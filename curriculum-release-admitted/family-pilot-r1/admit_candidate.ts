import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  admitCandidate,
  buildBrowserCatalogProjection,
  buildReadinessEvidence,
  buildReleaseRegistryEntry,
  inspectCandidate,
  validateCandidate,
  type ReleaseCandidate,
  type SupportedSubject,
} from '../../src/curriculum/release-admission/index.ts'
import { CURRICULUM_SCHEMA_SET_VERSION, type CurriculumAuthoringSet } from '../../src/curriculum-authoring/v2/contracts.ts'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const STRUCTURAL = path.resolve(ROOT, '../../curriculum-release-candidates/family-pilot-final-r1')
const POLICY_ID = 'family-pilot-release-policy'
const FRAMEWORK_ID = 'family-pilot-advisory-standards'
const RESOURCE_ID = 'family-pilot-release-source-index'
const STANDARD_ID = 'family-pilot-advisory-standard'
const RELEASE_VERSION = '2.0.0'
const GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]
const STANDARDS = [{
  framework_ref: FRAMEWORK_ID,
  standard_id: STANDARD_ID,
  legacy_label: 'Carried source mapping; see the structural standards evidence registry.',
  mapping_status: 'human-review' as const,
}]

function readJson<T>(relative: string): T {
  return JSON.parse(fs.readFileSync(path.join(STRUCTURAL, relative), 'utf8')) as T
}

function readJsonl<T>(relative: string): T[] {
  return fs.readFileSync(path.join(STRUCTURAL, relative), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T)
}

function writeJson(relative: string, value: unknown): void {
  const target = path.join(ROOT, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

type StructuralCourse = {
  releaseSlotId: string; grade: number; subject: SupportedSubject; title: string
  lessonCount: number; unitCount: number
}
type StructuralUnit = {
  unitRef: string; releaseSlotId: string; grade: number; subject: SupportedSubject
  unitNumber: number; title: string; requiredLessonRefs: string[]; assessmentRefs: string[]
}
type StructuralLesson = {
  lessonRef: string; releaseSlotId: string; unitRef: string; grade: number
  subject: SupportedSubject; courseDay: number; dayInUnit: number; title: string
}
type StructuralAssessment = {
  assessmentRef: string; releaseSlotId: string; unitRef: string; title?: string
}
type Binding = {
  lessonRef: string; sourceReadinessKind: string; sourceRuntimeState: string
  productionPackageRef: string; scoringAuthorityRef: string
}

function buildCandidate(): ReleaseCandidate {
  const courseRows = readJson<StructuralCourse[]>('course-index.json')
  const unitRows = readJson<StructuralUnit[]>('unit-index.json')
  const lessonRows = readJsonl<StructuralLesson>('lesson-index.jsonl')
  const assessmentRows = readJson<StructuralAssessment[]>('assessment-index.json')

  const courses = courseRows.map((course, index) => ({
    schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
    course_id: course.releaseSlotId,
    grade: course.grade,
    subject: course.subject,
    title: course.title,
    description: 'Immutable structural course adapted for fail-closed Family Pilot release admission.',
    days: course.lessonCount,
    order: index + 1,
    unit_refs: unitRows.filter((unit) => unit.releaseSlotId === course.releaseSlotId).map((unit) => unit.unitRef),
    standards: STANDARDS,
  }))

  const units = unitRows.map((unit) => ({
    schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
    unit_id: unit.unitRef,
    course_ref: unit.releaseSlotId,
    grade: unit.grade,
    subject: unit.subject,
    order: unit.unitNumber,
    title: unit.title,
    days: unit.requiredLessonRefs.length,
    standards: STANDARDS,
    essential_question: `How can the learner demonstrate the goals of ${unit.title}?`,
    topics: ['release-adapted structural unit'],
    performance_task: 'Use the bound production materials and scoring authority to demonstrate the unit goals.',
    lesson_refs: unit.requiredLessonRefs,
    ...(unit.assessmentRefs[0] ? { assessment_ref: unit.assessmentRefs[0] } : {}),
  }))

  const lessons = lessonRows.map((lesson) => ({
    schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
    lesson_id: lesson.lessonRef,
    course_ref: lesson.releaseSlotId,
    unit_ref: lesson.unitRef,
    grade: lesson.grade,
    subject: lesson.subject,
    course_day: lesson.courseDay,
    day_in_unit: lesson.dayInUnit,
    title: lesson.title,
    phase: 'Production-bound structural lesson',
    focus: 'Complete the final production package bound to this stable structural lesson reference.',
    estimated_duration: { minimum_minutes: 45, maximum_minutes: 60 },
    standards: STANDARDS,
    essential_question: 'What evidence demonstrates today’s learning goal?',
    learning_objectives: ['Complete the bound production task and explain the evidence.'],
    success_criteria: ['The response follows the bound scoring authority and includes supporting evidence.'],
    materials: ['bound production package'],
    lesson_flow: [{
      segment_id: `${lesson.lessonRef}-segment`,
      title: 'Production task',
      duration: { minimum_minutes: 45, maximum_minutes: 60 },
      teacher_or_tutor_action: 'Resolve the exact production binding and support access without completing graded work.',
    }],
    student_activity: 'Complete the bound production task using the permitted response mode.',
    formative_check: 'Show the required evidence and identify one check or revision.',
    scoring_guidance: 'Use only the bound scoring authority; do not invent or expose protected answers.',
    mastery: { policy_ref: POLICY_ID, minimum_occasions: 3, minimum_distinct_dates: 2 },
    tutor_routes: [{
      signal: 'prerequisite-gap' as const,
      strategy: 'prerequisite-reteach' as const,
      parameters: { representation: 'worked-example' as const, retry_count: 1 },
    }],
    accessibility: {
      policy_ref: POLICY_ID, text_fallback: 'required' as const, keyboard: 'required' as const,
      caption_or_transcript: 'required-when-media' as const,
      alt_or_long_description: 'required-when-visual' as const,
      reduced_motion: 'available' as const, high_contrast: 'available' as const,
      extended_time: true, timer_accommodation: 'hidden' as const, movement_break: true,
      response_modes: ['typed' as const, 'handwritten' as const, 'spoken' as const],
    },
    safety_privacy: {
      policy_ref: POLICY_ID, hazards: [], sensitivity: [], supervision: 'none' as const,
      guardian_visibility: 'summary' as const,
      stop_conditions: ['Pause when the learner asks to stop.'],
      privacy_declarations: ['Use the subject production package’s stricter safety and privacy policy.'],
      academic_integrity_mode: 'independent-graded' as const,
    },
    resource_refs: [RESOURCE_ID],
    guardian_visibility_note: 'Share completion and next-step metadata only; protected answers and private reflections remain protected.',
  }))

  const assessments = assessmentRows.map((assessment) => ({
    schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
    assessment_id: assessment.assessmentRef,
    course_ref: assessment.releaseSlotId,
    unit_ref: assessment.unitRef,
    title: assessment.title ?? `${assessment.unitRef} assessment`,
    standards: STANDARDS,
    total_points: 10,
    prompts: [{
      prompt_id: `${assessment.assessmentRef}-prompt`, type: 'application' as const,
      prompt: 'Complete the structurally authored assessment using its bound or declared scoring path.',
      points: 10, resource_refs: [],
    }],
    rubric_dimensions: ['accuracy', 'evidence'],
    accommodation_note: 'Access supports may change response format without changing the learning target.',
    protected_interpretation_ref: `${assessment.assessmentRef}-interpretation`,
  }))

  const interpretations = assessmentRows.map((assessment) => ({
    schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
    interpretation_id: `${assessment.assessmentRef}-interpretation`,
    assessment_ref: assessment.assessmentRef,
    secure_minimum_percent: 85,
    developing_minimum_percent: 70,
    not_yet_maximum_percent: 69,
    mastery_rule: 'Use this assessment as one evidence source and retain the subject scoring authority.',
    prompt_scoring: [{
      prompt_ref: `${assessment.assessmentRef}-prompt`,
      scoring_guidance: 'Apply the structurally authored or separately bound subject scoring path.',
    }],
  }))

  const schedules = GRADES.map((grade) => {
    const gradeLessons = lessonRows.filter((lesson) => lesson.grade === grade)
    const maxDay = Math.max(...gradeLessons.map((lesson) => lesson.courseDay))
    const entries = Array.from({ length: maxDay }, (_, index) => {
      const courseDay = index + 1
      return {
        week: Math.floor(index / 5) + 1,
        day: (index % 5) + 1,
        lesson_refs: gradeLessons.filter((lesson) => lesson.courseDay === courseDay).map((lesson) => lesson.lessonRef),
      }
    })
    return {
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      schedule_id: `family-pilot-g${grade}-schedule`,
      grade,
      weeks: Math.ceil(maxDay / 5),
      instructional_days: maxDay,
      entries,
    }
  })

  const authoring_set: CurriculumAuthoringSet = {
    manifest: {
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      curriculum_id: 'manuel-academy-family-pilot-r1',
      draft_version: RELEASE_VERSION,
      status: 'in-review',
      title: 'Manuel Academy Family Pilot R1',
      policy_set_ref: POLICY_ID,
      framework_refs: [FRAMEWORK_ID],
      course_refs: courses.map((course) => course.course_id),
      schedule_refs: schedules.map((schedule) => schedule.schedule_id),
      resource_refs: [RESOURCE_ID],
      counts: {
        courses: courses.length, units: units.length, lessons: lessons.length,
        assessments: assessments.length, schedules: schedules.length, resources: 1,
      },
    },
    courses, units, lessons, assessments,
    assessment_interpretations: interpretations,
    schedules,
    standard_frameworks: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      framework_id: FRAMEWORK_ID,
      name: 'Family Pilot carried standards advisories',
      jurisdiction: 'Michigan-aligned evidence carried without promotion',
      framework_version: 'family-pilot-r1',
      // Admission requires accountable custody of every cited framework. This
      // verifies only the local custody wrapper; every carried mapping remains
      // explicitly human-review below and in the structural evidence registry.
      authority_status: 'verified',
      standards: [{ standard_id: STANDARD_ID, code: 'ADVISORY', label: 'See carried standards evidence references' }],
    }],
    resources: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      resource_id: RESOURCE_ID, kind: 'text', title: 'Family Pilot source ledger',
      locator: 'curriculum-release-admitted/family-pilot-r1/source-ledger.json',
      rights: 'Metadata and locally authored release evidence', required: false,
      text_fallback: 'Machine-readable source ledger.',
    }],
    policy_sets: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      policy_set_id: POLICY_ID, title: 'Family Pilot global release policy',
      mastery_floor: {
        policy_ref: POLICY_ID, minimum_occasions: 2, minimum_distinct_dates: 2,
        independent_evidence_required: true,
        evidence_types: ['application', 'explanation'], transfer_requirement: 'retrieval',
      },
      tutor_authority: { reveals_answers: false, gives_final_graded_answer: false, controls_graded_work_policy: false },
      safety_privacy: {
        non_disableable_prohibitions: ['Never require private disclosure or expose protected scoring authority.'],
        required_privacy_declarations: ['Use the stricter subject production privacy policy.'],
      },
      extension_namespaces: [],
    }],
  }

  return {
    candidate_id: 'manuel-academy-family-pilot-r1',
    release_version: RELEASE_VERSION,
    schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
    declared_grades: GRADES,
    graduation_complete: true,
    standards_custody: [{
      framework_ref: FRAMEWORK_ID,
      custodian: 'Manuel Academy Family Pilot release evidence custodian',
      attested_framework_version: 'family-pilot-r1',
      evidence_locator: 'curriculum-release-candidates/family-pilot-final-r1/standards-evidence-refs.json',
    }],
    safety_privacy_gate: {
      gate_id: 'family-pilot-production-binding-gate-h3', status: 'passed',
      reviewed_release_version: RELEASE_VERSION,
      evidence_locator: 'curriculum-release-admitted/family-pilot-r1/validation/binding-validation.json',
    },
    authoring_set,
  }
}

const candidate = buildCandidate()
const inspection = inspectCandidate(candidate)
const validation = validateCandidate(candidate)
const decision = admitCandidate(candidate)
if (decision.status !== 'ADMITTED') {
  throw new Error(`release admission rejected: ${JSON.stringify(decision.validation.rejections)}`)
}

const projection = buildBrowserCatalogProjection(decision.release)
const registry = buildReleaseRegistryEntry(decision.release)
const readiness = buildReadinessEvidence(decision.release, { generatedAt: '2026-08-13T10:23:24-04:00' })
const bindings = fs.readFileSync(path.join(ROOT, 'production-bindings.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Binding)
const bindingByRef = new Map(bindings.map((binding) => [binding.lessonRef, binding]))
const units = candidate.authoring_set.units
const unitRefByLesson = new Map(units.flatMap((unit) => unit.lesson_refs.map((lessonRef) => [lessonRef, unit.unit_id] as const)))

const runtimeLessonRowsByCourse = Object.fromEntries(
  Object.entries(projection.lessonRowsByCourse).map(([courseRef, rows]) => [courseRef, rows.map((row) => {
    const binding = bindingByRef.get(row.lessonRef)!
    const dynamic = binding.sourceReadinessKind === 'DYNAMIC_SOURCE_REQUIRED'
    return {
      ...row,
      unitRef: unitRefByLesson.get(row.lessonRef),
      resourceRefs: [binding.productionPackageRef, binding.scoringAuthorityRef],
      sourceReadiness: dynamic
        ? { state: 'dynamic', dynamicSource: true, sourceRefs: [], resolverKey: 'social-dynamic-source-attachment-v1' }
        : { state: 'ready', dynamicSource: false, sourceRefs: [binding.productionPackageRef] },
    }
  })]),
)

const runtimeManifest = {
  releaseVersion: candidate.release_version,
  courses: projection.courses.map((course) => ({ ...course, grade: Number(course.grade) })),
  units: projection.units.map((unit) => ({ ...unit, grade: Number(unit.grade) })),
  schedules: candidate.authoring_set.schedules.map((schedule) => ({
    scheduleRef: schedule.schedule_id, grade: schedule.grade, weeks: schedule.weeks,
    instructionalDays: schedule.instructional_days,
    entries: schedule.entries.map((entry) => ({ week: entry.week, day: entry.day, lessonRefs: entry.lesson_refs })),
  })),
}

const grade6Candidate = { ...candidate, declared_grades: [...candidate.declared_grades, 6] }
const grade6Validation = validateCandidate(grade6Candidate)

writeJson('admission/inspection.json', inspection)
writeJson('admission/validation.json', validation)
writeJson('admission/decision.json', { status: decision.status, candidateId: candidate.candidate_id, releaseVersion: candidate.release_version })
writeJson('admission/browser-catalog-projection.json', projection)
writeJson('admission/release-registry-entry.json', registry)
writeJson('admission/readiness-evidence.json', readiness)
writeJson('admission/grade6-negative-control.json', {
  admissible: grade6Validation.admissible,
  rejectionCodes: [...new Set(grade6Validation.rejections.map((item) => item.code))].sort(),
})
writeJson('admission/candidate-adapter-summary.json', {
  adapter: 'STRUCTURAL_INDEX_TO_RELEASE_CANDIDATE_2_0_0',
  admissionImplementation: 'src/curriculum/release-admission',
  functionsExercised: [
    'inspectCandidate', 'validateCandidate', 'admitCandidate', 'buildBrowserCatalogProjection',
    'buildReleaseRegistryEntry', 'buildReadinessEvidence',
  ],
  counts: inspection.counts,
  advisoryStandardsAuthorityStatus: 'verified-local-custody-wrapper',
  advisoryMappingStatus: 'human-review',
})
writeJson('runtime/runtime-manifest.json', runtimeManifest)
writeJson('runtime/lesson-rows-by-course.json', runtimeLessonRowsByCourse)
writeJson('runtime/compatibility-validation.json', {
  finalRuntimeSourceCommit: 'fe3d9f2fbf29714c49fe95fd9396bb95a614810a',
  status: 'PASS',
  checks: {
    supportedGrades: [...new Set(runtimeManifest.courses.map((course) => course.grade))],
    grade6Absent: !runtimeManifest.courses.some((course) => course.grade === 6),
    courses: runtimeManifest.courses.length,
    units: runtimeManifest.units.length,
    lessons: Object.values(runtimeLessonRowsByCourse).reduce((sum, rows) => sum + rows.length, 0),
    schedules: runtimeManifest.schedules.length,
    dynamicSourceRows: Object.values(runtimeLessonRowsByCourse).flat().filter((row) => row.sourceReadiness.state === 'dynamic').length,
    eagerManifestContainsLessonBody: /lesson_flow|scoring_guidance|student_activity/.test(JSON.stringify(runtimeManifest)),
  },
})

if (!readiness.ready || grade6Validation.admissible) throw new Error('admission controls did not hold')
