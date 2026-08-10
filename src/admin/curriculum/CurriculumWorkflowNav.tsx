export type CurriculumWorkflowView =
  | 'published'
  | 'integrity'
  | 'history'
  | 'studio'
  | 'draft'
  | 'resources'
  | 'validation'
  | 'standards-review'
  | 'preview'
  | 'approval'
  | 'staging'
  | 'activation'

export type CurriculumWorkflowStepState =
  | 'complete'
  | 'ready'
  | 'pending'
  | 'blocked'
  | 'stale'
  | 'read-only'

export interface CurriculumWorkflowSnapshot {
  readonly draftId: string
  readonly draftRevision: number
  readonly baseReleaseVersion: string
  readonly targetVersion: string
  readonly readOnly: boolean
  readonly resourceLibraryReady: boolean
  readonly validation: {
    readonly draftId: string
    readonly draftRevision: number
    readonly baseReleaseVersion: string
    readonly targetVersion: string
    readonly validationSnapshotId: string
    readonly status: 'valid' | 'invalid' | 'incomplete' | 'unavailable' | 'error'
    readonly humanReviewBlockers: number
  } | null
  readonly approval: {
    readonly draftId: string
    readonly draftRevision: number
    readonly baseReleaseVersion: string
    readonly targetVersion: string
    readonly approvalId: string | null
    readonly validationSnapshotId: string | null
    readonly status: 'pending_review' | 'approved' | 'changes_requested' | 'stale'
  } | null
  readonly staging: {
    readonly draftId: string
    readonly draftRevision: number
    readonly baseReleaseVersion: string
    readonly targetVersion: string
    readonly stagingId: string | null
    readonly stageState: 'blocked' | 'eligible' | 'staged'
  } | null
}

export interface CurriculumWorkflowIdentity {
  readonly draftId: string
  readonly draftRevision: number
}

export interface CurriculumWorkflowDestination {
  readonly id: CurriculumWorkflowView
  readonly label: string
  readonly path: string
  readonly state: CurriculumWorkflowStepState
  readonly detail: string
}

function draftPath(identity: CurriculumWorkflowIdentity, fragment?: string): string {
  const query = `draft=${encodeURIComponent(identity.draftId)}&revision=${identity.draftRevision}`
  return `/academy/admin/curriculum/studio?${query}${fragment ? `#${fragment}` : ''}`
}

export function curriculumWorkflowDestinations(
  snapshot: CurriculumWorkflowSnapshot | null = null,
  identity: CurriculumWorkflowIdentity | null = snapshot,
): readonly CurriculumWorkflowDestination[] {
  const blocked = (id: CurriculumWorkflowView, label: string): CurriculumWorkflowDestination => ({
    id,
    label,
    path: '/academy/admin/curriculum/studio',
    state: 'blocked',
    detail: 'Open an assigned draft first',
  })
  if (!snapshot && !identity) return [
    { id: 'published', label: 'Published', path: '/academy/admin/curriculum', state: 'complete', detail: 'Immutable active source' },
    { id: 'integrity', label: 'Release integrity', path: '/academy/admin/curriculum/integrity', state: 'ready', detail: 'Verify active release provenance' },
    { id: 'history', label: 'Release History', path: '/academy/admin/curriculum/history', state: 'ready', detail: 'Review immutable governance history' },
    { id: 'studio', label: 'Studio', path: '/academy/admin/curriculum/studio', state: 'ready', detail: 'Select or create a draft' },
    blocked('draft', 'Draft'),
    blocked('resources', 'Resource Library'),
    blocked('validation', 'Validation'),
    blocked('standards-review', 'Standards Review'),
    blocked('preview', 'Preview / Diff'),
    blocked('approval', 'Human Approval'),
    blocked('staging', 'Release Staging'),
    { id: 'activation', label: 'Activation / Rollback', path: '/academy/admin/curriculum/activation', state: 'ready', detail: 'Manage the published release pointer' },
  ]

  if (!snapshot && identity) {
    const query = `draft=${encodeURIComponent(identity.draftId)}&revision=${identity.draftRevision}`
    const exactDraft = (fragment?: string) => draftPath(identity, fragment)
    return [
      { id: 'published', label: 'Published', path: '/academy/admin/curriculum', state: 'complete', detail: 'Immutable active source' },
      { id: 'integrity', label: 'Release integrity', path: '/academy/admin/curriculum/integrity', state: 'ready', detail: 'Verify active release provenance' },
      { id: 'history', label: 'Release History', path: '/academy/admin/curriculum/history', state: 'ready', detail: 'Review immutable governance history' },
      { id: 'studio', label: 'Studio', path: exactDraft(), state: 'complete', detail: `Draft revision ${identity.draftRevision}` },
      { id: 'draft', label: 'Draft', path: exactDraft('curriculum-draft-workspace'), state: 'ready', detail: `Revision ${identity.draftRevision}` },
      { id: 'resources', label: 'Resource Library', path: exactDraft('curriculum-resource-library'), state: 'pending', detail: 'Return to exact draft workspace' },
      { id: 'validation', label: 'Validation', path: exactDraft('curriculum-draft-validation'), state: 'pending', detail: 'Check exact-revision evidence in Studio' },
      { id: 'standards-review', label: 'Standards Review', path: `/academy/admin/curriculum/standards-review?${query}`, state: 'ready', detail: `Revision ${identity.draftRevision}` },
      { id: 'preview', label: 'Preview / Diff', path: `/academy/admin/curriculum/preview?${query}`, state: 'ready', detail: `Revision ${identity.draftRevision}` },
      { id: 'approval', label: 'Human Approval', path: exactDraft('curriculum-human-approval'), state: 'pending', detail: 'Check exact-revision evidence in Studio' },
      { id: 'staging', label: 'Release Staging', path: exactDraft('curriculum-release-staging'), state: 'pending', detail: 'Check exact-revision evidence in Studio' },
      { id: 'activation', label: 'Activation / Rollback', path: '/academy/admin/curriculum/activation', state: 'ready', detail: 'Manage the published release pointer' },
    ]
  }

  if (!snapshot) return []

  const query = `draft=${encodeURIComponent(snapshot.draftId)}&revision=${snapshot.draftRevision}`
  const exactStageIdentity = (evidence: {
    readonly draftId: string
    readonly draftRevision: number
    readonly baseReleaseVersion: string
    readonly targetVersion: string
  } | null) => evidence !== null
    && evidence.draftId === snapshot.draftId
    && evidence.draftRevision === snapshot.draftRevision
    && evidence.baseReleaseVersion === snapshot.baseReleaseVersion
    && evidence.targetVersion === snapshot.targetVersion
  const validationCurrent = exactStageIdentity(snapshot.validation)
  const validationState: CurriculumWorkflowStepState = !snapshot.validation
    ? 'pending'
    : !validationCurrent ? 'stale'
      : snapshot.validation.status === 'valid' ? 'complete' : 'blocked'
  const standardsState: CurriculumWorkflowStepState = !snapshot.validation
    ? 'pending'
    : !validationCurrent ? 'stale'
      : snapshot.validation.humanReviewBlockers > 0 ? 'blocked' : 'complete'
  const approvalState: CurriculumWorkflowStepState = !snapshot.approval
    ? 'pending'
    : !exactStageIdentity(snapshot.approval) || snapshot.approval.status === 'stale'
      ? 'stale'
      : snapshot.approval.status === 'approved' ? 'complete'
        : snapshot.approval.status === 'changes_requested' ? 'blocked' : 'pending'
  const stagingState: CurriculumWorkflowStepState = !snapshot.staging
    ? 'pending'
    : !exactStageIdentity(snapshot.staging) ? 'stale'
      : snapshot.staging.stageState === 'staged' ? 'complete'
        : snapshot.staging.stageState === 'eligible' ? 'ready' : 'blocked'

  return [
    { id: 'published', label: 'Published', path: '/academy/admin/curriculum', state: 'complete', detail: `Base ${snapshot.baseReleaseVersion}` },
    { id: 'integrity', label: 'Release integrity', path: '/academy/admin/curriculum/integrity', state: 'ready', detail: 'Verify active release provenance' },
    { id: 'history', label: 'Release History', path: '/academy/admin/curriculum/history', state: 'ready', detail: 'Review immutable governance history' },
    { id: 'studio', label: 'Studio', path: draftPath(snapshot), state: 'complete', detail: `Target ${snapshot.targetVersion}` },
    { id: 'draft', label: 'Draft', path: draftPath(snapshot, 'curriculum-draft-workspace'), state: snapshot.readOnly ? 'read-only' : 'complete', detail: `Revision ${snapshot.draftRevision}` },
    { id: 'resources', label: 'Resource Library', path: draftPath(snapshot, 'curriculum-resource-library'), state: snapshot.resourceLibraryReady ? 'complete' : 'pending', detail: 'Exact materialization' },
    { id: 'validation', label: 'Validation', path: draftPath(snapshot, 'curriculum-draft-validation'), state: validationState, detail: snapshot.validation ? `Revision ${snapshot.validation.draftRevision}` : 'Run validation next' },
    { id: 'standards-review', label: 'Standards Review', path: `/academy/admin/curriculum/standards-review?${query}`, state: standardsState, detail: snapshot.validation?.humanReviewBlockers ? `${snapshot.validation.humanReviewBlockers} human-review blockers` : 'No unresolved mapping blocker' },
    { id: 'preview', label: 'Preview / Diff', path: `/academy/admin/curriculum/preview?${query}`, state: 'ready', detail: `Open revision ${snapshot.draftRevision}` },
    { id: 'approval', label: 'Human Approval', path: draftPath(snapshot, 'curriculum-human-approval'), state: approvalState, detail: snapshot.approval?.status.replaceAll('_', ' ') ?? 'Awaiting exact-revision validation' },
    { id: 'staging', label: 'Release Staging', path: draftPath(snapshot, 'curriculum-release-staging'), state: stagingState, detail: snapshot.staging?.stageState ?? 'Awaiting approval' },
    { id: 'activation', label: 'Activation / Rollback', path: '/academy/admin/curriculum/activation', state: 'ready', detail: 'Manage the published release pointer' },
  ]
}

const STATE_LABELS: Readonly<Record<CurriculumWorkflowStepState, string>> = {
  complete: 'Complete',
  ready: 'Ready',
  pending: 'Pending',
  blocked: 'Blocked',
  stale: 'Stale',
  'read-only': 'Read-only',
}

export function CurriculumWorkflowNav({
  current,
  snapshot = null,
  identity = snapshot,
  onNavigate,
}: {
  readonly current: CurriculumWorkflowView
  readonly snapshot?: CurriculumWorkflowSnapshot | null
  readonly identity?: CurriculumWorkflowIdentity | null
  readonly onNavigate?: (view: CurriculumWorkflowView, href: string) => void
}) {
  const destinations = curriculumWorkflowDestinations(snapshot, identity)
  return (
    <nav className="curriculum-workflow-nav" aria-label="Curriculum pre-publish workflow">
      <div>
        <p>Pre-publish workflow</p>
        {identity && <small>Draft {identity.draftId} · revision {identity.draftRevision}</small>}
      </div>
      <ul>
        {destinations.map((destination) => (
          <li key={destination.id} data-state={destination.state}>
            <a
              href={destination.path}
              aria-current={current === destination.id ? 'page' : undefined}
              aria-label={`${destination.label}: ${STATE_LABELS[destination.state]}. ${destination.detail}`}
              onClick={onNavigate ? (event) => {
                event.preventDefault()
                onNavigate(destination.id, destination.path)
              } : undefined}
            >
              <span>{destination.label}</span>
              <small>{STATE_LABELS[destination.state]}</small>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
