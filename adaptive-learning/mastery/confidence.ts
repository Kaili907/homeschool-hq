import type {
  ConfidenceAssessment,
  ConfidenceFactor,
  ConfidenceLevel,
  IndependentDemonstrationEvidence,
  MasteryEvidence,
} from './contracts.ts'
import type { ISODateTime } from './ids.ts'

const DAY_MS = 24 * 60 * 60 * 1_000

export function confidenceLevelForScore(score: number): ConfidenceLevel {
  if (score < 0.25) return 'very_low'
  if (score < 0.5) return 'low'
  if (score < 0.75) return 'moderate'
  return 'high'
}

function isIndependent(
  evidence: MasteryEvidence,
): evidence is IndependentDemonstrationEvidence {
  return evidence.kind === 'independent_demonstration'
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function assessMasteryConfidence(
  evidence: readonly MasteryEvidence[],
  assessedAt: ISODateTime,
  algorithmVersion: string,
): ConfidenceAssessment {
  const usable = evidence.filter(({ quality }) => quality !== 'invalidated')
  const reliable = usable.filter(({ quality }) => quality === 'reliable')
  const independent = usable.filter(isIndependent)
  const successfulIndependent = independent.filter(
    ({ outcome, quality }) =>
      outcome === 'successful' && quality === 'reliable',
  )
  const unsuccessfulIndependent = independent.filter(
    ({ outcome, quality }) =>
      outcome === 'unsuccessful' && quality === 'reliable',
  )
  const distinctDays = new Set(
    successfulIndependent.map(({ capturedAt }) => capturedAt.slice(0, 10)),
  ).size
  const now = Date.parse(assessedAt)
  const newestUsable = usable.reduce<number | undefined>((newest, item) => {
    const captured = Date.parse(item.capturedAt)
    return newest === undefined || captured > newest ? captured : newest
  }, undefined)
  const hasRecentEvidence =
    newestUsable !== undefined &&
    now >= newestUsable &&
    now - newestUsable <= 30 * DAY_MS
  const hasConflictingQuality = usable.some(
    ({ quality }) => quality === 'conflicting',
  )
  const hasMixedIndependentResults =
    successfulIndependent.length > 0 && unsuccessfulIndependent.length > 0
  const limitedCount = usable.filter(({ quality }) => quality === 'limited').length
  const invalidatedCount = evidence.length - usable.length

  if (usable.length === 0) {
    const factors: ConfidenceFactor[] = []
    if (invalidatedCount > 0) {
      factors.push({
        code: 'invalidated_evidence_excluded',
        effect: 'neutral',
        explanation:
          'Invalidated evidence was preserved for audit but excluded from the estimate.',
      })
    }
    factors.push({
      code: 'no_independent_evidence',
      effect: 'lowers',
      explanation: 'No usable independent performance has been recorded.',
    })
    return {
      score: 0,
      level: 'very_low',
      assessedAt,
      algorithmVersion,
      basisEvidenceIds: [],
      factors,
    }
  }

  let score = 0.15
  const factors: ConfidenceFactor[] = []

  score += Math.min(usable.length, 5) * 0.05
  factors.push({
    code: 'evidence_volume',
    effect: usable.length >= 3 ? 'raises' : 'neutral',
    explanation: `${usable.length} usable evidence item${usable.length === 1 ? '' : 's'} contributed to this estimate.`,
  })

  score += (reliable.length / usable.length) * 0.15
  if (reliable.length > 0) {
    factors.push({
      code: 'consistent_results',
      effect: 'raises',
      explanation: `${reliable.length} evidence item${reliable.length === 1 ? ' is' : 's are'} marked reliable.`,
    })
  }

  if (successfulIndependent.length > 0) {
    score += Math.min(successfulIndependent.length, 2) * 0.17
    factors.push({
      code: 'independent_samples',
      effect: 'raises',
      explanation: `${successfulIndependent.length} successful independent demonstration${successfulIndependent.length === 1 ? '' : 's'} were observed.`,
    })
  } else {
    score -= 0.2
    factors.push({
      code: 'no_independent_evidence',
      effect: 'lowers',
      explanation:
        'Scores, completions, and supported work do not substitute for independent performance.',
    })
  }

  if (distinctDays >= 2) {
    score += 0.08
    factors.push({
      code: 'distinct_days',
      effect: 'raises',
      explanation:
        'Independent performance was demonstrated on more than one calendar day.',
    })
  }

  if (hasRecentEvidence) {
    score += 0.08
    factors.push({
      code: 'recent_evidence',
      effect: 'raises',
      explanation: 'At least one usable observation is recent.',
    })
  }

  if (
    successfulIndependent.length > 0 &&
    unsuccessfulIndependent.length === 0 &&
    !hasConflictingQuality
  ) {
    score += 0.05
    factors.push({
      code: 'consistent_results',
      effect: 'raises',
      explanation: 'Independent outcomes do not conflict.',
    })
  }

  if (hasConflictingQuality || hasMixedIndependentResults) {
    score -= 0.25
    factors.push({
      code: 'conflicting_results',
      effect: 'lowers',
      explanation:
        'Conflicting evidence limits certainty until another comparable check is completed.',
    })
  }

  if (limitedCount > 0) {
    score -= Math.min(0.15, limitedCount * 0.05)
    factors.push({
      code: 'limited_quality',
      effect: 'lowers',
      explanation: `${limitedCount} evidence item${limitedCount === 1 ? ' has' : 's have'} limited quality.`,
    })
  }

  if (invalidatedCount > 0) {
    factors.push({
      code: 'invalidated_evidence_excluded',
      effect: 'neutral',
      explanation: `${invalidatedCount} invalidated evidence item${invalidatedCount === 1 ? ' was' : 's were'} excluded.`,
    })
  }

  const boundedScore = Math.round(clamp(score) * 1_000) / 1_000
  return {
    score: boundedScore,
    level: confidenceLevelForScore(boundedScore),
    assessedAt,
    algorithmVersion,
    basisEvidenceIds: usable.map(({ id }) => id),
    factors,
  }
}

