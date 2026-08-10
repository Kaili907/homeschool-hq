import { describe, expect, it } from 'vitest'
import {
  evaluateStudyDeploymentPreflight,
  formatStudyDeploymentPreflight,
  runLocalStudyDeploymentPreflight,
  serializeStudyDeploymentPreflight,
  STUDY_DEPLOYMENT_GATE_STATUSES,
} from '../scripts/study-deployment-env-preflight.mjs'

const SECRET_SENTINELS = Object.freeze({
  serviceRole: 'service-role-secret-sentinel-never-print',
  hmac: 'safety-hmac-secret-sentinel-never-print',
  provider: 'anthropic-secret-sentinel-never-print',
  worker: 'worker-credential-secret-sentinel-never-print',
  invocation: 'manual-invocation-secret-sentinel-never-print',
})

function readyEnvironment() {
  return {
    VITE_STUDY_ENGINE_ENABLED: 'true',
    ACADEMY_STUDY_ENABLED: 'true',
    VITE_STUDY_ENGINE_PREVIEW: 'false',
    VITE_SUPABASE_URL: 'https://academy.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'public-anon-key',
    SUPABASE_URL: 'https://academy.supabase.co',
    SUPABASE_ANON_KEY: 'public-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: SECRET_SENTINELS.serviceRole,
    STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: SECRET_SENTINELS.hmac,
    ANTHROPIC_API_KEY: SECRET_SENTINELS.provider,
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: 'worker:adult-review',
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID: 'credential:adult-review',
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION: 'worker-credential-v1',
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION: 'worker-configuration-v1',
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: SECRET_SENTINELS.worker,
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET: SECRET_SENTINELS.invocation,
  }
}

function validNetlifyConfig() {
  return `
[build]
  functions = "netlify/functions"

[build.environment]
  VITE_USE_PROXY = "true"
  NODE_VERSION = "22"

[functions."study-adult-review-scheduled-worker"]
  schedule = "*/5 * * * *"

[[redirects]]
  from = "/api/study/adult-review/worker"
  to = "/.netlify/functions/study-adult-review-worker"
  status = 200

[[redirects]]
  from = "/api/study/safety/*"
  to = "/.netlify/functions/study-safety-classify"
  status = 200
`
}

function allFunctionFiles() {
  return new Set([
    'study-adult-review-scheduled-worker',
    'study-adult-review-worker',
    'study-safety-classify',
  ])
}

function evaluate(overrides = {}) {
  return evaluateStudyDeploymentPreflight({
    env: readyEnvironment(),
    netlifyToml: validNetlifyConfig(),
    functionFiles: allFunctionFiles(),
    ...overrides,
  })
}

function byId(result, id) {
  return result.gates.find((item) => item.id === id)
}

describe('Study production deployment environment preflight', () => {
  it('is ready when every required environment and checked-in configuration contract is present', () => {
    const result = evaluate()
    expect(result.overall).toBe('READY_FOR_DEPLOYMENT_ENVIRONMENT')
    expect(result.ready).toBe(true)
    expect(result.gates.every((item) => STUDY_DEPLOYMENT_GATE_STATUSES.includes(item.status))).toBe(true)
  })

  it('blocks when one required environment variable is missing', () => {
    const env = readyEnvironment()
    delete env.VITE_STUDY_ENGINE_ENABLED
    const result = evaluate({ env })
    expect(result.overall).toBe('BLOCKED_BY_MISSING_ENV')
    expect(byId(result, 'feature.client-study-enabled')).toMatchObject({
      status: 'missing', reasonCode: 'FEATURE_GATE_NOT_CONFIGURED',
    })
  })

  it('blocks and identifies a missing server-only secret without returning its value', () => {
    const env = readyEnvironment()
    delete env.SUPABASE_SERVICE_ROLE_KEY
    const result = evaluate({ env })
    expect(result.overall).toBe('BLOCKED_BY_MISSING_ENV')
    expect(byId(result, 'env.supabase_service_role_key')).toMatchObject({ status: 'missing', secret: true })
  })

  it('rejects malformed repository worker configuration', () => {
    const env = { ...readyEnvironment(), ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: 'unsafe worker id' }
    const result = evaluate({ env })
    expect(result.overall).toBe('BLOCKED_BY_MISSING_ENV')
    expect(byId(result, 'env.academy_study_adult_review_worker_id')).toMatchObject({
      status: 'malformed', reasonCode: 'WORKER_REFERENCE_MALFORMED',
    })
  })

  it('fails closed when a server-only secret is exposed through a VITE name', () => {
    const env = {
      ...readyEnvironment(),
      VITE_SUPABASE_SERVICE_ROLE_KEY: 'client-exposed-service-secret-never-print',
    }
    const result = evaluate({ env })
    expect(result.overall).toBe('BLOCKED_BY_UNSAFE_ENV')
    expect(byId(result, 'client-exposure.supabase_service_role_key')).toMatchObject({
      status: 'unsafe_client_exposure', reasonCode: 'SERVER_ONLY_ENV_EXPOSED_TO_CLIENT',
    })
  })

  it('blocks when the dedicated scheduled function is missing', () => {
    const files = allFunctionFiles()
    files.delete('study-adult-review-scheduled-worker')
    const result = evaluate({ functionFiles: files })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.scheduled_function_file')).toMatchObject({ status: 'missing' })
  })

  it('blocks a wrong scheduled function target', () => {
    const source = validNetlifyConfig().replace(
      '[functions."study-adult-review-scheduled-worker"]',
      '[functions."wrong-study-worker"]',
    )
    const files = allFunctionFiles().add('wrong-study-worker')
    const result = evaluate({ netlifyToml: source, functionFiles: files })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.scheduled_target')).toMatchObject({
      status: 'malformed', reasonCode: 'SCHEDULED_TARGET_WRONG',
    })
  })

  it('blocks a wrong scheduled cadence', () => {
    const source = validNetlifyConfig().replace('*/5 * * * *', '*/10 * * * *')
    const result = evaluate({ netlifyToml: source })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.scheduled_cadence')).toMatchObject({
      status: 'malformed', reasonCode: 'SCHEDULE_CADENCE_WRONG',
    })
  })

  it('blocks the public/manual worker when it is accidentally scheduled', () => {
    const source = `${validNetlifyConfig()}\n[functions."study-adult-review-worker"]\n  schedule = "*/5 * * * *"\n`
    const result = evaluate({ netlifyToml: source })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.manual_worker_not_scheduled')).toMatchObject({
      status: 'malformed', reasonCode: 'MANUAL_WORKER_ACCIDENTALLY_SCHEDULED',
    })
  })

  it('blocks when any function file referenced by Netlify configuration is missing', () => {
    const files = allFunctionFiles()
    files.delete('study-safety-classify')
    const result = evaluate({ functionFiles: files })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.referenced_function_files')).toMatchObject({
      status: 'missing', missingSubjects: ['study-safety-classify'],
    })
  })

  it('redacts every secret value from the machine and operator results', () => {
    const env = {
      ...readyEnvironment(),
      VITE_SUPABASE_SERVICE_ROLE_KEY: 'client-exposed-service-secret-never-print',
    }
    const result = evaluate({ env })
    const output = serializeStudyDeploymentPreflight(result) + formatStudyDeploymentPreflight(result)
    for (const secret of [...Object.values(SECRET_SENTINELS), env.VITE_SUPABASE_SERVICE_ROLE_KEY]) {
      expect(output).not.toContain(secret)
    }
    expect(output).not.toContain('public-anon-key')
  })

  it('emits a parseable deterministic machine-readable result', () => {
    const result = evaluate()
    const parsed = JSON.parse(serializeStudyDeploymentPreflight(result))
    expect(parsed).toMatchObject({
      schemaVersion: 1,
      preflight: 'study-production-deployment-environment',
      overall: 'READY_FOR_DEPLOYMENT_ENVIRONMENT',
      ready: true,
    })
    expect(parsed).not.toHaveProperty('generatedAt')
  })

  it('emits an operator-readable result with classifications, reasons, and limitations', () => {
    const output = formatStudyDeploymentPreflight(evaluate())
    expect(output).toContain('Overall: READY_FOR_DEPLOYMENT_ENVIRONMENT')
    expect(output).toContain('[present] feature.client-study-enabled')
    expect(output).toContain('PROVIDER_MODEL_VERSION_PINNED')
    expect(output).toContain('Passing does not prove that Study migrations are applied')
  })

  it('accepts the repository Netlify configuration and function file set with a complete fixture environment', async () => {
    const result = await runLocalStudyDeploymentPreflight({ env: readyEnvironment() })
    expect(result.overall).toBe('READY_FOR_DEPLOYMENT_ENVIRONMENT')
    expect(byId(result, 'netlify.scheduled_cadence')).toMatchObject({ status: 'present' })
    expect(byId(result, 'netlify.referenced_function_files')).toMatchObject({ status: 'present' })
  })
})
