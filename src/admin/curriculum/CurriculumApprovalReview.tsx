import type { CurriculumDraftValidationResult } from '../curriculum-authoring/contracts'
import {
  CURRICULUM_APPROVAL_REASON_CODES,
  type CurriculumApprovalDecision,
  type CurriculumApprovalReasonCode,
  type CurriculumApprovalStatusResult,
} from '../curriculum-approval/contracts'

const REASON_LABELS: Readonly<Record<CurriculumApprovalReasonCode, string>> = {
  'approval.ready': 'Approval ready',
  'changes.validation': 'Validation must be resolved',
  'changes.standards': 'Standards review must be resolved',
  'changes.content_quality': 'Content quality changes required',
  'changes.references': 'Reference integrity changes required',
  'changes.accessibility': 'Accessibility changes required',
  'changes.safety_privacy': 'Safety or privacy changes required',
  'changes.other': 'Other bounded review change',
}

const CHANGE_REASONS = CURRICULUM_APPROVAL_REASON_CODES.filter(
  (reason): reason is Exclude<CurriculumApprovalReasonCode, 'approval.ready'> =>
    reason !== 'approval.ready',
)

export interface CurriculumApprovalReviewProps {
  readonly draftId: string
  readonly draftRevision: number
  readonly approval: CurriculumApprovalStatusResult | null
  readonly validation: CurriculumDraftValidationResult | null
  readonly canApprove: boolean
  readonly hasUnsavedChanges?: boolean
  readonly busy: boolean
  readonly error: string | null
  readonly changeReason: Exclude<CurriculumApprovalReasonCode, 'approval.ready'>
  readonly onChangeReason: (reason: Exclude<CurriculumApprovalReasonCode, 'approval.ready'>) => void
  readonly onDecision: (decision: CurriculumApprovalDecision, reason: CurriculumApprovalReasonCode) => void
}

export function CurriculumApprovalReview({
  draftId,
  draftRevision,
  approval,
  validation,
  canApprove,
  hasUnsavedChanges = false,
  busy,
  error,
  changeReason,
  onChangeReason,
  onDecision,
}: CurriculumApprovalReviewProps) {
  const currentValidation = validation?.draftRevision === draftRevision ? validation : null
  const validationSummary = currentValidation?.validationSnapshot ?? approval?.latestValidation ?? null
  const blockingFindings = currentValidation?.run.findings.filter((finding) => finding.blocking) ?? []
  const status = approval?.status ?? 'pending_review'
  const approvalAllowed = canApprove
    && !hasUnsavedChanges
    && approval !== null
    && approval.draftRevision === draftRevision
    && validationSummary?.draftRevision === draftRevision
    && validationSummary.publicationReady
    && validationSummary.blockingCount === 0
    && validationSummary.humanReviewBlockerCount === 0
    && (status === 'pending_review' || status === 'stale')
  const changesAllowed = canApprove && !hasUnsavedChanges && approval !== null && status !== 'changes_requested'
  const previewHref = `/academy/admin/curriculum/preview?draft=${encodeURIComponent(draftId)}&revision=${draftRevision}`

  return (
    <section className="curriculum-approval-review" aria-labelledby="curriculum-approval-title">
      <header>
        <div>
          <p className="curriculum-studio-eyebrow">Human approval gate</p>
          <h3 id="curriculum-approval-title">Review draft revision {draftRevision}</h3>
          <p>Approval binds this exact revision, base release, target-version intent, Schema Set, and validation result.</p>
        </div>
        <span className={`curriculum-approval-badge is-${status}`}>{approvalStatusLabel(status)}</span>
      </header>

      {status === 'stale' && approval?.staleApproval && (
        <div className="curriculum-approval-alert" role="alert">
          <strong>Approval is stale.</strong>{' '}
          {approval.staleApproval.draftRevision === draftRevision
            ? `The validation identity changed for revision ${draftRevision}. Approve the newest valid result.`
            : `Revision ${approval.staleApproval.draftRevision} was approved, but the draft is now revision ${draftRevision}. Validate and approve the current revision.`}
        </div>
      )}
      {error && <div className="curriculum-approval-alert" role="alert"><strong>Approval service unavailable.</strong> {error}</div>}

      <div className="curriculum-approval-grid">
        <section aria-labelledby="curriculum-approval-validation-heading">
          <h4 id="curriculum-approval-validation-heading">Validation gate</h4>
          <dl>
            <div><dt>Draft revision</dt><dd>{draftRevision}</dd></div>
            <div><dt>Validation state</dt><dd>{validationSummary?.status ?? 'not run'}</dd></div>
            <div><dt>Blocking issues</dt><dd>{validationSummary?.blockingCount ?? 'unknown'}</dd></div>
            <div><dt>Human-review blockers</dt><dd>{validationSummary?.humanReviewBlockerCount ?? 'unknown'}</dd></div>
          </dl>
          {blockingFindings.length > 0 && (
            <ul className="curriculum-approval-blockers" aria-label="Blocking validation issues">
              {blockingFindings.slice(0, 5).map((finding) => (
                <li key={finding.id}><strong>{finding.rule}</strong><span>{finding.explanation}</span></li>
              ))}
            </ul>
          )}
          {blockingFindings.length > 5 && <p>{blockingFindings.length - 5} more blocking issues are shown in the validation workspace below.</p>}
          <a href={previewHref}>Open Preview / Diff seam</a>
        </section>

        <section aria-labelledby="curriculum-approval-decision-heading">
          <h4 id="curriculum-approval-decision-heading">Reviewer decision</h4>
          {canApprove ? (
            <>
              <button
                type="button"
                disabled={!approvalAllowed || busy}
                aria-describedby="curriculum-approve-help"
                onClick={() => onDecision('approved', 'approval.ready')}
              >{busy ? 'Recording decision…' : `Approve revision ${draftRevision}`}</button>
              <p id="curriculum-approve-help">Approval is enabled only for a current, complete validation with no blocking or unresolved human-review findings.</p>
              {hasUnsavedChanges && <p role="alert">Save or discard local edits before recording a review decision.</p>}
              <label htmlFor="curriculum-change-reason">Request-changes reason</label>
              <select
                id="curriculum-change-reason"
                value={changeReason}
                disabled={busy}
                onChange={(event) => onChangeReason(event.target.value as typeof changeReason)}
              >
                {CHANGE_REASONS.map((reason) => <option key={reason} value={reason}>{REASON_LABELS[reason]}</option>)}
              </select>
              <button
                type="button"
                className="curriculum-request-changes"
                disabled={!changesAllowed || busy}
                onClick={() => onDecision('changes_requested', changeReason)}
              >Request changes</button>
            </>
          ) : <p>Read-only review. The exact <code>curriculum:approve</code> capability is required to decide.</p>}
        </section>

        <section aria-labelledby="curriculum-approval-history-heading">
          <h4 id="curriculum-approval-history-heading">Review history</h4>
          {!approval || approval.history.length === 0 ? <p>No human decisions have been recorded.</p> : (
            <ol className="curriculum-approval-history">
              {approval.history.map((entry) => (
                <li key={entry.approvalId}>
                  <strong>{entry.decision === 'approved' ? 'Approved' : 'Changes requested'} · revision {entry.draftRevision}</strong>
                  <span>{REASON_LABELS[entry.reasonCode]} · {entry.reviewerRole} reviewer</span>
                  <time dateTime={entry.decidedAt}>{new Date(entry.decidedAt).toLocaleString()}</time>
                  {entry.bindingStatus === 'superseded' && <em>Superseded</em>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </section>
  )
}

export function approvalStatusLabel(status: CurriculumApprovalStatusResult['status']): string {
  if (status === 'pending_review') return 'Pending review'
  if (status === 'changes_requested') return 'Changes requested'
  if (status === 'stale') return 'Stale approval'
  return 'Approved'
}
