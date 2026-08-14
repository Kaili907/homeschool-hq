/**
 * Resolves, per grade + subject, the absolute filesystem path to the source
 * course directory this generator reads from. Three read-only source
 * branches are combined here; this package owns none of them:
 *
 *   - Grade 3 Health:   mac/g3-health-h2            (commit 50399a6)
 *   - Grade 3 PE/G4:    mac/g34-health-pe-r1        (commit d0ebaa0)
 *   - Canonical 5/7/8:  shared base curriculum-content (commit 656efba onward)
 *   - HS 9-12 Health:   mac/hs912-health-pe-r1       (commit e39e2b3)
 *   - HS 9-12 PE:       this repair branch's canonical authoring tree
 *
 * The G3/4 and HS Health sources have not merged into this branch yet, so
 * those are read from sibling git worktrees at generation time via
 * SOURCE_WORKTREES below. Canonical HS PE is owned by this correction lane.
 * The canonical 5/7/8 content ships in every worktree's shared base.
 *
 * Regenerating after the remaining source branches merge only requires
 * updating their SOURCE_WORKTREES entries to this worktree.
 */
import { resolve } from 'node:path'

const THIS_WORKTREE = resolve(new URL('../../../../../', import.meta.url).pathname)
const WORKTREES_ROOT = resolve(THIS_WORKTREE, '..')

export const SOURCE_WORKTREES = {
  G3_HEALTH_H2: process.env.MA_SOURCE_G3_HEALTH_H2
    ?? resolve(WORKTREES_ROOT, 'mac-g3-health-h2'),
  G34_HEALTH_PE: process.env.MA_SOURCE_G34_HEALTH_PE
    ?? resolve(WORKTREES_ROOT, 'mac-g34-health-pe-r1'),
  HS912_HEALTH_PE: process.env.MA_SOURCE_HS912_HEALTH_PE
    ?? resolve(WORKTREES_ROOT, 'mac-hs912-health-pe-r1'),
}

export const SUPPORTED_GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]

export function courseDir(grade, subject) {
  if (grade === 3 && subject === 'health') {
    return resolve(
      SOURCE_WORKTREES.G3_HEALTH_H2,
      'curriculum-authoring/full-family-grade34/subjects/health/grade-3',
    )
  }
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
  if (grade >= 9 && grade <= 12 && subject === 'physical-education') {
    return resolve(
      THIS_WORKTREE,
      `curriculum-authoring/full-family-highschool-9-12/subjects/${subject}/build/grade-${grade}/courses/${subject}`,
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

export function sourceBranchLabel(grade, subject) {
  if (grade === 3 && subject === 'health') return 'mac/g3-health-h2@50399a6fb6ae095907c0fde25db2a15ca85c6f1f'
  if (grade === 3 || grade === 4) return 'mac/g34-health-pe-r1@d0ebaa010cd01d7565967b4578d415dc7c8ee434'
  if (grade === 5 || grade === 7 || grade === 8) return 'shared base@656efba (canonical 5/7/8)'
  if (subject === 'physical-education') return 'mac/pe-transfer-authority-fix-r1 (canonical HS PE repair)'
  return 'mac/hs912-health-pe-r1@e39e2b343c41a1a800825651159e0e962d5288d7'
}
