/**
 * STUDY-A1-SERVER-TUTOR-BUILD-FEASIBILITY — the server-side Tutor build probe.
 *
 * A FEASIBILITY FIXTURE, NOT A DEPLOYED ARTIFACT. Nothing here is imported by a
 * Netlify function, nothing it produces is written into `netlify/functions`, and
 * no redirect routes to it. It exists so ./server-tutor-bundle.test.js can ask
 * one question and get a real answer: can the toolchain that bundles a Netlify
 * function bundle the frozen production Tutor, and does the result run in Node?
 *
 * WHY THE QUESTION IS NOT OBVIOUS. The production Tutor closure is authored
 * bundler-only from top to bottom. `moduleResolution: "bundler"`, `.ts`
 * extensions written inside import specifiers, extensionless relative imports
 * inside the frozen content, and one bare specifier — `@frozen/tutor-math-r1` —
 * that no resolver can find without being told where it points. `netlify/`
 * contains no TypeScript at all today; every function is plain ESM JavaScript.
 * So "move Tutor to the server" is gated on a build fact, and this measures it.
 *
 * WHY ESBUILD IS THE RIGHT TOOL TO ASK. Netlify's function bundler IS esbuild
 * (`node_bundler = "esbuild"` in zip-it-and-ship-it), so calling esbuild with
 * the deployed function runtime's platform, format and target is the same
 * toolchain rather than a stand-in for it.
 *
 * WHAT THIS DOES NOT PROVE. zip-it-and-ship-it exposes no `alias` option, so
 * Netlify's bundler cannot be handed the mapping directly. The mechanism proved
 * here is therefore the pre-bundle: `npm run build` — which Netlify runs — emits
 * a dependency-free ESM artifact, leaving the function bundler nothing to
 * resolve. See docs/server-tutor-build-feasibility.md.
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { frozenPackageAliases } from '../../scripts/frozen-package-aliases.mjs'

const repoRoot = new URL('../../', import.meta.url)

/**
 * The production Tutor surface, taken from the entry-point list that
 * src/study/production/tutorAdapterImportClosure.test.ts pins as "every module a
 * host would import to run a production Tutor turn". Bundling a subset would
 * measure a smaller closure than the one that would actually ship.
 */
export const PRODUCTION_TUTOR_ENTRY_POINTS = Object.freeze([
  'src/study/production/tutorAdapter.ts',
  'src/study/production/tutorRuntime.ts',
  'src/study/production/tutorPseudonym.ts',
  'src/study/production/tutorPresentation.ts',
  'src/study/production/tutorLaunchOrdering.ts',
])

/** The one entry that reaches Tutor Core and the frozen subject registry. */
export const TUTOR_ADAPTER_ENTRY_POINT = 'src/study/production/tutorAdapter.ts'

/**
 * Netlify's function runtime, restated as esbuild settings.
 *
 * `node22` is not a guess: netlify.toml sets `NODE_VERSION = "22"`, and
 * ./server-tutor-bundle.test.js asserts it still does, so this target cannot
 * drift away from the runtime it claims to describe.
 */
export const NETLIFY_FUNCTION_BUILD = Object.freeze({
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
})

/**
 * Bundles the given production entry points and returns esbuild's output files.
 *
 * `alias` is a parameter with no default on purpose. The RED case in the test
 * passes `{}` to show what today's configuration actually does, and a default
 * would have quietly made that case pass.
 */
export async function bundleProductionTutor({ entryPoints, alias }) {
  return build({
    ...NETLIFY_FUNCTION_BUILD,
    entryPoints: entryPoints.map((entry) => fileURLToPath(new URL(entry, repoRoot))),
    outdir: fileURLToPath(new URL('.netlify-build-probe/', repoRoot)),
    alias,
    write: false,
    logLevel: 'silent',
  })
}

/** The alias map the browser build uses, for the GREEN case. */
export { frozenPackageAliases }
