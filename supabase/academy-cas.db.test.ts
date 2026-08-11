import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultAppState } from '../src/migration'
import { academyProfileContractFixtures } from './academy-profile-contract.fixtures'

const HOUSEHOLD_A = '00000000-0000-4000-8000-00000000000a'
const HOUSEHOLD_B = '00000000-0000-4000-8000-00000000000b'
const HOUSEHOLD_C = '00000000-0000-4000-8000-00000000000c'

const testDirectory = fileURLToPath(new URL('.', import.meta.url))
const schemaPath = new URL('./schema.sql', import.meta.url)
const migrationPath = new URL(
  './migrations/20260726120000_academy_household_revision_cas.sql',
  import.meta.url,
)
const logicalVoiceMigrationPath = new URL(
  './migrations/20260809150000_academy_logical_voice_profile_contract.sql',
  import.meta.url,
)

function profileRow(
  id: string,
  name: string,
  updatedAt = '2026-07-26T12:00:00Z',
) {
  const profile = structuredClone(defaultAppState().profiles[id])
  if (!profile) throw new Error(`Missing test profile ${id}.`)
  profile.name = name
  return {
    profile_id: id,
    data: profile,
    updated_at: updatedAt,
  }
}

describe('Academy household server revision CAS migration', () => {
  let database: PGlite
  let server: PGLiteSocketServer
  let clientA: pg.Client
  let clientB: pg.Client
  let connection: pg.ClientConfig

  async function configureClient(client: pg.Client, householdId: string) {
    await client.query(
      `select set_config('request.jwt.claim.sub', $1, false)`,
      [householdId],
    )
    await client.query('set role authenticated')
  }

  async function mutate(
    client: pg.Client,
    expectedRevision: number,
    mutationId: string,
    profiles: unknown[],
  ) {
    const result = await client.query<{ result: Record<string, unknown> }>(
      // Expected mutation failures are part of this suite. Keep them on the
      // simple-query protocol because pglite-socket multiplexes one embedded
      // protocol engine and can emit stale extended-protocol completion
      // messages after an error. The real multi-backend PostgreSQL suite uses
      // bound parameters; all literals here are escaped by node-postgres.
      `select public.academy_apply_profile_mutation(
         ${expectedRevision},
         ${client.escapeLiteral(mutationId)},
         ${client.escapeLiteral(JSON.stringify(profiles))}::jsonb
       ) as result`,
    )
    return result.rows[0].result
  }

  async function mutateJson(
    client: pg.Client,
    expectedRevision: number,
    mutationId: string,
    profilesJson: string,
  ) {
    const result = await client.query<{ result: Record<string, unknown> }>(
      `select public.academy_apply_profile_mutation(
         ${expectedRevision},
         ${client.escapeLiteral(mutationId)},
         ${client.escapeLiteral(profilesJson)}::jsonb
       ) as result`,
    )
    return result.rows[0].result
  }

  async function snapshot(client: pg.Client) {
    const result = await client.query<{ result: Record<string, unknown> }>(
      'select public.academy_sync_snapshot() as result',
    )
    return result.rows[0].result
  }

  async function withIsolatedClient<T>(
    householdId: string,
    callback: (client: pg.Client) => Promise<T>,
  ): Promise<T> {
    const client = new pg.Client({
      ...connection,
      // Reject a single stuck socket query before the surrounding bounded
      // structural-limit test can time out.
      query_timeout: 20_000,
    })
    let operationError: unknown
    try {
      await client.connect()
      await configureClient(client, householdId)
      return await callback(client)
    } catch (cause) {
      operationError = cause
      throw cause
    } finally {
      try {
        await client.end()
      } catch (cleanupError) {
        if (operationError) {
          throw new AggregateError(
            [operationError, cleanupError],
            'Academy PGlite operation and isolated-client cleanup both failed.',
          )
        }
        throw cleanupError
      }
    }
  }

  beforeAll(async () => {
    expect(testDirectory).toContain('supabase')
    database = await PGlite.create()
    await database.exec(`
      create role anon;
      create role authenticated;
      create role service_role nologin bypassrls;
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
        ('${HOUSEHOLD_B}'::uuid),
        ('${HOUSEHOLD_C}'::uuid);
    `)
    await database.exec(await readFile(schemaPath, 'utf8'))
    const migration = await readFile(migrationPath, 'utf8')
    await database.exec(migration)
    // The tracked migration must remain safe when the local migration runner
    // encounters it a second time.
    await database.exec(migration)
    const logicalVoiceMigration = await readFile(logicalVoiceMigrationPath, 'utf8')
    await database.exec(logicalVoiceMigration)
    await database.exec(logicalVoiceMigration)

    server = new PGLiteSocketServer({
      db: database,
      host: '127.0.0.1',
      port: 0,
      maxConnections: 4,
    })
    await server.start()
    const port = Number(server.getServerConn().split(':').at(-1))
    connection = {
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
    const errors: unknown[] = []
    const clients = await Promise.allSettled([clientA?.end(), clientB?.end()])
    for (const result of clients) {
      if (result.status === 'rejected') errors.push(result.reason)
    }
    try {
      await server?.stop()
    } catch (cause) {
      errors.push(cause)
    }
    try {
      await database?.close()
    } catch (cause) {
      errors.push(cause)
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Academy PGlite cleanup failed.')
    }
  }, 30_000)

  it('allows exactly one of two clients to consume the same empty-cloud revision', async () => {
    const [first, second] = await Promise.all([
      mutate(clientA, 0, 'empty-a', [profileRow('p1', 'First')]),
      mutate(clientB, 0, 'empty-b', [profileRow('p1', 'Second')]),
    ])
    expect([first.status, second.status].sort()).toEqual([
      'applied',
      'conflict',
    ])
    expect(first.revision).toBe('1')
    expect(second.revision).toBe('1')
    expect((await snapshot(clientA)).revision).toBe('1')
  })

  it('advances a nonzero revision once and returns a typed conflict to the loser', async () => {
    const [first, second] = await Promise.all([
      mutate(clientA, 1, 'revision-a', [profileRow('p2', 'First')]),
      mutate(clientB, 1, 'revision-b', [profileRow('p2', 'Second')]),
    ])
    expect([first.status, second.status].sort()).toEqual([
      'applied',
      'conflict',
    ])
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

  it('rejects altered payload or expected revision under an applied mutation id', async () => {
    await configureClient(clientA, HOUSEHOLD_A)
    await expect(
      mutate(clientA, 2, 'retry-a', [profileRow('p3', 'Altered')]),
    ).rejects.toThrow(/reused with different input/)
    await expect(
      mutate(clientA, 3, 'retry-a', [profileRow('p3', 'Idempotent')]),
    ).rejects.toThrow(/reused with different input/)
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

  it('persists an immutable conflict receipt and replays its original result', async () => {
    await configureClient(clientA, HOUSEHOLD_C)
    expect(
      await mutate(clientA, 0, 'c-applied', [profileRow('p1', 'Baseline')]),
    ).toEqual({ status: 'applied', revision: '1' })
    const conflictingPayload = [profileRow('p2', 'Conflict payload')]
    expect(await mutate(clientA, 0, 'c-conflict', conflictingPayload)).toEqual({
      status: 'conflict',
      revision: '1',
    })
    expect(
      await mutate(clientA, 1, 'c-advance', [profileRow('p3', 'Advance')]),
    ).toEqual({ status: 'applied', revision: '2' })
    expect(await mutate(clientA, 0, 'c-conflict', conflictingPayload)).toEqual({
      status: 'conflict',
      revision: '1',
      replayed: true,
    })
    await expect(
      mutate(clientA, 1, 'c-conflict', conflictingPayload),
    ).rejects.toThrow(/reused with different input/)
    await expect(
      mutate(clientA, 0, 'c-conflict', [profileRow('p2', 'Altered')]),
    ).rejects.toThrow(/reused with different input/)
    expect((await snapshot(clientA)).revision).toBe('2')
    await clientA.query('reset role')
    const receipt = await clientA.query<{
      result_type: string
      observed_revision: string
      resulting_revision: string | null
    }>(
      `select result_type, observed_revision::text, resulting_revision::text
         from public.academy_household_sync_mutations
        where household_id = $1::uuid and mutation_id = 'c-conflict'`,
      [HOUSEHOLD_C],
    )
    expect(receipt.rows).toEqual([
      {
        result_type: 'conflict',
        observed_revision: '1',
        resulting_revision: null,
      },
    ])
    await configureClient(clientA, HOUSEHOLD_A)
  })

  it('enforces the shared Academy profile contract before writes or receipts', async () => {
    await configureClient(clientA, HOUSEHOLD_C)
    const before = await snapshot(clientA)
    for (const [index, fixture] of academyProfileContractFixtures().entries()) {
      const row = {
        profile_id: fixture.profileId,
        data: fixture.data,
        updated_at: '2026-07-26T12:00:00Z',
      }
      await clientA.query('reset role')
      const result = await clientA.query<{ valid: boolean }>(
        `select public.academy_sync_profile_is_valid($1, $2::jsonb) as valid`,
        [fixture.profileId, JSON.stringify(fixture.data)],
      )
      expect(result.rows[0].valid, fixture.name).toBe(fixture.valid)
      await configureClient(clientA, HOUSEHOLD_C)
      if (fixture.valid) {
        continue
      }
      await expect(
        mutate(clientA, Number(before.revision), `invalid-${index}`, [row]),
        fixture.name,
      ).rejects.toThrow(/invalid row/)
    }
    expect(await snapshot(clientA)).toEqual(before)
    await clientA.query('reset role')
    const receipts = await clientA.query<{ count: string }>(
      `select count(*)::text as count
         from public.academy_household_sync_mutations
        where household_id = $1::uuid and mutation_id like 'invalid-%'`,
      [HOUSEHOLD_C],
    )
    expect(receipts.rows[0].count).toBe('0')
    await configureClient(clientA, HOUSEHOLD_A)
  })

  it('validates the additive logical voice profile contract without rewriting legacy data', async () => {
    await clientA.query('reset role')
    const base = structuredClone(defaultAppState().profiles.p1) as Record<string, unknown>
    const valid = structuredClone(base) as Record<string, any>
    valid.tutor = {
      voiceMap: { default: { provider: 'elevenlabs', ref: 'historical-preserved', label: 'Hidden' } },
      voiceSelections: {
        default: {
          kind: 'catalog', voiceRef: 'academy.tts.synthetic-db',
          voiceVersion: 'v1', displayLabel: 'Synthetic DB voice',
        },
      },
    }
    const invalid = structuredClone(valid)
    invalid.tutor.voiceSelections.default.provider = 'elevenlabs'
    const result = await clientA.query<{ valid: boolean; invalid: boolean }>(
      `select
         public.academy_sync_logical_voice_contract_is_valid($1::jsonb) as valid,
         public.academy_sync_logical_voice_contract_is_valid($2::jsonb) as invalid`,
      [JSON.stringify(valid), JSON.stringify(invalid)],
    )
    expect(result.rows).toEqual([{ valid: true, invalid: false }])
    expect(valid.tutor.voiceMap.default.ref).toBe('historical-preserved')
    const constraint = await clientA.query<{ validated: boolean }>(
      `select convalidated as validated
         from pg_catalog.pg_constraint
        where conrelid = 'public.profiles'::regclass
          and conname = 'profiles_logical_voice_contract_check'`,
    )
    expect(constraint.rows).toEqual([{ validated: true }])
    await configureClient(clientA, HOUSEHOLD_A)
  })

  it.each([
    ['positive infinity timestamp', 'infinity'],
    ['negative infinity timestamp', '-infinity'],
    ['free-form timestamp', 'July 26, 2026'],
    ['date-only timestamp', '2026-07-26'],
  ])('rejects %s transactionally', async (_label, updatedAt) => {
    await configureClient(clientA, HOUSEHOLD_C)
    const before = await snapshot(clientA)
    await expect(
      mutate(clientA, Number(before.revision), `bad-time-${updatedAt}`, [
        profileRow('p4', 'Bad time', updatedAt),
      ]),
    ).rejects.toThrow(/invalid row|mutation id is invalid/)
    expect(await snapshot(clientA)).toEqual(before)
  })

  it('rejects invalid profile envelopes without revision or receipt changes', async () => {
    await configureClient(clientA, HOUSEHOLD_C)
    const before = await snapshot(clientA)
    const mismatch = profileRow('p1', 'Mismatch')
    mismatch.data.id = 'p2'
    const sixRows = [
      profileRow('p1', 'One'),
      profileRow('p2', 'Two'),
      profileRow('p3', 'Three'),
      profileRow('p4', 'Four'),
      profileRow('p5', 'Five'),
      profileRow('p1', 'Six'),
    ]
    for (const [id, payload] of [
      ['id-mismatch', [mismatch]],
      [
        'duplicate-profile-id',
        [profileRow('p1', 'One'), profileRow('p1', 'Two')],
      ],
      ['too-many-profiles', sixRows],
      [
        'reserved-profile-id',
        [
          {
            profile_id: '__proto__',
            data: { ...profileRow('p1', 'Reserved').data, id: '__proto__' },
            updated_at: '2026-07-26T12:00:00Z',
          },
        ],
      ],
    ] as const) {
      await expect(
        mutate(clientA, Number(before.revision), id, [...payload]),
      ).rejects.toThrow()
      expect(await snapshot(clientA)).toEqual(before)
    }
    await clientA.query('reset role')
    const receipts = await clientA.query<{ count: string }>(
      `select count(*)::text as count
         from public.academy_household_sync_mutations
        where household_id = $1::uuid
          and mutation_id in (
            'id-mismatch', 'duplicate-profile-id', 'too-many-profiles',
            'reserved-profile-id'
          )`,
      [HOUSEHOLD_C],
    )
    expect(receipts.rows[0].count).toBe('0')
  })

  it('rejects reserved nested keys, huge JavaScript-incompatible numerics, and mixed invalid rows', async () => {
    await configureClient(clientA, HOUSEHOLD_C)
    const before = await snapshot(clientA)
    const valid = profileRow('p4', 'Valid')
    const reserved = structuredClone(valid)
    reserved.data.skills = JSON.parse(
      '{"__proto__":{"attempts":1,"correct":1,"mastery":1}}',
    )
    await expect(
      mutate(clientA, Number(before.revision), 'reserved-nested', [reserved]),
    ).rejects.toThrow()
    const hugeNumericJson = JSON.stringify([
      profileRow('p5', 'Huge numeric'),
    ]).replace('"sessions":0', '"sessions":1e400')
    await expect(
      mutateJson(
        clientA,
        Number(before.revision),
        'huge-numeric',
        hugeNumericJson,
      ),
    ).rejects.toThrow()
    const malformed = profileRow('p5', 'Malformed')
    delete (malformed.data as Partial<typeof malformed.data>).totals
    await expect(
      mutate(clientA, Number(before.revision), 'mixed-invalid', [
        valid,
        malformed,
      ]),
    ).rejects.toThrow()
    expect(await snapshot(clientA)).toEqual(before)
  })

  it('enforces depth, entry, key, string, and total-payload limits before receipts', async () => {
    await withIsolatedClient(HOUSEHOLD_C, async (limitClient) => {
      const before = await snapshot(limitClient)
      const deep = profileRow('p4', 'Deep') as ReturnType<typeof profileRow> & {
        data: Record<string, unknown>
      }
      let nested: Record<string, unknown> = {}
      deep.data.additive = nested
      for (let index = 0; index < 129; index += 1) {
        nested.next = {}
        nested = nested.next as Record<string, unknown>
      }
      const excessiveArray = profileRow('p4', 'Array') as ReturnType<
        typeof profileRow
      > & { data: Record<string, unknown> }
      excessiveArray.data.additive = Array.from({ length: 50_001 }, () => 0)
      const oversizedKey = profileRow('p4', 'Key') as ReturnType<
        typeof profileRow
      > & { data: Record<string, unknown> }
      oversizedKey.data['k'.repeat(257)] = true
      const oversizedString = profileRow('p4', 'String') as ReturnType<
        typeof profileRow
      > & { data: Record<string, unknown> }
      oversizedString.data.additive = 'x'.repeat(1_000_001)
      const excessiveObject = profileRow('p4', 'Object') as ReturnType<
        typeof profileRow
      > & { data: Record<string, unknown> }
      excessiveObject.data.additive = Object.fromEntries(
        Array.from({ length: 50_001 }, (_, index) => [`key-${index}`, index]),
      )
      const excessiveNodes = profileRow('p4', 'Nodes') as ReturnType<
        typeof profileRow
      > & { data: Record<string, unknown> }
      excessiveNodes.data.additive = Array.from({ length: 10_001 }, () =>
        Array.from({ length: 50 }, () => 0),
      )
      for (const [id, row] of [
        ['deep-profile', deep],
        ['excessive-array', excessiveArray],
        ['excessive-object', excessiveObject],
        ['excessive-nodes', excessiveNodes],
        ['oversized-key', oversizedKey],
        ['oversized-string', oversizedString],
      ] as const) {
        await expect(
          mutate(limitClient, Number(before.revision), id, [row]),
        ).rejects.toThrow()
        expect(await snapshot(limitClient)).toEqual(before)
      }
      const overPayload = profileRow('p4', 'Payload') as ReturnType<
        typeof profileRow
      > & { data: Record<string, unknown> }
      overPayload.data.additive = 'x'.repeat(10_000_001)
      await expect(
        mutate(limitClient, Number(before.revision), 'over-payload', [
          overPayload,
        ]),
      ).rejects.toThrow()
      await limitClient.query('reset role')
      const receipts = await limitClient.query<{ count: string }>(
        `select count(*)::text as count
           from public.academy_household_sync_mutations
          where household_id = $1::uuid
            and mutation_id in (
              'deep-profile', 'excessive-array', 'oversized-key',
              'excessive-object', 'excessive-nodes', 'oversized-string',
              'over-payload'
            )`,
        [HOUSEHOLD_C],
      )
      expect(receipts.rows[0].count).toBe('0')
    })
    // Recursive node and 10 MB payload probes are intentionally expensive in
    // PGlite. Keep only this isolated proof above Vitest's five-second default.
  }, 30_000)

  it('rolls back the entire multi-profile mutation when any row fails', async () => {
    await configureClient(clientA, HOUSEHOLD_A)
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

  it('keeps the same mutation id independent between households', async () => {
    await configureClient(clientA, HOUSEHOLD_B)
    const beforeB = await snapshot(clientA)
    expect(
      await mutate(clientA, Number(beforeB.revision), 'shared-household-id', [
        profileRow('p2', 'Household B shared ID'),
      ]),
    ).toEqual({
      status: 'applied',
      revision: String(Number(beforeB.revision) + 1),
    })
    await configureClient(clientA, HOUSEHOLD_C)
    const beforeC = await snapshot(clientA)
    expect(
      await mutate(clientA, Number(beforeC.revision), 'shared-household-id', [
        profileRow('p2', 'Household C shared ID'),
      ]),
    ).toEqual({
      status: 'applied',
      revision: String(Number(beforeC.revision) + 1),
    })
    await clientA.query('reset role')
    const receipts = await clientA.query<{
      household_id: string
      count: string
    }>(
      `select household_id::text, count(*)::text as count
         from public.academy_household_sync_mutations
        where mutation_id = 'shared-household-id'
        group by household_id
        order by household_id`,
    )
    expect(receipts.rows).toEqual([
      { household_id: HOUSEHOLD_B, count: '1' },
      { household_id: HOUSEHOLD_C, count: '1' },
    ])
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
    ).toBe('p_expected_revision bigint, p_mutation_id text, p_profiles jsonb')
    const helpers = await clientA.query<{
      name: string
      owner: string
      configuration: string[]
      acl: string
    }>(`
      select procedure.proname as name,
             pg_get_userbyid(procedure.proowner) as owner,
             procedure.proconfig as configuration,
             coalesce(procedure.proacl::text, '') as acl
        from pg_catalog.pg_proc as procedure
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
       where namespace.nspname = 'public'
         and procedure.proname in (
           'academy_sync_is_text',
           'academy_sync_is_number',
           'academy_sync_is_date',
           'academy_sync_is_timestamp',
           'academy_sync_json_within_limits',
           'academy_sync_profile_is_valid'
         )
    `)
    expect(helpers.rows).toHaveLength(6)
    for (const helper of helpers.rows) {
      expect(helper.owner).toBe('postgres')
      expect(helper.configuration).toContain('search_path=pg_catalog, pg_temp')
      expect(helper.acl).not.toMatch(/(^|[,{])=X\//)
      expect(helper.acl).not.toContain('authenticated=X/')
      expect(helper.acl).not.toContain('anon=X/')
    }
    await clientA.query('set role authenticated')
  })

  it('leaves no residual fixture mutation beyond the expected household rows', async () => {
    await clientA.query('reset role')
    const result = await clientA.query<{ count: string }>(
      `select count(*)::text as count
         from public.profiles
        where household_id not in ($1::uuid, $2::uuid, $3::uuid)`,
      [HOUSEHOLD_A, HOUSEHOLD_B, HOUSEHOLD_C],
    )
    expect(result.rows[0].count).toBe('0')
    await clientA.query('set role authenticated')
  })
})

describe('Academy CAS migration over preexisting household profiles', () => {
  it('preserves rows and uses intentional lazy revision zero with partial upserts', async () => {
    const database = await PGlite.create()
    try {
      await database.exec(`
        create role anon;
        create role authenticated;
        create role service_role nologin bypassrls;
        create schema auth;
        create table auth.users (id uuid primary key);
        create or replace function auth.uid()
        returns uuid
        language sql
        stable
        as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
        insert into auth.users (id) values ('${HOUSEHOLD_A}'::uuid);
      `)
      await database.exec(await readFile(schemaPath, 'utf8'))
      const first = profileRow('p1', 'Existing One', '2026-07-20T10:00:00Z')
      const second = profileRow('p2', 'Existing Two', '2026-07-21T11:00:00Z')
      await database.query(
        `insert into public.profiles (
           household_id, profile_id, data, updated_at
         ) values
           ($1::uuid, $2, $3::jsonb, $4::timestamptz),
           ($1::uuid, $5, $6::jsonb, $7::timestamptz)`,
        [
          HOUSEHOLD_A,
          first.profile_id,
          JSON.stringify(first.data),
          first.updated_at,
          second.profile_id,
          JSON.stringify(second.data),
          second.updated_at,
        ],
      )
      const before = await database.query<{
        profile_id: string
        data: unknown
        updated_at: Date
      }>(
        `select profile_id, data, updated_at
           from public.profiles
          where household_id = $1::uuid
          order by profile_id`,
        [HOUSEHOLD_A],
      )

      const migration = await readFile(migrationPath, 'utf8')
      await database.exec(migration)
      const stateBeforeFirstMutation = await database.query<{ count: number }>(
        `select count(*)::integer as count
           from public.academy_household_sync_state`,
      )
      expect(stateBeforeFirstMutation.rows[0].count).toBe(0)
      await database.query(
        `select set_config('request.jwt.claim.sub', $1, false)`,
        [HOUSEHOLD_A],
      )
      await database.exec('set role authenticated')
      const snapshot = await database.query<{
        result: Record<string, unknown>
      }>(`select public.academy_sync_snapshot() as result`)
      expect(snapshot.rows[0].result).toMatchObject({
        revision: '0',
        rows: expect.arrayContaining([
          expect.objectContaining({ profile_id: 'p1' }),
          expect.objectContaining({ profile_id: 'p2' }),
        ]),
      })
      const replacement = profileRow(
        'p1',
        'Updated One',
        '2026-07-26T12:00:00Z',
      )
      const applied = await database.query<{
        result: Record<string, unknown>
      }>(
        `select public.academy_apply_profile_mutation(
           0, 'existing-first', $1::jsonb
         ) as result`,
        [JSON.stringify([replacement])],
      )
      expect(applied.rows[0].result).toEqual({
        status: 'applied',
        revision: '1',
      })
      await database.exec('reset role')
      const after = await database.query<{
        profile_id: string
        data: { name: string }
        updated_at: Date
      }>(
        `select profile_id, data, updated_at
           from public.profiles
          where household_id = $1::uuid
          order by profile_id`,
        [HOUSEHOLD_A],
      )
      expect(after.rows).toHaveLength(2)
      expect(after.rows[0].data.name).toBe('Updated One')
      expect(after.rows[1]).toEqual(before.rows[1])

      await database.exec(migration)
      const afterRerun = await database.query<{
        profile_id: string
        data: { name: string }
        updated_at: Date
      }>(
        `select profile_id, data, updated_at
           from public.profiles
          where household_id = $1::uuid
          order by profile_id`,
        [HOUSEHOLD_A],
      )
      expect(afterRerun.rows).toEqual(after.rows)
      const state = await database.query<{
        revision: string
        receipts: string
      }>(
        `select state.revision::text,
                (
                  select count(*)::text
                    from public.academy_household_sync_mutations
                   where household_id = state.household_id
                ) as receipts
           from public.academy_household_sync_state as state
          where household_id = $1::uuid`,
        [HOUSEHOLD_A],
      )
      expect(state.rows).toEqual([{ revision: '1', receipts: '1' }])
    } finally {
      await database.close()
    }
  })

  it('rejects incompatible unreleased receipt-table drift instead of accepting it', async () => {
    const database = await PGlite.create()
    try {
      await database.exec(`
        create role anon;
        create role authenticated;
        create role service_role nologin bypassrls;
        create schema auth;
        create table auth.users (id uuid primary key);
        create or replace function auth.uid()
        returns uuid
        language sql
        stable
        as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
      `)
      await database.exec(await readFile(schemaPath, 'utf8'))
      await database.exec(`
        create table public.academy_household_sync_mutations (
          household_id uuid not null references auth.users (id),
          mutation_id text not null,
          expected_revision bigint not null,
          resulting_revision bigint not null,
          payload jsonb not null,
          applied_at timestamptz not null default now(),
          primary key (household_id, mutation_id)
        );
      `)
      await expect(
        database.exec(await readFile(migrationPath, 'utf8')),
      ).rejects.toThrow(/receipt schema is incompatible/)
    } finally {
      await database.close()
    }
  })
})
