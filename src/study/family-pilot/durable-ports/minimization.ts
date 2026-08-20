// FAMILY-PILOT-DURABLE-PORTS: what may and may not reach device storage.
//
// These guards are a deliberate local copy of the minimization rules the
// accepted local-development ports apply in memory. They are NOT imported from
// there: this module must be importable in a production browser bundle, and the
// local-development provider must never be reachable from it. The rules
// themselves are copied verbatim rather than rewritten, so a record this store
// accepts is exactly a record the accepted provider would accept.
//
// The difference in consequence is what matters. In memory, a sensitive field
// that slips through is lost when the tab closes. Here it would be written to
// the family's device and survive every later reload, so every guard runs on
// the whole document immediately before the write, not only on the record being
// added.

import type { StudySafeEvent } from '../../types'

/**
 * Key names that may never carry a value into storage. `false` and `null` pass,
 * which is what keeps the literal `rawAnswerIncluded: false` /
 * `transcriptIncluded: false` minimization markers writable.
 */
const FORBIDDEN_PERSISTED_KEY =
  /^(?:rawanswer|rawresponse|transientlearnertext|transcript|transcripttext|captionshistory|adultprivatenotebody|providerapikey|accesstoken|answertext|responsetext|refreshtoken|bearertoken|servicerolekey|sessiongrant|launchgrant|studysessiongrant)$/i

/** Free text that reads as a credential or a verbatim record, wherever text is allowed at all. */
export const SENSITIVE_PERSISTED_TEXT =
  /\b(?:raw[-_ ]?answer|transcript|bearer\s+[a-z0-9._~-]+|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|service[-_ ]?role)\b/i

/** The shape every durable reference must have; never learner or tutor prose. */
export const OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

/** Exactly the accepted event allowlist. An unlisted key is a rejected write, not a stripped one. */
export const EVENT_ALLOWED_KEYS: Readonly<Record<StudySafeEvent['type'], readonly string[]>> = Object.freeze({
  'session-launched': ['lessonRef', 'segmentRef'],
  'tutor-directive': ['bridgeEventVersion', 'eventLedgerIdempotencyKey'],
  'checkpoint-saved': ['checkpointRef', 'revision'],
  'session-completed': ['blockRef', 'lessonRef'],
  'safety-stop': ['reasonCode', 'deliveryStatus'],
  'parent-control': ['controlType', 'result'],
})

/**
 * Walks any value and refuses a forbidden key that carries content. Throws
 * rather than stripping: a caller that believed it saved learner work must not
 * be told the write succeeded against a quietly emptied record.
 */
export function assertMinimizedForStorage(value: unknown, path = 'document'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertMinimizedForStorage(entry, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
      if (FORBIDDEN_PERSISTED_KEY.test(normalizedKey) && entry !== false && entry !== null) {
        throw new Error(`Sensitive Study field rejected before durable write at ${path}.${key}.`)
      }
      assertMinimizedForStorage(entry, `${path}.${key}`)
    }
  }
}

/** Event payloads are the one place a caller may hand us arbitrary strings. */
export function assertMinimizedEvent(event: StudySafeEvent): void {
  const allowed = EVENT_ALLOWED_KEYS[event.type]
  if (!allowed) throw new Error('Unknown Study event type rejected.')
  const unexpected = Object.keys(event.payload).filter((key) => !allowed.includes(key))
  if (unexpected.length > 0) throw new Error('Study event payload contains a non-allowlisted field.')
  if (Object.values(event.payload).some((value) => typeof value === 'string' && SENSITIVE_PERSISTED_TEXT.test(value))) {
    throw new Error('Study event payload text failed privacy minimization.')
  }
}
