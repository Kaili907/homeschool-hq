/**
 * STUDY-A1-PROD-TUTOR-WRAPPER Phase 8 — the per-session learner pseudonym.
 *
 * The properties tested here are the ones the value exists for. Two of them are
 * about what it DOES carry (stable within a session, distinct between sessions)
 * and the rest are about what it must not: no fragment of the session
 * reference, no cross-session identity, no weak fallback, and nothing a Tutor
 * could refuse as an identifier.
 */
import { describe, expect, it, vi } from 'vitest'
import { parseStudyTutorRef } from '../contracts/tutor'
import { isStudyBridgeOpaqueId } from '../studyRequestRef'
import {
  STUDY_TUTOR_PSEUDONYM_DIGEST_BYTES,
  STUDY_TUTOR_PSEUDONYM_NAMESPACE,
  STUDY_TUTOR_PSEUDONYM_PREFIX,
  STUDY_TUTOR_PSEUDONYM_SEPARATOR,
  studyTutorLearnerPseudonym,
} from './tutorPseudonym'

const SESSION_A = parseStudyTutorRef('study-session:aaaa1111')!
const SESSION_B = parseStudyTutorRef('study-session:aaaa1112')!
const LONG_SESSION = parseStudyTutorRef(`study-session:${'b'.repeat(100)}`)!

describe('the per-session Tutor learner pseudonym', () => {
  it('is stable for one session and different for another', async () => {
    const first = await studyTutorLearnerPseudonym(SESSION_A)
    const again = await studyTutorLearnerPseudonym(SESSION_A)
    const other = await studyTutorLearnerPseudonym(SESSION_B)
    expect(first).not.toBeNull()
    expect(again).toBe(first)
    expect(other).not.toBe(first)
  })

  it('avalanches: one character of difference does not leave a shared prefix', async () => {
    // SESSION_A and SESSION_B differ in the final character only. A truncating
    // or additive digest would show it.
    const first = (await studyTutorLearnerPseudonym(SESSION_A))!
    const other = (await studyTutorLearnerPseudonym(SESSION_B))!
    const firstHex = first.slice(STUDY_TUTOR_PSEUDONYM_PREFIX.length)
    const otherHex = other.slice(STUDY_TUTOR_PSEUDONYM_PREFIX.length)
    let shared = 0
    while (shared < firstHex.length && firstHex[shared] === otherHex[shared]) shared += 1
    expect(shared).toBeLessThan(8)
  })

  it('is exactly the shape the bridge admits as an identifier', async () => {
    const pseudonym = (await studyTutorLearnerPseudonym(LONG_SESSION))!
    expect(pseudonym.startsWith(STUDY_TUTOR_PSEUDONYM_PREFIX)).toBe(true)
    expect(pseudonym).toMatch(/^learner:[0-9a-f]{32}$/)
    expect(pseudonym.slice(STUDY_TUTOR_PSEUDONYM_PREFIX.length)).toHaveLength(STUDY_TUTOR_PSEUDONYM_DIGEST_BYTES * 2)
    // The bound that matters: an identifier the bridge refuses comes back as
    // `stop-invalid-input` before the classifier runs, which the host records
    // as a durable safety stop about a child who did nothing.
    expect(pseudonym.length).toBeLessThanOrEqual(128)
    expect(isStudyBridgeOpaqueId(pseudonym)).toBe(true)
  })

  it('is the same length whatever the session reference is', async () => {
    const short = (await studyTutorLearnerPseudonym(SESSION_A))!
    const long = (await studyTutorLearnerPseudonym(LONG_SESSION))!
    expect(long).toHaveLength(short.length)
  })

  it('carries no fragment of the session reference', async () => {
    const pseudonym = (await studyTutorLearnerPseudonym(LONG_SESSION))!
    expect(pseudonym).not.toContain(LONG_SESSION)
    // No run of the reference survives either — a prefix or suffix digest would
    // leak one, and would collide across every session sharing that prefix.
    for (let start = 0; start + 6 <= LONG_SESSION.length; start += 1) {
      expect(pseudonym).not.toContain(LONG_SESSION.slice(start, start + 6))
    }
  })

  it('carries no household, profile or student identifier, because it is given none', async () => {
    // Structural rather than textual: the function takes exactly one argument,
    // and its type is the validated session reference. There is no parameter a
    // caller could put a durable learner identifier in.
    expect(studyTutorLearnerPseudonym).toHaveLength(1)
  })

  it('is the SHA-256 of the namespaced reference, and not some other digest', async () => {
    // Recomputed independently here, so the algorithm is pinned rather than
    // described. An FNV or splitmix substitution fails this outright.
    const input = `${STUDY_TUTOR_PSEUDONYM_NAMESPACE}${STUDY_TUTOR_PSEUDONYM_SEPARATOR}${SESSION_A}`
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    const expected = [...new Uint8Array(digest).slice(0, STUDY_TUTOR_PSEUDONYM_DIGEST_BYTES)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    expect(await studyTutorLearnerPseudonym(SESSION_A)).toBe(`${STUDY_TUTOR_PSEUDONYM_PREFIX}${expected}`)
  })

  it('is namespaced, so it is not the bare digest of the reference', async () => {
    const bare = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SESSION_A))
    const bareHex = [...new Uint8Array(bare).slice(0, STUDY_TUTOR_PSEUDONYM_DIGEST_BYTES)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    expect(await studyTutorLearnerPseudonym(SESSION_A)).not.toBe(`${STUDY_TUTOR_PSEUDONYM_PREFIX}${bareHex}`)
  })

  it('fails closed when WebCrypto is unavailable, and never falls back to a weak digest', async () => {
    // The whole point of the null. A fallback would keep working while silently
    // losing the one property this value exists for, and nothing downstream
    // could tell the two apart.
    vi.stubGlobal('crypto', {})
    try {
      expect(await studyTutorLearnerPseudonym(SESSION_A)).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('fails closed when the digest itself throws', async () => {
    vi.stubGlobal('crypto', { subtle: { digest: () => { throw new Error('no subtle crypto here') } } })
    try {
      expect(await studyTutorLearnerPseudonym(SESSION_A)).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
