import { describe, expect, it } from 'vitest'
import type { AcademyGrade, AcademySubject } from '../../../types'
import {
  evaluateFinalFamilyReadiness,
  FINAL_READINESS_CODES,
  type AssignmentLessonScope,
  type FinalReadinessAssignmentConfiguration,
  type FinalReadinessCapabilities,
  type FinalReadinessCode,
  type FinalReadinessStudentConfiguration,
  type SubjectGradeScope,
} from '.'

interface Overrides {
  readonly admitted?: (scope: SubjectGradeScope) => boolean
  readonly material?: (scope: SubjectGradeScope | AssignmentLessonScope, materialRef: string) => boolean
  readonly storage?: FinalReadinessCapabilities['studyStorage']['health']
  readonly subjectAssignment?: (scope: SubjectGradeScope) => boolean
  readonly assignment?: (scope: AssignmentLessonScope) => boolean
  readonly safety?: (scope: SubjectGradeScope | AssignmentLessonScope) => boolean
  readonly completion?: (scope: SubjectGradeScope | AssignmentLessonScope) => boolean
  readonly source?: FinalReadinessCapabilities['dynamicSource']['isQualifying']
  readonly attestation?: (scope: AssignmentLessonScope) => boolean
  readonly tutor?: (scope: SubjectGradeScope) => boolean
  readonly staticHelp?: (scope: SubjectGradeScope) => boolean
}

function capabilities(overrides: Overrides = {}): FinalReadinessCapabilities {
  return {
    curriculumAdmission: { isAdmitted: overrides.admitted ?? (() => true) },
    productionMaterial: { isAvailable: overrides.material ?? (() => true) },
    studyStorage: { health: overrides.storage ?? (() => ({ status: 'HEALTHY', reasonCode: 'NONE' })) },
    assignment: {
      isSubjectAvailable: overrides.subjectAssignment ?? (() => true),
      isAssignmentAvailable: overrides.assignment ?? (() => true),
    },
    safety: { isAvailable: overrides.safety ?? (() => true) },
    completionAuthority: { isAvailable: overrides.completion ?? (() => true) },
    dynamicSource: { isQualifying: overrides.source ?? (() => true) },
    guardianAttestation: { isAvailable: overrides.attestation ?? (() => true) },
    tutor: {
      isTutorAvailable: overrides.tutor ?? (() => true),
      isStaticHelpAvailable: overrides.staticHelp ?? (() => true),
    },
  }
}

function assignment(
  assignmentRef: string,
  lessonRef = `lesson:${assignmentRef}`,
  overrides: Partial<FinalReadinessAssignmentConfiguration> = {},
): FinalReadinessAssignmentConfiguration {
  return {
    assignmentRef,
    lessonRef,
    requiredProductionMaterialRefs: [],
    dynamicSourceRequirement: 'NONE',
    completionRequirement: 'STANDARD',
    ...overrides,
  }
}

function subject(
  value: AcademySubject,
  workingGrade: AcademyGrade,
  assignments: readonly FinalReadinessAssignmentConfiguration[] = [assignment(`${value}:${workingGrade}`)],
) {
  return {
    subject: value,
    workingGrade,
    requiredProductionMaterialRefs: [],
    assignments,
  } as const
}

function student(
  studentRef: string,
  grade: AcademyGrade,
  subjects: readonly AcademySubject[] = ['mathematics'],
): FinalReadinessStudentConfiguration {
  return {
    studentRef,
    displayName: `Student ${studentRef}`,
    enabledSubjects: subjects.map((value) => subject(value, grade)),
  }
}

function allCodes(result: ReturnType<typeof evaluateFinalFamilyReadiness>): readonly FinalReadinessCode[] {
  return result.students.flatMap((studentResult) =>
    studentResult.subjects.flatMap((subjectResult) => [
      ...subjectResult.codes,
      ...subjectResult.assignments.flatMap((assignmentResult) => assignmentResult.codes),
    ]))
}

describe('evaluateFinalFamilyReadiness', () => {
  it('evaluates multiple students independently at canonical working grades', () => {
    const result = evaluateFinalFamilyReadiness([
      student('ada', '5', ['mathematics', 'science']),
      student('bea', '7', ['english-language-arts', 'social-studies']),
      student('cy', '8', ['ready-for-life']),
    ], capabilities())

    expect(result.status).toBe('FINAL_FAMILY_READY')
    expect(result.codes).toEqual(['READY'])
    expect(result.students.map(({ studentRef }) => studentRef)).toEqual(['ada', 'bea', 'cy'])
    expect(result.students.flatMap(({ subjects }) => subjects.map(({ workingGrade }) => workingGrade)))
      .toEqual(['5', '5', '7', '7', '8'])
  })

  it('distinguishes unsupported canonical grade from absent or malformed configuration', () => {
    const unsupported = {
      ...student('ada', '5'),
      enabledSubjects: [{ ...subject('mathematics', '5'), workingGrade: '6' }],
    }
    const malformed = {
      ...student('bea', '7'),
      enabledSubjects: [{ ...subject('science', '7'), workingGrade: 7 }],
    }
    const result = evaluateFinalFamilyReadiness([unsupported, malformed], capabilities())

    expect(result.status).toBe('BLOCKED')
    expect(result.students[0].subjects[0].codes).toEqual(['UNSUPPORTED_CURRICULUM_GRADE'])
    expect(result.students[1].subjects[0].codes).toEqual(['INVALID_CONFIGURATION'])
  })

  it.each([
    ['CURRICULUM_NOT_ADMITTED', { admitted: () => false }],
    ['REQUIRED_PRODUCTION_MATERIAL_MISSING', { material: () => false }],
    ['ASSIGNMENT_UNAVAILABLE', { subjectAssignment: () => false }],
    ['SAFETY_UNAVAILABLE', { safety: () => false }],
    ['COMPLETION_AUTHORITY_UNAVAILABLE', { completion: () => false }],
  ] as const)('hard-blocks %s', (expectedCode, override) => {
    const base = student('ada', '5')
    const configured = {
      ...base,
      enabledSubjects: [{
        ...base.enabledSubjects[0],
        requiredProductionMaterialRefs: ['material:required'],
      }],
    }
    const result = evaluateFinalFamilyReadiness([configured], capabilities(override))

    expect(result.status).toBe('BLOCKED')
    expect(allCodes(result)).toContain(expectedCode)
  })

  it('reports per-student storage health and blocks unavailable or read-only persistence', () => {
    const result = evaluateFinalFamilyReadiness([
      student('healthy', '5'),
      student('degraded', '7'),
      student('unavailable', '8'),
    ], capabilities({
      storage: (studentRef) => studentRef === 'healthy'
        ? { status: 'HEALTHY', reasonCode: 'NONE' }
        : studentRef === 'degraded'
          ? { status: 'DEGRADED', reasonCode: 'RECOVERED_STATE' }
          : { status: 'UNAVAILABLE', reasonCode: 'STORAGE_WRITE_FAILED' },
    }))

    expect(result.status).toBe('BLOCKED')
    expect(result.students[0].storageHealth).toEqual({ status: 'HEALTHY', reasonCode: 'NONE' })
    expect(result.students[1].codes).toContain('STUDY_PERSISTENCE_DEGRADED')
    expect(result.students[1].ready).toBe(true)
    expect(result.students[2].storageHealth).toEqual({
      status: 'UNAVAILABLE',
      reasonCode: 'STORAGE_WRITE_FAILED',
    })
    expect(result.students[2].codes).toContain('STUDY_PERSISTENCE_UNAVAILABLE')
    expect(result.students[2].ready).toBe(false)
  })

  it('keeps Tutor unavailability nonblocking when static help is available', () => {
    const withFallback = evaluateFinalFamilyReadiness([student('ada', '5')], capabilities({
      tutor: () => false,
      staticHelp: () => true,
    }))
    const withoutFallback = evaluateFinalFamilyReadiness([student('bea', '7')], capabilities({
      tutor: () => false,
      staticHelp: () => false,
    }))

    expect(withFallback.status).toBe('FINAL_FAMILY_READY')
    expect(withFallback.students[0].subjects[0].codes)
      .toContain('TUTOR_UNAVAILABLE_STATIC_HELP_AVAILABLE')
    expect(withoutFallback.status).toBe('BLOCKED')
    expect(withoutFallback.students[0].subjects[0].codes).toContain('TUTOR_HELP_UNAVAILABLE')
  })

  it('localizes a dynamic Social source gap to only the affected assignment', () => {
    const pending = assignment('social:current', 'social:lesson:current', {
      dynamicSourceRequirement: 'SOCIAL_STUDIES_SOURCE_ATTACHMENT',
      dynamicSourceMetadata: null,
    })
    const staticLesson = assignment('social:static', 'social:lesson:static')
    const configured = {
      ...student('ada', '7'),
      enabledSubjects: [subject('social-studies', '7', [pending, staticLesson])],
    }

    const result = evaluateFinalFamilyReadiness([configured], capabilities())

    expect(result.status).toBe('FINAL_FAMILY_READY')
    expect(result.codes).toEqual(['PENDING_SOURCE_ATTACHMENT'])
    expect(result.students[0].subjects[0].status).toBe('READY')
    expect(result.students[0].subjects[0].assignments).toMatchObject([
      {
        assignmentRef: 'social:current',
        status: 'PENDING',
        assignableAsNormalFamilyPilotTask: false,
        codes: ['PENDING_SOURCE_ATTACHMENT'],
      },
      {
        assignmentRef: 'social:static',
        status: 'READY',
        assignableAsNormalFamilyPilotTask: true,
        codes: ['READY'],
      },
    ])
  })

  it('releases a dynamic Social lesson only after complete, qualifying metadata is attached', () => {
    const configured = {
      ...student('ada', '7'),
      enabledSubjects: [subject('social-studies', '7', [assignment('social:current', 'social:lesson', {
        dynamicSourceRequirement: 'SOCIAL_STUDIES_SOURCE_ATTACHMENT',
        dynamicSourceMetadata: {
          sourceRef: 'source:current-events:1',
          title: 'Current event source',
          publisher: 'Qualified Publisher',
          publishedAt: '2026-08-12T12:00:00.000Z',
          attachedAt: '2026-08-13T12:00:00.000Z',
        },
      })])],
    }

    const qualifying = evaluateFinalFamilyReadiness([configured], capabilities({ source: () => true }))
    const rejected = evaluateFinalFamilyReadiness([configured], capabilities({ source: () => false }))

    expect(qualifying.students[0].subjects[0].assignments[0].status).toBe('READY')
    expect(rejected.students[0].subjects[0].assignments[0].codes)
      .toEqual(['PENDING_SOURCE_ATTACHMENT'])
  })

  it('requires attestation capability before an RFL guardian task is normally assignable', () => {
    const guardianTask = assignment('rfl:home-task', 'rfl:lesson:home-task', {
      completionRequirement: 'GUARDIAN_ATTESTATION',
    })
    const configured = {
      ...student('ada', '8'),
      enabledSubjects: [subject('ready-for-life', '8', [guardianTask])],
    }

    const absent = evaluateFinalFamilyReadiness([configured], capabilities({ attestation: () => false }))
    const available = evaluateFinalFamilyReadiness([configured], capabilities({ attestation: () => true }))

    expect(absent.status).toBe('FINAL_FAMILY_READY')
    expect(absent.codes).toEqual(['ATTESTATION_CAPABILITY_REQUIRED'])
    expect(absent.students[0].subjects[0].status).toBe('READY')
    expect(absent.students[0].subjects[0].assignments[0]).toMatchObject({
      status: 'PENDING',
      assignableAsNormalFamilyPilotTask: false,
      codes: ['ATTESTATION_CAPABILITY_REQUIRED'],
    })
    expect(available.students[0].subjects[0].assignments[0]).toMatchObject({
      status: 'READY',
      assignableAsNormalFamilyPilotTask: true,
      codes: ['READY'],
    })
  })

  it('uses only codes from the exported closed vocabulary', () => {
    const configured = {
      ...student('ada', '7'),
      enabledSubjects: [subject('social-studies', '7', [assignment('social:current', 'social:lesson', {
        dynamicSourceRequirement: 'SOCIAL_STUDIES_SOURCE_ATTACHMENT',
      })])],
    }
    const result = evaluateFinalFamilyReadiness([configured], capabilities({
      admitted: () => false,
      material: () => false,
      tutor: () => false,
    }))

    for (const code of [...result.codes, ...allCodes(result)]) {
      expect(FINAL_READINESS_CODES).toContain(code)
    }
  })
})
