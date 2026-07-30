/**
 * Credential-free external-assignment contract for Romeo Virtual Academy.
 *
 * The adapter receives assignment metadata only. Login credentials, session
 * cookies, API keys, and access tokens are explicitly outside this contract.
 */

export type ExternalAssignmentCompletionState =
  | "not_started"
  | "in_progress"
  | "completed";

export interface EnteredAssignmentProgress {
  readonly completedUnits: number;
  readonly totalUnits: number;
  readonly updatedAt: string;
}

export interface LinkedManuelAcademyTutoringSupport {
  readonly supportRef: string;
  readonly title: string;
  readonly state: "available" | "requested" | "completed";
}

export interface RomeoVirtualAcademyAssignmentInput {
  readonly externalAssignmentRef: string;
  readonly externalAssignmentTitle: string;
  readonly externalCourse: string;
  /**
   * Calendar-only due date. No time-of-day or inferred browser time zone.
   */
  readonly dueDate: string;
  readonly estimatedDurationMinutes: number;
  readonly completionState: ExternalAssignmentCompletionState;
  readonly parentEnteredProgress?: EnteredAssignmentProgress;
  readonly studentEnteredProgress?: EnteredAssignmentProgress;
  readonly linkedManuelAcademyTutoringSupport?: LinkedManuelAcademyTutoringSupport;
  readonly resumeNote?: string;
  readonly externalUrlReference?: string;
}

export interface RomeoVirtualAcademyAssignment
  extends RomeoVirtualAcademyAssignmentInput {
  readonly schemaVersion: "provisional-external-assignment.v1";
  readonly provider: "romeo_virtual_academy";
}

export interface EffectiveAssignmentProgress {
  readonly completedUnits: number;
  readonly totalUnits: number;
  readonly percent: number;
  readonly source: "external_state" | "parent" | "student" | "none";
}

export interface RomeoCalendarScheduleInput {
  readonly entryId: string;
  readonly learnerRef: string;
  readonly scheduledStart: string;
  readonly timeZone: string;
  readonly createdAt: string;
}

export type RomeoAdapterErrorCode =
  | "invalid_reference"
  | "invalid_text"
  | "invalid_due_date"
  | "invalid_duration"
  | "invalid_completion_state"
  | "invalid_progress"
  | "invalid_timestamp"
  | "invalid_url"
  | "credential_material";

export class RomeoAdapterError extends Error {
  public readonly name = "RomeoAdapterError";

  public constructor(
    public readonly code: RomeoAdapterErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface ExternalAssignmentAdapter<
  TInput,
  TAssignment,
  TSchedule,
  TCalendar,
> {
  readonly provider: string;
  normalize(input: TInput): TAssignment;
  toCalendar(assignment: TAssignment, schedule: TSchedule): TCalendar;
}
