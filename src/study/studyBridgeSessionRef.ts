/**
 * STUDY-A1-SESSIONREF-C — the session identifier a Study turn presents to the
 * Tutor bridge.
 *
 * The Study session container derives `${blockRef}:session`, and the calendar
 * adapter builds a block reference as
 *   block:<learnerRef ≤32>:<YYYY-MM-DD>:<lessonRef ≤80>
 * so an Academy-length lesson reference yields a 133-character session
 * reference. The bridge's pre-core safety gateway admits an opaque identifier
 * of at most 128 characters (`validOpaqueId` in
 * adaptive-tutor/study-engine/bridges/tutor-core/src/safety-gateway.ts) and
 * refuses a longer one *before* the classifier runs, shaped as
 * `stop-invalid-input` — which the host records in the durable A6-5-C ledger as
 * a learner safety stop. A girl who typed "ready" is then locked out across
 * refreshes and her dad is shown a safety incident that never happened.
 *
 * The bridge's `sessionId` is a transport correlation identifier, not a durable
 * key. Everything durable — the A6-5-C stop ledger, the checkpoint, session
 * persistence and the event scope — is keyed on `scope.sessionRef` inside the
 * host and never on what the bridge echoes back. The bridge itself only
 * validates it, matches it against its own single-call permit, quotes it in a
 * proposed adult-review hook, and returns it in the minimized projection. So
 * the durable Study session reference is left exactly as it is, and only the
 * value handed to the bridge is bounded.
 *
 * Stability across remounts is preserved because this is a pure function of the
 * session reference: the same Study session yields the same bridge identifier
 * on every mount, in every tab, forever.
 */
import { isStudyBridgeOpaqueId } from './studyRequestRef'

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK64 = 0xffffffffffffffffn

/**
 * FNV-1a over the reference's code units, finished with the splitmix64 mixer.
 *
 * Deliberately not a slice of the reference: a prefix or suffix of an
 * over-long block reference would collide across every session that shares a
 * learner and a date, and it would carry a fragment of the reference — and so
 * of the learner — into the value the bridge sees. Every code unit feeds the
 * digest, and nothing but the digest leaves.
 *
 * The finalizer matters: FNV-1a alone avalanches poorly, and two session
 * references differing in one character must not land near each other.
 *
 * 64 bits is sized for accidental collision, which is all that is being asked
 * of it. It is not a secret, not a capability and not a key, and nothing
 * durable is keyed on it, so a collision would merge two sessions' bridge
 * correlation and nothing else.
 */
function digest(value: string): string {
  let hash = FNV_OFFSET_BASIS
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash ^ BigInt(value.charCodeAt(index))) * FNV_PRIME) & MASK64
  }
  hash = ((hash ^ (hash >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64
  hash = ((hash ^ (hash >> 27n)) * 0x94d049bb133111ebn) & MASK64
  hash = (hash ^ (hash >> 31n)) & MASK64
  return hash.toString(16).padStart(16, '0')
}

/**
 * Total, deterministic, and always admissible: whatever the durable session
 * reference is, the result matches the bridge's opaque-id syntax and is at most
 * 128 characters.
 *
 * A reference the bridge already admits is returned unchanged, so every session
 * that works today keeps the exact identity it has today at the bridge. Only a
 * reference the bridge would refuse is replaced, and it is replaced by a short
 * fixed form — at most 41 characters — built from a prefix, the digest, and the
 * reference's length as a second discriminator.
 */
export function studyBridgeSessionRef(sessionRef: string): string {
  if (isStudyBridgeOpaqueId(sessionRef)) return sessionRef
  return `study-session:${digest(sessionRef)}:${sessionRef.length}`
}
