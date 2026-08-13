import {
  FINAL_E2E_PERSISTENCE_KEY,
  type FinalE2EAssignmentSnapshot,
  type FinalE2EPersistencePort,
  type FinalE2ERuntimeSnapshot,
  type FinalFamilyPilotHarnessInjection,
  type FinalFamilyPilotRuntime,
} from './contracts'
import {
  FINAL_E2E_LESSONS,
  FINAL_E2E_STUDENT_A,
  FINAL_E2E_STUDENT_B,
} from './fixtures'

export const FINAL_FAMILY_PILOT_SCENARIO_IDS = Object.freeze([
  '01-student-a-progress-and-checkpoint',
  '02-student-b-isolated-state',
  '03-student-a-exact-resume',
  '04-runtime-destruction-exact-resume',
  '05-learner-authority-completion',
  '06-rfl-guardian-attestation',
  '07-safety-hold-sibling-isolation-and-clear',
  '08-dynamic-social-source-gate',
  '09-backup-reset-restore',
  '10-completion-survives-reload',
  '11-corrupt-and-future-persistence-refused',
  '12-private-payloads-not-persisted',
] as const)

export type FinalFamilyPilotScenarioId = (typeof FINAL_FAMILY_PILOT_SCENARIO_IDS)[number]

export interface FinalFamilyPilotScenarioReport {
  readonly id: FinalFamilyPilotScenarioId
  readonly status: 'passed'
}
interface ScenarioContext {
  readonly injection: FinalFamilyPilotHarnessInjection
  readonly persistence: FinalE2EPersistencePort
  runtime: FinalFamilyPilotRuntime
  expectedAResume: FinalE2EAssignmentSnapshot | null
  backupPayload: string | null
  reopen: () => FinalFamilyPilotRuntime
  isolatedRuntime: (persistence: FinalE2EPersistencePort) => FinalFamilyPilotRuntime
}

export interface FinalFamilyPilotScenario {
  readonly id: FinalFamilyPilotScenarioId
  readonly description: string
  readonly run: (context: ScenarioContext) => Promise<void>
}

export class FinalFamilyPilotAcceptanceError extends Error {
  readonly scenarioId: FinalFamilyPilotScenarioId

  constructor(scenarioId: FinalFamilyPilotScenarioId, message: string) {
    super(`[${scenarioId}] ${message}`)
    this.name = 'FinalFamilyPilotAcceptanceError'
    this.scenarioId = scenarioId
  }
}

function assignment(
  snapshot: FinalE2ERuntimeSnapshot,
  studentRef: string,
  lessonRef: string,
): FinalE2EAssignmentSnapshot {
  const result = snapshot.students.find((student) => student.studentRef === studentRef)
    ?.assignments.find((candidate) => candidate.lessonRef === lessonRef)
  if (!result) throw new Error(`Missing fixture assignment ${studentRef}/${lessonRef}.`)
  return result
}

function same<T>(actual: T, expected: T): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected)
}

function assertScenario(
  id: FinalFamilyPilotScenarioId,
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new FinalFamilyPilotAcceptanceError(id, message)
}

function assertOk(
  id: FinalFamilyPilotScenarioId,
  result: Awaited<ReturnType<FinalFamilyPilotRuntime['start']>>,
): void {
  assertScenario(id, result.status === 'ok', `Expected ok, received ${result.status}.`)
}

function privatePayloadIsAbsent(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(privatePayloadIsAbsent)
  if (value === null || typeof value !== 'object') return true
  return Object.entries(value).every(([key, nested]) => {
    const privateField = /(?:raw(?:answer|response)|audio|transcript|learnertext|responsebody)/i.test(key)
    if (privateField && nested !== false && nested !== null) return false
    return privatePayloadIsAbsent(nested)
  })
}

export const FINAL_FAMILY_PILOT_SCENARIOS: readonly FinalFamilyPilotScenario[] = Object.freeze([
  {
    id: '01-student-a-progress-and-checkpoint',
    description: 'Student A starts, completes several segments, and checkpoints.',
    run: async (context) => {
      const id = '01-student-a-progress-and-checkpoint'
      assertOk(id, context.runtime.selectStudent(FINAL_E2E_STUDENT_A))
      assertOk(id, await context.runtime.start(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.sharedMath))
      assertOk(id, await context.runtime.completeSegments(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.sharedMath, 2))
      assertOk(id, await context.runtime.checkpoint(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.sharedMath))
      const progress = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.sharedMath)
      assertScenario(id, progress.completedSegmentRefs.length === 2, 'Student A did not retain two completed segments.')
      assertScenario(id, progress.checkpointRevision === 1, 'Student A checkpoint revision is not exact.')
      assertScenario(id, progress.currentSegmentRef === progress.segmentRefs[2], 'Student A resume pointer is not the next segment.')
      context.expectedAResume = progress
    },
  },
  {
    id: '02-student-b-isolated-state',
    description: 'Student B opens the same lesson without receiving Student A state.',
    run: async (context) => {
      const id = '02-student-b-isolated-state'
      assertOk(id, context.runtime.selectStudent(FINAL_E2E_STUDENT_B))
      assertOk(id, await context.runtime.start(FINAL_E2E_STUDENT_B, FINAL_E2E_LESSONS.sharedMath))
      const b = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_B, FINAL_E2E_LESSONS.sharedMath)
      const a = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.sharedMath)
      assertScenario(id, b.completedSegmentRefs.length === 0, 'Student B received completed work from Student A.')
      assertScenario(id, b.checkpointRevision === 0, 'Student B received Student A checkpoint metadata.')
      assertScenario(id, b.currentSegmentRef === b.segmentRefs[0], 'Student B did not start at segment one.')
      assertScenario(id, same(a, context.expectedAResume), 'Switching to Student B mutated Student A.')
    },
  },
  {
    id: '03-student-a-exact-resume',
    description: 'Switching back to Student A resumes the exact checkpointed position.',
    run: async (context) => {
      const id = '03-student-a-exact-resume'
      assertOk(id, context.runtime.selectStudent(FINAL_E2E_STUDENT_A))
      assertOk(id, await context.runtime.start(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.sharedMath))
      const resumed = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.sharedMath)
      assertScenario(id, same(resumed, context.expectedAResume), 'Student A did not resume with byte-equivalent assignment state.')
    },
  },
  {
    id: '04-runtime-destruction-exact-resume',
    description: 'A destroyed runtime reopens on fresh Study ports with exact durable state.',
    run: async (context) => {
      const id = '04-runtime-destruction-exact-resume'
      const expected = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.sharedMath)
      context.runtime.destroy()
      context.reopen()
      assertOk(id, await context.runtime.start(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.sharedMath))
      const resumed = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.sharedMath)
      assertScenario(id, same(resumed, expected), 'Browser-equivalent recreation changed the resume state.')
    },
  },
  {
    id: '05-learner-authority-completion',
    description: 'A normal learner-authority lesson certifies at learner finish.',
    run: async (context) => {
      const id = '05-learner-authority-completion'
      assertOk(id, await context.runtime.start(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.normalScience))
      assertOk(id, await context.runtime.completeSegments(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.normalScience, 5))
      assertOk(id, await context.runtime.finishLesson(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.normalScience))
      const completed = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.normalScience)
      assertScenario(id, completed.state === 'certified', 'Learner-authority work was not certified.')
      assertScenario(id, completed.completedAt !== null && completed.attestedAt === null, 'Learner completion timestamps are wrong.')
    },
  },
  {
    id: '06-rfl-guardian-attestation',
    description: 'RFL learner finish is pending until an adult attests.',
    run: async (context) => {
      const id = '06-rfl-guardian-attestation'
      assertOk(id, await context.runtime.start(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.rflGuardian))
      assertOk(id, await context.runtime.completeSegments(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.rflGuardian, 5))
      assertOk(id, await context.runtime.finishLesson(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.rflGuardian))
      const pending = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.rflGuardian)
      assertScenario(id, pending.state === 'pending-attestation', 'Guardian-authority work bypassed pending state.')
      assertScenario(id, pending.completedAt === null, 'Pending work was prematurely certified.')
      assertOk(id, await context.runtime.adultAttest(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.rflGuardian))
      const certified = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.rflGuardian)
      assertScenario(id, certified.state === 'certified' && certified.attestedAt !== null, 'Adult attestation did not certify RFL work.')
    },
  },
  {
    id: '07-safety-hold-sibling-isolation-and-clear',
    description: 'A safety hold blocks one student, not a sibling, and parent clear restores entry.',
    run: async (context) => {
      const id = '07-safety-hold-sibling-isolation-and-clear'
      context.injection.safetyPort.placeHold({
        studentRef: FINAL_E2E_STUDENT_A,
        reasonCode: 'synthetic-safety-hold',
        at: context.injection.now().toISOString(),
      })
      const blocked = await context.runtime.start(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.safetyMath)
      assertScenario(id, blocked.status === 'blocked' && blocked.reasonCode === 'synthetic-safety-hold', 'Held student was not blocked.')
      assertOk(id, await context.runtime.start(FINAL_E2E_STUDENT_B, FINAL_E2E_LESSONS.safetyMath))
      const sibling = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_B, FINAL_E2E_LESSONS.safetyMath)
      assertScenario(id, sibling.state === 'active', 'Sibling was affected by another student’s hold.')
      assertOk(id, await context.runtime.clearSafetyHold(FINAL_E2E_STUDENT_A))
      assertOk(id, await context.runtime.start(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.safetyMath))
    },
  },
  {
    id: '08-dynamic-social-source-gate',
    description: 'Dynamic Social work is blocked until a qualifying source is attached.',
    run: async (context) => {
      const id = '08-dynamic-social-source-gate'
      const before = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.socialDynamic)
      assertScenario(id, before.state === 'blocked-source', 'Dynamic Social assignment was initially startable.')
      const blocked = await context.runtime.start(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.socialDynamic)
      assertScenario(id, blocked.status === 'blocked' && blocked.reasonCode === 'qualifying-source-required', 'Missing source was not enforced.')
      const source = context.injection.fixtures.sources[0]
      assertScenario(id, source !== undefined, 'Synthetic qualifying source fixture is missing.')
      assertOk(id, await context.runtime.attachSource(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.socialDynamic, source))
      assertOk(id, await context.runtime.start(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.socialDynamic))
      const started = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.socialDynamic)
      assertScenario(id, started.state === 'active' && started.sourceRef === source.sourceRef, 'Qualified source did not unlock the lesson.')
    },
  },
  {
    id: '09-backup-reset-restore',
    description: 'Backup, mutation, reset, and restore reproduce every student state exactly.',
    run: async (context) => {
      const id = '09-backup-reset-restore'
      const expected = context.runtime.snapshot()
      const backup = await context.runtime.exportBackup()
      context.backupPayload = backup.payload
      assertOk(id, await context.runtime.completeSegments(FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.socialDynamic, 1))
      assertScenario(id, !same(context.runtime.snapshot(), expected), 'Mutation did not change the pre-restore state.')
      await context.runtime.reset()
      assertScenario(id, !same(context.runtime.snapshot(), expected), 'Reset did not clear the evolved state.')
      assertOk(id, await context.runtime.restore(backup))
      assertScenario(id, same(context.runtime.snapshot(), expected), 'Restore did not reproduce exact student states.')
    },
  },
  {
    id: '10-completion-survives-reload',
    description: 'A certified assignment remains certified after runtime reload.',
    run: async (context) => {
      const id = '10-completion-survives-reload'
      context.runtime.destroy()
      context.reopen()
      const completed = assignment(context.runtime.snapshot(), FINAL_E2E_STUDENT_A, FINAL_E2E_LESSONS.normalScience)
      assertScenario(id, completed.state === 'certified' && completed.completedAt !== null, 'Completed assignment regressed after reload.')
    },
  },
  {
    id: '11-corrupt-and-future-persistence-refused',
    description: 'Corrupt and future persisted state fail closed without destructive reseeding.',
    run: async (context) => {
      const id = '11-corrupt-and-future-persistence-refused'
      for (const serialized of [
        '{not-json',
        JSON.stringify({ schemaVersion: 999, activeStudentRef: null, students: [] }),
      ]) {
        const persistence = context.injection.createPersistence()
        persistence.setItem(FINAL_E2E_PERSISTENCE_KEY, serialized)
        const runtime = context.isolatedRuntime(persistence)
        const snapshot = runtime.snapshot()
        assertScenario(id, snapshot.status === 'refused', 'Unsupported persistence did not refuse startup.')
        assertScenario(id, snapshot.students.length === 0, 'Refused startup silently seeded fresh students.')
        assertScenario(id, persistence.getItem(FINAL_E2E_PERSISTENCE_KEY) === serialized, 'Refused startup overwrote recovery evidence.')
      }
    },
  },
  {
    id: '12-private-payloads-not-persisted',
    description: 'Persistence and backup contain no raw response, audio, or transcript payloads.',
    run: async (context) => {
      const id = '12-private-payloads-not-persisted'
      const values = context.persistence.entries().map((entry) => entry[1])
      if (context.backupPayload !== null) values.push(context.backupPayload)
      assertScenario(id, values.length > 0, 'No durable artifact was available for privacy inspection.')
      for (const serialized of values) {
        let parsed: unknown
        try {
          parsed = JSON.parse(serialized)
        } catch {
          throw new FinalFamilyPilotAcceptanceError(id, 'A durable artifact was not valid inspectable JSON.')
        }
        assertScenario(id, privatePayloadIsAbsent(parsed), 'A raw private response/audio/transcript payload was persisted.')
      }
    },
  },
])

function buildRuntime(
  injection: FinalFamilyPilotHarnessInjection,
  persistence: FinalE2EPersistencePort,
): FinalFamilyPilotRuntime {
  return injection.runtimeFactory.create({
    fixtures: injection.fixtures,
    curriculumProvider: injection.curriculumProvider,
    productionMaterialProvider: injection.productionMaterialProvider,
    studyPorts: injection.createStudyPorts(),
    completionPolicy: injection.completionPolicy,
    safetyPort: injection.safetyPort,
    backupRecovery: injection.backupRecovery,
    persistence,
    now: injection.now,
  })
}

export async function runFinalFamilyPilotScenarioLibrary(
  injection: FinalFamilyPilotHarnessInjection,
): Promise<readonly FinalFamilyPilotScenarioReport[]> {
  const persistence = injection.createPersistence()
  const context: ScenarioContext = {
    injection,
    persistence,
    runtime: buildRuntime(injection, persistence),
    expectedAResume: null,
    backupPayload: null,
    reopen: () => {
      context.runtime = buildRuntime(injection, persistence)
      return context.runtime
    },
    isolatedRuntime: (isolatedPersistence) => buildRuntime(injection, isolatedPersistence),
  }
  const reports: FinalFamilyPilotScenarioReport[] = []
  for (const scenario of FINAL_FAMILY_PILOT_SCENARIOS) {
    await scenario.run(context)
    reports.push({ id: scenario.id, status: 'passed' })
  }
  return Object.freeze(reports)
}
