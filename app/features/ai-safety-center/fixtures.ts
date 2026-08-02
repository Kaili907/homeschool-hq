import type {
  SafetyCenterData,
  SafetyCenterStudentScope,
  SafetyCenterViewer,
} from "./contracts";

export const DEMO_STUDENT_REF = "student:demo-maya";

export const demoStudent: SafetyCenterStudentScope = {
  studentRef: DEMO_STUDENT_REF,
  displayName: "Maya",
  gradeLabel: "Grade 7",
};

export const demoParentViewer: SafetyCenterViewer = {
  actorRef: "actor:demo-parent",
  role: "parent",
  identityAssurance: "verified",
  authorizedStudentRefs: [DEMO_STUDENT_REF],
};

export const demoStudentViewer: SafetyCenterViewer = {
  actorRef: "actor:demo-student",
  role: "student",
  identityAssurance: "verified",
  studentRef: DEMO_STUDENT_REF,
  authorizedStudentRefs: [],
};

export const demoSafetyCenterData: SafetyCenterData = {
  schemaVersion: "ai-safety-center.ui.v1",
  studentRef: DEMO_STUDENT_REF,
  generatedAt: "2026-07-28T14:30:00-04:00",
  instructionalHistory: {
    status: "ready",
    items: [
      {
        studentRef: DEMO_STUDENT_REF,
        sessionRef: "session:math-fractions-042",
        subjectRef: "subject:math",
        subjectLabel: "Math",
        topicLabel: "Equivalent fractions",
        startedAt: "2026-07-28T09:12:00-04:00",
        endedAt: "2026-07-28T09:24:00-04:00",
        durationMinutes: 12,
        status: "completed",
        summary:
          "Compared fractions using a common denominator and one visual hint.",
        turns: [
          {
            turnRef: "turn:math-001",
            speaker: "student",
            at: "2026-07-28T09:13:00-04:00",
            text: "Can you just tell me the final answer?",
            source: "student_text",
          },
          {
            turnRef: "turn:math-002",
            speaker: "tutor",
            at: "2026-07-28T09:13:08-04:00",
            text: "I won't give the final answer, but I can help with the next step. What denominator could both fractions use?",
            source: "scripted",
          },
          {
            turnRef: "turn:math-003",
            speaker: "student",
            at: "2026-07-28T09:14:20-04:00",
            text: "Twelve?",
            source: "student_text",
          },
          {
            turnRef: "turn:math-004",
            speaker: "tutor",
            at: "2026-07-28T09:14:25-04:00",
            text: "Yes. Now rewrite each numerator for a denominator of twelve.",
            source: "tutor",
          },
        ],
        timeline: [
          {
            timelineRef: "timeline:math-001",
            kind: "session_started",
            at: "2026-07-28T09:12:00-04:00",
            label: "Tutor session started",
          },
          {
            timelineRef: "timeline:math-002",
            kind: "answer_withheld",
            at: "2026-07-28T09:13:08-04:00",
            label: "Final answer withheld",
            detail: "The tutor offered the next-smallest learning step.",
          },
          {
            timelineRef: "timeline:math-003",
            kind: "tutor_help",
            at: "2026-07-28T09:14:25-04:00",
            label: "Common-denominator hint",
            detail: "Text hint available for on-device playback.",
          },
          {
            timelineRef: "timeline:math-004",
            kind: "session_ended",
            at: "2026-07-28T09:24:00-04:00",
            label: "Session completed",
          },
        ],
        linkedSafetyEventRefs: ["event:answer-integrity-001"],
        playback: "synthesized_from_text",
      },
      {
        studentRef: DEMO_STUDENT_REF,
        sessionRef: "session:science-ecosystems-018",
        subjectRef: "subject:science",
        subjectLabel: "Science",
        topicLabel: "Food webs and local habitats",
        startedAt: "2026-07-27T13:05:00-04:00",
        endedAt: "2026-07-27T13:19:00-04:00",
        durationMinutes: 14,
        status: "completed",
        summary:
          "Built a food-web example while keeping location details general.",
        turns: [
          {
            turnRef: "turn:science-001",
            speaker: "student",
            at: "2026-07-27T13:08:00-04:00",
            text: "Should I share exactly where I live so you can find animals near me?",
            source: "speech_transcript",
          },
          {
            turnRef: "turn:science-002",
            speaker: "tutor",
            at: "2026-07-27T13:08:06-04:00",
            text: "Please do not share your home address. A broad habitat, like coastal forest or city park, is enough for this lesson.",
            source: "scripted",
          },
          {
            turnRef: "turn:science-003",
            speaker: "student",
            at: "2026-07-27T13:08:44-04:00",
            text: "Let's use a city park.",
            source: "student_text",
          },
        ],
        timeline: [
          {
            timelineRef: "timeline:science-001",
            kind: "session_started",
            at: "2026-07-27T13:05:00-04:00",
            label: "Tutor session started",
          },
          {
            timelineRef: "timeline:science-002",
            kind: "safety_check",
            at: "2026-07-27T13:08:06-04:00",
            label: "Personal-information reminder",
            detail: "The lesson continued without collecting an address.",
          },
          {
            timelineRef: "timeline:science-003",
            kind: "session_ended",
            at: "2026-07-27T13:19:00-04:00",
            label: "Session completed",
          },
        ],
        linkedSafetyEventRefs: ["event:privacy-002"],
        playback: "synthesized_from_text",
      },
      {
        studentRef: DEMO_STUDENT_REF,
        sessionRef: "session:ela-conflict-009",
        subjectRef: "subject:ela",
        subjectLabel: "English",
        topicLabel: "Conflict in a short story",
        startedAt: "2026-07-25T10:02:00-04:00",
        endedAt: "2026-07-25T10:09:00-04:00",
        durationMinutes: 7,
        status: "paused",
        summary:
          "Session paused after language that required a trusted-adult check-in.",
        turns: [
          {
            turnRef: "turn:ela-001",
            speaker: "student",
            at: "2026-07-25T10:05:00-04:00",
            text: "I do not feel safe talking about this here.",
            source: "student_text",
          },
          {
            turnRef: "turn:ela-002",
            speaker: "tutor",
            at: "2026-07-25T10:05:02-04:00",
            text: "I'm pausing so a trusted adult can check in with you. You are not in trouble.",
            source: "scripted",
          },
        ],
        timeline: [
          {
            timelineRef: "timeline:ela-001",
            kind: "session_started",
            at: "2026-07-25T10:02:00-04:00",
            label: "Tutor session started",
          },
          {
            timelineRef: "timeline:ela-002",
            kind: "safety_check",
            at: "2026-07-25T10:05:01-04:00",
            label: "Safety language detected",
          },
          {
            timelineRef: "timeline:ela-003",
            kind: "session_paused",
            at: "2026-07-25T10:05:02-04:00",
            label: "Tutor paused",
            detail: "No additional model answer was generated.",
          },
          {
            timelineRef: "timeline:ela-004",
            kind: "parent_notified",
            at: "2026-07-25T10:05:04-04:00",
            label: "Parent notice created",
          },
          {
            timelineRef: "timeline:ela-005",
            kind: "human_review_requested",
            at: "2026-07-25T10:05:05-04:00",
            label: "Authorized human review queued",
          },
        ],
        linkedSafetyEventRefs: ["event:trusted-adult-003"],
        playback: "synthesized_from_text",
      },
    ],
  },
  safetyEvents: {
    status: "ready",
    items: [
      {
        studentRef: DEMO_STUDENT_REF,
        eventRef: "event:answer-integrity-001",
        sessionRef: "session:math-fractions-042",
        subjectRef: "subject:math",
        subjectLabel: "Math",
        occurredAt: "2026-07-28T09:13:08-04:00",
        category: "answer-integrity",
        severity: "low",
        escalation: "record-for-parent",
        status: "resolved",
        summary: "Tutor withheld a requested final answer",
        studentExplanation:
          "I did not give the final answer because my job is to help you learn the next step.",
        parentDetail:
          "A direct-answer request matched the answer-integrity rule. The tutor supplied a common-denominator hint and the lesson continued.",
        withheldReason: {
          code: "direct-answer-request",
          title: "Direct answer request",
          studentExplanation:
            "I can give you a hint or ask one small question, but I won't do the problem for you.",
          parentExplanation:
            "The student requested the final answer. The instructional policy requires guided help instead of answer disclosure.",
        },
      },
      {
        studentRef: DEMO_STUDENT_REF,
        eventRef: "event:privacy-002",
        sessionRef: "session:science-ecosystems-018",
        subjectRef: "subject:science",
        subjectLabel: "Science",
        occurredAt: "2026-07-27T13:08:06-04:00",
        category: "privacy-or-personal-data",
        severity: "moderate",
        escalation: "parent-review",
        status: "open",
        summary: "Tutor redirected a request to share a precise location",
        studentExplanation:
          "You do not need to share your address. A general place is enough for this lesson.",
        parentDetail:
          "The local privacy policy redirected the conversation before a precise address was supplied. No location was collected by this projection.",
        withheldReason: {
          code: "privacy-request",
          title: "Personal information was not needed",
          studentExplanation:
            "Keep your exact address private. We can use a general habitat instead.",
          parentExplanation:
            "The requested detail was unnecessary for the learning task, so the tutor continued using a general habitat.",
        },
      },
      {
        studentRef: DEMO_STUDENT_REF,
        eventRef: "event:trusted-adult-003",
        sessionRef: "session:ela-conflict-009",
        subjectRef: "subject:ela",
        subjectLabel: "English",
        occurredAt: "2026-07-25T10:05:01-04:00",
        category: "potential-abuse-or-unsafe-situation",
        severity: "critical",
        escalation: "human-safety-review",
        status: "reviewing",
        summary: "Tutor paused for a trusted-adult check-in",
        studentExplanation:
          "I paused so a trusted adult can check in. You are not in trouble.",
        parentDetail:
          "A local rule detected language that requires a prompt adult check-in and authorized human review. This is a precaution, not a diagnosis or claim that emergency services were contacted.",
        withheldReason: {
          code: "human-review-required",
          title: "Trusted-adult check-in required",
          studentExplanation:
            "The lesson is paused while a trusted adult checks in with you.",
          parentExplanation:
            "The safety policy paused the session and queued human review before more tutor content could be generated.",
        },
      },
    ],
  },
  reviewQueue: {
    status: "ready",
    items: [
      {
        studentRef: DEMO_STUDENT_REF,
        reviewRef: "review:trusted-adult-003",
        eventRef: "event:trusted-adult-003",
        requestedAt: "2026-07-25T10:05:05-04:00",
        status: "in_review",
        reasonLabel: "Trusted-adult safety review",
        expectedNextStep:
          "An authorized reviewer checks the event context and records a structured outcome.",
        falsePositiveRequest: {
          requestedAt: "2026-07-25T11:18:00-04:00",
          status: "submitted",
        },
      },
      {
        studentRef: DEMO_STUDENT_REF,
        reviewRef: "review:privacy-002",
        eventRef: "event:privacy-002",
        requestedAt: "2026-07-27T13:10:00-04:00",
        status: "parent_context_received",
        reasonLabel: "Privacy redirect check",
        expectedNextStep:
          "A reviewer confirms that the lesson continued without retaining a precise location.",
      },
    ],
  },
  auditHistory: {
    status: "ready",
    items: [
      {
        studentRef: DEMO_STUDENT_REF,
        auditRef: "audit:001",
        at: "2026-07-28T09:13:08-04:00",
        actor: "system",
        action: "answer_withheld",
        summary:
          "Answer-integrity policy withheld the final answer and supplied a hint.",
        eventRef: "event:answer-integrity-001",
      },
      {
        studentRef: DEMO_STUDENT_REF,
        auditRef: "audit:002",
        at: "2026-07-27T13:08:07-04:00",
        actor: "system",
        action: "parent_notified",
        summary:
          "An in-app parent notice was created without a transcript excerpt.",
        eventRef: "event:privacy-002",
      },
      {
        studentRef: DEMO_STUDENT_REF,
        auditRef: "audit:003",
        at: "2026-07-25T10:05:05-04:00",
        actor: "system",
        action: "human_review_requested",
        summary:
          "A human safety review was queued after the tutor paused the session.",
        eventRef: "event:trusted-adult-003",
      },
      {
        studentRef: DEMO_STUDENT_REF,
        auditRef: "audit:004",
        at: "2026-07-22T17:15:00-04:00",
        actor: "parent",
        action: "permission_changed",
        summary:
          "Allowed session window and maximum session length were updated.",
      },
    ],
  },
  permissions: {
    studentRef: DEMO_STUDENT_REF,
    revision: 4,
    tutorEnabled: true,
    voicePlaybackEnabled: true,
    openEndedExplorationEnabled: false,
    subjects: [
      { subjectRef: "subject:math", label: "Math", allowed: true },
      { subjectRef: "subject:ela", label: "English", allowed: true },
      { subjectRef: "subject:science", label: "Science", allowed: true },
      { subjectRef: "subject:history", label: "History", allowed: true },
      { subjectRef: "subject:japanese", label: "Japanese", allowed: false },
    ],
    schedule: {
      zoneId: "America/New_York",
      allowedDays: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
      ],
      startsAtLocal: "08:00",
      endsAtLocal: "17:00",
      maximumSessionMinutes: 35,
    },
    notifications: {
      inApp: true,
      emailOnFile: false,
      minimumSeverity: "high",
      includeTranscriptExcerpt: false,
    },
    retention: {
      instructionalHistoryDays: 60,
      safetyEventDays: 180,
      auditHistoryDays: 365,
      activeReviewHoldEnabled: true,
    },
  },
  studentSafety: {
    studentRef: DEMO_STUDENT_REF,
    tutorPausedByStudent: false,
    reportAndPauseControls: "always_available",
  },
};

export const demoMissingHistoryData: SafetyCenterData = {
  ...demoSafetyCenterData,
  generatedAt: "2026-07-28T14:35:00-04:00",
  instructionalHistory: {
    status: "unavailable",
    code: "temporarily_unavailable",
    retryable: true,
  },
};
