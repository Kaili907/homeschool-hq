import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { CorpusEntry, ScoringRecord, TaskSheetPackage } from './types.ts'

const OWN_ROOT = new URL('..', import.meta.url).pathname
// Read-only: the two already-authored, already-reviewed grade-4 packages
// shipped in the R3 sample. Loaded for combined coverage/gate/duplicate
// checks only — never written to. This directory owns
// ready-for-life-batches/grade-04/** exclusively, not ready-for-life-full/**.
const R3_REFERENCE_ROOT = new URL('../../../ready-for-life-full/', import.meta.url).pathname
const R3_REFERENCE_PACKAGES_DIR = join(R3_REFERENCE_ROOT, 'packages/ready-for-life/grade-04')

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...walk(full))
    } else if (entry.endsWith('.package.json')) {
      files.push(full)
    }
  }
  return files
}

function loadFrom(root: string, packagesDir: string, origin: CorpusEntry['origin']): CorpusEntry[] {
  const packageFiles = walk(packagesDir).sort()
  return packageFiles.map((packagePath) => {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as TaskSheetPackage
    const scoringPath = join(root, pkg.scoringRef)
    let scoring: ScoringRecord
    try {
      scoring = JSON.parse(readFileSync(scoringPath, 'utf-8')) as ScoringRecord
    } catch (err) {
      throw new Error(
        `Package ${relative(root, packagePath)} references scoringRef "${pkg.scoringRef}" which could not be read: ${(err as Error).message}`,
      )
    }
    return { pkg, scoring, packagePath, scoringPath, origin }
  })
}

/** Loads only this batch's own authored packages (curriculum-production/student-work/ready-for-life-batches/grade-04/packages). */
export function loadOwnCorpus(): CorpusEntry[] {
  return loadFrom(OWN_ROOT, join(OWN_ROOT, 'packages'), 'batch')
}

/** Loads the two read-only R3 grade-4 reference packages, for combined coverage/gate/duplicate checks only. */
export function loadR3ReferenceCorpus(): CorpusEntry[] {
  return loadFrom(R3_REFERENCE_ROOT, R3_REFERENCE_PACKAGES_DIR, 'r3-reference')
}

/** The full, honest grade-4 picture: this batch's 34 new lessons plus the 2 already-authored R3 lessons. */
export function loadCombinedGrade4Corpus(): CorpusEntry[] {
  return [...loadR3ReferenceCorpus(), ...loadOwnCorpus()].sort((a, b) => a.pkg.packageId.localeCompare(b.pkg.packageId))
}
