import { createHash } from 'node:crypto'

function stableDigest(parts) {
  return createHash('sha256').update(parts.join('\u001f'), 'utf8').digest('hex')
}

export function buildAdultReviewProposal({ decision, context, requestId, sessionId, occurredAt }) {
  if (!['urgent', 'uncertain', 'invalid'].includes(decision.outcome)) {
    throw new TypeError('adult_review_not_required')
  }
  const digest = stableDigest([
    'study-safety-proposal-v1',
    context.actorUserId,
    context.householdId,
    context.studentId,
    sessionId,
    requestId,
  ])
  return Object.freeze({
    schemaVersion: 1,
    proposalId: `safety-proposal-${digest.slice(0, 32)}`,
    householdId: context.householdId,
    studentId: context.studentId,
    sessionId,
    category: 'student-support',
    classification: decision.outcome,
    urgency: decision.outcome === 'urgent' ? 'urgent' : decision.outcome === 'uncertain' ? 'uncertain' : 'review-required',
    reasonCodes: Object.freeze([...decision.reasonCodes]),
    classifierVersion: decision.classifierVersion,
    occurredAt,
    idempotencyKey: `study-safety:${digest}`,
    deliveryState: 'proposed-not-delivered',
    authorizedRecipientResolutionState: 'pending',
  })
}

export function createAdultReviewProposalService({ persistence, now = Date.now }) {
  return Object.freeze({
    async propose({ decision, context, requestId, sessionId }) {
      const proposal = buildAdultReviewProposal({
        decision,
        context,
        requestId,
        sessionId,
        occurredAt: new Date(now()).toISOString(),
      })
      try {
        const result = await persistence.createProposal({ proposal })
        return result.created
          ? { state: 'recorded-not-delivered', proposalId: proposal.proposalId }
          : { state: 'duplicate-not-delivered', proposalId: result.duplicateProposalId }
      } catch {
        return { state: 'not-confirmed' }
      }
    },
  })
}
