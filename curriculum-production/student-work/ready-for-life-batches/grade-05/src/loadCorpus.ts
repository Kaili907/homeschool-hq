import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { CorpusEntry, ScoringRecord, TaskSheetPackage } from './types.ts'

const ROOT = new URL('..', import.meta.url).pathname

function walk(dir: string): string[] {
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

/**
 * Loads every authored package/scoring pair in this grade-5-only corpus.
 * Throws if a package has no matching scoring record, since a task sheet
 * with no scoring authority is not production material.
 */
export function loadCorpus(): CorpusEntry[] {
  const packagesDir = join(ROOT, 'packages')
  const packageFiles = walk(packagesDir).sort()

  return packageFiles.map((packagePath) => {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as TaskSheetPackage
    const scoringPath = join(ROOT, pkg.scoringRef)
    let scoring: ScoringRecord
    try {
      scoring = JSON.parse(readFileSync(scoringPath, 'utf-8')) as ScoringRecord
    } catch (err) {
      throw new Error(
        `Package ${relative(ROOT, packagePath)} references scoringRef "${pkg.scoringRef}" which could not be read: ${(err as Error).message}`,
      )
    }
    return { pkg, scoring, packagePath, scoringPath }
  })
}
