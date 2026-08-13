import { describe, expect, it } from 'vitest'
import { composeScoringRecord } from '../src/compose.ts'
import { ALL_SPECS } from '../src/registry.ts'
import { sourceLessonMap } from '../src/sourceIndex.ts'
import { checkCapstoneIntegrity } from '../src/validate.ts'
import type { JudgmentItem } from '../src/types.ts'

const source = sourceLessonMap()
const capstones = ALL_SPECS.filter((s) => s.isCapstone)

/** Everything a capstone must never ask a learner to supply about themselves. */
const FORBIDDEN_PERSONAL = [
  'income', 'bank balance', 'balances', 'credit score', 'debts', 'financial aid',
  'tuition bill', 'tax return', 'family finances', 'investment accounts', 'insurance policies',
]

describe('the grade 12 capstone', () => {
  it('exists, sits in the capstone unit, and covers the source-flagged capstone lesson', () => {
    expect(capstones.length).toBeGreaterThanOrEqual(7)
    expect(capstones.every((s) => s.unit === 7)).toBe(true)
    const flagged = [...source.values()].filter((l) => l.isCapstoneLesson).map((l) => l.lessonId)
    expect(flagged.length).toBeGreaterThan(0)
    for (const id of flagged) expect(capstones.some((s) => s.lessonId === id)).toBe(true)
  })

  it('passes the capstone integrity check', () => {
    expect(ALL_SPECS.flatMap(checkCapstoneIntegrity).map((f) => `${f.lessonId} ${f.where}: ${f.message}`)).toEqual([])
  })

  it('runs on a fictional case or a learner-invented fictional profile, and says so', () => {
    for (const spec of capstones) {
      expect(spec.scenario.toLowerCase()).toContain('fictional')
    }
    const mentionsInventedProfile = capstones.filter((s) =>
      /fictional profile the learner invented|profile the learner invents|fictional profile of your own|learner’s invented fictional profile|learner invented/i.test(
        [s.scenario, ...s.tasks.map((t) => t.directions)].join(' ')))
    expect(mentionsInventedProfile.length).toBeGreaterThanOrEqual(capstones.length - 1)
  })

  it('never asks the learner for their own real financial position', () => {
    const offences: string[] = []
    for (const spec of capstones) {
      const learnerText = [
        spec.scenario, spec.objective,
        ...spec.tasks.flatMap((t) => [t.directions, ...t.items.map((i) => i.text)]),
      ].join(' \n ').toLowerCase()
      for (const term of FORBIDDEN_PERSONAL) {
        const re = new RegExp(`\\byour\\b[^.?!]{0,40}\\b${term}\\b`, 'i')
        if (re.test(learnerText)) offences.push(`${spec.lessonId}: asks for "your ... ${term}"`)
      }
    }
    expect(offences).toEqual([])
  })

  it('integrates broadly rather than testing one strand', () => {
    for (const spec of capstones) {
      expect(spec.domains.length).toBeGreaterThanOrEqual(5)
    }
    const covered = new Set(capstones.flatMap((s) => s.domains))
    for (const required of ['income', 'taxes', 'budgeting', 'debt', 'saving-investing', 'insurance-risk']) {
      expect([...covered]).toContain(required)
    }
  })

  it('scores reasoning, calculations, tradeoffs, and evidence rather than a single outcome', () => {
    for (const spec of capstones) {
      const judgment = spec.tasks.flatMap((t) => t.items).filter((i): i is JudgmentItem => i.kind === 'judgment')
      expect(judgment.length).toBeGreaterThanOrEqual(1)
      const dims = new Set(judgment.flatMap((j) => j.dimensions))
      expect(dims.has('tradeoff-defense') || dims.has('plan-coherence')).toBe(true)
      expect(judgment.every((j) => j.evidenceRequirements.length >= 1)).toBe(true)
      // Every capstone lesson still carries oracle-verified computation.
      expect(spec.tasks.flatMap((t) => t.items).some((i) => i.kind !== 'judgment')).toBe(true)
    }
  })

  it('has no single predetermined correct life plan', () => {
    for (const spec of capstones) {
      const judgment = spec.tasks.flatMap((t) => t.items).filter((i): i is JudgmentItem => i.kind === 'judgment')
      const withAlternatives = judgment.filter((j) => (j.defensibleAlternatives?.length ?? 0) >= 2)
      expect({ lesson: spec.lessonId, withAlternatives: withAlternatives.length > 0 })
        .toEqual({ lesson: spec.lessonId, withAlternatives: true })
    }
  })

  it('publishes the defensible alternatives in the scoring record the adult actually reads', () => {
    for (const spec of capstones) {
      const rec = composeScoringRecord(spec, source.get(spec.lessonId)!) as {
        scoringAuthority: { judgment?: { defensibleAlternatives?: string[] }[] }
      }
      const published = (rec.scoringAuthority.judgment ?? []).filter((j) => (j.defensibleAlternatives?.length ?? 0) >= 2)
      expect({ lesson: spec.lessonId, published: published.length > 0 })
        .toEqual({ lesson: spec.lessonId, published: true })
    }
  })

  it('keeps the capstone case internally consistent across the lessons that share it', () => {
    // Case R's monthly take-home and reserve figures recur across capstone lessons;
    // a drift in either would break the plan the learner is asked to defend.
    const text = capstones.flatMap((s) => [s.scenario, ...s.tasks.flatMap((t) => [t.directions, ...t.items.map((i) => i.text)])]).join(' ')
    expect(text).toContain('$3,174.58')
    expect(text).toContain('$931.04')
    expect(text).toContain('$2,045')
    expect(text).toContain('$198.54')
  })
})
