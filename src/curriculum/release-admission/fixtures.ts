import {
  CURRICULUM_SCHEMA_SET_VERSION,
  type Assessment,
  type AssessmentProtectedInterpretation,
  type Course,
  type CurriculumAuthoringSet,
  type Lesson,
  type Schedule,
  type Unit,
} from '../../curriculum-authoring/v2/contracts.ts'
import type { ReleaseCandidate, SupportedSubject } from './types.ts'

/**
 * CURRICULUM-RELEASE-ADMISSION — synthetic release candidates.
 *
 * Admission has to be finished and provable before the grade and high-school
 * packages exist, so every test drives it from candidates generated here. The
 * generator is parameterized by grade, subject, and size, which means the same
 * machinery that admits a one-course grade 5 fixture admits a full canonical
 * grade 3–12 release without a single change when the real packages land.
 *
 * The shape follows the proven-valid set in
 * src/curriculum-authoring/v2/schemaSet.test.ts, so a fixture that fails
 * admission fails on the admission rule under test and not on authoring noise.
 */

const POLICY_ID = 'academy-release-policy'
const FRAMEWORK_ID = 'academy-release-framework'
const FRAMEWORK_VERSION = '2026.1'
const RESOURCE_ID = 'academy-release-resource'
const STANDARD_ID = 'standard-one'

export interface CandidateFixtureOptions {
  /** Grades to publish. Defaults to a single grade 5 course. */
  readonly grades?: readonly number[]
  readonly subjects?: readonly SupportedSubject[]
  readonly unitsPerCourse?: number
  readonly lessonsPerUnit?: number
  readonly releaseVersion?: string
  readonly schemaSetVersion?: string
  /** Defaults to `grades`; set it apart to exercise coverage mismatches. */
  readonly declaredGrades?: readonly number[]
  readonly graduationComplete?: boolean
}

const STANDARDS = [
  { framework_ref: FRAMEWORK_ID, standard_id: STANDARD_ID, mapping_status: 'canonical' },
] as const

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function courseId(grade: number, subject: string): string {
  return `ma-g${grade}-${subject}`
}

function unitId(grade: number, subject: string, unit: number): string {
  return `${courseId(grade, subject)}-u${pad(unit)}`
}

function lessonId(grade: number, subject: string, unit: number, lesson: number): string {
  return `${unitId(grade, subject, unit)}-l${pad(lesson)}`
}

function buildLesson(
  grade: number,
  subject: SupportedSubject,
  unit: number,
  lessonInUnit: number,
  courseDay: number,
): Lesson {
  return {
    schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
    lesson_id: lessonId(grade, subject, unit, lessonInUnit),
    course_ref: courseId(grade, subject),
    unit_ref: unitId(grade, subject, unit),
    grade,
    subject,
    course_day: courseDay,
    day_in_unit: lessonInUnit,
    title: `Grade ${grade} ${subject} unit ${unit} day ${lessonInUnit}`,
    phase: 'Launch',
    focus: 'Reason from evidence and explain the result.',
    estimated_duration: { minimum_minutes: 45, maximum_minutes: 60 },
    standards: [...STANDARDS],
    essential_question: 'What evidence supports the result?',
    learning_objectives: ['Explain the result using evidence.'],
    success_criteria: ['The response includes an accurate result and an explanation.'],
    materials: ['notebook'],
    lesson_flow: [
      {
        segment_id: `${lessonId(grade, subject, unit, lessonInUnit)}-s01`,
        title: 'Independent application',
        duration: { minimum_minutes: 45, maximum_minutes: 60 },
        teacher_or_tutor_action: 'Invite an independent attempt and ask for evidence.',
      },
    ],
    student_activity: 'Complete a fresh application and explain the reasoning.',
    formative_check: 'Show the result and name one check.',
    scoring_guidance: 'Score the stated target and accept multiple valid approaches.',
    mastery: { policy_ref: POLICY_ID, minimum_occasions: 3, minimum_distinct_dates: 2 },
    tutor_routes: [
      {
        signal: 'prerequisite-gap',
        strategy: 'prerequisite-reteach',
        parameters: { representation: 'concrete', retry_count: 1 },
      },
    ],
    accessibility: {
      policy_ref: POLICY_ID,
      text_fallback: 'required',
      keyboard: 'required',
      caption_or_transcript: 'required-when-media',
      alt_or_long_description: 'required-when-visual',
      reduced_motion: 'available',
      high_contrast: 'available',
      extended_time: true,
      timer_accommodation: 'hidden',
      movement_break: true,
      response_modes: ['typed', 'spoken'],
    },
    safety_privacy: {
      policy_ref: POLICY_ID,
      hazards: [],
      sensitivity: [],
      supervision: 'none',
      guardian_visibility: 'summary',
      stop_conditions: ['Pause when the learner asks to stop.'],
      privacy_declarations: ['Do not require private disclosure.'],
      academic_integrity_mode: 'practice-support',
    },
    resource_refs: [RESOURCE_ID],
    guardian_visibility_note: 'Share the target and next instructional step, not raw answers.',
  }
}

/** One lesson per instructional day, five days a week. */
function scheduleSlot(index: number): { week: number; day: number } {
  return { week: Math.floor(index / 5) + 1, day: (index % 5) + 1 }
}

/**
 * Builds a release candidate that admission accepts, then lets a caller mutate
 * it into whichever failure the test needs.
 */
export function buildCandidateFixture(options: CandidateFixtureOptions = {}): ReleaseCandidate {
  const grades = options.grades ?? [5]
  const subjects = options.subjects ?? ['mathematics']
  const unitsPerCourse = options.unitsPerCourse ?? 1
  const lessonsPerUnit = options.lessonsPerUnit ?? 2
  const releaseVersion = options.releaseVersion ?? '2.0.0'

  const courses: Course[] = []
  const units: Unit[] = []
  const lessons: Lesson[] = []
  const assessments: Assessment[] = []
  const interpretations: AssessmentProtectedInterpretation[] = []
  const schedules: Schedule[] = []

  let courseOrder = 0
  for (const grade of grades) {
    for (const subject of subjects) {
      courseOrder += 1
      const course = courseId(grade, subject)
      const courseUnitRefs: string[] = []
      let courseDay = 0

      for (let unit = 1; unit <= unitsPerCourse; unit += 1) {
        const unitRef = unitId(grade, subject, unit)
        const assessmentId = `${unitRef}-assessment`
        const unitLessonRefs: string[] = []
        courseUnitRefs.push(unitRef)

        for (let lessonInUnit = 1; lessonInUnit <= lessonsPerUnit; lessonInUnit += 1) {
          courseDay += 1
          const lesson = buildLesson(grade, subject, unit, lessonInUnit, courseDay)
          lessons.push(lesson)
          unitLessonRefs.push(lesson.lesson_id)
        }

        units.push({
          schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
          unit_id: unitRef,
          course_ref: course,
          grade,
          subject,
          order: unit,
          title: `Grade ${grade} ${subject} unit ${unit}`,
          days: lessonsPerUnit,
          standards: [...STANDARDS],
          essential_question: 'How can a learner demonstrate the target?',
          topics: ['reasoning'],
          performance_task: 'Demonstrate the target and explain the evidence.',
          lesson_refs: unitLessonRefs,
          assessment_ref: assessmentId,
        })

        assessments.push({
          schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
          assessment_id: assessmentId,
          course_ref: course,
          unit_ref: unitRef,
          title: `Grade ${grade} ${subject} unit ${unit} assessment`,
          standards: [...STANDARDS],
          total_points: 10,
          prompts: [
            {
              prompt_id: `${assessmentId}-p01`,
              type: 'application',
              prompt: 'Apply the idea in a fresh situation and explain the result.',
              points: 10,
              resource_refs: [],
            },
          ],
          rubric_dimensions: ['accuracy', 'evidence'],
          accommodation_note: 'Access supports may change format without changing the standard.',
          protected_interpretation_ref: `${assessmentId}-interpretation`,
        })

        interpretations.push({
          schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
          interpretation_id: `${assessmentId}-interpretation`,
          assessment_ref: assessmentId,
          secure_minimum_percent: 85,
          developing_minimum_percent: 70,
          not_yet_maximum_percent: 69,
          mastery_rule: 'Use this score as one evidence source, never as the sole mastery decision.',
          prompt_scoring: [
            {
              prompt_ref: `${assessmentId}-p01`,
              scoring_guidance: 'Award credit for an accurate result and supported reasoning.',
            },
          ],
        })
      }

      courses.push({
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        course_id: course,
        grade,
        subject,
        title: `Grade ${grade} ${subject}`,
        description: 'A generated course used to exercise release admission.',
        days: unitsPerCourse * lessonsPerUnit,
        order: courseOrder,
        unit_refs: courseUnitRefs,
        standards: [...STANDARDS],
      })
    }

    const gradeLessons = lessons.filter((lesson) => lesson.grade === grade)
    const entries = gradeLessons.map((lesson, index) => ({
      ...scheduleSlot(index),
      lesson_refs: [lesson.lesson_id],
    }))
    schedules.push({
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      schedule_id: `ma-g${grade}-schedule`,
      grade,
      weeks: Math.max(1, entries.at(-1)?.week ?? 1),
      instructional_days: entries.length,
      entries,
    })
  }

  const authoring_set: CurriculumAuthoringSet = {
    manifest: {
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      curriculum_id: 'manuel-academy-release-candidate',
      draft_version: releaseVersion,
      status: 'in-review',
      title: 'Manuel Academy release candidate',
      policy_set_ref: POLICY_ID,
      framework_refs: [FRAMEWORK_ID],
      course_refs: courses.map((course) => course.course_id),
      schedule_refs: schedules.map((schedule) => schedule.schedule_id),
      resource_refs: [RESOURCE_ID],
      counts: {
        courses: courses.length,
        units: units.length,
        lessons: lessons.length,
        assessments: assessments.length,
        schedules: schedules.length,
        resources: 1,
      },
    },
    courses,
    units,
    lessons,
    assessments,
    assessment_interpretations: interpretations,
    schedules,
    standard_frameworks: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        framework_id: FRAMEWORK_ID,
        name: 'Academy release standards',
        jurisdiction: 'Michigan-aligned; locally authored',
        framework_version: FRAMEWORK_VERSION,
        authority_status: 'verified',
        standards: [{ standard_id: STANDARD_ID, code: 'T.1', label: 'Test standard one' }],
      },
    ],
    resources: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        resource_id: RESOURCE_ID,
        kind: 'text',
        title: 'Readable source',
        locator: 'resources/release-resource.txt',
        rights: 'Locally authored',
        required: false,
        text_fallback: 'The resource is already readable text.',
      },
    ],
    policy_sets: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        policy_set_id: POLICY_ID,
        title: 'Academy global policy',
        mastery_floor: {
          policy_ref: POLICY_ID,
          minimum_occasions: 2,
          minimum_distinct_dates: 2,
          independent_evidence_required: true,
          evidence_types: ['application', 'explanation'],
          transfer_requirement: 'retrieval',
        },
        tutor_authority: {
          reveals_answers: false,
          gives_final_graded_answer: false,
          controls_graded_work_policy: false,
        },
        safety_privacy: {
          non_disableable_prohibitions: ['Never require a private disclosure.'],
          required_privacy_declarations: ['Collect only the minimum instructional evidence.'],
        },
        extension_namespaces: [],
      },
    ],
  }

  return {
    candidate_id: 'release-candidate-fixture',
    release_version: releaseVersion,
    schema_set_version: options.schemaSetVersion ?? CURRICULUM_SCHEMA_SET_VERSION,
    declared_grades: options.declaredGrades ?? grades,
    graduation_complete: options.graduationComplete ?? false,
    standards_custody: [
      {
        framework_ref: FRAMEWORK_ID,
        custodian: 'Manuel Academy standards custodian',
        attested_framework_version: FRAMEWORK_VERSION,
        evidence_locator: 'docs/curriculum/standards-custody/academy-release-framework.md',
      },
    ],
    safety_privacy_gate: {
      gate_id: 'academy-safety-privacy-gate',
      status: 'passed',
      reviewed_release_version: releaseVersion,
      evidence_locator: 'docs/curriculum/safety-privacy/release-gate.md',
    },
    authoring_set,
  }
}

/** The full canonical sequence — grade 3 through 12, with no grade 6. */
export function buildCanonicalCandidateFixture(
  options: CandidateFixtureOptions = {},
): ReleaseCandidate {
  return buildCandidateFixture({
    grades: [3, 4, 5, 7, 8, 9, 10, 11, 12],
    graduationComplete: true,
    ...options,
  })
}
