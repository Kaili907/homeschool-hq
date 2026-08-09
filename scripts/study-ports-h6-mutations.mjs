import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const censusPath = join(root, 'src', 'study', 'studyConsumerPortInjectionCensus.test.ts')
const portsPath = join(root, 'src', 'study', 'ports.ts')
const tscPath = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
const vitestPath = join(root, 'node_modules', 'vitest', 'vitest.mjs')
const originalBytes = new Map([
  [censusPath, readFileSync(censusPath)],
  [portsPath, readFileSync(portsPath)],
])
const originals = new Map([...originalBytes].map(([file, contents]) => [file, contents.toString('utf8')]))
const digest = (contents) => createHash('sha256').update(contents).digest('hex')
const originalDigests = new Map([...originalBytes].map(([file, contents]) => [file, digest(contents)]))
const rescue = mkdtempSync(join(tmpdir(), 'study-ports-h6-rescue-'))
for (const [file, contents] of originalBytes) writeFileSync(join(rescue, basename(file)), contents)

function detectEol(contents, file) {
  const lineFeeds = contents.match(/\n/g)?.length ?? 0
  const carriageReturns = contents.match(/\r\n/g)?.length ?? 0
  if (lineFeeds === 0 || carriageReturns === 0) return '\n'
  if (lineFeeds === carriageReturns) return '\r\n'
  throw new Error(`HARNESS_ERROR: mixed line endings in ${file}`)
}

const fragmentForEol = (fragment, eol) => fragment.replace(/\r?\n/g, eol)

function changed(mutant, original = originals.get(mutant.file), eol = detectEol(original, mutant.file)) {
  if (original === undefined) throw new Error(`HARNESS_ERROR: no rescue source for ${mutant.file}`)
  const needle = fragmentForEol(mutant.needle, eol)
  const replacement = fragmentForEol(mutant.replacement, eol)
  const matches = original.split(needle).length - 1
  if (matches !== 1) {
    throw new Error(
      `HARNESS_ERROR: ${mutant.id} ${mutant.name}: expected one match, found ${matches}: ${JSON.stringify(needle.slice(0, 80))}`,
    )
  }
  return original.replace(needle, replacement)
}

const propertyDrop = (operator) => ({
  file: censusPath,
  needle: `    if (ts.isPropertyAccessExpression(target)) {\n      const declarations = symbolAt(target)?.declarations ?? []`,
  replacement:
    `    if (ts.isPropertyAccessExpression(target)) {\n` +
    `      if (ts.isBinaryExpression(target.parent) && target.parent.operatorToken.kind === ts.SyntaxKind.${operator}) return grew\n` +
    `      const declarations = symbolAt(target)?.declarations ?? []`,
})

const mutants = [
  { id: 'M1', name: 'symbol-less dotted = dropped', ...propertyDrop('EqualsToken') },
  { id: 'M2', name: 'symbol-less dotted ??= dropped', ...propertyDrop('QuestionQuestionEqualsToken') },
  { id: 'M3', name: 'symbol-less dotted ||= dropped', ...propertyDrop('BarBarEqualsToken') },
  { id: 'M4', name: 'symbol-less dotted &&= dropped', ...propertyDrop('AmpersandAmpersandEqualsToken') },
  {
    id: 'M5',
    name: 'computed-key widening uses bogus attribution',
    file: censusPath,
    needle: `          if (key === null) result.whole = true`,
    replacement: `          if (key === null) result.members.add('__bogus_computed_key__')`,
  },
  {
    id: 'M6',
    name: 'import-alias follow removed',
    file: censusPath,
    needle: `    return found && found.flags & ts.SymbolFlags.Alias ? targetChecker.getAliasedSymbol(found) : found`,
    replacement: `    return found`,
  },
  {
    id: 'M7',
    name: 'whole-program sweep restricted to consumer modules',
    file: censusPath,
    needle: `  return capabilityScope(target, files)\n}\n\nconst productionScope = wholeProgramCapabilityScope`,
    replacement:
      `  return capabilityScope(target, consumerModuleFiles(target, files))\n}\n\nconst productionScope = wholeProgramCapabilityScope`,
  },
  {
    id: 'M8',
    name: 'props adoption removed',
    file: censusPath,
    needle: `      if (contract) found.push({ contract, property, propName: ts.isParameter(node) ? property.name : null })`,
    replacement: `      if (contract && node.pos < 0) found.push({ contract, property, propName: ts.isParameter(node) ? property.name : null })`,
  },
  {
    id: 'M9',
    name: 'indexed assignment removed',
    file: censusPath,
    needle: `    if (ts.isElementAccessExpression(target)) return assign(target.expression, everything())`,
    replacement: `    if (ts.isElementAccessExpression(target)) return grew`,
  },
  {
    id: 'M10',
    name: 'object destructuring assignment removed',
    file: censusPath,
    needle: `    if (ts.isObjectLiteralExpression(target)) {`,
    replacement: `    if (ts.isObjectLiteralExpression(target) && target.properties.length < 0) {`,
  },
  {
    id: 'M11',
    name: 'array destructuring assignment removed',
    file: censusPath,
    needle: `    if (ts.isArrayLiteralExpression(target)) {`,
    replacement: `    if (ts.isArrayLiteralExpression(target) && target.elements.length < 0) {`,
  },
  {
    id: 'M12',
    name: 'default initializer removed',
    file: censusPath,
    needle: `          } else if ((ts.isBindingElement(node) || ts.isParameter(node)) && node.initializer) {`,
    replacement: `          } else if ((ts.isBindingElement(node) || ts.isParameter(node)) && node.initializer && node.pos < 0) {`,
  },
  {
    id: 'M13',
    name: 'suppliedExpressions shorthand removed',
    file: censusPath,
    needle: `  if (ts.isShorthandPropertyAssignment(node)) return [node.name]`,
    replacement: `  if (ts.isShorthandPropertyAssignment(node)) return []`,
  },
  {
    id: 'M14',
    name: 'narrowProperties removed',
    file: censusPath,
    needle: `      if (property && narrowProperties.has(property)) return everything()`,
    replacement: `      if (property && narrowProperties.has(property) && expression.pos < 0) return everything()`,
  },
  {
    id: 'M15',
    name: 'element-access carriage removed',
    file: censusPath,
    needle: `    if (ts.isElementAccessExpression(expression)) {`,
    replacement: `    if (ts.isElementAccessExpression(expression) && expression.pos < 0) {`,
  },
  {
    id: 'M16',
    name: 'conditional false arm removed',
    file: censusPath,
    needle: `      absorb(result, carriageOf(expression.whenFalse))`,
    replacement: `      void expression.whenFalse`,
  },
  {
    id: 'M17',
    name: 'fixpoint capped below required depth',
    file: censusPath,
    needle: `    for (let growing = true; growing; ) {`,
    replacement: `    for (let growing = true, pass = 0; growing && pass < 2; pass += 1) {`,
  },
  {
    id: 'M18',
    name: 'fifth-site discovery disabled',
    file: censusPath,
    needle: `  return { sites, expressions }`,
    replacement: `  return { sites: sites.slice(0, 4), expressions }`,
  },
  {
    id: 'M19',
    name: 'required dashboard method removed',
    file: portsPath,
    needle: `  readonly calendar: Pick<StudyCalendarPort, 'list' | 'create'>`,
    replacement: `  readonly calendar: Pick<StudyCalendarPort, 'list'>`,
    typeLevel: true,
  },
  {
    id: 'M20',
    name: 'forbidden safety capability admitted',
    file: portsPath,
    needle: `export interface StudyDashboardPorts {`,
    replacement: `export interface StudyDashboardPorts {\n  readonly safety: StudySafetyPort`,
    typeLevel: true,
  },
]

const requestedId = process.argv[2]
const selectedMutants = requestedId ? mutants.filter((mutant) => mutant.id === requestedId) : mutants
if (requestedId && selectedMutants.length !== 1) throw new Error(`HARNESS_ERROR: unknown mutant ${requestedId}`)

function proveEolResolution() {
  for (const [label, eol] of [
    ['LF', '\n'],
    ['CRLF', '\r\n'],
  ]) {
    for (const mutant of mutants) {
      const canonical = originals.get(mutant.file).replace(/\r\n/g, '\n')
      const candidate = fragmentForEol(canonical, eol)
      changed(mutant, candidate, eol)
    }
    console.log(`EOL_PROOF ${label} ${mutants.length}_OF_${mutants.length}_RESOLVED`)
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true })
  if (result.error || result.status === null) {
    throw new Error(`HARNESS_ERROR: ${command} ${args.join(' ')}: ${result.error?.message ?? 'status:null'}`)
  }
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

function restoreAndVerify() {
  for (const [file, contents] of originalBytes) writeFileSync(file, contents)
  for (const [file, expected] of originalDigests) {
    const actual = digest(readFileSync(file))
    if (actual !== expected) {
      throw new Error(`HARNESS_ERROR: byte restoration failed for ${file}: expected ${expected}, found ${actual}`)
    }
  }
}

let rescueRemoved = false
function cleanupRescue() {
  if (rescueRemoved) return
  rmSync(rescue, { recursive: true, force: true })
  rescueRemoved = true
}

function handleSignal(signal) {
  try {
    restoreAndVerify()
    cleanupRescue()
  } catch (error) {
    console.error(error)
  }
  process.exit(signal === 'SIGINT' ? 130 : 143)
}

const handleSigint = () => handleSignal('SIGINT')
const handleSigterm = () => handleSignal('SIGTERM')
process.once('SIGINT', handleSigint)
process.once('SIGTERM', handleSigterm)

const results = []
try {
  proveEolResolution()
  for (const mutant of selectedMutants) {
    restoreAndVerify()
    try {
      writeFileSync(mutant.file, changed(mutant))
      const typecheck = run(process.execPath, [tscPath, '--noEmit'])
      let guard = { status: 0, output: 'compile-time contract mutant; focused runtime guard not applicable' }
      if (!mutant.typeLevel) {
        guard = run(process.execPath, [
          vitestPath,
          'run',
          '--project',
          'root-app',
          'src/study/studyConsumerPortInjectionCensus.test.ts',
        ])
      }
      const typecheckOk = mutant.typeLevel ? typecheck.status !== 0 : typecheck.status === 0
      const killed = mutant.typeLevel ? typecheck.status !== 0 : guard.status !== 0
      if (!typecheckOk || !killed) {
        const tail = `${typecheck.output}\n${guard.output}`.split(/\r?\n/).slice(-30).join('\n')
        throw new Error(
          `HARNESS_ERROR: ${mutant.id} ${mutant.name}: typecheck=${typecheck.status}, guard=${guard.status}\n${tail}`,
        )
      }
      results.push({ id: mutant.id, name: mutant.name, typecheck: typecheck.status, guard: guard.status, killed: true })
      console.log(`${mutant.id} KILLED typecheck=${typecheck.status} guard=${guard.status} ${mutant.name}`)
    } finally {
      restoreAndVerify()
    }
  }

  restoreAndVerify()
  try {
    const eol = detectEol(originals.get(censusPath), censusPath)
    const controlText = `${originals.get(censusPath)}${eol}// H6 inert mutation control${eol}`
    writeFileSync(censusPath, controlText)
    const controlTypecheck = run(process.execPath, [tscPath, '--noEmit'])
    const controlGuard = run(process.execPath, [
      vitestPath,
      'run',
      '--project',
      'root-app',
      'src/study/studyConsumerPortInjectionCensus.test.ts',
    ])
    if (controlTypecheck.status !== 0 || controlGuard.status !== 0) {
      throw new Error(`HARNESS_ERROR: inert control did not survive: typecheck=${controlTypecheck.status}, guard=${controlGuard.status}`)
    }
    console.log(`CONTROL SURVIVED typecheck=${controlTypecheck.status} guard=${controlGuard.status}`)
  } finally {
    restoreAndVerify()
  }
} finally {
  restoreAndVerify()
  cleanupRescue()
  process.removeListener('SIGINT', handleSigint)
  process.removeListener('SIGTERM', handleSigterm)
}

console.log(`BYTE_RESTORATION EXACT ${[...originalDigests.values()].join(' ')}`)
console.log(JSON.stringify({ rescue, semanticKilled: results.length, semanticTotal: selectedMutants.length, controlsSurvived: 1, controlsTotal: 1 }))
