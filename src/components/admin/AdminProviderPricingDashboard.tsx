import {
  cloneElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
} from 'react'
import {
  commitAdminProviderPricing,
  endAdminProviderPricing,
  previewAdminProviderPricing,
} from '../../admin/providerPricingHttpSource'
import {
  ANTHROPIC_PRICING_TIERS,
  ANTHROPIC_PRICING_UNITS,
  ELEVENLABS_PRICING_UNITS,
  EMPTY_PROVIDER_PRICING_DRAFT,
  PROVIDER_PRICING_REASON_CODES,
  draftForReplacement,
  formatExactInteger,
  formatExactUsdMicros,
  providerPricingErrorMessage,
  providerPricingTiming,
  utcDateTimeInputToIso,
  validateProviderPricingDraft,
  type ProviderPricingDraft,
  type ProviderPricingDraftErrors,
  type ProviderPricingEndRequest,
  type ProviderPricingErrorCode,
  type ProviderPricingMutationResult,
  type ProviderPricingPreview,
  type ProviderPricingReadState,
  type ProviderPricingReasonCode,
  type ProviderPricingTerm,
  type ProviderPricingTermRequest,
  type ProviderPricingTiming,
} from '../../admin/providerPricingModel'
import './admin-provider-pricing.css'

const PROVIDER_LABELS = { anthropic: 'Anthropic', elevenlabs: 'ElevenLabs' } as const
const UNIT_LABELS = {
  input_token: 'Input token',
  output_token: 'Output token',
  cached_input_read_token: 'Cached input read token',
  tts_character: 'TTS character',
  request: 'Request',
} as const
const REASON_LABELS: Readonly<Record<ProviderPricingReasonCode, string>> = {
  'operator.request': 'Operator request',
  'scheduled.change': 'Scheduled change',
  'corrective.action': 'Corrective action',
  'configuration.changed': 'Configuration changed',
}
const TIMING_LABELS: Readonly<Record<ProviderPricingTiming, string>> = {
  current: 'Current',
  scheduled: 'Scheduled',
  historical: 'Historical',
  disabled: 'Disabled',
}

export interface ProviderPricingMutationApi {
  readonly preview: (request: ProviderPricingTermRequest) => Promise<ProviderPricingPreview>
  readonly commit: (
    request: ProviderPricingTermRequest & {
      readonly expectedRevision: string
      readonly requestId: string
      readonly confirmationToken: string
    },
  ) => Promise<ProviderPricingMutationResult>
  readonly end: (request: ProviderPricingEndRequest) => Promise<ProviderPricingMutationResult>
}

const DEFAULT_MUTATION_API: ProviderPricingMutationApi = {
  preview: previewAdminProviderPricing,
  commit: commitAdminProviderPricing,
  end: endAdminProviderPricing,
}

export interface AdminProviderPricingDashboardProps {
  readonly readAuthorized: boolean
  readonly manageAuthorized: boolean
  readonly state: ProviderPricingReadState
  readonly onRetry?: () => void
  readonly onUpdated?: () => void
  readonly onBack?: () => void
  readonly now?: string
  readonly mutationApi?: ProviderPricingMutationApi
}

export interface PendingPreview {
  readonly request: ProviderPricingTermRequest
  readonly preview: ProviderPricingPreview
  readonly requestId: string
}

interface EndDraft {
  readonly term: ProviderPricingTerm
  readonly mode: '' | 'end' | 'disable'
  readonly effectiveUntil: string
  readonly reasonCode: '' | ProviderPricingReasonCode
}

interface EndDraftErrors {
  readonly mode?: string
  readonly effectiveUntil?: string
  readonly reasonCode?: string
}

export function AdminProviderPricingDashboard({
  readAuthorized,
  manageAuthorized,
  state,
  onRetry,
  onUpdated,
  onBack,
  now = new Date().toISOString(),
  mutationApi = DEFAULT_MUTATION_API,
}: AdminProviderPricingDashboardProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<ProviderPricingDraft>(EMPTY_PROVIDER_PRICING_DRAFT)
  const [draftErrors, setDraftErrors] = useState<ProviderPricingDraftErrors>({})
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null)
  const [endDraft, setEndDraft] = useState<EndDraft | null>(null)
  const [endErrors, setEndErrors] = useState<EndDraftErrors>({})
  const [pendingEnd, setPendingEnd] = useState<ProviderPricingEndRequest | null>(null)
  const [busy, setBusy] = useState<'preview' | 'commit' | 'end' | null>(null)
  const [mutationError, setMutationError] = useState<ProviderPricingErrorCode | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const termsById = useMemo(() => new Map(
    state.status === 'ready' ? state.model.terms.map((term) => [term.termId, term]) : [],
  ), [state])

  function resetMutationMessages() {
    setMutationError(null)
    setSuccess(null)
  }

  function startCreate() {
    resetMutationMessages()
    setDraft(EMPTY_PROVIDER_PRICING_DRAFT)
    setDraftErrors({})
    setPendingPreview(null)
    setEndDraft(null)
    setEditorOpen(true)
  }

  function startReplace(term: ProviderPricingTerm) {
    resetMutationMessages()
    setDraft(draftForReplacement(term))
    setDraftErrors({})
    setPendingPreview(null)
    setEndDraft(null)
    setEditorOpen(true)
  }

  function startEnd(term: ProviderPricingTerm) {
    resetMutationMessages()
    setEditorOpen(false)
    setPendingPreview(null)
    setEndErrors({})
    setPendingEnd(null)
    setEndDraft({ term, mode: '', effectiveUntil: '', reasonCode: '' })
  }

  async function requestPreview(event: FormEvent) {
    event.preventDefault()
    resetMutationMessages()
    const validation = validateProviderPricingDraft(draft)
    if (!validation.ok) {
      setDraftErrors(validation.errors)
      return
    }
    if (validation.request.replacesTermId) {
      const affected = termsById.get(validation.request.replacesTermId)
      if (!affected
        || validation.request.effectiveFrom <= now
        || validation.request.effectiveFrom <= affected.effectiveFrom
        || (affected.effectiveUntil !== null && validation.request.effectiveFrom >= affected.effectiveUntil)) {
        setDraftErrors({
          effectiveFrom: 'A replacement must start in the future, after the affected term starts, and before its existing end boundary.',
        })
        return
      }
    }
    const requestId = mutationRequestId()
    if (!requestId) {
      setMutationError('source_unavailable')
      return
    }
    setDraftErrors({})
    setBusy('preview')
    try {
      const preview = await mutationApi.preview(validation.request)
      setPendingPreview({ request: validation.request, preview, requestId })
    } catch (error) {
      setMutationError(errorCode(error))
    } finally {
      setBusy(null)
    }
  }

  async function commitPreview() {
    if (!manageAuthorized || !pendingPreview) return
    resetMutationMessages()
    setBusy('commit')
    try {
      const result = await mutationApi.commit({
        ...pendingPreview.request,
        expectedRevision: pendingPreview.preview.expectedRevision,
        requestId: pendingPreview.requestId,
        confirmationToken: pendingPreview.preview.confirmationToken,
      })
      setPendingPreview(null)
      setEditorOpen(false)
      setDraft(EMPTY_PROVIDER_PRICING_DRAFT)
      setSuccess(`Pricing revision ${result.revision} was committed with status ${result.status}.`)
      onUpdated?.()
    } catch (error) {
      const code = errorCode(error)
      setMutationError(code)
      if (['confirmation_expired', 'confirmation_reused', 'confirmation_mismatch', 'confirmation_invalid', 'revision_conflict', 'status_conflict', 'term_not_found'].includes(code)) {
        setPendingPreview(null)
      }
    } finally {
      setBusy(null)
    }
  }

  function reviewEnd(event: FormEvent) {
    event.preventDefault()
    resetMutationMessages()
    if (!endDraft) return
    const errors: { mode?: string; effectiveUntil?: string; reasonCode?: string } = {}
    const isFuture = new Date(endDraft.term.effectiveFrom).getTime() > new Date(now).getTime()
    if (!['end', 'disable'].includes(endDraft.mode)) {
      errors.mode = 'Choose whether to end or disable this term.'
    } else if (endDraft.mode === 'disable' && !isFuture) {
      errors.mode = 'Only an unused future term can be disabled.'
    }
    let effectiveUntil: string | null = null
    if (endDraft.mode === 'end') {
      effectiveUntil = utcDateTimeInputToIso(endDraft.effectiveUntil)
      if (!effectiveUntil) {
        errors.effectiveUntil = 'Enter a valid end date and time in UTC.'
      } else if (effectiveUntil <= now || effectiveUntil <= endDraft.term.effectiveFrom) {
        errors.effectiveUntil = 'The end boundary must be in the future and later than effective-from.'
      } else if (endDraft.term.effectiveUntil && effectiveUntil > endDraft.term.effectiveUntil) {
        errors.effectiveUntil = 'The new end boundary cannot extend the existing term interval.'
      }
    }
    if (!PROVIDER_PRICING_REASON_CODES.includes(endDraft.reasonCode as ProviderPricingReasonCode)) {
      errors.reasonCode = 'Choose a reason for ending or disabling this term.'
    }
    const requestId = mutationRequestId()
    if (Object.keys(errors).length > 0 || !endDraft.mode || !endDraft.reasonCode || !requestId) {
      setEndErrors(errors)
      if (!requestId) setMutationError('source_unavailable')
      return
    }
    setEndErrors({})
    setPendingEnd({
      termId: endDraft.term.termId,
      expectedRevision: endDraft.term.revision,
      mode: endDraft.mode,
      effectiveUntil,
      reasonCode: endDraft.reasonCode,
      requestId,
    })
  }

  async function commitEnd() {
    if (!manageAuthorized || !pendingEnd) return
    resetMutationMessages()
    setBusy('end')
    try {
      const result = await mutationApi.end(pendingEnd)
      setPendingEnd(null)
      setEndDraft(null)
      setSuccess(`Pricing revision ${result.revision} now has status ${result.status}.`)
      onUpdated?.()
    } catch (error) {
      const code = errorCode(error)
      setMutationError(code)
      if (['revision_conflict', 'status_conflict', 'term_not_found'].includes(code)) setPendingEnd(null)
    } finally {
      setBusy(null)
    }
  }

  if (!readAuthorized || state.status === 'unauthorized') {
    return (
      <section className="admin-pricing-message" role="alert">
        <p className="admin-pricing-eyebrow">Provider pricing</p>
        <h2>Pricing access unavailable</h2>
        <p>Provider pricing remains private because the server did not confirm costs:read access.</p>
      </section>
    )
  }

  if (state.status === 'idle' || state.status === 'loading') return <ProviderPricingLoading onBack={onBack} />
  if (state.status === 'error') {
    return (
      <div className="admin-pricing">
        <PricingHeader onBack={onBack} />
        <section className="admin-pricing-message" role="alert">
          <h2>Provider pricing could not be loaded</h2>
          <p>{providerPricingErrorMessage(state.code)}</p>
          {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
        </section>
      </div>
    )
  }
  if (state.status !== 'ready') return null

  const affectedTerm = pendingPreview?.request.replacesTermId
    ? termsById.get(pendingPreview.request.replacesTermId) ?? null : null
  const pendingEndTerm = pendingEnd ? termsById.get(pendingEnd.termId) ?? endDraft?.term ?? null : null

  return (
    <div className="admin-pricing">
      <PricingHeader onBack={onBack} />

      <section className="admin-pricing-support" aria-labelledby="pricing-support-title">
        <div>
          <p className="admin-pricing-eyebrow">Supported authority</p>
          <h2 id="pricing-support-title">Verified effective-dated terms only</h2>
          <p>Terms apply to one exact provider, product, model, logical tier, usage unit, and UTC interval. Historical records remain visible and are never rewritten.</p>
        </div>
        <div className="admin-pricing-support__notice">
          <strong>Anthropic cache-write pricing is unsupported</strong>
          <span>The runtime does not retain a trusted cache-write TTL split, so no cache-write control is offered and affected usage remains cost unavailable.</span>
        </div>
      </section>

      {!manageAuthorized && (
        <section className="admin-pricing-readonly" role="status">
          <strong>Read-only pricing access</strong>
          <span>You can inspect terms with costs:read. Creating, replacing, ending, or disabling terms requires configuration:manage and is rechecked by the server.</span>
        </section>
      )}
      {manageAuthorized && !editorOpen && !endDraft && (
        <button className="admin-pricing-primary" type="button" onClick={startCreate}>Add pricing term</button>
      )}
      {success && <section className="admin-pricing-success" role="status">{success}</section>}
      {mutationError && (
        <section className="admin-pricing-mutation-error" role="alert">
          <strong>Pricing change not saved</strong>
          <span>{providerPricingErrorMessage(mutationError)}</span>
          {onRetry && ['revision_conflict', 'status_conflict', 'term_not_found'].includes(mutationError)
            && <button type="button" onClick={onRetry}>Refresh terms</button>}
        </section>
      )}

      {manageAuthorized && editorOpen && !pendingPreview && (
        <ProviderPricingEditor
          draft={draft}
          errors={draftErrors}
          busy={busy === 'preview'}
          onChange={(next) => {
            setDraft(next)
            setDraftErrors({})
            setMutationError(null)
          }}
          onSubmit={requestPreview}
          onCancel={() => {
            setEditorOpen(false)
            setDraft(EMPTY_PROVIDER_PRICING_DRAFT)
            setDraftErrors({})
          }}
        />
      )}
      {manageAuthorized && endDraft && !pendingEnd && (
        <ProviderPricingEndEditor
          draft={endDraft}
          errors={endErrors}
          now={now}
          onChange={(next) => {
            setEndDraft(next)
            setEndErrors({})
            setMutationError(null)
          }}
          onSubmit={reviewEnd}
          onCancel={() => {
            setEndDraft(null)
            setEndErrors({})
          }}
        />
      )}

      <ProviderPricingTerms
        terms={state.model.terms}
        pricingStatus={state.model.pricingStatus}
        manageAuthorized={manageAuthorized}
        now={now}
        onReplace={startReplace}
        onEnd={startEnd}
      />

      {pendingPreview && (
        <ProviderPricingPreviewConfirmation
          pending={pendingPreview}
          affectedTerm={affectedTerm}
          busy={busy === 'commit'}
          error={mutationError}
          onConfirm={commitPreview}
          onCancel={() => {
            setPendingPreview(null)
            setMutationError(null)
          }}
        />
      )}
      {pendingEnd && pendingEndTerm && (
        <ProviderPricingEndConfirmation
          request={pendingEnd}
          term={pendingEndTerm}
          busy={busy === 'end'}
          error={mutationError}
          onConfirm={commitEnd}
          onCancel={() => {
            setPendingEnd(null)
            setMutationError(null)
          }}
        />
      )}
    </div>
  )
}

function PricingHeader({ onBack }: { readonly onBack?: () => void }) {
  return (
    <header className="admin-pricing-header">
      <div>
        <p className="admin-pricing-eyebrow">AI &amp; Costs / Provider Pricing</p>
        <h2>Provider Pricing</h2>
        <p>Manage exact verified USD terms used to calculate recorded marginal provider cost.</p>
      </div>
      {onBack && <button type="button" className="admin-pricing-secondary" onClick={onBack}>Back to AI &amp; Costs</button>}
    </header>
  )
}

function ProviderPricingLoading({ onBack }: { readonly onBack?: () => void }) {
  return (
    <div className="admin-pricing">
      <PricingHeader onBack={onBack} />
      <div className="admin-pricing-loading" aria-live="polite" aria-busy="true">
        <span className="admin-pricing-sr-only">Loading provider pricing terms</span>
        <div className="admin-pricing-skeleton admin-pricing-skeleton--wide" />
        <div className="admin-pricing-skeleton" />
      </div>
    </div>
  )
}

function ProviderPricingTerms({
  terms,
  pricingStatus,
  manageAuthorized,
  now,
  onReplace,
  onEnd,
}: {
  readonly terms: readonly ProviderPricingTerm[]
  readonly pricingStatus: 'pricing_unconfigured' | 'configured'
  readonly manageAuthorized: boolean
  readonly now: string
  readonly onReplace: (term: ProviderPricingTerm) => void
  readonly onEnd: (term: ProviderPricingTerm) => void
}) {
  if (pricingStatus === 'pricing_unconfigured') {
    return (
      <section className="admin-pricing-empty" role="status">
        <p className="admin-pricing-eyebrow">No verified terms</p>
        <h2>Pricing not configured</h2>
        <p>Admin Costs cannot calculate provider cost for affected usage until verified pricing is configured. No price is assumed or seeded.</p>
      </section>
    )
  }
  const groups = ([
    ['current', 'Current effective terms'],
    ['scheduled', 'Future effective terms'],
    ['historical', 'Historical terms'],
    ['disabled', 'Disabled future terms'],
  ] as const).map(([timing, title]) => ({
    timing,
    title,
    terms: terms.filter((term) => providerPricingTiming(term, now) === timing),
  })).filter((group) => group.terms.length > 0)

  return (
    <div className="admin-pricing-term-groups">
      {groups.map((group) => (
        <section className="admin-pricing-panel" aria-labelledby={`pricing-${group.timing}-title`} key={group.timing}>
          <header className="admin-pricing-section-heading">
            <p>{TIMING_LABELS[group.timing]}</p>
            <h2 id={`pricing-${group.timing}-title`}>{group.title}</h2>
          </header>
          <div className="admin-pricing-table-wrap">
            <table>
              <caption>{group.title} by exact provider pricing dimension</caption>
              <thead>
                <tr>
                  <th scope="col">Dimension</th>
                  <th scope="col">Exact price</th>
                  <th scope="col">Effective interval (UTC)</th>
                  <th scope="col">Revision / status</th>
                  {manageAuthorized && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>{group.terms.map((term) => (
                <tr key={term.termId}>
                  <th scope="row"><DimensionSummary term={term} /></th>
                  <td className="admin-pricing-price">
                    <strong>{formatExactUsdMicros(term.priceMicrosPerUnitSize)}</strong>
                    <span>USD per {formatExactInteger(term.unitSize)} {unitPlural(term.usageUnit, term.unitSize)}</span>
                  </td>
                  <td><EffectiveInterval term={term} /></td>
                  <td>
                    <span className={`admin-pricing-status admin-pricing-status--${term.status}`}>{term.status}</span>
                    <span>Revision {term.revision}</span>
                    <span>Verification {term.verificationRef}</span>
                  </td>
                  {manageAuthorized && (
                    <td className="admin-pricing-actions">
                      {term.status === 'published' ? (
                        <>
                          <button type="button" onClick={() => onReplace(term)}>Replace</button>
                          <button type="button" onClick={() => onEnd(term)}>End / disable</button>
                        </>
                      ) : <span>No available mutation</span>}
                    </td>
                  )}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

export function ProviderPricingEditor({
  draft,
  errors,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  readonly draft: ProviderPricingDraft
  readonly errors: ProviderPricingDraftErrors
  readonly busy: boolean
  readonly onChange: (draft: ProviderPricingDraft) => void
  readonly onSubmit: (event: FormEvent) => void
  readonly onCancel: () => void
}) {
  const editorRef = useRef<HTMLElement>(null)
  const replacement = draft.replacesTermId !== null
  const units = draft.provider === 'anthropic'
    ? ANTHROPIC_PRICING_UNITS
    : draft.provider === 'elevenlabs' ? ELEVENLABS_PRICING_UNITS : []
  const field = (name: keyof ProviderPricingDraft, value: string | null) => {
    onChange({ ...draft, [name]: value })
  }
  useEffect(() => {
    editorRef.current?.querySelector<HTMLElement>('select:not([disabled]), input:not([disabled])')?.focus()
  }, [])
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      editorRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    }
  }, [errors])
  return (
    <section className="admin-pricing-editor" aria-labelledby="pricing-editor-title" ref={editorRef}>
      <p className="admin-pricing-eyebrow">Preview required</p>
      <h2 id="pricing-editor-title">{replacement ? 'Replace pricing term' : 'Create pricing term'}</h2>
      <p>Enter verified terms only. The exact price is never prefilled; review the server preview before committing.</p>
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={busy}>
          <legend>Exact pricing dimension</legend>
          <div className="admin-pricing-form-grid">
            <PricingField label="Provider" error={errors.provider}>
              <select value={draft.provider} onChange={(event) => onChange({
                ...draft,
                provider: event.target.value as ProviderPricingDraft['provider'],
                logicalModelTier: '',
                usageUnit: '',
              })} disabled={replacement} aria-invalid={Boolean(errors.provider)}>
                <option value="">Choose provider</option>
                <option value="anthropic">Anthropic</option>
                <option value="elevenlabs">ElevenLabs</option>
              </select>
            </PricingField>
            <PricingField label="Provider product ID" error={errors.providerProductId}>
              <input value={draft.providerProductId} maxLength={120} disabled={replacement} onChange={(event) => field('providerProductId', event.target.value)} aria-invalid={Boolean(errors.providerProductId)} />
            </PricingField>
            <PricingField label="Provider model ID" error={errors.providerModelId}>
              <input value={draft.providerModelId} maxLength={120} disabled={replacement} onChange={(event) => field('providerModelId', event.target.value)} aria-invalid={Boolean(errors.providerModelId)} />
            </PricingField>
            <PricingField label="Logical model tier" error={errors.logicalModelTier}>
              {draft.provider === 'elevenlabs' ? (
                <input value="Not applicable" disabled />
              ) : (
                <select value={draft.logicalModelTier} disabled={replacement} onChange={(event) => field('logicalModelTier', event.target.value)} aria-invalid={Boolean(errors.logicalModelTier)}>
                  <option value="">Choose tier</option>
                  {ANTHROPIC_PRICING_TIERS.map((tier) => <option value={tier} key={tier}>{tier}</option>)}
                </select>
              )}
            </PricingField>
            <PricingField label="Usage unit" error={errors.usageUnit}>
              <select value={draft.usageUnit} disabled={replacement || !draft.provider} onChange={(event) => field('usageUnit', event.target.value)} aria-invalid={Boolean(errors.usageUnit)}>
                <option value="">Choose unit</option>
                {units.map((unit) => <option value={unit} key={unit}>{UNIT_LABELS[unit]}</option>)}
              </select>
            </PricingField>
            <PricingField label="Exact price (USD)" hint="Plain USD digits, with up to six decimal places." error={errors.exactUsd}>
              <input inputMode="decimal" autoComplete="off" value={draft.exactUsd} onChange={(event) => field('exactUsd', event.target.value)} aria-invalid={Boolean(errors.exactUsd)} />
            </PricingField>
            <PricingField label="Unit size" hint="Whole units; do not use commas." error={errors.unitSize}>
              <input inputMode="numeric" autoComplete="off" value={draft.unitSize} onChange={(event) => field('unitSize', event.target.value)} aria-invalid={Boolean(errors.unitSize)} />
            </PricingField>
            <PricingField label="Effective from (UTC)" error={errors.effectiveFrom}>
              <input type="datetime-local" value={draft.effectiveFrom} onChange={(event) => field('effectiveFrom', event.target.value)} aria-invalid={Boolean(errors.effectiveFrom)} />
            </PricingField>
            <PricingField label="Effective until (UTC, optional)" error={errors.effectiveUntil}>
              <input type="datetime-local" value={draft.effectiveUntil} onChange={(event) => field('effectiveUntil', event.target.value)} aria-invalid={Boolean(errors.effectiveUntil)} />
            </PricingField>
            <PricingField label="Verification reference" hint="Use an internal verified reference; never paste a URL or secret." error={errors.verificationRef}>
              <input value={draft.verificationRef} maxLength={128} autoComplete="off" onChange={(event) => field('verificationRef', event.target.value)} aria-invalid={Boolean(errors.verificationRef)} />
            </PricingField>
            <PricingField label="Reason" error={errors.reasonCode}>
              <select value={draft.reasonCode} onChange={(event) => field('reasonCode', event.target.value)} aria-invalid={Boolean(errors.reasonCode)}>
                <option value="">Choose reason</option>
                {PROVIDER_PRICING_REASON_CODES.map((reason) => <option value={reason} key={reason}>{REASON_LABELS[reason]}</option>)}
              </select>
            </PricingField>
          </div>
        </fieldset>
        <div className="admin-pricing-form-actions">
          <button className="admin-pricing-primary" type="submit" disabled={busy}>{busy ? 'Generating preview…' : 'Preview term'}</button>
          <button className="admin-pricing-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </form>
    </section>
  )
}

function ProviderPricingEndEditor({
  draft,
  errors,
  now,
  onChange,
  onSubmit,
  onCancel,
}: {
  readonly draft: EndDraft
  readonly errors: EndDraftErrors
  readonly now: string
  readonly onChange: (draft: EndDraft) => void
  readonly onSubmit: (event: FormEvent) => void
  readonly onCancel: () => void
}) {
  const future = new Date(draft.term.effectiveFrom).getTime() > new Date(now).getTime()
  return (
    <section className="admin-pricing-editor" aria-labelledby="pricing-end-title">
      <p className="admin-pricing-eyebrow">Confirmation required</p>
      <h2 id="pricing-end-title">End or disable a pricing term</h2>
      <DimensionSummary term={draft.term} />
      <p>{formatExactUsdMicros(draft.term.priceMicrosPerUnitSize)} USD per {formatExactInteger(draft.term.unitSize)} {unitPlural(draft.term.usageUnit, draft.term.unitSize)}.</p>
      <form onSubmit={onSubmit} noValidate>
        <fieldset>
          <legend>Requested consequence</legend>
          <PricingField label="Action" error={errors.mode}>
            <select value={draft.mode} onChange={(event) => onChange({ ...draft, mode: event.target.value as EndDraft['mode'], effectiveUntil: '' })} aria-invalid={Boolean(errors.mode)}>
              <option value="">Choose action</option>
              <option value="end">End at a UTC boundary</option>
              {future && <option value="disable">Disable unused future term</option>}
            </select>
          </PricingField>
          {draft.mode === 'end' && (
            <PricingField label="Effective until (UTC)" error={errors.effectiveUntil}>
              <input type="datetime-local" value={draft.effectiveUntil} onChange={(event) => onChange({ ...draft, effectiveUntil: event.target.value })} aria-invalid={Boolean(errors.effectiveUntil)} />
            </PricingField>
          )}
          <PricingField label="Reason" error={errors.reasonCode}>
            <select value={draft.reasonCode} onChange={(event) => onChange({ ...draft, reasonCode: event.target.value as EndDraft['reasonCode'] })} aria-invalid={Boolean(errors.reasonCode)}>
              <option value="">Choose reason</option>
              {PROVIDER_PRICING_REASON_CODES.map((reason) => <option value={reason} key={reason}>{REASON_LABELS[reason]}</option>)}
            </select>
          </PricingField>
        </fieldset>
        <div className="admin-pricing-form-actions">
          <button className="admin-pricing-danger" type="submit">Review consequence</button>
          <button className="admin-pricing-secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  )
}

export function ProviderPricingPreviewConfirmation({
  pending,
  affectedTerm,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  readonly pending: PendingPreview
  readonly affectedTerm: ProviderPricingTerm | null
  readonly busy: boolean
  readonly error: ProviderPricingErrorCode | null
  readonly onConfirm: () => void
  readonly onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)
  const { preview } = pending
  return (
    <div className="admin-pricing-dialog-backdrop">
      <div className="admin-pricing-dialog" role="dialog" aria-modal="true" aria-labelledby="pricing-preview-title" tabIndex={-1} ref={dialogRef} onKeyDown={(event) => handleDialogKey(event, busy, onCancel)}>
        <p className="admin-pricing-eyebrow">Preview → confirm → commit</p>
        <h2 id="pricing-preview-title">Confirm {preview.operation === 'replace' ? 'replacement' : 'new pricing term'}</h2>
        <dl className="admin-pricing-confirmation-list">
          <div><dt>Dimension</dt><dd><DimensionSummary term={preview.term} /></dd></div>
          <div><dt>Effective date</dt><dd><time dateTime={preview.term.effectiveFrom}>{formatUtc(preview.term.effectiveFrom)}</time>{preview.term.effectiveUntil && <> until <time dateTime={preview.term.effectiveUntil}>{formatUtc(preview.term.effectiveUntil)}</time></>}</dd></div>
          <div><dt>Current term affected</dt><dd>{affectedTerm ? <>{formatExactUsdMicros(affectedTerm.priceMicrosPerUnitSize)} · revision {affectedTerm.revision} · {affectedTerm.status}</> : 'None — this creates a term without replacing another term.'}</dd></div>
          <div><dt>Proposed exact price</dt><dd><strong>{formatExactUsdMicros(preview.term.priceMicrosPerUnitSize)}</strong> USD per {formatExactInteger(preview.term.unitSize)} {unitPlural(preview.term.usageUnit, preview.term.unitSize)}</dd></div>
          <div><dt>Revision</dt><dd>{preview.expectedRevision} → {preview.newRevision}</dd></div>
          <div><dt>Consequence</dt><dd>{preview.operation === 'replace'
            ? 'The affected published term will end at the proposed effective-from boundary, and the new revision will apply from that boundary.'
            : 'A new published term will become eligible only within the proposed effective interval.'}</dd></div>
        </dl>
        <p className="admin-pricing-expiry">Confirmation expires <time dateTime={preview.confirmationExpiresAt}>{formatUtc(preview.confirmationExpiresAt)}</time>.</p>
        {error && <p className="admin-pricing-inline-error" role="alert">{providerPricingErrorMessage(error)}</p>}
        <div className="admin-pricing-form-actions">
          <button className="admin-pricing-primary" type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Committing…' : 'Confirm and commit'}</button>
          <button className="admin-pricing-secondary" type="button" disabled={busy} onClick={onCancel}>Back to edit</button>
        </div>
      </div>
    </div>
  )
}

export function ProviderPricingEndConfirmation({
  request,
  term,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  readonly request: ProviderPricingEndRequest
  readonly term: ProviderPricingTerm
  readonly busy: boolean
  readonly error: ProviderPricingErrorCode | null
  readonly onConfirm: () => void
  readonly onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)
  return (
    <div className="admin-pricing-dialog-backdrop">
      <div className="admin-pricing-dialog" role="dialog" aria-modal="true" aria-labelledby="pricing-end-confirm-title" tabIndex={-1} ref={dialogRef} onKeyDown={(event) => handleDialogKey(event, busy, onCancel)}>
        <p className="admin-pricing-eyebrow">Deliberate confirmation</p>
        <h2 id="pricing-end-confirm-title">Confirm term {request.mode}</h2>
        <dl className="admin-pricing-confirmation-list">
          <div><dt>Dimension</dt><dd><DimensionSummary term={term} /></dd></div>
          <div><dt>Current term affected</dt><dd>Revision {term.revision} · {term.status} · {formatExactUsdMicros(term.priceMicrosPerUnitSize)}</dd></div>
          <div><dt>Effective date</dt><dd>{request.effectiveUntil ? <time dateTime={request.effectiveUntil}>{formatUtc(request.effectiveUntil)}</time> : 'The future term will never become effective.'}</dd></div>
          <div><dt>Consequence</dt><dd>{request.mode === 'disable'
            ? 'The unused future term will be marked disabled. It remains in history and no replacement price is created.'
            : 'The term will stop applying at this half-open interval boundary. Affected usage after the boundary will have unavailable cost unless another verified term applies.'}</dd></div>
        </dl>
        {error && <p className="admin-pricing-inline-error" role="alert">{providerPricingErrorMessage(error)}</p>}
        <div className="admin-pricing-form-actions">
          <button className="admin-pricing-danger" type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : `Confirm ${request.mode}`}</button>
          <button className="admin-pricing-secondary" type="button" disabled={busy} onClick={onCancel}>Back</button>
        </div>
      </div>
    </div>
  )
}

function PricingField({
  label,
  hint,
  error,
  children,
}: {
  readonly label: string
  readonly hint?: string
  readonly error?: string
  readonly children: ReactElement<{ readonly id?: string; readonly 'aria-describedby'?: string }>
}) {
  const inputId = useId()
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="admin-pricing-field">
      <label htmlFor={inputId}>{label}</label>
      {cloneElement(children, { id: inputId, 'aria-describedby': describedBy })}
      {hint && <small id={hintId}>{hint}</small>}
      {error && <strong id={errorId} role="alert">{error}</strong>}
    </div>
  )
}

function DimensionSummary({ term }: { readonly term: Pick<ProviderPricingTerm, 'provider' | 'providerProductId' | 'providerModelId' | 'logicalModelTier' | 'usageUnit'> | ProviderPricingPreview['term'] }) {
  return (
    <span className="admin-pricing-dimension">
      <strong>{PROVIDER_LABELS[term.provider]} · {term.providerProductId}</strong>
      <span>Model {term.providerModelId}</span>
      <span>{term.logicalModelTier ? `Tier ${term.logicalModelTier}` : 'No logical tier'} · {UNIT_LABELS[term.usageUnit]}</span>
    </span>
  )
}

function EffectiveInterval({ term }: { readonly term: ProviderPricingTerm }) {
  return (
    <span className="admin-pricing-interval">
      <span>From <time dateTime={term.effectiveFrom}>{formatUtc(term.effectiveFrom)}</time></span>
      <span>{term.effectiveUntil ? <>Until <time dateTime={term.effectiveUntil}>{formatUtc(term.effectiveUntil)}</time></> : 'No scheduled end'}</span>
    </span>
  )
}

function unitPlural(unit: keyof typeof UNIT_LABELS, unitSize: string): string {
  const label = UNIT_LABELS[unit].toLowerCase()
  return unitSize === '1' ? label : `${label}s`
}

function formatUtc(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC'
}

function useDialogFocus(dialogRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    return () => previous?.focus()
  }, [dialogRef])
}

function handleDialogKey(event: KeyboardEvent<HTMLDivElement>, busy: boolean, onCancel: () => void) {
  if (event.key === 'Escape' && !busy) {
    event.preventDefault()
    onCancel()
    return
  }
  if (event.key !== 'Tab') return
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  ))
  if (controls.length === 0) {
    event.preventDefault()
    event.currentTarget.focus()
    return
  }
  const first = controls[0]
  const last = controls.at(-1)!
  if (document.activeElement === event.currentTarget) {
    event.preventDefault()
    const destination = event.shiftKey ? last : first
    destination.focus()
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function mutationRequestId(): string | null {
  try {
    return globalThis.crypto?.randomUUID() ?? null
  } catch {
    return null
  }
}

function errorCode(error: unknown): ProviderPricingErrorCode {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') return code as ProviderPricingErrorCode
  }
  return 'source_unavailable'
}
