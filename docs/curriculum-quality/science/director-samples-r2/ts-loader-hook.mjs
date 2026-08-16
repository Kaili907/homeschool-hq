import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Node-only test hook for importing the exact Rich Study TypeScript modules. */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.')) {
    if (specifier.endsWith('/final-app/learner-response')) {
      return { url: new URL('./learner-response-shim.ts', import.meta.url).href, shortCircuit: true, format: 'module-typescript' }
    }
    const base = new URL(specifier, context.parentURL)
    const path = fileURLToPath(base)
    if (existsSync(path) && statSync(path).isDirectory()) {
      const index = new URL(`${specifier.replace(/\/$/, '')}/index.ts`, context.parentURL)
      if (existsSync(fileURLToPath(index))) return { url: index.href, shortCircuit: true, format: 'module-typescript' }
    }
    if (!/\.[a-z]+$/i.test(specifier)) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true, format: 'module-typescript' }
    }
  }
  return next(specifier, context)
}
