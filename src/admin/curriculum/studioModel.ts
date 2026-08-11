import type { AdminCapability } from '../contracts'
import type {
  CurriculumAssessmentEvidence,
  CurriculumBrowserSource,
  CurriculumCatalog,
  CurriculumCourseSummary,
  CurriculumGrade,
  CurriculumLessonSummary,
  CurriculumUnitSummary,
} from './contracts'
import type {
  CurriculumDraftAuthoringSource,
  CurriculumStudioEntityIndexEntry,
} from '../curriculum-authoring/contracts'
import type { CurriculumApprovalSource } from '../curriculum-approval/contracts'
import type { CurriculumStagingSource } from '../curriculum-staging/contracts'
import type { CurriculumPublishingSource } from '../curriculum-publishing/contracts'

export const CURRICULUM_STUDIO_RENDER_LIMIT = 250 as const
export const CURRICULUM_STUDIO_NAVIGATION_REQUEST = 'curriculum-studio:navigation-request' as const

export type CurriculumStudioEntity =
  | { readonly kind: 'grade'; readonly id: string; readonly grade: CurriculumGrade }
  | { readonly kind: 'course'; readonly id: string; readonly course: CurriculumCourseSummary }
  | { readonly kind: 'unit'; readonly id: string; readonly unit: CurriculumUnitSummary }
  | { readonly kind: 'lesson'; readonly id: string; readonly lesson: CurriculumLessonSummary }
  | { readonly kind: 'assessment'; readonly id: string; readonly assessment: CurriculumAssessmentEvidence }
  | { readonly kind: 'authoring'; readonly id: string; readonly entry: CurriculumStudioEntityIndexEntry }
  | { readonly kind: 'group'; readonly id: string; readonly label: string }

export interface CurriculumStudioSource extends CurriculumDraftAuthoringSource, CurriculumApprovalSource, CurriculumStagingSource, CurriculumPublishingSource {
  loadPublishedCatalog(): Promise<Pick<CurriculumCatalog, 'source'>>
}

export interface CurriculumStudioRow {
  readonly id: string
  readonly parentId: string | null
  readonly ancestorIds: readonly string[]
  readonly depth: number
  readonly label: string
  readonly context: string
  readonly hasChildren: boolean
  readonly entity: CurriculumStudioEntity
}

export interface CurriculumStudioIndex {
  readonly rows: readonly CurriculumStudioRow[]
  readonly byId: ReadonlyMap<string, CurriculumStudioRow>
}

export interface VisibleCurriculumStudioRows {
  readonly rows: readonly CurriculumStudioRow[]
  readonly total: number
  readonly limited: boolean
}

export type CurriculumTreeKey =
  | 'ArrowDown'
  | 'ArrowUp'
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'Home'
  | 'End'
  | 'Enter'
  | ' '

export interface CurriculumTreeKeyboardAction {
  readonly focusId: string
  readonly toggleId?: string
  readonly selectId?: string
}

/** Combines the immutable published read with the server-authoritative draft seam. */
export function createCurriculumStudioSource(
  publishedSource: Pick<CurriculumBrowserSource, 'loadIdentity'> | Pick<CurriculumBrowserSource, 'loadCatalog'>,
  authoringSource: CurriculumDraftAuthoringSource,
  approvalSource: CurriculumApprovalSource,
  stagingSource: CurriculumStagingSource,
  publishingSource: CurriculumPublishingSource,
): CurriculumStudioSource {
  return {
    ...authoringSource,
    ...approvalSource,
    ...stagingSource,
    ...publishingSource,
    loadPublishedCatalog: async () => 'loadIdentity' in publishedSource
      ? { source: await publishedSource.loadIdentity() }
      : { source: (await publishedSource.loadCatalog()).source },
  }
}

export function canWriteCurriculumDrafts(capabilities: readonly AdminCapability[]): boolean {
  return capabilities.includes('curriculum:drafts:write')
}

export function buildCurriculumStudioIndex(catalog: CurriculumCatalog): CurriculumStudioIndex {
  const rows: CurriculumStudioRow[] = []
  const coursesByGrade = new Map<number, CurriculumCourseSummary[]>()
  const unitsByCourse = new Map<string, CurriculumUnitSummary[]>()
  const lessonsByUnit = new Map<string, CurriculumLessonSummary[]>()
  const assessmentsByUnit = new Map<string, CurriculumAssessmentEvidence[]>()
  const unitKey = (courseId: string, unitNumber: number) => `${courseId}\u0000${unitNumber}`
  for (const course of catalog.courses) {
    const courses = coursesByGrade.get(course.grade) ?? []
    courses.push(course)
    coursesByGrade.set(course.grade, courses)
  }
  for (const unit of catalog.units) {
    const units = unitsByCourse.get(unit.courseId) ?? []
    units.push(unit)
    unitsByCourse.set(unit.courseId, units)
  }
  for (const lesson of catalog.lessons) {
    const key = unitKey(lesson.courseId, lesson.unitNumber)
    const lessons = lessonsByUnit.get(key) ?? []
    lessons.push(lesson)
    lessonsByUnit.set(key, lessons)
  }
  for (const assessment of catalog.assessments) {
    const key = unitKey(assessment.courseId, assessment.unitNumber)
    const assessments = assessmentsByUnit.get(key) ?? []
    assessments.push(assessment)
    assessmentsByUnit.set(key, assessments)
  }
  coursesByGrade.forEach((courses) => courses.sort((a, b) =>
    a.title.localeCompare(b.title) || a.courseId.localeCompare(b.courseId)))
  unitsByCourse.forEach((units) => units.sort((a, b) =>
    a.unitNumber - b.unitNumber || a.unitId.localeCompare(b.unitId)))
  lessonsByUnit.forEach((lessons) => lessons.sort((a, b) =>
    a.dayInUnit - b.dayInUnit || a.lessonId.localeCompare(b.lessonId)))
  assessmentsByUnit.forEach((assessments) => assessments.sort((a, b) =>
    a.assessmentId.localeCompare(b.assessmentId)))
  const add = (
    entity: CurriculumStudioEntity,
    parentId: string | null,
    ancestorIds: readonly string[],
    label: string,
    context: string,
    hasChildren: boolean,
  ) => rows.push({
    id: entity.id,
    parentId,
    ancestorIds,
    depth: ancestorIds.length + 1,
    label,
    context,
    hasChildren,
    entity,
  })

  for (const grade of [...catalog.grades].sort((a, b) => a - b)) {
    const gradeId = `grade:${grade}`
    const courses = coursesByGrade.get(grade) ?? []
    add(
      { kind: 'grade', id: gradeId, grade },
      null,
      [],
      `Grade ${grade}`,
      `${courses.length} courses`,
      courses.length > 0,
    )

    for (const course of courses) {
      const courseId = `course:${course.courseId}`
      const courseAncestors = [gradeId]
      const units = unitsByCourse.get(course.courseId) ?? []
      add(
        { kind: 'course', id: courseId, course },
        gradeId,
        courseAncestors,
        course.title,
        `${course.subject} · ${units.length} units`,
        units.length > 0,
      )

      for (const unit of units) {
        const unitId = `unit:${unit.unitId}`
        const unitAncestors = [...courseAncestors, courseId]
        const key = unitKey(course.courseId, unit.unitNumber)
        const lessons = lessonsByUnit.get(key) ?? []
        const assessments = assessmentsByUnit.get(key) ?? []
        add(
          { kind: 'unit', id: unitId, unit },
          courseId,
          unitAncestors,
          `Unit ${unit.unitNumber}: ${unit.title}`,
          `${lessons.length} lessons${assessments.length ? ` · ${assessments.length} assessment` : ''}`,
          lessons.length > 0 || assessments.length > 0,
        )

        const itemAncestors = [...unitAncestors, unitId]
        for (const lesson of lessons) {
          const lessonId = `lesson:${lesson.lessonId}`
          add(
            { kind: 'lesson', id: lessonId, lesson },
            unitId,
            itemAncestors,
            `Lesson ${lesson.dayInUnit}: ${lesson.title}`,
            lesson.lessonId,
            false,
          )
        }
        for (const assessment of assessments) {
          const assessmentId = `assessment:${assessment.assessmentId}`
          add(
            { kind: 'assessment', id: assessmentId, assessment },
            unitId,
            itemAncestors,
            `Assessment: ${assessment.assessmentId}`,
            `${assessment.totalPoints ?? 'Unknown'} points`,
            false,
          )
        }
      }
    }
  }

  return { rows, byId: new Map(rows.map((row) => [row.id, row])) }
}

export function buildMaterializedCurriculumStudioIndex(
  sourceEntries: readonly CurriculumStudioEntityIndexEntry[],
): CurriculumStudioIndex {
  const deduplicated = new Map<string, CurriculumStudioEntityIndexEntry>()
  sourceEntries.forEach((entry) => deduplicated.set(`${entry.entityType}:${entry.entityRef}`, entry))
  const entries = [...deduplicated.values()]
  const rows: CurriculumStudioRow[] = []
  const add = (
    entity: CurriculumStudioEntity,
    parentId: string | null,
    ancestorIds: readonly string[],
    label: string,
    context: string,
    hasChildren: boolean,
  ) => rows.push({
    id: entity.id,
    parentId,
    ancestorIds,
    depth: ancestorIds.length + 1,
    label,
    context,
    hasChildren,
    entity,
  })
  const sort = (left: CurriculumStudioEntityIndexEntry, right: CurriculumStudioEntityIndexEntry) =>
    left.position - right.position || left.label.localeCompare(right.label) || left.entityRef.localeCompare(right.entityRef)
  const added = new Set<string>()
  const coursesByParent = new Map<string, CurriculumStudioEntityIndexEntry[]>()
  const unitsByParent = new Map<string, CurriculumStudioEntityIndexEntry[]>()
  const childrenByParent = new Map<string, CurriculumStudioEntityIndexEntry[]>()
  const resources: CurriculumStudioEntityIndexEntry[] = []
  const gradesSet = new Set<number>()
  const addTo = (groups: Map<string, CurriculumStudioEntityIndexEntry[]>, entry: CurriculumStudioEntityIndexEntry) => {
    const group = groups.get(entry.parentId) ?? []
    group.push(entry)
    groups.set(entry.parentId, group)
  }
  for (const entry of entries) {
    if (entry.entityType === 'course') {
      if (entry.grade) gradesSet.add(entry.grade)
      addTo(coursesByParent, entry)
    } else if (entry.entityType === 'unit') {
      addTo(unitsByParent, entry)
    } else if (entry.entityType === 'lesson' || entry.entityType === 'assessment') {
      addTo(childrenByParent, entry)
    } else if (entry.entityType === 'media_resource') {
      resources.push(entry)
    }
  }
  coursesByParent.forEach((items) => items.sort(sort))
  unitsByParent.forEach((items) => items.sort(sort))
  childrenByParent.forEach((items) => items.sort(sort))
  resources.sort(sort)

  const grades = [...gradesSet]
    .sort((left, right) => left - right)
  for (const grade of grades) {
    const gradeId = `grade:${grade}`
    const courses = coursesByParent.get(gradeId) ?? []
    add({ kind: 'grade', id: gradeId, grade: grade as CurriculumGrade }, null, [], `Grade ${grade}`, `${courses.length} courses`, courses.length > 0)
    for (const course of courses) {
      const courseId = `course:${course.entityRef}`
      const units = unitsByParent.get(courseId) ?? []
      add({ kind: 'authoring', id: courseId, entry: course }, gradeId, [gradeId], course.label, course.context, units.length > 0)
      added.add(courseId)
      for (const unit of units) {
        const unitId = `unit:${unit.entityRef}`
        const children = childrenByParent.get(unitId) ?? []
        add({ kind: 'authoring', id: unitId, entry: unit }, courseId, [gradeId, courseId], unit.label, unit.context, children.length > 0)
        added.add(unitId)
        for (const child of children) {
          const childId = `${child.entityType}:${child.entityRef}`
          add({ kind: 'authoring', id: childId, entry: child }, unitId, [gradeId, courseId, unitId], child.label, child.context, false)
          added.add(childId)
        }
      }
    }
  }

  if (resources.length) {
    const resourceRoot = 'resources:all'
    add({ kind: 'group', id: resourceRoot, label: 'Media resources' }, null, [], 'Media resources', `${resources.length} resources`, true)
    resources.forEach((entry) => {
      const id = `media_resource:${entry.entityRef}`
      add({ kind: 'authoring', id, entry }, resourceRoot, [resourceRoot], entry.label, entry.context, false)
      added.add(id)
    })
  }

  const unattached = entries.filter((entry) => !added.has(`${entry.entityType}:${entry.entityRef}`)).sort(sort)
  if (unattached.length) {
    const rootId = 'unattached:all'
    add({ kind: 'group', id: rootId, label: 'Unattached entities' }, null, [], 'Unattached entities', `${unattached.length} require relationship repair`, true)
    unattached.forEach((entry) => {
      const id = `${entry.entityType}:${entry.entityRef}`
      add({ kind: 'authoring', id, entry }, rootId, [rootId], entry.label, entry.context, false)
    })
  }
  return { rows, byId: new Map(rows.map((row) => [row.id, row])) }
}

export function visibleCurriculumStudioRows(
  index: CurriculumStudioIndex,
  expandedIds: ReadonlySet<string>,
  query: string,
  limit = CURRICULUM_STUDIO_RENDER_LIMIT,
): VisibleCurriculumStudioRows {
  const normalized = query.trim().toLocaleLowerCase('en-US')
  let visible: readonly CurriculumStudioRow[]
  if (normalized) {
    const included = new Set<string>()
    for (const row of index.rows) {
      if (`${row.label} ${row.context} ${row.id} ${entitySearchText(row.entity)}`.toLocaleLowerCase('en-US').includes(normalized)) {
        included.add(row.id)
        row.ancestorIds.forEach((id) => included.add(id))
      }
    }
    visible = index.rows.filter((row) => included.has(row.id))
  } else {
    visible = index.rows.filter((row) => row.ancestorIds.every((id) => expandedIds.has(id)))
  }
  const safeLimit = Math.max(1, limit)
  return {
    rows: visible.slice(0, safeLimit),
    total: visible.length,
    limited: visible.length > safeLimit,
  }
}

function entitySearchText(entity: CurriculumStudioEntity): string {
  if (entity.kind === 'authoring') {
    return [entity.entry.entityType, entity.entry.entityRef, entity.entry.origin, entity.entry.subject ?? ''].join(' ')
  }
  if (entity.kind === 'group') return entity.label
  if (entity.kind === 'grade') return String(entity.grade)
  if (entity.kind === 'course') {
    return [entity.course.courseId, entity.course.subject, entity.course.description ?? '', entity.course.capstone ?? ''].join(' ')
  }
  if (entity.kind === 'unit') {
    return [
      entity.unit.unitId,
      entity.unit.courseId,
      entity.unit.essentialQuestion ?? '',
      entity.unit.performanceTask ?? '',
      ...entity.unit.standards,
      ...entity.unit.topics,
    ].join(' ')
  }
  if (entity.kind === 'lesson') {
    return [
      entity.lesson.lessonId,
      entity.lesson.courseId,
      entity.lesson.phase ?? '',
      entity.lesson.focus ?? '',
      ...entity.lesson.standards,
    ].join(' ')
  }
  return [
    entity.assessment.assessmentId,
    entity.assessment.courseId,
    entity.assessment.unitTitle,
    ...entity.assessment.standards,
  ].join(' ')
}

export function expandedAncestorsFor(
  index: CurriculumStudioIndex,
  entityId: string,
): ReadonlySet<string> {
  return new Set(index.byId.get(entityId)?.ancestorIds ?? [])
}

export function resolveCurriculumStudioEntity(
  index: CurriculumStudioIndex,
  token: string | null | undefined,
): CurriculumStudioRow | null {
  return token ? index.byId.get(token) ?? null : null
}

export function curriculumTreeKeyboardAction(
  rows: readonly CurriculumStudioRow[],
  focusedId: string,
  expandedIds: ReadonlySet<string>,
  key: CurriculumTreeKey,
): CurriculumTreeKeyboardAction | null {
  if (rows.length === 0) return null
  const currentIndex = Math.max(0, rows.findIndex((row) => row.id === focusedId))
  const current = rows[currentIndex]
  if (key === 'ArrowDown') return { focusId: rows[Math.min(rows.length - 1, currentIndex + 1)].id }
  if (key === 'ArrowUp') return { focusId: rows[Math.max(0, currentIndex - 1)].id }
  if (key === 'Home') return { focusId: rows[0].id }
  if (key === 'End') return { focusId: rows.at(-1)!.id }
  if (key === 'Enter' || key === ' ') return { focusId: current.id, selectId: current.id }
  if (key === 'ArrowRight') {
    if (current.hasChildren && !expandedIds.has(current.id)) {
      return { focusId: current.id, toggleId: current.id }
    }
    const child = rows[currentIndex + 1]
    return child?.parentId === current.id ? { focusId: child.id } : { focusId: current.id }
  }
  if (expandedIds.has(current.id)) return { focusId: current.id, toggleId: current.id }
  return { focusId: current.parentId ?? current.id }
}
