const VALUES = Object.freeze({
  'runtime.ai.enabled': true,
  'runtime.tts.enabled': true,
  'quota.ai.requests_per_account_day': 200,
  'quota.tts.requests_per_account_day': 1_000,
  'cost.warning.monthly_micros': '10000000',
  'cost.critical.monthly_micros': '25000000',
  'ai.approved_tiers': Object.freeze(['sonnet', 'haiku']),
  'ai.default_tier': 'sonnet',
})

const KEYS = Object.freeze(Object.keys(VALUES))

function setting(key, value) {
  const runtimeFlag = key.startsWith('runtime.')
  const quota = key.startsWith('quota.')
  const cost = key.startsWith('cost.')
  const approvedTiers = key === 'ai.approved_tiers'
  return Object.freeze({
    key,
    value,
    revision: '1',
    requiredCapability: 'configuration:manage',
    protectiveCapability: runtimeFlag ? 'engines:operate' : null,
    warningLevel: runtimeFlag || approvedTiers || key === 'cost.critical.monthly_micros'
      ? 'critical'
      : 'warning',
    bounds: quota
      ? Object.freeze({ minimum: '1', maximum: key.includes('.ai.') ? '200' : '1000' })
      : cost ? Object.freeze({ minimum: '1', maximum: '1000000000000' }) : null,
    allowlist: key.startsWith('ai.') ? Object.freeze(['sonnet', 'haiku']) : null,
    deploymentCeilingType: runtimeFlag
      ? 'boolean_enablement'
      : quota ? 'integer_maximum'
        : cost ? 'integer_micros_maximum'
          : approvedTiers ? 'allowlist_subset' : 'allowlist_member',
    registryVersion: 1,
    integrationStatus: 'pending_runtime_integration',
  })
}

export function savedRuntimeConfigurationProjection(overrides = {}) {
  const values = { ...VALUES, ...overrides }
  return Object.freeze({
    schemaVersion: 2,
    integrationStatus: 'pending_runtime_integration',
    settings: Object.freeze(KEYS.map((key) => setting(key, values[key]))),
  })
}
