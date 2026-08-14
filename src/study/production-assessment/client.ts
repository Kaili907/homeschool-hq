import type { ProductionItemAssessmentRequest } from './contracts'
import {
  ProductionAssessmentOfflineError,
  type ProductionItemAssessmentTransport,
} from './offline'

export class ProductionAssessmentServerError extends Error {
  readonly status: number

  constructor(status: number) {
    super('production_assessment_server_rejected')
    this.name = 'ProductionAssessmentServerError'
    this.status = status
  }
}

export class ProductionAssessmentTimeoutError extends ProductionAssessmentOfflineError {
  constructor() {
    super()
    this.name = 'ProductionAssessmentTimeoutError'
  }
}

export interface ProductionItemFetchTransportOptions {
  readonly timeoutMs?: number
}

/**
 * Browser transport sends only the opaque Study bearer, stable IDs, and the
 * learner response. The bearer supplier is expected to read an in-memory grant.
 */
export function createProductionItemFetchTransport(
  fetchImpl: typeof fetch,
  sessionReference: () => string,
  endpoint = '/.netlify/functions/production-item-assessment',
  options: ProductionItemFetchTransportOptions = {},
): ProductionItemAssessmentTransport {
  return Object.freeze({
    async assess(request: ProductionItemAssessmentRequest): Promise<unknown> {
      let response: Response
      const controller = new AbortController()
      const timeoutMs = Number.isSafeInteger(options.timeoutMs) && Number(options.timeoutMs) > 0
        ? Number(options.timeoutMs)
        : 8_000
      let timedOut = false
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        const requestPromise = fetchImpl(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${sessionReference()}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ schemaVersion: 1, operation: 'assess', request }),
        })
        response = await Promise.race([
          requestPromise,
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => {
              timedOut = true
              controller.abort()
              reject(new ProductionAssessmentTimeoutError())
            }, timeoutMs)
          }),
        ])
      } catch (error) {
        if (timedOut || error instanceof ProductionAssessmentTimeoutError) {
          throw new ProductionAssessmentTimeoutError()
        }
        if (error instanceof TypeError) throw new ProductionAssessmentOfflineError()
        throw error
      } finally {
        if (timeout !== undefined) clearTimeout(timeout)
      }
      if (!response.ok) throw new ProductionAssessmentServerError(response.status)
      return response.json()
    },
  })
}
