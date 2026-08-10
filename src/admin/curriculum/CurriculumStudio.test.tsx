import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AdminCapability } from '../contracts'
import type { CurriculumCatalog, CurriculumLessonSummary } from './contracts'
import type {
  CurriculumDraftAuthoringSource,
  CurriculumStudioEntityIndexEntry,
} from '../curriculum-authoring/contracts'
import type { CurriculumApprovalSource } from '../curriculum-approval/contracts'
import type { CurriculumStagingSource } from '../curriculum-staging/contracts'
import {
  CurriculumStudio,
  CurriculumStudioView,
  confirmCurriculumNavigation,
  curriculumPayloadDirty,
  curriculumSavedMessage,
} from './CurriculumStudio'
import { CurriculumWorkflowNav, CurriculumPreviewUnavailable } from './CurriculumWorkflowNav'
import {
  CURRICULUM_STUDIO_RENDER_LIMIT,
  buildCurriculumStudioIndex,
  buildMaterializedCurriculumStudioIndex,
  canWriteCurriculumDrafts,
  createCurriculumStudioSource,
  curriculumTreeKeyboardAction,
  expandedAncestorsFor,
  resolveCurriculumStudioEntity,
  visibleCurriculumStudioRows,
} from './studioModel'

const lesson: CurriculumLessonSummary = {
  lessonId: 'g5-math-u01-d01',
  courseId: 'g5-math',
  grade: 5,
  subject: 'mathematics',
  courseDay: 1,
  unitNumber: 1,
  unitTitle: 'Patterns and place value',
  dayInUnit: 1,
  title: 'Notice the pattern',
  phase: 'launch',
  focus: 'Describe a numerical pattern.',
  standards: ['5.OA.B.3'],
}

const catalog: CurriculumCatalog = {
  source: {
    packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
    version: '1.0.0',
    authoredOn: '2026-08-03',
    status: 'curriculum-authoring-release-complete',
    lifecycle: 'published',
    validationStatus: 'passed',
  },
  grades: [5],
  courses: [{
    courseId: 'g5-math', grade: 5, subject: 'mathematics', title: 'Grade 5 Mathematics', days: 180,
  }],
  units: [{
    unitId: 'g5-math-u01', courseId: 'g5-math', grade: 5, subject: 'mathematics',
    unitNumber: 1, title: 'Patterns and place value', days: 12, standards: ['5.OA.B.3'],
    topics: ['patterns'], lessonIds: [lesson.lessonId], assessmentId: 'g5-math-u01-assessment',
  }],
  lessons: [lesson],
  assessments: [{
    assessmentId: 'g5-math-u01-assessment', courseId: 'g5-math', unitNumber: 1,
    unitTitle: 'Patterns and place value', standards: ['5.OA.B.3'], totalPoints: 20,
  }],
}

const viewerCapabilities: readonly AdminCapability[] = ['curriculum:read']
const authorCapabilities: readonly AdminCapability[] = ['curriculum:read', 'curriculum:drafts:write']

const baseEntries: readonly CurriculumStudioEntityIndexEntry[] = [
  {
    entityType: 'course', entityRef: 'g5-math', origin: 'base', revision: null, position: 0,
    parentId: 'grade:5', grade: 5, subject: 'mathematics', label: 'Grade 5 Mathematics', context: 'mathematics · 1 unit',
  },
  {
    entityType: 'unit', entityRef: 'g5-math-u01', origin: 'base', revision: null, position: 0,
    parentId: 'course:g5-math', grade: 5, subject: 'mathematics', courseRef: 'g5-math',
    label: 'Unit 1: Patterns and place value', context: '1 lesson · assessment',
  },
  {
    entityType: 'lesson', entityRef: lesson.lessonId, origin: 'base', revision: null, position: 0,
    parentId: 'unit:g5-math-u01', grade: 5, subject: 'mathematics', courseRef: 'g5-math', unitRef: 'g5-math-u01',
    label: 'Lesson 1: Notice the pattern', context: 'launch · day 1',
  },
  {
    entityType: 'assessment', entityRef: 'g5-math-u01-assessment', origin: 'base', revision: null, position: 0,
    parentId: 'unit:g5-math-u01', courseRef: 'g5-math', unitRef: 'g5-math-u01',
    label: 'Assessment: Patterns', context: '20 points',
  },
  {
    entityType: 'media_resource', entityRef: 'g5-source-01', origin: 'base', revision: null, position: 0,
    parentId: 'resources:all', label: 'Original source', context: 'text · optional',
  },
]

function authoringSource(): CurriculumDraftAuthoringSource {
  return {
    listDrafts: vi.fn(async () => ({ schemaVersion: 1 as const, drafts: [] })),
    readDraft: vi.fn(), readEntity: vi.fn(), createDraft: vi.fn(), createEntity: vi.fn(),
    updateEntity: vi.fn(), tombstoneEntity: vi.fn(),
    readBaseIndex: vi.fn(async () => ({ schemaVersion: 1 as const, baseReleaseVersion: '1.0.0', entities: baseEntries })),
    readBaseEntity: vi.fn(), readMaterialization: vi.fn(), validateDraft: vi.fn(),
  }
}

function approvalSource(): CurriculumApprovalSource {
  return { readApproval: vi.fn(), decideApproval: vi.fn() }
}

function stagingSource(): CurriculumStagingSource {
  return { readStaging: vi.fn(), stageDraft: vi.fn() }
}

const studioSource = createCurriculumStudioSource(
  { loadCatalog: vi.fn(async () => catalog) },
  authoringSource(),
  approvalSource(),
  stagingSource(),
)

describe('Curriculum Studio shell', () => {
  it('builds the canonical Grade → Course → Unit → Lesson / Assessment hierarchy', () => {
    const index = buildCurriculumStudioIndex(catalog)
    expect(index.rows.map((row) => [row.depth, row.id])).toEqual([
      [1, 'grade:5'],
      [2, 'course:g5-math'],
      [3, 'unit:g5-math-u01'],
      [4, 'lesson:g5-math-u01-d01'],
      [4, 'assessment:g5-math-u01-assessment'],
    ])
    expect(index.byId.get('assessment:g5-math-u01-assessment')?.parentId).toBe('unit:g5-math-u01')
  })

  it('resolves stable selected-entity tokens and expands their ancestry', () => {
    const index = buildCurriculumStudioIndex(catalog)
    const selected = resolveCurriculumStudioEntity(index, 'lesson:g5-math-u01-d01')
    expect(selected?.entity.kind).toBe('lesson')
    expect([...expandedAncestorsFor(index, selected!.id)]).toEqual([
      'grade:5', 'course:g5-math', 'unit:g5-math-u01',
    ])
    expect(resolveCurriculumStudioEntity(index, 'lesson:not-real')).toBeNull()
  })

  it('materializes overrides once, retains draft-created entities, and includes media resources', () => {
    const override = { ...baseEntries[0], origin: 'base_override' as const, revision: 2, label: 'Revised Mathematics' }
    const created = {
      ...baseEntries[4], entityRef: 'draft-resource', origin: 'draft_created' as const,
      revision: 1, position: 1, label: 'Draft resource',
    }
    const index = buildMaterializedCurriculumStudioIndex([...baseEntries, override, created])
    expect(index.rows.filter((row) => row.id === 'course:g5-math')).toHaveLength(1)
    expect(index.byId.get('course:g5-math')?.label).toBe('Revised Mathematics')
    expect(index.byId.get('media_resource:draft-resource')?.parentId).toBe('resources:all')
  })

  it('does not render a giant expanded tree eagerly', () => {
    const manyLessons = Array.from({ length: 400 }, (_, index): CurriculumLessonSummary => ({
      ...lesson,
      lessonId: `g5-math-u01-d${String(index + 1).padStart(3, '0')}`,
      dayInUnit: index + 1,
      courseDay: index + 1,
      title: `Lesson ${index + 1}`,
    }))
    const largeCatalog: CurriculumCatalog = {
      ...catalog,
      lessons: manyLessons,
      units: [{ ...catalog.units[0], lessonIds: manyLessons.map((item) => item.lessonId) }],
    }
    const index = buildCurriculumStudioIndex(largeCatalog)
    const visible = visibleCurriculumStudioRows(
      index,
      new Set(['grade:5', 'course:g5-math', 'unit:g5-math-u01']),
      '',
    )
    expect(visible.limited).toBe(true)
    expect(visible.rows).toHaveLength(CURRICULUM_STUDIO_RENDER_LIMIT)
    expect(visible.total).toBe(404)
  })

  it('searches metadata while retaining the matching entity ancestry', () => {
    const index = buildCurriculumStudioIndex(catalog)
    const visible = visibleCurriculumStudioRows(index, new Set(), '5.OA.B.3')
    expect(visible.rows.map((row) => row.id)).toEqual([
      'grade:5',
      'course:g5-math',
      'unit:g5-math-u01',
      'lesson:g5-math-u01-d01',
      'assessment:g5-math-u01-assessment',
    ])
  })

  it('supports standard tree keyboard navigation, expansion, collapse, and selection', () => {
    const index = buildCurriculumStudioIndex(catalog)
    const collapsed = visibleCurriculumStudioRows(index, new Set(), '').rows
    expect(curriculumTreeKeyboardAction(collapsed, 'grade:5', new Set(), 'ArrowRight')).toEqual({
      focusId: 'grade:5', toggleId: 'grade:5',
    })
    const expandedIds = new Set(['grade:5'])
    const expanded = visibleCurriculumStudioRows(index, expandedIds, '').rows
    expect(curriculumTreeKeyboardAction(expanded, 'grade:5', expandedIds, 'ArrowRight')).toEqual({
      focusId: 'course:g5-math',
    })
    expect(curriculumTreeKeyboardAction(expanded, 'course:g5-math', expandedIds, 'ArrowLeft')).toEqual({
      focusId: 'grade:5',
    })
    expect(curriculumTreeKeyboardAction(expanded, 'course:g5-math', expandedIds, 'Enter')).toEqual({
      focusId: 'course:g5-math', selectId: 'course:g5-math',
    })
    expect(curriculumTreeKeyboardAction(expanded, 'grade:5', expandedIds, 'ArrowLeft')).toEqual({
      focusId: 'grade:5', toggleId: 'grade:5',
    })
  })

  it('truthfully models dirty navigation protection and replay-confirmed saves', () => {
    const original = { schema_set_version: '2.0.0', resource_id: 'test-resource', kind: 'text', title: 'Original', locator: 'test', rights: 'Owned', required: false, text_fallback: 'Text' } as const
    expect(curriculumPayloadDirty(original, original)).toBe(false)
    expect(curriculumPayloadDirty({ ...original, title: 'Changed' }, original)).toBe(true)
    expect(confirmCurriculumNavigation(true, () => false)).toBe(false)
    expect(confirmCurriculumNavigation(true, () => true)).toBe(true)
    expect(curriculumSavedMessage(false)).toBe('Saved')
    expect(curriculumSavedMessage(true)).toContain('replay confirmed')
  })

  it('renders the responsive three-pane workspace, focusable tree, media, and truthful viewer state', () => {
    const markup = renderToStaticMarkup(
      <CurriculumStudioView catalog={catalog} capabilities={viewerCapabilities} source={studioSource} initialBaseEntries={baseEntries} />,
    )
    expect(markup).toContain('aria-label="Curriculum hierarchy"')
    expect(markup).toContain('aria-label="Selected entity editor workspace"')
    expect(markup).toContain('aria-label="Curriculum metadata and status inspector"')
    expect(markup).toContain('role="tree"')
    expect(markup).toContain('role="treeitem"')
    expect(markup).toContain('tabindex="0"')
    expect(markup).toContain('Media resources')
    expect(markup).toContain('Read-only: curriculum:drafts:write is unavailable')
    expect(markup).toContain('no active release is implied')
    expect(markup).not.toContain('Create draft entity')
    expect(markup).not.toContain('autosaved')
  })

  it('is connected but does not imply an editable workspace until a draft is open', () => {
    expect(canWriteCurriculumDrafts(viewerCapabilities)).toBe(false)
    expect(canWriteCurriculumDrafts(authorCapabilities)).toBe(true)
    const markup = renderToStaticMarkup(
      <CurriculumStudioView catalog={catalog} capabilities={authorCapabilities} source={studioSource} initialBaseEntries={baseEntries} />,
    )
    expect(markup).toContain('data-draft-service="connected"')
    expect(markup).toContain('Draft service connected')
    expect(markup).toContain('Target-version intent')
    expect(markup).toContain('Select a draft or create a new workspace')
    expect(markup).toContain('Create from 1.0.0')
  })

  it('fails closed before curriculum read authorization and never calls the source during render', () => {
    const loadPublishedCatalog = vi.fn()
    const markup = renderToStaticMarkup(
      <CurriculumStudio authorization={{ status: 'denied' }} source={{ ...authoringSource(), ...approvalSource(), ...stagingSource(), loadPublishedCatalog }} />,
    )
    expect(markup).toContain('Curriculum Studio access unavailable')
    expect(markup).toContain('No hierarchy or draft metadata was loaded')
    expect(markup).not.toContain(catalog.source.packageId)
    expect(loadPublishedCatalog).not.toHaveBeenCalled()
  })

  it('combines the published read with the real draft authoring seam', async () => {
    const loadCatalog = vi.fn(async () => catalog)
    const draftSource = authoringSource()
    const source = createCurriculumStudioSource({ loadCatalog }, draftSource, approvalSource(), stagingSource())
    await expect(source.loadPublishedCatalog()).resolves.toBe(catalog)
    await expect(source.listDrafts()).resolves.toEqual({ schemaVersion: 1, drafts: [] })
    expect(loadCatalog).toHaveBeenCalledOnce()
    expect(source.createEntity).toBe(draftSource.createEntity)
  })

  it('exposes all controlled curriculum workflow destinations without publish activation', () => {
    const markup = renderToStaticMarkup(<CurriculumWorkflowNav current="studio" />)
    expect(markup).toContain('href="/academy/admin/curriculum"')
    expect(markup).toContain('href="/academy/admin/curriculum/studio"')
    expect(markup).toContain('href="/academy/admin/curriculum/integrity"')
    expect(markup).toContain('href="/academy/admin/curriculum/validation"')
    expect(markup).toContain('href="/academy/admin/curriculum/preview"')
    expect(markup).toContain('aria-current="page"')
    expect(markup).not.toMatch(/publish curriculum|activate publish/i)

    const preview = renderToStaticMarkup(<CurriculumPreviewUnavailable />)
    expect(preview).toContain('No draft is available to compare')
    expect(preview).toContain('No draft was loaded')
    expect(preview).not.toContain('generated successfully')
  })

  it('defines desktop, tablet, mobile, and visible-focus behavior', () => {
    const css = readFileSync(new URL('./curriculum-studio.css', import.meta.url), 'utf8')
    expect(css).toContain('grid-template-areas: "tree editor inspector"')
    expect(css).toContain('@container (max-width: 1050px)')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('@media (max-width: 480px)')
    expect(css).toContain(':focus-visible')
  })
})
