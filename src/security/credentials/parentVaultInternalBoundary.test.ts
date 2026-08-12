import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `parentVault.internal` is an implementation module, not an API. Naming it
 * `.internal` is only a convention, and this repository has no ESLint and no
 * tsconfig path restriction that could enforce it, so the boundary is enforced
 * here: ordinary production code must reach Parent credentials through the
 * `parentVault` facade or the credentials barrel, never by deep import.
 */
const INTERNAL_MODULE = 'parentVault.internal'

const sourceRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const selfPath = fileURLToPath(import.meta.url)

/** The only modules permitted to deep-import the internal vault. */
const ALLOWED_PRODUCTION_IMPORTERS = [
  'security/credentials/parentMigration.ts',
  'security/credentials/parentVault.ts',
]

const ALLOWED_TEST_IMPORTERS = [
  'security/credentials/parentMigration.test.ts',
  'security/credentials/parentPortable.test.ts',
  'security/credentials/parentVault.test.ts',
]

/** Static `from '…'`, bare side-effect `import '…'`, dynamic `import('…')`, and `require('…')`. */
function importsInternalModule(text: string): boolean {
  return new RegExp(
    String.raw`(?:from|import|require)\s*\(?\s*['"][^'"]*` +
      INTERNAL_MODULE.replace('.', String.raw`\.`) +
      String.raw`(?:\.js|\.ts)?['"]`,
  ).test(text)
}

function sourceFiles(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      found.push(...sourceFiles(path))
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(path)
    }
  }
  return found
}

function importersOfInternalModule(): readonly string[] {
  return sourceFiles(sourceRoot)
    // This file names the specifier as data, not as an import.
    .filter((path) => resolve(path) !== selfPath)
    .filter((path) => importsInternalModule(readFileSync(path, 'utf8')))
    .map((path) => relative(sourceRoot, path).replaceAll('\\', '/'))
    .sort()
}

describe('parentVault.internal deep-import boundary', () => {
  it('detects every import form it must police', () => {
    // Control: a matcher that matched nothing would make the sweep below pass
    // no matter what production code did.
    expect(importsInternalModule("import { x } from './parentVault.internal'")).toBe(true)
    expect(importsInternalModule("export { x } from './parentVault.internal'")).toBe(true)
    expect(importsInternalModule("import './parentVault.internal'")).toBe(true)
    expect(importsInternalModule("await import('./parentVault.internal')")).toBe(true)
    expect(importsInternalModule("require('./parentVault.internal')")).toBe(true)
    expect(importsInternalModule("import x from '../credentials/parentVault.internal.js'")).toBe(true)
    expect(importsInternalModule("import { x } from './parentVault'")).toBe(false)
    expect(importsInternalModule("import { x } from './parentMigration'")).toBe(false)
  })

  it('sweeps the whole source tree and reaches the known importers', () => {
    const files = sourceFiles(sourceRoot)
    // Control: an empty or collapsed sweep must not read as a clean result.
    expect(files.length).toBeGreaterThan(50)
    expect(files.map((path) => relative(sourceRoot, path).replaceAll('\\', '/'))).toEqual(
      expect.arrayContaining([...ALLOWED_PRODUCTION_IMPORTERS, ...ALLOWED_TEST_IMPORTERS]),
    )
  })

  it('permits exactly the approved Parent credential implementation modules', () => {
    expect(importersOfInternalModule()).toEqual(
      [...ALLOWED_PRODUCTION_IMPORTERS, ...ALLOWED_TEST_IMPORTERS].sort(),
    )
  })

  it('keeps ordinary production code out of the internal module', () => {
    const productionImporters = importersOfInternalModule().filter(
      (path) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'),
    )
    expect(productionImporters).toEqual(ALLOWED_PRODUCTION_IMPORTERS)
    // App, sync, Study, components, and every other security consumer must use
    // the supported facade instead.
    expect(
      productionImporters.filter((path) => !path.startsWith('security/credentials/')),
    ).toEqual([])
  })

  it('re-exports no internal vault binding through the credentials barrel', async () => {
    const barrel = (await import('./index')) as Record<string, unknown>
    const internal = (await import('./parentVault.internal')) as Record<string, unknown>
    // The facade deliberately reuses the operation names it delegates to, so a
    // leak is shared identity, not a shared name.
    const leaked = Object.keys(internal).filter((name) => barrel[name] === internal[name])
    expect(leaked).toEqual([])
    // Control: the internal module really does export bindings worth hiding,
    // and the facade really does cover the supported operations.
    expect(Object.keys(internal).length).toBeGreaterThan(10)
    expect(typeof barrel.verifyParentPin).toBe('function')
  })
})
