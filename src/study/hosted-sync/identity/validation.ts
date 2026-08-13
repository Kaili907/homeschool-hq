import { ACADEMY_GRADES, ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject, type Grade } from '../../../types'
import {
  HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION,
  STUDY_SESSION_HEADER,
  type HostedAdultAuthenticationState,
  type HostedAdultAuthorizationEnvelope,
  type HostedFamilyAuthorityEnvelope,
  type HostedStudentProfile,
} from './contracts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
const GRADES: readonly Grade[] = ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const AUTH_STATES = new Set<HostedAdultAuthenticationState>(['signed-out', 'expired', 'revoked'])
const FORBIDDEN_PROVIDER_HEADERS = new Set(['cookie', 'set-cookie', STUDY_SESSION_HEADER])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isGrade(value: unknown): value is Grade {
  return typeof value === 'string' && (GRADES as readonly string[]).includes(value)
}

function isAcademyGrade(value: unknown): value is AcademyGrade {
  return typeof value === 'string' && (ACADEMY_GRADES as readonly string[]).includes(value)
}

function isAcademySubject(value: unknown): value is AcademySubject {
  return typeof value === 'string' && (ACADEMY_SUBJECTS as readonly string[]).includes(value)
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function parseHostedStudentRef(
  value: unknown,
): Readonly<{ kind: 'academy-student-id'; value: string }> | null {
  if (!isRecord(value) || !exactKeys(value, ['kind', 'value'])) return null
  if (value.kind !== 'academy-student-id' || !isUuid(value.value)) return null
  return Object.freeze({ kind: 'academy-student-id', value: value.value })
}

function parseStudent(value: unknown): HostedStudentProfile | null {
  if (!isRecord(value) || !exactKeys(value, [
    'studentRef',
    'displayName',
    'nominalGrade',
    'workingGradeBySubject',
    'enabledSubjects',
    'pinRequired',
    'configRevision',
  ])) return null
  const studentRef = parseHostedStudentRef(value.studentRef)
  if (
    !studentRef ||
    typeof value.displayName !== 'string' ||
    value.displayName.trim() !== value.displayName ||
    value.displayName.length < 1 ||
    value.displayName.length > 80 ||
    !isGrade(value.nominalGrade) ||
    !isRecord(value.workingGradeBySubject) ||
    !Array.isArray(value.enabledSubjects) ||
    value.enabledSubjects.length < 1 ||
    value.enabledSubjects.length > ACADEMY_SUBJECTS.length ||
    !value.enabledSubjects.every(isAcademySubject) ||
    new Set(value.enabledSubjects).size !== value.enabledSubjects.length ||
    typeof value.pinRequired !== 'boolean' ||
    !positiveInteger(value.configRevision)
  ) return null

  const enabledSubjects = value.enabledSubjects as AcademySubject[]
  const workingGradeBySubject: Partial<Record<AcademySubject, AcademyGrade>> = {}
  for (const [subject, grade] of Object.entries(value.workingGradeBySubject)) {
    if (!isAcademySubject(subject) || !enabledSubjects.includes(subject) || !isAcademyGrade(grade)) return null
    workingGradeBySubject[subject] = grade
  }

  return Object.freeze({
    studentRef,
    displayName: value.displayName,
    nominalGrade: value.nominalGrade,
    workingGradeBySubject: Object.freeze(workingGradeBySubject),
    enabledSubjects: Object.freeze([...enabledSubjects]),
    pinRequired: value.pinRequired,
    configRevision: value.configRevision,
  })
}

export function parseHostedFamilyAuthorityEnvelope(value: unknown): HostedFamilyAuthorityEnvelope | null {
  if (!isRecord(value) || value.schemaVersion !== HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION) return null
  if (value.status === 'unavailable' || AUTH_STATES.has(value.status as HostedAdultAuthenticationState)) {
    return exactKeys(value, ['schemaVersion', 'status'])
      ? Object.freeze({ schemaVersion: HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION, status: value.status }) as HostedFamilyAuthorityEnvelope
      : null
  }
  if (value.status !== 'authorized' || !exactKeys(value, [
    'schemaVersion',
    'status',
    'adult',
    'household',
    'students',
    'expiresAt',
  ])) return null
  if (
    !isRecord(value.adult) ||
    !exactKeys(value.adult, ['adultRef']) ||
    !isUuid(value.adult.adultRef) ||
    !isRecord(value.household) ||
    !exactKeys(value.household, ['householdRef', 'relationship', 'authorityRevision']) ||
    !isUuid(value.household.householdRef) ||
    !['parent', 'guardian'].includes(String(value.household.relationship)) ||
    !positiveInteger(value.household.authorityRevision) ||
    !Array.isArray(value.students) ||
    value.students.length > 24 ||
    !isInstant(value.expiresAt)
  ) return null
  const students = value.students.map(parseStudent)
  if (students.some((student) => !student)) return null
  const refs = (students as HostedStudentProfile[]).map((student) => student.studentRef.value)
  if (new Set(refs).size !== refs.length) return null

  return Object.freeze({
    schemaVersion: HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION,
    status: 'authorized',
    adult: Object.freeze({ adultRef: value.adult.adultRef }),
    household: Object.freeze({
      householdRef: value.household.householdRef,
      relationship: value.household.relationship as 'parent' | 'guardian',
      authorityRevision: value.household.authorityRevision,
    }),
    students: Object.freeze(students as HostedStudentProfile[]),
    expiresAt: value.expiresAt,
  })
}

export function parseRequestHeaders(
  value: unknown,
  options: Readonly<{ requireAuthorization: boolean; providerHeaders: boolean }>,
): Readonly<Record<string, string>> | null {
  if (!isRecord(value)) return null
  const output: Record<string, string> = {}
  const normalizedNames = new Set<string>()
  let authorizationCount = 0
  for (const [name, headerValue] of Object.entries(value)) {
    const normalized = name.toLowerCase()
    if (
      !HEADER_NAME.test(name) ||
      normalizedNames.has(normalized) ||
      typeof headerValue !== 'string' ||
      headerValue.length < 1 ||
      headerValue.length > 4096 ||
      /[\r\n]/.test(headerValue) ||
      (options.providerHeaders && FORBIDDEN_PROVIDER_HEADERS.has(normalized))
    ) return null
    normalizedNames.add(normalized)
    if (normalized === 'authorization') {
      authorizationCount += 1
      if (!/^Bearer [^\s,]+$/.test(headerValue)) return null
    }
    output[name] = headerValue
  }
  if (Object.keys(output).length > 24) return null
  if (options.requireAuthorization && authorizationCount !== 1) return null
  return Object.freeze(output)
}

export function parseHostedAdultAuthorizationEnvelope(
  value: unknown,
): HostedAdultAuthorizationEnvelope | null {
  if (!isRecord(value) || value.schemaVersion !== HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION) return null
  if (value.status === 'unavailable' || AUTH_STATES.has(value.status as HostedAdultAuthenticationState)) {
    return exactKeys(value, ['schemaVersion', 'status'])
      ? Object.freeze({ schemaVersion: HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION, status: value.status }) as HostedAdultAuthorizationEnvelope
      : null
  }
  if (value.status !== 'authorized' || !exactKeys(value, [
    'schemaVersion',
    'status',
    'adultRef',
    'householdRef',
    'authorityRevision',
    'expiresAt',
    'headers',
  ])) return null
  const headers = parseRequestHeaders(value.headers, { requireAuthorization: true, providerHeaders: true })
  if (
    !isUuid(value.adultRef) ||
    !isUuid(value.householdRef) ||
    !positiveInteger(value.authorityRevision) ||
    !isInstant(value.expiresAt) ||
    !headers
  ) return null
  return Object.freeze({
    schemaVersion: HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION,
    status: 'authorized',
    adultRef: value.adultRef,
    householdRef: value.householdRef,
    authorityRevision: value.authorityRevision,
    expiresAt: value.expiresAt,
    headers,
  })
}
