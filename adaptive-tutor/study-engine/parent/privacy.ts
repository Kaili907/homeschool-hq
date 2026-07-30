import type {
  ParentControlState,
  ParentDashboardSnapshot,
  ParentVisibleEvidence,
} from "./contracts.js";

export type ParentPrivacyIssueCode =
  | "prohibited_field"
  | "prohibited_language"
  | "missing_evidence"
  | "unsupported_student_language"
  | "private_note_exposed";

export interface ParentPrivacyIssue {
  readonly code: ParentPrivacyIssueCode;
  readonly path: string;
  readonly message: string;
}

const PROHIBITED_FIELD =
  /(webcam|camera|eye.?track|gaze|medical.?diagnos|hidden.?behavio(?:u)?r.?score|attention.?span|permanent.?label)/i;
const PROHIBITED_LANGUAGE =
  /\b(webcam monitoring|eye[ -]?tracking|medical diagnosis|attention span|hidden behavior scoring|permanent child label)\b/i;
const UNSUPPORTIVE_LANGUAGE =
  /\b(lazy|bad student|failure|failed again|cannot focus|can't focus|behind everyone)\b/i;

function inspectValue(
  value: unknown,
  path: string,
  issues: ParentPrivacyIssue[],
): void {
  if (typeof value === "string") {
    if (PROHIBITED_LANGUAGE.test(value)) {
      issues.push({
        code: "prohibited_language",
        path,
        message:
          "Use parent-visible observational language without surveillance, diagnosis, scores, or permanent labels.",
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectValue(item, `${path}[${index}]`, issues),
    );
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (PROHIBITED_FIELD.test(key)) {
        issues.push({
          code: "prohibited_field",
          path: childPath,
          message: "This data category is outside the parent-insights contract.",
        });
      }
      inspectValue(child, childPath, issues);
    }
  }
}

function requireEvidence(
  value: { readonly evidence: readonly ParentVisibleEvidence[] },
  path: string,
  issues: ParentPrivacyIssue[],
): void {
  if (value.evidence.length === 0) {
    issues.push({
      code: "missing_evidence",
      path: `${path}.evidence`,
      message: "Every learning or habit inference needs parent-visible evidence.",
    });
  }
}

/**
 * Audits only the minimized dashboard projection. This is not behavior
 * scoring: it verifies that prohibited data is absent and that every displayed
 * inference can be traced to evidence a parent can see.
 */
export function auditParentDashboardPrivacy(
  snapshot: ParentDashboardSnapshot,
): readonly ParentPrivacyIssue[] {
  const issues: ParentPrivacyIssue[] = [];
  inspectValue(snapshot, "snapshot", issues);

  snapshot.today.skillsReviewed.forEach((item, index) =>
    requireEvidence(item, `snapshot.today.skillsReviewed[${index}]`, issues),
  );
  snapshot.learning.masteredSkills.forEach((item, index) =>
    requireEvidence(item, `snapshot.learning.masteredSkills[${index}]`, issues),
  );
  snapshot.learning.developingSkills.forEach((item, index) =>
    requireEvidence(
      item,
      `snapshot.learning.developingSkills[${index}]`,
      issues,
    ),
  );
  snapshot.learning.prerequisiteGaps.forEach((item, index) =>
    requireEvidence(
      item,
      `snapshot.learning.prerequisiteGaps[${index}]`,
      issues,
    ),
  );
  snapshot.learning.repeatedMisconceptions.forEach((item, index) => {
    requireEvidence(
      item,
      `snapshot.learning.repeatedMisconceptions[${index}]`,
      issues,
    );
    if (UNSUPPORTIVE_LANGUAGE.test(item.supportiveNextStep)) {
      issues.push({
        code: "unsupported_student_language",
        path: `snapshot.learning.repeatedMisconceptions[${index}].supportiveNextStep`,
        message: "The next step must remain supportive and non-labeling.",
      });
    }
  });
  snapshot.studyHabits.bestPerformingTaskLengths.forEach((item, index) =>
    requireEvidence(
      item,
      `snapshot.studyHabits.bestPerformingTaskLengths[${index}]`,
      issues,
    ),
  );
  snapshot.studyHabits.subjectsBenefitingFromShorterSections.forEach(
    (item, index) =>
      requireEvidence(
        item,
        `snapshot.studyHabits.subjectsBenefitingFromShorterSections[${index}]`,
        issues,
      ),
  );
  requireEvidence(
    snapshot.studyHabits.recommendation,
    "snapshot.studyHabits.recommendation",
    issues,
  );

  snapshot.today.resumableWork.forEach((item, index) => {
    if (UNSUPPORTIVE_LANGUAGE.test(item.studentMessage)) {
      issues.push({
        code: "unsupported_student_language",
        path: `snapshot.today.resumableWork[${index}].studentMessage`,
        message: "Resume language must remain supportive and non-labeling.",
      });
    }
  });

  return issues;
}

/**
 * Private notes are accepted by the control boundary but intentionally never
 * copied into the dashboard snapshot or student-facing projection.
 */
export function auditPrivateNoteIsolation(
  snapshot: ParentDashboardSnapshot,
  controls: ParentControlState,
): readonly ParentPrivacyIssue[] {
  const serializedSnapshot = JSON.stringify(snapshot);
  const issues: ParentPrivacyIssue[] = [];

  controls.privateNotes.forEach((note, index) => {
    if (serializedSnapshot.includes(note.body)) {
      issues.push({
        code: "private_note_exposed",
        path: `controls.privateNotes[${index}]`,
        message: "A parent-only note was exposed in the dashboard snapshot.",
      });
    }
  });

  return issues;
}
