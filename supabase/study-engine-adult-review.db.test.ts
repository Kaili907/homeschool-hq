import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const files = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './tests/study_engine_fixtures.sql',
] as const

const sql = Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
const structuralProbeSql = readFile(
  new URL('./tests/study_engine_adult_review_operations.sql', import.meta.url),
  'utf8',
)
let database: PGlite
const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const ACCESS_A = '00000000-0000-0000-0000-0000000001a1'
const ACCESS_SECOND_GUARDIAN = '00000000-0000-0000-0000-0000000001a3'
const PERMISSION_A = '00000000-0000-0000-0000-00000000f1a1'
const PERMISSION_SECOND_GUARDIAN = '00000000-0000-0000-0000-00000000f1a3'
const RECIPIENT_A = `recipient:${'a'.repeat(64)}`
const RECIPIENT_SECOND_GUARDIAN = `recipient:${'c'.repeat(64)}`
const ROUTE_A = `route:${'b'.repeat(64)}`
const ROUTE_SECOND_GUARDIAN = `route:${'d'.repeat(64)}`
const WORKER = 'worker:session17-synthetic'
const WORKER_CREDENTIAL = 'synthetic-worker-credential-session19'
const WORKER_CONFIGURATION_VERSION = 'worker-config-v1'
const WORKER_CREDENTIAL_VERSION = 'cred-v17-synthetic'

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

async function asService<T>(operation: () => Promise<T>): Promise<T> {
  await database.exec(`
    select set_config('request.jwt.claim.sub', '', false);
    select set_config('request.jwt.claims', '{"role":"service_role"}', false);
    select set_config('request.jwt.claim.role', 'service_role', false);
    set role service_role;
  `)
  try {
    return await operation()
  } finally {
    await database.exec(`
      reset role;
      select set_config('request.jwt.claims', '', false);
      select set_config('request.jwt.claim.role', '', false);
    `)
  }
}

async function asWorker<T>(operation: () => Promise<T>): Promise<T> {
  await database.exec(`
    select set_config('academy.study_worker_credential', '${WORKER_CREDENTIAL}', false);
    select set_config(
      'academy.study_worker_configuration_version',
      '${WORKER_CONFIGURATION_VERSION}', false
    );
    select set_config(
      'academy.study_worker_credential_version',
      '${WORKER_CREDENTIAL_VERSION}', false
    );
  `)
  try {
    return await asService(operation)
  } finally {
    await database.exec(`
      select set_config('academy.study_worker_credential', '', false);
      select set_config('academy.study_worker_configuration_version', '', false);
      select set_config('academy.study_worker_credential_version', '', false);
    `)
  }
}

async function rpc<T>(statement: string, parameters: unknown[] = []): Promise<T> {
  const result = await database.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  for (const migration of await sql) await database.exec(migration)
}, 120_000)

afterAll(async () => database.close())

describe.sequential('Study adult-review operations migration', () => {
  it('applies after Session 15 and records schema version 2', async () => {
    const result = await database.query<{
      version: number
      names: string[]
    }>(`
      select adult_review_operations_version as version, migration_names as names
      from academy_private.study_persistence_metadata where singleton
    `)
    expect(result.rows[0].version).toBe(2)
    expect(result.rows[0].names.at(-1)).toBe(
      '20260801170000_academy_study_adult_review_operations',
    )
  })

  it('installs the canonical state constraints and durable evidence relations', async () => {
    const states = await database.query<{ definition: string }>(`
      select pg_get_constraintdef(oid) as definition
      from pg_constraint
      where conname in (
        'study_proposals_v2_state_check',
        'study_proposals_v2_resolution_check',
        'study_delivery_jobs_v2_state_check'
      ) order by conname
    `)
    expect(states.rows.map((row) => row.definition).join('\n')).toContain('no-authorized-recipient')
    expect(states.rows.map((row) => row.definition).join('\n')).toContain('indeterminate')
    const relations = await database.query<{ name: string }>(`
      select to_regclass(name)::text as name
      from unnest(array[
        'academy_private.study_adult_review_attempt_events',
        'academy_private.study_adult_review_receipt_events',
        'academy_private.study_parent_notifications',
        'academy_private.study_adult_review_worker_registry',
        'academy_private.study_safety_rate_limit_scopes',
        'academy_private.study_adult_review_route_capabilities',
        'academy_private.study_adult_review_audit_events'
      ]) as name
    `)
    expect(relations.rows.every((row) => row.name !== null)).toBe(true)
  })

  it('forces RLS and gives ordinary roles no private table privileges', async () => {
    const rls = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'academy_private'
        and relation.relname in (
          'study_adult_review_attempt_events', 'study_adult_review_receipt_events',
          'study_parent_notifications', 'study_adult_review_worker_registry',
          'study_safety_rate_limit_scopes',
          'study_adult_review_route_capabilities', 'study_adult_review_audit_events'
        ) and relation.relrowsecurity and relation.relforcerowsecurity
    `)
    expect(rls.rows[0].count).toBe(7)
    const grants = await database.query<{ count: number }>(`
      select count(*)::integer as count from information_schema.role_table_grants
      where table_schema = 'academy_private'
        and grantee in ('anon', 'authenticated', 'service_role')
        and table_name like 'study_adult_review%'
    `)
    expect(grants.rows[0].count).toBe(0)
  })

  it('pins trusted search paths and exposes only the guardian projection to authenticated', async () => {
    const unpinned = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname in ('public', 'academy_private')
        and procedure.proname like '%adult_review%'
        and procedure.prosecdef
        and not (procedure.proconfig @> array['search_path=pg_catalog'])
    `)
    expect(unpinned.rows[0].count).toBe(0)
    const access = await database.query<{ guardian_read: boolean; anon_read: boolean }>(`
      select
        has_function_privilege('authenticated', 'public.academy_study_list_parent_notifications_v1(integer)', 'execute') as guardian_read,
        has_function_privilege('anon', 'public.academy_study_list_parent_notifications_v1(integer)', 'execute') as anon_read
    `)
    expect(access.rows).toEqual([{ guardian_read: true, anon_read: false }])
  })

  it('passes the standalone structural and authorization probe', async () => {
    await expect(database.exec(await structuralProbeSql)).resolves.toBeDefined()
  })

  it('classifies v1 RPCs, preserves canonical rate scopes, and uses safe volatility', async () => {
    const superseded = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from unnest(array[
        'public.academy_study_claim_adult_review_proposals_v1(timestamptz, integer, integer)',
        'public.academy_study_resolve_adult_recipients_v1(text)',
        'public.academy_study_reauthorize_adult_route_v1(jsonb)',
        'public.academy_study_record_recipient_resolution_v1(jsonb)',
        'public.academy_study_claim_delivery_jobs_v1(timestamptz, integer, integer)',
        'public.academy_study_record_delivery_attempt_v1(jsonb)',
        'public.academy_study_record_delivery_receipt_v1(jsonb)',
        'public.academy_study_record_delivery_outcome_v1(jsonb)'
      ]) as rpc(signature)
      where has_function_privilege('service_role', rpc.signature, 'execute')
    `)
    expect(superseded.rows[0].count).toBe(0)

    const compatibility = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from unnest(array[
        'public.academy_study_set_adult_notification_permission_v1(jsonb, bigint)',
        'public.academy_study_set_adult_notification_route_v1(jsonb, bigint)',
        'public.academy_study_create_adult_review_proposal_v1(jsonb)',
        'public.academy_study_reserve_safety_rate_limit_v1(jsonb)',
        'public.academy_study_record_safety_monitoring_event_v1(jsonb)',
        'public.academy_study_safety_durable_readiness_v1()'
      ]) as rpc(signature)
      where has_function_privilege('service_role', rpc.signature, 'execute')
    `)
    expect(compatibility.rows[0].count).toBe(6)

    const scopes = await database.query<{ scope: string }>(`
      select scope from academy_private.study_safety_rate_limit_scopes
      where enabled order by scope
    `)
    expect(scopes.rows.map(({ scope }) => scope)).toEqual([
      'classification', 'delivery-attempt', 'parent-notification-read',
      'proposal-creation', 'recipient-resolution', 'study-safety-classify',
      'study-safety-classify-subject-route', 'worker-claim',
    ])

    const unsafeVolatility = await database.query<{ names: string[] }>(`
      select coalesce(array_agg(procedure.proname order by procedure.proname), '{}') as names
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname in ('public', 'academy_private')
        and procedure.prokind = 'f'
        and pg_get_functiondef(procedure.oid) ~
          '(clock_timestamp\\(\\)|transaction_timestamp\\(\\)|now\\(\\))'
        and procedure.provolatile = 'i'
    `)
    expect(unsafeVolatility.rows[0].names).toEqual([])
  })

  it('reports not-ready until an authorized worker is configured without exposing it', async () => {
    const result = await asService(() => database.query<{ result: Record<string, unknown> }>(`
      select public.academy_study_adult_review_readiness_v2() as result
    `))
    expect(result.rows[0].result).toMatchObject({ state: 'not-ready', schemaVersion: 2 })
    expect(JSON.stringify(result.rows[0].result)).not.toMatch(
      /recipientRef|permissionRef|credentialDigest|secret/i,
    )
  })

  it('uses explicit permission, opaque resolution, leases, attempt events, and atomic in-app delivery', async () => {
    await database.exec(`
      insert into academy_private.study_adult_review_worker_registry (
        worker_id, configuration_version, credential_version,
        authorized_scopes, credential_digest, expires_at
      ) values (
        '${WORKER}', '${WORKER_CONFIGURATION_VERSION}',
        '${WORKER_CREDENTIAL_VERSION}',
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
    `)
    await asService(() => rpc(
      `select public.academy_study_set_adult_notification_permission_v1(
        $1::jsonb, 0
      ) as result`,
      [JSON.stringify({
        permissionId: PERMISSION_A,
        guardianAccessId: ACCESS_A,
        recipientRef: RECIPIENT_A,
        allowedChannels: ['in-app'],
        status: 'active',
        policyVersion: 'adult-notification-policy-v2',
        provenanceRef: 'guardian-consent:synthetic-session17',
      })],
    ))
    await asService(() => rpc(
      `select public.academy_study_set_adult_notification_route_v1(
        $1::jsonb, 0
      ) as result`,
      [JSON.stringify({
        routeRef: ROUTE_A,
        permissionId: PERMISSION_A,
        recipientRef: RECIPIENT_A,
        channel: 'in-app',
        status: 'active',
        providerRouteVersion: 'in-app-config-v1',
      })],
    ))
    const proposalId = 'proposal:session17-synthetic'
    expect(await asService(() => rpc(
      `select public.academy_study_create_adult_review_proposal_v1(
        $1::jsonb
      ) as result`,
      [JSON.stringify({
        schemaVersion: 1,
        proposalId,
        householdId: HOUSEHOLD_A,
        studentId: STUDENT_A,
        sessionId: 'session-a',
        category: 'student-support',
        classification: 'urgent',
        urgency: 'urgent',
        reasonCodes: ['safety-urgent-synthetic-v1'],
        classifierVersion: 'test-safety-classifier-v1',
        occurredAt: new Date().toISOString(),
        idempotencyKey: 'proposal:session17-synthetic:idempotency',
        deliveryState: 'proposed-not-delivered',
        authorizedRecipientResolutionState: 'pending',
      })],
    ))).toEqual({ created: true })
    const claims = await asWorker(() => rpc<{ proposals: Array<Record<string, unknown>> }>(
      `select public.academy_study_claim_adult_review_proposals_v2(
        '${WORKER}', 10, 30
      ) as result`,
    ))
    const claim = claims.proposals[0]
    expect(claim).toMatchObject({ proposalRef: proposalId })
    const resolution = await asWorker(() => rpc<{
      householdRef: string
      learnerRef: string
      proposalRef: string
      proposalRevision: number
      state: string
      resolutionRef: string
      policyVersion: string
      recipients: Array<Record<string, unknown>>
    }>(`select public.academy_study_resolve_adult_recipients_v2(
      '${proposalId}', '${WORKER}'
    ) as result`))
    expect(resolution.state).toBe('resolved')
    expect(JSON.stringify(resolution)).not.toMatch(/@|phone|address|membershipId|guardianAccessId/i)
    const routed = await asWorker(() => rpc<{ jobs: Array<Record<string, unknown>> }>(
      `select public.academy_study_record_recipient_resolution_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
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
    expect(routed.jobs).toHaveLength(1)
    const jobClaims = await asWorker(() => rpc<{ jobs: Array<Record<string, unknown>> }>(
      `select public.academy_study_claim_delivery_jobs_v2(
        '${WORKER}', 10, 30
      ) as result`,
    ))
    const job = jobClaims.jobs[0]
    const attemptId = 'attempt:session17-synthetic'
    const attempt = await asWorker(() => rpc<{ revision: number }>(
      `select public.academy_study_create_delivery_attempt_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify({
        jobId: job.jobId,
        leaseToken: job.leaseToken,
        expectedRevision: job.revision,
        attemptId,
        providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1',
      })],
    ))
    for (const state of ['created', 'submitted', 'provider-accepted']) {
      await asWorker(() => rpc(
        `select public.academy_study_record_attempt_event_v2(
          '${WORKER}', $1::jsonb
        ) as result`,
        [JSON.stringify({
          attemptId,
          jobId: job.jobId,
          state,
          structuredResult: `synthetic-${state}`,
          timeoutState: 'not-timed-out',
          retryDecision: 'not-applicable',
          errorCode: null,
        })],
      ))
    }
    const delivered = await asWorker(() => rpc<Record<string, unknown>>(
      `select public.academy_study_deliver_in_app_notification_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify({
        schemaVersion: 2,
        jobId: job.jobId,
        leaseToken: job.leaseToken,
        expectedRevision: attempt.revision,
        attemptId,
        deliveryIdempotencyKey: job.idempotencyKey,
        recipientRef: job.recipientRef,
        routeRef: job.routeRef,
        proposalId,
        householdId: HOUSEHOLD_A,
        studentId: STUDENT_A,
        providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1',
      })],
    ))
    expect(delivered).toMatchObject({ state: 'delivered', attemptId })
    expect(JSON.stringify(delivered)).not.toMatch(/raw|transcript|@|phone/i)
    expect(await asWorker(() => rpc(
      `select public.academy_study_deliver_in_app_notification_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify({
        schemaVersion: 2,
        jobId: job.jobId,
        leaseToken: job.leaseToken,
        expectedRevision: attempt.revision,
        attemptId,
        deliveryIdempotencyKey: job.idempotencyKey,
        recipientRef: job.recipientRef,
        routeRef: job.routeRef,
        proposalId,
        householdId: HOUSEHOLD_A,
        studentId: STUDENT_A,
        providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1',
      })],
    ))).toMatchObject({ state: 'already-delivered', attemptId })
    const verified = await asWorker(() => rpc<Record<string, unknown>>(
      `select public.academy_study_verify_in_app_notification_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify({
        providerReceiptRef: delivered.providerReceiptRef,
        providerName: 'academy-in-app',
        route: 'in-app',
        routeRef: job.routeRef,
        jobId: job.jobId,
        attemptId,
        proposalId,
        householdId: HOUSEHOLD_A,
        studentId: STUDENT_A,
        recipientRef: job.recipientRef,
        deliveryIdempotencyKey: job.idempotencyKey,
        providerConfigVersion: 'in-app-config-v1',
      })],
    ))
    expect(verified).toMatchObject({
      verified: true,
      receiptSchemaVersion: 1,
      testReceipt: false,
      receiptSource: 'server-verified',
    })
    expect(await asWorker(() => rpc(
      `select public.academy_study_verify_in_app_notification_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify({
        providerReceiptRef: delivered.providerReceiptRef,
        providerName: 'academy-in-app',
        route: 'in-app',
        routeRef: job.routeRef,
        jobId: job.jobId,
        attemptId,
        proposalId,
        householdId: HOUSEHOLD_A,
        studentId: STUDENT_A,
        recipientRef: `recipient:${'f'.repeat(64)}`,
        deliveryIdempotencyKey: job.idempotencyKey,
        providerConfigVersion: 'in-app-config-v1',
      })],
    ))).toEqual({ verified: false })
    await expect(asWorker(() => rpc(
      `select public.academy_study_verify_in_app_notification_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify({
        providerReceiptRef: delivered.providerReceiptRef,
        providerName: 'academy-in-app',
        route: 'in-app',
        routeRef: job.routeRef,
        jobId: job.jobId,
        attemptId,
        proposalId,
        householdId: HOUSEHOLD_A,
        studentId: STUDENT_A,
        recipientRef: job.recipientRef,
        deliveryIdempotencyKey: job.idempotencyKey,
        providerConfigVersion: 'wrong-provider-version',
      })],
    ))).rejects.toThrow(/STUDY_IN_APP_RECEIPT_INVALID/)
    const persisted = await database.query<{ jobs: number; notifications: number; receipts: number }>(`
      select
        (select count(*)::integer from academy_private.study_adult_review_delivery_jobs where state = 'delivered') as jobs,
        (select count(*)::integer from academy_private.study_parent_notifications) as notifications,
        (select count(*)::integer from academy_private.study_adult_review_delivery_receipts) as receipts
    `)
    expect(persisted.rows[0]).toEqual({ jobs: 1, notifications: 1, receipts: 1 })

    const receiptBinding = await database.query<{
      receipts: number
      receipt_events: number
      verified_attempt_events: number
    }>(`
      select
        (select count(*)::integer
          from academy_private.study_adult_review_delivery_receipts
          where proposal_id = '${proposalId}'
            and household_id = '${HOUSEHOLD_A}'
            and student_id = '${STUDENT_A}'
            and verification_state = 'verified'
            and receipt_environment = 'production'
            and receipt_source = 'server-verified'
            and not test_receipt) as receipts,
        (select count(*)::integer
          from academy_private.study_adult_review_receipt_events
          where proposal_id = '${proposalId}'
            and household_id = '${HOUSEHOLD_A}'
            and student_id = '${STUDENT_A}'
            and state = 'verified') as receipt_events,
        (select count(*)::integer
          from academy_private.study_adult_review_attempt_events
          where attempt_id = '${attemptId}'
            and state = 'receipt-verified'
            and receipt_reference is not null) as verified_attempt_events
    `)
    expect(receiptBinding.rows[0]).toEqual({
      receipts: 1,
      receipt_events: 1,
      verified_attempt_events: 1,
    })
  })

  it('rejects forged, revoked, wrong-scope, expired, and wrong-version workers', async () => {
    await expect(asWorker(() => rpc(
      `select public.academy_study_claim_adult_review_proposals_v2(
        'worker:forged', 1, 30
      ) as result`,
    ))).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)

    await database.exec(`
      update academy_private.study_adult_review_worker_registry
      set status = 'revoked', revoked_at = clock_timestamp(), revision = revision + 1
      where worker_id = '${WORKER}'
    `)
    await expect(asWorker(() => rpc(
      `select public.academy_study_claim_adult_review_proposals_v2(
        '${WORKER}', 1, 30
      ) as result`,
    ))).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
    await database.exec(`
      update academy_private.study_adult_review_worker_registry
      set status = 'active', revoked_at = null, revision = revision + 1
      where worker_id = '${WORKER}'
    `)

    await database.exec(`
      update academy_private.study_adult_review_worker_registry
      set authorized_scopes = array['monitoring'], revision = revision + 1
      where worker_id = '${WORKER}'
    `)
    await expect(asWorker(() => rpc(
      `select public.academy_study_claim_adult_review_proposals_v2(
        '${WORKER}', 1, 30
      ) as result`,
    ))).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
    await database.exec(`
      update academy_private.study_adult_review_worker_registry
      set authorized_scopes = array[
        'proposal-resolution', 'delivery-claim', 'delivery-attempt',
        'delivery-reconcile', 'monitoring', 'rate-limit', 'retention'
      ], revision = revision + 1
      where worker_id = '${WORKER}'
    `)

    await database.exec(`
      update academy_private.study_adult_review_worker_registry
      set effective_at = clock_timestamp() - interval '2 days',
          rotated_at = clock_timestamp() - interval '2 days',
          expires_at = clock_timestamp() - interval '1 day',
          revision = revision + 1
      where worker_id = '${WORKER}'
    `)
    await expect(asWorker(() => rpc(
      `select public.academy_study_claim_adult_review_proposals_v2(
        '${WORKER}', 1, 30
      ) as result`,
    ))).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
    await database.exec(`
      update academy_private.study_adult_review_worker_registry
      set effective_at = clock_timestamp(), rotated_at = clock_timestamp(),
          expires_at = clock_timestamp() + interval '1 day',
          revision = revision + 1
      where worker_id = '${WORKER}'
    `)

    await database.exec(`
      select set_config('academy.study_worker_credential', '${WORKER_CREDENTIAL}', false);
      select set_config(
        'academy.study_worker_configuration_version',
        '${WORKER_CONFIGURATION_VERSION}', false
      );
      select set_config('academy.study_worker_credential_version', '2', false);
    `)
    await expect(asService(() => rpc(
      `select public.academy_study_claim_adult_review_proposals_v2(
        '${WORKER}', 1, 30
      ) as result`,
    ))).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
    await database.exec(`
      select set_config('academy.study_worker_credential', '', false);
      select set_config('academy.study_worker_configuration_version', '', false);
      select set_config('academy.study_worker_credential_version', '', false);
    `)

    const audit = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from academy_private.study_adult_review_audit_events
      where event_name = 'worker-authorization'
        and worker_id = '${WORKER}'
        and worker_credential_version = '${WORKER_CREDENTIAL_VERSION}'
        and worker_configuration_version = '${WORKER_CONFIGURATION_VERSION}'
    `)
    expect(audit.rows[0].count).toBeGreaterThan(0)
  })

  it('enqueues two guardians on the same in-app channel without weakening duplicate suppression', async () => {
    await database.exec(`
      update public.academy_guardian_student_access
      set permission_level = 'learning_manager'
      where id = '${ACCESS_SECOND_GUARDIAN}'
    `)
    await asService(() => rpc(
      `select public.academy_study_set_adult_notification_permission_v1(
        $1::jsonb, 0
      ) as result`,
      [JSON.stringify({
        permissionId: PERMISSION_SECOND_GUARDIAN,
        guardianAccessId: ACCESS_SECOND_GUARDIAN,
        recipientRef: RECIPIENT_SECOND_GUARDIAN,
        allowedChannels: ['in-app'],
        status: 'active',
        policyVersion: 'adult-notification-policy-v2',
        provenanceRef: 'guardian-consent:synthetic-second-guardian',
      })],
    ))
    await asService(() => rpc(
      `select public.academy_study_set_adult_notification_route_v1(
        $1::jsonb, 0
      ) as result`,
      [JSON.stringify({
        routeRef: ROUTE_SECOND_GUARDIAN,
        permissionId: PERMISSION_SECOND_GUARDIAN,
        recipientRef: RECIPIENT_SECOND_GUARDIAN,
        channel: 'in-app',
        status: 'active',
        providerRouteVersion: 'in-app-config-v1',
      })],
    ))
    const proposalRef = 'proposal:two-guardians-session19'
    await asService(() => rpc(
      `select public.academy_study_create_adult_review_proposal_v1(
        $1::jsonb
      ) as result`,
      [JSON.stringify({
        schemaVersion: 1,
        proposalId: proposalRef,
        householdId: HOUSEHOLD_A,
        studentId: STUDENT_A,
        sessionId: 'session-a',
        category: 'student-support',
        classification: 'urgent',
        urgency: 'urgent',
        reasonCodes: ['safety-urgent-two-guardians'],
        classifierVersion: 'test-safety-classifier-v1',
        occurredAt: new Date().toISOString(),
        idempotencyKey: 'proposal:two-guardians:idempotency',
        deliveryState: 'proposed-not-delivered',
        authorizedRecipientResolutionState: 'pending',
      })],
    ))
    const claims = await asWorker(() => rpc<{ proposals: Array<Record<string, unknown>> }>(
      `select public.academy_study_claim_adult_review_proposals_v2(
        '${WORKER}', 10, 30
      ) as result`,
    ))
    const claim = claims.proposals.find((candidate) => candidate.proposalRef === proposalRef)!
    const resolution = await asWorker(() => rpc<{
      householdRef: string
      learnerRef: string
      proposalRevision: number
      resolutionRef: string
      policyVersion: string
      recipients: Array<Record<string, unknown>>
    }>(
      `select public.academy_study_resolve_adult_recipients_v2(
        '${proposalRef}', '${WORKER}'
      ) as result`,
    ))
    expect(resolution.recipients).toHaveLength(2)
    const recorded = await asWorker(() => rpc<{ jobs: Array<Record<string, unknown>> }>(
      `select public.academy_study_record_recipient_resolution_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify({
        householdRef: resolution.householdRef,
        learnerRef: resolution.learnerRef,
        proposalRef,
        proposalRevision: resolution.proposalRevision,
        leaseToken: claim.leaseToken,
        expectedRevision: claim.revision,
        state: 'resolved',
        resolutionRef: resolution.resolutionRef,
        policyVersion: resolution.policyVersion,
        recipients: resolution.recipients,
      })],
    ))
    expect(recorded.jobs).toHaveLength(2)
    expect(new Set(recorded.jobs.map((job) => job.recipientRef)).size).toBe(2)
    expect(new Set(recorded.jobs.map((job) => job.route))).toEqual(new Set(['in-app']))
    const cardinality = await database.query<{ jobs: number; tuples: number }>(`
      select count(*)::integer as jobs,
        count(distinct (recipient_ref, route_ref))::integer as tuples
      from academy_private.study_adult_review_delivery_jobs
      where proposal_id = '${proposalRef}'
    `)
    expect(cardinality.rows).toEqual([{ jobs: 2, tuples: 2 }])
    await database.exec(`
      update academy_private.study_adult_review_delivery_jobs
      set state = 'cancelled', revision = revision + 1,
          updated_at = clock_timestamp()
      where proposal_id = '${proposalRef}'
    `)
  })

  it('cancels stale-permission jobs idempotently and audits the job revision', async () => {
    const proposalId = 'proposal:stale-permission-session19'
    await database.exec(`
      insert into academy_private.study_adult_review_proposals_v1 (
        proposal_id, household_id, student_id, session_id, classification,
        urgency, reason_codes, classifier_version, occurred_at,
        idempotency_key, state, recipient_resolution_state,
        resolution_ref, resolution_policy_version
      ) values (
        '${proposalId}', '${HOUSEHOLD_A}', '${STUDENT_A}', 'session-a',
        'urgent', 'urgent', array['safety-urgent-stale-permission'],
        'production-safety-v1', clock_timestamp(),
        'proposal-idempotency:stale-permission-session19',
        'accepted', 'resolved', 'resolution:stale-permission-session19',
        'adult-notification-policy-v2'
      );
      insert into academy_private.study_adult_review_delivery_jobs (
        proposal_id, household_id, student_id, recipient_ref, route_ref,
        channel, delivery_idempotency_key, permission_id,
        permission_revision, route_revision, recipient_version
      ) select '${proposalId}', '${HOUSEHOLD_A}', '${STUDENT_A}',
        permission.recipient_ref, route.route_ref, route.channel,
        'delivery:stale-permission-session19', permission.id,
        permission.revision, route.revision, permission.permission_version
      from academy_private.study_adult_notification_permissions as permission
      join academy_private.study_adult_notification_routes as route
        on route.permission_id = permission.id
      where permission.id = '${PERMISSION_A}' and route.route_ref = '${ROUTE_A}';
      update academy_private.study_adult_notification_permissions
      set status = 'revoked', revoked_at = clock_timestamp(),
          revision = revision + 1, updated_at = clock_timestamp()
      where id = '${PERMISSION_A}';
    `)
    expect(await asWorker(() => rpc(
      `select public.academy_study_cancel_invalid_delivery_jobs_v2(
        '${WORKER}', 10
      ) as result`,
    ))).toEqual({ cancelledCount: 1 })
    expect(await asWorker(() => rpc(
      `select public.academy_study_cancel_invalid_delivery_jobs_v2(
        '${WORKER}', 10
      ) as result`,
    ))).toEqual({ cancelledCount: 0 })
    const cancelled = await database.query<{ state: string; audit: number }>(`
      select job.state,
        (select count(*)::integer
          from academy_private.study_adult_review_audit_events as audit
          where audit.event_name = 'invalid-job-cancelled'
            and audit.job_ref = job.id::text) as audit
      from academy_private.study_adult_review_delivery_jobs as job
      where job.proposal_id = '${proposalId}'
    `)
    expect(cancelled.rows).toEqual([{ state: 'cancelled', audit: 1 }])
    await database.exec(`
      update academy_private.study_adult_notification_permissions
      set status = 'active', revoked_at = null, revision = revision + 1,
          updated_at = clock_timestamp()
      where id = '${PERMISSION_A}'
    `)
  })

  it('durably records closed-schema monitoring and purges only expired bounded records', async () => {
    const monitoring = {
      schemaVersion: 2,
      eventName: 'study.adult_review.outbox_backlog',
      eventId: 'event:session17-synthetic',
      occurredAt: '2026-08-01T17:00:00.000Z',
      occurrenceBucket: '2026-08-01T17:00:00.000Z',
      severity: 'warning',
      retentionDays: 90,
      householdRef: 'none',
      learnerRef: 'none',
      proposalRef: 'none',
      jobRef: 'none',
      attemptRef: 'none',
      idempotencyKey: 'monitoring:session17-synthetic',
      dimensions: { environment: 'test', route: 'in_app' },
      measurement: { name: 'job_count', unit: 'count', value: 50, occurrences: 1 },
      threshold: {
        basis: 'value', observed: 50, operator: 'gte', value: 50,
        windowSeconds: 600, triggered: true,
      },
    }
    expect(await asWorker(() => rpc(
      `select public.academy_study_record_adult_review_monitoring_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify(monitoring)],
    ))).toEqual({ recorded: true })
    await expect(asWorker(() => rpc(
      `select public.academy_study_record_adult_review_monitoring_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify({
        ...monitoring,
        dimensions: { environment: 'test', route: 'email' },
      })],
    ))).rejects.toThrow(/STUDY_MONITORING_EVENT_IDEMPOTENCY_COLLISION/)

    const bucket = await database.query<{ id: string }>(`
      insert into academy_private.study_safety_rate_limit_buckets (
        actor_ref, household_ref, learner_ref, route_ref, scope,
        window_started_at, window_seconds, capacity, used, retain_until
      ) values (
        'actor:${'a'.repeat(64)}', 'household:${'b'.repeat(64)}',
        'learner:${'c'.repeat(64)}', 'route:${'d'.repeat(64)}',
        'worker-claim', clock_timestamp() - interval '3 days', 60, 5, 1,
        clock_timestamp() - interval '1 second'
      ) returning id
    `)
    await database.exec(`
      insert into academy_private.study_safety_rate_limit_reservations (
        actor_ref, household_ref, learner_ref, route_ref, scope,
        bucket_id, request_digest, allowed, retain_until
      ) values (
        'actor:${'a'.repeat(64)}', 'household:${'b'.repeat(64)}',
        'learner:${'c'.repeat(64)}', 'route:${'d'.repeat(64)}',
        'worker-claim', '${bucket.rows[0].id}', '${'e'.repeat(64)}', true,
        clock_timestamp() - interval '1 second'
      )
    `)
    const purged = await asWorker(() => rpc<{
      state: string
      deleted: { buckets: number; reservations: number }
    }>(`select public.academy_study_purge_adult_review_retention_v2(
      '${WORKER}', 100
    ) as result`))
    expect(purged).toMatchObject({
      state: 'completed',
      deleted: { buckets: 1, reservations: 1 },
    })
    const retained = await database.query<{ monitoring: number; purge_audit: number }>(`
      select
        (select count(*)::integer from academy_private.study_safety_monitoring_events
          where event_id = 'event:session17-synthetic') as monitoring,
        (select count(*)::integer from academy_private.study_adult_review_audit_events
          where event_name = 'retention-purge') as purge_audit
    `)
    expect(retained.rows[0]).toEqual({ monitoring: 1, purge_audit: 1 })
  })

  it('converts every predecessor delivery state with row-safe lease handling', async () => {
    const rowDatabase = await PGlite.create()
    try {
      await rowDatabase.exec(bootstrap)
      const migrations = await sql
      for (const migration of migrations.slice(0, 6)) await rowDatabase.exec(migration)
      await rowDatabase.exec(migrations[7])
      await rowDatabase.exec(`
        insert into academy_private.study_adult_notification_permissions (
          id, household_id, student_id, guardian_access_id, membership_id,
          recipient_ref, allowed_channels, status, policy_version, provenance_ref
        ) values (
          '${PERMISSION_A}', '${HOUSEHOLD_A}', '${STUDENT_A}', '${ACCESS_A}',
          '00000000-0000-0000-0000-0000000000a2', '${RECIPIENT_A}',
          array['in-app'], 'active', 'adult-notification-policy-v2',
          'guardian-consent:row-safe-fixture'
        );
        insert into academy_private.study_adult_notification_routes (
          route_ref, permission_id, household_id, student_id, recipient_ref,
          channel, status, provider_route_version
        ) values (
          '${ROUTE_A}', '${PERMISSION_A}', '${HOUSEHOLD_A}', '${STUDENT_A}',
          '${RECIPIENT_A}', 'in-app', 'active', 'in-app-config-v1'
        );
        insert into academy_private.study_adult_review_proposals_v1 (
          proposal_id, household_id, student_id, session_id, classification,
          urgency, reason_codes, classifier_version, occurred_at,
          idempotency_key, state, recipient_resolution_state,
          resolution_ref, resolution_policy_version
        )
        select 'proposal:row-safe-' || state_name, '${HOUSEHOLD_A}',
          '${STUDENT_A}', 'session-a', 'urgent', 'urgent',
          array['safety-urgent-row-safe'], 'production-safety-v1',
          clock_timestamp() - interval '1 hour',
          'proposal-idempotency:row-safe-' || state_name,
          'routed', 'resolved', 'resolution:row-safe-' || state_name,
          'adult-notification-policy-v2'
        from unnest(array[
          'pending', 'active-claimed', 'expired-empty', 'expired-attempt',
          'retry', 'indeterminate', 'delivered', 'permanent', 'cancelled'
        ]) as state_name;

        insert into academy_private.study_adult_review_delivery_jobs (
          proposal_id, household_id, student_id, recipient_ref, route_ref,
          channel, delivery_idempotency_key, state, retry_at, lease_token,
          lease_expires_at, lease_generation, last_failure_code,
          failed_at, delivered_at
        )
        select 'proposal:row-safe-' || state_name, '${HOUSEHOLD_A}',
          '${STUDENT_A}', '${RECIPIENT_A}', '${ROUTE_A}', 'in-app',
          'delivery:row-safe-' || state_name,
          case state_name
            when 'active-claimed' then 'claimed'
            when 'expired-empty' then 'claimed'
            when 'expired-attempt' then 'claimed'
            when 'retry' then 'retry-scheduled'
            when 'permanent' then 'permanent-failure'
            else state_name
          end,
          case when state_name = 'retry' then clock_timestamp() + interval '1 minute' end,
          case when state_name in ('active-claimed', 'expired-empty', 'expired-attempt')
            then gen_random_uuid() end,
          case when state_name = 'active-claimed' then clock_timestamp() + interval '1 hour'
            when state_name in ('expired-empty', 'expired-attempt')
              then clock_timestamp() - interval '1 hour' end,
          case when state_name in ('active-claimed', 'expired-empty', 'expired-attempt')
            then 1 else 0 end,
          case when state_name in ('retry', 'indeterminate', 'permanent')
            then 'synthetic-predecessor-failure' end,
          case when state_name in ('retry', 'indeterminate', 'permanent')
            then clock_timestamp() - interval '1 minute' end,
          case when state_name = 'delivered'
            then clock_timestamp() - interval '1 minute' end
        from unnest(array[
          'pending', 'active-claimed', 'expired-empty', 'expired-attempt',
          'retry', 'indeterminate', 'delivered', 'permanent', 'cancelled'
        ]) as state_name;
        insert into academy_private.study_adult_review_delivery_attempts (
          attempt_id, job_id, household_id, student_id, attempt_ordinal,
          lease_generation, delivery_idempotency_key, recipient_ref, route_ref,
          channel, provider_version, authorization_evidence_ref, attempted_at
        )
        select 'attempt:row-safe-expired', job.id, job.household_id,
          job.student_id, 1, 1, job.delivery_idempotency_key,
          job.recipient_ref, job.route_ref, job.channel,
          'academy-in-app:legacy', 'authorization:row-safe',
          clock_timestamp() - interval '2 hours'
        from academy_private.study_adult_review_delivery_jobs as job
        where job.proposal_id = 'proposal:row-safe-expired-attempt';
        insert into academy_private.study_adult_review_delivery_attempts (
          attempt_id, job_id, household_id, student_id, attempt_ordinal,
          lease_generation, delivery_idempotency_key, recipient_ref, route_ref,
          channel, provider_version, authorization_evidence_ref, attempted_at
        )
        select 'attempt:row-safe-delivered', job.id, job.household_id,
          job.student_id, 1, 1, job.delivery_idempotency_key,
          job.recipient_ref, job.route_ref, job.channel,
          'academy-in-app:legacy', 'authorization:row-safe-delivered',
          clock_timestamp() - interval '2 hours'
        from academy_private.study_adult_review_delivery_jobs as job
        where job.proposal_id = 'proposal:row-safe-delivered';
        insert into academy_private.study_adult_review_delivery_receipts (
          attempt_id, job_id, household_id, student_id, provider_version,
          provider_receipt_ref, receipt_evidence_ref, delivered_at
        )
        select attempt.attempt_id, attempt.job_id, attempt.household_id,
          attempt.student_id, attempt.provider_version,
          'receipt:row-safe-legacy', 'evidence:row-safe-legacy',
          clock_timestamp() - interval '1 hour'
        from academy_private.study_adult_review_delivery_attempts as attempt
        where attempt.attempt_id = 'attempt:row-safe-delivered';
      `)

      await rowDatabase.exec(migrations[6])
      const states = await rowDatabase.query<{
        suffix: string
        state: string
        lease_owner: string | null
        failure: string | null
      }>(`
        select replace(proposal_id, 'proposal:row-safe-', '') as suffix,
          state, lease_owner, last_failure_code as failure
        from academy_private.study_adult_review_delivery_jobs
        where proposal_id like 'proposal:row-safe-%'
        order by suffix
      `)
      expect(states.rows).toEqual([
        { suffix: 'active-claimed', state: 'leased', lease_owner: 'worker:legacy-migration-quarantine', failure: null },
        { suffix: 'cancelled', state: 'cancelled', lease_owner: null, failure: null },
        { suffix: 'delivered', state: 'indeterminate', lease_owner: null, failure: 'legacy-receipt-requires-reconciliation' },
        { suffix: 'expired-attempt', state: 'indeterminate', lease_owner: null, failure: 'legacy-lease-expired-after-attempt' },
        { suffix: 'expired-empty', state: 'pending', lease_owner: null, failure: null },
        { suffix: 'indeterminate', state: 'indeterminate', lease_owner: null, failure: 'synthetic-predecessor-failure' },
        { suffix: 'pending', state: 'pending', lease_owner: null, failure: null },
        { suffix: 'permanent', state: 'permanent-failure', lease_owner: null, failure: 'synthetic-predecessor-failure' },
        { suffix: 'retry', state: 'retryable', lease_owner: null, failure: 'synthetic-predecessor-failure' },
      ])
      const legacyReceipt = await rowDatabase.query<{
        verification: string
        environment: string
        source: string
        test_receipt: boolean
        proposal: string
      }>(`
        select verification_state as verification,
          receipt_environment as environment,
          receipt_source as source,
          test_receipt,
          proposal_id as proposal
        from academy_private.study_adult_review_delivery_receipts
        where attempt_id = 'attempt:row-safe-delivered'
      `)
      expect(legacyReceipt.rows).toEqual([{
        verification: 'legacy-unverified',
        environment: 'legacy-migrated',
        source: 'legacy-unverified',
        test_receipt: true,
        proposal: 'proposal:row-safe-delivered',
      }])
    } finally {
      await rowDatabase.close()
    }
  }, 120_000)
})
