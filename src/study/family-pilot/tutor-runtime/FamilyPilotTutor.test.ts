import { describe, expect, it } from 'vitest'
import { boundedGatewayConversation, scriptedTutorTurnPolicy } from './FamilyPilotTutor'
import type { FamilyPilotTutorMessage } from './history'

function held(index: number, size = 20): FamilyPilotTutorMessage {
  return {
    messageRef: `tutor-message:${index}`,
    role: index % 2 === 0 ? 'learner' : 'tutor',
    text: `${index}:${'x'.repeat(size)}`,
    createdAt: new Date(Date.UTC(2026, 8, 9, 10, index)).toISOString(),
    source: index % 2 === 0 ? 'typed' : 'ai',
  }
}

describe('Family Pilot Tutor provider window', () => {
  it('keeps a long child conversation open while sending only the bounded recent window', () => {
    const completeHistory = Array.from({ length: 41 }, (_, index) => held(index))
    const projected = boundedGatewayConversation(completeHistory)
    expect(completeHistory).toHaveLength(41)
    expect(projected.length).toBeLessThanOrEqual(12)
    expect(projected[0]?.role).toBe('user')
    expect(projected.at(-1)).toEqual({ role: 'user', content: completeHistory.at(-1)?.text })
  })

  it('stays under the gateway character ceiling without discarding the newest learner turn', () => {
    const completeHistory = Array.from({ length: 13 }, (_, index) => held(index, 1_900))
    const projected = boundedGatewayConversation(completeHistory)
    expect(projected.reduce((total, item) => total + item.content.length, 0)).toBeLessThanOrEqual(7_900)
    expect(projected[0]?.role).toBe('user')
    expect(projected.at(-1)?.content).toBe(completeHistory.at(-1)?.text)
  })

  it('raises an adult check-in from concerning language before any AI turn', () => {
    expect(scriptedTutorTurnPolicy('I want to die', false)).toEqual({
      reply: "That sounds like something to talk to your dad about — let's flag him.",
      needsAdult: true,
    })
  })

  it('blocks free-form Tutor help during an active mastery check', () => {
    const decision = scriptedTutorTurnPolicy('Please solve this for me.', true)
    expect(decision?.needsAdult).toBe(false)
    expect(decision?.reply).toContain('can’t help answer this check while it is active')
  })
})
