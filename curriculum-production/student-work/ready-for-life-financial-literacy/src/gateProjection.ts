import {
  evaluateCourseProductionReadiness,
  type CourseProductionInput,
  type CourseReadinessResult,
  type LessonProductionInput,
  type LessonContentBlock,
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

function scoringContentText(entry: CorpusEntry): string {
  const { scoringAuthority } = entry.scoring
  if (scoringAuthority.kind === 'ANSWER_KEY') {
    return scoringAuthority.items.map((i) => `${i.answer} ${i.verification.reasoning}`).join(' ')
  }
  return scoringAuthority.criteria.map((c) => `${c.dimension} ${c.levels.map((l) => l.descriptor).join(' ')}`).join(' ')
}

/**
 * Projects one authored package/scoring pair into the shared, curriculum-
 * branch-agnostic LessonProductionInput contract that
 * src/curriculum/production-quality already defines and this branch does
 * not own. financial-literacy always projects a fixed ANSWER_KEY (the gate
 * requires this for MATH_STRUCTURED_FINLIT); ready-for-life projects
 * whatever this corpus actually authored (RUBRIC or SCORING_JUDGMENT).
 */
export function toLessonProductionInput(entry: CorpusEntry): LessonProductionInput {
  const { pkg, scoring } = entry

  const instruction = pkg.subjectFamily === 'MATH_STRUCTURED_FINLIT' ? block(`${pkg.objective} ${pkg.scenario}`) : undefined
  const workedExample = pkg.subjectFamily === 'MATH_STRUCTURED_FINLIT' ? block(joinTasks(entry, ['warm-up', 'guided'])) : undefined
  const guidedPractice = pkg.subjectFamily === 'MATH_STRUCTURED_FINLIT' ? block(joinTasks(entry, ['guided'])) : undefined
  const independentWork = block(joinTasks(entry, ['independent', 'performance-task']) ?? joinTasks(entry, ['guided']))

  return {
    lessonId: pkg.lessonRef.lessonId,
    title: pkg.lessonRef.title,
    courseId: pkg.lessonRef.courseId,
    unitId: `unit-${pkg.lessonRef.unitNumber}`,
    subjectFamily: pkg.subjectFamily,
    instruction,
    workedExample,
    guidedPractice,
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
    // safeAlternative; a learner-only ready-for-life lesson (no guardian
    // task) has nothing for safeAlternative to stand in for.
    requiresSafetyOrPrivacyReview: pkg.realWorldAction,
    safetyOrPrivacyStatus: pkg.realWorldAction ? 'VERIFIED' : undefined,
    safeAlternative: pkg.simulationAlternative ? block(pkg.simulationAlternative.description) : undefined,
  }
}

export function evaluateCorpus(entries: readonly CorpusEntry[]): {
  readonly readyForLife: CourseReadinessResult
  readonly financialLiteracy: CourseReadinessResult
} {
  const byCourse = (subject: 'ready-for-life' | 'financial-literacy'): CourseProductionInput => ({
    courseId: `rfl-finlit-student-work-${subject}`,
    title: subject === 'ready-for-life' ? 'Ready for Life student-work corpus' : 'Financial Literacy student-work corpus',
    lessons: entries.filter((e) => e.pkg.lessonRef.subject === subject).map(toLessonProductionInput),
  })

  return {
    readyForLife: evaluateCourseProductionReadiness(byCourse('ready-for-life')),
    financialLiteracy: evaluateCourseProductionReadiness(byCourse('financial-literacy')),
  }
}
