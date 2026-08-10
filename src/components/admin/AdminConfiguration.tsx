import { useEffect, useId, useReducer, useRef } from 'react'
import type { AdminCapability } from '../../admin/contracts'
import {
  type AdminConfigurationErrorCode,
  AdminConfigurationError,
  type AdminConfigurationChangeRequest,
  type AdminConfigurationCommitResult,
  type AdminConfigurationPreview,
  type AdminConfigurationSource,
} from '../../admin/configurationHttpSource'
import {
  type AdminAiTier,
  type AdminConfigurationKey,
  type AdminConfigurationProjection,
  type AdminConfigurationSetting,
  type AdminRuntimeConfigurationProjection,
  type AdminRuntimeConfigurationSetting,
} from '../../admin/configurationModel'
import {
  ADMIN_CONFIGURATION_REASON_OPTIONS,
  adminConfigurationValuesEqual,
  draftForAdminConfigurationSetting,
  formatAdminConfigurationValue,
  parseAdminConfigurationDraft,
  type AdminConfigurationDraft,
  type AdminConfigurationReasonCode,
} from '../../admin/configurationUiModel'
import type { PublicVoiceCatalog, PublicVoiceCatalogEntry } from '../../tutor/voiceCatalog'
import './admin-configuration.css'

export type AdminConfigurationReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'ready'; readonly projection: AdminRuntimeConfigurationProjection }
  | { readonly status: 'error'; readonly code: 'configuration_timeout' | 'configuration_unavailable' }

export type AdminVoiceCatalogReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly catalog: PublicVoiceCatalog }

type EditingState = {
  readonly status: 'editing'
  readonly setting: AdminConfigurationSetting
  readonly draft: AdminConfigurationDraft
  readonly reasonCode: AdminConfigurationReasonCode
  readonly operation: 'idle' | 'previewing'
  readonly error: string | null
}

type ConfirmingState = {
  readonly status: 'confirming'
  readonly setting: AdminConfigurationSetting
  readonly draft: AdminConfigurationDraft
  readonly change: AdminConfigurationChangeRequest
  readonly preview: AdminConfigurationPreview
  readonly requestId: string | null
  readonly operation: 'ready' | 'saving' | 'error'
  readonly errorCode: AdminConfigurationErrorCode | null
}

export type AdminConfigurationEditorState =
  | { readonly status: 'idle' }
  | EditingState
  | ConfirmingState
  | {
      readonly status: 'success'
      readonly result: AdminConfigurationCommitResult
    }

export type AdminConfigurationEditorAction =
  | { readonly type: 'edit'; readonly setting: AdminConfigurationSetting }
  | { readonly type: 'draft'; readonly draft: AdminConfigurationDraft }
  | { readonly type: 'reason'; readonly reasonCode: AdminConfigurationReasonCode }
  | { readonly type: 'validation_error'; readonly error: string }
  | { readonly type: 'preview_start' }
  | {
      readonly type: 'preview_success'
      readonly change: AdminConfigurationChangeRequest
      readonly preview: AdminConfigurationPreview
    }
  | { readonly type: 'preview_error'; readonly code: AdminConfigurationErrorCode }
  | { readonly type: 'commit_start'; readonly requestId: string }
  | { readonly type: 'commit_error'; readonly code: AdminConfigurationErrorCode }
  | { readonly type: 'commit_success'; readonly result: AdminConfigurationCommitResult }
  | { readonly type: 'preview_again' }
  | { readonly type: 'cancel' }

export function adminConfigurationEditorReducer(
  state: AdminConfigurationEditorState,
  action: AdminConfigurationEditorAction,
): AdminConfigurationEditorState {
  if (action.type === 'edit') {
    return {
      status: 'editing', setting: action.setting,
      draft: draftForAdminConfigurationSetting(action.setting),
      reasonCode: 'operator.request', operation: 'idle', error: null,
    }
  }
  if (action.type === 'cancel') return { status: 'idle' }
  if (action.type === 'draft' && state.status === 'editing') {
    return { ...state, draft: action.draft, error: null }
  }
  if (action.type === 'reason' && state.status === 'editing') {
    return { ...state, reasonCode: action.reasonCode, error: null }
  }
  if (action.type === 'validation_error' && state.status === 'editing') {
    return { ...state, operation: 'idle', error: action.error }
  }
  if (action.type === 'preview_start' && state.status === 'editing') {
    return { ...state, operation: 'previewing', error: null }
  }
  if (action.type === 'preview_error' && state.status === 'editing') {
    return { ...state, operation: 'idle', error: configurationErrorMessage(action.code) }
  }
  if (action.type === 'preview_success' && state.status === 'editing') {
    return {
      status: 'confirming', setting: state.setting, draft: state.draft,
      change: action.change, preview: action.preview, requestId: null,
      operation: 'ready', errorCode: null,
    }
  }
  if (action.type === 'commit_start' && state.status === 'confirming') {
    return { ...state, requestId: state.requestId ?? action.requestId, operation: 'saving', errorCode: null }
  }
  if (action.type === 'commit_error' && state.status === 'confirming') {
    return { ...state, operation: 'error', errorCode: action.code }
  }
  if (action.type === 'commit_success' && state.status === 'confirming') {
    return { status: 'success', result: action.result }
  }
  if (action.type === 'preview_again' && state.status === 'confirming') {
    return {
      status: 'editing', setting: state.setting, draft: state.draft,
      reasonCode: state.change.reasonCode, operation: 'idle', error: null,
    }
  }
  return state
}

const SETTING_PRESENTATION: Readonly<Record<AdminConfigurationKey, {
  readonly title: string
  readonly description: string
  readonly group: 'runtime' | 'quota' | 'cost' | 'ai'
}>> = {
  'runtime.ai.enabled': {
    title: 'AI runtime desired state',
    description: 'Stored enablement ceiling for Academy AI requests.',
    group: 'runtime',
  },
  'runtime.tts.enabled': {
    title: 'TTS runtime desired state',
    description: 'Stored enablement ceiling for premium speech synthesis.',
    group: 'runtime',
  },
  'quota.ai.requests_per_account_day': {
    title: 'AI daily request ceiling',
    description: 'Maximum stored request allowance per account per day.',
    group: 'quota',
  },
  'quota.tts.requests_per_account_day': {
    title: 'TTS daily request ceiling',
    description: 'Maximum stored speech request allowance per account per day.',
    group: 'quota',
  },
  'cost.warning.monthly_micros': {
    title: 'Monthly cost warning',
    description: 'Stored USD threshold for an administrative warning.',
    group: 'cost',
  },
  'cost.critical.monthly_micros': {
    title: 'Monthly cost critical threshold',
    description: 'Stored USD threshold for a critical administrative warning.',
    group: 'cost',
  },
  'ai.approved_tiers': {
    title: 'Approved logical AI tiers',
    description: 'Stored allowlist of Academy logical model tiers.',
    group: 'ai',
  },
  'ai.default_tier': {
    title: 'Default logical AI tier',
    description: 'Stored default within the approved logical tier set.',
    group: 'ai',
  },
}

const GROUPS = [
  ['runtime', 'Runtime controls', 'Saved policy constrained by deployment and subsystem safety.'],
  ['quota', 'Daily quotas', 'Authoritative per-account gateway request ceilings.'],
  ['cost', 'Cost thresholds', 'Saved exactly; no authoritative alert consumer exists yet.'],
  ['ai', 'AI model policy', 'Server-enforced logical tiers only; provider model identifiers stay private.'],
] as const

export interface AdminConfigurationProps {
  readonly authorization: { readonly capabilities: readonly AdminCapability[] }
  readonly state: AdminConfigurationReadState
  readonly voiceCatalog: AdminVoiceCatalogReadState
  readonly source: AdminConfigurationSource
  readonly onCommitted: (result: AdminConfigurationCommitResult) => void
  readonly onRetry: () => void
  readonly onDirtyChange?: (dirty: boolean) => void
}

export function AdminConfiguration({
  authorization,
  state,
  voiceCatalog,
  source,
  onCommitted,
  onRetry,
  onDirtyChange,
}: AdminConfigurationProps) {
  const [editor, dispatch] = useReducer(adminConfigurationEditorReducer, { status: 'idle' })
  const operationController = useRef<AbortController | null>(null)
  const canManage = authorization.capabilities.includes('configuration:manage')
  const dirty = editor.status === 'editing' || editor.status === 'confirming'

  useEffect(() => {
    onDirtyChange?.(dirty)
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, onDirtyChange])

  useEffect(() => () => operationController.current?.abort(), [])

  if (state.status === 'loading') {
    return <ConfigurationState title="Loading configuration" message="Reading the authoritative configuration projection." busy />
  }
  if (state.status === 'unauthorized') {
    return <ConfigurationState title="Configuration access unavailable" message="The current server-resolved capabilities do not include configuration read access." />
  }
  if (state.status === 'error') {
    return (
      <ConfigurationState
        title={state.code === 'configuration_timeout' ? 'Configuration read timed out' : 'Configuration unavailable'}
        message="No substitute or cached configuration values are shown."
        onRetry={onRetry}
      />
    )
  }

  const projection = state.projection
  const enforcementCounts = projection.settings.reduce((counts, setting) => ({
    ...counts,
    [setting.runtime.enforcement]: counts[setting.runtime.enforcement] + 1,
  }), { enforced: 0, unavailable: 0, error: 0 })
  const enforcementSummary = [
    `${enforcementCounts.enforced} enforced`,
    `${enforcementCounts.unavailable} unavailable`,
    ...(enforcementCounts.error > 0 ? [`${enforcementCounts.error} error`] : []),
  ].join(' · ')

  async function previewChange(editing: EditingState) {
    const parsed = parseAdminConfigurationDraft(editing.setting.key, editing.draft, projection)
    if (!parsed.ok) {
      dispatch({ type: 'validation_error', error: parsed.error })
      return
    }
    if (adminConfigurationValuesEqual(editing.setting.value, parsed.value)) {
      dispatch({ type: 'validation_error', error: 'Change the value before requesting a preview.' })
      return
    }
    const change: AdminConfigurationChangeRequest = {
      settingKey: editing.setting.key,
      expectedRevision: editing.setting.revision,
      newValue: parsed.value,
      reasonCode: editing.reasonCode,
    }
    dispatch({ type: 'preview_start' })
    operationController.current?.abort()
    const controller = new AbortController()
    operationController.current = controller
    try {
      const preview = await source.preview(change, { signal: controller.signal })
      dispatch({ type: 'preview_success', change, preview })
    } catch (error) {
      if (controller.signal.aborted) return
      dispatch({
        type: 'preview_error',
        code: error instanceof AdminConfigurationError ? error.code : 'configuration_unavailable',
      })
    }
  }

  async function commitChange(confirming: ConfirmingState) {
    let requestId: string
    try {
      requestId = confirming.requestId ?? createConfigurationRequestId()
    } catch {
      dispatch({ type: 'commit_error', code: 'configuration_unavailable' })
      return
    }
    dispatch({ type: 'commit_start', requestId })
    operationController.current?.abort()
    const controller = new AbortController()
    operationController.current = controller
    try {
      const result = await source.commit({
        ...confirming.change,
        requestId,
        confirmationToken: confirming.preview.confirmationToken,
      }, { signal: controller.signal })
      onCommitted(result)
      dispatch({ type: 'commit_success', result })
    } catch (error) {
      if (controller.signal.aborted) return
      dispatch({
        type: 'commit_error',
        code: error instanceof AdminConfigurationError ? error.code : 'configuration_unavailable',
      })
    }
  }

  const statusMessage = editor.status === 'success'
    ? `Saved configuration for ${SETTING_PRESENTATION[editor.result.settingKey].title} at revision ${editor.result.revision}. Trusted runtime-effective state was re-read from the server.`
    : editor.status === 'confirming' && editor.operation === 'saving'
      ? 'Saving the confirmed configuration change.'
      : editor.status === 'confirming' && editor.operation === 'error' && editor.errorCode
        ? configurationErrorMessage(editor.errorCode) : ''

  return (
    <div className="admin-configuration">
      <p className="admin-sr-only" aria-live="polite" aria-atomic="true">{statusMessage}</p>

      <section className="admin-config-notice" role="status" aria-labelledby="configuration-status-title">
        <span aria-hidden="true">!</span>
        <div>
          <h2 id="configuration-status-title">Runtime enforcement is partially available</h2>
          <p>Six settings are resolved and consumed by the trusted AI/TTS gateways. Cost thresholds remain saved-only until an authoritative alert consumer exists; Study guardian and safety policy is not bypassed.</p>
        </div>
      </section>

      <dl className="admin-config-summary" aria-label="Configuration authority summary">
        <div><dt>Saved configuration</dt><dd>Durable Admin registry</dd></div>
        <div><dt>Runtime effective / enforced state</dt><dd>{enforcementSummary}</dd></div>
        <div><dt>Integration</dt><dd>{projection.runtimeStatus === 'partial_runtime_enforcement'
          ? 'Partial runtime enforcement' : 'Unavailable'}</dd></div>
        <div><dt>Access</dt><dd>{canManage ? 'Manage capability confirmed' : 'Read only'}</dd></div>
      </dl>

      {!canManage && (
        <p className="admin-config-readonly" role="note">
          Read only. The server-resolved session does not include <code>configuration:manage</code>.
        </p>
      )}

      {GROUPS.map(([group, title, description]) => (
        <section className="admin-config-group" aria-labelledby={`configuration-${group}`} key={group}>
          <div className="admin-config-group__heading">
            <div><p>Authoritative stored values</p><h2 id={`configuration-${group}`}>{title}</h2></div>
            <span>{description}</span>
          </div>
          <div className="admin-config-grid">
            {projection.settings
              .filter((setting) => SETTING_PRESENTATION[setting.key].group === group)
              .map((setting) => (
                <ConfigurationSettingCard
                  key={setting.key}
                  setting={setting}
                  projection={projection}
                  canManage={canManage}
                  editor={editor}
                  dispatch={dispatch}
                  onPreview={previewChange}
                  onCommit={commitChange}
                  onReload={() => {
                    dispatch({ type: 'cancel' })
                    onRetry()
                  }}
                />
              ))}
          </div>
        </section>
      ))}

      <UnsupportedConfigurationAreas voiceCatalog={voiceCatalog} />
    </div>
  )
}

function ConfigurationSettingCard({
  setting,
  projection,
  canManage,
  editor,
  dispatch,
  onPreview,
  onCommit,
  onReload,
}: {
  readonly setting: AdminRuntimeConfigurationSetting
  readonly projection: AdminRuntimeConfigurationProjection
  readonly canManage: boolean
  readonly editor: AdminConfigurationEditorState
  readonly dispatch: (action: AdminConfigurationEditorAction) => void
  readonly onPreview: (state: EditingState) => void
  readonly onCommit: (state: ConfirmingState) => void
  readonly onReload: () => void
}) {
  const presentation = SETTING_PRESENTATION[setting.key]
  const editorId = useId()
  const active = (editor.status === 'editing' || editor.status === 'confirming')
    && editor.setting.key === setting.key
  const success = editor.status === 'success' && editor.result.settingKey === setting.key
  return (
    <article className={`admin-config-card ${active ? 'is-editing' : ''}`}>
      <div className="admin-config-card__heading">
        <div><h3>{presentation.title}</h3><p>{presentation.description}</p></div>
        <span className={`admin-config-severity admin-config-severity--${setting.warningLevel}`}>
          {setting.warningLevel}
        </span>
      </div>
      <dl className="admin-config-facts">
        <div><dt>Saved configuration</dt><dd>{formatAdminConfigurationValue(setting.key, setting.value)}</dd></div>
        <div><dt>Runtime effective value</dt><dd>{setting.runtime.effectiveValue === null
          ? 'Unavailable'
          : formatAdminConfigurationValue(setting.key, setting.runtime.effectiveValue)}</dd></div>
        <div><dt>Classification</dt><dd>{setting.runtime.classification}</dd></div>
        <div><dt>Enforcement</dt><dd>{runtimeEnforcementLabel(setting)}</dd></div>
        <div><dt>Resolution</dt><dd>{runtimeResolutionLabel(setting)}</dd></div>
        <div><dt>Reason</dt><dd>{runtimeReasonLabel(setting)}</dd></div>
        <div><dt>Trusted consumer</dt><dd>{trustedConsumerLabel(setting)}</dd></div>
        <div><dt>Study effective settings</dt><dd>{studyStatusLabel(setting)}</dd></div>
        <div><dt>Source</dt><dd>Registry revision {setting.revision}</dd></div>
      </dl>

      {success && (
        <div className="admin-config-success" role="status">
          <strong>Saved configuration at revision {editor.result.revision}</strong>
          <span>The authoritative audit was committed atomically. The runtime-effective state shown above was re-read from the trusted server; no browser-submitted status was assumed.</span>
        </div>
      )}

      {!active && canManage && (
        <button
          type="button"
          className="admin-config-secondary"
          disabled={editor.status === 'editing' || editor.status === 'confirming'}
          aria-describedby={editorId}
          onClick={() => dispatch({ type: 'edit', setting })}
        >Edit stored value</button>
      )}
      <span id={editorId} className="admin-sr-only">Editing creates a validated preview before save.</span>

      {active && editor.status === 'editing' && (
        <form
          className="admin-config-editor"
          onSubmit={(event) => {
            event.preventDefault()
            void onPreview(editor)
          }}
        >
          <DraftControl state={editor} projection={projection} dispatch={dispatch} />
          <label className="admin-config-field">
            <span>Reason</span>
            <select
              value={editor.reasonCode}
              onChange={(event) => dispatch({
                type: 'reason', reasonCode: event.target.value as AdminConfigurationReasonCode,
              })}
              disabled={editor.operation === 'previewing'}
            >
              {ADMIN_CONFIGURATION_REASON_OPTIONS.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          {editor.error && <p className="admin-config-error" role="alert">{editor.error}</p>}
          <div className="admin-config-actions">
            <button type="submit" disabled={editor.operation === 'previewing'}>
              {editor.operation === 'previewing' ? 'Validating change…' : 'Preview change'}
            </button>
            <button type="button" className="admin-config-secondary" onClick={() => dispatch({ type: 'cancel' })}>Cancel</button>
          </div>
        </form>
      )}

      {active && editor.status === 'confirming' && (
        <div className="admin-config-confirmation">
          <h4>Review before saving</h4>
          <dl>
            <div><dt>Before</dt><dd>{formatAdminConfigurationValue(setting.key, editor.preview.currentValue)}</dd></div>
            <div><dt>After</dt><dd>{formatAdminConfigurationValue(setting.key, editor.preview.newValue)}</dd></div>
            <div><dt>Expected revision</dt><dd>{editor.preview.expectedRevision}</dd></div>
            <div><dt>Confirmation expires</dt><dd>{formatConfirmationExpiry(editor.preview.confirmationExpiresAt)}</dd></div>
          </dl>
          <p className="admin-config-confirmation__warning">
            {editor.preview.warningLevel === 'critical' ? 'Critical change. ' : ''}
            Saving stores and audits this value. The trusted resolver will apply deployment and stronger subsystem constraints before a runtime consumer uses it.
          </p>
          {editor.operation === 'error' && editor.errorCode && (
            <div className="admin-config-error" role="alert">
              <strong>Save not confirmed.</strong> {configurationErrorMessage(editor.errorCode)}
            </div>
          )}
          <div className="admin-config-actions">
            {editor.operation !== 'error' && (
              <button
                type="button"
                disabled={editor.operation === 'saving'}
                onClick={() => void onCommit(editor)}
              >{editor.operation === 'saving' ? 'Saving…' : 'Save confirmed change'}</button>
            )}
            {editor.operation === 'error' && editor.errorCode
              && isRetryableCommitError(editor.errorCode) && (
                <button type="button" onClick={() => void onCommit(editor)}>Retry save</button>
              )}
            {editor.operation === 'error' && editor.errorCode
              && ['revision_conflict', 'idempotency_conflict'].includes(editor.errorCode) && (
                <button type="button" onClick={onReload}>Reload current values</button>
              )}
            {editor.operation === 'error' && editor.errorCode
              && !isRetryableCommitError(editor.errorCode)
              && !['revision_conflict', 'idempotency_conflict'].includes(editor.errorCode) && (
                <button type="button" onClick={() => dispatch({ type: 'preview_again' })}>Preview again</button>
              )}
            <button
              type="button"
              className="admin-config-secondary"
              disabled={editor.operation === 'saving'}
              onClick={() => dispatch({ type: 'cancel' })}
            >Cancel</button>
          </div>
        </div>
      )}
    </article>
  )
}

function DraftControl({
  state,
  projection,
  dispatch,
}: {
  readonly state: EditingState
  readonly projection: AdminConfigurationProjection
  readonly dispatch: (action: AdminConfigurationEditorAction) => void
}) {
  const key = state.setting.key
  const disabled = state.operation === 'previewing'
  if (key === 'runtime.ai.enabled' || key === 'runtime.tts.enabled') {
    return (
      <label className="admin-config-field"><span>New stored desired state</span>
        <select
          value={String(state.draft)}
          disabled={disabled}
          onChange={(event) => dispatch({ type: 'draft', draft: event.target.value === 'true' })}
        ><option value="false">Disabled</option><option value="true">Enabled</option></select>
      </label>
    )
  }
  if (key === 'quota.ai.requests_per_account_day' || key === 'quota.tts.requests_per_account_day') {
    const maximum = key === 'quota.ai.requests_per_account_day' ? 200 : 1000
    return (
      <label className="admin-config-field"><span>New daily requests per account</span>
        <input
          type="number" min="1" max={maximum} step="1" inputMode="numeric"
          value={state.draft as string} disabled={disabled}
          onChange={(event) => dispatch({ type: 'draft', draft: event.target.value })}
        />
        <small>Allowed range: 1–{maximum.toLocaleString('en-US')}.</small>
      </label>
    )
  }
  if (key === 'cost.warning.monthly_micros' || key === 'cost.critical.monthly_micros') {
    return (
      <label className="admin-config-field"><span>New monthly amount (USD)</span>
        <input
          type="text" inputMode="decimal" value={state.draft as string} disabled={disabled}
          aria-describedby={`${key}-money-help`}
          onChange={(event) => dispatch({ type: 'draft', draft: event.target.value })}
        />
        <small id={`${key}-money-help`}>Exact amount, up to six decimal places; maximum $1,000,000.</small>
      </label>
    )
  }
  if (key === 'ai.approved_tiers') {
    const selected = state.draft as readonly AdminAiTier[]
    return (
      <fieldset className="admin-config-fieldset" disabled={disabled}>
        <legend>New approved logical tiers</legend>
        {(['sonnet', 'haiku'] as const).map((tier) => (
          <label key={tier}>
            <input
              type="checkbox" checked={selected.includes(tier)}
              onChange={(event) => dispatch({
                type: 'draft',
                draft: event.target.checked
                  ? [...selected, tier]
                  : selected.filter((candidate) => candidate !== tier),
              })}
            /> {tier[0].toUpperCase() + tier.slice(1)}
          </label>
        ))}
      </fieldset>
    )
  }
  const approved = projection.settings.find((setting) => setting.key === 'ai.approved_tiers')
  const tiers = Array.isArray(approved?.value) ? approved.value : []
  return (
    <label className="admin-config-field"><span>New default logical tier</span>
      <select
        value={state.draft as string} disabled={disabled}
        onChange={(event) => dispatch({ type: 'draft', draft: event.target.value })}
      >{tiers.map((tier) => <option value={tier} key={tier}>{tier[0].toUpperCase() + tier.slice(1)}</option>)}</select>
    </label>
  )
}

function UnsupportedConfigurationAreas({ voiceCatalog }: { readonly voiceCatalog: AdminVoiceCatalogReadState }) {
  return (
    <section className="admin-config-unsupported" aria-labelledby="unsupported-configuration-title">
      <div className="admin-config-group__heading">
        <div><p>Unavailable authorities</p><h2 id="unsupported-configuration-title">Not yet operational</h2></div>
        <span>No substitute persistence or client-only authority is used.</span>
      </div>
      <div className="admin-config-grid">
        <article className="admin-config-card">
          <div className="admin-config-card__heading"><div>
            <h3>Study defaults</h3>
            <p>No Admin Study effective-settings V2 authority is present.</p>
          </div><span className="admin-config-severity">unavailable</span></div>
          <p className="admin-config-unavailable-copy">Not editable. Guardian choices and safety authority are not read, written, or overridden by this page.</p>
        </article>
        <VoiceCatalogCard state={voiceCatalog} />
      </div>
    </section>
  )
}

function VoiceCatalogCard({ state }: { readonly state: AdminVoiceCatalogReadState }) {
  if (state.status === 'loading') {
    return (
      <article className="admin-config-card" aria-busy="true">
        <div className="admin-config-card__heading"><div><h3>TTS voice defaults</h3><p>Loading the sanitized logical-voice catalog.</p></div></div>
      </article>
    )
  }
  const { catalog } = state
  const operationalDefault = catalog.voices.find((voice) => (
    voice.voiceRef === catalog.defaultVoiceRef
    && voice.status === 'active'
    && voice.deploymentAvailable
  )) ?? null
  return (
    <article className="admin-config-card">
      <div className="admin-config-card__heading"><div>
        <h3>TTS voice defaults</h3>
        <p>Logical catalog visibility only; no Admin voice-default setting is registered.</p>
      </div><span className="admin-config-severity">unavailable</span></div>
      <label className="admin-config-field">
        <span>Current catalog default (read only)</span>
        <select disabled value={operationalDefault?.voiceRef ?? ''}>
          <option value="">No operational logical default</option>
          {catalog.voices.map((voice) => (
            <option
              key={`${voice.voiceRef}:${voice.voiceVersion}`}
              value={voice.voiceRef}
              disabled={!voiceIsOperational(voice)}
            >{voice.displayLabel} ({voice.voiceVersion}) — {voiceStatusLabel(voice)}</option>
          ))}
        </select>
      </label>
      {catalog.voices.length > 0 ? (
        <ul className="admin-config-voice-list" aria-label="Logical TTS voice status">
          {catalog.voices.map((voice) => (
            <li key={`${voice.voiceRef}:${voice.voiceVersion}`}>
              <div><strong>{voice.displayLabel}</strong><code>{voice.voiceRef} · {voice.voiceVersion}</code></div>
              <span>{voiceStatusLabel(voice)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-config-unavailable-copy">No approved premium logical voices are available. Browser-native speech remains the safe production fallback. Provider identifiers and credentials are never exposed.</p>
      )}
      <p className="admin-config-unavailable-copy">Not editable until an authoritative Admin logical-voice setting exists.</p>
    </article>
  )
}

function voiceIsOperational(voice: PublicVoiceCatalogEntry): boolean {
  return voice.status === 'active' && voice.deploymentAvailable
}

function runtimeEnforcementLabel(setting: AdminRuntimeConfigurationSetting): string {
  if (setting.runtime.enforcement === 'enforced') return 'Enforced'
  if (setting.runtime.enforcement === 'error') return 'Error'
  return 'Unavailable'
}

function runtimeResolutionLabel(setting: AdminRuntimeConfigurationSetting): string {
  const { resolution, reason } = setting.runtime
  if (resolution === 'saved') return 'Saved'
  if (resolution === 'constraint') {
    return reason === 'deployment_disabled'
      ? 'Constraint — deployment disabled (saved/deployment conflict)'
      : 'Constraint — deployment quota ceiling (saved/deployment conflict)'
  }
  if (resolution === 'fallback') {
    if (reason === 'browser_speech_fallback') return 'Fallback — browser speech fallback'
    if (reason === 'safe_fallback_quota_ceiling') return 'Fallback — safe quota ceiling'
    return 'Fallback — safe disabled state'
  }
  if (resolution === 'error') return 'Error — configuration resolution failed'
  return 'Unavailable — runtime consumer unavailable'
}

function runtimeReasonLabel(setting: AdminRuntimeConfigurationSetting): string {
  return setting.runtime.reason.split('_').join(' ')
}

function trustedConsumerLabel(setting: AdminRuntimeConfigurationSetting): string {
  if (setting.runtime.trustedConsumer === 'anthropic_gateway') return 'Anthropic gateway'
  if (setting.runtime.trustedConsumer === 'tts_gateway') return 'TTS gateway'
  return 'Unavailable'
}

function studyStatusLabel(setting: AdminRuntimeConfigurationSetting): string {
  return setting.runtime.studyStatus === 'unavailable'
    ? 'Unavailable — no Study effective-settings authority'
    : 'Not applicable — runtime enforcement unavailable'
}

function voiceStatusLabel(voice: PublicVoiceCatalogEntry): string {
  if (voice.status === 'revoked') return 'Revoked · unavailable'
  if (voice.status === 'disabled') return 'Disabled · unavailable'
  if (voice.status === 'legacy') return 'Legacy · unavailable'
  return voice.deploymentAvailable ? 'Active · deployment available' : 'Active · deployment unavailable'
}

function ConfigurationState({
  title,
  message,
  busy = false,
  onRetry,
}: {
  readonly title: string
  readonly message: string
  readonly busy?: boolean
  readonly onRetry?: () => void
}) {
  return (
    <section className="admin-config-state" aria-live="polite" aria-busy={busy}>
      <span aria-hidden="true">{busy ? '…' : '!'}</span>
      <h2>{title}</h2><p>{message}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </section>
  )
}

function createConfigurationRequestId(): string {
  const id = globalThis.crypto?.randomUUID?.()
  if (!id) throw new Error('request_id_unavailable')
  return id
}

function formatConfirmationExpiry(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))
}

function isRetryableCommitError(code: AdminConfigurationErrorCode): boolean {
  return code === 'configuration_timeout'
    || code === 'configuration_unavailable'
    || code === 'request_in_progress'
}

export function configurationErrorMessage(code: AdminConfigurationErrorCode): string {
  if (code === 'revision_conflict') return 'Another operator saved this setting first. Reload current values before editing again.'
  if (code === 'idempotency_conflict') return 'The save request conflicted with an existing request. Reload current values.'
  if (code === 'confirmation_expired') return 'The change preview expired. Preview the change again.'
  if (code === 'confirmation_reused' || code === 'confirmation_invalid' || code === 'confirmation_mismatch') {
    return 'The confirmation can no longer be used. Preview the change again.'
  }
  if (code === 'cross_setting_invalid') return 'This value conflicts with another current configuration value.'
  if (code === 'value_invalid' || code === 'unknown_key' || code === 'invalid_request') {
    return 'The server rejected this configuration value. Review it and preview again.'
  }
  if (code === 'configuration_unauthorized') return 'Configuration management authorization is no longer available.'
  if (code === 'configuration_timeout') return 'The configuration request timed out. Its result is not assumed.'
  if (code === 'request_in_progress') return 'The authoritative save is still in progress. Retry with the same request.'
  return 'The configuration service is unavailable. No success is assumed.'
}
