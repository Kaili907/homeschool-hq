import { describe, expect, it } from 'vitest'
import { composeScoringRecord } from '../src/compose.ts'
import { DIMENSIONS } from '../src/rubric.ts'
import { ALL_SPECS } from '../src/registry.ts'
import { sourceLessonMap } from '../src/sourceIndex.ts'
import type { JudgmentItem } from '../src/types.ts'

const source = sourceLessonMap()
const judgmentItems = ALL_SPECS.flatMap((s) =>
  s.tasks.flatMap((t) => t.items.filter((i): i is JudgmentItem => i.kind === 'judgment').map((i) => ({ spec: s, item: i }))),
)

/**
 * Rubric integrity.
 *
 * A judgment item is only defensibly scorable if the adult holding it can say
 * what a passing response must establish, what it must cite, and what to look
 * for — on this task, not in general. The shared level descriptors are
 * deliberately common across the course; everything task-specific is authored
 * per item and checked here.
 */
describe('rubric integrity', () => {
  it('gives every dimension four ordered levels with distinct descriptors', () => {
    const problems: string[] = []
    for (const [id, dim] of Object.entries(DIMENSIONS)) {
      const labels = dim.levels.map((l) => l.label)
      if (labels.join('|') !== 'Not yet|Approaching|Meets|Exceeds') problems.push(`${id}: levels are ${labels.join(', ')}`)
      if (new Set(dim.levels.map((l) => l.descriptor)).size !== 4) problems.push(`${id}: repeats a descriptor across levels`)
      for (const l of dim.levels) {
        // The "Not yet" descriptors are legitimately terse ("No assumption is
        // named."); the floor here catches an empty or placeholder level, not brevity.
        if (l.descriptor.trim().length < 20) problems.push(`${id}/${l.label}: descriptor is too thin to score against`)
      }
    }
    expect(problems).toEqual([])
  })

  it('names only dimensions the rubric actually defines', () => {
    const unknown = judgmentItems.flatMap(({ spec, item }) =>
      item.dimensions.filter((d) => !(d in DIMENSIONS)).map((d) => `${spec.lessonId} ${item.ref}: ${d}`),
    )
    expect(unknown).toEqual([])
  })

  it('carries task-specific criteria, evidence, and look-fors on every judgment item', () => {
    const problems: string[] = []
    for (const { spec, item } of judgmentItems) {
      if (item.acceptableAnswerCriteria.length < 2) problems.push(`${spec.lessonId} ${item.ref}: fewer than two acceptable-answer criteria`)
      if (item.evidenceRequirements.length < 1) problems.push(`${spec.lessonId} ${item.ref}: no evidence requirement`)
      if (item.lookFors.length < 2) problems.push(`${spec.lessonId} ${item.ref}: fewer than two look-fors`)
      if (item.dimensions.length < 2) problems.push(`${spec.lessonId} ${item.ref}: fewer than two rubric dimensions`)
      if (new Set(item.acceptableAnswerCriteria).size !== item.acceptableAnswerCriteria.length) {
        problems.push(`${spec.lessonId} ${item.ref}: repeats an acceptable-answer criterion`)
      }
      if (new Set(item.dimensions).size !== item.dimensions.length) {
        problems.push(`${spec.lessonId} ${item.ref}: repeats a dimension`)
      }
    }
    expect(problems).toEqual([])
  })

  it('never states an exact expected answer inside a judgment criterion set', () => {
    const bad = judgmentItems
      .filter(({ item }) => item.acceptableAnswerCriteria.some((c) => /\bthe (only )?correct answer is\b/i.test(c)))
      .map(({ spec, item }) => `${spec.lessonId} ${item.ref}`)
    expect(bad).toEqual([])
  })

  it('writes criteria that are lesson-specific rather than reused boilerplate', () => {
    const seen = new Map<string, string>()
    const reused: string[] = []
    for (const { spec, item } of judgmentItems) {
      const key = item.acceptableAnswerCriteria.join(' || ').toLowerCase()
      const prior = seen.get(key)
      if (prior) reused.push(`${spec.lessonId} ${item.ref} repeats the criteria of ${prior}`)
      else seen.set(key, `${spec.lessonId} ${item.ref}`)
    }
    expect(reused).toEqual([])
  })

  it('emits, for every judgment item, the rubric dimensions it names', () => {
    const problems: string[] = []
    for (const spec of ALL_SPECS) {
      const rec = composeScoringRecord(spec, source.get(spec.lessonId)!) as {
        scoringAuthority: { criteria?: { dimension: string }[]; judgment?: { ref: string; dimensions: string[] }[] }
      }
      const emitted = new Set((rec.scoringAuthority.criteria ?? []).map((c) => c.dimension))
      for (const j of rec.scoringAuthority.judgment ?? []) {
        for (const d of j.dimensions) {
          const label = DIMENSIONS[d as keyof typeof DIMENSIONS]?.dimension
          if (!label || !emitted.has(label)) problems.push(`${spec.lessonId} ${j.ref}: dimension ${d} has no emitted criteria block`)
        }
      }
    }
    expect(problems).toEqual([])
  })
})
