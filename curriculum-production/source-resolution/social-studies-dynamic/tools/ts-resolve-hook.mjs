/**
 * Minimal ESM resolve hook: the production-quality gate imports siblings
 * extensionless ('./types'), which Node's own resolver rejects. Appending
 * '.ts' lets us run the real gate under Node's type stripping instead of
 * reimplementing it here.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.ts', context.parentURL)
    if (existsSync(fileURLToPath(url))) return next(specifier + '.ts', context)
  }
  return next(specifier, context)
}
