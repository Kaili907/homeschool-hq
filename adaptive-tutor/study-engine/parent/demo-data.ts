import {
  PARENT_DASHBOARD_SCHEMA_VERSION,
  type ParentDashboardModel,
  type ParentDashboardSnapshot,
  type ParentVisibleEvidence,
} from "./contracts.js";
import { createParentControlState } from "./controls.js";

const evidence = (
  evidenceRef: string,
  description: string,
  observedAt: string,
  source: ParentVisibleEvidence["source"],
): ParentVisibleEvidence => ({
  evidenceRef,
  description,
  observedAt,
  source,
});

const fractionReviewEvidence = evidence(
  "evidence:fraction-review-01",
  "Correctly matched 5 of 5 equivalent-fraction pairs during the scheduled review.",
  "2026-07-28T09:18:00-04:00",
  "review_result",
);

const multiplicationEvidence = evidence(
  "evidence:multiplication-01",
  "Completed the 6-times-table retrieval set accurately in 7 minutes.",
  "2026-07-28T09:42:00-04:00",
  "completed_block",
);

const guidedPracticeEvidence = evidence(
  "evidence:guided-practice-01",
  "Completed three lesson sections and chose to pause before the next guided example.",
  "2026-07-28T10:26:00-04:00",
  "calendar_record",
);

const writingSectionEvidence = evidence(
  "evidence:writing-sections-01",
  "Two 12-minute drafting sections were completed with the planned break between them.",
  "2026-07-25T11:06:00-04:00",
  "completed_block",
);

const workBlockEvidence = evidence(
  "evidence:math-range-01",
  "Four recent math blocks between 18 and 22 minutes reached their planned stopping points.",
  "2026-07-28T10:26:00-04:00",
  "calendar_record",
);

const approvedBreak = {
  breakRef: "break:morning-01",
  durationMinutes: 5,
  approved: true,
  context: "Between math review and the fractions lesson",
} as const;

export const PARENT_DASHBOARD_DEMO_SNAPSHOT: ParentDashboardSnapshot = {
  schemaVersion: PARENT_DASHBOARD_SCHEMA_VERSION,
  generatedAt: "2026-07-28T11:15:00-04:00",
  zoneId: "America/New_York",
  studentRef: "student:demo-001",
  learnerLabel: "Learner A",
  today: {
    date: "2026-07-28",
    scheduledBlocks: [
      {
        blockRef: "block:fractions-01",
        title: "Fractions Lesson",
        subject: "Math",
        status: "partial",
        estimatedMinutes: 38,
        actualMinutes: 22,
      },
      {
        blockRef: "block:reading-01",
        title: "Independent Reading",
        subject: "Reading",
        status: "completed",
        estimatedMinutes: 20,
        actualMinutes: 19,
      },
      {
        blockRef: "block:writing-01",
        title: "Paragraph Revision",
        subject: "Writing",
        status: "scheduled",
        estimatedMinutes: 15,
      },
      {
        blockRef: "block:rva-science-01",
        title: "RVA Science Lab Notes",
        subject: "Science",
        status: "needs_support",
        estimatedMinutes: 25,
      },
    ],
    completedBlocks: [
      {
        blockRef: "block:review-01",
        title: "Equivalent Fractions Review",
        subject: "Math",
        status: "completed",
        estimatedMinutes: 8,
        actualMinutes: 7,
      },
      {
        blockRef: "block:reading-01",
        title: "Independent Reading",
        subject: "Reading",
        status: "completed",
        estimatedMinutes: 20,
        actualMinutes: 19,
      },
    ],
    skillsReviewed: [
      {
        skillRef: "skill:equivalent-fractions",
        label: "Equivalent fractions",
        reviewKind: "same_day",
        evidence: [fractionReviewEvidence],
      },
      {
        skillRef: "skill:multiplication-by-six",
        label: "Multiplication facts ×6",
        reviewKind: "future",
        evidence: [multiplicationEvidence],
      },
    ],
    breaksTaken: [approvedBreak],
    resumableWork: [
      {
        blockRef: "block:fractions-01",
        title: "Fractions Lesson",
        completedSegments: 3,
        totalSegments: 6,
        estimatedMinutesRemaining: 16,
        resumeAt: "Guided Practice",
        studentMessage:
          "Nice progress—you can continue with Guided Practice when you’re ready.",
      },
    ],
    assignmentsNeedingSupport: [
      {
        assignmentRef: "external:rva-science-01",
        title: "Ecosystem Lab Notes",
        course: "Romeo Virtual Academy Science",
        dueAt: "2026-07-29T15:00:00-04:00",
        supportReason:
          "The assignment is ready for linked Manuel Academy tutoring support.",
        linkedTutorSupportRef: "tutor-support:ecosystem-notes-01",
      },
    ],
  },
  learning: {
    masteredSkills: [
      {
        skillRef: "skill:equivalent-fractions",
        label: "Recognizes equivalent fractions",
        evidence: [fractionReviewEvidence],
      },
    ],
    developingSkills: [
      {
        skillRef: "skill:add-unlike-denominators",
        label: "Adds fractions with unlike denominators",
        evidence: [guidedPracticeEvidence],
      },
    ],
    prerequisiteGaps: [
      {
        skillRef: "skill:common-multiples",
        label: "Finding common multiples needs another guided example",
        evidence: [
          evidence(
            "evidence:common-multiples-01",
            "Needed a hint on two common-multiple steps in today’s guided practice.",
            "2026-07-28T10:20:00-04:00",
            "review_result",
          ),
        ],
      },
    ],
    upcomingReviews: [
      {
        reviewRef: "review:fractions-2026-07-30",
        skillLabel: "Adding fractions with unlike denominators",
        dueAt: "2026-07-30T09:00:00-04:00",
        priority: "important",
      },
    ],
    repeatedMisconceptions: [
      {
        insightRef: "insight:add-denominators-01",
        observation:
          "Added denominators as well as numerators in two recent practice examples.",
        occurrences: 2,
        evidence: [
          evidence(
            "evidence:add-denominators-01",
            "The same step appeared in guided examples on July 25 and July 28.",
            "2026-07-28T10:22:00-04:00",
            "review_result",
          ),
        ],
        supportiveNextStep:
          "Use a visual fraction model in the next guided example and celebrate the correct numerator step.",
      },
    ],
  },
  studyHabits: {
    currentEffectiveWorkBlockRanges: [
      {
        subject: "math",
        minimumMinutes: 18,
        maximumMinutes: 22,
        displayText:
          "Current effective math work-block range: 18–22 minutes",
      },
    ],
    bestPerformingTaskLengths: [
      {
        taskKind: "Guided math practice",
        minimumMinutes: 18,
        maximumMinutes: 22,
        evidence: [workBlockEvidence],
      },
      {
        taskKind: "Independent reading",
        minimumMinutes: 19,
        maximumMinutes: 24,
        evidence: [
          evidence(
            "evidence:reading-length-01",
            "Three recent reading blocks reached the planned chapter stop in 19–24 minutes.",
            "2026-07-28T09:58:00-04:00",
            "completed_block",
          ),
        ],
      },
    ],
    subjectsBenefitingFromShorterSections: [
      {
        subject: "Writing",
        suggestedSectionMinutes: 12,
        evidence: [writingSectionEvidence],
      },
    ],
    approvedBreaks: [approvedBreak],
    recommendation: {
      recommendationRef: "recommendation:math-duration-01",
      direction: "maintain",
      summary:
        "Maintain the current math work-block range and keep the approved five-minute break.",
      suggestedMaximumWorkMinutes: 22,
      suggestedBreakMinutes: 5,
      evidence: [
        workBlockEvidence,
        guidedPracticeEvidence,
        evidence(
          "evidence:parent-break-approval-01",
          "The parent-approved five-minute break was followed by a completed review block.",
          "2026-07-28T09:35:00-04:00",
          "parent_entry",
        ),
      ],
    },
  },
};

export function createParentDashboardDemoModel(): ParentDashboardModel {
  return {
    snapshot: PARENT_DASHBOARD_DEMO_SNAPSHOT,
    controls: createParentControlState({
      maximumWorkDurationMinutes: 25,
      breakDurationMinutes: 5,
      timersHidden: false,
    }),
  };
}
