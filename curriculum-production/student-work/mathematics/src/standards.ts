/**
 * Standard codes are authored at two granularities. A lesson record may cite
 * the parent standard 8.EE.8 while the item generator for that unit reports the
 * sub-standard 8.EE.8a. Those describe the same content at different levels of
 * detail, so a sub-standard counts as covering its parent and vice versa.
 *
 * Matching is deliberately narrow: only a trailing lowercase letter is treated
 * as a sub-standard suffix, so 8.EE.8 never matches 8.EE.80.
 */

const parentOf = (standard: string): string =>
  /[a-z]$/.test(standard) ? standard.slice(0, -1) : standard

export const standardsAlign = (left: string, right: string): boolean =>
  left === right || parentOf(left) === right || left === parentOf(right)

export const standardCoveredBy = (
  standard: string,
  lessonStandards: readonly string[],
): boolean => lessonStandards.some((candidate) => standardsAlign(standard, candidate))
