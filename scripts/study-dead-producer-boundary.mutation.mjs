import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const productionContainer = resolve(root, 'src/components/study/ProductionStudySessionContainer.tsx')
const deadProducerTest = resolve(root, 'src/study/production/deadProducerBoundary.test.ts')
const importClosure = resolve(root, 'src/study/testing/importClosure.ts')
const browserEntry = resolve(root, 'src/main.tsx')
const initialAuthorization = resolve(root, 'supabase/migrations/20260801011000_academy_study_engine_authorization.sql')
const finalReconciliation = resolve(root, 'supabase/migrations/20260801012000_academy_study_engine_production_reconciliation.sql')
const hopFiles = [1, 2, 3].map((hop) => resolve(root, `src/components/study/__deadProducerHop${hop}.ts`))

const boundaryCommand = [
  'node_modules/vitest/vitest.mjs',
  'run',
  'src/study/production/deadProducerBoundary.test.ts',
  '--reporter=dot',
]
const typecheckCommand = ['node_modules/typescript/bin/tsc', '--noEmit']

function replaceExact(text, search, replacement, expected = 1) {
  const count = text.split(search).length - 1
  if (count !== expected) throw new Error(`expected ${expected} match(es), found ${count}: ${search.slice(0, 100)}`)
  return text.split(search).join(replacement)
}

function replacePattern(text, pattern, replacement, expected = 1) {
  let count = 0
  const result = text.replace(pattern, (...args) => {
    count += 1
    return typeof replacement === 'function' ? replacement(...args) : replacement
  })
  if (count !== expected) throw new Error(`expected ${expected} pattern match(es), found ${count}: ${pattern}`)
  return result
}

function run(args) {
  return spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 120_000 })
}

const dynamicEdge = String.raw`|(?:^|[\s;{}()=,[])import\s*\(\s*['"]([^'"]+)['"]\s*\)`
const requireEdge = String.raw`|(?:^|[\s;{}()=,[])require\s*\(\s*['"]([^'"]+)['"]\s*\)`

const mutants = [
  {
    id: 'M1',
    label: 'production container imports runtimeFacade directly',
    files: [productionContainer],
    command: boundaryCommand,
    mutate: (sources) => new Map([[productionContainer, replaceExact(
      sources.get(productionContainer),
      "import { useMemo } from 'react'",
      "import { useMemo } from 'react'\nimport '../../study/runtimeFacade'",
    )]]),
  },
  {
    id: 'M2',
    label: 'production container reaches RC1 three hops down',
    files: [productionContainer],
    creates: hopFiles,
    command: boundaryCommand,
    mutate: (sources) => new Map([
      [productionContainer, replaceExact(
        sources.get(productionContainer),
        "import { useMemo } from 'react'",
        "import { useMemo } from 'react'\nimport './__deadProducerHop1'",
      )],
      [hopFiles[0], "import './__deadProducerHop2'\n"],
      [hopFiles[1], "import './__deadProducerHop3'\n"],
      [hopFiles[2], "import '../../study/runtimeFacade'\n"],
    ]),
  },
  {
    id: 'M3',
    label: 'walker ignores dynamic import',
    files: [importClosure],
    command: boundaryCommand,
    mutate: (sources) => new Map([[importClosure, replaceExact(
      sources.get(importClosure), dynamicEdge, '',
    )]]),
  },
  {
    id: 'M4',
    label: 'walker ignores require',
    files: [importClosure],
    command: boundaryCommand,
    mutate: (sources) => new Map([[importClosure, replaceExact(
      sources.get(importClosure), requireEdge, '',
    )]]),
  },
  {
    id: 'M5',
    label: 'old OPEN production-container marker restored',
    files: [deadProducerTest],
    command: boundaryCommand,
    mutate: (sources) => new Map([[deadProducerTest, replaceExact(
      sources.get(deadProducerTest), "  status: 'closed',", "  status: 'open',",
    )]]),
  },
  {
    id: 'M6',
    label: 'production container switched back to preview wrapper',
    files: [deadProducerTest],
    command: boundaryCommand,
    mutate: (sources) => new Map([[deadProducerTest, replaceExact(
      sources.get(deadProducerTest), '  surface: PRODUCTION_CONTAINER,', '  surface: PREVIEW_CONTAINER,',
    )]]),
  },
  {
    id: 'M7',
    label: 'Session13 assembly becomes browser reachable',
    files: [browserEntry],
    command: boundaryCommand,
    mutate: (sources) => new Map([[browserEntry, replaceExact(
      sources.get(browserEntry),
      "import { StrictMode } from 'react'",
      "import { StrictMode } from 'react'\nimport './study/composition/session13ProductionAssembly'",
    )]]),
  },
  {
    id: 'M8',
    label: 'stale RPC re-granted service_role',
    files: [finalReconciliation],
    command: boundaryCommand,
    mutate: (sources) => new Map([[finalReconciliation,
      `${sources.get(finalReconciliation)}\ngrant execute on function public.academy_study_enqueue_outbox(jsonb) to service_role;\n`,
    ]]),
  },
  {
    id: 'M9',
    label: 'stale RPC re-granted authenticated',
    files: [finalReconciliation],
    command: boundaryCommand,
    mutate: (sources) => new Map([[finalReconciliation,
      `${sources.get(finalReconciliation)}\ngrant execute on function public.academy_study_transition_outbox(jsonb) to authenticated;\n`,
    ]]),
  },
  {
    id: 'M10',
    label: 'contract type tripwire removed',
    files: [deadProducerTest],
    command: typecheckCommand,
    mutate: (sources) => new Map([[deadProducerTest, replaceExact(
      sources.get(deadProducerTest),
      '    // @ts-expect-error The durable Session 13 adapters implement',
      '    // The durable Session 13 adapters implement',
    )]]),
  },
  {
    id: 'M11',
    label: 'original PUBLIC revoke removed',
    files: [initialAuthorization],
    command: boundaryCommand,
    mutate: (sources) => new Map([[initialAuthorization, replacePattern(
      sources.get(initialAuthorization),
      /revoke all on function public\.academy_study_enqueue_outbox\(jsonb\)\r?\n  from public, anon, authenticated, service_role;/,
      'revoke all on function public.academy_study_enqueue_outbox(jsonb)\n  from anon, authenticated, service_role;',
    )]]),
  },
]

const controlledFiles = [...new Set(mutants.flatMap((mutant) => mutant.files))]
const originals = new Map(controlledFiles.map((path) => [path, readFileSync(path, 'utf8')]))
const results = []

const before = run(boundaryCommand)
if (before.status !== 0 || before.error) {
  console.error(before.stdout)
  console.error(before.stderr)
  throw new Error('baseline control failed before mutation campaign')
}

for (const mutant of mutants) {
  let status = 'HARNESS_ERROR'
  let exitStatus = null
  let error
  try {
    const mutated = mutant.mutate(originals)
    for (const [path, source] of mutated) writeFileSync(path, source, 'utf8')
    const result = run(mutant.command)
    exitStatus = result.status
    if (result.error || result.status === null) error = String(result.error ?? 'test process returned no status')
    else status = result.status === 0 ? 'SURVIVED' : 'KILLED'
  } catch (cause) {
    error = String(cause)
  } finally {
    for (const path of mutant.files) writeFileSync(path, originals.get(path), 'utf8')
    for (const path of mutant.creates ?? []) {
      if (existsSync(path)) rmSync(path, { force: true })
    }
  }
  const restored = mutant.files.every((path) => readFileSync(path, 'utf8') === originals.get(path))
    && (mutant.creates ?? []).every((path) => !existsSync(path))
  if (!restored) status = 'HARNESS_ERROR'
  results.push({ id: mutant.id, label: mutant.label, status, exitStatus, restored, ...(error ? { error } : {}) })
}

const after = run(boundaryCommand)
const controlSurvived = after.status === 0 && !after.error
for (const result of results) console.log(JSON.stringify(result))
const counts = Object.fromEntries(['KILLED', 'SURVIVED', 'HARNESS_ERROR'].map((status) => [
  status,
  results.filter((result) => result.status === status).length,
]))
console.log(JSON.stringify({ summary: counts, total: results.length, controlSurvived }))
if (!controlSurvived || counts.SURVIVED > 0 || counts.HARNESS_ERROR > 0 || counts.KILLED !== mutants.length) process.exitCode = 1
