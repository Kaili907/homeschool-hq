// CE3 — placement scoring model for the elementary (G3 / G4 / G6) instruments.
//
// This module is the single audit surface for placement. It holds NO assessment
// content: the six bank files carry the items, this file carries the arithmetic.
// A reviewer verifying a placement decision only has to check three things here:
//
//   1. PLACEMENT_THRESHOLDS — every number the decision depends on, named.
//   2. PLACEMENT_RULES      — the rule table, in order, each with its predicate
//                             written out in `when` for human comparison.
//   3. computePlacement     — the only arithmetic; no hidden weighting, no
//                             generator that scores itself against itself.
//
// DESIGN CONSTRAINTS carried from the assessment module's original addendum and
// from this session's brief:
//
//  - A placement result is a RECOMMENDATION. Nothing here reads or writes
//    Profile.workingLevels — the module never imports a profile at all, so it
//    cannot. Stephen is the only person who applies a level change.
//  - An answer the scorer cannot confidently judge is NEVER counted wrong. It
//    becomes `pending` (human review), which lowers confidence and can trip the
//    insufficient-evidence gate. Uncertainty is reported, not hidden.
//  - No `high` confidence exists. One test on one morning does not earn it.
//  - No child identity enters a PlacementResult. `Attempt.profileId` is read for
//    nothing and copied nowhere; the parent summary is identity-free by
//    construction so it can be handed to a reviewer as-is.

import type { Attempt, FixedTest } from '../types'
import { scoreItem } from '../normalizer'

// ---------- blueprint (the per-item audit table each bank file declares) ----------

/**
 * Which readiness question an item answers.
 *  - foundation: prerequisite skill from the PRIOR grade. Weak here means the
 *    child is missing the ground the nominal year is built on.
 *  - current: beginning-of-nominal-year readiness.
 *  - stretch: NEXT-grade signal. Strong here is the only evidence that can
 *    recommend advanced material.
 */
export type PlacementTier = 'foundation' | 'current' | 'stretch'

export const PLACEMENT_TIERS: readonly PlacementTier[] = ['foundation', 'current', 'stretch']

/**
 * How an item earns its weight.
 *  - auto: the item has a machine key; the shared normalizer judges it.
 *  - rubric: an open response a human scores 0..rubricPoints against the rubric
 *    printed in the scoring guide. Until a human supplies that score the item is
 *    `pending` — it is never guessed at and never counted wrong.
 */
export type ScoringMode = 'auto' | 'rubric'

export interface BlueprintEntry {
  tier: PlacementTier
  /** Skill domain, used for the domain summary and the skill-priority list. */
  domain: string
  /** Standard code + short skill descriptor, for the reviewer's cross-check. */
  standard: string
  /** Scoring weight. Every CE3 item weighs 1 — the field exists so a reviewer
   * can see at a glance that no item is silently double-counted. */
  weight: number
  mode: ScoringMode
  /** rubric items only: the maximum points a human grader may award. */
  rubricPoints?: number
}

export type Blueprint = Record<string, BlueprintEntry>

export type PlacementSubject = 'mathematics' | 'reading-ela'

/** One registered placement instrument: its test, its blueprint, its grade. */
export interface PlacementInstrument {
  test: FixedTest
  subject: PlacementSubject
  /** The learner's NOMINAL grade. Never a working level. */
  nominalGrade: '3' | '4' | '6'
  blueprint: Blueprint
  /** Stable report order for the domain summary. */
  domainOrder: readonly string[]
}

// ---------- thresholds (every number the decision depends on) ----------

export const PLACEMENT_THRESHOLDS = {
  /** Above this share of pending weight the instrument cannot support a call. */
  maxPendingShare: 0.25,
  /** Foundation below this → the prior year's ground is not there. */
  foundationShaky: 0.6,
  /** Foundation at or above this → prerequisites are secure. */
  foundationSecure: 0.85,
  /** Current-year readiness at or above this counts as already-held. */
  currentSecure: 0.85,
  /** Next-grade signal at or above this counts as genuine advanced evidence. */
  stretchReady: 0.7,
  /** Pending share above this forces low confidence. */
  lowConfidencePendingShare: 0.1,
  /** Skip share above this forces low confidence. */
  lowConfidenceSkipShare: 0.2,
  /** Landing this close to a band edge forces low confidence. */
  lowConfidenceMargin: 0.05,
  /** Domain at or above this reads as secure. */
  domainSecure: 0.8,
  /** Domain at or above this (and below domainSecure) reads as developing. */
  domainDeveloping: 0.5,
} as const

// ---------- outcomes ----------

export type PlacementOutcome =
  | 'insufficient-evidence'
  | 'one-level-below'
  | 'prerequisite-intervention'
  | 'nominal-with-review'
  | 'advanced-ready'

export const OUTCOME_LABEL: Record<PlacementOutcome, string> = {
  'insufficient-evidence': 'Insufficient evidence — parent review required',
  'one-level-below': 'Begin one level below the nominal grade for this subject',
  'prerequisite-intervention': 'Begin at the nominal grade WITH prerequisite intervention',
  'nominal-with-review': 'Begin at the nominal grade with targeted review',
  'advanced-ready': 'Ready for advanced material in this subject',
}

// ---------- metrics + the rule table ----------

export interface PlacementMetrics {
  /** null = the tier scored no item definitively (no evidence at all). */
  foundationPct: number | null
  currentPct: number | null
  stretchPct: number | null
  /** share of total blueprint weight awaiting human judgement */
  pendingShare: number
  /** share of total blueprint weight the child chose to skip */
  skipShare: number
}

/**
 * The evidence gate. Open = all three tiers produced at least one definitive
 * score AND human-review backlog is under the ceiling. Closed → R0 fires and
 * no placement band is claimed.
 */
export function evidenceGateOpen(m: PlacementMetrics): boolean {
  return (
    m.foundationPct !== null &&
    m.currentPct !== null &&
    m.stretchPct !== null &&
    m.pendingShare <= PLACEMENT_THRESHOLDS.maxPendingShare
  )
}

export interface PlacementRule {
  id: 'R0' | 'R1' | 'R2' | 'R3' | 'R4'
  outcome: PlacementOutcome
  /** The predicate in words, for line-by-line comparison against `matches`. */
  when: string
  matches: (m: PlacementMetrics) => boolean
}

const T = PLACEMENT_THRESHOLDS

/**
 * The placement-rule table.
 *
 * Each predicate is written FULLY BOUNDED rather than relying on the order of
 * evaluation, so the rules are pairwise disjoint AND exhaustive on their own:
 * for any PlacementMetrics value, exactly one rule matches. That property is
 * asserted directly over a dense grid in elementaryPlacement.test.ts, which is
 * what proves "no gaps, no overlapping contradictory ranges" — it is not an
 * argument about reading order.
 */
export const PLACEMENT_RULES: readonly PlacementRule[] = [
  {
    id: 'R0',
    outcome: 'insufficient-evidence',
    when: 'any tier scored no item definitively, OR pendingShare > 0.25',
    matches: (m) => !evidenceGateOpen(m),
  },
  {
    id: 'R1',
    outcome: 'one-level-below',
    when: 'gate open AND foundation < 0.60',
    matches: (m) => evidenceGateOpen(m) && (m.foundationPct as number) < T.foundationShaky,
  },
  {
    id: 'R2',
    outcome: 'prerequisite-intervention',
    when: 'gate open AND 0.60 <= foundation < 0.85',
    matches: (m) =>
      evidenceGateOpen(m) &&
      (m.foundationPct as number) >= T.foundationShaky &&
      (m.foundationPct as number) < T.foundationSecure,
  },
  {
    id: 'R3',
    outcome: 'advanced-ready',
    when: 'gate open AND foundation >= 0.85 AND current >= 0.85 AND stretch >= 0.70',
    matches: (m) =>
      evidenceGateOpen(m) &&
      (m.foundationPct as number) >= T.foundationSecure &&
      (m.currentPct as number) >= T.currentSecure &&
      (m.stretchPct as number) >= T.stretchReady,
  },
  {
    id: 'R4',
    outcome: 'nominal-with-review',
    when: 'gate open AND foundation >= 0.85 AND NOT (current >= 0.85 AND stretch >= 0.70)',
    matches: (m) =>
      evidenceGateOpen(m) &&
      (m.foundationPct as number) >= T.foundationSecure &&
      !(
        (m.currentPct as number) >= T.currentSecure &&
        (m.stretchPct as number) >= T.stretchReady
      ),
  },
]

/**
 * Resolve metrics to the single matching rule. The table is total, so the
 * fallback is unreachable; it resolves to R0 (insufficient evidence) rather
 * than to a placement, so any future edit that punched a hole in the table
 * would fail SAFE — toward "ask the parent", never toward a confident call.
 */
export function ruleFor(m: PlacementMetrics): PlacementRule {
  return PLACEMENT_RULES.find((r) => r.matches(m)) ?? PLACEMENT_RULES[0]
}

// ---------- domain + tier summaries ----------

export type DomainStatus = 'secure' | 'developing' | 'priority' | 'insufficient-evidence'

/** Domain bands: [0,0.50) priority · [0.50,0.80) developing · [0.80,1] secure. */
export function domainStatusOf(pct: number | null): DomainStatus {
  if (pct === null) return 'insufficient-evidence'
  if (pct >= T.domainSecure) return 'secure'
  if (pct >= T.domainDeveloping) return 'developing'
  return 'priority'
}

export interface Tally {
  earned: number
  possible: number
  pending: number
  skipped: number
  pct: number | null
}

export interface DomainSummary extends Tally {
  domain: string
  status: DomainStatus
}

export interface TierSummary extends Tally {
  tier: PlacementTier
}

export type Confidence = 'low' | 'moderate'

export interface PlacementResult {
  testId: string
  subject: PlacementSubject
  nominalGrade: '3' | '4' | '6'
  outcome: PlacementOutcome
  /** The rule that produced `outcome`, for the reviewer's audit trail. */
  ruleId: PlacementRule['id']
  confidence: Confidence
  /** Why confidence is low, in plain words. Empty when moderate. */
  confidenceReasons: string[]
  metrics: PlacementMetrics
  tiers: TierSummary[]
  domains: DomainSummary[]
  /** Weakest domains first — the skill priorities for the term. */
  priorities: string[]
  /** Items a human still has to read before this result firms up. */
  pendingItemIds: string[]
  /** Honest statement of what the Academy can and cannot deliver here. */
  academyNote: string
  /** Structural marker: this artifact is advisory and never applied by code. */
  recommendationOnly: true
}

// ---------- academy availability (levels 5, 7 and 8 only) ----------

/** Academy levels that have published content. Mirrors AcademyGrade in
 * src/types.ts; elementaryPlacement.test.ts asserts the two agree. */
export const ACADEMY_LEVELS_WITH_CONTENT: readonly string[] = ['5', '7', '8']

/** The level an outcome points at, or null when the outcome names no level. */
export function targetLevelFor(nominalGrade: string, outcome: PlacementOutcome): string | null {
  const n = Number(nominalGrade)
  switch (outcome) {
    case 'one-level-below':
      return String(n - 1)
    case 'prerequisite-intervention':
    case 'nominal-with-review':
      return nominalGrade
    case 'advanced-ready':
      return String(n + 1)
    case 'insufficient-evidence':
      return null
  }
}

/**
 * What the Academy can actually serve for this recommendation. Derived from
 * ACADEMY_LEVELS_WITH_CONTENT rather than written per grade, so it cannot drift
 * into flattering the parent about content that does not exist.
 */
export function academyNoteFor(nominalGrade: string, outcome: PlacementOutcome): string {
  const target = targetLevelFor(nominalGrade, outcome)
  if (target === null) {
    return (
      'No level is recommended yet, so no Academy level applies. The Academy publishes ' +
      'levels 5, 7 and 8 only.'
    )
  }
  if (ACADEMY_LEVELS_WITH_CONTENT.includes(target)) {
    return (
      `This recommendation points at level ${target}, and the Academy publishes level ` +
      `${target}. A parent who agreed with it could deliver it through the Academy. ` +
      'Assigning it is still a decision only a parent makes.'
    )
  }
  return (
    `This recommendation points at level ${target}. The Academy publishes levels 5, 7 and 8 ` +
    `only, so level ${target} does not exist there. This placement must be delivered through ` +
    'curriculum the parent chooses; it cannot be turned into an Academy working level.'
  )
}

// ---------- the scorer ----------

/** Defensive read of one stored answer. Any malformed shape reads as unanswered. */
function readAnswer(attempt: Attempt, itemId: string): { value: string; skipped: boolean } {
  const answers: unknown = attempt && typeof attempt === 'object' ? attempt.answers : undefined
  if (!answers || typeof answers !== 'object') return { value: '', skipped: true }
  const raw = (answers as Record<string, unknown>)[itemId]
  if (!raw || typeof raw !== 'object') return { value: '', skipped: true }
  const r = raw as { value?: unknown; skipped?: unknown }
  return {
    // A non-string value (corrupt storage) reads as blank, which routes the item
    // to human review — it is never scored wrong on the strength of bad data.
    value: typeof r.value === 'string' ? r.value : '',
    skipped: r.skipped === true,
  }
}

/** Defensive read of one human rubric score. Out-of-range or non-numeric → null (pending). */
function readRubricScore(scores: unknown, itemId: string, maxPoints: number): number | null {
  if (!scores || typeof scores !== 'object') return null
  const v = (scores as Record<string, unknown>)[itemId]
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  if (v < 0 || v > maxPoints) return null
  return v
}

const emptyTally = (): Tally => ({ earned: 0, possible: 0, pending: 0, skipped: 0, pct: null })

function finalize(t: Tally): Tally {
  return { ...t, pct: t.possible > 0 ? t.earned / t.possible : null }
}

function confidenceOf(
  m: PlacementMetrics,
  ruleId: PlacementRule['id'],
): { confidence: Confidence; reasons: string[] } {
  const reasons: string[] = []
  if (ruleId === 'R0') {
    reasons.push('the evidence gate did not open, so no placement band was claimed')
    return { confidence: 'low', reasons }
  }
  if (m.pendingShare > T.lowConfidencePendingShare) {
    reasons.push(
      `${Math.round(m.pendingShare * 100)}% of the assessment is still waiting on a human reader`,
    )
  }
  if (m.skipShare > T.lowConfidenceSkipShare) {
    reasons.push(`${Math.round(m.skipShare * 100)}% of the assessment was skipped`)
  }
  const near = (v: number, edge: number) => Math.abs(v - edge) < T.lowConfidenceMargin
  const f = m.foundationPct as number
  const c = m.currentPct as number
  const s = m.stretchPct as number
  if (near(f, T.foundationShaky) || near(f, T.foundationSecure)) {
    reasons.push('the prerequisite score landed on the edge between two recommendations')
  }
  if (f >= T.foundationSecure && (near(c, T.currentSecure) || near(s, T.stretchReady))) {
    reasons.push('the current-year or next-grade score landed on the edge between two recommendations')
  }
  return { confidence: reasons.length > 0 ? 'low' : 'moderate', reasons }
}

/**
 * Score one finished attempt into a placement RECOMMENDATION.
 *
 * `rubricScores` maps item id → points a human awarded (0..rubricPoints). Items
 * absent from it stay pending. The signature takes no Profile, so this function
 * has no way to change a working level even by accident.
 */
export function computePlacement(
  instrument: PlacementInstrument,
  attempt: Attempt,
  rubricScores?: Record<string, number>,
): PlacementResult {
  const tiers = new Map<PlacementTier, Tally>(PLACEMENT_TIERS.map((t) => [t, emptyTally()]))
  const domains = new Map<string, Tally>(instrument.domainOrder.map((d) => [d, emptyTally()]))
  const pendingItemIds: string[] = []
  let totalWeight = 0
  let pendingWeight = 0
  let skippedWeight = 0

  const bump = (entry: BlueprintEntry, field: keyof Tally, amount: number) => {
    const tier = tiers.get(entry.tier)
    if (tier) (tier[field] as number) += amount
    const domain = domains.get(entry.domain)
    if (domain) (domain[field] as number) += amount
  }

  for (const section of instrument.test.sections) {
    for (const item of section.items) {
      const entry = instrument.blueprint[item.id]
      if (!entry) {
        // An item with no blueprint row cannot be placed in a tier. Count it as
        // pending so a content mistake can only ever weaken the evidence.
        pendingItemIds.push(item.id)
        continue
      }
      const w = entry.weight
      totalWeight += w
      const { value, skipped } = readAnswer(attempt, item.id)

      if (entry.mode === 'rubric') {
        const max = entry.rubricPoints ?? 0
        const score = max > 0 ? readRubricScore(rubricScores, item.id, max) : null
        if (score !== null) {
          bump(entry, 'possible', w)
          bump(entry, 'earned', w * (score / max))
        } else if (skipped) {
          // Declined in front of the parent: evidence of not-demonstrated.
          bump(entry, 'possible', w)
          bump(entry, 'skipped', w)
          skippedWeight += w
        } else {
          bump(entry, 'pending', w)
          pendingWeight += w
          pendingItemIds.push(item.id)
        }
        continue
      }

      switch (scoreItem(item, value, skipped)) {
        case 'correct':
          bump(entry, 'possible', w)
          bump(entry, 'earned', w)
          break
        case 'incorrect':
          bump(entry, 'possible', w)
          break
        case 'skip':
          bump(entry, 'possible', w)
          bump(entry, 'skipped', w)
          skippedWeight += w
          break
        // 'unmatched' (scorer not confident) and 'ungraded' (no key) are never
        // counted wrong — they leave the denominator and wait for a human.
        case 'unmatched':
        case 'ungraded':
          bump(entry, 'pending', w)
          pendingWeight += w
          pendingItemIds.push(item.id)
          break
      }
    }
  }

  const tierSummaries: TierSummary[] = PLACEMENT_TIERS.map((tier) => ({
    tier,
    ...finalize(tiers.get(tier) ?? emptyTally()),
  }))
  const domainSummaries: DomainSummary[] = instrument.domainOrder.map((domain) => {
    const t = finalize(domains.get(domain) ?? emptyTally())
    return { domain, ...t, status: domainStatusOf(t.pct) }
  })

  const byTier = (tier: PlacementTier) =>
    tierSummaries.find((t) => t.tier === tier)?.pct ?? null

  const metrics: PlacementMetrics = {
    foundationPct: byTier('foundation'),
    currentPct: byTier('current'),
    stretchPct: byTier('stretch'),
    pendingShare: totalWeight > 0 ? pendingWeight / totalWeight : 1,
    skipShare: totalWeight > 0 ? skippedWeight / totalWeight : 0,
  }

  const rule = ruleFor(metrics)
  const { confidence, reasons } = confidenceOf(metrics, rule.id)

  const priorities = domainSummaries
    .filter((d) => d.status === 'priority' || d.status === 'developing')
    .sort((a, b) => (a.pct as number) - (b.pct as number))
    .map((d) => d.domain)

  return {
    testId: instrument.test.id,
    subject: instrument.subject,
    nominalGrade: instrument.nominalGrade,
    outcome: rule.outcome,
    ruleId: rule.id,
    confidence,
    confidenceReasons: reasons,
    metrics,
    tiers: tierSummaries,
    domains: domainSummaries,
    priorities,
    pendingItemIds,
    academyNote: academyNoteFor(instrument.nominalGrade, rule.outcome),
    recommendationOnly: true,
  }
}

// ---------- parent-readable summary ----------

const pct = (v: number | null) => (v === null ? 'no evidence' : `${Math.round(v * 100)}%`)

const TIER_LABEL: Record<PlacementTier, string> = {
  foundation: 'Prerequisites (last year’s skills)',
  current: 'This year’s starting skills',
  stretch: 'Next-grade signals',
}

const STATUS_LABEL: Record<DomainStatus, string> = {
  secure: 'secure',
  developing: 'developing',
  priority: 'priority for teaching',
  'insufficient-evidence': 'not enough evidence',
}

/**
 * Parent-readable placement recommendation. Deliberately identity-free: it
 * names no child, carries no profile id, and can be handed to a reviewer or
 * filed as-is. What it recommends is a starting point, not a verdict.
 */
export function buildPlacementSummary(result: PlacementResult): string {
  const lines: string[] = []
  const subject = result.subject === 'mathematics' ? 'Mathematics' : 'Reading / ELA'

  lines.push(`# Placement recommendation — ${subject}, nominal Grade ${result.nominalGrade}`)
  lines.push('')
  lines.push(`- Instrument: ${result.testId}`)
  lines.push(`- Recommendation: **${OUTCOME_LABEL[result.outcome]}**`)
  lines.push(`- Rule applied: ${result.ruleId} (${ruleWhen(result.ruleId)})`)
  lines.push(`- Confidence: ${result.confidence}`)
  lines.push('')

  lines.push('## What this is and is not')
  lines.push('')
  lines.push(
    'This is a recommendation from one assessment on one morning. It is a starting point for ' +
      'a parent to accept, adjust, or reject. Nothing here has been applied to any setting, and ' +
      'no software will apply it — a working level changes only when a parent changes it.',
  )
  lines.push('')
  lines.push(
    'One assessment cannot separate "has not learned this yet" from "knew it and had a bad ' +
      'morning." Read this beside what you already know about the learner; where the two ' +
      'disagree, what you know wins.',
  )
  lines.push('')

  if (result.confidenceReasons.length > 0) {
    lines.push('## Why confidence is low')
    lines.push('')
    for (const r of result.confidenceReasons) lines.push(`- ${r}`)
    lines.push('')
  }

  lines.push('## Score by readiness band')
  lines.push('')
  lines.push('| Band | Score | Earned / possible | Skipped | Awaiting human reading |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const t of result.tiers) {
    lines.push(
      `| ${TIER_LABEL[t.tier]} | ${pct(t.pct)} | ${round2(t.earned)} / ${t.possible} | ${t.skipped} | ${t.pending} |`,
    )
  }
  lines.push('')

  lines.push('## Skill domains')
  lines.push('')
  lines.push('| Domain | Score | Reading |')
  lines.push('| --- | --- | --- |')
  for (const d of result.domains) {
    lines.push(`| ${d.domain} | ${pct(d.pct)} | ${STATUS_LABEL[d.status]} |`)
  }
  lines.push('')

  lines.push('## Suggested teaching priorities')
  lines.push('')
  if (result.priorities.length === 0) {
    lines.push('- No domain fell below the secure band on this assessment.')
  } else {
    for (const d of result.priorities) lines.push(`- ${d}`)
  }
  lines.push('')

  lines.push('## Academy availability')
  lines.push('')
  lines.push(result.academyNote)
  lines.push('')

  if (result.pendingItemIds.length > 0) {
    lines.push('## Still needs a human reader')
    lines.push('')
    lines.push(
      `These items were not machine-scored. Score them against the rubric in the scoring guide, ` +
        `then re-run this summary: ${result.pendingItemIds.join(', ')}.`,
    )
    lines.push('')
  }

  lines.push('## Parent override')
  lines.push('')
  lines.push(
    'A parent may set a different starting level for any reason and owes no justification to ' +
      'this document. If the recommendation and the parent disagree, follow the parent. Re-check ' +
      'the placement after a few weeks of real work — that evidence is worth more than this test.',
  )

  return lines.join('\n')
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function ruleWhen(id: PlacementRule['id']): string {
  return PLACEMENT_RULES.find((r) => r.id === id)?.when ?? 'unknown rule'
}
