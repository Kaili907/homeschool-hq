import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { composeTaskSheet } from '../src/compose.ts'
import { ALL_SPECS } from '../src/registry.ts'
import { sourceLessonMap } from '../src/sourceIndex.ts'
import type { JudgmentItem } from '../src/types.ts'

/**
 * Grade 12 must be a senior progression, not grade 9 with larger numbers.
 *
 * The anti-template check inside the corpus proves no grade 12 lesson repeats
 * another grade 12 lesson. This file runs the same test *across grades*, against
 * the task sheets the sibling high-school lane already ships for grades 9 and
 * 10, and then measures the properties that make a lesson senior rather than
 * merely larger.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SIBLING = join(ROOT, '..', '..', 'financial-literacy-hs', 'packages')
const source = sourceLessonMap()

interface Sheet {
  readonly packageId: string
  readonly scenario: string
  readonly objective: string
  readonly tasks: readonly { directions: string; prompts: readonly { text: string }[] }[]
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.package.json') ? [full] : []
  })
}

/** Digits removed: what is left is the shape of the prompts, not their numbers. */
function skeletonOf(sheet: Sheet): string {
  return sheet.tasks
    .flatMap((t) => [t.directions, ...t.prompts.map((p) => p.text)])
    .join(' | ')
    .replace(/\d+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const normalise = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase()

const priorSheets: Sheet[] = walk(SIBLING).map((f) => JSON.parse(readFileSync(f, 'utf-8')) as Sheet)
const ourSheets: Sheet[] = ALL_SPECS.map((s) => composeTaskSheet(s, source.get(s.lessonId)!) as unknown as Sheet)

describe('anti-template against the grades already authored', () => {
  it('finds prior-grade task sheets to compare against', () => {
    // If the sibling lane is ever emptied this test would pass vacuously, so the
    // comparison set is asserted rather than assumed.
    expect(priorSheets.length).toBeGreaterThan(50)
    expect(priorSheets.every((s) => !s.packageId.startsWith('swk-flhs-g12-'))).toBe(true)
  })

  it('repeats no prior-grade prompt shape once every number is stripped', () => {
    const prior = new Map(priorSheets.map((s) => [skeletonOf(s), s.packageId]))
    const collisions = ourSheets
      .map((s) => ({ id: s.packageId, prior: prior.get(skeletonOf(s)) }))
      .filter((c) => c.prior !== undefined)
      .map((c) => `${c.id} repeats the prompt shape of ${c.prior}`)
    expect(collisions).toEqual([])
  })

  it('repeats no prior-grade scenario or objective', () => {
    const priorScenarios = new Map(priorSheets.map((s) => [normalise(s.scenario), s.packageId]))
    const priorObjectives = new Map(priorSheets.map((s) => [normalise(s.objective), s.packageId]))
    const collisions: string[] = []
    for (const s of ourSheets) {
      const scen = priorScenarios.get(normalise(s.scenario))
      if (scen) collisions.push(`${s.packageId} repeats the scenario of ${scen}`)
      const obj = priorObjectives.get(normalise(s.objective))
      if (obj) collisions.push(`${s.packageId} repeats the objective of ${obj}`)
    }
    expect(collisions).toEqual([])
  })
})

describe('senior-level progression', () => {
  it('integrates more than one domain in every lesson, and several on average', () => {
    expect(ALL_SPECS.every((s) => s.domains.length >= 2)).toBe(true)
    const mean = ALL_SPECS.reduce((n, s) => n + s.domains.length, 0) / ALL_SPECS.length
    expect(mean).toBeGreaterThanOrEqual(3.5)
  })

  it('covers every financial domain the grade 12 brief names', () => {
    const covered = new Set(ALL_SPECS.flatMap((s) => s.domains))
    const required = [
      'income', 'taxes', 'budgeting', 'banking', 'credit', 'debt', 'insurance-risk',
      'saving-investing', 'consumer-protection', 'fraud', 'postsecondary-financing',
      'multi-variable-decision',
    ]
    expect(required.filter((d) => !covered.has(d as never))).toEqual([])
  })

  it('carries multi-step reasoning: most lessons chain a computation onto an earlier result', () => {
    const chaining = ALL_SPECS.filter((s) =>
      s.tasks.flatMap((t) => t.items).some((i) => i.kind === 'numeric' && i.expr.includes('#')))
    expect(chaining.length / ALL_SPECS.length).toBeGreaterThanOrEqual(0.8)
  })

  it('requires defence and uncertainty, not only correct arithmetic', () => {
    const judgment = ALL_SPECS.flatMap((s) => s.tasks.flatMap((t) => t.items))
      .filter((i): i is JudgmentItem => i.kind === 'judgment')
    const dims = judgment.flatMap((j) => j.dimensions)
    for (const senior of ['tradeoff-defense', 'assumption-identification', 'communication-of-uncertainty', 'plan-coherence']) {
      expect(dims.filter((d) => d === senior).length).toBeGreaterThan(0)
    }
    const seniorShare = judgment.filter((j) =>
      j.dimensions.some((d) => d === 'tradeoff-defense' || d === 'assumption-identification'
        || d === 'communication-of-uncertainty' || d === 'plan-coherence')).length / judgment.length
    expect(seniorShare).toBeGreaterThanOrEqual(0.75)
  })

  it('asks extended rather than short responses in most lessons', () => {
    const judgment = ALL_SPECS.flatMap((s) => s.tasks.flatMap((t) => t.items))
      .filter((i): i is JudgmentItem => i.kind === 'judgment')
    const extended = judgment.filter((j) => j.length === 'extended').length
    expect(extended / judgment.length).toBeGreaterThanOrEqual(0.8)
  })
})
