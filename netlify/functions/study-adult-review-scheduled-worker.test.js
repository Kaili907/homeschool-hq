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
    const compose = vi.fn(async () => ({
      worker,
      scheduledWorkerCredentialSource: credentialSource,
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
