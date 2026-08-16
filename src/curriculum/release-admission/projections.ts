import type { Lesson, Unit } from '../../curriculum-authoring/v2/contracts.ts'
import {
  ADMISSION_REPORT_VERSION,
  ADMISSION_SCHEMA_SET_VERSION,
  ADMITTED_RELEASE,
  CANONICAL_GRADES,
  type AdmittedRelease,
  type CandidateInspection,
  type GradeCoverage,
} from './types.ts'

/**
 * CURRICULUM-RELEASE-ADMISSION — what an admitted release becomes.
 *
 * Three outputs, all pure and all derived from an AdmittedRelease, which only
 * admitCandidate can produce. None of them re-validate: by the time a release
 * reaches here it has already been admitted, and a second opinion at build
 * time would just be a place for the two answers to disagree.
 */

/**
 * The runtime half of the AdmittedRelease gate. The type says a rejected
 * candidate cannot get here; this makes it so for callers that cast, or that
 * reach these builders from JavaScript.
 */
function assertAdmitted(release: AdmittedRelease): void {
  if (release?.[ADMITTED_RELEASE] !== true) {
    throw new Error('release-admission: refusing to build from a release admitCandidate did not admit')
  }
}

/* ------------------------------------------------------------------ *
 * Browser catalog projection
 * ------------------------------------------------------------------ */

/**
 * Structural twins of CatalogCourse / CatalogUnit / GeneratedLessonRow in
 * src/study/family-pilot/catalog-runtime, restated here for one reason: those
 * types spell grade as AcademyGrade, which is '5' | '7' | '8' today, and a
 * release admitting grades 3, 4, 9, 10, 11, or 12 cannot be typed against it
 * until that union widens. Widening AcademyGrade belongs to the grade and
 * high-school normalization work, not here.
 *
 * Field names, ordering, and the eager-index/lazy-payload split all match the
 * runtime exactly, so this projection drops into createCatalogProvider as-is
 * once the union widens. projections.test.ts pins the field sets against the
 * shipped generated catalog and drives a real provider off this output, so a
 * rename on either side breaks a test rather than rotting silently. The grade
 * union itself is the one thing a cast still bridges.
 */
export interface ProjectedCatalogCourse {
  readonly courseRef: string
  readonly grade: string
  readonly subject: string
  readonly title: string
  readonly days: number
  readonly unitCount: number
  readonly lessonCount: number
}

export interface ProjectedCatalogUnit {
  readonly unitRef: string
  readonly courseRef: string
  readonly grade: string
  readonly subject: string
  readonly unitNumber: number
  readonly title: string
  readonly days: number
  readonly essentialQuestion: string
  readonly assessmentRef: string | null
  readonly lessonRefs: readonly string[]
}

/** One row of a course's lazy payload — see catalog-runtime/rows.ts. */
export interface ProjectedLessonRow {
  readonly lessonRef: string
  readonly unitNumber: number
  readonly dayInUnit: number
  readonly courseDay: number
  readonly title: string
  readonly estimatedMinutes: string
}

/**
 * The data half of CatalogProviderSource. The loaders half stays with the
 * generator that writes the per-course modules, because a static import()
 * specifier is what lets Vite split each course into its own chunk — a value
 * a pure function cannot synthesize without forfeiting the split.
 */
export interface BrowserCatalogProjection {
  readonly releaseVersion: string
  readonly courses: readonly ProjectedCatalogCourse[]
  readonly units: readonly ProjectedCatalogUnit[]
  /** courseRef -> that course's lessons, in course_day order. */
  readonly lessonRowsByCourse: Readonly<Record<string, readonly ProjectedLessonRow[]>>
}

/** The release's own range string, matching the generated payloads' '45–60'. */
function estimatedMinutes(lesson: Lesson): string {
  const { minimum_minutes: minimum, maximum_minutes: maximum } = lesson.estimated_duration
  return minimum === maximum ? `${minimum}` : `${minimum}–${maximum}`
}

function byCourseDay(left: Lesson, right: Lesson): number {
  return left.course_day - right.course_day
}

function byUnitOrder(left: Unit, right: Unit): number {
  return left.order - right.order
}

/**
 * Projects an admitted release into the browser catalog's shape: an eager
 * course/unit index plus per-course lesson rows. Catalog scope only — refs,
 * structure, and display metadata. Lesson bodies stay in the release and the
 * Study content pipeline that already projects them; duplicating them here
 * would put megabytes into the app's initial bundle to say nothing new.
 *
 * Ordering is fixed — courses by ref, units by order, lessons by course_day —
 * so the same release always projects byte-identically.
 */
export function buildBrowserCatalogProjection(release: AdmittedRelease): BrowserCatalogProjection {
  assertAdmitted(release)
  const set = release.candidate.authoring_set
  // Grade first, then the release's own course order. Sorting on course_id
  // alone reads 'ma-g10-...' before 'ma-g3-...', and the provider preserves
  // whatever order it is handed, so the catalog would list grade 10 first.
  const courses = [...set.courses].sort(
    (left, right) =>
      left.grade - right.grade ||
      left.order - right.order ||
      left.course_id.localeCompare(right.course_id),
  )
  const lessonsByCourse = new Map<string, Lesson[]>()
  for (const lesson of set.lessons) {
    const bucket = lessonsByCourse.get(lesson.course_ref)
    if (bucket) bucket.push(lesson)
    else lessonsByCourse.set(lesson.course_ref, [lesson])
  }
  const unitsByCourse = new Map<string, Unit[]>()
  for (const unit of set.units) {
    const bucket = unitsByCourse.get(unit.course_ref)
    if (bucket) bucket.push(unit)
    else unitsByCourse.set(unit.course_ref, [unit])
  }

  const projectedCourses: ProjectedCatalogCourse[] = []
  const projectedUnits: ProjectedCatalogUnit[] = []
  const lessonRowsByCourse: Record<string, readonly ProjectedLessonRow[]> = {}

  for (const course of courses) {
    const courseUnits = [...(unitsByCourse.get(course.course_id) ?? [])].sort(byUnitOrder)
    const courseLessons = [...(lessonsByCourse.get(course.course_id) ?? [])].sort(byCourseDay)
    const grade = String(course.grade)

    projectedCourses.push({
      courseRef: course.course_id,
      grade,
      subject: course.subject,
      title: course.title,
      days: course.days,
      unitCount: courseUnits.length,
      lessonCount: courseLessons.length,
    })

    for (const unit of courseUnits) {
      const unitLessons = set.lessons
        .filter((lesson) => lesson.unit_ref === unit.unit_id)
        .sort((left, right) => left.day_in_unit - right.day_in_unit)
      projectedUnits.push({
        unitRef: unit.unit_id,
        courseRef: course.course_id,
        grade,
        subject: unit.subject,
        unitNumber: unit.order,
        title: unit.title,
        days: unit.days,
        essentialQuestion: unit.essential_question,
        assessmentRef: unit.assessment_ref ?? null,
        lessonRefs: Object.freeze(unitLessons.map((lesson) => lesson.lesson_id)),
      })
    }

    const unitNumberByRef = new Map(courseUnits.map((unit) => [unit.unit_id, unit.order]))
    lessonRowsByCourse[course.course_id] = Object.freeze(
      courseLessons.map((lesson): ProjectedLessonRow => {
        const unitNumber = unitNumberByRef.get(lesson.unit_ref)
        // day_in_unit would often collide with a real unit number, so the
        // provider would quietly file the lesson under the wrong unit instead
        // of raising its own "absent from the index" error.
        if (unitNumber === undefined) {
          throw new Error(
            `release-admission: ${lesson.lesson_id} references unit ${lesson.unit_ref}, absent from the ${course.course_id} index`,
          )
        }
        return {
        lessonRef: lesson.lesson_id,
        unitNumber,
        dayInUnit: lesson.day_in_unit,
        courseDay: lesson.course_day,
        title: lesson.title,
        estimatedMinutes: estimatedMinutes(lesson),
        }
      }),
    )
  }

  return Object.freeze({
    releaseVersion: release.candidate.release_version,
    courses: Object.freeze(projectedCourses),
    units: Object.freeze(projectedUnits),
    lessonRowsByCourse: Object.freeze(lessonRowsByCourse),
  })
}

/* ------------------------------------------------------------------ *
 * Release registry entry
 * ------------------------------------------------------------------ */

export interface ReleaseRegistryGradeEntry {
  readonly grade: number
  readonly courses: number
  readonly units: number
  readonly lessons: number
  readonly subjects: readonly string[]
}

/**
 * The row the release registry records for an admitted release. Deliberately
 * metadata only — counts, coverage, custody, and the gate — matching how
 * academy_curriculum_release_files already stores
 * 'metadata_only_internal_source' rather than content.
 */
export interface ReleaseRegistryEntry {
  readonly report_version: typeof ADMISSION_REPORT_VERSION
  readonly release_version: string
  readonly candidate_id: string
  readonly schema_set_version: typeof ADMISSION_SCHEMA_SET_VERSION
  readonly admission_status: 'ADMITTED'
  readonly graduation_complete: boolean
  readonly grades: readonly ReleaseRegistryGradeEntry[]
  readonly subjects: readonly string[]
  readonly counts: CandidateInspection['counts']
  readonly standards_custody: readonly {
    readonly framework_ref: string
    readonly custodian: string
    readonly attested_framework_version: string
    readonly evidence_locator: string
  }[]
  readonly safety_privacy_gate: CandidateInspection['safety_privacy_gate']
}

function publishedGrades(coverage: readonly GradeCoverage[]): readonly ReleaseRegistryGradeEntry[] {
  return coverage
    .filter((entry) => entry.courses > 0)
    .map((entry) => ({
      grade: entry.grade,
      courses: entry.courses,
      units: entry.units,
      lessons: entry.lessons,
      subjects: entry.subjects,
    }))
}

/**
 * Builds the registry row for an admitted release. Only grades that actually
 * carry courses are listed, so the registry never implies coverage — a grade 6
 * row, in particular, can never appear.
 */
export function buildReleaseRegistryEntry(release: AdmittedRelease): ReleaseRegistryEntry {
  assertAdmitted(release)
  const { candidate, inspection } = release
  return Object.freeze({
    report_version: ADMISSION_REPORT_VERSION,
    release_version: candidate.release_version,
    candidate_id: candidate.candidate_id,
    schema_set_version: ADMISSION_SCHEMA_SET_VERSION,
    admission_status: 'ADMITTED',
    graduation_complete: candidate.graduation_complete,
    grades: Object.freeze(publishedGrades(inspection.coverage)),
    subjects: inspection.observed_subjects,
    counts: inspection.counts,
    standards_custody: Object.freeze(
      [...candidate.standards_custody].sort((left, right) =>
        left.framework_ref.localeCompare(right.framework_ref),
      ),
    ),
    safety_privacy_gate: inspection.safety_privacy_gate,
  })
}

/* ------------------------------------------------------------------ *
 * Readiness evidence
 * ------------------------------------------------------------------ */

export interface ReadinessCheck {
  readonly check: string
  readonly satisfied: boolean
  readonly detail: string
}

export interface ReadinessEvidence {
  readonly report_version: typeof ADMISSION_REPORT_VERSION
  readonly release_version: string
  readonly candidate_id: string
  readonly generated_at: string
  readonly ready: boolean
  readonly checks: readonly ReadinessCheck[]
}

export interface ReadinessEvidenceOptions {
  /** Supplied by the caller so evidence is reproducible; nothing here reads a clock. */
  readonly generatedAt: string
}

/**
 * Restates an admitted release as the evidence a convergence operator reads:
 * one line per admission concern.
 *
 * Every check is recomputed from the census rather than asserted. For a
 * genuinely admitted release the answer is the same either way — but evidence
 * that cannot come back false is not evidence, and a future gap between
 * admission and this report should surface here instead of being stamped
 * READY.
 */
export function buildReadinessEvidence(
  release: AdmittedRelease,
  options: ReadinessEvidenceOptions,
): ReadinessEvidence {
  assertAdmitted(release)
  const { candidate, inspection } = release
  const published = inspection.coverage.filter((entry) => entry.courses > 0)
  const custody = new Set(inspection.custody_frameworks)
  const uncovered = inspection.coverage.filter((entry) => entry.courses === 0)
  const gate = inspection.safety_privacy_gate
  const unscheduled = inspection.coverage.filter((entry) => !entry.scheduled)
  const uncustodied = inspection.referenced_frameworks.filter((ref) => !custody.has(ref))

  const checks: readonly ReadinessCheck[] = Object.freeze([
    {
      check: 'schema_set_version',
      satisfied: inspection.declared_schema_set_version === ADMISSION_SCHEMA_SET_VERSION,
      detail: `authored against ${inspection.declared_schema_set_version}`,
    },
    {
      check: 'grade_coverage',
      satisfied: inspection.unsupported_grades.length === 0 && published.length > 0,
      detail: `publishes grade(s) ${published.map((entry) => entry.grade).join(', ') || 'none'}`,
    },
    {
      check: 'schedule_resolution',
      satisfied: unscheduled.length === 0,
      detail: unscheduled.length === 0
        ? 'every published grade has a schedule placing all of its lessons'
        : `grade(s) ${unscheduled.map((entry) => entry.grade).join(', ')} are unscheduled`,
    },
    {
      check: 'subject_support',
      satisfied: inspection.unsupported_subjects.length === 0,
      detail: `subjects ${inspection.observed_subjects.join(', ') || 'none'}`,
    },
    {
      check: 'standards_custody',
      satisfied: uncustodied.length === 0,
      detail: uncustodied.length === 0
        ? `${inspection.referenced_frameworks.length} cited framework(s), each in custody`
        : `no custody for ${uncustodied.join(', ')}`,
    },
    {
      check: 'safety_privacy_gate',
      satisfied: gate.status === 'passed' && gate.reviewed_release_version === candidate.release_version,
      detail: `gate ${gate.gate_id} ${gate.status} for ${gate.reviewed_release_version}`,
    },
    {
      check: 'graduation_claim',
      satisfied: !candidate.graduation_complete || uncovered.length === 0,
      detail: candidate.graduation_complete
        ? `graduation-complete claimed across all ${CANONICAL_GRADES.length} canonical grades`
        : 'no graduation-complete claim made',
    },
  ])
  return Object.freeze({
    report_version: ADMISSION_REPORT_VERSION,
    release_version: candidate.release_version,
    candidate_id: candidate.candidate_id,
    generated_at: options.generatedAt,
    ready: checks.every((entry) => entry.satisfied),
    checks,
  })
}
