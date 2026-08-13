/**
 * Minimal Node ESM resolve hook: the repo's src/curriculum/production-quality
 * modules import siblings without a file extension (Vite/TS-project style),
 * which Node's own ESM resolver rejects. This hook retries a failed relative
 * resolution with a `.ts` extension appended, so `node --experimental-strip-types`
 * can import that module tree directly with no bundling step.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      try {
        return await nextResolve(`${specifier}.ts`, context)
      } catch {
        // fall through to the original error below
      }
    }
    throw err
  }
}
