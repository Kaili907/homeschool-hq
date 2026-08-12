import { describe, expect, it, vi } from 'vitest'
import { FAMILY_PILOT_STATIC_CONFIG, resolveFamilyPilotUnit } from '../../../src/curriculum/family-pilot/pilot-config'
import { loadFamilyPilotCatalog } from '../../../src/curriculum/family-pilot/source.node'
import { canHelp, closeHelp, startHelp, submitTurn } from '../../../src/study/family-pilot/tutor/tutorBridge'

/**
 * Proves the real Grade 5 Math pilot (ma-g5-mathematics-u01) can get safe
 * Tutor help with no live model required — no actual Anthropic/model call is
 * made anywhere in this file. Uses the real pilot catalog (loadFamilyPilotCatalog)
 * so "Grade 5 resolves" and "Grade 7/8 is never substituted" are proven
 * against actual frozen curriculum content, not a hand-built fixture.
 */

const scope = Object.freeze({
  householdRef: 'household:pilot-e2e',
  learnerRef: 'learner:pilot-e2e',
  sessionRef: 'session:pilot-e2e',
})

function grade5MathContext(overrides = {}) {
  return {
    scope,
    subject: 'math',
    grade: Number(FAMILY_PILOT_STATIC_CONFIG.grade),
    noAudio: false,
    mediaAvailable: true,
    problem: { prompt: 'What is 6 x 7?', correctAnswer: '42', studentAnswer: '' },
    ...overrides,
  }
}

const offlineApiDeps = () => ({
  getAccessToken: async () => 'token',
  fetchImpl: vi.fn(),
  isOnline: () => false,
})

describe('Grade 5 Math pilot — Tutor offline capability (no live model required)', () => {
  const catalog = loadFamilyPilotCatalog()
  const unit = resolveFamilyPilotUnit(catalog)

  it('1. the configured Grade 5 unit (ma-g5-mathematics-u01) resolves against the real pilot catalog', () => {
    expect(FAMILY_PILOT_STATIC_CONFIG.grade).toBe('5')
    expect(unit.unitId).toBe('ma-g5-mathematics-u01')
    expect(unit.courseId).toBe('ma-g5-mathematics')
    expect(unit.lessonIds.length).toBeGreaterThan(0)
  })

  it('2. Grade 5, with an active math problem, is within Tutor Core capability', () => {
    const eligibility = canHelp(grade5MathContext())
    expect(eligibility.path).toBe('tutor-core')
  })

  it('3. the static fallback returns useful, deterministic help', () => {
    const ineligible = grade5MathContext({ subject: 'reading', problem: undefined })
    expect(canHelp(ineligible).path).toBe('static-fallback')

    const first = startHelp(ineligible)
    expect(first.session.path).toBe('static-fallback')
    expect(first.presentation.visibleText.trim().length).toBeGreaterThan(0)

    const second = startHelp(ineligible)
    expect(second.presentation.visibleText).toBe(first.presentation.visibleText) // deterministic
  })

  it('4. a simulated live-Tutor failure degrades an eligible Grade 5 session to static help', async () => {
    const started = startHelp(grade5MathContext())
    expect(started.session.path).toBe('tutor-core')

    const step = await submitTurn(started.session, 'I need a hint', { apiDeps: offlineApiDeps() })
    expect(step.session.path).toBe('static-fallback')
    expect(step.presentation.visibleText.trim().length).toBeGreaterThan(0)
  })

  it('5. the whole degrade-and-continue lifecycle completes with no unhandled exception', async () => {
    let session = startHelp(grade5MathContext()).session
    const step1 = await submitTurn(session, 'first attempt', { apiDeps: offlineApiDeps() })
    session = step1.session
    const step2 = await submitTurn(session, 'second attempt, still stuck')
    session = step2.session
    const closed = closeHelp(session)

    expect(session.path).toBe('static-fallback')
    expect(closed.session.closed).toBe(true)
    expect(closed.presentation.visibleText.trim().length).toBeGreaterThan(0)
  })

  it('6. no learner answer is written or logged merely to produce the fallback', async () => {
    const marker = 'PILOT_E2E_SECRET_LEARNER_ANSWER_9f3c1a'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const started = startHelp(grade5MathContext())
      const degraded = await submitTurn(started.session, marker, { apiDeps: offlineApiDeps() })
      const closed = closeHelp(degraded.session)

      // The fallback path never persists anything (submitTurn/closeHelp are pure,
      // in-memory only) — verified here by checking the marker never reaches any
      // console sink (the only side channel this pure module could use) and never
      // survives into the returned, closeable summary.
      for (const spy of [logSpy, warnSpy, errorSpy]) {
        for (const call of spy.mock.calls) {
          expect(JSON.stringify(call)).not.toContain(marker)
        }
      }
      expect(JSON.stringify(closed.summary)).not.toContain(marker)
      expect(closed.summary.rawConversationIncluded).toBe(false)
      expect(closed.session.transcript).toEqual([])
    } finally {
      logSpy.mockRestore()
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it('7. no network call is required to produce the static fallback', async () => {
    const ineligible = grade5MathContext({ subject: 'reading', problem: undefined })
    const started = startHelp(ineligible) // synchronous, no deps passed at all
    expect(started.session.path).toBe('static-fallback')

    const fetchImpl = vi.fn()
    const step = await submitTurn(started.session, 'still need help', {
      apiDeps: { getAccessToken: async () => 'token', fetchImpl, isOnline: () => true },
    })
    expect(step.presentation.visibleText.trim().length).toBeGreaterThan(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('8. Grade 7/8 units are never accidentally substituted for the configured Grade 5 unit', () => {
    const grade5Course = catalog.courses.find(
      (c) => c.grade === '5' && c.courseId === FAMILY_PILOT_STATIC_CONFIG.courseId,
    )
    expect(grade5Course).toBeDefined()

    // Sanity: the pilot catalog genuinely contains grade 7/8 courses too, so
    // resolution below is a real choice, not a config with only one option.
    const otherGradeCourses = catalog.courses.filter((c) => c.grade === '7' || c.grade === '8')
    expect(otherGradeCourses.length).toBeGreaterThan(0)

    expect(unit.courseId).toBe('ma-g5-mathematics')
    expect(['7', '8']).not.toContain(FAMILY_PILOT_STATIC_CONFIG.grade)

    // Even with course order reversed, resolution still finds grade 5 by id —
    // not "whichever course comes first".
    const reordered = { releaseVersion: catalog.releaseVersion, courses: [...catalog.courses].reverse() }
    const unitAgain = resolveFamilyPilotUnit(reordered)
    expect(unitAgain.unitId).toBe('ma-g5-mathematics-u01')
    expect(unitAgain.courseId).toBe('ma-g5-mathematics')

    // A catalog missing the grade 5 course fails loudly instead of silently
    // falling back to a grade 7/8 course.
    const grade5Missing = {
      releaseVersion: catalog.releaseVersion,
      courses: catalog.courses.filter((c) => c.grade !== '5'),
    }
    expect(() => resolveFamilyPilotUnit(grade5Missing)).toThrow(/ma-g5-mathematics is not in the catalog/)
  })
})
