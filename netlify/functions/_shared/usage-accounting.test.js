import { describe, expect, it, vi } from 'vitest'
import {
  elapsedMilliseconds,
  parseAnthropicUsage,
  persistProviderUsage,
  submittedCharacterCount,
  trustedUsageVersions,
  usageAccountingBounds,
  usageRequestKey,
} from './usage-accounting.js'

describe('provider usage parsing', () => {
  it('accepts exact input, output, and supported Anthropic cache counters', () => {
    expect(
      parseAnthropicUsage({
        usage: {
          input_tokens: 101,
          output_tokens: 29,
          cache_read_input_tokens: 17,
          cache_creation_input_tokens: 13,
        },
      }),
    ).toEqual({
      kind: 'valid',
      inputTokens: 101,
      outputTokens: 29,
      cacheReadInputTokens: 17,
      cacheWriteInputTokens: 13,
    })
  })

  it('distinguishes missing usage from malformed and out-of-bounds usage', () => {
    expect(parseAnthropicUsage({})).toEqual({ kind: 'missing' })
    expect(parseAnthropicUsage({ usage: null })).toEqual({ kind: 'missing' })
    expect(parseAnthropicUsage({ usage: { input_tokens: 1 } })).toEqual({ kind: 'malformed' })
    expect(
      parseAnthropicUsage({
        usage: { input_tokens: usageAccountingBounds.maxUsageQuantity + 1, output_tokens: 1 },
      }),
    ).toEqual({ kind: 'malformed' })
    expect(
      parseAnthropicUsage({ usage: { input_tokens: 1.5, output_tokens: 1 } }),
    ).toEqual({ kind: 'malformed' })
  })

  it('supports exact zero usage without inventing cache counters', () => {
    expect(parseAnthropicUsage({ usage: { input_tokens: 0, output_tokens: 0 } })).toEqual({
      kind: 'valid',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
    })
  })
})

describe('usage execution metadata', () => {
  it('prefers a trusted platform execution id and falls back to a server id', () => {
    expect(
      usageRequestKey(
        { requestContext: { requestId: 'event-request' } },
        { awsRequestId: 'aws-request' },
        () => 'fallback-request',
      ),
    ).toBe('aws-request')
    expect(
      usageRequestKey(
        { requestContext: { requestId: 'invalid request id' } },
        {},
        () => 'fallback-request',
      ),
    ).toBe('fallback-request')
  })

  it('rounds and bounds latency without overflowing the ledger contract', () => {
    expect(elapsedMilliseconds(100, 100.6)).toBe(1)
    expect(elapsedMilliseconds(200, 100)).toBe(0)
    expect(elapsedMilliseconds(0, usageAccountingBounds.maxLatencyMs + 1_000)).toBe(
      usageAccountingBounds.maxLatencyMs,
    )
  })

  it('counts submitted TTS characters as Unicode code points rather than UTF-16 units', () => {
    expect(submittedCharacterCount('Read 🚀 aloud.')).toBe(13)
  })

  it('requires a trusted app version while keeping optional snapshots nullable', () => {
    expect(trustedUsageVersions({ ACADEMY_APP_VERSION: 'build-1' }, 'tutor')).toEqual({
      appVersion: 'build-1',
      engineVersion: null,
      curriculumVersion: null,
    })
    expect(trustedUsageVersions({ COMMIT_REF: 'commit-1', ACADEMY_TUTOR_ENGINE_VERSION: 'tutor-v2' }, 'tutor')).toEqual({
      appVersion: 'commit-1',
      engineVersion: 'tutor-v2',
      curriculumVersion: null,
    })
    expect(() => trustedUsageVersions({}, 'tts')).toThrow(expect.objectContaining({
      statusCode: 503,
      code: 'service_unavailable',
    }))
  })

  it('keeps accounting persistence failures isolated from learner responses', async () => {
    const access = { recordProviderUsage: vi.fn(async () => Promise.reject(new Error('offline'))) }
    await expect(persistProviderUsage(access, { requestKey: 'request' })).resolves.toBe(false)
  })
})
