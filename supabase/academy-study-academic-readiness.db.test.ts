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
    it.each([
      ['review-queue', 'public.academy_study_reviews'],
      ['calendar-adapter', 'public.academy_study_calendar_blocks'],
      ['parent-settings-adapter', 'public.academy_study_parent_settings'],
      ['event-ledger', 'public.academy_study_event_ledger'],
      ['adult-private-adapter', 'academy_private.study_adult_notes'],
    ] as const)('%s without %s', async (dependency, table) => {
      await reverted(async () => {
        await database.exec(`drop table ${table} cascade`)
        expect((await academicReadiness()).dependencies).toEqual(allReadyExcept(dependency))
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
        expect((await academicReadiness()).dependencies)
          .toEqual(allReadyExcept('review-queue'))
      })
    })

    it('requires row level security to still be enabled', async () => {
      await reverted(async () => {
        await database.exec(
          'alter table public.academy_study_reviews disable row level security',
        )
        expect((await academicReadiness()).dependencies)
          .toEqual(allReadyExcept('review-queue'))
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

    it('rejects a record kind the shared mutation no longer accepts', async () => {
      await reverted(async () => {
        // The adult-managed mutation keeps its name, signature, owner, privileges
        // and search_path, and still serves calendar and parent settings. Only the
        // review branch is gone. Nothing but a body-level contract check sees this.
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
        expect((await academicReadiness()).dependencies).toEqual(allReadyExcept('review-queue'))
      })
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
   * This migration adds a read-only probe. It must not have touched any academic
   * subsystem, and must not have widened any academic privilege.
   */
  describe('the five academic subsystems are unmodified', () => {
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
