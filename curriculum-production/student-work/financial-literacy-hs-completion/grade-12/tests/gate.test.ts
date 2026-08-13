import { describe, expect, it } from 'vitest'
import {
  evaluateCourseProductionReadiness,
  type CourseProductionInput,
  type LessonContentBlock,
  type LessonProductionInput,
} from '../../../../../src/curriculum/production-quality/index.ts'
import { composeScoringRecord, composeTaskSheet } from '../src/compose.ts'
import { buildGateMetadata, projectGateMode, SUBJECT_FAMILY } from '../src/gateMetadata.ts'
import { ALL_SPECS } from '../src/registry.ts'
import { sourceLessonMap } from '../src/sourceIndex.ts'

/**
 * Production Gate H3.
 *
 * This runs the real shared production-readiness gate — `src/curriculum/
 * production-quality`, which this lane does not own and does not modify —
 * over the authored grade 12 corpus, projected through the scoring-mode
 * metadata this lane prepares. No pass/fail claim is fabricated: the gate's
 * own code produces the result.
 */
const source = sourceLessonMap()

const block = (text: string): LessonContentBlock => ({ present: text.trim().length > 0, text })

interface Sheet {
  lessonRef: { lessonId: string; courseId: string; unitNumber: number; title: string }
  objective: string
  scenario: string
  remediation: string
  extension: string
  realWorldAction: boolean
  tasks: { kind: string; directions: string; prompts: { text: string }[] }[]
}

function joinTasks(sheet: Sheet, kinds: readonly string[]): string {
  return sheet.tasks
    .filter((t) => kinds.includes(t.kind))
    .map((t) => `${t.directions} ${t.prompts.map((p) => p.text).join(' ')}`)
    .join(' ')
}

function scoringContent(record: Record<string, unknown>): string {
  const authority = record.scoringAuthority as {
    items?: { answer: string; verification: { reasoning: string } }[]
    criteria?: { dimension: string; levels: { descriptor: string }[] }[]
  }
  const items = (authority.items ?? []).map((i) => `${i.answer} ${i.verification.reasoning}`).join(' ')
  const criteria = (authority.criteria ?? []).map((c) => `${c.dimension} ${c.levels.map((l) => l.descriptor).join(' ')}`).join(' ')
  return `${items} ${criteria}`.trim()
}

const lessons: LessonProductionInput[] = ALL_SPECS.map((spec) => {
  const src = source.get(spec.lessonId)!
  const sheet = composeTaskSheet(spec, src) as unknown as Sheet
  const record = composeScoringRecord(spec, src) as Record<string, unknown>
  const fixedItemCount = spec.tasks.flatMap((t) => t.items).filter((i) => i.kind !== 'judgment').length
  return {
    lessonId: sheet.lessonRef.lessonId,
    title: sheet.lessonRef.title,
    courseId: sheet.lessonRef.courseId,
    unitId: `unit-${sheet.lessonRef.unitNumber}`,
    subjectFamily: SUBJECT_FAMILY,
    instruction: block(`${sheet.objective} ${sheet.scenario}`),
    workedExample: block(joinTasks(sheet, ['warm-up', 'guided'])),
    guidedPractice: block(joinTasks(sheet, ['guided'])),
    independentWork: block(joinTasks(sheet, ['independent', 'performance-task'])),
    scoringAuthority: {
      kind: projectGateMode('HYBRID', fixedItemCount),
      content: block(scoringContent(record)),
    },
    remediation: block(sheet.remediation),
    extension: block(sheet.extension),
    assessmentAlignment: 'ALIGNED',
    requiresSafetyOrPrivacyReview: sheet.realWorldAction,
  }
})

const course: CourseProductionInput = {
  courseId: 'ma-g12-financial-literacy-student-work',
  title: 'Grade 12 Financial Literacy student-work corpus',
  lessons,
}

const result = evaluateCourseProductionReadiness(course)

describe('the shared production-quality gate over the grade 12 corpus', () => {
  it('returns NOT_READY for no lesson', () => {
    const notReady = result.lessonResults.filter((r) => r.status === 'NOT_READY')
    if (notReady.length > 0) {
      throw new Error(notReady.map((r) => `${r.lessonId}: ${r.codes.join(',')} — ${r.notes.join(' | ')}`).join('\n'))
    }
    expect(notReady).toEqual([])
  })

  it('raises no MISSING_ANSWER_KEY, MISSING_GUIDED_PRACTICE, or MISSING_INDEPENDENT_WORK', () => {
    const codes = result.lessonResults.flatMap((r) => r.codes)
    expect(codes).not.toContain('MISSING_ANSWER_KEY')
    expect(codes).not.toContain('MISSING_GUIDED_PRACTICE')
    expect(codes).not.toContain('MISSING_INDEPENDENT_WORK')
    expect(codes).not.toContain('MISSING_REMEDIATION')
    expect(codes).not.toContain('MISSING_EXTENSION')
  })

  it('reports the gap summary over all 72 lessons rather than a bare boolean', () => {
    expect(result.gapSummary.totalLessons).toBe(72)
    expect(result.lessonResults).toHaveLength(72)
  })

  it('reaches course-level READY', () => {
    expect(result.status).toBe('READY')
  })
})

describe('the prepared scoring-mode metadata', () => {
  const metadata = buildGateMetadata(ALL_SPECS)

  it('declares every lesson HYBRID in this lane and ANSWER_KEY to the gate', () => {
    expect(metadata.counts.lessons).toBe(72)
    expect(metadata.counts.byLaneKind).toEqual({ HYBRID: 72 })
    expect(metadata.counts.byGateMode).toEqual({ ANSWER_KEY: 72 })
  })

  it('backs every ANSWER_KEY claim with fixed items the oracle actually verified', () => {
    for (const lesson of metadata.lessons) {
      expect(lesson.fixedItemCount).toBeGreaterThan(0)
      expect(lesson.rubricItemCount).toBeGreaterThan(0)
      expect(lesson.oracleVerifiedFixedAnswers).toBeGreaterThan(0)
      expect(lesson.oracleVerifiedFixedAnswers).toBeLessThanOrEqual(lesson.fixedItemCount)
    }
    expect(metadata.counts.fixedItems).toBeGreaterThan(400)
    expect(metadata.counts.rubricItems).toBe(72)
  })

  it('refuses to project ANSWER_KEY for a lesson that carries no fixed item', () => {
    expect(() => projectGateMode('RUBRIC', 0)).toThrow(/cannot be declared ANSWER_KEY/)
    expect(() => projectGateMode('HYBRID', 0)).toThrow(/cannot be declared ANSWER_KEY/)
  })

  it('states the mapping rather than leaving the HYBRID-to-ANSWER_KEY step implicit', () => {
    expect(metadata.modeMapping.length).toBeGreaterThanOrEqual(3)
    expect(metadata.modeMapping.join(' ')).toContain('HYBRID')
    expect(metadata.gateContract).toContain('ANSWER_KEY')
  })
})
