import { describe, expect, it } from 'vitest'
import { createHostedSyncRpcAdapter } from './rpcAdapter'
import { HOSTED_SYNC_RPC, type HostedSyncAuthenticatedRpcProvider, type HostedSyncEphemeralAuthorization } from './types'
import { createLocalDbRpcEmulator } from './testing/localDbRpcEmulator'

const NOW = '2026-08-13T18:00:00.000Z'
const EXPIRES = '2026-08-13T19:00:00.000Z'
const DIGEST = 'a'.repeat(64)
const STUDENT = '00000000-0000-4000-8000-000000000101'
const OP = '10000000-0000-4000-8000-000000000001'

const imported = Object.freeze({
  localScope: { householdRef: 'household:alpha', studentRef: 'student:ada', assignmentRef: 'local:assignment:math', sessionRef: 'local:session:math' },
  hostedScope: { assignmentRef: 'assignment-math', sessionRef: 'session-math' },
  session: { lessonRef: 'lesson-math', subjectRef: 'mathematics', state: 'active', startedAt: NOW, completedAt: null, intendedLocalDate: '2026-08-13' },
  checkpoint: null, socialSource: null, guardianAttestation: null,
  safetyState: { schemaVersion: 1 as const, holds: [] }, assessment: null,
})

function authorization(provider: HostedSyncAuthenticatedRpcProvider, release = () => undefined): HostedSyncEphemeralAuthorization {
  return { acquire: async () => ({ status: 'AUTHORIZED', lease: { clientKind: 'AUTHENTICATED_USER', expiresAt: EXPIRES, provider, release } }) }
}

function adapter(provider: HostedSyncAuthenticatedRpcProvider) {
  return createHostedSyncRpcAdapter({ authorization: authorization(provider), isOnline: () => true, now: () => new Date(NOW) })
}

describe('hosted sync R2 exact DB RPC adapter', () => {
  it('calls the four installed RPC names with their exact PostgREST arguments', async () => {
    const provider = createLocalDbRpcEmulator({ now: () => new Date(NOW) })
    const client = adapter(provider)
    expect((await client.firstLink({ tokenDigest: DIGEST, studentId: STUDENT, clientOperationId: OP, import: imported })).code).toBe('SUCCESS')
    expect((await client.resolveMapping({ tokenDigest: DIGEST, studentId: STUDENT, localScope: imported.localScope })).code).toBe('SUCCESS')
    expect((await client.hydrate({ tokenDigest: DIGEST, studentId: STUDENT, assignmentRef: 'assignment-math', sessionId: 'session-math' })).code).toBe('SUCCESS')
    expect((await client.write({ tokenDigest: DIGEST, studentId: STUDENT, assignmentRef: 'assignment-math', sessionId: 'session-math', expectedRevision: 1, clientOperationId: '10000000-0000-4000-8000-000000000002', operation: 'session:complete', payload: { completedAt: NOW } })).code).toBe('SUCCESS')
    expect(provider.calls.map((call) => call.name)).toEqual(Object.values(HOSTED_SYNC_RPC))
    expect(provider.calls.map((call) => Object.keys(call.args))).toEqual([
      ['p_token_digest', 'p_student_id', 'p_client_operation_id', 'p_import'],
      ['p_token_digest', 'p_student_id', 'p_local_scope'],
      ['p_token_digest', 'p_student_id', 'p_assignment_ref', 'p_session_id'],
      ['p_token_digest', 'p_student_id', 'p_assignment_ref', 'p_session_id', 'p_expected_revision', 'p_client_operation_id', 'p_operation', 'p_payload'],
    ])
  })

  it('retries a lost acknowledgement with the same UUID and gets the stored result', async () => {
    const provider = createLocalDbRpcEmulator({ now: () => new Date(NOW) })
    provider.dropNextCommittedResponse(HOSTED_SYNC_RPC.firstLink)
    const client = adapter(provider)
    const input = { tokenDigest: DIGEST, studentId: STUDENT, clientOperationId: OP, import: imported }
    expect(await client.firstLink(input)).toMatchObject({ code: 'NETWORK_UNAVAILABLE' })
    expect(await client.firstLink(input)).toMatchObject({ code: 'SUCCESS', value: { status: 'imported' } })
  })

  it('fails closed for offline, expired authorization, malformed results, and forbidden payload fields', async () => {
    const provider = createLocalDbRpcEmulator()
    const offline = createHostedSyncRpcAdapter({ authorization: authorization(provider), isOnline: () => false })
    expect(await offline.hydrate({ tokenDigest: DIGEST, studentId: STUDENT, assignmentRef: 'assignment-math', sessionId: 'session-math' })).toMatchObject({ code: 'OFFLINE' })
    const expired = createHostedSyncRpcAdapter({ authorization: authorization(provider), isOnline: () => true, now: () => new Date(EXPIRES) })
    expect(await expired.hydrate({ tokenDigest: DIGEST, studentId: STUDENT, assignmentRef: 'assignment-math', sessionId: 'session-math' })).toMatchObject({ code: 'SESSION_EXPIRED' })
    const malformed: HostedSyncAuthenticatedRpcProvider = { rpc: async () => ({ data: { schemaVersion: 2, status: 'ready' }, error: null }) }
    expect(await adapter(malformed).hydrate({ tokenDigest: DIGEST, studentId: STUDENT, assignmentRef: 'assignment-math', sessionId: 'session-math' })).toMatchObject({ code: 'MALFORMED_RESPONSE' })
    expect(await adapter(provider).write({ tokenDigest: DIGEST, studentId: STUDENT, assignmentRef: 'assignment-math', sessionId: 'session-math', expectedRevision: 0, clientOperationId: OP, operation: 'assessment:set-state', payload: { rawAnswer: '42' } })).toMatchObject({ code: 'PERMANENT_REFUSAL', reasonCode: 'INVALID_CLIENT_INPUT' })
  })
})
