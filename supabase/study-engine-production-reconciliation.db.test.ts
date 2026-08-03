import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const files = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './tests/study_engine_fixtures.sql',
] as const

const sql = Promise.all(
  files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
)

const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const HOUSEHOLD_B = '00000000-0000-0000-0000-000000000022'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const ACCESS_A = '00000000-0000-0000-0000-0000000001a1'
const PERMISSION_A = '00000000-0000-0000-0000-00000000f1a1'
const RECIPIENT_A = 'recipient:guardian-a'
const ROUTE_A = 'route:guardian-a:email'
const FUTURE = '2030-08-01T14:00:00Z'

let database: PGlite

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create table auth.users (id uuid primary key);
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  set search_path = pg_catalog
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif(
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub',
        ''
      )::uuid
    )
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

function guardianClaims() {
  return JSON.stringify({ sub: GUARDIAN_A, role: 'authenticated' })
}

async function asRole<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  sub: string | null,
  claims: string,
  operation: () => Promise<T>,
): Promise<T> {
  await database.exec(`
    select set_config('request.jwt.claim.sub', '${sub ?? ''}', false);
    select set_config('request.jwt.claims', '${claims.replaceAll("'", "''")}', false);
    select set_config('request.jwt.claim.role', '${role}', false);
    set role ${role};
  `)
  try {
    return await operation()
  } finally {
    await database.exec(`
      reset role;
      select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claims', '', false);
      select set_config('request.jwt.claim.role', '', false);
    `)
  }
}

async function rpc<T>(statement: string, parameters: unknown[] = []) {
  const result = await database.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

function service<T>(operation: () => Promise<T>) {
  return asRole(
    'service_role', null, JSON.stringify({ role: 'service_role' }), operation,
  )
}

function proposal(id: string, idempotencyKey = `${id}:idempotency`) {
  return {
    schemaVersion: 1,
    proposalId: id,
    householdId: HOUSEHOLD_A,
    studentId: STUDENT_A,
    sessionId: 'session-a',
    category: 'student-support',
    classification: 'urgent',
    urgency: 'urgent',
    reasonCodes: ['safety-urgent-synthetic-v1'],
    classifierVersion: 'test-safety-classifier-v1',
    occurredAt: '2026-08-01T14:00:00Z',
    idempotencyKey,
    deliveryState: 'proposed-not-delivered',
    authorizedRecipientResolutionState: 'pending',
  }
}

async function createAndRoute(proposalId: string, at = FUTURE) {
  await service(() => rpc(
    `select public.academy_study_create_adult_review_proposal_v1(
      $1::jsonb
    ) as result`,
    [JSON.stringify(proposal(proposalId))],
  ))
  const claims = await service(() => rpc<Array<{
    proposal: Record<string, unknown>
    leaseToken: string
  }>>(
    `select public.academy_study_claim_adult_review_proposals_v1(
      $1::timestamptz, 10, 30
    ) as result`, [at],
  ))
  const claim = claims.find((item) => item.proposal.proposalId === proposalId)
  if (!claim) throw new Error(`missing proposal claim: ${proposalId}`)
  const resolved = await service(() => rpc<{
    state: string
    resolutionRef: string
    policyVersion: string
  }>(
    `select public.academy_study_resolve_adult_recipients_v1($1) as result`,
    [proposalId],
  ))
  const routed = await service(() => rpc<{ jobs: Array<Record<string, unknown>> }>(
    `select public.academy_study_record_recipient_resolution_v1(
      $1::jsonb
    ) as result`,
    [JSON.stringify({
      proposalId,
      proposalLeaseToken: claim.leaseToken,
      resolutionRef: resolved.resolutionRef,
      policyVersion: resolved.policyVersion,
      routes: [{
        recipientRef: RECIPIENT_A,
        routeRef: ROUTE_A,
        channel: 'email',
        deliveryIdempotencyKey: `${proposalId}:email`,
      }],
    })],
  ))
  return routed.jobs[0]
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  for (const migration of await sql) await database.exec(migration)
}, 120_000)

afterAll(async () => {
  await database.close()
})

describe.sequential('Study Engine production persistence reconciliation', () => {
  it('keeps the readiness definition coupled to security metadata, not table presence alone', async () => {
    const migration = (await sql)[4]
    const readinessDefinition = migration.slice(
      migration.indexOf('create or replace function public.academy_study_safety_durable_readiness_v1'),
      migration.indexOf('create trigger study_delivery_attempts_immutable'),
    )
    expect(readinessDefinition).toContain('study_safety_rate_limit_reservations')
    expect(readinessDefinition).toContain('relation.relforcerowsecurity')
    expect(readinessDefinition).toContain('pg_get_userbyid')
    expect(readinessDefinition).toContain('information_schema.role_table_grants')
    expect(readinessDefinition).toContain('count(distinct procedure.proname)')
    expect(readinessDefinition).toContain("has_function_privilege('anon'")
    expect(readinessDefinition).toContain("proconfig @> array['search_path=pg_catalog']")
  })

  it('forces RLS, closes table ACLs, and pins every trusted function search path', async () => {
    const catalog = await database.query<{
      private_tables: number
      forced_tables: number
      browser_grants: number
      unsafe_definers: number
    }>(`
      with reconciliation_tables as (
        select relation.oid, relation.relrowsecurity, relation.relforcerowsecurity
        from pg_catalog.pg_class as relation
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = relation.relnamespace
        where namespace.nspname = 'academy_private'
          and relation.relkind = 'r'
          and relation.relname in (
            'study_adult_notification_permissions',
            'study_adult_notification_routes',
            'study_adult_review_proposals_v1',
            'study_adult_review_delivery_jobs',
            'study_adult_review_delivery_attempts',
            'study_adult_review_delivery_receipts',
            'study_safety_rate_limit_buckets',
            'study_safety_rate_limit_reservations',
            'study_safety_monitoring_events'
          )
      )
      select
        (select count(*) from reconciliation_tables)::integer as private_tables,
        (select count(*) from reconciliation_tables
          where relrowsecurity and relforcerowsecurity)::integer as forced_tables,
        (select count(*) from information_schema.role_table_grants
          where table_schema = 'academy_private'
            and table_name in (
              'study_adult_notification_permissions',
              'study_adult_notification_routes',
              'study_adult_review_proposals_v1',
              'study_adult_review_delivery_jobs',
              'study_adult_review_delivery_attempts',
              'study_adult_review_delivery_receipts',
              'study_safety_rate_limit_buckets',
              'study_safety_rate_limit_reservations',
              'study_safety_monitoring_events'
            )
            and grantee in ('anon', 'authenticated', 'service_role'))::integer
          as browser_grants,
        (select count(*) from pg_catalog.pg_proc as procedure
          join pg_catalog.pg_namespace as namespace
            on namespace.oid = procedure.pronamespace
          where namespace.nspname = 'public'
            and procedure.proname like 'academy_study_%_v1'
            and procedure.prosecdef
            and not coalesce(
              procedure.proconfig @> array['search_path=pg_catalog']::text[],
              false
            ))::integer as unsafe_definers
    `)
    expect(catalog.rows[0]).toEqual({
      private_tables: 9,
      forced_tables: 9,
      browser_grants: 0,
      unsafe_definers: 0,
    })
  })

  it('exposes readiness only to the trusted server boundary', async () => {
    expect(await service(() => rpc(
      `select public.academy_study_safety_durable_readiness_v1() as result`,
    ))).toEqual({ status: 'ready', schemaVersion: 1 })
    await expect(asRole(
      'authenticated', GUARDIAN_A, guardianClaims(),
      () => rpc(
        `select public.academy_study_safety_durable_readiness_v1() as result`,
      ),
    )).rejects.toThrow(/permission denied/)
    await expect(asRole(
      'authenticated', GUARDIAN_A, guardianClaims(),
      () => database.exec(
        `select * from academy_private.study_adult_notification_permissions`,
      ),
    )).rejects.toThrow(/permission denied/)
  })

  it('fails readiness when RLS, grants, or a trusted search_path drifts', async () => {
    const readiness = () => service(() => rpc(
      `select public.academy_study_safety_durable_readiness_v1() as result`,
    ))

    await database.exec(`
      alter table academy_private.study_safety_monitoring_events
        no force row level security
    `)
    try {
      expect(await readiness()).toEqual({ status: 'not-ready', schemaVersion: 1 })
    } finally {
      await database.exec(`
        alter table academy_private.study_safety_monitoring_events
          force row level security
      `)
    }

    await database.exec(`
      grant select on academy_private.study_safety_monitoring_events
        to authenticated
    `)
    try {
      expect(await readiness()).toEqual({ status: 'not-ready', schemaVersion: 1 })
    } finally {
      await database.exec(`
        revoke select on academy_private.study_safety_monitoring_events
          from authenticated
      `)
    }

    await database.exec(`
      alter table academy_private.study_safety_monitoring_events
        owner to service_role
    `)
    try {
      expect(await readiness()).toEqual({ status: 'not-ready', schemaVersion: 1 })
    } finally {
      await database.exec(`
        alter table academy_private.study_safety_monitoring_events
          owner to postgres
      `)
    }

    await database.exec(`
      alter function public.academy_study_record_safety_monitoring_event_v1(jsonb)
        set search_path = public
    `)
    try {
      expect(await readiness()).toEqual({ status: 'not-ready', schemaVersion: 1 })
    } finally {
      await database.exec(`
        alter function public.academy_study_record_safety_monitoring_event_v1(jsonb)
          set search_path = pg_catalog
      `)
    }

    await database.exec(`
      alter function public.academy_study_record_safety_monitoring_event_v1(jsonb)
        rename to academy_study_record_safety_monitoring_event_v1_drifted
    `)
    try {
      expect(await readiness()).toEqual({ status: 'not-ready', schemaVersion: 1 })
    } finally {
      await database.exec(`
        alter function public.academy_study_record_safety_monitoring_event_v1_drifted(jsonb)
          rename to academy_study_record_safety_monitoring_event_v1
      `)
    }
    expect(await readiness()).toEqual({ status: 'ready', schemaVersion: 1 })
  })

  it('requires explicit versioned notification permission and rejects stale revisions', async () => {
    const permission = {
      permissionId: PERMISSION_A,
      guardianAccessId: ACCESS_A,
      recipientRef: RECIPIENT_A,
      allowedChannels: ['email'],
      status: 'active',
      policyVersion: 'adult-notification-policy-v1',
      provenanceRef: 'guardian-consent:synthetic-v1',
    }
    expect(await service(() => rpc(
      `select public.academy_study_set_adult_notification_permission_v1(
        $1::jsonb, 0
      ) as result`, [JSON.stringify(permission)],
    ))).toEqual({ status: 'stored', revision: 1 })
    expect(await service(() => rpc(
      `select public.academy_study_set_adult_notification_permission_v1(
        $1::jsonb, 0
      ) as result`, [JSON.stringify(permission)],
    ))).toEqual({ status: 'revision-conflict', currentRevision: 1 })
    expect(await service(() => rpc(
      `select public.academy_study_set_adult_notification_route_v1(
        $1::jsonb, 0
      ) as result`, [JSON.stringify({
        routeRef: ROUTE_A,
        permissionId: PERMISSION_A,
        recipientRef: RECIPIENT_A,
        channel: 'email',
        status: 'active',
        providerRouteVersion: 'test-provider-route-v1',
      })],
    ))).toEqual({ status: 'stored', revision: 1 })
  })

  it('stores only canonical minimized proposal evidence and rejects forgery/collision', async () => {
    const input = proposal('proposal-a')
    expect(await service(() => rpc(
      `select public.academy_study_create_adult_review_proposal_v1(
        $1::jsonb
      ) as result`, [JSON.stringify(input)],
    ))).toEqual({ created: true })
    expect(await service(() => rpc(
      `select public.academy_study_create_adult_review_proposal_v1(
        $1::jsonb
      ) as result`, [JSON.stringify(input)],
    ))).toEqual({ created: false, duplicateProposalId: 'proposal-a' })

    await expect(service(() => rpc(
      `select public.academy_study_create_adult_review_proposal_v1(
        $1::jsonb
      ) as result`, [JSON.stringify({ ...proposal('proposal-raw'), rawText: 'forbidden' })],
    ))).rejects.toThrow(/STUDY_PROPOSAL_V1_INVALID/)
    await expect(service(() => rpc(
      `select public.academy_study_create_adult_review_proposal_v1(
        $1::jsonb
      ) as result`, [JSON.stringify({
        ...proposal('proposal-forged'), householdId: HOUSEHOLD_B,
      })],
    ))).rejects.toThrow(/STUDY_PROPOSAL_V1_SCOPE_NOT_AVAILABLE/)
    await expect(service(() => rpc(
      `select public.academy_study_create_adult_review_proposal_v1(
        $1::jsonb
      ) as result`, [JSON.stringify({
        ...proposal('proposal-collision', input.idempotencyKey),
      })],
    ))).rejects.toThrow(/STUDY_PROPOSAL_V1_IDEMPOTENCY_COLLISION/)

    const columns = await database.query<{ name: string }>(`
      select column_name as name
      from information_schema.columns
      where table_schema = 'academy_private'
        and table_name = 'study_adult_review_proposals_v1'
    `)
    expect(columns.rows.map((row) => row.name).join(' ')).not.toMatch(
      /raw|text|transcript|answer|message|content/i,
    )
  })

  it('resolves only opaque active routes and binds delivery to an immutable receipt', async () => {
    const proposalClaims = await service(() => rpc<Array<{
      proposal: Record<string, unknown>
      leaseToken: string
    }>>(
      `select public.academy_study_claim_adult_review_proposals_v1(
        $1::timestamptz, 10, 30
      ) as result`, [FUTURE],
    ))
    const proposalClaim = proposalClaims.find(
      (item) => item.proposal.proposalId === 'proposal-a',
    )
    expect(proposalClaim).toBeDefined()
    const resolution = await service(() => rpc<{
      state: string
      resolutionRef: string
      policyVersion: string
      recipients: unknown[]
    }>(
      `select public.academy_study_resolve_adult_recipients_v1(
        'proposal-a'
      ) as result`,
    ))
    expect(resolution.state).toBe('resolved')
    expect(JSON.stringify(resolution)).not.toMatch(/@|phone|address|destination/i)

    const enqueued = await service(() => rpc<{ jobs: Array<{ outboxId: string }> }>(
      `select public.academy_study_record_recipient_resolution_v1(
        $1::jsonb
      ) as result`, [JSON.stringify({
        proposalId: 'proposal-a',
        proposalLeaseToken: proposalClaim?.leaseToken,
        resolutionRef: resolution.resolutionRef,
        policyVersion: resolution.policyVersion,
        routes: [{
          recipientRef: RECIPIENT_A,
          routeRef: ROUTE_A,
          channel: 'email',
          deliveryIdempotencyKey: 'proposal-a:email',
        }],
      })],
    ))
    expect(enqueued.jobs).toHaveLength(1)

    const claims = await service(() => rpc<Array<{
      record: Record<string, unknown>
      proposal: Record<string, unknown>
      leaseToken: string
    }>>(
      `select public.academy_study_claim_delivery_jobs_v1(
        $1::timestamptz, 10, 30
      ) as result`, [FUTURE],
    ))
    const claim = claims.find(
      (item) => item.record.outboxId === enqueued.jobs[0].outboxId,
    )
    expect(claim?.proposal).toMatchObject({ proposalId: 'proposal-a' })
    const reauthorization = await service(() => rpc<Record<string, unknown>>(
      `select public.academy_study_reauthorize_adult_route_v1(
        $1::jsonb
      ) as result`, [JSON.stringify({
        proposalRef: 'proposal-a',
        recipientRef: RECIPIENT_A,
        routeRef: ROUTE_A,
        now: FUTURE,
      })],
    ))
    expect(reauthorization).toMatchObject({ state: 'authorized', channel: 'email' })

    const attempt = {
      outboxId: enqueued.jobs[0].outboxId,
      leaseToken: claim?.leaseToken,
      attemptId: 'attempt-a',
      deliveryIdempotencyKey: 'proposal-a:email',
      recipientRef: RECIPIENT_A,
      routeRef: ROUTE_A,
      channel: 'email',
      providerVersion: 'test-provider-v1',
      authorizationEvidenceRef: reauthorization.authorizationEvidenceRef,
      attemptedAt: FUTURE,
    }
    expect(await service(() => rpc(
      `select public.academy_study_record_delivery_attempt_v1(
        $1::jsonb
      ) as result`, [JSON.stringify(attempt)],
    ))).toEqual({ attemptCount: 1 })
    await expect(service(() => rpc(
      `select public.academy_study_record_delivery_outcome_v1(
        $1::jsonb
      ) as result`, [JSON.stringify({
        outboxId: attempt.outboxId,
        leaseToken: attempt.leaseToken,
        state: 'delivered',
        attemptId: attempt.attemptId,
        occurredAt: FUTURE,
        retryAt: null,
        failureCode: null,
      })],
    ))).rejects.toThrow(/STUDY_VERIFIED_RECEIPT_REQUIRED/)

    const receipt = {
      ...attempt,
      deliveredAt: FUTURE,
      providerReceiptRef: 'provider-receipt-a',
      receiptEvidenceRef: 'receipt-evidence-a',
    }
    expect(await service(() => rpc(
      `select public.academy_study_record_delivery_receipt_v1(
        $1::jsonb
      ) as result`, [JSON.stringify(receipt)],
    ))).toEqual({ recorded: true })
    expect(await service(() => rpc(
      `select public.academy_study_record_delivery_outcome_v1(
        $1::jsonb
      ) as result`, [JSON.stringify({
        outboxId: attempt.outboxId,
        leaseToken: attempt.leaseToken,
        state: 'delivered',
        attemptId: attempt.attemptId,
        occurredAt: FUTURE,
        retryAt: null,
        failureCode: null,
      })],
    ))).toEqual({ recorded: true })
    await expect(database.exec(`
      update academy_private.study_adult_review_delivery_attempts
      set provider_version = 'tampered' where attempt_id = 'attempt-a'
    `)).rejects.toThrow(/STUDY_APPEND_ONLY/)
  })

  it('recovers an unattempted lost lease and quarantines an attempted lost lease', async () => {
    const job = await createAndRoute('proposal-lost')
    const firstClaims = await service(() => rpc<Array<{
      record: { outboxId: string }
      leaseToken: string
    }>>(
      `select public.academy_study_claim_delivery_jobs_v1(
        '2030-08-01T15:00:00Z', 10, 5
      ) as result`,
    ))
    const first = firstClaims.find((item) => item.record.outboxId === job.outboxId)
    expect(first).toBeDefined()
    const recoveredClaims = await service(() => rpc<Array<{
      record: { outboxId: string }
      leaseToken: string
    }>>(
      `select public.academy_study_claim_delivery_jobs_v1(
        '2030-08-01T15:00:06Z', 10, 5
      ) as result`,
    ))
    const recovered = recoveredClaims.find(
      (item) => item.record.outboxId === job.outboxId,
    )
    expect(recovered?.leaseToken).not.toBe(first?.leaseToken)
    await service(() => rpc(
      `select public.academy_study_record_delivery_attempt_v1(
        $1::jsonb
      ) as result`, [JSON.stringify({
        outboxId: job.outboxId,
        leaseToken: recovered?.leaseToken,
        attemptId: 'attempt-lost',
        deliveryIdempotencyKey: 'proposal-lost:email',
        recipientRef: RECIPIENT_A,
        routeRef: ROUTE_A,
        channel: 'email',
        providerVersion: 'test-provider-v1',
        authorizationEvidenceRef: 'authorization-evidence:lost',
        attemptedAt: '2030-08-01T15:00:07Z',
      })],
    ))
    const afterAttempt = await service(() => rpc<unknown[]>(
      `select public.academy_study_claim_delivery_jobs_v1(
        '2030-08-01T15:00:12Z', 10, 5
      ) as result`,
    ))
    expect(afterAttempt).toHaveLength(0)
    const state = await database.query<{ state: string; code: string }>(`
      select state, last_failure_code as code
      from academy_private.study_adult_review_delivery_jobs
      where id = '${job.outboxId}'
    `)
    expect(state.rows[0]).toEqual({
      state: 'indeterminate', code: 'lease-expired-after-attempt',
    })
  })

  it('enforces durable limits across opaque account/household/learner/route refs', async () => {
    const base = {
      actorRef: `actor:${'a'.repeat(64)}`,
      householdRef: `household:${'b'.repeat(64)}`,
      learnerRef: `learner:${'c'.repeat(64)}`,
      routeRef: `route:${'d'.repeat(64)}`,
      scope: 'study-safety-classify-subject-route',
      now: Date.parse(FUTURE),
    }
    const reserve = (input: Record<string, unknown>) => service(() => rpc(
      `select public.academy_study_reserve_safety_rate_limit_v1(
        $1::jsonb
      ) as result`, [JSON.stringify(input)],
    ))
    for (let index = 0; index < 10; index += 1) {
      expect(await reserve(base)).toEqual({ allowed: true })
    }
    expect(await reserve(base)).toMatchObject({ allowed: false })
    await expect(reserve({ ...base, householdRef: HOUSEHOLD_B }))
      .rejects.toThrow(/STUDY_RATE_LIMIT_SCOPE_NOT_AVAILABLE/)
    const counts = await database.query<{ used: number; reservations: number }>(`
      select bucket.used,
        (select count(*)::integer
         from academy_private.study_safety_rate_limit_reservations) as reservations
      from academy_private.study_safety_rate_limit_buckets as bucket
    `)
    expect(counts.rows[0]).toEqual({ used: 10, reservations: 11 })
  })

  it('records minimized immutable monitoring state and rejects extra raw fields', async () => {
    const event = {
      schemaVersion: 1,
      eventId: 'monitoring-event-a',
      name: 'study_safety.provider_timeout',
      service: 'study-safety',
      severity: 'warning',
      occurredAt: FUTURE,
      code: 'provider-timeout',
      metricName: 'study_safety_provider_timeout_total',
      runbookId: 'classifier-failure',
      attributes: { attemptCount: 1 },
    }
    expect(await service(() => rpc(
      `select public.academy_study_record_safety_monitoring_event_v1(
        $1::jsonb
      ) as result`, [JSON.stringify(event)],
    ))).toEqual({ recorded: true })
    await expect(service(() => rpc(
      `select public.academy_study_record_safety_monitoring_event_v1(
        $1::jsonb
      ) as result`, [JSON.stringify({ ...event, eventId: 'monitoring-raw', rawText: 'no' })],
    ))).rejects.toThrow(/STUDY_MONITORING_EVENT_INVALID/)
    await expect(database.exec(`
      delete from academy_private.study_safety_monitoring_events
      where event_id = 'monitoring-event-a'
    `)).rejects.toThrow(/STUDY_APPEND_ONLY/)
  })

  it('preserves timezone revision/provenance across household timezone changes', async () => {
    await database.exec(`
      insert into public.academy_study_calendar_blocks (
        id, household_id, student_id, block_type, source_reference,
        scheduled_start, intended_local_date, household_timezone,
        explicit_offset, duration_minutes, idempotency_key
      ) values (
        'calendar-snapshot-a', '${HOUSEHOLD_A}', '${STUDENT_A}',
        'lesson', 'lesson-a', '2026-08-01T14:00:00Z', '2026-08-01',
        'UTC', -240, 30, 'calendar-snapshot-key-a'
      )
    `)
    expect(await asRole(
      'authenticated', GUARDIAN_A, guardianClaims(),
      () => rpc(
        `select public.academy_study_set_household_timezone(
          $1, 'America/Chicago', 1, 'timezone-change-reconciliation'
        ) as result`, [HOUSEHOLD_A],
      ),
    )).toEqual({ status: 'stored', revision: 2 })
    await database.exec(`
      update public.academy_study_calendar_blocks
      set state = 'available'
      where id = 'calendar-snapshot-a'
    `)
    await database.exec(`
      insert into public.academy_study_calendar_blocks (
        id, household_id, student_id, block_type, source_reference,
        scheduled_start, intended_local_date, household_timezone,
        explicit_offset, duration_minutes, idempotency_key
      ) values (
        'calendar-snapshot-b', '${HOUSEHOLD_A}', '${STUDENT_A}',
        'lesson', 'lesson-a', '2026-08-01T15:00:00Z', '2026-08-01',
        'UTC', -300, 30, 'calendar-snapshot-key-b'
      )
    `)
    const snapshots = await database.query<{
      id: string
      timezone: string
      snapshot_revision: number
      provenance: string
      local_time: string
    }>(`
      select id, household_timezone as timezone,
        timezone_snapshot_revision as snapshot_revision,
        timezone_snapshot_provenance as provenance,
        intended_local_time::text as local_time
      from public.academy_study_calendar_blocks
      where id in ('calendar-snapshot-a', 'calendar-snapshot-b')
      order by id
    `)
    expect(snapshots.rows).toEqual([
      {
        id: 'calendar-snapshot-a', timezone: 'America/New_York',
        snapshot_revision: 1, provenance: 'household-settings-v1',
        local_time: '10:00:00',
      },
      {
        id: 'calendar-snapshot-b', timezone: 'America/Chicago',
        snapshot_revision: 2, provenance: 'household-settings-v1',
        local_time: '10:00:00',
      },
    ])
  })
})
