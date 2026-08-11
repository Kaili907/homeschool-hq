import { resolveAdminMonthlyCostWindow } from '../admin-monthly-cost-alert.js'

export const PRODUCTION_READINESS_SCHEMA_VERSION = 1
export const READINESS_STATUSES = Object.freeze([
  'READY',
  'BLOCKED',
  'PARTIAL',
  'UNVERIFIED',
  'NOT_APPLICABLE',
  'UNAVAILABLE',
])
export const READINESS_EVIDENCE_STATUSES = Object.freeze([
  'VERIFIED',
  'REPORTED',
  'UNVERIFIED',
  'MISMATCH',
  'UNAVAILABLE',
])

const POSITIVE = new Set(['1', 'true', 'on', 'enabled'])
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/
const MIGRATION_VERSION = /^\d{14}$/
const INTEGER_MICROS = /^(0|[1-9][0-9]*)$/
const PROVIDER_ENGINE_KEYS = Object.freeze(['tutor', 'jarvis', 'tts', 'study'])
const PROVIDER_JOURNAL_STATUSES = new Set([
  'complete_for_journaled_attempts',
  'partial',
  'gaps_detected',
  'reconciliation_conflict',
  'insufficient_evidence',
  'unavailable',
])
const MONTHLY_ALERT_STATUSES = new Set(['normal', 'warning', 'critical', 'partial', 'unavailable'])
const MONTHLY_ALERT_COMPLETENESS = new Set(['complete', 'partial', 'unavailable'])

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function positiveFlag(env, name) {
  const value = env?.[name]
  return typeof value === 'string' && POSITIVE.has(value.toLowerCase())
}

function present(env, names) {
  return names.some((name) => typeof env?.[name] === 'string' && env[name].trim() !== '')
}

function evidence(source, status) {
  return Object.freeze({ source, status })
}

function observation(label, status) {
  return Object.freeze({ label, status })
}

function check({ id, title, status, required = true, summary, action = null, source, evidenceStatus, observations = [] }) {
  return Object.freeze({
    id,
    title,
    status,
    required,
    summary,
    action,
    evidence: evidence(source, evidenceStatus),
    observations: Object.freeze(observations),
  })
}

function domainStatus(checks) {
  const required = checks.filter((item) => item.required)
  if (required.some((item) => item.status === 'BLOCKED')) return 'BLOCKED'
  if (required.some((item) => item.status === 'UNVERIFIED')) return 'UNVERIFIED'
  if (required.some((item) => item.status === 'UNAVAILABLE')) return 'UNAVAILABLE'
  if (required.some((item) => item.status === 'PARTIAL')) return 'PARTIAL'
  if (required.some((item) => !['READY', 'NOT_APPLICABLE'].includes(item.status))) return 'BLOCKED'
  if (checks.some((item) => ['BLOCKED', 'PARTIAL', 'UNVERIFIED', 'UNAVAILABLE'].includes(item.status))) {
    return 'PARTIAL'
  }
  return 'READY'
}

function domain(id, label, summary, checks) {
  return Object.freeze({
    id,
    label,
    status: domainStatus(checks),
    summary,
    checks: Object.freeze(checks),
  })
}

async function settle(probe, context) {
  if (typeof probe !== 'function') return Object.freeze({ ok: false, value: null })
  try {
    const isolatedContext = context === undefined ? undefined : Object.freeze({
      observedAt: new Date(context.observedAt.valueOf()),
      generatedAt: context.generatedAt,
    })
    return Object.freeze({ ok: true, value: await probe(isolatedContext) })
  } catch {
    return Object.freeze({ ok: false, value: null })
  }
}

function repositoryResult(result) {
  const source = result.ok && result.value && typeof result.value === 'object' ? result.value : null
  const migrations = source?.migrations
  const curriculum = source?.curriculum
  const releaseControls = source?.releaseControls
  const validSource = exactKeys(source, ['migrations', 'curriculum', 'releaseControls'])
  const validMigrations = validSource
    && exactKeys(migrations, [
      'state', 'migrationCount', 'manifestCount', 'collisionVersions',
      'orderingHazardCount', 'hashMismatchCount',
    ])
    && (migrations.state === 'ready' || migrations.state === 'blocked')
    && Number.isSafeInteger(migrations.migrationCount) && migrations.migrationCount >= 0
    && Number.isSafeInteger(migrations.manifestCount) && migrations.manifestCount >= 0
    && Array.isArray(migrations.collisionVersions)
    && migrations.collisionVersions.every((version) => MIGRATION_VERSION.test(version))
    && Number.isSafeInteger(migrations.orderingHazardCount) && migrations.orderingHazardCount >= 0
    && Number.isSafeInteger(migrations.hashMismatchCount) && migrations.hashMismatchCount >= 0
    && (migrations.state !== 'ready'
      || (migrations.manifestCount === migrations.migrationCount
        && migrations.collisionVersions.length === 0
        && migrations.orderingHazardCount === 0
        && migrations.hashMismatchCount === 0))
  const validCurriculum = validSource
    && exactKeys(curriculum, ['state', 'activeVersion', 'registeredReleaseCount', 'validationState'])
    && (curriculum.state === 'ready' || curriculum.state === 'blocked')
    && VERSION.test(curriculum.activeVersion)
    && Number.isSafeInteger(curriculum.registeredReleaseCount)
    && curriculum.registeredReleaseCount >= 1
    && (curriculum.validationState === 'passed' || curriculum.validationState === 'failed')
  const validReleaseControls = validSource
    && exactKeys(releaseControls, [
      'state', 'registry', 'staging', 'integrity', 'publishing', 'activationRollback',
    ])
    && (releaseControls.state === 'ready' || releaseControls.state === 'blocked')
    && ['registry', 'staging', 'integrity', 'publishing', 'activationRollback']
      .every((key) => typeof releaseControls[key] === 'boolean')
    && (releaseControls.state === 'ready') === [
      releaseControls.registry,
      releaseControls.staging,
      releaseControls.integrity,
      releaseControls.publishing,
      releaseControls.activationRollback,
    ].every(Boolean)
  return Object.freeze({
    migrations: validMigrations ? migrations : null,
    curriculum: validCurriculum ? curriculum : null,
    releaseControls: validReleaseControls ? releaseControls : null,
  })
}

function configurationResult(result) {
  const value = result.ok && result.value && typeof result.value === 'object' ? result.value : null
  if (!exactKeys(value, [
    'state', 'aiRequested', 'aiEffective', 'ttsRequested', 'ttsEffective',
    'activeVoiceCount', 'deployableVoiceCount',
  ])
    || !['ready', 'partial'].includes(value.state)
    || typeof value.aiRequested !== 'boolean'
    || typeof value.aiEffective !== 'boolean'
    || typeof value.ttsRequested !== 'boolean'
    || typeof value.ttsEffective !== 'boolean'
    || !Number.isSafeInteger(value.activeVoiceCount) || value.activeVoiceCount < 0
    || !Number.isSafeInteger(value.deployableVoiceCount) || value.deployableVoiceCount < 0
    || value.deployableVoiceCount > value.activeVoiceCount) return null
  return value
}

function hostedMigrationCheck(result) {
  const value = result.ok && result.value && typeof result.value === 'object' ? result.value : null
  const state = exactKeys(value, ['state']) ? value.state : null
  if (state === 'verified') return check({
    id: 'database.hosted_migrations',
    title: 'Hosted migration state',
    status: 'READY',
    summary: 'Authoritative read-only evidence matches the repository migration manifest.',
    source: 'Hosted migration evidence',
    evidenceStatus: 'VERIFIED',
  })
  if (state === 'mismatch') return check({
    id: 'database.hosted_migrations',
    title: 'Hosted migration state',
    status: 'BLOCKED',
    summary: 'Authoritative evidence does not match the expected repository migration state.',
    action: 'Reconcile the mismatch through a separately governed migration card; do not apply from this center.',
    source: 'Hosted migration evidence',
    evidenceStatus: 'MISMATCH',
  })
  return check({
    id: 'database.hosted_migrations',
    title: 'Hosted migration state',
    status: 'UNVERIFIED',
    summary: 'No safe authoritative hosted migration evidence was supplied. Hosted state was not queried.',
    action: 'Provide approved read-only evidence from a compatible authoritative source.',
    source: 'Hosted infrastructure not contacted',
    evidenceStatus: 'UNVERIFIED',
  })
}

function environmentChecks(env, configuration) {
  const requirements = [
    { label: 'Application build identity', names: ['ACADEMY_APP_VERSION', 'COMMIT_REF', 'DEPLOY_ID'] },
    { label: 'Supabase URL', names: ['SUPABASE_URL', 'VITE_SUPABASE_URL'] },
    { label: 'Supabase anonymous key', names: ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'] },
    { label: 'Supabase service role key', names: ['SUPABASE_SERVICE_ROLE_KEY'] },
    { label: 'Gateway-only browser policy', names: ['VITE_USE_PROXY'] },
    { label: 'Study server enablement', names: ['ACADEMY_STUDY_ENABLED'] },
    { label: 'Study browser mount enablement', names: ['VITE_STUDY_ENGINE_ENABLED'] },
  ]
  const studyEnabled = positiveFlag(env, 'ACADEMY_STUDY_ENABLED')
    && positiveFlag(env, 'VITE_STUDY_ENGINE_ENABLED')
  if (studyEnabled) {
    requirements.push(
      { label: 'Study rate-limit signing key', names: ['STUDY_SAFETY_RATE_LIMIT_HMAC_KEY'] },
      { label: 'Study worker credential', names: ['ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL'] },
      { label: 'Study worker credential version', names: ['ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION'] },
      { label: 'Study worker identity', names: ['ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID'] },
      { label: 'Study worker configuration version', names: ['ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION'] },
    )
  }
  if (configuration?.aiRequested === true || studyEnabled) {
    requirements.push(
      { label: 'AI deployment enablement', names: ['ACADEMY_AI_ENABLED'] },
      { label: 'AI provider credential', names: ['ANTHROPIC_API_KEY'] },
    )
  }
  if (configuration?.ttsRequested === true) {
    requirements.push(
      { label: 'TTS deployment enablement', names: ['ACADEMY_TTS_ENABLED'] },
      { label: 'TTS provider credential', names: ['ELEVENLABS_API_KEY'] },
      { label: 'TTS voice allowlist', names: ['ELEVENLABS_ALLOWED_VOICE_IDS'] },
    )
  }
  const observations = requirements.map(({ label, names }) => observation(
    label,
    present(env, names) ? 'present' : 'missing',
  ))
  if (!configuration) {
    observations.push(
      observation('Conditional AI provider requirements', 'not_checked'),
      observation('Conditional TTS provider requirements', 'not_checked'),
    )
  }
  const missing = observations.filter((item) => item.status === 'missing').length
  const notChecked = observations.filter((item) => item.status === 'not_checked').length
  return check({
    id: 'deployment.environment',
    title: 'Required environment-variable presence',
    status: missing > 0 ? 'BLOCKED' : notChecked > 0 ? 'UNVERIFIED' : 'READY',
    summary: missing > 0
      ? `${missing} required environment entr${missing === 1 ? 'y is' : 'ies are'} missing.`
      : notChecked > 0
        ? 'Base requirements are present, but conditional provider requirements could not be determined.'
        : 'Every applicable required environment entry is present.',
    action: missing > 0 ? 'Set the missing deployment entries through the governed hosting configuration workflow.' : null,
    source: 'Server environment presence only',
    evidenceStatus: missing > 0 ? 'MISMATCH' : notChecked > 0 ? 'UNVERIFIED' : 'VERIFIED',
    observations,
  })
}

function configurationChecks(configuration) {
  if (!configuration) {
    return [
      check({
        id: 'application.runtime_configuration', title: 'Effective Admin runtime configuration',
        status: 'UNAVAILABLE', summary: 'The saved and effective runtime configuration could not be read safely.',
        action: 'Restore the authorized read projection and retry.', source: 'Admin runtime configuration', evidenceStatus: 'UNAVAILABLE',
      }),
      check({
        id: 'ai_tts.ai_state', title: 'Effective AI state', status: 'UNAVAILABLE',
        summary: 'AI enablement could not be established from authoritative configuration.',
        source: 'Admin runtime configuration', evidenceStatus: 'UNAVAILABLE',
      }),
      check({
        id: 'ai_tts.tts_state', title: 'Effective TTS state', status: 'UNAVAILABLE',
        summary: 'TTS enablement and fallback state could not be established.',
        source: 'Admin runtime configuration', evidenceStatus: 'UNAVAILABLE',
      }),
      check({
        id: 'ai_tts.voice_catalog', title: 'Logical voice catalog deployability', status: 'UNVERIFIED',
        summary: 'Voice catalog applicability could not be determined.',
        source: 'Logical TTS catalog', evidenceStatus: 'UNVERIFIED',
      }),
    ]
  }
  const configurationCheck = check({
    id: 'application.runtime_configuration',
    title: 'Effective Admin runtime configuration',
    status: configuration.state === 'ready' ? 'READY' : 'PARTIAL',
    summary: configuration.state === 'ready'
      ? 'Every required saved setting has an authoritative effective runtime state.'
      : 'The effective projection is available, but some settings are not yet runtime-enforceable.',
    action: configuration.state === 'partial'
      ? 'Complete the separately governed runtime integrations before production activation.' : null,
    source: 'Admin runtime configuration',
    evidenceStatus: configuration.state === 'ready' ? 'VERIFIED' : 'REPORTED',
  })
  const aiConsistent = configuration.aiRequested === configuration.aiEffective
  const aiCheck = check({
    id: 'ai_tts.ai_state', title: 'Effective AI state',
    status: aiConsistent ? 'READY' : 'BLOCKED',
    summary: aiConsistent
      ? configuration.aiEffective
        ? 'AI is enabled by both saved policy and the deployment boundary.'
        : 'AI is authoritatively disabled and cannot be mistaken for an enabled provider path.'
      : 'Saved AI intent and effective deployment state do not agree.',
    action: aiConsistent ? null : 'Reconcile saved policy and deployment constraints through configuration governance.',
    source: 'Effective AI configuration', evidenceStatus: aiConsistent ? 'VERIFIED' : 'MISMATCH',
  })
  const ttsStatus = configuration.ttsRequested === configuration.ttsEffective
    ? 'READY' : configuration.ttsRequested ? 'UNAVAILABLE' : 'BLOCKED'
  const ttsCheck = check({
    id: 'ai_tts.tts_state', title: 'Effective TTS state', status: ttsStatus,
    summary: ttsStatus === 'READY'
      ? configuration.ttsEffective
        ? 'TTS is enabled with a deployable logical voice path.'
        : 'TTS is authoritatively disabled; browser speech remains a non-provider fallback.'
      : configuration.ttsRequested
        ? 'TTS is requested but only an unavailable or browser-speech fallback path is effective.'
        : 'The effective TTS state conflicts with saved policy.',
    action: ttsStatus === 'READY' ? null : 'Supply an approved deployable logical voice or disable saved TTS intent.',
    source: 'Effective TTS configuration', evidenceStatus: ttsStatus === 'READY' ? 'VERIFIED' : 'MISMATCH',
  })
  const catalogApplicable = configuration.ttsRequested
  const catalogReady = configuration.activeVoiceCount > 0 && configuration.deployableVoiceCount > 0
  const voiceCheck = check({
    id: 'ai_tts.voice_catalog', title: 'Logical voice catalog deployability',
    required: catalogApplicable,
    status: !catalogApplicable ? 'NOT_APPLICABLE' : catalogReady ? 'READY' : 'UNAVAILABLE',
    summary: !catalogApplicable
      ? 'No provider voice is required while saved TTS intent is disabled.'
      : catalogReady
        ? 'At least one active approved logical voice is deployable.'
        : 'No active approved logical voice can be deployed.',
    action: catalogApplicable && !catalogReady
      ? 'Approve and configure a logical catalog entry through a separate governed card.' : null,
    source: 'Logical TTS catalog', evidenceStatus: !catalogApplicable ? 'REPORTED' : catalogReady ? 'VERIFIED' : 'UNAVAILABLE',
  })
  return [configurationCheck, aiCheck, ttsCheck, voiceCheck]
}

function probeAvailability({ result, id, title, source, unavailableSummary, action }) {
  const state = result.ok && exactKeys(result.value, ['state']) ? result.value.state : null
  const available = state === 'available'
  return check({
    id, title,
    status: available ? 'READY' : 'UNAVAILABLE',
    summary: available ? `${title} is available through its bounded read contract.` : unavailableSummary,
    action: available ? null : action,
    source,
    evidenceStatus: available ? 'VERIFIED' : 'UNAVAILABLE',
  })
}

function providerAccountingCheck(result) {
  const value = result.ok && result.value && typeof result.value === 'object'
    ? result.value : null
  const instrumentation = value?.providerInstrumentation
  const engines = instrumentation?.engines
  const structurallyValid = exactKeys(value, [
    'status', 'journalStatus', 'reconciliationState', 'providerInstrumentation',
    'invoiceCompletenessClaim', 'metrics', 'breakdowns',
  ])
    && exactKeys(instrumentation, ['status', 'engines'])
    && ['complete', 'partial'].includes(instrumentation.status)
    && Array.isArray(engines)
    && engines.length <= PROVIDER_ENGINE_KEYS.length
    && engines.every((engine) => exactKeys(engine, ['key', 'status'])
      && PROVIDER_ENGINE_KEYS.includes(engine.key)
      && ['covered', 'pending'].includes(engine.status))
    && new Set(engines.map((engine) => engine.key)).size === engines.length
    && PROVIDER_JOURNAL_STATUSES.has(value?.journalStatus)
    && typeof value?.reconciliationState === 'string'
    && typeof value?.invoiceCompletenessClaim === 'boolean'

  if (!structurallyValid) return check({
    id: 'telemetry.provider_accounting', title: 'Provider accounting instrumentation',
    status: 'UNAVAILABLE',
    summary: 'The bounded provider-attempt coverage contract is unavailable or malformed.',
    action: 'Restore the privacy-minimized provider-attempt coverage projection and retry.',
    source: 'Provider attempt coverage contract', evidenceStatus: 'UNAVAILABLE',
  })

  if (value.invoiceCompletenessClaim !== false) return check({
    id: 'telemetry.provider_accounting', title: 'Provider accounting instrumentation',
    status: 'BLOCKED',
    summary: 'The accounting projection made an unsupported provider-invoice completeness claim.',
    action: 'Restore the explicit false invoice-completeness boundary before production activation.',
    source: 'Provider attempt coverage contract', evidenceStatus: 'MISMATCH',
  })

  const completeInstrumentation = instrumentation.status === 'complete'
    && engines.length === PROVIDER_ENGINE_KEYS.length
    && PROVIDER_ENGINE_KEYS.every((key) => engines.some((engine) =>
      engine.key === key && engine.status === 'covered'))
  if (!completeInstrumentation) return check({
    id: 'telemetry.provider_accounting', title: 'Provider accounting instrumentation',
    status: 'BLOCKED',
    summary: 'Tutor, Jarvis, premium TTS, and Study safety are not all covered by the current-path instrumentation contract.',
    action: 'Complete every known external provider-attempt path before production activation.',
    source: 'Provider attempt coverage contract', evidenceStatus: 'MISMATCH',
  })

  if (value.journalStatus === 'unavailable') return check({
    id: 'telemetry.provider_accounting', title: 'Provider accounting instrumentation',
    status: 'UNAVAILABLE',
    summary: 'Current-path instrumentation is complete, but bounded journal evidence is unavailable.',
    action: 'Restore the provider-attempt coverage read without weakening the instrumentation contract.',
    source: 'Provider attempt coverage contract', evidenceStatus: 'UNAVAILABLE',
  })
  if (value.journalStatus === 'partial') return check({
    id: 'telemetry.provider_accounting', title: 'Provider accounting instrumentation',
    status: 'PARTIAL',
    summary: 'All current provider paths are instrumented, but some bounded-window attempts have not reached terminal accounting state.',
    action: 'Allow or reconcile the in-progress provider-attempt lifecycle before production activation.',
    source: 'Provider attempt coverage contract', evidenceStatus: 'REPORTED',
  })
  if (value.journalStatus === 'gaps_detected'
    || value.journalStatus === 'reconciliation_conflict') return check({
    id: 'telemetry.provider_accounting', title: 'Provider accounting instrumentation',
    status: 'BLOCKED',
    summary: value.journalStatus === 'reconciliation_conflict'
      ? 'All current provider paths are instrumented, but journal and ledger evidence conflict.'
      : 'All current provider paths are instrumented, but bounded journal evidence contains accounting gaps.',
    action: 'Reconcile the accounting evidence without replacing or relabeling physical provider attempts.',
    source: 'Provider attempt coverage contract', evidenceStatus: 'MISMATCH',
  })

  return check({
    id: 'telemetry.provider_accounting', title: 'Provider accounting instrumentation',
    status: 'READY',
    summary: value.journalStatus === 'insufficient_evidence'
      ? 'Tutor, Jarvis, premium TTS, and Study safety are covered by the current-path instrumentation contract; no attempts were observed in the bounded window. This is not a provider-invoice completeness claim.'
      : 'Tutor, Jarvis, premium TTS, and Study safety are covered by the current-path instrumentation contract, with terminal bounded-window accounting. This is not a provider-invoice completeness claim.',
    source: 'Provider attempt coverage contract', evidenceStatus: 'VERIFIED',
  })
}

function monthlyCostAlertCheck(result, observedAt) {
  const value = result.ok && result.value && typeof result.value === 'object'
    ? result.value : null
  const window = value?.window
  const expectedWindow = resolveAdminMonthlyCostWindow(observedAt)
  const exactShape = exactKeys(value, [
    'contractVersion', 'generatedAt', 'currency', 'window', 'costAuthority', 'scope',
    'providerInvoiceTotalClaim', 'automaticProviderShutdown', 'completeness', 'status',
    'reason', 'activeCritical', 'monthlyCostMicros', 'warningThresholdMicros',
    'criticalThresholdMicros', 'remainingToWarningMicros', 'remainingToCriticalMicros',
  ]) && exactKeys(window, ['timezone', 'startAt', 'endExclusive'])
  if (!exactShape) return check({
    id: 'telemetry.monthly_cost_alert', title: 'Monthly cost alert runtime',
    status: 'UNAVAILABLE',
    summary: 'The authoritative monthly cost alert contract is unavailable or malformed.',
    action: 'Restore the bounded monthly cost evaluator and saved threshold projection.',
    source: 'Monthly provider-cost alert evaluator', evidenceStatus: 'UNAVAILABLE',
  })

  const semanticBoundary = value.contractVersion === 1
    && value.currency === 'USD'
    && value.costAuthority === 'academy_provider_usage_ledger'
    && value.scope === 'recorded_usage_derived_calculated_provider_cost'
    && value.providerInvoiceTotalClaim === false
    && value.automaticProviderShutdown === false
  if (!semanticBoundary) return check({
    id: 'telemetry.monthly_cost_alert', title: 'Monthly cost alert runtime',
    status: 'BLOCKED',
    summary: 'The monthly threshold projection violated its alert-only, ledger-authoritative safety boundary.',
    action: 'Restore false provider-invoice and automatic-shutdown claims before production activation.',
    source: 'Monthly provider-cost alert evaluator', evidenceStatus: 'MISMATCH',
  })

  const warning = value.warningThresholdMicros
  const critical = value.criticalThresholdMicros
  const configured = typeof warning === 'string' && INTEGER_MICROS.test(warning)
    && typeof critical === 'string' && INTEGER_MICROS.test(critical)
    && BigInt(warning) < BigInt(critical)
  const commonValid = typeof value.generatedAt === 'string'
    && value.generatedAt === observedAt.toISOString()
    && window.timezone === 'UTC'
    && window.startAt === expectedWindow.startAt
    && window.endExclusive === expectedWindow.endExclusive
    && MONTHLY_ALERT_COMPLETENESS.has(value.completeness)
    && MONTHLY_ALERT_STATUSES.has(value.status)
    && typeof value.reason === 'string'
    && typeof value.activeCritical === 'boolean'
    && value.activeCritical === (value.status === 'critical')
  if (!commonValid || !configured) return check({
    id: 'telemetry.monthly_cost_alert', title: 'Monthly cost alert runtime',
    status: 'UNAVAILABLE',
    summary: 'Monthly warning and critical alert thresholds could not be established safely.',
    action: 'Restore valid saved alert thresholds and the authoritative monthly aggregate.',
    source: 'Monthly provider-cost alert evaluator', evidenceStatus: 'UNAVAILABLE',
  })

  if (value.completeness === 'complete'
    && value.reason === 'complete'
    && ['normal', 'warning', 'critical'].includes(value.status)) return check({
    id: 'telemetry.monthly_cost_alert', title: 'Monthly cost alert runtime',
    status: 'READY',
    summary: `The authoritative monthly evaluator reports ${value.status} alert state. Thresholds are alerts only; provider auto-shutdown and provider-invoice-total claims remain false.`,
    source: 'Monthly provider-cost alert evaluator', evidenceStatus: 'VERIFIED',
  })

  if (value.completeness === 'partial'
    && ['partial_lower_bound', 'partial_lower_bound_critical'].includes(value.reason)
    && ['partial', 'critical'].includes(value.status)) return check({
    id: 'telemetry.monthly_cost_alert', title: 'Monthly cost alert runtime',
    status: 'PARTIAL',
    summary: 'The alert-only monthly evaluator has lower-bound cost evidence; it does not invent normal state or trigger provider shutdown.',
    action: 'Restore complete authoritative ledger aggregation while preserving the alert-only boundary.',
    source: 'Monthly provider-cost alert evaluator', evidenceStatus: 'REPORTED',
  })

  if (value.completeness === 'unavailable'
    && value.status === 'unavailable'
    && ['configuration_unavailable', 'aggregate_unavailable'].includes(value.reason)) return check({
    id: 'telemetry.monthly_cost_alert', title: 'Monthly cost alert runtime',
    status: 'UNAVAILABLE',
    summary: 'The alert-only runtime is present, but authoritative threshold or aggregate evidence is unavailable.',
    action: 'Restore the saved thresholds and authoritative usage-cost aggregate.',
    source: 'Monthly provider-cost alert evaluator', evidenceStatus: 'UNAVAILABLE',
  })

  return check({
    id: 'telemetry.monthly_cost_alert', title: 'Monthly cost alert runtime',
    status: 'BLOCKED',
    summary: 'The monthly alert status is inconsistent with its completeness and reason evidence.',
    action: 'Reconcile the evaluator contract without adding automatic provider controls.',
    source: 'Monthly provider-cost alert evaluator', evidenceStatus: 'MISMATCH',
  })
}

function releaseControlsCheck(releaseControls) {
  if (!releaseControls) return check({
    id: 'curriculum.release_controls', title: 'Local curriculum release controls',
    status: 'UNAVAILABLE',
    summary: 'Checked-in curriculum release-control evidence is unavailable or malformed.',
    action: 'Restore the local release-control module and migration inventory.',
    source: 'Checked-in release controls and local migration manifest', evidenceStatus: 'UNAVAILABLE',
  })
  const controls = [
    ['Release registry', releaseControls.registry],
    ['Exact-revision staging', releaseControls.staging],
    ['Integrity verification', releaseControls.integrity],
    ['Immutable publishing', releaseControls.publishing],
    ['Activation and rollback', releaseControls.activationRollback],
  ]
  const ready = releaseControls.state === 'ready'
  return check({
    id: 'curriculum.release_controls', title: 'Local curriculum release controls',
    status: ready ? 'READY' : 'BLOCKED',
    summary: ready
      ? 'Exact-revision staging, integrity verification, immutable publishing, and activation/rollback are assembled locally. This does not prove hosted migration application.'
      : 'One or more checked-in curriculum release controls or local migration contracts are missing.',
    action: ready ? null : 'Restore the missing local control-plane module or migration before any hosted release card.',
    source: 'Checked-in release controls and local migration manifest',
    evidenceStatus: ready ? 'VERIFIED' : 'MISMATCH',
    observations: controls.map(([label, available]) => observation(label, available ? 'present' : 'missing')),
  })
}

/**
 * Compose bounded facts. Every probe is isolated so one failed domain cannot
 * erase other evidence or become a false READY result.
 */
export function createAdminProductionReadinessService(options = {}) {
  const env = options.env ?? process.env
  const now = options.now ?? (() => new Date())

  return Object.freeze({
    async check(principal) {
      const clockValue = now()
      if (!(clockValue instanceof Date) || Number.isNaN(clockValue.valueOf())) {
        throw new TypeError('invalid readiness clock')
      }
      const observedAt = new Date(clockValue.valueOf())
      const probeContext = Object.freeze({
        observedAt: new Date(observedAt.valueOf()),
        generatedAt: observedAt.toISOString(),
      })
      const [
        repositoryRaw,
        configurationRaw,
        hostedMigrations,
        ownerBootstrap,
        telemetry,
        accounting,
        monthlyCostAlert,
      ] = await Promise.all([
        settle(options.repository, probeContext),
        settle(options.configuration, probeContext),
        settle(options.hostedMigrations, probeContext),
        settle(options.ownerBootstrap, probeContext),
        settle(options.telemetry, probeContext),
        settle(options.accounting, probeContext),
        settle(options.monthlyCostAlert, probeContext),
      ])
      const repository = repositoryResult(repositoryRaw)
      const configuration = configurationResult(configurationRaw)
      const configChecks = configurationChecks(configuration)

      const buildIdentity = present(env, ['ACADEMY_APP_VERSION', 'COMMIT_REF', 'DEPLOY_ID'])
      const productionContext = env?.CONTEXT === 'production' || env?.DEPLOY_CONTEXT === 'production'
      const buildStatus = !buildIdentity ? 'BLOCKED' : productionContext ? 'READY' : 'UNVERIFIED'
      const application = domain('application', 'Application', 'Build identity and effective Admin runtime policy.', [
        check({
          id: 'application.build', title: 'Production build state', status: buildStatus,
          summary: buildStatus === 'READY'
            ? 'An immutable build identity is present in a production deployment context.'
            : buildStatus === 'BLOCKED'
              ? 'No immutable application build identity is present.'
              : 'A build identity is present, but the production deployment context is not authoritative.',
          action: buildStatus === 'READY' ? null : 'Produce or identify the build through the governed deployment workflow.',
          source: 'Deployment build metadata', evidenceStatus: buildStatus === 'READY' ? 'VERIFIED' : buildStatus === 'BLOCKED' ? 'MISMATCH' : 'UNVERIFIED',
        }),
        configChecks[0],
      ])

      const migration = repository.migrations
      const repositoryMigrationCheck = migration
        ? check({
            id: 'database.repository_migrations', title: 'Local repository migration chain',
            status: migration.state === 'ready' ? 'READY' : 'BLOCKED',
            summary: migration.state === 'ready'
              ? `${migration.migrationCount} local migrations have unique ordered versions, earlier dependencies, and matching manifest hashes.`
              : migration.collisionVersions.length > 0
                ? `Duplicate migration version prefixes were found: ${migration.collisionVersions.join(', ')}.`
                : 'Migration ordering, manifest coverage, or file hashes do not match.',
            action: migration.state === 'ready' ? null : 'Report and reconcile repository migration hazards before any hosted migration card.',
            source: 'Local repository migration files and manifest',
            evidenceStatus: migration.state === 'ready' ? 'VERIFIED' : 'MISMATCH',
          })
        : check({
            id: 'database.repository_migrations', title: 'Local repository migration chain', status: 'UNAVAILABLE',
            summary: 'Local repository migration evidence is missing or malformed.',
            action: 'Restore the local manifest and collision-check inputs.',
            source: 'Local repository migration files and manifest', evidenceStatus: 'UNAVAILABLE',
          })
      const database = domain('database', 'Database', 'Expected local migrations and separately sourced hosted evidence.', [
        repositoryMigrationCheck,
        hostedMigrationCheck(hostedMigrations),
      ])

      const principalAuthorized = principal
        && typeof principal === 'object'
        && ['owner', 'admin', 'viewer'].includes(principal.role)
        && Array.isArray(principal.capabilities)
        && principal.capabilities.includes('releases:read')
      const ownerState = ownerBootstrap.ok && exactKeys(ownerBootstrap.value, ['state'])
        ? ownerBootstrap.value.state : principal?.role === 'owner' ? 'verified' : 'unverified'
      const authorization = domain('authorization', 'Authorization', 'Admin foundation and Owner continuity.', [
        check({
          id: 'authorization.foundation', title: 'Admin authorization foundation',
          status: principalAuthorized ? 'READY' : 'BLOCKED',
          summary: principalAuthorized
            ? 'This request passed the server-resolved releases read capability boundary.'
            : 'The production readiness capability was not established.',
          action: principalAuthorized ? null : 'Restore an active authorized Admin assignment.',
          source: 'Current Admin authorization', evidenceStatus: principalAuthorized ? 'VERIFIED' : 'MISMATCH',
        }),
        check({
          id: 'authorization.owner_bootstrap', title: 'Active Owner bootstrap',
          status: ownerState === 'verified' ? 'READY' : ownerState === 'missing' ? 'BLOCKED' : 'UNVERIFIED',
          summary: ownerState === 'verified'
            ? 'Authoritative evidence proves at least one active Owner assignment.'
            : ownerState === 'missing'
              ? 'Authoritative evidence proves no active Owner assignment exists.'
              : 'No safe authoritative Owner-count projection is available for this request.',
          action: ownerState === 'verified' ? null : ownerState === 'missing'
            ? 'Use a separately governed Owner bootstrap card.'
            : 'Supply an approved read-only Owner readiness projection.',
          source: principal?.role === 'owner' && ownerState === 'verified'
            ? 'Current active Owner authorization' : 'Owner bootstrap evidence',
          evidenceStatus: ownerState === 'verified' ? 'VERIFIED' : ownerState === 'missing' ? 'MISMATCH' : 'UNVERIFIED',
        }),
      ])

      const aiTts = domain('ai_tts', 'AI & TTS', 'Effective provider state and logical voice deployability.', configChecks.slice(1))
      const telemetryChecks = [
        probeAvailability({
          result: telemetry, id: 'telemetry.operational_aggregate', title: 'Operational aggregate availability',
          source: 'Operational telemetry aggregate', unavailableSummary: 'The bounded operational aggregate could not be read.',
          action: 'Restore the read-only aggregate contract and retry.',
        }),
        providerAccountingCheck(accounting),
        monthlyCostAlertCheck(monthlyCostAlert, observedAt),
      ]
      const telemetryDomain = domain('telemetry', 'Telemetry', 'Operational, provider-accounting, and alert-only cost evidence.', telemetryChecks)

      const curriculum = repository.curriculum
      const curriculumDomain = domain('curriculum', 'Curriculum', 'Pinned release, validation, and local-only release controls.', [
        curriculum
          ? check({
              id: 'curriculum.release_registry', title: 'Production release registry',
              status: curriculum.state === 'ready' ? 'READY' : 'BLOCKED',
              summary: curriculum.state === 'ready'
                ? `The production registry pins active curriculum ${curriculum.activeVersion}.`
                : 'The active registry entry does not match its immutable source release.',
              action: curriculum.state === 'ready' ? null : 'Correct the registry in a governed release card; do not activate from this center.',
              source: 'Production curriculum release registry', evidenceStatus: curriculum.state === 'ready' ? 'VERIFIED' : 'MISMATCH',
            })
          : check({
              id: 'curriculum.release_registry', title: 'Production release registry', status: 'UNAVAILABLE',
              summary: 'The production release registry is missing or malformed.',
              source: 'Production curriculum release registry', evidenceStatus: 'UNAVAILABLE',
            }),
        curriculum
          ? check({
              id: 'curriculum.active_validation', title: 'Active release validation',
              status: curriculum.validationState === 'passed' ? 'READY' : 'BLOCKED',
              summary: curriculum.validationState === 'passed'
                ? 'The current production release has a passing immutable validation artifact.'
                : 'The current production release validation is not passing.',
              action: curriculum.validationState === 'passed' ? null : 'Publish a new validated immutable release through curriculum governance.',
              source: 'Active curriculum validation artifact', evidenceStatus: curriculum.validationState === 'passed' ? 'VERIFIED' : 'MISMATCH',
            })
          : check({
              id: 'curriculum.active_validation', title: 'Active release validation', status: 'UNAVAILABLE',
              summary: 'Active curriculum validation evidence is unavailable.',
              source: 'Active curriculum validation artifact', evidenceStatus: 'UNAVAILABLE',
            }),
        releaseControlsCheck(repository.releaseControls),
      ])

      const studyMounted = positiveFlag(env, 'ACADEMY_STUDY_ENABLED')
        && positiveFlag(env, 'VITE_STUDY_ENGINE_ENABLED')
      const studyRaw = studyMounted
        ? await settle(options.study, probeContext)
        : Object.freeze({ ok: false, value: null })
      const studyState = studyRaw.ok && studyRaw.value && typeof studyRaw.value === 'object'
        ? studyRaw.value.status : null
      const studyStatus = studyState === 'ready' ? 'READY'
        : studyState === 'degraded' ? 'PARTIAL'
          : studyState === 'not-ready' ? 'BLOCKED' : 'UNAVAILABLE'
      const studyDomain = domain('study', 'Study', 'Production mount and existing Study readiness contract.', [
        check({
          id: 'study.mount', title: 'Production Study mount',
          status: studyMounted ? 'READY' : 'BLOCKED',
          summary: studyMounted
            ? 'Both the browser mount and server gateway are explicitly enabled.'
            : 'The Study browser mount or server gateway is not enabled.',
          action: studyMounted ? null : 'Enable Study only after every Study production dependency is authoritative.',
          source: 'Study deployment gates', evidenceStatus: studyMounted ? 'VERIFIED' : 'MISMATCH',
        }),
        check({
          id: 'study.readiness', title: 'Study production readiness contract',
          status: studyStatus,
          summary: studyStatus === 'READY'
            ? 'The existing authoritative Study readiness contract reports ready.'
            : studyStatus === 'PARTIAL'
              ? 'The Study readiness contract reports degraded.'
              : studyStatus === 'BLOCKED'
                ? 'The Study readiness contract reports not ready.'
                : 'Study readiness is unavailable and was not inferred from other evidence.',
          action: studyStatus === 'READY' ? null : 'Resolve the named Study contract through its owning governed production workflow.',
          source: 'Study production readiness contract', evidenceStatus: studyStatus === 'READY' ? 'VERIFIED' : studyStatus === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'REPORTED',
        }),
      ])

      const deployment = domain('deployment', 'Deployment', 'Presence-only checks; values and secrets are never projected.', [
        environmentChecks(env, configuration),
      ])
      const domains = Object.freeze([
        application,
        database,
        authorization,
        aiTts,
        telemetryDomain,
        curriculumDomain,
        studyDomain,
        deployment,
      ])
      const requiredChecks = domains.flatMap((item) => item.checks).filter((item) => item.required)
      const readyCount = requiredChecks.filter((item) => item.status === 'READY').length
      const blockingCount = requiredChecks.length - readyCount
      return Object.freeze({
        schemaVersion: PRODUCTION_READINESS_SCHEMA_VERSION,
        generatedAt: observedAt.toISOString(),
        status: blockingCount === 0 ? 'READY' : 'BLOCKED',
        requiredSummary: Object.freeze({
          total: requiredChecks.length,
          ready: readyCount,
          blocking: blockingCount,
        }),
        domains,
      })
    },
  })
}
