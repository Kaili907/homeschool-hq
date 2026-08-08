import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
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
  readonly specifier: string
  readonly kind: ImportEdgeKind
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
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0]!)
    ) {
      // A dynamic import is a runtime edge whatever the imported names are.
      edges.push({ specifier: (node.arguments[0] as ts.StringLiteral).text, kind: 'value' })
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
  const pending = [entry]
  while (pending.length > 0) {
    const file = pending.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const edge of importEdges(file, readFileSync(file, 'utf8'))) {
      if (!follow.has(edge.kind)) continue
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
