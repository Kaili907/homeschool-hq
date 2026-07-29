import {
  MASTERY_STATE_LABELS,
  type EvidenceExplanation,
  type MasteryEvidence,
  type MasteryExplanation,
  type MasteryReasonCode,
  type SkillGraph,
  type StudentSkillMastery,
} from './contracts.ts'
import { getSkill } from './graph.ts'
import { MasteryValidationError } from './validation-types.ts'
import { validateStudentSkillMastery } from './validation.ts'

const STATE_SUMMARIES: Readonly<Record<MasteryReasonCode, string>> = {
  no_evidence:
    'No direct performance evidence has been recorded for this skill yet.',
  prerequisite_record_missing:
    'A required prerequisite has no mastery record, so the system will not advance past it.',
  prerequisite_not_mastered:
    'A required prerequisite is not mastered, so work should return to that earlier skill.',
  only_supported_performance:
    'The student has worked on this skill with support, but supported completion does not establish mastery.',
  independent_evidence_below_threshold:
    'Independent work is present, but it has not yet met the repeated-performance mastery criterion.',
  independent_criterion_met:
    'Repeated successful independent performance met the mastery criterion.',
  independent_evidence_stale:
    'Earlier independent performance met the criterion, but it is old enough to require reinforcement.',
  recent_independent_failure:
    'A newer independent attempt showed difficulty after earlier successful performance.',
  conflicting_independent_results:
    'Comparable independent results conflict, so another check is needed before changing instruction.',
  evidence_quality_low:
    'The available evidence is limited, invalidated, or inconclusive.',
  reinforcement_succeeded:
    'A new independent demonstration successfully reinforced the skill.',
  manual_override_active:
    'A parent or teacher override currently controls the visible state; computed evidence remains unchanged.',
}

function explainEvidence(evidence: MasteryEvidence): EvidenceExplanation {
  switch (evidence.kind) {
    case 'assessment_attempt': {
      const scoring =
        evidence.scoringStatus === 'unscored'
          ? 'was not scored'
          : `${evidence.correctItemCount ?? 0} of ${evidence.attemptedItemCount} items were correct`
      return {
        evidenceId: evidence.id,
        kind: evidence.kind,
        capturedAt: evidence.capturedAt,
        contribution:
          evidence.quality === 'reliable' && evidence.scoringStatus !== 'unscored'
            ? 'context'
            : 'limits',
        summary: `Assessment attempt ${scoring}; support level: ${evidence.supportLevel.replaceAll('_', ' ')}. This attempt alone cannot establish mastery.`,
      }
    }
    case 'tutor_intervention':
      return {
        evidenceId: evidence.id,
        kind: evidence.kind,
        capturedAt: evidence.capturedAt,
        contribution:
          evidence.outcome === 'inconclusive' ||
          evidence.quality !== 'reliable'
            ? 'limits'
            : 'context',
        summary: `Tutor ${evidence.interventionType.replaceAll('_', ' ')} ended as ${evidence.outcome.replaceAll('_', ' ')}. Tutor-supported work is learning evidence, not independent mastery evidence.`,
      }
    case 'independent_demonstration':
      return {
        evidenceId: evidence.id,
        kind: evidence.kind,
        capturedAt: evidence.capturedAt,
        contribution:
          evidence.outcome === 'successful' &&
          evidence.quality === 'reliable'
            ? 'supports'
            : 'limits',
        summary: `Independent ${evidence.context.replaceAll('_', ' ')}: ${evidence.correctItemCount} of ${evidence.attemptedItemCount} correct; outcome ${evidence.outcome}.`,
      }
  }
}

export function explainMastery(
  record: StudentSkillMastery,
  graph: SkillGraph,
): MasteryExplanation {
  const result = validateStudentSkillMastery(record)
  if (!result.ok) {
    throw new MasteryValidationError(
      'Cannot explain an invalid mastery record.',
      result.issues,
    )
  }
  const skill = getSkill(graph, record.skillId)
  if (!skill) {
    throw new MasteryValidationError('Cannot explain an unknown graph skill.', [
      {
        path: '$.skillId',
        code: 'missing_skill',
        message: `Skill "${record.skillId}" does not exist in graph "${graph.id}".`,
      },
    ])
  }

  const blockingPrerequisites = record.prerequisiteStatus
    .filter(({ satisfied }) => !satisfied)
    .map((status) => {
      const prerequisite = getSkill(graph, status.skillId)
      return {
        skillId: status.skillId,
        title: prerequisite?.title ?? status.skillId,
        state: status.state,
        explanation:
          status.state === 'missing_record'
            ? 'No mastery record is available for this required prerequisite.'
            : `${prerequisite?.title ?? 'This prerequisite'} is ${MASTERY_STATE_LABELS[status.state]}.`,
      }
    })

  const whyThisState = record.reasonCodes
    .map((code) => STATE_SUMMARIES[code])
    .join(' ')
  const confidencePercent = Math.round(record.confidence.score * 100)
  const lastIndependentDemonstrationSummary =
    record.lastIndependentDemonstrationAt === undefined
      ? 'No successful independent demonstration has been recorded.'
      : `Last successful independent demonstration: ${record.lastIndependentDemonstrationAt}.`
  const currentOverride =
    record.override &&
    Date.parse(record.override.createdAt) <= Date.parse(record.evaluatedAt) &&
    (record.override.expiresAt === undefined ||
      Date.parse(record.override.expiresAt) > Date.parse(record.evaluatedAt))
      ? record.override
      : undefined

  return {
    skillId: skill.id,
    title: skill.title,
    learningObjective: skill.learningObjective,
    state: record.state,
    stateLabel: MASTERY_STATE_LABELS[record.state],
    whyThisState,
    blockingPrerequisites,
    evidence: record.evidence.map(explainEvidence),
    confidence: record.confidence,
    confidenceSummary: `${confidencePercent}% confidence (${record.confidence.level.replaceAll('_', ' ')}), based on ${record.confidence.basisEvidenceIds.length} usable evidence item${record.confidence.basisEvidenceIds.length === 1 ? '' : 's'}.`,
    nextAction: record.nextAction,
    lastIndependentDemonstrationAt:
      record.lastIndependentDemonstrationAt,
    lastIndependentDemonstrationSummary,
    manualOverride: currentOverride
      ? {
          state: currentOverride.state,
          reason: currentOverride.reason,
          actorRole: currentOverride.actor.role,
          createdAt: currentOverride.createdAt,
          expiresAt: currentOverride.expiresAt,
        }
      : undefined,
  }
}
