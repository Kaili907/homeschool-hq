import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  createExternalProviderAdapter,
  createNotReadyExternalProvider,
} from './external-provider.js'
import { createDurableInAppProvider } from './in-app-provider.js'
import { validateVerifiedAdultReviewReceipt } from './receipt-contract.js'
import { createAdultReviewWorker } from '../study-adult-review-operations/worker.js'
import { createAdultReviewOutboxWorker } from '../study-adult-review/outbox-worker.js'
import { createTestInAppProvider } from '../study-adult-review/delivery.js'
import { createInMemoryAdultReviewStore } from '../study-adult-review/memory-store.js'
import { createAdultReviewProposalService } from '../study-adult-review/proposal.js'
import { createTestRecipientResolver } from '../study-adult-review/recipients.js'
import { createGuardianNotificationPort } from '../study-adult-review/guardian-notifications.js'

/**
 * Server identifier hardening for the durable Study delivery estate.
 *
 * Two properties are proven here.
 *
 * 1. Namespace. The durable estate mints delivery keys as
 *    `'delivery:' || academy_private.study_sha256_json(...)`
 *    (20260801170000_academy_study_adult_review_operations.sql:1314). The
 *    synthetic `study-safety-delivery:<sha256>` namespace is not durable and
 *    must not survive anywhere in the server tree, in either direction: no
 *    generator emits it and no validator accepts it.
 *
 * 2. Primitive-first identifier boundaries. `RegExp#test` coerces its argument,
 *    so an unguarded pattern check admits a hostile carrier object whose
 *    `toString`/`valueOf` yields a canonical identifier it does not hold. Such a
 *    carrier must never reach a durable port, a hosted RPC payload, or a
 *    successful delivery result.
 */

const DIGEST = 'a'.repeat(64)
const OTHER_DIGEST = 'b'.repeat(64)
const RECIPIENT_DIGEST = 'c'.repeat(64)
const DELIVERY_KEY = `delivery:${DIGEST}`
const LEGACY_DELIVERY_KEY = `study-safety-delivery:${DIGEST}`
const ROUTE_REF = `route:${OTHER_DIGEST}`
const RECIPIENT_REF = `recipient:${RECIPIENT_DIGEST}`
const RECEIPT_REF = `in-app-receipt:${DIGEST}`
const EVIDENCE_REF = `in-app-evidence:${DIGEST}`
const ACTION_REF = 'adult-review:safety-proposal-0123456789abcdef0123456789abcdef'
const NOW = new Date('2026-08-01T12:00:00.000Z')

/** A non-string that presents a canonical identifier through coercion only. */
function carrier(value) {
  return { toString: () => value, valueOf: () => value }
}

const AUTHORITY = Object.freeze({
  verified: true,
  schemaVersion: 1,
  workerIdentity: 'worker:synthetic',
  credentialId: 'worker-credential:synthetic',
  credentialVersion: 'worker-credential-v2',
  scope: 'study:adult-review:delivery',
  expiresAt: '2099-08-01T12:05:00.000Z',
  revoked: false,
  verifierVersion: 'worker-verifier-v1',
  verificationRef: 'worker-verification:synthetic',
})

// ---------------------------------------------------------------------------
// Part A — the legacy delivery namespace must not survive in the server tree
// ---------------------------------------------------------------------------

/**
 * The in-memory adult-review stack is exercised through its own factories so
 * the key generator and the enqueue validator are proven on the real path.
 */
const GUARDIAN = Object.freeze({
  recipientRef: 'recipient:guardian-one',
  membershipRef: 'membership:guardian-one',
  learnerRelationshipRef: 'relationship:student-one',
  notificationPermissionRef: 'notification-permission:safety-one',
  relationship: 'guardian',
  routes: [{ channel: 'in-app', routeRef: 'in-app-route:guardian-one' }],
})

async function proposedStore() {
  const store = createInMemoryAdultReviewStore()
  const service = createAdultReviewProposalService({
    persistence: store,
    now: () => NOW.getTime(),
  })
  const { proposalId } = await service.propose({
    decision: {
      classificationVersion: 1,
      classifierVersion: 'test-safety-classifier-v1',
      outcome: 'urgent',
      categories: ['self-harm-or-immediate-danger'],
      reasonCodes: ['safety-urgent-suicide-intent-current-v1', 'safety-provider-urgent-v1'],
    },
    context: {
      actorUserId: '11111111-1111-4111-8111-111111111111',
      householdId: '33333333-3333-4333-8333-333333333333',
      studentId: '44444444-4444-4444-8444-444444444444',
      sessionId: '55555555-5555-4555-8555-555555555555',
    },
    requestId: '22222222-2222-4222-8222-222222222222',
    sessionId: '55555555-5555-4555-8555-555555555555',
  })
  return { store, proposalId }
}

function testResolver(proposalRef) {
  return createTestRecipientResolver({ proposalRef, recipients: [GUARDIAN] })
}

function serverSources(directory, collected = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) serverSources(path, collected)
    else if (entry.name.endsWith('.test.js')) continue
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) collected.push(path)
  }
  return collected
}

describe('legacy delivery namespace', () => {
  const functionsRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

  it('appears in no non-test server source under netlify/functions', () => {
    // The namespace is the prefixed identifier form. `study-safety-delivery-v1`
    // survives in outbox-worker.js only as a hash domain-separation tag inside a
    // digest preimage; it is never an identifier. Test files legitimately name
    // the legacy form as a value that must be rejected, so they are excluded.
    const namespace = `${LEGACY_DELIVERY_KEY.split(':')[0]}:`
    const offenders = serverSources(functionsRoot)
      .filter((path) => readFileSync(path, 'utf8').includes(namespace))
      .map((path) => relative(functionsRoot, path))
    expect(offenders).toEqual([])
  })

  it('is not minted by the in-memory adult-review outbox stack', async () => {
    const { store, proposalId } = await proposedStore()
    const worker = createAdultReviewOutboxWorker({
      store,
      recipientResolver: testResolver(proposalId),
      providers: [createTestInAppProvider()],
      now: () => NOW.getTime(),
    })

    await expect(worker.resolvePending()).resolves.toMatchObject({ jobsEnqueued: 1 })
    const [job] = store.snapshot().outbox
    expect(job.deliveryIdempotencyKey).toMatch(/^delivery:[a-f0-9]{64}$/)
  })

  it('is rejected by the not-ready external provider delivery boundary', async () => {
    const provider = createNotReadyExternalProvider('email')
    const attempt = {
      attemptId: 'attempt-1',
      recipientRef: RECIPIENT_REF,
      routeRef: 'email-route:synthetic',
      templateCode: 'study-safety-adult-review-v1',
    }
    await expect(provider.deliver({ ...attempt, idempotencyKey: DELIVERY_KEY }))
      .resolves.toEqual({ state: 'indeterminate', failureCode: 'provider-not-ready' })
    await expect(provider.deliver({ ...attempt, idempotencyKey: LEGACY_DELIVERY_KEY }))
      .rejects.toThrow('invalid_external_delivery_input')
  })

  it('is rejected by the adult-review test provider attempt boundary', async () => {
    const provider = createTestInAppProvider()
    const attempt = {
      attemptId: 'attempt-1',
      recipientRef: RECIPIENT_REF,
      routeRef: 'in-app-route:synthetic',
      templateCode: 'study-safety-adult-review-v1',
    }
    await expect(provider.deliver({ ...attempt, idempotencyKey: DELIVERY_KEY }))
      .resolves.toMatchObject({ state: 'delivered' })
    await expect(provider.deliver({ ...attempt, idempotencyKey: LEGACY_DELIVERY_KEY }))
      .rejects.toThrow('invalid_delivery_attempt')
  })

  it('is rejected by the in-memory outbox enqueue boundary', async () => {
    const { store, proposalId } = await proposedStore()
    const [claimed] = await store.claimUnresolvedProposals({ now: NOW.toISOString(), limit: 1 })
    const enqueue = (deliveryIdempotencyKey) => store.recordRecipientResolutionAndEnqueue({
      proposalId,
      proposalLeaseToken: claimed.leaseToken,
      resolutionRef: 'resolution:test-v1',
      policyVersion: 'policy:adult-notification-v1',
      routes: [{
        recipientRef: GUARDIAN.recipientRef,
        routeRef: GUARDIAN.routes[0].routeRef,
        channel: GUARDIAN.routes[0].channel,
        deliveryIdempotencyKey,
      }],
      enqueuedAt: NOW.toISOString(),
    })

    await expect(enqueue(LEGACY_DELIVERY_KEY)).rejects.toThrow('invalid_recipient_route_job')
    await expect(enqueue(DELIVERY_KEY)).resolves.toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Part B — recipient ref: primitive-first, and exactly the durable shape
// ---------------------------------------------------------------------------

const PROVIDER_DELIVERY = Object.freeze({
  idempotencyKey: DELIVERY_KEY,
  jobId: 'job:1',
  attemptId: 'attempt:1',
  proposalId: 'safety-proposal-1',
  householdId: 'household:1',
  studentId: 'student:1',
  recipientRef: RECIPIENT_REF,
  routeRef: ROUTE_REF,
  templateCode: 'study-safety-adult-review-v1',
})

const BINDING = Object.freeze({
  providerReceiptRef: RECEIPT_REF,
  providerName: 'academy-in-app',
  route: 'in-app',
  routeRef: ROUTE_REF,
  jobId: PROVIDER_DELIVERY.jobId,
  attemptId: PROVIDER_DELIVERY.attemptId,
  proposalId: PROVIDER_DELIVERY.proposalId,
  householdId: PROVIDER_DELIVERY.householdId,
  studentId: PROVIDER_DELIVERY.studentId,
  recipientRef: RECIPIENT_REF,
  deliveryIdempotencyKey: DELIVERY_KEY,
  providerConfigVersion: 'in-app-config-v1',
})

const RECEIPT = Object.freeze({
  ...BINDING,
  verified: true,
  receiptSchemaVersion: 1,
  deliveredAt: '2026-08-01T12:00:10.000Z',
  evidenceRef: EVIDENCE_REF,
  eventIdempotencyKey: 'receipt-event:1',
  receiptSource: 'server-verified',
  testReceipt: false,
})

function insertResult(overrides = {}) {
  return {
    state: 'delivered',
    providerReceiptRef: RECEIPT_REF,
    jobId: PROVIDER_DELIVERY.jobId,
    attemptId: PROVIDER_DELIVERY.attemptId,
    proposalId: PROVIDER_DELIVERY.proposalId,
    householdId: PROVIDER_DELIVERY.householdId,
    studentId: PROVIDER_DELIVERY.studentId,
    deliveryIdempotencyKey: PROVIDER_DELIVERY.idempotencyKey,
    recipientRef: PROVIDER_DELIVERY.recipientRef,
    routeRef: PROVIDER_DELIVERY.routeRef,
    providerName: 'academy-in-app',
    providerConfigVersion: 'in-app-config-v1',
    notification: {
      title: 'Study check-in needs your review',
      reasonCategory: 'immediate-safety',
      urgency: 'urgent',
      actionRef: ACTION_REF,
    },
    ...overrides,
  }
}

function inAppProvider(overrides = {}) {
  const persistence = {
    isDurable: true,
    isReady: () => true,
    insertNotification: vi.fn(async () => insertResult()),
    verifyNotificationReceipt: vi.fn(async () => RECEIPT),
    ...overrides,
  }
  return {
    persistence,
    configured: createDurableInAppProvider({
      persistence,
      adultReviewInAppDeliveryPolicy: 'approved',
      environment: 'production',
    }),
  }
}

/**
 * The recipient ref is carried by `recipient`, not `delivery`; `delivery`
 * repeats it only when the claim already holds it. Requests that exercise the
 * recipient boundary omit it there so the cross-field equality check cannot
 * mask a missing type guard.
 */
function deliveryRequest(patch = {}, recipientRef) {
  const delivery = { ...PROVIDER_DELIVERY, ...patch }
  if (recipientRef !== undefined) delete delivery.recipientRef
  return {
    delivery,
    recipient: { recipientRef: recipientRef === undefined ? RECIPIENT_REF : recipientRef },
    workerContext: AUTHORITY,
    trigger: 'scheduled',
    onAttemptSubmitted: vi.fn(async () => undefined),
  }
}

function readyPort(extra = {}) {
  return { isReady: () => true, ...extra }
}

function workerFixture(recipientRef = RECIPIENT_REF) {
  const claim = {
    claimId: 'claim:1',
    jobId: PROVIDER_DELIVERY.jobId,
    proposalId: PROVIDER_DELIVERY.proposalId,
    householdId: PROVIDER_DELIVERY.householdId,
    studentId: PROVIDER_DELIVERY.studentId,
    routeRef: ROUTE_REF,
    idempotencyKey: DELIVERY_KEY,
    templateCode: 'study-safety-adult-review-v1',
    attemptId: PROVIDER_DELIVERY.attemptId,
    leaseToken: 'lease:1',
    leaseRevision: 3,
    leaseExpiresAt: '2026-08-01T12:01:00.000Z',
  }
  const lease = {
    active: true,
    claimId: claim.claimId,
    jobId: claim.jobId,
    leaseToken: claim.leaseToken,
    leaseRevision: claim.leaseRevision,
    leaseExpiresAt: claim.leaseExpiresAt,
  }
  const attempt = {
    current: true,
    attemptId: claim.attemptId,
    jobId: claim.jobId,
    leaseToken: claim.leaseToken,
    deliveryIdempotencyKey: DELIVERY_KEY,
    providerName: 'academy-in-app',
    providerConfigVersion: 'in-app-config-v1',
  }
  const persistence = readyPort({
    claim: vi.fn(async () => [claim]),
    cancel: vi.fn(async () => undefined),
    validateLease: vi.fn(async () => ({ ...lease })),
    renewLease: vi.fn(async () => ({ ...lease })),
    releaseLease: vi.fn(async () => undefined),
    recordAttemptSubmitted: vi.fn(async () => ({ ...attempt })),
    validateCurrentAttempt: vi.fn(async () => ({ ...attempt })),
    commitReceipt: vi.fn(async () => ({
      committed: true,
      replayed: false,
      receiptId: RECEIPT.providerReceiptRef,
      eventIdempotencyKey: RECEIPT.eventIdempotencyKey,
      attemptId: RECEIPT.attemptId,
      jobId: RECEIPT.jobId,
    })),
    markIndeterminate: vi.fn(async () => undefined),
  })
  const provider = readyPort({
    channel: 'in-app',
    providerName: 'academy-in-app',
    providerConfigVersion: 'in-app-config-v1',
    adultReviewInAppDeliveryPolicy: 'approved',
    isDurable: true,
    isTestProvider: false,
    deliver: vi.fn(async ({ onAttemptSubmitted }) => {
      await onAttemptSubmitted({ attemptId: claim.attemptId })
      return { submitted: true, attemptId: claim.attemptId, receipt: RECEIPT }
    }),
  })
  const worker = createAdultReviewWorker({
    persistence,
    resolver: readyPort({ resolve: vi.fn(async () => ({ recipient: { recipientRef } })) }),
    provider,
    monitor: readyPort({ record: vi.fn(async () => undefined) }),
    schema: readyPort({ safeParse: (value) => ({ success: true, data: value }) }),
    workerCredentialVerifier: readyPort({ isDurable: true, verify: vi.fn(async () => AUTHORITY) }),
    workerCredentialVersion: AUTHORITY.credentialVersion,
    now: () => new Date(NOW),
    environment: 'production',
  })
  return { worker, persistence, provider, claim }
}

describe('durable recipient ref at the in-app delivery boundary', () => {
  it('accepts the durable recipient:<sha256> form', async () => {
    const { configured, persistence } = inAppProvider()
    await expect(configured.deliver(deliveryRequest())).resolves.toMatchObject({ verified: true })
    expect(persistence.insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientRef: RECIPIENT_REF }),
    )
  })

  it('does not let a hostile recipient carrier reach the durable port', async () => {
    const hostile = carrier(RECIPIENT_REF)
    const { configured, persistence } = inAppProvider()
    await expect(configured.deliver(deliveryRequest({}, hostile)))
      .rejects.toThrow('invalid_in_app_delivery')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
    expect(`${hostile}`).toBe(RECIPIENT_REF)
  })

  it.each([
    ['non-hex suffix', 'recipient:guardian-1'],
    ['uppercase digest', `recipient:${'C'.repeat(64)}`],
    ['short digest', `recipient:${'c'.repeat(63)}`],
    ['long digest', `recipient:${'c'.repeat(65)}`],
    ['wrong prefix', `notrecipient:${RECIPIENT_DIGEST}`],
    ['no prefix', RECIPIENT_DIGEST],
    ['array carrier', [RECIPIENT_REF]],
    ['number', 1],
    ['null', null],
  ])('rejects a recipient ref that is a %s', async (_label, recipientRef) => {
    const { configured, persistence } = inAppProvider()
    await expect(configured.deliver(deliveryRequest({}, recipientRef)))
      .rejects.toThrow('invalid_in_app_delivery')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })

  it('does not let a hostile recipient carrier reach the durable verify port', async () => {
    const { configured, persistence } = inAppProvider()
    await expect(configured.verifyReceipt({
      ...BINDING,
      recipientRef: carrier(RECIPIENT_REF),
      workerContext: AUTHORITY,
    })).rejects.toThrow('invalid_in_app_receipt_request')
    expect(persistence.verifyNotificationReceipt).not.toHaveBeenCalled()
  })
})

describe('durable recipient ref at the worker claim binding', () => {
  it('accepts the durable recipient:<sha256> form', async () => {
    const { worker, persistence, claim } = workerFixture()
    await expect(worker.processClaim(claim, { trigger: 'scheduled' }, AUTHORITY))
      .resolves.toEqual({ deliveryId: claim.jobId, status: 'delivered' })
    expect(persistence.recordAttemptSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({ recipientRef: RECIPIENT_REF }),
    )
  })

  it('does not let a hostile recipient carrier reach the durable attempt port', async () => {
    const hostile = carrier(RECIPIENT_REF)
    const { worker, persistence, provider, claim } = workerFixture(hostile)
    await expect(worker.processClaim(claim, { trigger: 'scheduled' }, AUTHORITY))
      .rejects.toThrow('delivery_binding_incomplete')
    expect(provider.deliver).not.toHaveBeenCalled()
    expect(persistence.recordAttemptSubmitted).not.toHaveBeenCalled()
    expect(`${hostile}`).toBe(RECIPIENT_REF)
  })

  it('rejects a recipient ref that is not the durable recipient:<sha256> form', async () => {
    const { worker, persistence, claim } = workerFixture('recipient:guardian-1')
    await expect(worker.processClaim(claim, { trigger: 'scheduled' }, AUTHORITY))
      .rejects.toThrow('delivery_binding_incomplete')
    expect(persistence.recordAttemptSubmitted).not.toHaveBeenCalled()
  })
})

describe('durable recipient ref in the adult-review receipt contract', () => {
  it('accepts the durable recipient:<sha256> form', () => {
    expect(validateVerifiedAdultReviewReceipt({ ...RECEIPT }, BINDING, { environment: 'production' }))
      .toEqual(RECEIPT)
  })

  it('rejects a hostile recipient carrier before any binding comparison', () => {
    const hostile = carrier(RECIPIENT_REF)
    expect(() => validateVerifiedAdultReviewReceipt(
      { ...RECEIPT, recipientRef: hostile },
      { ...BINDING, recipientRef: hostile },
      { environment: 'production' },
    )).toThrow('receipt_schema_mismatch')
  })

  it('rejects a recipient ref that is not the durable recipient:<sha256> form', () => {
    expect(() => validateVerifiedAdultReviewReceipt(
      { ...RECEIPT, recipientRef: 'recipient:guardian-1' },
      { ...BINDING, recipientRef: 'recipient:guardian-1' },
      { environment: 'production' },
    )).toThrow('receipt_schema_mismatch')
  })
})

// ---------------------------------------------------------------------------
// Part C — action ref
// ---------------------------------------------------------------------------

describe('notification action ref', () => {
  it('accepts the durable adult-review:<proposalId> form', async () => {
    const { configured } = inAppProvider()
    await expect(configured.deliver(deliveryRequest())).resolves.toMatchObject({
      notification: { actionRef: ACTION_REF },
    })
  })

  it('does not let a hostile action-ref carrier survive into a delivery result', async () => {
    const hostile = carrier(ACTION_REF)
    const { configured } = inAppProvider({
      insertNotification: vi.fn(async () => insertResult({
        notification: {
          title: 'Study check-in needs your review',
          reasonCategory: 'immediate-safety',
          urgency: 'urgent',
          actionRef: hostile,
        },
      })),
    })
    await expect(configured.deliver(deliveryRequest()))
      .rejects.toThrow('in_app_persistence_contract')
    expect(`${hostile}`).toBe(ACTION_REF)
  })
})

// ---------------------------------------------------------------------------
// Part D — adjacent receipt / evidence / provider identifier boundaries
// ---------------------------------------------------------------------------

describe('adjacent identifier boundaries are primitive-first', () => {
  it('does not let a hostile provider-receipt carrier reach the durable verify port', async () => {
    const hostile = carrier(RECEIPT_REF)
    const { configured, persistence } = inAppProvider({
      insertNotification: vi.fn(async () => insertResult({ providerReceiptRef: hostile })),
    })
    await expect(configured.deliver(deliveryRequest()))
      .rejects.toThrow('in_app_persistence_contract')
    expect(persistence.verifyNotificationReceipt).not.toHaveBeenCalled()
    expect(`${hostile}`).toBe(RECEIPT_REF)
  })

  it('does not let a hostile provider-receipt carrier into a verification request', async () => {
    const { configured, persistence } = inAppProvider()
    await expect(configured.verifyReceipt({
      ...BINDING,
      providerReceiptRef: carrier(RECEIPT_REF),
      workerContext: AUTHORITY,
    })).rejects.toThrow('invalid_in_app_receipt_request')
    expect(persistence.verifyNotificationReceipt).not.toHaveBeenCalled()
  })

  it('does not let a hostile evidence carrier become verified receipt evidence', async () => {
    const { configured } = inAppProvider({
      verifyNotificationReceipt: vi.fn(async () => ({
        ...RECEIPT,
        evidenceRef: carrier(EVIDENCE_REF),
      })),
    })
    await expect(configured.deliver(deliveryRequest()))
      .rejects.toThrow('in_app_persistence_contract')
  })

  it.each([
    ['idempotencyKey', DELIVERY_KEY],
    ['attemptId', 'attempt-1'],
    ['recipientRef', RECIPIENT_REF],
    ['routeRef', 'email-route:synthetic'],
  ])('rejects a hostile %s carrier at the external delivery boundary', async (key, value) => {
    const provider = createNotReadyExternalProvider('email')
    const attempt = {
      idempotencyKey: DELIVERY_KEY,
      attemptId: 'attempt-1',
      recipientRef: RECIPIENT_REF,
      routeRef: 'email-route:synthetic',
      templateCode: 'study-safety-adult-review-v1',
    }
    await expect(provider.deliver({ ...attempt, [key]: carrier(value) }))
      .rejects.toThrow('invalid_external_delivery_input')
    await expect(provider.reconcileStatus({
      idempotencyKey: attempt.idempotencyKey,
      attemptId: attempt.attemptId,
      recipientRef: attempt.recipientRef,
      routeRef: attempt.routeRef,
      providerAcceptanceRef: 'provider-acceptance-1',
      [key]: carrier(value),
    })).rejects.toThrow('invalid_external_reconciliation_input')
  })

  it('rejects a non-durable recipient ref at the external delivery boundary', async () => {
    const provider = createNotReadyExternalProvider('email')
    const attempt = {
      idempotencyKey: DELIVERY_KEY,
      attemptId: 'attempt-1',
      routeRef: 'email-route:synthetic',
      templateCode: 'study-safety-adult-review-v1',
    }
    for (const recipientRef of [
      'recipient:guardian-1',
      `recipient:${'C'.repeat(64)}`,
      `recipient:${'c'.repeat(63)}`,
      'guardian@example.invalid',
    ]) {
      await expect(provider.deliver({ ...attempt, recipientRef }))
        .rejects.toThrow('invalid_external_delivery_input')
    }
    await expect(provider.deliver({ ...attempt, recipientRef: RECIPIENT_REF }))
      .resolves.toEqual({ state: 'indeterminate', failureCode: 'provider-not-ready' })
  })

  it.each([
    ['deliveryIdempotencyKey', DELIVERY_KEY],
    ['recipientRef', RECIPIENT_REF],
    ['routeRef', 'email-route:synthetic'],
    ['providerReceiptRef', 'provider-receipt-1'],
  ])('rejects a hostile %s carrier at the external receipt boundary', async (key, value) => {
    const provider = createNotReadyExternalProvider('email')
    await expect(provider.verifyReceipt({
      deliveryIdempotencyKey: DELIVERY_KEY,
      recipientRef: RECIPIENT_REF,
      routeRef: 'email-route:synthetic',
      providerReceiptRef: 'provider-receipt-1',
      [key]: carrier(value),
    })).rejects.toThrow('invalid_external_receipt_input')
  })

  it('does not let a hostile attempt carrier survive an external receipt verification', async () => {
    const hostile = carrier('attempt-1')
    const adapter = createExternalProviderAdapter({
      channel: 'email',
      providerId: 'external-provider:synthetic',
      providerVersion: 'synthetic-v1',
      configurationVersion: 'synthetic-config-v1',
      isDurable: true,
      isTestProvider: false,
      supportsDurableIdempotency: true,
      deploymentMode: 'non-production',
      deliver: async () => ({ state: 'delivered', providerReceiptRef: 'provider-receipt-1' }),
      verifyReceipt: async () => ({
        verified: true,
        attemptId: hostile,
        evidenceRef: 'provider-evidence-1',
      }),
    })
    await expect(adapter.verifyReceipt({
      deliveryIdempotencyKey: DELIVERY_KEY,
      recipientRef: RECIPIENT_REF,
      routeRef: 'email-route:synthetic',
      providerReceiptRef: 'provider-receipt-1',
    })).resolves.toEqual({ verified: false })
  })

  it('does not let an array carrier pass as a guardian notification id', async () => {
    const port = createGuardianNotificationPort({
      env: { SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_ANON_KEY: 'anon-key' },
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          notifications: [{
            notificationId: [`notification:${DIGEST}`],
            title: 'Study check-in needs your review',
            reasonCategory: 'immediate-safety',
            urgency: 'urgent',
            createdAt: NOW.toISOString(),
            deliveredAt: NOW.toISOString(),
            read: false,
            actionRef: ACTION_REF,
          }],
        }),
      }),
    })
    await expect(port.list({ accessToken: 'synthetic-token' }))
      .rejects.toThrow('guardian_notification_port_contract')
  })
})
