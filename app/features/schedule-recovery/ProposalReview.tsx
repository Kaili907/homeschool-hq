import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import {
  activityCategoryLabels,
  formatDateTime,
  formatPlacement,
  recoveryChoiceMetadata,
  signedMinutes,
  triggerLabels,
} from './presentation'
import { RiskAndConflictList, WorkloadPreview } from './RecoveryIndicators'
import type {
  ConflictIndicator,
  DueDateRisk,
  RecoveryChoice,
  RecoveryProposalView,
  ScheduleRecoveryHandlers,
  StudentSummary,
} from './types'

interface ProposalReviewProps {
  proposal: RecoveryProposalView
  student: StudentSummary
  conflicts: ConflictIndicator[]
  dueDateRisks: DueDateRisk[]
  handlers?: Partial<ScheduleRecoveryHandlers>
  onAnnounce?: (message: string) => void
}

export function ProposalReview({
  proposal,
  student,
  conflicts,
  dueDateRisks,
  handlers,
  onAnnounce,
}: ProposalReviewProps) {
  const idPrefix = useId()
  const [selectedChoice, setSelectedChoice] = useState<RecoveryChoice>(
    proposal.decidedChoice ?? proposal.recommendedChoice,
  )
  const [showOverride, setShowOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const firstPlacement = proposal.changes[0]?.before[0]
  const [manualDate, setManualDate] = useState(
    firstPlacement?.date ?? proposal.createdAt.slice(0, 10),
  )
  const [manualTime, setManualTime] = useState(firstPlacement?.startTime ?? '09:00')
  const [manualDuration, setManualDuration] = useState(
    firstPlacement?.durationMinutes ?? 30,
  )
  const [manualReason, setManualReason] = useState('')

  useEffect(() => {
    const placement = proposal.changes[0]?.before[0]
    setSelectedChoice(proposal.decidedChoice ?? proposal.recommendedChoice)
    setShowOverride(false)
    setOverrideReason('')
    setManualDate(placement?.date ?? proposal.createdAt.slice(0, 10))
    setManualTime(placement?.startTime ?? '09:00')
    setManualDuration(placement?.durationMinutes ?? 30)
    setManualReason('')
  }, [proposal])

  const selectedOption = proposal.options.find(
    ({ choice }) => choice === selectedChoice,
  )
  const canDecide = proposal.status === 'pending' || proposal.status === 'undone'
  const hasOverload = proposal.workloadPreview.some(
    ({ proposedMinutes, limitMinutes }) => proposedMinutes > limitMinutes,
  )
  const callbacksReady =
    handlers?.onApprove !== undefined &&
    handlers.onOverride !== undefined &&
    handlers.onManualPlacement !== undefined

  const statusLabel =
    proposal.status === 'pending'
      ? 'Awaiting review'
      : proposal.status === 'approved'
        ? 'Approved'
        : proposal.status === 'overridden'
          ? 'Parent override'
          : 'Undone · ready to review'

  const submitRecommended = () => {
    if (
      !canDecide ||
      hasOverload ||
      selectedChoice !== proposal.recommendedChoice ||
      !selectedOption?.permitted
    ) {
      return
    }
    handlers?.onApprove?.({
      proposalId: proposal.id,
      choice: selectedChoice,
    })
    onAnnounce?.(`${student.name}'s recovery proposal was approved.`)
  }

  const submitOverride = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !canDecide ||
      hasOverload ||
      selectedChoice === 'parent-manual' ||
      !selectedOption?.permitted ||
      !overrideReason.trim()
    ) {
      return
    }
    handlers?.onOverride?.({
      proposalId: proposal.id,
      choice: selectedChoice,
      reason: overrideReason.trim(),
    })
    onAnnounce?.(
      `${student.name}'s proposal was overridden with ${recoveryChoiceMetadata(selectedChoice).label}.`,
    )
    setShowOverride(false)
  }

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !canDecide ||
      hasOverload ||
      manualDuration < 5 ||
      manualDuration > 240 ||
      !manualReason.trim()
    ) {
      return
    }
    handlers?.onManualPlacement?.({
      proposalId: proposal.id,
      date: manualDate,
      startTime: manualTime,
      durationMinutes: manualDuration,
      reason: manualReason.trim(),
    })
    onAnnounce?.(`${student.name}'s work was placed manually.`)
  }

  return (
    <article className="sr-proposal-detail">
      <header className="sr-proposal-header">
        <div>
          <div className="sr-heading-badges">
            <span className={`sr-status-badge sr-status-${proposal.status}`}>
              {statusLabel}
            </span>
            <span className="sr-trigger-badge">{triggerLabels[proposal.trigger]}</span>
          </div>
          <p className="sr-eyebrow">
            {student.name} · {proposal.sourceLabel}
          </p>
          <h2>{proposal.title}</h2>
          <p className="sr-header-meta">
            {proposal.priorityLabel}
            {proposal.dueAt ? ` · Due ${formatDateTime(proposal.dueAt)}` : ''}
          </p>
        </div>
      </header>

      <section className="sr-explanation-grid" aria-label="Proposal explanation">
        <article>
          <span>Why this changed</span>
          <p>{proposal.reason}</p>
        </article>
        <article>
          <span>Tradeoff</span>
          <p>{proposal.tradeoff}</p>
        </article>
      </section>

      <div className="sr-guardrail" role="note">
        <span className="sr-guardrail-icon" aria-hidden="true">
          ✓
        </span>
        <div>
          <strong>
            {proposal.requiredWorkPreserved
              ? 'Required work is preserved'
              : 'Required work needs explicit parent approval'}
          </strong>
          <p>
            Sleep, meals, parent-locked time, and fixed appointments stay protected.
            Tomorrow cannot be silently overloaded.
          </p>
        </div>
      </div>

      <ChangeComparison proposal={proposal} />
      <RiskAndConflictList conflicts={conflicts} dueDateRisks={dueDateRisks} />
      <WorkloadPreview days={proposal.workloadPreview} />

      <section className="sr-detail-section" aria-labelledby={`${idPrefix}-choices`}>
        <div className="sr-section-heading">
          <div>
            <h3 id={`${idPrefix}-choices`}>Choose a recovery plan</h3>
            <p>Review the recommendation or select a parent override.</p>
          </div>
          <span className="sr-inline-status sr-status-parent">Parent approval</span>
        </div>

        {!callbacksReady ? (
          <p className="sr-integration-note" role="note">
            Preview mode: connect decision handlers to enable approval and override
            actions.
          </p>
        ) : null}

        <fieldset className="sr-choice-list" disabled={!canDecide}>
          <legend className="sr-visually-hidden">Recovery choices</legend>
          {proposal.options.map((option) => {
            const metadata = recoveryChoiceMetadata(option.choice)
            const optionId = `${idPrefix}-${option.choice}`
            const selected = selectedChoice === option.choice
            const recommended = proposal.recommendedChoice === option.choice
            return (
              <label
                className={`sr-choice-card ${selected ? 'sr-choice-selected' : ''} ${
                  !option.permitted ? 'sr-choice-unavailable' : ''
                }`}
                htmlFor={optionId}
                key={option.choice}
              >
                <input
                  id={optionId}
                  type="radio"
                  name={`${idPrefix}-recovery-choice`}
                  value={option.choice}
                  checked={selected}
                  disabled={!option.permitted}
                  onChange={() => {
                    setSelectedChoice(option.choice)
                    setShowOverride(
                      option.choice !== proposal.recommendedChoice &&
                        option.choice !== 'parent-manual',
                    )
                  }}
                />
                <span className="sr-radio-control" aria-hidden="true" />
                <span className="sr-choice-content">
                  <span className="sr-choice-heading">
                    <strong>{metadata.label}</strong>
                    {recommended ? (
                      <span className="sr-recommended-badge">Recommended</span>
                    ) : null}
                  </span>
                  <span>{option.summary}</span>
                  <small>
                    Tradeoff: {option.tradeoff}
                    {!option.permitted && option.unavailableReason
                      ? ` Unavailable: ${option.unavailableReason}`
                      : ''}
                  </small>
                  <span className="sr-delta-row" aria-label="Workload impact">
                    <span>Today {signedMinutes(option.workloadDeltaMinutes.today)}</span>
                    <span>
                      Tomorrow {signedMinutes(option.workloadDeltaMinutes.tomorrow)}
                    </span>
                    <span>Week {signedMinutes(option.workloadDeltaMinutes.week)}</span>
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>

        {hasOverload ? (
          <div className="sr-blocking-alert" role="alert">
            This proposal exceeds a daily workload limit and cannot be approved.
          </div>
        ) : null}

        {canDecide && selectedChoice === proposal.recommendedChoice ? (
          <div className="sr-action-bar">
            <button
              className="sr-button sr-button-primary"
              type="button"
              disabled={!callbacksReady || hasOverload || !selectedOption?.permitted}
              onClick={submitRecommended}
            >
              Approve recommended plan
            </button>
            <span>The change is written to the recovery audit history.</span>
          </div>
        ) : null}

        {canDecide &&
        selectedChoice !== proposal.recommendedChoice &&
        selectedChoice !== 'parent-manual' ? (
          <OverrideForm
            choice={selectedChoice}
            reason={overrideReason}
            show={showOverride}
            disabled={!callbacksReady || hasOverload || !selectedOption?.permitted}
            onShow={() => setShowOverride(true)}
            onReasonChange={setOverrideReason}
            onCancel={() => setShowOverride(false)}
            onSubmit={submitOverride}
          />
        ) : null}

        {canDecide && selectedChoice === 'parent-manual' ? (
          <form className="sr-decision-form" onSubmit={submitManual}>
            <div className="sr-decision-form-heading">
              <div>
                <strong>Parent manual placement</strong>
                <span>Choose the exact placement. The engine must recheck it.</span>
              </div>
            </div>
            <div className="sr-form-grid">
              <label>
                Date
                <input
                  type="date"
                  value={manualDate}
                  required
                  onChange={(event) => setManualDate(event.target.value)}
                />
              </label>
              <label>
                Start time
                <input
                  type="time"
                  value={manualTime}
                  required
                  onChange={(event) => setManualTime(event.target.value)}
                />
              </label>
              <label>
                Duration
                <span className="sr-input-with-suffix">
                  <input
                    type="number"
                    min={5}
                    max={240}
                    step={5}
                    value={manualDuration}
                    required
                    onChange={(event) => setManualDuration(event.target.valueAsNumber)}
                  />
                  <span>minutes</span>
                </span>
              </label>
            </div>
            <label className="sr-full-field">
              Reason for manual placement
              <textarea
                rows={3}
                value={manualReason}
                required
                placeholder="Explain why this placement works for the household."
                onChange={(event) => setManualReason(event.target.value)}
              />
            </label>
            <div className="sr-form-actions">
              <button
                className="sr-button sr-button-primary"
                type="submit"
                disabled={!callbacksReady || hasOverload}
              >
                Check and use manual placement
              </button>
              <span>Conflicts and workload limits must pass before it is applied.</span>
            </div>
          </form>
        ) : null}

        {!canDecide ? (
          <div className="sr-decision-result">
            <span>Decision recorded</span>
            <strong>
              {recoveryChoiceMetadata(
                proposal.decidedChoice ?? proposal.recommendedChoice,
              ).label}
            </strong>
            {proposal.decisionNote ? <p>{proposal.decisionNote}</p> : null}
            <small>Use the history panel to restore the prior schedule.</small>
          </div>
        ) : null}
      </section>
    </article>
  )
}

function ChangeComparison({ proposal }: { proposal: RecoveryProposalView }) {
  return (
    <section className="sr-detail-section" aria-labelledby="sr-changes-title">
      <div className="sr-section-heading">
        <div>
          <h3 id="sr-changes-title">What changes</h3>
          <p>Before and after placements for every affected block.</p>
        </div>
      </div>
      <div className="sr-change-list">
        {proposal.changes.map((change) => (
          <article className="sr-change-card" key={change.id}>
            <header>
              <div>
                <span>{activityCategoryLabels[change.category]}</span>
                <strong>{change.title}</strong>
              </div>
              <div className="sr-change-badges">
                {change.isRequiredWork ? <span>Required</span> : <span>Movable</span>}
                {change.isFixedOrLocked ? <span>Locked</span> : null}
              </div>
            </header>
            <div className="sr-before-after">
              <PlacementColumn label="Before" placements={change.before} muted />
              <span className="sr-change-arrow" aria-hidden="true">
                →
              </span>
              <PlacementColumn label="After" placements={change.after} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function PlacementColumn({
  label,
  placements,
  muted = false,
}: {
  label: string
  placements: RecoveryProposalView['changes'][number]['before']
  muted?: boolean
}) {
  return (
    <div className={`sr-placement-column ${muted ? 'sr-placement-before' : ''}`}>
      <span>{label}</span>
      {placements.length === 0 ? (
        <strong>Not scheduled</strong>
      ) : (
        placements.map((placement, index) => (
          <div key={`${placement.date}-${placement.startTime}-${index}`}>
            <strong>{placement.label ?? `Block ${index + 1}`}</strong>
            <small>{formatPlacement(placement)}</small>
          </div>
        ))
      )}
    </div>
  )
}

function OverrideForm({
  choice,
  reason,
  show,
  disabled,
  onShow,
  onReasonChange,
  onCancel,
  onSubmit,
}: {
  choice: RecoveryChoice
  reason: string
  show: boolean
  disabled: boolean
  onShow: () => void
  onReasonChange: (reason: string) => void
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  if (!show) {
    return (
      <div className="sr-action-bar">
        <button
          className="sr-button sr-button-secondary"
          type="button"
          disabled={disabled}
          onClick={onShow}
        >
          Continue with parent override
        </button>
        <span>A reason is required for the audit history.</span>
      </div>
    )
  }

  return (
    <form className="sr-decision-form" onSubmit={onSubmit}>
      <div className="sr-decision-form-heading">
        <div>
          <strong>Override with “{recoveryChoiceMetadata(choice).label}”</strong>
          <span>The recommendation remains visible in history.</span>
        </div>
      </div>
      <label className="sr-full-field">
        Reason for choosing a different plan
        <textarea
          rows={3}
          required
          value={reason}
          placeholder="Add household context or explain the tradeoff."
          onChange={(event) => onReasonChange(event.target.value)}
        />
      </label>
      <div className="sr-form-actions">
        <button className="sr-button sr-button-primary" type="submit" disabled={disabled}>
          Approve parent override
        </button>
        <button
          className="sr-button sr-button-quiet"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
