import type {
  CollectionState,
  IdentityRole,
  InstructionalSession,
  SafetyCenterAction,
  SafetyCenterBoundaryIssue,
  SafetyCenterData,
  SafetyCenterStudentScope,
  SafetyCenterViewer,
  SafetyEvent,
  StudentRef,
} from "./contracts";

export interface SafetyCenterFilters {
  readonly query: string;
  readonly subjectRef: string;
  readonly fromDate: string;
  readonly toDate: string;
}

export type SafetyCenterAccessDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly issue: SafetyCenterBoundaryIssue;
    };

const SAFE_ACCESS_MESSAGE =
  "This safety center cannot show student information because access could not be verified.";

function denied(
  code: SafetyCenterBoundaryIssue["code"],
): SafetyCenterAccessDecision {
  return {
    allowed: false,
    issue: { code, safeMessage: SAFE_ACCESS_MESSAGE },
  };
}

function readyItems<T>(state: CollectionState<T>): readonly T[] {
  return state.status === "ready" ? state.items : [];
}

function allProjectionStudentRefs(data: SafetyCenterData): readonly StudentRef[] {
  return [
    data.studentRef,
    data.permissions.studentRef,
    data.studentSafety.studentRef,
    ...readyItems(data.instructionalHistory).map((item) => item.studentRef),
    ...readyItems(data.safetyEvents).map((item) => item.studentRef),
    ...readyItems(data.reviewQueue).map((item) => item.studentRef),
    ...readyItems(data.auditHistory).map((item) => item.studentRef),
  ];
}

/**
 * Defense-in-depth check for the UI boundary. The server remains responsible
 * for authorization and must never send sibling data in the first place.
 */
export function evaluateSafetyCenterAccess(
  viewer: SafetyCenterViewer,
  student: SafetyCenterStudentScope,
  data: SafetyCenterData,
): SafetyCenterAccessDecision {
  if (
    viewer.identityAssurance !== "verified" ||
    viewer.actorRef.trim().length === 0
  ) {
    return denied("identity_not_verified");
  }

  if (viewer.role !== "parent" && viewer.role !== "student") {
    return denied("role_not_supported");
  }

  const viewerMayAccess =
    viewer.role === "student"
      ? viewer.studentRef === student.studentRef
      : viewer.authorizedStudentRefs.includes(student.studentRef);

  if (!viewerMayAccess) {
    return denied("student_scope_not_authorized");
  }

  if (
    allProjectionStudentRefs(data).some(
      (studentRef) => studentRef !== student.studentRef,
    )
  ) {
    return denied("projection_scope_mismatch");
  }

  return { allowed: true };
}

const PARENT_ACTIONS = new Set<SafetyCenterAction["type"]>([
  "permissions_update_requested",
  "retention_update_requested",
  "export_requested",
  "deletion_requested",
  "human_review_requested",
  "false_positive_review_requested",
  "tutor_pause_requested",
  "tutor_resume_requested",
  "playback_requested",
  "history_retry_requested",
]);

const STUDENT_ACTIONS = new Set<SafetyCenterAction["type"]>([
  "student_report_submitted",
  "tutor_pause_requested",
  "playback_requested",
  "history_retry_requested",
]);

export function roleMayDispatchAction(
  role: IdentityRole,
  action: SafetyCenterAction,
): boolean {
  if (role === "parent") {
    return (
      PARENT_ACTIONS.has(action.type) &&
      (action.type !== "tutor_pause_requested" ||
        action.source === "parent_control")
    );
  }

  if (role === "student") {
    return (
      STUDENT_ACTIONS.has(action.type) &&
      (action.type !== "tutor_pause_requested" ||
        action.source === "student_block")
    );
  }

  return false;
}

export function actionMatchesStudent(
  action: SafetyCenterAction,
  studentRef: StudentRef,
): boolean {
  return action.studentRef === studentRef;
}

function datePart(timestamp: string): string {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(timestamp);
  return match?.[0] ?? "";
}

function inDateRange(
  timestamp: string,
  fromDate: string,
  toDate: string,
): boolean {
  const date = datePart(timestamp);
  if (!date) return false;
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function filterInstructionalSessions(
  sessions: readonly InstructionalSession[],
  filters: SafetyCenterFilters,
): readonly InstructionalSession[] {
  const query = normalized(filters.query);

  return sessions
    .filter((session) => {
      if (
        filters.subjectRef &&
        session.subjectRef !== filters.subjectRef
      ) {
        return false;
      }
      if (
        !inDateRange(session.startedAt, filters.fromDate, filters.toDate)
      ) {
        return false;
      }
      if (!query) return true;

      const haystack = normalized(
        [
          session.subjectLabel,
          session.topicLabel,
          session.summary,
          ...session.turns.map((turn) => turn.text),
        ].join(" "),
      );
      return haystack.includes(query);
    })
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export function filterSafetyEvents(
  events: readonly SafetyEvent[],
  filters: SafetyCenterFilters,
): readonly SafetyEvent[] {
  const query = normalized(filters.query);

  return events
    .filter((event) => {
      if (
        filters.subjectRef &&
        event.subjectRef !== filters.subjectRef
      ) {
        return false;
      }
      if (!inDateRange(event.occurredAt, filters.fromDate, filters.toDate)) {
        return false;
      }
      if (!query) return true;

      const haystack = normalized(
        [
          event.subjectLabel ?? "",
          event.summary,
          event.studentExplanation,
          event.parentDetail,
          event.withheldReason?.title ?? "",
        ].join(" "),
      );
      return haystack.includes(query);
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function collectSubjectOptions(
  data: SafetyCenterData,
): readonly { readonly value: string; readonly label: string }[] {
  const subjects = new Map<string, string>();

  data.permissions.subjects.forEach((subject) =>
    subjects.set(subject.subjectRef, subject.label),
  );
  readyItems(data.instructionalHistory).forEach((session) =>
    subjects.set(session.subjectRef, session.subjectLabel),
  );
  readyItems(data.safetyEvents).forEach((event) => {
    if (event.subjectRef && event.subjectLabel) {
      subjects.set(event.subjectRef, event.subjectLabel);
    }
  });

  return [...subjects.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function severityRank(
  severity: SafetyEvent["severity"],
): number {
  return {
    info: 0,
    low: 1,
    moderate: 2,
    high: 3,
    critical: 4,
  }[severity];
}
