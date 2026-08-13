import type {
  Course,
  CurriculumAuthoringSet,
  StandardReference,
} from '../../curriculum-authoring/v2/contracts.ts'
import {
  validateAuthoringSet,
  type AuthoringIssue,
  type AuthoringIssueCode,
} from '../../curriculum-authoring/v2/validation.ts'
import {
  ADMISSION_REPORT_VERSION,
  ADMISSION_SCHEMA_SET_VERSION,
  ADMITTED_RELEASE,
  CANONICAL_GRADES,
  SUPPORTED_SUBJECTS,
  type AdmissionDecision,
  type AdmissionRejection,
  type AdmissionRejectionCode,
  type AdmittedRelease,
  type CandidateInspection,
  type CandidateValidation,
  type CanonicalGrade,
  type GradeCoverage,
  type ReleaseCandidate,
  type SafetyPrivacyGateAttestation,
} from './types.ts'

/**
 * CURRICULUM-RELEASE-ADMISSION — inspect, validate, admit.
 *
 * The authoring schema set already decides whether content is well-formed, so
 * validateAuthoringSet runs first and its findings are mapped onto admission
 * codes rather than re-derived. What follows are the checks authoring cannot
 * make: grade canon, grade-level schedule coverage, standards custody, the
 * safety/privacy gate's own freshness, and the graduation claim.
 */

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/u

/**
 * Every authoring issue maps onto exactly one admission code. Nothing is
 * dropped — the verbatim issues also travel in the report — but an operator
 * reading rejection codes alone still sees the right category. Answer-authority
 * and projection-leak findings are safety/privacy failures, not shape ones.
 */
const ISSUE_CODE_MAP: Readonly<Record<AuthoringIssueCode, AdmissionRejectionCode>> = {
  SHAPE_INVALID: 'RELEASE_SCHEMA_MISMATCH',
  BAD_REFERENCE: 'RELEASE_SCHEMA_MISMATCH',
  ORDERING_INVALID: 'RELEASE_SCHEMA_MISMATCH',
  COUNT_MISMATCH: 'RELEASE_SCHEMA_MISMATCH',
  ASSESSMENT_POINT_MISMATCH: 'RELEASE_SCHEMA_MISMATCH',
  MASTERY_FLOOR_WEAKENED: 'RELEASE_SCHEMA_MISMATCH',
  ACCESSIBILITY_INVALID: 'RELEASE_SCHEMA_MISMATCH',
  EXTENSION_INVALID: 'RELEASE_SCHEMA_MISMATCH',
  DUPLICATE_ID: 'RELEASE_DUPLICATE_ID',
  SCHEDULE_INVALID: 'RELEASE_SCHEDULE_UNRESOLVED',
  STANDARD_REFERENCE_INVALID: 'RELEASE_STANDARDS_CUSTODY_MISSING',
  SAFETY_PRIVACY_INVALID: 'RELEASE_SAFETY_PRIVACY_GATE_FAILED',
  TUTOR_INVARIANT_VIOLATION: 'RELEASE_SAFETY_PRIVACY_GATE_FAILED',
  PROJECTION_LEAK: 'RELEASE_SAFETY_PRIVACY_GATE_FAILED',
}

function reject(
  rejections: AdmissionRejection[],
  code: AdmissionRejectionCode,
  path: string,
  detail: string,
): void {
  rejections.push({ code, path, detail })
}

const CANONICAL_GRADE_SET: ReadonlySet<number> = new Set(CANONICAL_GRADES)
const SUPPORTED_SUBJECT_SET: ReadonlySet<string> = new Set(SUPPORTED_SUBJECTS)

/**
 * A candidate parsed from JSON can be missing anything at all, so the census
 * reads every collection through this rather than trusting the declared type.
 * envelopeRejections turns the same absences into rejections; this only keeps
 * inspectCandidate from throwing before they can be reported.
 */
function list<T>(value: readonly T[] | undefined): readonly T[] {
  return Array.isArray(value) ? value : []
}

const UNREADABLE_GATE: SafetyPrivacyGateAttestation = {
  gate_id: '',
  status: 'not-run',
  reviewed_release_version: '',
  evidence_locator: '',
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Structural checks on the release-level envelope. validateAuthoringSet covers
 * authoring_set and nothing else, so without this a candidate whose
 * release_version and gate version are both absent satisfies the freshness
 * comparison by identity — undefined === undefined — and is admitted with no
 * version at all.
 */
function envelopeRejections(candidate: ReleaseCandidate): readonly AdmissionRejection[] {
  const rejections: AdmissionRejection[] = []
  const gate = candidate?.safety_privacy_gate
  if (!isNonEmptyString(candidate?.candidate_id)) {
    reject(rejections, 'RELEASE_SCHEMA_MISMATCH', 'candidate_id', 'a candidate must be identifiable')
  }
  if (!isNonEmptyString(candidate?.release_version) || !SEMVER.test(candidate.release_version)) {
    reject(
      rejections,
      'RELEASE_SCHEMA_MISMATCH',
      'release_version',
      'a candidate must name the semver release it proposes to become',
    )
  }
  if (typeof candidate?.schema_set_version !== 'string') {
    reject(rejections, 'RELEASE_SCHEMA_MISMATCH', 'schema_set_version', 'missing schema set version')
  }
  if (
    !Array.isArray(candidate?.declared_grades) ||
    !candidate.declared_grades.every((grade) => Number.isInteger(grade))
  ) {
    reject(rejections, 'RELEASE_SCHEMA_MISMATCH', 'declared_grades', 'must be a list of whole grades')
  }
  if (typeof candidate?.graduation_complete !== 'boolean') {
    reject(rejections, 'RELEASE_SCHEMA_MISMATCH', 'graduation_complete', 'must be stated true or false')
  }
  if (!Array.isArray(candidate?.standards_custody)) {
    reject(rejections, 'RELEASE_SCHEMA_MISMATCH', 'standards_custody', 'must be a list of custody records')
  }
  if (!candidate?.authoring_set || typeof candidate.authoring_set !== 'object') {
    reject(rejections, 'RELEASE_SCHEMA_MISMATCH', 'authoring_set', 'missing authoring set')
  }
  if (!gate || typeof gate !== 'object') {
    reject(rejections, 'RELEASE_SAFETY_PRIVACY_GATE_FAILED', 'safety_privacy_gate', 'no gate attestation')
  } else {
    if (gate.status !== 'passed' && gate.status !== 'failed' && gate.status !== 'not-run') {
      reject(
        rejections,
        'RELEASE_SAFETY_PRIVACY_GATE_FAILED',
        'safety_privacy_gate.status',
        'status must be passed, failed, or not-run',
      )
    }
    if (!isNonEmptyString(gate.gate_id)) {
      reject(rejections, 'RELEASE_SAFETY_PRIVACY_GATE_FAILED', 'safety_privacy_gate.gate_id', 'gate must be named')
    }
    if (!isNonEmptyString(gate.reviewed_release_version)) {
      reject(
        rejections,
        'RELEASE_SAFETY_PRIVACY_GATE_FAILED',
        'safety_privacy_gate.reviewed_release_version',
        'gate must name the release it reviewed',
      )
    }
  }
  return rejections
}

function ascending(values: Iterable<number>): readonly number[] {
  return [...new Set(values)].sort((left, right) => left - right)
}

function sorted(values: Iterable<string>): readonly string[] {
  return [...new Set(values)].sort()
}

function isCanonicalGrade(grade: number): grade is CanonicalGrade {
  return CANONICAL_GRADE_SET.has(grade)
}

/** Every collection guaranteed present, so the census can read it safely. */
function readableSet(candidate: ReleaseCandidate): CurriculumAuthoringSet {
  const set = (candidate?.authoring_set ?? {}) as CurriculumAuthoringSet
  return {
    manifest: set.manifest ?? ({} as CurriculumAuthoringSet['manifest']),
    courses: list(set.courses),
    units: list(set.units),
    lessons: list(set.lessons),
    assessments: list(set.assessments),
    assessment_interpretations: list(set.assessment_interpretations),
    schedules: list(set.schedules),
    standard_frameworks: list(set.standard_frameworks),
    resources: list(set.resources),
    policy_sets: list(set.policy_sets),
  }
}

/** Every framework any part of the candidate leans on. */
function referencedFrameworks(set: CurriculumAuthoringSet): readonly string[] {
  const refs = new Set<string>(list(set.manifest.framework_refs))
  const collect = (standards: readonly StandardReference[]): void => {
    for (const standard of standards) refs.add(standard.framework_ref)
  }
  for (const course of set.courses) collect(list(course.standards))
  for (const unit of set.units) collect(list(unit.standards))
  for (const lesson of set.lessons) collect(list(lesson.standards))
  for (const assessment of set.assessments) collect(list(assessment.standards))
  return sorted(refs)
}

/**
 * A grade is scheduled when a schedule claims it AND that schedule places every
 * one of the grade's lessons. validateAuthoringSet walks schedules, so it never
 * notices a grade that has lessons and no schedule at all — that hole is
 * exactly what admission has to close.
 */
function gradeIsScheduled(set: CurriculumAuthoringSet, grade: number, lessonIds: ReadonlySet<string>): boolean {
  const schedules = set.schedules.filter((schedule) => schedule.grade === grade)
  if (schedules.length === 0) return false
  const placed = new Set<string>()
  for (const schedule of schedules) {
    for (const entry of list(schedule.entries)) {
      for (const lessonRef of list(entry.lesson_refs)) placed.add(lessonRef)
    }
  }
  for (const lessonId of lessonIds) if (!placed.has(lessonId)) return false
  return true
}

function coverageForGrade(
  set: CurriculumAuthoringSet,
  grade: CanonicalGrade,
  declared: ReadonlySet<number>,
): GradeCoverage {
  const courses = set.courses.filter((course) => course.grade === grade)
  const units = set.units.filter((unit) => unit.grade === grade)
  const lessons = set.lessons.filter((lesson) => lesson.grade === grade)
  const lessonIds = new Set(lessons.map((lesson) => lesson.lesson_id))
  return {
    grade,
    declared: declared.has(grade),
    courses: courses.length,
    units: units.length,
    lessons: lessons.length,
    subjects: sorted(courses.map((course: Course) => course.subject)),
    scheduled: lessons.length === 0 ? true : gradeIsScheduled(set, grade, lessonIds),
  }
}

/**
 * A read-only census. Reaches no verdict, touches no filesystem, and is the
 * single place the numbers in every downstream report come from.
 */
export function inspectCandidate(candidate: ReleaseCandidate): CandidateInspection {
  const set = readableSet(candidate)
  const declaredGrades = list(candidate?.declared_grades).filter((grade) => Number.isInteger(grade))
  const declared = new Set(declaredGrades)
  const observedGrades = ascending(set.courses.map((course) => course.grade))
  const observedSubjects = sorted(set.courses.map((course) => course.subject))
  // Courses are what a release publishes, but a unit, lesson, or schedule can
  // name a grade of its own. A schedule that places no lessons is pinned to
  // nothing by the authoring validator, which is how a grade 6 schedule would
  // otherwise ride along inside an admitted release.
  const everyStatedGrade = [
    ...declaredGrades,
    ...observedGrades,
    ...set.units.map((unit) => unit.grade),
    ...set.lessons.map((lesson) => lesson.grade),
    ...set.schedules.map((schedule) => schedule.grade),
  ].filter((grade) => Number.isInteger(grade))
  return {
    candidate_id: candidate?.candidate_id,
    release_version: candidate?.release_version,
    declared_schema_set_version: candidate?.schema_set_version,
    supported_schema_set_version: ADMISSION_SCHEMA_SET_VERSION,
    declared_grades: ascending(declaredGrades),
    observed_grades: observedGrades,
    unsupported_grades: ascending(everyStatedGrade.filter((grade) => !isCanonicalGrade(grade))),
    observed_subjects: observedSubjects,
    unsupported_subjects: observedSubjects.filter((subject) => !SUPPORTED_SUBJECT_SET.has(subject)),
    graduation_complete_claimed: candidate.graduation_complete,
    counts: {
      courses: set.courses.length,
      units: set.units.length,
      lessons: set.lessons.length,
      assessments: set.assessments.length,
      schedules: set.schedules.length,
      resources: set.resources.length,
      standard_frameworks: set.standard_frameworks.length,
    },
    coverage: CANONICAL_GRADES.map((grade) => coverageForGrade(set, grade, declared)),
    referenced_frameworks: referencedFrameworks(set),
    custody_frameworks: sorted(list(candidate?.standards_custody).map((record) => record.framework_ref)),
    safety_privacy_gate: candidate?.safety_privacy_gate ?? UNREADABLE_GATE,
  }
}

/** null when the declared version is exactly supported. */
function schemaVersionRejection(candidate: ReleaseCandidate): AdmissionRejection | null {
  const declared = candidate.schema_set_version
  if (declared === ADMISSION_SCHEMA_SET_VERSION) return null
  const parsed = SEMVER.exec(declared)
  if (!parsed) {
    return {
      code: 'RELEASE_SCHEMA_MISMATCH',
      path: 'schema_set_version',
      detail: `${JSON.stringify(declared)} is not a schema set version`,
    }
  }
  const supported = SEMVER.exec(ADMISSION_SCHEMA_SET_VERSION) as RegExpExecArray
  const candidateParts = [Number(parsed[1]), Number(parsed[2]), Number(parsed[3])]
  const supportedParts = [Number(supported[1]), Number(supported[2]), Number(supported[3])]
  for (let index = 0; index < 3; index += 1) {
    if (candidateParts[index] > supportedParts[index]) {
      return {
        code: 'RELEASE_SCHEMA_FUTURE',
        path: 'schema_set_version',
        detail: `candidate declares ${declared}; this build admits at most ${ADMISSION_SCHEMA_SET_VERSION}`,
      }
    }
    if (candidateParts[index] < supportedParts[index]) break
  }
  return {
    code: 'RELEASE_SCHEMA_MISMATCH',
    path: 'schema_set_version',
    detail: `candidate declares ${declared}; this build admits ${ADMISSION_SCHEMA_SET_VERSION}`,
  }
}

function checkGradesAndSubjects(
  inspection: CandidateInspection,
  rejections: AdmissionRejection[],
): void {
  for (const grade of inspection.unsupported_grades) {
    reject(
      rejections,
      'RELEASE_GRADE_UNSUPPORTED',
      `grade:${grade}`,
      grade === 6
        ? 'grade 6 is not a Manuel Academy grade; the canonical sequence skips it'
        : `grade ${grade} is outside the canonical sequence ${CANONICAL_GRADES.join(', ')}`,
    )
  }
  for (const subject of inspection.unsupported_subjects) {
    reject(
      rejections,
      'RELEASE_SUBJECT_UNSUPPORTED',
      `subject:${subject}`,
      `${JSON.stringify(subject)} is not a supported Academy subject`,
    )
  }
  for (const coverage of inspection.coverage) {
    if (coverage.declared && coverage.courses === 0) {
      reject(
        rejections,
        'RELEASE_GRADE_MISSING',
        `declared_grades:${coverage.grade}`,
        `grade ${coverage.grade} is declared but the candidate publishes no course for it`,
      )
    }
    if (!coverage.declared && coverage.courses > 0) {
      reject(
        rejections,
        'RELEASE_GRADE_MISSING',
        `grade:${coverage.grade}`,
        `grade ${coverage.grade} carries ${coverage.courses} course(s) but is not declared`,
      )
    }
    if (!coverage.scheduled) {
      reject(
        rejections,
        'RELEASE_SCHEDULE_UNRESOLVED',
        `grade:${coverage.grade}`,
        `grade ${coverage.grade} has ${coverage.lessons} lesson(s) no schedule places`,
      )
    }
  }
}

function checkStandardsCustody(
  candidate: ReleaseCandidate,
  inspection: CandidateInspection,
  rejections: AdmissionRejection[],
): void {
  const records = list(candidate.standards_custody)
  const custody = new Map(records.map((record) => [record.framework_ref, record]))
  // A Map keeps only the last record per framework, so duplicates would leave
  // the earlier ones unchecked while still reaching the durable registry row.
  const seen = new Set<string>()
  for (const record of records) {
    if (seen.has(record.framework_ref)) {
      reject(
        rejections,
        'RELEASE_STANDARDS_CUSTODY_MISSING',
        `standards_custody:${record.framework_ref}`,
        'duplicate custody records for one framework; exactly one must be accountable',
      )
    }
    seen.add(record.framework_ref)
  }
  // Finding: custody for a framework nothing cites is unverifiable provenance.
  const cited = new Set(inspection.referenced_frameworks)
  for (const record of records) {
    if (!cited.has(record.framework_ref)) {
      reject(
        rejections,
        'RELEASE_STANDARDS_CUSTODY_MISSING',
        `standards_custody:${record.framework_ref}`,
        'custody record for a framework the candidate never cites',
      )
    }
  }
  const frameworks = new Map(
    list(candidate.authoring_set?.standard_frameworks).map((framework) => [
      framework.framework_id,
      framework,
    ]),
  )
  for (const frameworkRef of inspection.referenced_frameworks) {
    const path = `standards_custody:${frameworkRef}`
    const record = custody.get(frameworkRef)
    if (!record) {
      reject(rejections, 'RELEASE_STANDARDS_CUSTODY_MISSING', path, 'no custody record for a cited framework')
      continue
    }
    if (!record.custodian.trim() || !record.evidence_locator.trim()) {
      reject(rejections, 'RELEASE_STANDARDS_CUSTODY_MISSING', path, 'custody record needs a custodian and evidence locator')
    }
    // An absent framework is already a reference failure from the authoring
    // set; custody has nothing further to say about it.
    const framework = frameworks.get(frameworkRef)
    if (!framework) continue
    if (framework.authority_status !== 'verified') {
      reject(
        rejections,
        'RELEASE_STANDARDS_CUSTODY_MISSING',
        path,
        `framework authority_status is ${framework.authority_status}; admission requires verified`,
      )
    }
    if (record.attested_framework_version !== framework.framework_version) {
      reject(
        rejections,
        'RELEASE_STANDARDS_CUSTODY_MISSING',
        path,
        `custody attests ${record.attested_framework_version} but the framework is ${framework.framework_version}`,
      )
    }
  }
}

function checkSafetyPrivacyGate(candidate: ReleaseCandidate, rejections: AdmissionRejection[]): void {
  const gate = candidate.safety_privacy_gate
  if (gate.status !== 'passed') {
    reject(rejections, 'RELEASE_SAFETY_PRIVACY_GATE_FAILED', 'safety_privacy_gate.status', `gate status is ${gate.status}`)
  }
  if (gate.reviewed_release_version !== candidate.release_version) {
    reject(
      rejections,
      'RELEASE_SAFETY_PRIVACY_GATE_FAILED',
      'safety_privacy_gate.reviewed_release_version',
      `gate reviewed ${gate.reviewed_release_version}, not the candidate's ${candidate.release_version}`,
    )
  }
  if (!gate.evidence_locator.trim()) {
    reject(
      rejections,
      'RELEASE_SAFETY_PRIVACY_GATE_FAILED',
      'safety_privacy_gate.evidence_locator',
      'a passed gate must cite durable evidence',
    )
  }
}

/**
 * Graduation-complete means the release carries the whole published path, so
 * the claim is true only when every canonical grade — 3 through 12, skipping
 * the grade 6 the Academy does not publish — has content.
 */
function checkGraduationClaim(
  candidate: ReleaseCandidate,
  inspection: CandidateInspection,
  rejections: AdmissionRejection[],
): void {
  if (!candidate.graduation_complete) return
  const missing = inspection.coverage.filter((entry) => entry.courses === 0).map((entry) => entry.grade)
  if (missing.length > 0) {
    reject(
      rejections,
      'RELEASE_GRADUATION_CLAIM_FALSE',
      'graduation_complete',
      `claims graduation-complete but publishes no course for grade(s) ${missing.join(', ')}`,
    )
  }
}

/**
 * Fail-closed validation. A schema version this build does not speak short-
 * circuits: running the 2.0.0 authoring validator over content authored
 * against another schema set produces noise, not findings.
 */
export function validateCandidate(candidate: ReleaseCandidate): CandidateValidation {
  const inspection = inspectCandidate(candidate)
  const rejections: AdmissionRejection[] = []

  // An unreadable envelope stops here: every later gate would be comparing
  // absent values against each other and agreeing.
  const envelope = envelopeRejections(candidate)
  const schemaRejection = envelope.length === 0 ? schemaVersionRejection(candidate) : null
  if (envelope.length > 0 || schemaRejection) {
    return {
      report_version: ADMISSION_REPORT_VERSION,
      candidate_id: candidate?.candidate_id,
      release_version: candidate?.release_version,
      admissible: false,
      rejections: Object.freeze(schemaRejection ? [...envelope, schemaRejection] : [...envelope]),
      authoring_issues: Object.freeze([] as AuthoringIssue[]),
      inspection,
    }
  }

  const authoring = validateAuthoringSet(candidate.authoring_set)
  for (const issue of authoring.issues) {
    reject(rejections, ISSUE_CODE_MAP[issue.code], issue.path, `${issue.code}: ${issue.message}`)
  }
  checkGradesAndSubjects(inspection, rejections)
  checkStandardsCustody(candidate, inspection, rejections)
  checkSafetyPrivacyGate(candidate, rejections)
  checkGraduationClaim(candidate, inspection, rejections)

  return {
    report_version: ADMISSION_REPORT_VERSION,
    candidate_id: candidate.candidate_id,
    release_version: candidate.release_version,
    admissible: rejections.length === 0,
    rejections: Object.freeze([...rejections]),
    authoring_issues: authoring.issues,
    inspection,
  }
}

/**
 * The only producer of an AdmittedRelease. Downstream builders take that type
 * and nothing else, so a rejected candidate cannot reach the catalog, the
 * registry, or the readiness evidence.
 */
export function admitCandidate(candidate: ReleaseCandidate): AdmissionDecision {
  const validation = validateCandidate(candidate)
  if (!validation.admissible) {
    return {
      status: 'REJECTED',
      validation,
      rejection_codes: Object.freeze([...new Set(validation.rejections.map((entry) => entry.code))]),
    }
  }
  return {
    status: 'ADMITTED',
    validation,
    release: Object.freeze({
      [ADMITTED_RELEASE]: true as const,
      candidate,
      inspection: validation.inspection,
    }) satisfies AdmittedRelease,
  }
}
