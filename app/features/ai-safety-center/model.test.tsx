import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AiSafetyCenter } from "./AiSafetyCenter";
import type {
  SafetyCenterAction,
  SafetyCenterData,
  SafetyCenterViewer,
} from "./contracts";
import {
  DEMO_STUDENT_REF,
  demoParentViewer,
  demoSafetyCenterData,
  demoStudent,
  demoStudentViewer,
} from "./fixtures";
import {
  evaluateSafetyCenterAccess,
  filterInstructionalSessions,
  filterSafetyEvents,
  roleMayDispatchAction,
} from "./model";

describe("AI Safety Center authorization boundary", () => {
  it("allows only a verified authorized parent or the matching student", () => {
    expect(
      evaluateSafetyCenterAccess(
        demoParentViewer,
        demoStudent,
        demoSafetyCenterData,
      ),
    ).toEqual({ allowed: true });
    expect(
      evaluateSafetyCenterAccess(
        demoStudentViewer,
        demoStudent,
        demoSafetyCenterData,
      ),
    ).toEqual({ allowed: true });

    const unrelatedParent: SafetyCenterViewer = {
      ...demoParentViewer,
      actorRef: "actor:unrelated-parent",
      authorizedStudentRefs: ["student:someone-else"],
    };
    expect(
      evaluateSafetyCenterAccess(
        unrelatedParent,
        demoStudent,
        demoSafetyCenterData,
      ),
    ).toMatchObject({
      allowed: false,
      issue: { code: "student_scope_not_authorized" },
    });
  });

  it("fails closed if even one supplied record belongs to another student", () => {
    if (demoSafetyCenterData.safetyEvents.status !== "ready") {
      throw new Error("Demo events must be ready.");
    }
    const contaminated: SafetyCenterData = {
      ...demoSafetyCenterData,
      safetyEvents: {
        status: "ready",
        items: [
          ...demoSafetyCenterData.safetyEvents.items,
          {
            ...demoSafetyCenterData.safetyEvents.items[0],
            studentRef: "student:sibling",
            eventRef: "event:cross-student",
          },
        ],
      },
    };

    expect(
      evaluateSafetyCenterAccess(
        demoParentViewer,
        demoStudent,
        contaminated,
      ),
    ).toMatchObject({
      allowed: false,
      issue: { code: "projection_scope_mismatch" },
    });

    const markup = renderToStaticMarkup(
      <AiSafetyCenter
        viewer={demoParentViewer}
        student={demoStudent}
        data={contaminated}
        onAction={vi.fn()}
      />,
    );
    expect(markup).toContain("Student information stays hidden");
    expect(markup).not.toContain(demoStudent.displayName);
    expect(markup).not.toContain("event:cross-student");
  });

  it("restricts parent and student mutations to their own action set", () => {
    const studentReport: SafetyCenterAction = {
      type: "student_report_submitted",
      studentRef: DEMO_STUDENT_REF,
      category: "unhelpful",
    };
    const permissionsUpdate: SafetyCenterAction = {
      type: "permissions_update_requested",
      studentRef: DEMO_STUDENT_REF,
      expectedRevision: demoSafetyCenterData.permissions.revision,
      settings: demoSafetyCenterData.permissions,
    };
    const studentPause: SafetyCenterAction = {
      type: "tutor_pause_requested",
      studentRef: DEMO_STUDENT_REF,
      source: "student_block",
    };

    expect(roleMayDispatchAction("student", studentReport)).toBe(true);
    expect(roleMayDispatchAction("parent", studentReport)).toBe(false);
    expect(roleMayDispatchAction("parent", permissionsUpdate)).toBe(true);
    expect(roleMayDispatchAction("student", permissionsUpdate)).toBe(false);
    expect(roleMayDispatchAction("student", studentPause)).toBe(true);
    expect(roleMayDispatchAction("parent", studentPause)).toBe(false);
  });
});

describe("AI Safety Center filtering", () => {
  it("searches transcript text and combines subject and date filters", () => {
    if (demoSafetyCenterData.instructionalHistory.status !== "ready") {
      throw new Error("Demo history must be ready.");
    }

    expect(
      filterInstructionalSessions(
        demoSafetyCenterData.instructionalHistory.items,
        {
          query: "denominator",
          subjectRef: "subject:math",
          fromDate: "2026-07-28",
          toDate: "2026-07-28",
        },
      ).map((session) => session.sessionRef),
    ).toEqual(["session:math-fractions-042"]);

    expect(
      filterInstructionalSessions(
        demoSafetyCenterData.instructionalHistory.items,
        {
          query: "",
          subjectRef: "subject:math",
          fromDate: "2026-07-29",
          toDate: "",
        },
      ),
    ).toEqual([]);
  });

  it("keeps safety event filtering separate from instructional history", () => {
    if (demoSafetyCenterData.safetyEvents.status !== "ready") {
      throw new Error("Demo events must be ready.");
    }

    expect(
      filterSafetyEvents(demoSafetyCenterData.safetyEvents.items, {
        query: "address",
        subjectRef: "subject:science",
        fromDate: "",
        toDate: "",
      }).map((event) => event.eventRef),
    ).toEqual(["event:privacy-002"]);
  });
});
