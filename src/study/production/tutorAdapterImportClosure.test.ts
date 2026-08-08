/**
 * STUDY-A1-PROD-TUTOR-WRAPPER Phase 6 — what the production Tutor wrapper is
 * allowed to reach, pinned transitively.
 *
 * The wrapper's whole reason for existing is that the frozen preview bridge
 * cannot be promoted. Saying so in a comment is worth nothing: an ordinary
 * refactor two cards from now can add one import and put the release-candidate
 * sentinel, the `portable-non-production` health report, or a preview port back
 * on the production path, and every test would still pass because none of them
 * changes behaviour on the paths those tests drive.
 *
 * So the boundary is walked rather than asserted. This test starts at the
 * wrapper's five production modules, follows every edge it can see, and holds
 * the whole reachable set to the derivation recorded below.
 *
 * THREE WAYS A GUARD LIKE THIS FAILS OPEN, and what is done about each.
 *
 * It throws on the first violation, so the second one is never reported and the
 * next card fixes one import at a time. Every violation is COLLECTED here and
 * asserted at the end.
 *
 * It models `import` and not `require`, so a single `require()` is invisible.
 * Both forms are modelled below, and so is dynamic `import()`.
 *
 * It models `require('x')` syntactically, so `const r = require; r('x')` walks
 * straight past it — the classifier sees no `require(` and reports nothing,
 * which is the worst of the three because it reads as a clean pass. Every
 * mention of `require` and every dynamic `import` that is NOT immediately
 * applied to a string literal is recorded as an UNANALYSABLE edge and fails
 * this test. A guard that cannot see an edge must say so, not stay quiet.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')

/**
 * The wrapper's production surface. Every module a host would import to run a
 * production Tutor turn, so the closure below is the closure that actually
 * ships — not just the adapter's.
 */
const ENTRY_POINTS = [
  'src/study/production/tutorAdapter.ts',
  'src/study/production/tutorRuntime.ts',
  'src/study/production/tutorPseudonym.ts',
  'src/study/production/tutorPresentation.ts',
  'src/study/production/tutorLaunchOrdering.ts',
]

/**
 * Bare specifiers this repository maps to a path. Taken from `resolve.alias` in
 * vite.config.ts, so the walk follows the same edge the bundler does — an
 * aliased package that was merely allowed rather than followed would hide its
 * own subtree, which is a 9-file hole in this particular closure.
 */
const PACKAGE_ALIASES: Readonly<Record<string, string>> = {
  '@frozen/tutor-math-r1': 'adaptive-tutor/subjects/math/index.ts',
}

/**
 * FORBIDDEN, and each entry with the reason it is forbidden rather than a bare
 * path — a later reader has to be able to tell a rule from a habit.
 */
const FORBIDDEN_MODULES: readonly { readonly fragment: string; readonly because: string }[] = [
  { fragment: 'study-engine/runtime/src/tutor-bridge', because: 'carries the release-candidate learner sentinel' },
  { fragment: 'study-engine/runtime/src/student', because: 'reaches production through tutor-bridge' },
  { fragment: 'study-engine/runtime/src/version', because: 'release-candidate version surface' },
  { fragment: 'study-engine/runtime/src/health', because: 'reports portable-non-production' },
  { fragment: 'study-engine/integration-labs', because: 'vendored non-production copies' },
  { fragment: 'study-engine/prototype', because: 'prototype surface' },
  { fragment: 'study-engine/ui', because: 'preview presentation' },
  { fragment: 'runtime/src/browser', because: 'preview browser surface' },
  { fragment: 'runtime/src/romeo', because: 'non-production content path' },
  { fragment: 'runtime/src/demonstrations', because: 'demonstration surface' },
  { fragment: 'src/study/localDevelopmentPorts', because: 'preview ports' },
  { fragment: 'src/study/mountedPorts', because: 'mounted preview ports' },
  { fragment: 'src/study/runtimeFacade', because: 'the release-candidate host runtime' },
  { fragment: 'src/study/runtimeCompatibility', because: 'asserts portable-non-production release mode' },
  { fragment: 'src/study/demonstrations', because: 'synthetic demonstration data' },
]

/** The sentinel identity the preview bridge sends for every learner. */
const RC1_SENTINEL = ['learner', 'local-release-candidate'].join(':')

interface Edge {
  readonly from: string
  readonly specifier: string
}

interface WalkResult {
  readonly files: readonly string[]
  readonly packages: readonly Edge[]
  readonly unresolved: readonly Edge[]
  readonly unanalysable: readonly string[]
}

/**
 * Static import/export, dynamic `import(...)` and `require(...)`, each with a
 * string literal. Bare `import './x'` is included — a side-effect import is an
 * edge like any other.
 */
const LITERAL_EDGE =
  /(?:^|[\s;{}()])(?:import|export)\s+(?:type\s+)?[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;{}()=,[])import\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[\s;{}()=,[])require\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[\s;{}()])import\s+['"]([^'"]+)['"]/g

/** Any `require` mention, and any dynamic `import(`, for the negative check. */
const REQUIRE_MENTION = /\brequire\b/g
const REQUIRE_LITERAL = /\brequire\s*\(\s*['"][^'"]+['"]\s*\)/g
const DYNAMIC_IMPORT = /\bimport\s*\(/g
const DYNAMIC_IMPORT_LITERAL = /\bimport\s*\(\s*['"][^'"]+['"]\s*\)/g

/**
 * Comments removed. Edge extraction runs on this: the specifiers it looks for
 * are themselves string literals, so strings must survive here.
 */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/**
 * Comments AND string literals removed, for the negative scan only.
 *
 * The frozen Math R1 lesson content is JSON-shaped TypeScript whose prose says
 * things like "Never require a camera". A bare `\brequire\b` counter reports
 * every one of those as an unanalysable edge, and a guard that cries wolf on
 * curriculum copy is a guard the next card deletes. Executable code cannot live
 * inside a string literal, so blanking them costs nothing and removes the whole
 * false-positive class.
 *
 * Written as a scanner rather than a regex because quote characters nest: an
 * apostrophe inside a double-quoted sentence would end a naive single-quote
 * match and desynchronise everything after it.
 */
function executableCode(text: string): string {
  const source = code(text)
  let out = ''
  let quote: string | null = null
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!
    if (quote === null) {
      if (character === '"' || character === "'" || character === '`') {
        quote = character
        out += ' '
        continue
      }
      out += character
      continue
    }
    if (character === '\\') {
      index += 1
      out += ' '
      continue
    }
    if (character === quote) quote = null
    out += ' '
  }
  return out
}

function resolveSpecifier(fromFile: string, specifier: string): { kind: 'file' | 'package' | 'unresolved'; id: string } {
  if (!specifier.startsWith('.')) {
    const alias = PACKAGE_ALIASES[specifier]
    if (alias) return { kind: 'file', id: resolve(repoRoot, alias) }
    return { kind: 'package', id: specifier }
  }
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [
    base,
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return { kind: 'file', id: candidate }
  }
  return { kind: 'unresolved', id: base }
}

/**
 * Collects, and never throws mid-walk.
 *
 * An exception here would stop the walk at the first surprise and report a
 * closure smaller than the real one — the failure mode where a guard is loudest
 * about the least important thing and silent about the rest.
 */
function walk(entries: readonly string[]): WalkResult {
  const seen = new Set<string>()
  const packages: Edge[] = []
  const unresolved: Edge[] = []
  const unanalysable: string[] = []
  const stack = entries.map((entry) => resolve(repoRoot, entry))

  while (stack.length > 0) {
    const file = stack.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    let raw: string
    try {
      raw = readFileSync(file, 'utf8')
    } catch {
      unresolved.push({ from: file, specifier: '<unreadable>' })
      continue
    }
    const source = code(raw)
    // The negative scan reads the string-stripped form; the edge extraction
    // below reads the form that still has its specifiers in it.
    const executable = executableCode(raw)

    const requireMentions = (executable.match(REQUIRE_MENTION) ?? []).length
    const requireLiterals = (source.match(REQUIRE_LITERAL) ?? []).length
    if (requireMentions > requireLiterals) {
      unanalysable.push(`${relative(repoRoot, file).replaceAll('\\', '/')}: ${requireMentions - requireLiterals} require mention(s) not applied to a string literal`)
    }
    const dynamicImports = (executable.match(DYNAMIC_IMPORT) ?? []).length
    const dynamicImportLiterals = (source.match(DYNAMIC_IMPORT_LITERAL) ?? []).length
    if (dynamicImports > dynamicImportLiterals) {
      unanalysable.push(`${relative(repoRoot, file).replaceAll('\\', '/')}: ${dynamicImports - dynamicImportLiterals} dynamic import(s) without a string literal`)
    }

    LITERAL_EDGE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = LITERAL_EDGE.exec(source)) !== null) {
      const specifier = match[1] ?? match[2] ?? match[3] ?? match[4]
      if (!specifier) continue
      const resolved = resolveSpecifier(file, specifier)
      if (resolved.kind === 'package') packages.push({ from: file, specifier })
      else if (resolved.kind === 'unresolved') unresolved.push({ from: file, specifier })
      else if (!seen.has(resolved.id)) stack.push(resolved.id)
    }
  }

  return {
    files: [...seen].map((file) => relative(repoRoot, file).replaceAll('\\', '/')).sort(),
    packages,
    unresolved,
    unanalysable,
  }
}

describe('production Tutor wrapper import closure', () => {
  const closure = walk(ENTRY_POINTS)

  it('resolves every edge it can see, and reports every edge it cannot', () => {
    // Ordered so a failure names the unseeable edges first: an unanalysable
    // edge invalidates every other claim this file makes, because the closure
    // below is only the closure of what the walker could follow.
    expect(closure.unanalysable).toEqual([])
    expect(closure.unresolved.map((edge) => `${relative(repoRoot, edge.from)} -> ${edge.specifier}`)).toEqual([])
    expect(closure.packages.map((edge) => `${relative(repoRoot, edge.from)} -> ${edge.specifier}`)).toEqual([])
  })

  it('reaches no forbidden module, and collects every violation before failing', () => {
    const violations: string[] = []
    for (const file of closure.files) {
      for (const forbidden of FORBIDDEN_MODULES) {
        if (file.includes(forbidden.fragment)) {
          violations.push(`${file} (${forbidden.because})`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('does not reach the frozen preview bridge or the release-candidate runtime surfaces', () => {
    // Stated separately from the fragment sweep because these are the four the
    // card names by hand, and a fragment list is easy to edit down.
    expect(closure.files).not.toContain('adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts')
    expect(closure.files).not.toContain('adaptive-tutor/study-engine/runtime/src/student.ts')
    expect(closure.files).not.toContain('adaptive-tutor/study-engine/runtime/src/version.ts')
    expect(closure.files).not.toContain('adaptive-tutor/study-engine/runtime/src/health.ts')
  })

  it('carries the release-candidate learner sentinel nowhere in its production closure', () => {
    const carriers = closure.files.filter((file) => readFileSync(resolve(repoRoot, file), 'utf8').includes(RC1_SENTINEL))
    expect(carriers).toEqual([])
  })

  it('never asserts the portable-non-production release mode', () => {
    // `assertAcceptedStudyRuntime` REQUIRES `release.mode === 'portable-non-production'`.
    // A production wrapper calling it would be asserting that production is not
    // production, and would throw on any build that ever reported otherwise.
    //
    // Scanned on the comment-stripped form, unlike the sentinel above: this
    // asks whether the closure CALLS it, and a comment explaining why it must
    // not be called is the documentation, not the violation.
    const carriers = closure.files.filter((file) =>
      code(readFileSync(resolve(repoRoot, file), 'utf8')).includes('assertAcceptedStudyRuntime'))
    expect(carriers).toEqual([])
  })

  it('reaches the frozen primitives it is supposed to reach', () => {
    // The positive half. Without it, a closure that had accidentally become
    // empty — an entry point renamed, a walker that stopped following — would
    // pass every assertion above while proving nothing at all.
    expect(closure.files).toContain('adaptive-tutor/study-engine/bridges/tutor-core/src/orchestrator.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/bridges/tutor-core/src/safety-gateway.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/bridges/tutor-core/src/privacy.ts')
    expect(closure.files).toContain('adaptive-tutor/core/engine/adaptive-tutor-engine.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/runtime/src/subject-registry.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/runtime/src/safety.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/contracts/versioning.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/schemas/learning-evidence.schema.ts')
    // Followed through the alias rather than allowed past it.
    expect(closure.files).toContain('adaptive-tutor/subjects/math/index.ts')
  })

  it('holds the closure to its measured size, so a new subtree is a visible change', () => {
    // Not a style rule, and deliberately an exact number rather than a band.
    // The forbidden list above can only refuse what someone thought of; this
    // notices anything arriving that nobody thought of. A card that legitimately
    // grows the closure updates this number and says in its message what it
    // added — which is the whole cost, and it is the right cost for the one
    // boundary that keeps a release-candidate surface out of production.
    //
    // 89 as measured on this card: 70 under adaptive-tutor/ (the frozen bridge
    // primitives, the frozen Core, the subject registry and the aliased frozen
    // Math R1 package) and 19 under src/study/ (the Tutor contract, the host
    // ports and types, the lifecycle, and the wrapper's own five modules).
    expect(closure.files.length).toBe(89)
    expect(closure.files.filter((file) => file.startsWith('src/study/'))).toHaveLength(19)
  })
})
