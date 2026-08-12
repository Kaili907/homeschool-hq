/**
 * Runs a TypeScript entry point from this directory under Node.
 *
 * The existing curriculum generators in src/curriculum import siblings without
 * file extensions, which Node's own resolver rejects. esbuild is already a
 * repository dependency and resolves them the same way Vite does, so bundling
 * through it keeps generation and the vitest suite reading identical modules.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const entry = process.argv[2]
if (!entry) {
  console.error('usage: node tooling/run.mjs <entry.ts> [args...]')
  process.exit(2)
}

const outDir = mkdtempSync(join(tmpdir(), 'ma-student-work-'))
const outfile = join(outDir, 'entry.mjs')

try {
  await build({
    entryPoints: [resolve(entry)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile,
    packages: 'external',
    logLevel: 'warning',
  })
  process.argv = [process.argv[0], outfile, ...process.argv.slice(3)]
  await import(pathToFileURL(outfile).href)
} finally {
  process.on('exit', () => rmSync(outDir, { recursive: true, force: true }))
}
