import type { ChildProcess } from 'node:child_process'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultAppState } from '../src/migration'

const HOUSEHOLD_A = '00000000-0000-4000-8000-00000000000a'
const HOUSEHOLD_B = '00000000-0000-4000-8000-00000000000b'
const schemaPath = new URL('./schema.sql', import.meta.url)
const migrationPath = new URL(
  './migrations/20260726120000_academy_household_revision_cas.sql',
  import.meta.url,
)
const WINDOWS_CLEANUP_TIMEOUT_MS = 10_000
const WINDOWS_CLEANUP_RETRY_MS = 100

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function waitForProcessExit(process: ChildProcess) {
  if (process.exitCode !== null || process.signalCode !== null) return
  await new Promise<void>((resolve, reject) => {
    const exited = () => {
      clearTimeout(timeout)
      resolve()
    }
    const timeout = setTimeout(() => {
      process.removeListener('exit', exited)
      reject(new Error('Academy PostgreSQL process did not exit in time.'))
    }, WINDOWS_CLEANUP_TIMEOUT_MS)
    process.once('exit', exited)
    if (process.exitCode !== null || process.signalCode !== null) {
      process.removeListener('exit', exited)
      clearTimeout(timeout)
      resolve()
    }
  })
  if (process.exitCode === null && process.signalCode === null) {
    throw new Error('Academy PostgreSQL process still appears to be running.')
  }
}

async function removeDatabaseDirectory(databaseDir: string) {
  const deadline = Date.now() + WINDOWS_CLEANUP_TIMEOUT_MS
  while (true) {
    try {
      await rm(databaseDir, { recursive: true, force: true })
      try {
        await access(databaseDir)
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return
        throw cause
      }
      throw new Error('Academy PostgreSQL directory still exists after removal.')
    } catch (cause) {
      const code = (cause as NodeJS.ErrnoException).code
      if (
        !['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(code ?? '') ||
        Date.now() >= deadline
      ) {
        throw cause
      }
      await delay(WINDOWS_CLEANUP_RETRY_MS)
    }
  }
}

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate an Academy PostgreSQL test port.'))
        return
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

function profileRow(id: string, name: string) {
  const profile = structuredClone(defaultAppState().profiles[id])
  if (!profile) throw new Error(`Missing test profile ${id}.`)
  profile.name = name
  return {
    profile_id: id,
    data: profile,
    updated_at: '2026-07-26T12:00:00Z',
  }
}

describe('Academy CAS on independent PostgreSQL backends', () => {
  let databaseDir: string
  let server: EmbeddedPostgres
  let controller: pg.Client
  let clientA: pg.Client
  let clientB: pg.Client
  let serverProcess: ChildProcess | undefined
  let cleanupPromise: Promise<void> | null = null

  async function cleanupServer() {
    if (cleanupPromise) return cleanupPromise
    cleanupPromise = (async () => {
      const errors: unknown[] = []
      const clients = await Promise.allSettled([
        controller?.end(),
        clientA?.end(),
        clientB?.end(),
      ])
      for (const result of clients) {
        if (result.status === 'rejected') errors.push(result.reason)
      }
      try {
        if (server) await server.stop()
      } catch (cause) {
        errors.push(cause)
      }
      try {
        if (serverProcess) await waitForProcessExit(serverProcess)
      } catch (cause) {
        errors.push(cause)
      }
      try {
        if (databaseDir) await removeDatabaseDirectory(databaseDir)
      } catch (cause) {
        errors.push(cause)
      }
      if (errors.length > 0) {
        throw new AggregateError(errors, 'Academy PostgreSQL cleanup failed.')
      }
    })()
    return cleanupPromise
  }

  async function configure(client: pg.Client, householdId: string) {
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
    name: string,
  ) {
    return mutatePayload(
      client,
      expectedRevision,
      mutationId,
      JSON.stringify([profileRow('p1', name)]),
    )
  }

  async function mutatePayload(
    client: pg.Client,
    expectedRevision: number,
    mutationId: string,
    payload: string,
  ) {
    const result = await client.query<{ result: Record<string, unknown> }>(
      `select public.academy_apply_profile_mutation($1, $2, $3::jsonb) as result`,
      [expectedRevision, mutationId, payload],
    )
    return result.rows[0].result
  }

  async function waitForBlockedBackends(pids: number[]) {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const result = await controller.query<{
        pid: number
        wait_event_type: string | null
      }>(
        `select pid, wait_event_type
           from pg_catalog.pg_stat_activity
          where pid = any($1::integer[])`,
        [pids],
      )
      if (
        result.rows.length === pids.length &&
        result.rows.every((row) => row.wait_event_type === 'Lock')
      ) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error(
      'Independent Academy CAS backends did not block as expected.',
    )
  }

  beforeAll(async () => {
    try {
      databaseDir = await mkdtemp(join(tmpdir(), 'academy-postgres-cas-'))
      server = new EmbeddedPostgres({
        databaseDir,
        port: await availablePort(),
        user: 'postgres',
        password: 'academy-test-only',
        // The harness owns bounded, verified directory removal after the
        // library has stopped its tracked child process.
        persistent: true,
        initdbFlags: ['--encoding=UTF8', '--locale=C'],
        postgresFlags: [
          '-c',
          'listen_addresses=127.0.0.1',
          // PostgreSQL 18 defaults to a separate Windows io_worker process
          // that embedded-postgres can orphan after taskkill reports the
          // tracked postmaster exited. Synchronous I/O keeps every test
          // backend in the tracked server tree without changing CAS locking.
          '-c',
          'io_method=sync',
        ],
        onLog: () => undefined,
        onError: () => undefined,
      })
      await server.initialise()
      await server.start()
      serverProcess = (
        server as unknown as { process?: ChildProcess }
      ).process
      if (!serverProcess?.pid) {
        throw new Error('Academy PostgreSQL child process was not tracked.')
      }
      controller = server.getPgClient()
      clientA = server.getPgClient()
      clientB = server.getPgClient()
      await Promise.all([
        controller.connect(),
        clientA.connect(),
        clientB.connect(),
      ])
      await controller.query(`
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
        ('${HOUSEHOLD_B}'::uuid);
    `)
      await controller.query(await readFile(schemaPath, 'utf8'))
      await controller.query(await readFile(migrationPath, 'utf8'))
      await Promise.all([
        configure(clientA, HOUSEHOLD_A),
        configure(clientB, HOUSEHOLD_A),
      ])
    } catch (cause) {
      try {
        await cleanupServer()
      } catch (cleanupCause) {
        throw new AggregateError(
          [cause, cleanupCause],
          'Academy PostgreSQL setup and cleanup both failed.',
        )
      }
      throw cause
    }
  }, 120_000)

  afterAll(async () => {
    await cleanupServer()
  }, 60_000)

  it('uses genuinely distinct PostgreSQL backend processes', async () => {
    const [first, second, control] = await Promise.all([
      clientA.query<{ pid: number }>('select pg_backend_pid() as pid'),
      clientB.query<{ pid: number }>('select pg_backend_pid() as pid'),
      controller.query<{ pid: number }>('select pg_backend_pid() as pid'),
    ])
    expect(
      new Set([first.rows[0].pid, second.rows[0].pid, control.rows[0].pid])
        .size,
    ).toBe(3)
    console.info(
      `Academy CAS PostgreSQL backend PIDs: ${first.rows[0].pid}, ${second.rows[0].pid}, ${control.rows[0].pid}`,
    )
  })

  it('serializes two independent empty-household creators', async () => {
    await controller.query('begin')
    await controller.query(
      'lock table public.academy_household_sync_state in access exclusive mode',
    )
    const pids = await Promise.all([
      clientA.query<{ pid: number }>('select pg_backend_pid() as pid'),
      clientB.query<{ pid: number }>('select pg_backend_pid() as pid'),
    ])
    const first = mutate(clientA, 0, 'empty-real-a', 'Empty A')
    const second = mutate(clientB, 0, 'empty-real-b', 'Empty B')
    await waitForBlockedBackends(pids.map((result) => result.rows[0].pid))
    await controller.query('commit')
    const results = await Promise.all([first, second])

    expect(results.map((result) => result.status).sort()).toEqual([
      'applied',
      'conflict',
    ])
    const state = await controller.query<{ revision: string }>(
      `select revision::text
         from public.academy_household_sync_state
        where household_id = $1::uuid`,
      [HOUSEHOLD_A],
    )
    expect(state.rows[0].revision).toBe('1')
    const profiles = await controller.query<{ name: string }>(
      `select data->>'name' as name
         from public.profiles
        where household_id = $1::uuid`,
      [HOUSEHOLD_A],
    )
    expect(profiles.rows).toHaveLength(1)
    expect(['Empty A', 'Empty B']).toContain(profiles.rows[0].name)
  })

  it('allows exactly one backend to consume a nonzero revision', async () => {
    await controller.query('begin')
    await controller.query(
      `select revision
         from public.academy_household_sync_state
        where household_id = $1::uuid
        for update`,
      [HOUSEHOLD_A],
    )
    const pids = await Promise.all([
      clientA.query<{ pid: number }>('select pg_backend_pid() as pid'),
      clientB.query<{ pid: number }>('select pg_backend_pid() as pid'),
    ])
    const first = mutate(clientA, 1, 'nonzero-real-a', 'Nonzero A')
    const second = mutate(clientB, 1, 'nonzero-real-b', 'Nonzero B')
    await waitForBlockedBackends(pids.map((result) => result.rows[0].pid))
    await controller.query('commit')
    const results = await Promise.all([first, second])

    expect(results.map((result) => result.status).sort()).toEqual([
      'applied',
      'conflict',
    ])
    const state = await controller.query<{ revision: string }>(
      `select revision::text
         from public.academy_household_sync_state
        where household_id = $1::uuid`,
      [HOUSEHOLD_A],
    )
    expect(state.rows[0].revision).toBe('2')
    const profiles = await controller.query<{ name: string }>(
      `select data->>'name' as name
         from public.profiles
        where household_id = $1::uuid and profile_id = 'p1'`,
      [HOUSEHOLD_A],
    )
    expect(profiles.rows).toHaveLength(1)
    expect(['Nonzero A', 'Nonzero B']).toContain(profiles.rows[0].name)
  })

  it('applies concurrent identical retries only once', async () => {
    await controller.query('begin')
    await controller.query(
      `select revision
         from public.academy_household_sync_state
        where household_id = $1::uuid
        for update`,
      [HOUSEHOLD_A],
    )
    const pids = await Promise.all([
      clientA.query<{ pid: number }>('select pg_backend_pid() as pid'),
      clientB.query<{ pid: number }>('select pg_backend_pid() as pid'),
    ])
    const payload = JSON.stringify([profileRow('p1', 'Same retry')])
    const first = mutatePayload(clientA, 2, 'same-real-retry', payload)
    const second = mutatePayload(clientB, 2, 'same-real-retry', payload)
    await waitForBlockedBackends(pids.map((result) => result.rows[0].pid))
    await controller.query('commit')
    const results = await Promise.all([first, second])
    expect(results.map((result) => result.status).sort()).toEqual([
      'applied',
      'replayed',
    ])
    expect(results.every((result) => result.revision === '3')).toBe(true)
    const state = await controller.query<{
      revision: string
      receipts: string
    }>(
      `select state.revision::text,
              (
                select count(*)::text
                  from public.academy_household_sync_mutations as receipt
                 where receipt.household_id = state.household_id
                   and receipt.mutation_id = 'same-real-retry'
              ) as receipts
         from public.academy_household_sync_state as state
        where household_id = $1::uuid`,
      [HOUSEHOLD_A],
    )
    expect(state.rows).toEqual([{ revision: '3', receipts: '1' }])
  })
})
