import type { FinalCatalogLesson } from '../../../curriculum/final-runtime'
import type {
  FinalFamilyPilotCatalog,
  FinalLearnerAssessmentMaterial,
  FinalLearnerProductionMaterial,
  FinalProductionBinding,
} from '../../../curriculum/final-app-data'
import type { AcademyGrade, AcademySubject } from '../../../types'
import { adaptHostLessonToStudyPlan, type HostLessonDescriptor } from '../../curriculumAdapter'
import type { StudySafetyPort, StudyPortBundle } from '../../ports'
import type { HostStudyLaunchContext, StudySafetyRequest, StudySafetyResult, StudySubject } from '../../types'
import { isConcerning } from '../../../tutor/tutorEngine'
import {
  addFamilyPilotAssignment,
  completeFamilyPilotAssignment,
  createFamilyPilotStudent,
  findFamilyPilotStudent,
  loadFamilyPilotState,
  pauseFamilyPilotAssignment,
  recordFamilyPilotProgress,
  resumeFamilyPilotAssignment,
  saveFamilyPilotState,
  setActiveFamilyPilotStudent,
  startFamilyPilotAssignment,
  updateFamilyPilotState,
  type FamilyPilotAssignmentRecordV1,
  type FamilyPilotSnapshot,
  type FamilyPilotStateV1,
  type FamilyPilotStoreOptions,
} from '../core'
import {
  createFinalFamilyPilotStudyRuntime,
  type CreateFinalFamilyPilotStudyRuntimeOptions,
  type FinalFamilyPilotAttestationRecord,
  type FinalFamilyPilotResult,
  type FinalFamilyPilotStudyRuntimeApi,
} from '../final-composition'
import {
  evaluateFinalFamilyReadiness,
  type FinalAssignmentReadinessResult,
  type FinalReadinessStudentConfiguration,
  type StudyStorageHealth,
} from '../final-readiness'
import {
  canStudentResume,
  clearSafetyHold,
  createSafetyHold,
  listOpenSafetyHolds,
  type SafetyHoldV1,
} from '../safety'
import type { FamilySetupStudent } from '../setup'
import type { FamilyPilotStudySession, FamilyPilotStudySnapshot } from '../study'
import { validateDynamicSocialSourceBundle } from './dynamicSource'
import {
  digestLocalPin,
  loadFinalFamilyPilotAppState,
  saveFinalFamilyPilotAppState,
  type FinalFamilyPilotAppSnapshot,
  type FinalFamilyPilotAppStateV1,
  type FinalFamilyPilotAppStoreOptions,
  type FinalFamilyPilotSourceAttachment,
  type FinalAssessmentAssignmentStatus,
  type FinalFamilyPilotAssessmentAssignment,
} from './state'

export interface FinalFamilyPilotControllerOptions {
  readonly catalog: FinalFamilyPilotCatalog
  readonly coreStore?: FamilyPilotStoreOptions
  readonly appStore?: FinalFamilyPilotAppStoreOptions
  readonly now?: () => Date
  readonly indexedDb?: CreateFinalFamilyPilotStudyRuntimeOptions['indexedDb']
  readonly createRuntime?: typeof createFinalFamilyPilotStudyRuntime
}

export type FinalFamilyPilotControllerResult =
  | {
      readonly status: 'ok'
      readonly study: FamilyPilotStudySnapshot
      readonly completionStatus: 'NOT_COMPLETE' | 'PENDING_GUARDIAN_ATTESTATION' | 'CERTIFIED'
      readonly material: FinalLearnerProductionMaterial
    }
  | { readonly status: 'rejected'; readonly reason: string; readonly message: string }

export interface FinalFamilyPilotReadinessView {
  readonly result: FinalAssignmentReadinessResult
  readonly storage: StudyStorageHealth
}

function hashRef(value: string): string {
  let hash = 0x811c9dc5
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function finalAssignmentRef(studentRef: string, lessonRef: string): string {
  return `assignment:${hashRef(studentRef)}:${hashRef(lessonRef)}`
}

export function finalAssessmentAssignmentRef(studentRef: string, assessmentRef: string): string {
  return `assessment:${hashRef(studentRef)}:${hashRef(assessmentRef)}`
}

export function academySubjectToStudySubject(subject: AcademySubject): StudySubject {
  if (subject === 'mathematics') return 'math'
  if (subject === 'english-language-arts') return 'reading'
  return 'other'
}

export function finalLessonDescriptor(lesson: FinalCatalogLesson): HostLessonDescriptor {
  return Object.freeze({
    lessonRef: lesson.lessonRef,
    title: lesson.title,
    // Final subject packages are completion-evidence activities. Mastery remains
    // Tutor Core authority elsewhere; this adapter never forges a Tutor receipt.
    kind: 'manuel-academy-activity' as const,
    skillRefs: Object.freeze([`${lesson.lessonRef}:skill`]),
  })
}

function atDate(now: () => Date): string {
  return now().toISOString().slice(0, 10)
}

function replaceCoreAssignmentSession(
  state: FamilyPilotStateV1,
  studentRef: string,
  assignmentRef: string,
  sessionRef: string,
): FamilyPilotStateV1 {
  return Object.freeze({
    ...state,
    students: Object.freeze(state.students.map((student) => student.studentRef !== studentRef ? student : Object.freeze({
      ...student,
      assignments: Object.freeze(student.assignments.map((assignment) =>
        assignment.assignmentRef !== assignmentRef ? assignment : Object.freeze({ ...assignment, sessionRef }))),
    }))),
  })
}

export const finalFamilyPilotSafetyPort: StudySafetyPort = Object.freeze({
  mode: 'production',
  classifierVersion: 'family-pilot-deterministic-safety-v1',
  evaluate(request: StudySafetyRequest): StudySafetyResult {
    const stopped = isConcerning(request.transientText)
    return stopped
      ? { outcome: 'uncertain', mayContinue: false, adultHelpState: 'proposed-not-delivered' }
      : { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
  },
})

/**
 * Final browser orchestrator. It owns wiring only: Core owns household progress,
 * the final composition owns Study transitions, and IndexedDB owns Study bytes.
 */
export class FinalFamilyPilotController {
  readonly #catalog: FinalFamilyPilotCatalog
  readonly #coreStore: FamilyPilotStoreOptions
  readonly #appStore: FinalFamilyPilotAppStoreOptions
  readonly #now: () => Date
  readonly #indexedDb: CreateFinalFamilyPilotStudyRuntimeOptions['indexedDb']
  readonly #createRuntime: typeof createFinalFamilyPilotStudyRuntime
  #appSnapshot: FinalFamilyPilotAppSnapshot
  #activeRuntime: {
    readonly studentRef: string
    readonly assignmentRef: string
    readonly runtime: FinalFamilyPilotStudyRuntimeApi
  } | null = null

  constructor(options: FinalFamilyPilotControllerOptions) {
    this.#catalog = options.catalog
    this.#coreStore = options.coreStore ?? {}
    this.#appStore = options.appStore ?? {}
    const sourceNow = options.now ?? (() => new Date())
    // The accepted calendar runtime records active time in whole seconds and
    // refuses fractional-second intervals. One normalized clock is shared with
    // both Study and its IndexedDB ports below, so ordinary browser timing can
    // never make a valid learner transition look like an unsafe write.
    this.#now = () => new Date(Math.floor(sourceNow().getTime() / 1_000) * 1_000)
    this.#indexedDb = options.indexedDb ?? { safety: finalFamilyPilotSafetyPort }
    this.#createRuntime = options.createRuntime ?? createFinalFamilyPilotStudyRuntime
    this.#appSnapshot = loadFinalFamilyPilotAppState(this.#appStore)
  }

  get catalog(): FinalFamilyPilotCatalog { return this.#catalog }
  get appSnapshot(): FinalFamilyPilotAppSnapshot { return this.#appSnapshot }
  get coreSnapshot(): FamilyPilotSnapshot { return loadFamilyPilotState(this.#coreStore) }

  refresh(): void {
    this.#appSnapshot = loadFinalFamilyPilotAppState(this.#appStore)
  }

  close(): void {
    this.#activeRuntime?.runtime.close()
    this.#activeRuntime = null
  }

  setupStudent(student: FamilySetupStudent): void {
    this.#writeCore((state) => createFamilyPilotStudent(state, {
      studentRef: student.studentRef,
      displayName: student.displayName,
    }, this.#at()))
  }

  saveSetup(setup: FinalFamilyPilotAppStateV1['setup']): void {
    this.#commitApp((state) => ({ ...state, setup }))
    for (const student of setup.students) this.setupStudent(student)
  }

  selectStudent(studentRef: string | null): void {
    if (studentRef !== this.#appSnapshot.state.activeStudentRef) this.close()
    this.#commitApp((state) => ({ ...state, activeStudentRef: studentRef }))
    this.#writeCore((state) => setActiveFamilyPilotStudent(state, studentRef))
  }

  setStudentPin(studentRef: string, pin: string | null): void {
    if (!this.#studentSetup(studentRef)) throw new Error('Student configuration is unavailable.')
    if (pin !== null && !/^\d{4}$/.test(pin)) throw new Error('A local student PIN must contain exactly four digits.')
    this.#commitApp((state) => {
      const studentAccessVerifiers = { ...state.studentAccessVerifiers }
      if (pin === null) delete studentAccessVerifiers[studentRef]
      else studentAccessVerifiers[studentRef] = digestLocalPin(pin)
      return { ...state, studentAccessVerifiers: Object.freeze(studentAccessVerifiers) }
    })
  }

  setParentPin(pin: string): void {
    if (!/^\d{4}$/.test(pin)) throw new Error('A local parent PIN must contain exactly four digits.')
    this.#commitApp((state) => ({ ...state, parentAccessVerifier: digestLocalPin(pin) }))
  }

  verifyParentPin(pin: string): boolean {
    const verifier = this.#appSnapshot.state.parentAccessVerifier
    return Boolean(verifier && /^\d{4}$/.test(pin) && verifier === digestLocalPin(pin))
  }

  coursesFor(student: FamilySetupStudent, subject?: AcademySubject) {
    return Object.freeze(student.enabledSubjects.flatMap((enabledSubject) => {
      if (subject && subject !== enabledSubject) return []
      const grade = student.workingGradeBySubject[enabledSubject] ?? student.nominalGrade
      if (grade === '6') return []
      return this.#catalog.runtime.listCourses(Number(grade) as never)
        .filter((course) => course.subject === enabledSubject)
    }))
  }

  async assignLesson(studentRef: string, lessonRef: string): Promise<FamilyPilotAssignmentRecordV1> {
    const student = this.#studentSetup(studentRef)
    if (!student) throw new Error('Student configuration is unavailable.')
    const lesson = await this.#catalog.runtime.getLesson(lessonRef)
    const binding = await this.#catalog.getBinding(lessonRef)
    const material = await this.#catalog.getMaterial(lessonRef)
    if (!lesson || !binding || !material || binding.lessonRef !== lesson.lessonRef) {
      throw new Error('That admitted production lesson is unavailable.')
    }
    const expectedGrade = student.workingGradeBySubject[lesson.subject] ?? student.nominalGrade
    if (!student.enabledSubjects.includes(lesson.subject) || Number(expectedGrade) !== lesson.grade) {
      throw new Error('That lesson is not enabled at this student’s working grade.')
    }
    const descriptor = finalLessonDescriptor(lesson)
    const assignmentRef = finalAssignmentRef(studentRef, lessonRef)
    this.#writeCore((state) => addFamilyPilotAssignment(state, studentRef, {
      assignmentRef,
      lessonRef,
      subject: lesson.subject,
      title: lesson.title,
      totalSegments: adaptHostLessonToStudyPlan(descriptor).segments.length,
    }, this.#at()))
    const record = this.#assignment(studentRef, assignmentRef)
    if (!record) throw new Error('The assignment could not be saved.')
    return record
  }

  assessmentAssignments(studentRef?: string): readonly FinalFamilyPilotAssessmentAssignment[] {
    return this.#appSnapshot.state.assessmentAssignments.filter((item) => !studentRef || item.studentRef === studentRef)
  }

  assessmentsFor(student: FamilySetupStudent, courseRef?: string) {
    return this.#catalog.listAssessments(courseRef).filter((assessment) => {
      const expectedGrade = student.workingGradeBySubject[assessment.subject] ?? student.nominalGrade
      return student.enabledSubjects.includes(assessment.subject) && Number(expectedGrade) === assessment.grade
    })
  }

  async assignAssessment(studentRef: string, assessmentRef: string): Promise<FinalFamilyPilotAssessmentAssignment> {
    const student = this.#studentSetup(studentRef)
    if (!student) throw new Error('Student configuration is unavailable.')
    const binding = this.#catalog.listAssessments().find((item) => item.assessmentRef === assessmentRef)
    const material = await this.#catalog.getAssessment(assessmentRef)
    if (!binding || !material || material.assessmentRef !== assessmentRef || material.courseRef !== binding.courseRef) {
      throw new Error('That admitted assessment material is unavailable.')
    }
    const expectedGrade = student.workingGradeBySubject[material.subject] ?? student.nominalGrade
    if (!student.enabledSubjects.includes(material.subject) || Number(expectedGrade) !== material.grade) {
      throw new Error('That assessment is not enabled at this student’s working grade.')
    }
    if (!material.learnerTasks.length || material.productionReadiness.structuralOnly !== false || material.productionReadiness.answerMaterialIncluded !== false) {
      throw new Error('That assessment failed its learner-material admission contract.')
    }
    const assignmentRef = finalAssessmentAssignmentRef(studentRef, assessmentRef)
    const existing = this.#appSnapshot.state.assessmentAssignments.find((item) => item.assignmentRef === assignmentRef)
    if (existing) return existing
    const now = this.#at()
    const assignment: FinalFamilyPilotAssessmentAssignment = Object.freeze({
      assignmentRef,
      assessmentRef,
      studentRef,
      courseRef: material.courseRef,
      subject: material.subject,
      grade: material.grade,
      title: `${material.location.unitTitle} assessment`,
      authorityClass: material.completionScoringAuthorityClass,
      status: 'PLANNED',
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    })
    this.#commitApp((state) => ({
      ...state,
      assessmentAssignments: Object.freeze([...state.assessmentAssignments, assignment]),
    }))
    return assignment
  }

  async loadAssessment(studentRef: string, assignmentRef: string): Promise<{
    readonly assignment: FinalFamilyPilotAssessmentAssignment
    readonly material: FinalLearnerAssessmentMaterial
  }> {
    const assignment = this.#appSnapshot.state.assessmentAssignments.find((item) =>
      item.studentRef === studentRef && item.assignmentRef === assignmentRef)
    if (!assignment) throw new Error('That assessment assignment is unavailable.')
    const material = await this.#catalog.getAssessment(assignment.assessmentRef)
    if (!material || material.courseRef !== assignment.courseRef || material.grade !== assignment.grade || material.subject !== assignment.subject) {
      throw new Error('That assessment binding is unavailable.')
    }
    if (!this.assessmentSourceReady(studentRef, material)) {
      throw new Error(`This assessment is blocked until qualifying source metadata is attached to ${material.location.assessmentLessonRef ?? 'its source lesson'}.`)
    }
    if (assignment.status === 'PLANNED') this.updateAssessmentStatus(studentRef, assignmentRef, 'ACTIVE')
    return { assignment: this.#appSnapshot.state.assessmentAssignments.find((item) => item.assignmentRef === assignmentRef) ?? assignment, material }
  }

  assessmentSourceReady(studentRef: string, material: FinalLearnerAssessmentMaterial): boolean {
    if (!material.productionReadiness.requiresSourceAttachment) return true
    const lessonRef = material.location.assessmentLessonRef
    return Boolean(lessonRef && this.#appSnapshot.state.sourceAttachments.some((item) =>
      item.studentRef === studentRef && item.lessonRef === lessonRef && item.status === 'ATTACHED_SATISFIED'))
  }

  updateAssessmentStatus(studentRef: string, assignmentRef: string, status: FinalAssessmentAssignmentStatus): void {
    const current = this.#appSnapshot.state.assessmentAssignments.find((item) => item.studentRef === studentRef && item.assignmentRef === assignmentRef)
    if (!current) throw new Error('That assessment assignment is unavailable.')
    if (status === 'CERTIFIED' && current.authorityClass === 'AUTO_SCOREABLE' && current.status !== 'PENDING_ASSESSMENT') {
      throw new Error('Trusted scoring must complete before certification.')
    }
    const now = this.#at()
    this.#commitApp((state) => ({
      ...state,
      assessmentAssignments: Object.freeze(state.assessmentAssignments.map((item) =>
        item.assignmentRef !== assignmentRef || item.studentRef !== studentRef ? item : Object.freeze({
          ...item,
          status,
          updatedAt: now,
          completedAt: status === 'CERTIFIED' ? now : null,
        }))),
    }))
  }

  async readiness(studentRef: string, assignmentRef: string): Promise<FinalFamilyPilotReadinessView> {
    const prepared = await this.#prepare(studentRef, assignmentRef)
    const runtime = await this.#runtime(studentRef, assignmentRef, prepared.lesson)
    const health = await runtime.storageHealth()
    const storage: StudyStorageHealth = health.ready
      ? { status: 'HEALTHY', reasonCode: 'NONE' }
      : { status: 'UNAVAILABLE', reasonCode: health.previousWriteFailed ? 'STORAGE_WRITE_FAILED' : 'STORAGE_UNAVAILABLE' }
    const source = this.#source(studentRef, assignmentRef, prepared.lesson.lessonRef)
    const config: FinalReadinessStudentConfiguration = {
      studentRef,
      displayName: prepared.student.displayName,
      enabledSubjects: [{
        subject: prepared.lesson.subject,
        workingGrade: String(prepared.lesson.grade),
        requiredProductionMaterialRefs: [prepared.material.materialRef],
        assignments: [{
          assignmentRef,
          lessonRef: prepared.lesson.lessonRef,
          requiredProductionMaterialRefs: [prepared.material.materialRef],
          dynamicSourceRequirement: prepared.binding.sourceReadinessKind === 'DYNAMIC_SOURCE_REQUIRED'
            ? 'SOCIAL_STUDIES_SOURCE_ATTACHMENT'
            : 'NONE',
          ...(source ? { dynamicSourceMetadata: source } : {}),
          completionRequirement: prepared.binding.completionAuthority === 'GUARDIAN_ATTESTATION_REQUIRED'
            ? 'GUARDIAN_ATTESTATION'
            : 'STANDARD',
        }],
      }],
    }
    const safetyAvailable = this.#appSnapshot.safetyRecovery === 'available'
    const family = evaluateFinalFamilyReadiness([config], {
      curriculumAdmission: { isAdmitted: () => this.#catalog.manifest.admissionStatus === 'ADMITTED' },
      productionMaterial: { isAvailable: (_scope, ref) => ref === prepared.material.materialRef },
      studyStorage: { health: () => storage },
      assignment: {
        isSubjectAvailable: () => true,
        isAssignmentAvailable: () => Boolean(this.#assignment(studentRef, assignmentRef)),
      },
      safety: { isAvailable: () => safetyAvailable },
      completionAuthority: { isAvailable: () => Boolean(prepared.binding.completionAuthority) },
      dynamicSource: { isQualifying: (_scope, metadata) => Boolean(source && metadata.sourceRef === source.sourceRef) },
      guardianAttestation: { isAvailable: () => true },
      tutor: { isTutorAvailable: () => false, isStaticHelpAvailable: () => true },
    })
    const result = family.students[0]?.subjects[0]?.assignments[0]
    if (!result) throw new Error('Final readiness could not evaluate this assignment.')
    return { result, storage }
  }

  async start(studentRef: string, assignmentRef: string): Promise<FinalFamilyPilotControllerResult> {
    try {
      const prepared = await this.#prepare(studentRef, assignmentRef)
      const readiness = await this.readiness(studentRef, assignmentRef)
      if (!readiness.result.assignableAsNormalFamilyPilotTask) {
        return { status: 'rejected', reason: readiness.result.codes[0] ?? 'NOT_READY', message: this.#readinessMessage(readiness.result) }
      }
      const runtime = await this.#runtime(studentRef, assignmentRef, prepared.lesson)
      return this.#applyStudyResult(studentRef, assignmentRef, prepared.material, await runtime.start(assignmentRef), true)
    } catch (error) {
      return this.#error(error)
    }
  }

  async reopen(studentRef: string, assignmentRef: string): Promise<FinalFamilyPilotControllerResult> {
    try {
      const prepared = await this.#prepare(studentRef, assignmentRef)
      const runtime = await this.#runtime(studentRef, assignmentRef, prepared.lesson)
      const saved = this.#savedSession(studentRef, assignmentRef)
      if (!saved) return this.start(studentRef, assignmentRef)
      const reopened = await runtime.reopen(assignmentRef, saved)
      if (reopened.status === 'rejected' && reopened.reason === 'runtime-rejected' && reopened.detailCode === 'unknown-assignment') {
        return this.#rebuild(studentRef, assignmentRef, prepared.material, runtime)
      }
      return this.#applyStudyResult(studentRef, assignmentRef, prepared.material, reopened, false)
    } catch (error) {
      return this.#error(error)
    }
  }

  async pause(
    studentRef: string,
    assignmentRef: string,
    presentationProgressRef: string | null = null,
  ): Promise<FinalFamilyPilotControllerResult> {
    return this.#sessionOperation(studentRef, assignmentRef, async (runtime, session) => {
      const result = await runtime.pause(assignmentRef, session, presentationProgressRef)
      if (result.status === 'ok') this.#writeCore((state) => pauseFamilyPilotAssignment(state, studentRef, assignmentRef, this.#at()))
      return result
    })
  }

  async resume(studentRef: string, assignmentRef: string): Promise<FinalFamilyPilotControllerResult> {
    return this.#sessionOperation(studentRef, assignmentRef, async (runtime, session) => {
      const result = await runtime.resume(assignmentRef, session)
      if (result.status === 'ok') this.#writeCore((state) => resumeFamilyPilotAssignment(state, studentRef, assignmentRef, session.sessionRef, this.#at()))
      return result
    })
  }

  async checkpoint(
    studentRef: string,
    assignmentRef: string,
    presentationProgressRef: string | null = null,
  ): Promise<FinalFamilyPilotControllerResult> {
    return this.#sessionOperation(studentRef, assignmentRef, (runtime, session) =>
      runtime.checkpoint(assignmentRef, session, presentationProgressRef))
  }

  async completeSegment(studentRef: string, assignmentRef: string): Promise<FinalFamilyPilotControllerResult> {
    return this.#sessionOperation(studentRef, assignmentRef, async (runtime, session) => {
      const before = await runtime.snapshot(assignmentRef, session)
      if (before.status !== 'ok') return before
      const segmentRef = before.study.segmentRef
      const advanced = await runtime.completeSegment(assignmentRef, session)
      if (advanced.status !== 'ok') return advanced
      if (segmentRef) {
        this.#writeCore((state) => recordFamilyPilotProgress(state, studentRef, assignmentRef, { segmentRef }, this.#at()))
      }
      if (advanced.study.assignmentState !== 'completed') return advanced
      const completed = await runtime.complete(assignmentRef, session)
      if (completed.status === 'ok' && completed.completionStatus === 'CERTIFIED') {
        this.#writeCore((state) => completeFamilyPilotAssignment(state, studentRef, assignmentRef, this.#at()))
      }
      return completed
    })
  }

  async requestAdultHelp(studentRef: string, assignmentRef: string): Promise<SafetyHoldV1> {
    const session = this.#savedSession(studentRef, assignmentRef)
    if (!session) throw new Error('Open this assignment before requesting an adult check-in.')
    const created = createSafetyHold(this.#appSnapshot.state.safety, {
      studentRef,
      sessionRef: session.sessionRef,
      createdAt: this.#at(),
      reasonCode: 'parent-review-requested',
      source: 'parent',
    })
    this.#commitApp((state) => ({ ...state, safety: created.state }))
    return created.hold
  }

  openSafetyHolds(studentRef: string): readonly SafetyHoldV1[] {
    return listOpenSafetyHolds(this.#appSnapshot.state.safety, studentRef)
  }

  async clearHold(studentRef: string, assignmentRef: string, holdRef: string): Promise<void> {
    const prepared = await this.#prepare(studentRef, assignmentRef)
    const runtime = await this.#runtime(studentRef, assignmentRef, prepared.lesson)
    const session = this.#savedSession(studentRef, assignmentRef)
    if (!session) throw new Error('The held Study session is unavailable.')
    const cleared = await runtime.clearSafetyHold({
      assignmentRef,
      session,
      holdRef,
      adultAuthorized: true,
      adultHouseholdRef: this.#appSnapshot.state.householdRef,
      clearedByRef: `adult:${hashRef(this.#appSnapshot.state.householdRef)}`,
    })
    if (cleared.status !== 'cleared') throw new Error(cleared.message)
  }

  attachDynamicSource(input: {
    readonly studentRef: string
    readonly assignmentRef: string
    readonly sources: readonly unknown[]
    readonly adultAttested: boolean
  }): FinalFamilyPilotSourceAttachment {
    const assignment = this.#assignment(input.studentRef, input.assignmentRef)
    if (!assignment) throw new Error('That assignment is unavailable.')
    const metadata = validateDynamicSocialSourceBundle({ lessonRef: assignment.lessonRef, sources: input.sources, adultAttested: input.adultAttested })
    const first = metadata[0]
    const now = this.#at()
    const attachment: FinalFamilyPilotSourceAttachment = Object.freeze({
      studentRef: input.studentRef,
      assignmentRef: input.assignmentRef,
      lessonRef: assignment.lessonRef,
      sourceRef: `source:${hashRef(`${input.studentRef}:${input.assignmentRef}:${String(first.attachmentId)}`)}`,
      title: String(first.sourceTitle),
      publisher: String(first.responsibleParty),
      publishedAt: new Date(`${String(first.retrievedOn)}T00:00:00.000Z`).toISOString(),
      metadata,
      adultAttestedAt: now,
      attachedAt: now,
      status: 'ATTACHED_SATISFIED',
    })
    this.#commitApp((state) => ({
      ...state,
      sourceAttachments: Object.freeze([
        ...state.sourceAttachments.filter((item) => !(item.studentRef === input.studentRef && item.assignmentRef === input.assignmentRef)),
        attachment,
      ]),
    }))
    return attachment
  }

  pendingAttestations(studentRef?: string): readonly FinalFamilyPilotAttestationRecord[] {
    return this.#appSnapshot.state.attestations.filter((item) =>
      item.status === 'PENDING_GUARDIAN_ATTESTATION' && (!studentRef || item.studentRef === studentRef))
  }

  async attest(
    studentRef: string,
    assignmentRef: string,
    evidenceMode: 'adult-observed' | 'simulated-alternative',
  ): Promise<FinalFamilyPilotControllerResult> {
    try {
      const prepared = await this.#prepare(studentRef, assignmentRef)
      const runtime = await this.#runtime(studentRef, assignmentRef, prepared.lesson)
      const session = this.#savedSession(studentRef, assignmentRef)
      if (!session) throw new Error('The exact learner session is unavailable.')
      const result = await runtime.attest({
        assignmentRef,
        session,
        adultAuthorized: true,
        adultHouseholdRef: this.#appSnapshot.state.householdRef,
        attestedByRef: `adult:${hashRef(this.#appSnapshot.state.householdRef)}`,
        evidenceMode,
      })
      if (result.status !== 'ok') return result
      this.#writeCore((state) => completeFamilyPilotAssignment(state, studentRef, assignmentRef, this.#at()))
      return { status: 'ok', study: result.study, completionStatus: 'CERTIFIED', material: prepared.material }
    } catch (error) {
      return this.#error(error)
    }
  }

  async tutor(studentRef: string, assignmentRef: string) {
    const prepared = await this.#prepare(studentRef, assignmentRef)
    const runtime = await this.#runtime(studentRef, assignmentRef, prepared.lesson)
    const session = this.#savedSession(studentRef, assignmentRef)
    if (!session) throw new Error('Open this assignment before asking for help.')
    return runtime.startTutor(assignmentRef, session)
  }

  #at(): string { return this.#now().toISOString() }

  #studentSetup(studentRef: string): FamilySetupStudent | null {
    return this.#appSnapshot.state.setup.students.find((item) => item.studentRef === studentRef) ?? null
  }

  #assignment(studentRef: string, assignmentRef: string): FamilyPilotAssignmentRecordV1 | null {
    return findFamilyPilotStudent(this.coreSnapshot.state, studentRef)?.assignments.find((item) => item.assignmentRef === assignmentRef) ?? null
  }

  #savedSession(studentRef: string, assignmentRef: string): FamilyPilotStudySession | null {
    return this.#appSnapshot.state.sessions.find((item) => item.studentRef === studentRef && item.assignmentRef === assignmentRef)?.session ?? null
  }

  #source(studentRef: string, assignmentRef: string, lessonRef: string): FinalFamilyPilotSourceAttachment | null {
    return this.#appSnapshot.state.sourceAttachments.find((item) =>
      item.studentRef === studentRef && item.assignmentRef === assignmentRef && item.lessonRef === lessonRef) ?? null
  }

  #writeCore(mutate: (state: FamilyPilotStateV1) => FamilyPilotStateV1): FamilyPilotSnapshot {
    const result = updateFamilyPilotState(mutate, this.#coreStore)
    if (result.status === 'unavailable' || result.status === 'read-only') {
      throw new Error('Family Pilot progress could not be saved on this device.')
    }
    return result
  }

  #commitApp(mutate: (state: FinalFamilyPilotAppStateV1) => Omit<FinalFamilyPilotAppStateV1, 'updatedAt'> & { readonly updatedAt?: string }): void {
    if (this.#appSnapshot.status === 'read-only') throw new Error('This device has Family Pilot state from a newer app version.')
    const changed = mutate(this.#appSnapshot.state)
    const next = Object.freeze({ ...changed, updatedAt: this.#at() }) as FinalFamilyPilotAppStateV1
    const saved = saveFinalFamilyPilotAppState(next, this.#appStore)
    if (saved.status !== 'saved') throw new Error('Family Pilot supporting state could not be saved on this device.')
    this.#appSnapshot = { status: 'ready', reasonCode: null, state: next, safetyRecovery: this.#appSnapshot.safetyRecovery }
  }

  async #prepare(studentRef: string, assignmentRef: string): Promise<{
    readonly student: FamilySetupStudent
    readonly assignment: FamilyPilotAssignmentRecordV1
    readonly lesson: FinalCatalogLesson
    readonly binding: FinalProductionBinding
    readonly material: FinalLearnerProductionMaterial
  }> {
    const student = this.#studentSetup(studentRef)
    const assignment = this.#assignment(studentRef, assignmentRef)
    if (!student || !assignment) throw new Error('That assignment is not available for this student.')
    const [lesson, binding, material] = await Promise.all([
      this.#catalog.runtime.getLesson(assignment.lessonRef),
      this.#catalog.getBinding(assignment.lessonRef),
      this.#catalog.getMaterial(assignment.lessonRef),
    ])
    if (!lesson || !binding || !material || binding.lessonRef !== assignment.lessonRef || material.lessonRef !== assignment.lessonRef) {
      throw new Error('The admitted curriculum binding is unavailable.')
    }
    return { student, assignment, lesson, binding, material }
  }

  #context(student: FamilySetupStudent, lesson: FinalCatalogLesson): HostStudyLaunchContext {
    const subject = academySubjectToStudySubject(lesson.subject)
    return Object.freeze({
      householdRef: this.#appSnapshot.state.householdRef,
      learnerRef: student.studentRef,
      hostProfileRef: student.studentRef,
      grade: lesson.grade,
      subject,
      lessonRef: lesson.lessonRef,
      skillRefs: Object.freeze([`${lesson.lessonRef}:skill`]),
      householdTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      learnerLocalDate: atDate(this.#now),
      accessibility: Object.freeze({ largeText: false, reducedMotion: false, noAudio: true, captions: true, transientTranscript: false, highContrast: false, oneTaskAtATime: true }),
      timerPreference: Object.freeze({ visibility: 'shown', milestonesOnly: true }),
      parentLimits: Object.freeze({ maximumWorkMinutes: 30, breakMinutes: 5 }),
      accommodationLimits: Object.freeze({}),
    })
  }

  async #runtime(studentRef: string, assignmentRef: string, lesson: FinalCatalogLesson): Promise<FinalFamilyPilotStudyRuntimeApi> {
    if (this.#activeRuntime?.studentRef === studentRef && this.#activeRuntime.assignmentRef === assignmentRef) {
      return this.#activeRuntime.runtime
    }
    this.close()
    const student = this.#studentSetup(studentRef)
    if (!student) throw new Error('Student configuration is unavailable.')
    const runtime = await this.#createRuntime({
      context: { studentRef, study: this.#context(student, lesson) },
      assignmentState: {
        resolve: ({ studentRef: requestedStudent, assignmentRef: requestedAssignment }) => {
          const record = this.#assignment(requestedStudent, requestedAssignment)
          return record ? { studentRef: requestedStudent, assignmentRef: requestedAssignment, lessonRef: record.lessonRef } : null
        },
      },
      curriculumLessons: {
        resolveLesson: async (binding) => {
          const resolved = await this.#catalog.runtime.getLesson(binding.lessonRef)
          return resolved ? finalLessonDescriptor(resolved) : null
        },
      },
      productionMaterials: {
        resolve: async (binding) => {
          const material = await this.#catalog.getMaterial(binding.lessonRef)
          return material
            ? { status: 'ready', material: { materialRef: material.materialRef, mediaAvailable: false } }
            : { status: 'unavailable', reasonCode: 'production-material-not-found' }
        },
      },
      sourceReadiness: {
        check: async (binding) => {
          const production = await this.#catalog.getBinding(binding.lessonRef)
          if (!production) return { status: 'blocked', reasonCode: 'production-binding-not-found' }
          if (production.sourceReadinessKind !== 'DYNAMIC_SOURCE_REQUIRED') return { status: 'ready' }
          return this.#source(binding.studentRef, binding.assignmentRef, binding.lessonRef)
            ? { status: 'ready' }
            : { status: 'blocked', reasonCode: 'PENDING_SOURCE_ATTACHMENT' }
        },
      },
      completionAuthority: {
        authorityFor: async (binding) => (await this.#catalog.getBinding(binding.lessonRef))?.completionAuthority ?? 'GUARDIAN_ATTESTATION_REQUIRED',
      },
      guardianAttestation: {
        read: (input) => this.#appSnapshot.state.attestations.find((item) =>
          item.studentRef === input.studentRef && item.assignmentRef === input.assignmentRef && item.lessonRef === input.lessonRef && item.sessionRef === input.sessionRef) ?? null,
        recordLearnerCompletion: async (input) => {
          const record: FinalFamilyPilotAttestationRecord = Object.freeze({
            studentRef: input.studentRef,
            assignmentRef: input.assignmentRef,
            lessonRef: input.lessonRef,
            sessionRef: input.sessionRef,
            authority: 'GUARDIAN_ATTESTATION_REQUIRED',
            status: 'PENDING_GUARDIAN_ATTESTATION',
            learnerAssertedAt: input.learnerAssertedAt,
            attestedAt: null,
            attestedByRef: null,
            evidenceMode: null,
          })
          this.#saveAttestation(record)
          return record
        },
        attest: async (input) => {
          const before = this.#appSnapshot.state.attestations.find((item) =>
            item.studentRef === input.studentRef && item.assignmentRef === input.assignmentRef && item.lessonRef === input.lessonRef && item.sessionRef === input.sessionRef)
          if (!before) throw new Error('attestation-not-pending')
          const record: FinalFamilyPilotAttestationRecord = Object.freeze({
            ...before,
            status: 'CERTIFIED',
            attestedAt: input.attestedAt,
            attestedByRef: input.attestedByRef,
            evidenceMode: input.evidenceMode,
          })
          this.#saveAttestation(record)
          return record
        },
      },
      safetyHolds: {
        checkStudyEntry: ({ studentRef: heldStudent, sessionRef }) => {
          if (this.#appSnapshot.safetyRecovery !== 'available') {
            return { allowed: false, reasonCode: 'safety-state-unavailable', studentMessage: 'Please get an adult before continuing.' }
          }
          if (!sessionRef || canStudentResume(this.#appSnapshot.state.safety, heldStudent, sessionRef)) return { allowed: true }
          const hold = listOpenSafetyHolds(this.#appSnapshot.state.safety, heldStudent).find((item) => item.sessionRef === sessionRef)
          return { allowed: false, reasonCode: hold?.reasonCode ?? 'safety-hold', studentMessage: 'Please get an adult before continuing.', ...(hold ? { holdRef: hold.holdRef } : {}) }
        },
        clear: async (input) => {
          const hold = this.#appSnapshot.state.safety.holds.find((item) => item.holdRef === input.holdRef)
          if (!hold || hold.studentRef !== input.studentRef || hold.sessionRef !== input.sessionRef) return { status: 'not-found' }
          const next = clearSafetyHold(this.#appSnapshot.state.safety, input.holdRef, { clearedAt: input.clearedAt, clearedBy: input.clearedByRef })
          this.#commitApp((state) => ({ ...state, safety: next }))
          return { status: 'cleared' }
        },
      },
      indexedDb: this.#indexedDb,
      now: this.#now,
    })
    this.#activeRuntime = { studentRef, assignmentRef, runtime }
    return runtime
  }

  #saveAttestation(record: FinalFamilyPilotAttestationRecord): void {
    this.#commitApp((state) => ({
      ...state,
      attestations: Object.freeze([
        ...state.attestations.filter((item) => !(item.studentRef === record.studentRef && item.assignmentRef === record.assignmentRef && item.lessonRef === record.lessonRef && item.sessionRef === record.sessionRef)),
        record,
      ]),
    }))
  }

  #saveSession(studentRef: string, assignmentRef: string, session: FamilyPilotStudySession): void {
    this.#commitApp((state) => ({
      ...state,
      sessions: Object.freeze([
        ...state.sessions.filter((item) => !(item.studentRef === studentRef && item.assignmentRef === assignmentRef)),
        Object.freeze({ studentRef, assignmentRef, session: Object.freeze({ ...session }) }),
      ]),
    }))
  }

  async #applyStudyResult(
    studentRef: string,
    assignmentRef: string,
    material: FinalLearnerProductionMaterial,
    result: FinalFamilyPilotResult,
    started: boolean,
  ): Promise<FinalFamilyPilotControllerResult> {
    if (result.status !== 'ok') return result
    this.#saveSession(studentRef, assignmentRef, result.study.session)
    if (started) {
      this.#writeCore((state) => startFamilyPilotAssignment(state, studentRef, assignmentRef, result.study.session.sessionRef, this.#at()))
    }
    return { status: 'ok', study: result.study, completionStatus: result.completionStatus, material }
  }

  async #sessionOperation(
    studentRef: string,
    assignmentRef: string,
    operation: (runtime: FinalFamilyPilotStudyRuntimeApi, session: FamilyPilotStudySession) => Promise<FinalFamilyPilotResult>,
  ): Promise<FinalFamilyPilotControllerResult> {
    try {
      const prepared = await this.#prepare(studentRef, assignmentRef)
      const runtime = await this.#runtime(studentRef, assignmentRef, prepared.lesson)
      const session = this.#savedSession(studentRef, assignmentRef)
      if (!session) throw new Error('The saved Study session is unavailable.')
      return this.#applyStudyResult(studentRef, assignmentRef, prepared.material, await operation(runtime, session), false)
    } catch (error) {
      return this.#error(error)
    }
  }

  async #rebuild(
    studentRef: string,
    assignmentRef: string,
    material: FinalLearnerProductionMaterial,
    runtime: FinalFamilyPilotStudyRuntimeApi,
  ): Promise<FinalFamilyPilotControllerResult> {
    const record = this.#assignment(studentRef, assignmentRef)
    if (!record) throw new Error('The assignment recovery record is unavailable.')
    let restored = await runtime.start(assignmentRef)
    if (restored.status !== 'ok') return restored
    const completed = new Set(record.progress.completedSegmentRefs)
    for (let index = 0; index < completed.size; index += 1) {
      const segmentRef = restored.study.segmentRef
      if (!segmentRef || !completed.has(segmentRef)) break
      restored = await runtime.completeSegment(assignmentRef, restored.study.session)
      if (restored.status !== 'ok') return restored
    }
    if (record.state === 'paused' && restored.study.assignmentState !== 'completed') {
      restored = await runtime.pause(assignmentRef, restored.study.session)
      if (restored.status !== 'ok') return restored
    }
    this.#saveSession(studentRef, assignmentRef, restored.study.session)
    const savedSessionRef = restored.study.session.sessionRef
    this.#writeCore((state) => replaceCoreAssignmentSession(state, studentRef, assignmentRef, savedSessionRef))
    return { status: 'ok', study: restored.study, completionStatus: restored.completionStatus, material }
  }

  #readinessMessage(result: FinalAssignmentReadinessResult): string {
    if (result.codes.includes('PENDING_SOURCE_ATTACHMENT')) return 'A parent must attach qualifying source metadata before this Social Studies lesson can start.'
    if (result.codes.includes('STUDY_PERSISTENCE_UNAVAILABLE')) return 'Study storage is unavailable. Nothing was started.'
    if (result.codes.includes('SAFETY_UNAVAILABLE')) return 'Safety state needs an adult review before Study can start.'
    return `This assignment is not ready: ${result.codes.join(', ')}.`
  }

  #error(error: unknown): { readonly status: 'rejected'; readonly reason: string; readonly message: string } {
    return {
      status: 'rejected',
      reason: error instanceof Error ? error.name : 'unavailable',
      message: error instanceof Error ? error.message : 'That action could not be completed.',
    }
  }
}

/** Restore helper used by the accepted backup UI after full validation. */
export function saveRestoredCoreState(state: FamilyPilotStateV1, options: FamilyPilotStoreOptions = {}): void {
  const saved = saveFamilyPilotState(state, options)
  if (saved.status !== 'ready') throw new Error('Restored Family Pilot progress could not be committed.')
}

/** Type-level proof that final production wiring contains all accepted ports only. */
export type FinalFamilyPilotAcceptedPorts = StudyPortBundle
