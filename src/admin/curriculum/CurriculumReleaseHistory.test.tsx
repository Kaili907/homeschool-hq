import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CurriculumReleaseHistoryModel } from '../curriculum-history'
import {
  CurriculumReleaseHistory,
  CurriculumReleaseHistoryState,
  CurriculumReleaseHistoryView,
} from './CurriculumReleaseHistory'

function model(): CurriculumReleaseHistoryModel {
  return {
    schemaVersion: 1,
    environment: 'production',
    authority: 'default_current_curriculum',
    activeReleaseVersion: '1.0.0',
    pointerRevision: 3,
    pointerTransitionKind: 'rollback',
    pointerTransitionedAt: '2026-08-10T18:00:00.000Z',
    releases: [
      {
        packageId: 'manuel-academy-v1', version: '1.0.0',
        publishedAt: '2026-08-09T15:00:00.000Z', authoredOn: '2026-08-03',
        publishedStatus: 'published', lifecycle: 'active', active: true,
        previouslyActive: true, pointerRevisions: [3, 1],
        integrityState: 'verified_evidence_available', provenanceKind: 'legacy',
        provenanceCompleteness: 'incomplete', provenanceEvidenceAvailable: true,
        sourceCommit: '1'.repeat(40), sourceRoot: 'curriculum-content/manuel-academy/1.0.0',
        baseReleaseVersion: null,
        rollbackEligibility: {
          state: 'ineligible', blockingReason: 'current_release',
          explanation: 'This release is already current and cannot be selected as a rollback target.',
        },
        counts: { courses: 30, units: 230, lessons: 2700, assessments: 230, texts: 18, schedules: 3 },
      },
      {
        packageId: 'manuel-academy-v2', version: '2.0.0',
        publishedAt: '2026-08-10T15:00:00.000Z', authoredOn: '2026-08-10',
        publishedStatus: 'published', lifecycle: 'previously_active', active: false,
        previouslyActive: true, pointerRevisions: [2],
        integrityState: 'verified_evidence_available', provenanceKind: 'legacy',
        provenanceCompleteness: 'incomplete', provenanceEvidenceAvailable: true,
        sourceCommit: '2'.repeat(40), sourceRoot: 'curriculum-content/manuel-academy/2.0.0',
        baseReleaseVersion: null,
        rollbackEligibility: {
          state: 'eligible', blockingReason: null,
          explanation: 'Previously active, published, and backed by the required immutable artifact evidence.',
        },
        counts: { courses: 30, units: 232, lessons: 2736, assessments: 232, texts: 18, schedules: 3 },
      },
    ],
    transitions: [
      {
        pointerRevision: 3, previousReleaseVersion: '2.0.0', newReleaseVersion: '1.0.0',
        transitionKind: 'rollback', reasonCode: 'release.rolled_back',
        transitionedAt: '2026-08-10T18:00:00.000Z',
      },
      {
        pointerRevision: 2, previousReleaseVersion: '1.0.0', newReleaseVersion: '2.0.0',
        transitionKind: 'activation', reasonCode: 'release.activated',
        transitionedAt: '2026-08-10T16:00:00.000Z',
      },
      {
        pointerRevision: 1, previousReleaseVersion: null, newReleaseVersion: '1.0.0',
        transitionKind: 'migration_seed', reasonCode: null,
        transitionedAt: '2026-08-09T16:00:00.000Z',
      },
    ],
    historyTruncated: false,
  }
}

describe('Curriculum Release History Admin surface', () => {
  it('shows active, prior, activation, rollback, provenance, and bounded eligibility evidence', () => {
    const markup = renderToStaticMarkup(
      <CurriculumReleaseHistoryView
        model={model()}
        releaseIntegrityHref={(version) => `/academy/admin/curriculum/releases/${version}/integrity`}
      />,
    )
    expect(markup).toContain('Curriculum Release History')
    expect(markup).toContain('Current active')
    expect(markup).toContain('<dd>1.0.0</dd>')
    expect(markup).toContain('Pointer revision')
    expect(markup).toContain('Previously active')
    expect(markup).toContain('Rollback eligible')
    expect(markup).toContain('Legacy')
    expect(markup).toContain('Incomplete provenance')
    expect(markup).toContain('Verified evidence available')
    expect(markup).toContain('Unavailable in published registry')
    expect(markup).toContain('release.rolled_back')
    expect(markup).toContain('release.activated')
    expect(markup).toContain('Revision 3')
    expect(markup).toContain('Open Release Integrity')
    expect(markup).not.toMatch(/confirm rollback|rollback to this release|activate this release/i)
  })

  it('provides native search/filter controls and listbox keyboard-navigation semantics', () => {
    const markup = renderToStaticMarkup(<CurriculumReleaseHistoryView model={model()} />)
    expect(markup).toContain('type="search"')
    expect(markup.match(/<select/g)).toHaveLength(2)
    expect(markup).toContain('role="listbox"')
    expect(markup).toContain('role="option"')
    expect(markup).toContain('aria-selected="true"')
    expect(markup).toContain('aria-controls="curriculum-release-governance-detail"')
    expect(markup).toContain('Release Integrity route unavailable')
  })

  it('has explicit empty, unavailable, and authorization-denied states without private identities', () => {
    const empty = renderToStaticMarkup(
      <CurriculumReleaseHistoryView model={{ ...model(), releases: [], transitions: [] }} />,
    )
    expect(empty).toContain('No published releases are available')
    expect(empty).toContain('No pointer transition evidence is available')

    const unavailable = renderToStaticMarkup(
      <CurriculumReleaseHistoryState role="alert" title="Release history unavailable">
        No partial history is shown.
      </CurriculumReleaseHistoryState>,
    )
    expect(unavailable).toContain('role="alert"')
    expect(unavailable).toContain('No partial history is shown')

    const read = vi.fn()
    const denied = renderToStaticMarkup(
      <CurriculumReleaseHistory authorization={{ status: 'denied' }} source={{ read }} />,
    )
    expect(denied).toContain('curriculum:read')
    expect(denied).toContain('No release or pointer evidence was loaded')
    expect(read).not.toHaveBeenCalled()

    const markup = renderToStaticMarkup(<CurriculumReleaseHistoryView model={model()} />)
    expect(markup).not.toMatch(/correlation|actor|student|learner|50000000-0000/i)
  })

  it('defines desktop, tablet, mobile, and visible-focus behavior', () => {
    const css = readFileSync(new URL('./curriculum-release-history.css', import.meta.url), 'utf8')
    expect(css).toContain('grid-template-columns: minmax(17rem, .85fr) minmax(0, 1.35fr)')
    expect(css).toContain('@container (max-width: 900px)')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('@media (max-width: 520px)')
    expect(css).toContain(':focus-visible')
  })
})
