import { useEffect, useRef, type RefObject } from 'react'
import type {
  StudyOperationAction,
  StudyOperationGate,
  StudyOperationGateId,
  StudyOperationReasonCode,
  StudyOperationStatus,
  StudyOperationsProjection,
  StudyOperationsReadState,
  StudyWorkerEvidence,
} from '../../admin/studyOperationsModel'
import './admin-study-operations.css'

interface AdminStudyOperationsProps {
  readonly authorized: boolean
  readonly state: StudyOperationsReadState
  readonly onRetry?: () => void
}

const GATE_LABELS: Readonly<Record<StudyOperationGateId, string>> = {
  effective_settings_v2: 'Effective Settings V2',
  curriculum_release_binding: 'Curriculum Release Authority / Binding',
  session_semantics: 'Session Semantics',
  bound_content_runtime: 'Bound Content Runtime',
  adult_review_worker_composition: 'Adult Review Worker Composition',
  adult_review_worker_schedule: 'Adult Review Worker Schedule',
  adult_review_worker_run_evidence: 'Adult Review Worker Run Evidence',
  study_telemetry: 'Study Telemetry',
  provider_cost_accounting: 'Provider Cost Accounting',
  provider_attempt_coverage: 'Provider Attempt Coverage',
  production_mount: 'Production Mount',
}

const STATUS_LABELS: Readonly<Record<StudyOperationStatus, string>> = {
  ready: 'Ready',
  partial: 'Partial',
  manual_review: 'Manual review',
  unavailable: 'Unavailable',
  not_configured: 'Not configured',
  blocked: 'Blocked',
  unknown: 'Unknown',
}

const REASON_MESSAGES: Readonly<Record<StudyOperationReasonCode, string>> = {
  verified: 'The connected authority returned verified readiness evidence.',
  partial_evidence: 'Some bounded evidence is available, but it does not prove complete readiness.',
  manual_verification_required: 'Automated evidence is insufficient; an operator must verify the deployed authority.',
  unknown_evidence: 'No authoritative conclusion can be drawn from the available evidence.',
  effective_settings_v2_not_integrated: 'The Study Effective Settings V2 authority is not integrated on this deployment.',
  curriculum_release_binding_not_integrated: 'No production curriculum release authority and runtime binding are integrated here.',
  session_semantics_not_ready: 'One or more durable session-semantics dependencies are not ready.',
  bound_content_runtime_not_integrated: 'No authority currently proves that the runtime is bound to released content.',
  adult_review_worker_not_composed: 'A production adult-review worker composition is not available to this dashboard.',
  adult_review_worker_composed: 'The durable adult-review worker registry has an active production composition.',
  adult_review_worker_schedule_absent: 'No authoritative worker schedule evidence is connected.',
  adult_review_worker_schedule_unverified: 'The declared worker schedule has not been verified in the hosted runtime.',
  adult_review_worker_schedule_configured: 'The private worker deployment manifest declares the five-minute schedule.',
  adult_review_worker_no_run_evidence: 'The worker is configured, but no durable run evidence has been recorded.',
  adult_review_worker_no_work: 'The latest durable run is within the freshness window and found no work.',
  adult_review_worker_processed: 'The latest durable run is within the freshness window and processed work.',
  adult_review_worker_partial: 'The latest durable run recorded retryable failures and is degraded.',
  adult_review_worker_failed: 'The latest durable run failed and does not establish operational health.',
  adult_review_worker_unavailable: 'The latest durable run could not reach a required dependency.',
  adult_review_worker_run_stale: 'The latest successful result is older than the server-owned 15-minute freshness window.',
  study_telemetry_verified: 'A bounded Study telemetry event was verified by the operational telemetry source.',
  study_telemetry_partial: 'The bounded telemetry source was truncated or rejected invalid rows.',
  study_telemetry_absent: 'The telemetry source is available, but no Study session evidence was observed.',
  study_telemetry_unavailable: 'The bounded Study telemetry source could not be read.',
  provider_cost_accounting_not_integrated: 'Study provider cost accounting is not integrated on this deployment.',
  provider_attempt_coverage_not_integrated: 'End-to-end Study provider-attempt coverage is not integrated on this deployment.',
  study_feature_disabled: 'The server-owned Study production feature gate is disabled.',
  production_mount_blocked: 'Study readiness currently blocks the production mount.',
  production_mount_unverified: 'Server readiness does not by itself prove the hosted browser mount.',
  source_unavailable: 'The authoritative evidence source could not be read.',
}

const ACTION_MESSAGES: Readonly<Record<StudyOperationAction, string>> = {
  none: 'No operator action required.',
  integrate_effective_settings: 'Integrate the approved Effective Settings V2 authority.',
  bind_curriculum_release: 'Connect release authority and verify runtime content binding.',
  restore_session_readiness: 'Resolve the failing session-readiness dependencies.',
  integrate_bound_content: 'Connect the bound-content runtime authority.',
  compose_worker: 'Complete and verify the production worker composition.',
  configure_worker_schedule: 'Configure and verify the hosted worker schedule.',
  inspect_worker_runs: 'Inspect the private worker runtime and restore durable five-minute evidence.',
  restore_worker_runtime: 'Restore the worker dependency or execution path, then verify a durable run.',
  inspect_telemetry: 'Verify the Study telemetry writer and bounded read projection.',
  integrate_cost_accounting: 'Integrate Study provider calls with the approved cost ledger.',
  complete_attempt_coverage: 'Add complete provider-attempt coverage without assuming cost-ledger completeness.',
  enable_study: 'Enable Study only after all production authorities are approved.',
  verify_production_mount: 'Verify the deployed browser mount and its current readiness lease.',
  retry_evidence: 'Retry the bounded evidence read after the authority recovers.',
}

const GROUPS: readonly {
  readonly id: string
  readonly eyebrow: string
  readonly title: string
  readonly gateIds: readonly StudyOperationGateId[]
}[] = [
  {
    id: 'study-core-gates',
    eyebrow: 'Core runtime',
    title: 'Authority and session gates',
    gateIds: [
      'effective_settings_v2', 'curriculum_release_binding',
      'session_semantics', 'bound_content_runtime',
    ],
  },
  {
    id: 'study-worker-gates',
    eyebrow: 'Adult review',
    title: 'Worker readiness',
    gateIds: [
      'adult_review_worker_composition',
      'adult_review_worker_schedule',
      'adult_review_worker_run_evidence',
    ],
  },
  {
    id: 'study-observability-gates',
    eyebrow: 'Observability and economics',
    title: 'Evidence coverage',
    gateIds: ['study_telemetry', 'provider_cost_accounting', 'provider_attempt_coverage'],
  },
  {
    id: 'study-delivery-gates',
    eyebrow: 'Delivery',
    title: 'Production availability',
    gateIds: ['production_mount'],
  },
]

export function AdminStudyOperations(props: AdminStudyOperationsProps) {
  const recoveryHeadingRef = useRef<HTMLHeadingElement>(null)
  const retryPendingRef = useRef(false)
  useEffect(() => {
    if (props.state.status === 'loading' || !retryPendingRef.current) return
    retryPendingRef.current = false
    recoveryHeadingRef.current?.focus()
  }, [props.state.status])

  if (!props.authorized || props.state.status === 'denied') {
    return (
      <StudyOperationsState
        title="Study Operations unavailable"
        message="The canonical health:read capability is required. Guardian access does not grant this permission."
        headingRef={recoveryHeadingRef}
      />
    )
  }
  if (props.state.status === 'loading') return <StudyOperationsLoading />
  if (props.state.status === 'error') {
    return (
      <StudyOperationsState
        title="Study readiness evidence unavailable"
        message={props.state.code === 'study_operations_timeout'
          ? 'The authorized Study Operations request timed out.'
          : 'The authorized Study Operations projection could not be loaded.'}
        headingRef={recoveryHeadingRef}
        announcement="alert"
        onRetry={props.onRetry && (() => {
          retryPendingRef.current = true
          props.onRetry?.()
        })}
      />
    )
  }
  return <StudyOperationsReady projection={props.state.projection} headingRef={recoveryHeadingRef} />
}

function StudyOperationsReady({
  projection,
  headingRef,
}: {
  projection: StudyOperationsProjection
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const readyCount = projection.gates.filter((gate) => gate.status === 'ready').length
  const byId = new Map(projection.gates.map((gate) => [gate.id, gate]))
  return (
    <div className="study-ops">
      <span className="study-ops__sr-only" role="status">
        Study Operations loaded. {readyCount} of {projection.gates.length} gates ready.
        Overall status: {STATUS_LABELS[projection.overallStatus]}.
      </span>
      <section className="study-ops__summary" aria-labelledby="study-ops-summary-title">
        <div>
          <p className="study-ops__eyebrow">Read-only production readiness</p>
          <h2 id="study-ops-summary-title" ref={headingRef} tabIndex={-1}>Study production gates</h2>
          <p>Separate operational authorities are shown without inferring readiness from deployed code.</p>
        </div>
        <div className="study-ops__score">
          <StatusBadge status={projection.overallStatus} />
          <strong>{readyCount} of {projection.gates.length} gates ready</strong>
          <span>Projection generated <time dateTime={projection.generatedAt}>{projection.generatedAt}</time></span>
        </div>
      </section>

      {projection.overallStatus !== 'ready' && (
        <div className={`study-ops__banner study-ops__banner--${projection.overallStatus}`} role="status">
          <strong>Study production readiness is {STATUS_LABELS[projection.overallStatus].toLowerCase()}.</strong>
          <span>Unavailable evidence remains unavailable; no read-only card authorizes a Study operation.</span>
        </div>
      )}

      {GROUPS.map((group) => (
        <section className="study-ops__group" aria-labelledby={group.id} key={group.id}>
          <header>
            <p className="study-ops__eyebrow">{group.eyebrow}</p>
            <h2 id={group.id}>{group.title}</h2>
          </header>
          <div className="study-ops__grid">
            {group.gateIds.map((id) => (
              <GateCard
                gate={byId.get(id)!}
                workerEvidence={projection.workerEvidence}
                key={id}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function GateCard({
  gate,
  workerEvidence,
}: {
  gate: StudyOperationGate
  workerEvidence: StudyWorkerEvidence | null
}) {
  const titleId = `study-gate-${gate.id}`
  return (
    <article className={`study-ops__card study-ops__card--${gate.status}`} aria-labelledby={titleId}>
      <div className="study-ops__card-heading">
        <h3 id={titleId}>{GATE_LABELS[gate.id]}</h3>
        <StatusBadge status={gate.status} />
      </div>
      <p className="study-ops__reason">{REASON_MESSAGES[gate.reasonCode]}</p>
      <GateFacts gate={gate} workerEvidence={workerEvidence} />
      <div className="study-ops__action">
        <span aria-hidden="true">&gt;</span>
        <p><strong>Operator action</strong>{ACTION_MESSAGES[gate.operatorAction]}</p>
      </div>
    </article>
  )
}

function GateFacts({
  gate,
  workerEvidence,
}: {
  gate: StudyOperationGate
  workerEvidence: StudyWorkerEvidence | null
}) {
  if (gate.id === 'adult_review_worker_composition') {
    return (
      <dl>
        <div>
          <dt>Configured state</dt>
          <dd>{workerEvidence
            ? workerEvidence.configuredState === 'configured' ? 'Configured' : 'Not configured'
            : 'Unknown'}</dd>
        </div>
        <div><dt>Contract</dt><dd>{gate.contractVersion ?? 'Not integrated'}</dd></div>
      </dl>
    )
  }
  if (gate.id === 'adult_review_worker_schedule') {
    return (
      <dl>
        <div><dt>Configured state</dt><dd>{gate.status === 'ready' ? 'Configured' : 'Not configured'}</dd></div>
        <div><dt>Cadence</dt><dd>{gate.status === 'ready' ? 'Every 5 minutes' : 'Unknown'}</dd></div>
      </dl>
    )
  }
  if (gate.id === 'adult_review_worker_run_evidence') {
    return (
      <dl>
        <TimestampFact label="Latest run" value={workerEvidence?.latestRunTimestamp ?? null} />
        <TimestampFact
          label="Latest successful run"
          value={workerEvidence?.latestSuccessfulRunTimestamp ?? null}
        />
        <div>
          <dt>Latest category</dt>
          <dd>{workerResultLabel(workerEvidence?.latestResultCategory ?? null)}</dd>
        </div>
        <div>
          <dt>Staleness</dt>
          <dd>{workerStalenessLabel(workerEvidence?.stalenessClassification ?? null)}</dd>
        </div>
        <div><dt>Worker version</dt><dd>{workerEvidence?.workerVersion ?? 'Unknown'}</dd></div>
      </dl>
    )
  }
  return (
    <dl>
      <div><dt>Contract / version</dt><dd>{gate.contractVersion ?? 'Not integrated'}</dd></div>
      <TimestampFact label="Last verified" value={gate.lastVerifiedAt} />
    </dl>
  )
}

function TimestampFact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ? <time dateTime={value}>{value}</time> : 'Unknown'}</dd>
    </div>
  )
}

function workerResultLabel(value: StudyWorkerEvidence['latestResultCategory']): string {
  if (value === 'no_work') return 'No work'
  if (value === 'processed') return 'Processed'
  if (value === 'partial_with_retryable_failures') return 'Partial with retryable failures'
  if (value === 'failed') return 'Failed'
  if (value === 'unavailable') return 'Unavailable'
  return 'No evidence'
}

function workerStalenessLabel(
  value: StudyWorkerEvidence['stalenessClassification'] | null,
): string {
  if (value === 'healthy') return 'Healthy (15 minutes or less)'
  if (value === 'degraded') return 'Degraded'
  if (value === 'unknown') return 'Unknown'
  if (value === 'unavailable') return 'Unavailable'
  return 'Unknown'
}

function StatusBadge({ status }: { status: StudyOperationStatus }) {
  const glyph = status === 'ready' ? '+'
    : status === 'blocked' ? 'x'
      : status === 'partial' || status === 'manual_review' ? '!'
        : '?'
  return (
    <span className={`study-ops__badge study-ops__badge--${status}`}>
      <span aria-hidden="true">{glyph}</span>{STATUS_LABELS[status]}
    </span>
  )
}

function StudyOperationsState({
  title,
  message,
  onRetry,
  headingRef,
  announcement = 'status',
}: {
  readonly title: string
  readonly message: string
  readonly onRetry?: () => void
  readonly headingRef: RefObject<HTMLHeadingElement | null>
  readonly announcement?: 'alert' | 'status'
}) {
  return (
    <section
      className="study-ops-state"
      role={announcement}
      aria-live={announcement === 'alert' ? 'assertive' : 'polite'}
    >
      <span className="study-ops-state__glyph" aria-hidden="true">!</span>
      <h2 ref={headingRef} tabIndex={-1}>{title}</h2>
      <p>{message}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </section>
  )
}

function StudyOperationsLoading() {
  return (
    <div className="study-ops study-ops--loading" role="status" aria-busy="true" aria-live="polite">
      <span className="study-ops__sr-only">Loading Study Operations</span>
      <div className="study-ops__skeleton study-ops__skeleton--summary" />
      <div className="study-ops__grid">
        {Array.from({ length: 6 }, (_, index) => <div className="study-ops__skeleton" key={index} />)}
      </div>
    </div>
  )
}
