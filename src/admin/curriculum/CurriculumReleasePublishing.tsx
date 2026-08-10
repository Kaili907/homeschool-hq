import type { CurriculumPublishingStatusResult } from '../curriculum-publishing/contracts'

const BLOCKING_COPY: Readonly<Record<string, string>> = {
  staged_candidate_missing: 'An exact immutable staged candidate is required.',
  staging_identity_mismatch: 'The draft identity, revision, target, base release, or Schema Set changed after staging.',
  artifact_set_incomplete: 'The staged artifact set is incomplete or its byte counts do not match.',
  artifact_tampered: 'At least one staged artifact no longer matches its stored SHA-256.',
  manifest_mismatch: 'The canonical manifest, artifact inventory, or manifest SHA-256 does not match.',
  package_mismatch: 'The staged package SHA-256 does not recompute to the recorded identity.',
  approval_stale: 'The exact approval is no longer current for this staged revision and validation.',
  validation_blocked: 'The exact validation is not publication-ready.',
  human_review_blocked: 'An unresolved human-review blocker remains.',
  target_version_collision: 'The target version already belongs to a different immutable release.',
}

function verdict(value: boolean): string {
  return value ? 'VERIFIED' : 'FAILED'
}

export function CurriculumReleasePublishing({
  status,
  busy,
  error,
  canPublish,
  onRefresh,
  onPublish,
}: {
  readonly status: CurriculumPublishingStatusResult | null
  readonly busy: boolean
  readonly error: string | null
  readonly canPublish: boolean
  readonly onRefresh: () => void
  readonly onPublish: () => void
}) {
  const candidate = status?.candidate ?? null
  const published = status?.published ?? null
  const publishAllowed = status?.eligible === true && candidate !== null && canPublish && !busy
  return (
    <section className="curriculum-release-publishing" aria-labelledby="curriculum-release-publishing-title">
      <header>
        <div>
          <p className="curriculum-studio-eyebrow">Immutable release custody · no activation</p>
          <h3 id="curriculum-release-publishing-title">Publish release</h3>
        </div>
        <strong className={`curriculum-publishing-state is-${status?.publicationState ?? 'unavailable'}`}>
          {published ? 'PUBLISHED, NOT ACTIVE' : status?.eligible ? 'ELIGIBLE TO PUBLISH' : 'NOT ELIGIBLE'}
        </strong>
      </header>

      {status ? (
        <>
          <dl className="curriculum-publishing-facts">
            <div><dt>Staging identity</dt><dd>{candidate?.stagingId ?? 'missing'}</dd></div>
            <div><dt>Target release</dt><dd>{status.targetVersion}</dd></div>
            <div><dt>Draft / revision</dt><dd>{status.draftId} / {status.draftRevision}</dd></div>
            <div><dt>Base release</dt><dd>{status.baseReleaseVersion}</dd></div>
            <div><dt>Schema Set</dt><dd>{status.schemaSetVersion}</dd></div>
            <div><dt>Approval</dt><dd>{candidate?.approvalStatus ?? 'missing'}</dd></div>
            <div><dt>Validation</dt><dd>{candidate?.validationStatus ?? 'missing'}</dd></div>
            <div><dt>Human review</dt><dd>{candidate?.humanReviewStatus ?? 'missing'}</dd></div>
          </dl>

          {candidate && (
            <div className="curriculum-publishing-verification" role="status">
              <strong>Staged evidence revalidation</strong>
              <dl>
                <div><dt>Artifact set</dt><dd>{verdict(candidate.verification.artifactSetComplete)}</dd></div>
                <div><dt>Content SHA-256</dt><dd>{verdict(candidate.verification.contentVerified)}</dd></div>
                <div><dt>Manifest SHA-256</dt><dd>{verdict(candidate.verification.manifestVerified)}</dd></div>
                <div><dt>Package SHA-256</dt><dd>{verdict(candidate.verification.packageVerified)}</dd></div>
              </dl>
              <p>{candidate.fileCount} immutable JSON artifacts · {candidate.byteCount.toLocaleString()} exact bytes</p>
              <code>{candidate.packageHash}</code>
            </div>
          )}

          {status.blockingReasons.length > 0 && (
            <div className="curriculum-publishing-blockers" role="alert">
              <strong>Publication is blocked</strong>
              <ul>{status.blockingReasons.map((reason) => <li key={reason}>{BLOCKING_COPY[reason] ?? reason}</li>)}</ul>
            </div>
          )}

          {published && (
            <div className="curriculum-published-result" role="status">
              <strong>PUBLISHED, NOT ACTIVE</strong>
              <p>Release {published.version} is registered with immutable artifacts. The production pointer and every learner pin are unchanged.</p>
              <dl>
                <div><dt>Release ID</dt><dd>{published.releaseId}</dd></div>
                <div><dt>Package SHA-256</dt><dd><code>{published.packageHash}</code></dd></div>
                <div><dt>Published artifacts</dt><dd>{published.fileCount} · {published.byteCount.toLocaleString()} bytes</dd></div>
                <div><dt>Activation</dt><dd>NOT ACTIVE</dd></div>
              </dl>
            </div>
          )}
        </>
      ) : <p role={error ? 'alert' : 'status'}>{error ?? 'Loading publication eligibility and exact staged evidence…'}</p>}

      {error && status && <p role="alert">{error}</p>}
      {!canPublish && !published && (
        <p className="curriculum-publishing-permission">Permission denied: curriculum:publish is required to publish.</p>
      )}
      <div className="curriculum-publishing-actions">
        <button type="button" disabled={busy} onClick={onRefresh}>Refresh publication status</button>
        {!published && canPublish && (
          <button type="button" disabled={!publishAllowed} onClick={onPublish}>
            {busy ? 'Publishing exact staged bytes…' : `Publish ${status?.targetVersion ?? 'staged release'}`}
          </button>
        )}
      </div>
      {!published && <small>Publication is one-way and immutable. It does not change the production active pointer or learner assignments.</small>}
    </section>
  )
}
