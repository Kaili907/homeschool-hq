import {
  parseStudyProductionBeginResponse,
  parseStudyProductionCheckpointReadResponse,
  parseStudyProductionCheckpointResponse,
  parseStudyProductionResumeResponse,
  parseStudyProductionTransitionResponse,
  type StudyProductionBeginRequest,
  type StudyProductionBeginResponse,
  type StudyProductionCheckpointReadResponse,
  type StudyProductionCheckpointRequest,
  type StudyProductionCheckpointResponse,
  type StudyProductionResumeRequest,
  type StudyProductionResumeResponse,
  type StudyProductionTransitionRequest,
  type StudyProductionTransitionResponse,
} from '../contracts/production/session'
import type { VerifiedStudyRuntimeAdapter } from '../production/verifiedRuntimeAdapter'

export class StudyProductionSessionContractError extends Error {
  constructor() {
    super('The Study service returned an unavailable response contract.')
    this.name = 'StudyProductionSessionContractError'
  }
}

export interface StudyProductionSessionClient {
  begin(request: StudyProductionBeginRequest, signal?: AbortSignal): Promise<StudyProductionBeginResponse>
  resume(request: StudyProductionResumeRequest, signal?: AbortSignal): Promise<StudyProductionResumeResponse>
  transition(
    request: StudyProductionTransitionRequest,
    signal?: AbortSignal,
  ): Promise<StudyProductionTransitionResponse>
  readCheckpoint(
    request: StudyProductionResumeRequest,
    signal?: AbortSignal,
  ): Promise<StudyProductionCheckpointReadResponse>
  saveCheckpoint(
    request: StudyProductionCheckpointRequest,
    signal?: AbortSignal,
  ): Promise<StudyProductionCheckpointResponse>
}

export interface StudyProductionSessionClientOptions {
  readonly runtime: Pick<VerifiedStudyRuntimeAdapter, 'execute'>
  /** Local attempt identity only. Server mutation identities remain in requests. */
  readonly createAttemptRef?: (operation: string) => string
}

function defaultAttemptRef(operation: string): string {
  const value = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}:${Math.random().toString(36).slice(2)}`
  return `production-session-attempt:${operation}:${value}`
}

/**
 * Typed browser adapter for the already verified production runtime. Every
 * body is rebuilt by an exact V2 parser before a controller or UI can see it.
 */
export function createStudyProductionSessionClient(
  options: StudyProductionSessionClientOptions,
): StudyProductionSessionClient {
  const attemptRef = options.createAttemptRef ?? defaultAttemptRef

  async function execute<T>(input: {
    readonly operation:
      | 'session:begin'
      | 'session:resume'
      | 'session:transition'
      | 'checkpoint:read'
      | 'checkpoint:compare-and-swap'
    readonly request: object
    readonly parse: (value: unknown) => T | null
    readonly signal?: AbortSignal
  }): Promise<T> {
    const value = await options.runtime.execute({
      operation: input.operation,
      request: input.request as Readonly<Record<string, unknown>>,
      operationRef: attemptRef(input.operation),
      signal: input.signal,
    })
    const parsed = input.parse(value)
    if (!parsed) throw new StudyProductionSessionContractError()
    return parsed
  }

  const client: StudyProductionSessionClient = {
    begin(request: StudyProductionBeginRequest, signal?: AbortSignal) {
      return execute({
        operation: 'session:begin',
        request,
        parse: parseStudyProductionBeginResponse,
        signal,
      })
    },
    resume(request: StudyProductionResumeRequest, signal?: AbortSignal) {
      return execute({
        operation: 'session:resume',
        request,
        parse: parseStudyProductionResumeResponse,
        signal,
      })
    },
    transition(request: StudyProductionTransitionRequest, signal?: AbortSignal) {
      return execute({
        operation: 'session:transition',
        request,
        parse: parseStudyProductionTransitionResponse,
        signal,
      })
    },
    readCheckpoint(request: StudyProductionResumeRequest, signal?: AbortSignal) {
      return execute({
        operation: 'checkpoint:read',
        request,
        parse: parseStudyProductionCheckpointReadResponse,
        signal,
      })
    },
    saveCheckpoint(request: StudyProductionCheckpointRequest, signal?: AbortSignal) {
      return execute({
        operation: 'checkpoint:compare-and-swap',
        request,
        parse: parseStudyProductionCheckpointResponse,
        signal,
      })
    },
  }
  return Object.freeze(client)
}
