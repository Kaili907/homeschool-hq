import { ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject } from '../../../types'
import {
  FINAL_READINESS_CODES,
  HARD_BLOCKING_READINESS_CODES,
  type AssignmentLessonScope,
  type DynamicSourceMetadata,
  type FinalAssignmentReadinessResult,
  type FinalFamilyReadinessResult,
  type FinalReadinessCapabilities,
  type FinalReadinessCode,
  type FinalReadinessStudentConfiguration,
  type FinalStudentReadinessResult,
  type FinalSubjectReadinessResult,
  type StudyStorageHealth,
  type SubjectGradeScope,
} from './types'

/** Runtime values checked by the canonical AcademyGrade type. */
export const FAMILY_PILOT_CURRICULUM_GRADES = Object.freeze(
  ['5', '7', '8'] as const satisfies readonly AcademyGrade[],
)

const CODE_ORDER = new Map<FinalReadinessCode, number>(
  FINAL_READINESS_CODES.map((code, index) => [code, index]),
)
const HARD_CODES = new Set<FinalReadinessCode>(HARD_BLOCKING_READINESS_CODES)
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/

function codes(values: readonly FinalReadinessCode[]): readonly FinalReadinessCode[] {
  const unique = [...new Set(values)]
  unique.sort((left, right) => (CODE_ORDER.get(left) ?? 999) - (CODE_ORDER.get(right) ?? 999))
  return Object.freeze(unique.length === 0 ? ['READY'] : unique)
}

function hasHardBlock(values: readonly FinalReadinessCode[]): boolean {
  return values.some((code) => HARD_CODES.has(code))
}

function safeBoolean(check: () => boolean): boolean {
  try {
    return check() === true
  } catch {
    return false
  }
}

function validRef(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value)
}

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160
}

function isAcademySubject(value: unknown): value is AcademySubject {
  return typeof value === 'string' && (ACADEMY_SUBJECTS as readonly string[]).includes(value)
}

function isAcademyGrade(value: unknown): value is AcademyGrade {
  return typeof value === 'string' && (FAMILY_PILOT_CURRICULUM_GRADES as readonly string[]).includes(value)
}

function isConfiguredGrade(value: unknown): value is string {
  return typeof value === 'string' && /^\d{1,2}$/.test(value)
}

function validMaterialRefs(values: readonly string[]): boolean {
  return Array.isArray(values) && values.every(validRef) && new Set(values).size === values.length
}

function sourceMetadataIsComplete(metadata: DynamicSourceMetadata): boolean {
  return validRef(metadata.sourceRef) &&
    validText(metadata.title) &&
    validText(metadata.publisher) &&
    Number.isFinite(Date.parse(metadata.publishedAt)) &&
    Number.isFinite(Date.parse(metadata.attachedAt))
}

function storageHealth(
  capabilities: FinalReadinessCapabilities,
  studentRef: string,
): StudyStorageHealth {
  try {
    const health = capabilities.studyStorage.health(studentRef)
    const validPair = health.status === 'HEALTHY'
      ? health.reasonCode === 'NONE'
      : health.status === 'DEGRADED'
        ? health.reasonCode === 'RECOVERED_STATE'
        : health.status === 'READ_ONLY'
          ? health.reasonCode === 'SCHEMA_VERSION_AHEAD'
          : health.status === 'UNAVAILABLE' && [
            'STORAGE_UNAVAILABLE',
            'STORAGE_WRITE_FAILED',
            'HEALTH_PROBE_FAILED',
          ].includes(health.reasonCode)
    if (validPair) return Object.freeze({ ...health })
  } catch {
    // A failed health probe is itself closed, reportable unavailable evidence.
  }
  return Object.freeze({ status: 'UNAVAILABLE', reasonCode: 'HEALTH_PROBE_FAILED' })
}

function materialCodes(
  scope: SubjectGradeScope | AssignmentLessonScope,
  materialRefs: readonly string[],
  capabilities: FinalReadinessCapabilities,
): FinalReadinessCode[] {
  if (!validMaterialRefs(materialRefs)) return ['INVALID_CONFIGURATION']
  return materialRefs.some((materialRef) =>
    !safeBoolean(() => capabilities.productionMaterial.isAvailable(scope, materialRef)))
    ? ['REQUIRED_PRODUCTION_MATERIAL_MISSING']
    : []
}

function evaluateAssignment(
  scope: SubjectGradeScope,
  assignment: FinalReadinessStudentConfiguration['enabledSubjects'][number]['assignments'][number],
  capabilities: FinalReadinessCapabilities,
): FinalAssignmentReadinessResult {
  const found: FinalReadinessCode[] = []
  const assignmentValid = validRef(assignment.assignmentRef) &&
    validRef(assignment.lessonRef) &&
    ['NONE', 'SOCIAL_STUDIES_SOURCE_ATTACHMENT'].includes(assignment.dynamicSourceRequirement) &&
    ['STANDARD', 'GUARDIAN_ATTESTATION'].includes(assignment.completionRequirement)

  if (!assignmentValid) {
    found.push('INVALID_CONFIGURATION')
  } else {
    const assignmentScope: AssignmentLessonScope = {
      ...scope,
      assignmentRef: assignment.assignmentRef,
      lessonRef: assignment.lessonRef,
    }
    found.push(...materialCodes(assignmentScope, assignment.requiredProductionMaterialRefs, capabilities))
    if (!safeBoolean(() => capabilities.assignment.isAssignmentAvailable(assignmentScope))) {
      found.push('ASSIGNMENT_UNAVAILABLE')
    }
    if (!safeBoolean(() => capabilities.safety.isAvailable(assignmentScope))) {
      found.push('SAFETY_UNAVAILABLE')
    }
    if (!safeBoolean(() => capabilities.completionAuthority.isAvailable(assignmentScope))) {
      found.push('COMPLETION_AUTHORITY_UNAVAILABLE')
    }

    if (
      assignment.dynamicSourceRequirement === 'SOCIAL_STUDIES_SOURCE_ATTACHMENT' &&
      scope.subject !== 'social-studies'
    ) {
      found.push('INVALID_CONFIGURATION')
    } else if (assignment.dynamicSourceRequirement === 'SOCIAL_STUDIES_SOURCE_ATTACHMENT') {
      const metadata = assignment.dynamicSourceMetadata
      const sourceReady = Boolean(metadata) &&
        sourceMetadataIsComplete(metadata as DynamicSourceMetadata) &&
        safeBoolean(() => capabilities.dynamicSource.isQualifying(
          assignmentScope,
          metadata as DynamicSourceMetadata,
        ))
      if (!sourceReady) found.push('PENDING_SOURCE_ATTACHMENT')
    }

    if (
      assignment.completionRequirement === 'GUARDIAN_ATTESTATION' &&
      !safeBoolean(() => capabilities.guardianAttestation.isAvailable(assignmentScope))
    ) found.push('ATTESTATION_CAPABILITY_REQUIRED')
  }

  const resultCodes = codes(found)
  const blocked = hasHardBlock(resultCodes)
  const pending = resultCodes.includes('PENDING_SOURCE_ATTACHMENT') ||
    resultCodes.includes('ATTESTATION_CAPABILITY_REQUIRED')
  const status = blocked ? 'BLOCKED' : pending ? 'PENDING' : 'READY'
  return Object.freeze({
    assignmentRef: assignment.assignmentRef,
    lessonRef: assignment.lessonRef,
    status,
    assignableAsNormalFamilyPilotTask: status === 'READY',
    codes: resultCodes,
  })
}

function evaluateSubject(
  studentRef: string,
  subjectConfig: FinalReadinessStudentConfiguration['enabledSubjects'][number],
  capabilities: FinalReadinessCapabilities,
  storage: StudyStorageHealth,
  duplicated: boolean,
): FinalSubjectReadinessResult {
  const found: FinalReadinessCode[] = []
  const { subject, workingGrade } = subjectConfig
  if (duplicated || !isAcademySubject(subject) || !isConfiguredGrade(workingGrade)) {
    found.push('INVALID_CONFIGURATION')
    return Object.freeze({
      subject,
      workingGrade,
      status: 'BLOCKED',
      codes: codes(found),
      assignments: Object.freeze([]),
    })
  }
  if (!isAcademyGrade(workingGrade)) {
    found.push('UNSUPPORTED_CURRICULUM_GRADE')
    return Object.freeze({
      subject,
      workingGrade,
      status: 'BLOCKED',
      codes: codes(found),
      assignments: Object.freeze([]),
    })
  }

  const scope: SubjectGradeScope = { studentRef, subject, workingGrade }
  if (!safeBoolean(() => capabilities.curriculumAdmission.isAdmitted(scope))) {
    found.push('CURRICULUM_NOT_ADMITTED')
  }
  found.push(...materialCodes(scope, subjectConfig.requiredProductionMaterialRefs, capabilities))
  if (storage.status === 'READ_ONLY' || storage.status === 'UNAVAILABLE') {
    found.push('STUDY_PERSISTENCE_UNAVAILABLE')
  } else if (storage.status === 'DEGRADED') {
    found.push('STUDY_PERSISTENCE_DEGRADED')
  }
  if (!safeBoolean(() => capabilities.assignment.isSubjectAvailable(scope))) {
    found.push('ASSIGNMENT_UNAVAILABLE')
  }
  if (!safeBoolean(() => capabilities.safety.isAvailable(scope))) {
    found.push('SAFETY_UNAVAILABLE')
  }
  if (!safeBoolean(() => capabilities.completionAuthority.isAvailable(scope))) {
    found.push('COMPLETION_AUTHORITY_UNAVAILABLE')
  }

  const tutorAvailable = safeBoolean(() => capabilities.tutor.isTutorAvailable(scope))
  if (!tutorAvailable) {
    if (safeBoolean(() => capabilities.tutor.isStaticHelpAvailable(scope))) {
      found.push('TUTOR_UNAVAILABLE_STATIC_HELP_AVAILABLE')
    } else {
      found.push('TUTOR_HELP_UNAVAILABLE')
    }
  }

  const assignmentRefs = new Set<string>()
  const lessonRefs = new Set<string>()
  const duplicateAssignmentRefs = new Set<string>()
  for (const assignment of subjectConfig.assignments) {
    if (assignmentRefs.has(assignment.assignmentRef) || lessonRefs.has(assignment.lessonRef)) {
      duplicateAssignmentRefs.add(assignment.assignmentRef)
    }
    assignmentRefs.add(assignment.assignmentRef)
    lessonRefs.add(assignment.lessonRef)
  }
  const assignments = subjectConfig.assignments.map((assignment) => {
    if (!duplicateAssignmentRefs.has(assignment.assignmentRef)) {
      return evaluateAssignment(scope, assignment, capabilities)
    }
    return Object.freeze({
      assignmentRef: assignment.assignmentRef,
      lessonRef: assignment.lessonRef,
      status: 'BLOCKED' as const,
      assignableAsNormalFamilyPilotTask: false,
      codes: codes(['INVALID_CONFIGURATION']),
    })
  })
  found.push(...assignments.flatMap((assignment) => assignment.codes.filter((code) => code !== 'READY')))

  const resultCodes = codes(found)
  return Object.freeze({
    subject,
    workingGrade,
    status: hasHardBlock(resultCodes) ? 'BLOCKED' : 'READY',
    codes: resultCodes,
    assignments: Object.freeze(assignments),
  })
}

function evaluateStudent(
  student: FinalReadinessStudentConfiguration,
  capabilities: FinalReadinessCapabilities,
  duplicated: boolean,
): FinalStudentReadinessResult {
  const found: FinalReadinessCode[] = []
  const valid = !duplicated && validRef(student.studentRef) && validText(student.displayName) &&
    Array.isArray(student.enabledSubjects) && student.enabledSubjects.length > 0
  const health = validRef(student.studentRef)
    ? storageHealth(capabilities, student.studentRef)
    : Object.freeze({ status: 'UNAVAILABLE' as const, reasonCode: 'HEALTH_PROBE_FAILED' as const })
  if (!valid) found.push('INVALID_CONFIGURATION')

  const enabledSubjects = Array.isArray(student.enabledSubjects) ? student.enabledSubjects : []
  const counts = new Map<string, number>()
  for (const subject of enabledSubjects) {
    counts.set(subject.subject, (counts.get(subject.subject) ?? 0) + 1)
  }
  const subjects = valid
    ? enabledSubjects.map((subject) =>
      evaluateSubject(student.studentRef, subject, capabilities, health, (counts.get(subject.subject) ?? 0) > 1))
    : []
  found.push(...subjects.flatMap((subject) => subject.codes))
  const resultCodes = codes(found.filter((code) => code !== 'READY'))
  const ready = !hasHardBlock(resultCodes) && subjects.every((subject) => subject.status === 'READY')
  return Object.freeze({
    studentRef: student.studentRef,
    displayName: student.displayName,
    ready,
    codes: resultCodes,
    storageHealth: health,
    subjects: Object.freeze(subjects),
  })
}

/**
 * Pure final-convergence gate. It performs no discovery and mutates no input;
 * convergence supplies capability snapshots/ports from the owning modules.
 */
export function evaluateFinalFamilyReadiness(
  students: readonly FinalReadinessStudentConfiguration[],
  capabilities: FinalReadinessCapabilities,
): FinalFamilyReadinessResult {
  if (!Array.isArray(students) || students.length === 0) {
    return Object.freeze({ status: 'BLOCKED', codes: codes(['INVALID_CONFIGURATION']), students: [] })
  }
  const counts = new Map<string, number>()
  for (const student of students) counts.set(student.studentRef, (counts.get(student.studentRef) ?? 0) + 1)
  const results = students.map((student) =>
    evaluateStudent(student, capabilities, (counts.get(student.studentRef) ?? 0) > 1))
  const resultCodes = codes(results.flatMap((student) => student.codes).filter((code) => code !== 'READY'))
  return Object.freeze({
    status: results.every((student) => student.ready) ? 'FINAL_FAMILY_READY' : 'BLOCKED',
    codes: resultCodes,
    students: Object.freeze(results),
  })
}
