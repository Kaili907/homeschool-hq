import type { CurriculumStagingStatusResult } from '../curriculum-staging/contracts'

const BLOCKING_COPY: Readonly<Record<string, string>> = {
  validation_missing: 'An exact validation snapshot is required for this revision.',
  validation_blocked: 'Validation is not publication-eligible or still has blocking findings.',
  approval_missing: 'Human approval is missing for this exact revision and validation identity.',
  approval_stale: 'The approval is stale for the current draft revision or validation identity.',
  changes_requested: 'Human review recorded changes requested for this revision.',
  target_version_collision: 'The target version already belongs to an immutable release or staged candidate.',
  revision_mismatch: 'The requested revision is not the current authoritative draft revision.',
  schema_set_unsupported: 'This Schema Set version is not supported by release staging.',
}

export function CurriculumReleaseStaging({
  status,
  busy,
  error,
  canStage,
  hasUnsavedChanges,
  currentDraftId = null,
  currentDraftRevision = null,
  onRefresh,
  onStage,
}: {
  readonly status: CurriculumStagingStatusResult | null
  readonly busy: boolean
  readonly error: string | null
  readonly canStage: boolean
  readonly hasUnsavedChanges: boolean
  readonly currentDraftId?: string | null
  readonly currentDraftRevision?: number | null
  readonly onRefresh: () => void
  readonly onStage: () => void
}) {
  const candidate = status?.candidate ?? null
  const evidenceStale = status !== null && currentDraftId !== null && currentDraftRevision !== null
    && (status.draftId !== currentDraftId || status.draftRevision !== currentDraftRevision)
  const stageAllowed = status?.eligible === true && !evidenceStale && canStage && !hasUnsavedChanges && !busy
  return (
    <section className="curriculum-release-staging" aria-labelledby="curriculum-release-staging-title">
      <header>
        <div>
          <p className="curriculum-studio-eyebrow">Release custody · exact revision</p>
          <h3 id="curriculum-release-staging-title">Release staging</h3>
        </div>
        <strong className={`curriculum-staging-state is-${status?.stageState ?? 'unavailable'}`}>
          {evidenceStale ? 'STALE EVIDENCE' : candidate ? 'STAGED, NOT PUBLISHED' : status?.eligible ? 'READY TO STAGE' : 'NOT ELIGIBLE'}
        </strong>
      </header>

      {evidenceStale && (
        <div className="curriculum-staging-blockers" role="alert">
          <strong>Staging evidence is stale</strong>
          <p>The loaded candidate belongs to revision {status.draftRevision}; this workspace is revision {currentDraftRevision}. Refresh before relying on eligibility.</p>
        </div>
      )}

      {status ? (
        <>
          <dl className="curriculum-staging-facts">
            <div><dt>Draft / revision</dt><dd>{status.draftId} / {status.draftRevision}</dd></div>
            <div><dt>Base release</dt><dd>{status.baseReleaseVersion}</dd></div>
            <div><dt>Target release</dt><dd>{status.targetVersion}</dd></div>
            <div><dt>Schema Set</dt><dd>{status.schemaSetVersion}</dd></div>
            <div><dt>Validation</dt><dd>{status.validation?.status ?? 'missing'}</dd></div>
            <div><dt>Approval</dt><dd>{status.approval?.status ?? 'missing'}</dd></div>
          </dl>

          {status.blockingReasons.length > 0 && (
            <div className="curriculum-staging-blockers" role="alert">
              <strong>Staging is blocked</strong>
              <ul>{status.blockingReasons.map((reason) => <li key={reason}>{BLOCKING_COPY[reason] ?? reason}</li>)}</ul>
            </div>
          )}

          {candidate && (
            <div className="curriculum-staging-manifest" role="status">
              <p><strong>Immutable candidate {candidate.stagingId}</strong></p>
              <dl>
                <div><dt>Artifacts</dt><dd>{candidate.fileCount} files · {candidate.byteCount.toLocaleString()} bytes</dd></div>
                <div><dt>Entities</dt><dd>{Object.values(candidate.entityCounts).reduce((total, count) => total + count, 0).toLocaleString()}</dd></div>
                <div><dt>Content SHA-256</dt><dd><code>{candidate.contentHash}</code></dd></div>
                <div><dt>Manifest SHA-256</dt><dd><code>{candidate.manifestHash}</code></dd></div>
                <div><dt>Package SHA-256</dt><dd><code>{candidate.packageHash}</code></dd></div>
              </dl>
              <p>This candidate is isolated from the published registry and learner runtime.</p>
            </div>
          )}
        </>
      ) : (
        <p role={error ? 'alert' : 'status'}>{error ?? 'Loading exact staging eligibility…'}</p>
      )}

      {error && status && <p role="alert">{error}</p>}
      {hasUnsavedChanges && <p role="alert">Save or discard local edits before staging.</p>}
      {!canStage && <p className="curriculum-staging-permission">Permission denied: curriculum:publish is required to stage a release candidate.</p>}
      <div className="curriculum-staging-actions">
        <button type="button" disabled={busy} onClick={onRefresh}>Refresh staging status</button>
        {!candidate && canStage && (
          <button type="button" disabled={!stageAllowed} onClick={onStage}>
            {busy ? 'Staging exact revision…' : 'Stage approved revision'}
          </button>
        )}
      </div>
      {!candidate && <small>Safe retry reuses the same request identity. Staging never publishes or changes an active pointer.</small>}
    </section>
  )
}
