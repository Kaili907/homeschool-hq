import type { AcademyGrade } from '../../../types'
import type { HostLessonDescriptor } from '../../curriculumAdapter'
import type { StudyPortBundle } from '../../ports'
import type { HostStudyLaunchContext, StudyAdultAuthorization, StudySubject } from '../../types'
import {
  addFamilyPilotAssignment,
  attestFamilyPilotCompletion,
  createFamilyPilotStudent,
  findFamilyPilotStudent,
  loadFamilyPilotState,
  pauseFamilyPilotAssignment,
  projectFamilyPilotParentProgress,
  recordFamilyPilotLearnerCompletion,
  recordFamilyPilotProgress,
  resumeFamilyPilotAssignment,
  setActiveFamilyPilotStudent,
  startFamilyPilotAssignment,
  updateFamilyPilotState,
  type FamilyPilotAssignmentRecordV1,
  type FamilyPilotCompletionRecordV1,
  type FamilyPilotSnapshot,
  type FamilyPilotStoreOptions,
  type FamilyPilotStudentRecordV1,
} from '../core'
import {
  familyPilotCompletionAuthority,
  resolveCompletionAuthority,
  type FamilyPilotAttestationRejection,
  type FamilyPilotAttestationRequest,
  type FamilyPilotAttestationResult,
  type FamilyPilotCompletionPolicyPort,
  type FamilyPilotPendingAttestation,
} from '../completion'
import {
  FamilyPilotStudyRuntime,
  familyPilotStudySession,
  type FamilyPilotStudyResult,
  type FamilyPilotStudySession,
  type FamilyPilotStudySnapshot,
} from '../study'
import { canHelp, closeHelp, startHelp, submitTurn, type FamilyPilotHelpSession, type FamilyPilotHelpStep, type FamilyPilotTutorDeps } from '../tutor'
import type { FamilyPilotStudentProfile } from '../auth/types'
import type { StudentAssignment } from '../student/types'
import { toStudentAssignments } from './assignments'
import { assignmentRefFor, lessonSegments, type FamilyPilotCurriculumPort } from './curriculum'
import { launchContextFor, learnerScopeFor, toStudentSelector } from './identity'
import { checkStudyEntry, checkTutorEntry, type FamilyPilotSafetyPort } from './safety'

// FAMILY-PILOT-INTEGRATION: the one object that owns the wiring.
//
// Division of authority, restated because it is the whole point of this file:
//
//   • Family Pilot Core is the source of PERSISTED pilot state. It alone
//     decides what survives a reload.
//   • The Study runtime is the authority on a Study SESSION. It alone decides
//     what a lesson's current position is.
//   • This controller owns neither. It performs the Study transition first and
//     only records into Core what the runtime actually accepted, so a rejected
//     transition can never leave Core claiming work that did not happen.
//
// There is no third store here by design.

/** Every operation reports the pilot record and, when Study ran, its snapshot. */
export type FamilyPilotOperationResult =
  | {
      readonly status: 'ok'
      readonly snapshot: FamilyPilotSnapshot
      readonly study: FamilyPilotStudySnapshot | null
      /**
       * Set by complete() only. It is how a caller learns that the learner's
       * click was RECORDED rather than certifying, without having to re-derive
       * the policy decision the controller already made.
       */
      readonly completion?: FamilyPilotCompletionRecordV1 | null
    }
  | {
      readonly status: 'rejected'
      readonly reason: string
      readonly message: string
      readonly snapshot: FamilyPilotSnapshot
    }

export interface FamilyPilotControllerOptions {
  readonly ports: StudyPortBundle
  readonly curriculum: FamilyPilotCurriculumPort
  readonly store?: FamilyPilotStoreOptions
  /** Absent until the separate Safety branch lands; the pilot runs without it. */
  readonly safety?: FamilyPilotSafetyPort
  /**
   * Overrides the completion authority for every lesson. Absent means the
   * curriculum port decides, which is the shipped path — the authority belongs
   * to the lesson package, not to whoever constructed the controller.
   */
  readonly completionPolicy?: FamilyPilotCompletionPolicyPort
  readonly tutorDeps?: FamilyPilotTutorDeps
  readonly now?: () => Date
  readonly householdTimeZone?: string
  readonly defaultGrade?: AcademyGrade
  readonly newStudentRef?: () => string
}

function studentRef(): string {
  const value = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}:${Math.random().toString(36).slice(2)}`
  return `student:${value}`
}

export class FamilyPilotController {
  readonly #ports: StudyPortBundle
  readonly #curriculum: FamilyPilotCurriculumPort
  readonly #store: FamilyPilotStoreOptions
  readonly #safety: FamilyPilotSafetyPort | undefined
  readonly #tutorDeps: FamilyPilotTutorDeps
  readonly #now: () => Date
  readonly #timeZone: string
  readonly #defaultGrade: AcademyGrade
  readonly #newStudentRef: () => string
  readonly #runtime: FamilyPilotStudyRuntime
  readonly #completionPolicy: FamilyPilotCompletionPolicyPort
  /**
   * Grade is not part of the Core schema, so it is held per process. Losing it
   * on reload costs a default, never a record: assignments are already seeded
   * into Core by then and the lesson refs they carry are what drives Study.
   */
  readonly #grades = new Map<string, AcademyGrade>()

  constructor(options: FamilyPilotControllerOptions) {
    this.#ports = options.ports
    this.#curriculum = options.curriculum
    this.#store = options.store ?? {}
    this.#safety = options.safety
    this.#tutorDeps = options.tutorDeps ?? {}
    this.#now = options.now ?? (() => new Date())
    this.#timeZone = options.householdTimeZone ?? 'UTC'
    this.#defaultGrade = options.defaultGrade ?? '5'
    this.#newStudentRef = options.newStudentRef ?? studentRef
    this.#runtime = new FamilyPilotStudyRuntime({
      ports: options.ports,
      now: this.#now,
    })
    // The default policy reads the authority off the lesson package itself, so
    // the curriculum stays the authority on which work needs an adult and this
    // controller stays the thing that enforces it.
    this.#completionPolicy = options.completionPolicy ?? {
      authorityFor: ({ studentRef, lessonRef }) => {
        const lesson = this.#lessonMap(studentRef).get(lessonRef)
        const authored = lesson ? this.#curriculum.completionAuthorityFor?.(lesson) : undefined
        return authored ? familyPilotCompletionAuthority(authored) : 'LEARNER_AUTHORITY'
      },
    }
  }

  get runtime(): FamilyPilotStudyRuntime {
    return this.#runtime
  }

  // ---------------------------------------------------------------- identity

  snapshot(): FamilyPilotSnapshot {
    return loadFamilyPilotState(this.#store)
  }

  /** Login profiles, in Core order. */
  studentProfiles(): readonly FamilyPilotStudentProfile[] {
    return this.snapshot().state.students.map((student) => ({
      studentRef: toStudentSelector(student.studentRef),
      displayName: student.displayName,
      avatarInitial: student.displayName.trim().charAt(0).toUpperCase() || undefined,
    }))
  }

  createStudent(displayName: string, grade?: AcademyGrade): FamilyPilotSnapshot {
    const ref = this.#newStudentRef()
    const snapshot = updateFamilyPilotState(
      (state) => createFamilyPilotStudent(state, { studentRef: ref, displayName }, this.#at()),
      this.#store,
    )
    this.#grades.set(ref, grade ?? this.#defaultGrade)
    return snapshot
  }

  /** The only way the active student changes. Unknown refs are refused by Core. */
  selectStudent(ref: string | null): FamilyPilotSnapshot {
    return updateFamilyPilotState(
      (state) => setActiveFamilyPilotStudent(state, ref),
      this.#store,
    )
  }

  gradeFor(ref: string): AcademyGrade {
    return this.#grades.get(ref) ?? this.#defaultGrade
  }

  setGrade(ref: string, grade: AcademyGrade): void {
    this.#grades.set(ref, grade)
  }

  // -------------------------------------------------------------- curriculum

  lessonsFor(ref: string): readonly HostLessonDescriptor[] {
    try {
      return this.#curriculum.listLessons(this.gradeFor(ref))
    } catch {
      return []
    }
  }

  #lessonMap(ref: string): ReadonlyMap<string, HostLessonDescriptor> {
    return new Map(this.lessonsFor(ref).map((lesson) => [lesson.lessonRef, lesson]))
  }

  /**
   * Seeds this student's assignments from the curriculum port. Idempotent:
   * addFamilyPilotAssignment refuses a duplicate assignmentRef, and the refs
   * are derived from the lesson ref, so re-running never duplicates or resets
   * work already in progress.
   */
  ensureAssignments(ref: string): FamilyPilotSnapshot {
    const lessons = this.lessonsFor(ref)
    if (lessons.length === 0) return this.snapshot()
    const at = this.#at()
    return updateFamilyPilotState((state) =>
      lessons.reduce((carried, lesson) => {
        let totalSegments = 0
        try {
          totalSegments = lessonSegments(lesson).length
        } catch {
          return carried
        }
        return addFamilyPilotAssignment(carried, ref, {
          assignmentRef: assignmentRefFor(lesson.lessonRef),
          lessonRef: lesson.lessonRef,
          subject: 'Math',
          title: lesson.title,
          totalSegments,
        }, at)
      }, state), this.#store)
  }

  /** This student's assignments only — see toStudentAssignments on why. */
  assignmentsFor(ref: string): readonly StudentAssignment[] {
    const student = this.#student(ref)
    if (!student) return []
    return toStudentAssignments(student, this.#lessonMap(ref))
  }

  parentProgress(ref: string) {
    return projectFamilyPilotParentProgress(this.snapshot().state, ref)
  }

  // ------------------------------------------------------------------- study

  /**
   * Starts Study for one assignment.
   *
   * Order matters: the Study runtime runs FIRST and Core is written only from
   * the session the runtime actually returned. A runtime rejection therefore
   * leaves Core exactly as it was.
   */
  async start(ref: string, assignmentRef: string): Promise<FamilyPilotOperationResult> {
    const gate = checkStudyEntry(this.#safety, { studentRef: ref, assignmentRef })
    if (!gate.allowed) return this.#refuse(gate.reasonCode, gate.studentMessage)
    const bound = this.#bind(ref, assignmentRef)
    if ('status' in bound) return bound

    const result = await this.#runtime.startAssignment({
      context: bound.context,
      assignment: { kind: 'static-curriculum', lesson: bound.lesson },
    })
    if (result.status !== 'ok') return this.#rejected(result)
    const blockRef = result.snapshot.session.blockRef
    const snapshot = updateFamilyPilotState((state) =>
      startFamilyPilotAssignment(state, ref, assignmentRef, blockRef, this.#at()), this.#store)
    return { status: 'ok', snapshot, study: result.snapshot }
  }

  /**
   * Re-attaches to a started assignment and restores its exact position.
   *
   * A paused assignment is resumed on both sides; an already-active one is only
   * re-attached. If the Study ports no longer hold the block — the in-memory
   * preview ports do not survive a real page reload — the assignment is rebuilt
   * from Core's persisted record rather than dropping the learner back to step
   * one. See #rebuild.
   */
  async resume(ref: string, assignmentRef: string): Promise<FamilyPilotOperationResult> {
    const gate = checkStudyEntry(this.#safety, { studentRef: ref, assignmentRef })
    if (!gate.allowed) return this.#refuse(gate.reasonCode, gate.studentMessage)
    const bound = this.#bind(ref, assignmentRef)
    if ('status' in bound) return bound
    const session = this.#session(bound.context, bound.record)
    if (!session) return this.start(ref, assignmentRef)

    let attached = await this.#runtime.resumeAssignment({ context: bound.context, session })
    if (attached.status === 'rejected' && attached.reason === 'unknown-assignment') {
      return this.#rebuild(ref, assignmentRef, bound.record)
    }
    if (attached.status !== 'ok') return this.#rejected(attached)

    if (attached.snapshot.assignmentState === 'paused') {
      const resumed = await this.#runtime.resume({ context: bound.context, session })
      if (resumed.status !== 'ok') return this.#rejected(resumed)
      attached = resumed
    }
    const snapshot = bound.record.state === 'paused'
      ? updateFamilyPilotState((state) =>
          resumeFamilyPilotAssignment(state, ref, assignmentRef, session.blockRef, this.#at()), this.#store)
      : this.snapshot()
    return { status: 'ok', snapshot, study: attached.snapshot }
  }

  /**
   * Rebuilds a Study session whose block the ports no longer hold, and walks it
   * back to where the household left off.
   *
   * This matters because the pilot's Study ports are in-memory: they do not
   * survive closing the browser, while Core's record of the work does. Without
   * this, a learner who did four of five steps yesterday would be handed step
   * one again today — "save/resume fails" from the family's point of view.
   *
   * Nothing is forged. The replay drives the SAME completeSegment transition
   * the learner originally drove, once per step Core recorded as finished, and
   * stops the moment the runtime's current step is one Core does not vouch
   * for. The runtime stays the authority on whether each transition is legal;
   * the loop is bounded by the recorded count so a mismatch cannot spin.
   */
  async #rebuild(
    ref: string,
    assignmentRef: string,
    record: FamilyPilotAssignmentRecordV1,
  ): Promise<FamilyPilotOperationResult> {
    // Clear Core's pause block first, while the record is still 'paused' — the
    // only state resumeFamilyPilotAssignment accepts. start() below only flips
    // the state to 'active'; it would leave pausedAt and resumeSegmentRef set,
    // and toStudentAssignment prefers resumeSegmentRef, so the assignment card
    // would name an earlier step than the one Study actually reopens.
    if (record.state === 'paused' && record.sessionRef !== null) {
      updateFamilyPilotState((state) =>
        resumeFamilyPilotAssignment(state, ref, assignmentRef, record.sessionRef as string, this.#at()),
        this.#store)
    }
    const started = await this.start(ref, assignmentRef)
    if (started.status !== 'ok' || !started.study) return started
    const finished = new Set(record.progress.completedSegmentRefs)
    let current = started.study
    for (let step = 0; step < finished.size; step += 1) {
      const segmentRef = current.segmentRef
      if (segmentRef === null || !finished.has(segmentRef)) break
      const advanced = await this.completeSegment(ref, assignmentRef)
      if (advanced.status !== 'ok' || !advanced.study) break
      current = advanced.study
    }
    return { status: 'ok', snapshot: this.snapshot(), study: current }
  }

  async pause(ref: string, assignmentRef: string): Promise<FamilyPilotOperationResult> {
    const bound = this.#bind(ref, assignmentRef)
    if ('status' in bound) return bound
    const session = this.#session(bound.context, bound.record)
    if (!session) return this.#refuse('assignment-not-started', 'Start this work before pausing it.')
    const paused = await this.#runtime.pause({ context: bound.context, session })
    if (paused.status !== 'ok') return this.#rejected(paused)
    const snapshot = updateFamilyPilotState((state) =>
      pauseFamilyPilotAssignment(state, ref, assignmentRef, this.#at()), this.#store)
    return { status: 'ok', snapshot, study: paused.snapshot }
  }

  /**
   * Saves a durable Study checkpoint — "save my place".
   *
   * It writes NOTHING to Core's completed-segment set. The snapshot's
   * segmentRef is the step the learner is still ON, not one they finished;
   * recording it as complete would over-report progress to a parent and, worse,
   * make #rebuild replay past a step that was never done. Core's completed set
   * grows only in completeSegment, and the resume position is derived from it:
   * the first step not in the set is exactly where the learner was.
   */
  async checkpoint(ref: string, assignmentRef: string): Promise<FamilyPilotOperationResult> {
    const bound = this.#bind(ref, assignmentRef)
    if ('status' in bound) return bound
    const session = this.#session(bound.context, bound.record)
    if (!session) return this.#refuse('assignment-not-started', 'Start this work before saving it.')
    const saved = await this.#runtime.checkpoint({ context: bound.context, session })
    if (saved.status !== 'ok') return this.#rejected(saved)
    return { status: 'ok', snapshot: this.snapshot(), study: saved.snapshot }
  }

  /** Completes the current segment on both sides. */
  async completeSegment(ref: string, assignmentRef: string): Promise<FamilyPilotOperationResult> {
    const bound = this.#bind(ref, assignmentRef)
    if ('status' in bound) return bound
    const session = this.#session(bound.context, bound.record)
    if (!session) return this.#refuse('assignment-not-started', 'Start this work first.')
    const before = await this.#runtime.snapshot({ context: bound.context, session })
    if (before.status !== 'ok') return this.#rejected(before)
    const finished = before.snapshot.segmentRef
    const done = await this.#runtime.completeSegment({ context: bound.context, session })
    if (done.status !== 'ok') return this.#rejected(done)
    const snapshot = finished === null
      ? this.snapshot()
      : updateFamilyPilotState((state) =>
          recordFamilyPilotProgress(state, ref, assignmentRef, { segmentRef: finished }, this.#at()), this.#store)
    return { status: 'ok', snapshot, study: done.snapshot }
  }

  /**
   * The learner says they are finished.
   *
   * THIS is the completion-policy seam. Every learner-facing "Finish" in the
   * pilot arrives here, and here is where the authority for this exact lesson
   * is resolved before anything is written:
   *
   *   LEARNER_AUTHORITY               -> the assignment completes, as before.
   *   GUARDIAN_ATTESTATION_REQUIRED   -> the work is recorded and the
   *                                      assignment stays
   *                                      PENDING_GUARDIAN_ATTESTATION. Core
   *                                      refuses to complete it, so pressing
   *                                      Finish again cannot certify it and
   *                                      neither can any other caller.
   *
   * The Study calendar runtime remains the authority on whether the work is
   * actually done: Core records the completion only when the runtime reports
   * the block as 'completed'. What this deliberately does NOT do is call
   * runtime.completeAssignment(), which writes a mastery-attested Study session
   * row. That row is refused unless an accepted Tutor Core receipt exists, and
   * on a local-first pilot the only way to earn one is submitStudyAction() —
   * which, against a 'local-development' safety port, returns a stop and writes
   * a PERMANENT device-local safety lock for that session
   * (src/study/safety/localStopLedger.ts intentionally exposes no way to clear
   * it). Driving mastery here would therefore end the lesson for good rather
   * than complete it.
   *
   * So the pilot records household completion and leaves the mastery receipt to
   * the commercial pipeline. It does not forge one.
   */
  async complete(ref: string, assignmentRef: string): Promise<FamilyPilotOperationResult> {
    const bound = this.#bind(ref, assignmentRef)
    if ('status' in bound) return bound
    const session = this.#session(bound.context, bound.record)
    if (!session) return this.#refuse('assignment-not-started', 'Start this work first.')
    const current = await this.#runtime.snapshot({ context: bound.context, session })
    if (current.status !== 'ok') return this.#rejected(current)
    if (current.snapshot.assignmentState !== 'completed') {
      return this.#refuse('assignment-incomplete', 'This work still has steps left to finish.')
    }
    const authority = resolveCompletionAuthority(this.#completionPolicy, {
      studentRef: ref,
      assignmentRef,
      lessonRef: bound.record.lessonRef,
    })
    const snapshot = updateFamilyPilotState((state) =>
      recordFamilyPilotLearnerCompletion(state, ref, assignmentRef, authority, this.#at()),
      this.#store)
    return {
      status: 'ok',
      snapshot,
      study: current.snapshot,
      completion: this.#completionOf(snapshot, ref, assignmentRef),
    }
  }

  // ------------------------------------------------------- adult attestation

  /**
   * The work on this student's list that a household adult still has to sign
   * off. Read straight from persisted state, so it survives a reload and does
   * not depend on the Study ports still holding the block.
   */
  pendingAttestations(ref: string): readonly FamilyPilotPendingAttestation[] {
    const student = this.#student(ref)
    if (!student) return []
    return student.assignments
      .filter((item) => item.completion.status === 'PENDING_GUARDIAN_ATTESTATION')
      .map((item) => Object.freeze({
        studentRef: student.studentRef,
        assignmentRef: item.assignmentRef,
        lessonRef: item.lessonRef,
        subject: item.subject,
        title: item.title,
        learnerAssertedAt: item.completion.learnerAssertedAt,
      }))
  }

  /**
   * A household-authorized adult certifies one pending assignment.
   *
   * Deliberately synchronous and independent of the Study runtime. The pilot's
   * Study ports are in-memory and do not survive closing the browser, but a
   * pending attestation does — so an adult signing off the next morning must
   * not need a live block, and does not get one.
   *
   * Every refusal below names what could not be proved, because "nothing
   * happened" is the wrong answer for an adult who believes they just signed
   * their child's work off:
   *
   *   • store-read-only        stored state came from a newer build; this one
   *                            must not write over a schema it cannot read.
   *   • adult-not-authorized   the caller is not a verified household adult.
   *   • unknown-student /
   *     unknown-assignment     the named work is not on this device.
   *   • lesson-binding-mismatch the attestation names a different lesson than
   *                            the one this assignment now carries.
   *   • attestation-not-required this work completes on the learner's own
   *                            say-so, or is already finished.
   *   • attestation-not-recorded the learner has not finished it yet.
   *   • attestation-not-saved  device storage refused the write.
   *
   * Attesting twice returns ok with `alreadyAttested`, changing nothing: the
   * stored `attestedAt` keeps naming the moment the adult really did certify.
   */
  attest(
    request: FamilyPilotAttestationRequest,
    authorization: StudyAdultAuthorization,
  ): FamilyPilotAttestationResult {
    // Checked first, and by name. A read-only store parses as an EMPTY state,
    // so every lookup below would fail as 'unknown-student' — telling an adult
    // their child is not set up on this device, which is both false and
    // alarming. The truth is that this build may not write here at all.
    const current = this.snapshot()
    if (current.status === 'read-only') {
      return this.#refuseAttestation(
        'store-read-only',
        'This device has newer saved work than this version can write to. Update, then sign off.',
        current,
      )
    }
    const scope = learnerScopeFor(request.studentRef)
    // The same check parent/actions.ts makes before any adult action.
    if (!authorization.adultAuthorized || authorization.householdRef !== scope.householdRef) {
      return this.#refuseAttestation(
        'adult-not-authorized',
        'Only a verified adult in this household can sign work off.',
      )
    }
    const student = this.#student(request.studentRef)
    if (!student) {
      return this.#refuseAttestation('unknown-student', 'That learner is not set up on this device.')
    }
    const record = student.assignments.find(
      (item) => item.assignmentRef === request.assignmentRef,
    )
    if (!record) {
      return this.#refuseAttestation('unknown-assignment', 'That work is not on this learner’s list.')
    }
    if (record.lessonRef !== request.lessonRef) {
      return this.#refuseAttestation(
        'lesson-binding-mismatch',
        'That sign-off is for a different lesson. Open the work again and try once more.',
      )
    }
    if (
      record.completion.status === 'CERTIFIED' &&
      record.completion.authority === 'GUARDIAN_ATTESTATION_REQUIRED'
    ) {
      return {
        status: 'ok',
        snapshot: this.snapshot(),
        completion: record.completion,
        alreadyAttested: true,
      }
    }
    // Asked of the POLICY, not only of the record: a record carries no
    // authority until the learner finishes it, so reading the stored value
    // alone would tell an adult that work they were asked to watch needs no
    // sign-off. The stored value is still honoured, so a curriculum that stops
    // requiring an adult cannot strand work already waiting on one.
    const requiresAdult =
      resolveCompletionAuthority(this.#completionPolicy, {
        studentRef: request.studentRef,
        assignmentRef: request.assignmentRef,
        lessonRef: record.lessonRef,
      }) === 'GUARDIAN_ATTESTATION_REQUIRED' ||
      record.completion.authority === 'GUARDIAN_ATTESTATION_REQUIRED'
    if (!requiresAdult) {
      return this.#refuseAttestation(
        'attestation-not-required',
        record.completion.status === 'CERTIFIED'
          ? 'This work is already finished.'
          : 'This work does not need an adult sign-off.',
      )
    }
    if (record.completion.status !== 'PENDING_GUARDIAN_ATTESTATION') {
      return this.#refuseAttestation(
        'attestation-not-recorded',
        'Your learner has not finished this yet.',
      )
    }

    const snapshot = updateFamilyPilotState((state) =>
      attestFamilyPilotCompletion(state, {
        studentRef: request.studentRef,
        assignmentRef: request.assignmentRef,
        lessonRef: request.lessonRef,
        attestedByRef: request.attestedByRef,
        evidenceMode: request.evidenceMode,
      }, this.#at()), this.#store)

    // The STORE decides whether this happened, not the record.
    //
    // updateFamilyPilotState returns the mutated in-memory state even when the
    // write was refused — a full or denied quota reports 'unavailable' while
    // still handing back a state that says CERTIFIED. Reading the record back
    // would therefore show a sign-off that reached no disk, and the adult would
    // be told the work now counts while it sits in the same pending list
    // tomorrow. Only 'ready' and 'recovered' mean the bytes actually landed.
    if (snapshot.status !== 'ready' && snapshot.status !== 'recovered') {
      return this.#refuseAttestation(
        'attestation-not-saved',
        'That sign-off could not be saved on this device. Your learner’s work is unchanged.',
        snapshot,
      )
    }
    const completion = this.#completionOf(snapshot, request.studentRef, request.assignmentRef)
    if (!completion || completion.status !== 'CERTIFIED') {
      return this.#refuseAttestation(
        'attestation-not-saved',
        'That sign-off could not be saved. Your learner’s work is unchanged.',
        snapshot,
      )
    }
    return { status: 'ok', snapshot, completion, alreadyAttested: false }
  }

  // ------------------------------------------------------------------- tutor

  /**
   * Opens Tutor help for the current segment.
   *
   * startHelp never throws and degrades to the static fallback on its own, so
   * the lesson survives an unavailable Tutor Core. A safety refusal is returned
   * as a closed help session rather than an exception, for the same reason.
   */
  help(ref: string, assignmentRef: string): FamilyPilotHelpStep | null {
    const bound = this.#bind(ref, assignmentRef)
    if ('status' in bound) return null
    const gate = checkTutorEntry(this.#safety, { studentRef: ref, assignmentRef })
    const session = this.#session(bound.context, bound.record)
    const scope = {
      ...learnerScopeFor(ref),
      sessionRef: session?.sessionRef ?? `${bound.record.assignmentRef}:help`,
    }
    const context = {
      scope,
      subject: bound.context.subject,
      grade: bound.context.grade,
      noAudio: bound.context.accessibility.noAudio,
      mediaAvailable: true,
    }
    if (!gate.allowed) {
      const opened = startHelp(context)
      return { ...opened, session: { ...opened.session, closed: true } }
    }
    return startHelp(context)
  }

  helpEligibility(ref: string, assignmentRef: string) {
    const step = this.help(ref, assignmentRef)
    if (!step) return null
    return canHelp(step.session.context)
  }

  async helpTurn(session: FamilyPilotHelpSession, message: string): Promise<FamilyPilotHelpStep> {
    return submitTurn(session, message, this.#tutorDeps)
  }

  closeHelp(session: FamilyPilotHelpSession) {
    return closeHelp(session)
  }

  // ----------------------------------------------------------------- private

  #at(): string {
    return this.#now().toISOString()
  }

  #student(ref: string): FamilyPilotStudentRecordV1 | null {
    return findFamilyPilotStudent(this.snapshot().state, ref)
  }

  /**
   * Resolves the student, the assignment and its lesson together, so no caller
   * can operate on an assignment it did not first prove belongs to the student
   * it named.
   */
  #bind(ref: string, assignmentRef: string):
    | {
        readonly record: FamilyPilotAssignmentRecordV1
        readonly lesson: HostLessonDescriptor
        readonly context: HostStudyLaunchContext
      }
    | FamilyPilotOperationResult {
    const student = this.#student(ref)
    if (!student) return this.#refuse('unknown-student', 'That learner is not set up on this device.')
    const record = student.assignments.find((item) => item.assignmentRef === assignmentRef)
    if (!record) return this.#refuse('unknown-assignment', 'That work is not on this learner’s list.')
    const lesson = this.#lessonMap(ref).get(record.lessonRef)
    if (!lesson) return this.#refuse('unknown-lesson', 'That lesson is not available on this device.')
    let subject: StudySubject = 'math'
    try {
      subject = lessonSubjectFor(lesson)
    } catch {
      subject = 'math'
    }
    return {
      record,
      lesson,
      context: launchContextFor({
        studentRef: ref,
        grade: Number(this.gradeFor(ref)),
        subject,
        lessonRef: record.lessonRef,
        skillRefs: lesson.skillRefs,
        householdTimeZone: this.#timeZone,
        at: this.#now(),
      }),
    }
  }

  /** The Study handle for a started assignment, rebuilt from Core's blockRef. */
  #session(
    context: HostStudyLaunchContext,
    record: FamilyPilotAssignmentRecordV1,
  ): FamilyPilotStudySession | null {
    if (record.sessionRef === null) return null
    return familyPilotStudySession(context, record.sessionRef)
  }

  #completionOf(
    snapshot: FamilyPilotSnapshot,
    ref: string,
    assignmentRef: string,
  ): FamilyPilotCompletionRecordV1 | null {
    return findFamilyPilotStudent(snapshot.state, ref)
      ?.assignments.find((item) => item.assignmentRef === assignmentRef)
      ?.completion ?? null
  }

  #refuseAttestation(
    reason: FamilyPilotAttestationRejection,
    message: string,
    snapshot: FamilyPilotSnapshot = this.snapshot(),
  ): FamilyPilotAttestationResult {
    return { status: 'rejected', reason, message, snapshot }
  }

  #refuse(reason: string, message: string): FamilyPilotOperationResult {
    return { status: 'rejected', reason, message, snapshot: this.snapshot() }
  }

  #rejected(result: FamilyPilotStudyResult): FamilyPilotOperationResult {
    if (result.status === 'ok') throw new Error('unreachable')
    return this.#refuse(result.reason, result.message)
  }
}

function lessonSubjectFor(lesson: HostLessonDescriptor): StudySubject {
  return lesson.kind === 'reading' ? 'reading' : lesson.kind === 'writing' ? 'writing' : 'math'
}
