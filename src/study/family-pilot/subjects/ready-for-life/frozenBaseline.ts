import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

/**
 * FULL-FAMILY-READY-FOR-LIFE-FROZEN — establishes what this repo can and
 * cannot actually attest about the frozen baseline artifact
 * `a5-ready-for-life-v1.zip`, instead of assuming custody.
 *
 * What was checked: curriculum-content/manuel-academy/1.0.0/curriculum-manifest.json
 * lists it under `frozen_baselines` as "Director-frozen 12-lesson Ready for
 * Life baseline; referenced, not copied or modified" — the same "referenced,
 * not copied" pattern used for the other two frozen overlays in that list
 * (a5-grade5-math, a5-adaptive-english-mvp). Two more docs
 * (integration/SESSION-CURR-1-CODEX-IMPORT-CARD.md and
 * standards/standards-reference.md) repeat the same artifact name and hash.
 * A repo-wide search finds no file named a5-ready-for-life-v1.zip anywhere
 * in this working tree.
 *
 * Reading that together: this repo does not hold the binary — by its own
 * declared policy, it was never supposed to ("referenced, not copied or
 * modified"). What this repo *can* attest is that its own three textual
 * references to that external artifact's identity (name + sha256) agree
 * with each other and with the expected hash below. This module verifies
 * exactly that, and nothing more — it does not and cannot verify the
 * artifact's bytes, because the artifact isn't here to hash.
 *
 * The 108-lesson / 18-unit Ready for Life course this lane actually
 * integrates (curriculum-content/.../courses/ready-for-life) is a distinct,
 * larger, in-repo, checksummed (SHA256SUMS.txt) body of content — not the
 * 12-lesson frozen zip. This module's job is solely to not let a rewrite of
 * that zip's *reference* pass unnoticed; content.node.ts is what actually
 * loads and validates the real course.
 */

export const EXPECTED_FROZEN_ARTIFACT = 'a5-ready-for-life-v1.zip'
export const EXPECTED_FROZEN_SHA256 = 'cc27e17d73838207af3fb43a3543bb3f59f990b5b6769fed1411ca2e1e05526c'

const CONTENT_ROOT = fileURLToPath(
  new URL('../../../../../curriculum-content/manuel-academy/', import.meta.url),
)

export interface RflFrozenBaselineCustodyReport {
  readonly artifact: string
  readonly expectedSha256: string
  readonly manifestEntryFound: boolean
  readonly manifestSha256Matches: boolean
  readonly importCardReferenceMatches: boolean
  readonly standardsReferenceMatches: boolean
  /** True only if manifest + both docs are found and all three hashes agree
   * with EXPECTED_FROZEN_SHA256. This is "reference custody" — it says
   * nothing about the binary, which this repo does not hold. */
  readonly referenceCustodyEstablished: boolean
  /** True if a file with this exact name exists anywhere under
   * curriculum-content/ in this working tree. Expected false: the manifest
   * declares this artifact "referenced, not copied or modified". */
  readonly artifactBytesPresentInRepo: boolean
}

function readManifestSha256(): { found: boolean; sha256: string | null } {
  let raw: string
  try {
    raw = readFileSync(join(CONTENT_ROOT, '1.0.0', 'curriculum-manifest.json'), 'utf8')
  } catch {
    return { found: false, sha256: null }
  }
  const manifest = JSON.parse(raw) as { frozen_baselines?: unknown }
  const baselines = Array.isArray(manifest.frozen_baselines) ? manifest.frozen_baselines : []
  const entry = baselines.find(
    (b): b is { artifact: string; sha256: string } =>
      !!b && typeof b === 'object' && (b as { artifact?: unknown }).artifact === EXPECTED_FROZEN_ARTIFACT,
  )
  if (!entry) return { found: false, sha256: null }
  return { found: true, sha256: entry.sha256 }
}

function readDocReference(relativePath: string): string | null {
  let raw: string
  try {
    raw = readFileSync(join(CONTENT_ROOT, '1.0.0', relativePath), 'utf8')
  } catch {
    return null
  }
  const escapedArtifact = EXPECTED_FROZEN_ARTIFACT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`${escapedArtifact}\\D{0,10}([0-9a-f]{64})`, 'i')
  const match = pattern.exec(raw)
  return match ? match[1] : null
}

function findByName(dir: string, name: string): boolean {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return false
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let stats: ReturnType<typeof statSync>
    try {
      stats = statSync(full)
    } catch {
      continue
    }
    if (stats.isDirectory()) {
      if (findByName(full, name)) return true
    } else if (entry === name) {
      return true
    }
  }
  return false
}

export function reportFrozenBaselineCustody(): RflFrozenBaselineCustodyReport {
  const manifest = readManifestSha256()
  const importCardHash = readDocReference(join('integration', 'SESSION-CURR-1-CODEX-IMPORT-CARD.md'))
  const standardsHash = readDocReference(join('standards', 'standards-reference.md'))

  const manifestSha256Matches = manifest.found && manifest.sha256 === EXPECTED_FROZEN_SHA256
  const importCardReferenceMatches = importCardHash === EXPECTED_FROZEN_SHA256
  const standardsReferenceMatches = standardsHash === EXPECTED_FROZEN_SHA256

  return Object.freeze({
    artifact: EXPECTED_FROZEN_ARTIFACT,
    expectedSha256: EXPECTED_FROZEN_SHA256,
    manifestEntryFound: manifest.found,
    manifestSha256Matches,
    importCardReferenceMatches,
    standardsReferenceMatches,
    referenceCustodyEstablished:
      manifestSha256Matches && importCardReferenceMatches && standardsReferenceMatches,
    artifactBytesPresentInRepo: findByName(CONTENT_ROOT, EXPECTED_FROZEN_ARTIFACT),
  })
}
