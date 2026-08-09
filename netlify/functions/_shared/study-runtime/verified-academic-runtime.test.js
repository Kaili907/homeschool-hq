import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createStudyAcademicRuntimeHandler } from '../../study-academic-runtime.js'
import { createVerifiedAcademicRuntimeGateway, OPERATIONS } from './verified-academic-runtime.js'

const reference = `aca_stu_v1_${'A'.repeat(43)}`

describe('verified academic runtime gateway', () => {
  it('passes only a digest and capability into one transactional RPC', async () => {
    const call = vi.fn(async () => ({
      schemaVersion: 1,
      status: 'ok',
      operation: 'calendar:read',
      body: { blocks: [] },
    }))
    const gateway = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call },
    })
    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'calendar:read',
      request: { cursor: null },
    })).resolves.toEqual({
      schemaVersion: 1,
      status: 'ok',
      operation: 'calendar:read',
      body: { blocks: [] },
    })
    expect(call).toHaveBeenCalledWith('academy_study_execute_verified_runtime_v1', {
      p_token_digest: createHash('sha256').update(reference, 'ascii').digest('hex'),
      p_required_capability: 'student:assignments:read',
      p_operation: 'calendar:read',
      p_request: { cursor: null },
    })
  })

  it('rejects caller identity, sentinels, and protected response payloads', async () => {
    const gateway = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call: vi.fn() },
    })
    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'session:begin',
      request: { studentId: '22222222-2222-4222-8222-222222222222' },
    })).rejects.toThrow(/authority/i)
    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'session:begin',
      request: { session: { student_id: '22222222-2222-4222-8222-222222222222' } },
    })).rejects.toThrow(/authority/i)
    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'session:begin',
      request: { blockRef: 'learner:local-release-candidate' },
    })).rejects.toThrow(/sentinel/i)

    const leaking = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call: vi.fn(async () => ({
        schemaVersion: 1,
        status: 'ok',
        operation: 'dashboard:read',
        body: { rawAnswer: 'not allowed' },
      })) },
    })
    await expect(leaking.execute({
      sessionReference: reference,
      operation: 'dashboard:read',
      request: {},
    })).rejects.toThrow(/authority/i)
  })

  it('carries the two learner operations and refuses adult preferences', async () => {
    expect(OPERATIONS['event:append']).toBe('student:attempts:create')
    expect(OPERATIONS['calendar:transition']).toBe('student:attempts:create')
    expect(Object.keys(OPERATIONS)).not.toContain('preferences:write')

    for (const [operation, request] of [
      ['event:append', {
        sessionId: 'session-a',
        eventId: 'event.1',
        eventKind: 'session_started',
        payload: { schema_version: 1, state_to: 'active' },
        idempotencyKey: 'idem.1',
      }],
      ['calendar:transition', {
        blockId: 'block.1',
        expectedRevision: 1,
        transition: 'start',
        at: '2026-08-09T14:00:00Z',
        segmentRef: null,
        pauseCategory: null,
        idempotencyKey: 'calendar.1',
      }],
    ]) {
      const routed = vi.fn(async () => ({
        schemaVersion: 1, status: 'ok', operation, body: { status: 'appended' },
      }))
      const gateway = createVerifiedAcademicRuntimeGateway({
        rpc: { isConfigured: () => true, call: routed },
      })
      await expect(gateway.execute({ sessionReference: reference, operation, request }))
        .resolves.toMatchObject({ status: 'ok', operation })
      expect(routed).toHaveBeenCalledWith('academy_study_execute_verified_runtime_v1', {
        p_token_digest: createHash('sha256').update(reference, 'ascii').digest('hex'),
        p_required_capability: 'student:attempts:create',
        p_operation: operation,
        p_request: request,
      })
    }

    // A learner-supplied authority key never reaches the RPC, at either depth.
    const refusing = vi.fn()
    const gateway = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call: refusing },
    })
    for (const request of [
      { learnerRef: 'learner-1' },
      { householdId: '11111111-1111-4111-8111-111111111111' },
      { payload: { student_id: '22222222-2222-4222-8222-222222222222' } },
    ]) {
      await expect(gateway.execute({
        sessionReference: reference, operation: 'event:append', request,
      })).rejects.toThrow(/authority/i)
    }
    expect(refusing).not.toHaveBeenCalled()
  })

  it('keeps the HTTP response minimized and fails closed', async () => {
    const execute = vi.fn(async () => ({
      schemaVersion: 1,
      status: 'ok',
      operation: 'dashboard:read',
      body: { assignments: [] },
    }))
    const handler = createStudyAcademicRuntimeHandler({
      gateway: { isReady: () => true, execute },
    })
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/study/academic-runtime',
      headers: {
        authorization: `Bearer ${reference}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ schemaVersion: 1, operation: 'dashboard:read', request: {} }),
    })
    expect(response.statusCode).toBe(200)
    expect(response.body).not.toMatch(/student|household|grant|token|credential/i)
    expect((await handler({ httpMethod: 'POST', path: '/api/study/academic-runtime', headers: {} })).statusCode).toBe(401)
  })
})
