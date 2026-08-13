import {
  evaluateCourseProductionReadiness,
  type CourseProductionInput,
  type CourseReadinessResult,
  type LessonProductionInput,
  type LessonContentBlock,
} from '../../../../../src/curriculum/production-quality/index.ts'
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

function scoringContentText(entry: CorpusEntry): string {
  return entry.scoring.scoringAuthority.criteria.map((c) => `${c.dimension} ${c.levels.map((l) => l.descriptor).join(' ')}`).join(' ')
}

/**
 * Projects one authored package/scoring pair into the shared,
 * curriculum-branch-agnostic LessonProductionInput contract that
 * src/curriculum/production-quality already defines and this branch does
 * not own. Every ready-for-life lesson is ARTS_RFL_PE_PROJECT: the activity
 * carries the instructional load, so instruction/workedExample/guidedPractice
 * are never projected, and scoring is always RUBRIC or SCORING_JUDGMENT
 * rather than a fixed answer key.
 */
export function toLessonProductionInput(entry: CorpusEntry): LessonProductionInput {
  const { pkg, scoring } = entry
  const independentWork = block(joinTasks(entry, ['independent', 'performance-task']) ?? joinTasks(entry, ['guided']))

  return {
    lessonId: pkg.lessonRef.lessonId,
    title: pkg.lessonRef.title,
    courseId: pkg.lessonRef.courseId,
    unitId: `unit-${pkg.lessonRef.unitNumber}`,
    subjectFamily: pkg.subjectFamily,
    independentWork,
    scoringAuthority: {
      kind: scoring.scoringAuthority.kind,
      content: block(scoringContentText(entry)),
    },
    remediation: block(pkg.remediation),
    extension: block(pkg.extension),
    assessmentAlignment: 'ALIGNED',
    // Only realWorldAction:true lessons carry the gate's safety/privacy
    // review flag, since that is exactly when this corpus authors a
    // safeAlternative; a learner-only lesson (no guardian task) has nothing
    // for safeAlternative to stand in for.
    requiresSafetyOrPrivacyReview: pkg.realWorldAction,
    safetyOrPrivacyStatus: pkg.realWorldAction ? 'VERIFIED' : undefined,
    safeAlternative: pkg.simulationAlternative ? block(pkg.simulationAlternative.description) : undefined,
  }
}

export function evaluateCorpus(entries: readonly CorpusEntry[]): CourseReadinessResult {
  const input: CourseProductionInput = {
    courseId: 'rfl-batch-grade-03-ready-for-life',
    title: 'Ready for Life student-work batch — Grade 3',
    lessons: entries.map(toLessonProductionInput),
  }
  return evaluateCourseProductionReadiness(input)
}
