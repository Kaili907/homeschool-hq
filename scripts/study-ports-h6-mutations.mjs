import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const censusPath = join(root, 'src', 'study', 'studyConsumerPortInjectionCensus.test.ts')
const portsPath = join(root, 'src', 'study', 'ports.ts')
const tscPath = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
const vitestPath = join(root, 'node_modules', 'vitest', 'vitest.mjs')
const originals = new Map([
  [censusPath, readFileSync(censusPath, 'utf8')],
  [portsPath, readFileSync(portsPath, 'utf8')],
])
const rescue = mkdtempSync(join(tmpdir(), 'study-ports-h6-rescue-'))
for (const [file, contents] of originals) writeFileSync(join(rescue, basename(file)), contents)

function changed(file, needle, replacement) {
  const original = originals.get(file)
  if (original === undefined) throw new Error(`HARNESS_ERROR: no rescue source for ${file}`)
  const matches = original.split(needle).length - 1
  if (matches !== 1) throw new Error(`HARNESS_ERROR: expected one match, found ${matches}: ${needle.slice(0, 80)}`)
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

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true })
  if (result.error || result.status === null) {
    throw new Error(`HARNESS_ERROR: ${command} ${args.join(' ')}: ${result.error?.message ?? 'status:null'}`)
  }
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

function restore() {
  for (const [file, contents] of originals) writeFileSync(file, contents)
}

const results = []
try {
  for (const mutant of selectedMutants) {
    restore()
    writeFileSync(mutant.file, changed(mutant.file, mutant.needle, mutant.replacement))
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
  }

  restore()
  const controlText = `${originals.get(censusPath)}\n// H6 inert mutation control\n`
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
  restore()
}

for (const [file, contents] of originals) {
  if (readFileSync(file, 'utf8') !== contents) throw new Error(`HARNESS_ERROR: byte restoration failed for ${file}`)
}

console.log(JSON.stringify({ rescue, semanticKilled: results.length, semanticTotal: selectedMutants.length, controlsSurvived: 1, controlsTotal: 1 }))
rmSync(rescue, { recursive: true, force: true })
