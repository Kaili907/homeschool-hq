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

export interface CurriculumStudioSource extends CurriculumDraftAuthoringSource, CurriculumApprovalSource {
  loadPublishedCatalog(): Promise<CurriculumCatalog>
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
  publishedSource: Pick<CurriculumBrowserSource, 'loadCatalog'>,
  authoringSource: CurriculumDraftAuthoringSource,
  approvalSource: CurriculumApprovalSource,
): CurriculumStudioSource {
  return {
    ...authoringSource,
    ...approvalSource,
    loadPublishedCatalog: () => publishedSource.loadCatalog(),
  }
}

export function canWriteCurriculumDrafts(capabilities: readonly AdminCapability[]): boolean {
  return capabilities.includes('curriculum:drafts:write')
}

export function buildCurriculumStudioIndex(catalog: CurriculumCatalog): CurriculumStudioIndex {
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

  for (const grade of [...catalog.grades].sort((a, b) => a - b)) {
    const gradeId = `grade:${grade}`
    const courses = catalog.courses
      .filter((course) => course.grade === grade)
      .sort((a, b) => a.title.localeCompare(b.title) || a.courseId.localeCompare(b.courseId))
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
      const units = catalog.units
        .filter((unit) => unit.courseId === course.courseId)
        .sort((a, b) => a.unitNumber - b.unitNumber || a.unitId.localeCompare(b.unitId))
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
        const lessons = catalog.lessons
          .filter((lesson) => lesson.courseId === course.courseId && lesson.unitNumber === unit.unitNumber)
          .sort((a, b) => a.dayInUnit - b.dayInUnit || a.lessonId.localeCompare(b.lessonId))
        const assessments = catalog.assessments
          .filter((assessment) => assessment.courseId === course.courseId && assessment.unitNumber === unit.unitNumber)
          .sort((a, b) => a.assessmentId.localeCompare(b.assessmentId))
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

  const grades = [...new Set(entries.filter((entry) => entry.entityType === 'course' && entry.grade).map((entry) => entry.grade!))]
    .sort((left, right) => left - right)
  for (const grade of grades) {
    const gradeId = `grade:${grade}`
    const courses = entries.filter((entry) => entry.entityType === 'course' && entry.parentId === gradeId).sort(sort)
    add({ kind: 'grade', id: gradeId, grade: grade as CurriculumGrade }, null, [], `Grade ${grade}`, `${courses.length} courses`, courses.length > 0)
    for (const course of courses) {
      const courseId = `course:${course.entityRef}`
      const units = entries.filter((entry) => entry.entityType === 'unit' && entry.parentId === courseId).sort(sort)
      add({ kind: 'authoring', id: courseId, entry: course }, gradeId, [gradeId], course.label, course.context, units.length > 0)
      added.add(courseId)
      for (const unit of units) {
        const unitId = `unit:${unit.entityRef}`
        const children = entries
          .filter((entry) => (entry.entityType === 'lesson' || entry.entityType === 'assessment') && entry.parentId === unitId)
          .sort(sort)
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

  const resources = entries.filter((entry) => entry.entityType === 'media_resource').sort(sort)
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
