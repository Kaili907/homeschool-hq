import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const censusPath = join(root, 'src', 'study', 'studyConsumerPortInjectionCensus.test.ts')
const portsPath = join(root, 'src', 'study', 'ports.ts')
const tutorLaunchOrderingPath = join(root, 'src', 'study', 'production', 'tutorLaunchOrdering.ts')
const studySessionContainerPath = join(root, 'src', 'components', 'study', 'StudySessionContainer.tsx')
const tscPath = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
const vitestPath = join(root, 'node_modules', 'vitest', 'vitest.mjs')
const originalBytes = new Map([
  [censusPath, readFileSync(censusPath)],
  [portsPath, readFileSync(portsPath)],
  [tutorLaunchOrderingPath, readFileSync(tutorLaunchOrderingPath)],
  [studySessionContainerPath, readFileSync(studySessionContainerPath)],
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

function changed(mutant, original = originals.get(mutant.file), requestedEol) {
  if (original === undefined) throw new Error(`HARNESS_ERROR: no rescue source for ${mutant.file}`)
  const eol = requestedEol ?? detectEol(original, mutant.file)
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

const guardKilled = { expectTypecheck: 'pass', expectGuard: 'fail' }
const typecheckKilled = { expectTypecheck: 'fail', expectGuard: 'skip' }
const typecheckAndGuardKilled = { expectTypecheck: 'fail', expectGuard: 'fail' }
const typecheckOnlyKilled = { expectTypecheck: 'fail', expectGuard: 'pass' }

const h7Mutants = [
  { id: 'H7M1', name: 'symbol-less dotted = dropped', ...propertyDrop('EqualsToken'), ...guardKilled },
  { id: 'H7M2', name: 'symbol-less dotted ??= dropped', ...propertyDrop('QuestionQuestionEqualsToken'), ...guardKilled },
  { id: 'H7M3', name: 'symbol-less dotted ||= dropped', ...propertyDrop('BarBarEqualsToken'), ...guardKilled },
  { id: 'H7M4', name: 'symbol-less dotted &&= dropped', ...propertyDrop('AmpersandAmpersandEqualsToken'), ...guardKilled },
  {
    id: 'H7M5',
    name: 'computed-key widening uses bogus attribution',
    file: censusPath,
    needle: `          if (key === null) result.whole = true`,
    replacement: `          if (key === null) result.members.add('__bogus_computed_key__')`,
    ...guardKilled,
  },
  {
    id: 'H7M6',
    name: 'import-alias follow removed',
    file: censusPath,
    needle:
      `  const symbolAt = (node: ts.Node) => {\n` +
      `    const found = ts.isPropertyAccessExpression(node)\n` +
      `      ? targetChecker.getSymbolAtLocation(node.name)\n` +
      `      : targetChecker.getSymbolAtLocation(node)\n` +
      `    return found && found.flags & ts.SymbolFlags.Alias ? targetChecker.getAliasedSymbol(found) : found\n` +
      `  }`,
    replacement:
      `  const symbolAt = (node: ts.Node) => {\n` +
      `    const found = ts.isPropertyAccessExpression(node)\n` +
      `      ? targetChecker.getSymbolAtLocation(node.name)\n` +
      `      : targetChecker.getSymbolAtLocation(node)\n` +
      `    return found\n` +
      `  }`,
    ...guardKilled,
  },
  {
    id: 'H7M7',
    name: 'whole-program sweep restricted to consumer modules',
    file: censusPath,
    needle: `  return capabilityScope(target, files)\n}\n\nconst productionScope = wholeProgramCapabilityScope`,
    replacement:
      `  return capabilityScope(target, consumerModuleFiles(target, files))\n}\n\nconst productionScope = wholeProgramCapabilityScope`,
    ...guardKilled,
  },
  {
    id: 'H7M8',
    name: 'props adoption removed',
    file: censusPath,
    needle: `    found.push(...safe.map(({ property, propName }) => ({ contract, property, propName })))`,
    replacement:
      `    if (node.pos < 0) found.push(...safe.map(({ property, propName }) => ({ contract, property, propName })))`,
    ...guardKilled,
  },
  {
    id: 'H7M9',
    name: 'indexed assignment removed',
    file: censusPath,
    needle: `    if (ts.isElementAccessExpression(target)) return assign(target.expression, everything())`,
    replacement: `    if (ts.isElementAccessExpression(target)) return grew`,
    ...guardKilled,
  },
  {
    id: 'H7M10',
    name: 'object destructuring assignment removed',
    file: censusPath,
    needle: `    if (ts.isObjectLiteralExpression(target)) {`,
    replacement: `    if (ts.isObjectLiteralExpression(target) && target.properties.length < 0) {`,
    ...guardKilled,
  },
  {
    id: 'H7M11',
    name: 'array destructuring assignment removed',
    file: censusPath,
    needle: `    if (ts.isArrayLiteralExpression(target)) {`,
    replacement: `    if (ts.isArrayLiteralExpression(target) && target.elements.length < 0) {`,
    ...guardKilled,
  },
  {
    id: 'H7M12',
    name: 'default initializer removed',
    file: censusPath,
    needle: `          } else if ((ts.isBindingElement(node) || ts.isParameter(node)) && node.initializer) {`,
    replacement: `          } else if ((ts.isBindingElement(node) || ts.isParameter(node)) && node.initializer && node.pos < 0) {`,
    ...guardKilled,
  },
  {
    id: 'H7M13',
    name: 'suppliedExpressions shorthand removed',
    file: censusPath,
    needle: `  if (ts.isShorthandPropertyAssignment(node)) return [node.name]`,
    replacement: `  if (ts.isShorthandPropertyAssignment(node)) return []`,
    ...guardKilled,
  },
  {
    id: 'H7M14',
    name: 'narrowProperties removed',
    file: censusPath,
    needle: `      if (property && narrowProperties.has(property)) return everything()`,
    replacement: `      if (property && narrowProperties.has(property) && expression.pos < 0) return everything()`,
    ...guardKilled,
  },
  {
    id: 'H7M15',
    name: 'element-access carriage removed',
    file: censusPath,
    needle: `    if (ts.isElementAccessExpression(expression)) {`,
    replacement: `    if (ts.isElementAccessExpression(expression) && expression.pos < 0) {`,
    ...guardKilled,
  },
  {
    id: 'H7M16',
    name: 'conditional false arm removed',
    file: censusPath,
    needle: `      absorb(result, carriageOf(expression.whenFalse))`,
    replacement: `      void expression.whenFalse`,
    ...guardKilled,
  },
  {
    id: 'H7M17',
    name: 'fixpoint capped below required depth',
    file: censusPath,
    needle: `    for (let growing = true; growing; ) {`,
    replacement: `    for (let growing = true, pass = 0; growing && pass < 2; pass += 1) {`,
    ...guardKilled,
  },
  {
    id: 'H7M18',
    name: 'site discovery truncated',
    file: censusPath,
    needle: `  return { sites, expressions, unsafe }`,
    replacement: `  return { sites: sites.slice(0, 4), expressions, unsafe }`,
    ...guardKilled,
  },
  {
    id: 'H7M19',
    name: 'required dashboard method removed',
    file: portsPath,
    needle: `  readonly calendar: Pick<StudyCalendarPort, 'list' | 'create'>`,
    replacement: `  readonly calendar: Pick<StudyCalendarPort, 'list'>`,
    ...typecheckKilled,
  },
  {
    id: 'H7M20',
    name: 'forbidden safety capability admitted',
    file: portsPath,
    needle: `export interface StudyDashboardPorts {`,
    replacement: `export interface StudyDashboardPorts {\n  readonly safety: StudySafetyPort`,
    ...typecheckKilled,
  },
]

const cardMutants = [
  {
    id: 'M1',
    name: 'remove ProductionStudySessionPorts guarded root',
    file: censusPath,
    needle: `    NARROW_CONTRACTS.map((name) => [declarationOf(name) as ts.Declaration, name] as const),`,
    replacement:
      `    NARROW_CONTRACTS.filter((name) => name !== PRODUCTION_SESSION_CONTRACT)\n` +
      `      .map((name) => [declarationOf(name) as ts.Declaration, name] as const),`,
    ...guardKilled,
  },
  {
    id: 'M2',
    name: 'ignore Pick type arguments',
    file: censusPath,
    needle:
      `  const validatedPick = (source: NarrowResolution, keyType: ts.Type | undefined): NarrowResolution => {\n` +
      `    if (source.kind !== 'safe') return source\n` +
      `    const keys = keyType ? finiteLiteralKeys(keyType) : null\n` +
      `    const allowed = allowedRoles(source.contract)\n` +
      `    if (!keys || keys.some((key) => !allowed.has(key))) {\n` +
      `      return unsafe(source.contract, \`a Pick from \${source.contract} does not name only finite canonical role keys\`)\n` +
      `    }\n` +
      `    return source\n` +
      `  }`,
    replacement:
      `  const validatedPick = (source: NarrowResolution, _keyType: ts.Type | undefined): NarrowResolution =>\n` +
      `    source.kind === 'safe' ? NONE : source`,
    ...guardKilled,
  },
  {
    id: 'M3',
    name: 'imported Pick alias loses provenance',
    file: censusPath,
    needle:
      `    const symbol = symbolAtTypeName(node.typeName)\n` +
      `    const direct = declarationResolution(symbol?.declarations)\n` +
      `    if (direct.kind !== 'none') return direct\n` +
      `    const semanticType = targetChecker.getTypeFromTypeNode(node)\n\n` +
      `    const typeParameter = symbol?.declarations?.find(ts.isTypeParameterDeclaration)\n` +
      `    if (typeParameter?.constraint) {\n` +
      `      const constrained = traceTypeNode(typeParameter.constraint, new Set(seenAliases))\n` +
      `      return constrained.kind === 'safe'\n` +
      `        ? unsafe(constrained.contract, \`a generic type parameter is constrained by \${constrained.contract} and may widen it\`)\n` +
      `        : constrained\n` +
      `    }\n\n` +
      `    const alias = symbol?.declarations?.find(ts.isTypeAliasDeclaration)\n` +
      `    if (alias === pickDeclaration) {`,
    replacement:
      `    const rawSymbol = targetChecker.getSymbolAtLocation(node.typeName)\n` +
      `    const symbol = symbolAtTypeName(node.typeName)\n` +
      `    const direct = declarationResolution(symbol?.declarations)\n` +
      `    if (direct.kind !== 'none') return direct\n` +
      `    const semanticType = targetChecker.getTypeFromTypeNode(node)\n\n` +
      `    const typeParameter = symbol?.declarations?.find(ts.isTypeParameterDeclaration)\n` +
      `    if (typeParameter?.constraint) {\n` +
      `      const constrained = traceTypeNode(typeParameter.constraint, new Set(seenAliases))\n` +
      `      return constrained.kind === 'safe'\n` +
      `        ? unsafe(constrained.contract, \`a generic type parameter is constrained by \${constrained.contract} and may widen it\`)\n` +
      `        : constrained\n` +
      `    }\n\n` +
      `    const alias = symbol?.declarations?.find(ts.isTypeAliasDeclaration)\n` +
      `    if (!alias || seenAliases.has(alias)) return fullBundleSurface(semanticType) ? FULL : NONE\n` +
      `    if (\n` +
      `      rawSymbol &&\n` +
      `      rawSymbol.flags & ts.SymbolFlags.Alias &&\n` +
      `      ts.isTypeReferenceNode(alias.type) &&\n` +
      `      symbolAtTypeName(alias.type.typeName)?.declarations?.includes(pickDeclaration!)\n` +
      `    ) {\n` +
      `      const source = alias.type.typeArguments?.[0]\n` +
      `      const resolution = source ? traceTypeNode(source, new Set(seenAliases)) : NONE\n` +
      `      return resolution.kind === 'safe'\n` +
      `        ? unsafe(resolution.contract, 'an imported Pick alias lost its guarded provenance')\n` +
      `        : resolution\n` +
      `    }\n` +
      `    if (alias === pickDeclaration) {`,
    ...guardKilled,
  },
  {
    id: 'M4',
    name: 'direct local production-root alias loses provenance',
    file: censusPath,
    needle:
      `    if (!alias || seenAliases.has(alias)) return fullBundleSurface(semanticType) ? FULL : NONE\n` +
      `    seenAliases.add(alias)\n` +
      `    return traceTypeNode(alias.type, seenAliases)`,
    replacement:
      `    if (!alias || seenAliases.has(alias)) return fullBundleSurface(semanticType) ? FULL : NONE\n` +
      `    seenAliases.add(alias)\n` +
      `    if (ts.isTypeReferenceNode(alias.type)) {\n` +
      `      const directAlias = declarationResolution(symbolAtTypeName(alias.type.typeName)?.declarations)\n` +
      `      if (directAlias.kind === 'safe' && directAlias.contract === PRODUCTION_SESSION_CONTRACT) {\n` +
      `        return unsafe(directAlias.contract, \`a direct \${directAlias.contract} alias lost its guarded root\`)\n` +
      `      }\n` +
      `    }\n` +
      `    return traceTypeNode(alias.type, seenAliases)`,
    ...guardKilled,
  },
  {
    id: 'M5',
    name: 'indexed checkpoint projection loses provenance',
    file: censusPath,
    needle:
      `      const keys = literalKeys(node.indexType)\n` +
      `      const allowed = allowedRoles(root.contract)`,
    replacement:
      `      const keys = literalKeys(node.indexType)\n` +
      `      if (keys?.includes('checkpoint')) return NONE\n` +
      `      const allowed = allowedRoles(root.contract)`,
    ...guardKilled,
  },
  {
    id: 'M6',
    name: 'indexed calendar projection loses provenance',
    file: censusPath,
    needle:
      `      const keys = literalKeys(node.indexType)\n` +
      `      const allowed = allowedRoles(root.contract)`,
    replacement:
      `      const keys = literalKeys(node.indexType)\n` +
      `      if (keys?.includes('calendar')) return NONE\n` +
      `      const allowed = allowedRoles(root.contract)`,
    ...guardKilled,
  },
  {
    id: 'M7',
    name: 'parenthesized alias loses provenance',
    file: censusPath,
    needle: `    if (ts.isParenthesizedTypeNode(node)) return traceTypeNode(node.type, seenAliases)`,
    replacement:
      `    if (ts.isParenthesizedTypeNode(node)) {\n` +
      `      const wrapped = traceTypeNode(node.type, seenAliases)\n` +
      `      return wrapped.kind === 'safe'\n` +
      `        ? unsafe(wrapped.contract, \`a parenthesized \${wrapped.contract} wrapper lost its guarded provenance\`)\n` +
      `        : wrapped\n` +
      `    }`,
    ...guardKilled,
  },
  {
    id: 'M8',
    name: 'broad union with StudyPortBundle accepted',
    file: censusPath,
    needle:
      `    if (hasFullBundle) {\n` +
      `      return unsafe(contract, \`a \${contract} union also exposes the complete \${FULL_BUNDLE}\`)\n` +
      `    }`,
    replacement:
      `    if (hasFullBundle) {\n` +
      `      return { kind: 'safe', contract }\n` +
      `    }`,
    ...guardKilled,
  },
  {
    id: 'M9',
    name: 'DurableStudySessionPreparation reverted to StudyPortBundle',
    file: tutorLaunchOrderingPath,
    needle: `  readonly ports: Pick<ProductionStudySessionPorts, 'calendar' | 'eventLedger' | 'persistence'>`,
    replacement: `  readonly ports: import('../ports').StudyPortBundle`,
    ...typecheckAndGuardKilled,
  },
  {
    id: 'M10',
    name: 'add parentSettings to production session contract',
    file: portsPath,
    needle:
      `  readonly eventLedger: StudyEventLedgerPort\n` +
      `  readonly safety: StudySafetyPort\n` +
      `}`,
    replacement:
      `  readonly eventLedger: StudyEventLedgerPort\n` +
      `  readonly parentSettings?: StudyParentSettingsPort\n` +
      `  readonly safety: StudySafetyPort\n` +
      `}`,
    ...typecheckAndGuardKilled,
  },
  {
    id: 'M11',
    name: 'add outbox',
    file: portsPath,
    needle:
      `  readonly eventLedger: StudyEventLedgerPort\n` +
      `  readonly safety: StudySafetyPort\n` +
      `}`,
    replacement:
      `  readonly eventLedger: StudyEventLedgerPort\n` +
      `  readonly outbox?: StudyOutboxPort\n` +
      `  readonly safety: StudySafetyPort\n` +
      `}`,
    ...typecheckAndGuardKilled,
  },
  {
    id: 'M12',
    name: 'add adultPrivate',
    file: portsPath,
    needle:
      `  readonly eventLedger: StudyEventLedgerPort\n` +
      `  readonly safety: StudySafetyPort\n` +
      `}`,
    replacement:
      `  readonly eventLedger: StudyEventLedgerPort\n` +
      `  readonly adultPrivate?: StudyAdultPrivatePort\n` +
      `  readonly safety: StudySafetyPort\n` +
      `}`,
    ...typecheckAndGuardKilled,
  },
  {
    id: 'M13',
    name: 'remove required checkpoint method',
    file: portsPath,
    needle:
      `export interface ProductionStudyCheckpointPort {\n` +
      `  loadLatest(scope: StudyScope, operation?: StudyOperationContext): Promise<StudyCheckpoint | null>\n` +
      `  save(`,
    replacement:
      `export interface ProductionStudyCheckpointPort {\n` +
      `  save(`,
    ...typecheckOnlyKilled,
  },
  {
    id: 'M14',
    name: 'remove required calendar method',
    file: portsPath,
    needle: `  'list' | 'start' | 'pause' | 'resume' | 'completeCurrentSegment'`,
    replacement: `  'list' | 'start' | 'resume' | 'completeCurrentSegment'`,
    ...typecheckOnlyKilled,
  },
  {
    id: 'M15',
    name: 'missing production injection site from reviewed census',
    file: censusPath,
    needle: `  return { sites, expressions, unsafe }`,
    replacement:
      `  return {\n` +
      `    sites: sites.filter((site) => site.contract !== PRODUCTION_SESSION_CONTRACT),\n` +
      `    expressions,\n` +
      `    unsafe,\n` +
      `  }`,
    ...guardKilled,
  },
  {
    id: 'M16',
    name: 'direct full bundle handed to production preparation',
    file: studySessionContainerPath,
    needle:
      `      return await prepareDurableStudySession(settled, {\n` +
      `        token: surface.token,\n` +
      `        ports,\n` +
      `        scope,`,
    replacement:
      `      return await prepareDurableStudySession(settled, {\n` +
      `        token: surface.token,\n` +
      `        ports: ports as StudyPortBundle,\n` +
      `        scope,`,
    ...guardKilled,
  },
  {
    id: 'M17',
    name: 'existing H7 symbol-less dotted write regression',
    ...propertyDrop('EqualsToken'),
    ...guardKilled,
  },
  {
    id: 'M18',
    name: 'existing H7 cross-module alias regression',
    file: censusPath,
    needle:
      `  const symbolAt = (node: ts.Node) => {\n` +
      `    const found = ts.isPropertyAccessExpression(node)\n` +
      `      ? targetChecker.getSymbolAtLocation(node.name)\n` +
      `      : targetChecker.getSymbolAtLocation(node)\n` +
      `    return found && found.flags & ts.SymbolFlags.Alias ? targetChecker.getAliasedSymbol(found) : found\n` +
      `  }`,
    replacement:
      `  const symbolAt = (node: ts.Node) => {\n` +
      `    const found = ts.isPropertyAccessExpression(node)\n` +
      `      ? targetChecker.getSymbolAtLocation(node.name)\n` +
      `      : targetChecker.getSymbolAtLocation(node)\n` +
      `    return found\n` +
      `  }`,
    ...guardKilled,
  },
  {
    id: 'M19',
    name: 'add reviewQueue to production session contract',
    file: portsPath,
    needle:
      `  readonly eventLedger: StudyEventLedgerPort\n` +
      `  readonly safety: StudySafetyPort\n` +
      `}`,
    replacement:
      `  readonly eventLedger: StudyEventLedgerPort\n` +
      `  readonly reviewQueue?: StudyReviewQueuePort\n` +
      `  readonly safety: StudySafetyPort\n` +
      `}`,
    ...typecheckAndGuardKilled,
  },
  {
    id: 'M20',
    name: 'Pick with non-finite keys accepted',
    file: censusPath,
    needle: `    if (!keys || keys.some((key) => !allowed.has(key))) {`,
    replacement: `    if (keys && keys.some((key) => !allowed.has(key))) {`,
    ...guardKilled,
  },
  {
    id: 'M21',
    name: 'different-surface production union accepted',
    file: censusPath,
    needle: `    if (safeTypes.slice(1).some((type) => !mutuallyAssignable(safeTypes[0]!, type))) {`,
    replacement: `    if (safeTypes.slice(0, 0).some((type) => !mutuallyAssignable(safeTypes[0]!, type))) {`,
    ...guardKilled,
  },
  {
    id: 'M22',
    name: 'same-root intersection widening accepted',
    file: censusPath,
    needle:
      `    const widenings = safeAnchors.map((anchor) => intersectionWidening(type, anchor))\n` +
      `    return widenings.some((widening) => widening === null)\n` +
      `      ? { kind: 'safe', contract }\n` +
      `      : unsafe(contract, \`a \${contract} intersection widens beyond its guarded surface through \${widenings[0]}\`)`,
    replacement:
      `    const widenings = safeAnchors.map((anchor) => intersectionWidening(type, anchor))\n` +
      `    void widenings\n` +
      `    return { kind: 'safe', contract }`,
    ...guardKilled,
  },
  {
    id: 'M23',
    name: 'full-bundle alias and heritage provenance ignored',
    file: censusPath,
    needle:
      `function fullBundleReferencesOf(target: ts.Program, files: readonly string[]): readonly string[] {\n` +
      `  const { checker: targetChecker, narrowContractOf: narrowOf } = contractsOf(target)\n` +
      `  const references: string[] = []\n` +
      `  for (const fileName of files) {\n` +
      `    const source = target.getSourceFile(fileName)\n` +
      `    if (!source) continue\n` +
      `    const visit = (node: ts.Node) => {\n` +
      `      const isHeritageType = ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent)\n` +
      `      if (ts.isTypeNode(node) || isHeritageType) {\n` +
      `        const type = ts.isTypeNode(node)\n` +
      `          ? targetChecker.getTypeFromTypeNode(node)\n` +
      `          : targetChecker.getTypeAtLocation(node)\n` +
      `        const resolution = narrowOf(type, ts.isTypeNode(node) ? node : undefined)\n` +
      `        if (resolution.kind === 'full-bundle') references.push(at(node))`,
    replacement:
      `function fullBundleReferencesOf(target: ts.Program, files: readonly string[]): readonly string[] {\n` +
      `  const { checker: targetChecker, fullBundleDeclaration: targetFullBundle } = contractsOf(target)\n` +
      `  const references: string[] = []\n` +
      `  for (const fileName of files) {\n` +
      `    const source = target.getSourceFile(fileName)\n` +
      `    if (!source) continue\n` +
      `    const visit = (node: ts.Node) => {\n` +
      `      const isHeritageType = ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent)\n` +
      `      if (ts.isTypeNode(node) || isHeritageType) {\n` +
      `        const type = ts.isTypeNode(node)\n` +
      `          ? targetChecker.getTypeFromTypeNode(node)\n` +
      `          : targetChecker.getTypeAtLocation(node)\n` +
      `        const symbol = type.aliasSymbol ?? type.getSymbol()\n` +
      `        if (symbol?.declarations?.includes(targetFullBundle)) references.push(at(node))`,
    ...guardKilled,
  },
  {
    id: 'M24',
    name: 'declared contextual type syntax ignored at indexed hand-offs',
    file: censusPath,
    needle: `        const resolution = relevant[0] ?? narrowOf(contextualType)`,
    replacement: `        const resolution = narrowOf(contextualType)`,
    ...guardKilled,
  },
  {
    id: 'M25',
    name: 'partial adult-role intersection accepted',
    file: censusPath,
    needle:
      `    const forbidden = forbiddenRole(type, contract)\n` +
      `    if (forbidden) return unsafe(contract, \`a \${contract} intersection exposes the forbidden \${forbidden} role\`)\n` +
      `    const safeAnchors = partTypes.filter((_, index) => parts[index]?.kind === 'safe')`,
    replacement:
      `    const forbidden = forbiddenRole(type, contract)\n` +
      `    if (forbidden) return { kind: 'safe', contract }\n` +
      `    const safeAnchors = partTypes.filter((_, index) => parts[index]?.kind === 'safe')`,
    ...guardKilled,
  },
  {
    id: 'M26',
    name: 'unsupported generic wrapper accepted',
    file: censusPath,
    needle:
      `    if (guarded) {\n` +
      `      return unsafe(guarded.contract, \`an unsupported generic wrapper contains the guarded \${guarded.contract} root\`)\n` +
      `    }`,
    replacement:
      `    if (guarded) {\n` +
      `      return guarded\n` +
      `    }`,
    ...guardKilled,
  },
  {
    id: 'M27',
    name: 'mapped import/index descendant scan truncated',
    file: censusPath,
    needle:
      `        if (\n` +
      `          child !== node &&\n` +
      `          (ts.isTypeReferenceNode(child) || ts.isImportTypeNode(child) || ts.isIndexedAccessTypeNode(child))\n` +
      `        ) {`,
    replacement: `        if (child !== node && ts.isTypeReferenceNode(child)) {`,
    ...guardKilled,
  },
  {
    id: 'M28',
    name: 'any or unknown property widening accepted',
    file: censusPath,
    needle:
      `    if (propertyType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {\n` +
      `      return \`the any/unknown \${property.name} member\`\n` +
      `    }`,
    replacement:
      `    if (propertyType.flags & ts.TypeFlags.Never) {\n` +
      `      return \`the any/unknown \${property.name} member\`\n` +
      `    }`,
    ...guardKilled,
  },
  {
    id: 'M29',
    name: 'full-bundle-only union forgotten',
    file: censusPath,
    needle:
      `    if (safe.length === 0) return hasFullBundle ? FULL : NONE\n` +
      `    const contract = safe[0]!.contract\n` +
      `    if (safe.some((part) => part.contract !== contract)) return unsafe(contract, 'a union combines different narrow Study roots')`,
    replacement:
      `    if (safe.length === 0) return NONE\n` +
      `    const contract = safe[0]!.contract\n` +
      `    if (safe.some((part) => part.contract !== contract)) return unsafe(contract, 'a union combines different narrow Study roots')`,
    ...guardKilled,
  },
  {
    id: 'M30',
    name: 'full-bundle-only intersection forgotten',
    file: censusPath,
    needle:
      `    if (safe.length === 0) return hasFullBundle ? FULL : NONE\n` +
      `    const contract = safe[0]!.contract\n` +
      `    if (safe.some((part) => part.contract !== contract)) {\n` +
      `      return unsafe(contract, 'an intersection combines different narrow Study roots')\n` +
      `    }`,
    replacement:
      `    if (safe.length === 0) return NONE\n` +
      `    const contract = safe[0]!.contract\n` +
      `    if (safe.some((part) => part.contract !== contract)) {\n` +
      `      return unsafe(contract, 'an intersection combines different narrow Study roots')\n` +
      `    }`,
    ...guardKilled,
  },
  {
    id: 'M31',
    name: 'canonical Partial declaration whitelist removed',
    file: censusPath,
    needle: `  let partialDeclaration: ts.TypeAliasDeclaration | null = null`,
    replacement: `  let partialDeclaration: ts.TypeAliasDeclaration | null = {} as ts.TypeAliasDeclaration`,
    ...guardKilled,
  },
  {
    id: 'M32',
    name: 'full-bundle heritage clause omitted',
    file: censusPath,
    needle:
      `      const isHeritageType = ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent)\n` +
      `      if (ts.isTypeNode(node) || isHeritageType) {`,
    replacement:
      `      const isHeritageType = ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent)\n` +
      `      if (ts.isTypeNode(node) && !isHeritageType) {`,
    ...guardKilled,
  },
  {
    id: 'M33',
    name: 'number-index intersection widening ignored',
    file: censusPath,
    needle: `  for (const kind of [ts.IndexKind.String, ts.IndexKind.Number] as const) {`,
    replacement: `  for (const kind of [ts.IndexKind.String] as const) {`,
    ...guardKilled,
  },
  {
    id: 'M34',
    name: 'call-signature intersection widening ignored',
    file: censusPath,
    needle: `  for (const kind of [ts.SignatureKind.Call, ts.SignatureKind.Construct] as const) {`,
    replacement: `  for (const kind of [ts.SignatureKind.Construct] as const) {`,
    ...guardKilled,
  },
  {
    id: 'M35',
    name: 'construct-signature intersection widening ignored',
    file: censusPath,
    needle: `  for (const kind of [ts.SignatureKind.Call, ts.SignatureKind.Construct] as const) {`,
    replacement: `  for (const kind of [ts.SignatureKind.Call] as const) {`,
    ...guardKilled,
  },
  {
    id: 'M36',
    name: 'unguarded non-nullish union arm accepted',
    file: censusPath,
    needle: `    if (parts.some((part, index) => part.kind === 'none' && !harmless[index])) {`,
    replacement: `    if (parts.some((part, index) => part.kind === 'none' && !harmless[index] && index < 0)) {`,
    ...guardKilled,
  },
  {
    id: 'M37',
    name: 'incompatible declared prop surfaces accepted',
    file: censusPath,
    needle:
      `function declaredSurfacesAreCompatible(\n` +
      `  targetChecker: ts.TypeChecker,\n` +
      `  surfaces: readonly ts.Type[],\n` +
      `  location: ts.Node,\n` +
      `): boolean {\n` +
      `  const first = surfaces[0]\n` +
      `  return !first || surfaces.slice(1).every(\n` +
      `    (surface) =>\n` +
      `      capabilitySurfaceWidening(targetChecker, surface, first, location) === null &&\n` +
      `      capabilitySurfaceWidening(targetChecker, first, surface, location) === null,\n` +
      `  )\n` +
      `}`,
    replacement:
      `function declaredSurfacesAreCompatible(\n` +
      `  _targetChecker: ts.TypeChecker,\n` +
      `  _surfaces: readonly ts.Type[],\n` +
      `  _location: ts.Node,\n` +
      `): boolean {\n` +
      `  return true\n` +
      `}`,
    ...guardKilled,
  },
  {
    id: 'M38',
    name: 'recursive nested member surface traversal removed',
    file: censusPath,
    needle: `  if (paired.has(anchor)) return null`,
    replacement: `  if (seen.size > 0 || paired.has(anchor)) return null`,
    ...guardKilled,
  },
  {
    id: 'M39',
    name: 'production-interface heritage tracing removed',
    file: censusPath,
    needle: `    return heritageTypes.length > 0`,
    replacement: `    return heritageTypes.length < 0`,
    ...guardKilled,
  },
  {
    id: 'M40',
    name: 'array syntax wrapper handling removed',
    file: censusPath,
    needle: `    if (ts.isArrayTypeNode(node)) {`,
    replacement: `    if (ts.isArrayTypeNode(node) && node.pos < 0) {`,
    ...guardKilled,
  },
  {
    id: 'M41',
    name: 'tuple syntax wrapper handling removed',
    file: censusPath,
    needle: `    if (ts.isTupleTypeNode(node)) {`,
    replacement: `    if (ts.isTupleTypeNode(node) && node.pos < 0) {`,
    ...guardKilled,
  },
  {
    id: 'M42',
    name: 'readonly syntax wrapper handling removed',
    file: censusPath,
    needle: `    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {`,
    replacement:
      `    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword && node.pos < 0) {`,
    ...guardKilled,
  },
  {
    id: 'M43',
    name: 'semantic reference type arguments ignored',
    file: censusPath,
    needle: `        ? targetChecker.getTypeArguments(type as ts.TypeReference)`,
    replacement: `        ? targetChecker.getTypeArguments(type as ts.TypeReference).slice(0, 0)`,
    ...guardKilled,
  },
  {
    id: 'M44',
    name: 'syntactic generic constraint ignored',
    file: censusPath,
    needle: `    if (typeParameter?.constraint) {`,
    replacement: `    if (typeParameter?.constraint && typeParameter.pos < 0) {`,
    ...guardKilled,
  },
  {
    id: 'M45',
    name: 'semantic generic constraint ignored',
    file: censusPath,
    needle: `      const constraint = targetChecker.getBaseConstraintOfType(type)`,
    replacement:
      `      const constraint = type.flags & ts.TypeFlags.Never ? targetChecker.getBaseConstraintOfType(type) : undefined`,
    ...guardKilled,
  },
  {
    id: 'M46',
    name: 'destructured indexed BindingElement recovery removed',
    file: censusPath,
    needle:
      `  if (ts.isBindingElement(node)) {\n` +
      `    const parameter = parameterOf(node)`,
    replacement:
      `  if (ts.isBindingElement(node) && node.pos < 0) {\n` +
      `    const parameter = parameterOf(node)`,
    ...guardKilled,
  },
  {
    id: 'M47',
    name: 'explicit this value-parameter indexing removed',
    file: censusPath,
    needle: `      ? signature.parameters.filter((candidate) => !isThisParameter(candidate)).indexOf(parameter)`,
    replacement:
      `      ? signature.parameters\n` +
      `          .filter((candidate) => !isThisParameter(candidate) || candidate === signature.parameters[0])\n` +
      `          .indexOf(parameter)`,
    ...guardKilled,
  },
  {
    id: 'M48',
    name: 'TypeQuery projection loses provenance',
    file: censusPath,
    needle: `    if (ts.isTypeQueryNode(node)) return traceType(targetChecker.getTypeFromTypeNode(node), seenAliases)`,
    replacement: `    if (ts.isTypeQueryNode(node)) return NONE`,
    ...guardKilled,
  },
  {
    id: 'M49',
    name: 'conditional wrapper accepted',
    file: censusPath,
    needle:
      `    if (ts.isConditionalTypeNode(node)) {\n` +
      `      return guardedGenericWrapper(\n` +
      `        [node.checkType, node.extendsType, node.trueType, node.falseType].map((part) =>\n` +
      `          traceTypeNode(part, new Set(seenAliases)),\n` +
      `        ),\n` +
      `      )\n` +
      `    }`,
    replacement:
      `    if (ts.isConditionalTypeNode(node)) {\n` +
      `      return traceTypeNode(node.trueType, new Set(seenAliases))\n` +
      `    }`,
    ...guardKilled,
  },
  {
    id: 'M50',
    name: 'missing-prop props union arm accepted',
    file: censusPath,
    needle: `new Set(group.map((candidate) => candidate.constituentIndex)).size !== objectConstituentIndexes.size`,
    replacement:
      `new Set(group.map((candidate) => candidate.constituentIndex)).size !== objectConstituentIndexes.size && objectConstituentIndexes.size < 0`,
    ...guardKilled,
  },
  {
    id: 'M51',
    name: 'missing-prop props intersection arm accepted',
    file: censusPath,
    needle: `!intersectionWidenings.some((widening) => widening === null)`,
    replacement:
      `!intersectionWidenings.some((widening) => widening === null) && intersectionWidenings.length < 0`,
    ...guardKilled,
  },
]
const mutants = [...h7Mutants, ...cardMutants]

const transformationKeyOf = (mutant) =>
  `${mutant.file}\0${fragmentForEol(mutant.needle, '\n')}\0${fragmentForEol(mutant.replacement, '\n')}`

function transformationGroupsOf(candidates) {
  const groups = new Map()
  for (const mutant of candidates) {
    const key = transformationKeyOf(mutant)
    groups.set(key, [...(groups.get(key) ?? []), mutant.id])
  }
  return [...groups.values()]
}

const ids = new Set()
for (const mutant of mutants) {
  if (ids.has(mutant.id)) throw new Error(`HARNESS_ERROR: duplicate mutant id ${mutant.id}`)
  ids.add(mutant.id)
  if (!['pass', 'fail'].includes(mutant.expectTypecheck)) {
    throw new Error(`HARNESS_ERROR: ${mutant.id} has invalid typecheck expectation ${mutant.expectTypecheck}`)
  }
  if (!['pass', 'fail', 'skip'].includes(mutant.expectGuard)) {
    throw new Error(`HARNESS_ERROR: ${mutant.id} has invalid guard expectation ${mutant.expectGuard}`)
  }
  if (mutant.expectTypecheck === 'pass' && mutant.expectGuard !== 'fail') {
    throw new Error(`HARNESS_ERROR: ${mutant.id} has no failing semantic oracle`)
  }
}

const requestedId = process.argv[2]
const eolOnly = requestedId === '--eol-only'
const selectedMutants = requestedId && !eolOnly ? mutants.filter((mutant) => mutant.id === requestedId) : eolOnly ? [] : mutants
if (requestedId && !eolOnly && selectedMutants.length !== 1) {
  throw new Error(`HARNESS_ERROR: unknown mutant ${requestedId}`)
}

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

function expectationMet(expectation, result) {
  if (expectation === 'skip') return result === null
  if (!result) return false
  return expectation === 'pass' ? result.status === 0 : result.status !== 0
}

function renderStatus(result) {
  return result === null ? 'skip' : String(result.status)
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
      const guard = mutant.expectGuard === 'skip'
        ? null
        : run(process.execPath, [
          vitestPath,
          'run',
          '--project',
          'root-app',
          'src/study/studyConsumerPortInjectionCensus.test.ts',
        ])
      const typecheckOk = expectationMet(mutant.expectTypecheck, typecheck)
      const guardOk = expectationMet(mutant.expectGuard, guard)
      if (!typecheckOk || !guardOk) {
        const tail = `${typecheck.output}\n${guard?.output ?? ''}`.split(/\r?\n/).slice(-30).join('\n')
        throw new Error(
          `HARNESS_ERROR: ${mutant.id} ${mutant.name}: expected typecheck=${mutant.expectTypecheck}, guard=${mutant.expectGuard}; ` +
          `found typecheck=${renderStatus(typecheck)}, guard=${renderStatus(guard)}\n${tail}`,
        )
      }
      results.push({
        id: mutant.id,
        name: mutant.name,
        expectedTypecheck: mutant.expectTypecheck,
        expectedGuard: mutant.expectGuard,
        typecheck: typecheck.status,
        guard: guard?.status ?? null,
        killed: true,
      })
      console.log(
        `${mutant.id} KILLED typecheck=${renderStatus(typecheck)} guard=${renderStatus(guard)} ${mutant.name}`,
      )
    } finally {
      restoreAndVerify()
    }
  }

  if (!eolOnly) {
    restoreAndVerify()
    try {
      const eol = detectEol(originals.get(censusPath), censusPath)
      const controlText = `${originals.get(censusPath)}${eol}// production-port convergence inert mutation control${eol}`
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
  }
} finally {
  restoreAndVerify()
  cleanupRescue()
  process.removeListener('SIGINT', handleSigint)
  process.removeListener('SIGTERM', handleSigterm)
}

const killedIds = new Set(results.map((result) => result.id))
const killedMutants = selectedMutants.filter((mutant) => killedIds.has(mutant.id))
const selectedTransformationGroups = transformationGroupsOf(selectedMutants)
const killedTransformationGroups = transformationGroupsOf(killedMutants)
const restorationPairs = [...originalDigests].map(([file, sha256]) => ({ file, sha256 }))

console.log(`BYTE_RESTORATION EXACT ${JSON.stringify(restorationPairs)}`)
console.log(JSON.stringify({
  rescue,
  rescueRemoved,
  h7SemanticTotal: h7Mutants.length,
  cardSemanticTotal: cardMutants.length,
  semanticNamedKilled: results.length,
  semanticNamedTotal: selectedMutants.length,
  semanticUniqueKilled: killedTransformationGroups.length,
  semanticUniqueTotal: selectedTransformationGroups.length,
  duplicateTransformations: transformationGroupsOf(mutants).filter((ids) => ids.length > 1),
  controlsSurvived: eolOnly ? 0 : 1,
  controlsTotal: eolOnly ? 0 : 1,
}))
