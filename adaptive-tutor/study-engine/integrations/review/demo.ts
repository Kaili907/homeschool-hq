import {
  buildDailyReviewQueue,
  createReviewItem,
  deferReview,
} from "./review-queue.js";

const planningDate = "2026-07-28";

const overdueReteaching = createReviewItem({
  reviewRef: "review-fractions-reteach",
  skillRef: "skill-fraction-equivalence",
  title: "Fractions strategy refresh",
  source: "tutor_generated",
  kind: "reteaching",
  priority: "urgent",
  createdDate: "2026-07-24",
  scheduledDate: "2026-07-27",
  estimatedMinutes: 10,
});

const prerequisiteSupport = createReviewItem({
  reviewRef: "review-multiplication-prerequisite",
  skillRef: "skill-multiplication-facts",
  title: "Multiplication warm-up",
  source: "tutor_generated",
  kind: "prerequisite_remediation",
  priority: "high",
  createdDate: planningDate,
  scheduledDate: planningDate,
  estimatedMinutes: 8,
});

const sameDayReview = createReviewItem({
  reviewRef: "review-vocabulary-same-day",
  skillRef: "skill-context-clues",
  title: "Context clues quick review",
  source: "tutor_generated",
  kind: "review",
  priority: "normal",
  createdDate: planningDate,
  scheduledDate: planningDate,
  estimatedMinutes: 12,
});

const lowerPriorityReview = createReviewItem({
  reviewRef: "review-writing-same-day",
  skillRef: "skill-topic-sentences",
  title: "Topic sentence check-in",
  source: "tutor_generated",
  kind: "review",
  priority: "low",
  createdDate: planningDate,
  scheduledDate: planningDate,
  estimatedMinutes: 5,
});

const futureReview = createReviewItem({
  reviewRef: "review-decimals-future",
  skillRef: "skill-decimal-place-value",
  title: "Decimal place value review",
  source: "tutor_generated",
  kind: "review",
  priority: "normal",
  createdDate: planningDate,
  scheduledDate: "2026-07-31",
  estimatedMinutes: 7,
});

const deferredReview = deferReview(
  createReviewItem({
    reviewRef: "review-reading-deferred",
    skillRef: "skill-main-idea",
    title: "Main idea practice",
    source: "tutor_generated",
    kind: "review",
    priority: "normal",
    createdDate: planningDate,
    scheduledDate: planningDate,
    estimatedMinutes: 6,
  }),
  {
    recordedOn: planningDate,
    resumeDate: "2026-07-30",
    reason: "student_request",
    actor: "student",
  },
);

/**
 * Fixed inputs make this demonstration safe to render in docs, tests, or a
 * prototype without network, storage, identity, or calendar access.
 */
export function createMockReviewQueueDemo() {
  const queue = buildDailyReviewQueue({
    planningDate,
    limits: {
      maxItems: 3,
      maxMinutes: 25,
    },
    reviews: [
      lowerPriorityReview,
      futureReview,
      sameDayReview,
      deferredReview,
      prerequisiteSupport,
      overdueReteaching,
    ],
  });

  return {
    schemaVersion: "provisional-review-queue-demo.v1" as const,
    explanation:
      "The queue schedules the highest-priority due work first and keeps the rest for a later plan when the daily limit would be exceeded.",
    queue,
    deferralDemonstration: {
      reviewRef: deferredReview.reviewRef,
      newScheduledDate: deferredReview.scheduledDate,
      recordedDeferral: deferredReview.deferrals[0],
      studentMessage: "This review has been moved to a later day.",
    },
  };
}
