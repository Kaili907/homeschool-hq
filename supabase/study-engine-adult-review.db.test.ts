import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const files = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './tests/study_engine_fixtures.sql',
] as const

const sql = Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
let database: PGlite
const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const ACCESS_A = '00000000-0000-0000-0000-0000000001a1'
const PERMISSION_A = '00000000-0000-0000-0000-00000000f1a1'
const RECIPIENT_A = `recipient:${'a'.repeat(64)}`
const ROUTE_A = `route:${'b'.repeat(64)}`
const WORKER = 'worker:session17-synthetic'

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
          'study_adult_review_route_capabilities', 'study_adult_review_audit_events'
        ) and relation.relrowsecurity and relation.relforcerowsecurity
    `)
    expect(rls.rows[0].count).toBe(6)
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
        worker_id, configuration_version, authorized_scopes, credential_digest
      ) values (
        '${WORKER}', 'worker-config-v1',
        array['proposal-resolution', 'delivery-claim', 'delivery-attempt',
          'delivery-reconcile', 'monitoring', 'rate-limit', 'retention'],
        '${'a'.repeat(64)}'
      )
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
    const claims = await asService(() => rpc<{ proposals: Array<Record<string, unknown>> }>(
      `select public.academy_study_claim_adult_review_proposals_v2(
        '${WORKER}', 10, 30
      ) as result`,
    ))
    const claim = claims.proposals[0]
    expect(claim).toMatchObject({ proposalId })
    const resolution = await asService(() => rpc<{
      state: string
      resolutionRef: string
      policyVersion: string
      recipients: Array<Record<string, unknown>>
    }>(`select public.academy_study_resolve_adult_recipients_v2(
      '${proposalId}', '${WORKER}'
    ) as result`))
    expect(resolution.state).toBe('resolved')
    expect(JSON.stringify(resolution)).not.toMatch(/@|phone|address|membershipId|guardianAccessId/i)
    const routed = await asService(() => rpc<{ jobs: Array<Record<string, unknown>> }>(
      `select public.academy_study_record_recipient_resolution_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify({
        proposalId,
        leaseToken: claim.leaseToken,
        expectedRevision: claim.revision,
        state: 'resolved',
        resolutionRef: resolution.resolutionRef,
        policyVersion: resolution.policyVersion,
        recipients: resolution.recipients,
      })],
    ))
    expect(routed.jobs).toHaveLength(1)
    const jobClaims = await asService(() => rpc<{ jobs: Array<Record<string, unknown>> }>(
      `select public.academy_study_claim_delivery_jobs_v2(
        '${WORKER}', 10, 30
      ) as result`,
    ))
    const job = jobClaims.jobs[0]
    const attemptId = 'attempt:session17-synthetic'
    const attempt = await asService(() => rpc<{ revision: number }>(
      `select public.academy_study_create_delivery_attempt_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify({
        jobId: job.jobId,
        leaseToken: job.leaseToken,
        expectedRevision: job.revision,
        attemptId,
        providerName: 'in-app',
        providerConfigVersion: 'in-app-config-v1',
      })],
    ))
    for (const state of ['created', 'submitted', 'provider-accepted']) {
      await asService(() => rpc(
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
    const delivered = await asService(() => rpc<Record<string, unknown>>(
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
        providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1',
      })],
    ))
    expect(delivered).toMatchObject({ state: 'delivered', attemptId })
    expect(JSON.stringify(delivered)).not.toMatch(/raw|transcript|@|phone/i)
    const persisted = await database.query<{ jobs: number; notifications: number; receipts: number }>(`
      select
        (select count(*)::integer from academy_private.study_adult_review_delivery_jobs where state = 'delivered') as jobs,
        (select count(*)::integer from academy_private.study_parent_notifications) as notifications,
        (select count(*)::integer from academy_private.study_adult_review_delivery_receipts) as receipts
    `)
    expect(persisted.rows[0]).toEqual({ jobs: 1, notifications: 1, receipts: 1 })
  })

  it('durably records closed-schema monitoring and purges only expired bounded records', async () => {
    const monitoring = {
      schemaVersion: 2,
      eventName: 'study.adult_review.outbox_backlog',
      eventId: 'event:session17-synthetic',
      occurredAt: '2026-08-01T17:00:00.000Z',
      severity: 'warning',
      retentionDays: 90,
      dimensions: { environment: 'test', route: 'in_app' },
      measurement: { name: 'job_count', unit: 'count', value: 50, occurrences: 1 },
      threshold: {
        basis: 'value', observed: 50, operator: 'gte', value: 50,
        windowSeconds: 600, triggered: true,
      },
    }
    expect(await asService(() => rpc(
      `select public.academy_study_record_adult_review_monitoring_v2(
        '${WORKER}', $1::jsonb
      ) as result`,
      [JSON.stringify(monitoring)],
    ))).toEqual({ recorded: true })

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
    const purged = await asService(() => rpc<{
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
})
