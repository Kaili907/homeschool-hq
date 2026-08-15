import type { StudyCheckpoint, StudyScope, StudySessionSnapshot } from '../../types'
import {
  FINAL_E2E_PERSISTENCE_KEY,
  FINAL_E2E_STATE_VERSION,
  type FinalE2EActionResult,
  type FinalE2EAssignmentSnapshot,
  type FinalE2EAssignmentState,
  type FinalE2EBackupArtifact,
  type FinalE2EBackupRecoveryPort,
  type FinalE2ECompletionPolicy,
  type FinalE2EPersistencePort,
  type FinalE2ERuntimeSnapshot,
  type FinalE2ESafetyPort,
  type FinalE2ESourceFixture,
  type FinalE2EStudentSnapshot,
  type FinalFamilyPilotRuntime,
  type FinalFamilyPilotRuntimeFactory,
  type FinalFamilyPilotRuntimeInput,
} from './contracts'

type MutableAssignment = {
  assignmentRef: string
  lessonRef: string
  studentRef: string
  subject: FinalE2EAssignmentSnapshot['subject']
  state: FinalE2EAssignmentState
  segmentRefs: string[]
  completedSegmentRefs: string[]
  currentSegmentRef: string | null
  checkpointRevision: number
  sourceRef: string | null
  completedAt: string | null
  attestedAt: string | null
  rawAnswerIncluded: false
  audioIncluded: false
  transcriptIncluded: false
}

type MutableStudent = Omit<FinalE2EStudentSnapshot, 'assignments'> & {
  assignments: MutableAssignment[]
}

interface PersistedState {
  schemaVersion: typeof FINAL_E2E_STATE_VERSION
  activeStudentRef: string | null
  students: MutableStudent[]
}

const FORBIDDEN_PRIVATE_KEY = /(?:raw(?:answer|response)|audio|transcript|learnertext|responsebody)/i

function clone<T>(value: T): T {
  return structuredClone(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') &&
    new Set(value).size === value.length
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

const ASSIGNMENT_STATES: readonly FinalE2EAssignmentState[] = [
  'not-started',
  'active',
  'paused',
  'blocked-source',
  'in-progress',
  'pending-attestation',
  'certified',
]

const SUBJECTS: readonly FinalE2EAssignmentSnapshot['subject'][] = [
  'mathematics',
  'science',
  'social-studies',
  'ready-for-life',
]

function hasForbiddenPrivateData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenPrivateData)
  if (!isRecord(value)) return false
  return Object.entries(value).some(([key, nested]) =>
    (FORBIDDEN_PRIVATE_KEY.test(key) && nested !== false && nested !== null) || hasForbiddenPrivateData(nested))
}

function parseState(serialized: string): PersistedState | null {
  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    return null
  }
  if (!isRecord(value) || value.schemaVersion !== FINAL_E2E_STATE_VERSION || hasForbiddenPrivateData(value)) return null
  if (!(value.activeStudentRef === null || typeof value.activeStudentRef === 'string')) return null
  if (!Array.isArray(value.students)) return null
  const studentRefs = new Set<string>()
  for (const student of value.students) {
    if (!isRecord(student) || typeof student.studentRef !== 'string' || typeof student.displayName !== 'string') return null
    if (!['5', '7', '8'].includes(String(student.grade)) || !Array.isArray(student.assignments)) return null
    if (studentRefs.has(student.studentRef)) return null
    studentRefs.add(student.studentRef)
    const assignmentRefs = new Set<string>()
    for (const assignment of student.assignments) {
      if (
        !isRecord(assignment) || typeof assignment.assignmentRef !== 'string' ||
        typeof assignment.lessonRef !== 'string' || assignment.studentRef !== student.studentRef ||
        !SUBJECTS.includes(assignment.subject as FinalE2EAssignmentSnapshot['subject']) ||
        !ASSIGNMENT_STATES.includes(assignment.state as FinalE2EAssignmentState) ||
        !isStringList(assignment.segmentRefs) || !isStringList(assignment.completedSegmentRefs) ||
        !isNullableString(assignment.currentSegmentRef) ||
        !Number.isSafeInteger(assignment.checkpointRevision) || Number(assignment.checkpointRevision) < 0 ||
        !isNullableString(assignment.sourceRef) || !isNullableString(assignment.completedAt) ||
        !isNullableString(assignment.attestedAt)
      ) return null
      if (assignmentRefs.has(assignment.assignmentRef)) return null
      assignmentRefs.add(assignment.assignmentRef)
      if (!(assignment.completedSegmentRefs as string[]).every((ref) => (assignment.segmentRefs as string[]).includes(ref))) return null
      if (assignment.currentSegmentRef !== null && !(assignment.segmentRefs as string[]).includes(assignment.currentSegmentRef)) return null
      if (assignment.rawAnswerIncluded !== false || assignment.audioIncluded !== false || assignment.transcriptIncluded !== false) return null
    }
  }
  if (value.activeStudentRef !== null && !studentRefs.has(value.activeStudentRef)) return null
  return clone(value) as unknown as PersistedState
}

function assignmentRef(studentRef: string, lessonRef: string): string {
  return `assignment:${studentRef}:${lessonRef}`
}

function scopeFor(assignment: MutableAssignment): StudyScope {
  return {
    householdRef: 'synthetic:household',
    learnerRef: assignment.studentRef,
    sessionRef: `session:${assignment.studentRef}:${assignment.lessonRef}`,
  }
}

function action(status: 'ok', snapshot: FinalE2ERuntimeSnapshot): FinalE2EActionResult
function action(
  status: 'blocked' | 'refused',
  snapshot: FinalE2ERuntimeSnapshot,
  reasonCode: string,
): FinalE2EActionResult
function action(
  status: 'ok' | 'blocked' | 'refused',
  snapshot: FinalE2ERuntimeSnapshot,
  reasonCode?: string,
): FinalE2EActionResult {
  return status === 'ok'
    ? { status, snapshot }
    : { status, reasonCode: reasonCode as string, snapshot }
}

class ReferenceFinalFamilyPilotRuntime implements FinalFamilyPilotRuntime {
  readonly #input: FinalFamilyPilotRuntimeInput
  #state: PersistedState
  #refusalReason: string | null = null
  #destroyed = false

  constructor(input: FinalFamilyPilotRuntimeInput) {
    this.#input = input
    const serialized = input.persistence.getItem(FINAL_E2E_PERSISTENCE_KEY)
    if (serialized === null) {
      this.#state = this.#seed()
      this.#persist()
      return
    }
    const parsed = parseState(serialized)
    if (parsed) {
      this.#state = parsed
      return
    }
    this.#state = { schemaVersion: FINAL_E2E_STATE_VERSION, activeStudentRef: null, students: [] }
    this.#refusalReason = 'unsupported-or-corrupt-persistence'
  }

  snapshot = (): FinalE2ERuntimeSnapshot => ({
    status: this.#refusalReason === null && !this.#destroyed ? 'ready' : 'refused',
    refusalReason: this.#destroyed ? 'runtime-destroyed' : this.#refusalReason,
    activeStudentRef: this.#state.activeStudentRef,
    students: clone(this.#state.students),
  })

  selectStudent = (studentRef: string): FinalE2EActionResult => {
    const unavailable = this.#unavailable()
    if (unavailable) return unavailable
    if (!this.#state.students.some((student) => student.studentRef === studentRef)) {
      return action('refused', this.snapshot(), 'unknown-student')
    }
    this.#state.activeStudentRef = studentRef
    this.#persist()
    return action('ok', this.snapshot())
  }

  start = async (studentRef: string, lessonRef: string): Promise<FinalE2EActionResult> => {
    const unavailable = this.#unavailable()
    if (unavailable) return unavailable
    const assignment = this.#assignment(studentRef, lessonRef)
    if (!assignment) return action('refused', this.snapshot(), 'unknown-assignment')
    const safety = this.#input.safetyPort.checkEntry({ studentRef, assignmentRef: assignment.assignmentRef })
    if (!safety.allowed) return action('blocked', this.snapshot(), safety.reasonCode)
    if (assignment.state === 'blocked-source') return action('blocked', this.snapshot(), 'qualifying-source-required')
    if (assignment.state === 'certified') return action('ok', this.snapshot())
    assignment.state = 'active'
    assignment.currentSegmentRef = assignment.segmentRefs.find((ref) => !assignment.completedSegmentRefs.includes(ref)) ?? null
    this.#state.activeStudentRef = studentRef
    await this.#input.studyPorts.persistence.saveSession(this.#studySnapshot(assignment, 'active'))
    this.#persist()
    return action('ok', this.snapshot())
  }

  completeSegments = async (
    studentRef: string,
    lessonRef: string,
    count: number,
  ): Promise<FinalE2EActionResult> => {
    const unavailable = this.#unavailable()
    if (unavailable) return unavailable
    const assignment = this.#assignment(studentRef, lessonRef)
    if (!assignment) return action('refused', this.snapshot(), 'unknown-assignment')
    const safety = this.#input.safetyPort.checkEntry({ studentRef, assignmentRef: assignment.assignmentRef })
    if (!safety.allowed) return action('blocked', this.snapshot(), safety.reasonCode)
    if (assignment.state !== 'active') return action('refused', this.snapshot(), 'assignment-not-active')
    for (let index = 0; index < count; index += 1) {
      const current = assignment.segmentRefs.find((ref) => !assignment.completedSegmentRefs.includes(ref))
      if (!current) break
      assignment.completedSegmentRefs.push(current)
    }
    assignment.currentSegmentRef = assignment.segmentRefs.find((ref) => !assignment.completedSegmentRefs.includes(ref)) ?? null
    this.#persist()
    return action('ok', this.snapshot())
  }

  checkpoint = async (studentRef: string, lessonRef: string): Promise<FinalE2EActionResult> => {
    const unavailable = this.#unavailable()
    if (unavailable) return unavailable
    const assignment = this.#assignment(studentRef, lessonRef)
    if (!assignment || assignment.state !== 'active' || assignment.currentSegmentRef === null) {
      return action('refused', this.snapshot(), 'assignment-not-checkpointable')
    }
    assignment.checkpointRevision += 1
    const scope = scopeFor(assignment)
    const checkpoint: StudyCheckpoint = {
      checkpointRef: `${scope.sessionRef}:checkpoint:${assignment.checkpointRevision}`,
      ...scope,
      lessonRef,
      segmentRef: assignment.currentSegmentRef,
      revision: assignment.checkpointRevision,
      capturedAt: this.#at(),
      completedSegmentRefs: [...assignment.completedSegmentRefs],
      elapsedActiveSecondsInSegment: 0,
      responseDraftRef: null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }
    await this.#input.studyPorts.checkpoint.save(checkpoint)
    this.#persist()
    return action('ok', this.snapshot())
  }

  finishLesson = async (studentRef: string, lessonRef: string): Promise<FinalE2EActionResult> => {
    const unavailable = this.#unavailable()
    if (unavailable) return unavailable
    const assignment = this.#assignment(studentRef, lessonRef)
    if (!assignment || assignment.state !== 'active') return action('refused', this.snapshot(), 'assignment-not-active')
    assignment.completedSegmentRefs = [...assignment.segmentRefs]
    assignment.currentSegmentRef = null
    const lesson = this.#lesson(studentRef, lessonRef)
    if (!lesson) return action('refused', this.snapshot(), 'unknown-lesson')
    assignment.state = this.#input.completionPolicy.learnerFinish({
      studentRef,
      assignmentRef: assignment.assignmentRef,
      authority: lesson.completionAuthority,
      at: this.#at(),
    })
    if (assignment.state === 'certified') assignment.completedAt = this.#at()
    this.#persist()
    return action('ok', this.snapshot())
  }

  adultAttest = async (studentRef: string, lessonRef: string): Promise<FinalE2EActionResult> => {
    const unavailable = this.#unavailable()
    if (unavailable) return unavailable
    const assignment = this.#assignment(studentRef, lessonRef)
    const lesson = this.#lesson(studentRef, lessonRef)
    if (!assignment || !lesson || assignment.state !== 'pending-attestation') {
      return action('refused', this.snapshot(), 'attestation-not-pending')
    }
    assignment.state = this.#input.completionPolicy.adultAttest({
      studentRef,
      assignmentRef: assignment.assignmentRef,
      authority: lesson.completionAuthority,
      at: this.#at(),
    })
    if (assignment.state !== 'certified') return action('refused', this.snapshot(), 'attestation-refused')
    assignment.attestedAt = this.#at()
    assignment.completedAt = this.#at()
    this.#persist()
    return action('ok', this.snapshot())
  }

  attachSource = async (
    studentRef: string,
    lessonRef: string,
    source: FinalE2ESourceFixture,
  ): Promise<FinalE2EActionResult> => {
    const unavailable = this.#unavailable()
    if (unavailable) return unavailable
    const assignment = this.#assignment(studentRef, lessonRef)
    const lesson = this.#lesson(studentRef, lessonRef)
    if (!assignment || !lesson) return action('refused', this.snapshot(), 'unknown-assignment')
    const qualified = this.#input.productionMaterialProvider.qualifySource({ lesson, source })
    if (!qualified.qualified) return action('blocked', this.snapshot(), qualified.reasonCode ?? 'source-refused')
    const resolution = this.#input.productionMaterialProvider.resolve({ lesson, sourceRef: source.sourceRef })
    if (resolution.status !== 'ready') return action('blocked', this.snapshot(), resolution.reasonCode)
    assignment.sourceRef = source.sourceRef
    assignment.segmentRefs = [...resolution.segmentRefs]
    assignment.state = 'not-started'
    this.#persist()
    return action('ok', this.snapshot())
  }

  clearSafetyHold = async (studentRef: string): Promise<FinalE2EActionResult> => {
    const unavailable = this.#unavailable()
    if (unavailable) return unavailable
    this.#input.safetyPort.clearHold({ studentRef, at: this.#at() })
    return action('ok', this.snapshot())
  }

  exportBackup = async (): Promise<FinalE2EBackupArtifact> => {
    const serialized = this.#input.persistence.getItem(FINAL_E2E_PERSISTENCE_KEY)
    if (serialized === null || parseState(serialized) === null) throw new Error('Cannot export invalid pilot state.')
    return this.#input.backupRecovery.exportState(serialized)
  }

  reset = async (): Promise<void> => {
    this.#input.persistence.removeItem(FINAL_E2E_PERSISTENCE_KEY)
    this.#state = this.#seed()
    this.#refusalReason = null
  }

  restore = async (artifact: FinalE2EBackupArtifact): Promise<FinalE2EActionResult> => {
    const recovered = this.#input.backupRecovery.recoverState(artifact)
    if (recovered.status !== 'ok') return action('refused', this.snapshot(), recovered.reasonCode)
    const parsed = parseState(recovered.serializedState)
    if (!parsed) return action('refused', this.snapshot(), 'invalid-backup-state')
    this.#state = parsed
    this.#refusalReason = null
    this.#persist()
    return action('ok', this.snapshot())
  }

  destroy = (): void => {
    this.#destroyed = true
  }

  #seed(): PersistedState {
    return {
      schemaVersion: FINAL_E2E_STATE_VERSION,
      activeStudentRef: null,
      students: this.#input.fixtures.students.map((fixture) => ({
        ...fixture,
        assignments: this.#input.curriculumProvider.listLessons(fixture.grade).map((lesson) => {
          const material = this.#input.productionMaterialProvider.resolve({ lesson, sourceRef: null })
          return {
            assignmentRef: assignmentRef(fixture.studentRef, lesson.lessonRef),
            lessonRef: lesson.lessonRef,
            studentRef: fixture.studentRef,
            subject: lesson.subject,
            state: material.status === 'ready' ? 'not-started' : 'blocked-source',
            segmentRefs: material.status === 'ready' ? [...material.segmentRefs] : [],
            completedSegmentRefs: [],
            currentSegmentRef: null,
            checkpointRevision: 0,
            sourceRef: null,
            completedAt: null,
            attestedAt: null,
            rawAnswerIncluded: false,
            audioIncluded: false,
            transcriptIncluded: false,
          }
        }),
      })),
    }
  }

  #assignment(studentRef: string, lessonRef: string): MutableAssignment | null {
    return this.#state.students.find((student) => student.studentRef === studentRef)
      ?.assignments.find((assignment) => assignment.lessonRef === lessonRef) ?? null
  }

  #lesson(studentRef: string, lessonRef: string) {
    const grade = this.#state.students.find((student) => student.studentRef === studentRef)?.grade
    return grade ? this.#input.curriculumProvider.listLessons(grade).find((lesson) => lesson.lessonRef === lessonRef) : undefined
  }

  #studySnapshot(assignment: MutableAssignment, status: StudySessionSnapshot['status']): StudySessionSnapshot {
    return {
      scope: scopeFor(assignment),
      lessonRef: assignment.lessonRef,
      segmentRef: assignment.currentSegmentRef ?? assignment.segmentRefs[0] ?? 'segment:unavailable',
      status,
      updatedAt: this.#at(),
      lastAcceptedEventRef: null,
      lastProgressionDecisionRef: null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }
  }

  #persist(): void {
    if (hasForbiddenPrivateData(this.#state)) throw new Error('Private learner data cannot be persisted.')
    this.#input.persistence.setItem(FINAL_E2E_PERSISTENCE_KEY, JSON.stringify(this.#state))
  }

  #at(): string {
    return this.#input.now().toISOString()
  }

  #unavailable(): FinalE2EActionResult | null {
    if (this.#destroyed) return action('refused', this.snapshot(), 'runtime-destroyed')
    if (this.#refusalReason) return action('refused', this.snapshot(), this.#refusalReason)
    return null
  }
}

export const referenceRuntimeFactory = Object.freeze<FinalFamilyPilotRuntimeFactory>({
  create: (input) => new ReferenceFinalFamilyPilotRuntime(input),
})

export function createMemoryFinalE2EPersistence(): FinalE2EPersistencePort {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
    entries: () => [...values.entries()],
  }
}

export function createReferenceSafetyPort(): FinalE2ESafetyPort {
  const holds = new Map<string, string>()
  return {
    checkEntry: ({ studentRef }) => {
      const reasonCode = holds.get(studentRef)
      return reasonCode ? { allowed: false, reasonCode } : { allowed: true }
    },
    placeHold: ({ studentRef, reasonCode }) => { holds.set(studentRef, reasonCode) },
    clearHold: ({ studentRef }) => { holds.delete(studentRef) },
  }
}

export const referenceCompletionPolicy = Object.freeze<FinalE2ECompletionPolicy>({
  learnerFinish: ({ authority }) => authority === 'guardian' ? 'pending-attestation' : 'certified',
  adultAttest: ({ authority }) => authority === 'guardian' ? 'certified' : 'in-progress',
})

export const referenceBackupRecovery = Object.freeze<FinalE2EBackupRecoveryPort>({
  exportState: (serializedState) => ({
    format: 'family-pilot-final-e2e-backup-v1',
    payload: serializedState,
  }),
  recoverState: (artifact) => artifact.format === 'family-pilot-final-e2e-backup-v1'
    ? { status: 'ok', serializedState: artifact.payload }
    : { status: 'refused', reasonCode: 'unsupported-backup-format' },
})

export const FINAL_E2E_PRIVATE_FIELD_PATTERN = FORBIDDEN_PRIVATE_KEY
