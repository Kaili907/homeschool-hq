import { describe, expect, it } from "vitest";
import { mergeCalendarEntries } from "../../integrations/calendar/index.js";
import {
  RomeoAdapterError,
  buildRomeoMockDemonstration,
  effectiveRomeoProgress,
  normalizeRomeoAssignment,
  romeoVirtualAcademyAdapter,
  type RomeoVirtualAcademyAssignmentInput,
} from "../../integrations/romeo/index.js";

const completeInput = {
  externalAssignmentRef: "rva-algebra-204",
  externalAssignmentTitle: "Solving Two-Step Equations",
  externalCourse: "Algebra I",
  dueDate: "2026-07-31",
  estimatedDurationMinutes: 35,
  completionState: "in_progress",
  parentEnteredProgress: {
    completedUnits: 2,
    totalUnits: 5,
    updatedAt: "2026-07-28T08:20:00-04:00",
  },
  studentEnteredProgress: {
    completedUnits: 3,
    totalUnits: 5,
    updatedAt: "2026-07-28T09:10:00-04:00",
  },
  linkedManuelAcademyTutoringSupport: {
    supportRef: "support-two-step-equations",
    title: "Practice two-step equations with the tutor",
    state: "available",
  },
  resumeNote: "Resume with question 6. You have already completed the examples.",
  externalUrlReference:
    "https://academy.example.invalid/assignments/rva-algebra-204",
} as const satisfies RomeoVirtualAcademyAssignmentInput;

describe("Romeo Virtual Academy external-assignment adapter", () => {
  it("normalizes every required field without credentials", () => {
    const assignment = normalizeRomeoAssignment(completeInput);

    expect(assignment).toEqual({
      schemaVersion: "provisional-external-assignment.v1",
      provider: "romeo_virtual_academy",
      ...completeInput,
    });
    expect(JSON.stringify(assignment)).not.toMatch(
      /password|credential|accessToken|refreshToken|sessionCookie|apiKey/i,
    );
  });

  it("keeps parent and student reports distinct and exposes only declared progress", () => {
    const assignment = normalizeRomeoAssignment(completeInput);

    expect(effectiveRomeoProgress(assignment)).toEqual({
      completedUnits: 3,
      totalUnits: 5,
      percent: 60,
      source: "student",
    });
    expect(
      effectiveRomeoProgress(
        normalizeRomeoAssignment({
          ...completeInput,
          completionState: "completed",
        }),
      ),
    ).toEqual({
      completedUnits: 1,
      totalUnits: 1,
      percent: 100,
      source: "external_state",
    });
  });

  it("creates a deduplicatable Romeo calendar activity", () => {
    const assignment = romeoVirtualAcademyAdapter.normalize(completeInput);
    const schedule = {
      entryId: "calendar-rva-algebra-204",
      learnerRef: "learner-calendar-test",
      scheduledStart: "2026-07-29T10:00:00-04:00",
      timeZone: "America/New_York",
      createdAt: "2026-07-28T09:15:00-04:00",
    } as const;
    const first = romeoVirtualAcademyAdapter.toCalendar(assignment, schedule);
    const repeat = romeoVirtualAcademyAdapter.toCalendar(assignment, {
      ...schedule,
      entryId: "calendar-rva-algebra-204-repeat",
    });

    expect(first).toMatchObject({
      source: "romeo_virtual_academy",
      sourceItemRef: "rva-algebra-204",
      title: "Solving Two-Step Equations",
      subject: "Algebra I",
      blockType: "romeo_virtual_academy_activity",
      estimatedMinutes: 35,
    });
    expect(mergeCalendarEntries([first], [repeat])).toHaveLength(1);
    expect(buildRomeoMockDemonstration()).toMatchObject({
      effectiveProgress: { percent: 60, source: "student" },
      calendarEntryCountAfterRepeatImport: 1,
    });
  });

  it("rejects credential fields and credential-bearing URL references", () => {
    expect(() =>
      normalizeRomeoAssignment({
        ...completeInput,
        password: "must-not-be-stored",
      } as RomeoVirtualAcademyAssignmentInput & { password: string }),
    ).toThrowError(
      expect.objectContaining<Partial<RomeoAdapterError>>({
        code: "credential_material",
      }),
    );
    expect(() =>
      normalizeRomeoAssignment({
        ...completeInput,
        externalUrlReference:
          "https://academy.example.invalid/assignment?token=secret",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RomeoAdapterError>>({
        code: "credential_material",
      }),
    );
    expect(() =>
      normalizeRomeoAssignment({
        ...completeInput,
        externalUrlReference:
          "https://student:password@academy.example.invalid/assignment",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RomeoAdapterError>>({
        code: "invalid_url",
      }),
    );
  });

  it("rejects impossible due dates, progress, and offset-free updates", () => {
    expect(() =>
      normalizeRomeoAssignment({
        ...completeInput,
        dueDate: "2026-02-30",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RomeoAdapterError>>({
        code: "invalid_due_date",
      }),
    );
    expect(() =>
      normalizeRomeoAssignment({
        ...completeInput,
        parentEnteredProgress: {
          completedUnits: 6,
          totalUnits: 5,
          updatedAt: "2026-07-28T08:20:00-04:00",
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RomeoAdapterError>>({
        code: "invalid_progress",
      }),
    );
    expect(() =>
      normalizeRomeoAssignment({
        ...completeInput,
        studentEnteredProgress: {
          completedUnits: 3,
          totalUnits: 5,
          updatedAt: "2026-07-28T09:10:00",
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RomeoAdapterError>>({
        code: "invalid_timestamp",
      }),
    );
  });
});
