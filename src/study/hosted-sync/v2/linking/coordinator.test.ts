import { describe, expect, it } from 'vitest'
import { FirstLinkCoordinator } from './coordinator'
import { requiredOperationIds } from './manifest'
import type {
  FirstLinkApi,
  FirstLinkInspection,
  FirstLinkManifest,
  FirstLinkProgressPort,
  FirstLinkReadback,
  LinkedHouseholdReceipt,
  LocalHouseholdForLink,
  PendingFirstLinkImport,
} from './types'

function household(updatedAt = '2026-08-02T00:00:00.000Z'): LocalHouseholdForLink {
  return {
    localHouseholdRef: 'household:local', capturedAt: updatedAt,
    students: [{
      localStudentRef: 'student:local', displayName: 'Ada',
      identity: { kind: 'legacy-profile-id', value: 'student:local' },
      assignments: [{
        kind: 'lesson', localAssignmentRef: 'assignment:local', contentRef: 'lesson:math',
        title: 'Math', subject: 'math', state: 'active', completedAt: null,
        createdAt: '2026-08-01T00:00:00.000Z', updatedAt,
        progress: { completedSegmentRefs: ['segment:1'], totalSegments: 2, lastSegmentRef: 'segment:2', activeSeconds: 50 },
      }],
      studyDocument: {
        localDocumentRef: 'document:local', updatedAt, sessions: [{
          localSessionRef: 'session:local', localAssignmentRef: 'assignment:local', blockRef: 'block:local',
          lessonRef: 'lesson:math', status: 'active', segmentRef: 'segment:2', updatedAt,
          lastAcceptedEventRef: null, checkpoint: null,
        }],
      },
      sources: [], attestations: [], safetyHolds: [],
    }],
  }
}

const INSPECTION: FirstLinkInspection = {
  authority: {
    status: 'authenticated-parent-household-authority', authorityRef: 'authority:server',
    remoteHouseholdRef: 'household:remote', expiresAt: '2099-01-01T00:00:00.000Z',
  },
  serverBaseRevision: 4,
  remoteStudents: [],
}

class MemoryProgress implements FirstLinkProgressPort {
  pending: PendingFirstLinkImport | null = null
  async load(localHouseholdRef: string) {
    return this.pending?.manifest.household.localHouseholdRef === localHouseholdRef ? this.pending : null
  }
  async savePending(pending: PendingFirstLinkImport) { this.pending = pending }
  async clearPending(localHouseholdRef: string, attemptId: string) {
    if (
      this.pending?.manifest.household.localHouseholdRef === localHouseholdRef &&
      this.pending.manifest.attemptId === attemptId
    ) this.pending = null
  }
}

function readbackFor(manifest: FirstLinkManifest): FirstLinkReadback {
  return {
    status: 'complete',
    attemptId: manifest.attemptId,
    manifestDigest: manifest.manifestDigest,
    remoteHouseholdRef: manifest.household.remoteHouseholdRef,
    serverRevision: manifest.serverBaseRevisionSeed + 1,
    appliedOperationIds: requiredOperationIds(manifest),
    students: manifest.students.map((student, studentIndex) => ({
      localStudentRef: student.localStudentRef,
      remoteStudentRef: student.remoteStudentRef ?? `remote-student:${studentIndex}`,
      assignments: student.assignments.map((assignment, assignmentIndex) => ({
        localAssignmentRef: assignment.localAssignmentRef,
        remoteAssignmentRef: assignment.remoteAssignmentRef ?? `remote-assignment:${studentIndex}:${assignmentIndex}`,
      })),
      sessions: student.studyDocument.sessions.map((session, sessionIndex) => ({
        localSessionRef: session.localSessionRef,
        remoteSessionRef: session.remoteSessionRef ?? `remote-session:${studentIndex}:${sessionIndex}`,
      })),
    })),
  }
}

class FakeApi implements FirstLinkApi {
  manifests: FirstLinkManifest[] = []
  failAfterPartial = false
  incomplete = false
  mismatch = false
  conflict = false
  async inspect() { return INSPECTION }
  async apply(manifest: FirstLinkManifest) {
    this.manifests.push(manifest)
    if (this.failAfterPartial) {
      this.failAfterPartial = false
      throw new Error('network dropped after server accepted a prefix')
    }
    if (this.conflict) return { status: 'conflict' as const }
    return { status: this.incomplete ? 'incomplete' as const : 'accepted' as const }
  }
  async readback(attemptId: string) {
    const manifest = [...this.manifests].reverse().find((item) => item.attemptId === attemptId)
    if (!manifest) throw new Error('not found')
    const result = readbackFor(manifest)
    if (this.incomplete) return { ...result, status: 'incomplete' as const }
    if (this.mismatch) return { ...result, appliedOperationIds: result.appliedOperationIds.slice(1) }
    return result
  }
}

function harness(initial = household()) {
  let local = initial
  const progress = new MemoryProgress()
  const api = new FakeApi()
  const commits: LinkedHouseholdReceipt[] = []
  const coordinator = new FirstLinkCoordinator({
    api,
    readLocal: async () => local,
    progress,
    localCommit: { commitVerifiedLink: async (receipt) => { commits.push(receipt) } },
    now: () => '2026-08-03T00:00:00.000Z',
    newAttemptId: () => 'attempt:stable',
  })
  return { coordinator, api, progress, commits, setLocal: (next: LocalHouseholdForLink) => { local = next } }
}

describe('first-link coordinator', () => {
  it('requires explicit Parent confirmation and does not call the remote apply without it', async () => {
    const run = harness()
    const review = await run.coordinator.prepare()
    const result = await run.coordinator.execute(review, false)
    expect(result).toMatchObject({ status: 'failed', code: 'PARENT_CONFIRMATION_REQUIRED' })
    expect(run.api.manifests).toHaveLength(0)
    expect(run.commits).toHaveLength(0)
  })

  it('leaves source state untouched on a network failure and resumes with identical IDs', async () => {
    const source = household()
    const before = JSON.stringify(source)
    const run = harness(source)
    run.api.failAfterPartial = true
    const review = await run.coordinator.prepare()
    const failed = await run.coordinator.execute(review, true)
    expect(failed).toMatchObject({ status: 'failed', code: 'NETWORK_FAILURE', resumable: true })
    expect(JSON.stringify(source)).toBe(before)
    expect(run.progress.pending?.manifest.attemptId).toBe('attempt:stable')
    expect(run.commits).toHaveLength(0)

    const resumed = await run.coordinator.resume('household:local')
    expect(resumed.status).toBe('linked')
    expect(run.api.manifests).toHaveLength(2)
    expect(run.api.manifests[1]).toEqual(run.api.manifests[0])
    expect(run.commits).toHaveLength(1)
    expect(run.progress.pending).toBeNull()
  })

  it('keeps a partial remote import pending and does not mark linking complete', async () => {
    const run = harness()
    run.api.incomplete = true
    const result = await run.coordinator.execute(await run.coordinator.prepare(), true)
    expect(result).toMatchObject({ status: 'failed', code: 'REMOTE_IMPORT_INCOMPLETE', resumable: true })
    expect(run.progress.pending).not.toBeNull()
    expect(run.commits).toHaveLength(0)
  })

  it('does not overwrite remote state that changed after planning', async () => {
    const run = harness()
    run.api.conflict = true
    const result = await run.coordinator.execute(await run.coordinator.prepare(), true)
    expect(result).toMatchObject({ status: 'failed', code: 'REMOTE_STATE_CHANGED', resumable: false })
    expect(run.commits).toHaveLength(0)
  })

  it('refuses a non-exact readback even after apply reports success', async () => {
    const run = harness()
    run.api.mismatch = true
    const result = await run.coordinator.execute(await run.coordinator.prepare(), true)
    expect(result).toMatchObject({ status: 'failed', code: 'READBACK_MISMATCH', resumable: true })
    expect(run.commits).toHaveLength(0)
    expect(run.progress.pending).not.toBeNull()
  })

  it('forces a fresh Parent review if local work changes after the displayed plan', async () => {
    const run = harness()
    const review = await run.coordinator.prepare()
    run.setLocal(household('2026-08-03T01:00:00.000Z'))
    const result = await run.coordinator.execute(review, true)
    expect(result).toMatchObject({ status: 'failed', code: 'LOCAL_STATE_CHANGED' })
    expect(run.api.manifests).toHaveLength(0)
    expect(run.commits).toHaveLength(0)
  })

  it('commits only the exact server readback mapping and server revision', async () => {
    const run = harness()
    const result = await run.coordinator.execute(await run.coordinator.prepare(), true)
    expect(result.status).toBe('linked')
    expect(run.commits).toEqual([expect.objectContaining({
      localHouseholdRef: 'household:local', remoteHouseholdRef: 'household:remote',
      attemptId: 'attempt:stable', serverRevision: 5,
      students: [{
        localStudentRef: 'student:local', remoteStudentRef: 'remote-student:0',
        assignments: [{ localAssignmentRef: 'assignment:local', remoteAssignmentRef: 'remote-assignment:0:0' }],
        sessions: [{ localSessionRef: 'session:local', remoteSessionRef: 'remote-session:0:0' }],
      }],
    })])
  })

  it('can finish the immutable confirmed snapshot after newer local progress is recorded', async () => {
    const run = harness()
    run.api.failAfterPartial = true
    await run.coordinator.execute(await run.coordinator.prepare(), true)
    run.setLocal(household('2026-08-04T00:00:00.000Z'))
    const result = await run.coordinator.resume('household:local')
    expect(result.status).toBe('linked')
    expect(run.api.manifests[1]).toEqual(run.api.manifests[0])
  })
})
