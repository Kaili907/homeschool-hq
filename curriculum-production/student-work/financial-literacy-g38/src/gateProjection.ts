import {
  evaluateCourseProductionReadiness,
  type CourseReadinessResult,
  type LessonContentBlock,
  type LessonProductionInput,
} from '../../../../src/curriculum/production-quality/index.ts'
import type { CorpusEntry } from './types.ts'

function block(text: string | undefined): LessonContentBlock {
  return text && text.trim().length > 0 ? { present: true, text } : { present: false }
}

function joinTasks(entry: CorpusEntry, kinds: readonly string[]): string | undefined {
  const parts = entry.pkg.tasks
    .filter((t) => kinds.includes(t.kind))
    .map((t) => `${t.directions} ${t.prompts.map((p) => p.text).join(' ')}`)
  return parts.length > 0 ? parts.join(' ') : undefined
}

function scoringText(entry: CorpusEntry): string {
  const authority = entry.scoring.scoringAuthority
  if (authority.kind === 'ANSWER_KEY') {
    return authority.items.map((i) => `${i.promptText} ${i.answer} ${i.verification.reasoning}`).join(' ')
  }
  return [
    ...authority.criteria.map((c) => `${c.dimension}: ${c.levels.map((l) => `${l.label} — ${l.descriptor}`).join(' ')}`),
    ...authority.acceptableAnswerCriteria,
  ].join(' ')
}

/**
 * Projects an authored pair into the shared, branch-agnostic readiness
 * contract owned by src/curriculum/production-quality (imported read-only).
 *
 * The scoring authority is reported as authored, never upgraded: a judgment
 * lesson projects RUBRIC even though the gate models every FinLit lesson as
 * fixed-answer. Relabelling it ANSWER_KEY would buy a green gate with a
 * claim this corpus cannot verify, which is the failure mode the previous
 * review found.
 */
export function toLessonProductionInput(entry: CorpusEntry): LessonProductionInput {
  const { pkg } = entry
  return {
    lessonId: pkg.lessonRef.lessonId,
    title: pkg.lessonRef.title,
    courseId: pkg.lessonRef.courseId,
    unitId: `unit-${pkg.lessonRef.unitNumber}`,
    subjectFamily: 'MATH_STRUCTURED_FINLIT',
    instruction: block(`${pkg.objective} ${pkg.scenario}`),
    workedExample: block(joinTasks(entry, ['warm-up', 'guided'])),
    guidedPractice: block(joinTasks(entry, ['guided'])),
    independentWork: block(joinTasks(entry, ['independent', 'performance-task'])),
    scoringAuthority: { kind: entry.scoring.scoringAuthority.kind, content: block(scoringText(entry)) },
    remediation: block(pkg.remediation),
    extension: block(pkg.extension),
    assessmentAlignment: 'ALIGNED',
    requiresSafetyOrPrivacyReview: false,
  }
}

export function evaluateCorpus(entries: readonly CorpusEntry[]): CourseReadinessResult[] {
  const grades = [...new Set(entries.map((e) => e.source.grade))].sort((a, b) => a - b)
  return grades.map((grade) => {
    const forGrade = entries.filter((e) => e.source.grade === grade)
    return evaluateCourseProductionReadiness({
      courseId: `ma-g${grade}-financial-literacy`,
      title: `Grade ${grade} Financial Literacy student-work corpus`,
      lessons: forGrade.map(toLessonProductionInput),
    })
  })
}
