import { describe, expect, it } from 'vitest'
import { emptyDurableStudyDocument } from '../../../family-pilot/durable-ports/schema'
import { buildFirstLinkImportArgs, buildRevisionedWriteArgs, parseHostedSyncSnapshot } from './contracts'
import type { HostedSyncIdentity } from './types'

const NOW = '2026-08-13T18:00:00.000Z'
const IDENTITY: HostedSyncIdentity = {
  householdRef: 'household:one',
  learnerRef: 'learner:ada',
  documentRef: 'durable-study-v1',
}
const OPERATION_ID = '11111111-1111-4111-8111-111111111111'

describe('hosted sync R2 exact privacy contract', () => {
  it('accepts the canonical minimized document and returns an isolated frozen copy', () => {
    const document = emptyDurableStudyDocument(IDENTITY, NOW)
    const parsed = parseHostedSyncSnapshot({ documentSchemaVersion: 1, document }, IDENTITY)
    expect(parsed?.document).toEqual(document)
    expect(parsed?.document).not.toBe(document)
    expect(Object.isFrozen(parsed?.document)).toBe(true)
  })

  it.each([
    ['rawResponse', 'learner prose'],
    ['tutorMessage', 'verbatim tutor prose'],
    ['pin', '1234'],
    ['answerText', 'forty two'],
    ['serviceRoleKey', 'secret'],
  ])('refuses forbidden %s authority instead of stripping it', (field, secret) => {
    const document = { ...emptyDurableStudyDocument(IDENTITY, NOW), [field]: secret }
    expect(parseHostedSyncSnapshot({ documentSchemaVersion: 1, document }, IDENTITY)).toBeNull()
  })

  it('requires adult-confirmed first link, stable UUID, exact local scope, and CAS revision', () => {
    const snapshot = { documentSchemaVersion: 1 as const, document: emptyDurableStudyDocument(IDENTITY, NOW) }
    expect(buildFirstLinkImportArgs({
      identity: IDENTITY,
      operationId: OPERATION_ID,
      baseRevision: 0,
      adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED',
      confirmedAt: NOW,
      snapshot,
    })).not.toBeNull()
    expect(buildRevisionedWriteArgs({
      identity: IDENTITY,
      operationId: 'not-a-uuid',
      baseRevision: 1,
      snapshot,
    })).toBeNull()
    expect(buildRevisionedWriteArgs({
      identity: { ...IDENTITY, learnerRef: 'learner:other' },
      operationId: OPERATION_ID,
      baseRevision: 1,
      snapshot,
    })).toBeNull()
  })
})
