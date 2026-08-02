import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MASTERY_STATES, type MasteryState } from "../../adaptive-learning/mastery/index.ts";
import { AccessibleMasteryList } from "../../app/features/mastery/AccessibleMasteryList.tsx";
import { ParentSkillDetail } from "../../app/features/mastery/ParentSkillDetail.tsx";
import { StudentMasteryMap } from "../../app/features/mastery/StudentMasteryMap.tsx";
import { MasteryStatusBadge } from "../../app/features/mastery/MasteryStatusBadge.tsx";
import {
  DEFAULT_MASTERY_FILTERS,
  type MasteryFiltersValue,
} from "../../app/features/mastery/model.ts";
import {
  countActiveMasteryFilters,
  filterMasterySkills,
  getMasteryFilterOptions,
  groupSkillsBySubject,
} from "../../app/features/mastery/filtering.ts";
import {
  MASTERY_STATE_ORDER,
  getMasteryStatePresentation,
} from "../../app/features/mastery/statusPresentation.ts";
import { allStateDashboardModel } from "./ui-fixture.ts";

describe("student mastery filtering", () => {
  it("offers subject, state, and grade-band options from the visible model", () => {
    const options = getMasteryFilterOptions(allStateDashboardModel);

    expect(options.subjects).toEqual(["English", "Math"]);
    expect(options.gradeBands).toEqual(["High 9-12", "Middle 6-8"]);
    expect(options.states).toEqual(MASTERY_STATE_ORDER);
  });

  it("combines subject, state, and grade-band filters without mutating skills", () => {
    const original = [...allStateDashboardModel.skills];
    const filters: MasteryFiltersValue = {
      subject: "English",
      state: "evidence_uncertain",
      gradeBand: "High 9-12",
    };

    const filtered = filterMasterySkills(
      allStateDashboardModel.skills,
      filters,
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      subject: "English",
      state: "evidence_uncertain",
      gradeBand: "High 9-12",
    });
    expect(allStateDashboardModel.skills).toEqual(original);
    expect(countActiveMasteryFilters(filters)).toBe(3);
    expect(countActiveMasteryFilters(DEFAULT_MASTERY_FILTERS)).toBe(0);
  });

  it("groups skills by subject and prerequisite depth", () => {
    const grouped = groupSkillsBySubject([
      allStateDashboardModel.skills[3],
      allStateDashboardModel.skills[1],
      allStateDashboardModel.skills[5],
      allStateDashboardModel.skills[4],
    ]);

    expect([...grouped.keys()]).toEqual(["English", "Math"]);
    expect(
      grouped.get("Math")?.map((skill) => skill.graphLevel),
    ).toEqual([1, 3]);
  });
});

describe("status communication independent of color", () => {
  it("keeps the engine and interface state lists in exact sync", () => {
    expect(MASTERY_STATE_ORDER).toEqual(MASTERY_STATES);
  });

  it.each(MASTERY_STATES)(
    "renders visible text and a hidden decorative signal for %s",
    (state: MasteryState) => {
      const presentation = getMasteryStatePresentation(state);
      const markup = renderToStaticMarkup(
        <MasteryStatusBadge state={state} />,
      );

      expect(markup).toContain(`data-state="${state}"`);
      expect(markup).toContain(presentation.label);
      expect(markup).toContain('aria-hidden="true"');
    },
  );
});

describe("accessible nonvisual mastery view", () => {
  it("renders an ordered, named text list with semantic skill facts", () => {
    const markup = renderToStaticMarkup(
      <AccessibleMasteryList
        skills={allStateDashboardModel.skills}
        selectedSkillId={allStateDashboardModel.skills[0].skillId}
        onSelectSkill={() => undefined}
      />,
    );

    expect(markup).toContain("<ol");
    expect(markup).toContain('aria-label="Mastery skills in text format"');
    expect(markup).toContain("<article");
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain("<dl");
    expect(markup).toContain("<dt>Prerequisite path</dt>");
    expect(markup).toContain("<dt>Confidence</dt>");
    expect(markup).toContain("<dt>Last independent demonstration</dt>");
    expect(markup).toContain("<dt>Next step</dt>");
    expect(markup).toContain("<strong>Why this state</strong>");
    expect(markup).toContain('aria-pressed="true"');

    for (const state of MASTERY_STATES) {
      expect(markup).toContain(getMasteryStatePresentation(state).label);
    }
  });

  it("provides a polite status message when filters return no skills", () => {
    const markup = renderToStaticMarkup(
      <AccessibleMasteryList skills={[]} />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("No skills match these filters.");
  });

  it("renders labeled filter controls and an explicit accessible-list view", () => {
    const markup = renderToStaticMarkup(
      <StudentMasteryMap
        model={allStateDashboardModel}
        initialView="list"
      />,
    );

    expect(markup).toContain("Filter the mastery map");
    expect(markup).toMatch(/<label for="[^"]+-subject">/);
    expect(markup).toMatch(/<label for="[^"]+-state">/);
    expect(markup).toMatch(/<label for="[^"]+-grade-band">/);
    expect(markup).toContain(">Subject</span>");
    expect(markup).toContain(">Mastery state</span>");
    expect(markup).toContain(">Grade band</span>");
    expect(markup).toContain('aria-label="Mastery map view"');
    expect(markup).toContain('aria-pressed="true">Accessible list</button>');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });
});

describe("parent skill-detail questions", () => {
  it("answers all six required questions with semantic evidence detail", () => {
    const skill = allStateDashboardModel.skills.find(
      (candidate) => candidate.state === "blocked_by_prerequisite",
    );
    expect(skill).toBeDefined();
    if (!skill) return;

    const markup = renderToStaticMarkup(
      <ParentSkillDetail
        learnerName={allStateDashboardModel.learner.displayName}
        studentId={allStateDashboardModel.learner.studentId}
        skill={skill}
      />,
    );

    const requiredQuestions = [
      "What is the student learning?",
      "What prerequisite is blocking progress?",
      "What evidence supports the current state?",
      "How confident is the system?",
      "What should happen next?",
      "When did the student last demonstrate the skill independently?",
    ];

    for (const question of requiredQuestions) {
      expect(markup).toContain(`<h3>${question}</h3>`);
    }

    expect(markup).toContain("Blocked by prerequisite");
    expect(markup).toContain("Multiply fractions");
    expect(markup).toContain("<ol");
    expect(markup).toContain("<meter");
    expect(markup).toContain(
      "No independent demonstration has been recorded.",
    );
    expect(markup).toContain("Manual parent or teacher override");
    expect(markup).toContain("Override audit history (1)");
  });

  it("states that completion alone is not mastery when evidence is absent", () => {
    const skill = allStateDashboardModel.skills.find(
      (candidate) => candidate.state === "not_yet_assessed",
    );
    expect(skill).toBeDefined();
    if (!skill) return;

    const markup = renderToStaticMarkup(
      <ParentSkillDetail
        learnerName={allStateDashboardModel.learner.displayName}
        studentId={allStateDashboardModel.learner.studentId}
        skill={skill}
      />,
    );

    expect(markup).toContain(
      "Completion by itself is not treated as mastery.",
    );
  });
});
