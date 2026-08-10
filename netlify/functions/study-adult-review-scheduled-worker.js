import { envFlagEnabled } from './_shared/http.js'
import { createProductionAdultReviewWorkerComposition } from './_shared/study-adult-review-operations/composition.js'
import {
  responseForRun,
  responseForSystemicError,
  resultResponse,
} from './_shared/study-adult-review-operations/entrypoint-result.js'

export const STUDY_ADULT_REVIEW_SCHEDULE = Object.freeze({
  scheduled: 'configured',
  cadence: '*/5 * * * *',
})

export const STUDY_ADULT_REVIEW_SCHEDULED_BATCH_LIMIT = 10

export function createStudyAdultReviewScheduledWorkerHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const injected = overrides.worker !== undefined
    || overrides.scheduledWorkerCredentialSource !== undefined
  const compose = overrides.compose ?? createProductionAdultReviewWorkerComposition
  let pending = null

  async function composition() {
    if (injected) {
      return {
        worker: overrides.worker,
        credentialSource: overrides.scheduledWorkerCredentialSource,
      }
    }
    if (!pending) pending = compose({ env }).catch(() => null)
    const composed = await pending
    if (!composed) {
      pending = null
      return {}
    }
    return {
      worker: composed.worker,
      credentialSource: composed.scheduledWorkerCredentialSource,
    }
  }

  const ready = (worker, credentialSource) => typeof worker?.ready === 'function'
    && typeof worker.run === 'function'
    && credentialSource?.isDurable === true
    && credentialSource?.isReady?.() === true
    && credentialSource?.authorityBoundary === 'netlify-scheduled-function'
    && typeof credentialSource.credentialForRun === 'function'

  // Deliberately accepts no request-derived authority. Netlify invokes this
  // handler only through the schedule declared in netlify.toml; it has no
  // production URL and is not a redirect target.
  return async () => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) {
      return resultResponse(503, 'unavailable')
    }
    const { worker, credentialSource } = await composition()
    if (!ready(worker, credentialSource)) return resultResponse(503, 'unavailable')

    try {
      const workerCredential = await credentialSource.credentialForRun()
      if (
        typeof workerCredential !== 'string'
        || workerCredential.length < 32
        || workerCredential.length > 512
      ) return resultResponse(503, 'unavailable')

      const limit = STUDY_ADULT_REVIEW_SCHEDULED_BATCH_LIMIT
      return responseForRun(await worker.run({
        trigger: 'scheduled',
        workerCredential,
        limit,
      }, { limit }), limit)
    } catch (error) {
      return responseForSystemicError(error)
    }
  }
}

export const handler = createStudyAdultReviewScheduledWorkerHandler()
