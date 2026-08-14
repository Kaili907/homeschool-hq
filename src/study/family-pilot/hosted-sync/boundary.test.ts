import { describe, expect, it, vi } from 'vitest'
import { defaultAppState } from '../../../migration'
import {
  FORBIDDEN_SYNC_FIELD_FAMILIES_V1,
  HOSTED_STUDY_SYNC_FIELD_ALLOWLIST_V1,
  HOSTED_STUDY_SYNC_SCHEMA_ID,
  HostedStudySyncPreNetworkGate,
  HostedSyncBoundaryError,
  serializeHostedStudySyncV1,
  validateHostedStudySyncV1,
  type HostedStudySyncNetworkRequest,
  type SerializedHostedStudySyncV1,
} from './boundary'

function candidate(): any {
  return {
    schemaVersion: 1,
    releaseRef: 'family-pilot-r1',
    updatedAt: '2026-08-13T16:00:00.000Z',
    learners: [{
      learnerRef: 'student:avery',
      displayName: 'Avery',
      nominalGrade: '5',
      workingGradeBySubject: { mathematics: '5' },
      enabledSubjects: ['mathematics', 'ready-for-life', 'social-studies'],
      assignments: [{
        assignmentRef: 'assignment:math-1',
        lessonRef: 'ma-g5-mathematics-u01-l01',
        subject: 'mathematics',
        title: 'Launch and diagnostic',
        state: 'active',
        updatedAt: '2026-08-13T15:59:00.000Z',
        completedAt: null,
        progress: {
          completedSegmentRefs: ['segment:learn'],
          totalSegments: 3,
          lastSegmentRef: 'segment:practice',
        },
      }],
      assessmentAssignments: [{
        assignmentRef: 'assignment:assessment-1',
        assessmentRef: 'assessment:math-u01',
        courseRef: 'ma-g5-mathematics',
        subject: 'mathematics',
        grade: 5,
        title: 'Unit 1 assessment',
        authorityClass: 'AUTO_SCOREABLE',
        status: 'PENDING_ASSESSMENT',
        updatedAt: '2026-08-13T15:59:00.000Z',
        completedAt: null,
      }],
      sourceAttachments: [{
        assignmentRef: 'assignment:social-1',
        lessonRef: 'ma-g3-social-studies-u09-l01',
        sourceRef: 'source:family-library-1',
        attachedAt: '2026-08-13T15:00:00.000Z',
        status: 'ATTACHED_SATISFIED',
      }],
      completionAttestations: [{
        assignmentRef: 'assignment:rfl-1',
        lessonRef: 'ma-g5-ready-for-life-u01-l04',
        sessionRef: 'session:rfl-1',
        authority: 'GUARDIAN_ATTESTATION_REQUIRED',
        status: 'CERTIFIED',
        learnerAssertedAt: '2026-08-13T15:30:00.000Z',
        attestedAt: '2026-08-13T15:35:00.000Z',
        attestedByRef: 'guardian:1',
        evidenceMode: 'adult-observed',
      }],
      entryBlocks: [{
        blockRef: 'block:safety-1',
        sessionRef: 'session:math-1',
        status: 'cleared',
        createdAt: '2026-08-13T15:10:00.000Z',
        clearedAt: '2026-08-13T15:20:00.000Z',
        clearedByRef: 'guardian:1',
      }],
    }],
  }
}

function expectRefused(value: unknown, path?: string): HostedSyncBoundaryError {
  try {
    serializeHostedStudySyncV1(value)
  } catch (error) {
    expect(error).toBeInstanceOf(HostedSyncBoundaryError)
    if (path) expect((error as HostedSyncBoundaryError).path).toBe(path)
    return error as HostedSyncBoundaryError
  }
  throw new Error('Expected hosted-sync serialization to be refused.')
}

describe('production hosted-sync privacy serializer', () => {
  it('has one frozen, unique, deny-by-default allowlist and deterministic output', async () => {
    expect(Object.isFrozen(HOSTED_STUDY_SYNC_FIELD_ALLOWLIST_V1)).toBe(true)
    expect(new Set(HOSTED_STUDY_SYNC_FIELD_ALLOWLIST_V1).size).toBe(HOSTED_STUDY_SYNC_FIELD_ALLOWLIST_V1.length)
    expect(Object.isFrozen(FORBIDDEN_SYNC_FIELD_FAMILIES_V1)).toBe(true)

    const sent: HostedStudySyncNetworkRequest[] = []
    const gate = new HostedStudySyncPreNetworkGate({
      send: vi.fn(async (request: HostedStudySyncNetworkRequest) => {
        sent.push(request)
        return 'ok'
      }),
    })
    const first = serializeHostedStudySyncV1(candidate())
    const second = serializeHostedStudySyncV1(structuredClone(candidate()))
    expect(first.schemaId).toBe(HOSTED_STUDY_SYNC_SCHEMA_ID)
    expect(first.byteLength).toBe(second.byteLength)
    await gate.write(first)
    await gate.write(second)
    expect(sent[0].body).toBe(sent[1].body)
    expect(validateHostedStudySyncV1(candidate()).ok).toBe(true)

    const unknown = candidate()
    unknown.learners[0].debug = true
    const error = expectRefused(unknown, '$.learners[0].debug')
    expect(error.code).toBe('UNALLOWLISTED_FIELD')
  })

  const forbiddenMutants: readonly [string, string, unknown][] = [
    ['raw PIN', 'rawPin', '4826'],
    ['PIN digest', 'pinDigest', 'deadbeef'],
    ['PIN verifier', 'pinVerifier', 'verifier'],
    ['bearer', 'studyBearer', 'Bearer study-secret-token'],
    ['token', 'token', 'token-secret'],
    ['grant', 'launchGrant', 'grant-secret'],
    ['raw learner response', 'learnerResponse', 'learner prose'],
    ['Tutor transcript', 'tutorTranscript', 'raw Tutor turns'],
    ['assistant transcript', 'assistantTranscript', 'raw assistant turns'],
    ['audio', 'audioBlob', 'base64-audio'],
    ['answerIndex', 'answerIndex', 2],
    ['correctAnswer', 'correctAnswer', 'B'],
    ['expectedAnswer', 'expectedAnswer', 'B'],
    ['answerKeyRef', 'answerKeyRef', 'answer-key:math-u1'],
    ['scoring locator', 'scoringLocator', '/restricted/scoring/math-u1'],
    ['adult rubric', 'adultRubric', 'private scoring rubric'],
    ['answer authority', 'answerAuthorityRef', 'authority:answer-1'],
    ['scoring authority', 'adultScoringAuthority', 'authority:scoring-1'],
    ['private note', 'privateNote', 'adult-only note body'],
    ['emotional inference', 'emotionalState', 'anxious'],
    ['personality inference', 'personalityInference', 'introverted'],
    ['diagnostic inference', 'diagnosticInference', 'possible condition'],
    ['service credentials', 'serviceCredentials', 'server secret'],
  ]

  it.each(forbiddenMutants)('rejects forbidden mutant: %s', (_label, field, value) => {
    const held = candidate()
    held.learners[0].assignments[0][field] = value
    const error = expectRefused(held, `$.learners[0].assignments[0].${field}`)
    expect(error.code).toBe('FORBIDDEN_FIELD')
  })

  it('rejects a nested forbidden field before an unknown container can hide it', () => {
    const held = candidate()
    held.learners[0].assignments[0].progress.metadata = {
      envelope: { expectedAnswer: 'secret' },
    }
    expectRefused(
      held,
      '$.learners[0].assignments[0].progress.metadata.envelope.expectedAnswer',
    )
  })

  it('rejects credential-shaped text hidden in an allowlisted field', () => {
    const held = candidate()
    held.learners[0].assignments[0].title = 'Bearer abc.def.ghi'
    const error = expectRefused(held, '$.learners[0].assignments[0].title')
    expect(error.code).toBe('SENSITIVE_VALUE')
  })

  it('rejects sparse/named arrays, accessors, and hidden object fields', () => {
    const sparse = candidate()
    sparse.learners[0].assignments.length = 2
    expectRefused(sparse, '$.learners[0].assignments[1]')

    const named = candidate()
    named.learners[0].assignments.secret = 'hidden'
    expectRefused(named, '$.learners[0].assignments.secret')

    const accessor = candidate()
    Object.defineProperty(accessor.learners[0], 'debug', { enumerable: true, get: () => true })
    expectRefused(accessor, '$.learners[0].debug')

    const hidden = candidate()
    Object.defineProperty(hidden.learners[0], 'hidden', { enumerable: false, value: 'secret' })
    expectRefused(hidden, '$.learners[0].hidden')
  })

  it('rejects object and array aliases instead of traversing shared mutable state', () => {
    const objectAlias = candidate()
    objectAlias.learners[0].assignments.push({
      ...structuredClone(objectAlias.learners[0].assignments[0]),
      assignmentRef: 'assignment:math-2',
      progress: objectAlias.learners[0].assignments[0].progress,
    })
    expect(expectRefused(objectAlias).code).toBe('INVALID_TYPE')

    const arrayAlias = candidate()
    arrayAlias.learners[0].assignments[0].progress.completedSegmentRefs =
      arrayAlias.learners[0].enabledSubjects
    expect(expectRefused(arrayAlias).code).toBe('INVALID_TYPE')
  })

  it('rejects a whole legacy Profile and whole local/backup document shapes', () => {
    expect(validateHostedStudySyncV1(defaultAppState().profiles.p1).ok).toBe(false)
    expect(validateHostedStudySyncV1({ schemaVersion: 1, pinDigests: { avery: 'deadbeef' } }).ok).toBe(false)
    expect(validateHostedStudySyncV1({ backupSchemaVersion: 1, appState: {}, studyDocuments: [] }).ok).toBe(false)
    expect(validateHostedStudySyncV1({ schemaVersion: 1, parentSettings: {}, events: [] }).ok).toBe(false)
  })
})

describe('mandatory hosted-sync pre-network gate', () => {
  it.each(['first-link', 'write'] as const)('dispatches %s only from sealed serializer output', async (operation) => {
    const send = vi.fn(async (_request: HostedStudySyncNetworkRequest) => ({ ok: true }))
    const gate = new HostedStudySyncPreNetworkGate({ send })
    const payload = serializeHostedStudySyncV1(candidate())

    await expect(gate[operation === 'first-link' ? 'firstLink' : 'write'](payload)).resolves.toEqual({ ok: true })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      operation,
      schemaId: HOSTED_STUDY_SYNC_SCHEMA_ID,
      contentType: 'application/json',
      body: expect.any(String),
    }))
    expect(JSON.parse(send.mock.calls[0][0].body)).toEqual(expect.objectContaining({
      schemaVersion: 1,
      releaseRef: 'family-pilot-r1',
    }))
  })

  it.each(['first-link', 'write'] as const)('refuses %s bypasses before the network port', async (operation) => {
    const send = vi.fn(async (_request: HostedStudySyncNetworkRequest) => ({ ok: true }))
    const gate = new HostedStudySyncPreNetworkGate({ send })
    const method = operation === 'first-link' ? gate.firstLink.bind(gate) : gate.write.bind(gate)
    const real = serializeHostedStudySyncV1(candidate())
    const bypasses = [
      candidate(),
      JSON.stringify(candidate()),
      { schemaId: HOSTED_STUDY_SYNC_SCHEMA_ID, byteLength: real.byteLength },
      structuredClone(real),
      Object.create(Object.getPrototypeOf(real)),
    ]

    for (const bypass of bypasses) {
      expect(() => method(bypass as SerializedHostedStudySyncV1)).toThrowError(
        expect.objectContaining({ code: 'UNSERIALIZED_PAYLOAD' }),
      )
    }
    expect(send).not.toHaveBeenCalled()
  })
})
