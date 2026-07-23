// ---------- M4 high-school catalog (pure data) ----------
//
// Shared by the generators (geometryGen / algebraGen), the state helpers
// (hsState), and the UI (HighSchoolHome). No React, no generator code here so
// every layer can import the ids/labels without pulling in the SVG or RNG code.

import type { Grade } from '../types'

export interface HsUnit {
  id: string
  name: string
  blurb: string
}

/** The nine Geometry practice units, in teaching order (Build-Spec §M4). */
export const GEOMETRY_UNITS: HsUnit[] = [
  { id: 'angles', name: 'Angles & Parallel Lines', blurb: 'Vertical, linear pairs, transversals' },
  { id: 'congruence', name: 'Triangle Congruence', blurb: 'SSS, SAS, ASA & corresponding parts' },
  { id: 'similarity', name: 'Similarity', blurb: 'Scale factor & proportional sides' },
  { id: 'pythagorean', name: 'Right Triangles', blurb: 'Pythagorean theorem' },
  { id: 'trig', name: 'Trig Ratios', blurb: 'SOH-CAH-TOA' },
  { id: 'quadrilaterals', name: 'Quadrilaterals', blurb: 'Angles & properties' },
  { id: 'circles', name: 'Circles', blurb: 'Circumference & area' },
  { id: 'areaVolume', name: 'Area & Volume', blurb: 'Polygons, prisms & cylinders' },
  { id: 'coordinate', name: 'Coordinate Geometry', blurb: 'Slope, distance & midpoint' },
]

/** Algebra I maintenance topics — the daily 5-question warm-up draws from these. */
export const ALGEBRA_TOPICS: HsUnit[] = [
  { id: 'equations', name: 'Equation Solving', blurb: 'One- & two-step, distribute' },
  { id: 'slope', name: 'Slope', blurb: 'From points & from equations' },
  { id: 'factoring', name: 'Factoring', blurb: 'GCF, trinomials, difference of squares' },
]

export const GEOMETRY_UNIT_IDS = GEOMETRY_UNITS.map((u) => u.id)
export const ALGEBRA_TOPIC_IDS = ALGEBRA_TOPICS.map((u) => u.id)

/** id → name for both catalogs (used to label stats & timed-quiz sources). */
export const HS_UNIT_NAME: Record<string, string> = Object.fromEntries(
  [...GEOMETRY_UNITS, ...ALGEBRA_TOPICS].map((u) => [u.id, u.name]),
)

// ---------- default course tracks (Dad edits these in Grown-Ups) ----------

const unit = (n: number, label?: string): { id: string; label: string; done: boolean } => ({
  id: `u${n}`,
  label: label ?? `Unit ${n}`,
  done: false,
})

const genericUnits = (count: number) => Array.from({ length: count }, (_, i) => unit(i + 1))

const geometryCourseUnits = () =>
  GEOMETRY_UNITS.map((u, i) => ({ id: `u${i + 1}`, label: u.name, done: false }))

/** Seed courses so a teen's home shows whole-year progress across every subject. */
export function defaultCoursesFor(grade: Grade): { id: string; name: string; units: ReturnType<typeof unit>[] }[] {
  if (grade === '10') {
    return [
      { id: 'geometry', name: 'Geometry', units: geometryCourseUnits() },
      { id: 'english10', name: 'English 10', units: genericUnits(6) },
      { id: 'biology', name: 'Biology', units: genericUnits(6) },
      { id: 'worldhist', name: 'World History', units: genericUnits(6) },
      { id: 'elective10', name: 'Elective', units: genericUnits(4) },
    ]
  }
  if (grade === '12') {
    return [
      { id: 'algebra2', name: 'Algebra II', units: genericUnits(8) },
      { id: 'english12', name: 'English 12', units: genericUnits(6) },
      { id: 'goveco', name: 'Government & Economics', units: genericUnits(6) },
      { id: 'science12', name: 'Science', units: genericUnits(6) },
    ]
  }
  return []
}

// ---------- default college-application tasks (senior only) ----------

/**
 * Placeholder senior-year checklist Dad edits. Dates are examples for a
 * 2026–27 applicant; overdue detection is always relative to today, so these
 * simply give Dad a starting point to adjust.
 */
export function defaultCollegeTasks(): { id: string; label: string; due: string; done: boolean }[] {
  return [
    { id: 'c1', label: 'Finalize college list', due: '2026-08-15', done: false },
    { id: 'c2', label: 'Common App essay — first draft', due: '2026-09-15', done: false },
    { id: 'c3', label: 'Request recommendation letters', due: '2026-09-30', done: false },
    { id: 'c4', label: 'Submit FAFSA', due: '2026-10-15', done: false },
    { id: 'c5', label: 'State University application', due: '2026-11-01', done: false },
  ]
}
