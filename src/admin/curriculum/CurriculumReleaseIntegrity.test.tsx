import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CurriculumIntegrityReport, CurriculumIntegritySource } from '../curriculum-integrity/contracts'
import {
  CurriculumReleaseIntegrity,
  CurriculumReleaseIntegrityView,
} from './CurriculumReleaseIntegrity'

const report: CurriculumIntegrityReport = {
  schemaVersion: 1, status: 'INCOMPLETE', readOnly: true,
  evidenceGaps: [{ code: 'staged_evidence_unavailable', message: 'Staged release evidence is currently unavailable.' }],
  subjects: [{
    subjectId: 'published:1.0.0', kind: 'published', version: '1.0.0', state: 'PUBLISHED',
    status: 'INCOMPLETE', packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
    baseReleaseVersion: null, schemaSetVersion: null, manifestStatus: 'VERIFIED',
    packageStatus: 'UNVERIFIED', metadataStatus: 'VERIFIED',
    artifacts: { status: 'VERIFIED', expectedCount: 182, observedCount: 182, verifiedCount: 182 },
    provenance: { status: 'INCOMPLETE', links: [
      { kind: 'draft', label: 'Draft revision', status: 'UNVERIFIED', identity: null, detail: 'No draft identity is recorded.' },
      { kind: 'validation', label: 'Validation', status: 'UNVERIFIED', identity: null, detail: 'No validation identity is recorded.' },
      { kind: 'approval', label: 'Approval', status: 'UNVERIFIED', identity: null, detail: 'No approval identity is recorded.' },
      { kind: 'staging', label: 'Staging', status: 'UNVERIFIED', identity: null, detail: 'No staging identity is recorded.' },
      { kind: 'published', label: 'Published release', status: 'VERIFIED', identity: '1.0.0', detail: 'Legacy import.' },
    ] },
    mismatches: [{ code: 'artifact_hash_mismatch', subject: 'README.md', message: 'Registry and observed artifact SHA-256 values differ.' }],
    evidenceGaps: [{ code: 'package_hash_unavailable', message: 'No canonical package hash is recorded.' }],
  }],
}

describe('Curriculum Release Integrity / Provenance UI', () => {
  it('renders status, release state, artifact counts, bounded mismatches, gaps, and the complete chain', () => {
    const markup = renderToStaticMarkup(<CurriculumReleaseIntegrityView report={report} />)
    expect(markup).toContain('Release Integrity / Provenance')
    expect(markup).toContain('Version 1.0.0')
    expect(markup).toContain('PUBLISHED')
    expect(markup).toContain('Artifacts expected')
    expect(markup).toContain('182')
    expect(markup).toContain('Specific mismatches')
    expect(markup).toContain('README.md')
    expect(markup).toContain('UNVERIFIED evidence gaps')
    expect(markup).toContain('No canonical package hash is recorded.')
    expect(markup).toContain('aria-label="Provenance chain for release 1.0.0"')
    for (const label of ['Draft revision', 'Validation', 'Approval', 'Staging', 'Published release']) {
      expect(markup).toContain(label)
    }
  })

  it('is read-only and exposes no payload or mutation controls', () => {
    const markup = renderToStaticMarkup(<CurriculumReleaseIntegrityView report={report} />).toLowerCase()
    expect(markup).toContain('read-only')
    expect(markup).toContain('never repairs')
    expect(markup).not.toContain('<button')
    expect(markup).not.toContain('canonicalcontent')
    expect(markup).not.toContain('curriculum payload')
    expect(markup).not.toContain('type="submit"')
  })

  it('does not request evidence without curriculum:read authorization', () => {
    const source: CurriculumIntegritySource = { readIntegrity: vi.fn() }
    const markup = renderToStaticMarkup(
      <CurriculumReleaseIntegrity authorization={{ status: 'denied' }} source={source} />,
    )
    expect(markup).toContain('Release integrity access unavailable')
    expect(source.readIntegrity).not.toHaveBeenCalled()
  })
})
