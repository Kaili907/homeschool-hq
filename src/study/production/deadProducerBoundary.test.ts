/**
 * STUDY-A1-PROD-DEAD-PRODUCER-RETIREMENT-C — the production-port design's three
 * dead-producer findings, made load-bearing.
 *
 * All three are true of the tree today and all three are invisible: nothing
 * fails, nothing warns, and the only record of them is prose in
 * docs/study-engine-production-composition. Prose does not survive a refactor.
 * What follows is the same three facts stated so that undoing one breaks a test
 * or the typecheck rather than shipping.
 *
 *   1. `createSession13ProductionAssembly` has zero callers.
 *   2. `SupabaseStudyOutboxAdapter` targets four RPCs that the final migration
 *      state leaves executable by NO role.
 *   3. The durable Session 13 assembly targets `contracts/persistence`, which is
 *      a different contract from the host's `StudyPortBundle` in
 *      src/study/ports.ts — the two share slot names and share no methods.
 *
 * WHAT THIS FILE IS NOT. It does not retire anything and it does not change a
 * grant, a flag, a route or the host container. The Session 13 assembly and the
 * outbox adapter both stay exactly as they are; this says where they may not go.
 *
 * THE ONE GUARD THAT IS NOT LEXICAL. A name sweep only catches the spellings
 * someone thought of, so the load-bearing claim here is REACHABILITY: the walk
 * below starts at the real browser entry, follows every edge it can see, and
 * holds the dead producers out of the set. A call site spelled any way at all
 * pulls its module into that set.
 *
 * A walker that cannot see an edge fails this file rather than staying quiet —
 * `require` mentions not applied to a string literal, and dynamic `import(...)`
 * without one, are collected as UNANALYSABLE and asserted empty first. Every
 * claim below is only as good as that list being empty.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  createSession13ProductionAssembly,
  type Session13ProductionAssemblyInput,
} from '../composition/session13ProductionAssembly'
import {
  SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES,
  type Session13DurableAcademicAdapters,
} from '../composition/durableAcademicProductionPorts'
import { assertCompleteStudyPortBundle, type StudyPortBundle } from '../ports'
import type { StudySupabaseClient } from '../persistence/supabaseShared'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')

/** The module that shipping code would have to reach to run either producer. */
const ASSEMBLY_MODULE = 'src/study/composition/session13ProductionAssembly.ts'
/** `export *`, so a caller can reach the assembly without naming its file. */
const COMPOSITION_BARREL = 'src/study/composition/index.ts'
/** This file, which names the assembly in order to hold it. */
const THIS_FILE = 'src/study/production/deadProducerBoundary.test.ts'
/** The real browser entry — index.html's only module script. */
const BROWSER_ENTRY = 'src/main.tsx'
/** The production host surface the pending boundary at the end is about. */
const HOST_CONTAINER = 'src/components/study/StudySessionContainer.tsx'

/** The sentinel identity the frozen preview bridge sends for every learner. */
const RC1_SENTINEL = ['learner', 'local-release-candidate'].join(':')

function read(file: string): string {
  return readFileSync(resolve(repoRoot, file), 'utf8')
}

/** Comments removed; string literals kept, because specifiers live in them. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

// ---------------------------------------------------------------------------
// Import-closure walk. Adapted from ./tutorAdapterImportClosure.test.ts, which
// walks the Tutor wrapper's five entry points; this one walks the browser entry
// and the host container. Same failure modes, same handling: collect, never
// throw mid-walk, and report every edge that could not be followed.
// ---------------------------------------------------------------------------

/** Bare specifiers this repository maps to a path, from vite.config.ts. */
const PACKAGE_ALIASES: Readonly<Record<string, string>> = {
  '@frozen/tutor-math-r1': 'adaptive-tutor/subjects/math/index.ts',
}

const LITERAL_EDGE =
  /(?:^|[\s;{}()])(?:import|export)\s+(?:type\s+)?[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;{}()=,[])import\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[\s;{}()=,[])require\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[\s;{}()])import\s+['"]([^'"]+)['"]/g

const REQUIRE_MENTION = /\brequire\b/g
const REQUIRE_LITERAL = /\brequire\s*\(\s*['"][^'"]+['"]\s*\)/g
const DYNAMIC_IMPORT = /\bimport\s*\(/g
const DYNAMIC_IMPORT_LITERAL = /\bimport\s*\(\s*['"][^'"]+['"]\s*\)/g

/**
 * Comments AND string literals removed, for the negative scan only. Written as
 * a scanner because quote characters nest: an apostrophe inside a double-quoted
 * sentence ends a naive single-quote match and desynchronises everything after.
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

interface Edge {
  readonly from: string
  readonly specifier: string
}

interface WalkResult {
  readonly files: readonly string[]
  readonly packages: readonly string[]
  readonly unresolved: readonly string[]
  readonly unanalysable: readonly string[]
}

function resolveSpecifier(
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
    const executable = executableCode(raw)
    const label = relative(repoRoot, file).replaceAll('\\', '/')

    const requireMentions = (executable.match(REQUIRE_MENTION) ?? []).length
    const requireLiterals = (source.match(REQUIRE_LITERAL) ?? []).length
    if (requireMentions > requireLiterals) {
      unanalysable.push(`${label}: ${requireMentions - requireLiterals} require mention(s) not applied to a string literal`)
    }
    const dynamicImports = (executable.match(DYNAMIC_IMPORT) ?? []).length
    const dynamicImportLiterals = (source.match(DYNAMIC_IMPORT_LITERAL) ?? []).length
    if (dynamicImports > dynamicImportLiterals) {
      unanalysable.push(`${label}: ${dynamicImports - dynamicImportLiterals} dynamic import(s) without a string literal`)
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

  const describeEdge = (edge: Edge) =>
    `${relative(repoRoot, edge.from).replaceAll('\\', '/')} -> ${edge.specifier}`
  return {
    files: [...seen].map((file) => relative(repoRoot, file).replaceAll('\\', '/')).sort(),
    packages: [...new Set(packages.map((edge) => edge.specifier))].sort(),
    unresolved: [...new Set(unresolved.map(describeEdge))].sort(),
    unanalysable: unanalysable.sort(),
  }
}

// ---------------------------------------------------------------------------
// Source sweep, for the zero-caller claim.
// ---------------------------------------------------------------------------

const CODE_ROOTS = ['src', 'netlify', 'scripts', 'supabase', 'tests'] as const
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const

function sourceFiles(): readonly string[] {
  const found: string[] = []
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const full = resolve(directory, entry.name)
      if (entry.isDirectory()) visit(full)
      else if (CODE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
        found.push(relative(repoRoot, full).replaceAll('\\', '/'))
      }
    }
  }
  for (const root of CODE_ROOTS) {
    const full = resolve(repoRoot, root)
    if (existsSync(full)) visit(full)
  }
  return found.sort()
}

// ---------------------------------------------------------------------------
// A Session 13 assembly, built from clients and probes that would throw if the
// boundary ever touched them. Nothing here reaches a database.
// ---------------------------------------------------------------------------

const REFUSING_CLIENT: StudySupabaseClient = {
  auth: {
    getSession: () => {
      throw new Error('The dead-producer boundary never opens a Supabase session.')
    },
  },
  rpc: () => {
    throw new Error('The dead-producer boundary never calls a Supabase RPC.')
  },
}

const NOT_READY_PROBES = Object.fromEntries(
  SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES.map((key) => [key, () => 'not-ready' as const]),
) as Session13ProductionAssemblyInput['health']

const assembly = createSession13ProductionAssembly({
  authenticatedClient: REFUSING_CLIENT,
  trustedServerClient: REFUSING_CLIENT,
  health: NOT_READY_PROBES,
})

describe('STUDY-A1 dead production producers — the assembly has no caller', () => {
  it('is named by its own module and by this boundary, and nowhere else', () => {
    /**
     * A lexical sweep, and it is honest about being one: it catches the
     * spellings a caller would actually use — a direct import, a namespace
     * import, a re-export — and it does not catch a computed property access.
     * The closure walk in the next describe is what catches that.
     *
     * This file is in the expected set because it constructs the assembly
     * above. That is the point of listing the set exactly rather than counting
     * it: a third name arriving is a visible change to this line.
     */
    const namers = sourceFiles().filter((file) => read(file).includes('createSession13ProductionAssembly'))
    expect(namers).toEqual([ASSEMBLY_MODULE, THIS_FILE])
  })

  it('is not reachable through the composition barrel either', () => {
    // src/study/composition/index.ts re-exports the assembly with `export *`,
    // so a module importing the BARREL reaches the assembly without ever
    // naming it. Today nothing imports the barrel: every importer of
    // study/composition names a submodule (hostStudyLifecycle, appStudySession).
    //
    // This matches the `from '...'` form only. A side-effect `import '../composition'`
    // or a dynamic `import('../composition')` walks past it and is caught by the
    // closure below instead, where the barrel is named as a forbidden module.
    const barrelImporters = sourceFiles().filter((file) =>
      /from\s+['"][^'"]*\/composition['"]|from\s+['"]\.\.?\/composition['"]/.test(code(read(file))))
    expect(barrelImporters).toEqual([])
    // And the barrel does re-export it, so the check above is about something.
    expect(code(read(COMPOSITION_BARREL))).toContain("export * from './session13ProductionAssembly'")
  })
})

describe('STUDY-A1 dead production producers — nothing dead reaches the browser', () => {
  const closure = walk([BROWSER_ENTRY])

  it('follows every edge it can see, and reports every edge it cannot', () => {
    // First, because everything below is only a claim about what the walker
    // could follow.
    expect(closure.unanalysable).toEqual([])
    // One unresolved edge, and it is an asset rather than a module: Vite's
    // `?raw` suffix on a generated curriculum markdown file. It resolves to no
    // TypeScript module by construction, so it is pinned rather than allowed.
    expect(closure.unresolved).toEqual([
      'src/reading/passages.ts -> ../curriculum/reading/Reading-Passages-Q1.md?raw',
    ])
    expect(closure.packages).toEqual(['@supabase/supabase-js', 'react', 'react-dom/client'])
  })

  it('reaches the surfaces it is supposed to reach', () => {
    // The positive control. Without it a closure that had silently become empty
    // — an entry renamed, a walker that stopped following — would satisfy every
    // absence below while proving nothing at all.
    expect(closure.files).toContain('src/App.tsx')
    expect(closure.files).toContain('src/study/ports.ts')
    expect(closure.files).toContain(HOST_CONTAINER)
    expect(closure.files.length).toBeGreaterThan(200)
  })

  it('does not reach the Session 13 production assembly', () => {
    expect(closure.files).not.toContain(ASSEMBLY_MODULE)
    expect(closure.files).not.toContain(COMPOSITION_BARREL)
  })

  it('does not reach any Supabase durable persistence adapter', () => {
    // Derived by listing the directory rather than by naming the eight
    // adapters, so a ninth adapter is covered on the day it is written.
    const persistenceModules = readdirSync(resolve(repoRoot, 'src/study/persistence'))
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => `src/study/persistence/${name}`)
      .sort()
    expect(persistenceModules).toContain('src/study/persistence/SupabaseStudyOutboxAdapter.ts')
    expect(closure.files.filter((file) => persistenceModules.includes(file))).toEqual([])
  })
})

describe('STUDY-A1 dead production producers — the assembly is not a host port bundle', () => {
  /**
   * The tripwire the card asks for, in the two places the mistake would be
   * made: the type, and the shape at runtime.
   *
   * Both `src/study/ports.ts` and `src/study/contracts/persistence/ports.ts`
   * export types named `StudyPersistencePort`, `StudyCheckpointPort`,
   * `StudyOutboxPort` and five more. The names match; the methods do not
   * overlap at all — the host calls `loadSession`/`saveSession`, the durable
   * contract exposes `createSession`/`transitionSession`. That collision is
   * exactly what makes "just pass the assembly's adapters to the host" look
   * plausible to a reader who has only seen one of the two files.
   */
  it('does not type-check as a StudyPortBundle', () => {
    // Positive control FIRST: the value really is the durable adapter set, so
    // the negative pin below fails for the reason it claims rather than
    // because an import went stale.
    const durable: Session13DurableAcademicAdapters = assembly.adapters
    expect(Object.keys(durable).sort()).toEqual([
      'adultPrivate',
      'calendar',
      'checkpoint',
      'eventLedger',
      'outbox',
      'parentSettings',
      'reviewQueue',
      'studySession',
    ])

    // @ts-expect-error The durable Session 13 adapters implement
    // contracts/persistence, not the host StudyPortBundle. If this line ever
    // compiles, the two contracts have converged and wiring the assembly into
    // the browser has stopped being a type error — which is the moment this
    // boundary is supposed to demand a review.
    const asHostBundle: StudyPortBundle = durable
    expect(asHostBundle).toBe(durable)

    // @ts-expect-error And the obvious next move — reach for a cast — is
    // refused too. The two contracts do not overlap enough for `as` to be
    // plausible to the compiler: `SupabaseStudyCheckpointAdapter` has neither
    // `loadLatest` nor `save`. Only an `as unknown as` gets past this, which is
    // a deliberate act rather than a tidy-up.
    const asPartialHostBundle = durable as Partial<StudyPortBundle>
    expect(asPartialHostBundle).toBe(durable)
  })

  it('is rejected by the host completeness check at runtime', () => {
    // The type pins above are gone the moment someone writes `as unknown as`.
    // This is the same claim without the compiler: the host's own guard, run on
    // the durable adapters, refuses them and names what is missing.
    const forced = assembly.adapters as unknown as Partial<StudyPortBundle>
    expect(() => assertCompleteStudyPortBundle(forced)).toThrow(/missing persistence, safety port/)
  })

  it('brands nine registry slots rather than a bundle', () => {
    // What it DOES produce, so the absence above is a statement about a real
    // object. Nine slots from eight adapters: the outbox adapter serves both
    // `adult-review-proposal-store` and `outbox-store`.
    expect(assembly.ports.map((port) => port.key)).toEqual([...SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES])
    expect(assembly.ports).toHaveLength(9)
    expect(Object.keys(assembly.adapters)).toHaveLength(8)
  })
})

// ---------------------------------------------------------------------------
// The stale outbox adapter: explicitly non-routable.
// ---------------------------------------------------------------------------

/**
 * The four legacy RPCs `SupabaseStudyOutboxAdapter` calls, with the argument
 * types that make each signature unique. The NAMES are cross-checked against
 * the adapter source below, so adding a fifth call without adding it here fails
 * this file rather than slipping past the lineage replay.
 */
const OUTBOX_RPC_SIGNATURES: Readonly<Record<string, string>> = Object.freeze({
  academy_study_create_adult_review_proposal: 'jsonb',
  academy_study_enqueue_outbox: 'jsonb',
  academy_study_transition_outbox: 'jsonb',
  academy_study_outbox_status: 'uuid',
})

const DOLLAR_QUOTED_BODY = /\$([a-zA-Z_]*)\$[\s\S]*?\$\1\$/g

/** Splits a grant/revoke target list on commas that are not inside parentheses. */
function splitTargets(list: string): readonly string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const character of list) {
    if (character === '(') depth += 1
    if (character === ')') depth -= 1
    if (character === ',' && depth === 0) {
      out.push(current)
      current = ''
      continue
    }
    current += character
  }
  if (current.trim()) out.push(current)
  return out.map((target) => target.trim())
}

interface AclReplay {
  readonly roles: ReadonlyMap<string, ReadonlySet<string>>
  readonly lineage: ReadonlyMap<string, readonly string[]>
  readonly unanalysable: readonly string[]
}

/**
 * Replays every GRANT and REVOKE in the migrations, in applied order, over the
 * four signatures — and seeds each one with PUBLIC, because that is what
 * PostgreSQL grants a newly created function by default. Seeding matters: it is
 * the difference between "nobody was granted EXECUTE" and "nobody CAN execute".
 * A migration that dropped the `revoke ... from public` line would still grant
 * nothing and would still leave the function callable by every role.
 */
function replayFunctionAcl(): AclReplay {
  const migrationsDirectory = resolve(repoRoot, 'supabase/migrations')
  const roles = new Map<string, Set<string>>()
  const lineage = new Map<string, string[]>()
  const unanalysable: string[] = []
  for (const name of Object.keys(OUTBOX_RPC_SIGNATURES)) {
    roles.set(name, new Set())
    lineage.set(name, [])
  }

  const files = readdirSync(migrationsDirectory).filter((name) => name.endsWith('.sql')).sort()
  for (const file of files) {
    const raw = readFileSync(resolve(migrationsDirectory, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--[^\n]*/g, ' ')

    // A grant issued from inside a function body or DO block is invisible to a
    // statement-level replay. Ones that do not mention these four functions
    // cannot affect them; one that does is reported rather than ignored.
    for (const body of raw.match(DOLLAR_QUOTED_BODY) ?? []) {
      if (!/\b(grant|revoke)\b/i.test(body)) continue
      for (const name of Object.keys(OUTBOX_RPC_SIGNATURES)) {
        if (body.includes(name)) unanalysable.push(`${file}: grant/revoke on ${name} inside a dollar-quoted body`)
      }
    }

    const sql = raw.replace(DOLLAR_QUOTED_BODY, ' <body> ').replace(/\s+/g, ' ').toLowerCase()
    if (sql.includes('alter default privileges')) {
      unanalysable.push(`${file}: alter default privileges is not modelled`)
    }

    for (const statement of sql.split(';')) {
      const trimmed = statement.trim()
      for (const [name, args] of Object.entries(OUTBOX_RPC_SIGNATURES)) {
        if (new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\s*\\(`).test(trimmed)) {
          const history = lineage.get(name)!
          if (history.length === 0) {
            roles.get(name)!.add('public')
            history.push(`${file}: create — default execute to public`)
          } else {
            // CREATE OR REPLACE preserves the existing ACL.
            history.push(`${file}: create or replace — acl preserved`)
          }
          continue
        }
        if (!/^(grant|revoke)\b/.test(trimmed)) continue
        const match = trimmed.match(/on\s+function\s+([^;]*?)\s+(from|to)\s+([a-z_, ]+)$/)
        if (!match) {
          if (trimmed.includes(`public.${name}`)) {
            unanalysable.push(`${file}: unparsed grant/revoke naming ${name}: ${trimmed}`)
          }
          continue
        }
        const wanted = `public.${name}(${args})`
        if (!splitTargets(match[1]!).some((target) => target.replaceAll(' ', '') === wanted)) continue
        const grantees = match[3]!.split(',').map((role) => role.trim()).filter(Boolean)
        const current = roles.get(name)!
        if (trimmed.startsWith('grant')) {
          for (const role of grantees) current.add(role)
          lineage.get(name)!.push(`${file}: grant to ${grantees.join(', ')}`)
        } else {
          for (const role of grantees) current.delete(role)
          lineage.get(name)!.push(`${file}: revoke from ${grantees.join(', ')}`)
        }
      }
    }
  }

  return { roles, lineage, unanalysable: unanalysable.sort() }
}

describe('STUDY-A1 stale outbox adapter — explicitly non-routable', () => {
  const acl = replayFunctionAcl()

  it('calls exactly the four RPCs whose grants are replayed below', () => {
    // Derived from the adapter, not restated. A fifth `trustedServerRpc` call
    // fails here, so the lineage claim can never silently cover less than the
    // adapter actually does.
    const adapter = code(read('src/study/persistence/SupabaseStudyOutboxAdapter.ts'))
    const called = [...adapter.matchAll(/trustedServerRpc\(\s*this\.serverClient,\s*'([a-z0-9_]+)'/g)]
      .map((match) => match[1]!)
      .sort()
    expect(called).toEqual(Object.keys(OUTBOX_RPC_SIGNATURES).sort())
    // And it reaches the database only through the trusted-server helper, so
    // the four above are the whole surface rather than most of it.
    expect(adapter).not.toMatch(/authenticatedRpc|this\.serverClient\.rpc/)
  })

  it('replays the migrations without an unmodelled grant', () => {
    expect(acl.unanalysable).toEqual([])
    // Each signature has a real history, so an empty role set below is the
    // result of revokes rather than of matching nothing at all.
    for (const name of Object.keys(OUTBOX_RPC_SIGNATURES)) {
      expect(acl.lineage.get(name)?.length ?? 0).toBeGreaterThanOrEqual(3)
      expect(acl.lineage.get(name)?.[0]).toMatch(/create — default execute to public$/)
    }
  })

  it('leaves every one of the four executable by no role at all', () => {
    const remaining = Object.fromEntries(
      Object.keys(OUTBOX_RPC_SIGNATURES).map((name) => [name, [...(acl.roles.get(name) ?? [])].sort()]),
    )
    expect(remaining).toEqual({
      academy_study_create_adult_review_proposal: [],
      academy_study_enqueue_outbox: [],
      academy_study_transition_outbox: [],
      academy_study_outbox_status: [],
    })
  })

  it('is constructed nowhere but the dead assembly', () => {
    // Not retired, and deliberately not: the RPCs still exist (revoked, not
    // dropped), the assembly still brands two registry slots from this adapter,
    // and the live adult-review path uses the attempt-bound `_v1` replacements
    // through the Netlify server ports instead. Deleting the class would mean
    // editing the assembly and the registry composer, which is a larger change
    // than the fact being recorded. So: kept, and held out of the browser.
    // The needle is assembled rather than written out: spelled literally it
    // would match this file too, and an expected list that has to include the
    // test doing the searching hides the one entry that matters.
    const construction = ['new ', 'SupabaseStudyOutboxAdapter', '('].join('')
    const constructors = sourceFiles().filter((file) => code(read(file)).includes(construction))
    expect(constructors).toEqual([ASSEMBLY_MODULE])
  })
})

// ---------------------------------------------------------------------------
// Pending: the production container boundary. Recorded here, closed elsewhere.
// ---------------------------------------------------------------------------

/**
 * Explicit contract data for a boundary this card does not close and must not
 * pretend to. `StudySessionContainer` — the host surface a production route
 * would render — statically reaches the release-candidate host runtime and,
 * through it, the frozen preview bridge that sends one sentinel identity for
 * every learner. That is why the production route is dark, and it is the
 * parallel safe-container lane's job to change, not this one's.
 */
const PENDING_PRODUCTION_CONTAINER_BOUNDARY = Object.freeze({
  status: 'open',
  surface: HOST_CONTAINER,
  /** Reached statically from the container today. */
  reaches: Object.freeze([
    'adaptive-tutor/study-engine/runtime/src/health.ts',
    'adaptive-tutor/study-engine/runtime/src/student.ts',
    'adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts',
    'adaptive-tutor/study-engine/runtime/src/version.ts',
    'src/study/runtimeFacade.ts',
  ]),
  /** Of those, the modules that carry the sentinel learner identity itself. */
  sentinelCarriers: Object.freeze([
    'adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts',
    'src/study/runtimeFacade.ts',
  ]),
  closedBy: 'the parallel safe-container lane',
  notClosedBy: 'STUDY-A1-PROD-DEAD-PRODUCER-RETIREMENT-C',
})

describe('STUDY-A1 pending production container boundary', () => {
  it('records the container reaching runtimeFacade and the RC1 sentinel, unchanged', () => {
    /**
     * A record, held against measurement — not a failing test and not a fix.
     * The assertions below pass today because the boundary is open. When the
     * safe-container lane closes it they stop passing, and whoever closes it
     * has to come here and say so. That is the whole mechanism: the open state
     * is pinned so that closing it cannot be silent either.
     */
    const closure = walk([PENDING_PRODUCTION_CONTAINER_BOUNDARY.surface])
    expect(closure.unanalysable).toEqual([])

    const reached = PENDING_PRODUCTION_CONTAINER_BOUNDARY.reaches.filter((module) =>
      closure.files.includes(module))
    expect(reached).toEqual([...PENDING_PRODUCTION_CONTAINER_BOUNDARY.reaches])

    const carriers = closure.files.filter((file) => read(file).includes(RC1_SENTINEL)).sort()
    expect(carriers).toEqual([...PENDING_PRODUCTION_CONTAINER_BOUNDARY.sentinelCarriers])

    // The recorded status is derived from the measurement rather than asserted
    // against itself, so the datum above cannot drift away from the tree.
    const measured = carriers.length > 0 ? 'open' : 'closed'
    expect(measured).toBe(PENDING_PRODUCTION_CONTAINER_BOUNDARY.status)
  })

  it.todo(
    'closes the production container boundary: StudySessionContainer must reach a ' +
    'verified-identity runtime instead of runtimeFacade/RC1 — owned by the parallel ' +
    'safe-container lane, not by STUDY-A1-PROD-DEAD-PRODUCER-RETIREMENT-C',
  )
})
