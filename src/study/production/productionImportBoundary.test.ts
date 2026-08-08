import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(here, '..', '..')

/**
 * STUDY-A1-PROD-DASH-1 Phase 9 — the boundary is claimed over the whole static
 * import closure, not over one file's own import list. A forbidden module one
 * hop away is still in the production surface, and a single-file regex would
 * never see it.
 *
 * STUDY-A1-PROD-DASH-H2 Phase 2 — and the closure is walked twice, because a
 * text-level walk answers the wrong question.
 *
 * The dashboard's raw import text reaches `sync/supabase` (and with it
 * `@supabase/supabase-js` `createClient`) in three hops:
 *
 *   VerifiedStudyDashboard -> verifiedRuntimeAdapter
 *     -> studyProductionReadinessClient -> tutor/gatewayAuth -> sync/supabase
 *
 * Today that path is harmless, because the first two hops are `import type` and
 * TypeScript erases them before the bundler runs: none of it is in the shipped
 * bundle. But "harmless because of how the import happens to be written" is a
 * property no text-level walk can see, and deleting four characters would
 * silently pull a Supabase client into the learner surface.
 *
 * So edges are classified with the TypeScript parser rather than a regex, and
 * the forbidden set is asserted against the VALUE closure — the modules the
 * production bundle actually keeps. The raw closure is still walked, and the
 * erased frontier is asserted by name below, so the erasure this boundary
 * depends on is a committed fact rather than an accident.
 */

type ImportEdgeKind = 'value' | 'type'

interface ImportEdge {
  /**
   * The module this edge names, or `null` when the edge is a call whose target
   * is not a string literal. `null` is not "no edge": it is an edge the
   * boundary cannot read, and the walk below fails on it rather than passing it
   * by silence.
   */
  readonly specifier: string | null
  readonly kind: ImportEdgeKind
}

/**
 * STUDY-A1-PROD-DASH-H3 Phase 3 — a call is a `require`, however it is reached.
 *
 * A bare `require('m')` is the shape that matters, but `globalThis.require?.('m')`
 * and `globalThis['require']('m')` are the same edge written to slip past a check
 * that only looks for an identifier, so the name is matched wherever the callee
 * ends.
 */
function isRequireCall(node: ts.CallExpression): boolean {
  const callee = node.expression
  if (ts.isIdentifier(callee)) return callee.text === 'require'
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text === 'require'
  if (ts.isElementAccessExpression(callee)) {
    return ts.isStringLiteral(callee.argumentExpression) &&
      callee.argumentExpression.text === 'require'
  }
  return false
}

/**
 * The specifier of a `require(...)` or `import(...)`, or `null` when it is not a
 * string literal.
 *
 * Only a literal is read. Nothing here executes, resolves or evaluates the
 * argument: a variable, a template and a conditional are all reported as
 * unknown, because a guess about where such a call leads is worth less than an
 * admission that the boundary cannot see it.
 */
function literalSpecifier(node: ts.CallExpression): string | null {
  const first = node.arguments[0]
  return first && ts.isStringLiteral(first) ? first.text : null
}

/**
 * Every module edge a source file declares, classified as one the production
 * bundle keeps or one TypeScript erases.
 *
 * The classification is deliberately asymmetric: only a clause the language
 * guarantees is erased — `import type ... from` and `export type ... from` —
 * counts as a type edge. Everything else is a value edge, including
 * `import { type A } from 'm'`, whose erasure depends on a compiler setting
 * (`verbatimModuleSyntax`) that this repo does not pin. Guessing wrong in that
 * direction would let a forbidden module through; guessing wrong in this
 * direction only fails a test that a human then reads.
 */
function importEdges(fileName: string, text: string): readonly ImportEdge[] {
  const parsed = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const edges: ImportEdge[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      // `import 'm'` has no clause at all: kept for its side effects.
      const kind: ImportEdgeKind = node.importClause?.isTypeOnly ? 'type' : 'value'
      edges.push({ specifier: node.moduleSpecifier.text, kind })
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      edges.push({
        specifier: node.moduleSpecifier.text,
        kind: node.isTypeOnly ? 'type' : 'value',
      })
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      // A dynamic import is a runtime edge whatever the imported names are.
      edges.push({ specifier: literalSpecifier(node), kind: 'value' })
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      // `import x = require('m')`. `tsc` refuses this form under this repo's
      // `module: ESNext`, so it cannot reach a source file today — but that is
      // the compiler's guarantee, not this walk's, and a `module` change would
      // hand it back silently.
      const reference = node.moduleReference.expression
      edges.push({
        specifier: ts.isStringLiteral(reference) ? reference.text : null,
        kind: node.isTypeOnly ? 'type' : 'value',
      })
    } else if (ts.isCallExpression(node) && isRequireCall(node)) {
      // TypeScript erases nothing here: a `require` is a call, and a call is a
      // value edge. Classifying it as anything else is what let an injected
      // `require('../../study/localDevelopmentPorts')` cross this boundary
      // unseen.
      edges.push({ specifier: literalSpecifier(node), kind: 'value' })
    }
    ts.forEachChild(node, visit)
  }

  visit(parsed)
  return edges
}

function resolveRelative(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier)
  // `./x.js` in this repo's TypeScript sources means `./x.ts` on disk.
  const withoutJs = base.replace(/\.js$/, '')
  const candidates = [
    base,
    `${base}.ts`, `${base}.tsx`,
    `${withoutJs}.ts`, `${withoutJs}.tsx`,
    join(base, 'index.ts'), join(base, 'index.tsx'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

interface ImportClosure {
  /** Every reachable module, as a `src`-relative POSIX path. */
  readonly files: readonly string[]
  /** Reachable packages, as written (`react`, `@supabase/supabase-js`). */
  readonly packages: readonly string[]
  /** Relative specifiers that resolved to nothing, as `<file> -> <specifier>`. */
  readonly unresolved: readonly string[]
  /**
   * Files carrying a `require(...)` or `import(...)` whose target is not a
   * string literal. The walk cannot say where such a call leads, so the file is
   * named here and the boundary fails on it — the one thing that must never
   * happen is treating "unreadable" as "reaches nothing".
   */
  readonly unanalyzable: readonly string[]
}

/**
 * Unresolved specifiers are collected rather than thrown. Throwing mid-walk
 * turns every boundary question into one collection error about whichever
 * import happened to be unresolvable first, which hides the finding that
 * matters — the forbidden module the closure actually reached.
 */
function importClosure(entry: string, follow: ReadonlySet<ImportEdgeKind>): ImportClosure {
  const seen = new Set<string>()
  const packages = new Set<string>()
  const unresolved = new Set<string>()
  const unanalyzable = new Set<string>()
  const pending = [entry]
  while (pending.length > 0) {
    const file = pending.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const edge of importEdges(file, readFileSync(file, 'utf8'))) {
      if (!follow.has(edge.kind)) continue
      if (edge.specifier === null) {
        // Collected like the unresolved ones, and for the same reason: throwing
        // here would turn every boundary question into one error about whichever
        // call happened to be unreadable first.
        unanalyzable.add(relative(sourceRoot, file).replaceAll('\\', '/'))
        continue
      }
      if (!edge.specifier.startsWith('.')) {
        // Bare specifiers never resolve to a file here, but a forbidden package
        // is still reachable, so they are recorded rather than dropped.
        packages.add(edge.specifier)
        continue
      }
      const resolved = resolveRelative(file, edge.specifier)
      if (resolved) pending.push(resolved)
      else unresolved.add(`${relative(sourceRoot, file).replaceAll('\\', '/')} -> ${edge.specifier}`)
    }
  }
  return {
    files: [...seen].map((file) => relative(sourceRoot, file).replaceAll('\\', '/')),
    packages: [...packages],
    unresolved: [...unresolved],
    unanalyzable: [...unanalyzable],
  }
}

describe('production Study import boundary', () => {
  it('does not statically import preview ports or the sentinel runtime from App', () => {
    const app = readFileSync(join(sourceRoot, 'App.tsx'), 'utf8')
    expect(app).not.toMatch(/from ['"]\.\/study\/(?:localDevelopmentPorts|mountedPorts)['"]/)
    expect(app).not.toMatch(/from ['"]\.\/components\/study\/StudySessionRoute['"]/)
    expect(app).toContain('import.meta.env.DEV')
    expect(app).toContain("import('./study/mountedPorts')")
  })

  it('keeps local, memory, test, preview, synthetic and sentinel identifiers out of the production root', () => {
    const productionText = readdirSync(here)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(here, name), 'utf8'))
      .join('\n')
    expect(productionText).not.toMatch(/localDevelopmentPorts|memory-store|test provider|learner:local-release-candidate/i)
  })
})

// STUDY-A1-PROD-DASH-H2 Phase 2 — the classifier is the load-bearing part of
// the walk above, so it is tested directly rather than only through the real
// graph. A closure that silently classified every edge as `type` would pass
// every forbidden-module assertion in this file while checking nothing.
describe('production import edge classification', () => {
  const edge = (source: string) => importEdges('probe.ts', source)[0]

  it.each([
    ['import type { A } from \'./m\'', 'type'],
    ['export type { A } from \'./m\'', 'type'],
    ['import { a } from \'./m\'', 'value'],
    ['import a from \'./m\'', 'value'],
    ['import * as a from \'./m\'', 'value'],
    ['import \'./m\'', 'value'],
    ['export { a } from \'./m\'', 'value'],
    ['export * from \'./m\'', 'value'],
    ['import { a, type B } from \'./m\'', 'value'],
    ['const m = await import(\'./m\')', 'value'],
    // Erasure here depends on `verbatimModuleSyntax`, which this repo does not
    // pin, so the boundary treats it as a value edge rather than assume.
    ['import { type A } from \'./m\'', 'value'],
  ])('classifies `%s` as a %s edge', (source, kind) => {
    expect(edge(source)).toEqual({ specifier: './m', kind })
  })

  it('sees an edge inside a function body, not only at the top of a file', () => {
    const edges = importEdges('probe.ts', `
      export async function load() { return import('./lazy') }
    `)
    expect(edges).toEqual([{ specifier: './lazy', kind: 'value' }])
  })

  it('reports every edge a file declares, in order', () => {
    const edges = importEdges('probe.ts', `
      import type { A } from './types'
      import { b } from './values'
      import './side-effect'
    `)
    expect(edges).toEqual([
      { specifier: './types', kind: 'type' },
      { specifier: './values', kind: 'value' },
      { specifier: './side-effect', kind: 'value' },
    ])
  })
})

// STUDY-A1-PROD-DASH-H3 Phases 3 and 4 — the classifier above understood ESM and
// nothing else.
//
// A `require('../../study/localDevelopmentPorts')` injected into the real
// dashboard source typechecked, built, and left every assertion in this file
// green: the walk simply did not see the edge. Rollup happens to leave that call
// unresolved today rather than bundling the module, so the gap was never a
// shipped leak — but "the bundler currently declines to follow it" is not the
// boundary this file claims to hold.
//
// Two rules, and the second matters as much as the first. A `require` with a
// string literal is a VALUE edge, because TypeScript erases nothing about a
// call. A `require` whose target is not a literal is an edge this walk cannot
// read, and it is reported as unknown rather than skipped — silence would make
// `require(name)` the way around everything above.
describe('production import edge classification of CommonJS require', () => {
  const edge = (source: string) => importEdges('probe.ts', source)[0]

  it.each([
    'const x = require(\'./foo\')',
    'require("../bar")',
    'const { a } = require(\'./foo\')',
    'export const x = require(\'./foo\')',
    'function load() { return require(\'./foo\') }',
    'if (flag) { require(\'./foo\') }',
  ])('classifies %s as a value edge to a named module', (source) => {
    expect(edge(source)?.kind).toBe('value')
    expect(typeof edge(source)?.specifier).toBe('string')
  })

  it.each([
    ['const x = require(\'./foo\')', './foo'],
    ['require("../bar")', '../bar'],
    ['require(\'@supabase/supabase-js\')', '@supabase/supabase-js'],
  ])('reads the specifier of %s', (source, specifier) => {
    expect(edge(source)).toEqual({ specifier, kind: 'value' })
  })

  it('never classifies a require as an erased edge', () => {
    // The mutation this kills: `kind: 'type'`. A require is a call; there is no
    // TypeScript setting under which it disappears, so a type classification
    // would hide every forbidden module reached this way.
    for (const source of [
      'const x = require(\'./foo\')',
      'require(\'@supabase/supabase-js\')',
      'const x = require(name)',
    ]) {
      expect(edge(source)?.kind).toBe('value')
      expect(edge(source)?.kind).not.toBe('type')
    }
  })

  it.each([
    ['a variable', 'const x = require(name)'],
    ['a template with a substitution', 'const x = require(`./${name}`)'],
    ['a conditional', 'const x = require(condition ? \'./a\' : \'./b\')'],
    ['an optional call through globalThis', 'globalThis.require?.(name)'],
    ['an indexed access', 'globalThis[\'require\'](name)'],
    ['a concatenation', 'const x = require(\'./\' + name)'],
    ['no argument at all', 'require()'],
  ])('reports %s as an edge it cannot read, not as no edge', (_name, source) => {
    const found = edge(source)
    expect(found, `${source} produced no edge at all`).toBeDefined()
    expect(found!.kind).toBe('value')
    expect(found!.specifier).toBeNull()
  })

  it('reads the literal even when the call is reached through globalThis', () => {
    // Conservative in the safe direction: the specifier is legible, so the edge
    // is recorded by name and the forbidden set gets to judge it.
    expect(edge('globalThis.require?.(\'./x\')')).toEqual({ specifier: './x', kind: 'value' })
  })

  it('sees a require nested inside a function body', () => {
    expect(importEdges('probe.ts', `
      export function load() { return require('./lazy') }
    `)).toEqual([{ specifier: './lazy', kind: 'value' }])
  })

  it('leaves a require that is not a call alone', () => {
    // No call, no edge. A guard that fired on the identifier alone would report
    // edges that do not exist and train a reader to ignore it.
    expect(importEdges('probe.ts', 'const options = { require: false }')).toEqual([])
    expect(importEdges('probe.ts', 'const alias = require')).toEqual([])
  })

  it('classifies an import-equals require as a value edge', () => {
    // Unreachable in this repo — `tsc` rejects it under `module: ESNext` — so
    // this is held here rather than through an injection into real source. The
    // point is that the walk does not depend on that compiler setting staying
    // where it is.
    expect(edge('import x = require(\'./foo\')')).toEqual({ specifier: './foo', kind: 'value' })
  })

  it('applies the same rule to a dynamic import it cannot read', () => {
    // `import(name)` is the identical gap written the other way. Closing one and
    // not the other would leave the fail-closed rule a formality.
    expect(edge('const m = await import(name)')).toEqual({ specifier: null, kind: 'value' })
    expect(edge('const m = await import(`./${name}`)')).toEqual({ specifier: null, kind: 'value' })
  })

  it('reports require edges alongside the ESM ones, in order', () => {
    expect(importEdges('probe.ts', `
      import type { A } from './types'
      const b = require('./values')
      import './side-effect'
      const c = require(name)
    `)).toEqual([
      { specifier: './types', kind: 'type' },
      { specifier: './values', kind: 'value' },
      { specifier: './side-effect', kind: 'value' },
      { specifier: null, kind: 'value' },
    ])
  })
})

// STUDY-A1-PROD-DASH-H3 Phase 4 — the walk itself, on a closure built for the
// purpose.
//
// Classifying an edge correctly is only half of it: the closure has to act on
// the classification. Neither property is provable against the real dashboard
// graph, because that graph contains no require at all — every assertion about
// `unanalyzable` there passes by being empty, whether the walk collects
// unreadable calls or drops them on the floor. These fixtures give the walk
// something to find.
describe('the closure walk over CommonJS edges', () => {
  function withFixture(files: Readonly<Record<string, string>>, check: (dir: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), 'h3-import-boundary-'))
    try {
      for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
      check(dir)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  const valueOnly = () => new Set<ImportEdgeKind>(['value'])

  it('follows a require into the file it names', () => {
    withFixture({
      'entry.ts': `const forbidden = require('./leaf')\nvoid forbidden\n`,
      'leaf.ts': `export const leaf = 1\n`,
    }, (dir) => {
      const closure = importClosure(join(dir, 'entry.ts'), valueOnly())
      expect(closure.files).toHaveLength(2)
      expect(closure.files.some((file) => file.endsWith('leaf.ts'))).toBe(true)
      expect(closure.unanalyzable).toEqual([])
      expect(closure.unresolved).toEqual([])
    })
  })

  it('records a bare-package require as a reachable package', () => {
    withFixture({
      'entry.ts': `const client = require('@supabase/supabase-js')\nvoid client\n`,
    }, (dir) => {
      const closure = importClosure(join(dir, 'entry.ts'), valueOnly())
      expect(closure.packages).toEqual(['@supabase/supabase-js'])
    })
  })

  it('names the file when a require target cannot be read, rather than walking past it', () => {
    // The mutation this kills: dropping the `unanalyzable.add` and keeping the
    // `continue`. Against the real graph that mutant is invisible, because the
    // real graph never produces an unreadable edge for it to swallow.
    withFixture({
      'entry.ts': `declare const name: string\nconst hidden = require(name)\nvoid hidden\n`,
    }, (dir) => {
      const closure = importClosure(join(dir, 'entry.ts'), valueOnly())
      expect(closure.unanalyzable).toHaveLength(1)
      expect(closure.unanalyzable[0]).toContain('entry.ts')
      // And it is not quietly recorded as a package named something unreadable.
      expect(closure.packages).toEqual([])
    })
  })

  it('names the file for an unreadable dynamic import too', () => {
    withFixture({
      'entry.ts': `declare const name: string\nexport const load = () => import(name)\n`,
    }, (dir) => {
      expect(importClosure(join(dir, 'entry.ts'), valueOnly()).unanalyzable).toHaveLength(1)
    })
  })

  it('reaches a forbidden module through a require one hop away', () => {
    // The shape the boundary actually exists to catch: the entry file's own
    // imports look clean, and the forbidden edge is a require in a file it
    // pulls in.
    withFixture({
      'entry.ts': `import './hop'\n`,
      'hop.ts': `const ports = require('./localDevelopmentPorts')\nvoid ports\n`,
      'localDevelopmentPorts.ts': `export const ports = 1\n`,
    }, (dir) => {
      const closure = importClosure(join(dir, 'entry.ts'), valueOnly())
      expect(closure.files.some((file) => file.endsWith('localDevelopmentPorts.ts'))).toBe(true)
    })
  })

  it('does not follow a require that only a type edge reaches', () => {
    // The erasure asymmetry still holds under the new edge form: a require
    // inside a module reached only by `import type` is not in the value closure.
    withFixture({
      'entry.ts': `import type { A } from './types'\nexport type B = A\n`,
      'types.ts': `const ports = require('./localDevelopmentPorts')\nvoid ports\nexport type A = 1\n`,
      'localDevelopmentPorts.ts': `export const ports = 1\n`,
    }, (dir) => {
      const production = importClosure(join(dir, 'entry.ts'), valueOnly())
      const raw = importClosure(join(dir, 'entry.ts'), new Set<ImportEdgeKind>(['value', 'type']))
      expect(production.files).toHaveLength(1)
      expect(raw.files.some((file) => file.endsWith('localDevelopmentPorts.ts'))).toBe(true)
    })
  })
})

describe('verified production Study dashboard import boundary', () => {
  const entry = join(sourceRoot, 'components', 'study', 'VerifiedStudyDashboard.tsx')
  const raw = importClosure(entry, new Set<ImportEdgeKind>(['value', 'type']))
  /** What the production bundle keeps: type-only edges are erased before it. */
  const production = importClosure(entry, new Set<ImportEdgeKind>(['value']))

  it('walked a real closure', () => {
    // Guards every assertion below: an empty or one-file closure would pass the
    // forbidden checks without having looked at anything.
    expect(raw.files.length).toBeGreaterThan(5)
    expect(raw.files).toContain('components/study/VerifiedStudyDashboard.tsx')
    expect(raw.files).toContain('study/production/verifiedDashboardContracts.ts')
    expect(raw.files).toContain('study/production/verifiedRuntimeAdapter.ts')
    // Nothing was skipped, so "absent from the closure" means absent.
    expect(raw.unresolved).toEqual([])
    expect(production.unresolved).toEqual([])
    // And nothing was unreadable, so "absent" is not standing in for "there is a
    // call here whose target this walk could not name".
    expect(raw.unanalyzable).toEqual([])
    expect(production.unanalyzable).toEqual([])
  })

  it('walked a real production closure, and it is a subset of the raw one', () => {
    // The same guard for the walk the forbidden set is actually asserted
    // against: it must have reached the surface and its contracts for real.
    expect(production.files).toContain('components/study/VerifiedStudyDashboard.tsx')
    expect(production.files).toContain('study/production/verifiedDashboardContracts.ts')
    expect(production.files.every((file) => raw.files.includes(file))).toBe(true)
    expect(production.files.length).toBeLessThanOrEqual(raw.files.length)
  })

  it.each([
    // Preview and local-development composition.
    'study/localDevelopmentPorts',
    'study/mountedPorts',
    'study/ports',
    // Direct browser-to-database Study persistence.
    'study/persistence/',
    // Preview Study surfaces and their adapters.
    'components/study/StudyDashboard',
    'components/study/StudySessionRoute',
    'components/study/StudySessionContainer',
    'components/study/StudySettings',
    'study/calendarAdapter',
    'study/demonstrations',
    // Transports of their own. The verified surface speaks to the runtime
    // adapter it is handed and to nothing else, so the Supabase client and the
    // gateway bearer helper are both out of the production closure.
    'sync/',
    'sync/supabase',
    'tutor/gatewayAuth',
  ])('never reaches %s in production', (forbidden) => {
    expect(production.files.filter((file) => file.startsWith(forbidden))).toEqual([])
  })

  it('reaches no package except React from production', () => {
    // `@supabase/supabase-js` is the one that matters: `createClient` is a value
    // export, so a value edge to `sync/supabase` would bring it along.
    expect([...production.packages].sort()).toEqual(['react'])
  })

  it('never reaches supabaseShared, trustedServerRpc or trustedServerClient', () => {
    // Asserted over the raw closure: these must not be present even behind an
    // erased edge, because a type-only reference to a trusted-server transport
    // is already a design error.
    const text = raw.files.map((file) => readFileSync(join(sourceRoot, file), 'utf8')).join('\n')
    expect(text).not.toMatch(/supabaseShared|trustedServerRpc|trustedServerClient/)
  })

  it('carries no client construction or credential read into production', () => {
    const text = production.files
      .map((file) => readFileSync(join(sourceRoot, file), 'utf8'))
      .join('\n')
    expect(text).not.toMatch(/createClient|getGatewayAccessToken|SUPABASE_SERVICE_ROLE_KEY/)
  })

  // The erased frontier, named. These two edges are the only reason the walk
  // above stops short of a Supabase client, so each is asserted as type-only by
  // name: converting either one to a value import fails here first, and fails
  // the forbidden-module assertions immediately after.
  it.each([
    ['components/study/VerifiedStudyDashboard.tsx', '../../study/production/verifiedRuntimeAdapter'],
    ['study/production/verifiedRuntimeAdapter.ts', '../client/studyProductionReadinessClient'],
    ['study/production/verifiedRuntimeAdapter.ts', '../client/studyIdentityClient'],
  ])('keeps %s -> %s a type-only edge', (file, specifier) => {
    const edges = importEdges(file, readFileSync(join(sourceRoot, file), 'utf8'))
    const found = edges.filter((candidate) => candidate.specifier === specifier)
    expect(found, `${file} no longer imports ${specifier}`).toHaveLength(1)
    expect(found[0]!.kind).toBe('type')
  })

  it('reaches the Supabase client only through those erased edges', () => {
    // The positive half of the claim above. If this ever stops holding, the
    // erasure the boundary depends on has been removed from under it and the
    // type-only assertions have become decoration.
    expect(raw.files).toContain('sync/supabase.ts')
    expect(raw.files).toContain('tutor/gatewayAuth.ts')
    expect(raw.packages).toContain('@supabase/supabase-js')
    expect(production.files).not.toContain('sync/supabase.ts')
    expect(production.files).not.toContain('tutor/gatewayAuth.ts')
    expect(production.packages).not.toContain('@supabase/supabase-js')
  })

  it('runs the verified runtime adapter and never the identity client directly', () => {
    const component = readFileSync(entry, 'utf8')
    expect(component).toContain("from '../../study/production/verifiedRuntimeAdapter'")
    expect(component).not.toMatch(/studyIdentityClient|createStudyIdentityClient/)
    // No transport of its own: no fetch, no storage, no Supabase client.
    expect(component).not.toMatch(/\bfetch\s*\(|localStorage|sessionStorage|createClient/)
    expect(component).toContain('runtime.execute(')
  })

  it('leaves no mojibake in the surfaces this card wrote', () => {
    for (const file of [
      'components/study/VerifiedStudyDashboard.tsx',
      'study/production/verifiedDashboardContracts.ts',
    ]) {
      // Latin-1 supplement characters are how a mis-decoded UTF-8 ellipsis or
      // apostrophe shows up in this codebase.
      expect(readFileSync(join(sourceRoot, file), 'utf8')).not.toMatch(/[À-ÿ]/)
    }
    // The placeholder that carried one was deleted, not edited around.
    const app = readFileSync(join(sourceRoot, 'App.tsx'), 'utf8')
    expect(app).not.toContain('VerifiedProductionStudyHost')
    expect(app).not.toContain('Verified Study workspace')
  })
})
