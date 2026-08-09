/**
 * The bare specifiers this repository resolves by path, and the ONE place they
 * are declared.
 *
 * `@frozen/tutor-math-r1` is not a package any resolver can find on its own.
 * The frozen Math R1 directory declares only `name` and `type` — no `exports`,
 * no `main` — and there is no tsconfig `paths` entry anywhere in the repo. The
 * specifier resolves solely because a bundler is told where it points.
 *
 * That is not fixable inside the frozen package: every interior file, including
 * its `package.json`, is checksummed by its own `SHA256SUMS.txt`, and
 * adaptive-tutor/study-engine/tests/final-assembly/math-package-integrity.test.ts
 * matches all of them and fails on any unlisted file. Adding an `exports` field,
 * or a shim beside it, breaks the freeze. So the mapping lives out here, and the
 * only question is how many copies of it there are.
 *
 * It used to be one copy per build. The browser build declared it in
 * vite.config.ts; a server build would have declared its own. Two maps that must
 * agree and are never compared is how the browser and the server end up teaching
 * from different content while both look correct — so both builds now read this
 * module instead.
 *
 * Consumers: ../vite.config.ts (browser) and ../netlify/build/server-tutor-bundle.mjs
 * (server). The two configs under adaptive-tutor/study-engine/runtime/ are the
 * frozen preview's own and are deliberately not touched.
 */
import { fileURLToPath } from 'node:url'

/** Specifier to repo-relative path. Written this way so it reads as data. */
export const FROZEN_PACKAGE_ALIAS_SOURCES = Object.freeze({
  '@frozen/tutor-math-r1': 'adaptive-tutor/subjects/math/index.ts',
})

const repoRoot = new URL('../', import.meta.url)

/**
 * The same map with absolute paths, which is what both Vite's `resolve.alias`
 * and esbuild's `alias` take.
 */
export const frozenPackageAliases = Object.freeze(
  Object.fromEntries(
    Object.entries(FROZEN_PACKAGE_ALIAS_SOURCES).map(([specifier, relativePath]) => [
      specifier,
      fileURLToPath(new URL(relativePath, repoRoot)),
    ]),
  ),
)
