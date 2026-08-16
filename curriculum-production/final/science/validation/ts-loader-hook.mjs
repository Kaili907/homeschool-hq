/**
 * Lets Node import the repo's TypeScript production-quality gate directly.
 *
 * `src/curriculum/production-quality/*` uses extensionless relative specifiers,
 * which Node's ESM resolver rejects. This hook appends `.ts` when the file
 * exists; Node's own type stripping handles the rest. No build step, no
 * dependency, and — importantly — the gate that runs here is the committed gate,
 * not a copy of it.
 */

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL)
    if (existsSync(fileURLToPath(candidate))) {
      return { url: candidate.href, shortCircuit: true, format: 'module-typescript' }
    }
  }
  return next(specifier, context)
}
