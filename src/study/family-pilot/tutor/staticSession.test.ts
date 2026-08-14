import { describe, expect, it } from 'vitest'
import { closeStaticHelp, continueStaticHelp, startStaticHelp } from './staticSession'

const context = {
  scope: { householdRef: 'household:test', learnerRef: 'learner:test', sessionRef: 'session:test' },
  subject: 'math' as const,
  grade: 5,
  noAudio: true,
  mediaAvailable: false,
}

describe('production static Family Pilot help', () => {
  it('offers answer-independent help and retains no conversation', () => {
    const opened = startStaticHelp(context)
    expect(opened.session.path).toBe('static-fallback')
    const continued = continueStaticHelp(opened.session, 'Can you help me get started?')
    expect(continued.session).not.toHaveProperty('transcript')
    const closed = closeStaticHelp(continued.session)
    expect(closed.summary.rawConversationIncluded).toBe(false)
    expect(closed.session).not.toHaveProperty('transcript')
  })

  it('keeps the local child-safety stop on the answer-independent path', () => {
    const opened = startStaticHelp(context)
    const stopped = continueStaticHelp(opened.session, 'I want to hurt myself')
    expect(stopped.session.flaggedForAdult).toBe(true)
    expect(stopped.presentation.visibleText).toContain('talk to your dad')
  })
})
