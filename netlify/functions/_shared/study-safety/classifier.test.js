import { describe, expect, it, vi } from 'vitest'
import { SYNTHETIC_SAFETY_CORPUS_V1 } from './corpus.v1.js'
import { deterministicSafetyAssessment, normalizeTransientText } from './deterministic.js'
import { createAnthropicSafetyClassifier } from './provider.js'
import { classifyTransientSafety } from './service.js'

const ACCOUNTING_CONTEXT = Object.freeze({
  requestKey: 'study-safety-unit-request',
  accountRef: '11111111-1111-4111-8111-111111111111',
  householdRef: '22222222-2222-4222-8222-222222222222',
  householdAttribution: 'resolved',
})

function createAccountedClassifier(options = {}) {
  let attemptSequence = 0
  const journal = {
    reserve: vi.fn(async () => ({
      status: 'created',
      attemptId: `90000000-0000-4000-8000-${String(++attemptSequence).padStart(12, '0')}`,
      state: 'reserved',
    })),
    transition: vi.fn(async (input) => ({
      status: 'created', attemptId: input.attemptId, state: input.toState,
    })),
    linkLedger: vi.fn(async (input) => ({
      status: 'created', attemptId: input.attemptId, state: 'ledgered',
    })),
  }
  return createAnthropicSafetyClassifier({
    ...options,
    env: {
      ACADEMY_APP_VERSION: 'study-safety-test-build',
      ...options.env,
    },
    gatewayAccess: options.gatewayAccess ?? {
      recordProviderUsage: vi.fn(async () => undefined),
    },
    providerAttemptJournal: options.providerAttemptJournal ?? journal,
  })
}

const providerCode = (outcome) => `safety-provider-${outcome}-v1`
const reviewedClassifier = Object.freeze({
  classifierVersion: 'test-safety-classifier-v1',
  isConfigured: () => true,
  circuitState: () => 'closed',
  async classify(request) {
    const { outcome, categories } = request.deterministicAssessment
    return {
      classificationVersion: 1,
      classifierVersion: 'test-safety-classifier-v1',
      outcome,
      categories,
      reasonCodes: [providerCode(outcome)],
    }
  },
})

describe('versioned synthetic child-safety corpus', () => {
  it('is hand-authored, unique, complete, and contains no delivery during classification', () => {
    expect(SYNTHETIC_SAFETY_CORPUS_V1.length).toBeGreaterThanOrEqual(70)
    expect(new Set(SYNTHETIC_SAFETY_CORPUS_V1.map((entry) => entry.caseId)).size).toBe(SYNTHETIC_SAFETY_CORPUS_V1.length)
    const tags = new Set(SYNTHETIC_SAFETY_CORPUS_V1.flatMap((entry) => entry.tags))
    for (const required of [
      'direct', 'indirect', 'academic', 'fiction', 'quotation', 'historical', 'hypothetical', 'idiom', 'technical',
      'negation', 'misspelling', 'obfuscation', 'multiple-categories', 'contradiction', 'prompt-injection',
      'mixed-academic-personal', 'empty', 'oversized',
    ]) expect(tags.has(required)).toBe(true)
    for (const entry of SYNTHETIC_SAFETY_CORPUS_V1) {
      expect(entry.dataProvenance).toBe('hand-authored-synthetic')
      expect(entry.expected.deliveryAttemptedDuringClassification).toBe(false)
      expect(entry).not.toHaveProperty('studentId')
    }
  })

  it.each(SYNTHETIC_SAFETY_CORPUS_V1.map((entry) => [entry.caseId, entry]))(
    '%s produces the reviewed classification and reason',
    async (_caseId, entry) => {
      const result = await classifyTransientSafety(entry.input, reviewedClassifier)
      expect(result.outcome).toBe(entry.expected.classification)
      expect(result.reasonCodes).toContain(entry.expected.expectedReasonCode)
      expect(result.outcome === 'clear').toBe(entry.expected.tutorCoreMayRun)
      expect(result.outcome !== 'clear').toBe(entry.expected.adultReviewProposed)
    },
  )

  it('personal disclosure outranks academic context while attributed fiction stays clear', () => {
    const mixed = normalizeTransientText('The story discusses neglect, but my dad hits me.')
    const quote = normalizeTransientText('The character says, "I want to die," in the novel.')
    expect(deterministicSafetyAssessment(mixed).outcome).toBe('urgent')
    expect(deterministicSafetyAssessment(mixed).ruleIds).toContain('safety-personal-signal-outranks-context-v1')
    expect(deterministicSafetyAssessment(quote).outcome).toBe('clear')
  })

  it('a provider cannot downgrade deterministic urgent or uncertain results', async () => {
    const downgrader = {
      classifierVersion: 'test-safety-classifier-v1',
      async classify() {
        return {
          classificationVersion: 1,
          classifierVersion: 'test-safety-classifier-v1',
          outcome: 'clear',
          categories: [],
          reasonCodes: ['safety-provider-clear-v1'],
        }
      },
    }
    expect((await classifyTransientSafety('I want to die.', downgrader)).outcome).toBe('urgent')
    expect((await classifyTransientSafety('I might hurt myself.', downgrader)).outcome).toBe('uncertain')
  })

  it('fails closed for exceptions, malformed output, extra fields, and covert reason codes', async () => {
    const cases = [
      { classifierVersion: 'test-safety-classifier-v1', classify: async () => { throw new Error('raw provider body') } },
      { classifierVersion: 'test-safety-classifier-v1', classify: async () => ({ outcome: 'clear' }) },
      {
        classifierVersion: 'test-safety-classifier-v1',
        classify: async () => ({
          classificationVersion: 1,
          classifierVersion: 'test-safety-classifier-v1',
          outcome: 'clear', categories: [], reasonCodes: ['safety-provider-clear-v1'], rawText: 'sentinel',
        }),
      },
      {
        classifierVersion: 'test-safety-classifier-v1',
        classify: async () => ({
          classificationVersion: 1,
          classifierVersion: 'test-safety-classifier-v1',
          outcome: 'clear', categories: [], reasonCodes: ['encoded-learner-text'],
        }),
      },
    ]
    for (const classifier of cases) {
      const result = await classifyTransientSafety('ordinary answer', classifier)
      expect(result.outcome).toBe('invalid')
      expect(JSON.stringify(result)).not.toContain('sentinel')
      expect(JSON.stringify(result)).not.toContain('raw provider body')
    }
  })
})

describe('secured provider adapter', () => {
  const request = {
    classificationVersion: 1,
    normalizedTransientText: 'ordinary synthetic answer',
    deterministicAssessment: { outcome: 'clear', categories: [], ruleIds: ['safety-clear-no-signal-v1'] },
  }

  it('uses fixed server configuration and exact structured output', async () => {
    const fetchImpl = vi.fn(async (_url, init) => new Response(JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify({ outcome: 'clear', categories: [], reasonCodes: ['safety-provider-clear-v1'] }) }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const classifier = createAccountedClassifier({ env: { ANTHROPIC_API_KEY: 'test-provider-key' }, fetchImpl })
    const result = await classifier.classify(request, ACCOUNTING_CONTEXT)
    expect(result.outcome).toBe('clear')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers['x-api-key']).toBe('test-provider-key')
    const body = JSON.parse(init.body)
    expect(Object.keys(body).sort()).toEqual(['max_tokens', 'messages', 'model', 'system', 'temperature'])
    expect(body.system).not.toContain('ordinary synthetic answer')
  })

  it('retries bounded transient failures and rejects malformed/refusal output without raw logging', async () => {
    const events = []
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('provider secret body'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: 'I refuse' }] }), { status: 200 }))
    const classifier = createAccountedClassifier({
      env: { ANTHROPIC_API_KEY: 'test-provider-key' },
      fetchImpl,
      delay: async () => {},
      monitoring: { record: async (event) => events.push(event) },
    })
    const result = await classifier.classify(request, ACCOUNTING_CONTEXT)
    expect(result.outcome).toBe('invalid')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(JSON.stringify({ result, events })).not.toContain('provider secret body')
    expect(JSON.stringify({ result, events })).not.toContain('I refuse')
  })

  it('opens the circuit after terminal failures even if monitoring throws', async () => {
    let now = 1_000
    const classifier = createAccountedClassifier({
      env: { ANTHROPIC_API_KEY: 'test-provider-key' },
      fetchImpl: vi.fn(async () => { throw new Error('outage') }),
      delay: async () => {},
      maxAttempts: 1,
      failureThreshold: 2,
      now: () => now,
      monitoring: { record: async () => { throw new Error('monitoring outage') } },
    })
    await classifier.classify(request, ACCOUNTING_CONTEXT)
    await classifier.classify(request, ACCOUNTING_CONTEXT)
    expect(classifier.circuitState()).toBe('open')
    const result = await classifier.classify(request, ACCOUNTING_CONTEXT)
    expect(result.reasonCodes).toEqual(['safety-invalid-provider-circuit-open-v1'])
    now += 31_000
    expect(classifier.circuitState()).not.toBe('open')
  })

  it('treats provider timeout as indeterminate and does not retry without proof', async () => {
    const fetchImpl = vi.fn(async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')), { once: true })
    }))
    const classifier = createAccountedClassifier({
      env: { ANTHROPIC_API_KEY: 'test-provider-key' },
      fetchImpl,
      timeoutMs: 1,
      maxAttempts: 2,
      delay: async () => {},
    })
    const result = await classifier.classify(request, ACCOUNTING_CONTEXT)
    expect(result.reasonCodes).toEqual(['safety-invalid-provider-timeout-v1'])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
