import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AdminCapability } from '../contracts'
import type { CurriculumCatalog, CurriculumLessonSummary } from './contracts'
import type {
  CurriculumDraftAuthoringSource,
  CurriculumDraftCollaborators,
  CurriculumDraftDetail,
  CurriculumStudioEntityIndexEntry,
} from '../curriculum-authoring/contracts'
import type { CurriculumApprovalSource } from '../curriculum-approval/contracts'
import type { CurriculumStagingSource } from '../curriculum-staging/contracts'
import type { CurriculumPublishingSource } from '../curriculum-publishing/contracts'
import {
  CurriculumStudio,
  CurriculumStudioView,
  assertExactDraftMaterialization,
  confirmCurriculumCollaboratorRevocation,
  confirmCurriculumNavigation,
  curriculumPayloadDirty,
  curriculumPreviewHref,
  curriculumSavedMessage,
  curriculumStudioIdentityFromSearch,
} from './CurriculumStudio'
import {
  CurriculumWorkflowNav,
  curriculumWorkflowDestinations,
  type CurriculumWorkflowSnapshot,
} from './CurriculumWorkflowNav'
import { CurriculumResourceLibraryView } from './CurriculumResourceLibrary'
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
import { buildCurriculumResourceLibrary } from './resourceLibraryModel'

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
const DRAFT_ID = '10000000-0000-4000-8000-000000000001'
const EDITOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const REVIEWER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const openDraft: CurriculumDraftDetail = {
  schemaVersion: 1,
  draftId: DRAFT_ID,
  baseReleaseVersion: '1.0.0',
  targetVersion: '2.0.0-draft.1',
  authoringSchemaVersion: '2.0.0',
  lifecycleState: 'draft',
  revision: 3,
  createdAt: '2026-08-10T12:00:00Z',
  updatedAt: '2026-08-10T12:05:00Z',
  entities: [],
}

function collaborators(currentResponsibility: 'editor' | 'reviewer'): CurriculumDraftCollaborators {
  return {
    schemaVersion: 1,
    draftId: DRAFT_ID,
    draftRevision: 3,
    currentResponsibility,
    collaborators: [
      {
        principalRef: EDITOR_ID, responsibility: 'editor', status: 'active',
        assignmentRevision: 1, assignedAt: '2026-08-10T12:00:00Z', revokedAt: null,
      },
      {
        principalRef: REVIEWER_ID, responsibility: 'reviewer', status: 'active',
        assignmentRevision: 1, assignedAt: '2026-08-10T12:01:00Z', revokedAt: null,
      },
    ],
  }
}

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

const baseResourceLibrary = buildCurriculumResourceLibrary({
  origin: 'published-release',
  baseReleaseVersion: '1.0.0',
  validation: { findings: [] },
  entities: [{
    entityType: 'media_resource', entityRef: 'g5-source-01', origin: 'base', revision: null,
    position: 0, tombstoned: false,
    payload: {
      schema_set_version: '2.0.0', resource_id: 'g5-source-01', kind: 'text', title: 'Original source',
      locator: 'curriculum/original-source.txt', rights: 'Locally authored.', required: false,
      text_fallback: 'Original source text.',
    },
  }],
})

function authoringSource(): CurriculumDraftAuthoringSource {
  return {
    listDrafts: vi.fn(async () => ({ schemaVersion: 1 as const, drafts: [] })),
    readDraft: vi.fn(), readEntity: vi.fn(), createDraft: vi.fn(), createEntity: vi.fn(),
    updateEntity: vi.fn(), tombstoneEntity: vi.fn(),
    listCollaborators: vi.fn(), addCollaborator: vi.fn(), revokeCollaborator: vi.fn(),
    readBaseIndex: vi.fn(async () => ({
      schemaVersion: 1 as const, baseReleaseVersion: '1.0.0', entities: baseEntries,
      resourceLibrary: baseResourceLibrary,
    })),
    readBaseEntity: vi.fn(), readMaterialization: vi.fn(), validateDraft: vi.fn(), readPreview: vi.fn(),
  }
}

function approvalSource(): CurriculumApprovalSource {
  return { readApproval: vi.fn(), decideApproval: vi.fn() }
}

function stagingSource(): CurriculumStagingSource {
  return { readStaging: vi.fn(), stageDraft: vi.fn() }
}

function publishingSource(): CurriculumPublishingSource {
  return { readPublication: vi.fn(), publishStaged: vi.fn() }
}

const studioSource = createCurriculumStudioSource(
  { loadCatalog: vi.fn(async () => catalog) },
  authoringSource(),
  approvalSource(),
  stagingSource(),
  publishingSource(),
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

  it('indexes the deterministic 5,000-entity server maximum linearly and renders only 250 rows', () => {
    const entries: CurriculumStudioEntityIndexEntry[] = []
    const grades = [5, 7, 8] as const
    for (let courseIndex = 0; courseIndex < 30; courseIndex += 1) {
      const grade = grades[courseIndex % grades.length]
      const courseRef = `stress-course-${courseIndex}`
      entries.push({
        entityType: 'course', entityRef: courseRef, origin: 'base', revision: null,
        position: courseIndex, parentId: `grade:${grade}`, grade,
        subject: 'stress-subject', label: `Stress course ${courseIndex}`, context: '8 units',
      })
      for (let unitIndex = 0; unitIndex < 8; unitIndex += 1) {
        const unitRef = `${courseRef}-unit-${unitIndex}`
        entries.push({
          entityType: 'unit', entityRef: unitRef, origin: 'base', revision: null,
          position: unitIndex, parentId: `course:${courseRef}`, grade,
          subject: 'stress-subject', courseRef, label: `Unit ${unitIndex}`, context: '19 lessons',
        })
        for (let lessonIndex = 0; lessonIndex < 19; lessonIndex += 1) {
          const entityRef = `${unitRef}-lesson-${lessonIndex}`
          entries.push({
            entityType: 'lesson', entityRef, origin: 'base', revision: null,
            position: lessonIndex, parentId: `unit:${unitRef}`, grade,
            subject: 'stress-subject', courseRef, unitRef,
            label: `Lesson ${lessonIndex}`, context: 'deterministic stress fixture',
          })
        }
      }
    }
    for (let resourceIndex = 0; resourceIndex < 170; resourceIndex += 1) {
      entries.push({
        entityType: 'media_resource', entityRef: `stress-resource-${resourceIndex}`,
        origin: 'base', revision: null, position: resourceIndex,
        parentId: 'resources:all', label: `Resource ${resourceIndex}`, context: 'text · optional',
      })
    }
    expect(entries).toHaveLength(5_000)

    const started = performance.now()
    const index = buildMaterializedCurriculumStudioIndex(entries)
    const elapsedMs = performance.now() - started
    const expanded = new Set(index.rows.filter((row) => row.hasChildren).map((row) => row.id))
    const visible = visibleCurriculumStudioRows(index, expanded, '')
    console.info(`[admin-performance] 5000-entity curriculum index ${elapsedMs.toFixed(1)}ms`)

    expect(index.rows).toHaveLength(5_004)
    expect(visible.total).toBe(5_004)
    expect(visible.rows).toHaveLength(CURRICULUM_STUDIO_RENDER_LIMIT)
    expect(visible.limited).toBe(true)
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
    expect(markup).toContain('Resource Library')
    expect(markup).toContain('Read-only: curriculum:drafts:write is unavailable')
    expect(markup).toContain('no active release is implied')
    expect(markup).not.toContain('Create draft entity')
    expect(markup).not.toContain('autosaved')
  })

  it('renders the accessible Resource Library inventory, filters, details, validation seam, and editor navigation', () => {
    const referencedLibrary = buildCurriculumResourceLibrary({
      origin: 'draft', baseReleaseVersion: '1.0.0', draftId: 'draft-one', draftRevision: 4,
      validation: { findings: [] },
      entities: [{
        entityType: 'media_resource', entityRef: 'g5-source-01', origin: 'base_override', revision: 2,
        position: 0, tombstoned: false,
        payload: {
          schema_set_version: '2.0.0', resource_id: 'g5-source-01', kind: 'text', title: 'Original source',
          locator: 'curriculum/original-source.txt', rights: 'Locally authored.', required: false,
          text_fallback: 'Original source text.',
        },
      }, {
        entityType: 'lesson', entityRef: lesson.lessonId, origin: 'base_override', revision: 3,
        position: 0, tombstoned: false,
        payload: { lesson_id: lesson.lessonId, title: lesson.title, resource_refs: ['g5-source-01'] },
      }],
    })
    const markup = renderToStaticMarkup(
      <CurriculumResourceLibraryView
        library={referencedLibrary}
        writeAllowed={false}
        onCreateResource={vi.fn()}
        onOpenResource={vi.fn()}
        onJumpToReference={vi.fn()}
      />,
    )
    expect(markup).toContain('aria-labelledby="curriculum-resource-library-title"')
    expect(markup).toContain('aria-label="Filter resource inventory"')
    expect(markup).toContain('Type / category')
    expect(markup).toContain('Reference status')
    expect(markup).toContain('Draft override')
    expect(markup).toContain('Open in structured editor (read-only)')
    expect(markup).toContain(`Jump to lesson`)
    expect(markup).toContain('No resource finding was reported')
    expect(markup).toMatch(/no uploads, downloads, or storage-provider actions/i)
    expect(markup).not.toMatch(/upload file|signed url|cdn/i)
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

  it('renders bounded collaborator assignments with labeled add/revoke controls for editors', () => {
    const markup = renderToStaticMarkup(
      <CurriculumStudioView
        catalog={catalog}
        capabilities={authorCapabilities}
        source={studioSource}
        initialBaseEntries={baseEntries}
        initialOpenDraft={openDraft}
        initialCollaboration={collaborators('editor')}
      />,
    )
    expect(markup).toContain('Current draft collaborators')
    expect(markup).toContain('Add verified Admin principal')
    expect(markup).toContain('for="curriculum-collaborator-principal"')
    expect(markup).toContain(`aria-label="Revoke reviewer collaborator ${REVIEWER_ID}"`)
    expect(markup).toContain('Editor requires underlying curriculum:drafts:write')
    expect(markup).not.toMatch(/email|learner(?:Ref|Id| name)|student work|private note/i)
  })

  it('keeps a globally capable reviewer read-only and confirms destructive revocation accessibly', () => {
    const markup = renderToStaticMarkup(
      <CurriculumStudioView
        catalog={catalog}
        capabilities={authorCapabilities}
        source={studioSource}
        initialBaseEntries={baseEntries}
        initialOpenDraft={openDraft}
        initialCollaboration={collaborators('reviewer')}
      />,
    )
    expect(markup).toContain('Reviewer assignment')
    expect(markup).toContain('resource assignment is read-only')
    expect(markup).not.toContain('Add verified Admin principal')
    expect(markup).not.toContain('>Revoke</button>')
    const confirm = vi.fn(() => false)
    expect(confirmCurriculumCollaboratorRevocation(REVIEWER_ID, 'reviewer', confirm)).toBe(false)
    expect(confirm).toHaveBeenCalledWith(
      `Revoke reviewer access for Admin principal ${REVIEWER_ID}?`,
    )
  })

  it('renders the collaborator empty state without inventing authority', () => {
    const markup = renderToStaticMarkup(
      <CurriculumStudioView
        catalog={catalog}
        capabilities={authorCapabilities}
        source={studioSource}
        initialBaseEntries={baseEntries}
        initialOpenDraft={openDraft}
        initialCollaboration={{ ...collaborators('editor'), collaborators: [] }}
      />,
    )
    expect(markup).toContain('No current collaborators')
  })

  it('fails closed before curriculum read authorization and never calls the source during render', () => {
    const loadPublishedCatalog = vi.fn()
    const markup = renderToStaticMarkup(
      <CurriculumStudio authorization={{ status: 'denied' }} source={{ ...authoringSource(), ...approvalSource(), ...stagingSource(), ...publishingSource(), loadPublishedCatalog }} />,
    )
    expect(markup).toContain('Curriculum Studio access unavailable')
    expect(markup).toContain('No hierarchy or draft metadata was loaded')
    expect(markup).not.toContain(catalog.source.packageId)
    expect(loadPublishedCatalog).not.toHaveBeenCalled()
  })

  it('combines the published read with the real draft authoring seam', async () => {
    const loadIdentity = vi.fn(async () => catalog.source)
    const draftSource = authoringSource()
    const source = createCurriculumStudioSource({ loadIdentity }, draftSource, approvalSource(), stagingSource(), publishingSource())
    await expect(source.loadPublishedCatalog()).resolves.toEqual({ source: catalog.source })
    await expect(source.listDrafts()).resolves.toEqual({ schemaVersion: 1, drafts: [] })
    expect(loadIdentity).toHaveBeenCalledOnce()
    expect(source.createEntity).toBe(draftSource.createEntity)
  })

  it('exposes all controlled curriculum workflow destinations without publish activation', () => {
    const markup = renderToStaticMarkup(<CurriculumWorkflowNav current="studio" />)
    expect(markup).toContain('href="/academy/admin/curriculum"')
    expect(markup).toContain('href="/academy/admin/curriculum/studio"')
    expect(markup).toContain('href="/academy/admin/curriculum/integrity"')
    expect(markup).toContain('href="/academy/admin/curriculum/history"')
    expect(markup).toContain('Standards Review')
    expect(markup).toContain('Preview / Diff')
    expect(markup).toContain('Human Approval')
    expect(markup).toContain('Release Staging')
    expect(curriculumWorkflowDestinations().find((step) => step.id === 'validation')).toMatchObject({
      path: '/academy/admin/curriculum/studio', state: 'blocked',
    })
    expect(curriculumWorkflowDestinations().find((step) => step.id === 'preview')).toMatchObject({
      path: '/academy/admin/curriculum/studio', state: 'blocked',
    })
    expect(markup).toContain('aria-current="page"')
    expect(markup).toContain('aria-label="Curriculum pre-publish workflow"')
    expect(markup).not.toMatch(/publish curriculum|activate publish/i)
  })

  it('models the exact-revision workflow, approved standards resolution, and downstream staleness', () => {
    const pending: CurriculumWorkflowSnapshot = {
      draftId: DRAFT_ID,
      draftRevision: 7,
      baseReleaseVersion: '1.0.0',
      targetVersion: '2.0.0-draft.1',
      readOnly: false,
      resourceLibraryReady: true,
      validation: {
        draftId: DRAFT_ID,
        draftRevision: 7,
        baseReleaseVersion: '1.0.0',
        targetVersion: '2.0.0-draft.1',
        validationSnapshotId: '20000000-0000-4000-8000-000000000001',
        status: 'invalid',
        humanReviewBlockers: 2,
      },
      approval: {
        draftId: DRAFT_ID,
        draftRevision: 7,
        baseReleaseVersion: '1.0.0',
        targetVersion: '2.0.0-draft.1',
        approvalId: null,
        validationSnapshotId: '20000000-0000-4000-8000-000000000001',
        status: 'pending_review',
      },
      staging: {
        draftId: DRAFT_ID,
        draftRevision: 7,
        baseReleaseVersion: '1.0.0',
        targetVersion: '2.0.0-draft.1',
        stagingId: null,
        stageState: 'blocked',
      },
    }
    const blocked = curriculumWorkflowDestinations(pending)
    expect(blocked.find((step) => step.id === 'standards-review')?.state).toBe('blocked')
    expect(blocked.find((step) => step.id === 'approval')?.state).toBe('pending')
    expect(blocked.find((step) => step.id === 'staging')?.state).toBe('blocked')
    expect(blocked.find((step) => step.id === 'preview')?.path).toContain(`draft=${DRAFT_ID}&revision=7`)

    const resolved: CurriculumWorkflowSnapshot = {
      ...pending,
      validation: { ...pending.validation!, status: 'valid', humanReviewBlockers: 0 },
      approval: {
        ...pending.approval!,
        approvalId: '30000000-0000-4000-8000-000000000001',
        status: 'approved',
      },
      staging: {
        ...pending.staging!,
        stagingId: '40000000-0000-4000-8000-000000000001',
        stageState: 'staged',
      },
    }
    const complete = curriculumWorkflowDestinations(resolved)
    expect(complete.filter((step) => ['validation', 'standards-review', 'approval', 'staging'].includes(step.id)).map((step) => step.state)).toEqual([
      'complete', 'complete', 'complete', 'complete',
    ])

    const mutated: CurriculumWorkflowSnapshot = { ...resolved, draftRevision: 8 }
    const stale = curriculumWorkflowDestinations(mutated)
    expect(stale.filter((step) => ['validation', 'standards-review', 'approval', 'staging'].includes(step.id)).map((step) => step.state)).toEqual([
      'stale', 'stale', 'stale', 'stale',
    ])
    expect(stale.find((step) => step.id === 'draft')?.path).toContain('revision=8')
  })

  it('keeps reviewer navigation read-only and preserves exact identity across standalone workflow pages', () => {
    const reviewer: CurriculumWorkflowSnapshot = {
      draftId: DRAFT_ID,
      draftRevision: 3,
      baseReleaseVersion: '1.0.0',
      targetVersion: '2.0.0-draft.1',
      readOnly: true,
      resourceLibraryReady: true,
      validation: null,
      approval: null,
      staging: null,
    }
    expect(curriculumWorkflowDestinations(reviewer).find((step) => step.id === 'draft')?.state).toBe('read-only')
    const standalone = curriculumWorkflowDestinations(null, { draftId: DRAFT_ID, draftRevision: 3 })
    expect(standalone.find((step) => step.id === 'published')?.path).toBe('/academy/admin/curriculum')
    expect(standalone.find((step) => step.id === 'integrity')?.path).toBe('/academy/admin/curriculum/integrity')
    expect(standalone.find((step) => step.id === 'history')?.path).toBe('/academy/admin/curriculum/history')
    expect(standalone.find((step) => step.id === 'activation')?.path).toBe('/academy/admin/curriculum/activation')
    const globalIds: readonly string[] = ['published', 'integrity', 'history', 'activation']
    const draftBound = standalone.filter((step) => !globalIds.includes(step.id))
    expect(draftBound).not.toHaveLength(0)
    expect(draftBound.every((step) => step.path.includes(`draft=${DRAFT_ID}`))).toBe(true)
    expect(draftBound.every((step) => step.path.includes('revision=3'))).toBe(true)
  })

  it('builds an exact revision preview deep link without carrying mutable authority', () => {
    expect(curriculumPreviewHref('10000000-0000-4000-8000-000000000001', 7)).toBe(
      '/academy/admin/curriculum/preview?draft=10000000-0000-4000-8000-000000000001&revision=7',
    )
    expect(curriculumStudioIdentityFromSearch(`?draft=${DRAFT_ID}&revision=7`)).toEqual({
      draftId: DRAFT_ID,
      draftRevision: 7,
    })
    expect(curriculumStudioIdentityFromSearch(`?draft=${DRAFT_ID}&revision=0`)).toBeNull()
  })

  it('rejects a materialization whose draft, revision, or base identity drifts', () => {
    const exact = { draftId: DRAFT_ID, draftRevision: 3, baseReleaseVersion: '1.0.0' }
    expect(() => assertExactDraftMaterialization(openDraft, exact)).not.toThrow()
    expect(() => assertExactDraftMaterialization(openDraft, { ...exact, draftRevision: 4 })).toThrow('conflict')
    expect(() => assertExactDraftMaterialization(openDraft, { ...exact, draftId: '10000000-0000-4000-8000-000000000002' })).toThrow('conflict')
    expect(() => assertExactDraftMaterialization(openDraft, { ...exact, baseReleaseVersion: '9.9.9' })).toThrow('conflict')
  })

  it('defines desktop, tablet, mobile, and visible-focus behavior', () => {
    const css = readFileSync(new URL('./curriculum-studio.css', import.meta.url), 'utf8')
    const component = readFileSync(new URL('./CurriculumStudio.tsx', import.meta.url), 'utf8')
    expect(css).toContain('grid-template-areas: "tree editor inspector"')
    expect(css).toContain('@container (max-width: 1050px)')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('@media (max-width: 480px)')
    expect(css).toContain(':focus-visible')
    expect(component).toContain('Permission denied: this Admin principal is not assigned to the draft.')
    expect(component).toContain('Collaborators are unavailable. The draft remains conservatively read-only.')
    expect(component).toContain('Stale collaborator change: refresh the draft before trying again.')
    expect(component).toContain('Retry will reuse the same idempotency key.')
    expect(css).toContain('.curriculum-resource-layout')
    expect(css).not.toContain('CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT')
  })
})
