import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AdminCapability } from '../contracts'
import type { CurriculumCatalog, CurriculumLessonSummary } from './contracts'
import { CurriculumStudio, CurriculumStudioView } from './CurriculumStudio'
import { CurriculumWorkflowNav, CurriculumPreviewUnavailable } from './CurriculumWorkflowNav'
import {
  CURRICULUM_STUDIO_RENDER_LIMIT,
  buildCurriculumStudioIndex,
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

  it('renders the three landmarks, editor slots, focusable tree, and truthful viewer state', () => {
    const markup = renderToStaticMarkup(
      <CurriculumStudioView catalog={catalog} capabilities={viewerCapabilities} />,
    )
    expect(markup).toContain('aria-label="Curriculum hierarchy"')
    expect(markup).toContain('aria-label="Selected entity editor workspace"')
    expect(markup).toContain('aria-label="Curriculum metadata and status inspector"')
    expect(markup).toContain('role="tree"')
    expect(markup).toContain('role="treeitem"')
    expect(markup).toContain('tabindex="0"')
    expect(markup).toContain('data-editor-slot="lesson-fields"')
    expect(markup).toContain('data-editor-slot="assessment-fields"')
    expect(markup).toContain('data-editor-slot="resources"')
    expect(markup).toContain('data-editor-slot="standards-mastery"')
    expect(markup).toContain('data-editor-slot="tutor-routes"')
    expect(markup).toContain('data-editor-slot="safety-privacy"')
    expect(markup).toContain('data-editor-slot="accessibility"')
    expect(markup).toContain('Read-only Admin session')
    expect(markup).toContain('does not include curriculum:drafts:write')
    expect(markup).not.toMatch(/>Save</)
    expect(markup).not.toContain('autosaved')
  })

  it('is truthful when a draft-capable role has no draft service', () => {
    expect(canWriteCurriculumDrafts(viewerCapabilities)).toBe(false)
    expect(canWriteCurriculumDrafts(authorCapabilities)).toBe(true)
    const markup = renderToStaticMarkup(
      <CurriculumStudioView catalog={catalog} capabilities={authorCapabilities} />,
    )
    expect(markup).toContain('data-draft-service="not-connected"')
    expect(markup).toContain('Draft service not connected')
    expect(markup).toContain('Authoring is not connected')
    expect(markup).toContain('no save is implied')
    expect(markup).toContain('No save attempted')
    expect(markup).not.toMatch(/>Save</)
  })

  it('fails closed before curriculum read authorization and never calls the source during render', () => {
    const loadPublishedCatalog = vi.fn()
    const markup = renderToStaticMarkup(
      <CurriculumStudio authorization={{ status: 'denied' }} source={{ loadPublishedCatalog }} />,
    )
    expect(markup).toContain('Curriculum Studio access unavailable')
    expect(markup).toContain('No hierarchy or entity metadata was loaded')
    expect(markup).not.toContain(catalog.source.packageId)
    expect(loadPublishedCatalog).not.toHaveBeenCalled()
  })

  it('adapts only the existing published read and defines no competing mutation seam', async () => {
    const loadCatalog = vi.fn(async () => catalog)
    const source = createCurriculumStudioSource({ loadCatalog })
    await expect(source.loadPublishedCatalog()).resolves.toBe(catalog)
    expect(loadCatalog).toHaveBeenCalledOnce()
    expect(Object.keys(source)).toEqual(['loadPublishedCatalog'])
  })

  it('exposes all controlled curriculum workflow destinations without publish activation', () => {
    const markup = renderToStaticMarkup(<CurriculumWorkflowNav current="studio" />)
    expect(markup).toContain('href="/academy/admin/curriculum"')
    expect(markup).toContain('href="/academy/admin/curriculum/studio"')
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
