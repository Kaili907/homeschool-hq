import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ANTHROPIC_MODELS } from '../netlify/functions/_shared/anthropic-policy.js'
import { STUDY_ADULT_REVIEW_SCHEDULE } from '../netlify/functions/study-adult-review-scheduled-worker.js'

export const STUDY_DEPLOYMENT_PREFLIGHT_SCHEMA_VERSION = 1
export const STUDY_DEPLOYMENT_OUTCOMES = Object.freeze([
  'READY_FOR_DEPLOYMENT_ENVIRONMENT',
  'BLOCKED_BY_MISSING_ENV',
  'BLOCKED_BY_UNSAFE_ENV',
  'BLOCKED_BY_DEPLOYMENT_CONFIG',
])

export const STUDY_DEPLOYMENT_GATE_STATUSES = Object.freeze([
  'present',
  'missing',
  'malformed',
  'unsafe_client_exposure',
  'not_required',
  'unknown',
])

export const EXPECTED_STUDY_SCHEDULED_FUNCTION = 'study-adult-review-scheduled-worker'
export const STUDY_MANUAL_WORKER_FUNCTION = 'study-adult-review-worker'
export const EXPECTED_STUDY_SCHEDULE = '*/5 * * * *'
export const EXPECTED_NODE_VERSION = '22'
export const EXPECTED_STUDY_SAFETY_MODEL = 'claude-haiku-4-5'

const WORKER_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u
const SECRET_MIN_LENGTH = 32
const SECRET_MAX_LENGTH = 512
const SERVER_ONLY_ENV = Object.freeze([
  'SUPABASE_SERVICE_ROLE_KEY',
  'ACADEMY_STUDY_ENABLED',
  'STUDY_SAFETY_RATE_LIMIT_HMAC_KEY',
  'ANTHROPIC_API_KEY',
  'ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID',
  'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID',
  'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION',
  'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION',
  'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL',
  'ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET',
])

export const STUDY_DEPLOYMENT_ENV_INVENTORY = Object.freeze([
  Object.freeze({ name: 'VITE_STUDY_ENGINE_ENABLED', required: true, secret: false, role: 'client-feature-gate' }),
  Object.freeze({ name: 'ACADEMY_STUDY_ENABLED', required: true, secret: false, role: 'server-feature-gate' }),
  Object.freeze({ name: 'VITE_STUDY_ENGINE_PREVIEW', required: false, secret: false, role: 'development-only-gate' }),
  Object.freeze({ name: 'VITE_ALLOW_BROWSER_PROVIDER_KEYS', required: false, secret: false, role: 'local-only-provider-key-mode' }),
  Object.freeze({ name: 'VITE_SUPABASE_URL', required: true, secret: false, role: 'browser-supabase-url' }),
  Object.freeze({ name: 'VITE_SUPABASE_ANON_KEY', required: true, secret: false, role: 'browser-supabase-anon-key' }),
  Object.freeze({ name: 'SUPABASE_URL', required: true, secret: false, role: 'server-supabase-url' }),
  Object.freeze({ name: 'SUPABASE_ANON_KEY', required: false, secret: false, role: 'server-supabase-anon-key-override' }),
  Object.freeze({ name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, secret: true, role: 'durable-server-rpc-credential' }),
  Object.freeze({ name: 'STUDY_SAFETY_RATE_LIMIT_HMAC_KEY', required: true, secret: true, role: 'safety-correlation-key' }),
  Object.freeze({ name: 'ANTHROPIC_API_KEY', required: true, secret: true, role: 'study-safety-classifier-provider' }),
  Object.freeze({ name: 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID', required: true, secret: false, role: 'worker-identity' }),
  Object.freeze({ name: 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID', required: true, secret: false, role: 'worker-credential-id' }),
  Object.freeze({ name: 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION', required: true, secret: false, role: 'worker-credential-version' }),
  Object.freeze({ name: 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION', required: true, secret: false, role: 'worker-configuration-version' }),
  Object.freeze({ name: 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL', required: true, secret: true, role: 'worker-credential' }),
  Object.freeze({ name: 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET', required: true, secret: true, role: 'manual-worker-invocation-secret' }),
  Object.freeze({ name: 'VITE_USE_PROXY', required: true, secret: false, role: 'checked-in-production-provider-gate' }),
  Object.freeze({ name: 'NODE_VERSION', required: true, secret: false, role: 'checked-in-netlify-runtime-version' }),
])

const LIMITATIONS = Object.freeze([
  'Passing does not prove that Study migrations are applied to hosted Supabase.',
  'Passing does not prove that provider pricing is configured in the database.',
  'Passing does not prove that provider-attempt coverage is complete.',
  'Passing does not prove that production smoke tests pass.',
  'Runtime readiness and deployed function state are not contacted by this local static preflight.',
])

function value(env, name) {
  const candidate = env?.[name]
  return typeof candidate === 'string' ? candidate.trim() : ''
}

function gate({ id, category, subject, status, reasonCode, required = true, secret = false, remediation, ...detail }) {
  if (!STUDY_DEPLOYMENT_GATE_STATUSES.includes(status)) throw new TypeError('unsupported_preflight_gate_status')
  return Object.freeze({
    id,
    category,
    subject,
    status,
    reasonCode,
    required,
    secret,
    remediation,
    ...detail,
  })
}

function requiredPresenceGate(env, definition) {
  const configured = value(env, definition.name)
  const status = configured ? 'present' : 'missing'
  return gate({
    id: `env.${definition.name.toLowerCase()}`,
    category: definition.category ?? 'environment',
    subject: definition.name,
    status,
    reasonCode: configured ? 'REQUIRED_ENV_PRESENT' : 'REQUIRED_ENV_MISSING',
    secret: definition.secret === true,
    remediation: configured
      ? 'No action required.'
      : `Configure ${definition.name} in the production deployment environment.`,
  })
}

function explicitTrueGate(env, name, side) {
  const configured = value(env, name)
  const status = !configured ? 'missing' : configured === 'true' ? 'present' : 'malformed'
  return gate({
    id: `feature.${side}`,
    category: 'feature-gate',
    subject: name,
    status,
    reasonCode: status === 'present'
      ? 'FEATURE_GATE_EXPLICITLY_ENABLED'
      : status === 'missing'
        ? 'FEATURE_GATE_NOT_CONFIGURED'
        : 'FEATURE_GATE_NOT_EXACT_TRUE',
    remediation: status === 'present'
      ? 'No action required.'
      : `Set ${name} to the exact string true for the production deployment.`,
    codeDefault: 'disabled',
    environmentConfiguredState: status,
    runtimeReadiness: 'unknown',
  })
}

function validHttpsUrl(raw) {
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
  } catch {
    return false
  }
}

function normalizedUrl(raw) {
  try {
    return new URL(raw).toString().replace(/\/+$/u, '')
  } catch {
    return ''
  }
}

function urlGate(env, name, role) {
  const configured = value(env, name)
  const status = !configured ? 'missing' : validHttpsUrl(configured) ? 'present' : 'malformed'
  return gate({
    id: `env.${name.toLowerCase()}`,
    category: 'environment',
    subject: name,
    status,
    reasonCode: status === 'present'
      ? 'SUPABASE_HTTPS_URL_PRESENT'
      : status === 'missing'
        ? 'SUPABASE_URL_MISSING'
        : 'SUPABASE_URL_MALFORMED',
    remediation: status === 'present'
      ? 'No action required.'
      : `Configure ${name} as the credential-free HTTPS Supabase project URL.`,
    role,
  })
}

function workerReferenceGate(env, name) {
  const configured = value(env, name)
  const status = !configured ? 'missing' : WORKER_REF.test(configured) ? 'present' : 'malformed'
  return gate({
    id: `env.${name.toLowerCase()}`,
    category: 'worker',
    subject: name,
    status,
    reasonCode: status === 'present'
      ? 'WORKER_REFERENCE_PRESENT'
      : status === 'missing'
        ? 'WORKER_REFERENCE_MISSING'
        : 'WORKER_REFERENCE_MALFORMED',
    remediation: status === 'present'
      ? 'No action required.'
      : `Configure ${name} with the repository worker-reference format (1-160 safe reference characters).`,
  })
}

function boundedSecretGate(env, name, role) {
  const configured = value(env, name)
  const status = !configured
    ? 'missing'
    : configured.length >= SECRET_MIN_LENGTH && configured.length <= SECRET_MAX_LENGTH
      ? 'present'
      : 'malformed'
  return gate({
    id: `env.${name.toLowerCase()}`,
    category: 'worker',
    subject: name,
    status,
    reasonCode: status === 'present'
      ? 'BOUNDED_SECRET_PRESENT'
      : status === 'missing'
        ? 'BOUNDED_SECRET_MISSING'
        : 'BOUNDED_SECRET_LENGTH_INVALID',
    secret: true,
    remediation: status === 'present'
      ? 'No action required.'
      : `Configure ${name} as a 32-512 character server-only secret.`,
    role,
  })
}

/**
 * Parse only the checked-in Netlify string settings this preflight consumes.
 * Unknown TOML remains outside the result and is never echoed.
 */
export function parseNetlifyDeploymentConfig(source) {
  const build = {}
  const buildEnvironment = {}
  const functions = new Map()
  const redirects = []
  let target = null

  for (const rawLine of String(source ?? '').split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (line === '[build]') {
      target = build
      continue
    }
    if (line === '[build.environment]') {
      target = buildEnvironment
      continue
    }
    const functionSection = /^\[functions\."([A-Za-z0-9_-]+)"\]$/u.exec(line)
    if (functionSection) {
      const settings = {}
      functions.set(functionSection[1], settings)
      target = settings
      continue
    }
    if (line === '[[redirects]]') {
      const redirect = {}
      redirects.push(redirect)
      target = redirect
      continue
    }
    if (line.startsWith('[')) {
      target = null
      continue
    }
    const setting = /^([A-Za-z0-9_.-]+)\s*=\s*"([^"]*)"$/u.exec(line)
    if (target && setting) target[setting[1]] = setting[2]
  }
  return Object.freeze({ build, buildEnvironment, functions, redirects: Object.freeze(redirects) })
}

function referencedFunctionNames(config) {
  const names = new Set(config.functions.keys())
  for (const redirect of config.redirects) {
    const match = /^\/\.netlify\/functions\/([A-Za-z0-9_-]+)(?:\/|$)/u.exec(redirect.to ?? '')
    if (match) names.add(match[1])
  }
  return [...names].sort()
}

function netlifyGates(netlifyToml, functionFiles) {
  const config = parseNetlifyDeploymentConfig(netlifyToml)
  const scheduled = [...config.functions.entries()].filter(([, settings]) => typeof settings.schedule === 'string')
  const expected = config.functions.get(EXPECTED_STUDY_SCHEDULED_FUNCTION)
  const scheduledNames = scheduled.map(([name]) => name)
  const targetStatus = expected
    ? 'present'
    : scheduledNames.length > 0
      ? 'malformed'
      : 'missing'
  const missingFiles = referencedFunctionNames(config).filter((name) => !functionFiles.has(name))
  const scheduledFilePresent = functionFiles.has(EXPECTED_STUDY_SCHEDULED_FUNCTION)
  const expectedCadence = expected?.schedule
  const cadencePresent = expectedCadence === EXPECTED_STUDY_SCHEDULE &&
    STUDY_ADULT_REVIEW_SCHEDULE?.cadence === EXPECTED_STUDY_SCHEDULE &&
    STUDY_ADULT_REVIEW_SCHEDULE?.scheduled === 'configured'
  const manualScheduled = config.functions.get(STUDY_MANUAL_WORKER_FUNCTION)?.schedule !== undefined
  const scheduledRedirected = config.redirects.some((redirect) =>
    redirect.to === `/.netlify/functions/${EXPECTED_STUDY_SCHEDULED_FUNCTION}`)
  const proxyValue = config.buildEnvironment.VITE_USE_PROXY
  const nodeVersion = config.buildEnvironment.NODE_VERSION
  const functionsDirectory = config.build.functions

  return [
    gate({
      id: 'netlify.functions_directory', category: 'netlify', subject: 'build.functions',
      status: functionsDirectory === 'netlify/functions' ? 'present' : functionsDirectory ? 'malformed' : 'missing',
      reasonCode: functionsDirectory === 'netlify/functions' ? 'FUNCTIONS_DIRECTORY_CONFIGURED' : 'FUNCTIONS_DIRECTORY_INVALID',
      remediation: functionsDirectory === 'netlify/functions' ? 'No action required.' : 'Set build.functions to netlify/functions.',
    }),
    gate({
      id: 'netlify.scheduled_target', category: 'netlify', subject: EXPECTED_STUDY_SCHEDULED_FUNCTION,
      status: targetStatus,
      reasonCode: targetStatus === 'present'
        ? 'SCHEDULED_TARGET_PRESENT'
        : targetStatus === 'missing'
          ? 'SCHEDULED_TARGET_MISSING'
          : 'SCHEDULED_TARGET_WRONG',
      remediation: targetStatus === 'present'
        ? 'No action required.'
        : `Schedule only the dedicated ${EXPECTED_STUDY_SCHEDULED_FUNCTION} entrypoint for Study adult review.`,
    }),
    gate({
      id: 'netlify.scheduled_cadence', category: 'netlify', subject: EXPECTED_STUDY_SCHEDULE,
      status: expectedCadence === undefined ? 'missing' : cadencePresent ? 'present' : 'malformed',
      reasonCode: cadencePresent ? 'SCHEDULE_CADENCE_EXACT' : expectedCadence === undefined ? 'SCHEDULE_CADENCE_MISSING' : 'SCHEDULE_CADENCE_WRONG',
      remediation: cadencePresent ? 'No action required.' : `Set the dedicated scheduled worker cadence to exactly ${EXPECTED_STUDY_SCHEDULE}.`,
    }),
    gate({
      id: 'netlify.manual_worker_not_scheduled', category: 'netlify', subject: STUDY_MANUAL_WORKER_FUNCTION,
      status: manualScheduled ? 'malformed' : 'present',
      reasonCode: manualScheduled ? 'MANUAL_WORKER_ACCIDENTALLY_SCHEDULED' : 'MANUAL_WORKER_NOT_SCHEDULED',
      remediation: manualScheduled ? 'Remove schedule configuration from the public/manual worker.' : 'No action required.',
    }),
    gate({
      id: 'netlify.scheduled_function_private', category: 'netlify', subject: EXPECTED_STUDY_SCHEDULED_FUNCTION,
      status: scheduledRedirected ? 'malformed' : 'present',
      reasonCode: scheduledRedirected ? 'SCHEDULED_FUNCTION_PUBLICLY_REDIRECTED' : 'SCHEDULED_FUNCTION_NOT_REDIRECTED',
      remediation: scheduledRedirected ? 'Remove the public redirect to the scheduled worker.' : 'No action required.',
    }),
    gate({
      id: 'netlify.scheduled_function_file', category: 'netlify', subject: `${EXPECTED_STUDY_SCHEDULED_FUNCTION}.js`,
      status: scheduledFilePresent ? 'present' : 'missing',
      reasonCode: scheduledFilePresent ? 'SCHEDULED_FUNCTION_FILE_PRESENT' : 'SCHEDULED_FUNCTION_FILE_MISSING',
      remediation: scheduledFilePresent ? 'No action required.' : 'Restore the dedicated scheduled function file before deployment.',
    }),
    gate({
      id: 'netlify.referenced_function_files', category: 'netlify', subject: 'referenced Netlify function files',
      status: missingFiles.length === 0 ? 'present' : 'missing',
      reasonCode: missingFiles.length === 0 ? 'REFERENCED_FUNCTION_FILES_PRESENT' : 'REFERENCED_FUNCTION_FILE_MISSING',
      remediation: missingFiles.length === 0
        ? 'No action required.'
        : `Restore the referenced function file(s): ${missingFiles.join(', ')}.`,
      missingSubjects: Object.freeze(missingFiles),
    }),
    gate({
      id: 'netlify.provider_proxy_gate', category: 'netlify', subject: 'VITE_USE_PROXY',
      status: proxyValue === 'true' ? 'present' : proxyValue === undefined ? 'missing' : 'malformed',
      reasonCode: proxyValue === 'true' ? 'PRODUCTION_PROXY_EXPLICITLY_ENABLED' : 'PRODUCTION_PROXY_NOT_EXACT_TRUE',
      remediation: proxyValue === 'true' ? 'No action required.' : 'Set build.environment.VITE_USE_PROXY to the exact string true.',
    }),
    gate({
      id: 'netlify.node_version', category: 'netlify', subject: 'NODE_VERSION',
      status: nodeVersion === EXPECTED_NODE_VERSION ? 'present' : nodeVersion === undefined ? 'missing' : 'malformed',
      reasonCode: nodeVersion === EXPECTED_NODE_VERSION ? 'NODE_VERSION_EXACT' : 'NODE_VERSION_WRONG_OR_MISSING',
      remediation: nodeVersion === EXPECTED_NODE_VERSION ? 'No action required.' : `Pin build.environment.NODE_VERSION to ${EXPECTED_NODE_VERSION}.`,
      expectedVersion: EXPECTED_NODE_VERSION,
    }),
  ]
}

function environmentGates(env) {
  const gates = [
    explicitTrueGate(env, 'VITE_STUDY_ENGINE_ENABLED', 'client-study-enabled'),
    explicitTrueGate(env, 'ACADEMY_STUDY_ENABLED', 'server-study-enabled'),
    urlGate(env, 'VITE_SUPABASE_URL', 'browser'),
    requiredPresenceGate(env, { name: 'VITE_SUPABASE_ANON_KEY' }),
    urlGate(env, 'SUPABASE_URL', 'server'),
  ]

  const preview = value(env, 'VITE_STUDY_ENGINE_PREVIEW')
  gates.push(gate({
    id: 'feature.production-preview-disabled',
    category: 'feature-gate',
    subject: 'VITE_STUDY_ENGINE_PREVIEW',
    status: !preview ? 'not_required' : preview === 'false' ? 'present' : 'malformed',
    reasonCode: !preview
      ? 'PRODUCTION_PREVIEW_GATE_DEFAULT_DISABLED'
      : preview === 'false'
        ? 'PRODUCTION_PREVIEW_GATE_EXPLICITLY_DISABLED'
        : 'PRODUCTION_PREVIEW_GATE_INVALID',
    required: false,
    remediation: !preview || preview === 'false'
      ? 'No action required.'
      : 'Remove the development-only preview gate from production or set it to false.',
    codeDefault: 'disabled',
    environmentConfiguredState: !preview ? 'not_required' : preview === 'false' ? 'present' : 'malformed',
    runtimeReadiness: 'unknown',
  }))

  const serverAnon = value(env, 'SUPABASE_ANON_KEY')
  gates.push(gate({
    id: 'env.supabase_anon_key',
    category: 'environment',
    subject: 'SUPABASE_ANON_KEY',
    status: serverAnon ? 'present' : 'not_required',
    reasonCode: serverAnon ? 'SERVER_ANON_KEY_OVERRIDE_PRESENT' : 'SERVER_ANON_KEY_USES_VITE_FALLBACK',
    required: false,
    remediation: 'No action required; server code accepts VITE_SUPABASE_ANON_KEY as the public fallback.',
  }))

  gates.push(requiredPresenceGate(env, { name: 'SUPABASE_SERVICE_ROLE_KEY', secret: true }))
  gates.push(requiredPresenceGate(env, { name: 'STUDY_SAFETY_RATE_LIMIT_HMAC_KEY', secret: true, category: 'provider-safety' }))
  gates.push(requiredPresenceGate(env, { name: 'ANTHROPIC_API_KEY', secret: true, category: 'provider-safety' }))

  for (const name of [
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID',
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID',
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION',
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION',
  ]) gates.push(workerReferenceGate(env, name))

  gates.push(boundedSecretGate(env, 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL', 'scheduled-and-durable-worker'))
  gates.push(boundedSecretGate(env, 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET', 'manual-worker-invocation'))

  const clientUrl = value(env, 'VITE_SUPABASE_URL')
  const serverUrl = value(env, 'SUPABASE_URL')
  const urlsMatch = validHttpsUrl(clientUrl) && validHttpsUrl(serverUrl) && normalizedUrl(clientUrl) === normalizedUrl(serverUrl)
  gates.push(gate({
    id: 'env.supabase_project_alignment', category: 'environment', subject: 'browser/server Supabase URL alignment',
    status: !clientUrl || !serverUrl ? 'missing' : urlsMatch ? 'present' : 'malformed',
    reasonCode: urlsMatch ? 'SUPABASE_PROJECT_URLS_ALIGNED' : !clientUrl || !serverUrl ? 'SUPABASE_PROJECT_URL_ALIGNMENT_UNAVAILABLE' : 'SUPABASE_PROJECT_URLS_MISMATCH',
    remediation: urlsMatch ? 'No action required.' : 'Configure the browser and server Supabase URLs for the same exact HTTPS project endpoint.',
  }))

  const clientAnon = value(env, 'VITE_SUPABASE_ANON_KEY')
  const anonAligned = !serverAnon || !clientAnon || serverAnon === clientAnon
  gates.push(gate({
    id: 'env.supabase_anon_key_alignment', category: 'environment', subject: 'browser/server Supabase anon-key alignment',
    status: !clientAnon ? 'missing' : anonAligned ? 'present' : 'malformed',
    reasonCode: !clientAnon ? 'SUPABASE_ANON_KEY_ALIGNMENT_UNAVAILABLE' : anonAligned ? 'SUPABASE_ANON_KEYS_ALIGNED' : 'SUPABASE_ANON_KEYS_MISMATCH',
    remediation: !clientAnon || !anonAligned ? 'Configure the browser and optional server anon-key settings for the same Supabase project.' : 'No action required.',
  }))

  return gates
}

function exposureGates(env) {
  const gates = SERVER_ONLY_ENV.map((serverName) => {
    const exposedName = `VITE_${serverName}`
    const exposed = value(env, exposedName) !== ''
    return gate({
      id: `client-exposure.${serverName.toLowerCase()}`,
      category: 'client-exposure',
      subject: exposedName,
      status: exposed ? 'unsafe_client_exposure' : 'not_required',
      reasonCode: exposed ? 'SERVER_ONLY_ENV_EXPOSED_TO_CLIENT' : 'SERVER_ONLY_ENV_NOT_CLIENT_EXPOSED',
      required: false,
      secret: serverName.includes('KEY') || serverName.includes('SECRET') || serverName.endsWith('CREDENTIAL'),
      remediation: exposed ? `Remove ${exposedName} from every client-facing deployment scope.` : 'No action required.',
    })
  })
  const browserKeysRequested = value(env, 'VITE_ALLOW_BROWSER_PROVIDER_KEYS') === 'true'
  gates.push(gate({
    id: 'client-exposure.browser-provider-key-mode',
    category: 'client-exposure',
    subject: 'VITE_ALLOW_BROWSER_PROVIDER_KEYS',
    status: browserKeysRequested ? 'unsafe_client_exposure' : 'not_required',
    reasonCode: browserKeysRequested ? 'BROWSER_PROVIDER_KEY_MODE_REQUESTED' : 'BROWSER_PROVIDER_KEY_MODE_NOT_REQUESTED',
    required: false,
    remediation: browserKeysRequested ? 'Remove the local-only browser provider-key request from the production environment.' : 'No action required.',
  }))
  return gates
}

function contractGates() {
  const providerPinned = ANTHROPIC_MODELS?.haiku === EXPECTED_STUDY_SAFETY_MODEL &&
    !/latest/iu.test(ANTHROPIC_MODELS?.haiku ?? '')
  return [
    gate({
      id: 'provider.study_safety_model', category: 'provider-safety', subject: 'Anthropic Study safety model contract',
      status: providerPinned ? 'present' : 'malformed',
      reasonCode: providerPinned ? 'PROVIDER_MODEL_VERSION_PINNED' : 'PROVIDER_MODEL_VERSION_NOT_PINNED',
      remediation: providerPinned ? 'No action required.' : `Restore the reviewed Study safety model contract to ${EXPECTED_STUDY_SAFETY_MODEL}; do not use latest.`,
      expectedVersion: EXPECTED_STUDY_SAFETY_MODEL,
    }),
    gate({
      id: 'scope.runtime_readiness', category: 'scope', subject: 'hosted runtime readiness',
      status: 'unknown', reasonCode: 'LOCAL_PREFLIGHT_DOES_NOT_CONTACT_HOSTED_RUNTIME', required: false,
      remediation: 'Run the separately authorized hosted readiness and production smoke phases after deployment.',
    }),
    gate({
      id: 'scope.provider_pricing', category: 'scope', subject: 'provider pricing terms',
      status: 'unknown', reasonCode: 'PROVIDER_PRICING_IS_DATABASE_AUTHORITY', required: false,
      remediation: 'Validate pricing through the separate Admin/database authority phase.',
    }),
  ]
}

function overallFor(gates) {
  if (gates.some((item) => item.status === 'unsafe_client_exposure')) return 'BLOCKED_BY_UNSAFE_ENV'
  if (gates.some((item) => item.category === 'netlify' && ['missing', 'malformed'].includes(item.status))) {
    return 'BLOCKED_BY_DEPLOYMENT_CONFIG'
  }
  if (gates.some((item) => item.required && ['missing', 'malformed'].includes(item.status))) {
    return 'BLOCKED_BY_MISSING_ENV'
  }
  if (gates.some((item) => item.category !== 'netlify' && item.status === 'malformed')) {
    return 'BLOCKED_BY_MISSING_ENV'
  }
  return 'READY_FOR_DEPLOYMENT_ENVIRONMENT'
}

export function evaluateStudyDeploymentPreflight({ env = {}, netlifyToml = '', functionFiles = new Set() } = {}) {
  const files = functionFiles instanceof Set ? functionFiles : new Set(functionFiles)
  const gates = Object.freeze([
    ...environmentGates(env),
    ...exposureGates(env),
    ...netlifyGates(netlifyToml, files),
    ...contractGates(),
  ])
  const overall = overallFor(gates)
  return Object.freeze({
    schemaVersion: STUDY_DEPLOYMENT_PREFLIGHT_SCHEMA_VERSION,
    preflight: 'study-production-deployment-environment',
    scope: 'local-static-configuration-only',
    overall,
    ready: overall === 'READY_FOR_DEPLOYMENT_ENVIRONMENT',
    inventory: STUDY_DEPLOYMENT_ENV_INVENTORY,
    gates,
    limitations: LIMITATIONS,
  })
}

export function serializeStudyDeploymentPreflight(result) {
  return `${JSON.stringify(result, null, 2)}\n`
}

export function formatStudyDeploymentPreflight(result) {
  const lines = [
    'Study production deployment environment preflight',
    `Overall: ${result.overall}`,
    'Scope: local static configuration only; no hosted service was contacted.',
    '',
    'Gates:',
  ]
  for (const item of result.gates) {
    lines.push(`- [${item.status}] ${item.id} (${item.reasonCode}) — ${item.remediation}`)
  }
  lines.push('', 'Limitations:')
  for (const limitation of result.limitations) lines.push(`- ${limitation}`)
  return `${lines.join('\n')}\n`
}

export async function runLocalStudyDeploymentPreflight({ rootDirectory = process.cwd(), env = process.env } = {}) {
  let netlifyToml = ''
  let entries = []
  try {
    netlifyToml = await readFile(resolve(rootDirectory, 'netlify.toml'), 'utf8')
  } catch {
    // Missing configuration is represented by deterministic missing gates.
  }
  try {
    entries = await readdir(resolve(rootDirectory, 'netlify/functions'), { withFileTypes: true })
  } catch {
    // Missing function directory is represented by deterministic missing gates.
  }
  const functionFiles = new Set(entries.flatMap((entry) => {
    if (entry.isDirectory()) return [entry.name]
    const match = /^(.+)\.(?:js|mjs|ts)$/u.exec(entry.name)
    return match ? [match[1]] : []
  }))
  return evaluateStudyDeploymentPreflight({ env, netlifyToml, functionFiles })
}

function argumentValue(args, flag) {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

async function main() {
  const args = process.argv.slice(2)
  const format = argumentValue(args, '--format') ?? 'operator'
  const rootDirectory = resolve(argumentValue(args, '--root') ?? process.cwd())
  if (!['json', 'operator'].includes(format)) {
    throw new Error('Usage: study-deployment-env-preflight [--format json|operator] [--root <path>]')
  }
  const result = await runLocalStudyDeploymentPreflight({ rootDirectory })
  process.stdout.write(format === 'json'
    ? serializeStudyDeploymentPreflight(result)
    : formatStudyDeploymentPreflight(result))
  if (!result.ready) process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'study_deployment_preflight_failed'}\n`)
    process.exitCode = 1
  })
}
