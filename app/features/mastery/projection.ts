import type {
  EvidenceExplanation,
  GradeBand,
  MasteryEvidence,
  MasteryExplanation,
  MasteryReasonCode,
  MasteryState,
  SkillGraph,
  SkillId,
  StudentId,
  StudentSkillMastery,
  SubjectId,
} from "../../../adaptive-learning/mastery/index.js";
import type {
  ConfidenceLevel,
  MasteryConfidenceView,
  MasteryDashboardModel,
  MasteryEvidenceView,
  MasteryOverrideAuditView,
  MasterySkillView,
} from "./model.js";

export interface BuildMasteryDashboardModelInput {
  readonly learner: {
    readonly studentId: StudentId;
    readonly displayName: string;
    readonly gradeBand: string;
  };
  readonly generatedAt: string;
  /** Graphs must already have passed domain graph validation. */
  readonly graphs: readonly SkillGraph[];
  readonly masteryRecords: readonly StudentSkillMastery[];
  readonly explanations?: readonly MasteryExplanation[];
  readonly subjectLabels?: Readonly<Partial<Record<SubjectId, string>>>;
}

const GRADE_BAND_LABELS: Readonly<Record<GradeBand, string>> = {
  "elementary-3-5": "Grades 3–5",
  "middle-6-8": "Grades 6–8",
  "high-9-12": "Grades 9–12",
};

const REASON_LABELS: Readonly<Record<MasteryReasonCode, string>> = {
  no_evidence: "No performance evidence has been collected yet.",
  prerequisite_record_missing:
    "A required prerequisite does not have a mastery record yet.",
  prerequisite_not_mastered:
    "At least one required prerequisite is not yet mastered.",
  only_supported_performance:
    "Current success was observed with support, not independently.",
  independent_evidence_below_threshold:
    "Independent performance is below the mastery criterion.",
  independent_criterion_met:
    "Reliable independent performance met the mastery criterion.",
  independent_evidence_stale:
    "The last independent demonstration is old enough to need reinforcement.",
  recent_independent_failure:
    "A recent independent check shows that reinforcement is needed.",
  conflicting_independent_results:
    "Independent performance evidence currently points in different directions.",
  evidence_quality_low:
    "Available evidence is too limited or low-quality for a firm conclusion.",
  reinforcement_succeeded:
    "A reinforcement check was completed successfully and independently.",
  manual_override_active:
    "A documented parent or teacher override is currently active.",
};

const CONFIDENCE_LEVEL_MAP: Readonly<
  Record<StudentSkillMastery["confidence"]["level"], ConfidenceLevel>
> = {
  very_low: "insufficient",
  low: "low",
  moderate: "medium",
  high: "high",
};

function gradeBandLabel(gradeBand: GradeBand): string {
  return GRADE_BAND_LABELS[gradeBand];
}

function percentage(correct: number, attempted: number): string {
  if (attempted <= 0) return "No scored items";
  return `${Math.round((correct / attempted) * 100)}% accuracy`;
}

function supportLabel(
  supportLevel:
    | "independent"
    | "minimal_support"
    | "guided"
    | "full_support",
): string {
  switch (supportLevel) {
    case "independent":
      return "without instructional support";
    case "minimal_support":
      return "with minimal support";
    case "guided":
      return "with guided support";
    case "full_support":
      return "with full support";
  }
}

function evidenceSummary(evidence: MasteryEvidence): string {
  switch (evidence.kind) {
    case "assessment_attempt": {
      const result =
        evidence.correctItemCount === undefined
          ? `${evidence.attemptedItemCount} items; scoring incomplete`
          : percentage(evidence.correctItemCount, evidence.attemptedItemCount);
      return `${result}, ${supportLabel(evidence.supportLevel)}.`;
    }
    case "tutor_intervention":
      return `${evidence.interventionType.replaceAll("_", " ")}; ${evidence.outcome.replaceAll("_", " ")}.`;
    case "independent_demonstration":
      return `${percentage(
        evidence.correctItemCount,
        evidence.attemptedItemCount,
      )} on ${evidence.taskNovelty.replaceAll("_", " ")}; ${evidence.outcome}.`;
  }
}

function evidenceTitle(evidence: MasteryEvidence): string {
  switch (evidence.kind) {
    case "assessment_attempt":
      return `${evidence.assessmentType[0]?.toUpperCase() ?? ""}${evidence.assessmentType.slice(1)} assessment`;
    case "tutor_intervention":
      return `Tutor ${evidence.interventionType.replaceAll("_", " ")}`;
    case "independent_demonstration":
      return `Independent ${evidence.context.replaceAll("_", " ")}`;
  }
}

function evidenceResult(evidence: MasteryEvidence): string {
  switch (evidence.kind) {
    case "assessment_attempt":
      return evidence.scoringStatus.replaceAll("_", " ");
    case "tutor_intervention":
      return evidence.outcome.replaceAll("_", " ");
    case "independent_demonstration":
      return evidence.outcome;
  }
}

function projectEvidence(
  evidence: MasteryEvidence,
  explanation?: EvidenceExplanation,
): MasteryEvidenceView {
  return {
    evidenceId: evidence.id,
    kind: evidence.kind,
    title: evidenceTitle(evidence),
    summary: explanation?.summary ?? evidenceSummary(evidence),
    observedAt: evidence.capturedAt,
    sourceLabel: evidence.sourceRef,
    independent:
      evidence.kind === "independent_demonstration" ||
      (evidence.kind === "assessment_attempt" &&
        evidence.supportLevel === "independent"),
    resultLabel: evidenceResult(evidence),
  };
}

function confidenceView(
  record: StudentSkillMastery | undefined,
  explanation: MasteryExplanation | undefined,
): MasteryConfidenceView {
  if (!record) {
    return {
      score: 0,
      level: "insufficient",
      explanation:
        "The system has not evaluated this skill because there is no evidence record.",
    };
  }

  return {
    score: record.confidence.score,
    level: CONFIDENCE_LEVEL_MAP[record.confidence.level],
    explanation:
      explanation?.confidenceSummary ??
      (record.confidence.factors.length > 0
        ? record.confidence.factors
            .map((factor) => factor.explanation)
            .join(" ")
        : "Confidence is based on the quality, independence, consistency, and recency of evidence."),
  };
}

function stateReasons(
  record: StudentSkillMastery | undefined,
  explanation: MasteryExplanation | undefined,
): readonly string[] {
  if (explanation) return [explanation.whyThisState];
  if (!record || record.reasonCodes.length === 0) {
    return ["No performance evidence has been collected yet."];
  }
  return record.reasonCodes.map((reason) => REASON_LABELS[reason]);
}

function nextStep(
  record: StudentSkillMastery | undefined,
  explanation: MasteryExplanation | undefined,
): string {
  const action = explanation?.nextAction ?? record?.nextAction;
  if (!action) return "Collect an initial independent demonstration.";
  return `${action.label} ${action.rationale}`.trim();
}

function auditHistory(
  record: StudentSkillMastery | undefined,
): readonly MasteryOverrideAuditView[] {
  if (!record) return [];

  return [...record.overrideAuditHistory]
    .sort(
      (left, right) =>
        new Date(right.at).getTime() - new Date(left.at).getTime(),
    )
    .map((entry) => ({
      auditEntryId: entry.id,
      overrideId: entry.overrideId,
      changedAt: entry.at,
      actorLabel: entry.actor.actorId,
      actorRole: entry.actor.role,
      previousState: entry.fromState,
      overrideState: entry.toState,
      reason: entry.reason,
      status:
        entry.action === "revoked" || entry.action === "expired"
          ? "revoked"
          : record.override?.id === entry.overrideId
            ? "active"
            : "superseded",
    }));
}

function graphLevels(graph: SkillGraph): ReadonlyMap<SkillId, number> {
  const prerequisites = new Map<SkillId, SkillId[]>();
  const levels = new Map<SkillId, number>();
  const active = new Set<SkillId>();

  for (const skill of graph.skills) prerequisites.set(skill.id, []);
  for (const edge of graph.prerequisites) {
    prerequisites
      .get(edge.dependentSkillId)
      ?.push(edge.prerequisiteSkillId);
  }

  const visit = (skillId: SkillId): number => {
    const existing = levels.get(skillId);
    if (existing !== undefined) return existing;
    if (active.has(skillId)) {
      throw new TypeError(
        `Cannot project circular prerequisite graph at skill "${skillId}".`,
      );
    }

    active.add(skillId);
    const incoming = prerequisites.get(skillId) ?? [];
    const level =
      incoming.length === 0
        ? 0
        : Math.max(...incoming.map((prerequisiteId) => visit(prerequisiteId))) +
          1;
    active.delete(skillId);
    levels.set(skillId, level);
    return level;
  };

  for (const skill of graph.skills) visit(skill.id);
  return levels;
}

/**
 * Projects validated mastery-domain records into a display model. This
 * function performs no mastery inference; absent records remain not assessed.
 */
export function buildMasteryDashboardModel({
  learner,
  generatedAt,
  graphs,
  masteryRecords,
  explanations = [],
  subjectLabels = {},
}: BuildMasteryDashboardModelInput): MasteryDashboardModel {
  const recordBySkillId = new Map<SkillId, StudentSkillMastery>();
  for (const record of masteryRecords) {
    if (record.studentId !== learner.studentId) {
      throw new TypeError(
        `Cannot project mastery record for a different student at skill "${record.skillId}".`,
      );
    }
    if (recordBySkillId.has(record.skillId)) {
      throw new TypeError(
        `Cannot project duplicate mastery record for skill "${record.skillId}".`,
      );
    }
    recordBySkillId.set(record.skillId, record);
  }
  const explanationBySkillId = new Map<SkillId, MasteryExplanation>();
  for (const explanation of explanations) {
    if (explanationBySkillId.has(explanation.skillId)) {
      throw new TypeError(
        `Cannot project duplicate mastery explanation for skill "${explanation.skillId}".`,
      );
    }
    explanationBySkillId.set(explanation.skillId, explanation);
  }
  const skills: MasterySkillView[] = [];
  const seenSkillIds = new Set<SkillId>();

  for (const graph of graphs) {
    const definitionById = new Map(
      graph.skills.map((definition) => [definition.id, definition] as const),
    );
    const levels = graphLevels(graph);

    for (const definition of graph.skills) {
      if (seenSkillIds.has(definition.id)) {
        throw new TypeError(
          `Cannot project duplicate mastery skill ID "${definition.id}".`,
        );
      }
      seenSkillIds.add(definition.id);
      const record = recordBySkillId.get(definition.id);
      const explanation = explanationBySkillId.get(definition.id);
      const explanationEvidenceById = new Map(
        explanation?.evidence.map(
          (item) => [item.evidenceId, item] as const,
        ) ?? [],
      );
      const incomingEdges = graph.prerequisites.filter(
        (edge) => edge.dependentSkillId === definition.id,
      );
      const outgoingEdges = graph.prerequisites.filter(
        (edge) => edge.prerequisiteSkillId === definition.id,
      );

      const prerequisites = incomingEdges.map((edge) => {
        const prerequisite = definitionById.get(edge.prerequisiteSkillId);
        const status = record?.prerequisiteStatus.find(
          (item) => item.skillId === edge.prerequisiteSkillId,
        );
        const prerequisiteRecord = recordBySkillId.get(
          edge.prerequisiteSkillId,
        );
        const state: MasteryState =
          status?.state === "missing_record" || status?.state === undefined
            ? (prerequisiteRecord?.state ?? "not_yet_assessed")
            : status.state;

        return {
          skillId: edge.prerequisiteSkillId,
          title: prerequisite?.title ?? String(edge.prerequisiteSkillId),
          state,
          isBlocking:
            status?.satisfied === false ||
            (status === undefined && state !== "mastered"),
        };
      });

      skills.push({
        skillId: definition.id,
        title: definition.title,
        description: definition.learningObjective,
        parentDescription: definition.description,
        subject:
          subjectLabels[definition.subjectId] ??
          subjectLabels[graph.subjectId] ??
          graph.title,
        gradeBand: gradeBandLabel(definition.gradeBand),
        state: record?.state ?? "not_yet_assessed",
        graphLevel: levels.get(definition.id) ?? 0,
        prerequisites,
        unlocks: outgoingEdges.map((edge) => ({
          skillId: edge.dependentSkillId,
          title:
            definitionById.get(edge.dependentSkillId)?.title ??
            String(edge.dependentSkillId),
        })),
        evidence:
          record?.evidence.map((item) =>
            projectEvidence(item, explanationEvidenceById.get(item.id)),
          ) ?? [],
        confidence: confidenceView(record, explanation),
        explanation: stateReasons(record, explanation),
        nextStep: nextStep(record, explanation),
        lastIndependentDemonstrationAt:
          record?.lastIndependentDemonstrationAt,
        overrideAudit: auditHistory(record),
      });
    }
  }

  return {
    learner: {
      studentId: learner.studentId,
      displayName: learner.displayName,
      gradeBand: learner.gradeBand,
      generatedAt,
    },
    skills,
  };
}
