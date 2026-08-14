import { describe, expect, it } from 'vitest'
import { buildFirstLinkManifest, digestFirstLinkPlan, requiredOperationIds } from './manifest'
import { buildFirstLinkPlan } from './plan'
import type { FirstLinkInspection, LocalHouseholdForLink } from './types'

const local: LocalHouseholdForLink = {
  localHouseholdRef: 'household:local',
  capturedAt: '2026-08-02T00:00:00.000Z',
  students: [{
    localStudentRef: 'student:local', displayName: 'Ada',
    identity: { kind: 'legacy-profile-id', value: 'student:local' },
    assignments: [{
      kind: 'lesson', localAssignmentRef: 'assignment:local', contentRef: 'lesson:math', title: 'Math', subject: 'math',
      state: 'completed', completedAt: '2026-08-02T00:00:00.000Z',
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z',
      progress: { completedSegmentRefs: ['segment:1'], totalSegments: 1, lastSegmentRef: 'segment:1', activeSeconds: 90 },
      // Runtime-only extra data must not cross the manifest allowlist.
      pinDigest: 'do-not-upload', rawAnswer: 'do-not-upload',
    } as LocalHouseholdForLink['students'][number]['assignments'][number]],
    studyDocument: {
      localDocumentRef: 'document:local', updatedAt: '2026-08-02T00:00:00.000Z',
      sessions: [{
        localSessionRef: 'session:local', localAssignmentRef: 'assignment:local', blockRef: 'block:local',
        lessonRef: 'lesson:math', status: 'completed', segmentRef: 'segment:1',
        updatedAt: '2026-08-02T00:00:00.000Z', lastAcceptedEventRef: 'event:safe',
        checkpoint: {
          checkpointRef: 'checkpoint:local', revision: 2, capturedAt: '2026-08-02T00:00:00.000Z',
          completedSegmentRefs: ['segment:1'], elapsedActiveSecondsInSegment: 90,
        },
        transcript: 'do-not-upload',
      } as LocalHouseholdForLink['students'][number]['studyDocument']['sessions'][number]],
    },
    sources: [{
      localSourceRef: 'source:local', localAssignmentRef: 'assignment:local', lessonRef: 'lesson:math',
      title: 'Source title', publisher: 'Publisher', publishedAt: '2026-08-01T00:00:00.000Z',
      attachedAt: '2026-08-02T00:00:00.000Z', status: 'ATTACHED_SATISFIED',
    }],
    attestations: [{
      localAssignmentRef: 'assignment:local', lessonRef: 'lesson:math', localSessionRef: 'session:local',
      status: 'CERTIFIED', learnerAssertedAt: '2026-08-02T00:00:00.000Z',
      attestedAt: '2026-08-02T00:01:00.000Z', evidenceMode: 'adult-observed',
      attestedByRef: 'adult:private',
    } as LocalHouseholdForLink['students'][number]['attestations'][number]],
    safetyHolds: [{
      localHoldRef: 'hold:local', localSessionRef: 'session:local', createdAt: '2026-08-02T00:00:00.000Z',
      status: 'cleared', reasonCode: 'parent-review-requested', source: 'parent',
      acknowledgedAt: '2026-08-02T00:01:00.000Z', clearedAt: '2026-08-02T00:02:00.000Z',
      clearedBy: 'adult:private',
    } as LocalHouseholdForLink['students'][number]['safetyHolds'][number]],
  }],
}

const inspection: FirstLinkInspection = {
  authority: {
    status: 'authenticated-parent-household-authority', authorityRef: 'authority:server',
    remoteHouseholdRef: 'household:remote', expiresAt: '2099-01-01T00:00:00.000Z',
  },
  serverBaseRevision: 11,
  remoteStudents: [],
}

async function manifest(attemptId: string) {
  const plan = buildFirstLinkPlan(local, inspection)
  const planDigest = await digestFirstLinkPlan(plan, local)
  return buildFirstLinkManifest({
    attemptId,
    plan,
    local,
    confirmation: {
      confirmationVersion: 1, approved: true, confirmedAt: '2026-08-03T00:00:00.000Z', planDigest,
    },
  })
}

describe('first-link minimized manifest', () => {
  it('carries required state and operation IDs while excluding forbidden local authority', async () => {
    const built = await manifest('attempt:one')
    expect(built).toMatchObject({
      manifestVersion: 1,
      serverBaseRevisionSeed: 11,
      household: { localHouseholdRef: 'household:local', remoteHouseholdRef: 'household:remote' },
      rawAnswerIncluded: false,
      tutorTranscriptIncluded: false,
      pinIncluded: false,
      adultAnswerAuthorityIncluded: false,
    })
    expect(built.students[0]?.assignments[0]?.progress.completedSegmentRefs).toEqual(['segment:1'])
    expect(built.students[0]?.studyDocument.sessions[0]).toMatchObject({
      localSessionRef: 'session:local', checkpoint: { revision: 2 },
    })
    expect(built.students[0]?.attestations[0]).toMatchObject({
      status: 'CERTIFIED', authorityTreatment: 'authenticated-parent-import-receipt-required',
    })
    const bytes = JSON.stringify(built)
    expect(bytes).not.toContain('do-not-upload')
    expect(bytes).not.toContain('adult:private')
    expect(bytes).not.toContain('pinDigest')
    expect(bytes).not.toContain('"rawAnswer":')
    expect(bytes).not.toContain('attestedByRef')
    expect(bytes).not.toContain('clearedBy')
    expect(new Set(requiredOperationIds(built)).size).toBe(requiredOperationIds(built).length)
  })

  it('is byte-deterministic for a retry and changes every operation namespace for a new attempt', async () => {
    const first = await manifest('attempt:stable')
    const retry = await manifest('attempt:stable')
    const next = await manifest('attempt:new')
    expect(retry).toEqual(first)
    expect(next.manifestDigest).not.toBe(first.manifestDigest)
    expect(requiredOperationIds(next)).not.toEqual(requiredOperationIds(first))
  })

  it('rejects a confirmation digest for any other local snapshot or mapping', async () => {
    const plan = buildFirstLinkPlan(local, inspection)
    await expect(buildFirstLinkManifest({
      attemptId: 'attempt:bad', plan, local,
      confirmation: {
        confirmationVersion: 1, approved: true,
        confirmedAt: '2026-08-03T00:00:00.000Z', planDigest: 'wrong',
      },
    })).rejects.toThrow(/does not match/)
  })
})
