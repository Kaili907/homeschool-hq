import {
  AUTHORIZED_SUBJECT_PACKAGES,
  findUnauthorizedSubjectPackageFiles,
} from "../../../scripts/subject-package-guard.ts";

describe("subject package guard", () => {
  it("authorizes exactly the math subject package", () => {
    expect(AUTHORIZED_SUBJECT_PACKAGES).toEqual(["math"]);
  });

  it("accepts files under the authorized subjects/math package", () => {
    expect(
      findUnauthorizedSubjectPackageFiles([
        "subjects/math/index.ts",
        "subjects/math/lessons/01-place-value-and-regrouping/sequence.json",
        "core/contracts/index.ts",
        "examples/math-interaction.ts",
      ]),
    ).toEqual([]);
  });

  it("keeps rejecting english and every other final subject package", () => {
    const unauthorized = [
      "subjects/english/index.ts",
      "subjects/science/manifest.json",
      "subjects/mathematics/index.ts",
      "study-engine/vendor/subjects/english/index.ts",
    ];
    expect(findUnauthorizedSubjectPackageFiles(unauthorized)).toEqual(
      unauthorized,
    );
  });

  it("ignores paths that merely mention subjects outside a subjects/ directory", () => {
    expect(
      findUnauthorizedSubjectPackageFiles([
        "docs/subjects-overview.md",
        "core/subjects.ts",
      ]),
    ).toEqual([]);
  });
});
