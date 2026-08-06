import { describe, expect, it } from 'vitest'
import {
  ALL_TESTS,
  ELEMENTARY_INSTRUMENTS,
  ELEMENTARY_INSTRUMENT_BY_TEST_ID,
  ELEMENTARY_TESTS,
  itemCount,
  testsForGrade,
} from './banks'
import {
  ACADEMY_LEVELS_WITH_CONTENT,
  OUTCOME_LABEL,
  PLACEMENT_RULES,
  PLACEMENT_THRESHOLDS,
  PLACEMENT_TIERS,
  academyNoteFor,
  buildPlacementSummary,
  computePlacement,
  domainStatusOf,
  evidenceGateOpen,
  ruleFor,
  targetLevelFor,
} from './banks/placementModel'
import * as placementModel from './banks/placementModel'
import type {
  BlueprintEntry,
  PlacementInstrument,
  PlacementMetrics,
  PlacementOutcome,
  PlacementTier,
} from './banks/placementModel'
import { scoreItem } from './normalizer'
import { finishAttempt, getState, recordAnswer, startAttempt } from './attempts'
import { buildReport } from './report'
import { emptyAssessmentState } from './types'
import type { Attempt, Item } from './types'
import { academyGradeOf } from '../academy/featureFlag'
import type { Grade } from '../types'

// ---------- RED PROOF (CE3) ----------
// Behavioural proof that the baseline registry ships no beginning-of-year
// placement instrument for the nominal Grade 3, Grade 4 or Grade 6 learners.
// Run this against 668cfd8 BEFORE the banks exist: all three grades resolve to
// an empty test list, so every expectation below fails.

describe('CE3 red proof — elementary placement instruments are registered', () => {
  it.each(['3', '4', '6'])('grade %s receives a mathematics placement assessment', (grade) => {
    const ids = testsForGrade(grade).map((t) => t.id)
    expect(ids).toContain(`ele-math-g${grade}`)
  })

  it.each(['3', '4', '6'])('grade %s receives a reading/ELA placement assessment', (grade) => {
    const ids = testsForGrade(grade).map((t) => t.id)
    expect(ids).toContain(`ele-ela-g${grade}`)
  })
})

// ---------- helpers ----------

const ALL_GRADES: Grade[] = ['3', '4', '5', '6', '7', '8', '10', '12']

function allItemsOf(inst: PlacementInstrument): Item[] {
  return inst.test.sections.flatMap((s) => s.items)
}

function itemById(inst: PlacementInstrument, id: string): Item | undefined {
  return allItemsOf(inst).find((i) => i.id === id)
}

function entriesOfTier(inst: PlacementInstrument, tier: PlacementTier): [string, BlueprintEntry][] {
  return Object.entries(inst.blueprint).filter(([, e]) => e.tier === tier)
}

const canonicalAnswer = (item: Item): string =>
  Array.isArray(item.key) ? item.key.join(', ') : (item.key ?? '')

/**
 * Build an attempt in which exactly `correctIds` are answered with the canonical
 * key and every other blueprinted item is SKIPPED. Skips land in the denominator
 * with zero earned and produce no pending weight, so each tier's percentage is
 * exactly (correct in tier) / (items in tier) — no hidden arithmetic in the
 * fixture itself.
 */
function attemptWith(inst: PlacementInstrument, correctIds: Set<string>): Attempt {
  const answers: Attempt['answers'] = {}
  for (const id of Object.keys(inst.blueprint)) {
    const item = itemById(inst, id)
    if (!item) continue
    if (correctIds.has(id) && item.key !== undefined) {
      answers[id] = { value: canonicalAnswer(item), skipped: false, msOnItem: 20000 }
    } else {
      answers[id] = { value: '', skipped: true, msOnItem: 3000 }
    }
  }
  return { testId: inst.test.id, profileId: 'p-fixture', startedAt: 'x', answers }
}

/** ids of the first `n` AUTO items in a tier (rubric items cannot self-score). */
function autoIdsInTier(inst: PlacementInstrument, tier: PlacementTier, n: number): string[] {
  return entriesOfTier(inst, tier)
    .filter(([, e]) => e.mode === 'auto')
    .slice(0, n)
    .map(([id]) => id)
}

/** smallest count k of `total` whose share lands inside [lo, hi). */
function countInBand(total: number, lo: number, hi: number): number {
  for (let k = 0; k <= total; k++) {
    const share = k / total
    if (share >= lo && share < hi) return k
  }
  throw new Error(`no count of ${total} lands in [${lo}, ${hi})`)
}

// ---------- inventory + registration ----------

describe('CE3 inventory and registration', () => {
  it('registers exactly six elementary instruments', () => {
    expect(ELEMENTARY_INSTRUMENTS).toHaveLength(6)
    expect(ELEMENTARY_TESTS.map((t) => t.id).sort()).toEqual([
      'ele-ela-g3',
      'ele-ela-g4',
      'ele-ela-g6',
      'ele-math-g3',
      'ele-math-g4',
      'ele-math-g6',
    ])
  })

  it('every test id in the whole registry is unique', () => {
    const ids = ALL_TESTS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every item id in the whole registry is unique', () => {
    const ids = ALL_TESTS.flatMap((t) => t.sections.flatMap((s) => s.items.map((i) => i.id)))
    const seen = new Map<string, number>()
    for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1)
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)
    expect(duplicates).toEqual([])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every item id inside one instrument is unique', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      const ids = allItemsOf(inst).map((i) => i.id)
      expect(new Set(ids).size, inst.test.id).toBe(ids.length)
    }
  })

  it('only the intended grade receives each assessment', () => {
    const expected: Record<string, string[]> = {
      '3': ['ele-math-g3', 'ele-ela-g3'],
      '4': ['ele-math-g4', 'ele-ela-g4'],
      '5': [],
      '6': ['ele-math-g6', 'ele-ela-g6'],
      '7': [],
      '8': [],
      '10': [],
      '12': [],
    }
    for (const grade of ALL_GRADES) {
      const got = testsForGrade(grade)
        .map((t) => t.id)
        .filter((id) => id.startsWith('ele-'))
        .sort()
      expect(got, `grade ${grade}`).toEqual([...expected[grade]].sort())
    }
  })

  it('each instrument declares exactly its own nominal grade', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      expect(inst.test.forGrades, inst.test.id).toEqual([inst.nominalGrade])
    }
  })

  it('instrument sizes stay inside a homeschool morning', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      const n = itemCount(inst.test)
      expect(n, inst.test.id).toBeGreaterThanOrEqual(24)
      expect(n, inst.test.id).toBeLessThanOrEqual(36)
      expect(inst.test.sections.length, inst.test.id).toBe(4)
    }
  })

  it('every instrument carries a shame-free intro and no timer', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      expect(inst.test.intro ?? '', inst.test.id).toMatch(/SKIP/)
      expect(inst.test.timerSec, inst.test.id).toBeUndefined()
      // never rank, shame, or diagnose in an instrument a child reads
      const prose = [inst.test.intro ?? '', inst.test.title].join(' ').toLowerCase()
      for (const banned of ['stupid', 'behind', 'disability', 'disorder', 'adhd', 'dyslexi']) {
        expect(prose, `${inst.test.id} / ${banned}`).not.toContain(banned)
      }
    }
  })

  it('reading instruments carry self-contained passages', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS.filter((i) => i.subject === 'reading-ela')) {
      const withPassage = inst.test.sections.filter((s) => (s.passage ?? '').length > 300)
      expect(withPassage.length, inst.test.id).toBe(2)
      for (const s of withPassage) {
        // the read-aloud/fluency item must sit in the section that shows the
        // passage, otherwise the child is asked to read text not yet on screen
        expect(s.items.length, `${inst.test.id} / ${s.name}`).toBeGreaterThan(0)
      }
    }
  })

  it('the fluency probe is untimed and never reports a rate', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS.filter((i) => i.subject === 'reading-ela')) {
      const fluency = Object.entries(inst.blueprint).filter(
        ([, e]) => e.domain === 'Reading accuracy (read-aloud)',
      )
      expect(fluency.length, inst.test.id).toBe(1)
      const item = itemById(inst, fluency[0][0])!
      const prompt = item.prompt.toLowerCase()
      const note = (item.keyNote ?? '').toLowerCase()
      // what the child reads: an explicit promise that nothing is being timed
      expect(prompt, inst.test.id).toMatch(
        /no timer|nobody is timing you|nothing is being timed/,
      )
      expect(prompt, inst.test.id).not.toMatch(/\bwpm\b/)
      // what the parent reads: untimed, accuracy only, and an explicit ban on
      // recording a rate — the phrase appears here ONLY as a prohibition
      expect(note, inst.test.id).toContain('untimed')
      expect(note, inst.test.id).toContain('do not time the reading')
      expect(note, inst.test.id).toContain('do not record a words-per-minute figure')
      expect(note, inst.test.id).toContain('accuracy only')
      expect(inst.blueprint[item.id].mode, inst.test.id).toBe('rubric')
    }
  })
})

// ---------- blueprint integrity: answer authority for every scored item ----------

describe('CE3 blueprint integrity', () => {
  it('every item has a blueprint row and every blueprint row resolves to an item', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      const itemIds = new Set(allItemsOf(inst).map((i) => i.id))
      const blueprintIds = new Set(Object.keys(inst.blueprint))
      const missing = [...itemIds].filter((id) => !blueprintIds.has(id))
      const orphaned = [...blueprintIds].filter((id) => !itemIds.has(id))
      expect(missing, `${inst.test.id} items with no blueprint row`).toEqual([])
      expect(orphaned, `${inst.test.id} blueprint rows with no item`).toEqual([])
    }
  })

  it('every scored item has an answer key OR a rubric — never neither, never both', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      for (const item of allItemsOf(inst)) {
        const entry = inst.blueprint[item.id]
        const label = `${inst.test.id}/${item.id}`
        if (entry.mode === 'auto') {
          expect(item.key, `${label} auto item needs a key`).toBeDefined()
          expect(entry.rubricPoints, `${label} auto item must not carry rubricPoints`).toBeUndefined()
        } else {
          expect(item.key, `${label} rubric item must not carry a machine key`).toBeUndefined()
          expect(entry.rubricPoints ?? 0, `${label} rubric item needs points`).toBeGreaterThan(0)
          expect(item.kind, `${label} rubric item should be an open response`).toBe('longtext')
        }
        // an answer authority a human can read, on EVERY scored item
        expect(item.keyNote, `${label} needs a keyNote`).toBeTruthy()
      }
    }
  })

  it('every rubric item states its point range in the keyNote', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      for (const [id, entry] of Object.entries(inst.blueprint)) {
        if (entry.mode !== 'rubric') continue
        const note = itemById(inst, id)!.keyNote ?? ''
        expect(note, `${inst.test.id}/${id}`).toContain('RUBRIC ITEM')
        expect(note, `${inst.test.id}/${id}`).toContain(`0–${entry.rubricPoints}`)
      }
    }
  })

  it('EVERY answer-key reference resolves — the canonical key scores correct', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      for (const item of allItemsOf(inst)) {
        if (item.key === undefined) continue
        const verdict = scoreItem(item, canonicalAnswer(item), false)
        expect(verdict, `${inst.test.id}/${item.id} key "${canonicalAnswer(item)}"`).toBe('correct')
      }
    }
  })

  it('every choice key is one of the offered choices, and choices never collide', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      for (const item of allItemsOf(inst)) {
        if (item.kind !== 'choice') continue
        const label = `${inst.test.id}/${item.id}`
        expect(item.choices, label).toBeDefined()
        expect(item.choices!.length, label).toBeGreaterThanOrEqual(3)
        expect(item.choices, label).toContain(item.key as string)
        // two options that normalise to the same string would make a correct
        // answer indistinguishable from a wrong one
        const normalised = item.choices!.map((c) => c.replace(/\s+/g, '').toLowerCase())
        expect(new Set(normalised).size, `${label} colliding choices`).toBe(normalised.length)
      }
    }
  })

  it('a wrong multiple-choice answer scores incorrect, not pending', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      for (const item of allItemsOf(inst)) {
        if (item.kind !== 'choice') continue
        const wrong = item.choices!.find((c) => c !== item.key)!
        expect(scoreItem(item, wrong, false), `${inst.test.id}/${item.id}`).toBe('incorrect')
      }
    }
  })

  it('every item weighs exactly 1 — no silent double counting', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      for (const [id, entry] of Object.entries(inst.blueprint)) {
        expect(entry.weight, `${inst.test.id}/${id}`).toBe(1)
      }
    }
  })

  it('every blueprint row carries a tier, a declared domain and a standard tag', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      for (const [id, entry] of Object.entries(inst.blueprint)) {
        const label = `${inst.test.id}/${id}`
        expect(PLACEMENT_TIERS, label).toContain(entry.tier)
        expect(inst.domainOrder, `${label} domain not in domainOrder`).toContain(entry.domain)
        expect(entry.standard.length, `${label} standard tag`).toBeGreaterThan(6)
        expect(entry.standard, `${label} standard tag needs a descriptor`).toContain('—')
      }
    }
  })

  it('every declared domain actually carries at least one item', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      for (const domain of inst.domainOrder) {
        const n = Object.values(inst.blueprint).filter((e) => e.domain === domain).length
        expect(n, `${inst.test.id} / ${domain}`).toBeGreaterThan(0)
      }
    }
  })

  it('every tier carries enough AUTO items to reach its thresholds unaided', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      for (const tier of PLACEMENT_TIERS) {
        const auto = entriesOfTier(inst, tier).filter(([, e]) => e.mode === 'auto')
        // 4 auto items is the minimum granularity at which the 0.70 stretch and
        // 0.85 foundation edges are both reachable without a graded rubric.
        expect(auto.length, `${inst.test.id} / ${tier}`).toBeGreaterThanOrEqual(4)
      }
    }
  })

  it('ungraded rubric work alone can never close the evidence gate', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      const total = Object.values(inst.blueprint).reduce((n, e) => n + e.weight, 0)
      const rubric = Object.values(inst.blueprint)
        .filter((e) => e.mode === 'rubric')
        .reduce((n, e) => n + e.weight, 0)
      expect(rubric / total, `${inst.test.id} rubric share`).toBeLessThanOrEqual(
        PLACEMENT_THRESHOLDS.maxPendingShare,
      )
    }
  })

  it('mathematics covers the domains this grade must sample', () => {
    const required: Record<string, string[]> = {
      'ele-math-g3': ['Place value', 'Fractions', 'Measurement', 'Word problems and reasoning'],
      'ele-math-g4': [
        'Fraction equivalence and comparison',
        'Multiplication and division',
        'Geometry',
        'Multi-step problems',
      ],
      'ele-math-g6': [
        'Ratios, rates and percent',
        'Integers',
        'Expressions and equations',
        'Coordinate plane',
        'Statistics',
      ],
    }
    for (const [testId, domains] of Object.entries(required)) {
      const inst = ELEMENTARY_INSTRUMENT_BY_TEST_ID[testId]
      for (const d of domains) expect(inst.domainOrder, testId).toContain(d)
    }
  })

  it('every ELA instrument samples the full required strand list', () => {
    const required = [
      'Word analysis and decoding',
      'Reading accuracy (read-aloud)',
      'Vocabulary in context',
      'Literal comprehension',
      'Inference',
      'Main idea and evidence',
      'Grammar and conventions',
      'Writing',
    ]
    for (const inst of ELEMENTARY_INSTRUMENTS.filter((i) => i.subject === 'reading-ela')) {
      for (const d of required) expect(inst.domainOrder, inst.test.id).toContain(d)
    }
  })

  it('every open response is rubric-scored, never left to the machine', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      for (const item of allItemsOf(inst)) {
        if (item.kind !== 'longtext') continue
        expect(inst.blueprint[item.id].mode, `${inst.test.id}/${item.id}`).toBe('rubric')
      }
    }
  })
})

// ---------- the rule table: disjoint, exhaustive, reachable ----------

describe('CE3 placement-rule table', () => {
  it('exactly one rule matches for every metrics value on a dense grid', () => {
    const steps = Array.from({ length: 21 }, (_, i) => i / 20) // 0.00 … 1.00
    const pendings = [0, 0.1, PLACEMENT_THRESHOLDS.maxPendingShare, 0.3, 1]
    let checked = 0
    for (const f of steps) {
      for (const c of steps) {
        for (const s of steps) {
          for (const pendingShare of pendings) {
            const m: PlacementMetrics = {
              foundationPct: f,
              currentPct: c,
              stretchPct: s,
              pendingShare,
              skipShare: 0,
            }
            const hits = PLACEMENT_RULES.filter((r) => r.matches(m))
            expect(hits.length, `f=${f} c=${c} s=${s} pending=${pendingShare}`).toBe(1)
            checked++
          }
        }
      }
    }
    expect(checked).toBe(steps.length ** 3 * pendings.length)
  })

  it('exactly one rule matches when a tier produced no evidence at all', () => {
    const nulls: (number | null)[] = [null, 0.9]
    for (const f of nulls) {
      for (const c of nulls) {
        for (const s of nulls) {
          const m: PlacementMetrics = {
            foundationPct: f,
            currentPct: c,
            stretchPct: s,
            pendingShare: 0,
            skipShare: 0,
          }
          const hits = PLACEMENT_RULES.filter((r) => r.matches(m))
          expect(hits.length, `${f}/${c}/${s}`).toBe(1)
          if (f === null || c === null || s === null) {
            expect(hits[0].id).toBe('R0')
            expect(evidenceGateOpen(m)).toBe(false)
          }
        }
      }
    }
  })

  it('band edges belong to exactly one side (no overlapping ranges)', () => {
    const at = (f: number, c: number, s: number): PlacementOutcome =>
      ruleFor({ foundationPct: f, currentPct: c, stretchPct: s, pendingShare: 0, skipShare: 0 })
        .outcome

    // foundation edge 0.60: below → one level below, exactly at → prerequisites
    expect(at(0.599, 1, 1)).toBe('one-level-below')
    expect(at(0.6, 1, 1)).toBe('prerequisite-intervention')
    // foundation edge 0.85: below → prerequisites, exactly at → nominal or above
    expect(at(0.849, 1, 1)).toBe('prerequisite-intervention')
    expect(at(0.85, 1, 1)).toBe('advanced-ready')
    // current edge 0.85 and stretch edge 0.70 with secure prerequisites
    expect(at(1, 0.849, 1)).toBe('nominal-with-review')
    expect(at(1, 0.85, 0.7)).toBe('advanced-ready')
    expect(at(1, 1, 0.699)).toBe('nominal-with-review')
  })

  it('the pending ceiling is the only gate that overrides a band', () => {
    const strong = { foundationPct: 1, currentPct: 1, stretchPct: 1, skipShare: 0 }
    expect(ruleFor({ ...strong, pendingShare: PLACEMENT_THRESHOLDS.maxPendingShare }).outcome).toBe(
      'advanced-ready',
    )
    expect(
      ruleFor({ ...strong, pendingShare: PLACEMENT_THRESHOLDS.maxPendingShare + 0.001 }).outcome,
    ).toBe('insufficient-evidence')
  })

  it('every outcome has a label and every rule states its predicate', () => {
    for (const rule of PLACEMENT_RULES) {
      expect(OUTCOME_LABEL[rule.outcome], rule.id).toBeTruthy()
      expect(rule.when.length, rule.id).toBeGreaterThan(10)
    }
    expect(new Set(PLACEMENT_RULES.map((r) => r.id)).size).toBe(PLACEMENT_RULES.length)
    expect(new Set(PLACEMENT_RULES.map((r) => r.outcome)).size).toBe(PLACEMENT_RULES.length)
  })

  it('domain bands partition [0,1] with no gap and no overlap', () => {
    for (let i = 0; i <= 100; i++) {
      const status = domainStatusOf(i / 100)
      expect(['secure', 'developing', 'priority']).toContain(status)
    }
    expect(domainStatusOf(0)).toBe('priority')
    expect(domainStatusOf(PLACEMENT_THRESHOLDS.domainDeveloping - 0.001)).toBe('priority')
    expect(domainStatusOf(PLACEMENT_THRESHOLDS.domainDeveloping)).toBe('developing')
    expect(domainStatusOf(PLACEMENT_THRESHOLDS.domainSecure - 0.001)).toBe('developing')
    expect(domainStatusOf(PLACEMENT_THRESHOLDS.domainSecure)).toBe('secure')
    expect(domainStatusOf(1)).toBe('secure')
    expect(domainStatusOf(null)).toBe('insufficient-evidence')
  })
})

// ---------- every threshold is reachable from a REAL attempt ----------

describe('CE3 every placement threshold is reachable on every instrument', () => {
  /** full marks on every rubric item — used only for the advanced-ready case,
   * because an UNGRADED open response correctly holds a tier score down. */
  const fullRubric = (inst: PlacementInstrument): Record<string, number> =>
    Object.fromEntries(
      Object.entries(inst.blueprint)
        .filter(([, e]) => e.mode === 'rubric')
        .map(([id, e]) => [id, e.rubricPoints!]),
    )

  const outcomesFor = (inst: PlacementInstrument) => {
    const auto = (tier: PlacementTier) =>
      entriesOfTier(inst, tier)
        .filter(([, e]) => e.mode === 'auto')
        .map(([id]) => id)
    const nF = entriesOfTier(inst, 'foundation').length
    const nS = entriesOfTier(inst, 'stretch').length
    const nC = entriesOfTier(inst, 'current').length

    return {
      // R1: no prerequisite item earned → foundation 0%
      'one-level-below': { ids: new Set<string>(), rubric: undefined },
      // R2: foundation inside [0.60, 0.85)
      'prerequisite-intervention': {
        ids: new Set(autoIdsInTier(inst, 'foundation', countInBand(nF, 0.6, 0.85))),
        rubric: undefined,
      },
      // R3: prerequisites secure, this year secure, next-grade signal present —
      // every auto item correct AND every rubric item graded at full marks
      'advanced-ready': {
        ids: new Set([...auto('foundation'), ...auto('current'), ...auto('stretch')]),
        rubric: fullRubric(inst),
      },
      // R4: prerequisites secure, current year not yet
      'nominal-with-review': {
        ids: new Set([
          ...autoIdsInTier(inst, 'foundation', countInBand(nF, 0.85, 1.0001)),
          ...autoIdsInTier(inst, 'stretch', countInBand(nS, 0, 0.7)),
          ...autoIdsInTier(inst, 'current', countInBand(nC, 0, 0.85)),
        ]),
        rubric: undefined,
      },
    }
  }

  it.each(ELEMENTARY_INSTRUMENTS.map((i) => [i.test.id, i] as const))(
    '%s reaches all four scored placement bands',
    (_id, inst) => {
      for (const [expected, { ids, rubric }] of Object.entries(outcomesFor(inst))) {
        const result = computePlacement(inst, attemptWith(inst, ids), rubric)
        expect(result.outcome, `${inst.test.id} → ${expected}`).toBe(expected)
        expect(result.metrics.pendingShare, `${inst.test.id} fixture must not be pending`).toBe(0)
      }
    },
  )

  it.each(ELEMENTARY_INSTRUMENTS.map((i) => [i.test.id, i] as const))(
    '%s reaches insufficient-evidence when nothing can be judged',
    (_id, inst) => {
      // every item answered with a blank, non-skipped response: the scorer
      // refuses to guess, so the whole instrument becomes pending
      const answers: Attempt['answers'] = {}
      for (const id of Object.keys(inst.blueprint)) {
        answers[id] = { value: '', skipped: false, msOnItem: 1000 }
      }
      const result = computePlacement(inst, {
        testId: inst.test.id,
        profileId: 'p',
        startedAt: 'x',
        answers,
      })
      expect(result.outcome).toBe('insufficient-evidence')
      expect(result.ruleId).toBe('R0')
      expect(result.confidence).toBe('low')
      expect(result.metrics.pendingShare).toBe(1)
    },
  )

  it('all five outcomes occur across the six instruments', () => {
    const seen = new Set<PlacementOutcome>()
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      for (const { ids, rubric } of Object.values(outcomesFor(inst))) {
        seen.add(computePlacement(inst, attemptWith(inst, ids), rubric).outcome)
      }
      const blank: Attempt['answers'] = {}
      for (const id of Object.keys(inst.blueprint)) {
        blank[id] = { value: '', skipped: false, msOnItem: 0 }
      }
      seen.add(
        computePlacement(inst, { testId: inst.test.id, profileId: 'p', startedAt: 'x', answers: blank })
          .outcome,
      )
    }
    expect([...seen].sort()).toEqual(
      (Object.keys(OUTCOME_LABEL) as PlacementOutcome[]).sort(),
    )
  })

  it('a perfect paper still reports moderate confidence, never certainty', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      const everyAuto = new Set(
        Object.entries(inst.blueprint)
          .filter(([, e]) => e.mode === 'auto')
          .map(([id]) => id),
      )
      const rubricScores: Record<string, number> = {}
      for (const [id, e] of Object.entries(inst.blueprint)) {
        if (e.mode === 'rubric') rubricScores[id] = e.rubricPoints!
      }
      const result = computePlacement(inst, attemptWith(inst, everyAuto), rubricScores)
      expect(result.outcome, inst.test.id).toBe('advanced-ready')
      expect(result.confidence, inst.test.id).toBe('moderate')
      // 'high' is not a value this module can produce, by design
      expect(['low', 'moderate']).toContain(result.confidence)
    }
  })

  it('an edge-of-band score is reported as low confidence', () => {
    const inst = ELEMENTARY_INSTRUMENT_BY_TEST_ID['ele-math-g3']
    const nF = entriesOfTier(inst, 'foundation').length
    const onEdge = new Set(autoIdsInTier(inst, 'foundation', countInBand(nF, 0.85, 1.0001)))
    const result = computePlacement(inst, attemptWith(inst, onEdge))
    expect(result.confidence).toBe('low')
    expect(result.confidenceReasons.length).toBeGreaterThan(0)
  })

  it('rubric points move the score only when a human supplies them', () => {
    const inst = ELEMENTARY_INSTRUMENT_BY_TEST_ID['ele-ela-g3']
    const writingIds = Object.entries(inst.blueprint)
      .filter(([, e]) => e.mode === 'rubric')
      .map(([id]) => id)
    const answered: Attempt['answers'] = {}
    for (const id of Object.keys(inst.blueprint)) {
      answered[id] = { value: 'a written response', skipped: false, msOnItem: 60000 }
    }
    const attempt: Attempt = { testId: inst.test.id, profileId: 'p', startedAt: 'x', answers: answered }

    const ungraded = computePlacement(inst, attempt)
    for (const id of writingIds) expect(ungraded.pendingItemIds).toContain(id)

    const full: Record<string, number> = {}
    for (const id of writingIds) full[id] = inst.blueprint[id].rubricPoints!
    const graded = computePlacement(inst, attempt, full)
    for (const id of writingIds) expect(graded.pendingItemIds).not.toContain(id)
    expect(graded.metrics.pendingShare).toBeLessThan(ungraded.metrics.pendingShare)
  })
})

// ---------- malformed input is handled safely ----------

describe('CE3 malformed answers are handled safely', () => {
  const inst = ELEMENTARY_INSTRUMENT_BY_TEST_ID['ele-math-g4']
  const firstAuto = Object.entries(inst.blueprint).find(([, e]) => e.mode === 'auto')![0]
  const firstRubric = Object.entries(inst.blueprint).find(([, e]) => e.mode === 'rubric')![0]

  const malformed: [string, unknown][] = [
    ['answers missing entirely', undefined],
    ['answers is null', null],
    ['answers is a string', 'nope'],
    ['answers is an array', []],
    ['entry is null', { [firstAuto]: null }],
    ['entry is a number', { [firstAuto]: 7 }],
    ['value is a number', { [firstAuto]: { value: 470, skipped: false, msOnItem: 0 } }],
    ['value is null', { [firstAuto]: { value: null, skipped: false, msOnItem: 0 } }],
    ['value is an object', { [firstAuto]: { value: {}, skipped: false, msOnItem: 0 } }],
    ['skipped is a string', { [firstAuto]: { value: '470', skipped: 'yes', msOnItem: 0 } }],
    ['unknown item ids present', { 'not-an-item': { value: 'x', skipped: false, msOnItem: 0 } }],
    ['msOnItem is NaN', { [firstAuto]: { value: '470', skipped: false, msOnItem: NaN } }],
  ]

  it.each(malformed)('%s → a well-formed result, never a throw', (_label, answers) => {
    const attempt = {
      testId: inst.test.id,
      profileId: 'p',
      startedAt: 'x',
      answers,
    } as unknown as Attempt
    const result = computePlacement(inst, attempt)
    expect(Object.keys(OUTCOME_LABEL)).toContain(result.outcome)
    expect(result.recommendationOnly).toBe(true)
    expect(Number.isFinite(result.metrics.pendingShare)).toBe(true)
    expect(Number.isFinite(result.metrics.skipShare)).toBe(true)
    for (const t of result.tiers) {
      expect(t.pct === null || (t.pct >= 0 && t.pct <= 1), `${t.tier} pct ${t.pct}`).toBe(true)
    }
    expect(() => buildPlacementSummary(result)).not.toThrow()
  })

  it('a corrupt answer value is queued for a human, never scored wrong', () => {
    const attempt = {
      testId: inst.test.id,
      profileId: 'p',
      startedAt: 'x',
      answers: { [firstAuto]: { value: 470, skipped: false, msOnItem: 0 } },
    } as unknown as Attempt
    const result = computePlacement(inst, attempt)
    expect(result.pendingItemIds).toContain(firstAuto)
  })

  const badScores: [string, unknown][] = [
    ['rubric scores missing', undefined],
    ['rubric scores null', null],
    ['rubric scores a string', 'three'],
    ['score above the maximum', { [firstRubric]: 999 }],
    ['score negative', { [firstRubric]: -1 }],
    ['score NaN', { [firstRubric]: NaN }],
    ['score Infinity', { [firstRubric]: Infinity }],
    ['score as a string', { [firstRubric]: '3' }],
  ]

  it.each(badScores)('%s → the item stays pending rather than inventing a score', (_l, scores) => {
    const answers: Attempt['answers'] = {}
    for (const id of Object.keys(inst.blueprint)) {
      answers[id] = { value: 'written answer', skipped: false, msOnItem: 1000 }
    }
    const result = computePlacement(
      inst,
      { testId: inst.test.id, profileId: 'p', startedAt: 'x', answers },
      scores as Record<string, number> | undefined,
    )
    expect(result.pendingItemIds).toContain(firstRubric)
  })

  it('a valid in-range rubric score is honoured', () => {
    const answers: Attempt['answers'] = {}
    for (const id of Object.keys(inst.blueprint)) {
      answers[id] = { value: 'written answer', skipped: false, msOnItem: 1000 }
    }
    const max = inst.blueprint[firstRubric].rubricPoints!
    const result = computePlacement(
      inst,
      { testId: inst.test.id, profileId: 'p', startedAt: 'x', answers },
      { [firstRubric]: max },
    )
    expect(result.pendingItemIds).not.toContain(firstRubric)
  })
})

// ---------- placement is advisory, never applied ----------

describe('CE3 placement stays a recommendation', () => {
  const inst = ELEMENTARY_INSTRUMENT_BY_TEST_ID['ele-math-g6']

  it('a full run through the real attempt pipeline leaves the profile untouched', () => {
    let state = emptyAssessmentState()
    state = startAttempt(state, inst.test.id, 'p-secret-9182', '2026-08-06T09:00:00.000Z').state
    for (const item of allItemsOf(inst)) {
      state =
        item.key !== undefined
          ? recordAnswer(state, inst.test.id, item.id, canonicalAnswer(item), false, 20000)
          : recordAnswer(state, inst.test.id, item.id, 'my written answer', false, 60000)
    }
    state = finishAttempt(state, inst.test, '2026-08-06T09:45:00.000Z')
    const attempt = getState(state).attempts[0]

    const profileLike = {
      id: 'p-secret-9182',
      name: 'Test Student',
      grade: '6',
      workingLevels: { mathematics: '5', 'english-language-arts': '7' },
      academy: { courseIds: ['ma-g5-mathematics'] },
      assessments: state,
    }
    const before = JSON.stringify(profileLike)

    const result = computePlacement(inst, attempt)
    const summary = buildPlacementSummary(result)

    expect(JSON.stringify(profileLike)).toBe(before)
    expect(profileLike.workingLevels).toEqual({ mathematics: '5', 'english-language-arts': '7' })
    expect(profileLike.grade).toBe('6')
    expect(summary.length).toBeGreaterThan(500)
  })

  it('the result is structurally marked advisory and names no level to apply', () => {
    const result = computePlacement(inst, attemptWith(inst, new Set()))
    expect(result.recommendationOnly).toBe(true)
    expect(Object.keys(result)).not.toContain('workingLevel')
    expect(Object.keys(result)).not.toContain('applied')
    expect(JSON.stringify(result)).not.toContain('workingLevels')
  })

  it('the placement module exports no writer — it cannot apply anything', () => {
    const writers = Object.keys(placementModel).filter((name) =>
      /^(set|apply|write|save|persist|assign)/i.test(name),
    )
    expect(writers).toEqual([])
  })

  it('the parent summary states the override and the uncertainty in plain words', () => {
    const result = computePlacement(inst, attemptWith(inst, new Set()))
    const summary = buildPlacementSummary(result)
    expect(summary).toContain('Parent override')
    expect(summary).toMatch(/recommendation/i)
    expect(summary).toMatch(/one assessment on one morning/i)
    expect(summary).toMatch(/no software will apply it/i)
    expect(summary).toMatch(/what you know wins/i)
    // it must never present itself as a diagnosis
    expect(summary.toLowerCase()).not.toMatch(/diagnos|disorder|disabilit/)
  })
})

// ---------- no child identity leaks into a placement artifact ----------

describe('CE3 no child identity leakage', () => {
  it('neither the result nor the parent summary carries the profile id or a name', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      const attempt: Attempt = {
        testId: inst.test.id,
        profileId: 'p-secret-4471',
        startedAt: '2026-08-06T09:00:00.000Z',
        answers: attemptWith(inst, new Set(autoIdsInTier(inst, 'foundation', 2))).answers,
      }
      const result = computePlacement(inst, attempt)
      const serialised = JSON.stringify(result)
      const summary = buildPlacementSummary(result)

      expect(serialised, inst.test.id).not.toContain('p-secret-4471')
      expect(summary, inst.test.id).not.toContain('p-secret-4471')
      expect(Object.keys(result)).not.toContain('profileId')
      expect(Object.keys(result)).not.toContain('studentName')
      expect(summary, inst.test.id).not.toMatch(/\bstars?\b/i)
    }
  })

  it('the identity-free summary is still complete enough to act on', () => {
    const inst = ELEMENTARY_INSTRUMENT_BY_TEST_ID['ele-ela-g6']
    const summary = buildPlacementSummary(computePlacement(inst, attemptWith(inst, new Set())))
    expect(summary).toContain('Score by readiness band')
    expect(summary).toContain('Skill domains')
    expect(summary).toContain('Suggested teaching priorities')
    expect(summary).toContain('Academy availability')
    for (const domain of inst.domainOrder) expect(summary).toContain(domain)
  })
})

// ---------- academy availability is reported honestly ----------

describe('CE3 academy availability is reported honestly', () => {
  it('the local level list agrees with the app’s own academy-grade mapping', () => {
    for (const grade of ALL_GRADES) {
      expect(ACADEMY_LEVELS_WITH_CONTENT.includes(grade), `grade ${grade}`).toBe(
        academyGradeOf(grade) !== null,
      )
    }
    expect([...ACADEMY_LEVELS_WITH_CONTENT].sort()).toEqual(['5', '7', '8'])
  })

  it('each outcome points at the level it actually names', () => {
    expect(targetLevelFor('6', 'one-level-below')).toBe('5')
    expect(targetLevelFor('6', 'nominal-with-review')).toBe('6')
    expect(targetLevelFor('6', 'prerequisite-intervention')).toBe('6')
    expect(targetLevelFor('6', 'advanced-ready')).toBe('7')
    expect(targetLevelFor('6', 'insufficient-evidence')).toBeNull()
  })

  it('an unsupported level is named as unsupported, never quietly forced', () => {
    // Grade 3 and Grade 4 have no Academy level at or below the nominal grade
    for (const grade of ['3', '4']) {
      for (const outcome of ['one-level-below', 'nominal-with-review', 'prerequisite-intervention'] as const) {
        const note = academyNoteFor(grade, outcome)
        expect(note, `${grade}/${outcome}`).toContain('does not exist there')
        expect(note, `${grade}/${outcome}`).toContain('levels 5, 7 and 8')
      }
    }
    // Grade 6 nominal is likewise unpublished
    expect(academyNoteFor('6', 'nominal-with-review')).toContain('does not exist there')
  })

  it('a supported level is named as supported, and still needs a parent', () => {
    // Grade 6 one level below → Academy level 5; Grade 6 advanced → level 7
    expect(academyNoteFor('6', 'one-level-below')).toContain('the Academy publishes level 5')
    expect(academyNoteFor('6', 'advanced-ready')).toContain('the Academy publishes level 7')
    // Grade 4 advanced → level 5
    expect(academyNoteFor('4', 'advanced-ready')).toContain('the Academy publishes level 5')
    for (const note of [
      academyNoteFor('6', 'one-level-below'),
      academyNoteFor('6', 'advanced-ready'),
      academyNoteFor('4', 'advanced-ready'),
    ]) {
      expect(note).toMatch(/only a parent makes/i)
    }
  })

  it('grade 3 is never told an Academy level is available', () => {
    for (const outcome of Object.keys(OUTCOME_LABEL) as PlacementOutcome[]) {
      expect(academyNoteFor('3', outcome)).not.toMatch(/the Academy publishes level [578]\b/)
    }
  })

  it('the note appears verbatim in the parent summary', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      const result = computePlacement(inst, attemptWith(inst, new Set()))
      expect(buildPlacementSummary(result), inst.test.id).toContain(result.academyNote)
    }
  })
})

// ---------- the existing runner still drives these instruments ----------

describe('CE3 instruments run through the existing assessment pipeline', () => {
  it('an attempt records, finishes, auto-scores and exports for every instrument', () => {
    for (const inst of ELEMENTARY_INSTRUMENTS) {
      let state = emptyAssessmentState()
      state = startAttempt(state, inst.test.id, 'p3', '2026-08-06T09:00:00.000Z').state
      for (const item of allItemsOf(inst)) {
        const value = item.key !== undefined ? canonicalAnswer(item) : 'a written answer'
        state = recordAnswer(state, inst.test.id, item.id, value, false, 15000)
      }
      state = finishAttempt(state, inst.test, '2026-08-06T09:40:00.000Z')
      const attempt = getState(state).attempts[0]

      const autoCount = Object.values(inst.blueprint).filter((e) => e.mode === 'auto').length
      const rubricCount = Object.values(inst.blueprint).filter((e) => e.mode === 'rubric').length
      const totalCorrect = Object.values(attempt.autoScore!.bySection).reduce(
        (n, x) => n + x.correct,
        0,
      )
      expect(totalCorrect, inst.test.id).toBe(autoCount)
      expect(attempt.autoScore!.gradedItems, inst.test.id).toBe(rubricCount)
      expect(attempt.autoScore!.skips, inst.test.id).toBe(0)

      const report = buildReport(inst.test, attempt, 'Student')
      for (const item of allItemsOf(inst)) expect(report, inst.test.id).toContain(item.id)
      // no star currency in an assessment artifact (rule inherited from the HS bank)
      expect(report.toLowerCase()).not.toMatch(/\bstars?\b/)
    }
  })

  it('a skipped item is recorded as a skip, not as a wrong answer', () => {
    const inst = ELEMENTARY_INSTRUMENT_BY_TEST_ID['ele-math-g3']
    const result = computePlacement(inst, attemptWith(inst, new Set()))
    expect(result.metrics.pendingShare).toBe(0)
    expect(result.metrics.skipShare).toBe(1)
    for (const tier of result.tiers) expect(tier.pct).toBe(0)
  })
})

// ---------- the Grade 10/12 bank is untouched ----------

describe('CE3 leaves the existing high-school assessments unchanged', () => {
  it('the six high-school tests keep their ids, grades and item counts', () => {
    const expected: Record<string, { grades: string[]; items: number }> = {
      'hs-math-diagnostic': { grades: ['10', '12'], items: 34 },
      'hs-reading': { grades: ['10', '12'], items: 15 },
      'hs-grammar': { grades: ['10', '12'], items: 15 },
      'hs-essay': { grades: ['10', '12'], items: 1 },
      'hs-essay-senior-b': { grades: ['12'], items: 1 },
      'hs-reading-survey': { grades: ['10', '12'], items: 5 },
    }
    const hs = ALL_TESTS.filter((t) => t.id.startsWith('hs-'))
    expect(hs).toHaveLength(6)
    for (const test of hs) {
      expect(test.forGrades, test.id).toEqual(expected[test.id].grades)
      expect(itemCount(test), test.id).toBe(expected[test.id].items)
    }
  })

  it('no elementary instrument reaches a teen and no high-school test reaches a child', () => {
    for (const grade of ['10', '12']) {
      expect(testsForGrade(grade).filter((t) => t.id.startsWith('ele-')), grade).toHaveLength(0)
    }
    for (const grade of ['3', '4', '6']) {
      expect(testsForGrade(grade).filter((t) => t.id.startsWith('hs-')), grade).toHaveLength(0)
    }
  })
})
