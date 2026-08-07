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

// ---------------------------------------------------------------------------
// STUDY-C2 v2 operations contract closure.
//
// The Session 17/19 chain above is left exactly as-is. The C2 contract changes
// the delivery state machine (M6) and the terminal lease projection (M5), so it
// is exercised against its own ephemeral database that applies the full hosted
// chain including 20260801190000 and the C2 forward migration.
// ---------------------------------------------------------------------------

const G1_MIGRATION = './migrations/20260806120000_academy_study_in_app_receipt_timestamp.sql'
const C2_MIGRATION = './migrations/20260806140000_academy_study_c2_operations_contract.sql'

// Natural migration version order. 20260806120000 (G1 receipt timestamp
// normalization) sorts before 20260806140000 (C2 operations contract), so a
// hosted apply runs G1 first. The chain below is that order, not a convenience
// ordering: C2's predecessor precondition requires G1 to be present.
const c2Files = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  G1_MIGRATION,
  C2_MIGRATION,
  './tests/study_engine_fixtures.sql',
] as const

const HOUSEHOLD_B = '00000000-0000-0000-0000-000000000022'
const STUDENT_B = '00000000-0000-0000-0000-000000000201'
const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const MEMBERSHIP_A = '00000000-0000-0000-0000-0000000000a2'
const C2_WORKER = 'worker:c2-synthetic'
const C2_CLAIM_ONLY_WORKER = 'worker:c2-claim-only'
const C2_OTHER_WORKER = 'worker:c2-other'
const C2_REVOKED_WORKER = 'worker:c2-revoked'

let c2: PGlite

async function c2Read(path: string): Promise<string | null> {
  try {
    return await readFile(new URL(path, import.meta.url), 'utf8')
  } catch {
    return null
  }
}

async function c2AsService<T>(operation: () => Promise<T>): Promise<T> {
  await c2.exec(`
    select set_config('request.jwt.claims', '{"role":"service_role"}', false);
    select set_config('request.jwt.claim.role', 'service_role', false);
    set role service_role;
  `)
  try {
    return await operation()
  } finally {
    await c2.exec(`
      reset role;
      select set_config('request.jwt.claims', '', false);
      select set_config('request.jwt.claim.role', '', false);
    `)
  }
}

async function c2AsWorker<T>(operation: () => Promise<T>): Promise<T> {
  await c2.exec(`
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
    return await c2AsService(operation)
  } finally {
    await c2.exec(`
      select set_config('academy.study_worker_credential', '', false);
      select set_config('academy.study_worker_configuration_version', '', false);
      select set_config('academy.study_worker_credential_version', '', false);
    `)
  }
}

async function c2Rpc<T>(statement: string, parameters: unknown[] = []): Promise<T> {
  const result = await c2.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

interface ClaimedJob {
  claimId: string
  jobId: string
  proposalId: string
  householdId: string
  studentId: string
  templateCode: string
  recipientRef: string
  routeRef: string
  route: string
  idempotencyKey: string
  leaseToken: string
  leaseExpiresAt: string
  leaseGeneration: number
  revision: number
}

/**
 * Drives the real proposal -> resolution -> job pipeline so every claimed job
 * carries genuine durable household/student identity rather than test literals.
 * Two authorized guardians are configured, so each proposal yields two jobs.
 */
async function c2Provision(tag: string): Promise<ClaimedJob[]> {
  const proposalRef = `proposal:c2-${tag}`
  await c2AsService(() => c2Rpc(
    `select public.academy_study_create_adult_review_proposal_v1($1::jsonb) as result`,
    [JSON.stringify({
      schemaVersion: 1,
      proposalId: proposalRef,
      householdId: HOUSEHOLD_A,
      studentId: STUDENT_A,
      sessionId: 'session-a',
      category: 'student-support',
      classification: 'urgent',
      urgency: 'urgent',
      reasonCodes: ['safety-urgent-c2'],
      classifierVersion: 'test-safety-classifier-v1',
      occurredAt: new Date().toISOString(),
      idempotencyKey: `proposal:c2-${tag}:idempotency`,
      deliveryState: 'proposed-not-delivered',
      authorizedRecipientResolutionState: 'pending',
    })],
  ))
  const claims = await c2AsWorker(() => c2Rpc<{ proposals: Array<Record<string, unknown>> }>(
    `select public.academy_study_claim_adult_review_proposals_v2('${C2_WORKER}', 50, 60) as result`,
  ))
  const claim = claims.proposals.find((candidate) => candidate.proposalRef === proposalRef)!
  const resolution = await c2AsWorker(() => c2Rpc<{
    householdRef: string
    learnerRef: string
    proposalRevision: number
    resolutionRef: string
    policyVersion: string
    recipients: Array<Record<string, unknown>>
  }>(
    `select public.academy_study_resolve_adult_recipients_v2(
      '${proposalRef}', '${C2_WORKER}'
    ) as result`,
  ))
  await c2AsWorker(() => c2Rpc(
    `select public.academy_study_record_recipient_resolution_v2(
      '${C2_WORKER}', $1::jsonb
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
  const claimed = await c2AsWorker(() => c2Rpc<{ jobs: ClaimedJob[] }>(
    `select public.academy_study_claim_delivery_jobs_v2('${C2_WORKER}', 50, 300) as result`,
  ))
  return claimed.jobs.filter((job) => job.proposalId === proposalRef)
}

async function c2Attempt(job: ClaimedJob, attemptId: string): Promise<number> {
  const created = await c2AsWorker(() => c2Rpc<{ revision: number }>(
    `select public.academy_study_create_delivery_attempt_v2('${C2_WORKER}', $1::jsonb) as result`,
    [JSON.stringify({
      jobId: job.jobId,
      leaseToken: job.leaseToken,
      expectedRevision: job.revision,
      attemptId,
      providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1',
    })],
  ))
  return created.revision
}

async function c2Event(job: ClaimedJob, attemptId: string, state: string): Promise<void> {
  await c2AsWorker(() => c2Rpc(
    `select public.academy_study_record_attempt_event_v2('${C2_WORKER}', $1::jsonb) as result`,
    [JSON.stringify({
      attemptId,
      jobId: job.jobId,
      state,
      structuredResult: `c2-${state}`,
      timeoutState: 'not-timed-out',
      retryDecision: 'not-applicable',
      errorCode: null,
    })],
  ))
}

async function c2Deliver(
  job: ClaimedJob,
  attemptId: string,
  revision: number,
  overrides: Record<string, unknown> = {},
) {
  return c2AsWorker(() => c2Rpc<Record<string, unknown>>(
    `select public.academy_study_deliver_in_app_notification_v2('${C2_WORKER}', $1::jsonb) as result`,
    [JSON.stringify({
      schemaVersion: 2,
      jobId: job.jobId,
      leaseToken: job.leaseToken,
      expectedRevision: revision,
      attemptId,
      deliveryIdempotencyKey: job.idempotencyKey,
      recipientRef: job.recipientRef,
      routeRef: job.routeRef,
      proposalId: job.proposalId,
      householdId: job.householdId,
      studentId: job.studentId,
      providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1',
      ...overrides,
    })],
  ))
}

beforeAll(async () => {
  c2 = await PGlite.create()
  await c2.exec(bootstrap)
  for (const path of c2Files) {
    const source = await c2Read(path)
    if (source === null) {
      if (path === C2_MIGRATION) continue
      throw new Error(`missing required migration ${path}`)
    }
    await c2.exec(source)
  }
  // Director-owned in-app delivery policy approval and one authorized worker
  // schedule. Both are hosted-operator prerequisites, not contract surface.
  await c2.exec(`
    update academy_private.study_production_policy
    set adult_review_in_app_delivery_policy = 'approved',
        approval_reference = 'director-approval:c2-database-test',
        approved_by = '${GUARDIAN_A}', approved_at = clock_timestamp(),
        revision = revision + 1, updated_at = clock_timestamp()
    where singleton;
    insert into academy_private.study_adult_review_worker_registry (
      worker_id, configuration_version, credential_version,
      authorized_scopes, credential_digest, expires_at
    ) values
      ('${C2_WORKER}', '${WORKER_CONFIGURATION_VERSION}', '${WORKER_CREDENTIAL_VERSION}',
        array['proposal-resolution', 'delivery-claim', 'delivery-attempt',
          'delivery-reconcile', 'monitoring', 'rate-limit', 'retention'],
        academy_private.study_sha256_json(jsonb_build_object('credential', '${WORKER_CREDENTIAL}')),
        clock_timestamp() + interval '1 day'),
      ('${C2_CLAIM_ONLY_WORKER}', '${WORKER_CONFIGURATION_VERSION}', '${WORKER_CREDENTIAL_VERSION}',
        array['delivery-claim'],
        academy_private.study_sha256_json(jsonb_build_object('credential', '${WORKER_CREDENTIAL}')),
        clock_timestamp() + interval '1 day'),
      ('${C2_OTHER_WORKER}', '${WORKER_CONFIGURATION_VERSION}', '${WORKER_CREDENTIAL_VERSION}',
        array['delivery-claim', 'delivery-attempt'],
        academy_private.study_sha256_json(jsonb_build_object('credential', '${WORKER_CREDENTIAL}')),
        clock_timestamp() + interval '1 day'),
      ('${C2_REVOKED_WORKER}', '${WORKER_CONFIGURATION_VERSION}', '${WORKER_CREDENTIAL_VERSION}',
        array['delivery-claim', 'delivery-attempt'],
        academy_private.study_sha256_json(jsonb_build_object('credential', '${WORKER_CREDENTIAL}')),
        clock_timestamp() + interval '1 day');
    update academy_private.study_adult_review_worker_registry
    set status = 'revoked', revoked_at = clock_timestamp()
    where worker_id = '${C2_REVOKED_WORKER}';
    update academy_private.study_adult_review_route_capabilities
    set readiness = 'ready', allows_production = true,
        decision_code = 'synthetic-policy-approved-for-database-test'
    where route = 'in-app';
    update public.academy_guardian_student_access
    set permission_level = 'learning_manager'
    where id = '${ACCESS_SECOND_GUARDIAN}';
  `)
  for (const recipient of [
    { permission: PERMISSION_A, access: ACCESS_A, ref: RECIPIENT_A, route: ROUTE_A },
    {
      permission: PERMISSION_SECOND_GUARDIAN,
      access: ACCESS_SECOND_GUARDIAN,
      ref: RECIPIENT_SECOND_GUARDIAN,
      route: ROUTE_SECOND_GUARDIAN,
    },
  ]) {
    await c2AsService(() => c2Rpc(
      `select public.academy_study_set_adult_notification_permission_v1($1::jsonb, 0) as result`,
      [JSON.stringify({
        permissionId: recipient.permission,
        guardianAccessId: recipient.access,
        recipientRef: recipient.ref,
        allowedChannels: ['in-app'],
        status: 'active',
        policyVersion: 'adult-notification-policy-v2',
        provenanceRef: 'guardian-consent:c2-synthetic',
      })],
    ))
    await c2AsService(() => c2Rpc(
      `select public.academy_study_set_adult_notification_route_v1($1::jsonb, 0) as result`,
      [JSON.stringify({
        routeRef: recipient.route,
        permissionId: recipient.permission,
        recipientRef: recipient.ref,
        channel: 'in-app',
        status: 'active',
        providerRouteVersion: 'in-app-config-v1',
      })],
    ))
  }
}, 180_000)

afterAll(async () => c2.close())

describe.sequential('STUDY-C2 v2 operations contract', () => {
  it('installs the C2 forward migration and records its marker', async () => {
    expect(await c2Read(C2_MIGRATION)).not.toBeNull()
    const marker = await c2.query<{ version: number; names: string[] }>(`
      select c2_operations_contract_version as version, migration_names as names
      from academy_private.study_persistence_metadata where singleton
    `)
    expect(marker.rows[0].version).toBe(1)
    expect(marker.rows[0].names.at(-1)).toBe(
      '20260806140000_academy_study_c2_operations_contract',
    )
  })

  it('projects claimId, raw household/student identity, and the template code', async () => {
    const jobs = await c2Provision('claim-projection')
    expect(jobs).toHaveLength(2)
    const job = jobs[0]
    expect(Object.keys(job).sort()).toEqual([
      'claimId', 'householdId', 'idempotencyKey', 'jobId', 'leaseExpiresAt',
      'leaseGeneration', 'leaseToken', 'proposalId', 'recipientRef', 'revision',
      'route', 'routeRef', 'studentId', 'templateCode',
    ])
    expect(job.claimId).toBe(job.jobId)
    expect(job.templateCode).toBe('study-safety-adult-review-v1')
    const durable = await c2.query<{ household: string; student: string; template: string }>(`
      select household_id::text as household, student_id::text as student,
        template_code as template
      from academy_private.study_adult_review_delivery_jobs where id = '${job.jobId}'
    `)
    expect(durable.rows[0]).toEqual({
      household: job.householdId,
      student: job.studentId,
      template: job.templateCode,
    })
    expect(job.householdId).toBe(HOUSEHOLD_A)
    expect(job.studentId).toBe(STUDENT_A)
  })

  it('refuses cross-household substitution of the claimed identity at delivery binding', async () => {
    const [job] = await c2Provision('cross-household')
    const attemptId = 'attempt:c2-cross-household'
    const revision = await c2Attempt(job, attemptId)
    await c2Event(job, attemptId, 'created')
    await c2Event(job, attemptId, 'submitted')
    await expect(c2Deliver(job, attemptId, revision, { householdId: HOUSEHOLD_B }))
      .rejects.toThrow(/STUDY_IN_APP_DELIVERY_BINDING_MISMATCH/)
    await expect(c2Deliver(job, attemptId, revision, { studentId: STUDENT_B }))
      .rejects.toThrow(/STUDY_IN_APP_DELIVERY_BINDING_MISMATCH/)
  })

  it('exposes no learner text, contact, or raw destination in the claim envelope', async () => {
    const jobs = await c2Provision('claim-privacy')
    const serialized = JSON.stringify(jobs)
    expect(serialized).not.toMatch(/@|phone|address|transcript|membershipId|guardianAccessId|credential/i)
    expect(serialized).not.toContain(MEMBERSHIP_A)
    expect(serialized).not.toContain(GUARDIAN_A)
    expect(serialized).not.toContain(WORKER_CREDENTIAL)
  })

  it('still requires the service-role worker boundary for the claim projection', async () => {
    await expect(c2Rpc(
      `select public.academy_study_claim_delivery_jobs_v2('${C2_WORKER}', 10, 30) as result`,
    )).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_claim_delivery_jobs_v2('worker:forged', 10, 30) as result`,
    ))).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
  })

  it('proves a live lease without mutating it, and refuses every mismatched binding', async () => {
    const [job, sibling] = await c2Provision('lease-proof')
    const proof = await c2AsWorker(() => c2Rpc<Record<string, unknown>>(
      `select public.academy_study_prove_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}'
      ) as result`,
    ))
    expect(Object.keys(proof).sort()).toEqual([
      'active', 'jobId', 'leaseExpiresAt', 'leaseRevision', 'leaseToken',
    ])
    expect(proof).toMatchObject({
      active: true,
      jobId: job.jobId,
      leaseToken: job.leaseToken,
      leaseRevision: job.revision,
    })
    const repeated = await c2AsWorker(() => c2Rpc<Record<string, unknown>>(
      `select public.academy_study_prove_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}'
      ) as result`,
    ))
    expect(repeated).toEqual(proof)

    const wrongToken = await c2AsWorker(() => c2Rpc<Record<string, unknown>>(
      `select public.academy_study_prove_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${sibling.leaseToken}'
      ) as result`,
    ))
    expect(wrongToken).toEqual({
      active: false, jobId: job.jobId, leaseToken: null,
      leaseRevision: null, leaseExpiresAt: null,
    })
    const wrongWorker = await c2AsWorker(() => c2Rpc<{ active: boolean }>(
      `select public.academy_study_prove_delivery_lease_v2(
        '${C2_OTHER_WORKER}', '${job.jobId}', '${job.leaseToken}'
      ) as result`,
    ))
    expect(wrongWorker.active).toBe(false)
    const unknownJob = await c2AsWorker(() => c2Rpc<{ active: boolean }>(
      `select public.academy_study_prove_delivery_lease_v2(
        '${C2_WORKER}', '00000000-0000-0000-0000-0000000000ff', '${job.leaseToken}'
      ) as result`,
    ))
    expect(unknownJob.active).toBe(false)

    const attemptId = 'attempt:c2-lease-proof'
    const revision = await c2Attempt(job, attemptId)
    expect(revision).toBeGreaterThan(job.revision)
    const afterAttempt = await c2AsWorker(() => c2Rpc<{ leaseRevision: number; active: boolean }>(
      `select public.academy_study_prove_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}'
      ) as result`,
    ))
    expect(afterAttempt).toMatchObject({ active: true, leaseRevision: revision })

    await c2.exec(`
      update academy_private.study_adult_review_delivery_jobs
      set lease_expires_at = clock_timestamp() - interval '1 minute'
      where id = '${sibling.jobId}'
    `)
    const expired = await c2AsWorker(() => c2Rpc<{ active: boolean }>(
      `select public.academy_study_prove_delivery_lease_v2(
        '${C2_WORKER}', '${sibling.jobId}', '${sibling.leaseToken}'
      ) as result`,
    ))
    expect(expired.active).toBe(false)
  })

  it('proves the current attempt from stored durable fields without writing evidence', async () => {
    const [job, sibling] = await c2Provision('attempt-proof')
    const attemptId = 'attempt:c2-attempt-proof'
    await c2Attempt(job, attemptId)
    const before = await c2.query<{ count: number }>(`
      select count(*)::integer as count from academy_private.study_adult_review_attempt_events
    `)
    const proof = await c2AsWorker(() => c2Rpc<Record<string, unknown>>(
      `select public.academy_study_prove_current_attempt_v2(
        '${C2_WORKER}', '${job.jobId}', '${attemptId}', '${job.leaseToken}'
      ) as result`,
    ))
    expect(Object.keys(proof).sort()).toEqual([
      'attemptId', 'current', 'deliveryIdempotencyKey', 'jobId',
      'leaseToken', 'providerConfigVersion', 'providerName',
    ])
    expect(proof).toEqual({
      current: true,
      attemptId,
      jobId: job.jobId,
      leaseToken: job.leaseToken,
      deliveryIdempotencyKey: job.idempotencyKey,
      providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1',
    })
    await c2AsWorker(() => c2Rpc(
      `select public.academy_study_prove_current_attempt_v2(
        '${C2_WORKER}', '${job.jobId}', '${attemptId}', '${job.leaseToken}'
      ) as result`,
    ))
    const after = await c2.query<{ count: number }>(`
      select count(*)::integer as count from academy_private.study_adult_review_attempt_events
    `)
    expect(after.rows[0].count).toBe(before.rows[0].count)

    const staleAttempt = await c2AsWorker(() => c2Rpc<{ current: boolean }>(
      `select public.academy_study_prove_current_attempt_v2(
        '${C2_WORKER}', '${job.jobId}', 'attempt:c2-never-created', '${job.leaseToken}'
      ) as result`,
    ))
    expect(staleAttempt.current).toBe(false)
    const wrongToken = await c2AsWorker(() => c2Rpc<Record<string, unknown>>(
      `select public.academy_study_prove_current_attempt_v2(
        '${C2_WORKER}', '${job.jobId}', '${attemptId}', '${sibling.leaseToken}'
      ) as result`,
    ))
    expect(wrongToken).toEqual({
      current: false, attemptId, jobId: job.jobId, leaseToken: null,
      deliveryIdempotencyKey: null, providerName: null, providerConfigVersion: null,
    })
    await c2.exec(`
      update academy_private.study_adult_review_delivery_jobs
      set lease_generation = lease_generation + 1 where id = '${job.jobId}'
    `)
    const staleGeneration = await c2AsWorker(() => c2Rpc<{ current: boolean }>(
      `select public.academy_study_prove_current_attempt_v2(
        '${C2_WORKER}', '${job.jobId}', '${attemptId}', '${job.leaseToken}'
      ) as result`,
    ))
    expect(staleGeneration.current).toBe(false)
    await c2.exec(`
      update academy_private.study_adult_review_delivery_jobs
      set lease_generation = lease_generation - 1 where id = '${job.jobId}'
    `)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_prove_current_attempt_v2(
        '${C2_CLAIM_ONLY_WORKER}', '${job.jobId}', '${attemptId}', '${job.leaseToken}'
      ) as result`,
    ))).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
  })

  it('cancels exactly one leased job for an allowed reason and leaves siblings intact', async () => {
    const [job, sibling] = await c2Provision('cancel-scope')
    const cancelled = await c2AsWorker(() => c2Rpc<Record<string, unknown>>(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${job.revision}, 'invalid_delivery'
      ) as result`,
    ))
    expect(cancelled).toMatchObject({
      cancelled: true, jobId: job.jobId, state: 'cancelled',
      reasonCode: 'invalid_delivery', replay: false,
    })
    const rows = await c2.query<{ id: string; state: string; token: string | null }>(`
      select id::text as id, state, lease_token::text as token
      from academy_private.study_adult_review_delivery_jobs
      where id in ('${job.jobId}', '${sibling.jobId}')
    `)
    expect(rows.rows.find((row) => row.id === job.jobId))
      .toMatchObject({ state: 'cancelled', token: null })
    expect(rows.rows.find((row) => row.id === sibling.jobId))
      .toMatchObject({ state: 'leased', token: sibling.leaseToken })

    const audit = await c2.query<{ count: number }>(`
      select count(*)::integer as count
      from academy_private.study_adult_review_audit_events
      where job_ref = '${job.jobId}' and reason_code = 'invalid_delivery'
    `)
    expect(audit.rows[0].count).toBe(1)

    const replay = await c2AsWorker(() => c2Rpc<Record<string, unknown>>(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${job.revision}, 'invalid_delivery'
      ) as result`,
    ))
    expect(replay).toMatchObject({ cancelled: false, replay: true, state: 'cancelled' })
    const auditAfterReplay = await c2.query<{ count: number }>(`
      select count(*)::integer as count
      from academy_private.study_adult_review_audit_events
      where job_ref = '${job.jobId}' and reason_code = 'invalid_delivery'
    `)
    expect(auditAfterReplay.rows[0].count).toBe(1)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${job.revision}, 'invalid_recipient'
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_CANCEL_CONFLICT/)

    await expect(c2Attempt(job, 'attempt:c2-cancel-then-deliver'))
      .rejects.toThrow(/STUDY_DELIVERY_ATTEMPT_BINDING_MISMATCH/)
  })

  it('cancels for invalid_recipient and refuses every other reason code', async () => {
    const [job] = await c2Provision('cancel-recipient')
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${job.revision}, 'operator_choice'
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_CANCEL_REASON_INVALID/)
    const cancelled = await c2AsWorker(() => c2Rpc<{ cancelled: boolean; reasonCode: string }>(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${job.revision}, 'invalid_recipient'
      ) as result`,
    ))
    expect(cancelled).toMatchObject({ cancelled: true, reasonCode: 'invalid_recipient' })
  })

  it('refuses wrong token, stale revision, wrong worker, revoked worker, and guardian sessions', async () => {
    const [job, sibling] = await c2Provision('cancel-refusals')
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_WORKER}', '${job.jobId}', '${sibling.leaseToken}', ${job.revision}, 'invalid_delivery'
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_CANCEL_CONFLICT/)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${job.revision - 1}, 'invalid_delivery'
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_CANCEL_CONFLICT/)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_OTHER_WORKER}', '${job.jobId}', '${job.leaseToken}', ${job.revision}, 'invalid_delivery'
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_CANCEL_CONFLICT/)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_REVOKED_WORKER}', '${job.jobId}', '${job.leaseToken}', ${job.revision}, 'invalid_delivery'
      ) as result`,
    ))).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
    await c2.exec(`
      select set_config('request.jwt.claim.sub', '${GUARDIAN_A}', false);
    `)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${job.revision}, 'invalid_delivery'
      ) as result`,
    ))).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
    await c2.exec(`select set_config('request.jwt.claim.sub', '', false);`)
    const stillLeased = await c2.query<{ state: string }>(`
      select state from academy_private.study_adult_review_delivery_jobs where id = '${job.jobId}'
    `)
    expect(stillLeased.rows[0].state).toBe('leased')
  })

  it('refuses cancellation of a job that a newer claimant has re-leased', async () => {
    const [job] = await c2Provision('cancel-released')
    await c2AsWorker(() => c2Rpc(
      `select public.academy_study_release_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${job.revision}
      ) as result`,
    ))
    const reclaimed = await c2AsWorker(() => c2Rpc<{ jobs: ClaimedJob[] }>(
      `select public.academy_study_claim_delivery_jobs_v2('${C2_OTHER_WORKER}', 50, 300) as result`,
    ))
    const newLease = reclaimed.jobs.find((candidate) => candidate.jobId === job.jobId)!
    expect(newLease.leaseToken).not.toBe(job.leaseToken)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${job.revision}, 'invalid_delivery'
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_CANCEL_CONFLICT/)
    const state = await c2.query<{ state: string; owner: string }>(`
      select state, lease_owner as owner
      from academy_private.study_adult_review_delivery_jobs where id = '${job.jobId}'
    `)
    expect(state.rows[0]).toEqual({ state: 'leased', owner: C2_OTHER_WORKER })
  })

  it('records provider-accepted inside the delivery transaction and retains the terminal lease', async () => {
    const [job] = await c2Provision('delivery-state-machine')
    const attemptId = 'attempt:c2-delivery-state-machine'
    const revision = await c2Attempt(job, attemptId)
    await c2Event(job, attemptId, 'created')
    await c2Event(job, attemptId, 'submitted')
    const delivered = await c2Deliver(job, attemptId, revision)
    expect(delivered).toMatchObject({ state: 'delivered', attemptId, jobId: job.jobId })

    const events = await c2.query<{ state: string }>(`
      select state from academy_private.study_adult_review_attempt_events
      where attempt_id = '${attemptId}' order by occurred_at, event_id
    `)
    expect(events.rows.map((row) => row.state)).toEqual([
      'created', 'submitted', 'provider-accepted', 'receipt-verified',
    ])

    const terminal = await c2.query<{
      state: string; token: string | null; owner: string | null; expires: string | null
    }>(`
      select state, lease_token::text as token, lease_owner as owner,
        lease_expires_at::text as expires
      from academy_private.study_adult_review_delivery_jobs where id = '${job.jobId}'
    `)
    expect(terminal.rows[0].state).toBe('delivered')
    expect(terminal.rows[0].token).toBe(job.leaseToken)
    expect(terminal.rows[0].owner).toBe(C2_WORKER)
    expect(terminal.rows[0].expires).not.toBeNull()

    const retainedProof = await c2AsWorker(() => c2Rpc<{ active: boolean }>(
      `select public.academy_study_prove_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}'
      ) as result`,
    ))
    expect(retainedProof.active).toBe(true)
    const retainedAttempt = await c2AsWorker(() => c2Rpc<{ current: boolean }>(
      `select public.academy_study_prove_current_attempt_v2(
        '${C2_WORKER}', '${job.jobId}', '${attemptId}', '${job.leaseToken}'
      ) as result`,
    ))
    expect(retainedAttempt.current).toBe(true)

    // Retained terminal lease is evidence only: no processing capability.
    const current = await c2.query<{ revision: number }>(`
      select revision from academy_private.study_adult_review_delivery_jobs where id = '${job.jobId}'
    `)
    const terminalRevision = current.rows[0].revision
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_renew_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${terminalRevision}, 30
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_LEASE_CONFLICT/)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_release_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${terminalRevision}
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_RELEASE_UNSAFE|STUDY_DELIVERY_LEASE_CONFLICT/)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_create_delivery_attempt_v2('${C2_WORKER}', $1::jsonb) as result`,
      [JSON.stringify({
        jobId: job.jobId,
        leaseToken: job.leaseToken,
        expectedRevision: terminalRevision,
        attemptId: 'attempt:c2-after-terminal',
        providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1',
      })],
    ))).rejects.toThrow(/STUDY_DELIVERY_ATTEMPT_BINDING_MISMATCH/)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${terminalRevision}, 'invalid_delivery'
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_CANCEL_CONFLICT/)

    await c2.exec(`
      update academy_private.study_adult_review_delivery_jobs
      set lease_expires_at = clock_timestamp() - interval '1 minute'
      where id = '${job.jobId}'
    `)
    const reclaim = await c2AsWorker(() => c2Rpc<{ jobs: ClaimedJob[] }>(
      `select public.academy_study_claim_delivery_jobs_v2('${C2_WORKER}', 50, 300) as result`,
    ))
    expect(reclaim.jobs.map((candidate) => candidate.jobId)).not.toContain(job.jobId)
    const afterSweep = await c2.query<{ state: string }>(`
      select state from academy_private.study_adult_review_delivery_jobs where id = '${job.jobId}'
    `)
    expect(afterSweep.rows[0].state).toBe('delivered')
    const expiredProof = await c2AsWorker(() => c2Rpc<{ active: boolean }>(
      `select public.academy_study_prove_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}'
      ) as result`,
    ))
    expect(expiredProof.active).toBe(false)
  })

  // -------------------------------------------------------------------------
  // M2 evidence semantics. READ THIS BEFORE BUILDING AN ADAPTER ON THIS RPC.
  //
  // academy_study_prove_delivery_lease_v2 reports active:true for a *delivered*
  // job whose retained lease has not yet expired. That is deliberate and it is
  // the M5 terminal-lease-retention design: the retained lease is evidence of
  // which worker and which lease produced the receipt, so the proof keeps
  // answering questions about it until the lease naturally expires.
  //
  // active:true is NOT a grant of operational capability. It answers "is this
  // the lease that produced this receipt, and is it still within its window",
  // not "may I do work against this job". Every state-changing path in the
  // contract independently requires job.state = 'leased', which a delivered job
  // never satisfies again. A future adapter must therefore branch on the job's
  // own terminal state, never on active:true, before attempting work.
  //
  // The field name is worker-facing contract surface and is deliberately left
  // unchanged. This test is the standing proof that the capability boundary is
  // enforced in SQL rather than by adapter convention.
  // -------------------------------------------------------------------------
  it('treats an active delivered-lease proof as evidence only, never as capability', async () => {
    const [job] = await c2Provision('lease-evidence-not-capability')
    const attemptId = 'attempt:c2-lease-evidence'
    const revision = await c2Attempt(job, attemptId)
    await c2Event(job, attemptId, 'created')
    await c2Event(job, attemptId, 'submitted')
    const delivered = await c2Deliver(job, attemptId, revision)
    expect(delivered).toMatchObject({ state: 'delivered', jobId: job.jobId })

    const terminalRevision = (await c2.query<{ revision: number }>(`
      select revision from academy_private.study_adult_review_delivery_jobs
      where id = '${job.jobId}'
    `)).rows[0].revision

    // Evidence half: the proof is active because the retained lease has not
    // expired, and it still names the lease that produced the receipt.
    const proof = await c2AsWorker(() => c2Rpc<Record<string, unknown>>(
      `select public.academy_study_prove_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}'
      ) as result`,
    ))
    expect(proof).toMatchObject({
      active: true, jobId: job.jobId, leaseToken: job.leaseToken,
    })
    expect((await c2.query<{ state: string }>(`
      select state from academy_private.study_adult_review_delivery_jobs
      where id = '${job.jobId}'
    `)).rows[0].state).toBe('delivered')

    const countRows = async () => {
      const result = await c2.query<{
        events: number; attempts: number; receipts: number; notifications: number
      }>(`
        select
          (select count(*) from academy_private.study_adult_review_attempt_events
            where job_id = '${job.jobId}')::integer as events,
          (select count(*) from academy_private.study_adult_review_delivery_attempts
            where job_id = '${job.jobId}')::integer as attempts,
          (select count(*) from academy_private.study_adult_review_delivery_receipts
            where job_id = '${job.jobId}')::integer as receipts,
          (select count(*) from academy_private.study_parent_notifications
            where job_id = '${job.jobId}')::integer as notifications
      `)
      return result.rows[0]
    }
    const before = await countRows()
    // Guard the invariance check below against comparing zeroes: the delivered
    // job really does carry durable rows that a successful write would change.
    expect(before.events).toBeGreaterThan(0)
    expect(before.attempts).toBeGreaterThan(0)
    expect(before.receipts).toBeGreaterThan(0)
    expect(before.notifications).toBeGreaterThan(0)

    // Capability half: every operation is refused while the proof is active.
    // 1. claim
    const reclaim = await c2AsWorker(() => c2Rpc<{ jobs: ClaimedJob[] }>(
      `select public.academy_study_claim_delivery_jobs_v2('${C2_WORKER}', 50, 300) as result`,
    ))
    expect(reclaim.jobs.map((candidate) => candidate.jobId)).not.toContain(job.jobId)

    // 2. renew
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_renew_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${terminalRevision}, 30
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_LEASE_CONFLICT/)

    // 3. release
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_release_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${terminalRevision}
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_RELEASE_UNSAFE|STUDY_DELIVERY_LEASE_CONFLICT/)

    // 4. create a new attempt
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_create_delivery_attempt_v2('${C2_WORKER}', $1::jsonb) as result`,
      [JSON.stringify({
        jobId: job.jobId,
        leaseToken: job.leaseToken,
        expectedRevision: terminalRevision,
        attemptId: 'attempt:c2-lease-evidence-second',
        providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1',
      })],
    ))).rejects.toThrow(/STUDY_DELIVERY_ATTEMPT_BINDING_MISMATCH/)

    // 5. record a new attempt event against the delivered attempt
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_record_attempt_event_v2('${C2_WORKER}', $1::jsonb) as result`,
      [JSON.stringify({
        attemptId,
        jobId: job.jobId,
        state: 'submitted',
        structuredResult: 'c2-post-terminal-event',
        timeoutState: 'not-timed-out',
        retryDecision: 'not-applicable',
        errorCode: null,
      })],
    ))).rejects.toThrow(/STUDY_ATTEMPT_EVENT_BINDING_MISMATCH/)

    // 6. cancel
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_cancel_delivery_job_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${terminalRevision}, 'invalid_delivery'
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_CANCEL_CONFLICT/)

    // 7. redeliver non-idempotently. A replay carrying the same idempotency key
    // but different durable identity is a collision, not a second delivery.
    await expect(
      c2Deliver(job, 'attempt:c2-lease-evidence-forged', terminalRevision),
    ).rejects.toThrow(/STUDY_IN_APP_IDEMPOTENCY_COLLISION/)
    // A genuinely identical replay is the only accepted repeat: it returns the
    // settled outcome and must not produce a second receipt or notification.
    const replay = await c2Deliver(job, attemptId, terminalRevision)
    expect(replay).toMatchObject({ state: 'already-delivered', jobId: job.jobId })

    // Nothing above wrote anything: the active proof bought no capability.
    expect(await countRows()).toEqual(before)

    // The evidence window closes on its own; capability never reopens.
    await c2.exec(`
      update academy_private.study_adult_review_delivery_jobs
      set lease_expires_at = clock_timestamp() - interval '1 minute'
      where id = '${job.jobId}'
    `)
    const afterExpiry = await c2AsWorker(() => c2Rpc<{ active: boolean }>(
      `select public.academy_study_prove_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}'
      ) as result`,
    ))
    expect(afterExpiry.active).toBe(false)
    expect((await c2.query<{ state: string }>(`
      select state from academy_private.study_adult_review_delivery_jobs
      where id = '${job.jobId}'
    `)).rows[0].state).toBe('delivered')
  })

  // -------------------------------------------------------------------------
  // End-to-end receipt boundary on the integrated chain.
  //
  // G1 (20260806120000) is now genuinely below C2 (20260806140000) in the same
  // chain, so this is the first place the whole path can be proven at once: a
  // real C2-driven delivery, then server-side verification, then validation by
  // the actual server receipt contract module the runtime uses. The G1 suite
  // proves the normalization itself; this proves it survives integration and
  // that no raw timestamptz reaches the receipt boundary.
  // -------------------------------------------------------------------------
  it('returns a normalized UTC-millisecond deliveredAt that satisfies the server receipt contract', async () => {
    const [job] = await c2Provision('receipt-timestamp-e2e')
    const attemptId = 'attempt:c2-receipt-timestamp-e2e'
    const revision = await c2Attempt(job, attemptId)
    await c2Event(job, attemptId, 'created')
    await c2Event(job, attemptId, 'submitted')
    const delivered = await c2Deliver(job, attemptId, revision)
    expect(delivered).toMatchObject({ state: 'delivered', jobId: job.jobId })
    const providerReceiptRef = String(delivered.providerReceiptRef)

    const binding = {
      providerReceiptRef,
      providerName: 'academy-in-app',
      route: 'in-app',
      routeRef: job.routeRef,
      jobId: job.jobId,
      attemptId,
      proposalId: job.proposalId,
      householdId: job.householdId,
      studentId: job.studentId,
      recipientRef: job.recipientRef,
      deliveryIdempotencyKey: job.idempotencyKey,
      providerConfigVersion: 'in-app-config-v1',
    }
    const receipt = await c2AsWorker(() => c2Rpc<Record<string, unknown>>(
      `select public.academy_study_verify_in_app_notification_v2($1::text, $2::jsonb) as result`,
      [C2_WORKER, JSON.stringify(binding)],
    ))

    // The exact server receipt contract shape for deliveredAt.
    expect(receipt.deliveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    const deliveredAt = String(receipt.deliveredAt)
    expect(deliveredAt.endsWith('Z')).toBe(true)
    expect(deliveredAt).toHaveLength(24)
    expect(Number.isFinite(Date.parse(deliveredAt))).toBe(true)
    // No raw timestamptz residue: no microseconds, no numeric offset, no space.
    expect(deliveredAt).not.toMatch(/[+-]\d{2}:\d{2}$/)
    expect(deliveredAt).not.toMatch(/\.\d{4,}/)
    expect(deliveredAt).not.toContain(' ')
    // Round-trips to the identical instant, so normalization lost no meaning.
    expect(new Date(deliveredAt).toISOString()).toBe(deliveredAt)

    // The stored durable value is the same instant the receipt reports.
    const stored = await c2.query<{ delivered: string }>(`
      select delivered_at::text as delivered
      from academy_private.study_parent_notifications where job_id = '${job.jobId}'
    `)
    expect(Date.parse(stored.rows[0].delivered)).toBe(Date.parse(deliveredAt))

    // Validate against the real server contract module.
    //
    // One field still mismatches, and it is NOT the timestamp: SQL emits the
    // canonical durable key `delivery:<sha256>` while this branch's
    // receipt-contract.js still carries the legacy `study-safety-delivery:`
    // prefix. Widening the JS contract is a separate card's scope and is
    // deliberately not done here, so the assertion below pins that gap
    // precisely rather than papering over it.
    const contract = await import(
      '../netlify/functions/_shared/study-delivery/receipt-contract.js'
    )
    const { validateVerifiedAdultReviewReceipt } = contract
    const bindingForContract = {
      providerName: 'academy-in-app',
      route: 'in-app',
      routeRef: job.routeRef,
      jobId: job.jobId,
      attemptId,
      proposalId: job.proposalId,
      householdId: job.householdId,
      studentId: job.studentId,
      recipientRef: job.recipientRef,
      deliveryIdempotencyKey: job.idempotencyKey,
      providerConfigVersion: 'in-app-config-v1',
    }
    expect(job.idempotencyKey).toMatch(/^delivery:[a-f0-9]{64}$/)
    expect(() => validateVerifiedAdultReviewReceipt(
      receipt, bindingForContract, { environment: 'production' },
    )).toThrow('receipt_schema_mismatch')

    // Translating only that one legacy prefix — changing no other field, and
    // above all not deliveredAt — makes the whole receipt validate. That is the
    // proof that the receipt boundary is otherwise contract-clean and that no
    // raw timestamptz survives it.
    const legacyKey = job.idempotencyKey.replace(/^delivery:/, 'study-safety-delivery:')
    const validated = validateVerifiedAdultReviewReceipt(
      { ...receipt, deliveryIdempotencyKey: legacyKey },
      { ...bindingForContract, deliveryIdempotencyKey: legacyKey },
      { environment: 'production' },
    )
    expect(validated.deliveredAt).toBe(deliveredAt)
    expect(validated.verified).toBe(true)
    expect(validated.receiptSource).toBe('server-verified')
    expect(validated.testReceipt).toBe(false)
  })

  it('refuses delivery when provider-accepted was pre-recorded by the adapter', async () => {
    const [job] = await c2Provision('pre-accepted')
    const attemptId = 'attempt:c2-pre-accepted'
    const revision = await c2Attempt(job, attemptId)
    await c2Event(job, attemptId, 'created')
    await c2Event(job, attemptId, 'submitted')
    await c2Event(job, attemptId, 'provider-accepted')
    await expect(c2Deliver(job, attemptId, revision))
      .rejects.toThrow(/STUDY_IN_APP_ATTEMPT_NOT_SUBMITTED/)
  })

  it('keeps timeout-indeterminate legal and preserves the sweep and release guard', async () => {
    const [job, sibling] = await c2Provision('indeterminate')
    const attemptId = 'attempt:c2-indeterminate'
    await c2Attempt(job, attemptId)
    await c2Event(job, attemptId, 'created')
    await c2Event(job, attemptId, 'submitted')
    await c2Event(job, attemptId, 'timeout-indeterminate')
    const jobRevision = await c2.query<{ revision: number }>(`
      select revision from academy_private.study_adult_review_delivery_jobs where id = '${job.jobId}'
    `)
    await expect(c2AsWorker(() => c2Rpc(
      `select public.academy_study_release_delivery_lease_v2(
        '${C2_WORKER}', '${job.jobId}', '${job.leaseToken}', ${jobRevision.rows[0].revision}
      ) as result`,
    ))).rejects.toThrow(/STUDY_DELIVERY_RELEASE_UNSAFE/)

    const siblingAttempt = 'attempt:c2-indeterminate-sibling'
    await c2Attempt(sibling, siblingAttempt)
    await c2Event(sibling, siblingAttempt, 'created')
    await c2Event(sibling, siblingAttempt, 'submitted')
    await c2.exec(`
      update academy_private.study_adult_review_delivery_jobs
      set lease_expires_at = clock_timestamp() - interval '1 minute'
      where id in ('${job.jobId}', '${sibling.jobId}')
    `)
    await c2AsWorker(() => c2Rpc(
      `select public.academy_study_claim_delivery_jobs_v2('${C2_WORKER}', 50, 300) as result`,
    ))
    const swept = await c2.query<{ id: string; state: string; failure: string | null }>(`
      select id::text as id, state, last_failure_code as failure
      from academy_private.study_adult_review_delivery_jobs
      where id in ('${job.jobId}', '${sibling.jobId}')
    `)
    expect(swept.rows).toHaveLength(2)
    expect(swept.rows.every((row) => row.state === 'indeterminate')).toBe(true)
    expect(swept.rows.every((row) => row.failure === 'lease-expired-after-submit')).toBe(true)
  })

  it('grants the new contract surface to service_role only, definer and search-path pinned', async () => {
    const signatures = [
      'public.academy_study_prove_delivery_lease_v2(text, uuid, uuid)',
      'public.academy_study_prove_current_attempt_v2(text, uuid, text, uuid)',
      'public.academy_study_cancel_delivery_job_v2(text, uuid, uuid, bigint, text)',
      'public.academy_study_claim_delivery_jobs_v2(text, integer, integer)',
    ]
    for (const signature of signatures) {
      const acl = await c2.query<{
        service: boolean; guardian: boolean; anon: boolean; everyone: boolean
      }>(`
        select
          has_function_privilege('service_role', '${signature}', 'execute') as service,
          has_function_privilege('authenticated', '${signature}', 'execute') as guardian,
          has_function_privilege('anon', '${signature}', 'execute') as anon,
          has_function_privilege('public', '${signature}', 'execute') as everyone
      `)
      expect(acl.rows[0], signature).toEqual({
        service: true, guardian: false, anon: false, everyone: false,
      })
    }
    const definition = await c2.query<{
      name: string; secdef: boolean; config: string[] | null; owner: string
    }>(`
      select procedure.proname as name, procedure.prosecdef as secdef,
        procedure.proconfig as config, authority.rolname as owner
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      join pg_roles authority on authority.oid = procedure.proowner
      where namespace.nspname = 'public' and procedure.proname in (
        'academy_study_prove_delivery_lease_v2',
        'academy_study_prove_current_attempt_v2',
        'academy_study_cancel_delivery_job_v2'
      ) order by procedure.proname
    `)
    expect(definition.rows).toHaveLength(3)
    expect(definition.rows.every((row) => row.secdef)).toBe(true)
    expect(definition.rows.every((row) => row.owner === 'postgres')).toBe(true)
    expect(definition.rows.every(
      (row) => row.config?.includes('search_path=pg_catalog') ?? false,
    )).toBe(true)
    // No direct table privileges are added. The only academy_private grants are
    // the pre-existing Session 13 student-identity ones; nothing in the Study
    // adult-review or delivery surface is reachable by table privilege.
    const tableGrants = await c2.query<{ table_name: string; grantee: string }>(`
      select distinct table_name, grantee
      from information_schema.role_table_grants
      where table_schema = 'academy_private'
        and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
      order by table_name, grantee
    `)
    expect(tableGrants.rows).toEqual([
      { table_name: 'student_access_credentials', grantee: 'service_role' },
      { table_name: 'student_session_grants', grantee: 'service_role' },
    ])
    const v1 = await c2.query<{ count: number }>(`
      select count(*)::integer as count
      from unnest(array[
        'public.academy_study_claim_delivery_jobs_v1(timestamptz, integer, integer)',
        'public.academy_study_record_delivery_attempt_v1(jsonb)',
        'public.academy_study_record_delivery_receipt_v1(jsonb)',
        'public.academy_study_record_delivery_outcome_v1(jsonb)'
      ]) as rpc(signature)
      where has_function_privilege('service_role', rpc.signature, 'execute')
    `)
    expect(v1.rows[0].count).toBe(0)
  })

  it('preserves the 20260801190000 policy wrapper on the public delivery entry point', async () => {
    const wrapper = await c2.query<{ definition: string }>(`
      select pg_get_functiondef(
        'public.academy_study_deliver_in_app_notification_v2(text, jsonb)'::regprocedure
      ) as definition
    `)
    expect(wrapper.rows[0].definition).toContain('STUDY_ADULT_REVIEW_POLICY_NOT_APPROVED')
    expect(wrapper.rows[0].definition).toContain('study_deliver_in_app_notification_internal_v2')
    expect(wrapper.rows[0].definition).toContain('study_is_trusted_server')
    const internalAcl = await c2.query<{ service: boolean }>(`
      select has_function_privilege(
        'service_role',
        'academy_private.study_deliver_in_app_notification_internal_v2(text, jsonb)',
        'execute'
      ) as service
    `)
    expect(internalAcl.rows[0].service).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// STUDY-C2 / G1 migration order.
//
// C2 (20260806140000) originally asserted its predecessor state with an exact
// equality on migration_names. That pinned it to one historical chain snapshot,
// so the moment an earlier-versioned sibling landed, natural version order
// broke: G1 (20260806120000) sorts first, applies first, appends its own name,
// and C2 then aborted with 'STUDY_C2 predecessor marker mismatch'.
//
// The correction asserts containment plus explicit marker properties. These
// tests are the permanent regression for both directions: natural sorted order
// must apply, and C2 without G1 must still fail closed.
// ---------------------------------------------------------------------------

const ORDER_BASE_CHAIN = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './migrations/20260801190000_academy_study_final_production_reconciliation.sql',
] as const

/**
 * Applies a chain to a throwaway database and reports the first failure.
 * Returns null when the whole chain applies.
 */
async function applyChain(paths: readonly string[]): Promise<
  { path: string; message: string } | null
> {
  const database = await PGlite.create()
  try {
    await database.exec(bootstrap)
    for (const path of paths) {
      const source = await readFile(new URL(path, import.meta.url), 'utf8')
      try {
        await database.exec(source)
      } catch (error) {
        return { path, message: (error as Error).message }
      }
    }
    return null
  } finally {
    await database.close()
  }
}

describe.sequential('STUDY-C2 and G1 migration order', () => {
  it('applies in natural sorted version order: G1 (120000) then C2 (140000)', async () => {
    const sorted = [...ORDER_BASE_CHAIN, G1_MIGRATION, C2_MIGRATION]
    // The chain under test really is ascending version order, so this proves
    // the order a hosted apply would choose, not a hand-picked one.
    const migrations = sorted.filter((path) => path.includes('/migrations/'))
    expect([...migrations].sort()).toEqual(migrations)
    expect(migrations.at(-2)).toBe(G1_MIGRATION)
    expect(migrations.at(-1)).toBe(C2_MIGRATION)
    expect(await applyChain(sorted)).toBeNull()
  }, 180_000)

  it('records both markers when the natural order is applied', async () => {
    const database = await PGlite.create()
    try {
      await database.exec(bootstrap)
      for (const path of [...ORDER_BASE_CHAIN, G1_MIGRATION, C2_MIGRATION]) {
        await database.exec(await readFile(new URL(path, import.meta.url), 'utf8'))
      }
      const marker = await database.query<{
        names: string[]
        c2: number
        manifest: Record<string, unknown>
      }>(`
        select migration_names as names,
               c2_operations_contract_version as c2,
               security_manifest as manifest
        from academy_private.study_persistence_metadata where singleton
      `)
      const row = marker.rows[0]
      expect(row.names).toContain('20260806120000_academy_study_in_app_receipt_timestamp')
      expect(row.names).toContain('20260806140000_academy_study_c2_operations_contract')
      // G1 first, C2 second — the order the names were appended.
      expect(row.names.indexOf('20260806120000_academy_study_in_app_receipt_timestamp'))
        .toBeLessThan(row.names.indexOf('20260806140000_academy_study_c2_operations_contract'))
      expect(row.c2).toBe(1)
      expect(row.manifest.in_app_receipt_delivered_at_normalized).toBe(true)
      expect(row.manifest.c2_operations_contract_version).toBe(1)
    } finally {
      await database.close()
    }
  }, 180_000)

  it('fails closed when C2 is applied without the G1 receipt timestamp migration', async () => {
    const failure = await applyChain([...ORDER_BASE_CHAIN, C2_MIGRATION])
    expect(failure).not.toBeNull()
    expect(failure!.path).toBe(C2_MIGRATION)
    expect(failure!.message).toContain('STUDY_C2 predecessor marker mismatch')
  }, 180_000)

  it('fails closed on every incomplete or unknown predecessor marker state', async () => {
    // Each case applies the full base chain and G1, corrupts exactly one
    // property C2 depends on, then applies C2. Every one must be refused. This
    // is the mutation proof that the relaxed containment check did not become
    // permissive: containment tolerates *extra* names, never missing ones.
    const mutations = [
      {
        label: 'a required predecessor name is missing',
        sql: `update academy_private.study_persistence_metadata
              set migration_names = array_remove(
                migration_names, '20260801170000_academy_study_adult_review_operations')
              where singleton`,
      },
      {
        label: 'the G1 receipt timestamp migration name is missing',
        sql: `update academy_private.study_persistence_metadata
              set migration_names = array_remove(
                migration_names, '20260806120000_academy_study_in_app_receipt_timestamp')
              where singleton`,
      },
      {
        label: 'the normalized-receipt property is absent',
        sql: `update academy_private.study_persistence_metadata
              set security_manifest = security_manifest
                - 'in_app_receipt_delivered_at_normalized'
              where singleton`,
      },
      {
        label: 'the normalized-receipt property is false',
        sql: `update academy_private.study_persistence_metadata
              set security_manifest = security_manifest || jsonb_build_object(
                'in_app_receipt_delivered_at_normalized', false)
              where singleton`,
      },
      {
        // The column is constrained to (0, 2), so 0 is the legal wrong value.
        label: 'adult_review_operations_version is not 2',
        sql: `update academy_private.study_persistence_metadata
              set adult_review_operations_version = 0 where singleton`,
      },
      {
        label: 'final_production_version is not 1',
        sql: `update academy_private.study_persistence_metadata
              set final_production_version = 0 where singleton`,
      },
      {
        label: 'the singleton marker row is absent entirely',
        sql: `delete from academy_private.study_persistence_metadata where singleton`,
      },
    ]

    for (const mutation of mutations) {
      const database = await PGlite.create()
      try {
        await database.exec(bootstrap)
        for (const path of [...ORDER_BASE_CHAIN, G1_MIGRATION]) {
          await database.exec(await readFile(new URL(path, import.meta.url), 'utf8'))
        }
        await database.exec(mutation.sql)
        const c2Source = await readFile(new URL(C2_MIGRATION, import.meta.url), 'utf8')
        await expect(
          database.exec(c2Source),
          mutation.label,
        ).rejects.toThrow('STUDY_C2 predecessor marker mismatch')
      } finally {
        await database.close()
      }
    }
  }, 300_000)

  it('refuses a second application of C2 onto an already-closed contract', async () => {
    const failure = await applyChain([
      ...ORDER_BASE_CHAIN, G1_MIGRATION, C2_MIGRATION, C2_MIGRATION,
    ])
    expect(failure).not.toBeNull()
    expect(failure!.path).toBe(C2_MIGRATION)
    expect(failure!.message).toContain('STUDY_C2 operations contract already applied')
  }, 180_000)

  it('asserts predecessors by containment, never by exact array equality', async () => {
    const source = await readFile(new URL(C2_MIGRATION, import.meta.url), 'utf8')
    // The defect was `marker.migration_names <> array[...]`. Containment (@>)
    // is what lets a legitimately-ordered sibling land ahead of this migration.
    expect(source).not.toMatch(/migration_names\s*<>\s*array\[/)
    expect(source).toMatch(/migration_names\s*@>\s*array\[/)
    // G1 is a named, required predecessor.
    expect(source).toContain('20260806120000_academy_study_in_app_receipt_timestamp')
    // The normalized-receipt property is asserted, not merely the name.
    expect(source).toContain('in_app_receipt_delivered_at_normalized')
  })
})
