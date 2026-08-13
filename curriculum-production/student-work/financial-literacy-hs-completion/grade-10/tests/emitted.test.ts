import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { composeScoringRecord, composeTaskSheet, packagePath, scoringPath } from '../src/compose.ts'
import { ALL_SPECS } from '../src/registry.ts'
import { sourceLessonMap } from '../src/sourceIndex.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const source = sourceLessonMap()

function walk(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full, suffix)
    return entry.endsWith(suffix) ? [full] : []
  })
}

const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), 'utf-8'))

/** Anything on this list appearing in a task sheet means a learner can read the key. */
const ADULT_ONLY_KEYS = [
  'answer', 'verification', 'reasoning', 'criteria', 'levels', 'descriptor', 'lookFors',
  'acceptableAnswerCriteria', 'evidenceRequirements', 'commonMisconception', 'workedSolution',
  'scoringAuthority', 'judgment', 'substituted', 'why',
]

function keysOf(value: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) { value.forEach((v) => keysOf(v, acc)); return acc }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { acc.add(k); keysOf(v, acc) }
  }
  return acc
}

describe('the emitted corpus', () => {
  it('is exactly what the authored specs compose to, with no hand edits', () => {
    const drift: string[] = []
    for (const spec of ALL_SPECS) {
      const src = source.get(spec.lessonId)!
      const pkgRel = packagePath(spec)
      const scoRel = scoringPath(spec)
      if (!existsSync(join(ROOT, pkgRel))) { drift.push(`${pkgRel} is missing; run src/emit.ts`); continue }
      if (!existsSync(join(ROOT, scoRel))) { drift.push(`${scoRel} is missing; run src/emit.ts`); continue }
      if (JSON.stringify(readJson(pkgRel)) !== JSON.stringify(composeTaskSheet(spec, src))) drift.push(`${pkgRel} differs from what its spec composes to`)
      if (JSON.stringify(readJson(scoRel)) !== JSON.stringify(composeScoringRecord(spec, src))) drift.push(`${scoRel} differs from what its spec composes to`)
    }
    expect(drift).toEqual([])
  })

  it('ships one task sheet and one scoring record per authored lesson and nothing else', () => {
    expect(walk(join(ROOT, 'packages'), '.package.json')).toHaveLength(ALL_SPECS.length)
    expect(walk(join(ROOT, 'scoring'), '.scoring.json')).toHaveLength(ALL_SPECS.length)
  })

  it('keeps every answer, rubric descriptor, and look-for out of the learner-facing sheet', () => {
    const leaks: string[] = []
    for (const spec of ALL_SPECS) {
      const sheet = composeTaskSheet(spec, source.get(spec.lessonId)!)
      const keys = keysOf(sheet)
      for (const k of ADULT_ONLY_KEYS) {
        if (keys.has(k)) leaks.push(`${spec.lessonId} task sheet exposes "${k}"`)
      }
    }
    expect(leaks).toEqual([])
  })

  it('never attaches an exact key to a judgment item', () => {
    const bad: string[] = []
    for (const spec of ALL_SPECS) {
      const rec = composeScoringRecord(spec, source.get(spec.lessonId)!) as {
        scoringAuthority: { judgment?: { ref: string; exactKey: unknown }[] }
      }
      for (const j of rec.scoringAuthority.judgment ?? []) {
        if (j.exactKey !== null) bad.push(`${spec.lessonId} ${j.ref}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('points every task sheet at a scoring record that exists and names the same lesson', () => {
    const broken: string[] = []
    for (const spec of ALL_SPECS) {
      const sheet = readJson(packagePath(spec)) as { scoringRef: string; lessonRef: { lessonId: string } }
      if (!existsSync(join(ROOT, sheet.scoringRef))) { broken.push(`${spec.lessonId}: dangling scoringRef`); continue }
      const rec = readJson(sheet.scoringRef) as { lessonId: string }
      if (rec.lessonId !== sheet.lessonRef.lessonId) broken.push(`${spec.lessonId}: scoring record names ${rec.lessonId}`)
    }
    expect(broken).toEqual([])
  })
})
