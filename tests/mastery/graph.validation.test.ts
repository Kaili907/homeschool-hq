import { describe, expect, it } from "vitest";
import {
  MasteryValidationError,
  asSkillId,
  asStudentId,
  createSkillGraph,
  findPrerequisiteCycles,
  isStableId,
  masteryRecordStorageKeyFor,
  topologicallySortSkills,
  validateSkillGraph,
} from "../../adaptive-learning/mastery/index.ts";

function validGraphPayload(): Record<string, unknown> {
  return {
    kind: "mastery-skill-graph",
    schemaVersion: 1,
    id: "graph.math.test",
    revision: 1,
    subjectId: "subject.math",
    title: "Math validation graph",
    skills: [
      {
        id: "math.foundation",
        subjectId: "subject.math",
        title: "Foundation",
        learningObjective: "I can demonstrate the foundation independently.",
        description: "A stable foundation skill.",
        gradeBand: "middle-6-8",
        domain: "number",
      },
      {
        id: "math.application",
        subjectId: "subject.math",
        title: "Application",
        learningObjective: "I can apply the foundation independently.",
        description: "A dependent application skill.",
        gradeBand: "middle-6-8",
        domain: "number",
      },
      {
        id: "math.transfer",
        subjectId: "subject.math",
        title: "Transfer",
        learningObjective: "I can transfer the skill to a new context.",
        description: "A second dependent skill.",
        gradeBand: "middle-6-8",
        domain: "number",
      },
    ],
    prerequisites: [
      {
        prerequisiteSkillId: "math.foundation",
        dependentSkillId: "math.application",
        relation: "required",
        rationale: "The application depends on the foundation.",
      },
      {
        prerequisiteSkillId: "math.application",
        dependentSkillId: "math.transfer",
        relation: "required",
        rationale: "Transfer follows successful application.",
      },
    ],
  };
}

function issueCodes(result: ReturnType<typeof validateSkillGraph>): string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe("stable mastery identifiers", () => {
  it("preserves opaque IDs and creates a stable tuple key without display text", () => {
    const studentId = asStudentId("student:legacy-p1");
    const skillId = asSkillId("legacy/path/fracUnit-");

    expect(skillId).toBe("legacy/path/fracUnit-");
    expect(masteryRecordStorageKeyFor(studentId, skillId)).toEqual([
      "student:legacy-p1",
      "student-skill-mastery",
      "legacy/path/fracUnit-",
    ]);
    expect(isStableId("path/segment")).toBe(true);
    expect(isStableId("trailing-")).toBe(true);
  });

  it.each([
    "",
    "contains whitespace",
    ".leading-dot",
    `too-long-${"x".repeat(128)}`,
  ])("rejects an unstable identifier: %s", (candidate) => {
    expect(isStableId(candidate)).toBe(false);
    expect(() => asSkillId(candidate)).toThrow(TypeError);
  });
});

describe("skill graph runtime validation", () => {
  it("accepts a valid directed graph and preserves stable skill IDs", () => {
    const result = validateSkillGraph(validGraphPayload());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.skills.map((skill) => skill.id)).toEqual([
      "math.foundation",
      "math.application",
      "math.transfer",
    ]);
    expect(topologicallySortSkills(result.value).map((skill) => skill.id)).toEqual(
      ["math.foundation", "math.application", "math.transfer"],
    );
  });

  it("rejects non-object, unknown-kind, and future-schema payloads", () => {
    expect(issueCodes(validateSkillGraph("not a graph"))).toContain(
      "invalid_type",
    );

    const unknownKind = {
      ...validGraphPayload(),
      kind: "unknown-graph-kind",
    };
    expect(issueCodes(validateSkillGraph(unknownKind))).toContain(
      "invalid_discriminant",
    );

    const futureVersion = {
      ...validGraphPayload(),
      schemaVersion: 2,
    };
    expect(issueCodes(validateSkillGraph(futureVersion))).toContain(
      "unsupported_schema_version",
    );
  });

  it("rejects duplicate skill IDs", () => {
    const payload = validGraphPayload();
    const skills = payload.skills as Record<string, unknown>[];
    payload.skills = [...skills, { ...skills[0] }];

    const result = validateSkillGraph(payload);

    expect(issueCodes(result)).toContain("duplicate_skill_id");
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "$.skills[3].id",
            code: "duplicate_skill_id",
          }),
        ]),
      );
    }
  });

  it("rejects missing prerequisite and dependent references", () => {
    const missingPrerequisite = validGraphPayload();
    missingPrerequisite.prerequisites = [
      {
        prerequisiteSkillId: "math.missing",
        dependentSkillId: "math.application",
        relation: "required",
        rationale: "Invalid dangling prerequisite.",
      },
    ];

    const missingDependent = validGraphPayload();
    missingDependent.prerequisites = [
      {
        prerequisiteSkillId: "math.foundation",
        dependentSkillId: "math.missing",
        relation: "required",
        rationale: "Invalid dangling dependent.",
      },
    ];

    expect(issueCodes(validateSkillGraph(missingPrerequisite))).toContain(
      "dangling_prerequisite",
    );
    expect(issueCodes(validateSkillGraph(missingDependent))).toContain(
      "dangling_dependent",
    );
  });

  it("rejects duplicate and self-referential edges", () => {
    const duplicate = validGraphPayload();
    const prerequisites = duplicate.prerequisites as Record<string, unknown>[];
    duplicate.prerequisites = [...prerequisites, { ...prerequisites[0] }];
    expect(issueCodes(validateSkillGraph(duplicate))).toContain("duplicate_edge");

    const selfReference = validGraphPayload();
    selfReference.prerequisites = [
      {
        prerequisiteSkillId: "math.foundation",
        dependentSkillId: "math.foundation",
        relation: "required",
        rationale: "Invalid self-reference.",
      },
    ];
    expect(issueCodes(validateSkillGraph(selfReference))).toContain(
      "self_dependency",
    );
  });

  it("detects and rejects a multi-skill circular dependency", () => {
    const cyclePayload = validGraphPayload();
    cyclePayload.prerequisites = [
      ...(cyclePayload.prerequisites as Record<string, unknown>[]),
      {
        prerequisiteSkillId: "math.transfer",
        dependentSkillId: "math.foundation",
        relation: "required",
        rationale: "Creates a cycle for validation.",
      },
    ];

    const result = validateSkillGraph(cyclePayload);

    expect(issueCodes(result)).toContain("circular_dependency");
    if (!result.ok) {
      expect(
        result.issues.find((issue) => issue.code === "circular_dependency")
          ?.message,
      ).toContain(
        "math.foundation -> math.application -> math.transfer -> math.foundation",
      );
    }
  });

  it("returns a deterministic closed cycle path for diagnostics", () => {
    const valid = validateSkillGraph(validGraphPayload());
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;

    const cyclicGraph = {
      ...valid.value,
      prerequisites: [
        ...valid.value.prerequisites,
        {
          prerequisiteSkillId: asSkillId("math.transfer"),
          dependentSkillId: asSkillId("math.foundation"),
          relation: "required" as const,
          rationale: "Creates a closed path.",
        },
      ],
    };

    expect(findPrerequisiteCycles(cyclicGraph)).toEqual([
      [
        "math.foundation",
        "math.application",
        "math.transfer",
        "math.foundation",
      ],
    ]);
  });

  it("throws a structured validation error at the creation boundary", () => {
    const result = validateSkillGraph(validGraphPayload());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const cyclicGraph = {
      ...result.value,
      prerequisites: [
        ...result.value.prerequisites,
        {
          prerequisiteSkillId: asSkillId("math.transfer"),
          dependentSkillId: asSkillId("math.foundation"),
          relation: "required" as const,
          rationale: "Creates a closed path.",
        },
      ],
    };

    expect(() => createSkillGraph(cyclicGraph)).toThrow(MasteryValidationError);
  });
});
