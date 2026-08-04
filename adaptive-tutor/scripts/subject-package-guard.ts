/**
 * Final subject packages are forbidden in-tree unless dispatcher-authorized.
 * The frozen Math R1 package mounted at the top-level subjects/math path
 * (D-MATH-2) is the only authorized package; any other subjects/<id> entry —
 * including a subjects/math tree at any other depth — must keep failing
 * validation.
 */
export const AUTHORIZED_SUBJECT_PACKAGE_PATHS: readonly string[] = [
  "subjects/math/",
];

export function findUnauthorizedSubjectPackageFiles(
  relativeFiles: readonly string[],
): string[] {
  return relativeFiles.filter((file) => {
    if (!/(?:^|\/)subjects\//.test(file)) return false;
    return !AUTHORIZED_SUBJECT_PACKAGE_PATHS.some((path) =>
      file.startsWith(path),
    );
  });
}
