import {
  MASTERY_SCHEMA_VERSION,
  MASTERY_STATES,
  type IndependentDemonstrationEvidence,
  type MasteryEvidence,
  type MasteryNextAction,
  type MasteryReasonCode,
  type MasteryState,
  type PrerequisiteStatus,
  type SkillGraph,
  type StudentSkillMastery,
} from './contracts.ts'
import { assessMasteryConfidence } from './confidence.ts'
import {
  getPrerequisiteEdges,
  getSkill,
  validateSkillGraph,
} from './graph.ts'
import type {
  ISODateTime,
  MasteryRecordId,
  SkillId,
  StudentId,
} from './ids.ts'
import {
  MasteryValidationError,
  isIsoDateTime,
  isPositiveInteger,
  type ValidationIssue,
} from './validation-types.ts'
import {
  validateMasteryEvidence,
  validateStudentSkillMastery,
} from './validation.ts'

const DAY_MS = 24 * 60 * 60 * 1_000

export interface MasteryPolicy {
  readonly algorithmVersion: string
  readonly minimumIndependentDemonstrations: number
  readonly minimumIndependentDistinctDays: number
  readonly reinforcementAfterDays: number
  readonly conflictWindowDays: number
  readonly requireNovelOrTransferEvidence: boolean
}

export const DEFAULT_MASTERY_POLICY: MasteryPolicy = {
  algorithmVersion: 'manuel-mastery-v1',
  minimumIndependentDemonstrations: 2,
  minimumIndependentDistinctDays: 2,
  reinforcementAfterDays: 45,
  conflictWindowDays: 7,
  requireNovelOrTransferEvidence: true,
}

export const MASTERY_TRANSITION_RULES: Readonly<
  Record<MasteryState, readonly MasteryState[]>
> = {
  not_yet_assessed: [
    'not_yet_assessed',
    'currently_learning',
    'blocked_by_prerequisite',
    'evidence_uncertain',
    'mastered',
    'needs_reinforcement',
  ],
  currently_learning: [
    'currently_learning',
    'mastered',
    'needs_reinforcement',
    'blocked_by_prerequisite',
    'evidence_uncertain',
  ],
  mastered: [
    'mastered',
    'needs_reinforcement',
    'blocked_by_prerequisite',
    'evidence_uncertain',
  ],
  needs_reinforcement: [
    'needs_reinforcement',
    'mastered',
    'currently_learning',
    'blocked_by_prerequisite',
    'evidence_uncertain',
  ],
  blocked_by_prerequisite: [
    'blocked_by_prerequisite',
    'not_yet_assessed',
    'currently_learning',
    'needs_reinforcement',
    'evidence_uncertain',
    'mastered',
  ],
  evidence_uncertain: [
    'evidence_uncertain',
    'not_yet_assessed',
    'currently_learning',
    'needs_reinforcement',
    'blocked_by_prerequisite',
    'mastered',
  ],
}

export interface MasteryTransitionDecision {
  readonly allowed: boolean
  readonly code: 'allowed' | 'manual_override' | 'disallowed_engine_transition'
  readonly message: string
}

/**
 * Manual changes may select any state but must go through the audited override
 * API. Evidence-engine transitions use the explicit matrix above.
 */
export function validateMasteryTransition(
  from: MasteryState,
  to: MasteryState,
  source: 'evidence_engine' | 'manual_override' = 'evidence_engine',
): MasteryTransitionDecision {
  if (source === 'manual_override') {
    return {
      allowed: true,
      code: 'manual_override',
      message: 'Manual state changes are allowed only with an override audit entry.',
    }
  }
  const allowed = MASTERY_TRANSITION_RULES[from].includes(to)
  return {
    allowed,
    code: allowed ? 'allowed' : 'disallowed_engine_transition',
    message: allowed
      ? `Evidence transition from ${from} to ${to} is allowed.`
      : `Evidence transition from ${from} to ${to} is not allowed; use an evidence-appropriate intermediate state or an audited manual override.`,
  }
}

export interface EvaluateMasteryInput {
  readonly recordId: MasteryRecordId
  readonly studentId: StudentId
  readonly skillId: SkillId
  readonly graph: SkillGraph
  readonly evidence: readonly MasteryEvidence[]
  /**
   * Records for direct prerequisites. Extra graph records are ignored; missing
   * direct records are explicit blockers, never assumed mastered.
   */
  readonly prerequisiteRecords?: readonly StudentSkillMastery[]
  readonly previous?: StudentSkillMastery
  readonly evaluatedAt: ISODateTime
  readonly policy?: Partial<MasteryPolicy>
}

interface DerivedState {
  readonly state: MasteryState
  readonly reasons: readonly MasteryReasonCode[]
  readonly latestIndependentSuccess?: IndependentDemonstrationEvidence
  readonly latestIndependentFailure?: IndependentDemonstrationEvidence
  readonly qualifiesForMastery: boolean
  readonly reinforcementSucceeded: boolean
}

function mergePolicy(partial: Partial<MasteryPolicy> | undefined): MasteryPolicy {
  const policy = { ...DEFAULT_MASTERY_POLICY, ...partial }
  const issues: ValidationIssue[] = []
  if (
    typeof policy.algorithmVersion !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(policy.algorithmVersion) ||
    policy.algorithmVersion.length > 128
  ) {
    issues.push({
      path: '$.policy.algorithmVersion',
      code: 'invalid_stable_id',
      message: 'Policy algorithmVersion must be a stable opaque ID.',
    })
  }
  for (const [key, value] of [
    [
      'minimumIndependentDemonstrations',
      policy.minimumIndependentDemonstrations,
    ],
    ['minimumIndependentDistinctDays', policy.minimumIndependentDistinctDays],
    ['reinforcementAfterDays', policy.reinforcementAfterDays],
    ['conflictWindowDays', policy.conflictWindowDays],
  ] as const) {
    if (!isPositiveInteger(value)) {
      issues.push({
        path: `$.policy.${key}`,
        code: 'invalid_policy_value',
        message: `${key} must be a positive integer.`,
      })
    }
  }
  if (typeof policy.requireNovelOrTransferEvidence !== 'boolean') {
    issues.push({
      path: '$.policy.requireNovelOrTransferEvidence',
      code: 'invalid_policy_value',
      message: 'requireNovelOrTransferEvidence must be boolean.',
    })
  }
  if (issues.length > 0) {
    throw new MasteryValidationError('Invalid mastery policy.', issues)
  }
  return policy
}

function chronologicalEvidence(
  evidence: readonly MasteryEvidence[],
): readonly MasteryEvidence[] {
  return [...evidence].sort(
    (left, right) =>
      Date.parse(left.capturedAt) - Date.parse(right.capturedAt) ||
      left.id.localeCompare(right.id),
  )
}

function directPrerequisiteStatus(
  graph: SkillGraph,
  skillId: SkillId,
  studentId: StudentId,
  records: readonly StudentSkillMastery[],
): readonly PrerequisiteStatus[] {
  const bySkillId = new Map(records.map((record) => [record.skillId, record]))
  return getPrerequisiteEdges(graph, skillId).map((edge) => {
    const record = bySkillId.get(edge.prerequisiteSkillId)
    if (!record || record.studentId !== studentId) {
      return {
        skillId: edge.prerequisiteSkillId,
        state: 'missing_record',
        satisfied: false,
      }
    }
    return {
      skillId: edge.prerequisiteSkillId,
      state: record.state,
      satisfied: record.state === 'mastered',
      recordRevision: record.revision,
    }
  })
}

function independentEvidence(
  evidence: readonly MasteryEvidence[],
): readonly IndependentDemonstrationEvidence[] {
  return evidence.filter(
    (item): item is IndependentDemonstrationEvidence =>
      item.kind === 'independent_demonstration',
  )
}

function deriveState(
  evidence: readonly MasteryEvidence[],
  prerequisiteStatus: readonly PrerequisiteStatus[],
  previous: StudentSkillMastery | undefined,
  now: ISODateTime,
  policy: MasteryPolicy,
): DerivedState {
  const blockers = prerequisiteStatus.filter(({ satisfied }) => !satisfied)
  if (blockers.length > 0) {
    return {
      state: 'blocked_by_prerequisite',
      reasons: blockers.map(({ state }) =>
        state === 'missing_record'
          ? 'prerequisite_record_missing'
          : 'prerequisite_not_mastered',
      ),
      qualifiesForMastery: false,
      reinforcementSucceeded: false,
    }
  }

  if (evidence.length === 0) {
    return {
      state: 'not_yet_assessed',
      reasons: ['no_evidence'],
      qualifiesForMastery: false,
      reinforcementSucceeded: false,
    }
  }

  const usable = evidence.filter(({ quality }) => quality !== 'invalidated')
  if (usable.length === 0) {
    return {
      state: 'evidence_uncertain',
      reasons: ['evidence_quality_low'],
      qualifiesForMastery: false,
      reinforcementSucceeded: false,
    }
  }

  const independent = independentEvidence(usable)
  const reliableIndependent = independent.filter(
    ({ quality }) => quality === 'reliable',
  )
  const successes = reliableIndependent.filter(
    ({ outcome }) => outcome === 'successful',
  )
  const failures = reliableIndependent.filter(
    ({ outcome }) => outcome === 'unsuccessful',
  )
  const latestSuccess = successes.at(-1)
  const latestFailure = failures.at(-1)
  const distinctSuccessDays = new Set(
    successes.map(({ capturedAt }) => capturedAt.slice(0, 10)),
  ).size
  const hasNovelOrTransfer = successes.some(
    ({ taskNovelty }) => taskNovelty !== 'familiar_items',
  )
  const qualifiesForMastery =
    successes.length >= policy.minimumIndependentDemonstrations &&
    distinctSuccessDays >= policy.minimumIndependentDistinctDays &&
    (!policy.requireNovelOrTransferEvidence || hasNovelOrTransfer)

  const hasExplicitConflict = usable.some(
    ({ quality }) => quality === 'conflicting',
  )
  const resultsWithinConflictWindow =
    latestSuccess !== undefined &&
    latestFailure !== undefined &&
    Math.abs(
      Date.parse(latestSuccess.capturedAt) -
        Date.parse(latestFailure.capturedAt),
    ) <=
      policy.conflictWindowDays * DAY_MS

  if (hasExplicitConflict || resultsWithinConflictWindow) {
    return {
      state: 'evidence_uncertain',
      reasons: ['conflicting_independent_results'],
      latestIndependentSuccess: latestSuccess,
      latestIndependentFailure: latestFailure,
      qualifiesForMastery,
      reinforcementSucceeded: false,
    }
  }

  const latestFailureIsNewer =
    latestFailure !== undefined &&
    (latestSuccess === undefined ||
      Date.parse(latestFailure.capturedAt) >
        Date.parse(latestSuccess.capturedAt))
  const isStale =
    latestSuccess !== undefined &&
    Date.parse(now) - Date.parse(latestSuccess.capturedAt) >=
      policy.reinforcementAfterDays * DAY_MS

  if (qualifiesForMastery && latestFailureIsNewer) {
    return {
      state: 'needs_reinforcement',
      reasons: ['recent_independent_failure'],
      latestIndependentSuccess: latestSuccess,
      latestIndependentFailure: latestFailure,
      qualifiesForMastery,
      reinforcementSucceeded: false,
    }
  }

  if (qualifiesForMastery && isStale) {
    return {
      state: 'needs_reinforcement',
      reasons: ['independent_evidence_stale'],
      latestIndependentSuccess: latestSuccess,
      latestIndependentFailure: latestFailure,
      qualifiesForMastery,
      reinforcementSucceeded: false,
    }
  }

  if (qualifiesForMastery && latestSuccess) {
    const reinforcementSucceeded =
      previous?.computedState === 'needs_reinforcement' &&
      Date.parse(latestSuccess.capturedAt) > Date.parse(previous.evaluatedAt)
    return {
      state: 'mastered',
      reasons: reinforcementSucceeded
        ? ['independent_criterion_met', 'reinforcement_succeeded']
        : ['independent_criterion_met'],
      latestIndependentSuccess: latestSuccess,
      latestIndependentFailure: latestFailure,
      qualifiesForMastery,
      reinforcementSucceeded,
    }
  }

  const onlyLowQuality = usable.every(
    ({ quality }) => quality === 'limited' || quality === 'conflicting',
  )
  const onlyInconclusive =
    independent.length > 0 &&
    independent.every(({ outcome }) => outcome === 'inconclusive') &&
    usable.every(
      (item) =>
        item.kind === 'independent_demonstration' ||
        (item.kind === 'assessment_attempt' &&
          item.scoringStatus === 'unscored') ||
        (item.kind === 'tutor_intervention' &&
          item.outcome === 'inconclusive'),
    )
  if (onlyLowQuality || onlyInconclusive) {
    return {
      state: 'evidence_uncertain',
      reasons: ['evidence_quality_low'],
      latestIndependentSuccess: latestSuccess,
      latestIndependentFailure: latestFailure,
      qualifiesForMastery: false,
      reinforcementSucceeded: false,
    }
  }

  const hasSupportedPerformance = usable.some(
    (item) =>
      item.kind === 'tutor_intervention' ||
      (item.kind === 'assessment_attempt' &&
        item.supportLevel !== 'independent'),
  )
  return {
    state: 'currently_learning',
    reasons: [
      hasSupportedPerformance
        ? 'only_supported_performance'
        : 'independent_evidence_below_threshold',
    ],
    latestIndependentSuccess: latestSuccess,
    latestIndependentFailure: latestFailure,
    qualifiesForMastery: false,
    reinforcementSucceeded: false,
  }
}

function nextActionFor(
  state: MasteryState,
  skillId: SkillId,
  prerequisiteStatus: readonly PrerequisiteStatus[],
  reasons: readonly MasteryReasonCode[],
): MasteryNextAction {
  const blockerIds = prerequisiteStatus
    .filter(({ satisfied }) => !satisfied)
    .map(({ skillId: prerequisiteSkillId }) => prerequisiteSkillId)

  switch (state) {
    case 'not_yet_assessed':
      return {
        kind: 'collect_initial_evidence',
        label: 'Complete a short independent check',
        rationale:
          'The system needs direct performance evidence before choosing an instructional path.',
        targetSkillIds: [skillId],
      }
    case 'blocked_by_prerequisite':
      return {
        kind: 'reteach_prerequisite',
        label: 'Strengthen the blocking prerequisite',
        rationale:
          'A required earlier skill is not yet mastered, so instruction should return there first.',
        targetSkillIds: blockerIds,
      }
    case 'mastered':
      return {
        kind: 'maintain_with_spaced_review',
        label: 'Keep mastery fresh with spaced review',
        rationale:
          'Independent performance met the criterion; brief later retrieval protects retention.',
        targetSkillIds: [skillId],
      }
    case 'needs_reinforcement':
      return {
        kind: 'schedule_reinforcement',
        label: 'Schedule an independent reinforcement check',
        rationale:
          'Previously sufficient independent evidence is stale or a newer independent attempt showed difficulty.',
        targetSkillIds: [skillId],
      }
    case 'evidence_uncertain':
      return {
        kind: reasons.includes('conflicting_independent_results')
          ? 'resolve_conflicting_evidence'
          : 'adult_review',
        label: reasons.includes('conflicting_independent_results')
          ? 'Run another comparable independent check'
          : 'Review evidence quality, then reassess',
        rationale:
          'The available evidence is inconclusive, conflicting, or too limited for a dependable instructional decision.',
        targetSkillIds: [skillId],
      }
    case 'currently_learning':
      if (reasons.includes('only_supported_performance')) {
        return {
          kind: 'collect_independent_demonstration',
          label: 'Fade support and check independent performance',
          rationale:
            'Supported work shows learning progress but cannot establish mastery.',
          targetSkillIds: [skillId],
        }
      }
      return {
        kind: 'continue_adaptive_instruction',
        label: 'Continue the adaptive teaching cycle',
        rationale:
          'The student is engaging with the skill but has not yet met the independent mastery criterion.',
        targetSkillIds: [skillId],
      }
  }
}

function isOverrideCurrent(
  record: StudentSkillMastery | undefined,
  now: ISODateTime,
): boolean {
  const override = record?.override
  if (!override) return false
  return (
    Date.parse(override.createdAt) <= Date.parse(now) &&
    (override.expiresAt === undefined ||
      Date.parse(override.expiresAt) > Date.parse(now))
  )
}

/**
 * Evaluates one student/skill record. The function is pure and deterministic:
 * callers provide IDs and time, and no state is read from global storage.
 */
export function evaluateMastery(
  input: EvaluateMasteryInput,
): StudentSkillMastery {
  const graphResult = validateSkillGraph(input.graph)
  if (!graphResult.ok) {
    throw new MasteryValidationError(
      'Cannot evaluate against an invalid skill graph.',
      graphResult.issues,
    )
  }
  if (!isIsoDateTime(input.evaluatedAt)) {
    throw new MasteryValidationError('Invalid mastery evaluation time.', [
      {
        path: '$.evaluatedAt',
        code: 'invalid_datetime',
        message: 'evaluatedAt must be an RFC 3339 date-time.',
      },
    ])
  }
  const skill = getSkill(input.graph, input.skillId)
  if (!skill) {
    throw new MasteryValidationError('Skill is not present in the graph.', [
      {
        path: '$.skillId',
        code: 'missing_skill',
        message: `Skill "${input.skillId}" is not present in graph "${input.graph.id}".`,
      },
    ])
  }
  if (input.previous) {
    const previousResult = validateStudentSkillMastery(input.previous)
    if (!previousResult.ok) {
      throw new MasteryValidationError(
        'Previous mastery record is invalid.',
        previousResult.issues,
      )
    }
    if (
      input.previous.id !== input.recordId ||
      input.previous.studentId !== input.studentId ||
      input.previous.skillId !== input.skillId
    ) {
      throw new MasteryValidationError(
        'Previous mastery record identity mismatch.',
        [
          {
            path: '$.previous',
            code: 'record_identity_mismatch',
            message:
              'Previous record ID, student ID, and skill ID must match the evaluation input.',
          },
        ],
      )
    }
    if (
      Date.parse(input.evaluatedAt) < Date.parse(input.previous.evaluatedAt)
    ) {
      throw new MasteryValidationError(
        'Mastery evaluation time cannot move backward.',
        [
          {
            path: '$.evaluatedAt',
            code: 'evaluation_out_of_order',
            message:
              'A new evaluation cannot precede the previous record evaluation.',
          },
        ],
      )
    }
  }

  const evidenceIds = new Set<string>()
  for (const [index, evidence] of input.evidence.entries()) {
    const result = validateMasteryEvidence(evidence)
    if (!result.ok) {
      throw new MasteryValidationError(
        `Mastery evidence at index ${index} is invalid.`,
        result.issues.map((issue) => ({
          ...issue,
          path: `$.evidence[${index}]${issue.path.slice(1)}`,
        })),
      )
    }
    if (
      evidence.studentId !== input.studentId ||
      evidence.skillId !== input.skillId
    ) {
      throw new MasteryValidationError('Mastery evidence identity mismatch.', [
        {
          path: `$.evidence[${index}]`,
          code: 'evidence_identity_mismatch',
          message: 'Every evidence item must belong to the evaluated student and skill.',
        },
      ])
    }
    if (evidenceIds.has(evidence.id)) {
      throw new MasteryValidationError('Duplicate mastery evidence ID.', [
        {
          path: `$.evidence[${index}].id`,
          code: 'duplicate_evidence_id',
          message: `Evidence ID "${evidence.id}" occurs more than once.`,
        },
      ])
    }
    evidenceIds.add(evidence.id)
  }

  for (const [index, evidence] of input.evidence.entries()) {
    if (evidence.kind !== 'independent_demonstration') continue
    for (const [refIndex, reference] of evidence.sourceEvidenceIds.entries()) {
      if (!evidenceIds.has(reference)) {
        throw new MasteryValidationError(
          'Independent demonstration references missing evidence.',
          [
            {
              path: `$.evidence[${index}].sourceEvidenceIds[${refIndex}]`,
              code: 'missing_evidence_reference',
              message: `Referenced evidence "${reference}" is not in this evaluation.`,
            },
        ],
      )
    }
    if (Date.parse(evidence.capturedAt) > Date.parse(input.evaluatedAt)) {
      throw new MasteryValidationError(
        'Future evidence cannot affect the current mastery state.',
        [
          {
            path: `$.evidence[${index}].capturedAt`,
            code: 'future_evidence',
            message: 'Evidence captured after evaluatedAt must be quarantined.',
          },
        ],
      )
    }
    }
  }

  const policy = mergePolicy(input.policy)
  const orderedEvidence = chronologicalEvidence(input.evidence)
  const latestSuccessfulIndependentAt = independentEvidence(orderedEvidence)
    .filter(
      ({ outcome, quality }) =>
        outcome === 'successful' && quality === 'reliable',
    )
    .at(-1)?.capturedAt
  const prerequisiteRecords = input.prerequisiteRecords ?? []
  for (const record of prerequisiteRecords) {
    if (record.studentId === input.studentId) {
      const result = validateStudentSkillMastery(record)
      if (!result.ok) {
        throw new MasteryValidationError(
          'Prerequisite mastery record is invalid.',
          result.issues,
        )
      }
    }
  }
  const prerequisiteStatus = directPrerequisiteStatus(
    input.graph,
    input.skillId,
    input.studentId,
    prerequisiteRecords,
  )
  const derived = deriveState(
    orderedEvidence,
    prerequisiteStatus,
    input.previous,
    input.evaluatedAt,
    policy,
  )

  if (input.previous) {
    const transition = validateMasteryTransition(
      input.previous.computedState,
      derived.state,
    )
    if (!transition.allowed) {
      throw new MasteryValidationError('Disallowed mastery state transition.', [
        {
          path: '$.computedState',
          code: transition.code,
          message: transition.message,
        },
      ])
    }
  }

  const confidence = assessMasteryConfidence(
    orderedEvidence,
    input.evaluatedAt,
    policy.algorithmVersion,
  )
  const overrideIsCurrent = isOverrideCurrent(input.previous, input.evaluatedAt)
  const effectiveState = overrideIsCurrent
    ? input.previous!.override!.state
    : derived.state
  const reasonCodes = overrideIsCurrent
    ? ([...derived.reasons, 'manual_override_active'] as const)
    : derived.reasons
  const record: StudentSkillMastery = {
    kind: 'student-skill-mastery',
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: input.recordId,
    revision: (input.previous?.revision ?? 0) + 1,
    studentId: input.studentId,
    skillId: input.skillId,
    computedState: derived.state,
    state: effectiveState,
    confidence,
    evidence: orderedEvidence,
    basisEvidenceIds: orderedEvidence
      .filter(({ quality }) => quality !== 'invalidated')
      .map(({ id }) => id),
    prerequisiteStatus,
    reasonCodes: [...new Set(reasonCodes)],
    nextAction: nextActionFor(
      derived.state,
      input.skillId,
      prerequisiteStatus,
      reasonCodes,
    ),
    evaluatedAt: input.evaluatedAt,
    lastIndependentDemonstrationAt: latestSuccessfulIndependentAt,
    lastReinforcedAt: derived.reinforcementSucceeded
      ? derived.latestIndependentSuccess?.capturedAt
      : input.previous?.lastReinforcedAt,
    override: input.previous?.override,
    overrideAuditHistory: input.previous?.overrideAuditHistory ?? [],
  }

  const result = validateStudentSkillMastery(record)
  if (!result.ok) {
    throw new MasteryValidationError(
      'Mastery engine produced an invalid record.',
      result.issues,
    )
  }
  return record
}

export function isMasteryState(value: unknown): value is MasteryState {
  return (
    typeof value === 'string' &&
    MASTERY_STATES.includes(value as MasteryState)
  )
}
