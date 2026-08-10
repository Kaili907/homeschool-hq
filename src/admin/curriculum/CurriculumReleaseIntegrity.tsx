import { useEffect, useState, type ReactNode } from 'react'
import type {
  CurriculumIntegrityAuthorization,
  CurriculumIntegrityReport,
  CurriculumIntegritySource,
  CurriculumIntegrityStatus,
  CurriculumIntegritySubject,
} from '../curriculum-integrity/contracts'
import './curriculum-integrity.css'

export function CurriculumReleaseIntegrity({
  authorization,
  source,
}: {
  readonly authorization: CurriculumIntegrityAuthorization
  readonly source: CurriculumIntegritySource
}) {
  const canRead = authorization.status === 'authorized'
    && authorization.capabilities.includes('curriculum:read')
  const [report, setReport] = useState<CurriculumIntegrityReport | null>(null)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!canRead) {
      setReport(null)
      return
    }
    let current = true
    setReport(null)
    setError(false)
    source.readIntegrity().then(
      (value) => { if (current) setReport(value) },
      () => { if (current) setError(true) },
    )
    return () => { current = false }
  }, [canRead, reload, source])

  if (authorization.status === 'checking') {
    return <IntegrityState role="status" title="Checking release integrity access">No release evidence has been requested yet.</IntegrityState>
  }
  if (!canRead) {
    return <IntegrityState role="alert" title="Release integrity access unavailable">This Admin session does not have the curriculum:read capability.</IntegrityState>
  }
  if (error) {
    return <IntegrityState role="alert" title="Release integrity verifier unavailable" onRetry={() => setReload((value) => value + 1)}>No verification conclusion was produced. Existing artifacts and release state were not changed.</IntegrityState>
  }
  if (!report) {
    return <IntegrityState role="status" title="Verifying release integrity">Recalculating available artifact, manifest, package, metadata, and provenance evidence.</IntegrityState>
  }
  return <CurriculumReleaseIntegrityView report={report} />
}

function IntegrityState({
  role, title, children, onRetry,
}: {
  readonly role: 'status' | 'alert'
  readonly title: string
  readonly children: ReactNode
  readonly onRetry?: () => void
}) {
  return (
    <section className="curriculum-integrity-state" role={role} aria-labelledby="curriculum-integrity-state-title">
      <p className="curriculum-integrity-eyebrow">Release Integrity / Provenance</p>
      <h2 id="curriculum-integrity-state-title">{title}</h2>
      <p>{children}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </section>
  )
}

export function CurriculumReleaseIntegrityView({ report }: { readonly report: CurriculumIntegrityReport }) {
  return (
    <section className="curriculum-integrity" aria-labelledby="curriculum-integrity-title">
      <header>
        <div>
          <p className="curriculum-integrity-eyebrow">Admin Console · Read-only</p>
          <h2 id="curriculum-integrity-title">Release Integrity / Provenance</h2>
          <p>
            Recorded release evidence is compared with independently recalculated bytes and identities.
            The verifier never repairs, publishes, activates, rolls back, or changes a pointer.
          </p>
        </div>
        <StatusBadge status={report.status} label={`Overall ${report.status}`} />
      </header>

      {report.evidenceGaps.length > 0 && (
        <section className="curriculum-integrity-gaps" aria-labelledby="integrity-source-gaps">
          <h3 id="integrity-source-gaps">Unavailable evidence sources</h3>
          <ul>{report.evidenceGaps.map((gap) => <li key={gap.code}>{gap.message}</li>)}</ul>
        </section>
      )}

      {report.subjects.length === 0 ? (
        <div role="status" className="curriculum-integrity-empty">No staged or published release evidence is available to verify.</div>
      ) : report.subjects.map((subject) => <IntegritySubject key={subject.subjectId} subject={subject} />)}
    </section>
  )
}

function IntegritySubject({ subject }: { readonly subject: CurriculumIntegritySubject }) {
  return (
    <article className="curriculum-integrity-subject" aria-labelledby={`integrity-${subject.subjectId}`}>
      <header>
        <div>
          <p className="curriculum-integrity-eyebrow">{subject.state} release</p>
          <h3 id={`integrity-${subject.subjectId}`}>Version {subject.version}</h3>
          <p>{subject.packageId ?? 'Package identity unavailable'}</p>
        </div>
        <StatusBadge status={subject.status} />
      </header>

      <dl className="curriculum-integrity-facts">
        <Fact label="State" value={subject.state} />
        <Fact label="Manifest" value={subject.manifestStatus} status={subject.manifestStatus} />
        <Fact label="Package hash" value={subject.packageStatus} status={subject.packageStatus} />
        <Fact label="Artifact inventory" value={subject.artifacts.status} status={subject.artifacts.status} />
        <Fact label="Artifacts expected" value={subject.artifacts.expectedCount ?? 'Unavailable'} />
        <Fact label="Artifacts observed" value={subject.artifacts.observedCount ?? 'Unavailable'} />
        <Fact label="Artifacts verified" value={subject.artifacts.verifiedCount} />
        <Fact label="Metadata" value={subject.metadataStatus} status={subject.metadataStatus} />
        <Fact label="Base release" value={subject.baseReleaseVersion ?? 'Unavailable'} />
        <Fact label="Schema Set" value={subject.schemaSetVersion ?? 'Unavailable'} />
      </dl>

      <section className="curriculum-integrity-provenance" aria-labelledby={`provenance-${subject.subjectId}`}>
        <div className="curriculum-integrity-section-heading">
          <h4 id={`provenance-${subject.subjectId}`}>Provenance chain</h4>
          <StatusBadge status={subject.provenance.status} />
        </div>
        <ol aria-label={`Provenance chain for release ${subject.version}`}>
          {subject.provenance.links.map((link) => (
            <li key={link.kind}>
              <span className="curriculum-integrity-arrow" aria-hidden="true">→</span>
              <div>
                <strong>{link.label}</strong>
                <StatusBadge status={link.status} />
                {link.identity && <code>{link.identity}</code>}
                {link.detail && <p>{link.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {subject.mismatches.length > 0 && (
        <section className="curriculum-integrity-findings" aria-labelledby={`mismatches-${subject.subjectId}`}>
          <h4 id={`mismatches-${subject.subjectId}`}>Specific mismatches</h4>
          <ul>{subject.mismatches.map((item, index) => (
            <li key={`${item.code}:${item.subject}:${index}`}><strong>{item.subject}</strong> — {item.message}</li>
          ))}</ul>
        </section>
      )}

      {subject.evidenceGaps.length > 0 && (
        <section className="curriculum-integrity-gaps" aria-labelledby={`gaps-${subject.subjectId}`}>
          <h4 id={`gaps-${subject.subjectId}`}>UNVERIFIED evidence gaps</h4>
          <ul>{subject.evidenceGaps.map((gap) => <li key={gap.code}>{gap.message}</li>)}</ul>
        </section>
      )}
    </article>
  )
}

function Fact({ label, value, status }: { readonly label: string; readonly value: string | number; readonly status?: CurriculumIntegrityStatus }) {
  return <div><dt>{label}</dt><dd>{status ? <StatusBadge status={status} /> : value}</dd></div>
}

function StatusBadge({ status, label }: { readonly status: CurriculumIntegrityStatus; readonly label?: string }) {
  return <span className={`curriculum-integrity-badge is-${status.toLowerCase()}`} aria-label={label}>{status}</span>
}
