/**
 * STUDY-A1-PROD-TUTOR-WRAPPER — the only learner identifier a production Tutor
 * is given.
 *
 * The frozen preview bridge sends one hard-coded sentinel string for every
 * child on every turn (`runSafeTutorBridge` in
 * adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts; the literal is
 * deliberately not repeated here, because ./productionImportBoundary.test.ts
 * scans this directory's production text for it). That is a release
 * candidate's sentinel, not an identity, and it is exactly why the preview path
 * may not be promoted: in production it would make every learner the same
 * learner to Tutor Core, and any per-learner state the Core or a later hosted
 * Tutor accumulated would be shared across every child in every household.
 *
 * The opposite mistake is the one worth being careful about. The obvious repair
 * is to send the learner's real identifier — the profile id, the student record
 * id, the household id — and that hands an out-of-process instructional service
 * a durable, cross-session, cross-household handle on a named ten-year-old.
 * `StudyTutorLaunch` deliberately carries none of those (see ../contracts/tutor/
 * runtime.ts), so this module must not reintroduce one by the back door.
 *
 * What is sent instead is a per-session pseudonym: a digest of the Study Tutor
 * session reference under a fixed namespace. It correlates the turns of ONE
 * session, which is all Tutor Core needs to teach a lesson, and it correlates
 * nothing else. A new Study session is a new pseudonym even for the same child,
 * so nothing accumulates across sessions and there is no identifier a Tutor
 * could use to recognise her tomorrow.
 *
 * SHA-256, not FNV. src/study/studyBridgeSessionRef.ts uses a 64-bit FNV-1a
 * digest and is right to: it is a transport correlation value chosen for
 * collision resistance and nothing else, and the reference it digests is a
 * host-local block reference. This value is different in kind — it stands in
 * FOR a learner — so the property that matters is that the session reference
 * cannot be recovered or confirmed from it. A 64-bit non-cryptographic digest
 * with a published algorithm is guessable by enumeration; SHA-256 is not.
 *
 * It is deliberately NOT an HMAC. An HMAC would need a secret, a secret needs
 * somewhere to live, and this runs in a browser: a key shipped to the client is
 * not a secret, and pretending otherwise would be a worse claim than the one
 * made here. What is claimed is only this — the pseudonym does not carry the
 * session reference, and it does not survive the session.
 */
import type { StudyTutorRef } from '../contracts/tutor/refs'

/**
 * The domain separator. Every digest in this system that could otherwise be
 * confused with another one is namespaced, so a value computed here can never
 * equal a value computed for some other purpose over the same input.
 */
export const STUDY_TUTOR_PSEUDONYM_NAMESPACE = 'study-tutor-learner-v1'

/** Between the namespace and the reference, so the two cannot run together. */
export const STUDY_TUTOR_PSEUDONYM_SEPARATOR = ':'

/** Reads as an identifier at the bridge, and says what kind of thing it is. */
export const STUDY_TUTOR_PSEUDONYM_PREFIX = 'learner:'

/**
 * 16 digest bytes, hex-encoded: 32 characters, 40 with the prefix.
 *
 * Half of SHA-256 deliberately. 128 bits is far past what a per-session
 * correlation value needs against collision, and a shorter value keeps the
 * whole identifier well inside the bridge's 128-character opaque-id bound with
 * no arithmetic for a future reader to check.
 */
export const STUDY_TUTOR_PSEUDONYM_DIGEST_BYTES = 16

const HEX = '0123456789abcdef'

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += HEX[byte >> 4]! + HEX[byte & 0x0f]!
  return out
}

/**
 * The per-session learner pseudonym, or `null`.
 *
 * `null` means "no pseudonym could be produced", and the only correct response
 * to it is to refuse the turn. It is returned when `crypto.subtle` is missing —
 * a non-secure context, an ancient browser — and there is deliberately NO weak
 * fallback: a caller that silently downgraded to a non-cryptographic digest
 * would keep working while quietly losing the one property this value exists
 * for, and nothing downstream could tell the two apart. Failing closed costs a
 * learner one refused turn on a platform Study does not support; failing open
 * costs her the property permanently and invisibly.
 *
 * The input is `StudyTutorRef`, not `string`, so the reference has already been
 * through `parseStudyTutorRef` and cannot be a host session reference someone
 * decided to pass along unvalidated.
 *
 * Total: a throwing or absent `crypto.subtle` is `null`, never an exception
 * through the caller, per the same rule the contract parsers follow.
 */
export async function studyTutorLearnerPseudonym(sessionRef: StudyTutorRef): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle || typeof subtle.digest !== 'function') return null
    const input = `${STUDY_TUTOR_PSEUDONYM_NAMESPACE}${STUDY_TUTOR_PSEUDONYM_SEPARATOR}${sessionRef}`
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input))
    const bytes = new Uint8Array(digest).slice(0, STUDY_TUTOR_PSEUDONYM_DIGEST_BYTES)
    if (bytes.length !== STUDY_TUTOR_PSEUDONYM_DIGEST_BYTES) return null
    return `${STUDY_TUTOR_PSEUDONYM_PREFIX}${toHex(bytes)}`
  } catch {
    return null
  }
}
