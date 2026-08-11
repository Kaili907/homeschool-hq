import {
  parseStudyBoundContentResponse,
  type StudyBoundContentRequest,
  type StudyBoundContentResponse,
} from '../contracts/production/content'
import type { VerifiedStudyRuntimeAdapter } from '../production/verifiedRuntimeAdapter'

export class StudyBoundContentContractError extends Error {
  constructor() {
    super('The Study content service returned an unavailable response contract.')
    this.name = 'StudyBoundContentContractError'
  }
}

export interface StudyBoundContentClient {
  load(request: StudyBoundContentRequest, signal?: AbortSignal): Promise<StudyBoundContentResponse>
}

export interface StudyBoundContentClientOptions {
  readonly runtime: Pick<VerifiedStudyRuntimeAdapter, 'readBoundContent'>
  readonly createAttemptRef?: () => string
}

function defaultAttemptRef(): string {
  const value = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}:${Math.random().toString(36).slice(2)}`
  return `production-bound-content-attempt:${value}`
}

/** Strict browser DTO boundary for learner-safe, server-authorized content. */
export function createStudyBoundContentClient(
  options: StudyBoundContentClientOptions,
): StudyBoundContentClient {
  const attemptRef = options.createAttemptRef ?? defaultAttemptRef
  return Object.freeze({
    async load(request: StudyBoundContentRequest, signal?: AbortSignal) {
      const value = await options.runtime.readBoundContent({
        request: request as unknown as Readonly<Record<string, unknown>>,
        operationRef: attemptRef(),
        signal,
      })
      const parsed = parseStudyBoundContentResponse(value)
      if (!parsed) throw new StudyBoundContentContractError()
      return parsed
    },
  })
}
