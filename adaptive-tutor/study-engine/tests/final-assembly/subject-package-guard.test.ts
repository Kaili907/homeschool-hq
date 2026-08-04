import {
  AUTHORIZED_SUBJECT_PACKAGE_PATHS,
  findUnauthorizedSubjectPackageFiles,
} from "../../../scripts/subject-package-guard.ts";

describe("subject package guard", () => {
  it("authorizes exactly the top-level subjects/math package path", () => {
    expect(AUTHORIZED_SUBJECT_PACKAGE_PATHS).toEqual(["subjects/math/"]);
  });

  it("accepts files under the authorized subjects/math mount", () => {
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
      "subjects/README.md",
      "study-engine/vendor/subjects/english/index.ts",
    ];
    expect(findUnauthorizedSubjectPackageFiles(unauthorized)).toEqual(
      unauthorized,
    );
  });

  it("rejects a subjects/math tree anywhere other than the authorized mount", () => {
    const shadowed = [
      "core/subjects/math/rogue-sequence.ts",
      "study-engine/vendor/subjects/math/index.ts",
      "examples/subjects/math/tampered-sequence.ts",
    ];
    expect(findUnauthorizedSubjectPackageFiles(shadowed)).toEqual(shadowed);
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
