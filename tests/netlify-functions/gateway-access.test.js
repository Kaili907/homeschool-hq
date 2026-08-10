import { describe, expect, it, vi } from 'vitest'
import { createGatewayAccess, dailyLimit } from '../../netlify/functions/_shared/gateway-access.js'

const TEST_ATTEMPT_ID = '90000000-0000-4000-8000-000000000001'

function membershipClient(result) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    abortSignal: vi.fn(async () => result),
  }
  return { client: { from: vi.fn(() => builder) }, builder }
}

describe('gateway service-role access', () => {
  it('exposes the journal RPC adapter through the same service-role client', async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: { status: 'created', attemptId: TEST_ATTEMPT_ID, state: 'reserved' },
        error: null,
      })),
    }
    const store = createGatewayAccess({ client }).createProviderAttemptStore()
    await store.reserve({
      reservationKey: 'reserve.gateway',
      logicalOperationKey: 'operation.gateway',
      physicalRetryIndex: 0,
      operationalExecutionKey: 'telemetry.gateway',
      ledgerExecutionKey: 'ledger_gateway',
      accountRef: '10000000-0000-4000-8000-000000000001',
      householdRef: '20000000-0000-4000-8000-000000000001',
      householdAttribution: 'resolved',
      appVersion: 'build-v1',
      engineVersion: 'tutor-v1',
      curriculumVersion: null,
      engine: 'tutor',
      purpose: 'tutor_turn',
      provider: 'anthropic',
      providerProductId: 'claude-sonnet-4-6',
      providerModelId: 'claude-sonnet-4-6',
      logicalModelTier: 'sonnet',
    })
    expect(client.rpc).toHaveBeenCalledWith(
      'academy_reserve_provider_attempt_v1',
      expect.objectContaining({ p_reservation_key: 'reserve.gateway' }),
    )
  })

  it('queries only an active, non-revoked membership for the verified user id', async () => {
    const { client, builder } = membershipClient({ data: [{ household_id: 'household-id' }], error: null })
    const access = createGatewayAccess({ client })
    await expect(access.requireEntitlement('verified-user-id')).resolves.toEqual({
      householdRef: 'household-id',
      householdAttribution: 'resolved',
    })
    expect(client.from).toHaveBeenCalledWith('academy_household_memberships')
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'user_id', 'verified-user-id')
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'status', 'active')
    expect(builder.eq).toHaveBeenNthCalledWith(3, 'academy_households.status', 'active')
    expect(builder.is).toHaveBeenCalledWith('revoked_at', null)
    expect(builder.select).toHaveBeenCalledWith('household_id, academy_households!inner(status)')
    expect(builder.limit).toHaveBeenCalledWith(2)
  })

  it('fails closed when the verified user has no current membership', async () => {
    const { client } = membershipClient({ data: [], error: null })
    const access = createGatewayAccess({ client })
    await expect(access.requireEntitlement('verified-user-id')).rejects.toMatchObject({
      statusCode: 403,
      code: 'not_entitled',
    })
  })

  it('calls the atomic usage RPC and rejects a false reservation', async () => {
    const rpcBuilder = {
      abortSignal: vi.fn(async () => ({ data: false, error: null })),
    }
    const client = { rpc: vi.fn(() => rpcBuilder) }
    const access = createGatewayAccess({ client })
    await expect(access.consumeUsage('verified-user-id', 'anthropic', 50)).rejects.toMatchObject({
      statusCode: 429,
      code: 'usage_limit',
    })
    expect(client.rpc).toHaveBeenCalledWith('academy_consume_gateway_usage', {
      p_user_id: 'verified-user-id',
      p_endpoint: 'anthropic',
      p_limit: 50,
    })
  })

  it('passes only the bounded accounting contract to the server ledger RPC', async () => {
    const rpcBuilder = {
      abortSignal: vi.fn(async () => ({ data: 'usage-id', error: null })),
    }
    const client = { rpc: vi.fn(() => rpcBuilder) }
    const access = createGatewayAccess({ client })
    await access.recordProviderUsage({
      requestKey: 'request-key',
      occurredAt: '2026-08-08T12:00:00.000Z',
      accountRef: 'verified-user-id',
      householdRef: 'household-id',
      householdAttribution: 'resolved',
      appVersion: 'build-1',
      engineVersion: 'tutor-v1',
      curriculumVersion: null,
      engine: 'tutor',
      provider: 'anthropic',
      logicalModelTier: 'sonnet',
      providerProductId: 'claude-sonnet-4-6',
      providerModelId: 'claude-sonnet-4-6',
      inputTokens: 10,
      outputTokens: 4,
      cachedInputReadTokens: 2,
      cachedInputWriteTokens: 1,
      ttsCharacters: null,
      latencyMs: 80,
      result: 'success',
      resultReasonCode: null,
      billingDisposition: 'billable',
    })
    expect(client.rpc).toHaveBeenCalledWith('academy_record_provider_usage', {
      p_execution_key: 'request-key',
      p_occurred_at: '2026-08-08T12:00:00.000Z',
      p_account_id: 'verified-user-id',
      p_household_id: 'household-id',
      p_household_attribution: 'resolved',
      p_app_version: 'build-1',
      p_engine_version: 'tutor-v1',
      p_curriculum_version: null,
      p_engine: 'tutor',
      p_provider: 'anthropic',
      p_logical_model_tier: 'sonnet',
      p_provider_product_id: 'claude-sonnet-4-6',
      p_provider_model_id: 'claude-sonnet-4-6',
      p_input_tokens: 10,
      p_output_tokens: 4,
      p_cached_input_read_tokens: 2,
      p_cached_input_write_tokens: 1,
      p_tts_characters: null,
      p_latency_ms: 80,
      p_result: 'success',
      p_result_reason_code: null,
      p_billing_disposition: 'billable',
    })
  })

  it('reports ambiguous household attribution without guessing a household', async () => {
    const { client } = membershipClient({
      data: [{ household_id: 'household-a' }, { household_id: 'household-b' }],
      error: null,
    })
    await expect(createGatewayAccess({ client }).requireEntitlement('verified-user-id')).resolves.toEqual({
      householdRef: null,
      householdAttribution: 'ambiguous',
    })
  })

  it('reads the bounded canonical cost projection through the service RPC', async () => {
    const data = [{ costMicros: '9007199254740993' }]
    const client = { rpc: vi.fn(() => ({ abortSignal: vi.fn(async () => ({ data, error: null })) })) }
    await expect(createGatewayAccess({ client }).readProviderUsageCosts({
      limit: 25,
      before: '2026-08-08T12:00:00.000Z',
    })).resolves.toBe(data)
    expect(client.rpc).toHaveBeenCalledWith('academy_read_provider_usage_costs', {
      p_limit: 25,
      p_before: '2026-08-08T12:00:00.000Z',
    })
  })

  it('reads provider attempt coverage with the fixed costs capability and bounded range', async () => {
    const data = { schemaVersion: 1, invoiceCompletenessClaim: false }
    const client = { rpc: vi.fn(() => ({ abortSignal: vi.fn(async () => ({ data, error: null })) })) }
    await expect(createGatewayAccess({ client }).readProviderAttemptCoverage({
      startAt: '2026-08-08T00:00:00.000Z',
      endExclusive: '2026-08-09T00:00:00.000Z',
    })).resolves.toBe(data)
    expect(client.rpc).toHaveBeenCalledWith('academy_read_provider_attempt_coverage_v1', {
      p_start_at: '2026-08-08T00:00:00.000Z',
      p_end_exclusive: '2026-08-09T00:00:00.000Z',
      p_required_capability: 'costs:read',
    })
  })

  it('uses safe defaults for absent, malformed, zero, or excessive limits', () => {
    expect(dailyLimit({}, 'LIMIT', 50)).toBe(50)
    expect(dailyLimit({ LIMIT: 'nope' }, 'LIMIT', 50)).toBe(50)
    expect(dailyLimit({ LIMIT: '0' }, 'LIMIT', 50)).toBe(50)
    expect(dailyLimit({ LIMIT: '100001' }, 'LIMIT', 50)).toBe(50)
    expect(dailyLimit({ LIMIT: '75' }, 'LIMIT', 50)).toBe(75)
  })
})
