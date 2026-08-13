import { describe, expect, it, vi } from 'vitest'
import { emptyDurableStudyDocument, type DurableStudyDocumentV1 } from '../../family-pilot/durable-ports/schema'
import { assertStudySyncPayloadPrivate } from './privacy'
import { createStudySyncTransport } from './transport'
import type {
  StudySyncAuthorization,
  StudySyncIdentity,
  StudySyncPushInput,
} from './types'

const identity: StudySyncIdentity = Object.freeze({
  householdRef: 'household:hosted-a',
  studentRef: 'student:ada',
  documentRef: 'study:primary',
})

const document = emptyDurableStudyDocument({
  householdRef: identity.householdRef,
  learnerRef: identity.studentRef,
}, '2026-08-13T12:00:00.000Z')

const pushInput: StudySyncPushInput = Object.freeze({
  identity,
  operationId: 'sync-operation:stable-a',
  baseRevision: 3,
  document,
})

function authorization(value = 'Bearer ephemeral.test.credential'): StudySyncAuthorization {
  return {
    authorizeStudyRequestHeaders: (headers) => ({ ...headers, Authorization: value }),
  }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function pushResponse(duplicate = false) {
  return {
    protocolVersion: 1,
    status: 'SUCCESS',
    operation: 'PUSH',
    identity,
    operationId: pushInput.operationId,
    serverRevision: 4,
    acceptedAt: '2026-08-13T12:01:00.000Z',
    duplicate,
  }
}

function transportFor(fetchImpl: typeof fetch, overrides: Partial<Parameters<typeof createStudySyncTransport>[0]> = {}) {
  return createStudySyncTransport({
    resolveEndpoint: (operation) => `/api/study/sync/${operation.toLowerCase()}`,
    authorization: authorization(),
    fetchImpl,
    isOnline: () => true,
    ...overrides,
  })
}

describe('hosted Study sync transport — success contracts', () => {
  it('hydrates exact household/student/document revision state', async () => {
    const fetchImpl = vi.fn(async () => json({
      protocolVersion: 1,
      status: 'SUCCESS',
      operation: 'HYDRATE',
      householdRef: identity.householdRef,
      students: [{
        studentRef: identity.studentRef,
        documents: [{
          documentRef: identity.documentRef,
          serverRevision: 4,
          acknowledgedRevision: 3,
          hasRemoteDocument: true,
        }],
      }],
    })) as unknown as typeof fetch
    const result = await transportFor(fetchImpl).hydrate({
      householdRef: identity.householdRef,
      students: [{ studentRef: identity.studentRef, documentRefs: [identity.documentRef] }],
    })

    expect(result).toEqual({
      code: 'SUCCESS',
      value: {
        householdRef: identity.householdRef,
        students: [{
          studentRef: identity.studentRef,
          documents: [{
            documentRef: identity.documentRef,
            serverRevision: 4,
            acknowledgedRevision: 3,
            hasRemoteDocument: true,
          }],
        }],
      },
    })
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!
    expect(url).toBe('/api/study/sync/hydrate')
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error' })
    expect(JSON.parse(String(init?.body))).toEqual({
      protocolVersion: 1,
      operation: 'HYDRATE',
      householdRef: identity.householdRef,
      students: [{ studentRef: identity.studentRef, documentRefs: [identity.documentRef] }],
    })
  })

  it('pulls only a canonically minimized document bound to the requested identity', async () => {
    const fetchImpl = vi.fn(async () => json({
      protocolVersion: 1,
      status: 'SUCCESS',
      operation: 'PULL',
      identity,
      serverRevision: 4,
      document,
    })) as unknown as typeof fetch
    const result = await transportFor(fetchImpl).pull({ identity, afterRevision: 3 })
    expect(result.code).toBe('SUCCESS')
    if (result.code === 'SUCCESS') {
      expect(result.value.document).toEqual(document)
      expect(Object.isFrozen(result.value.document)).toBe(true)
    }
  })

  it('pushes a conditional minimized write and returns the accepted server revision', async () => {
    const fetchImpl = vi.fn(async () => json(pushResponse())) as unknown as typeof fetch
    const result = await transportFor(fetchImpl).push(pushInput)
    expect(result).toEqual({
      code: 'SUCCESS',
      value: {
        identity,
        operationId: pushInput.operationId,
        serverRevision: 4,
        acceptedAt: '2026-08-13T12:01:00.000Z',
        duplicate: false,
      },
    })
    const body = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]![1]?.body))
    expect(body).toMatchObject({
      protocolVersion: 1,
      operation: 'PUSH',
      operationId: pushInput.operationId,
      baseRevision: 3,
      mutation: 'REPLACE_MINIMIZED_STUDY_DOCUMENT',
    })
    expect(body.document).toEqual(document)
  })

  it('acknowledges an exact server revision with its own stable identity', async () => {
    const fetchImpl = vi.fn(async () => json({
      protocolVersion: 1,
      status: 'SUCCESS',
      operation: 'ACKNOWLEDGE',
      identity,
      acknowledgementId: 'sync-ack:stable-a',
      serverRevision: 4,
      acknowledgedAt: '2026-08-13T12:02:00.000Z',
      duplicate: false,
    })) as unknown as typeof fetch
    await expect(transportFor(fetchImpl).acknowledge({
      identity,
      acknowledgementId: 'sync-ack:stable-a',
      serverRevision: 4,
    })).resolves.toMatchObject({ code: 'SUCCESS', value: { serverRevision: 4 } })
  })

  it('applies authorization ephemerally and keeps it outside the body and transport surface', async () => {
    const credential = 'Bearer ephemeral-only-canary'
    const fetchImpl = vi.fn(async () => json(pushResponse())) as unknown as typeof fetch
    const transport = transportFor(fetchImpl, { authorization: authorization(credential) })
    await transport.push(pushInput)
    const [, init] = vi.mocked(fetchImpl).mock.calls[0]!
    expect(init?.headers).toMatchObject({ authorization: credential })
    expect(String(init?.body)).not.toContain(credential)
    expect(JSON.stringify(transport)).toBe('{}')
    expect(JSON.stringify(transport)).not.toContain(credential)
  })

  it('makes duplicate retry safe by sending the same operation ID unchanged', async () => {
    const responses = [json(pushResponse(false)), json(pushResponse(true))]
    const fetchImpl = vi.fn(async () => responses.shift()!) as unknown as typeof fetch
    const transport = transportFor(fetchImpl)
    expect(await transport.push(pushInput)).toMatchObject({ code: 'SUCCESS', value: { duplicate: false } })
    expect(await transport.push(pushInput)).toMatchObject({ code: 'SUCCESS', value: { duplicate: true } })
    const operationIds = vi.mocked(fetchImpl).mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)).operationId)
    expect(operationIds).toEqual([pushInput.operationId, pushInput.operationId])
  })

  it('accepts only injected root-relative or credential-free HTTPS endpoints', async () => {
    const fetchImpl = vi.fn(async () => json(pushResponse())) as unknown as typeof fetch
    expect(await transportFor(fetchImpl, {
      resolveEndpoint: () => 'https://sync.example.test/study/push',
    }).push(pushInput)).toMatchObject({ code: 'SUCCESS' })
    for (const endpoint of [
      'http://sync.example.test/study/push',
      'https://user:secret@sync.example.test/study/push',
      '/api/study/sync?student=ada',
      '//sync.example.test/study/push',
    ]) {
      const before = vi.mocked(fetchImpl).mock.calls.length
      expect(await transportFor(fetchImpl, { resolveEndpoint: () => endpoint }).push(pushInput))
        .toMatchObject({ code: 'PERMANENT_REFUSAL' })
      expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(before)
    }
  })
})

describe('hosted Study sync transport — failure taxonomy', () => {
  it('fails closed without authorization and makes no request', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const result = await transportFor(fetchImpl, {
      authorization: { authorizeStudyRequestHeaders: () => null },
    }).push(pushInput)
    expect(result).toEqual({
      code: 'AUTHORIZATION_REQUIRED', retry: 'REAUTHORIZE', httpStatus: null, retryAfterMs: null,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports offline before request and network failure from fetch distinctly', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    expect(await transportFor(fetchImpl, { isOnline: () => false }).push(pushInput)).toMatchObject({ code: 'OFFLINE' })
    expect(fetchImpl).not.toHaveBeenCalled()

    const failedFetch = vi.fn(async () => { throw new TypeError('network unavailable') }) as unknown as typeof fetch
    expect(await transportFor(failedFetch).push(pushInput)).toMatchObject({
      code: 'NETWORK_UNAVAILABLE', retry: 'RETRY_WITH_BACKOFF',
    })
  })

  it('classifies timeout and actively aborts the request', async () => {
    let observedSignal: AbortSignal | undefined
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      observedSignal = init?.signal ?? undefined
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    })) as unknown as typeof fetch
    const result = await transportFor(fetchImpl, { timeoutMs: 5 }).push(pushInput)
    expect(result).toMatchObject({ code: 'TIMEOUT', retry: 'RETRY_WITH_BACKOFF' })
    expect(observedSignal?.aborted).toBe(true)
  })

  it('bounds a stalled asynchronous authorization seam without making a request', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const result = await transportFor(fetchImpl, {
      timeoutMs: 5,
      authorization: {
        authorizeStudyRequestHeaders: () => new Promise(() => {}),
      },
    }).push(pushInput)
    expect(result).toMatchObject({ code: 'TIMEOUT', retry: 'RETRY_WITH_BACKOFF' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('classifies rate limits and bounded Retry-After metadata', async () => {
    const fetchImpl = vi.fn(async () => json({}, 429, { 'retry-after': '3' })) as unknown as typeof fetch
    expect(await transportFor(fetchImpl).push(pushInput)).toEqual({
      code: 'RATE_LIMITED', retry: 'RETRY_AFTER_DELAY', httpStatus: 429, retryAfterMs: 3000,
    })
  })

  it.each([
    [401, 'SESSION_EXPIRED', 'REAUTHORIZE'],
    [403, 'PERMANENT_REFUSAL', 'DO_NOT_RETRY'],
    [409, 'STALE_REVISION', 'REBASE_REQUIRED'],
    [412, 'STALE_REVISION', 'REBASE_REQUIRED'],
    [500, 'SERVER_UNAVAILABLE', 'RETRY_WITH_BACKOFF'],
    [503, 'SERVER_UNAVAILABLE', 'RETRY_WITH_BACKOFF'],
  ] as const)('maps HTTP %i to %s', async (status, code, retry) => {
    const fetchImpl = vi.fn(async () => json({}, status)) as unknown as typeof fetch
    expect(await transportFor(fetchImpl).push(pushInput)).toEqual({
      code, retry, httpStatus: status, retryAfterMs: null,
    })
  })

  it('rejects malformed JSON, non-JSON success, and cross-student success bodies', async () => {
    const responses = [
      new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }),
      new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
      json({ ...pushResponse(), identity: { ...identity, studentRef: 'student:other' } }),
    ]
    const fetchImpl = vi.fn(async () => responses.shift()!) as unknown as typeof fetch
    const transport = transportFor(fetchImpl)
    expect(await transport.push(pushInput)).toMatchObject({ code: 'MALFORMED_RESPONSE' })
    expect(await transport.push(pushInput)).toMatchObject({ code: 'MALFORMED_RESPONSE' })
    expect(await transport.push(pushInput)).toMatchObject({ code: 'MALFORMED_RESPONSE' })
  })

  it('honors caller abort without converting it to a network or safety failure', async () => {
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    })) as unknown as typeof fetch
    const controller = new AbortController()
    const pending = transportFor(fetchImpl).push(pushInput, controller.signal)
    controller.abort()
    await expect(pending).resolves.toEqual({
      code: 'ABORTED', retry: 'ABORTED', httpStatus: null, retryAfterMs: null,
    })
  })
})

describe('hosted Study sync transport — privacy boundary', () => {
  it.each([
    ['raw Tutor transcript', { rawTutorTranscript: 'verbatim tutor content' }],
    ['audio', { audio: 'base64-audio' }],
    ['emotional label', { emotionalLabels: ['distressed'] }],
    ['personality inference', { personalityInference: 'introverted' }],
    ['diagnostic inference', { diagnosticInference: 'condition' }],
    ['browser credential', { browserCredential: 'secret' }],
    ['PIN', { pin: '1234' }],
    ['adult private note', { adultPrivateNoteBody: 'private' }],
  ])('refuses the %s privacy canary', (_label, canary) => {
    expect(() => assertStudySyncPayloadPrivate({ document, ...canary })).toThrow(/privacy refusal/)
  })

  it('permits only the canonical false minimization markers', () => {
    expect(() => assertStudySyncPayloadPrivate({ rawAnswerIncluded: false, transcriptIncluded: false })).not.toThrow()
    expect(() => assertStudySyncPayloadPrivate({ rawAnswerIncluded: true })).toThrow(/privacy refusal/)
    expect(() => assertStudySyncPayloadPrivate({ transcriptIncluded: 'raw transcript' })).toThrow(/privacy refusal/)
  })

  it('refuses a sensitive document before fetch', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const unsafe = { ...document, browserCredential: 'secret' } as DurableStudyDocumentV1
    expect(await transportFor(fetchImpl).push({ ...pushInput, document: unsafe })).toMatchObject({
      code: 'PERMANENT_REFUSAL', retry: 'DO_NOT_RETRY',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('never touches browser credential persistence APIs', async () => {
    const credential = 'Bearer no-persistence-canary'
    const setItem = vi.fn()
    const getItem = vi.fn()
    const open = vi.fn()
    vi.stubGlobal('localStorage', { setItem, getItem })
    vi.stubGlobal('sessionStorage', { setItem, getItem })
    vi.stubGlobal('indexedDB', { open })
    try {
      const fetchImpl = vi.fn(async () => json(pushResponse())) as unknown as typeof fetch
      await transportFor(fetchImpl, { authorization: authorization(credential) }).push(pushInput)
      expect(setItem).not.toHaveBeenCalled()
      expect(getItem).not.toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
      expect(String(vi.mocked(fetchImpl).mock.calls[0]![1]?.body)).not.toContain(credential)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
