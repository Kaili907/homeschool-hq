/**
 * STUDY-A1-PROD-TUTOR-WRAPPER-H2 — Tutor prose is REJECTED above the contract
 * bound, never shortened to fit it.
 *
 * WHY THIS FILE EXISTS. `STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH` is 2,500 and the
 * contract parser quarantines anything longer, which ../contracts/tutor/results.test.ts
 * already proves about the parser. What no test proved was that the production
 * runtime hands the parser what the Tutor actually said. The independent review
 * of 604a7a3 demonstrated the gap: inserting `.slice(0, 2_500)` — and even
 * `.slice(0, 400)` — before the runtime's result-building call laundered an
 * utterance the contract would have quarantined into an accepted one, and all
 * 2,609 tests stayed green.
 *
 * They stayed green because the frozen content that ships today cannot produce
 * such an utterance. Every utterance reachable by driving the frozen Core is
 * short, clean prose, so a truncating transform anywhere on the path is a no-op
 * against it and no behavioural test could tell. The bound is not there for
 * today's content: it is there for a hosted Tutor or a later content pack, which
 * is precisely the output nothing here can drive.
 *
 * HOW THE OUTPUT IS DRIVEN. One seam is substituted, and it is the narrowest one
 * that exists: the utterance handed to `sanitizeLearnerFacingText`. Everything
 * on both sides of it is real — the real subject registry, the real frozen Core
 * engine, the real output-safety classifier (which judges the RAW Core response,
 * upstream of this seam and unaffected by it), the real canonical sanitizer, the
 * real presentation seam and the real `acceptStudyTutorResult` crossing. The
 * substitution replaces the sanitizer's INPUT, never its output, so the reviewed
 * sanitizer still runs and its result is still what travels.
 *
 * That places the injection ABOVE both truncation sites, so one fixture covers
 * both: `visibleText = safe.text` in ./tutorAdapter.ts and
 * `studyTutorLearnerPresentation(adapterResult.visibleText)` in ./tutorRuntime.ts.
 *
 * The mock cannot fail silently. If it did not apply, the accepted case below
 * would carry the frozen Core's own short prose instead of the exact 2,500
 * characters it asserts, and the test would fail rather than pass vacuously.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const injected = vi.hoisted(() => ({ utterance: null as string | null }))

vi.mock('../../../adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('../../../adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts')
  >()
  return {
    ...original,
    /**
     * The canonical sanitizer, given a different utterance. It is not replaced
     * and it is not approximated: `original.sanitizeLearnerFacingText` is the
     * reviewed implementation and it decides what comes out, exactly as it does
     * in production.
     */
    sanitizeLearnerFacingText: (value: string) =>
      original.sanitizeLearnerFacingText(injected.utterance ?? value),
  }
})

import { sanitizeLearnerFacingText } from '../../../adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts'
import {
  STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE,
  STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH,
  parseStudyTutorLearnerText,
  parseStudyTutorRef,
  type StudyTutorTurn,
  type ValidatedStudyTutorResult,
} from '../contracts/tutor'
import type { StudyEventLedgerPort, StudySafetyPort } from '../ports'
import type { StudySafeEvent } from '../types'
import { ProductionStudyTutorRuntime, STUDY_TUTOR_RUNTIME_REASON_CODES } from './tutorRuntime'

const SESSION = parseStudyTutorRef('study-session:visible-text-boundary')!
const REQUEST = parseStudyTutorRef('study-turn:visible-text-boundary')!
const LESSON = parseStudyTutorRef('lesson:visible-text-boundary')!
const SEGMENT = parseStudyTutorRef('segment:visible-text-boundary')!
const SKILL = parseStudyTutorRef('skill:visible-text-boundary')!
const LEARNER_TEXT = parseStudyTutorLearnerText('ready')!

const clearSafety: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'test-study-a1-prod-tutor-wrapper-h2-visible-text',
  evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
}

function eventLedgerPort(appended: StudySafeEvent[]): StudyEventLedgerPort {
  return {
    append: async (_scope, event) => {
      appended.push(event)
      return 'appended'
    },
  }
}

function turn(): StudyTutorTurn {
  return {
    sessionRef: SESSION,
    requestRef: REQUEST,
    lessonRef: LESSON,
    segmentRef: SEGMENT,
    subject: 'math',
    skillRef: SKILL,
    taskType: 'guided-practice',
    transientLearnerText: LEARNER_TEXT,
    expectedAnswer: 'ready',
    occurredAt: '2026-08-01T14:00:00.000Z',
    learnerLocalDate: '2026-08-01',
    householdTimeZone: 'America/Detroit',
  }
}

async function submitWithUtterance(utterance: string): Promise<ValidatedStudyTutorResult> {
  injected.utterance = utterance
  return new ProductionStudyTutorRuntime({
    scope: {
      householdRef: 'household:visible-text-boundary',
      learnerRef: 'learner:visible-text-boundary',
      sessionRef: 'study-session:visible-text-boundary',
    },
    hostProfileRef: 'profile:visible-text-boundary',
    safety: clearSafety,
    eventLedger: eventLedgerPort([]),
    isCurrent: () => true,
    bridgeSessionRef: 'study-session:visible-text-boundary',
  }).submit(turn())
}

afterEach(() => { injected.utterance = null })

describe('PHASE 4 — Tutor prose above the contract bound quarantines rather than being shortened', () => {
  it('accepts an utterance exactly at the bound, and shows every character of it', async () => {
    const atBound = 'x'.repeat(STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH)
    const result = await submitWithUtterance(atBound)

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    // Identity, not length. A `.slice(0, 400)` anywhere on the path leaves this
    // a valid accepted result carrying the wrong text, and only an identity
    // assertion notices.
    expect(result.visibleText).toBe(atBound)
    expect(result.visibleText).toHaveLength(STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH)
  })

  it('quarantines one character above the bound instead of trimming it to fit', async () => {
    const overBound = 'x'.repeat(STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH + 1)
    const result = await submitWithUtterance(overBound)

    // The whole of the finding. Any truncating transform on the path makes this
    // `accepted` — with 2,500 characters for a slice at the bound, or 400 for a
    // shorter one — and laundering output the host could not vouch for into
    // output it treats as vouched for is exactly what the bound exists to stop.
    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') return
    expect(result.reasonCode).toBe(STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE)
    expect(Object.keys(result).sort()).toEqual(['reasonCode', 'status'])
  })

  it('quarantines an utterance far above the bound', async () => {
    // The hosted-Tutor case the bound was written for: prose the host would
    // otherwise hold in surface state and render to a ten-year-old in full.
    const result = await submitWithUtterance('x'.repeat(25_000))
    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') return
    expect(result.reasonCode).toBe(STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE)
  })

  it('quarantines prose the presentation seam refuses, rather than padding or dropping it', async () => {
    // The other end of the same rule. An empty or whitespace-only utterance is
    // not presentable, and the refusal is structural — it says nothing about the
    // learner and writes nothing durable.
    const result = await submitWithUtterance('   \n\t  ')
    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') return
    expect(result.reasonCode).toBe(STUDY_TUTOR_RUNTIME_REASON_CODES.presentationRefused)
  })
})

describe('PHASE 7 — the reviewed sanitizer decides the prose, and its OUTPUT is what travels', () => {
  it('presents the sanitized text and never the raw utterance', async () => {
    // A synthetic sanitizer-sensitive utterance. The output-safety classifier
    // judged the real Core response upstream of this seam and cleared it, which
    // is the case the sanitizer exists for: cleared prose that still carries a
    // contact detail a child must not be handed.
    const raw = 'Great work. Email tutor@example.invalid or call 313-555-0142 for the next step.'
    const result = await submitWithUtterance(raw)

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return

    // The safe text, not the source text.
    expect(result.visibleText).not.toBe(raw)
    expect(result.visibleText).not.toContain('tutor@example.invalid')
    expect(result.visibleText).not.toContain('313-555-0142')
    expect(result.visibleText).toContain('[contact detail removed]')

    // And it is the CANONICAL sanitizer's own answer, character for character —
    // not an ad hoc redaction that happens to look similar.
    expect(result.visibleText).toBe(sanitizeLearnerFacingText(raw).text)
    // A second pass changes nothing, so what travelled is an output rather than
    // an input that was merely inspected.
    expect(sanitizeLearnerFacingText(result.visibleText).text).toBe(result.visibleText)
  })

  it('replaces an utterance the sanitizer refuses outright, and shows the replacement', async () => {
    // The credential branch replaces the whole text. The point is the same: the
    // learner is shown what the sanitizer returned, and nothing of the original.
    const raw = 'To continue, use password: hunter2 on the sign-in page.'
    const result = await submitWithUtterance(raw)

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    expect(result.visibleText).toBe(sanitizeLearnerFacingText(raw).text)
    expect(result.visibleText).not.toContain('hunter2')
  })
})
