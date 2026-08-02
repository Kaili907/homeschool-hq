import {
  STUDY_ENGINE_SCHEMA_VERSION,
  asBrandedId,
  type AccommodationId,
  type ControlSetId,
  type FocusProfileId,
  type LessonId,
  type LessonSegment,
  type LessonStudyPlan,
  type ParentTeacherControls,
  type SegmentId,
  type SessionId,
  type SkillId,
  type StudentFocusProfile,
  type StudentId,
  type StudyPlanId,
  type SubjectId as CanonicalSubjectId,
  type TimerPresentationPreference,
} from "@study-contracts";
import { SESSION_DEFINITIONS, type LearningSegmentId } from "@study-content";
import {
  PARENT_PREFERENCE_INPUT_VERSION,
  type CanonicalUiSegmentId,
  type ParentPreferenceInputV1,
  type RuntimeSubjectId,
} from "./runtimeTypes";

const CONTRACT_CREATED_AT = "2026-07-28T12:00:00.000Z";

/*
 * DEC-002: these are fixed, caller-authored opaque lookup values. Display
 * subject, grade, title, date, and sequence data never participate in an ID.
 */
export const LEARNER_REFERENCE = asBrandedId<StudentId>(
  "lrn_01K1A4G7M2P9R6V3X8C5T0NQHD",
);
export const CONTROL_SET_ID = asBrandedId<ControlSetId>(
  "ctl_01K1B7N4Q9V2M6R8T3X5C0HPWA",
);
export const FOCUS_PROFILE_ID = asBrandedId<FocusProfileId>(
  "foc_01K1C9R5M3V7Q2T8X4N6H0PWAB",
);
export const ADULT_REFERENCE = "act_01K1D6T2V8M4Q9R3X7N5C0HPWA";
export const TIMING_OVERRIDE_ID = "ovr_01K1E8V4Q2M7T9R5X3N6C0HPWA";
export const TIMING_ACCOMMODATION_ID = asBrandedId<AccommodationId>(
  "acc_01K1F3M9V5Q2T7R8X4N6C0HPWA",
);
export const LEARNER_TIME_ZONE = "America/New_York";

export const UI_SEGMENT_SEQUENCE: readonly LearningSegmentId[] = [
  "warm-up",
  "visual-lesson",
  "guided-practice",
  "independent-attempt",
  "self-check",
  "exit-ticket",
];

export const CANONICAL_SEGMENT_SEQUENCE: readonly CanonicalUiSegmentId[] = [
  "check-in",
  ...UI_SEGMENT_SEQUENCE,
];

const SUBJECT_KEYS: Readonly<
  Record<
    RuntimeSubjectId,
    {
      readonly subjectId: CanonicalSubjectId;
      readonly lessonId: LessonId;
      readonly planId: StudyPlanId;
      readonly skillId: SkillId;
    }
  >
> = {
  math: {
    subjectId: asBrandedId<CanonicalSubjectId>("sub_01K1G5Q9M3V7T2R8X4N6C0HPWA"),
    lessonId: asBrandedId<LessonId>("lsn_01K1H7V3Q9M5T2R8X4N6C0HPWA"),
    planId: asBrandedId<StudyPlanId>("pln_01K1J2M8V4Q7T9R5X3N6C0HPWA"),
    skillId: asBrandedId<SkillId>("skl_01K1K4Q9M2V7T5R8X3N6C0HPWA"),
  },
  reading: {
    subjectId: asBrandedId<CanonicalSubjectId>("sub_01K1M6V2Q8T4R9X5N3C7H0PWAB"),
    lessonId: asBrandedId<LessonId>("lsn_01K1N8Q4M2V7T9R5X3C6H0PWAB"),
    planId: asBrandedId<StudyPlanId>("pln_01K1P3M9V5Q2T7R8X4C6H0PWAB"),
    skillId: asBrandedId<SkillId>("skl_01K1Q5V2M8T4R9X3N7C6H0PWAB"),
  },
};

const SEGMENT_IDS: Readonly<
  Record<RuntimeSubjectId, Readonly<Record<CanonicalUiSegmentId, SegmentId>>>
> = {
  math: {
    "check-in": asBrandedId<SegmentId>("seg_01K1R7M3V9Q5T2X8N4C6H0PWAB"),
    "warm-up": asBrandedId<SegmentId>("seg_01K1S2V8Q4M7T9X5N3C6H0PWAB"),
    "visual-lesson": asBrandedId<SegmentId>("seg_01K1T4M9V2Q7R5X8N3C6H0PWAB"),
    "guided-practice": asBrandedId<SegmentId>("seg_01K1V6Q2M8T4R9X5N3C7H0PWAB"),
    "independent-attempt": asBrandedId<SegmentId>("seg_01K1W8M4V2Q7T9X5N3C6H0PWAB"),
    "self-check": asBrandedId<SegmentId>("seg_01K1X3V9Q5M2T7R8N4C6H0PWAB"),
    "exit-ticket": asBrandedId<SegmentId>("seg_01K1Y5M2V8Q4T9R3N7C6H0PWAB"),
  },
  reading: {
    "check-in": asBrandedId<SegmentId>("seg_01K1Z7Q3M9V5T2R8N4C6H0PWAB"),
    "warm-up": asBrandedId<SegmentId>("seg_01K204V8Q2M7T9R5N3C6H0PWAB"),
    "visual-lesson": asBrandedId<SegmentId>("seg_01K216M2V8Q4T9R5N3C7H0PWAB"),
    "guided-practice": asBrandedId<SegmentId>("seg_01K228Q4M9V2T7R5N3C6H0PWAB"),
    "independent-attempt": asBrandedId<SegmentId>("seg_01K233M9V5Q2T7R8N4C6H0PWAB"),
    "self-check": asBrandedId<SegmentId>("seg_01K245V2Q8M4T9R3N7C6H0PWAB"),
    "exit-ticket": asBrandedId<SegmentId>("seg_01K257M3V9Q5T2R8N4C6H0PWAB"),
  },
};

const OBJECTIVE_IDS: Readonly<
  Record<RuntimeSubjectId, Readonly<Record<CanonicalUiSegmentId, string>>>
> = {
  math: {
    "check-in": "obj_01K269Q4M2V7T9R5X3N6C0HPWA",
    "warm-up": "obj_01K27BM9V5Q2T7R8X4N6C0HPWA",
    "visual-lesson": "obj_01K28DV3Q9M5T2R8X4N6C0HPWA",
    "guided-practice": "obj_01K29FM2V8Q4T9R5X3N6C0HPWA",
    "independent-attempt": "obj_01K2AHQ8M4V2T7R9X5N3C0PWAB",
    "self-check": "obj_01K2BKM3V9Q5T2R8X4N6C0HPWA",
    "exit-ticket": "obj_01K2CMV7Q3M9T5R2X8N4C0HPWA",
  },
  reading: {
    "check-in": "obj_01K2DNQ4M8V2T7R9X5C3H0PWAB",
    "warm-up": "obj_01K2EPR9V5Q2T7M8X4C6H0PWAB",
    "visual-lesson": "obj_01K2FRT3M9V5Q2T8X4C6H0PWAB",
    "guided-practice": "obj_01K2GTV8Q4M2R9X5N3C7H0PWAB",
    "independent-attempt": "obj_01K2HVW2M8Q4T9R5N3C7H0PWAB",
    "self-check": "obj_01K2JXY9V5Q2T7R8N4C6H0PWAB",
    "exit-ticket": "obj_01K2KZ23M9V5Q7T8N4C6H0PWAB",
  },
};

const DETERMINISTIC_DEMO_SESSION_IDS: Readonly<
  Record<RuntimeSubjectId, SessionId>
> = {
  math: asBrandedId<SessionId>("ses_01K2M4Q9V2T7R5X8N3C6H0PWAB"),
  reading: asBrandedId<SessionId>("ses_01K2N6V3Q9M5T2R8X4C7H0PWAB"),
};

export function idsFor(subjectId: RuntimeSubjectId) {
  return SUBJECT_KEYS[subjectId];
}

/** Deterministic fixture default; production callers should inject a SessionId. */
export function demoSessionIdFor(subjectId: RuntimeSubjectId): SessionId {
  return DETERMINISTIC_DEMO_SESSION_IDS[subjectId];
}

/**
 * Creates a caller-owned opaque session identity for interactive local runs.
 * Deterministic tests should inject demoSessionIdFor(subjectId) instead.
 */
export function createLocalSessionId(): SessionId {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return asBrandedId<SessionId>(`ses_${cryptoApi.randomUUID()}`);
  }
  if (typeof cryptoApi?.getRandomValues === "function") {
    const words = cryptoApi.getRandomValues(new Uint32Array(4));
    return asBrandedId<SessionId>(
      `ses_${Array.from(words, (word) => word.toString(16).padStart(8, "0")).join("")}`,
    );
  }
  const fallback = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 0x1_0000_0000)
      .toString(16)
      .padStart(8, "0"),
  ).join("");
  return asBrandedId<SessionId>(`ses_${fallback}`);
}

export function canonicalSegmentId(
  subjectId: RuntimeSubjectId,
  segment: CanonicalUiSegmentId,
): SegmentId {
  return SEGMENT_IDS[subjectId][segment];
}

export function defaultParentPreferences(): ParentPreferenceInputV1 {
  return {
    schemaVersion: PARENT_PREFERENCE_INPUT_VERSION,
    timerMode: "visible",
    maximumDurationMinutes: 20,
    breakRange: {
      minimumMinutes: 2,
      defaultMinutes: 3,
      maximumMinutes: 8,
    },
    requiredBreaks: false,
    reducedMotion: false,
    noAudio: false,
    largeText: false,
    readAloud: true,
    speechInput: true,
  };
}

function timerPresentation(
  mode: ParentPreferenceInputV1["timerMode"],
): TimerPresentationPreference {
  if (mode === "hidden") return "hidden";
  if (mode === "minimal") return "progress-bar";
  return "count-down";
}

function responseModeFor(segment: CanonicalUiSegmentId, subjectId: RuntimeSubjectId) {
  if (segment === "check-in" || segment === "self-check") {
    return ["selected-answer"] as const;
  }
  const definition = SESSION_DEFINITIONS[subjectId].segments[segment];
  return definition.responseKind === "choice"
    ? (["selected-answer"] as const)
    : (["typed-answer", "spoken-answer"] as const);
}

function taskTypeFor(segment: CanonicalUiSegmentId) {
  switch (segment) {
    case "check-in":
    case "self-check":
      return "reflection" as const;
    case "warm-up":
      return "retrieval-practice" as const;
    case "visual-lesson":
      return "direct-instruction" as const;
    case "guided-practice":
      return "guided-practice" as const;
    case "independent-attempt":
      return "independent-practice" as const;
    case "exit-ticket":
      return "mastery-check" as const;
  }
}

function minutesFor(segment: CanonicalUiSegmentId) {
  switch (segment) {
    case "check-in":
    case "self-check":
      return { minimumMinutes: 1, plannedMinutes: 1, maximumMinutes: 3 };
    case "warm-up":
      return { minimumMinutes: 1, plannedMinutes: 2, maximumMinutes: 4 };
    case "visual-lesson":
    case "guided-practice":
      return { minimumMinutes: 1, plannedMinutes: 3, maximumMinutes: 6 };
    case "independent-attempt":
      return { minimumMinutes: 2, plannedMinutes: 4, maximumMinutes: 8 };
    case "exit-ticket":
      return { minimumMinutes: 1, plannedMinutes: 2, maximumMinutes: 4 };
  }
}

function buildSegment(
  subjectId: RuntimeSubjectId,
  segment: CanonicalUiSegmentId,
  sequence: number,
): LessonSegment {
  const ids = idsFor(subjectId);
  const previous = CANONICAL_SEGMENT_SEQUENCE[sequence - 2];
  const definition =
    segment === "check-in" ? undefined : SESSION_DEFINITIONS[subjectId].segments[segment];
  const title = definition?.title ?? "Check in before learning";
  const taskType = taskTypeFor(segment);
  const masteryRequired = segment === "exit-ticket";
  return {
    id: canonicalSegmentId(subjectId, segment),
    sequence,
    title,
    taskType,
    learningObjectiveIds: [OBJECTIVE_IDS[subjectId][segment]],
    timing: minutesFor(segment),
    cognitiveLoad: {
      overallLevel: segment === "independent-attempt" ? "moderate" : "low",
      novelty: segment === "visual-lesson" ? "moderate" : "low",
      workingMemoryDemand:
        segment === "guided-practice" || segment === "independent-attempt"
          ? "moderate"
          : "low",
      interactionDemand: "low",
      supportLevel: segment === "guided-practice" ? "high" : "moderate",
      supportStrategies: ["visual-model", "learner-choice", "supportive-prompt"],
    },
    activeResponse: {
      required: segment !== "visual-lesson",
      modes: responseModeFor(segment, subjectId),
      minimumResponseCount: segment === "visual-lesson" ? 0 : 1,
      maximumPassiveMinutes: segment === "visual-lesson" ? 3 : 1,
    },
    breakEligibility: {
      eligible: true,
      studentMayRequest: true,
      approvalRequired: false,
      availableAfterActiveMinutes: 1,
      recommendedBreakMinutes: 3,
    },
    masteryCheck: {
      required: masteryRequired,
      skillIds: masteryRequired ? [ids.skillId] : [],
      learningObjectiveIds: masteryRequired
        ? [OBJECTIVE_IDS[subjectId]["exit-ticket"]]
        : [],
      minimumItemCount: masteryRequired ? 1 : 0,
      ...(masteryRequired
        ? {
            criterion: {
              minimumAccuracyPercent: 70,
              minimumIndependentResponses: 1,
              maximumHintCount: 2,
            },
          }
        : {}),
    },
    prerequisiteRefs: [],
    dependsOnSegmentIds: previous ? [canonicalSegmentId(subjectId, previous)] : [],
  };
}

export function buildLessonPlan(subjectId: RuntimeSubjectId): LessonStudyPlan {
  const ids = idsFor(subjectId);
  const segments = CANONICAL_SEGMENT_SEQUENCE.map((segment, index) =>
    buildSegment(subjectId, segment, index + 1),
  );
  return {
    kind: "lesson-study-plan",
    schemaVersion: STUDY_ENGINE_SCHEMA_VERSION,
    id: ids.planId,
    revision: 1,
    createdAt: CONTRACT_CREATED_AT,
    updatedAt: CONTRACT_CREATED_AT,
    metadata: {
      source: "manual",
      tags: ["student-runtime", "grade-5", subjectId],
      extensions: {
        "manuel:runtime-catalog-version": "student-runtime.catalog.v1",
        "manuel:task-id-strategy": "stable-task-id-per-canonical-segment",
      },
    },
    studentId: LEARNER_REFERENCE,
    lessonId: ids.lessonId,
    subjectId: ids.subjectId,
    gradeBand: "elementary-3-5",
    gradeBandStartingRanges: [
      {
        gradeBand: "elementary-3-5",
        basis: "grade-band-starting-range",
        effectiveWorkBlockRange: {
          minimumMinutes: 8,
          targetMinutes: 15,
          maximumMinutes: 20,
        },
        reviewAfterEligibleSessions: 5,
      },
    ],
    subjectTimingProfiles: [
      {
        subjectId: ids.subjectId,
        effectiveWorkBlockRange: {
          minimumMinutes: 8,
          targetMinutes: subjectId === "math" ? 15 : 14,
          maximumMinutes: 20,
        },
        rationale: "Grade-band starting range for the local integration demonstration.",
      },
    ],
    taskTimingProfiles: [],
    prerequisiteRefs: [],
    segments,
    segmentSequence: segments.map((segment) => segment.id),
    focusProfileRef: { id: FOCUS_PROFILE_ID, revision: 1 },
    controlsRef: { id: CONTROL_SET_ID, revision: 1 },
  };
}

export function buildControls(
  preferences: ParentPreferenceInputV1,
  at: string,
): ParentTeacherControls {
  const manualOverrides =
    preferences.parentManualOverrideMinutes === undefined
      ? []
      : [
          {
            id: TIMING_OVERRIDE_ID,
            target: "work-duration" as const,
            setBy: { role: "parent" as const, actorId: ADULT_REFERENCE },
            reason: "Local integration-lab manual duration preference.",
            createdAt: at,
            maximumWorkDurationMinutes: Math.min(
              preferences.parentManualOverrideMinutes,
              preferences.maximumDurationMinutes,
            ),
          },
        ];
  const accommodations =
    preferences.accommodationMaximumMinutes === undefined
      ? []
      : [
          {
            id: TIMING_ACCOMMODATION_ID,
            enabled: true,
            functionalDescription: `Use a work-block maximum of ${preferences.accommodationMaximumMinutes} minutes.`,
            source: "school-plan" as const,
          },
        ];
  return {
    kind: "parent-teacher-controls",
    schemaVersion: STUDY_ENGINE_SCHEMA_VERSION,
    id: CONTROL_SET_ID,
    revision: 1,
    createdAt: CONTRACT_CREATED_AT,
    updatedAt: at,
    metadata: {
      source: "manual",
      tags: ["student-runtime", "mock-controls"],
      extensions: {
        "manuel:required-breaks": preferences.requiredBreaks,
        "manuel:card5-precedence-status": "provisional-awaiting-card5",
      },
    },
    studentId: LEARNER_REFERENCE,
    maximumWorkDurationMinutes: preferences.maximumDurationMinutes,
    breakDuration: preferences.breakRange,
    timerVisibility: timerPresentation(preferences.timerMode),
    manualOverrides,
    recommendationDecisions: [],
    accommodations,
    rescheduling: [],
    reviewRequests: [],
    approvedInterruptionCategories: [
      "accessibility-need",
      "technology-issue",
      "wellbeing",
      "parent-directed",
    ],
  };
}

export function buildFocusProfile(
  preferences: ParentPreferenceInputV1,
  at: string,
): StudentFocusProfile {
  const accommodationMaximum =
    preferences.accommodationMaximumMinutes ?? preferences.maximumDurationMinutes;
  return {
    kind: "student-focus-profile",
    schemaVersion: STUDY_ENGINE_SCHEMA_VERSION,
    id: FOCUS_PROFILE_ID,
    revision: 1,
    createdAt: CONTRACT_CREATED_AT,
    updatedAt: at,
    metadata: {
      source: "manual",
      tags: ["student-runtime", "mock-focus-profile"],
    },
    studentId: LEARNER_REFERENCE,
    gradeBand: "elementary-3-5",
    estimate: {
      status: "insufficient-data",
      eligibleObservationCount: 0,
      minimumObservationCount: 5,
      gradeBandStartingRange: {
        minimumMinutes: 8,
        targetMinutes: 15,
        maximumMinutes: 20,
      },
      reason: "new-profile",
    },
    breakDurationMinutes: preferences.breakRange.defaultMinutes,
    timerPresentationPreference: timerPresentation(preferences.timerMode),
    taskSpecificProfiles: [],
    subjectSpecificProfiles: [],
    accessibility: {
      textScalePercent: preferences.largeText ? 130 : 100,
      reducedMotion: preferences.reducedMotion,
      highContrast: true,
      narration: preferences.noAudio
        ? "off"
        : preferences.readAloud
          ? "preferred"
          : "available",
      captions: true,
      inputModes: [
        "keyboard",
        "touch",
        ...(preferences.speechInput ? (["speech"] as const) : []),
      ],
      lowDistractionPresentation: true,
    },
    accommodations:
      preferences.accommodationMaximumMinutes === undefined
        ? []
        : [
            {
              id: TIMING_ACCOMMODATION_ID,
              category: "timing",
              enabled: true,
              functionalDescription: `Use a work-block maximum of ${accommodationMaximum} minutes.`,
              approvedBy: "school-plan",
            },
          ],
    adjustmentHistory: [],
    parentOverride: {
      active: true,
      maximumWorkDurationMinutes: preferences.maximumDurationMinutes,
      ...(preferences.parentManualOverrideMinutes !== undefined
        ? { targetWorkDurationMinutes: preferences.parentManualOverrideMinutes }
        : {}),
      breakDurationMinutes: preferences.breakRange.defaultMinutes,
      setBy: { role: "parent", actorId: ADULT_REFERENCE },
      reason: "Local integration-lab mock settings.",
      createdAt: at,
      reviewAt: "2026-08-28T12:00:00.000Z",
    },
    contextSkillIds: [],
  };
}
