/**
 * Registry of the 18 source courses (2 subjects x 9 grades) this lesson-level
 * corpus is generated from. Mirrors the unit-level registry in
 * ../technology-arts/src/courses.mjs, but resolves each course's
 * `lessons.jsonl` (one authored lesson per line) instead of units.json, and
 * still resolves units.json/assessments.json for the unit context a lesson
 * task has to sit inside.
 *
 * G3/4 and HS 9-12 sources live in sibling git worktrees of the same
 * repository (not merged into this branch), so their paths resolve against
 * the worktrees directory and can be overridden with TECH_ARTS_G34_ROOT /
 * TECH_ARTS_HS_ROOT. Canonical grades 5/7/8 live in this worktree's own
 * curriculum-content package.
 */
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const THIS_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(THIS_DIR, '../../../..')
const WORKTREES_ROOT = resolve(REPO_ROOT, '..')

const CANONICAL_GRADES_ROOT = resolve(
  REPO_ROOT,
  'curriculum-content/manuel-academy/1.0.0/grades',
)

const G34_ROOT =
  process.env.TECH_ARTS_G34_ROOT ??
  resolve(WORKTREES_ROOT, 'mac-g34-tech-arts-r1/curriculum-authoring/full-family-grade34/subjects')

const HS_ROOT =
  process.env.TECH_ARTS_HS_ROOT ??
  resolve(
    WORKTREES_ROOT,
    'mac-hs912-tech-arts-r1/curriculum-authoring/full-family-highschool-9-12/subjects',
  )

function course(band, base, grade, subjectKey) {
  return {
    band,
    grade,
    gradeDir: `grade-${String(grade).padStart(2, '0')}`,
    subjectKey,
    lessonsPath: resolve(base, 'lessons.jsonl'),
    unitsPath: resolve(base, 'units.json'),
    assessmentsPath: resolve(base, 'assessments.json'),
  }
}

const canonicalCourse = (grade, folder, subjectKey) =>
  course(
    'canonical-5-7-8',
    resolve(CANONICAL_GRADES_ROOT, `grade-${grade}`, 'courses', folder),
    grade,
    subjectKey,
  )

const g34Course = (grade, folder, subjectKey) =>
  course('g3-4', resolve(G34_ROOT, folder, `grade-${grade}`), grade, subjectKey)

const hsCourse = (grade, folder, subjectKey) =>
  course(
    'hs-9-12',
    resolve(HS_ROOT, folder, `grade-${String(grade).padStart(2, '0')}`),
    grade,
    subjectKey,
  )

export const COURSES = [
  g34Course(3, 'technology-computer-science', 'technology'),
  g34Course(4, 'technology-computer-science', 'technology'),
  canonicalCourse(5, 'technology', 'technology'),
  canonicalCourse(7, 'technology', 'technology'),
  canonicalCourse(8, 'technology', 'technology'),
  hsCourse(9, 'technology-computer-science', 'technology'),
  hsCourse(10, 'technology-computer-science', 'technology'),
  hsCourse(11, 'technology-computer-science', 'technology'),
  hsCourse(12, 'technology-computer-science', 'technology'),

  g34Course(3, 'arts-music', 'arts-music'),
  g34Course(4, 'arts-music', 'arts-music'),
  canonicalCourse(5, 'arts-and-music', 'arts-music'),
  canonicalCourse(7, 'arts-and-music', 'arts-music'),
  canonicalCourse(8, 'arts-and-music', 'arts-music'),
  hsCourse(9, 'arts-music', 'arts-music'),
  hsCourse(10, 'arts-music', 'arts-music'),
  hsCourse(11, 'arts-music', 'arts-music'),
  hsCourse(12, 'arts-music', 'arts-music'),
]
