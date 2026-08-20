#!/usr/bin/env node --experimental-strip-types
/**
 * Runs a TypeScript entry point under Node's native type-stripping, with the
 * extensionless-import loader registered so it can import
 * src/curriculum/production-quality directly from the repo root.
 *
 * Usage: node --experimental-strip-types tooling/run-ts.mjs <entry.ts>
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const entry = process.argv[2]
if (!entry) {
  console.error('usage: node --experimental-strip-types tooling/run-ts.mjs <entry.ts>')
  process.exit(2)
}

register(pathToFileURL(new URL('./ts-ext-loader.mjs', import.meta.url).pathname).href)

await import(pathToFileURL(resolve(entry)).href)
