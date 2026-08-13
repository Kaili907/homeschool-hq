import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'

/**
 * Normalized-token-overlap (Jaccard) near-duplicate detector. Each of the 36
 * lessons must read as genuinely authored for its own focus, not a
 * mail-merge of one template — the shared 4-phase skeleton (warm-up /
 * guided / independent / reflection) is expected to produce some
 * structural similarity in short "directions" labels, but no two lessons'
 * scenario or task-directions text should be near-duplicates of each other.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0
  for (const w of a) if (b.has(w)) intersection++
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : intersection / union
}

interface Flag {
  readonly a: string
  readonly b: string
  readonly sim: number
}

function findNearDuplicates(items: readonly { id: string; tok: Set<string> }[], threshold: number): Flag[] {
  const flags: Flag[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = jaccard(items[i].tok, items[j].tok)
      if (sim > threshold) flags.push({ a: items[i].id, b: items[j].id, sim })
    }
  }
  return flags.sort((x, y) => y.sim - x.sim)
}

describe('duplicate-content check across the 36 authored grade-05 lessons', () => {
  const entries = loadCorpus()

  it('no two scenario strings are near-duplicates of each other', () => {
    const scenarios = entries.map((e) => ({ id: e.pkg.packageId, tok: tokenize(e.pkg.scenario) }))
    const flags = findNearDuplicates(scenarios, 0.6)
    if (flags.length > 0) {
      throw new Error(`Near-duplicate scenarios found:\n${flags.map((f) => `${f.a} <-> ${f.b}: ${f.sim.toFixed(2)}`).join('\n')}`)
    }
    expect(flags).toEqual([])
  })

  it('no two task-directions strings are near-duplicates of each other', () => {
    const directions: { id: string; tok: Set<string> }[] = []
    for (const { pkg } of entries) {
      for (const task of pkg.tasks) {
        directions.push({ id: `${pkg.packageId}/${task.taskId}`, tok: tokenize(task.directions) })
      }
    }
    const flags = findNearDuplicates(directions, 0.8)
    if (flags.length > 0) {
      throw new Error(`Near-duplicate task directions found:\n${flags.map((f) => `${f.a} <-> ${f.b}: ${f.sim.toFixed(2)}`).join('\n')}`)
    }
    expect(flags).toEqual([])
  })

  it('no two scenario strings are exact-duplicate substrings of each other', () => {
    const scenarios = entries.map((e) => ({ id: e.pkg.packageId, text: e.pkg.scenario.trim() }))
    for (let i = 0; i < scenarios.length; i++) {
      for (let j = i + 1; j < scenarios.length; j++) {
        expect(scenarios[i].text, `${scenarios[i].id} and ${scenarios[j].id} have identical scenario text`).not.toBe(scenarios[j].text)
      }
    }
  })
})
