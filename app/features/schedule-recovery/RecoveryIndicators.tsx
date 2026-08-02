import {
  formatDate,
  formatDateTime,
  formatMinutes,
  riskLabels,
  workloadState,
} from './presentation'
import type {
  ConflictIndicator,
  DueDateRisk,
  RecoveryProposalView,
  WorkloadDay,
} from './types'

interface RecoverySummaryProps {
  proposals: RecoveryProposalView[]
  conflicts: ConflictIndicator[]
  dueDateRisks: DueDateRisk[]
}

export function RecoverySummary({
  proposals,
  conflicts,
  dueDateRisks,
}: RecoverySummaryProps) {
  const pending = proposals.filter(
    ({ status }) => status === 'pending' || status === 'undone',
  ).length
  const protectedConflicts = conflicts.filter(
    ({ status }) => status === 'protected',
  ).length
  const highRisk = dueDateRisks.filter(
    ({ level }) => level === 'high' || level === 'critical',
  ).length
  const overloads = proposals
    .flatMap(({ workloadPreview }) => workloadPreview)
    .filter(({ proposedMinutes, limitMinutes }) => proposedMinutes > limitMinutes)
    .length

  return (
    <section className="sr-summary-grid" aria-label="Recovery status summary">
      <SummaryMetric
        label="Needs parent review"
        value={pending}
        detail={pending === 1 ? 'proposal waiting' : 'proposals waiting'}
        tone={pending > 0 ? 'attention' : 'calm'}
      />
      <SummaryMetric
        label="Due-date risk"
        value={highRisk}
        detail="high-risk items"
        tone={highRisk > 0 ? 'warning' : 'calm'}
      />
      <SummaryMetric
        label="Protected conflicts"
        value={protectedConflicts}
        detail="locked times honored"
        tone="protected"
      />
      <SummaryMetric
        label="Overloaded days"
        value={overloads}
        detail={overloads === 0 ? 'all proposals within limits' : 'cannot be approved'}
        tone={overloads === 0 ? 'calm' : 'danger'}
      />
    </section>
  )
}

function SummaryMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: number
  detail: string
  tone: 'attention' | 'warning' | 'protected' | 'calm' | 'danger'
}) {
  return (
    <article className={`sr-summary-card sr-tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

export function WorkloadPreview({ days }: { days: WorkloadDay[] }) {
  return (
    <section className="sr-detail-section" aria-labelledby="sr-workload-title">
      <div className="sr-section-heading">
        <div>
          <h3 id="sr-workload-title">Workload after this change</h3>
          <p>Daily student-specific limits include scheduled learning time.</p>
        </div>
        <span className="sr-inline-status sr-status-safe">No silent overload</span>
      </div>
      <div className="sr-workload-list">
        {days.map((day) => {
          const state = workloadState(day)
          const percentage = Math.min(
            100,
            Math.round((day.proposedMinutes / day.limitMinutes) * 100),
          )
          return (
            <article className="sr-workload-row" key={day.date}>
              <div className="sr-workload-label">
                <strong>{formatDate(day.date, { weekday: 'short' })}</strong>
                <span>
                  {formatMinutes(day.proposedMinutes)} of {formatMinutes(day.limitMinutes)}
                </span>
              </div>
              <div
                className={`sr-meter sr-meter-${state}`}
                role="progressbar"
                aria-label={`${formatDate(day.date, { weekday: 'long' })} proposed workload`}
                aria-valuemin={0}
                aria-valuemax={day.limitMinutes}
                aria-valuenow={day.proposedMinutes}
              >
                <span style={{ width: `${percentage}%` }} />
              </div>
              <div className="sr-workload-meta">
                <span className={`sr-inline-status sr-workload-state-${state}`}>
                  {state.replace('-', ' ')}
                </span>
                {day.overloadPrevented ? (
                  <small>Overload avoided</small>
                ) : (
                  <small>{formatMinutes(day.protectedMinutes)} protected</small>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function RiskAndConflictList({
  conflicts,
  dueDateRisks,
}: {
  conflicts: ConflictIndicator[]
  dueDateRisks: DueDateRisk[]
}) {
  if (conflicts.length === 0 && dueDateRisks.length === 0) {
    return (
      <section className="sr-empty-note" aria-label="Risks and conflicts">
        <strong>No active conflict or due-date warning</strong>
        <span>The proposal still preserves workload limits and protected time.</span>
      </section>
    )
  }

  return (
    <section className="sr-detail-section" aria-labelledby="sr-alerts-title">
      <div className="sr-section-heading">
        <div>
          <h3 id="sr-alerts-title">Conflicts and due-date risk</h3>
          <p>Items checked before this proposal can be approved.</p>
        </div>
      </div>
      <div className="sr-alert-list">
        {dueDateRisks.map((risk) => (
          <article
            className={`sr-alert sr-risk-${risk.level}`}
            key={risk.id}
            aria-label={`${riskLabels[risk.level]} due-date risk`}
          >
            <span className="sr-alert-mark" aria-hidden="true">
              !
            </span>
            <div>
              <div className="sr-alert-heading">
                <strong>{risk.title}</strong>
                <span>{riskLabels[risk.level]} risk</span>
              </div>
              <p>{risk.detail}</p>
              <small>Due {formatDateTime(risk.dueAt)}</small>
            </div>
          </article>
        ))}
        {conflicts.map((conflict) => (
          <article
            className={`sr-alert sr-conflict-${conflict.status}`}
            key={conflict.id}
          >
            <span className="sr-alert-mark sr-lock-mark" aria-hidden="true">
              L
            </span>
            <div>
              <div className="sr-alert-heading">
                <strong>{conflict.title}</strong>
                <span>{conflict.status.replaceAll('-', ' ')}</span>
              </div>
              <p>{conflict.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

