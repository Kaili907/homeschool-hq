import { readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  STUDY_ADULT_REVIEW_SCHEDULE,
  STUDY_ADULT_REVIEW_SCHEDULED_BATCH_LIMIT,
  createStudyAdultReviewScheduledWorkerHandler,
} from './study-adult-review-scheduled-worker.js'

const WORKER_CREDENTIAL = 'opaque-adult-review-worker-credential-000001'
const ENV = Object.freeze({ ACADEMY_STUDY_ENABLED: 'true' })

function parseFunctionConfiguration(source) {
  const configurations = {}
  let current
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim()
    const section = /^\[functions\."([^"]+)"\]$/u.exec(line)
    if (section) {
      current = section[1]
      configurations[current] = {}
      continue
    }
    if (line.startsWith('[')) {
      current = undefined
      continue
    }
    const setting = /^(\w+)\s*=\s*"([^"]*)"$/u.exec(line)
    if (current && setting) configurations[current][setting[1]] = setting[2]
  }
  return configurations
}

function readyWorker(result) {
  return {
    ready: vi.fn(async () => ({ ready: true })),
    run: vi.fn(async () => result),
  }
}

function readyCredentialSource(overrides = {}) {
  return {
    isDurable: true,
    isReady: () => true,
    authorityBoundary: 'netlify-scheduled-function',
    credentialForRun: vi.fn(async () => WORKER_CREDENTIAL),
    ...overrides,
  }
}

function body(response) {
  return JSON.parse(response.body)
}

describe('Study private scheduled worker configuration', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const netlifyToml = readFileSync(resolvePath(here, '../../netlify.toml'), 'utf8')
  const configurations = parseFunctionConfiguration(netlifyToml)

  it('declares the dedicated entrypoint at the exact frozen cadence', () => {
    expect(configurations['study-adult-review-scheduled-worker']).toEqual({
      schedule: '*/5 * * * *',
    })
    expect(STUDY_ADULT_REVIEW_SCHEDULE).toEqual({
      scheduled: 'configured',
      cadence: '*/5 * * * *',
    })
  })

  it('does not schedule or redirect to the public manual worker', () => {
    expect(configurations['study-adult-review-worker']).toBeUndefined()
    expect(netlifyToml).toContain('to = "/.netlify/functions/study-adult-review-worker"')
    expect(netlifyToml).not.toContain(
      'to = "/.netlify/functions/study-adult-review-scheduled-worker"',
    )
  })
})

describe('Study private scheduled worker execution', () => {
  it('uses the production composition seam for one bounded scheduled cycle', async () => {
    const worker = readyWorker({ claimed: 1, delivered: 1, indeterminate: 0, failed: 0 })
    const credentialSource = readyCredentialSource()
    const runEvidence = {
      isDurable: true,
      isReady: () => true,
      record: vi.fn(async () => ({ recorded: true, replayed: false })),
    }
    const compose = vi.fn(async () => ({
      worker,
      scheduledWorkerCredentialSource: credentialSource,
      runEvidence,
    }))
    const handler = createStudyAdultReviewScheduledWorkerHandler({ env: ENV, compose })

    const response = await handler({
      headers: {
        'x-nf-event': 'schedule',
        'x-academy-study-worker-invocation': 'browser-forged-value-that-is-long-enough-0001',
      },
      body: JSON.stringify({ learnerId: 'caller-controlled' }),
    })

    expect(response.statusCode).toBe(200)
    expect(body(response)).toEqual({
      status: 'processed', claimed: 1, delivered: 1, indeterminate: 0, failed: 0,
    })
    expect(compose).toHaveBeenCalledOnce()
    expect(compose).toHaveBeenCalledWith({ env: ENV })
    expect(credentialSource.credentialForRun).toHaveBeenCalledWith()
    expect(worker.run).toHaveBeenCalledOnce()
    expect(worker.run).toHaveBeenCalledWith({
      trigger: 'scheduled',
      workerCredential: WORKER_CREDENTIAL,
      limit: STUDY_ADULT_REVIEW_SCHEDULED_BATCH_LIMIT,
    }, { limit: STUDY_ADULT_REVIEW_SCHEDULED_BATCH_LIMIT })
    expect(runEvidence.record).toHaveBeenCalledOnce()
  })

  it('does not let forged browser headers replace missing scheduled authority', async () => {
    const worker = readyWorker({ claimed: 1, delivered: 1, indeterminate: 0, failed: 0 })
    const handler = createStudyAdultReviewScheduledWorkerHandler({
      env: ENV,
      worker,
      scheduledWorkerCredentialSource: readyCredentialSource({
        isReady: () => false,
      }),
    })

    const response = await handler({
      headers: {
        'x-nf-event': 'schedule',
        'x-academy-study-worker-invocation': WORKER_CREDENTIAL,
        authorization: `Bearer ${WORKER_CREDENTIAL}`,
      },
    })
    expect(response.statusCode).toBe(503)
    expect(body(response)).toEqual({
      status: 'unavailable', claimed: 0, delivered: 0, indeterminate: 0, failed: 0,
    })
    expect(worker.run).not.toHaveBeenCalled()
  })

  it.each([
    ['no_work', { claimed: 0, delivered: 0, indeterminate: 0, failed: 0 }, 200],
    ['processed', { claimed: 3, delivered: 2, indeterminate: 1, failed: 0 }, 200],
    ['partial_with_retryable_failures',
      { claimed: 3, delivered: 1, indeterminate: 0, failed: 1 }, 503],
    ['failed', { claimed: 2, delivered: 0, indeterminate: 0, failed: 2 }, 503],
  ])('returns a bounded %s result', async (status, result, statusCode) => {
    const handler = createStudyAdultReviewScheduledWorkerHandler({
      env: ENV,
      worker: readyWorker(result),
      scheduledWorkerCredentialSource: readyCredentialSource(),
    })
    const response = await handler()
    expect(response.statusCode).toBe(statusCode)
    expect(body(response)).toEqual({ status, ...result })
  })

  it('persists one content-free receipt for a scheduled invocation', async () => {
    const runEvidence = {
      isDurable: true,
      isReady: () => true,
      record: vi.fn(async () => ({ recorded: true, replayed: false })),
    }
    const handler = createStudyAdultReviewScheduledWorkerHandler({
      env: ENV,
      worker: readyWorker({
        claimed: 3, delivered: 1, indeterminate: 0, cancelled: 1, failed: 1,
      }),
      scheduledWorkerCredentialSource: readyCredentialSource(),
      runEvidence,
      createRunId: () => '00000000-0000-4000-8000-000000000102',
      now: vi.fn()
        .mockReturnValueOnce(new Date('2026-08-10T12:05:00.000Z'))
        .mockReturnValueOnce(new Date('2026-08-10T12:05:02.000Z')),
    })
    expect(body(await handler()).status).toBe('partial_with_retryable_failures')
    expect(runEvidence.record).toHaveBeenCalledWith({
      runId: '00000000-0000-4000-8000-000000000102',
      startedAt: '2026-08-10T12:05:00.000Z',
      completedAt: '2026-08-10T12:05:02.000Z',
      resultCategory: 'partial_with_retryable_failures',
      claimedCount: 3,
      processedCount: 1,
      retryableFailureCount: 1,
      terminalFailureCount: 1,
      invocationKind: 'scheduled',
      reasonCode: 'retryable-failures',
    })
    expect(JSON.stringify(runEvidence.record.mock.calls)).not.toMatch(
      /student|learner|payload|content|provider|transcript|note|secret/i,
    )
  })

  it('records a bounded unavailable result and fails closed if evidence cannot persist', async () => {
    const runEvidence = {
      isDurable: true,
      isReady: () => true,
      record: vi.fn(async () => ({ recorded: true, replayed: false })),
    }
    const worker = readyWorker()
    worker.run.mockRejectedValueOnce(new Error('durable_port_unavailable'))
    const handler = createStudyAdultReviewScheduledWorkerHandler({
      env: ENV,
      worker,
      scheduledWorkerCredentialSource: readyCredentialSource(),
      runEvidence,
      createRunId: () => '00000000-0000-4000-8000-000000000103',
      now: () => new Date('2026-08-10T12:10:00.000Z'),
    })
    expect(body(await handler()).status).toBe('unavailable')
    expect(runEvidence.record).toHaveBeenCalledWith(expect.objectContaining({
      resultCategory: 'unavailable',
      claimedCount: 0,
      processedCount: 0,
      retryableFailureCount: 0,
      terminalFailureCount: 0,
      reasonCode: 'dependency-unavailable',
    }))

    runEvidence.record.mockRejectedValueOnce(new Error('private database detail'))
    expect(body(await handler())).toEqual({
      status: 'unavailable', claimed: 0, delivered: 0, indeterminate: 0, failed: 0,
    })
  })

  it.each([
    ['durable_port_unavailable', 503, 'unavailable'],
    ['raw database exception containing private learner work', 500, 'failed'],
  ])('returns a privacy-safe systemic result for %s', async (message, statusCode, status) => {
    const worker = readyWorker()
    worker.run.mockRejectedValueOnce(new Error(message))
    const handler = createStudyAdultReviewScheduledWorkerHandler({
      env: ENV,
      worker,
      scheduledWorkerCredentialSource: readyCredentialSource(),
    })
    const response = await handler()

    expect(response.statusCode).toBe(statusCode)
    expect(body(response)).toEqual({
      status, claimed: 0, delivered: 0, indeterminate: 0, failed: 0,
    })
    expect(response.body).not.toContain(message)
    expect(response.body).not.toContain(WORKER_CREDENTIAL)
  })

  it('fails closed without the Study gate or production dependencies', async () => {
    const compose = vi.fn(async () => { throw new Error('private dependency detail') })
    const disabled = createStudyAdultReviewScheduledWorkerHandler({ env: {}, compose })
    expect(body(await disabled()).status).toBe('unavailable')
    expect(compose).not.toHaveBeenCalled()

    const enabled = createStudyAdultReviewScheduledWorkerHandler({ env: ENV, compose })
    const response = await enabled()
    expect(response.statusCode).toBe(503)
    expect(body(response)).toEqual({
      status: 'unavailable', claimed: 0, delivered: 0, indeterminate: 0, failed: 0,
    })
    expect(response.body).not.toContain('private dependency detail')
  })
})
