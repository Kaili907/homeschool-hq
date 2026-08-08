import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Repo-structure guards for the D1 manual/scheduled worker split.
 *
 * Everything asserted here is DERIVED from the repository as it actually is:
 * the scheduled entrypoint is found by which file imports the scheduled
 * authority, and the scheduled config key is parsed out of `netlify.toml`.
 * Nothing compares two hardcoded copies of the same string, because that is
 * exactly the failure these tests exist to catch -- if the config key and the
 * entrypoint filename ever diverge, Netlify binds the schedule to a function
 * that is not the private scheduled worker, and the split fails open.
 */

const here = dirname(fileURLToPath(import.meta.url))
const REPO = resolvePath(here, '../../../..')
const FUNCTIONS_DIR = resolvePath(REPO, 'netlify/functions')
const NETLIFY_TOML = resolvePath(REPO, 'netlify.toml')

const SCHEDULED_AUTHORITY = 'createNetlifyScheduledWorkerAuthorization'
const MANUAL_AUTHORITY = 'createNetlifyWorkerInvocationAuthorization'
const MANUAL_ROUTE = '/api/study/adult-review/worker'

const repoPath = (file) => relative(REPO, file).replace(/\\/g, '/')
const escapeForPattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Source-level import reader. It must never execute a module to learn what
// that module imports: the whole point is to observe the graph a deployment
// would build, from bytes, before anything is constructed.
const FROM_STATEMENT = /(?:import|export)\s+([^'"]*?)\s*from\s*'([^']+)'/g
const SIDE_EFFECT_IMPORT = /import\s+'([^']+)'/g

function importsOf(source) {
  const statements = []
  for (const [, clause, specifier] of source.matchAll(FROM_STATEMENT)) {
    const named = clause.match(/\{([\s\S]*?)\}/)
    const bindings = named
      ? named[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)
      : []
    statements.push({ specifier, bindings })
  }
  for (const [, specifier] of source.matchAll(SIDE_EFFECT_IMPORT)) {
    statements.push({ specifier, bindings: [] })
  }
  return statements
}

/**
 * Transitive import closure over relative specifiers.
 *
 * A specifier that cannot be resolved is COLLECTED, never thrown on: a walker
 * that dies mid-walk stops early and reports a clean closure it never actually
 * finished inspecting, which reads as a pass. The unresolved list is asserted
 * empty by the callers, so an unwalkable edge is a visible failure instead.
 */
function importClosure(entry) {
  const modules = new Map()
  const unresolved = []
  const external = new Set()
  const queue = [entry]

  while (queue.length > 0) {
    const file = queue.pop()
    if (modules.has(file)) continue
    if (!existsSync(file)) {
      unresolved.push({ from: null, specifier: file })
      continue
    }
    const source = readFileSync(file, 'utf8')
    const imports = importsOf(source)
    modules.set(file, { source, imports })
    for (const statement of imports) {
      if (!statement.specifier.startsWith('.')) {
        external.add(statement.specifier)
        continue
      }
      const target = resolvePath(dirname(file), statement.specifier)
      if (!existsSync(target)) {
        unresolved.push({ from: repoPath(file), specifier: statement.specifier })
        continue
      }
      queue.push(target)
    }
  }
  return { modules, unresolved, external }
}

function importersOf(closure, binding) {
  return [...closure.modules]
    .filter(([, module]) => module.imports.some((statement) => statement.bindings.includes(binding)))
    .map(([file]) => repoPath(file))
    .sort()
}

// Top-level Netlify function entrypoints. `_shared` is a directory, so the
// file filter excludes it without naming it.
function entrypointFiles() {
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js'))
    .map((entry) => entry.name)
}

// The scheduled entrypoint is whichever entrypoint imports the scheduled
// authority. Derived, so renaming the file moves this answer with it.
function scheduledEntrypointStems() {
  return entrypointFiles()
    .filter((name) => importsOf(readFileSync(resolvePath(FUNCTIONS_DIR, name), 'utf8'))
      .some((statement) => statement.bindings.includes(SCHEDULED_AUTHORITY)))
    .map((name) => name.replace(/\.js$/, ''))
}

// The manual entrypoint is whichever function the manual HTTP route redirects
// to. Also derived, from the same file the schedule key is read from.
function manualEntrypointStem() {
  const toml = readFileSync(NETLIFY_TOML, 'utf8')
  const match = toml.match(
    new RegExp(`from = "${escapeForPattern(MANUAL_ROUTE)}"\\s*\\n\\s*to = "/\\.netlify/functions/([^"]+)"`),
  )
  return match?.[1]
}

// Every `[functions."<key>"]` block in netlify.toml that declares a schedule.
function scheduledConfigEntries() {
  const toml = readFileSync(NETLIFY_TOML, 'utf8')
  const entries = []
  for (const match of toml.matchAll(/^\[functions\."([^"]+)"\]([\s\S]*?)(?=^\[|$(?![\s\S]))/gm)) {
    const schedule = match[2].match(/^\s*schedule\s*=\s*"([^"]*)"/m)
    if (schedule) entries.push({ key: match[1], schedule: schedule[1] })
  }
  return entries
}

describe('D1 schedule binding: the config key IS the entrypoint filename', () => {
  it('has exactly one scheduled entrypoint and exactly one scheduled config key', () => {
    expect(scheduledEntrypointStems()).toHaveLength(1)
    expect(scheduledConfigEntries()).toHaveLength(1)
  })

  it('binds the schedule to the actual scheduled entrypoint filename stem', () => {
    // Both sides are read from the repository. A one-character config typo, or
    // a rename of the entrypoint file alone, breaks this equality -- which is
    // the fail-open case: the schedule would otherwise silently bind to
    // nothing, or to some other function.
    expect(scheduledConfigEntries()[0].key).toBe(scheduledEntrypointStems()[0])
  })

  it('runs the scheduled worker on the dispatched five-minute schedule', () => {
    expect(scheduledConfigEntries()[0].schedule).toBe('*/5 * * * *')
  })

  it('never schedules the public manual entrypoint', () => {
    const manual = manualEntrypointStem()
    expect(manual).toBeTruthy()
    expect(scheduledConfigEntries().map((entry) => entry.key)).not.toContain(manual)
  })

  it('publishes no HTTP route to the scheduled worker, and leaves the manual route intact', () => {
    const toml = readFileSync(NETLIFY_TOML, 'utf8')
    const stem = scheduledEntrypointStems()[0]
    expect(toml).not.toMatch(new RegExp(`to = "[^"]*${escapeForPattern(stem)}"`))
    expect(toml).toContain(`to = "/.netlify/functions/${manualEntrypointStem()}"`)
  })
})

describe('D1 schedule split: entrypoint import separation', () => {
  const manualEntrypoint = resolvePath(FUNCTIONS_DIR, `${manualEntrypointStem()}.js`)
  const scheduledEntrypoint = resolvePath(FUNCTIONS_DIR, `${scheduledEntrypointStems()[0]}.js`)
  const COMPOSITION = 'netlify/functions/_shared/study-adult-review-operations/composition.js'

  it('never names the scheduled authority in the manual entrypoint', () => {
    // The public entrypoint must not be able to ASK for the authority whose
    // proof is platform path exclusivity -- that authority authorizes a run
    // with no presented secret, which is safe only on a path no caller can
    // reach. It names no authority at all, so it takes the composition's
    // fail-closed default, which is the manual one.
    const source = readFileSync(manualEntrypoint, 'utf8')
    const bindings = importsOf(source).flatMap((statement) => statement.bindings)
    expect(bindings).not.toContain(SCHEDULED_AUTHORITY)
    expect(source).not.toMatch(new RegExp(escapeForPattern(SCHEDULED_AUTHORITY)))
    expect(source).not.toMatch(/invocationAuthority/)
  })

  it('never reads a request from the scheduled entrypoint', () => {
    const source = readFileSync(scheduledEntrypoint, 'utf8')
    const bindings = importsOf(source).flatMap((statement) => statement.bindings)
    // No header reader, no body reader, no query reader is even in scope.
    for (const forbidden of ['getHeader', 'readJsonBody', 'hasQuery', MANUAL_AUTHORITY]) {
      expect(bindings).not.toContain(forbidden)
    }
    expect(source).not.toMatch(/headers/)
    expect(source).not.toMatch(/httpMethod/)
    expect(source).not.toMatch(/INVOCATION/)
  })

  it('names its authority from a module constant, never from an invocation', () => {
    // The scheduled entrypoint selects its authority, so the selection must be
    // a fixed import reference -- not a string, not a lookup, not anything
    // that could ever be assembled from input. It reads no request at all
    // (asserted above), so there is nothing to assemble one from either.
    const source = readFileSync(scheduledEntrypoint, 'utf8')
    const bindings = importsOf(source).flatMap((statement) => statement.bindings)
    expect(bindings).toContain(SCHEDULED_AUTHORITY)
    expect(source).toMatch(
      new RegExp(`invocationAuthority:\\s*${escapeForPattern(SCHEDULED_AUTHORITY)}`),
    )
  })

  it('routes both authorities through exactly one selector module', () => {
    // H2: the composition is the ONE module that knows both authorities,
    // because it is the selector. Every other module reaches at most one. If a
    // second module ever starts importing either factory, a path could
    // construct an authority behind the selector's back, and that widening
    // fails here rather than passing unnoticed.
    for (const entry of [manualEntrypoint, scheduledEntrypoint]) {
      const closure = importClosure(entry)
      expect(closure.unresolved).toEqual([])
      expect(closure.modules.size).toBeGreaterThan(5)
      expect(importersOf(closure, MANUAL_AUTHORITY)).toEqual([COMPOSITION])
    }
    // The scheduled entrypoint is the one exception, and it is the intended
    // one: it names the authority it is selecting.
    expect(importersOf(importClosure(scheduledEntrypoint), SCHEDULED_AUTHORITY))
      .toEqual([COMPOSITION, repoPath(scheduledEntrypoint)].sort())
    expect(importersOf(importClosure(manualEntrypoint), SCHEDULED_AUTHORITY))
      .toEqual([COMPOSITION])
  })

  it('reads the optional manual operator secret in exactly one module', () => {
    // H2, structurally: the secret that gates the OPTIONAL manual path must be
    // read in one place only -- the manual authority factory. Anything else
    // reading it would re-couple the automatic worker to an operator
    // convenience, which is the defect this session closed.
    const SECRET = 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET'
    const readers = []
    for (const file of [...importClosure(scheduledEntrypoint).modules.keys()]) {
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim()
        // Comments may still explain which path needs the secret and why; only
        // executable lines are forbidden from naming it.
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
        if (trimmed.includes(SECRET)) readers.push(repoPath(file))
      }
    }
    expect([...new Set(readers)]).toEqual(['netlify/functions/_shared/study-worker/credential.js'])
  })
})

describe('D1 schedule split: x-nf-event is not authority anywhere in source', () => {
  function sourceFiles(directory) {
    const files = []
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = resolvePath(directory, entry.name)
      if (entry.isDirectory()) files.push(...sourceFiles(full))
      else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) files.push(full)
    }
    return files
  }

  it('has no non-test source line that reads the Netlify schedule marker', () => {
    const offenders = []
    for (const file of sourceFiles(FUNCTIONS_DIR)) {
      for (const [index, line] of readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
        const trimmed = line.trim()
        // Comments may still explain WHY the marker is inert; only executable
        // lines are forbidden from mentioning it.
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
        if (trimmed.includes('x-nf-event')) offenders.push(`${repoPath(file)}:${index + 1}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
