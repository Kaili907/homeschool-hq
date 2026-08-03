import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ParentDashboardPrototype,
  applyParentControlEvent,
  auditParentDashboardPrivacy,
  auditPrivateNoteIsolation,
  createParentDashboardDemoModel,
  InMemoryParentDashboardAdapter,
} from "../../parent/index.js";

describe("parent dashboard demonstration", () => {
  it("renders every requested Today, Learning, and Study Habits category", () => {
    const markup = renderToStaticMarkup(<ParentDashboardPrototype />);

    for (const expected of [
      "TODAY",
      "Scheduled blocks",
      "Completed blocks",
      "Skills reviewed",
      "Breaks taken",
      "Resumable work",
      "Assignments needing support",
      "LEARNING",
      "Mastered skills",
      "Developing skills",
      "Prerequisite gaps",
      "Upcoming reviews",
      "Repeated misconceptions",
      "STUDY HABITS",
      "Best-performing task lengths",
      "Subjects that benefit from shorter sections",
      "Approved breaks",
      "Suggested increase, maintain, or decrease",
      "Evidence supporting the recommendation",
    ]) {
      expect(markup).toContain(expected);
    }
  });

  it("uses observational work-block language and the resumable lesson example", () => {
    const markup = renderToStaticMarkup(<ParentDashboardPrototype />);

    expect(markup).toContain(
      "Current effective math work-block range: 18–22 minutes",
    );
    expect(markup).not.toMatch(/attention span: 18 minutes/i);
    expect(markup).toContain("Fractions Lesson");
    expect(markup).toContain("3 of 6 sections complete");
    expect(markup).toContain("Estimated time remaining: 16 minutes");
    expect(markup).toContain("Resume at: Guided Practice");
    expect(markup).toContain(
      "Nice progress—you can continue with Guided Practice when you’re ready.",
    );
  });

  it("shows all parent controls in the working mock", () => {
    const markup = renderToStaticMarkup(<ParentDashboardPrototype />);

    for (const control of [
      "accept-recommendation",
      "reject-recommendation",
      "set-maximum-work-duration",
      "set-break-duration",
      "hide-timers",
      "add-accommodation",
      "reschedule-incomplete-work",
      "mark-outside-interruption",
      "mark-technical-interruption",
      "add-private-note",
      "request-teacher-review",
      "request-tutor-review",
    ]) {
      expect(markup).toContain(`data-control="${control}"`);
    }
  });

  it("passes the dashboard privacy audit with visible evidence", () => {
    const model = createParentDashboardDemoModel();

    expect(auditParentDashboardPrivacy(model.snapshot)).toEqual([]);
    expect(
      model.snapshot.studyHabits.recommendation.evidence.length,
    ).toBeGreaterThan(0);
    expect(
      model.snapshot.learning.repeatedMisconceptions[0]?.evidence.length,
    ).toBeGreaterThan(0);
  });

  it("flags a reviewed skill whose parent-visible evidence is missing", () => {
    const model = createParentDashboardDemoModel();
    const snapshot = {
      ...model.snapshot,
      today: {
        ...model.snapshot.today,
        skillsReviewed: model.snapshot.today.skillsReviewed.map(
          (skill, index) =>
            index === 0 ? { ...skill, evidence: [] } : skill,
        ),
      },
    };

    expect(auditParentDashboardPrivacy(snapshot)).toContainEqual(
      expect.objectContaining({
        code: "missing_evidence",
        path: "snapshot.today.skillsReviewed[0].evidence",
      }),
    );
  });

  it("keeps a parent private note out of the rendered dashboard", () => {
    const model = createParentDashboardDemoModel();
    const withNote = applyParentControlEvent(model, {
      type: "private_note_added",
      noteRef: "note:parent-only-01",
      body: "Try the paper fraction circles before Thursday.",
      at: "2026-07-28T12:00:00-04:00",
    });
    const markup = renderToStaticMarkup(
      <ParentDashboardPrototype initialModel={withNote} />,
    );

    expect(markup).not.toContain(
      "Try the paper fraction circles before Thursday.",
    );
    expect(markup.replaceAll("<!-- -->", "")).toContain("Private notes: 1");
    expect(auditPrivateNoteIsolation(withNote.snapshot, withNote.controls)).toEqual(
      [],
    );
  });

  it("provides a credential-free in-memory adapter demonstration", async () => {
    const adapter = new InMemoryParentDashboardAdapter(
      createParentDashboardDemoModel(),
    );

    const next = await adapter.dispatch({
      type: "timers_hidden_set",
      hidden: true,
      at: "2026-07-28T12:05:00-04:00",
    });
    const loadedAgain = await adapter.load();

    expect(next.controls.timersHidden).toBe(true);
    expect(loadedAgain).toStrictEqual(next);
    expect(JSON.stringify(loadedAgain)).not.toMatch(
      /password|access.?token|refresh.?token|login.?credential/i,
    );
  });
});
