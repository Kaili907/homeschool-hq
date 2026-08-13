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

/**
 * Browser transport sends only the opaque Study bearer, stable IDs, and the
 * learner response. The bearer supplier is expected to read an in-memory grant.
 */
export function createProductionItemFetchTransport(
  fetchImpl: typeof fetch,
  sessionReference: () => string,
  endpoint = '/.netlify/functions/production-item-assessment',
): ProductionItemAssessmentTransport {
  return Object.freeze({
    async assess(request: ProductionItemAssessmentRequest): Promise<unknown> {
      let response: Response
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${sessionReference()}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ schemaVersion: 1, operation: 'assess', request }),
        })
      } catch (error) {
        if (error instanceof TypeError) throw new ProductionAssessmentOfflineError()
        throw error
      }
      if (!response.ok) throw new ProductionAssessmentServerError(response.status)
      return response.json()
    },
  })
}
