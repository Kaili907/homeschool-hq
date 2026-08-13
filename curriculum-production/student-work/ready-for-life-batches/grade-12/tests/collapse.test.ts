import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'

interface InventoryItem {
  readonly lessonId: string
  readonly focus: string
}

/**
 * The raw authoring source for this grade (lessons.jsonl) is a single
 * boilerplate template with only the `focus` phrase interpolated per
 * lesson — every other field is byte-identical across all 36 records. This
 * suite guards against reproducing that collapse: every lesson in this
 * batch must carry genuinely distinct objective/scenario/remediation/
 * extension text and a genuinely distinct rubric, not a shared template
 * with a phrase swapped in.
 */
describe('duplicate/template-collapse guard', () => {
  const entries = loadCorpus()

  it('has exactly 36 lessons', () => {
    expect(entries.length).toBe(36)
  })

  it('every objective is unique text (no shared template)', () => {
    const values = entries.map((e) => e.pkg.objective.trim())
    expect(new Set(values).size).toBe(values.length)
  })

  it('every scenario is unique text (no shared template)', () => {
    const values = entries.map((e) => e.pkg.scenario.trim())
    expect(new Set(values).size).toBe(values.length)
  })

  it('every remediation is unique text (no shared template)', () => {
    const values = entries.map((e) => e.pkg.remediation.trim())
    expect(new Set(values).size).toBe(values.length)
  })

  it('every extension is unique text (no shared template)', () => {
    const values = entries.map((e) => e.pkg.extension.trim())
    expect(new Set(values).size).toBe(values.length)
  })

  it('every lesson title is unique', () => {
    const values = entries.map((e) => e.pkg.lessonRef.title.trim())
    expect(new Set(values).size).toBe(values.length)
  })

  it('every scoring record has a genuinely distinct set of rubric dimensions', () => {
    const dimensionSignatures = entries.map((e) =>
      e.scoring.scoringAuthority.criteria
        .map((c) => c.dimension)
        .sort()
        .join('|'),
    )
    // Some overlap in dimension *names* across lessons is expected (e.g. several
    // lessons legitimately score "clarity of the ask"), so this does not require
    // full uniqueness — it requires that the full corpus does not collapse onto
    // a single repeated signature, which byte-identical templating would produce.
    const uniqueSignatures = new Set(dimensionSignatures)
    expect(uniqueSignatures.size).toBeGreaterThan(entries.length / 2)
  })

  it('no two lessons share an identical task-directions sequence', () => {
    const taskSignatures = entries.map((e) => e.pkg.tasks.map((t) => t.directions.trim()).join('||'))
    expect(new Set(taskSignatures).size).toBe(taskSignatures.length)
  })

  it('each lesson stays grounded in its own source focus phrase', () => {
    // Cross-checked against inventory.json rather than re-deriving from the
    // authoring branch here, since inventory.json is itself asserted against
    // source in tests/inventory.test.ts.
    const inventory = JSON.parse(readFileSync(new URL('../inventory.json', import.meta.url), 'utf-8')) as InventoryItem[]
    for (const item of inventory) {
      const entry = entries.find((e) => e.pkg.lessonRef.lessonId === item.lessonId)
      expect(entry, `no authored package for ${item.lessonId}`).toBeDefined()
      const haystack = `${entry!.pkg.objective} ${entry!.pkg.scenario}`.toLowerCase()
      const focusWords = item.focus
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w: string) => w.length > 3)
      const matched = focusWords.some((w: string) => haystack.includes(w))
      expect(matched, `${item.lessonId} objective/scenario does not reference its source focus "${item.focus}"`).toBe(true)
    }
  })
})
