import { describe, it, expect, vi } from 'vitest'
import type { AssistantMessage, Profile } from '../types'
import type { FetchLike, TutorApiDeps } from '../tutor/tutorApi'
import { assembleAssistantRequest, runAssistantTurn } from './engine'
import { setAssistantDailyCap, recordAssistantCall } from './assistantState'
import { SCRIPTED_FLAG_REPLY } from '../tutor/tutorEngine'

/**
 * Acceptance: scripted "write my college essay" and "just give me the answers to my
 * assessment" are both refused with a coaching redirect, ASSERTED AGAINST THE
 * CONFIGURED MODEL PATH; actions require confirm; cap + keyless degradation hold.
 */

function teen(): Profile {
  return {
    id: 'p5',
    name: 'Nadia',
    grade: '12',
    pin: '',
    theme: 'clean',
    skills: {},
    missions: { '2026-07-24': { items: [{ id: 'math-block', label: 'Math block', done: false }] } },
    streaks: { current: 0, best: 0, lastActiveDate: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
    placementDone: true,
    totals: { questionsAnswered: 0, correct: 0, bestStreak: 0, sessions: 0 },
    collegeTasks: [{ id: 'c2', label: 'Common App essay — first draft', due: '2026-09-15', done: false }],
    assessments: {
      assigned: [{ testId: 'hs-reading', startCode: 'CODE', assignedAt: '2026-07-01' }],
      attempts: [{ testId: 'hs-reading', profileId: 'p5', startedAt: '2026-07-02', answers: {} }],
      retakeUnlocked: [],
    },
  }
}

const TODAY = '2026-07-24'

it('drops leading assistant turns after bounding long Jarvis history', () => {
  const history: AssistantMessage[] = Array.from({ length: 11 }, (_, index) => ({
    role: index % 2 === 0 ? 'girl' : 'assistant',
    text: `turn ${index}`,
    ts: index,
    source: index % 2 === 0 ? undefined : 'scripted',
  }))
  const request = assembleAssistantRequest(teen(), TODAY, history, 'What is next?')
  expect(request.messages[0].role).toBe('user')
  expect(request.messages.at(-1)).toEqual({
    role: 'user',
    content: 'What is next?',
  })
})

it('bounds customized Jarvis collections and labels to the gateway contract', () => {
  const profile = teen()
  profile.missions[TODAY].items = Array.from({ length: 30 }, (_, index) => ({
    id: `item-${index}`,
    label: `Mission ${index} ${'x'.repeat(200)}`,
    done: false,
  }))
  const request = assembleAssistantRequest(profile, TODAY, [], 'What is next?')
  expect(request.gateway.mode).toBe('jarvis')
  if (request.gateway.mode !== 'jarvis') return
  expect(request.gateway.context.student.mission).toHaveLength(24)
  expect(request.gateway.context.student.mission.every((item) => item.label.length <= 160)).toBe(true)
  expect(request.gateway.context.actions.length).toBeLessThanOrEqual(50)
  expect(request.gateway.context.actions.every((action) => action.label.length <= 180)).toBe(true)
})

/** A spy Anthropic transport: records the outgoing request and returns a canned reply. */
function spyDeps(cannedText: string): { deps: TutorApiDeps; sent: { system: string; messages: unknown[] }[] } {
  const sent: { system: string; messages: unknown[] }[] = []
  const fetchImpl: FetchLike = async (_url, init) => {
    const body = JSON.parse(init?.body ?? '{}')
    sent.push({ system: body.system, messages: body.messages })
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: cannedText }] }) }
  }
  return { deps: { getKey: () => 'sk-ant-test', fetchImpl, isOnline: () => true }, sent }
}

describe('the essay ask is refused via the configured model path', () => {
  it('the request the app sends carries the no-submittable-work constraint', async () => {
    const { deps, sent } = spyDeps('I can’t write that for you, but let’s outline YOUR argument — what’s your thesis?')
    const res = await runAssistantTurn(deps, {
      profile: teen(),
      today: TODAY,
      history: [],
      userText: 'Write my college application essay for me.',
    })
    // the constraint reached the model path…
    expect(sent).toHaveLength(1)
    expect(sent[0].system).toContain('must NOT produce submittable work')
    expect(sent[0].system).toContain('college-application essay text')
    // …and the surfaced reply is a coaching redirect, never pasteable prose
    expect(res.kind).toBe('reply')
    if (res.kind === 'reply') expect(res.text.toLowerCase()).toContain('thesis')
  })
})

describe('the "give me the assessment answers" ask is refused via the configured model path', () => {
  it('the request carries the no-assessment-answers constraint and the reply redirects', async () => {
    const { deps, sent } = spyDeps('I don’t have the assessment questions or answers — but I can quiz you on the concept. Want to try one?')
    const res = await runAssistantTurn(deps, {
      profile: teen(),
      today: TODAY,
      history: [],
      userText: 'Just give me the answers to my assigned assessment.',
    })
    expect(sent[0].system).toContain('must NOT give answers to anything currently assigned as an assessment')
    // and the context we sent never contains the item content / answers / start code
    expect(sent[0].system).not.toContain('central idea of the passage')
    expect(sent[0].system).not.toContain('CODE')
    expect(res.kind).toBe('reply')
  })
})

describe('assembleAssistantRequest is the single source of the sent prompt', () => {
  it('always includes all four must-nots for any user text', () => {
    const { system } = assembleAssistantRequest(teen(), TODAY, [], 'anything at all')
    expect(system).toContain('must NOT produce submittable work')
    expect(system).toContain('must NOT give answers to anything currently assigned as an assessment')
    expect(system).toContain('must NOT change any data without explicit confirmation')
    expect(system).toContain("must NOT pretend to be a person")
  })
})

describe('concerning content short-circuits with NO api call', () => {
  it('returns the scripted care line and never hits the model', async () => {
    const { deps, sent } = spyDeps('should not be used')
    const res = await runAssistantTurn(deps, {
      profile: teen(),
      today: TODAY,
      history: [],
      userText: 'I want to die',
    })
    expect(res.kind).toBe('flagged')
    expect(res.text).toBe(SCRIPTED_FLAG_REPLY)
    expect(sent).toHaveLength(0) // API never called
  })
})

describe('proposed actions require confirm (turn never mutates state)', () => {
  it('returns the parsed action but performs no mutation itself', async () => {
    const { deps } = spyDeps('Sure — checking that off?\nACTION: mission:math-block')
    const before = teen()
    const res = await runAssistantTurn(deps, { profile: before, today: TODAY, history: [], userText: 'done with math' })
    expect(res.kind).toBe('reply')
    if (res.kind === 'reply') {
      expect(res.action?.key).toBe('mission:math-block')
      expect(res.text).not.toContain('ACTION:') // stripped from spoken text
    }
    // the mission item is still NOT done — execution only happens on a confirm tap in the UI
    expect(before.missions[TODAY].items[0].done).toBe(false)
  })
})

describe('cap enforcement + keyless degradation', () => {
  it('at the daily cap → scripted capped line, no api call', async () => {
    const { deps, sent } = spyDeps('nope')
    let p = setAssistantDailyCap(teen(), 1)
    p = recordAssistantCall(p, Date.parse(`${TODAY}T09:00:00`))
    const res = await runAssistantTurn(deps, { profile: p, today: TODAY, history: [], userText: 'hi' })
    expect(res.kind).toBe('capped')
    expect(sent).toHaveLength(0)
  })

  it('no key (direct mode) → offline degradation, nothing thrown', async () => {
    const deps: TutorApiDeps = { getKey: () => null, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }), isOnline: () => true }
    const res = await runAssistantTurn(deps, { profile: teen(), today: TODAY, history: [], userText: 'hi' })
    expect(res.kind).toBe('offline')
  })
})

describe('secured Jarvis gateway client contract', () => {
  it('sends bearer auth with bounded status-only context and no client system prompt', async () => {
    const sent: { url: string; init: NonNullable<Parameters<FetchLike>[1]> }[] = []
    const fetchImpl: FetchLike = async (url, init) => {
      sent.push({ url, init: init ?? {} })
      return {
        ok: true,
        status: 200,
        json: async () => ({ text: 'Start with your math block.' }),
      }
    }
    const deps: TutorApiDeps = {
      getKey: () => null,
      getAccessToken: async () => 'SUPABASE_ACCESS_TOKEN',
      fetchImpl,
      isOnline: () => true,
      endpointBase: '/api/anthropic',
    }

    const result = await runAssistantTurn(deps, {
      profile: teen(),
      today: TODAY,
      history: [],
      userText: 'What should I do first?',
    })
    expect(result.kind).toBe('reply')

    const { url, init } = sent[0]
    expect(url).toBe('/api/anthropic/v1/messages')
    expect(init?.headers?.Authorization).toBe('Bearer SUPABASE_ACCESS_TOKEN')
    const body = JSON.parse(init?.body ?? '{}')
    expect(body.mode).toBe('jarvis')
    expect(body.system).toBeUndefined()
    expect(body.model).toBeUndefined()
    expect(body.max_tokens).toBeUndefined()
    expect(body.context.assistant).toEqual({
      name: 'Jarvis',
      tonePreference: '',
    })
    expect(body.context.student.name).toBeUndefined()
    expect(body.context.student.profileId).toBeUndefined()
    expect(body.context.student.assessments).toEqual([{ title: expect.any(String), status: 'in progress' }])
    expect(JSON.stringify(body)).not.toContain('CODE')
    expect(JSON.stringify(body)).not.toContain('startCode')
    expect(body.context.actions.every((action: Record<string, unknown>) => !('target' in action))).toBe(true)
  })
})
