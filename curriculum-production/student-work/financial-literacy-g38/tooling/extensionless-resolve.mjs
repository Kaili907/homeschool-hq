/**
 * Two resolution shims, both needed only when running under bare node:
 *
 *  1. The shared readiness gate under src/curriculum/production-quality is
 *     written for a bundler and imports its siblings without a file extension.
 *     Node's ESM resolver requires one, so an unresolved relative specifier is
 *     retried with `.ts` appended. The gate is imported read-only, unmodified.
 *
 *  2. `vitest` is mapped to a minimal local shim so the committed test files
 *     can run in a checkout with no dependencies installed. Under real vitest
 *     this hook is not registered at all.
 */
const VITEST_SHIM = new URL('./vitest-shim.mjs', import.meta.url).href

export async function resolve(specifier, context, next) {
  if (specifier === 'vitest') return { url: VITEST_SHIM, shortCircuit: true }
  try {
    return await next(specifier, context)
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return next(`${specifier}.ts`, context)
    }
    throw err
  }
}
