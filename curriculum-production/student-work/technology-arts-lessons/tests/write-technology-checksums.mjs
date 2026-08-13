#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const OUTPUT = resolve(ROOT, 'TECHNOLOGY_SHA256SUMS.txt')

function filesUnder(path) {
  if (statSync(path).isFile()) return [path]
  return readdirSync(path).sort().flatMap((name) => filesUnder(resolve(path, name)))
}

const inputs = [
  resolve(ROOT, 'packages/technology'),
  resolve(ROOT, 'scoring-guides/technology'),
  resolve(ROOT, 'src'),
  resolve(ROOT, 'schema'),
  resolve(ROOT, 'tests'),
  resolve(ROOT, 'technology-content-repair-evidence.json'),
  resolve(ROOT, 'manifest.json'),
  resolve(ROOT, 'README.md'),
]

const files = inputs
  .flatMap(filesUnder)
  .filter((path) => path !== OUTPUT)
  .sort((a, b) => relative(ROOT, a).localeCompare(relative(ROOT, b)))

const lines = files.map((path) => {
  const digest = createHash('sha256').update(readFileSync(path)).digest('hex')
  return `${digest}  ${relative(ROOT, path)}`
})
writeFileSync(OUTPUT, lines.join('\n') + '\n')
console.log(`Wrote ${lines.length} Technology production checksums to ${OUTPUT}`)
