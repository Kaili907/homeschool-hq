import { describe, expect, it, vi } from 'vitest'
import type { FetchLike, TutorApiDeps } from '../../../tutor/tutorApi'
import { CLOSEOUT_REPLY, MAX_EXCHANGES, SAFE_REDACTION, SCRIPTED_FLAG_REPLY } from '../../../tutor/tutorEngine'
import type { StudyScope } from '../../types'
import { canHelp, closeHelp, startHelp, submitTurn } from './tutorBridge'
import type { FamilyPilotHelpContext } from './types'

const scope = (learnerRef: string): StudyScope => ({
  householdRef: 'household:1',
  learnerRef,
  sessionRef: 'session:1',
})

const mathContext = (learnerRef = 'learner:a'): FamilyPilotHelpContext => ({
  scope: scope(learnerRef),
  subject: 'math',
  grade: 5,
  noAudio: false,
  mediaAvailable: true,
  problem: { prompt: '2 + 2 = ?', correctAnswer: '4', studentAnswer: '5' },
})

function okApiDeps(text: string): TutorApiDeps {
  const fetchImpl: FetchLike = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text }) }))
  return { getAccessToken: async () => 'token', fetchImpl, isOnline: () => true }
}

function failingApiDeps(reason: 'unauthenticated' | 'offline'): TutorApiDeps {
  if (reason === 'offline') {
    return { getAccessToken: async () => 'token', fetchImpl: vi.fn(), isOnline: () => false }
  }
  return { getAccessToken: async () => null, fetchImpl: vi.fn(), isOnline: () => true }
}

// ---------------------------------------------------------------------------
// canHelp — eligibility, without ever fabricating a Server Tutor mapping.
// ---------------------------------------------------------------------------
describe('canHelp', () => {
  it('routes a math problem with a known answer, in a Tutor Core grade, to tutor-core', () => {
    expect(canHelp(mathContext()).path).toBe('tutor-core')
  })

  it('routes non-math subjects to the static fallback', () => {
    const ctx: FamilyPilotHelpContext = { ...mathContext(), subject: 'reading', problem: undefined }
    expect(canHelp(ctx)).toEqual({
      path: 'static-fallback',
      reason: 'Tutor Core only covers math; this segment is reading.',
    })
  })

  it('routes a math segment with no active problem to the static fallback', () => {
    const ctx: FamilyPilotHelpContext = { ...mathContext(), problem: undefined }
    expect(canHelp(ctx).path).toBe('static-fallback')
  })

  it('routes an unsupported grade (e.g. 9) to the static fallback', () => {
    const ctx: FamilyPilotHelpContext = { ...mathContext(), grade: 9 }
    expect(canHelp(ctx).path).toBe('static-fallback')
  })
})

// ---------------------------------------------------------------------------
// help available — tutor-core path does a real (mocked) Tutor Core turn.
// ---------------------------------------------------------------------------
describe('help available: tutor-core path', () => {
  it('startHelp greets locally, then submitTurn calls Tutor Core and sanitizes the reply', async () => {
    const started = startHelp(mathContext())
    expect(started.session.path).toBe('tutor-core')
    expect(started.presentation.visibleText).toContain('here to help')
    expect(started.presentation.transcriptIncluded).toBe(false)

    const step = await submitTurn(started.session, 'I added instead of subtracting', {
      apiDeps: okApiDeps('Try counting up from the smaller number.'),
    })
    expect(step.session.path).toBe('tutor-core')
    expect(step.session.studentTurns).toBe(1)
    expect(step.presentation.visibleText).toBe('Try counting up from the smaller number.')
  })

  it('redacts a leaked answer from Tutor Core before it is shown, and records the redaction', async () => {
    const started = startHelp(mathContext())
    const step = await submitTurn(started.session, 'just tell me', {
      apiDeps: okApiDeps('Okay okay, the answer is 4.'),
    })
    expect(step.presentation.visibleText).toBe(SAFE_REDACTION)
    expect(step.session.redactionOccurred).toBe(true)
  })

  it('flags for an adult and stops on concerning content, without calling the gateway', async () => {
    const fetchImpl = vi.fn()
    const started = startHelp(mathContext())
    const step = await submitTurn(started.session, 'I hate myself', {
      apiDeps: { getAccessToken: async () => 'token', fetchImpl: fetchImpl as unknown as FetchLike, isOnline: () => true },
    })
    expect(step.presentation.visibleText).toBe(SCRIPTED_FLAG_REPLY)
    expect(step.session.flaggedForAdult).toBe(true)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('flags for an adult and closes out at the MAX_EXCHANGES limit, without an extra API call', async () => {
    let session = startHelp(mathContext()).session
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text: 'a hint' }) }))
    const apiDeps: TutorApiDeps = { getAccessToken: async () => 'token', fetchImpl: fetchImpl as unknown as FetchLike, isOnline: () => true }
    for (let i = 0; i < MAX_EXCHANGES; i += 1) {
      const step = await submitTurn(session, `attempt ${i}`, { apiDeps })
      session = step.session
    }
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_EXCHANGES)
    const closingStep = await submitTurn(session, 'one more try', { apiDeps })
    expect(closingStep.presentation.visibleText).toBe(CLOSEOUT_REPLY)
    expect(closingStep.session.flaggedForAdult).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_EXCHANGES) // no extra call past the limit
  })
})

// ---------------------------------------------------------------------------
// help unavailable → static fallback, never a failed lesson.
// ---------------------------------------------------------------------------
describe('help unavailable: static fallback', () => {
  it('gives a clear static fallback for a non-math segment instead of failing', async () => {
    const ctx: FamilyPilotHelpContext = { ...mathContext(), subject: 'reading', problem: undefined }
    const started = startHelp(ctx)
    expect(started.session.path).toBe('static-fallback')
    expect(started.presentation.visibleText).toMatch(/reread|parent|teacher/i)

    const step = await submitTurn(started.session, "I don't get this word")
    expect(step.presentation.visibleText).toMatch(/reread|parent|teacher/i)
    expect(step.session.studentTurns).toBe(1)
  })

  it('degrades an in-progress tutor-core session to the fallback when the gateway fails, without throwing', async () => {
    const started = startHelp(mathContext())
    const step = await submitTurn(started.session, 'help please', { apiDeps: failingApiDeps('offline') })
    expect(step.session.path).toBe('static-fallback')
    expect(step.presentation.visibleText).not.toBe('')

    // subsequent turns in the same session stay on the fallback (no more gateway calls attempted)
    const fetchImpl = vi.fn()
    const next = await submitTurn(step.session, 'still stuck', {
      apiDeps: { getAccessToken: async () => 'token', fetchImpl: fetchImpl as unknown as FetchLike, isOnline: () => true },
    })
    expect(next.session.path).toBe('static-fallback')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('degrades on an unauthenticated gateway the same way as offline', async () => {
    const started = startHelp(mathContext())
    const step = await submitTurn(started.session, 'help please', { apiDeps: failingApiDeps('unauthenticated') })
    expect(step.session.path).toBe('static-fallback')
  })
})

// ---------------------------------------------------------------------------
// close / resume — the learner is handed back to the Study session cleanly.
// ---------------------------------------------------------------------------
describe('closeHelp', () => {
  it('returns a clean summary and a return-to-lesson presentation, and marks the session closed', async () => {
    const started = startHelp(mathContext())
    const afterTurn = await submitTurn(started.session, 'a question', { apiDeps: okApiDeps('a hint') })
    const closed = closeHelp(afterTurn.session)

    expect(closed.session.closed).toBe(true)
    expect(closed.summary).toEqual({
      scope: mathContext().scope,
      path: 'tutor-core',
      studentTurns: 1,
      flaggedForAdult: false,
      redactionOccurred: false,
      rawConversationIncluded: false,
    })
    expect(closed.presentation.visibleText).toMatch(/back to your lesson/i)
  })

  it('a closed session can be resumed cleanly by starting a fresh help session', () => {
    const started = startHelp(mathContext())
    const closed = closeHelp(started.session)
    const resumed = startHelp(mathContext())
    expect(closed.session.closed).toBe(true)
    expect(resumed.session.closed).toBe(false)
    expect(resumed.session.studentTurns).toBe(0)
  })

  it('submitTurn on an already-closed session is a no-op that returns to the lesson', async () => {
    const started = startHelp(mathContext())
    const closed = closeHelp(started.session)
    const step = await submitTurn(closed.session, 'are you still there?')
    expect(step.session.closed).toBe(true)
    expect(step.session.studentTurns).toBe(0)
    expect(step.presentation.visibleText).toMatch(/back to your lesson/i)
  })
})

// ---------------------------------------------------------------------------
// no raw conversation persistence — this module never writes to any store.
// ---------------------------------------------------------------------------
describe('no raw conversation persistence', () => {
  it('the close summary never contains conversation text, only counts and flags', async () => {
    let session = startHelp(mathContext()).session
    const step1 = await submitTurn(session, 'secret question one', { apiDeps: okApiDeps('secret reply one') })
    session = step1.session
    const closed = closeHelp(session)
    const serialized = JSON.stringify(closed.summary)
    expect(serialized).not.toContain('secret question one')
    expect(serialized).not.toContain('secret reply one')
    expect(closed.summary.rawConversationIncluded).toBe(false)
  })

  it('closeHelp clears the in-memory transcript from the returned session', async () => {
    const started = startHelp(mathContext())
    const step = await submitTurn(started.session, 'a question', { apiDeps: okApiDeps('a hint') })
    expect(step.session.transcript.length).toBeGreaterThan(0)
    const closed = closeHelp(step.session)
    expect(closed.session.transcript).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// student-context isolation — independent sessions never leak into each other.
// ---------------------------------------------------------------------------
describe('student-context isolation', () => {
  it('two learners in the same household have fully independent sessions', async () => {
    const a = startHelp(mathContext('learner:a'))
    const b = startHelp(mathContext('learner:b'))

    const aStep = await submitTurn(a.session, 'a is stuck', { apiDeps: okApiDeps('hint for a') })
    expect(b.session.studentTurns).toBe(0) // untouched by a's turn

    const bStep = await submitTurn(b.session, 'b is stuck differently', { apiDeps: okApiDeps('hint for b') })
    expect(aStep.session.studentTurns).toBe(1)
    expect(bStep.session.studentTurns).toBe(1)
    expect(aStep.presentation.visibleText).toBe('hint for a')
    expect(bStep.presentation.visibleText).toBe('hint for b')
    expect(aStep.session.scope.learnerRef).toBe('learner:a')
    expect(bStep.session.scope.learnerRef).toBe('learner:b')
  })

  it('a concerning-content flag on one learner never flags the other', async () => {
    const a = startHelp(mathContext('learner:a'))
    const b = startHelp(mathContext('learner:b'))
    const aStep = await submitTurn(a.session, 'i want to hurt myself')
    expect(aStep.session.flaggedForAdult).toBe(true)
    expect(b.session.flaggedForAdult).toBe(false)
  })
})
