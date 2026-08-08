import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Consolidated read-only academic readiness contract.
 *
 * Study production readiness names seven academic dependencies. Two of them —
 * study-session-adapter and checkpoint-adapter — are provable from the Netlify
 * operation surface, because `academy_study_execute_verified_runtime_v1` exposes
 * session:begin/session:transition and checkpoint:read/checkpoint:compare-and-swap.
 * The other five have no operation on that surface at all, and calendar's one
 * operation (`calendar:read`, capability student:assignments:read) is a read that
 * never touches the mutation contract the calendar adapter actually needs.
 *
 * Written RED before the migration existed. The `blind` suite below is the RED
 * proof and is permanent: it establishes that the readiness RPC which is actually
 * ready today cannot tell "schema present" from "required contract incomplete"
 * for any of the five. Those cases pass on both sides of the change. The
 * `academy_study_academic_readiness_v1` suites fail with the migration withheld
 * — the function is simply absent — and pass once it lands.
 *
 * No case writes a learner row to witness anything. Perturbations are DDL,
 * privilege and metadata changes inside a transaction that is always rolled back,
 * and one case pins that a readiness call leaves every academic table's row count
 * exactly where it found it.
 */
const ACADEMIC_MIGRATION =
  './migrations/20260808150000_academy_study_academic_readiness_contract.sql'

const chain = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  './migrations/20260806120000_academy_study_in_app_receipt_timestamp.sql',
  './migrations/20260806140000_academy_study_c2_operations_contract.sql',
  './migrations/20260808120000_academy_study_actor_bound_session_verification.sql',
  ACADEMIC_MIGRATION,
  './tests/study_engine_fixtures.sql',
] as const

const READINESS = 'public.academy_study_academic_readiness_v1()'

/** The closed dependency key set, in the order the RPC must return them. */
const ACADEMIC_DEPENDENCIES = [
  'study-session-adapter',
  'checkpoint-adapter',
  'review-queue',
  'calendar-adapter',
  'parent-settings-adapter',
  'adult-private-adapter',
  'event-ledger',
] as const

type AcademicDependency = typeof ACADEMIC_DEPENDENCIES[number]

/** Exact signatures the contract requires, by the dependency that requires them. */
const SHARED_ADULT_MANAGED =
  'public.academy_study_upsert_adult_managed_record(text,jsonb,bigint,text)'

const REQUIRED_FUNCTIONS: Readonly<Record<AcademicDependency, readonly string[]>> = {
  'study-session-adapter': [
    'public.academy_study_create_session(jsonb,text)',
    'public.academy_study_transition_session(text,bigint,text,timestamptz,text)',
  ],
  'checkpoint-adapter': [
    'public.academy_study_read_checkpoint(text)',
    'public.academy_study_compare_and_swap_checkpoint(text,bigint,text,jsonb)',
  ],
  'review-queue': [SHARED_ADULT_MANAGED],
  'calendar-adapter': [SHARED_ADULT_MANAGED],
  'parent-settings-adapter': [
    SHARED_ADULT_MANAGED,
    'public.academy_study_effective_settings(uuid,date)',
  ],
  'adult-private-adapter': [
    'public.academy_study_store_protected_work(jsonb)',
    'public.academy_study_read_protected_work(uuid,text,bigint)',
    'public.academy_study_append_adult_note(jsonb)',
    'public.academy_study_list_adult_note_metadata(uuid)',
    'public.academy_study_read_adult_note(uuid,text,bigint,uuid)',
  ],
  'event-ledger': ['public.academy_study_append_event(text,text,integer,text)'],
}

/** Every academic table the readiness contract reads metadata about. */
const ACADEMIC_TABLES = [
  'public.academy_study_sessions',
  'public.academy_study_checkpoints',
  'public.academy_study_reviews',
  'public.academy_study_calendar_blocks',
  'public.academy_study_parent_settings',
  // Accommodations is part of the contract because academy_study_effective_settings
  // composes it into the parent-settings answer, and because the shared
  // adult-managed ownership guard queries it on every call.
  'public.academy_study_accommodations',
  'public.academy_study_event_ledger',
  'academy_private.study_protected_learner_work',
  'academy_private.study_adult_notes',
] as const

const sources = Promise.all(chain.map(async (path) => {
  try {
    return await readFile(new URL(path, import.meta.url), 'utf8')
  } catch {
    // Only the not-yet-authored academic migration may be missing; a missing
    // predecessor must still fail loudly.
    if (path === ACADEMIC_MIGRATION) return ''
    throw new Error(`missing migration source: ${path}`)
  }
}))

let database: PGlite

const ACADEMIC_MIGRATION_INDEX = chain.indexOf(ACADEMIC_MIGRATION)

async function academicMigrationSource() {
  return (await sources)[ACADEMIC_MIGRATION_INDEX]
}

/** The full lineage up to and including actor binding, migration withheld. */
async function chainWithoutAcademicMigration() {
  const candidate = await PGlite.create()
  await candidate.exec(bootstrap)
  const loaded = await sources
  for (let index = 0; index < chain.length; index += 1) {
    if (index === ACADEMIC_MIGRATION_INDEX || !loaded[index]) continue
    await candidate.exec(loaded[index])
  }
  return candidate
}

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create table auth.users (id uuid primary key);
  create or replace function auth.uid()
  returns uuid language sql stable set search_path = pg_catalog as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub', '')::uuid
    )
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

async function asRole<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  subject: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({
    role: role === 'anon' ? 'authenticated' : role,
    ...(subject ? { sub: subject } : {}),
  })
  await database.exec(`
    select set_config('request.jwt.claim.sub', '${subject ?? ''}', false);
    select set_config('request.jwt.claims', '${claims.replaceAll("'", "''")}', false);
    select set_config('request.jwt.claim.role', '${role}', false);
    set role ${role};
  `)
  try {
    return await operation()
  } finally {
    try {
      await database.exec(`
        reset role;
        select set_config('request.jwt.claim.sub', '', false);
        select set_config('request.jwt.claims', '', false);
        select set_config('request.jwt.claim.role', '', false);
      `)
    } catch {
      // A failure inside an open transaction aborts the session and this cleanup
      // cannot run. Letting it throw would replace the real failure with
      // "current transaction is aborted"; the caller's rollback restores it.
    }
  }
}

async function rpc<T>(statement: string, parameters: unknown[] = []) {
  const result = await database.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

/** Runs perturbations against the shared chain and unwinds them. DDL included. */
async function reverted<T>(operation: () => Promise<T>): Promise<T> {
  await database.exec('begin')
  try {
    return await operation()
  } finally {
    await database.exec('rollback')
  }
}

interface AcademicReadiness {
  schemaVersion: number
  contractVersion: number
  status: string
  dependencies: Record<string, string>
}

/** The consolidated read-only academic readiness contract, as the server calls it. */
async function academicReadiness() {
  return asRole('service_role', null, () =>
    rpc<AcademicReadiness>(`select ${READINESS} as result`))
}

/** The pre-existing readiness RPC that is genuinely ready on this lineage. */
async function verifiedIdentityReadiness() {
  return asRole('service_role', null, () => rpc<Record<string, unknown>>(
    'select public.academy_study_verified_identity_readiness_v1() as result',
  ))
}

async function safetyDurableReadiness() {
  return asRole('service_role', null, () => rpc<Record<string, unknown>>(
    'select public.academy_study_safety_durable_readiness_v1() as result',
  ))
}

async function regprocedureExists(signature: string) {
  const result = await database.query<{ present: boolean }>(
    'select to_regprocedure($1) is not null as present',
    [signature],
  )
  return result.rows[0].present
}

async function hasExecute(role: string, signature: string) {
  const result = await database.query<{ allowed: boolean }>(
    "select has_function_privilege($1, $2, 'EXECUTE') as allowed",
    [role, signature],
  )
  return result.rows[0].allowed
}

/** Row counts for every academic table, used to prove readiness mutates nothing. */
async function academicRowCounts() {
  const counts: Record<string, number> = {}
  for (const table of ACADEMIC_TABLES) {
    const result = await database.query<{ total: number }>(
      `select count(*)::int as total from ${table}`,
    )
    counts[table] = result.rows[0].total
  }
  return counts
}

/**
 * Every dependency ready except the named ones. Written as a whole-object
 * expectation rather than per-key assertions so that a perturbation which
 * silently knocks out a second dependency cannot pass unnoticed.
 */
function allReadyExcept(...notReady: readonly AcademicDependency[]) {
  return Object.fromEntries(ACADEMIC_DEPENDENCIES.map((dependency) =>
    [dependency, notReady.includes(dependency) ? 'not-ready' : 'ready']))
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  for (const source of await sources) if (source) await database.exec(source)
}, 180_000)

afterAll(async () => {
  await database?.close()
})

describe.sequential('consolidated academic readiness contract', () => {
  /**
   * The RED. Each case breaks one of the five academic contracts that the
   * Netlify operation surface cannot reach and shows the readiness RPC which is
   * actually ready on this lineage reporting ready anyway. These pass before and
   * after the migration — they are statements about the pre-existing surface,
   * and they are why a new consolidated contract is needed at all.
   */
  describe('the pre-existing server surface is blind to the academic contract', () => {
    it('reports ready before any perturbation, so the cases below are meaningful', async () => {
      await expect(verifiedIdentityReadiness()).resolves.toMatchObject({ status: 'ready' })
      await expect(safetyDurableReadiness()).resolves.toMatchObject({ status: 'ready' })
    })

    it.each([
      ['review-queue', 'drop table public.academy_study_reviews cascade'],
      ['calendar-adapter', 'drop table public.academy_study_calendar_blocks cascade'],
      ['parent-settings-adapter', 'drop table public.academy_study_parent_settings cascade'],
      ['adult-private-adapter', 'drop table academy_private.study_adult_notes cascade'],
      ['event-ledger', 'drop table public.academy_study_event_ledger cascade'],
    ])('cannot tell that %s lost its durable table', async (_dependency, perturbation) => {
      await reverted(async () => {
        await database.exec(perturbation)
        await expect(verifiedIdentityReadiness()).resolves.toMatchObject({ status: 'ready' })
        await expect(safetyDurableReadiness()).resolves.toMatchObject({ status: 'ready' })
      })
    })

    it.each([
      ['review-queue / calendar-adapter / parent-settings-adapter',
        `drop function ${SHARED_ADULT_MANAGED.replace('public.academy_study_upsert_adult_managed_record', 'public.academy_study_upsert_adult_managed_record')} cascade`],
      ['parent-settings-adapter',
        'drop function public.academy_study_effective_settings(uuid,date) cascade'],
      ['adult-private-adapter',
        'drop function public.academy_study_read_adult_note(uuid,text,bigint,uuid) cascade'],
      ['event-ledger',
        'drop function public.academy_study_append_event(text,text,integer,text) cascade'],
    ])('cannot tell that %s lost its required function', async (_dependency, perturbation) => {
      await reverted(async () => {
        await database.exec(perturbation)
        await expect(verifiedIdentityReadiness()).resolves.toMatchObject({ status: 'ready' })
        await expect(safetyDurableReadiness()).resolves.toMatchObject({ status: 'ready' })
      })
    })

    it('cannot tell that a learner-facing role gained the adult-managed mutation', async () => {
      await reverted(async () => {
        await database.exec(`grant execute on function ${SHARED_ADULT_MANAGED} to anon`)
        await expect(verifiedIdentityReadiness()).resolves.toMatchObject({ status: 'ready' })
        await expect(safetyDurableReadiness()).resolves.toMatchObject({ status: 'ready' })
      })
    })
  })

  describe('surface and security', () => {
    it('creates the consolidated readiness function', async () => {
      expect(await regprocedureExists(READINESS)).toBe(true)
    })

    it('grants execute to the trusted server only', async () => {
      expect(await hasExecute('service_role', READINESS)).toBe(true)
      expect(await hasExecute('authenticated', READINESS)).toBe(false)
      expect(await hasExecute('anon', READINESS)).toBe(false)
      expect(await hasExecute('public', READINESS)).toBe(false)
    })

    it('is owned by postgres, stable, and security definer with a pinned search_path', async () => {
      const result = await database.query<{
        owner: string
        volatility: string
        security_definer: boolean
        config: string[] | null
      }>(`
        select pg_get_userbyid(proowner) as owner, provolatile as volatility,
          prosecdef as security_definer, proconfig as config
        from pg_proc where oid = to_regprocedure($1)
      `, [READINESS])
      expect(result.rows[0]).toMatchObject({
        owner: 'postgres',
        volatility: 's',
        security_definer: true,
      })
      expect(result.rows[0].config).toContain('search_path=pg_catalog')
    })

    it('raises 42501 for a non-trusted-server caller', async () => {
      await expect(asRole('service_role', '00000000-0000-0000-0000-0000000000a1', () =>
        rpc(`select ${READINESS} as result`),
      )).rejects.toThrow(/STUDY_TRUSTED_SERVER_REQUIRED/)
      await database.exec('rollback')
    })

    it('refuses execution to learner-facing roles', async () => {
      await expect(asRole('authenticated', '00000000-0000-0000-0000-0000000000a1', () =>
        rpc(`select ${READINESS} as result`),
      )).rejects.toThrow(/permission denied|STUDY_TRUSTED_SERVER_REQUIRED/)
      await database.exec('rollback')
      await expect(asRole('anon', null, () => rpc(`select ${READINESS} as result`)))
        .rejects.toThrow(/permission denied|STUDY_TRUSTED_SERVER_REQUIRED/)
      await database.exec('rollback')
    })
  })

  describe('response shape and privacy', () => {
    it('returns exactly the closed contract keys', async () => {
      const result = await academicReadiness()
      expect(Object.keys(result).sort())
        .toEqual(['contractVersion', 'dependencies', 'schemaVersion', 'status'])
      expect(Object.keys(result.dependencies).sort())
        .toEqual([...ACADEMIC_DEPENDENCIES].sort())
      expect(result.schemaVersion).toBe(1)
      expect(result.contractVersion).toBe(1)
    })

    it('returns only closed readiness states', async () => {
      const result = await academicReadiness()
      for (const state of Object.values(result.dependencies)) {
        expect(['ready', 'not-ready']).toContain(state)
      }
      expect(['ready', 'not-ready']).toContain(result.status)
    })

    it('carries no learner, household, session, or free-text database detail', async () => {
      const serialized = JSON.stringify(await academicReadiness())
      expect(serialized).not.toMatch(
        /student|learner|household|session_id|grant|checkpoint_id|note|payload|credential|secret|token|digest|error|detail|message|sqlstate|hint/i,
      )
      // Every value in the response is drawn from the closed vocabulary above.
      const values = JSON.stringify(await academicReadiness())
        .match(/"[^"]*"/g) ?? []
      const allowed = new Set([
        '"schemaVersion"', '"contractVersion"', '"status"', '"dependencies"',
        '"ready"', '"not-ready"',
        ...ACADEMIC_DEPENDENCIES.map((dependency) => `"${dependency}"`),
      ])
      for (const value of values) expect(allowed.has(value)).toBe(true)
    })

    it('reports every dependency ready against the intact estate', async () => {
      const result = await academicReadiness()
      expect(result.dependencies).toEqual(allReadyExcept())
      expect(result.status).toBe('ready')
    })
  })

  describe('readiness is read-only', () => {
    it('changes no academic row count', async () => {
      const before = await academicRowCounts()
      await academicReadiness()
      await academicReadiness()
      expect(await academicRowCounts()).toEqual(before)
    })

    /**
     * Read-only is enforced by the engine, not only by what the body happens to
     * say. A readiness function declared STABLE cannot be given a write at all, so
     * a future edit that tries to smuggle one in fails loudly instead of quietly
     * mutating an academic table.
     */
    it('cannot be given a write while it stays declared stable', async () => {
      await reverted(async () => {
        await database.exec(`
          create or replace function public.academy_study_academic_readiness_v1()
          returns jsonb language plpgsql stable security definer
          set search_path = pg_catalog as $injected$
          begin
            insert into public.academy_study_reviews (id) values ('injected');
            return '{}'::jsonb;
          end;
          $injected$;
        `)
        // The refusal aborts the surrounding transaction, so the count below needs
        // a savepoint to survive it.
        await database.exec('savepoint injected_write')
        await expect(academicReadiness()).rejects.toThrow(
          /not allowed in a non-volatile function/,
        )
        await database.exec('rollback to savepoint injected_write')
        const after = await database.query<{ total: number }>(
          `select count(*)::int as total from public.academy_study_reviews
           where id = 'injected'`,
        )
        expect(after.rows[0].total).toBe(0)
      })
    })

    it('does not write a mutation receipt or an audit event', async () => {
      const counts = async () => {
        const result = await database.query<{ receipts: number, audits: number }>(`
          select
            (select count(*) from academy_private.study_mutation_receipts)::int as receipts,
            (select count(*) from public.academy_study_audit_events)::int as audits
        `)
        return result.rows[0]
      }
      const before = await counts()
      await academicReadiness()
      expect(await counts()).toEqual(before)
    })
  })

  /**
   * Isolation. Each case removes exactly one required object and pins the whole
   * dependency map, so a check that has quietly become a shared tripwire — or a
   * dependency whose probe was never wired at all — shows up immediately.
   */
  describe('a missing required table takes down exactly its dependency', () => {
    /**
     * Reviews, calendar blocks and accommodations are queried by the shared
     * adult-managed mutation's ownership guard on every call regardless of kind,
     * so losing any one of those three tables really does break all three
     * adult-managed dependencies. That is asserted here rather than left to be
     * discovered: a test expecting only review-queue to fall would be wrong about
     * the architecture, not about the contract.
     */
    it.each([
      ['reviews', 'public.academy_study_reviews',
        ['review-queue', 'calendar-adapter', 'parent-settings-adapter']],
      ['calendar blocks', 'public.academy_study_calendar_blocks',
        ['review-queue', 'calendar-adapter', 'parent-settings-adapter']],
      ['accommodations', 'public.academy_study_accommodations',
        ['review-queue', 'calendar-adapter', 'parent-settings-adapter']],
      ['parent settings', 'public.academy_study_parent_settings',
        ['parent-settings-adapter']],
      ['the event ledger', 'public.academy_study_event_ledger', ['event-ledger']],
      ['adult notes', 'academy_private.study_adult_notes', ['adult-private-adapter']],
    ] as const)('losing %s closes exactly the dependencies that read it',
      async (_label, table, dependencies) => {
        await reverted(async () => {
          await database.exec(`drop table ${table} cascade`)
          expect((await academicReadiness()).dependencies)
            .toEqual(allReadyExcept(...dependencies))
        })
      })

    it('adult-private-adapter without its protected work table', async () => {
      await reverted(async () => {
        // Checkpoints carry a foreign key into protected work, so the cascade
        // removes that constraint; the checkpoint table itself survives and its
        // dependency must stay ready.
        await database.exec('drop table academy_private.study_protected_learner_work cascade')
        expect((await academicReadiness()).dependencies)
          .toEqual(allReadyExcept('adult-private-adapter'))
      })
    })
  })

  describe('a missing required function takes down exactly its dependency', () => {
    it.each([
      ['study-session-adapter', 'public.academy_study_create_session(jsonb,text)'],
      ['study-session-adapter',
        'public.academy_study_transition_session(text,bigint,text,timestamptz,text)'],
      ['checkpoint-adapter', 'public.academy_study_read_checkpoint(text)'],
      ['checkpoint-adapter',
        'public.academy_study_compare_and_swap_checkpoint(text,bigint,text,jsonb)'],
      ['parent-settings-adapter', 'public.academy_study_effective_settings(uuid,date)'],
      ['event-ledger', 'public.academy_study_append_event(text,text,integer,text)'],
      ['adult-private-adapter', 'public.academy_study_store_protected_work(jsonb)'],
      ['adult-private-adapter', 'public.academy_study_read_protected_work(uuid,text,bigint)'],
      ['adult-private-adapter', 'public.academy_study_append_adult_note(jsonb)'],
      ['adult-private-adapter', 'public.academy_study_list_adult_note_metadata(uuid)'],
      ['adult-private-adapter', 'public.academy_study_read_adult_note(uuid,text,bigint,uuid)'],
    ] as const)('%s without %s', async (dependency, signature) => {
      await reverted(async () => {
        await database.exec(`drop function ${signature} cascade`)
        expect((await academicReadiness()).dependencies).toEqual(allReadyExcept(dependency))
      })
    })

    /**
     * The one place isolation is architecturally impossible: review, calendar and
     * parent settings are three record kinds of a single adult-managed mutation.
     * Pinned as the honest three-way outage rather than left to be discovered.
     */
    it('takes down all three adult-managed kinds when their shared function is gone', async () => {
      await reverted(async () => {
        await database.exec(`drop function ${SHARED_ADULT_MANAGED} cascade`)
        expect((await academicReadiness()).dependencies).toEqual(
          allReadyExcept('review-queue', 'calendar-adapter', 'parent-settings-adapter'),
        )
      })
    })
  })

  /**
   * A table name is not a contract. Each case leaves a correctly named relation
   * in place and removes only part of what the adapter writes.
   */
  describe('table existence alone is not readiness', () => {
    it.each([
      ['review-queue', 'public.academy_study_reviews', 'interval_days'],
      ['calendar-adapter', 'public.academy_study_calendar_blocks', 'completion_units'],
      ['parent-settings-adapter', 'public.academy_study_parent_settings', 'parent_override'],
      ['event-ledger', 'public.academy_study_event_ledger', 'payload_digest'],
      ['study-session-adapter', 'public.academy_study_sessions', 'household_timezone'],
      ['checkpoint-adapter', 'public.academy_study_checkpoints', 'safe_instructional_cursor'],
      ['adult-private-adapter', 'academy_private.study_adult_notes', 'keyed_integrity_tag'],
      // Columns the adapters demonstrably write or read that this contract used to
      // omit. The compare-and-swap pivots on checkpoints.revision, so that one
      // being absent from the contract was the most serious of them: the whole
      // point of the checkpoint adapter is lost without it and readiness said ready.
      ['checkpoint-adapter', 'public.academy_study_checkpoints', 'revision'],
      ['checkpoint-adapter', 'public.academy_study_checkpoints', 'integrity_digest'],
      ['checkpoint-adapter', 'public.academy_study_checkpoints', 'last_accepted_event_id'],
      ['checkpoint-adapter', 'public.academy_study_checkpoints', 'draft_revision'],
      ['checkpoint-adapter', 'public.academy_study_checkpoints', 'expires_at'],
      ['checkpoint-adapter', 'public.academy_study_checkpoints', 'household_timezone'],
      ['checkpoint-adapter', 'public.academy_study_checkpoints', 'event_version'],
      ['checkpoint-adapter', 'public.academy_study_checkpoints', 'canonical_task_id'],
      ['checkpoint-adapter', 'public.academy_study_checkpoints',
        'technical_interruption_state'],
      ['checkpoint-adapter', 'public.academy_study_checkpoints',
        'timezone_snapshot_revision'],
      ['event-ledger', 'public.academy_study_event_ledger', 'event_version'],
      ['study-session-adapter', 'public.academy_study_sessions', 'study_plan_id'],
      ['study-session-adapter', 'public.academy_study_sessions', 'schema_version'],
      ['study-session-adapter', 'public.academy_study_sessions', 'created_by'],
      ['study-session-adapter', 'public.academy_study_sessions',
        'timezone_snapshot_provenance'],
      ['review-queue', 'public.academy_study_reviews', 'household_timezone'],
      ['calendar-adapter', 'public.academy_study_calendar_blocks', 'household_timezone'],
      ['calendar-adapter', 'public.academy_study_calendar_blocks', 'dst_resolution'],
      ['calendar-adapter', 'public.academy_study_calendar_blocks', 'intended_local_time'],
      ['parent-settings-adapter', 'public.academy_study_parent_settings', 'updated_by'],
      ['adult-private-adapter', 'academy_private.study_protected_learner_work',
        'checkpoint_id'],
      ['adult-private-adapter', 'academy_private.study_adult_notes', 'created_at'],
    ] as const)('%s when %s loses %s', async (dependency, table, column) => {
      await reverted(async () => {
        await database.exec(`alter table ${table} drop column ${column} cascade`)
        expect((await academicReadiness()).dependencies).toEqual(allReadyExcept(dependency))
      })
    })

    it('is not satisfied by an empty relation wearing the right name', async () => {
      await reverted(async () => {
        await database.exec(`
          drop table public.academy_study_reviews cascade;
          create table public.academy_study_reviews (id text primary key);
        `)
        // The replacement carries reviews.id, so the adult-managed ownership
        // guard's household_id/student_id are what is now missing — which closes
        // all three adult-managed dependencies, not review-queue alone.
        expect((await academicReadiness()).dependencies)
          .toEqual(allReadyExcept(
            'review-queue', 'calendar-adapter', 'parent-settings-adapter'))
      })
    })

    it('requires row level security to still be enabled', async () => {
      await reverted(async () => {
        await database.exec(
          'alter table public.academy_study_reviews disable row level security',
        )
        expect((await academicReadiness()).dependencies)
          .toEqual(allReadyExcept(
            'review-queue', 'calendar-adapter', 'parent-settings-adapter'))
      })
    })

    it('closes only parent-settings-adapter when accommodations loses a read column',
      async () => {
        await reverted(async () => {
          // effective_settings composes accommodations into the answer, so this is
          // a genuine parent-settings break even though its own table is intact.
          await database.exec(`alter table public.academy_study_accommodations
            drop column effective_from cascade`)
          expect((await academicReadiness()).dependencies)
            .toEqual(allReadyExcept('parent-settings-adapter'))
        })
      })
  })

  describe('the wrong function is not the right function', () => {
    it('rejects a changed signature', async () => {
      await reverted(async () => {
        await database.exec(`
          drop function public.academy_study_effective_settings(uuid,date) cascade;
          create function public.academy_study_effective_settings(p_student_id uuid)
          returns jsonb language sql stable security definer
          set search_path = pg_catalog as $decoy$ select '{}'::jsonb $decoy$;
          grant execute on function public.academy_study_effective_settings(uuid)
            to authenticated;
        `)
        expect((await academicReadiness()).dependencies)
          .toEqual(allReadyExcept('parent-settings-adapter'))
      })
    })

    it('rejects a wrong owner', async () => {
      await reverted(async () => {
        await database.exec(`
          alter function public.academy_study_append_event(text,text,integer,text)
            owner to service_role
        `)
        expect((await academicReadiness()).dependencies).toEqual(allReadyExcept('event-ledger'))
      })
    })

    it('rejects an unpinned search_path', async () => {
      await reverted(async () => {
        await database.exec(`
          alter function public.academy_study_read_checkpoint(text) reset search_path
        `)
        expect((await academicReadiness()).dependencies)
          .toEqual(allReadyExcept('checkpoint-adapter'))
      })
    })

    it('rejects a security invoker definition', async () => {
      await reverted(async () => {
        await database.exec(`
          alter function public.academy_study_create_session(jsonb,text) security invoker
        `)
        expect((await academicReadiness()).dependencies)
          .toEqual(allReadyExcept('study-session-adapter'))
      })
    })

    it('rejects a record kind the shared mutation can no longer serve', async () => {
      await reverted(async () => {
        // A body that keeps the name, signature, owner, privileges and search_path
        // but serves nothing. It no longer consults the kind authority at all, so
        // all three adult-managed dependencies close together.
        await database.exec(`
          create or replace function public.academy_study_upsert_adult_managed_record(
            p_record_kind text, p_record jsonb,
            p_expected_revision bigint, p_idempotency_key text
          ) returns jsonb language plpgsql security definer
          set search_path = pg_catalog as $decoy$
          begin
            if p_record_kind = 'calendar' then return '{}'::jsonb; end if;
            if p_record_kind = 'parent_settings' then return '{}'::jsonb; end if;
            raise exception 'STUDY_RECORD_INVALID';
          end;
          $decoy$;
        `)
        expect((await academicReadiness()).dependencies).toEqual(allReadyExcept(
          'review-queue', 'calendar-adapter', 'parent-settings-adapter'))
      })
    })
  })

  /**
   * Record-kind support, proved against the mutation path rather than its spelling.
   *
   * The contract this replaces searched the shared mutation's source text for
   * `p_record_kind = '<kind>'`. Every kind carries that text twice for unrelated
   * reasons, and the list that actually admitted a kind spelled none of them that
   * way, so withdrawing a kind from the real accept-list left readiness reporting
   * it ready while every call for it raised STUDY_RECORD_INVALID. Three strings in
   * comments were enough to report all three ready.
   *
   * Both sides now call `study_adult_managed_record_kind_supported`. Each case
   * below therefore asserts the pair: what the real mutation does, and what
   * readiness says about it. A case that only checked readiness could not tell
   * this contract from the one it replaces.
   */
  describe('the shared record-kind authority binds mutation and readiness', () => {
    const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
    const STUDENT_A = '00000000-0000-0000-0000-000000000101'
    const AUTHORITY =
      'academy_private.study_adult_managed_record_kind_supported(text)'
    const KIND_DEPENDENCY = {
      review: 'review-queue',
      calendar: 'calendar-adapter',
      parent_settings: 'parent-settings-adapter',
    } as const
    type ManagedKind = keyof typeof KIND_DEPENDENCY

    const record = (kind: ManagedKind, tag: string) => ({
      review: {
        id: `review-${tag}`, student_id: STUDENT_A, skill_id: 'skill-a',
        source_session_id: 'session-a', review_kind: 'spaced',
        due_at: '2026-08-02T14:00:00Z', intended_local_date: '2026-08-02',
        priority: 50, state: 'scheduled', attempt_count: 0, interval_days: 1,
        reteaching_required: false, prerequisite_remediation_required: false,
      },
      calendar: {
        id: `calendar-${tag}`, student_id: STUDENT_A, block_type: 'lesson',
        source_reference: 'lesson-a', scheduled_start: '2026-08-02T14:00:00Z',
        intended_local_date: '2026-08-02', explicit_offset: -240,
        duration_minutes: 30, completion_units: 0, required_units: 1,
        resume_session_id: null, resume_segment_id: null, state: 'scheduled',
      },
      parent_settings: {
        student_id: STUDENT_A, timer_mode: 'visible', maximum_work_minutes: 30,
        break_minimum_minutes: 5, break_maximum_minutes: 15, required_breaks: 1,
        reduced_motion: false, no_audio: false, large_text: false,
        read_aloud: false, speech_input_allowed: false, parent_override: false,
      },
    }[kind])

    let attempt = 0
    /**
     * Calls the real mutation as a learning manager. A savepoint keeps an expected
     * refusal from aborting the enclosing perturbation, so readiness can still be
     * asked in the same case. The fixture already carries parent settings at
     * revision 1, hence the differing expected revision.
     */
    async function upsert(kind: ManagedKind) {
      attempt += 1
      const point = `kind_attempt_${attempt}`
      await database.exec(`savepoint ${point}`)
      try {
        const result = await asRole('authenticated', GUARDIAN_A, () =>
          database.query<{ result: unknown }>(
            `select public.academy_study_upsert_adult_managed_record(
               $1, $2::jsonb, $3, $4
             ) as result`,
            [kind, JSON.stringify(record(kind, `k${attempt}`)),
              kind === 'parent_settings' ? 1 : 0, `kind-attempt-${attempt}`],
          ))
        await database.exec(`release savepoint ${point}`)
        return { accepted: true, result: result.rows[0].result }
      } catch (error) {
        await database.exec(`rollback to savepoint ${point}`)
        return { accepted: false, error: String((error as Error).message) }
      }
    }

    /** Redefines the single authority without one kind. */
    async function withdraw(kind: string) {
      const kept = ['review', 'calendar', 'parent_settings', 'accommodation']
        .filter((candidate) => candidate !== kind)
        .map((candidate) => `'${candidate}'`)
        .join(', ')
      await database.exec(`
        create or replace function
          academy_private.study_adult_managed_record_kind_supported(p_kind text)
        returns boolean language sql immutable set search_path = pg_catalog
        as $authority$ select p_kind in (${kept}) $authority$;
      `)
    }

    it('accepts all three kinds and reports all three ready before perturbation',
      async () => {
        await reverted(async () => {
          for (const kind of Object.keys(KIND_DEPENDENCY) as ManagedKind[]) {
            expect((await upsert(kind)).accepted).toBe(true)
          }
          expect((await academicReadiness()).dependencies).toEqual(allReadyExcept())
        })
      })

    /**
     * This is also what kills a readiness probe that answers from a list of its
     * own: only a probe still reading the authority moves when the authority does.
     */
    it.each(Object.keys(KIND_DEPENDENCY) as ManagedKind[])(
      'withdrawing %s refuses it at the mutation AND closes only its dependency',
      async (kind) => {
        await reverted(async () => {
          await withdraw(kind)
          const refused = await upsert(kind)
          expect(refused.accepted).toBe(false)
          expect(refused.error).toMatch(/STUDY_RECORD_INVALID/)
          expect((await academicReadiness()).dependencies)
            .toEqual(allReadyExcept(KIND_DEPENDENCY[kind]))
          // The other two keep working: one withdrawn kind is not a three-way outage.
          for (const other of (Object.keys(KIND_DEPENDENCY) as ManagedKind[])
            .filter((candidate) => candidate !== kind)) {
            expect((await upsert(other)).accepted).toBe(true)
          }
        })
      })

    it.each([
      ['comments', `
        begin
          -- supported: p_record_kind = 'review'
          -- academy_private.study_adult_managed_record_kind_supported(p_record_kind)
          -- supported: p_record_kind = 'calendar'
          -- supported: p_record_kind = 'parent_settings'
          raise exception 'STUDY_RECORD_INVALID' using errcode = '22023';
        end;`],
      ['a string literal', `
        declare
          dead text :=
            'academy_private.study_adult_managed_record_kind_supported(p_record_kind)';
        begin
          raise exception 'STUDY_RECORD_INVALID' using errcode = '22023';
          if p_record_kind = 'review' then return dead::jsonb; end if;
          if p_record_kind = 'calendar' then return null; end if;
          if p_record_kind = 'parent_settings' then return null; end if;
        end;`],
    ] as const)('is not satisfied by the authority appearing only in %s',
      async (_label, body) => {
        await reverted(async () => {
          await database.exec(`
            create or replace function public.academy_study_upsert_adult_managed_record(
              p_record_kind text, p_record jsonb,
              p_expected_revision bigint, p_idempotency_key text
            ) returns jsonb language plpgsql security definer
            set search_path = pg_catalog as $decoy$${body}$decoy$;
          `)
          for (const kind of Object.keys(KIND_DEPENDENCY) as ManagedKind[]) {
            expect((await upsert(kind)).accepted).toBe(false)
          }
          expect((await academicReadiness()).dependencies).toEqual(allReadyExcept(
            'review-queue', 'calendar-adapter', 'parent-settings-adapter'))
        })
      })

    it('closes when the mutation bypasses the authority with its own list',
      async () => {
        await reverted(async () => {
          // Everything else in the real body is preserved; only the admission gate
          // is swapped back to a narrower literal list. The mutation must match or
          // this case is proving nothing.
          const definition = await database.query<{ body: string }>(
            `select replace(pg_get_functiondef(to_regprocedure($1)), chr(13), '')
               as body`, [SHARED_ADULT_MANAGED])
          const original = definition.rows[0].body
          const bypassed = original.replace(
            '  if not academy_private.study_adult_managed_record_kind_supported(\n'
            + '       p_record_kind\n     ) or p_expected_revision is null',
            "  if p_record_kind not in ('calendar', 'parent_settings')\n"
            + '     or p_expected_revision is null')
          expect(bypassed).not.toBe(original)
          await database.exec(bypassed)
          expect((await upsert('review')).accepted).toBe(false)
          expect((await academicReadiness()).dependencies).toEqual(allReadyExcept(
            'review-queue', 'calendar-adapter', 'parent-settings-adapter'))
        })
      })

    it('closes all three when the authority itself is gone', async () => {
      await reverted(async () => {
        await database.exec(`drop function ${AUTHORITY} cascade`)
        expect((await academicReadiness()).dependencies).toEqual(allReadyExcept(
          'review-queue', 'calendar-adapter', 'parent-settings-adapter'))
      })
    })

    it('keeps unknown kinds refused and absent from the response', async () => {
      // Asked as the owner, which is the only way the authority is ever reached:
      // both callers are security-definer functions running as postgres. No client
      // role can execute it, which the ACL case below pins separately.
      const unknown = await database.query<{ supported: boolean }>(
        `select academy_private.study_adult_managed_record_kind_supported($1)
           as supported`, ['transcript'])
      expect(unknown.rows[0].supported).toBe(false)
      await reverted(async () => {
        attempt += 1
        await database.exec(`savepoint unknown_kind`)
        const refused = await asRole('authenticated', GUARDIAN_A, async () => {
          try {
            await database.query(
              `select public.academy_study_upsert_adult_managed_record(
                 'transcript', '{}'::jsonb, 0, 'unknown-kind-probe') as result`)
            return 'accepted'
          } catch (error) { return String((error as Error).message) }
        })
        await database.exec(`rollback to savepoint unknown_kind`)
        expect(refused).toMatch(/STUDY_RECORD_INVALID/)
        expect(Object.keys((await academicReadiness()).dependencies)).toHaveLength(7)
      })
    })

    it('is reachable by no client role', async () => {
      for (const role of ['anon', 'authenticated', 'service_role', 'public']) {
        expect(await hasExecute(role, AUTHORITY)).toBe(false)
      }
    })

    it('is owned by postgres, immutable, and search_path pinned', async () => {
      const result = await database.query<{
        owner: string; volatility: string; config: string[] | null
      }>(`select pg_get_userbyid(proowner) as owner, provolatile as volatility,
            proconfig as config
          from pg_proc where oid = to_regprocedure($1)`, [AUTHORITY])
      expect(result.rows[0].owner).toBe('postgres')
      expect(result.rows[0].volatility).toBe('i')
      expect(result.rows[0].config).toEqual(['search_path=pg_catalog'])
    })

    it('left the frozen mutation function with no literal kind list of its own',
      async () => {
        const definition = await database.query<{ body: string }>(
          'select pg_get_functiondef(to_regprocedure($1)) as body',
          [SHARED_ADULT_MANAGED])
        expect(definition.rows[0].body)
          .not.toContain("'review', 'calendar', 'parent_settings', 'accommodation'")
        expect(definition.rows[0].body).toContain(
          'academy_private.study_adult_managed_record_kind_supported(')
      })

    it('kept the frozen mutation function otherwise intact', async () => {
      // Owner, definer posture, pinned search_path and the adapter/anon ACL split
      // all survive being re-declared from the catalog.
      const result = await database.query<{
        owner: string; definer: boolean; config: string[] | null
      }>(`select pg_get_userbyid(proowner) as owner, prosecdef as definer,
            proconfig as config
          from pg_proc where oid = to_regprocedure($1)`, [SHARED_ADULT_MANAGED])
      expect(result.rows[0].owner).toBe('postgres')
      expect(result.rows[0].definer).toBe(true)
      expect(result.rows[0].config).toEqual(['search_path=pg_catalog'])
      expect(await hasExecute('authenticated', SHARED_ADULT_MANAGED)).toBe(true)
      expect(await hasExecute('anon', SHARED_ADULT_MANAGED)).toBe(false)
    })
  })

  describe('privilege drift is not readiness', () => {
    it.each([
      ['review-queue / calendar-adapter / parent-settings-adapter',
        `revoke execute on function ${SHARED_ADULT_MANAGED} from authenticated`,
        ['review-queue', 'calendar-adapter', 'parent-settings-adapter']],
      ['event-ledger',
        'revoke execute on function public.academy_study_append_event(text,text,integer,text) from authenticated',
        ['event-ledger']],
    ] as const)('%s loses readiness when the adapter role loses execute', async (
      _label, perturbation, affected,
    ) => {
      await reverted(async () => {
        await database.exec(perturbation)
        expect((await academicReadiness()).dependencies)
          .toEqual(allReadyExcept(...affected as readonly AcademicDependency[]))
      })
    })

    it.each([
      ['review-queue / calendar-adapter / parent-settings-adapter',
        `grant execute on function ${SHARED_ADULT_MANAGED} to anon`,
        ['review-queue', 'calendar-adapter', 'parent-settings-adapter']],
      ['adult-private-adapter',
        'grant execute on function public.academy_study_read_adult_note(uuid,text,bigint,uuid) to anon',
        ['adult-private-adapter']],
    ] as const)('%s loses readiness when an unauthenticated role gains execute', async (
      _label, perturbation, affected,
    ) => {
      await reverted(async () => {
        await database.exec(perturbation)
        expect((await academicReadiness()).dependencies)
          .toEqual(allReadyExcept(...affected as readonly AcademicDependency[]))
      })
    })

    it('treats a PUBLIC grant as the escalation it is', async () => {
      await reverted(async () => {
        await database.exec(`
          grant execute on function public.academy_study_append_event(text,text,integer,text)
            to public
        `)
        expect((await academicReadiness()).dependencies).toEqual(allReadyExcept('event-ledger'))
      })
    })
  })

  describe('contract version and metadata', () => {
    it('records its own marker transition and appends its migration name', async () => {
      const result = await database.query<{
        academic_readiness_version: number
        migration_names: string[]
        manifest: Record<string, unknown>
      }>(`
        select academic_readiness_version, migration_names, security_manifest as manifest
        from academy_private.study_persistence_metadata where singleton
      `)
      expect(result.rows[0].academic_readiness_version).toBe(1)
      expect(result.rows[0].migration_names)
        .toContain('20260808150000_academy_study_academic_readiness_contract')
      expect(result.rows[0].manifest).toMatchObject({
        academic_readiness_version: 1,
        academic_readiness_read_only: true,
        academic_readiness_execute_role: 'service_role',
      })
    })

    it('constrains its marker to 0 or 1', async () => {
      await expect(reverted(() => database.exec(`
        update academy_private.study_persistence_metadata
        set academic_readiness_version = 2 where singleton
      `))).rejects.toThrow()
    })

    it('fails every dependency closed when the authorization contract version is incompatible', async () => {
      await reverted(async () => {
        await database.exec(`
          update academy_private.study_persistence_metadata
          set authorization_version = 0 where singleton
        `)
        const result = await academicReadiness()
        expect(result.dependencies).toEqual(
          allReadyExcept(...ACADEMIC_DEPENDENCIES),
        )
        expect(result.status).toBe('not-ready')
      })
    })

    /**
     * storage_version is not part of the readiness gate, and this is why: its
     * column constraint pins it to 1, so while the singleton exists it cannot
     * hold another value. A predicate over it could never be false and so could
     * never be a gate. Pinned as a constraint so that a later migration relaxing
     * it — which would make the omission wrong — fails here rather than silently
     * opening a hole nobody re-derives.
     */
    it('cannot express an incompatible storage_version at all', async () => {
      await expect(reverted(() => database.exec(`
        update academy_private.study_persistence_metadata
        set storage_version = 0 where singleton
      `))).rejects.toThrow(/storage_version/)
    })

    it('fails closed when the metadata singleton is missing', async () => {
      await reverted(async () => {
        await database.exec('delete from academy_private.study_persistence_metadata')
        const result = await academicReadiness()
        expect(result.dependencies).toEqual(allReadyExcept(...ACADEMIC_DEPENDENCIES))
        expect(result.status).toBe('not-ready')
      })
    })
  })

  describe('aggregate status', () => {
    it('is not-ready when any single dependency is not-ready', async () => {
      for (const table of [
        'public.academy_study_reviews',
        'public.academy_study_calendar_blocks',
        'public.academy_study_parent_settings',
        'public.academy_study_event_ledger',
      ]) {
        await reverted(async () => {
          await database.exec(`drop table ${table} cascade`)
          expect((await academicReadiness()).status).toBe('not-ready')
        })
      }
    })

    it('is ready only when all seven are ready', async () => {
      const result = await academicReadiness()
      expect(Object.values(result.dependencies).every((state) => state === 'ready')).toBe(true)
      expect(result.status).toBe('ready')
    })
  })

  /**
   * Predecessor and collision guards, exercised as behavior. Each builds the
   * lineage up to actor binding, perturbs one thing, and offers the migration —
   * so a deleted guard appears as a migration that cheerfully applies.
   */
  describe('predecessor and collision guards', () => {
    it('refuses a second application', async () => {
      const database2 = await chainWithoutAcademicMigration()
      try {
        await database2.exec(await academicMigrationSource())
        await expect(database2.exec(await academicMigrationSource()))
          .rejects.toThrow(/already applied/)
      } finally {
        await database2.close()
      }
    })

    it('refuses when the readiness function already exists', async () => {
      const database2 = await chainWithoutAcademicMigration()
      try {
        await database2.exec(`
          create function public.academy_study_academic_readiness_v1()
          returns jsonb language sql stable as $decoy$ select '{}'::jsonb $decoy$;
        `)
        await expect(database2.exec(await academicMigrationSource()))
          .rejects.toThrow(/object collision/)
      } finally {
        await database2.close()
      }
    })

    /**
     * The gate rewrite is a substitution, so its failure mode is matching nothing.
     * Silently leaving the literal list behind would restore exactly the drift this
     * migration exists to remove, while every test that only checks the authority
     * still passed. It must abort instead.
     */
    it('refuses when the adult-managed admission gate is not where it expects',
      async () => {
        const database2 = await chainWithoutAcademicMigration()
        try {
          await database2.exec(`
            create or replace function public.academy_study_upsert_adult_managed_record(
              p_record_kind text, p_record jsonb,
              p_expected_revision bigint, p_idempotency_key text
            ) returns jsonb language plpgsql security definer
            set search_path = pg_catalog as $reshaped$
            begin
              -- The same four kinds, spelled a different way.
              if p_record_kind not in ('review','calendar','parent_settings','accommodation')
              then raise exception 'STUDY_RECORD_INVALID'; end if;
              return '{}'::jsonb;
            end;
            $reshaped$;
          `)
          await expect(database2.exec(await academicMigrationSource()))
            .rejects.toThrow(/admission gate not found/)
        } finally {
          await database2.close()
        }
      })

    it('refuses when the adult-managed mutation is absent entirely', async () => {
      const database2 = await chainWithoutAcademicMigration()
      try {
        await database2.exec(`drop function ${SHARED_ADULT_MANAGED} cascade`)
        await expect(database2.exec(await academicMigrationSource()))
          .rejects.toThrow(/adult-managed mutation missing/)
      } finally {
        await database2.close()
      }
    })

    it('refuses when the metadata singleton is absent', async () => {
      const database2 = await chainWithoutAcademicMigration()
      try {
        await database2.exec('delete from academy_private.study_persistence_metadata')
        await expect(database2.exec(await academicMigrationSource()))
          .rejects.toThrow(/predecessor marker mismatch/)
      } finally {
        await database2.close()
      }
    })

    it.each([
      ['the actor-binding marker version is unset', `
        update academy_private.study_persistence_metadata
        set actor_binding_version = 0 where singleton
      `],
      ['the actor-binding manifest fact is absent', `
        update academy_private.study_persistence_metadata
        set security_manifest = security_manifest - 'actor_binding_version'
        where singleton
      `],
      ['the actor-binding predecessor name is missing', `
        update academy_private.study_persistence_metadata
        set migration_names = array_remove(
          migration_names, '20260808120000_academy_study_actor_bound_session_verification'
        ) where singleton
      `],
    ])('refuses when %s', async (_label, perturbation) => {
      const database2 = await chainWithoutAcademicMigration()
      try {
        await database2.exec(perturbation)
        await expect(database2.exec(await academicMigrationSource()))
          .rejects.toThrow(/predecessor marker mismatch/)
      } finally {
        await database2.close()
      }
    })
  })

  /**
   * The migration rewrites exactly one expression -- the adult-managed admission
   * gate -- and adds read-only probes. Nothing else about the academic subsystems
   * may have moved: no privilege widened, no row level security relaxed, and no
   * academic mutation handed to the trusted server role.
   */
  describe('the academic subsystems are otherwise unmodified', () => {
    it('leaves every academic function executable by authenticated and closed to anon', async () => {
      const signatures = new Set(Object.values(REQUIRED_FUNCTIONS).flat())
      for (const signature of signatures) {
        expect(await hasExecute('authenticated', signature)).toBe(true)
        expect(await hasExecute('anon', signature)).toBe(false)
      }
    })

    it('grants no academic mutation to the trusted server role', async () => {
      // The readiness probe reads catalog metadata. It is not a back door into
      // the learner-facing mutation surface, which stays authenticated-only.
      expect(await hasExecute('service_role', SHARED_ADULT_MANAGED)).toBe(false)
      expect(await hasExecute('service_role',
        'public.academy_study_append_event(text,text,integer,text)')).toBe(false)
    })

    it('leaves row level security enabled on every academic table', async () => {
      for (const table of ACADEMIC_TABLES) {
        const result = await database.query<{ enabled: boolean }>(
          'select relrowsecurity as enabled from pg_class where oid = to_regclass($1)',
          [table],
        )
        expect(result.rows[0].enabled).toBe(true)
      }
    })
  })
})
