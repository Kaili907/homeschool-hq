import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import {
  AI_SAFETY_SCHEMA_REGISTRY,
  conversationSessionJsonSchema,
  validateConversationSession,
  validateDataRequest,
  validateParentNotification,
  validateRetentionPolicy,
  validateSafetyEvent,
  validateTutorPermissions,
} from '../../ai-safety/core/index.ts'
import {
  answerWithheldEventFixture,
  deletionRequestFixture,
  emergencyEventFixture,
  exportRequestFixture,
  parentNotificationFixture,
  retentionPolicyFixture,
  studentASessionFixture,
  tutorPermissionsFixture,
} from '../../ai-safety/core/fixtures.ts'

describe('AI Safety runtime contract validation', () => {
  it('accepts every valid seed contract', () => {
    expect(validateConversationSession(studentASessionFixture).success).toBe(true)
    expect(validateSafetyEvent(answerWithheldEventFixture).success).toBe(true)
    expect(validateSafetyEvent(emergencyEventFixture).success).toBe(true)
    expect(validateParentNotification(parentNotificationFixture).success).toBe(true)
    expect(validateTutorPermissions(tutorPermissionsFixture).success).toBe(true)
    expect(validateRetentionPolicy(retentionPolicyFixture).success).toBe(true)
    expect(validateDataRequest(exportRequestFixture).success).toBe(true)
    expect(validateDataRequest(deletionRequestFixture).success).toBe(true)
  })

  it('rejects privacy safeguard weakening and extra raw-audio fields', () => {
    const unsafeSession = {
      ...studentASessionFixture,
      rawMicrophoneRecordingStored: true,
      rawAudioUrl: 'https://example.invalid/recording.wav',
    }
    const result = validateConversationSession(unsafeSession)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          '$.rawMicrophoneRecordingStored',
          '$.rawAudioUrl',
        ]),
      )
    }

    const weakenedPermissions = {
      ...tutorPermissionsFixture,
      parentReviewMode: 'student-private',
      studentPrivacyNotice: 'fully-private',
      voiceDataMode: 'keep-recordings',
    }
    expect(validateTutorPermissions(weakenedPermissions).success).toBe(false)
  })

  it('requires emergency events to say no hotline data or service contact was supplied', () => {
    expect(
      validateSafetyEvent({
        ...emergencyEventFixture,
        hotlineInformationProvided: true,
        emergencyServicesContacted: true,
      }).success,
    ).toBe(false)
  })

  it('rejects chronologically invalid sessions and non-JSON-safe payloads', () => {
    expect(
      validateConversationSession({
        ...studentASessionFixture,
        endedAt: '2026-07-27T13:59:00.000Z',
      }).success,
    ).toBe(false)
    expect(
      validateSafetyEvent({
        ...answerWithheldEventFixture,
        studentExplanation: undefined,
      }).success,
    ).toBe(false)

    const cyclic = { ...answerWithheldEventFixture } as Record<string, unknown>
    cyclic.loop = cyclic
    const result = validateSafetyEvent(cyclic)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.some((issue) => issue.code === 'json-safety')).toBe(true)
    }
  })

  it('rejects accessor payloads without invoking their getter', () => {
    let invoked = false
    const hostile = { ...studentASessionFixture } as Record<string, unknown>
    Object.defineProperty(hostile, 'kind', {
      enumerable: true,
      get() {
        invoked = true
        return 'conversation-session'
      },
    })
    const result = validateConversationSession(hostile)
    expect(result.success).toBe(false)
    expect(invoked).toBe(false)
  })

  it('enforces numeric retention literals rather than coercing strings', () => {
    expect(
      validateRetentionPolicy({
        ...retentionPolicyFixture,
        instructionalHistoryDays: '60',
        safetyEventDays: '180',
        auditHistoryDays: '365',
      }).success,
    ).toBe(false)
    expect(
      validateRetentionPolicy({
        ...retentionPolicyFixture,
        instructionalHistoryDays: 45,
      }).success,
    ).toBe(false)
  })

  it('requires parent approval metadata on approved deletion requests', () => {
    expect(
      validateDataRequest({
        ...deletionRequestFixture,
        status: 'approved',
      }).success,
    ).toBe(false)
    expect(
      validateDataRequest({
        ...deletionRequestFixture,
        status: 'approved',
        approvedBy: { role: 'parent', actorId: 'parent-actor-a' },
        approvedAt: '2026-07-28T15:01:00.000Z',
      }).success,
    ).toBe(true)
  })
})

describe('AI Safety JSON Schema registry', () => {
  it('publishes unique Draft 2020-12 schema documents that are JSON serializable', () => {
    const ids = AI_SAFETY_SCHEMA_REGISTRY.map((schema) => schema.$id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const schema of AI_SAFETY_SCHEMA_REGISTRY) {
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
      expect(JSON.parse(JSON.stringify(schema))).toEqual(schema)
    }
  })

  it('documents the fixed no-raw-recording and safety-exception constraints', () => {
    const json = JSON.stringify(conversationSessionJsonSchema)
    expect(json).toContain('"rawMicrophoneRecordingStored":{"const":false}')
    expect(json).toContain('"safetyExceptionApplies":{"const":true}')
    expect(json).toContain('"parentReviewScope"')
  })

  it('keeps checked-in schema artifacts parseable and ID-aligned with the registry', () => {
    const schemaDirectory = new URL('../../ai-safety/schemas/', import.meta.url)
    const files = readdirSync(schemaDirectory)
      .filter((file) => file.endsWith('.schema.json'))
      .sort()
    expect(files).toHaveLength(AI_SAFETY_SCHEMA_REGISTRY.length)
    const checkedInIds = files
      .map((file) =>
        JSON.parse(
          readFileSync(new URL(file, schemaDirectory), 'utf8'),
        ) as Record<string, unknown>,
      )
      .map((schema) => schema.$id)
      .sort()
    expect(checkedInIds).toEqual(
      AI_SAFETY_SCHEMA_REGISTRY.map((schema) => schema.$id).sort(),
    )
  })
})
