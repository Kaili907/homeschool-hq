import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { composeScoringRecord, composeTaskSheet, packagePath, scoringPath } from '../src/compose.ts'
import { buildGateMetadata } from '../src/gateMetadata.ts'
import { ALL_SPECS } from '../src/registry.ts'
import { sourceLessonMap } from '../src/sourceIndex.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const source = sourceLessonMap()
const GATE_METADATA_PATH = 'gate/gate-metadata.json'

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
  'scoringAuthority', 'judgment', 'substituted', 'why', 'defensibleAlternatives',
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

  it('is deterministic: composing twice produces byte-identical output', () => {
    for (const spec of ALL_SPECS.slice(0, 12)) {
      const src = source.get(spec.lessonId)!
      expect(JSON.stringify(composeTaskSheet(spec, src))).toBe(JSON.stringify(composeTaskSheet(spec, src)))
      expect(JSON.stringify(composeScoringRecord(spec, src))).toBe(JSON.stringify(composeScoringRecord(spec, src)))
    }
    expect(JSON.stringify(buildGateMetadata(ALL_SPECS))).toBe(JSON.stringify(buildGateMetadata(ALL_SPECS)))
  })

  it('ships one task sheet and one scoring record per authored lesson and nothing else', () => {
    expect(walk(join(ROOT, 'packages'), '.package.json')).toHaveLength(72)
    expect(walk(join(ROOT, 'scoring'), '.scoring.json')).toHaveLength(72)
    expect(ALL_SPECS).toHaveLength(72)
  })

  it('uses a unique package id per lesson that no sibling lane already ships', () => {
    const ids = ALL_SPECS.map((s) => (readJson(packagePath(s)) as { packageId: string }).packageId)
    expect(new Set(ids).size).toBe(ids.length)
    const siblingPackages = walk(join(ROOT, '..', '..', 'financial-literacy-hs', 'packages'), '.package.json')
    const siblingIds = new Set(siblingPackages.map((f) => (JSON.parse(readFileSync(f, 'utf-8')) as { packageId: string }).packageId))
    expect(ids.filter((id) => siblingIds.has(id))).toEqual([])
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

  it('never puts a numeric item\u2019s own answer into the question that asks for it', () => {
    /**
     * Scope note. The structural guarantee that no answer, rubric descriptor or
     * look-for reaches a learner is made by the adult-only-keys test above: the
     * scoring record is a separate document and the task sheet has no field to
     * carry a key in. This test covers the one remaining way a sheet could hand
     * over an answer — printing it in the prompt that asks for it.
     *
     * It deliberately does not flag three things that are correct by design:
     * a choice item lists its answer among the options; a later prompt restates
     * an earlier result so it can be reasoned about; and the remediation gives
     * the right figures to a learner who got them wrong. A figure appearing in
     * task directions is likewise required rather than forbidden — the
     * parameter-visibility check demands that every figure an answer is scored
     * against is shown to the learner.
     */
    const leaks: string[] = []
    let examined = 0
    for (const spec of ALL_SPECS) {
      for (const item of spec.tasks.flatMap((t) => t.items)) {
        if (item.kind !== 'numeric') continue
        examined += 1
        const declared = new Set(Object.values(item.given).map((v) => String(v)))
        const bare = item.answer.replace(/[$,%]/g, '')
        if (declared.has(bare) || declared.has(bare.replace(/\.00$/, ''))) continue
        // Boundary-aware so a short answer such as "61" does not match inside "612".
        const escaped = item.answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const re = new RegExp(`(?<![\\d.])${escaped}(?![\\d])`)
        for (const [where, text] of [['prompt', item.text], ['scenario', spec.scenario], ['objective', spec.objective]] as const) {
          if (re.test(text)) leaks.push(`${spec.lessonId} ${item.ref}: answer ${item.answer} appears in the ${where}`)
        }
      }
    }
    expect(leaks).toEqual([])
    // Guards against the check quietly becoming a no-op.
    expect(examined).toBeGreaterThan(400)
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

  it('records every lesson as HYBRID, since every grade 12 lesson is mixed work', () => {
    const kinds = ALL_SPECS.map((spec) =>
      (composeScoringRecord(spec, source.get(spec.lessonId)!) as { scoringAuthority: { kind: string } }).scoringAuthority.kind)
    expect([...new Set(kinds)]).toEqual(['HYBRID'])
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

  it('ships gate metadata matching what the specs build', () => {
    expect(existsSync(join(ROOT, GATE_METADATA_PATH))).toBe(true)
    expect(JSON.stringify(readJson(GATE_METADATA_PATH))).toBe(JSON.stringify(buildGateMetadata(ALL_SPECS)))
  })
})
