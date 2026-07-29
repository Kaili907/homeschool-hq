import {
  assertValidMasteryEvidence,
  type MasteryEvidence,
  type StudentId,
} from '../../../adaptive-learning/mastery/index.ts'

export const NON_EVIDENCE_HOST_SIGNAL_KINDS = [
  'completion',
  'attendance',
  'transfer_credit',
  'schedule_completion',
  'adult_approval',
  'ui_state',
] as const

export type NonEvidenceHostSignalKind =
  (typeof NON_EVIDENCE_HOST_SIGNAL_KINDS)[number]

export interface NonEvidenceHostSignal {
  readonly kind: NonEvidenceHostSignalKind
  readonly value: unknown
}

const NO_MASTERY_EVIDENCE: readonly MasteryEvidence[] = Object.freeze([])

/**
 * These legacy/application signals are context only. They can never be
 * translated into independent-demonstration evidence.
 */
export function ignoreUnsupportedHostProgressSignal(
  _signal: NonEvidenceHostSignal,
): readonly MasteryEvidence[] {
  return NO_MASTERY_EVIDENCE
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJson)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalizeJson(item)]),
  )
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value))
}

/**
 * Replay protection belongs at the host boundary because the mastery engine
 * deliberately rejects duplicate evidence IDs. Exact replays are a no-op;
 * conflicting reuse of an ID fails closed.
 */
export function mergeMasteryEvidenceForReplay(
  studentId: StudentId,
  current: readonly MasteryEvidence[],
  incoming: readonly MasteryEvidence[],
): readonly MasteryEvidence[] {
  const merged: MasteryEvidence[] = []
  const byId = new Map<string, MasteryEvidence>()

  for (const evidence of [...current, ...incoming]) {
    assertValidMasteryEvidence(evidence)
    if (evidence.studentId !== studentId) {
      throw new TypeError(
        `Cannot merge mastery evidence for a different learner at evidence "${evidence.id}".`,
      )
    }

    const existing = byId.get(evidence.id)
    if (!existing) {
      byId.set(evidence.id, evidence)
      merged.push(evidence)
      continue
    }
    if (canonicalJson(existing) !== canonicalJson(evidence)) {
      throw new TypeError(
        `Conflicting mastery evidence reused the ID "${evidence.id}".`,
      )
    }
  }

  return Object.freeze(merged)
}
