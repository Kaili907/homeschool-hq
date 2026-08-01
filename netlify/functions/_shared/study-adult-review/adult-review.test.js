import { describe, expect, it, vi } from 'vitest'
import { createTestEmailProvider, createTestInAppProvider } from './delivery.js'
import { createInMemoryAdultReviewStore } from './memory-store.js'
import { createAdultReviewOutboxWorker } from './outbox-worker.js'
import { createAdultReviewProposalService } from './proposal.js'
import { createTestRecipientResolver, validRecipientResolution } from './recipients.js'

const IDS = Object.freeze({
  actor: '11111111-1111-4111-8111-111111111111',
  request: '22222222-2222-4222-8222-222222222222',
  household: '33333333-3333-4333-8333-333333333333',
  student: '44444444-4444-4444-8444-444444444444',
  session: '55555555-5555-4555-8555-555555555555',
})
const DECISION = Object.freeze({
  classificationVersion: 1,
  classifierVersion: 'test-safety-classifier-v1',
  outcome: 'urgent',
  categories: ['self-harm-or-immediate-danger'],
  reasonCodes: ['safety-urgent-suicide-intent-current-v1', 'safety-provider-urgent-v1'],
})
const CONTEXT = Object.freeze({
  actorUserId: IDS.actor,
  householdId: IDS.household,
  studentId: IDS.student,
  sessionId: IDS.session,
})
const NOW_ISO = '2026-08-01T12:00:00.000Z'

async function proposedStore() {
  const store = createInMemoryAdultReviewStore()
  const service = createAdultReviewProposalService({ persistence: store, now: () => Date.parse(NOW_ISO) })
  const result = await service.propose({
    decision: DECISION,
    context: CONTEXT,
    requestId: IDS.request,
    sessionId: IDS.session,
  })
  return { store, service, proposalId: result.proposalId }
}

function recipients(routes = [
  { channel: 'email', routeRef: 'email-route:guardian-one' },
  { channel: 'in-app', routeRef: 'in-app-route:guardian-one' },
]) {
  return [{
    recipientRef: 'recipient:guardian-one',
    membershipRef: 'membership:guardian-one',
    learnerRelationshipRef: 'relationship:student-one',
    notificationPermissionRef: 'notification-permission:safety-one',
    relationship: 'guardian',
    routes,
  }]
}

describe('minimized adult-review proposal and recipient boundary', () => {
  it('records only approved fields and makes duplicate creation idempotent', async () => {
    const { store, service, proposalId } = await proposedStore()
    const duplicate = await service.propose({ decision: DECISION, context: CONTEXT, requestId: IDS.request, sessionId: IDS.session })
    expect(duplicate).toEqual({ state: 'duplicate-not-delivered', proposalId })
    const snapshot = store.snapshot()
    expect(snapshot.proposals).toHaveLength(1)
    expect(Object.keys(snapshot.proposals[0].proposal).sort()).toEqual([
      'authorizedRecipientResolutionState', 'category', 'classification', 'classifierVersion', 'deliveryState',
      'householdId', 'idempotencyKey', 'occurredAt', 'proposalId', 'reasonCodes', 'schemaVersion', 'sessionId',
      'studentId', 'urgency',
    ])
    expect(JSON.stringify(snapshot)).not.toContain('raw')
    expect(JSON.stringify(snapshot)).not.toContain('transcript')
  })

  it('fails closed on a reused request id with conflicting classification semantics', async () => {
    const { store, service } = await proposedStore()
    const conflict = await service.propose({
      decision: {
        ...DECISION,
        outcome: 'uncertain',
        reasonCodes: ['safety-uncertain-self-harm-v1', 'safety-provider-uncertain-v1'],
      },
      context: CONTEXT,
      requestId: IDS.request,
      sessionId: IDS.session,
    })
    expect(conflict).toEqual({ state: 'not-confirmed' })
    expect(store.snapshot().proposals).toHaveLength(1)
    expect(store.snapshot().proposals[0].proposal.classification).toBe('urgent')
  })

  it('rejects raw disclosure and unknown fields at the persistence boundary', async () => {
    const store = createInMemoryAdultReviewStore()
    await expect(store.createProposal({
      proposal: {
        schemaVersion: 1,
        proposalId: 'safety-proposal-forged',
        householdId: IDS.household,
        studentId: IDS.student,
        sessionId: IDS.session,
        category: 'student-support',
        classification: 'urgent',
        urgency: 'urgent',
        reasonCodes: ['safety-provider-urgent-v1'],
        classifierVersion: 'test-safety-classifier-v1',
        occurredAt: NOW_ISO,
        idempotencyKey: `study-safety:${'a'.repeat(64)}`,
        deliveryState: 'proposed-not-delivered',
        authorizedRecipientResolutionState: 'pending',
        rawDisclosure: 'synthetic-sensitive-content',
      },
    })).rejects.toThrow('invalid_adult_review_proposal')
    expect(JSON.stringify(store.snapshot())).not.toContain('synthetic-sensitive-content')
  })

  it('accepts only exact opaque recipient/permission/route evidence', () => {
    const valid = {
      state: 'resolved',
      resolutionRef: 'resolution:test-v1',
      policyVersion: 'policy:adult-notification-v1',
      recipients: recipients(),
    }
    expect(validRecipientResolution(valid)).toBe(true)
    expect(validRecipientResolution({ ...valid, rawText: 'sentinel' })).toBe(false)
    expect(validRecipientResolution({
      ...valid,
      recipients: [{ ...recipients()[0], email: 'spoof@example.test' }],
    })).toBe(false)
    expect(validRecipientResolution({
      ...valid,
      recipients: [{ ...recipients()[0], routes: [{ channel: 'email', routeRef: 'email-route:x', destination: 'spoof@example.test' }] }],
    })).toBe(false)
    expect(validRecipientResolution({
      ...valid,
      recipients: [{ ...recipients()[0], recipientRef: '5555550100' }],
    })).toBe(false)
  })
})

describe('per-route outbox delivery and evidence', () => {
  it('creates one job per authorized route and delivers only with verified receipts', async () => {
    const { store, proposalId } = await proposedStore()
    const resolver = createTestRecipientResolver({ proposalRef: proposalId, recipients: recipients() })
    const email = createTestEmailProvider()
    const inApp = createTestInAppProvider()
    const worker = createAdultReviewOutboxWorker({ store, recipientResolver: resolver, providers: [email, inApp], now: () => Date.parse(NOW_ISO) })
    expect(await worker.resolvePending()).toEqual({ proposalsClaimed: 1, jobsEnqueued: 2 })
    const results = await worker.deliver()
    expect(results.map((entry) => entry.state)).toEqual(['delivered', 'delivered'])
    const snapshot = store.snapshot()
    expect(snapshot.outbox).toHaveLength(2)
    expect(snapshot.outbox.every((entry) => entry.state === 'delivered')).toBe(true)
    expect(snapshot.receipts).toHaveLength(2)
    expect(email.stats()).toEqual({ calls: 1, uniqueDeliveries: 1 })
    expect(inApp.stats()).toEqual({ calls: 1, uniqueDeliveries: 1 })
    expect(JSON.stringify(snapshot)).not.toContain('@')
  })

  it('marks a provider-accepted/response-lost result indeterminate and never retries blindly', async () => {
    let now = Date.parse(NOW_ISO)
    const { store, proposalId } = await proposedStore()
    const resolver = createTestRecipientResolver({
      proposalRef: proposalId,
      recipients: recipients([{ channel: 'email', routeRef: 'email-route:guardian-one' }]),
    })
    const email = createTestEmailProvider({ script: [{ state: 'delivered-then-throw' }] })
    const worker = createAdultReviewOutboxWorker({
      store, recipientResolver: resolver, providers: [email], now: () => now, baseRetryMs: 100, maxRetryMs: 100,
    })
    await worker.resolvePending()
    expect((await worker.deliver())[0].state).toBe('indeterminate')
    now += 101
    expect(await worker.deliver()).toEqual([])
    expect(email.stats()).toEqual({ calls: 1, uniqueDeliveries: 1 })
    expect(store.snapshot().outbox[0].state).toBe('indeterminate')
  })

  it('clamps temporary retries and stops after the server-owned maximum attempts', async () => {
    let now = Date.parse(NOW_ISO)
    const { store, proposalId } = await proposedStore()
    const resolver = createTestRecipientResolver({
      proposalRef: proposalId,
      recipients: recipients([{ channel: 'email', routeRef: 'email-route:guardian-one' }]),
    })
    const email = createTestEmailProvider({ script: [
      { state: 'temporary-failure', retryAt: '2099-01-01T00:00:00.000Z' },
      { state: 'temporary-failure', retryAt: '2099-01-01T00:00:00.000Z' },
    ] })
    const worker = createAdultReviewOutboxWorker({
      store, recipientResolver: resolver, providers: [email], now: () => now,
      baseRetryMs: 100, maxRetryMs: 100, maxAttempts: 2,
    })
    await worker.resolvePending()
    await worker.deliver()
    expect(store.snapshot().outbox[0].retryAt).toBe(new Date(now + 100).toISOString())
    now += 101
    await worker.deliver()
    now += 101
    expect((await worker.deliver())[0].state).toBe('permanent-failure')
    expect(email.stats().calls).toBe(2)
  })

  it('does not call a provider after recipient-route revocation', async () => {
    const { store, proposalId } = await proposedStore()
    const revoked = new Set(['email-route:guardian-one'])
    const resolver = createTestRecipientResolver({
      proposalRef: proposalId,
      recipients: recipients([{ channel: 'email', routeRef: 'email-route:guardian-one' }]),
      revokedRouteRefs: revoked,
    })
    const email = createTestEmailProvider()
    const worker = createAdultReviewOutboxWorker({ store, recipientResolver: resolver, providers: [email], now: () => Date.parse(NOW_ISO) })
    await worker.resolvePending()
    expect((await worker.deliver())[0].state).toBe('permanent-failure')
    expect(email.stats()).toEqual({ calls: 0, uniqueDeliveries: 0 })
  })

  it('never calls accepted/queued evidence delivered', async () => {
    const { store, proposalId } = await proposedStore()
    const resolver = createTestRecipientResolver({
      proposalRef: proposalId,
      recipients: recipients([{ channel: 'in-app', routeRef: 'in-app-route:guardian-one' }]),
    })
    const inApp = createTestInAppProvider({ script: [{ state: 'accepted-awaiting-receipt' }] })
    const worker = createAdultReviewOutboxWorker({ store, recipientResolver: resolver, providers: [inApp], now: () => Date.parse(NOW_ISO) })
    await worker.resolvePending()
    expect((await worker.deliver())[0].state).toBe('indeterminate')
    const snapshot = store.snapshot()
    expect(snapshot.outbox[0].state).toBe('indeterminate')
    expect(snapshot.receipts).toHaveLength(0)
    expect(snapshot.outbox[0]).not.toHaveProperty('deliveredAt')
  })

  it('rejects one provider receipt reused across two immutable attempts', async () => {
    const { store, proposalId } = await proposedStore()
    const resolver = createTestRecipientResolver({
      proposalRef: proposalId,
      recipients: recipients([
        { channel: 'email', routeRef: 'email-route:guardian-one' },
        { channel: 'email', routeRef: 'email-route:guardian-two' },
      ]),
    })
    const attemptByRoute = new Map()
    const provider = {
      channel: 'email',
      providerVersion: 'test-email-replay-v1',
      isDurable: false,
      isTestProvider: true,
      supportsDurableIdempotency: true,
      isReady: () => true,
      async deliver(input) {
        attemptByRoute.set(input.routeRef, input.attemptId)
        return { state: 'delivered', providerReceiptRef: 'same-provider-receipt' }
      },
    }
    const validator = {
      channel: 'email', isDurable: false, isTestProvider: true, isReady: () => true,
      async verifyReceipt(input) {
        return { verified: true, attemptId: attemptByRoute.get(input.routeRef), evidenceRef: 'verified-replay-evidence' }
      },
    }
    const worker = createAdultReviewOutboxWorker({
      store,
      recipientResolver: resolver,
      providers: [provider],
      receiptValidators: [validator],
      now: () => Date.parse(NOW_ISO),
    })
    await worker.resolvePending()
    expect((await worker.deliver()).map((entry) => entry.state)).toEqual(['delivered', 'indeterminate'])
    expect(store.snapshot().receipts).toHaveLength(1)
  })

  it('emits sanitized backlog, recipient, and repeated-delivery evidence', async () => {
    let now = Date.parse(NOW_ISO)
    const { store, proposalId } = await proposedStore()
    const events = []
    const monitoring = { record: async (event) => events.push(event) }
    const resolver = createTestRecipientResolver({
      proposalRef: proposalId,
      recipients: recipients([{ channel: 'email', routeRef: 'email-route:guardian-one' }]),
    })
    const email = createTestEmailProvider({ script: [{ state: 'temporary-failure' }, { state: 'permanent-failure' }] })
    const worker = createAdultReviewOutboxWorker({
      store, recipientResolver: resolver, providers: [email], monitoring, now: () => now,
      backlogAlertCount: 1, baseRetryMs: 1, maxRetryMs: 1,
    })
    await worker.resolvePending()
    await worker.deliver()
    now += 2
    await worker.deliver()
    expect(events.some((event) => event.name === 'study_safety.outbox_backlog')).toBe(true)
    expect(events.some((event) => event.name === 'study_safety.delivery_repeated_failure')).toBe(true)
    expect(JSON.stringify(events)).not.toContain(proposalId)
    expect(JSON.stringify(events)).not.toContain('guardian-one')
  })
})
