import { describe, expect, it } from 'vitest'
import {
  evaluateStudyDeploymentPreflight,
  EXPECTED_FAMILY_PILOT_CONTEXT,
  EXPECTED_NETLIFY_FUNCTION_ENTRYPOINTS,
  formatStudyDeploymentPreflight,
  parseStudyScheduledFunctionContract,
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
  command = "npm run build"
  publish = "dist"
  functions = "netlify/function-entrypoints"

[build.environment]
  VITE_USE_PROXY = "true"
  NODE_VERSION = "22"

[context."${EXPECTED_FAMILY_PILOT_CONTEXT}".environment]
  VITE_FAMILY_PILOT_ENABLED = "true"

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
  return new Set(EXPECTED_NETLIFY_FUNCTION_ENTRYPOINTS)
}

function allFunctionEntrypointSources() {
  return new Map(EXPECTED_NETLIFY_FUNCTION_ENTRYPOINTS.map((name) => [
    name,
    `export { handler } from '../functions/${name}.js'`,
  ]))
}

function evaluate(overrides = {}) {
  return evaluateStudyDeploymentPreflight({
    env: readyEnvironment(),
    netlifyToml: validNetlifyConfig(),
    functionFiles: allFunctionFiles(),
    functionEntrypointSources: allFunctionEntrypointSources(),
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

  it('blocks when the reviewed function entrypoint directory is missing', () => {
    const result = evaluate({
      functionFiles: new Set(),
      functionEntrypointSources: new Map(),
      functionDirectoryPresent: false,
    })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.entrypoint_directory')).toMatchObject({
      status: 'missing', reasonCode: 'FUNCTION_ENTRYPOINT_DIRECTORY_MISSING',
    })
  })

  it('blocks the old broad production-module function path', () => {
    const source = validNetlifyConfig().replace(
      'functions = "netlify/function-entrypoints"',
      'functions = "netlify/functions"',
    )
    const result = evaluate({ netlifyToml: source })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.functions_directory')).toMatchObject({
      status: 'malformed', reasonCode: 'FUNCTIONS_DIRECTORY_UNSAFE_OR_MISSING',
    })
  })

  it('blocks a callable test or helper outside the reviewed allowlist', () => {
    const files = allFunctionFiles().add('release-test-helper')
    const sources = allFunctionEntrypointSources().set(
      'release-test-helper',
      "export { handler } from '../functions/release-test-helper.js'",
    )
    const result = evaluate({ functionFiles: files, functionEntrypointSources: sources })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.function_surface')).toMatchObject({
      status: 'malformed',
      reasonCode: 'CALLABLE_FUNCTION_SURFACE_FORBIDDEN',
      forbiddenSubjects: ['release-test-helper'],
    })
  })

  it('blocks a resolver exposed as a callable function', () => {
    const files = allFunctionFiles().add('production-item-resolver')
    const sources = allFunctionEntrypointSources().set(
      'production-item-resolver',
      "export { handler } from '../functions/production-item-resolver.js'",
    )
    const result = evaluate({ functionFiles: files, functionEntrypointSources: sources })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.function_surface')).toMatchObject({
      status: 'malformed',
      forbiddenSubjects: ['production-item-resolver'],
    })
  })

  it('blocks an entrypoint redirected to a broad resolver implementation', () => {
    const sources = allFunctionEntrypointSources()
    sources.set(
      'production-item-assessment',
      "export { handler } from '../functions/production-item-resolver.js'",
    )
    const result = evaluate({ functionEntrypointSources: sources })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.entrypoint_delegates')).toMatchObject({
      status: 'malformed',
      reasonCode: 'FUNCTION_ENTRYPOINT_DELEGATE_UNSAFE',
      invalidSubjects: ['production-item-assessment'],
    })
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

  it('fails closed when the scheduled entrypoint source contract is unavailable', () => {
    const result = evaluate({ scheduledFunctionContract: null })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.scheduled_cadence')).toMatchObject({
      status: 'malformed', reasonCode: 'SCHEDULE_CADENCE_WRONG',
    })
  })

  it('parses only the exact reviewed scheduled entrypoint source contract', () => {
    const exact = `export const STUDY_ADULT_REVIEW_SCHEDULE = Object.freeze({\n  scheduled: 'configured',\n  cadence: '*/5 * * * *',\n})`
    expect(parseStudyScheduledFunctionContract(exact)).toEqual({
      scheduled: 'configured', cadence: '*/5 * * * *',
    })
    expect(parseStudyScheduledFunctionContract(exact.replace('*/5', '*/10'))).toBeNull()
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

  it('blocks missing required deployment build configuration', () => {
    const source = validNetlifyConfig().replace('  command = "npm run build"\n', '')
    const result = evaluate({ netlifyToml: source })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.build_command')).toMatchObject({
      status: 'missing', reasonCode: 'BUILD_COMMAND_WRONG_OR_MISSING',
    })
  })

  it('blocks the wrong publish path', () => {
    const source = validNetlifyConfig().replace('publish = "dist"', 'publish = "public"')
    const result = evaluate({ netlifyToml: source })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.publish_directory')).toMatchObject({
      status: 'malformed', reasonCode: 'PUBLISH_DIRECTORY_WRONG_OR_MISSING',
    })
  })

  it('blocks a missing controlled Family Pilot branch assignment', () => {
    const source = validNetlifyConfig().replace(
      `[context."${EXPECTED_FAMILY_PILOT_CONTEXT}".environment]\n  VITE_FAMILY_PILOT_ENABLED = "true"\n`,
      '',
    )
    const result = evaluate({ netlifyToml: source })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.family_pilot_branch_context')).toMatchObject({
      status: 'missing', reasonCode: 'FAMILY_PILOT_BRANCH_CONTEXT_MISSING',
    })
  })

  it('blocks global Family Pilot enablement even when the named branch remains configured', () => {
    const source = validNetlifyConfig().replace(
      '  NODE_VERSION = "22"',
      '  NODE_VERSION = "22"\n  VITE_FAMILY_PILOT_ENABLED = "true"',
    )
    const result = evaluate({ netlifyToml: source })
    expect(result.overall).toBe('BLOCKED_BY_DEPLOYMENT_CONFIG')
    expect(byId(result, 'netlify.family_pilot_global_default_off')).toMatchObject({
      status: 'malformed', reasonCode: 'FAMILY_PILOT_GLOBALLY_CONFIGURED',
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

  it('reports the integrated repository schedule as ready with a complete fixture environment', async () => {
    const result = await runLocalStudyDeploymentPreflight({ env: readyEnvironment() })
    expect(result.overall).toBe('READY_FOR_DEPLOYMENT_ENVIRONMENT')
    expect(result.ready).toBe(true)
    expect(byId(result, 'netlify.scheduled_target')).toMatchObject({ status: 'present' })
    expect(byId(result, 'netlify.scheduled_function_file')).toMatchObject({ status: 'present' })
    expect(byId(result, 'netlify.function_surface')).toMatchObject({ status: 'present' })
    expect(byId(result, 'netlify.entrypoint_delegates')).toMatchObject({ status: 'present' })
    expect(byId(result, 'netlify.family_pilot_branch_context')).toMatchObject({ status: 'present' })
  })
})
