import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const HOUSEHOLD_A = '00000000-0000-4000-8000-00000000000a'
const HOUSEHOLD_B = '00000000-0000-4000-8000-00000000000b'

const testDirectory = fileURLToPath(new URL('.', import.meta.url))
const schemaPath = new URL('./schema.sql', import.meta.url)
const migrationPath = new URL(
  './migrations/20260726120000_academy_household_revision_cas.sql',
  import.meta.url,
)

function profileRow(id: string, name: string, updatedAt = '2026-07-26T12:00:00Z') {
  return {
    profile_id: id,
    data: { id, name },
    updated_at: updatedAt,
  }
}

describe('Academy household server revision CAS migration', () => {
  let database: PGlite
  let server: PGLiteSocketServer
  let clientA: pg.Client
  let clientB: pg.Client

  async function configureClient(client: pg.Client, householdId: string) {
    await client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
      householdId,
    ])
    await client.query('set role authenticated')
  }

  async function mutate(
    client: pg.Client,
    expectedRevision: number,
    mutationId: string,
    profiles: unknown[],
  ) {
    const result = await client.query<{ result: Record<string, unknown> }>(
      `select public.academy_apply_profile_mutation($1, $2, $3::jsonb) as result`,
      [expectedRevision, mutationId, JSON.stringify(profiles)],
    )
    return result.rows[0].result
  }

  async function snapshot(client: pg.Client) {
    const result = await client.query<{ result: Record<string, unknown> }>(
      'select public.academy_sync_snapshot() as result',
    )
    return result.rows[0].result
  }

  beforeAll(async () => {
    expect(testDirectory).toContain('supabase')
    database = await PGlite.create()
    await database.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create or replace function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      insert into auth.users (id) values
        ('${HOUSEHOLD_A}'::uuid),
        ('${HOUSEHOLD_B}'::uuid);
    `)
    await database.exec(await readFile(schemaPath, 'utf8'))
    const migration = await readFile(migrationPath, 'utf8')
    await database.exec(migration)
    // The tracked migration must remain safe when the local migration runner
    // encounters it a second time.
    await database.exec(migration)

    server = new PGLiteSocketServer({
      db: database,
      host: '127.0.0.1',
      port: 0,
      maxConnections: 4,
    })
    await server.start()
    const port = Number(server.getServerConn().split(':').at(-1))
    const connection = {
      host: '127.0.0.1',
      port,
      database: 'postgres',
      user: 'postgres',
      ssl: false,
    }
    clientA = new pg.Client(connection)
    clientB = new pg.Client(connection)
    await Promise.all([clientA.connect(), clientB.connect()])
    await configureClient(clientA, HOUSEHOLD_A)
    await configureClient(clientB, HOUSEHOLD_A)
  }, 60_000)

  afterAll(async () => {
    await Promise.allSettled([clientA?.end(), clientB?.end()])
    await server?.stop()
    await database?.close()
  })

  it('allows exactly one of two clients to consume the same empty-cloud revision', async () => {
    const [first, second] = await Promise.all([
      mutate(clientA, 0, 'empty-a', [profileRow('p1', 'First')]),
      mutate(clientB, 0, 'empty-b', [profileRow('p1', 'Second')]),
    ])
    expect([first.status, second.status].sort()).toEqual(['applied', 'conflict'])
    expect(first.revision).toBe('1')
    expect(second.revision).toBe('1')
    expect((await snapshot(clientA)).revision).toBe('1')
  })

  it('advances a nonzero revision once and returns a typed conflict to the loser', async () => {
    const [first, second] = await Promise.all([
      mutate(clientA, 1, 'revision-a', [profileRow('p2', 'First')]),
      mutate(clientB, 1, 'revision-b', [profileRow('p2', 'Second')]),
    ])
    expect([first.status, second.status].sort()).toEqual(['applied', 'conflict'])
    expect(first.revision).toBe('2')
    expect(second.revision).toBe('2')
  })

  it('replays the same mutation id without applying or incrementing twice', async () => {
    const payload = [profileRow('p3', 'Idempotent')]
    const applied = await mutate(clientA, 2, 'retry-a', payload)
    const replayed = await mutate(clientA, 2, 'retry-a', payload)
    expect(applied).toEqual({ status: 'applied', revision: '3' })
    expect(replayed).toEqual({ status: 'replayed', revision: '3' })
    expect((await snapshot(clientA)).revision).toBe('3')
  })

  it('performs no profile writes for a stale expected revision', async () => {
    const before = await snapshot(clientA)
    const conflict = await mutate(clientA, 2, 'stale-a', [
      profileRow('p4', 'Must not exist'),
    ])
    const after = await snapshot(clientA)
    expect(conflict).toEqual({ status: 'conflict', revision: '3' })
    expect(after).toEqual(before)
  })

  it('rolls back the entire multi-profile mutation when any row fails', async () => {
    await expect(
      mutate(clientA, 3, 'rollback-a', [
        profileRow('p4', 'Would otherwise write'),
        profileRow('p5', 'Invalid timestamp', 'not-a-date'),
      ]),
    ).rejects.toThrow()
    const current = await snapshot(clientA)
    expect(current.revision).toBe('3')
    expect(current.rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ profile_id: 'p4' }),
        expect.objectContaining({ profile_id: 'p5' }),
      ]),
    )
  })

  it('isolates authenticated households and derives identity without a caller household parameter', async () => {
    const householdB = new pg.Client({
      host: '127.0.0.1',
      port: Number(server.getServerConn().split(':').at(-1)),
      database: 'postgres',
      user: 'postgres',
      ssl: false,
    })
    await householdB.connect()
    try {
      await configureClient(householdB, HOUSEHOLD_B)
      expect(
        await mutate(householdB, 0, 'household-b-write', [
          profileRow('p1', 'Household B'),
        ]),
      ).toEqual({ status: 'applied', revision: '1' })
      // pglite-socket multiplexes one embedded PostgreSQL session, so its GUC
      // is intentionally reset before each isolation assertion. The two-client
      // CAS tests above still use distinct PostgreSQL protocol connections.
      await configureClient(clientA, HOUSEHOLD_A)
      const a = await snapshot(clientA)
      await configureClient(householdB, HOUSEHOLD_B)
      const b = await snapshot(householdB)
      expect(a.revision).toBe('3')
      expect(b.revision).toBe('1')
      expect(JSON.stringify(a)).not.toContain('Household B')
    } finally {
      await householdB.end()
    }
  })

  it('rejects missing authentication and anonymous execution', async () => {
    const unauthenticated = new pg.Client({
      host: '127.0.0.1',
      port: Number(server.getServerConn().split(':').at(-1)),
      database: 'postgres',
      user: 'postgres',
      ssl: false,
    })
    await unauthenticated.connect()
    try {
      await unauthenticated.query(
        `select set_config('request.jwt.claim.sub', '', false)`,
      )
      await unauthenticated.query('set role authenticated')
      await expect(
        mutate(unauthenticated, 0, 'missing-auth', [
          profileRow('p1', 'Rejected'),
        ]),
      ).rejects.toThrow()
      await unauthenticated.query('reset role')
      await unauthenticated.query('set role anon')
      await expect(
        unauthenticated.query('select public.academy_sync_snapshot()'),
      ).rejects.toThrow()
    } finally {
      await unauthenticated.end()
    }
  })

  it('removes the unconditional authenticated table-write path', async () => {
    await configureClient(clientA, HOUSEHOLD_A)
    await expect(
      clientA.query(
        `insert into public.profiles (profile_id, data)
         values ('p5', '{"id":"p5","name":"bypass"}'::jsonb)`,
      ),
    ).rejects.toThrow()
  })

  it('owns security-definer RPCs as postgres with fixed search paths and narrow grants', async () => {
    await clientA.query('reset role')
    const functions = await clientA.query<{
      name: string
      owner: string
      configuration: string[]
      acl: string
      arguments: string
    }>(`
      select procedure.proname as name,
             pg_get_userbyid(procedure.proowner) as owner,
             procedure.proconfig as configuration,
             coalesce(procedure.proacl::text, '') as acl,
             pg_get_function_identity_arguments(procedure.oid) as arguments
        from pg_catalog.pg_proc as procedure
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
       where namespace.nspname = 'public'
         and procedure.proname in (
           'academy_sync_snapshot',
           'academy_apply_profile_mutation'
         )
       order by procedure.proname
    `)
    expect(functions.rows).toHaveLength(2)
    for (const procedure of functions.rows) {
      expect(procedure.owner).toBe('postgres')
      expect(procedure.configuration).toContain(
        'search_path=pg_catalog, pg_temp',
      )
      expect(procedure.acl).toContain('authenticated=X/postgres')
      expect(procedure.acl).not.toMatch(/(^|[,{])=X\//)
    }
    expect(
      functions.rows.find(
        (procedure) => procedure.name === 'academy_apply_profile_mutation',
      )?.arguments,
    ).toBe(
      'p_expected_revision bigint, p_mutation_id text, p_profiles jsonb',
    )
    await clientA.query('set role authenticated')
  })

  it('leaves no residual fixture mutation beyond the expected household rows', async () => {
    await clientA.query('reset role')
    const result = await clientA.query<{ count: string }>(
      `select count(*)::text as count
         from public.profiles
        where household_id not in ($1::uuid, $2::uuid)`,
      [HOUSEHOLD_A, HOUSEHOLD_B],
    )
    expect(result.rows[0].count).toBe('0')
    await clientA.query('set role authenticated')
  })
})
