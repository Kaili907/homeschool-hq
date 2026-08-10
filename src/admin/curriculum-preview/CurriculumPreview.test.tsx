import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CurriculumDraftAuthoringSource,
  CurriculumDraftSummary,
  CurriculumPreviewEntityDiff,
  CurriculumPreviewResult,
} from '../curriculum-authoring/contracts'
import { CurriculumPreview, CurriculumPreviewState, CurriculumPreviewView } from './CurriculumPreview'
import {
  CURRICULUM_PREVIEW_RENDER_LIMIT,
  currentPreviewValidation,
  curriculumPreviewEntityToken,
  curriculumPreviewKeyboardTarget,
  filterCurriculumPreview,
  isCurriculumPreviewStale,
} from './model'

const DRAFT_ID = '10000000-0000-4000-8000-000000000001'

const draft: CurriculumDraftSummary = {
  schemaVersion: 1,
  draftId: DRAFT_ID,
  baseReleaseVersion: '1.0.0',
  targetVersion: '2.0.0-draft.1',
  authoringSchemaVersion: '2.0.0',
  lifecycleState: 'draft',
  revision: 4,
  createdAt: '2026-08-10T12:00:00Z',
  updatedAt: '2026-08-10T13:00:00Z',
}

const modified: CurriculumPreviewEntityDiff = {
  entityType: 'lesson',
  entityRef: 'lesson:math-5-1',
  label: 'Lesson 1: Revised patterns',
  context: 'launch · day 1',
  changeType: 'modified',
  basePosition: 0,
  candidatePosition: 1,
  fieldChangeCount: 3,
  fieldChangesLimited: false,
  fieldChanges: [
    { path: 'title', label: 'Title', category: 'identity', before: { kind: 'text', display: 'Patterns' }, after: { kind: 'text', display: 'Revised patterns' } },
    { path: 'tutor_routes', label: 'Tutor Routes', category: 'tutor-routing', before: { kind: 'list', display: '1 item', itemCount: 1 }, after: { kind: 'list', display: '2 items', itemCount: 2 } },
    { path: 'protected_metadata', label: 'Protected Metadata', category: 'protected', before: { kind: 'withheld', display: 'Withheld from preview' }, after: { kind: 'withheld', display: 'Withheld from preview' } },
  ],
}

const unchanged: CurriculumPreviewEntityDiff = {
  entityType: 'course', entityRef: 'course:math-5', label: 'Mathematics 5', context: 'mathematics',
  changeType: 'unchanged', basePosition: 0, candidatePosition: 0,
  fieldChangeCount: 0, fieldChangesLimited: false, fieldChanges: [],
}

function preview(entities: readonly CurriculumPreviewEntityDiff[] = [unchanged, modified]): CurriculumPreviewResult {
  const counts = {
    unchanged: entities.filter((entity) => entity.changeType === 'unchanged').length,
    added: entities.filter((entity) => entity.changeType === 'added').length,
    modified: entities.filter((entity) => entity.changeType === 'modified').length,
    removed: entities.filter((entity) => entity.changeType === 'removed').length,
  }
  const typedCounts = (entityType: CurriculumPreviewEntityDiff['entityType']) => ({
    unchanged: entities.filter((entity) => entity.entityType === entityType && entity.changeType === 'unchanged').length,
    added: entities.filter((entity) => entity.entityType === entityType && entity.changeType === 'added').length,
    modified: entities.filter((entity) => entity.entityType === entityType && entity.changeType === 'modified').length,
    removed: entities.filter((entity) => entity.entityType === entityType && entity.changeType === 'removed').length,
  })
  const baseEntities = counts.unchanged + counts.modified + counts.removed
  const candidateEntities = counts.unchanged + counts.modified + counts.added
  return {
    schemaVersion: 1,
    previewRef: `curriculum-preview:${DRAFT_ID}:4:${'a'.repeat(64)}`,
    authority: {
      draftId: DRAFT_ID, draftRevision: 4, baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-draft.1',
      schemaSetVersion: '2.0.0', candidateDigest: 'a'.repeat(64),
    },
    freshness: 'current',
    summary: {
      ...counts,
      baseEntities,
      candidateEntities,
      totalCompared: entities.length,
      byEntityType: {
        course: typedCounts('course'), unit: typedCounts('unit'), lesson: typedCounts('lesson'),
        assessment: typedCounts('assessment'), media_resource: typedCounts('media_resource'),
      },
      validationStatus: 'invalid', publicationReady: false,
      validationBlockers: 1, humanReviewBlockers: 1, standardsBlockers: 1,
    },
    validation: {
      state: 'current',
      draftRevision: 4,
      run: {
        engineVersion: 'curriculum-validation-v2',
        status: 'invalid',
        statusMessage: 'The snapshot has publication-blocking validation findings.',
        publicationReady: false,
        source: { origin: 'draft', snapshotId: `${DRAFT_ID}@4`, curriculumVersion: '2.0.0-draft.1', schemaSetVersion: '2.0.0' },
        summary: { total: 1, errors: 1, warnings: 0, info: 0, blocking: 1, nonBlocking: 0 },
        findings: [{
          id: 'cvf-standard', severity: 'error', category: 'standards',
          entity: { type: 'lesson', id: 'lesson:physical-education-5' }, path: 'lessons[0].standards',
          rule: 'standards.human_review_required', explanation: 'Michigan PE mapping requires human review.',
          blocking: true, remediation: 'Complete standards review.',
        }],
      },
    },
    entities,
  }
}

function source(): CurriculumDraftAuthoringSource {
  return {
    listDrafts: vi.fn(), readDraft: vi.fn(), readEntity: vi.fn(), createDraft: vi.fn(), createEntity: vi.fn(),
    updateEntity: vi.fn(), tombstoneEntity: vi.fn(), readBaseIndex: vi.fn(), readBaseEntity: vi.fn(),
    readMaterialization: vi.fn(), validateDraft: vi.fn(), readPreview: vi.fn(),
  }
}

describe('ADMIN-19 Curriculum Preview / Diff UI', () => {
  it('renders exact authority, reconciled summary, structured before/after, blockers, and no mutation controls', () => {
    const markup = renderToStaticMarkup(
      <CurriculumPreviewView preview={preview()} drafts={[draft]} selectedDraftId={DRAFT_ID} latestRevision={4} />,
    )
    expect(markup).toContain('Revision-bound candidate')
    expect(markup).toContain(DRAFT_ID)
    expect(markup).toContain('Base release')
    expect(markup).toContain('2.0.0-draft.1')
    expect(markup).toContain('Current · revision 4')
    expect(markup).toContain('Structured before and after changes')
    expect(markup).toContain('Published base')
    expect(markup).toContain('Draft candidate')
    expect(markup).toContain('Michigan PE mapping requires human review')
    expect(markup).toContain('Validation: invalid')
    expect(markup).toContain('Publication ready')
    expect(markup).toContain('No')
    expect(markup).not.toMatch(/stage release|publish now|activate release|save preview/i)
    expect(markup).not.toContain('private note')
  })

  it('keeps an older preview visibly stale and never implies the newer revision was previewed', () => {
    expect(isCurriculumPreviewStale(4, 5)).toBe(true)
    const markup = renderToStaticMarkup(
      <CurriculumPreviewView preview={preview()} drafts={[{ ...draft, revision: 5 }]} selectedDraftId={DRAFT_ID} latestRevision={5} />,
    )
    expect(markup).toContain('Stale · draft is now revision 5')
    expect(markup).toContain('This preview remains bound to revision 4')
    expect(markup).toContain('Revision 5 has not been previewed')
  })

  it('does not present validation from the wrong revision as current', () => {
    const wrongValidation: CurriculumPreviewResult = {
      ...preview(),
      validation: { state: 'not-current', draftRevision: 3, run: null },
    }
    expect(currentPreviewValidation(wrongValidation)).toBeNull()
    const markup = renderToStaticMarkup(
      <CurriculumPreviewView preview={wrongValidation} drafts={[draft]} selectedDraftId={DRAFT_ID} latestRevision={4} />,
    )
    expect(markup).toContain('Validation is not current for this preview')
    expect(markup).toContain('another revision is never treated as current')
    expect(markup).not.toContain('Validation: valid')
  })

  it('supports change/entity/search filters and caps large trees without changing authoritative counts', () => {
    const many = Array.from({ length: 450 }, (_, index): CurriculumPreviewEntityDiff => ({
      ...modified,
      entityRef: `lesson:math-${index}`,
      label: index === 449 ? 'Needle lesson' : `Lesson ${index}`,
      changeType: index % 2 ? 'modified' : 'added',
    }))
    const result = preview(many)
    const capped = filterCurriculumPreview(result, { search: '', changeType: 'all', entityType: 'all' })
    expect(capped.entities).toHaveLength(CURRICULUM_PREVIEW_RENDER_LIMIT)
    expect(capped.total).toBe(450)
    expect(capped.limited).toBe(true)
    expect(filterCurriculumPreview(result, { search: 'needle', changeType: 'modified', entityType: 'lesson' }).entities)
      .toHaveLength(1)
    const markup = renderToStaticMarkup(
      <CurriculumPreviewView preview={result} drafts={[draft]} selectedDraftId={DRAFT_ID} latestRevision={4} />,
    )
    expect(markup).toContain(`Rendering is capped at ${CURRICULUM_PREVIEW_RENDER_LIMIT} rows`)
    expect(markup).toContain('Summary counts still cover the complete candidate')
  })

  it('has a truthful no-change state and keyboard-navigable stable entity identities', () => {
    const noChange = preview([unchanged])
    const markup = renderToStaticMarkup(
      <CurriculumPreviewView preview={noChange} drafts={[draft]} selectedDraftId={DRAFT_ID} latestRevision={4} />,
    )
    expect(markup).toContain('No candidate changes')
    expect(markup).toContain('matches its published base')
    const entities = [unchanged, modified]
    expect(curriculumPreviewKeyboardTarget(entities, curriculumPreviewEntityToken(unchanged), 'ArrowDown'))
      .toBe(curriculumPreviewEntityToken(modified))
    expect(curriculumPreviewKeyboardTarget(entities, curriculumPreviewEntityToken(modified), 'Home'))
      .toBe(curriculumPreviewEntityToken(unchanged))
  })

  it('fails closed before read authorization and defines responsive, visible-focus layout', () => {
    const deniedSource = source()
    const markup = renderToStaticMarkup(<CurriculumPreview authorization={{ status: 'denied' }} source={deniedSource} />)
    expect(markup).toContain('Curriculum preview access unavailable')
    expect(markup).toContain('No draft, candidate metadata, or validation result was loaded')
    expect(deniedSource.listDrafts).not.toHaveBeenCalled()
    expect(deniedSource.readPreview).not.toHaveBeenCalled()

    const css = readFileSync(new URL('./curriculum-preview.css', import.meta.url), 'utf8')
    expect(css).toContain('container-type: inline-size')
    expect(css).toContain('@container (max-width: 900px)')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('@media (max-width: 480px)')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('prefers-reduced-motion')
  })

  it('renders explicit loading, unavailable, and no-draft states', () => {
    const loading = renderToStaticMarkup(<CurriculumPreviewState title="Building exact revision preview" busy>Loading candidate…</CurriculumPreviewState>)
    const unavailable = renderToStaticMarkup(<CurriculumPreviewState title="Curriculum preview unavailable" alert>Safe unavailable state.</CurriculumPreviewState>)
    const empty = renderToStaticMarkup(<CurriculumPreviewState title="No draft is available to compare">Create a draft first.</CurriculumPreviewState>)
    expect(loading).toContain('aria-busy="true"')
    expect(loading).toContain('role="status"')
    expect(unavailable).toContain('role="alert"')
    expect(unavailable).not.toContain('server error')
    expect(empty).toContain('No draft is available to compare')
  })
})
