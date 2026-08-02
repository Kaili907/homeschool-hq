export type StudyPersistenceErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid-input'
  | 'revision-conflict'
  | 'idempotency-collision'
  | 'integrity-failed'
  | 'temporarily-unavailable'
  | 'cancelled'
  | 'database-contract'

export class StudyPersistenceError extends Error {
  constructor(
    readonly code: StudyPersistenceErrorCode,
    readonly retryable: boolean,
  ) {
    super(`Study persistence operation failed: ${code}`)
    this.name = 'StudyPersistenceError'
  }
}
