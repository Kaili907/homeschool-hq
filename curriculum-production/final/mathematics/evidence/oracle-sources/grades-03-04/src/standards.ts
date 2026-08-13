/**
 * Standard codes are authored at two granularities. A lesson record may cite
 * the parent standard 3.MD.5 while an item generator for that unit reports the
 * sub-standard 3.MD.5a. Those describe the same content at different levels of
 * detail, so a sub-standard counts as covering its parent and vice versa.
 *
 * Matching is deliberately narrow: only a trailing lowercase letter is treated
 * as a sub-standard suffix, so 3.MD.5 never matches 3.MD.50.
 */

const parentOf = (standard: string): string =>
  /[a-z]$/.test(standard) ? standard.slice(0, -1) : standard

export const standardsAlign = (left: string, right: string): boolean =>
  left === right || parentOf(left) === right || left === parentOf(right)

export const standardCoveredBy = (
  standard: string,
  lessonStandards: readonly string[],
): boolean => lessonStandards.some((candidate) => standardsAlign(standard, candidate))
