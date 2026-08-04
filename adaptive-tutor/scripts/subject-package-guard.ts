/**
 * Final subject packages are forbidden in-tree unless dispatcher-authorized.
 * subjects/math (Math R1, D-MATH-2) is the only authorized package; every
 * other subjects/<id> entry must keep failing validation.
 */
export const AUTHORIZED_SUBJECT_PACKAGES: readonly string[] = ["math"];

export function findUnauthorizedSubjectPackageFiles(
  relativeFiles: readonly string[],
): string[] {
  return relativeFiles.filter((file) => {
    const match = /(?:^|\/)subjects\/([^/]+)/.exec(file);
    if (!match) return false;
    const subject = match[1];
    if (!subject) return true;
    return !AUTHORIZED_SUBJECT_PACKAGES.includes(subject);
  });
}
