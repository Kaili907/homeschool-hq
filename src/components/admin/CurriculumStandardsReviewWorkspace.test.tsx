import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildCurriculumStandardsReviewQueue } from '../../admin/curriculum-standards-review/model'
import { createHumanStandardsReviewFinding } from '../../admin/curriculum-validation/engine'
import {
  KNOWN_STANDARDS_REVIEW_CONTEXT,
  knownCurriculumStandardsReviewOccurrences,
} from '../../admin/curriculum-standards-review/knownEvidence'
import { CurriculumStandardsReviewWorkspace } from './CurriculumStandardsReviewWorkspace'

describe('CurriculumStandardsReviewWorkspace', () => {
  it('renders repository-backed unresolved counts, filters, grouping, and entity drill-down accessibly', () => {
    const html = renderToStaticMarkup(<CurriculumStandardsReviewWorkspace
      readState={{ status: 'ready', decisions: [] }} canManage canApprove
    />)
    expect(html).toContain('Human standards review')
    expect(html).toContain('>658<')
    expect(html).toContain('Local label 2')
    for (const id of [
      'standards-review-query', 'standards-review-grade', 'standards-review-course',
      'standards-review-status', 'standards-review-group', 'standards-decision-status',
      'standards-reviewer-note',
    ]) expect(html).toContain(`id="${id}"`)
    expect(html).toContain('Affected entities (')
    expect(html).toContain('cvf-')
    expect(html).toContain('sm:grid-cols-2')
    expect(html).toContain('xl:grid-cols-5')
    expect(html).toContain('xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,.9fr)]')
  })

  it('shows explicit evidence fields for an approved decision and explains separate persistence', () => {
    const candidate = buildCurriculumStandardsReviewQueue(
      knownCurriculumStandardsReviewOccurrences(), KNOWN_STANDARDS_REVIEW_CONTEXT,
    )[0]
    const decision = {
      schemaVersion: 1 as const, ...candidate,
      findingIds: candidate.entities.map((entity) => entity.findingId),
      status: 'approved_mapping' as const,
      canonicalStandardId: 'verified-id-entered-by-human',
      frameworkVersion: 'verified-version-entered-by-human',
      canonicalTitle: 'Verified title entered by human',
      evidenceSource: 'Official source reference entered by human',
      reviewerNote: 'Evidence verified by human reviewer.',
      revision: 1,
      updatedAt: '2026-08-10T12:00:00Z',
    }
    const html = renderToStaticMarkup(<CurriculumStandardsReviewWorkspace
      readState={{ status: 'ready', decisions: [decision] }} canManage canApprove
    />)
    for (const id of ['standards-canonical-id', 'standards-framework-version', 'standards-canonical-title', 'standards-evidence-source']) {
      expect(html).toContain(`id="${id}"`)
    }
    expect(html).toContain('Enter only facts verified by a human')
    expect(html).toContain('does not rewrite the published release or apply changes to a draft')
  })

  it('derives grade filter options from current unresolved evidence, including two-digit grades', () => {
    const occurrences = [3, 10, 12].map((grade) => ({
      sourceLabel: 'UNVERIFIED-LOCAL',
      grade,
      courseRef: `ma-g${grade}-science`,
      finding: createHumanStandardsReviewFinding({
        entity: { type: 'lesson', id: `ma-g${grade}-science-u10-l12` },
        path: `lessons[${grade}].standards[0]`,
        legacyLabel: 'UNVERIFIED-LOCAL',
      }),
    }))
    const html = renderToStaticMarkup(<CurriculumStandardsReviewWorkspace
      readState={{ status: 'ready', decisions: [], occurrences, context: { kind: 'draft', ref: 'draft:grades' } }}
      canManage canApprove
    />)

    expect(html).toContain('<option value="3">Grade 3</option>')
    expect(html).toContain('<option value="10">Grade 10</option>')
    expect(html).toContain('<option value="12">Grade 12</option>')
    expect(html).not.toContain('<option value="5">Grade 5</option>')
    expect(html).toContain('UNVERIFIED-LOCAL')
  })

  it('withholds approval when the presentation lacks curriculum approval capability', () => {
    const html = renderToStaticMarkup(<CurriculumStandardsReviewWorkspace
      readState={{ status: 'ready', decisions: [] }} canManage canApprove={false}
    />)
    expect(html).toContain('Approved mapping — approval capability required')
    expect(html).toContain('value="approved_mapping" disabled=""')
  })

  it('fails closed for denied, unavailable, and loading reads', () => {
    expect(renderToStaticMarkup(<CurriculumStandardsReviewWorkspace readState={{ status: 'denied' }} canManage={false} canApprove={false} />)).toContain('Curriculum read capability is required')
    expect(renderToStaticMarkup(<CurriculumStandardsReviewWorkspace readState={{ status: 'error' }} canManage={false} canApprove={false} />)).toContain('No substitute decisions are shown')
    expect(renderToStaticMarkup(<CurriculumStandardsReviewWorkspace readState={{ status: 'loading' }} canManage={false} canApprove={false} />)).toContain('aria-busy="true"')
  })
})
