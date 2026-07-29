import {
  asStudentId,
  type MasteryExplanation,
  type SkillGraph,
  type StudentSkillMastery,
} from '../../../adaptive-learning/mastery/index.ts'
import { buildMasteryDashboardModel } from '../../../app/features/mastery/projection.ts'
import type { MasteryDashboardModel } from '../../../app/features/mastery/model.ts'

export interface MasteryLearnerIdentity {
  readonly id: string
  readonly name: string
  readonly grade: string
}

export interface ReadOnlyMasterySnapshot {
  readonly generatedAt: string
  readonly graphs: readonly SkillGraph[]
  readonly masteryRecords: readonly StudentSkillMastery[]
  readonly explanations?: readonly MasteryExplanation[]
}

export function masteryGradeBandLabel(grade: string): string {
  switch (grade) {
    case '3':
    case '4':
      return 'Grades 3–5'
    case '6':
      return 'Grades 6–8'
    case '10':
    case '12':
      return 'Grades 9–12'
    default:
      throw new TypeError(`Unsupported mastery learner grade "${grade}".`)
  }
}

/**
 * This is a read-only projection seam. It accepts only frozen mastery-domain
 * records; it never reads Profile.skills, completion, attendance, schedules,
 * assessments, tutor state, or manual progress snapshots.
 */
export function buildLearnerMasteryDashboard(
  learner: MasteryLearnerIdentity,
  snapshot: ReadOnlyMasterySnapshot,
): MasteryDashboardModel {
  const studentId = asStudentId(learner.id)

  return buildMasteryDashboardModel({
    learner: {
      studentId,
      displayName: learner.name,
      gradeBand: masteryGradeBandLabel(learner.grade),
    },
    generatedAt: snapshot.generatedAt,
    graphs: snapshot.graphs,
    masteryRecords: snapshot.masteryRecords,
    explanations: snapshot.explanations,
  })
}

export function emptyMasterySnapshot(generatedAt: string): ReadOnlyMasterySnapshot {
  return {
    generatedAt,
    graphs: [],
    masteryRecords: [],
    explanations: [],
  }
}
