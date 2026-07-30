import { readdirSync, readFileSync } from "node:fs";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DAILY_CALENDAR_BLOCK_TYPES,
  buildCalendarMockDemonstration,
} from "../../integrations/calendar/index.js";
import { createMockReviewQueueDemo } from "../../integrations/review/index.js";
import {
  buildRomeoMockDemonstration,
  romeoVirtualAcademyAdapter,
} from "../../integrations/romeo/index.js";
import {
  PARENT_CONTROL_SCHEMA_VERSION,
  PARENT_DASHBOARD_SCHEMA_VERSION,
  applyParentControlEvent,
  createParentDashboardDemoModel,
} from "../../parent/index.js";

const studyEngineRoot = fileURLToPath(new URL("../../", import.meta.url));
const adaptiveTutorRoot = resolve(studyEngineRoot, "..");
const implementationRoots = [
  resolve(studyEngineRoot, "integrations"),
  resolve(studyEngineRoot, "parent"),
] as const;
const forbiddenRoots = [
  resolve(adaptiveTutorRoot, "core"),
  resolve(adaptiveTutorRoot, "subjects"),
  resolve(studyEngineRoot, "contracts"),
  resolve(studyEngineRoot, "schemas"),
  resolve(studyEngineRoot, "engine"),
  resolve(studyEngineRoot, "ui"),
] as const;

function sourceFiles(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [absolute] : [];
  });
}

function isWithin(path: string, root: string): boolean {
  const pathFromRoot = relative(root, path);
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
  );
}

function importSpecifiers(source: string): readonly string[] {
  return [
    ...source.matchAll(
      /(?:\bfrom\s+|\bimport\s*\()\s*["']([^"']+)["']/g,
    ),
  ].map((match) => match[1]);
}

describe("cross-cutting integration validation boundary", () => {
  it("does not couple provisional implementations to forbidden production areas", () => {
    const findings = implementationRoots.flatMap((root) =>
      sourceFiles(root).flatMap((path) => {
        const source = readFileSync(path, "utf8");
        return importSpecifiers(source).flatMap((specifier) => {
          if (!specifier.startsWith(".")) {
            return /(?:^|[/@-])(core|subjects|study-ui|schemas)(?:[/@-]|$)/i.test(
              specifier,
            )
              ? [{ path, specifier, reason: "forbidden bare import" }]
              : [];
          }
          const target = resolve(dirname(path), specifier);
          return forbiddenRoots.some((forbiddenRoot) =>
            isWithin(target, forbiddenRoot),
          )
            ? [{ path, specifier, reason: "forbidden relative import" }]
            : [];
        });
      }),
    );

    expect(findings).toEqual([]);
  });

  it("exposes every required calendar, review, Romeo, and parent demonstration surface", () => {
    const calendar = buildCalendarMockDemonstration();
    const review = createMockReviewQueueDemo();
    const romeo = buildRomeoMockDemonstration();
    const parent = createParentDashboardDemoModel();

    expect(calendar.everyDailyBlockType.map(({ blockType }) => blockType)).toEqual(
      DAILY_CALENDAR_BLOCK_TYPES,
    );
    expect(calendar.partialFractionsView).toMatchObject({
      title: "Fractions Lesson",
      completionState: "partially_complete",
      segmentsCompleted: 3,
      totalSegments: 6,
      estimatedMinutesRemaining: 16,
      resumeAt: "Guided Practice",
    });
    expect(review.queue.summary).toMatchObject({
      overloadAvoided: true,
      scheduledCount: 2,
      capacityHeldCount: 2,
      upcomingCount: 2,
    });
    expect(romeo.assignment).toMatchObject({
      schemaVersion: "provisional-external-assignment.v1",
      provider: "romeo_virtual_academy",
      externalAssignmentTitle: "Solving Two-Step Equations",
      externalCourse: "Algebra I",
      dueDate: "2026-07-31",
      estimatedDurationMinutes: 35,
      completionState: "in_progress",
      parentEnteredProgress: expect.any(Object),
      studentEnteredProgress: expect.any(Object),
      linkedManuelAcademyTutoringSupport: expect.any(Object),
      resumeNote: expect.any(String),
      externalUrlReference: expect.stringMatching(/^https:/),
    });
    expect(parent.snapshot).toMatchObject({
      schemaVersion: PARENT_DASHBOARD_SCHEMA_VERSION,
      today: {
        scheduledBlocks: expect.any(Array),
        completedBlocks: expect.any(Array),
        skillsReviewed: expect.any(Array),
        breaksTaken: expect.any(Array),
        resumableWork: expect.any(Array),
        assignmentsNeedingSupport: expect.any(Array),
      },
      learning: {
        masteredSkills: expect.any(Array),
        developingSkills: expect.any(Array),
        prerequisiteGaps: expect.any(Array),
        upcomingReviews: expect.any(Array),
        repeatedMisconceptions: expect.any(Array),
      },
      studyHabits: {
        currentEffectiveWorkBlockRanges: expect.any(Array),
        bestPerformingTaskLengths: expect.any(Array),
        subjectsBenefitingFromShorterSections: expect.any(Array),
        approvedBreaks: expect.any(Array),
        recommendation: expect.any(Object),
      },
    });
    expect(parent.controls.schemaVersion).toBe(
      PARENT_CONTROL_SCHEMA_VERSION,
    );
  });

  it("maps only the assignment metadata needed by the calendar projection", () => {
    const assignment = buildRomeoMockDemonstration().assignment;
    const calendar = romeoVirtualAcademyAdapter.toCalendar(assignment, {
      entryId: "validation-rva-calendar-entry",
      learnerRef: "learner-validation",
      scheduledStart: "2026-07-29T10:00:00-04:00",
      timeZone: "America/New_York",
      createdAt: "2026-07-28T09:15:00-04:00",
    });
    const serialized = JSON.stringify(calendar);

    expect(calendar).toMatchObject({
      source: "romeo_virtual_academy",
      sourceItemRef: assignment.externalAssignmentRef,
      title: assignment.externalAssignmentTitle,
      subject: assignment.externalCourse,
      blockType: "romeo_virtual_academy_activity",
      estimatedMinutes: assignment.estimatedDurationMinutes,
    });
    expect(serialized).not.toMatch(
      /dueDate|EnteredProgress|resumeNote|externalUrlReference|TutoringSupport/i,
    );
  });

  it("keeps demonstrations deterministic, JSON-safe, immutable, and side-effect free", () => {
    expect(buildCalendarMockDemonstration()).toStrictEqual(
      buildCalendarMockDemonstration(),
    );
    expect(createMockReviewQueueDemo()).toStrictEqual(
      createMockReviewQueueDemo(),
    );
    expect(buildRomeoMockDemonstration()).toStrictEqual(
      buildRomeoMockDemonstration(),
    );

    const initial = createParentDashboardDemoModel();
    const serialized = JSON.stringify({
      calendar: buildCalendarMockDemonstration(),
      review: createMockReviewQueueDemo(),
      romeo: buildRomeoMockDemonstration(),
      parent: initial,
    });
    expect(() => JSON.parse(serialized)).not.toThrow();

    const next = applyParentControlEvent(initial, {
      type: "maximum_work_duration_set",
      minutes: 24,
      at: "2026-07-28T12:00:00-04:00",
    });
    expect(initial.controls.maximumWorkDurationMinutes).toBe(25);
    expect(initial.controls.revision).toBe(0);
    expect(next.controls.maximumWorkDurationMinutes).toBe(24);
    expect(next.controls.revision).toBe(1);
    expect(next.snapshot).toBe(initial.snapshot);
  });
});
