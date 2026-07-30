import {
  STUDY_TASK_TYPES,
  type BridgeInstructionDisposition,
  type StudyGradeBand,
  type StudyTaskType,
  type TutorPhase,
  type TutorSubject,
} from "./contracts.ts";
import { isTutorStableId } from "./validation.ts";

const STUDY_OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

export interface GovernedIdMapping {
  readonly studyId: string;
  readonly tutorId: string;
}

export interface GovernedIdRegistry {
  readonly mappings: readonly GovernedIdMapping[];
  toTutor(studyId: string): MappingResult<string>;
  toStudy(tutorId: string): MappingResult<string>;
}

export type MappingResult<T> =
  | { readonly status: "mapped"; readonly value: T }
  | {
      readonly status: "unsupported";
      readonly reasonCode:
        | "invalid-study-id"
        | "invalid-tutor-id"
        | "unmapped-study-id"
        | "unmapped-tutor-id"
        | "unsupported-grade-level"
        | "study-only-task";
    };

export function createGovernedIdRegistry(
  mappings: readonly GovernedIdMapping[],
): GovernedIdRegistry {
  const studyIds = new Set<string>();
  const tutorIds = new Set<string>();
  for (const mapping of mappings) {
    if (!STUDY_OPAQUE_ID.test(mapping.studyId)) {
      throw new Error("Governed mapping contains an invalid Study ID.");
    }
    if (!isTutorStableId(mapping.tutorId)) {
      throw new Error("Governed mapping contains an invalid Tutor Core ID.");
    }
    if (studyIds.has(mapping.studyId) || tutorIds.has(mapping.tutorId)) {
      throw new Error("Governed mappings must be one-to-one.");
    }
    studyIds.add(mapping.studyId);
    tutorIds.add(mapping.tutorId);
  }
  const byStudy = new Map(mappings.map((item) => [item.studyId, item.tutorId]));
  const byTutor = new Map(mappings.map((item) => [item.tutorId, item.studyId]));
  return {
    mappings: [...mappings],
    toTutor(studyId) {
      if (!STUDY_OPAQUE_ID.test(studyId)) {
        return { status: "unsupported", reasonCode: "invalid-study-id" };
      }
      const value = byStudy.get(studyId);
      return value === undefined
        ? { status: "unsupported", reasonCode: "unmapped-study-id" }
        : { status: "mapped", value };
    },
    toStudy(tutorId) {
      if (!isTutorStableId(tutorId)) {
        return { status: "unsupported", reasonCode: "invalid-tutor-id" };
      }
      const value = byTutor.get(tutorId);
      return value === undefined
        ? { status: "unsupported", reasonCode: "unmapped-tutor-id" }
        : { status: "mapped", value };
    },
  };
}

export const SUBJECT_MAPPINGS: readonly {
  readonly studyId: string;
  readonly tutorSubject: TutorSubject;
}[] = [
  { studyId: "math", tutorSubject: "math" },
  { studyId: "english", tutorSubject: "english" },
  { studyId: "english-language-arts", tutorSubject: "english" },
  { studyId: "science", tutorSubject: "science" },
  { studyId: "social-studies", tutorSubject: "social-studies" },
  { studyId: "general", tutorSubject: "general" },
];

export function mapStudySubjectToTutor(
  subjectId: string,
): MappingResult<TutorSubject> {
  if (!STUDY_OPAQUE_ID.test(subjectId)) {
    return { status: "unsupported", reasonCode: "invalid-study-id" };
  }
  const mapping = SUBJECT_MAPPINGS.find((item) => item.studyId === subjectId);
  return mapping
    ? { status: "mapped", value: mapping.tutorSubject }
    : { status: "unsupported", reasonCode: "unmapped-study-id" };
}

export interface TutorGradeBand {
  readonly min: number;
  readonly max: number;
  readonly label: string;
}

const STUDY_TO_TUTOR_GRADE: Readonly<Record<StudyGradeBand, TutorGradeBand>> = {
  "elementary-3-5": { min: 3, max: 5, label: "Grades 3-5" },
  "middle-6-8": { min: 6, max: 8, label: "Grades 6-8" },
  "high-9-12": { min: 9, max: 12, label: "Grades 9-12" },
};

export function mapStudyGradeBandToTutor(
  gradeBand: StudyGradeBand,
): TutorGradeBand {
  const mapped = STUDY_TO_TUTOR_GRADE[gradeBand];
  return { ...mapped };
}

export function mapTutorGradeLevelToStudy(
  gradeLevel: number,
): MappingResult<StudyGradeBand> {
  if (!Number.isInteger(gradeLevel) || gradeLevel < 3 || gradeLevel > 12) {
    return { status: "unsupported", reasonCode: "unsupported-grade-level" };
  }
  if (gradeLevel <= 5) return { status: "mapped", value: "elementary-3-5" };
  if (gradeLevel <= 8) return { status: "mapped", value: "middle-6-8" };
  return { status: "mapped", value: "high-9-12" };
}

export interface TutorInteractionRequest {
  readonly requestedPhase: TutorPhase;
  readonly advisoryOnly: true;
  readonly instructionalAuthority: "tutor-core";
  readonly mappingReasonCode: string;
}

const TASK_PHASES: Partial<
  Readonly<Record<StudyTaskType, TutorInteractionRequest>>
> = {
  "direct-instruction": {
    requestedPhase: "teach-visually",
    advisoryOnly: true,
    instructionalAuthority: "tutor-core",
    mappingReasonCode: "study-task-direct-instruction",
  },
  "worked-example": {
    requestedPhase: "teach-visually",
    advisoryOnly: true,
    instructionalAuthority: "tutor-core",
    mappingReasonCode: "study-task-worked-example",
  },
  "guided-practice": {
    requestedPhase: "guided-practice",
    advisoryOnly: true,
    instructionalAuthority: "tutor-core",
    mappingReasonCode: "study-task-guided-practice",
  },
  "independent-practice": {
    requestedPhase: "independent-attempt",
    advisoryOnly: true,
    instructionalAuthority: "tutor-core",
    mappingReasonCode: "study-task-independent-practice",
  },
  "retrieval-practice": {
    requestedPhase: "reassess",
    advisoryOnly: true,
    instructionalAuthority: "tutor-core",
    mappingReasonCode: "study-task-retrieval-practice",
  },
  "mastery-check": {
    requestedPhase: "independent-attempt",
    advisoryOnly: true,
    instructionalAuthority: "tutor-core",
    mappingReasonCode: "study-task-mastery-check",
  },
  "prerequisite-remediation": {
    requestedPhase: "reteach",
    advisoryOnly: true,
    instructionalAuthority: "tutor-core",
    mappingReasonCode: "study-task-prerequisite-remediation",
  },
};

export function mapStudyTaskToTutorPhase(
  taskType: StudyTaskType,
): MappingResult<TutorInteractionRequest> {
  if (!(STUDY_TASK_TYPES as readonly string[]).includes(taskType)) {
    return { status: "unsupported", reasonCode: "study-only-task" };
  }
  const mapped = TASK_PHASES[taskType];
  return mapped
    ? { status: "mapped", value: mapped }
    : { status: "unsupported", reasonCode: "study-only-task" };
}

export interface StudySegmentForTutor {
  readonly segmentId: string;
  readonly sequence: number;
  readonly taskType: StudyTaskType;
  readonly skillIds: readonly string[];
}

export interface TutorCycleRequest {
  readonly segmentId: string;
  readonly sequence: number;
  readonly skillIds: readonly string[];
  readonly interaction: TutorInteractionRequest;
  readonly completionRemainsStudyOwned: true;
  readonly masteryRemainsTutorOwned: true;
}

export function mapStudySegmentToTutorCycle(
  segment: StudySegmentForTutor,
): MappingResult<TutorCycleRequest> {
  if (
    !STUDY_OPAQUE_ID.test(segment.segmentId) ||
    !Number.isInteger(segment.sequence) ||
    segment.sequence < 1 ||
    !Array.isArray(segment.skillIds) ||
    segment.skillIds.some((id) => !STUDY_OPAQUE_ID.test(id))
  ) {
    return { status: "unsupported", reasonCode: "invalid-study-id" };
  }
  const interaction = mapStudyTaskToTutorPhase(segment.taskType);
  if (interaction.status !== "mapped") return interaction;
  return {
    status: "mapped",
    value: {
      segmentId: segment.segmentId,
      sequence: segment.sequence,
      skillIds: [...segment.skillIds],
      interaction: interaction.value,
      completionRemainsStudyOwned: true,
      masteryRemainsTutorOwned: true,
    },
  };
}

/**
 * Canonical replacement for Session 2's nonexistent `correct | reteach`
 * directive. Only a verified Tutor Core phase is considered.
 */
export function mapTutorPhaseToBridgeDisposition(
  phase: TutorPhase,
): BridgeInstructionDisposition {
  if (phase === "advance") return "advance";
  if (phase === "reteach") return "reteach";
  if (phase === "escalated") return "adult-review";
  return "continue-core-cycle";
}

export type RetiringSession2DirectiveResult =
  | {
      readonly status: "mapped";
      readonly directive: "correct" | "reteach";
      readonly canonicalReplacement: "advance" | "reteach";
      readonly sourceAuthority: "tutor-core";
      readonly retirementRequired: true;
    }
  | {
      readonly status: "unsupported";
      readonly reasonCode: "tutor-phase-not-final";
      readonly retirementRequired: true;
    };

export function mapTutorPhaseToRetiringSession2Directive(
  phase: TutorPhase,
): RetiringSession2DirectiveResult {
  if (phase === "advance") {
    return {
      status: "mapped",
      directive: "correct",
      canonicalReplacement: "advance",
      sourceAuthority: "tutor-core",
      retirementRequired: true,
    };
  }
  if (phase === "reteach") {
    return {
      status: "mapped",
      directive: "reteach",
      canonicalReplacement: "reteach",
      sourceAuthority: "tutor-core",
      retirementRequired: true,
    };
  }
  return {
    status: "unsupported",
    reasonCode: "tutor-phase-not-final",
    retirementRequired: true,
  };
}
