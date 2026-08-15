import type { CurriculumAuthoringSet, StandardReference } from '../../curriculum-authoring/v2/contracts'
import { createHumanStandardsReviewFinding, type CurriculumValidationFinding } from '../curriculum-validation/engine'
import type {
  CurriculumStandardsReviewCandidate,
  CurriculumStandardsReviewContextKind,
  CurriculumStandardsReviewDecision,
  CurriculumStandardsReviewEntity,
  CurriculumStandardsReviewItem,
  CurriculumStandardsReviewOccurrence,
  CurriculumStandardsReviewState,
} from './contracts'

/** Builds review occurrences whose finding IDs exactly match ADMIN-18 Schema v2 validation. */
export function collectCurriculumStandardsReviewOccurrences(
  snapshot: CurriculumAuthoringSet,
): readonly CurriculumStandardsReviewOccurrence[] {
  const occurrences: CurriculumStandardsReviewOccurrence[] = []
  const unitById = new Map(snapshot.units.map((unit) => [unit.unit_id, unit]))
  const courseById = new Map(snapshot.courses.map((course) => [course.course_id, course]))
  const courseGrade = (courseRef: string, fallback: number) => courseById.get(courseRef)?.grade ?? fallback
  function add(
    standards: readonly StandardReference[],
    owner: { readonly type: 'course' | 'unit' | 'lesson' | 'assessment'; readonly id: string },
    path: string,
    grade: number,
    courseRef: string,
  ) {
    standards.forEach((reference, index) => {
      if (reference.mapping_status !== 'human-review' || !reference.legacy_label) return
      occurrences.push({
        sourceLabel: reference.legacy_label,
        grade,
        courseRef,
        finding: createHumanStandardsReviewFinding({
          entity: owner,
          path: `${path}[${index}]`,
          legacyLabel: reference.legacy_label,
        }),
      })
    })
  }
  snapshot.courses.forEach((item, index) => add(
    item.standards, { type: 'course', id: item.course_id }, `courses[${index}].standards`, item.grade, item.course_id,
  ))
  snapshot.units.forEach((item, index) => add(
    item.standards, { type: 'unit', id: item.unit_id }, `units[${index}].standards`,
    courseGrade(item.course_ref, item.grade), item.course_ref,
  ))
  snapshot.lessons.forEach((item, index) => add(
    item.standards, { type: 'lesson', id: item.lesson_id }, `lessons[${index}].standards`,
    courseGrade(item.course_ref, item.grade), item.course_ref,
  ))
  snapshot.assessments.forEach((item, index) => {
    const unit = unitById.get(item.unit_ref)
    const course = courseById.get(item.course_ref)
    if (!unit && !course) return
    add(
      item.standards, { type: 'assessment', id: item.assessment_id }, `assessments[${index}].standards`,
      course?.grade ?? unit!.grade, item.course_ref,
    )
  })
  return occurrences
}

export type CurriculumStandardsReviewGroupBy = 'source-label' | 'grade' | 'course' | 'draft' | 'affected-count' | 'status'

export interface CurriculumStandardsReviewFilters {
  readonly query?: string
  readonly grade?: number | 'all'
  readonly courseRef?: string | 'all'
  readonly status?: CurriculumStandardsReviewState | 'all'
}

export interface CurriculumStandardsReviewGroup {
  readonly key: string
  readonly label: string
  readonly affectedCount: number
  readonly items: readonly CurriculumStandardsReviewItem[]
}

function hash(value: string, seed: number): string {
  let result = seed >>> 0
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193) >>> 0
  }
  return result.toString(16).padStart(8, '0')
}

export function standardsReviewKey(input: {
  readonly contextKind: CurriculumStandardsReviewContextKind
  readonly contextRef: string
  readonly sourceLabel: string
  readonly grade: number
  readonly courseRef: string
  readonly findingIds?: readonly string[]
}): string {
  const identity = [
    input.contextKind, input.contextRef, input.sourceLabel, input.grade, input.courseRef,
    ...(input.findingIds ? [...input.findingIds].sort() : []),
  ].join('|')
  return `csr-${hash(identity, 0x811c9dc5)}${hash(identity, 0x9e3779b9)}`
}

function entity(finding: CurriculumValidationFinding): CurriculumStandardsReviewEntity | null {
  if (!finding.entity.id || !['course', 'unit', 'lesson', 'assessment'].includes(finding.entity.type)) return null
  return {
    findingId: finding.id,
    entityType: finding.entity.type as CurriculumStandardsReviewEntity['entityType'],
    entityRef: finding.entity.id,
    path: finding.path,
  }
}

function exactDecision(
  candidate: CurriculumStandardsReviewCandidate,
  decision: CurriculumStandardsReviewDecision | undefined,
): CurriculumStandardsReviewDecision | null {
  if (!decision || decision.reviewKey !== candidate.reviewKey || decision.affectedCount !== candidate.affectedCount) return null
  const expected = candidate.entities.map((item) => item.findingId).sort()
  const actual = [...decision.findingIds].sort()
  if (expected.length !== actual.length || expected.some((findingId, index) => findingId !== actual[index])) return null
  return decision
}

export function buildCurriculumStandardsReviewQueue(
  occurrences: readonly CurriculumStandardsReviewOccurrence[],
  context: { readonly kind: CurriculumStandardsReviewContextKind; readonly ref: string },
  decisions: readonly CurriculumStandardsReviewDecision[] = [],
): readonly CurriculumStandardsReviewItem[] {
  const grouped = new Map<string, { seed: CurriculumStandardsReviewOccurrence; entities: CurriculumStandardsReviewEntity[] }>()
  for (const occurrence of occurrences) {
    if (occurrence.finding.rule !== 'standards.human_review_required' || !occurrence.finding.blocking) continue
    const projected = entity(occurrence.finding)
    if (!projected) continue
    const key = standardsReviewKey({
      contextKind: context.kind,
      contextRef: context.ref,
      sourceLabel: occurrence.sourceLabel,
      grade: occurrence.grade,
      courseRef: occurrence.courseRef,
    })
    const current = grouped.get(key)
    if (current) current.entities.push(projected)
    else grouped.set(key, { seed: occurrence, entities: [projected] })
  }
  const decisionByKey = new Map(decisions.map((decision) => [decision.reviewKey, decision]))
  return [...grouped.values()].map((value) => {
    const entities = [...new Map(value.entities.map((item) => [item.findingId, item])).values()]
      .sort((left, right) => left.entityType.localeCompare(right.entityType) || left.entityRef.localeCompare(right.entityRef))
    const reviewKey = standardsReviewKey({
      contextKind: context.kind,
      contextRef: context.ref,
      sourceLabel: value.seed.sourceLabel,
      grade: value.seed.grade,
      courseRef: value.seed.courseRef,
      findingIds: entities.map((item) => item.findingId),
    })
    const candidate: CurriculumStandardsReviewCandidate = {
      reviewKey,
      contextKind: context.kind,
      contextRef: context.ref,
      sourceLabel: value.seed.sourceLabel,
      grade: value.seed.grade,
      courseRef: value.seed.courseRef,
      findingRule: 'standards.human_review_required',
      affectedCount: entities.length,
      entities,
    }
    const decision = exactDecision(candidate, decisionByKey.get(reviewKey))
    return { ...candidate, decision, status: decision?.status ?? 'unreviewed' }
  }).sort((left, right) =>
    left.sourceLabel.localeCompare(right.sourceLabel, undefined, { numeric: true })
      || left.grade - right.grade
      || left.courseRef.localeCompare(right.courseRef),
  )
}

export function filterCurriculumStandardsReviewQueue(
  items: readonly CurriculumStandardsReviewItem[],
  filters: CurriculumStandardsReviewFilters,
): readonly CurriculumStandardsReviewItem[] {
  const query = filters.query?.trim().toLocaleLowerCase() ?? ''
  return items.filter((item) => (
    (!query || [item.sourceLabel, item.courseRef, item.contextRef, item.status, ...item.entities.map((entity) => entity.entityRef)]
      .some((value) => value.toLocaleLowerCase().includes(query)))
    && (!filters.grade || filters.grade === 'all' || item.grade === filters.grade)
    && (!filters.courseRef || filters.courseRef === 'all' || item.courseRef === filters.courseRef)
    && (!filters.status || filters.status === 'all' || item.status === filters.status)
  ))
}

export function groupCurriculumStandardsReviewQueue(
  items: readonly CurriculumStandardsReviewItem[],
  groupBy: CurriculumStandardsReviewGroupBy,
): readonly CurriculumStandardsReviewGroup[] {
  const groups = new Map<string, CurriculumStandardsReviewItem[]>()
  for (const item of items) {
    const key = groupBy === 'source-label' ? item.sourceLabel
      : groupBy === 'grade' ? String(item.grade)
        : groupBy === 'course' ? item.courseRef
          : groupBy === 'draft' ? `${item.contextKind}:${item.contextRef}`
            : groupBy === 'affected-count' ? String(item.affectedCount)
              : item.status
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.entries()].map(([key, groupedItems]) => ({
    key,
    label: groupBy === 'grade' ? `Grade ${key}`
      : groupBy === 'draft' ? groupedItems[0].contextRef
        : groupBy === 'affected-count' ? `${key} affected entities`
        : key.replaceAll('_', ' '),
    affectedCount: groupedItems.reduce((total, item) => total + item.affectedCount, 0),
    items: groupedItems,
  })).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }))
}

export function approvedStandardsReviewDecisions(
  decisions: readonly CurriculumStandardsReviewDecision[],
) {
  return decisions.map((decision) => ({
    status: decision.status,
    findingIds: decision.findingIds,
    canonicalStandardId: decision.canonicalStandardId,
    frameworkVersion: decision.frameworkVersion,
    canonicalTitle: decision.canonicalTitle,
    evidenceSource: decision.evidenceSource,
  }))
}
