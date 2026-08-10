import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// The exact server receipt contract for `deliveredAt`
// (netlify/functions/_shared/study-delivery/receipt-contract.js validTimestamp).
const RECEIPT_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
// A raw timestamptz rendered by Postgres: optional fractional part, numeric offset.
const RAW_TIMESTAMPTZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}$/

const baseFiles = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  './migrations/20260810120000_academy_study_effective_settings_v2.sql',
  './migrations/20260810150000_academy_study_curriculum_binding.sql',
] as const
const CORRECTION = './migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql'
const FIXTURES = './tests/study_engine_fixtures.sql'

const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const ACCESS_A = '00000000-0000-0000-0000-0000000001a1'
const PERMISSION_A = '00000000-0000-0000-0000-00000000f1a1'
const RECIPIENT_A = `recipient:${'a'.repeat(64)}`
const ROUTE_A = `route:${'b'.repeat(64)}`
const WORKER = 'worker:study-g1-synthetic'
const WORKER_CREDENTIAL = 'synthetic-worker-credential-study-g1'
const WORKER_CONFIGURATION_VERSION = 'worker-config-v1'
const WORKER_CREDENTIAL_VERSION = 'cred-g1-synthetic'
const PROPOSAL_A = 'proposal:study-g1-synthetic'
const ATTEMPT_A = 'attempt:study-g1-synthetic'
// A microsecond-precision instant: the raw rendering keeps six fractional
// digits and a session offset, the contract allows exactly three and 'Z'.
const MICROSECOND_INSTANT = '2026-08-01T12:00:00.123456+00'
const NORMALIZED_INSTANT = '2026-08-01T12:00:00.123Z'

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

interface Binding {
  providerReceiptRef: string
  providerName: string
  route: string
  routeRef: string
  jobId: string
  attemptId: string
  proposalId: string
  householdId: string
  studentId: string
  recipientRef: string
  deliveryIdempotencyKey: string
  providerConfigVersion: string
}

async function asService<T>(db: PGlite, operation: () => Promise<T>): Promise<T> {
  await db.exec(`
    select set_config('request.jwt.claim.sub', '', false);
    select set_config('request.jwt.claims', '{"role":"service_role"}', false);
    select set_config('request.jwt.claim.role', 'service_role', false);
    set role service_role;
  `)
  try {
    return await operation()
  } finally {
    await db.exec(`
      reset role;
      select set_config('request.jwt.claims', '', false);
      select set_config('request.jwt.claim.role', '', false);
    `)
  }
}

async function asWorker<T>(
  db: PGlite,
  operation: () => Promise<T>,
  credential: string = WORKER_CREDENTIAL,
): Promise<T> {
  await db.exec(`
    select set_config('academy.study_worker_credential', '${credential}', false);
    select set_config('academy.study_worker_configuration_version', '${WORKER_CONFIGURATION_VERSION}', false);
    select set_config('academy.study_worker_credential_version', '${WORKER_CREDENTIAL_VERSION}', false);
  `)
  try {
    return await asService(db, operation)
  } finally {
    await db.exec(`
      select set_config('academy.study_worker_credential', '', false);
      select set_config('academy.study_worker_configuration_version', '', false);
      select set_config('academy.study_worker_credential_version', '', false);
    `)
  }
}

async function rpc<T>(db: PGlite, statement: string, parameters: unknown[] = []): Promise<T> {
  const result = await db.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

/** Drives the real Session 17/19 delivery path to one durable verified receipt. */
async function seedDeliveredNotification(db: PGlite): Promise<Binding> {
  await db.exec(`
    insert into academy_private.study_adult_review_worker_registry (
      worker_id, configuration_version, credential_version,
      authorized_scopes, credential_digest, expires_at
    ) values (
      '${WORKER}', '${WORKER_CONFIGURATION_VERSION}', '${WORKER_CREDENTIAL_VERSION}',
      array['proposal-resolution', 'delivery-claim', 'delivery-attempt',
        'delivery-reconcile', 'monitoring', 'rate-limit', 'retention'],
      academy_private.study_sha256_json(
        jsonb_build_object('credential', '${WORKER_CREDENTIAL}')
      ),
      clock_timestamp() + interval '1 day'
    );
    update academy_private.study_adult_review_route_capabilities
    set readiness = 'ready', allows_production = true,
        decision_code = 'synthetic-policy-approved-for-database-test'
    where route = 'in-app';
    update academy_private.study_production_policy
    set adult_review_in_app_delivery_policy = 'approved',
        approval_reference = 'synthetic-policy-approval-for-database-test',
        approved_by = '${GUARDIAN_A}', approved_at = clock_timestamp()
    where singleton;
  `)
  await asService(db, () => rpc(
    db,
    'select public.academy_study_set_adult_notification_permission_v1($1::jsonb, 0) as result',
    [JSON.stringify({
      permissionId: PERMISSION_A,
      guardianAccessId: ACCESS_A,
      recipientRef: RECIPIENT_A,
      allowedChannels: ['in-app'],
      status: 'active',
      policyVersion: 'adult-notification-policy-v2',
      provenanceRef: 'guardian-consent:synthetic-study-g1',
    })],
  ))
  await asService(db, () => rpc(
    db,
    'select public.academy_study_set_adult_notification_route_v1($1::jsonb, 0) as result',
    [JSON.stringify({
      routeRef: ROUTE_A,
      permissionId: PERMISSION_A,
      recipientRef: RECIPIENT_A,
      channel: 'in-app',
      status: 'active',
      providerRouteVersion: 'in-app-config-v1',
    })],
  ))
  await asService(db, () => rpc(
    db,
    'select public.academy_study_create_adult_review_proposal_v1($1::jsonb) as result',
    [JSON.stringify({
      schemaVersion: 1,
      proposalId: PROPOSAL_A,
      householdId: HOUSEHOLD_A,
      studentId: STUDENT_A,
      sessionId: 'session-a',
      category: 'student-support',
      classification: 'urgent',
      urgency: 'urgent',
      reasonCodes: ['safety-urgent-synthetic-v1'],
      classifierVersion: 'test-safety-classifier-v1',
      occurredAt: new Date().toISOString(),
      idempotencyKey: `${PROPOSAL_A}:idempotency`,
      deliveryState: 'proposed-not-delivered',
      authorizedRecipientResolutionState: 'pending',
    })],
  ))
  const claims = await asWorker(db, () => rpc<{ proposals: Array<Record<string, unknown>> }>(
    db,
    `select public.academy_study_claim_adult_review_proposals_v2('${WORKER}', 10, 30) as result`,
  ))
  const claim = claims.proposals[0]
  const resolution = await asWorker(db, () => rpc<Record<string, unknown>>(
    db,
    `select public.academy_study_resolve_adult_recipients_v2('${PROPOSAL_A}', '${WORKER}') as result`,
  ))
  await asWorker(db, () => rpc(
    db,
    `select public.academy_study_record_recipient_resolution_v2('${WORKER}', $1::jsonb) as result`,
    [JSON.stringify({
      householdRef: resolution.householdRef,
      learnerRef: resolution.learnerRef,
      proposalRef: resolution.proposalRef,
      proposalRevision: resolution.proposalRevision,
      leaseToken: claim.leaseToken,
      expectedRevision: claim.revision,
      state: 'resolved',
      resolutionRef: resolution.resolutionRef,
      policyVersion: resolution.policyVersion,
      recipients: resolution.recipients,
    })],
  ))
  const jobClaims = await asWorker(db, () => rpc<{ jobs: Array<Record<string, unknown>> }>(
    db,
    `select public.academy_study_claim_delivery_jobs_v2('${WORKER}', 10, 30) as result`,
  ))
  const job = jobClaims.jobs[0]
  const attempt = await asWorker(db, () => rpc<{ revision: number }>(
    db,
    `select public.academy_study_create_delivery_attempt_v2('${WORKER}', $1::jsonb) as result`,
    [JSON.stringify({
      jobId: job.jobId,
      leaseToken: job.leaseToken,
      expectedRevision: job.revision,
      attemptId: ATTEMPT_A,
      providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1',
    })],
  ))
  for (const state of ['created', 'submitted', 'provider-accepted']) {
    await asWorker(db, () => rpc(
      db,
      `select public.academy_study_record_attempt_event_v2('${WORKER}', $1::jsonb) as result`,
      [JSON.stringify({
        attemptId: ATTEMPT_A,
        jobId: job.jobId,
        state,
        structuredResult: `synthetic-${state}`,
        timeoutState: 'not-timed-out',
        retryDecision: 'not-applicable',
        errorCode: null,
      })],
    ))
  }
  const delivered = await asWorker(db, () => rpc<Record<string, unknown>>(
    db,
    `select public.academy_study_deliver_in_app_notification_v2('${WORKER}', $1::jsonb) as result`,
    [JSON.stringify({
      schemaVersion: 2,
      jobId: job.jobId,
      leaseToken: job.leaseToken,
      expectedRevision: attempt.revision,
      attemptId: ATTEMPT_A,
      deliveryIdempotencyKey: job.idempotencyKey,
      recipientRef: job.recipientRef,
      routeRef: job.routeRef,
      proposalId: PROPOSAL_A,
      householdId: HOUSEHOLD_A,
      studentId: STUDENT_A,
      providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1',
    })],
  ))
  expect(delivered).toMatchObject({ state: 'delivered', attemptId: ATTEMPT_A })
  return {
    providerReceiptRef: String(delivered.providerReceiptRef),
    providerName: 'academy-in-app',
    route: 'in-app',
    routeRef: String(job.routeRef),
    jobId: String(job.jobId),
    attemptId: ATTEMPT_A,
    proposalId: PROPOSAL_A,
    householdId: HOUSEHOLD_A,
    studentId: STUDENT_A,
    recipientRef: String(job.recipientRef),
    deliveryIdempotencyKey: String(job.idempotencyKey),
    providerConfigVersion: 'in-app-config-v1',
  }
}

async function verify(
  db: PGlite,
  binding: Record<string, unknown>,
  options: { worker?: string; credential?: string } = {},
): Promise<Record<string, unknown>> {
  return asWorker(db, () => rpc<Record<string, unknown>>(
    db,
    'select public.academy_study_verify_in_app_notification_v2($1::text, $2::jsonb) as result',
    [options.worker ?? WORKER, JSON.stringify(binding)],
  ), options.credential)
}

/** Sets the notification's delivered_at only; receipt/receipt-event binding is untouched. */
async function setDeliveredAt(db: PGlite, value: string): Promise<void> {
  await db.exec(`
    update academy_private.study_parent_notifications
    set delivered_at = timestamptz '${value}'
    where delivery_idempotency_key is not null
  `)
}

async function withTimeZone<T>(db: PGlite, zone: string, run: () => Promise<T>): Promise<T> {
  await db.exec(`set TimeZone = '${zone}'`)
  try {
    return await run()
  } finally {
    await db.exec('reset TimeZone')
  }
}

interface FunctionPosture {
  identity: string
  result: string
  owner: string
  security_definer: boolean
  volatility: string
  config: string
  acl: string
}

async function posture(db: PGlite): Promise<FunctionPosture> {
  const result = await db.query<FunctionPosture>(`
    select
      pg_get_function_identity_arguments(procedure.oid) as identity,
      pg_get_function_result(procedure.oid) as result,
      owner.rolname as owner,
      procedure.prosecdef as security_definer,
      procedure.provolatile::text as volatility,
      coalesce(array_to_string(procedure.proconfig, ','), '<none>') as config,
      coalesce(array_to_string(procedure.proacl::text[], '|'), '<default>') as acl
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    join pg_catalog.pg_roles as owner on owner.oid = procedure.proowner
    where namespace.nspname = 'public'
      and procedure.proname = 'academy_study_verify_in_app_notification_v2'
  `)
  expect(result.rows).toHaveLength(1)
  return result.rows[0]
}

async function privileges(db: PGlite): Promise<Record<string, boolean>> {
  const signature = 'public.academy_study_verify_in_app_notification_v2(text,jsonb)'
  const result = await db.query<Record<string, boolean>>(`
    select
      has_function_privilege('anon', '${signature}', 'execute') as anon,
      has_function_privilege('authenticated', '${signature}', 'execute') as authenticated,
      has_function_privilege('service_role', '${signature}', 'execute') as service_role,
      has_function_privilege('postgres', '${signature}', 'execute') as postgres
  `)
  return result.rows[0]
}

async function build(files: readonly string[]): Promise<PGlite> {
  const db = await PGlite.create()
  await db.exec(bootstrap)
  for (const path of files) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8')
    try {
      await db.exec(source)
    } catch (error) {
      throw new Error(`Failed to apply ${path}`, { cause: error })
    }
  }
  return db
}

let baseline: PGlite
let corrected: PGlite
let baselineBinding: Binding
let correctedBinding: Binding

beforeAll(async () => {
  baseline = await build([...baseFiles, FIXTURES])
  corrected = await build([...baseFiles, CORRECTION, FIXTURES])
  baselineBinding = await seedDeliveredNotification(baseline)
  correctedBinding = await seedDeliveredNotification(corrected)
  await setDeliveredAt(baseline, MICROSECOND_INSTANT)
  await setDeliveredAt(corrected, MICROSECOND_INSTANT)
}, 120_000)

afterAll(async () => {
  await baseline?.close()
  await corrected?.close()
})

describe.sequential('verified in-app receipt deliveredAt normalization', () => {
  it('records the forward marker without disturbing the predecessor chain', async () => {
    const result = await corrected.query<{ names: string[]; normalized: boolean; version: number }>(`
      select migration_names as names,
        (security_manifest ->> 'in_app_receipt_delivered_at_normalized')::boolean as normalized,
        final_production_version as version
      from academy_private.study_persistence_metadata where singleton
    `)
    expect(result.rows[0].names).toEqual([
      '20260801010000_academy_study_engine_storage',
      '20260801011000_academy_study_engine_authorization',
      '20260801012000_academy_study_engine_production_reconciliation',
      '20260801160000_academy_study_verified_identity',
      '20260801170000_academy_study_adult_review_operations',
      '20260801190000_academy_study_final_production_reconciliation',
      '20260810120000_academy_study_effective_settings_v2',
      '20260810150000_academy_study_curriculum_binding',
      '20260810152000_academy_study_in_app_receipt_timestamp',
    ])
    expect(result.rows[0].normalized).toBe(true)
    expect(result.rows[0].version).toBe(1)
    const readiness = await asService(corrected, () => rpc<Record<string, unknown>>(
      corrected,
      'select public.academy_study_verified_identity_readiness_v1() as result',
    ))
    expect(readiness.status).toBe('ready')
  })

  it('refuses to apply twice over an already normalized database', async () => {
    // Isolated database: a rejected migration leaves an aborted transaction
    // behind, which must not reach the shared corrected chain.
    const replayed = await build([...baseFiles, CORRECTION])
    try {
      const source = await readFile(new URL(CORRECTION, import.meta.url), 'utf8')
      await expect(replayed.exec(source)).rejects.toThrow(/already applied/)
      await replayed.exec('rollback')
      const result = await replayed.query<{ count: number }>(`
        select cardinality(array_positions(migration_names,
          '20260810152000_academy_study_in_app_receipt_timestamp'))::integer as count
        from academy_private.study_persistence_metadata where singleton
      `)
      expect(result.rows[0].count).toBe(1)
    } finally {
      await replayed.close()
    }
  })

  // The defect, proven behaviourally against the checked-in Session 17 definition.
  it('leaves the pre-migration definition emitting a raw session-local timestamptz', async () => {
    const utc = await withTimeZone(baseline, 'UTC', () => verify(baseline, baselineBinding))
    expect(utc.verified).toBe(true)
    expect(utc.deliveredAt).toBe('2026-08-01T12:00:00.123456+00:00')
    expect(utc.deliveredAt).toMatch(RAW_TIMESTAMPTZ)
    expect(utc.deliveredAt).not.toMatch(RECEIPT_TIMESTAMP)

    const chicago = await withTimeZone(baseline, 'America/Chicago', () => verify(baseline, baselineBinding))
    expect(chicago.deliveredAt).toBe('2026-08-01T07:00:00.123456-05:00')
    expect(chicago.deliveredAt).not.toMatch(RECEIPT_TIMESTAMP)
    // Same instant, wrong wire format: the defect is purely serialization.
    expect(Date.parse(String(chicago.deliveredAt)))
      .toBe(Date.parse(String(utc.deliveredAt)))
    expect(Date.parse(String(utc.deliveredAt))).toBe(Date.parse(NORMALIZED_INSTANT))
  })

  it('emits normalized UTC milliseconds that satisfy the receipt contract', async () => {
    const receipt = await verify(corrected, correctedBinding)
    expect(receipt.verified).toBe(true)
    expect(receipt.deliveredAt).toMatch(RECEIPT_TIMESTAMP)
    expect(receipt.deliveredAt).toBe(NORMALIZED_INSTANT)
    const value = String(receipt.deliveredAt)
    expect(value.endsWith('Z')).toBe(true)
    expect(value.split('.')[1]).toBe('123Z')
    expect(Number.isFinite(Date.parse(value))).toBe(true)
    expect(Date.parse(value)).toBe(Date.UTC(2026, 7, 1, 12, 0, 0, 123))
  })

  it('converts to UTC independently of the session time zone', async () => {
    for (const zone of ['UTC', 'America/Chicago', 'Asia/Tokyo', 'Etc/GMT+5']) {
      const receipt = await withTimeZone(corrected, zone, () => verify(corrected, correctedBinding))
      expect(receipt.deliveredAt, zone).toBe(NORMALIZED_INSTANT)
    }
  })

  it('truncates sub-millisecond precision rather than rounding it', async () => {
    // to_char(..., 'MS') is integer division of the microsecond field: the
    // repository convention is truncation, so .123999 never becomes .124.
    const cases: Array<[string, string]> = [
      ['2026-08-01T12:00:00.123456+00', '2026-08-01T12:00:00.123Z'],
      ['2026-08-01T12:00:00.123999+00', '2026-08-01T12:00:00.123Z'],
      ['2026-08-01T12:00:00.999999+00', '2026-08-01T12:00:00.999Z'],
      ['2026-08-01T12:00:00.000001+00', '2026-08-01T12:00:00.000Z'],
      ['2026-08-01T12:00:00+00', '2026-08-01T12:00:00.000Z'],
    ]
    for (const [stored, expected] of cases) {
      await setDeliveredAt(corrected, stored)
      const receipt = await verify(corrected, correctedBinding)
      expect(receipt.deliveredAt, stored).toBe(expected)
      expect(receipt.deliveredAt, stored).toMatch(RECEIPT_TIMESTAMP)
    }
    await setDeliveredAt(corrected, MICROSECOND_INSTANT)
  })

  it('carries midnight and date boundaries across the UTC conversion', async () => {
    const cases: Array<[string, string]> = [
      ['2026-08-01T20:00:00-05:00', '2026-08-02T01:00:00.000Z'],
      ['2026-08-01T00:00:00+00', '2026-08-01T00:00:00.000Z'],
      ['2026-08-01T02:30:00+05:30', '2026-07-31T21:00:00.000Z'],
      ['2026-12-31T23:59:59.999500+00', '2026-12-31T23:59:59.999Z'],
    ]
    for (const [stored, expected] of cases) {
      await setDeliveredAt(corrected, stored)
      const receipt = await verify(corrected, correctedBinding)
      expect(receipt.deliveredAt, stored).toBe(expected)
      expect(receipt.deliveredAt, stored).toMatch(RECEIPT_TIMESTAMP)
    }
    await setDeliveredAt(corrected, MICROSECOND_INSTANT)
  })

  it('keeps null-timestamp behaviour unchanged', async () => {
    // delivered_at is NOT NULL, so a stored null is unreachable in both chains.
    for (const db of [baseline, corrected]) {
      const column = await db.query<{ not_null: boolean }>(`
        select attribute.attnotnull as not_null
        from pg_catalog.pg_attribute as attribute
        where attribute.attrelid = 'academy_private.study_parent_notifications'::regclass
          and attribute.attname = 'delivered_at'
      `)
      expect(column.rows[0].not_null).toBe(true)
    }
    // The normalization propagates null rather than fabricating a timestamp.
    const expression = await corrected.query<{ is_null: boolean }>(`
      select to_char(null::timestamptz at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') is null as is_null
    `)
    expect(expression.rows[0].is_null).toBe(true)
    // The unmatched path still returns exactly {verified:false} in both chains.
    const missing = { ...correctedBinding, attemptId: 'attempt:study-g1-absent' }
    expect(await verify(corrected, missing)).toEqual({ verified: false })
    expect(await verify(baseline, { ...baselineBinding, attemptId: 'attempt:study-g1-absent' }))
      .toEqual({ verified: false })
  })

  it('changes no receipt field other than deliveredAt', async () => {
    const receipt = await verify(corrected, correctedBinding)
    const stored = await corrected.query<Record<string, unknown>>(`
      select
        receipt.receipt_schema_version::integer as "receiptSchemaVersion",
        receipt.provider_receipt_ref as "providerReceiptRef",
        notification.job_id::text as "jobId",
        notification.attempt_id as "attemptId",
        notification.delivery_idempotency_key as "deliveryIdempotencyKey",
        notification.recipient_ref as "recipientRef",
        notification.proposal_id as "proposalId",
        notification.household_id::text as "householdId",
        notification.student_id::text as "studentId",
        notification.route_ref as "routeRef",
        receipt.receipt_evidence_ref as "evidenceRef",
        event.event_idempotency_key as "eventIdempotencyKey",
        receipt.receipt_source as "receiptSource",
        receipt.test_receipt as "testReceipt"
      from academy_private.study_parent_notifications as notification
      join academy_private.study_adult_review_delivery_receipts as receipt
        on receipt.job_id = notification.job_id
       and receipt.attempt_id = notification.attempt_id
      join academy_private.study_adult_review_receipt_events as event
        on event.receipt_id = receipt.id and event.state = 'verified'
    `)
    expect(stored.rows).toHaveLength(1)
    expect(receipt).toEqual({
      verified: true,
      route: 'in-app',
      providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1',
      deliveredAt: NORMALIZED_INSTANT,
      ...stored.rows[0],
    })

    // Same eighteen keys as the pre-migration definition, and every value that
    // is not a per-database generated identifier is identical across chains.
    const before = await verify(baseline, baselineBinding)
    expect(Object.keys(receipt).sort()).toEqual(Object.keys(before).sort())
    const generated = new Set([
      'deliveredAt', 'jobId', 'providerReceiptRef', 'evidenceRef',
      'eventIdempotencyKey', 'deliveryIdempotencyKey', 'recipientRef', 'routeRef',
    ])
    for (const key of Object.keys(receipt)) {
      if (generated.has(key)) continue
      expect(receipt[key], key).toEqual(before[key])
    }
  })

  it('still rejects an unauthorized or mis-credentialed worker', async () => {
    await expect(verify(corrected, correctedBinding, { worker: 'worker:study-g1-imposter' }))
      .rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
    await expect(verify(corrected, correctedBinding, { credential: 'wrong-worker-credential' }))
      .rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
    await expect(rpc(
      corrected,
      `select public.academy_study_verify_in_app_notification_v2('${WORKER}', $1::jsonb) as result`,
      [JSON.stringify(correctedBinding)],
    )).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
  })

  it('still refuses every mis-bound proposal, household, student, job, attempt, and recipient', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['proposal', { proposalId: 'proposal:study-g1-other' }],
      ['household', { householdId: '00000000-0000-0000-0000-000000000022' }],
      ['student', { studentId: '00000000-0000-0000-0000-000000000201' }],
      ['job', { jobId: '00000000-0000-0000-0000-0000000009f1' }],
      ['attempt', { attemptId: 'attempt:study-g1-other' }],
      ['recipient', { recipientRef: `recipient:${'f'.repeat(64)}` }],
      ['route', { routeRef: `route:${'e'.repeat(64)}` }],
      ['deliveryKey', { deliveryIdempotencyKey: `delivery:${'0'.repeat(64)}` }],
      ['providerReceiptRef', { providerReceiptRef: 'receipt:study-g1-other' }],
    ]
    for (const [name, override] of cases) {
      expect(await verify(corrected, { ...correctedBinding, ...override }), name)
        .toEqual({ verified: false })
    }
  })

  it('still rejects malformed and unknown binding keys', async () => {
    await expect(verify(corrected, { ...correctedBinding, jobId: 'not-a-uuid' }))
      .rejects.toThrow(/invalid input syntax for type uuid/)
    await expect(verify(corrected, { ...correctedBinding, householdId: 'not-a-uuid' }))
      .rejects.toThrow(/invalid input syntax for type uuid/)
    await expect(verify(corrected, { ...correctedBinding, workerContext: 'extra' }))
      .rejects.toThrow(/STUDY_IN_APP_RECEIPT_INVALID/)
    const { providerReceiptRef, ...missing } = correctedBinding
    expect(providerReceiptRef).toBeTruthy()
    await expect(verify(corrected, missing))
      .rejects.toThrow(/STUDY_IN_APP_RECEIPT_INVALID/)
    await expect(verify(corrected, { ...correctedBinding, route: 'email' }))
      .rejects.toThrow(/STUDY_IN_APP_RECEIPT_INVALID/)
    await expect(verify(corrected, { ...correctedBinding, providerName: 'academy-email' }))
      .rejects.toThrow(/STUDY_IN_APP_RECEIPT_INVALID/)
    await expect(verify(corrected, { ...correctedBinding, providerConfigVersion: 'wrong-provider-version' }))
      .rejects.toThrow(/STUDY_IN_APP_RECEIPT_INVALID/)
  })

  it('preserves signature, ownership, security posture, and pinned search_path', async () => {
    const before = await posture(baseline)
    const after = await posture(corrected)
    expect(after).toEqual(before)
    expect(after).toMatchObject({
      identity: 'p_worker_id text, p_binding jsonb',
      result: 'jsonb',
      owner: 'postgres',
      security_definer: true,
      volatility: 'v',
      config: 'search_path=pg_catalog',
    })
  })

  it('preserves the exact grant set with PUBLIC, anon, and authenticated revoked', async () => {
    const before = await privileges(baseline)
    const after = await privileges(corrected)
    expect(after).toEqual(before)
    expect(after).toEqual({
      anon: false,
      authenticated: false,
      service_role: true,
      postgres: true,
    })
    const acl = (await posture(corrected)).acl
    expect(acl).toBe((await posture(baseline)).acl)
    expect(acl).toContain('service_role=X/postgres')
    // No PUBLIC entry: a PUBLIC grant is serialized with an empty grantee.
    expect(acl.split('|').some((entry) => entry.startsWith('='))).toBe(false)
    expect(acl).not.toContain('anon=')
    expect(acl).not.toContain('authenticated=')
  })
})
