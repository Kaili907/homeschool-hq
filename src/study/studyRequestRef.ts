/**
 * STUDY-A1-COMP Phase 9 — the identifier a Study turn presents to the Tutor
 * bridge.
 *
 * The bridge admits an opaque identifier of at most 128 characters
 * (`validOpaqueId` in
 * adaptive-tutor/study-engine/bridges/tutor-core/src/safety-gateway.ts), and it
 * refuses a longer one *before* the classifier runs. That refusal arrives shaped
 * as `stop-invalid-input`, which the host turns into a durable safety stop — so
 * an over-long identifier tells a girl who wrote nothing wrong to go get her dad,
 * and locks her session across refreshes.
 *
 * The reference this replaces was built from the block, the session and the
 * segment, so it grew with them and crossed the bound on ordinary host lesson
 * references. What follows is bounded by construction: a fixed prefix and one
 * opaque identifier, 47 characters in total whatever the block is called.
 */

/** The bridge's own bound. Asserted against the bridge regex in the tests. */
export const STUDY_BRIDGE_OPAQUE_ID_MAX_LENGTH = 128

/** Mirrors `validOpaqueId` in the Tutor bridge safety gateway. */
const STUDY_BRIDGE_OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

export function isStudyBridgeOpaqueId(value: string): boolean {
  return STUDY_BRIDGE_OPAQUE_ID.test(value)
}

const HEX = '0123456789abcdef'

/**
 * A v4-shaped identifier. `crypto.randomUUID` needs a secure context, which a
 * LAN http:// origin is not, so `getRandomValues` is the fallback and the last
 * resort is `Math.random`. Only uniqueness is being asked of this value — it is
 * never a secret, a capability, or a key — so a degraded source weakens nothing
 * that matters.
 */
function opaqueIdentifier(): string {
  const generated = globalThis.crypto?.randomUUID?.()
  if (generated) return generated
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => HEX[byte >> 4]! + HEX[byte & 0x0f]!).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * One reference per submitted turn.
 *
 * Deliberately not derived from the session, the segment or the clock:
 *  - it carries no learner text, no bearer and no Study-session reference,
 *    because there is nowhere in it for one to go;
 *  - it needs no persistent storage;
 *  - it cannot collide inside a millisecond, which the `Date.now()` suffix it
 *    replaces could;
 *  - and the session and segment it used to name already travel to the bridge
 *    as `sessionId` and `segmentId`, so nothing downstream loses them.
 *
 * The bridge treats it as the accepted event's identity, and the host event
 * ledger keys idempotency on that — one reference per turn is exactly the
 * existing semantics, since the previous form re-minted on every submit too.
 */
export function createStudyTurnRequestRef(): string {
  return `study-turn:${opaqueIdentifier()}`
}
