/**
 * STUDY-A1-PRODUCTION-SAFE-CONTAINER — the transitive import walker, shared by
 * every closure guard rather than reimplemented per guard.
 *
 * Moved here verbatim from ../production/tutorAdapterImportClosure.test.ts,
 * which was the only closure guard when it was written. There are two now — the
 * production Tutor wrapper's and the production container's — and two
 * hand-written walkers is the shape where one of them quietly becomes weaker
 * than the other and nobody notices, because each guard's own test still
 * passes. The entry points, the forbidden lists and the size pins stay with
 * their guards; only the mechanism is here.
 *
 * THREE WAYS A GUARD LIKE THIS FAILS OPEN, and what is done about each.
 *
 * It throws on the first violation, so the second one is never reported and the
 * next card fixes one import at a time. Nothing here throws mid-walk; every
 * surprise is COLLECTED and returned for the caller to assert on.
 *
 * It models `import` and not `require`, so a single `require()` is invisible.
 * Both forms are modelled below, and so is dynamic `import()`.
 *
 * It models `require('x')` syntactically, so `const r = require; r('x')` walks
 * straight past it — the classifier sees no `require(` and reports nothing,
 * which is the worst of the three because it reads as a clean pass. Every
 * mention of `require` and every dynamic `import` that is NOT immediately
 * applied to a string literal is recorded as an UNANALYSABLE edge. A guard that
 * cannot see an edge must say so, not stay quiet.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

/**
 * Bare specifiers this repository maps to a path. Taken from `resolve.alias` in
 * vite.config.ts, so the walk follows the same edge the bundler does — an
 * aliased package that was merely allowed rather than followed would hide its
 * own subtree, which is a 9-file hole in the wrapper's closure.
 */
export const PACKAGE_ALIASES: Readonly<Record<string, string>> = {
  '@frozen/tutor-math-r1': 'adaptive-tutor/subjects/math/index.ts',
}

/** The sentinel identity the preview bridge sends for every learner. */
export const RC1_SENTINEL = ['learner', 'local-release-candidate'].join(':')

export interface Edge {
  readonly from: string
  readonly specifier: string
}

export interface WalkResult {
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
export function code(text: string): string {
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
export function executableCode(text: string): string {
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

function resolveSpecifier(
  repoRoot: string,
  fromFile: string,
  specifier: string,
): { kind: 'file' | 'package' | 'unresolved'; id: string } {
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
export function walkImportClosure(repoRoot: string, entries: readonly string[]): WalkResult {
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
      const resolved = resolveSpecifier(repoRoot, file, specifier)
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
