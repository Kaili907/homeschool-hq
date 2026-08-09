const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

/** The single source of truth for approved local authentication time bounds. */
export const SECURITY_SESSION_POLICY = Object.freeze({
  learner: Object.freeze({
    idleTimeoutMs: 30 * MINUTE_MS,
    absoluteTimeoutMs: 8 * HOUR_MS,
  }),
  parent: Object.freeze({
    storage: 'memory-only' as const,
    idleTimeoutMs: 15 * MINUTE_MS,
    absoluteTimeoutMs: HOUR_MS,
  }),
  parentStepUp: Object.freeze({
    storage: 'memory-only' as const,
    maximumLifetimeMs: 2 * MINUTE_MS,
    operationUseLimit: 1 as const,
  }),
})
