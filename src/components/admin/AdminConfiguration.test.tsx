import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AdminConfigurationSource, AdminConfigurationPreview } from '../../admin/configurationHttpSource'
import {
  ADMIN_CONFIGURATION_KEYS,
  type AdminConfigurationKey,
  type AdminRuntimeConfigurationProjection,
} from '../../admin/configurationModel'
import type { PublicVoiceCatalog } from '../../tutor/voiceCatalog'
import {
  AdminConfiguration,
  adminConfigurationEditorReducer,
  configurationErrorMessage,
} from './AdminConfiguration'

function setting(key: AdminConfigurationKey) {
  const isRuntime = key.startsWith('runtime.')
  const quota = key.startsWith('quota.')
  const money = key.startsWith('cost.')
  const approved = key === 'ai.approved_tiers'
  return {
    key,
    value: isRuntime ? false : key === 'quota.ai.requests_per_account_day' ? 50
      : key === 'quota.tts.requests_per_account_day' ? 200
        : key === 'cost.warning.monthly_micros' ? '10000000'
          : key === 'cost.critical.monthly_micros' ? '25000000'
            : approved ? ['sonnet', 'haiku'] as const : 'sonnet' as const,
    revision: '1', requiredCapability: 'configuration:manage' as const,
    protectiveCapability: isRuntime ? 'engines:operate' as const : null,
    warningLevel: isRuntime || approved || key === 'cost.critical.monthly_micros' ? 'critical' as const : 'warning' as const,
    bounds: quota ? { minimum: '1', maximum: key.includes('.ai.') ? '200' : '1000' } : money ? { minimum: '1', maximum: '1000000000000' } : null,
    allowlist: key.startsWith('ai.') ? ['sonnet', 'haiku'] as const : null,
    deploymentCeilingType: isRuntime ? 'boolean_enablement' as const : quota ? 'integer_maximum' as const : money ? 'integer_micros_maximum' as const : approved ? 'allowlist_subset' as const : 'allowlist_member' as const,
    registryVersion: 1 as const, integrationStatus: 'pending_runtime_integration' as const,
    runtime: money ? {
      classification: 'ENFORCEABLE_NOW' as const,
      effectiveValue: key === 'cost.warning.monthly_micros' ? '10000000' : '25000000',
      enforcement: 'enforced' as const,
      resolution: 'saved' as const,
      reason: 'saved_value_enforced' as const,
      trustedConsumer: 'cost_alert_evaluator' as const,
      studyStatus: 'not_applicable' as const,
    } : {
      classification: 'ENFORCEABLE_NOW' as const,
      effectiveValue: isRuntime ? false
        : key === 'quota.ai.requests_per_account_day' ? 50
          : key === 'quota.tts.requests_per_account_day' ? 100
            : approved ? ['sonnet', 'haiku'] as const : 'sonnet' as const,
      enforcement: 'enforced' as const,
      resolution: key === 'runtime.tts.enabled' ? 'fallback' as const
        : key === 'quota.tts.requests_per_account_day' ? 'constraint' as const
          : key === 'ai.approved_tiers' ? 'error' as const : 'saved' as const,
      reason: key === 'runtime.tts.enabled' ? 'browser_speech_fallback' as const
        : key === 'quota.tts.requests_per_account_day' ? 'deployment_quota_ceiling' as const
          : key === 'ai.approved_tiers' ? 'configuration_resolution_failed' as const
            : 'saved_value_enforced' as const,
      trustedConsumer: key === 'runtime.tts.enabled'
        || key === 'quota.tts.requests_per_account_day'
        ? 'tts_gateway' as const : 'anthropic_gateway' as const,
      studyStatus: 'unavailable' as const,
    },
  }
}

const PROJECTION: AdminRuntimeConfigurationProjection = {
  schemaVersion: 2,
  integrationStatus: 'pending_runtime_integration',
  runtimeStatus: 'partial_runtime_enforcement',
  settings: ADMIN_CONFIGURATION_KEYS.map(setting),
}

const VOICES = {
  catalogVersion: 'catalog-v1', synthesisEnabled: true,
  defaultVoiceRef: 'academy.tts.clear',
  voices: [
    { voiceRef: 'academy.tts.clear', voiceVersion: 'v1', displayLabel: 'Clear Guide', providerClass: 'premium', status: 'active', deploymentAvailable: true, cachedPlaybackAllowed: true, providerVoiceId: 'RAW_PROVIDER_123' },
    { voiceRef: 'academy.tts.retired', voiceVersion: 'v2', displayLabel: 'Retired Guide', providerClass: 'premium', status: 'revoked', deploymentAvailable: false, cachedPlaybackAllowed: false, providerVoiceId: 'RAW_PROVIDER_456' },
    { voiceRef: 'academy.tts.paused', voiceVersion: 'v1', displayLabel: 'Paused Guide', providerClass: 'premium', status: 'disabled', deploymentAvailable: false, cachedPlaybackAllowed: true, providerVoiceId: 'RAW_PROVIDER_789' },
  ],
} as unknown as PublicVoiceCatalog

const SOURCE: AdminConfigurationSource = {
  read: vi.fn(), preview: vi.fn(), commit: vi.fn(),
}

function render(capabilities: readonly ('configuration:read' | 'configuration:manage')[], voices = VOICES) {
  return renderToStaticMarkup(<AdminConfiguration
    authorization={{ capabilities }}
    state={{ status: 'ready', projection: PROJECTION }}
    voiceCatalog={{ status: 'ready', catalog: voices }}
    source={SOURCE}
    onCommitted={() => {}}
    onRetry={() => {}}
  />)
}

describe('Admin Configuration page', () => {
  it('gives a viewer current stored values and source/status without mutation controls', () => {
    const markup = render(['configuration:read'])
    expect(markup).toContain('Trusted runtime consumers are active')
    expect(markup).toContain('Saved configuration</dt><dd>Durable Admin registry')
    expect(markup).toContain('Runtime effective / enforced state</dt><dd>8 enforced · 0 unavailable')
    expect(markup).toContain('Runtime effective value</dt><dd>100')
    expect(markup).toContain('Resolution</dt><dd>Saved')
    expect(markup).toContain('Constraint — deployment quota ceiling (saved/deployment conflict)')
    expect(markup).toContain('Fallback — browser speech fallback')
    expect(markup).toContain('Error — configuration resolution failed')
    expect(markup).toContain('Trusted consumer</dt><dd>Anthropic gateway')
    expect(markup).toContain('Trusted consumer</dt><dd>TTS gateway')
    expect(markup).toContain('Trusted consumer</dt><dd>Monthly cost alert evaluator')
    expect(markup).toContain('Effective — cost alert threshold')
    expect(markup).toContain('Study effective settings</dt><dd>Unavailable — no Study effective-settings authority')
    expect(markup).toContain('Not applicable — operational alert threshold only')
    expect(markup).toContain('do not disable, reroute, or impose a provider spending hard cap')
    expect(markup).toContain('Read only')
    expect(markup).not.toContain('<button')
    expect(markup).not.toContain('<form')
  })

  it('offers authorized editing for exactly the eight registered backend settings', () => {
    const markup = render(['configuration:read', 'configuration:manage'])
    expect(markup.match(/Edit stored value/g)).toHaveLength(8)
    for (const label of [
      'AI runtime desired state', 'TTS runtime desired state', 'AI daily request ceiling',
      'TTS daily request ceiling', 'Monthly cost warning', 'Monthly cost critical threshold',
      'Approved logical AI tiers', 'Default logical AI tier',
    ]) expect(markup).toContain(label)
    expect(markup).not.toContain('generic JSON')
  })

  it('renders Study and TTS voice authority as unavailable without guardian writes', () => {
    const markup = render(['configuration:read', 'configuration:manage'])
    expect(markup).toContain('No Admin Study effective-settings V2 authority is present')
    expect(markup).toContain('Guardian choices and safety authority are not read, written, or overridden')
    expect(markup).toContain('no Admin voice-default setting is registered')
    expect(markup).toContain('Not editable until an authoritative Admin logical-voice setting exists')
  })

  it('uses only logical voice references and marks revoked/disabled voices unavailable', () => {
    const markup = render(['configuration:read'])
    expect(markup).toContain('academy.tts.clear')
    expect(markup).toContain('academy.tts.retired')
    expect(markup).toContain('academy.tts.retired · v2')
    expect(markup).toContain('Revoked · unavailable')
    expect(markup).toContain('Disabled · unavailable')
    expect(markup).toMatch(/value="academy\.tts\.retired" disabled=""/)
    expect(markup).not.toMatch(/RAW_PROVIDER_123|RAW_PROVIDER_456|RAW_PROVIDER_789/)
  })

  it('does not render injected secrets or private payload fields', () => {
    const unsafeProjection = {
      ...PROJECTION,
      providerApiKey: 'SECRET_API_KEY',
      learnerConversation: 'PRIVATE_TUTOR_CONVERSATION',
      settings: PROJECTION.settings.map((entry, index) => index === 0
        ? { ...entry, rawProviderObject: { token: 'SECRET_TOKEN' } } : entry),
    } as unknown as AdminRuntimeConfigurationProjection
    const markup = renderToStaticMarkup(<AdminConfiguration
      authorization={{ capabilities: ['configuration:read'] }}
      state={{ status: 'ready', projection: unsafeProjection }}
      voiceCatalog={{ status: 'ready', catalog: VOICES }}
      source={SOURCE} onCommitted={() => {}} onRetry={() => {}}
    />)
    expect(markup).not.toMatch(/SECRET_API_KEY|SECRET_TOKEN|PRIVATE_TUTOR_CONVERSATION|rawProviderObject/)
  })

  it('renders honest loading, failure, retry, and catalog-empty states', () => {
    const common = { authorization: { capabilities: ['configuration:read'] as const }, source: SOURCE, onCommitted: () => {}, onRetry: () => {}, voiceCatalog: { status: 'loading' as const } }
    expect(renderToStaticMarkup(<AdminConfiguration {...common} state={{ status: 'loading' }} />)).toContain('Loading configuration')
    expect(renderToStaticMarkup(<AdminConfiguration {...common} state={{ status: 'error', code: 'configuration_unavailable' }} />)).toContain('Try again')
    const empty = { catalogVersion: 'catalog-v2', synthesisEnabled: false, defaultVoiceRef: null, voices: [] }
    const markup = render(['configuration:read'], empty)
    expect(markup).toContain('No approved premium logical voices are available')
    expect(markup).toContain('Browser-native speech remains the safe production fallback')
  })

  it('has responsive reflow and visible keyboard focus rules', () => {
    const css = readFileSync(new URL('./admin-configuration.css', import.meta.url), 'utf8')
    expect(css).toContain('@media (max-width: 700px)')
    expect(css).toContain('.admin-config-grid { grid-template-columns: 1fr; }')
    expect(css).toContain('@media (max-width: 460px)')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('outline: 3px solid')
  })
})

describe('Admin Configuration edit/save state machine', () => {
  const runtime = setting('runtime.ai.enabled')
  const change = { settingKey: runtime.key, expectedRevision: '1', newValue: true, reasonCode: 'operator.request' as const }
  const preview: AdminConfigurationPreview = {
    schemaVersion: 2, settingKey: runtime.key, currentValue: false, newValue: true,
    expectedRevision: '1', warningLevel: 'critical',
    confirmationId: '20000000-0000-4000-8000-000000000101',
    confirmationExpiresAt: '2026-08-10T17:05:00.000Z', confirmationToken: 'A'.repeat(43),
    integrationStatus: 'pending_runtime_integration',
  }

  it('supports edit, cancel/reset, preview, saving, and success', () => {
    let state = adminConfigurationEditorReducer({ status: 'idle' }, { type: 'edit', setting: runtime })
    expect(state).toMatchObject({ status: 'editing', draft: false })
    state = adminConfigurationEditorReducer(state, { type: 'draft', draft: true })
    state = adminConfigurationEditorReducer(state, { type: 'preview_start' })
    expect(state).toMatchObject({ status: 'editing', operation: 'previewing' })
    state = adminConfigurationEditorReducer(state, { type: 'preview_success', change, preview })
    expect(state).toMatchObject({ status: 'confirming', operation: 'ready', preview: { currentValue: false, newValue: true } })
    state = adminConfigurationEditorReducer(state, { type: 'commit_start', requestId: 'request-one' })
    expect(state).toMatchObject({ status: 'confirming', operation: 'saving', requestId: 'request-one' })
    state = adminConfigurationEditorReducer(state, { type: 'commit_success', result: {
      schemaVersion: 2, settingKey: runtime.key, value: true, revision: '2',
      idempotencyResult: 'created', integrationStatus: 'pending_runtime_integration',
    } })
    expect(state).toMatchObject({ status: 'success', result: { revision: '2' } })
    expect(adminConfigurationEditorReducer(adminConfigurationEditorReducer({ status: 'idle' }, { type: 'edit', setting: runtime }), { type: 'cancel' })).toEqual({ status: 'idle' })
  })

  it('preserves the request ID for retry and distinguishes CAS from server failure', () => {
    let state = adminConfigurationEditorReducer({ status: 'idle' }, { type: 'edit', setting: runtime })
    state = adminConfigurationEditorReducer(state, { type: 'preview_success', change, preview })
    state = adminConfigurationEditorReducer(state, { type: 'commit_start', requestId: 'stable-request' })
    state = adminConfigurationEditorReducer(state, { type: 'commit_error', code: 'configuration_timeout' })
    state = adminConfigurationEditorReducer(state, { type: 'commit_start', requestId: 'replacement-request' })
    expect(state).toMatchObject({ requestId: 'stable-request', operation: 'saving' })
    expect(configurationErrorMessage('revision_conflict')).toContain('Another operator')
    expect(configurationErrorMessage('configuration_unavailable')).toContain('No success is assumed')
  })
})
