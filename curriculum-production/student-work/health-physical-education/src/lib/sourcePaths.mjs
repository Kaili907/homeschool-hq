/**
 * Resolves, per grade + subject, the absolute filesystem path to the source
 * course directory this generator reads from. Three read-only source
 * branches are combined here; this package owns none of them:
 *
 *   - Grade 3/4:        mac/g34-health-pe-r1        (commit d0ebaa0)
 *   - Canonical 5/7/8:  shared base curriculum-content (commit 656efba onward)
 *   - HS 9-12:          mac/hs912-health-pe-r1       (commit e39e2b3)
 *
 * The G3/4 and HS 9-12 branches have not merged into this branch yet, so
 * those two are read from sibling git worktrees at generation time via
 * SOURCE_WORKTREES below. The canonical 5/7/8 content ships in every
 * worktree's shared base and is read from this worktree directly.
 *
 * Regenerating after those branches merge only requires updating
 * SOURCE_WORKTREES.G34_HEALTH_PE / HS912_HEALTH_PE to point at this
 * worktree's own curriculum-authoring tree instead of a sibling path.
 */
import { resolve } from 'node:path'

const THIS_WORKTREE = resolve(new URL('../../../../../', import.meta.url).pathname)
const WORKTREES_ROOT = resolve(THIS_WORKTREE, '..')

export const SOURCE_WORKTREES = {
  G34_HEALTH_PE: process.env.MA_SOURCE_G34_HEALTH_PE
    ?? resolve(WORKTREES_ROOT, 'mac-g34-health-pe-r1'),
  HS912_HEALTH_PE: process.env.MA_SOURCE_HS912_HEALTH_PE
    ?? resolve(WORKTREES_ROOT, 'mac-hs912-health-pe-r1'),
}

export const SUPPORTED_GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]

export function courseDir(grade, subject) {
  if (grade === 3 || grade === 4) {
    return resolve(
      SOURCE_WORKTREES.G34_HEALTH_PE,
      `curriculum-authoring/full-family-grade34/subjects/${subject}/grade-${grade}`,
    )
  }
  if (grade === 5 || grade === 7 || grade === 8) {
    return resolve(
      THIS_WORKTREE,
      `curriculum-content/manuel-academy/1.0.0/grades/grade-${grade}/courses/${subject}`,
    )
  }
  if (grade >= 9 && grade <= 12) {
    return resolve(
      SOURCE_WORKTREES.HS912_HEALTH_PE,
      `curriculum-authoring/full-family-highschool-9-12/subjects/${subject}/build/grade-${grade}/courses/${subject}`,
    )
  }
  throw new Error(`unsupported grade: ${grade}`)
}

export function sourceBranchLabel(grade) {
  if (grade === 3 || grade === 4) return 'mac/g34-health-pe-r1@d0ebaa0'
  if (grade === 5 || grade === 7 || grade === 8) return 'shared base@656efba (canonical 5/7/8)'
  return 'mac/hs912-health-pe-r1@e39e2b3'
}
