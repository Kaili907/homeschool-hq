import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import type { StudyDashboardPorts, StudyParentControlPorts, StudySettingsPorts } from './ports'

/**
 * StudyDashboardPorts, StudySettingsPorts, StudyParentControlPorts, and the
 * ProductionStudySessionPorts learner-session root narrow what each Study surface
 * may reach. A type assertion where the ports are handed over —
 * or anywhere inside the surface that received them — erases that narrowing and the
 * compiler says nothing.
 *
 * WHAT THIS FILE PROTECTS, EXACTLY:
 *
 *   1. every expression the checker types as one of the narrow contracts, at the
 *      hand-over forms `suppliedExpressions` models: a JSX attribute, a call or
 *      construction argument, a named or shorthand property of an object literal,
 *      and the initializer of a variable or class field whose type is declared;
 *   2. every property of a parameter's declared type that the checker resolves to
 *      one of the narrow contracts — `props: { ports: StudyDashboardPorts }` and a
 *      named `interface Props` alike — and that property alone, not its siblings;
 *      and
 *   3. across the whole production program — not only the modules that declare a
 *      root, so a capability parked in one module's state and asserted in another is
 *      still reported, an imported binding being followed to the declaration it
 *      aliases — the values whose provenance runs back to one of those roots through
 *      the forms implemented below, tracked to a fixed point by symbol identity:
 *
 *        binding      const a = root · let a = root · a = root (later) ·
 *                     a ??= root · a ||= root · a &&= root ·
 *                     for (const a of [root]) · class C { field = root }
 *        destructure  const { k } = · const { k: renamed } = · const { ...rest } =
 *                     · const [a] = · const { a = root } = · const [a = root] = ·
 *                     (p = root) => · and the same patterns nested
 *        destructure  ({ k } = ·) ({ k: renamed } = ·) ({ ...rest } = ·)
 *          (assigned) ({ k = root } = ·) [a] = · [...rest] = ·  — literal syntax
 *                     meaning what the patterns above mean, and a separate code path
 *        write        arr[i] = root · w['k'] = root · w.k = root when `k` has no
 *                     declared symbol (the *container* widens to `whole`; see the
 *                     note on index blindness below)
 *        object       { ...root } · { root } · { k: root } · { k: { root } } ·
 *                     { [computed]: root } (widens to `whole`)
 *        array        [root] · [root.k] · [...roots]  (index-blind: an array that
 *                     carries anywhere is treated as carrying everywhere)
 *        reads        a.k · a?.k · a[0] · a['k'] · a[computed] · this.field · (a) ·
 *                     a! · await a · a as T · <T>a · a satisfies T · (f(), a)
 *        joins        cond ? a : b (either arm alone) · a ?? b · a || b · a && b
 *
 * Three deliberate imprecisions, each of which can only add a finding, never remove
 * one: reassignment is flow-insensitive, so a binding that carries once carries for
 * the rest of the file; arrays are index-blind on both the read and the write side;
 * and an indexed or keyed *write* widens the whole container rather than the written
 * key, so `w['k'] = ports` taints `w.other` too.
 *
 * Nothing wider. What is NOT covered, and is pinned below as a known survivor rather
 * than quietly implied to be covered:
 *
 *   - known remaining out-of-scope interprocedural forms. `function
 *     launder(x: unknown) { return x as any }`
 *     called as `launder(ports)` passes the capability across a call boundary this
 *     file does not follow, in either direction. Object-literal methods and getters
 *     are the same boundary wearing a different hat, as is a call with a declared
 *     narrow return type. The pinned survivors at the end of PROVENANCE_CASES assert
 *     only that these named forms remain outside this intentionally bounded model —
 *     not that they are the only possible JavaScript or TypeScript escapes.
 *   - a hand-over written as a spread argument, `Consumer(...[ports])`, has no
 *     per-parameter contextual type, so (1) cannot see it. For a *discovered*
 *     consumer that form fails closed instead, through the reference sweep; for a
 *     callee that is not a discovered consumer there is no narrow contract to erase.
 *
 * This is not whole-program taint analysis and does not claim to be. The list above
 * is the claim, and every line of it is forced by a fixture case.
 *
 * The predecessors were each got past by independent review, and every escape was
 * reproduced on this branch before the revision that closed it was written:
 *
 *   E1–E4 spelling games at the injection sites, and a fifth render in a file the
 *         guard never opened                                    (closed by the census)
 *   F1a   `const alias = ports; void (alias as any).adultPrivate`
 *   F1b   `const { ...spread } = ports; void (spread as any).safety`
 *   F2    delete a consumer from the hand-written scope list, then cast in its body
 *                                        (closed by deriving consumers from typed use)
 *   G1    `const w = { ports }; void (w.ports as any).safety`, and the same through
 *         `{ inner: ports }`, `[ports]`, `[ports.calendar]`, `const { ports: back } =
 *         w`, and multi-hop chains of those                    (closed by (3) above)
 *   G2    a consumer shaped `function Thing(props: { ports: StudyDashboardPorts })`,
 *         invisible to a sweep that only reads parameter types (closed by (2) above)
 *   G3    `class W { readonly leaked = ports }`, `for (const a of [ports])`, and
 *         `(f(), ports) as any` — three bindings the first pass at (3) still missed
 *   H1    a props-object consumer was *discovered* by (2) and then rejected as
 *         unbound, because the check binding consumers to their modules re-derived
 *         contracts from parameter and binding *types* only. The advertised form was
 *         dark: fail-closed, never usable       (closed by one shared seeding rule)
 *   H2    `arr[0] = ports`, `({ a } = { a: ports })`, `[a] = [ports]` and
 *         `const { a = ports } = holder` — four same-function local forms the
 *         assignment arm never reached, because it read only `symbolAt(left)` and a
 *         default is not an initializer of the thing destructured
 *                                                     (closed by `assign` and above)
 *   H3    three implemented branches no fixture forced: the shorthand arm of
 *         `suppliedExpressions`, index-blind element access on an *object*, and the
 *         false arm of a conditional join. Removing any of the three left every test
 *         green                                       (closed by forcing cases, not
 *                                                      by changing the analysis)
 *   H4    `(globalThis as any).leakedPorts = ports`, `reg.k = ports`, and
 *         `reg.k ??= ports` disappeared when the dotted property had no declared
 *         symbol, although `reg['k'] = ports` widened its receiver correctly
 *                         (closed by widening the dotted receiver or failing closed)
 *
 * Every one of those was run against its parent commit's own guard first, and each
 * left `tsc --noEmit` and that guard at exit 0 while a role outside the affected
 * narrow contract was reachable. H3 is the exception that proves the rule: nothing
 * was reachable, but nothing was proving it was not.
 *
 * Copying a *parameter property* the same way is not another escape: `readonly leaked
 * = this.ports` inside StudyParentController is TS2729, so the compiler closes it.
 */

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(sourceRoot, '..')

// ── the program ───────────────────────────────────────────────────────────────
// Built from the repository's own tsconfig, so the sweep sees exactly the files
// `tsc --noEmit` does. Tests are excluded: they are allowed to assert freely, and
// two of them exist precisely to hand narrow port objects around.

const configFile = ts.readConfigFile(join(repositoryRoot, 'tsconfig.json'), ts.sys.readFile)
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'))
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, repositoryRoot)
const productionFiles = parsedConfig.fileNames.filter((name) => !/\.test\.tsx?$/.test(name))
const program = ts.createProgram(productionFiles, { ...parsedConfig.options, noEmit: true })
const checker = program.getTypeChecker()

const posix = (path: string) => resolve(path).replaceAll('\\', '/')
const underSource = (path: string) => relative(sourceRoot, path).replaceAll('\\', '/')

function at(node: ts.Node): string {
  const source = node.getSourceFile()
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
  return `${underSource(source.fileName)}:${line + 1}`
}

const textOf = (node: ts.Node) => node.getText(node.getSourceFile()).replaceAll(/\s+/g, ' ')

type TypeErasure = ts.AsExpression | ts.TypeAssertion
const isTypeErasure = (node: ts.Node): node is TypeErasure =>
  ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)

/**
 * Assignment operators that can move a whole object into their target. `+=` and the
 * arithmetic family cannot, so they are not here; the three logical assignments can,
 * and are the same joins as `??`, `||` and `&&` with a store attached.
 */
const CARRYING_ASSIGNMENTS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
])

// ── the contracts, resolved to declarations ───────────────────────────────────
// These five contract names are the only ones this file spells, and every later comparison
// is against the *declaration node* they resolve to. That is what makes an aliased
// import (`StudyPortBundle as Bundle`, `StudyDashboardPorts as DashPorts`)
// indistinguishable from the original here.

const NARROW_CONTRACTS = [
  'StudyDashboardPorts',
  'StudySettingsPorts',
  'StudyParentControlPorts',
  'ProductionStudySessionPorts',
] as const
const FULL_BUNDLE = 'StudyPortBundle'
type NarrowContract = (typeof NARROW_CONTRACTS)[number]

type NarrowResolution =
  | { readonly kind: 'none' }
  | { readonly kind: 'full-bundle' }
  | { readonly kind: 'safe'; readonly contract: NarrowContract }
  | { readonly kind: 'unsafe'; readonly contract: NarrowContract; readonly reason: string }

const NONE: NarrowResolution = { kind: 'none' }
const FULL: NarrowResolution = { kind: 'full-bundle' }
const PRODUCTION_SESSION_CONTRACT: NarrowContract = 'ProductionStudySessionPorts'
const PRODUCTION_SESSION_ROLES = new Set(['calendar', 'checkpoint', 'persistence', 'eventLedger', 'safety'])

/**
 * Resolves the contract names against one program. Taken per program because a
 * declaration node is only comparable within the program that parsed it — the
 * fixture sweep at the bottom of this file builds its own.
 */
function contractsOf(target: ts.Program) {
  const portsModule = join(sourceRoot, 'study', 'ports.ts')
  const portsSource = target.getSourceFile(portsModule)
  if (!portsSource) throw new Error(`the Study port contracts are not in the program: ${portsModule}`)

  const interfaces = new Map<string, ts.InterfaceDeclaration>()
  ts.forEachChild(portsSource, (node) => {
    if (ts.isInterfaceDeclaration(node)) interfaces.set(node.name.text, node)
  })
  const declarationOf = (name: string) => {
    const declaration = interfaces.get(name)
    if (!declaration) throw new Error(`${name} is no longer an interface in src/study/ports.ts`)
    return declaration
  }

  const narrowByDeclaration = new Map<ts.Declaration, NarrowContract>(
    NARROW_CONTRACTS.map((name) => [declarationOf(name) as ts.Declaration, name] as const),
  )
  const targetChecker = target.getTypeChecker()
  const fullBundleDeclaration = declarationOf(FULL_BUNDLE)
  const fullBundleRoles = new Set(
    targetChecker.getPropertiesOfType(targetChecker.getTypeAtLocation(fullBundleDeclaration)).map((property) => property.name),
  )

  // Bootstrap the two supported mapped types once, then compare their declaration
  // nodes. User aliases merely named Pick or Partial do not gain authority.
  let pickDeclaration: ts.TypeAliasDeclaration | null = null
  let partialDeclaration: ts.TypeAliasDeclaration | null = null
  const findSupportedUtilities = (node: ts.Node) => {
    if (pickDeclaration && partialDeclaration) return
    if (
      ts.isTypeReferenceNode(node) &&
      ts.isIdentifier(node.typeName) &&
      (node.typeName.text === 'Pick' || node.typeName.text === 'Partial')
    ) {
      const found = targetChecker.getSymbolAtLocation(node.typeName)
      const symbol = found && found.flags & ts.SymbolFlags.Alias ? targetChecker.getAliasedSymbol(found) : found
      const declaration = symbol?.declarations?.find(ts.isTypeAliasDeclaration) ?? null
      if (node.typeName.text === 'Pick') pickDeclaration ??= declaration
      else partialDeclaration ??= declaration
    }
    ts.forEachChild(node, findSupportedUtilities)
  }
  findSupportedUtilities(portsSource)
  if (!pickDeclaration || !partialDeclaration) {
    throw new Error('the canonical Pick and Partial declarations are not both reachable from src/study/ports.ts')
  }

  const declarationResolution = (declarations: readonly ts.Declaration[] | undefined): NarrowResolution => {
    for (const declaration of declarations ?? []) {
      const contract = narrowByDeclaration.get(declaration)
      if (contract) return { kind: 'safe', contract }
      if (declaration === fullBundleDeclaration) return FULL
    }
    return NONE
  }

  const symbolAtTypeName = (name: ts.EntityName): ts.Symbol | undefined => {
    const found = targetChecker.getSymbolAtLocation(name)
    return found && found.flags & ts.SymbolFlags.Alias ? targetChecker.getAliasedSymbol(found) : found
  }

  const harmlessType = (type: ts.Type) =>
    Boolean(type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Never))

  const harmlessUnionArm = (node: ts.TypeNode) => harmlessType(targetChecker.getTypeFromTypeNode(node))

  const allowedRoles = (contract: NarrowContract) => contract === PRODUCTION_SESSION_CONTRACT
    ? PRODUCTION_SESSION_ROLES
    : new Set(
        targetChecker
          .getPropertiesOfType(targetChecker.getTypeAtLocation(declarationOf(contract)))
          .map((property) => property.name),
      )

  const forbiddenRole = (type: ts.Type, contract: NarrowContract): string | null => {
    const allowed = allowedRoles(contract)
    for (const property of targetChecker.getPropertiesOfType(type)) {
      if (fullBundleRoles.has(property.name) && !allowed.has(property.name)) return property.name
    }
    return null
  }

  const unsafe = (contract: NarrowContract, reason: string): NarrowResolution => ({ kind: 'unsafe', contract, reason })

  const mutuallyAssignable = (left: ts.Type, right: ts.Type) =>
    targetChecker.isTypeAssignableTo(left, right) && targetChecker.isTypeAssignableTo(right, left)

  const finiteLiteralKeys = (type: ts.Type): readonly string[] | null => {
    if (type.flags & ts.TypeFlags.Never) return []
    if (type.isUnion()) {
      const parts = type.types.map(finiteLiteralKeys)
      return parts.every((part): part is readonly string[] => part !== null) ? [...new Set(parts.flat())] : null
    }
    if (type.flags & ts.TypeFlags.StringLiteral) return [(type as ts.StringLiteralType).value]
    if (type.flags & ts.TypeFlags.NumberLiteral) return [String((type as ts.NumberLiteralType).value)]
    return null
  }

  const validatedPick = (source: NarrowResolution, keyType: ts.Type | undefined): NarrowResolution => {
    if (source.kind !== 'safe') return source
    const keys = keyType ? finiteLiteralKeys(keyType) : null
    const allowed = allowedRoles(source.contract)
    if (!keys || keys.some((key) => !allowed.has(key))) {
      return unsafe(source.contract, `a Pick from ${source.contract} does not name only finite canonical role keys`)
    }
    return source
  }

  const guardedGenericWrapper = (parts: readonly NarrowResolution[]): NarrowResolution => {
    const rejected = parts.find((part): part is Extract<NarrowResolution, { kind: 'unsafe' }> => part.kind === 'unsafe')
    if (rejected) return rejected
    const guarded = parts.find((part): part is Extract<NarrowResolution, { kind: 'safe' }> => part.kind === 'safe')
    if (guarded) {
      return unsafe(guarded.contract, `an unsupported generic wrapper contains the guarded ${guarded.contract} root`)
    }
    return parts.some((part) => part.kind === 'full-bundle') ? FULL : NONE
  }

  const semanticTypeArguments = (type: ts.Type): readonly ts.Type[] => {
    const referenceArguments =
      type.flags & ts.TypeFlags.Object && (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
        ? targetChecker.getTypeArguments(type as ts.TypeReference)
        : []
    return [...new Set([...(type.aliasTypeArguments ?? []), ...referenceArguments])]
  }

  const combineUnion = (
    parts: readonly NarrowResolution[],
    harmless: readonly boolean[],
    partTypes: readonly ts.Type[],
  ): NarrowResolution => {
    const rejected = parts.find((part): part is Extract<NarrowResolution, { kind: 'unsafe' }> => part.kind === 'unsafe')
    if (rejected) return rejected
    const safe = parts.filter((part): part is Extract<NarrowResolution, { kind: 'safe' }> => part.kind === 'safe')
    const hasFullBundle = parts.some((part) => part.kind === 'full-bundle')
    if (safe.length === 0) return hasFullBundle ? FULL : NONE
    const contract = safe[0]!.contract
    if (safe.some((part) => part.contract !== contract)) return unsafe(contract, 'a union combines different narrow Study roots')
    if (hasFullBundle) {
      return unsafe(contract, `a ${contract} union also exposes the complete ${FULL_BUNDLE}`)
    }
    if (parts.some((part, index) => part.kind === 'none' && !harmless[index])) {
      return unsafe(contract, `a ${contract} union has a non-nullish arm whose capabilities are not guarded`)
    }
    const safeTypes = partTypes.filter((_, index) => parts[index]?.kind === 'safe')
    if (safeTypes.slice(1).some((type) => !mutuallyAssignable(safeTypes[0]!, type))) {
      return unsafe(contract, `a ${contract} union combines different capability surfaces`)
    }
    return { kind: 'safe', contract }
  }

  const intersectionWidening = (type: ts.Type, anchor: ts.Type): string | null =>
    capabilitySurfaceWidening(targetChecker, type, anchor, portsSource)

  const combineIntersection = (
    parts: readonly NarrowResolution[],
    type: ts.Type,
    partTypes: readonly ts.Type[],
  ): NarrowResolution => {
    const rejected = parts.find((part): part is Extract<NarrowResolution, { kind: 'unsafe' }> => part.kind === 'unsafe')
    if (rejected) return rejected
    const safe = parts.filter((part): part is Extract<NarrowResolution, { kind: 'safe' }> => part.kind === 'safe')
    const hasFullBundle = parts.some((part) => part.kind === 'full-bundle')
    if (safe.length === 0) return hasFullBundle ? FULL : NONE
    const contract = safe[0]!.contract
    if (safe.some((part) => part.contract !== contract)) {
      return unsafe(contract, 'an intersection combines different narrow Study roots')
    }
    if (hasFullBundle) {
      return unsafe(contract, `a ${contract} intersection also exposes the complete ${FULL_BUNDLE}`)
    }
    const forbidden = forbiddenRole(type, contract)
    if (forbidden) return unsafe(contract, `a ${contract} intersection exposes the forbidden ${forbidden} role`)
    const safeAnchors = partTypes.filter((_, index) => parts[index]?.kind === 'safe')
    const widenings = safeAnchors.map((anchor) => intersectionWidening(type, anchor))
    return widenings.some((widening) => widening === null)
      ? { kind: 'safe', contract }
      : unsafe(contract, `a ${contract} intersection widens beyond its guarded surface through ${widenings[0]}`)
  }

  const interfaceHeritageResolution = (
    declarations: readonly ts.Declaration[] | undefined,
    resultType: ts.Type,
    resolveBase: (type: ts.Type) => NarrowResolution,
  ): NarrowResolution => {
    const heritageTypes = (declarations ?? [])
      .filter(ts.isInterfaceDeclaration)
      .flatMap((declaration) => declaration.heritageClauses ?? [])
      .flatMap((clause) => clause.types)
      .map((heritage) => targetChecker.getTypeAtLocation(heritage))
    return heritageTypes.length > 0
      ? combineIntersection(heritageTypes.map(resolveBase), resultType, heritageTypes)
      : NONE
  }

  const literalKeys = (node: ts.TypeNode): readonly string[] | null => {
    return finiteLiteralKeys(targetChecker.getTypeFromTypeNode(node))
  }

  const fullBundleSurface = (type: ts.Type) => {
    const properties = new Set(targetChecker.getPropertiesOfType(type).map((property) => property.name))
    return [...fullBundleRoles].every((role) => properties.has(role))
  }

  function traceTypeNode(node: ts.TypeNode, seenAliases = new Set<ts.TypeAliasDeclaration>()): NarrowResolution {
    if (ts.isParenthesizedTypeNode(node)) return traceTypeNode(node.type, seenAliases)
    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {
      return traceTypeNode(node.type, seenAliases)
    }
    if (ts.isArrayTypeNode(node)) {
      return guardedGenericWrapper([traceTypeNode(node.elementType, new Set(seenAliases))])
    }
    if (ts.isTupleTypeNode(node)) {
      const elementType = (element: ts.TypeNode | ts.NamedTupleMember): ts.TypeNode =>
        ts.isNamedTupleMember(element) || ts.isOptionalTypeNode(element) || ts.isRestTypeNode(element)
          ? element.type
          : element
      return guardedGenericWrapper(
        node.elements.map((element) => traceTypeNode(elementType(element), new Set(seenAliases))),
      )
    }
    if (ts.isTypeQueryNode(node)) return traceType(targetChecker.getTypeFromTypeNode(node), seenAliases)
    if (ts.isConditionalTypeNode(node)) {
      return guardedGenericWrapper(
        [node.checkType, node.extendsType, node.trueType, node.falseType].map((part) =>
          traceTypeNode(part, new Set(seenAliases)),
        ),
      )
    }
    if (ts.isUnionTypeNode(node)) {
      const partTypes = node.types.map((part) => targetChecker.getTypeFromTypeNode(part))
      return combineUnion(
        node.types.map((part) => traceTypeNode(part, new Set(seenAliases))),
        node.types.map(harmlessUnionArm),
        partTypes,
      )
    }
    if (ts.isIntersectionTypeNode(node)) {
      const partTypes = node.types.map((part) => targetChecker.getTypeFromTypeNode(part))
      return combineIntersection(
        node.types.map((part) => traceTypeNode(part, new Set(seenAliases))),
        targetChecker.getTypeFromTypeNode(node),
        partTypes,
      )
    }
    if (ts.isIndexedAccessTypeNode(node)) {
      const root = traceTypeNode(node.objectType, new Set(seenAliases))
      if (root.kind !== 'safe') return root.kind === 'unsafe' ? root : NONE
      const keys = literalKeys(node.indexType)
      const allowed = allowedRoles(root.contract)
      if (!keys || keys.length === 0 || keys.some((key) => !allowed.has(key))) {
        return unsafe(root.contract, `an indexed ${root.contract} projection does not name only canonical role keys`)
      }
      return root
    }
    if (ts.isMappedTypeNode(node)) {
      let guardedRoot: NarrowContract | null = null
      let containsFullBundle = false
      const visit = (child: ts.Node) => {
        if (
          child !== node &&
          (ts.isTypeReferenceNode(child) || ts.isImportTypeNode(child) || ts.isIndexedAccessTypeNode(child))
        ) {
          const resolution = traceTypeNode(child, new Set(seenAliases))
          if (resolution.kind === 'safe') guardedRoot ??= resolution.contract
          if (resolution.kind === 'unsafe') guardedRoot ??= resolution.contract
          if (resolution.kind === 'full-bundle') containsFullBundle = true
        }
        ts.forEachChild(child, visit)
      }
      visit(node)
      return guardedRoot
        ? unsafe(
            guardedRoot,
            `an arbitrary mapped type wraps ${guardedRoot}; only the canonical Pick and Partial declarations are supported`,
          )
        : containsFullBundle ? FULL : NONE
    }
    if (ts.isImportTypeNode(node)) return traceType(targetChecker.getTypeFromTypeNode(node), seenAliases)
    if (!ts.isTypeReferenceNode(node)) return NONE

    const symbol = symbolAtTypeName(node.typeName)
    const direct = declarationResolution(symbol?.declarations)
    if (direct.kind !== 'none') return direct
    const semanticType = targetChecker.getTypeFromTypeNode(node)

    const typeParameter = symbol?.declarations?.find(ts.isTypeParameterDeclaration)
    if (typeParameter?.constraint) {
      const constrained = traceTypeNode(typeParameter.constraint, new Set(seenAliases))
      return constrained.kind === 'safe'
        ? unsafe(constrained.contract, `a generic type parameter is constrained by ${constrained.contract} and may widen it`)
        : constrained
    }

    const alias = symbol?.declarations?.find(ts.isTypeAliasDeclaration)
    if (alias === pickDeclaration) {
      const source = node.typeArguments?.[0]
      const resolution = source ? traceTypeNode(source, new Set(seenAliases)) : NONE
      return validatedPick(resolution, node.typeArguments?.[1] ? targetChecker.getTypeFromTypeNode(node.typeArguments[1]) : undefined)
    }
    if (alias === partialDeclaration) {
      const source = node.typeArguments?.[0]
      return source ? traceTypeNode(source, new Set(seenAliases)) : NONE
    }
    const generic = guardedGenericWrapper(
      (node.typeArguments ?? []).map((argument) => traceTypeNode(argument, new Set(seenAliases))),
    )
    if (generic.kind !== 'none') return generic
    const heritage = interfaceHeritageResolution(symbol?.declarations, semanticType, (base) =>
      traceType(base, new Set(seenAliases)),
    )
    if (heritage.kind !== 'none') return heritage
    if (!alias || seenAliases.has(alias)) return fullBundleSurface(semanticType) ? FULL : NONE
    seenAliases.add(alias)
    return traceTypeNode(alias.type, seenAliases)
  }

  function traceType(
    type: ts.Type,
    seenAliases = new Set<ts.TypeAliasDeclaration>(),
    seenTypes = new Set<ts.Type>(),
  ): NarrowResolution {
    if (seenTypes.has(type)) return NONE
    seenTypes.add(type)
    const direct = declarationResolution((type.aliasSymbol ?? type.getSymbol())?.declarations)
    if (direct.kind !== 'none') return direct
    if (type.flags & ts.TypeFlags.TypeParameter) {
      const constraint = targetChecker.getBaseConstraintOfType(type)
      if (constraint && constraint !== type) {
        const constrained = traceType(constraint, new Set(seenAliases), new Set(seenTypes))
        return constrained.kind === 'safe'
          ? unsafe(constrained.contract, `a generic type parameter is constrained by ${constrained.contract} and may widen it`)
          : constrained
      }
    }
    if (type.isUnion()) {
      return combineUnion(
        type.types.map((part) => traceType(part, new Set(seenAliases), new Set(seenTypes))),
        type.types.map(harmlessType),
        type.types,
      )
    }
    if (type.isIntersection()) {
      return combineIntersection(
        type.types.map((part) => traceType(part, new Set(seenAliases), new Set(seenTypes))),
        type,
        type.types,
      )
    }

    const alias = type.aliasSymbol?.declarations?.find(ts.isTypeAliasDeclaration)
    if (alias === pickDeclaration) {
      const source = type.aliasTypeArguments?.[0]
      const resolution = source ? traceType(source, new Set(seenAliases), new Set(seenTypes)) : NONE
      return validatedPick(resolution, type.aliasTypeArguments?.[1])
    }
    if (alias === partialDeclaration) {
      const source = type.aliasTypeArguments?.[0]
      return source ? traceType(source, new Set(seenAliases), new Set(seenTypes)) : NONE
    }
    const generic = guardedGenericWrapper(
      semanticTypeArguments(type).map((argument) =>
        traceType(argument, new Set(seenAliases), new Set(seenTypes)),
      ),
    )
    if (generic.kind !== 'none') return generic
    const heritage = interfaceHeritageResolution((type.aliasSymbol ?? type.getSymbol())?.declarations, type, (base) =>
      traceType(base, new Set(seenAliases), new Set(seenTypes)),
    )
    if (heritage.kind !== 'none') return heritage
    if (!alias || seenAliases.has(alias)) return fullBundleSurface(type) ? FULL : NONE
    seenAliases.add(alias)
    return traceTypeNode(alias.type, seenAliases)
  }

  /** Resolve approved roots and wrappers by declaration identity, never spelling alone. */
  const narrowContractOf = (type: ts.Type | undefined, node?: ts.TypeNode): NarrowResolution => {
    if (!type) return NONE
    const fromNode = node ? traceTypeNode(node) : NONE
    const traced = fromNode.kind === 'none' ? traceType(type) : fromNode
    if (traced.kind !== 'safe') return traced
    const forbidden = forbiddenRole(type, traced.contract)
    return forbidden
      ? unsafe(traced.contract, `a ${traced.contract} wrapper exposes the forbidden ${forbidden} role`)
      : traced
  }

  return {
    checker: targetChecker,
    narrowContractOf,
    fullBundleDeclaration,
    typeNodeResolutionOf: (node: ts.TypeNode) => traceTypeNode(node),
  }
}

const { fullBundleDeclaration } = contractsOf(program)

// ── the census: every expression supplied to a narrow contract ────────────────
// Generated, not listed. The contextual type comes from the *declared* parameter
// or prop, so it resolves whatever the supplied expression does to itself — a cast
// cannot make its own site invisible.

/** Positions where a value is handed to a declared contract. */
function suppliedExpressions(node: ts.Node): readonly ts.Expression[] {
  if (ts.isJsxAttribute(node)) {
    const initializer = node.initializer
    return initializer && ts.isJsxExpression(initializer) && initializer.expression ? [initializer.expression] : []
  }
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) return node.arguments ?? []
  if (ts.isPropertyAssignment(node)) return [node.initializer]
  // `f({ ports })` hands over just as much as `f({ ports: ports })` does.
  if (ts.isShorthandPropertyAssignment(node)) return [node.name]
  if ((ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) && node.initializer) return [node.initializer]
  return []
}

function typeNodesOfSymbol(symbol: ts.Symbol | undefined): readonly ts.TypeNode[] {
  return [
    ...new Set(
      (symbol?.declarations ?? []).map(declaredTypeNodeOf).filter((node): node is ts.TypeNode => Boolean(node)),
    ),
  ]
}

type SeenTypePairs = Map<ts.Type, Set<ts.Type>>

const inertCapabilityMarker = (type: ts.Type): boolean =>
  type.isUnion()
    ? type.types.every(inertCapabilityMarker)
    : Boolean(type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Never))

const capabilityObjectSurface = (type: ts.Type): boolean =>
  Boolean(type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) ||
  (type.isUnion() && type.types.some(capabilityObjectSurface))

function capabilitySurfaceWidening(
  targetChecker: ts.TypeChecker,
  type: ts.Type,
  anchor: ts.Type,
  location: ts.Node,
  seen: SeenTypePairs = new Map(),
): string | null {
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return 'an any/unknown capability surface'

  const paired = seen.get(type) ?? new Set<ts.Type>()
  if (paired.has(anchor)) return null
  paired.add(anchor)
  seen.set(type, paired)

  for (const kind of [ts.IndexKind.String, ts.IndexKind.Number] as const) {
    const resultIndex = targetChecker.getIndexTypeOfType(type, kind)
    const anchorIndex = targetChecker.getIndexTypeOfType(anchor, kind)
    if (!resultIndex) continue
    if (!anchorIndex) return `${ts.IndexKind[kind].toLowerCase()} index access`
    const nested = capabilitySurfaceWidening(targetChecker, resultIndex, anchorIndex, location, seen)
    if (nested) return `${ts.IndexKind[kind].toLowerCase()} index access exposes ${nested}`
  }

  for (const kind of [ts.SignatureKind.Call, ts.SignatureKind.Construct] as const) {
    if (targetChecker.getSignaturesOfType(type, kind).length > targetChecker.getSignaturesOfType(anchor, kind).length) {
      return `${ts.SignatureKind[kind].toLowerCase()} access`
    }
  }

  for (const property of targetChecker.getPropertiesOfType(type)) {
    const propertyLocation = property.valueDeclaration ?? property.declarations?.[0] ?? location
    const propertyType = targetChecker.getTypeOfSymbolAtLocation(property, propertyLocation)
    const anchorProperty = targetChecker.getPropertyOfType(anchor, property.name)
    if (!anchorProperty) {
      if (property.flags & ts.SymbolFlags.Optional && inertCapabilityMarker(propertyType)) continue
      return `the added ${property.name} member`
    }
    if (propertyType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
      return `the any/unknown ${property.name} member`
    }
    const anchorLocation = anchorProperty.valueDeclaration ?? anchorProperty.declarations?.[0] ?? location
    const anchorType = targetChecker.getTypeOfSymbolAtLocation(anchorProperty, anchorLocation)
    if (capabilityObjectSurface(propertyType) && capabilityObjectSurface(anchorType)) {
      const nested = capabilitySurfaceWidening(targetChecker, propertyType, anchorType, propertyLocation, seen)
      if (nested) return `the ${property.name} member exposes ${nested}`
    }
    if (
      !targetChecker.isTypeAssignableTo(anchorType, propertyType) ||
      !targetChecker.isTypeAssignableTo(propertyType, anchorType)
    ) {
      return `the widened ${property.name} member`
    }
  }
  return null
}

/**
 * A union/intersection may repeat one carrying prop only when every declaration
 * describes the same capability surface. Declaration identity alone is not enough:
 * two projections of the same guarded root can expose different roles.
 */
function declaredSurfacesAreCompatible(
  targetChecker: ts.TypeChecker,
  surfaces: readonly ts.Type[],
  location: ts.Node,
): boolean {
  const first = surfaces[0]
  return !first || surfaces.slice(1).every(
    (surface) =>
      capabilitySurfaceWidening(targetChecker, surface, first, location) === null &&
      capabilitySurfaceWidening(targetChecker, first, surface, location) === null,
  )
}

function contextualPropertyTypeNodes(
  targetChecker: ts.TypeChecker,
  contextualType: ts.Type | undefined,
  key: string | null,
): readonly ts.TypeNode[] {
  return key && contextualType
    ? typeNodesOfSymbol(targetChecker.getPropertyOfType(contextualType, key))
    : []
}

/** The declaration-side syntax that produced an expression's contextual type. */
function contextualTypeNodesOf(
  targetChecker: ts.TypeChecker,
  expression: ts.Expression,
): readonly ts.TypeNode[] {
  const parent = expression.parent
  if (
    (ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent)) &&
    parent.initializer === expression
  ) {
    return parent.type ? [parent.type] : []
  }

  if (
    (ts.isPropertyAssignment(parent) && parent.initializer === expression) ||
    (ts.isShorthandPropertyAssignment(parent) && parent.name === expression)
  ) {
    const object = parent.parent
    if (ts.isObjectLiteralExpression(object)) {
      return contextualPropertyTypeNodes(
        targetChecker,
        targetChecker.getContextualType(object),
        staticKeyOf(parent.name ?? parent),
      )
    }
  }

  if (
    (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
    parent.arguments?.includes(expression) &&
    !ts.isSpreadElement(expression)
  ) {
    const index = parent.arguments.indexOf(expression)
    const signature = targetChecker.getResolvedSignature(parent)
    return typeNodesOfSymbol(signature?.getParameters()[index])
  }

  if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) {
    const attribute = parent.parent
    const opening = attribute.parent.parent
    if (ts.isJsxOpeningElement(opening) || ts.isJsxSelfClosingElement(opening)) {
      const props = targetChecker.getResolvedSignature(opening)?.getParameters()[0]
      if (!props) return []
      const propsType = targetChecker.getTypeOfSymbolAtLocation(props, opening)
      return contextualPropertyTypeNodes(targetChecker, propsType, staticKeyOf(attribute.name))
    }
  }

  return []
}

interface InjectionSite {
  readonly file: string
  readonly contract: string
  readonly expression: ts.Expression
}

/**
 * Every hand-over in one file set. Taken as a function so the fixture at the bottom
 * of this file can run it too. Production now writes one shorthand-property
 * injection inside the durable-preparation call, but still no declared class-field
 * injection; the fixture keeps every supported hand-over form explicit.
 */
function censusOf(target: ts.Program, files: readonly string[]) {
  const { checker: targetChecker, narrowContractOf: narrowOf } = contractsOf(target)
  const sites: InjectionSite[] = []
  const expressions = new Set<ts.Node>()
  const unsafe: string[] = []
  for (const fileName of files) {
    const source = target.getSourceFile(fileName)
    if (!source) continue
    const visit = (node: ts.Node) => {
      for (const expression of suppliedExpressions(node)) {
        const typeNodes = contextualTypeNodesOf(targetChecker, expression)
        const contextualType = targetChecker.getContextualType(expression) ??
          (typeNodes[0] ? targetChecker.getTypeFromTypeNode(typeNodes[0]) : undefined)
        const declaredResolutions = typeNodes.map((typeNode) => narrowOf(contextualType, typeNode))
        const declaredSurfaces = typeNodes.map((typeNode) => targetChecker.getTypeFromTypeNode(typeNode))
        const relevant = declaredResolutions.filter((resolution) => resolution.kind !== 'none')
        const resolutionKeys = new Set(
          relevant.map((resolution) =>
            resolution.kind === 'safe' || resolution.kind === 'unsafe'
              ? `${resolution.kind}:${resolution.contract}`
              : resolution.kind,
          ),
        )
        if (
          relevant.length > 0 &&
          (
            relevant.length !== declaredResolutions.length ||
            resolutionKeys.size > 1 ||
            !declaredSurfacesAreCompatible(targetChecker, declaredSurfaces, expression)
          )
        ) {
          unsafe.push(`${at(expression)} — contextual contract has multiple incompatible declared type nodes`)
          continue
        }
        const resolution = relevant[0] ?? narrowOf(contextualType)
        if (resolution.kind === 'unsafe') {
          unsafe.push(`${at(expression)} — ${resolution.reason}`)
          continue
        }
        if (resolution.kind !== 'safe') continue
        sites.push({ file: underSource(fileName), contract: resolution.contract, expression })
        expressions.add(expression)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return { sites, expressions, unsafe }
}

const { sites: census, expressions: censusExpressions, unsafe: censusUnsafe } = censusOf(program, productionFiles)

const censusReport = census.map((site) => `${site.file} | ${site.contract} | ${textOf(site.expression)}`).sort()

/**
 * The reviewed census. Not a scope list — the sweep above does not consult it. It
 * is the record of which injections a human has looked at, so another site, a
 * deleted site, or a moved site has to be read by someone before this file is
 * green again.
 */
const REVIEWED_CENSUS = [
  'App.tsx | StudyDashboardPorts | studyRuntime.ports',
  'App.tsx | StudySettingsPorts | studyRuntime.ports',
  'components/hub/ParentHub.tsx | StudyParentControlPorts | study.ports',
  'components/hub/StudyParentPanel.tsx | StudyParentControlPorts | ports',
  'components/study/StudySessionContainer.tsx | ProductionStudySessionPorts | ports',
]

// ── capability roots and their provenance ─────────────────────────────────────
// Nothing below is seeded with a component name or a module path. A capability root
// is a parameter — directly, through a destructured binding in its parameter list,
// or as a *property of the parameter's declared type* — that the checker resolves by
// declaration identity to one of the narrow contracts.
//
// What a value carries is then modelled structurally rather than as a single bit, so
// that `props.ports` is a capability while `props.other` beside it is not, and
// `w.ports` is one while `w.unrelated` is not. `whole` means the value itself is (or
// conservatively stands for) a capability; `members` names the keys known to carry
// one. Anything a form below cannot attribute to a key widens to `whole` — this
// analysis is allowed to be wrong in the direction of a failing test, never in the
// direction of a reachable role.

interface Carriage {
  whole: boolean
  readonly members: Set<string>
}

const nothing = (): Carriage => ({ whole: false, members: new Set() })
const everything = (): Carriage => ({ whole: true, members: new Set() })
const carries = (carriage: Carriage) => carriage.whole || carriage.members.size > 0

function absorb(into: Carriage, from: Carriage): boolean {
  let grew = false
  if (from.whole && !into.whole) {
    into.whole = true
    grew = true
  }
  if (!into.whole) {
    for (const key of from.members) {
      if (!into.members.has(key)) {
        into.members.add(key)
        grew = true
      }
    }
  }
  return grew
}

interface Consumer {
  readonly module: string
  readonly exportName: string
  readonly contract: string
  /** Zero-based parameter whose position or property carries the contract. */
  readonly parameterIndex: number
  /** The prop that carries the contract, or null when the parameter itself is it. */
  readonly propName: string | null
}

interface PortsRoot {
  readonly declaration: ts.Declaration
  readonly consumer: Consumer
}

interface BodyFinding {
  readonly line: number
  readonly message: string
}

/**
 * Forms this file does not model. Anything landing here fails the guard with a file
 * and line rather than being waved through — an unmodelled edge is the one thing a
 * census cannot survive silently.
 */
const unmodelled: string[] = []
unmodelled.push(...censusUnsafe)

/** The parameter a declaration belongs to, or null if it is not in a parameter list. */
function parameterOf(declaration: ts.Node): ts.ParameterDeclaration | null {
  let current: ts.Node = declaration
  while (ts.isBindingElement(current) || ts.isObjectBindingPattern(current) || ts.isArrayBindingPattern(current)) {
    current = current.parent
  }
  return ts.isParameter(current) ? current : null
}

const isThisParameter = (parameter: ts.ParameterDeclaration): boolean =>
  ts.isIdentifier(parameter.name) && parameter.name.text === 'this'

type Signature = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration | ts.ConstructorDeclaration

function enclosingSignature(node: ts.Node): Signature | null {
  let current: ts.Node | undefined = node
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isConstructorDeclaration(current)
    ) {
      return current
    }
    current = current.parent
  }
  return null
}

/** The name a host would import this consumer by. Null means "fail closed". */
function consumerNameOf(signature: Signature): string | null {
  if (ts.isConstructorDeclaration(signature)) return signature.parent.name?.text ?? null
  if (ts.isFunctionDeclaration(signature)) return signature.name?.text ?? null
  if (ts.isMethodDeclaration(signature)) {
    const owner = ts.isClassDeclaration(signature.parent) ? signature.parent.name?.text : undefined
    return owner && ts.isIdentifier(signature.name) ? `${owner}.${signature.name.text}` : null
  }
  // An arrow or function expression is named by whatever holds it, including through
  // a wrapper call such as memo() or forwardRef().
  let node: ts.Node = signature
  while (node.parent && !ts.isVariableDeclaration(node.parent) && ts.isCallExpression(node.parent)) node = node.parent
  const holder = node.parent
  if (holder && ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)) return holder.name.text
  return null
}

/** A property key this analysis can name, or null when it is computed. */
function staticKeyOf(name: ts.Node): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return null
}

/** The prop a destructured parameter binding reads, when it reads one directly. */
function propKeyOf(node: ts.ParameterDeclaration | ts.BindingElement): string | null {
  if (ts.isParameter(node)) return null
  const pattern = node.parent
  if (!ts.isObjectBindingPattern(pattern) || !ts.isParameter(pattern.parent)) return null
  return staticKeyOf(node.propertyName ?? node.name)
}

interface NarrowDeclaration {
  /** The narrow contract this parameter position declares. */
  readonly contract: NarrowContract
  /** The property symbol carrying it, or null when the parameter's own type is it. */
  readonly property: ts.Symbol | null
  /** The prop a host hands it over as, or null when the position is positional. */
  readonly propName: string | null
}

type NarrowResolver = (type: ts.Type | undefined, node?: ts.TypeNode) => NarrowResolution

function declaredTypeNodeOf(declaration: ts.Declaration): ts.TypeNode | undefined {
  if (
    ts.isParameter(declaration) ||
    ts.isPropertySignature(declaration) ||
    ts.isPropertyDeclaration(declaration) ||
    ts.isVariableDeclaration(declaration) ||
    ts.isTypeAliasDeclaration(declaration)
  ) {
    return declaration.type
  }
  return undefined
}

/**
 * What one parameter — or one destructured binding in a parameter list — declares.
 *
 * ONE rule, used by the seeding pass and by the bind check at the bottom of this
 * file, so the two cannot drift into disagreeing about what a props object declares.
 * A second, weaker copy here is exactly what left the props-object form discovered
 * but unadoptable: it read parameter and binding *types* only, so a contract living
 * on a PropertySignature was reported by discovery and then rejected as unbound.
 */
function narrowContractsAt(
  targetChecker: ts.TypeChecker,
  narrowOf: NarrowResolver,
  node: ts.ParameterDeclaration | ts.BindingElement,
  onUnsafe: (node: ts.Node, resolution: Extract<NarrowResolution, { kind: 'unsafe' }>) => void = () => {},
): readonly NarrowDeclaration[] {
  const type = targetChecker.getTypeAtLocation(node)

  if (ts.isBindingElement(node)) {
    const parameter = parameterOf(node)
    const key = propKeyOf(node)
    if (parameter && key !== null) {
      const parameterType = targetChecker.getTypeAtLocation(parameter)
      const typeNodes = (parameterType.isUnionOrIntersection() ? parameterType.types : [parameterType])
        .flatMap((constituent) => typeNodesOfSymbol(targetChecker.getPropertyOfType(constituent, key)))
      const resolutions = typeNodes.map((typeNode) => narrowOf(type, typeNode))
      const safe = resolutions.filter(
        (resolution): resolution is Extract<NarrowResolution, { kind: 'safe' }> => resolution.kind === 'safe',
      )
      const rejected = resolutions.find(
        (resolution): resolution is Extract<NarrowResolution, { kind: 'unsafe' }> => resolution.kind === 'unsafe',
      )
      if (rejected) {
        onUnsafe(node, rejected)
        return []
      }
      if (safe.length > 0) {
        const contract = safe[0]!.contract
        const surfaces = typeNodes.map((typeNode) => targetChecker.getTypeFromTypeNode(typeNode))
        if (
          safe.length !== resolutions.length ||
          safe.some((resolution) => resolution.contract !== contract) ||
          !declaredSurfacesAreCompatible(targetChecker, surfaces, node)
        ) {
          onUnsafe(node, {
            kind: 'unsafe',
            contract,
            reason: 'a destructured parameter combines incompatible declared capability surfaces',
          })
          return []
        }
        return [{ contract, property: null, propName: key }]
      }
    }
  }

  const own = narrowOf(type, ts.isParameter(node) ? node.type : undefined)
  if (own.kind === 'unsafe') {
    onUnsafe(node, own)
    return []
  }
  if (own.kind === 'safe') return [{ contract: own.contract, property: null, propName: propKeyOf(node) }]
  // A props object. The contract lives on a property of the declared type, so only
  // that property is a capability — a sibling prop of an unrelated type is left
  // alone, which is the whole point of asking the checker rather than tainting the
  // parameter wholesale. Per union/intersection constituent, so a narrow arm of a
  // union is not lost.
  interface Candidate {
    readonly resolution: NarrowResolution
    readonly property: ts.Symbol
    readonly propName: string | null
    readonly declaration: ts.Node
    readonly surface: ts.Type
    readonly constituent: ts.Type
    readonly constituentIndex: number
  }
  const candidates: Candidate[] = []
  const constituents = type.isUnionOrIntersection() ? type.types : [type]
  const objectConstituentIndexes = new Set(
    constituents.flatMap((constituent, index) => constituent.flags & ts.TypeFlags.Object ? [index] : []),
  )
  for (const [constituentIndex, constituent] of constituents.entries()) {
    if (!(constituent.flags & ts.TypeFlags.Object)) continue
    for (const property of targetChecker.getPropertiesOfType(constituent)) {
      const propertyDeclaration = property.declarations?.find((declaration) => declaredTypeNodeOf(declaration))
      const propertyType = targetChecker.getTypeOfSymbolAtLocation(property, node)
      const resolution = narrowOf(
        propertyType,
        propertyDeclaration ? declaredTypeNodeOf(propertyDeclaration) : undefined,
      )
      candidates.push({
        resolution,
        property,
        propName: ts.isParameter(node) ? property.name : null,
        declaration: propertyDeclaration ?? node,
        surface: propertyType,
        constituent,
        constituentIndex,
      })
    }
  }

  const found: NarrowDeclaration[] = []
  const byProp = new Map<string | null, Candidate[]>()
  for (const candidate of candidates) {
    const group = byProp.get(candidate.propName) ?? []
    group.push(candidate)
    byProp.set(candidate.propName, group)
  }
  for (const group of byProp.values()) {
    const first = group[0]!
    const rejected = group.find(
      (candidate): candidate is Candidate & { resolution: Extract<NarrowResolution, { kind: 'unsafe' }> } =>
        candidate.resolution.kind === 'unsafe',
    )
    if (rejected) {
      onUnsafe(rejected.declaration, rejected.resolution)
      continue
    }
    const safe = group.filter(
      (candidate): candidate is Candidate & { resolution: Extract<NarrowResolution, { kind: 'safe' }> } =>
        candidate.resolution.kind === 'safe',
    )
    if (safe.length === 0) continue
    const contract = safe[0]!.resolution.contract
    const intersectionWidenings = type.isIntersection()
      ? safe.map((candidate) =>
          capabilitySurfaceWidening(targetChecker, type, candidate.constituent, node),
        )
      : []
    if (
      (type.isUnion() && new Set(group.map((candidate) => candidate.constituentIndex)).size !== objectConstituentIndexes.size) ||
      (type.isIntersection() && !intersectionWidenings.some((widening) => widening === null)) ||
      safe.length !== group.length ||
      safe.some((candidate) => candidate.resolution.contract !== contract) ||
      !declaredSurfacesAreCompatible(targetChecker, group.map((candidate) => candidate.surface), node)
    ) {
      onUnsafe(first.declaration, {
        kind: 'unsafe',
        contract,
        reason: 'a props-object union/intersection combines different capability surfaces',
      })
      continue
    }
    found.push(...safe.map(({ property, propName }) => ({ contract, property, propName })))
  }
  return found
}

/**
 * Seeds the capability roots in one file set and follows their provenance to a fixed
 * point. Used unchanged by the production sweep and by the fixture at the bottom of
 * this file, so the fixture proves the code production runs rather than a copy of it.
 *
 * REASSIGNMENT (conservative). A binding that carries once carries for the rest of
 * the file: `let p = ports; p = other; (p as any)` is still reported. Flow-sensitive
 * reasoning would buy a few false positives back at the price of a failure mode that
 * is silence, and silence is the one answer a census must not give.
 */
function capabilityScope(target: ts.Program, files: readonly string[]) {
  const { checker: targetChecker, narrowContractOf: narrowOf } = contractsOf(target)
  const sources = files
    .map((file) => target.getSourceFile(file))
    .filter((source): source is ts.SourceFile => Boolean(source))

  const carriage = new Map<ts.Declaration, Carriage>()
  /** Property symbols the checker resolves to a narrow contract, by symbol identity. */
  const narrowProperties = new Set<ts.Symbol>()
  const roots: PortsRoot[] = []
  const unnameable: string[] = []

  const carriageFor = (declaration: ts.Declaration) => {
    const existing = carriage.get(declaration)
    if (existing) return existing
    const fresh = nothing()
    carriage.set(declaration, fresh)
    return fresh
  }

  function record(declaration: ts.Declaration, contract: string, propName: string | null) {
    const signature = enclosingSignature(declaration)
    const exportName = signature ? consumerNameOf(signature) : null
    const parameter = parameterOf(declaration)
    const parameterIndex = signature && parameter
      ? signature.parameters.filter((candidate) => !isThisParameter(candidate)).indexOf(parameter)
      : -1
    if (!exportName || parameterIndex < 0) {
      unnameable.push(`${at(declaration)} — a ${contract} parameter belongs to a callable this sweep cannot name`)
      return
    }
    const module = underSource(declaration.getSourceFile().fileName)
    roots.push({ declaration, consumer: { module, exportName, contract, parameterIndex, propName } })
  }

  for (const source of sources) {
    const seed = (node: ts.Node) => {
      if ((ts.isParameter(node) || ts.isBindingElement(node)) && parameterOf(node)) {
        for (const declared of narrowContractsAt(targetChecker, narrowOf, node, (where, resolution) => {
          unnameable.push(`${at(where)} — ${resolution.reason}`)
        })) {
          if (declared.property === null) absorb(carriageFor(node), everything())
          else {
            narrowProperties.add(declared.property)
            carriageFor(node).members.add(declared.property.name)
          }
          record(node, declared.contract, declared.propName)
        }
      }
      ts.forEachChild(node, seed)
    }
    seed(source)
  }

  // `this.ports` on a parameter property resolves through the property name, so ask
  // for the symbol there rather than at the access expression. An *imported* binding
  // resolves to its own import specifier, so it has to be followed to the declaration
  // it aliases — otherwise a capability parked in one module's state and asserted in
  // another reads as carrying nothing, and the whole-program sweep buys nothing.
  const symbolAt = (node: ts.Node) => {
    const found = ts.isPropertyAccessExpression(node)
      ? targetChecker.getSymbolAtLocation(node.name)
      : targetChecker.getSymbolAtLocation(node)
    return found && found.flags & ts.SymbolFlags.Alias ? targetChecker.getAliasedSymbol(found) : found
  }

  const carriageAtDeclarations = (declarations: readonly ts.Declaration[] | undefined): Carriage | null => {
    for (const declaration of declarations ?? []) {
      const found = carriage.get(declaration)
      if (found) return found
    }
    return null
  }

  const declaredCarriage = (node: ts.Node): Carriage | null => carriageAtDeclarations(symbolAt(node)?.declarations)

  /**
   * `{ ports }` binds its own property symbol to that identifier, so the value it
   * copies has to be asked for separately — otherwise the shorthand form reads as
   * carrying nothing while `{ ports: ports }` beside it reads correctly.
   */
  const shorthandValueCarriage = (property: ts.ShorthandPropertyAssignment): Carriage =>
    carriageAtDeclarations(targetChecker.getShorthandAssignmentValueSymbol(property)?.declarations) ?? nothing()

  /** What an expression carries. Never mutated by callers; stored carriages are shared. */
  function carriageOf(expression: ts.Node): Carriage {
    const declared = declaredCarriage(expression)
    if (declared) return declared

    if (ts.isPropertyAccessExpression(expression)) {
      const property = targetChecker.getSymbolAtLocation(expression.name)
      if (property && narrowProperties.has(property)) return everything()
      const base = carriageOf(expression.expression)
      return base.whole || base.members.has(expression.name.text) ? everything() : nothing()
    }
    if (ts.isElementAccessExpression(expression)) {
      const base = carriageOf(expression.expression)
      if (base.whole) return everything()
      const key = staticKeyOf(expression.argumentExpression)
      const hit = key === null ? base.members.size > 0 : base.members.has(key)
      return hit ? everything() : nothing()
    }
    if (ts.isObjectLiteralExpression(expression)) {
      const result = nothing()
      for (const property of expression.properties) {
        if (ts.isSpreadAssignment(property)) {
          // A spread cannot be attributed to a key without knowing the source shape.
          if (carries(carriageOf(property.expression))) result.whole = true
        } else if (ts.isPropertyAssignment(property)) {
          if (!carries(carriageOf(property.initializer))) continue
          const key = staticKeyOf(property.name)
          if (key === null) result.whole = true
          else result.members.add(key)
        } else if (ts.isShorthandPropertyAssignment(property)) {
          if (carries(shorthandValueCarriage(property))) result.members.add(property.name.text)
        }
        // Methods, getters and setters close over their scope across a call boundary
        // this file does not follow; see the header.
      }
      return result
    }
    if (ts.isArrayLiteralExpression(expression)) {
      for (const element of expression.elements) {
        const value = ts.isSpreadElement(element) ? element.expression : element
        if (carries(carriageOf(value))) return everything()
      }
      return nothing()
    }
    if (ts.isConditionalExpression(expression)) {
      const result = nothing()
      absorb(result, carriageOf(expression.whenTrue))
      absorb(result, carriageOf(expression.whenFalse))
      return result
    }
    if (ts.isBinaryExpression(expression)) {
      const operator = expression.operatorToken.kind
      if (operator === ts.SyntaxKind.EqualsToken || operator === ts.SyntaxKind.CommaToken) {
        return carriageOf(expression.right)
      }
      // `a ??= b` yields either operand exactly as `a ?? b` does, so the three
      // logical assignments join here beside the operators they are built from.
      if (
        operator === ts.SyntaxKind.QuestionQuestionToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.AmpersandAmpersandToken ||
        CARRYING_ASSIGNMENTS.has(operator)
      ) {
        const result = nothing()
        absorb(result, carriageOf(expression.left))
        absorb(result, carriageOf(expression.right))
        return result
      }
      return nothing()
    }
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      // `await x` on a non-thenable yields x itself, so it is a read like the others.
      ts.isAwaitExpression(expression) ||
      isTypeErasure(expression)
    ) {
      return carriageOf(expression.expression)
    }
    return nothing()
  }

  /** Distributes what a value carries over the names one binding pattern introduces. */
  function bindPattern(name: ts.BindingName, owner: ts.Declaration, value: Carriage): boolean {
    if (ts.isIdentifier(name)) return absorb(carriageFor(owner), value)

    if (ts.isObjectBindingPattern(name)) {
      let grew = false
      const claimed = new Set<string>()
      for (const element of name.elements) {
        if (element.dotDotDotToken) continue
        const key = staticKeyOf(element.propertyName ?? element.name)
        if (key !== null) claimed.add(key)
        // A named key inherits only what that key carries; a computed one cannot be
        // attributed, so it inherits everything the source carries.
        const inherited = value.whole || key === null ? value : value.members.has(key) ? everything() : nothing()
        if (carries(inherited)) grew = bindPattern(element.name, element, everything()) || grew
      }
      for (const element of name.elements) {
        if (!element.dotDotDotToken) continue
        const rest = nothing()
        if (value.whole) rest.whole = true
        else for (const key of value.members) if (!claimed.has(key)) rest.members.add(key)
        if (carries(rest)) grew = bindPattern(element.name, element, rest) || grew
      }
      return grew
    }

    // Array patterns are index-blind, matching how array literals are read above.
    let grew = false
    if (!carries(value)) return grew
    for (const element of name.elements) {
      if (ts.isOmittedExpression(element)) continue
      grew = bindPattern(element.name, element, everything()) || grew
    }
    return grew
  }

  /**
   * `({ a } = …)` binds the object literal's *own* property symbol to that identifier
   * on the writing side just as it does on the reading side, so the variable actually
   * being assigned has to be asked for separately. Without this the named form
   * `({ p: a } = …)` closes while the shorthand beside it stays open.
   */
  function assignToShorthand(property: ts.ShorthandPropertyAssignment): boolean {
    let grew = false
    for (const declaration of targetChecker.getShorthandAssignmentValueSymbol(property)?.declarations ?? []) {
      grew = absorb(carriageFor(declaration), everything()) || grew
    }
    return grew
  }

  /** Whether an assignment target can ultimately store carriage on a declaration. */
  function hasAssignmentAnchor(target: ts.Expression): boolean {
    if (
      ts.isParenthesizedExpression(target) ||
      ts.isNonNullExpression(target) ||
      ts.isSatisfiesExpression(target) ||
      isTypeErasure(target)
    ) {
      return hasAssignmentAnchor(target.expression)
    }
    if (ts.isElementAccessExpression(target)) return hasAssignmentAnchor(target.expression)
    if (ts.isPropertyAccessExpression(target)) {
      if ((symbolAt(target)?.declarations?.length ?? 0) > 0) return true
      return hasAssignmentAnchor(target.expression)
    }
    return (symbolAt(target)?.declarations?.length ?? 0) > 0
  }

  /**
   * Distributes what a value carries over an *assignment* target.
   *
   * `({ a } = …)` and `[a] = …` mean what the binding patterns above mean, but they
   * are object- and array-*literal* nodes rather than patterns, so they arrive here
   * and not at `bindPattern`. Reading only `symbolAt(left)` is what let all three of
   * `arr[0] = ports`, `({ a } = { a: ports })` and `[a] = [ports]` through.
   */
  function assign(target: ts.Expression, value: Carriage): boolean {
    let grew = false
    if (!carries(value)) return grew
    if (
      ts.isParenthesizedExpression(target) ||
      ts.isNonNullExpression(target) ||
      ts.isSatisfiesExpression(target) ||
      isTypeErasure(target)
    ) {
      return assign(target.expression, value)
    }

    if (ts.isObjectLiteralExpression(target)) {
      const claimed = new Set<string>()
      for (const property of target.properties) {
        if (ts.isSpreadAssignment(property)) continue
        const key = staticKeyOf(property.name)
        if (key !== null) claimed.add(key)
        // A named key inherits only what that key carries; one that cannot be named
        // inherits everything the source carries.
        const supplied = value.whole || key === null ? value : value.members.has(key) ? everything() : nothing()
        if (!carries(supplied)) continue
        if (ts.isPropertyAssignment(property)) grew = assign(property.initializer, everything()) || grew
        else if (ts.isShorthandPropertyAssignment(property)) grew = assignToShorthand(property) || grew
      }
      for (const property of target.properties) {
        if (!ts.isSpreadAssignment(property)) continue
        const rest = nothing()
        if (value.whole) rest.whole = true
        else for (const key of value.members) if (!claimed.has(key)) rest.members.add(key)
        if (carries(rest)) grew = assign(property.expression, rest) || grew
      }
      return grew
    }

    // Index-blind, matching the array literal and array pattern above.
    if (ts.isArrayLiteralExpression(target)) {
      for (const element of target.elements) {
        if (ts.isOmittedExpression(element)) continue
        grew = assign(ts.isSpreadElement(element) ? element.expression : element, everything()) || grew
      }
      return grew
    }

    // `arr[0] = ports`. A slot has no declaration of its own to hang a carriage on,
    // so the write lands on the container — and on the *whole* container, not the
    // written key. That is deliberate: element reads are already index-blind, so
    // attributing a write to `0` would make `arr[1]` and `arr[i]` disagree about the
    // same array. Precise element flow is not attempted; the container widens
    // instead, which is wrong only in the direction of a failing test. `w['k'] = ports`
    // therefore taints `w.other` as well.
    if (ts.isElementAccessExpression(target)) return assign(target.expression, everything())

    if (ts.isPropertyAccessExpression(target)) {
      const declarations = symbolAt(target)?.declarations ?? []
      if (declarations.length > 0) {
        for (const declaration of declarations) grew = absorb(carriageFor(declaration), value) || grew
        return grew
      }

      // An index signature, `any`, or another symbol-less dotted property has no
      // declaration on which to store provenance. Widen its receiver just as an
      // element-access write does. If even the receiver has no declaration (for
      // example `makeRegistry().slot = ports`), fail closed instead of silently
      // dropping the write.
      if (hasAssignmentAnchor(target.expression)) return assign(target.expression, everything())
      const message = `${at(target)} — a symbol-less dotted property write carries narrow ports through a receiver this sweep cannot anchor`
      if (!unnameable.includes(message)) unnameable.push(message)
      return grew
    }

    // An identifier — declared property accesses returned above.
    for (const declaration of symbolAt(target)?.declarations ?? []) {
      grew = absorb(carriageFor(declaration), value) || grew
    }
    return grew
  }

  function findings(): readonly BodyFinding[] {
    for (let growing = true; growing; ) {
      growing = false
      for (const source of sources) {
        const visit = (node: ts.Node) => {
          if (ts.isVariableDeclaration(node) && node.initializer) {
            const value = carriageOf(node.initializer)
            if (carries(value)) growing = bindPattern(node.name, node, value) || growing
          } else if (ts.isForOfStatement(node) && ts.isVariableDeclarationList(node.initializer)) {
            // A loop binding has no initializer of its own, so it is neither seeded
            // nor reached by the arm above. Index-blind, like the array literal it
            // usually iterates.
            if (carries(carriageOf(node.expression))) {
              for (const declaration of node.initializer.declarations) {
                growing = bindPattern(declaration.name, declaration, everything()) || growing
              }
            }
          } else if (ts.isPropertyDeclaration(node) && node.initializer) {
            // `class C { readonly copy = ports }` declared inside a consumer, which
            // survived on the parent commit. Copying a *parameter property* the same
            // way — `readonly copy = this.ports` in StudyParentController — is not
            // the same hole: TS2729 rejects it, so the compiler already closes it.
            const value = carriageOf(node.initializer)
            if (carries(value)) growing = absorb(carriageFor(node), value) || growing
          } else if (ts.isShorthandPropertyAssignment(node) && node.objectAssignmentInitializer) {
            // `({ a = ports } = source)`. The default is reached whether or not
            // `source` carries, so it is not routed through the distribution below.
            const value = carriageOf(node.objectAssignmentInitializer)
            if (carries(value)) growing = assignToShorthand(node) || growing
          } else if ((ts.isBindingElement(node) || ts.isParameter(node)) && node.initializer) {
            // A default: `const { a = ports } = holder`, `const [a = ports] = list`,
            // `(a = ports) => …`. The value never passes through the thing being
            // destructured, so neither the arm above nor `bindPattern` reaches it.
            const value = carriageOf(node.initializer)
            if (carries(value)) growing = bindPattern(node.name, node, value) || growing
          } else if (ts.isBinaryExpression(node) && CARRYING_ASSIGNMENTS.has(node.operatorToken.kind)) {
            const value = carriageOf(node.right)
            if (carries(value)) growing = assign(node.left, value) || growing
          }
          ts.forEachChild(node, visit)
        }
        visit(source)
      }
    }

    const found: BodyFinding[] = []
    for (const source of sources) {
      const visit = (node: ts.Node) => {
        if (isTypeErasure(node) && carries(carriageOf(node.expression))) {
          found.push({
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            message: `${at(node)} — the ports handed to ${underSource(source.fileName)} are asserted to \`${textOf(node.type)}\``,
          })
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    return found
  }

  return { roots, unnameable, findings }
}

// ── the consumers, discovered from typed use ──────────────────────────────────
// Add a seventh surface that takes StudyDashboardPorts — as a parameter or as a prop
// on one — and it appears here on the next run; take the narrow type off an existing
// one and it disappears. Either way the reviewed snapshot stops matching.

/** The intentionally rejected alternative: scan only modules that declare roots. */
function consumerModuleFiles(target: ts.Program, files: readonly string[]): readonly string[] {
  const modules = new Set(capabilityScope(target, files).roots.map((root) => posix(root.declaration.getSourceFile().fileName)))
  return files.filter((file) => modules.has(posix(file)))
}

/** One seam shared by production and the cross-module fixture, so the file-set claim is forceable. */
function wholeProgramCapabilityScope(target: ts.Program, files: readonly string[]) {
  return capabilityScope(target, files)
}

const productionScope = wholeProgramCapabilityScope(program, productionFiles)
const portsRoots = productionScope.roots
unmodelled.push(...productionScope.unnameable)

const describeConsumer = (consumer: Consumer) =>
  `${consumer.module} | ${consumer.exportName} | ${consumer.contract} | ${consumer.propName ?? '(positional)'}`
const consumerKey = (consumer: Consumer) => `${describeConsumer(consumer)} | parameter:${consumer.parameterIndex}`

const consumerReport = [...new Set(portsRoots.map((root) => describeConsumer(root.consumer)))].sort()

/**
 * One entry per distinct contract *and* carrying prop, not one per module. A surface
 * whose props object declared two different narrow contracts would appear twice and
 * be swept twice, rather than the second one being dropped by a dedupe.
 */
const consumersOf = (roots: readonly PortsRoot[]): readonly Consumer[] => [
  ...new Map(roots.map((root) => [consumerKey(root.consumer), root.consumer])).values(),
]

const CONSUMERS = consumersOf(portsRoots)

/**
 * What every module in a file set declares, keyed as `contract | prop`, read straight
 * from the checker by the *same* rule the seeding pass uses.
 *
 * Sharing `narrowContractsAt` is the point. This check exists to catch a declaration
 * the reported consumer set has lost — the dedupe above is the lossy step — and a
 * second, weaker walk here would instead reject the props-object form the seeding
 * pass supports, which is how the predecessor left that form discovered but
 * unadoptable.
 */
function declarationsByModule(target: ts.Program, files: readonly string[]): Map<string, Set<string>> {
  const { checker: targetChecker, narrowContractOf: narrowOf } = contractsOf(target)
  const byModule = new Map<string, Set<string>>()
  for (const fileName of files) {
    const source = target.getSourceFile(fileName)
    if (!source) continue
    const module = underSource(fileName)
    const visit = (node: ts.Node) => {
      if ((ts.isParameter(node) || ts.isBindingElement(node)) && parameterOf(node)) {
        for (const declared of narrowContractsAt(targetChecker, narrowOf, node)) {
          const found = byModule.get(module) ?? new Set<string>()
          found.add(`${declared.contract} | ${declared.propName ?? '(positional)'}`)
          byModule.set(module, found)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return byModule
}

/** Per module: what the reported consumers claim, beside what the checker declares. */
function bindingReport(target: ts.Program, files: readonly string[]) {
  const claimed = new Map<string, Set<string>>()
  for (const consumer of consumersOf(capabilityScope(target, files).roots)) {
    const found = claimed.get(consumer.module) ?? new Set<string>()
    found.add(`${consumer.contract} | ${consumer.propName ?? '(positional)'}`)
    claimed.set(consumer.module, found)
  }
  const declared = declarationsByModule(target, files)
  const modules = [...new Set([...claimed.keys(), ...declared.keys()])].sort()
  const render = (source: Map<string, Set<string>>) =>
    modules.map((module) => `${module} -> ${[...(source.get(module) ?? [])].sort().join(', ') || 'no narrow contract'}`)
  return { claimed: render(claimed), declared: render(declared) }
}

/**
 * The reviewed consumers. Like REVIEWED_CENSUS this is a record of what a human has
 * read, never an input: every sweep below runs off the discovered set above, so
 * deleting a line here cannot shrink what is checked — it can only fail this file.
 */
const REVIEWED_CONSUMERS = [
  'components/hub/StudyParentPanel.tsx | StudyParentPanel | StudyParentControlPorts | ports',
  'components/study/StudyDashboard.tsx | StudyDashboard | StudyDashboardPorts | ports',
  'components/study/StudySettings.tsx | StudySettings | StudySettingsPorts | ports',
  'study/parentController.ts | StudyParentController | StudyParentControlPorts | (positional)',
  'study/ports.ts | assertCompleteProductionStudySessionPorts | ProductionStudySessionPorts | (positional)',
  'study/production/tutorLaunchOrdering.ts | prepareDurableStudySession | ProductionStudySessionPorts | ports',
]

// ── every reference to a discovered consumer ──────────────────────────────────
// The census is blind in one direction: it finds expressions the checker already
// types as a narrow contract. If a consumer is rendered in a form that hides its
// ports expression — spread props, a namespace import, a computed module specifier
// — there is no expression to type, and silence would read as safety. So the
// discovered consumers are also swept from the other end: every reference to them
// is found from their module path and must land on a census entry.

const consumersByPath = new Map<string, Consumer[]>()
for (const consumer of CONSUMERS) {
  const path = posix(join(sourceRoot, consumer.module))
  consumersByPath.set(path, [...(consumersByPath.get(path) ?? []), consumer])
}

function consumersFor(fromFile: string, specifier: string): readonly Consumer[] {
  if (!specifier.startsWith('.')) return []
  const base = resolve(dirname(fromFile), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    const found = consumersByPath.get(posix(candidate))
    if (found) return found
  }
  return []
}

const bindings: { consumer: Consumer; name: ts.Identifier }[] = []

function collectStaticBinding(declaration: ts.ImportDeclaration, consumer: Consumer) {
  const clause = declaration.importClause
  // A bare `import './X'` binds no value and so cannot inject anything.
  if (!clause || clause.isTypeOnly) return
  if (clause.name) {
    unmodelled.push(`${at(clause.name)} — default import of the ${consumer.exportName} module`)
    return
  }
  const named = clause.namedBindings
  if (!named) return
  if (ts.isNamespaceImport(named)) {
    unmodelled.push(`${at(named)} — namespace import of the ${consumer.exportName} module`)
    return
  }
  for (const specifier of named.elements) {
    if (specifier.isTypeOnly) continue
    if ((specifier.propertyName ?? specifier.name).text === consumer.exportName) {
      bindings.push({ consumer, name: specifier.name })
    }
  }
}

function collectDynamicBinding(call: ts.CallExpression, consumer: Consumer) {
  let node: ts.Node = call
  while (!ts.isVariableDeclaration(node) && node.parent) node = node.parent
  if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) {
    unmodelled.push(`${at(call)} — dynamic import of the ${consumer.exportName} module is not bound to a named constant`)
    return
  }
  // Which export the binding carries: the lazy wrapper names it as a property.
  let namesTheExport = false
  const scan = (child: ts.Node) => {
    if (ts.isPropertyAccessExpression(child) && child.name.text === consumer.exportName) namesTheExport = true
    ts.forEachChild(child, scan)
  }
  if (node.initializer) scan(node.initializer)
  if (!namesTheExport) {
    unmodelled.push(`${at(call)} — dynamic import of the ${consumer.exportName} module never names that export`)
    return
  }
  bindings.push({ consumer, name: node.name })
}

for (const fileName of productionFiles) {
  const source = program.getSourceFile(fileName)
  if (!source) continue
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      for (const consumer of consumersFor(fileName, node.moduleSpecifier.text)) collectStaticBinding(node, consumer)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      for (const consumer of consumersFor(fileName, node.moduleSpecifier.text)) {
        unmodelled.push(`${at(node)} — re-export of the ${consumer.exportName} module opens a second import path`)
      }
    } else if (ts.isCallExpression(node)) {
      const specifier = node.arguments[0]
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if (isDynamicImport && (!specifier || !ts.isStringLiteral(specifier))) {
        unmodelled.push(`${at(node)} — dynamic import with a computed specifier could reach any module`)
      } else if ((isDynamicImport || isRequire) && specifier && ts.isStringLiteral(specifier)) {
        for (const consumer of consumersFor(fileName, specifier.text)) {
          if (isRequire) unmodelled.push(`${at(node)} — require() of the ${consumer.exportName} module`)
          else collectDynamicBinding(node, consumer)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

function portsExpressionInJsx(element: ts.JsxOpeningLikeElement, consumer: Consumer): ts.Expression | null {
  const properties = element.attributes.properties
  const spread = properties.find(ts.isJsxSpreadAttribute)
  if (spread) {
    unmodelled.push(`${at(spread)} — ${consumer.exportName} receives spread props, which hide the ports expression`)
    return null
  }
  // The prop to open is the one discovery found the contract on — not a name this
  // file chooses. A positional consumer rendered as an element has no such prop.
  if (consumer.propName === null) {
    unmodelled.push(`${at(element)} — ${consumer.exportName} takes its ${consumer.contract} positionally but is rendered as an element`)
    return null
  }
  const attribute = properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && textOf(property.name) === consumer.propName,
  )
  if (!attribute) {
    unmodelled.push(`${at(element)} — ${consumer.exportName} is rendered without an explicit ${consumer.propName} prop`)
    return null
  }
  const initializer = attribute.initializer
  if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) {
    unmodelled.push(`${at(attribute)} — the ${consumer.propName} prop on ${consumer.exportName} is not a braced expression`)
    return null
  }
  return initializer.expression
}

/** The ports expression inside a call or construction argument. */
function portsExpressionInArgument(argument: ts.Expression, consumer: Consumer): ts.Expression | null {
  if (consumer.propName === null) return argument
  if (!ts.isObjectLiteralExpression(argument)) {
    unmodelled.push(`${at(argument)} — ${consumer.exportName} is given a props object this sweep cannot open`)
    return null
  }
  for (const property of argument.properties) {
    if (ts.isSpreadAssignment(property)) {
      unmodelled.push(`${at(property)} — ${consumer.exportName} receives spread props, which hide the ports expression`)
      return null
    }
    if (staticKeyOf(property.name ?? property) !== consumer.propName) continue
    if (ts.isPropertyAssignment(property)) return property.initializer
    if (ts.isShorthandPropertyAssignment(property)) return property.name
  }
  unmodelled.push(`${at(argument)} — ${consumer.exportName} is constructed without an explicit ${consumer.propName} prop`)
  return null
}

function portsExpressionAt(reference: ts.Identifier, consumer: Consumer): ts.Expression | null {
  const parent = reference.parent
  if ((ts.isJsxOpeningElement(parent) || ts.isJsxSelfClosingElement(parent)) && parent.tagName === reference) {
    if (consumer.parameterIndex !== 0) {
      unmodelled.push(`${at(parent)} — ${consumer.exportName} declares ports outside its JSX props parameter`)
      return null
    }
    return portsExpressionInJsx(parent, consumer)
  }
  if (
    (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
    parent.expression === reference
  ) {
    const argument = parent.arguments?.[consumer.parameterIndex]
    if (!argument) {
      unmodelled.push(`${at(parent)} — ${consumer.exportName} supplies no argument at its guarded parameter`)
      return null
    }
    return portsExpressionInArgument(argument, consumer)
  }
  // `!StudyDashboard` is the availability test the lazy bindings need. It reads the
  // binding without passing anything to it, so it cannot inject ports.
  if (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken) return null
  unmodelled.push(
    `${at(reference)} — ${consumer.exportName} is used as ${ts.SyntaxKind[parent.kind]}, a form this sweep does not model`,
  )
  return null
}

const referencesOutsideCensus: string[] = []
for (const binding of bindings) {
  const symbol = checker.getSymbolAtLocation(binding.name)
  const source = binding.name.getSourceFile()
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node !== binding.name && checker.getSymbolAtLocation(node) === symbol) {
      const expression = portsExpressionAt(node, binding.consumer)
      if (expression && !censusExpressions.has(expression)) {
        referencesOutsideCensus.push(
          `${at(expression)} — ports supplied to ${binding.consumer.exportName} are not typed as ${binding.consumer.contract}`,
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

// ── assertions at the injection sites ─────────────────────────────────────────
// The whole subtree, not the top-level node, so `{ ...ports } as any` and
// `(identity(ports) as Bundle)` expose their assertion. When the site is a bare
// identifier the alias it names is followed to its initializer in the same file,
// so `const p = bundle as any` one line above the render is not a way round this.

function assertionsWithin(expression: ts.Expression, describe: (node: TypeErasure) => string): readonly string[] {
  const found: string[] = []
  const seen = new Set<ts.Node>()
  const walk = (root: ts.Node) => {
    if (seen.has(root)) return
    seen.add(root)
    const visit = (node: ts.Node) => {
      if (isTypeErasure(node)) found.push(describe(node))
      // A bare alias: follow it to the initializer it was declared with. Bounded to
      // same-file variable declarations, which is the alias form F1 exploited.
      if (ts.isIdentifier(node)) {
        for (const declaration of checker.getSymbolAtLocation(node)?.declarations ?? []) {
          if (ts.isVariableDeclaration(declaration) && declaration.initializer) walk(declaration.initializer)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(root)
  }
  walk(expression)
  return found
}

const assertionsAtInjectionSites = census.flatMap((site) =>
  assertionsWithin(site.expression, (node) => `${at(node)} — ${site.contract} injection asserts to \`${textOf(node.type)}\``),
)

// ── assertions inside the consumer bodies ─────────────────────────────────────

// The whole production program, not just the consumer modules. Roots are only seeded
// where a narrow contract is declared, so widening the file set costs nothing in
// precision — and it closes the one place a capability could be parked in module
// state by a consumer and asserted from a file that is not itself a consumer.
const consumerBodyEscapes = productionScope.findings().map((finding) => finding.message)

// ── the provenance tracker, proven against a fixture ──────────────────────────
// Production consumers wrap nothing today, so nothing above would notice if the
// tracker stopped working. These cases run through `capabilityScope` — the same
// function, not a copy — over a synthetic module compiled against the real ports
// contracts. Four of them are the documented boundary: what this file does not
// claim to catch.

/** The parameter list a case is compiled against, and what discovery must find on it. */
const SHAPES = {
  positional: {
    params: '(ports: StudyParentControlPorts, spare: unknown)',
    discovers: ['(positional) | StudyParentControlPorts'],
  },
  props: {
    params: '(props: { ports: StudyParentControlPorts; other: { safety: unknown } }, spare: unknown)',
    discovers: ['ports | StudyParentControlPorts'],
  },
  twoContracts: {
    params: '(props: { dash: StudyDashboardPorts; parent: StudyParentControlPorts }, spare: unknown)',
    discovers: ['dash | StudyDashboardPorts', 'parent | StudyParentControlPorts'],
  },
  destructuredProjection: {
    params:
      "({ calendar: projectedCalendar }: { calendar: ProductionStudySessionPorts['calendar'] }, spare: unknown)",
    discovers: ['calendar | ProductionStudySessionPorts'],
  },
} as const

type ShapeName = keyof typeof SHAPES

interface ProvenanceCase {
  readonly id: string
  readonly shape?: ShapeName
  readonly body: string
  readonly escapes: boolean
  /** The write must fail closed because no stable receiver declaration exists. */
  readonly unmodelled?: boolean
  /** Roots this case declares beyond its own signature, as `owner | prop | contract`. */
  readonly alsoDiscovers?: readonly string[]
  /** Census entries this case must produce, as `contract | text`. */
  readonly supplies?: readonly string[]
  /** Its call/property hand-off must be rejected before it can become a census site. */
  readonly unsafeHandoff?: boolean
}

const PROVENANCE_CASES: readonly ProvenanceCase[] = [
  // Bindings — the F1 class, carried over.
  { id: 'direct alias', body: 'const a = ports; void (a as any).adultPrivate', escapes: true },
  { id: 'alias of alias', body: 'const a = ports; const b = a; void (b as any).outbox', escapes: true },
  { id: 'property alias', body: 'const a = ports.calendar; void (a as any).start', escapes: true },
  { id: 'named destructuring', body: 'const { calendar } = ports; void (calendar as any).resume', escapes: true },
  { id: 'rest destructuring', body: 'const { ...rest } = ports; void (rest as any).adultPrivate', escapes: true },
  { id: 'object spread', body: 'const a = { ...ports }; void (a as any).safety', escapes: true },
  { id: 'let binding', body: 'let a = ports; void (a as any).safety', escapes: true },
  { id: 'assignment after declaration', body: 'let a: unknown; a = ports; void (a as any)', escapes: true },
  { id: 'still tainted after reassignment', body: 'let a: unknown = ports; a = spare; void (a as any)', escapes: true },
  // Copied before its source is assigned. Flow-insensitively `a` carries, so `b`
  // does too — and reaching that verdict needs a second pass over the file, which
  // is the fixed point earning its keep rather than a one-shot walk.
  { id: 'copied before the source is assigned', body: 'let a: unknown = spare; let b: unknown = a; a = ports; void (b as any)', escapes: true },

  // Object literal provenance — the G1 class.
  { id: 'shorthand property', body: 'const w = { ports }; void (w.ports as any).safety', escapes: true },
  { id: 'named property', body: 'const w = { inner: ports }; void (w.inner as any).safety', escapes: true },
  { id: 'property of a role', body: 'const w = { p: ports.calendar }; void (w.p as any).start', escapes: true },
  { id: 'shorthand of an alias', body: 'const source = ports; const w = { source }; void (w.source as any).safety', escapes: true },
  { id: 'nested object literal', body: 'const w = { inner: { ports } }; void (w.inner.ports as any).safety', escapes: true },
  { id: 'string-key read', body: 'const w = { ports }; void (w["ports"] as any).safety', escapes: true },
  { id: 'wrapper asserted whole', body: 'const w = { ports }; void (w as any).ports.safety', escapes: true },
  { id: 'sibling key of a wrapper stays free', body: 'const w = { ports, other: spare }; void (w.other as any); void ports.outbox', escapes: false },
  {
    id: 'computed-key object literal widens whole',
    body: 'const key = String(spare); const w = { [key]: ports, clean: spare }; void (w.clean as any).safety',
    escapes: true,
  },

  // Array literal provenance.
  { id: 'array element', body: 'const w = [ports]; void (w[0] as any).safety', escapes: true },
  { id: 'array of a role', body: 'const w = [ports.calendar]; void (w[0] as any).start', escapes: true },
  { id: 'array of an alias', body: 'const a = ports; const w = [a]; void (w[0] as any).safety', escapes: true },
  { id: 'array spread', body: 'const w = [...[ports]]; void (w[0] as any).safety', escapes: true },
  { id: 'array read at a computed index', body: 'const w = [ports]; void (w[Number("0")] as any).safety', escapes: true },
  // An *object* read at a key this analysis cannot name. The array cases above all
  // reach `whole` first, so only this one forces the index-blind arm for members.
  {
    id: 'object read at a computed key',
    body: 'const w: Record<string, unknown> = { ports }; void (w[String("x")] as any).safety',
    escapes: true,
  },
  {
    id: 'clean object read at a computed key stays free',
    body: 'const w: Record<string, unknown> = { safety: spare }; void (w[String("x")] as any); void ports.outbox',
    escapes: false,
  },
  { id: 'array destructuring', body: 'const w = [ports]; const [first] = w; void (first as any).safety', escapes: true },

  // Loop and class-field bindings, and the read forms in between.
  { id: 'for-of binding', body: 'for (const a of [ports]) void (a as any).safety', escapes: true },
  {
    id: 'class field copy',
    body: 'class Wrapper { readonly leaked = ports; read() { void (this.leaked as any).safety } } void Wrapper',
    escapes: true,
  },
  {
    id: 'class parameter property',
    body: 'class ParamProps { constructor(private readonly q: StudyParentControlPorts) {} read() { void (this.q as any).safety } } void ParamProps',
    escapes: true,
    alsoDiscovers: ['ParamProps | (positional) | StudyParentControlPorts'],
  },
  { id: 'parenthesised read', body: 'const a = ports; void ((a) as any).safety', escapes: true },
  { id: 'non-null read', body: 'const w = { ports }; void (w.ports! as any).safety', escapes: true },
  { id: 'satisfies read', body: 'const a = ports satisfies StudyParentControlPorts; void (a as any).safety', escapes: true },
  { id: 'comma operator', body: 'void ((String(spare), ports) as any).safety', escapes: true },
  // Awaiting a non-thenable yields it unchanged, so `await` is a read, not a boundary.
  { id: 'awaited read', body: 'const inner = async () => { const a = await ports; void (a as any).safety }; void inner', escapes: true },

  // Assignment targets that wear a literal's syntax — the H4-R F3 class.
  { id: 'indexed assignment', body: 'const arr: unknown[] = [spare]; arr[0] = ports; void (arr[0] as any).safety', escapes: true },
  {
    id: 'indexed assignment of a role, read at another index',
    // The container widens whole, so an index the write never touched still reports.
    body: 'const arr: unknown[] = [spare]; arr[1] = ports.calendar; void (arr[0] as any).start',
    escapes: true,
  },
  { id: 'keyed assignment onto an object', body: 'const w: Record<string, unknown> = {}; w["k"] = ports; void (w["other"] as any).safety', escapes: true },
  { id: 'symbol-less dotted assignment', body: 'const w: Record<string, unknown> = {}; w.k = ports; void (w.k as any).safety', escapes: true },
  { id: 'symbol-less dotted nullish assignment', body: 'const w: Record<string, unknown> = {}; w.k ??= ports; void (w.k as any).safety', escapes: true },
  { id: 'symbol-less dotted logical-or assignment', body: 'const w: Record<string, unknown> = {}; w.k ||= ports; void (w.k as any).safety', escapes: true },
  { id: 'symbol-less dotted logical-and assignment', body: 'const w: Record<string, unknown> = { k: spare }; w.k &&= ports; void (w.k as any).safety', escapes: true },
  { id: 'declared dotted property assignment', body: 'const w: { k?: unknown } = {}; w.k = ports; void (w.k as any).safety', escapes: true },
  {
    id: 'global symbol-less dotted assignment',
    body: '(globalThis as any).leakedPorts = ports; void ((globalThis as any).leakedPorts as any).safety',
    escapes: false,
    unmodelled: true,
  },
  {
    id: 'unanchored symbol-less dotted assignment fails closed',
    body: 'const make = (): Record<string, unknown> => ({}); make().k = ports',
    escapes: false,
    unmodelled: true,
  },
  { id: 'object destructuring assignment', body: 'let a: unknown; ({ a } = { a: ports }); void (a as any).safety', escapes: true },
  { id: 'renamed object destructuring assignment', body: 'let a: unknown; ({ p: a } = { p: ports }); void (a as any).safety', escapes: true },
  { id: 'rest of an object destructuring assignment', body: 'let rest: Record<string, unknown>; ({ ...rest } = { p: ports }); void (rest as any).safety', escapes: true },
  { id: 'default in an object destructuring assignment', body: 'let a: unknown; ({ a = ports } = {} as { a?: unknown }); void (a as any).safety', escapes: true },
  { id: 'array destructuring assignment', body: 'let a: unknown; [a] = [ports]; void (a as any).safety', escapes: true },
  { id: 'array destructuring assignment then alias', body: 'let a: unknown; let b: unknown; [a] = [ports]; b = a; void (b as any).safety', escapes: true },
  { id: 'rest of an array destructuring assignment', body: 'let rest: unknown[]; [...rest] = [ports]; void (rest[0] as any).safety', escapes: true },

  // Defaults. The value never passes through the thing being destructured.
  {
    id: 'object binding default initializer',
    body: 'const holder: { a?: StudyParentControlPorts } = {}; const { a = ports } = holder; void (a as any).safety',
    escapes: true,
  },
  {
    id: 'array binding default initializer',
    body: 'const list: (StudyParentControlPorts | undefined)[] = []; const [a = ports] = list; void (a as any).safety',
    escapes: true,
    // The declared array is now an explicitly unsupported capability wrapper, so
    // its empty initializer fails closed before the provenance assertion also fires.
    unsafeHandoff: true,
  },
  { id: 'parameter default initializer', body: 'const inner = (a: unknown = ports) => (a as any).safety; void inner', escapes: true },

  // Logical assignment: the joins below with a store attached.
  { id: 'nullish assignment', body: 'let a: unknown; a ??= ports; void (a as any).safety', escapes: true },
  { id: 'logical-or assignment', body: 'let a: unknown; a ||= ports; void (a as any).safety', escapes: true },
  { id: 'logical-and assignment', body: 'let a: unknown = spare; a &&= ports; void (a as any).safety', escapes: true },
  { id: 'value of a logical assignment', body: 'let a: unknown; void ((a ??= ports) as any).safety', escapes: true },

  // Joins.
  { id: 'conditional join', body: 'const a = spare ? ports : ports.calendar; void (a as any).safety', escapes: true },
  // One arm at a time, so removing either side of the join fails on its own case.
  { id: 'conditional false arm only', body: 'const a = spare ? spare : ports; void (a as any).safety', escapes: true },
  { id: 'conditional true arm only', body: 'const a = spare ? ports : spare; void (a as any).safety', escapes: true },
  {
    id: 'nullish join',
    body: 'const maybe: StudyParentControlPorts | undefined = ports; const a = maybe ?? spare; void (a as any)',
    escapes: true,
    // The declared constant is a hand-over in its own right, and the census sees it
    // through a union constituent.
    supplies: ['StudyParentControlPorts | ports'],
  },
  {
    id: 'logical-or join',
    body: 'const maybe: StudyParentControlPorts | undefined = ports; const a = maybe || spare; void (a as any)',
    escapes: true,
    supplies: ['StudyParentControlPorts | ports'],
  },
  { id: 'logical-and join', body: 'const flag = Boolean(spare); const a = flag && ports; void (a as any)', escapes: true },

  // Round-trip destructuring.
  { id: 'destructure back from a wrapper', body: 'const w = { ports }; const { ports: back } = w; void (back as any).safety', escapes: true },
  { id: 'destructure back inline', body: 'const { ports: back } = { ports }; void (back as any).safety', escapes: true },
  { id: 'destructure a nested wrapper', body: 'const w = { inner: { ports } }; const { inner: { ports: back } } = w; void (back as any).safety', escapes: true },
  { id: 'rest of a wrapper keeps the key', body: 'const w = { ports, other: spare }; const { other, ...rest } = w; void (rest as any).ports.safety', escapes: true },

  // Multi-hop: object -> destructure -> alias -> array -> read.
  {
    id: 'four hops',
    body: 'const w = { ports }; const { ports: back } = w; const a = back; const arr = [a]; void (arr[0] as any).safety',
    escapes: true,
  },
  {
    id: 'five hops through a nested wrapper',
    body: 'const w = { inner: { ports } }; const i = w.inner; const { ports: back } = i; const arr = [{ back }]; void (arr[0].back as any).safety',
    escapes: true,
  },

  // Assertion forms over a newly traced value. No target spelling is privileged.
  { id: 'as any', body: 'const w = { ports }; void (w.ports as any).safety', escapes: true },
  { id: 'as unknown as full bundle', body: 'const w = { ports }; void (w.ports as unknown as StudyPortBundle).safety', escapes: true },
  { id: 'as the full bundle', body: 'const w = { ports }; void ((w as any).ports as StudyPortBundle).safety', escapes: true },
  { id: 'as its own narrow type', body: 'const w = { ports }; void (w.ports as StudyParentControlPorts).outbox', escapes: true },
  { id: 'double assertion', body: 'const w = { ports }; void (w.ports as unknown as any).safety', escapes: true },
  {
    id: 'intersection assertion',
    body: 'const w = { ports }; void (w.ports as unknown as StudyParentControlPorts & { safety: unknown }).safety',
    escapes: true,
  },
  { id: 'angle-bracket assertion', body: 'const w = { ports }; void (<any>w.ports).safety', escapes: true },

  // Props-object consumers: discovery seeds `props.<prop>`, not `props`.
  { id: 'props member direct', shape: 'props', body: 'void (props.ports as any).safety', escapes: true },
  { id: 'props member alias', shape: 'props', body: 'const p = props.ports; void (p as any).safety', escapes: true },
  { id: 'props member destructured', shape: 'props', body: 'const { ports } = props; void (ports as any).safety', escapes: true },
  { id: 'props member wrapped', shape: 'props', body: 'const w = { p: props.ports }; void (w.p as any).safety', escapes: true },
  { id: 'props member in an array', shape: 'props', body: 'const w = [props.ports]; void (w[0] as any).safety', escapes: true },
  { id: 'props object asserted whole', shape: 'props', body: 'void (props as any).ports.safety', escapes: true },
  { id: 'unrelated props member stays free', shape: 'props', body: 'void (props.other as any).safety; void props.ports.outbox', escapes: false },
  {
    id: 'unrelated props member destructured stays free',
    shape: 'props',
    body: 'const { other } = props; void (other as any).safety; void props.ports.outbox',
    escapes: false,
  },

  // A property the checker resolved to a narrow contract is a capability wherever it
  // is read, including on a value whose own provenance this file never traced. The
  // call below is the documented boundary, so `make()` carries nothing — but
  // `make().ports` names a property symbol seeding already resolved, and that is what
  // reports it. Nothing else in this fixture reaches that arm.
  {
    id: 'narrow prop read on a value this file did not trace',
    shape: 'props',
    body: 'const make = (): typeof props => props; void (make().ports as any).safety',
    escapes: true,
  },
  {
    id: 'props member multi-hop',
    shape: 'props',
    body: 'const w = { p: props.ports }; const { p } = w; const arr = [p]; void (arr[0] as any).safety',
    escapes: true,
  },

  // The long chain, written in reverse dependency order so each hop needs its own
  // pass: props member -> assignment -> object -> object destructuring assignment ->
  // array -> array destructuring assignment -> conditional false arm -> assertion.
  // Three growth passes, so a fixpoint cut to one — or to two — fails here.
  {
    id: 'eight hops needing three passes',
    shape: 'props',
    body:
      'let seeded: unknown; let wrapped: unknown; let listed: unknown; let joined: unknown; ' +
      '[listed] = [wrapped]; ({ k: wrapped } = { k: seeded }); seeded = props.ports; ' +
      'joined = spare ? spare : listed; void (joined as any).safety',
    escapes: true,
  },

  // Two narrow contracts on one props object: both are seeded, neither is dropped.
  { id: 'first of two contracts', shape: 'twoContracts', body: 'void (props.dash as any).safety', escapes: true },
  { id: 'second of two contracts', shape: 'twoContracts', body: 'void (props.parent as any).safety', escapes: true },
  {
    id: 'destructured indexed projection keeps provenance',
    shape: 'destructuredProjection',
    body: 'void (projectedCalendar as any).createContinuation',
    escapes: true,
  },

  {
    id: 'semantic constrained generic fails closed',
    body:
      'const inner: <T extends ProductionStudySessionPorts>(value: T) => void = (value) => { void (value as any).outbox }; ' +
      'void inner; void ports.outbox',
    escapes: false,
    unmodelled: true,
  },
  {
    id: 'semantic array wrapper fails closed',
    body:
      'const inner: (value: ProductionStudySessionPorts[]) => void = (value) => { void (value as any).outbox }; ' +
      'void inner; void ports.outbox',
    escapes: false,
    unmodelled: true,
  },

  // Hand-overs. `suppliedExpressions` decides what the census can see at all.
  // Production now forces the shorthand arm through durable preparation, while
  // these cases keep every supported form independently visible.
  { id: 'supplied as a call argument', body: 'take(ports)', escapes: false, supplies: ['StudyParentControlPorts | ports'] },
  { id: 'supplied to a constructor', body: 'void new Holder(ports)', escapes: false, supplies: ['StudyParentControlPorts | ports'] },
  { id: 'supplied as a named property', body: 'panel({ ports: ports })', escapes: false, supplies: ['StudyParentControlPorts | ports'] },
  // `panel({ ports })` hands over exactly as much as `panel({ ports: ports })` does,
  // and reaches the census through a different arm.
  { id: 'supplied as a shorthand property', body: 'panel({ ports })', escapes: false, supplies: ['StudyParentControlPorts | ports'] },
  {
    id: 'supplied after an explicit this parameter',
    body: 'takeWithThis(ports)',
    escapes: false,
    supplies: ['StudyParentControlPorts | ports'],
  },
  {
    id: 'supplied to a declared constant',
    body: 'const held: StudyParentControlPorts = ports; void held',
    escapes: false,
    supplies: ['StudyParentControlPorts | ports'],
  },
  {
    id: 'supplied to a declared class field',
    body: 'class Field { readonly held: StudyParentControlPorts = ports } void Field',
    escapes: false,
    supplies: ['StudyParentControlPorts | ports'],
  },
  {
    id: 'union props surfaces fail closed at a call hand-off',
    body:
      "const takeSplit = (value: { ports: ProductionStudySessionPorts['calendar'] } | { ports: ProductionStudySessionPorts['checkpoint'] }) => { void value }; " +
      'takeSplit({ ports: mixedProductionRole }); void ports.outbox',
    escapes: false,
    unmodelled: true,
    unsafeHandoff: true,
  },
  {
    id: 'intersection props surfaces fail closed at a call hand-off',
    body:
      "const takeBoth = (value: { ports: ProductionStudySessionPorts['calendar'] } & { ports: ProductionStudySessionPorts['checkpoint'] }) => { void value }; " +
      'takeBoth({ ports: mixedProductionRole }); void ports.outbox',
    escapes: false,
    unmodelled: true,
    unsafeHandoff: true,
  },
  {
    id: 'props union with an unguarded arm fails closed',
    body:
      "const takeMixed = (value: { ports: ProductionStudySessionPorts['calendar'] } | { ports: { outbox: StudyOutboxPort } }) => { void value }; " +
      'void takeMixed; void ports.outbox',
    escapes: false,
    unmodelled: true,
  },
  {
    id: 'props union with a missing carrying prop and adult arm fails closed',
    body:
      "const takeAdultUnion = (value: { ports: ProductionStudySessionPorts['calendar'] } | { outbox: StudyOutboxPort }) => { if ('outbox' in value) void value.outbox.propose }; " +
      'void takeAdultUnion; void ports.outbox',
    escapes: false,
    unmodelled: true,
  },
  {
    id: 'props intersection with a missing carrying prop and adult arm fails closed',
    body:
      "const takeAdultIntersection = (value: { ports: ProductionStudySessionPorts['calendar'] } & { outbox: StudyOutboxPort }) => { void value.outbox.propose }; " +
      'void takeAdultIntersection; void ports.outbox',
    escapes: false,
    unmodelled: true,
  },

  // Controls: values that never touch a capability.
  { id: 'unrelated local object', body: 'const other = { safety: spare }; void (other as any).safety; void ports.outbox', escapes: false },
  { id: 'unrelated local array', body: 'const other = [spare]; void (other[0] as any); void ports.outbox', escapes: false },
  { id: 'unrelated indexed assignment', body: 'const arr: unknown[] = [spare]; arr[0] = spare; void (arr[0] as any); void ports.outbox', escapes: false },
  { id: 'unrelated object destructuring assignment', body: 'let a: unknown; ({ a } = { a: spare }); void (a as any); void ports.outbox', escapes: false },
  { id: 'unrelated array destructuring assignment', body: 'let a: unknown; [a] = [spare]; void (a as any); void ports.outbox', escapes: false },
  { id: 'unrelated binding default', body: 'const holder: { a?: unknown } = {}; const { a = spare } = holder; void (a as any); void ports.outbox', escapes: false },
  { id: 'unrelated logical assignment', body: 'let a: unknown; a ??= spare; void (a as any); void ports.outbox', escapes: false },
  // The documented boundary: both sides of a call, however the call is spelled.
  { id: 'helper laundering — outside the boundary', body: 'const launder = (x: unknown) => x as any; void launder(ports)', escapes: false },
  { id: 'object getter — outside the boundary', body: 'const w = { get p() { return ports } }; void (w.p as any).safety', escapes: false },
  { id: 'object method — outside the boundary', body: 'const w = { p() { return ports } }; void (w.p() as any).safety', escapes: false },
  // A call is a call however its return type is written: declaring the contract on
  // the way out does not make the boundary followable. `make().ports` above is caught
  // for a different reason — the property symbol, not the call.
  {
    id: 'call returning the contract — outside the boundary',
    body: 'const make = (): StudyParentControlPorts => ports; void (make() as any).safety',
    escapes: false,
  },
]

const FIXTURE_PATH = posix(join(sourceRoot, 'study', 'portsProvenanceFixture.generated.ts'))
const PARKING_FIXTURE_PATH = posix(join(sourceRoot, 'study', 'portsProvenanceParkingFixture.generated.ts'))
const TYPE_WRAPPER_FIXTURE_PATH = posix(join(sourceRoot, 'study', 'portsTypeWrappersFixture.generated.ts'))
const TYPE_ALIAS_FIXTURE_PATH = posix(join(sourceRoot, 'study', 'portsTypeAliasesFixture.generated.ts'))
const INDEXED_HANDOFF_FIXTURE_PATH = posix(join(sourceRoot, 'study', 'portsIndexedHandoffsFixture.generated.tsx'))
const FIXTURE_FILES = [
  FIXTURE_PATH,
  PARKING_FIXTURE_PATH,
  TYPE_WRAPPER_FIXTURE_PATH,
  TYPE_ALIAS_FIXTURE_PATH,
  INDEXED_HANDOFF_FIXTURE_PATH,
] as const

interface TypeWrapperCase {
  readonly id: string
  readonly type: string
  readonly verdict: 'caught' | 'unmodelled'
  readonly body?: string
  readonly typeParameters?: string
}

const TYPE_WRAPPER_CASES: readonly TypeWrapperCase[] = [
  { id: 'direct production root', type: 'ProductionStudySessionPorts', verdict: 'caught' },
  {
    id: 'direct Pick derivative',
    type: `Pick<ProductionStudySessionPorts, 'calendar' | 'checkpoint'>`,
    verdict: 'caught',
  },
  { id: 'direct production-root alias', type: 'DirectProductionAlias', verdict: 'caught' },
  { id: 'renamed local Pick alias', type: 'RenamedLocalProductionPick', verdict: 'caught' },
  { id: 'renamed imported Pick alias', type: 'RenamedImportedProductionPick', verdict: 'caught' },
  { id: 'nested local Pick alias', type: 'NestedProductionPick', verdict: 'caught' },
  {
    id: 'parenthesized Pick derivative',
    type: `(Pick<ProductionStudySessionPorts, 'calendar'>)`,
    verdict: 'caught',
  },
  {
    id: 'direct checkpoint indexed projection',
    type: `ProductionStudySessionPorts['checkpoint']`,
    verdict: 'caught',
  },
  { id: 'aliased checkpoint indexed projection', type: 'CheckpointProjection', verdict: 'caught' },
  {
    id: 'direct calendar indexed projection',
    type: `ProductionStudySessionPorts['calendar']`,
    verdict: 'caught',
  },
  { id: 'aliased calendar indexed projection', type: 'CalendarProjection', verdict: 'caught' },
  { id: 'safe marker intersection', type: 'SafeProductionIntersection', verdict: 'caught' },
  { id: 'broad full-bundle union', type: 'BroadProductionUnion', verdict: 'unmodelled' },
  { id: 'broad full-bundle intersection', type: 'BroadProductionIntersection', verdict: 'unmodelled' },
  { id: 'arbitrary mapped-type wrapper', type: 'ArbitraryProductionMap', verdict: 'unmodelled' },
  { id: 'different-surface production union', type: 'SplitProductionUnion', verdict: 'unmodelled' },
  { id: 'same-root role-adding intersection', type: 'AddedCheckpointIntersection', verdict: 'unmodelled' },
  { id: 'widened calendar-member intersection', type: 'WidenedCalendarIntersection', verdict: 'unmodelled' },
  { id: 'index-signature intersection', type: 'IndexedProductionIntersection', verdict: 'unmodelled' },
  { id: 'any intersection', type: 'AnyProductionIntersection', verdict: 'unmodelled' },
  { id: 'partial adult-role intersection', type: 'PartialAdultIntersection', verdict: 'unmodelled' },
  {
    id: 'Pick with any keys',
    type: 'AnyKeyProductionPick',
    verdict: 'unmodelled',
    body: 'void ports.outbox.propose',
  },
  {
    id: 'canonical Partial derivative',
    type: 'Partial<ProductionStudySessionPorts>',
    verdict: 'caught',
  },
  {
    id: 'local generic mapped wrapper',
    type: 'GenericProductionMap<ProductionStudySessionPorts>',
    verdict: 'unmodelled',
  },
  { id: 'import-type mapped wrapper', type: 'ImportTypeProductionMap', verdict: 'unmodelled' },
  {
    id: 'any-widened calendar property intersection',
    type: 'AnyCalendarPropertyIntersection',
    verdict: 'unmodelled',
    body: 'void ports.calendar.createContinuation',
  },
  { id: 'number-index intersection', type: 'NumberIndexedProductionIntersection', verdict: 'unmodelled' },
  { id: 'call-signature intersection', type: 'CallableProductionIntersection', verdict: 'unmodelled' },
  { id: 'construct-signature intersection', type: 'ConstructableProductionIntersection', verdict: 'unmodelled' },
  { id: 'unguarded non-nullish union arm', type: 'UnguardedProductionUnion', verdict: 'unmodelled' },
  {
    id: 'optional nested calendar-method widening',
    type: 'OptionalCalendarMethodLeak',
    verdict: 'unmodelled',
    body: 'void ports.calendar.createContinuation',
  },
  {
    id: 'nested any calendar-member widening',
    type: 'NestedAnyCalendarLeak',
    verdict: 'unmodelled',
    body: 'void ports.calendar.list',
  },
  { id: 'safe production interface heritage', type: 'SafeProductionHeritage', verdict: 'caught' },
  {
    id: 'adult-leaky production interface heritage',
    type: 'LeakyProductionHeritage',
    verdict: 'unmodelled',
    body: 'void ports.outbox',
  },
  { id: 'array syntax wrapper', type: 'ProductionStudySessionPorts[]', verdict: 'unmodelled' },
  { id: 'tuple syntax wrapper', type: '[ProductionStudySessionPorts]', verdict: 'unmodelled' },
  { id: 'readonly syntax wrapper', type: 'readonly ProductionStudySessionPorts[]', verdict: 'unmodelled' },
  {
    id: 'generic constrained production root',
    type: 'T',
    typeParameters: '<T extends ProductionStudySessionPorts>',
    verdict: 'unmodelled',
  },
  { id: 'typeof-root indexed projection', type: 'CalendarViaTypeof', verdict: 'caught' },
  { id: 'conditional indexed projection', type: 'ConditionalProjection', verdict: 'unmodelled' },
]

const FULL_BUNDLE_ALIAS_CASES = [
  { id: 'imported full-bundle alias', type: 'RenamedImportedFullBundleAlias' },
  { id: 'nested imported full-bundle alias', type: 'NestedImportedFullBundleAlias' },
  { id: 'full-bundle interface heritage', type: 'FullBundleHeritage' },
  { id: 'optional imported full-bundle alias', type: 'OptionalImportedFullBundleAlias', body: 'void ports?.outbox' },
  { id: 'marked imported full-bundle alias', type: 'MarkedImportedFullBundleAlias' },
  { id: 'Partial imported full-bundle alias', type: 'PartialImportedFullBundleAlias' },
  { id: 'readonly-array imported full-bundle alias', type: 'ImportedFullBundleArrayAlias', body: 'void ports[0]?.outbox' },
] as const

const typeAliasFixtureText = [
  `import type { ProductionStudySessionPorts, StudyPortBundle } from './ports'`,
  `export type ImportedProductionPick = Pick<ProductionStudySessionPorts, 'calendar' | 'checkpoint'>`,
  `export type ImportedFullBundleAlias = StudyPortBundle`,
  `export type NestedImportedFullBundleAlias = ImportedFullBundleAlias`,
  `export type OptionalImportedFullBundleAlias = StudyPortBundle | undefined`,
  `export type MarkedImportedFullBundleAlias = StudyPortBundle & { readonly marker?: never }`,
  `export type PartialImportedFullBundleAlias = Partial<StudyPortBundle>`,
  `export type ImportedFullBundleArrayAlias = readonly StudyPortBundle[]`,
  `export declare const semanticProductionReference: readonly ProductionStudySessionPorts[]`,
  `export declare const semanticFullBundleReference: readonly StudyPortBundle[]`,
  '',
].join('\n')

const TYPE_WRAPPER_PREAMBLE = [
  `import type { ProductionStudyCalendarPort, ProductionStudySessionPorts, StudyCalendarPort, StudyOutboxPort, StudyPortBundle } from './ports'`,
  `import type { ImportedProductionPick as RenamedImportedProductionPick, ImportedFullBundleAlias as RenamedImportedFullBundleAlias, NestedImportedFullBundleAlias, OptionalImportedFullBundleAlias, MarkedImportedFullBundleAlias, PartialImportedFullBundleAlias, ImportedFullBundleArrayAlias } from './portsTypeAliasesFixture.generated'`,
  `type DirectProductionAlias = ProductionStudySessionPorts`,
  `type RenamedLocalProductionPick = Pick<ProductionStudySessionPorts, 'calendar' | 'checkpoint'>`,
  `type NestedProductionPick = RenamedLocalProductionPick`,
  `type CheckpointProjection = ProductionStudySessionPorts['checkpoint']`,
  `type CalendarProjection = ProductionStudySessionPorts['calendar']`,
  `declare const canonicalProductionPorts: ProductionStudySessionPorts`,
  `type CalendarViaTypeof = (typeof canonicalProductionPorts)['calendar']`,
  `type ConditionalProjection = ProductionStudySessionPorts extends unknown ? ProductionStudySessionPorts['calendar'] : never`,
  `type SafeProductionIntersection = Pick<ProductionStudySessionPorts, 'calendar'> & { readonly marker?: never }`,
  `type BroadProductionUnion = ProductionStudySessionPorts | StudyPortBundle`,
  `type BroadProductionIntersection = ProductionStudySessionPorts & StudyPortBundle`,
  `type ArbitraryProductionMap = { [K in keyof ProductionStudySessionPorts]: ProductionStudySessionPorts[K] }`,
  `type SplitProductionUnion = Pick<ProductionStudySessionPorts, 'calendar'> | Pick<ProductionStudySessionPorts, 'checkpoint'>`,
  `type AddedCheckpointIntersection = Pick<ProductionStudySessionPorts, 'calendar'> & { readonly checkpoint: ProductionStudySessionPorts['checkpoint'] }`,
  `type WidenedCalendarIntersection = Pick<ProductionStudySessionPorts, 'calendar'> & { readonly calendar: StudyCalendarPort }`,
  `type IndexedProductionIntersection = Pick<ProductionStudySessionPorts, 'calendar'> & Record<string, any>`,
  `type AnyProductionIntersection = Pick<ProductionStudySessionPorts, 'calendar'> & any`,
  `type PartialAdultIntersection = ProductionStudySessionPorts & { readonly parentSettings: StudyPortBundle['parentSettings'] }`,
  `type AnyKeyProductionPick = Pick<ProductionStudySessionPorts, any>`,
  `type GenericProductionMap<T> = { [K in keyof T]: T[K] }`,
  `type ImportTypeProductionMap = { [K in keyof import('./ports').ProductionStudySessionPorts]: import('./ports').ProductionStudySessionPorts[K] }`,
  `type AnyCalendarPropertyIntersection = Pick<ProductionStudySessionPorts, 'calendar'> & { readonly calendar: any }`,
  `type NumberIndexedProductionIntersection = Pick<ProductionStudySessionPorts, 'calendar'> & Record<number, any>`,
  `type CallableProductionIntersection = Pick<ProductionStudySessionPorts, 'calendar'> & { (): void }`,
  `type ConstructableProductionIntersection = Pick<ProductionStudySessionPorts, 'calendar'> & { new (): unknown }`,
  `type UnguardedProductionUnion = Pick<ProductionStudySessionPorts, 'calendar'> | { readonly outbox: StudyPortBundle['outbox'] }`,
  `type OptionalCalendarMethodLeak = Pick<ProductionStudySessionPorts, 'calendar'> & { readonly calendar: ProductionStudyCalendarPort & { readonly createContinuation?: StudyCalendarPort['createContinuation'] } }`,
  `type NestedAnyCalendarLeak = Pick<ProductionStudySessionPorts, 'calendar'> & { readonly calendar: ProductionStudyCalendarPort & { readonly list: any } }`,
  `interface SafeProductionHeritage extends ProductionStudySessionPorts {}`,
  `interface LeakyProductionHeritage extends ProductionStudySessionPorts { readonly outbox: StudyOutboxPort }`,
  `interface FullBundleHeritage extends StudyPortBundle {}`,
] as const

const typeWrapperLineOfCase = (index: number) => TYPE_WRAPPER_PREAMBLE.length + index + 1
const fullBundleAliasLineOfCase = (index: number) => TYPE_WRAPPER_PREAMBLE.length + TYPE_WRAPPER_CASES.length + index + 1
const typeWrapperFixtureText = [
  ...TYPE_WRAPPER_PREAMBLE,
  ...TYPE_WRAPPER_CASES.map(
    (wrapperCase, index) =>
      `export function typeCase${index}${wrapperCase.typeParameters ?? ''}(ports: ${wrapperCase.type}) { ${wrapperCase.body ?? 'void (ports as any).outbox'} }`,
  ),
  ...FULL_BUNDLE_ALIAS_CASES.map(
    (aliasCase, index) =>
      `export function fullBundleCase${index}(ports: ${aliasCase.type}) { ${'body' in aliasCase ? aliasCase.body : 'void ports.outbox'} }`,
  ),
  '',
].join('\n')

const INDEXED_HANDOFF_PREAMBLE = [
  `import type { ProductionStudySessionPorts } from './ports'`,
  `type CheckpointAlias = ProductionStudySessionPorts['checkpoint']`,
  `declare const session: ProductionStudySessionPorts`,
  `export function takeDirectCheckpoint(value: ProductionStudySessionPorts['checkpoint']) { void value }`,
  `export function takeAliasedCheckpoint(value: CheckpointAlias) { void value }`,
  `export function takeThisCheckpoint(this: void, value: ProductionStudySessionPorts['checkpoint']) { void value }`,
  `export class TakeCheckpoint { constructor(value: ProductionStudySessionPorts['checkpoint']) { void value } }`,
  `export function takeCalendarProps(props: { ports: ProductionStudySessionPorts['calendar'] }) { void props }`,
  `export function TakeCalendarJsx(props: { ports: ProductionStudySessionPorts['calendar'] }) { void props; return null }`,
] as const

const INDEXED_HANDOFF_CASES = [
  { id: 'direct indexed call', source: `takeDirectCheckpoint(session.checkpoint)`, expression: 'session.checkpoint' },
  { id: 'aliased indexed call', source: `takeAliasedCheckpoint(session.checkpoint)`, expression: 'session.checkpoint' },
  { id: 'indexed call after explicit this', source: `takeThisCheckpoint(session.checkpoint)`, expression: 'session.checkpoint' },
  { id: 'indexed constructor call', source: `new TakeCheckpoint(session.checkpoint)`, expression: 'session.checkpoint' },
  { id: 'indexed named prop call', source: `takeCalendarProps({ ports: session.calendar })`, expression: 'session.calendar' },
  { id: 'indexed shorthand prop call', source: `const ports = session.calendar; takeCalendarProps({ ports })`, expression: 'ports' },
  { id: 'indexed JSX prop', source: `void <TakeCalendarJsx ports={session.calendar} />`, expression: 'session.calendar' },
  {
    id: 'indexed declared variable',
    source: `const checkpoint: ProductionStudySessionPorts['checkpoint'] = session.checkpoint`,
    expression: 'session.checkpoint',
  },
  {
    id: 'indexed declared class field',
    source: `class HandoffHolder { readonly checkpoint: ProductionStudySessionPorts['checkpoint'] = session.checkpoint }`,
    expression: 'session.checkpoint',
  },
] as const

const indexedHandoffFixtureText = [
  ...INDEXED_HANDOFF_PREAMBLE,
  ...INDEXED_HANDOFF_CASES.map((handoffCase) => handoffCase.source),
  '',
].join('\n')

const parkingFixtureText = [
  `export const registry: Record<string, unknown> = {}`,
  `void (registry.leaked as any).safety`,
  '',
].join('\n')

/**
 * The receivers the hand-over cases above supply. Each declares a narrow contract on
 * a parameter, so each is also a discovered consumer — spelled out in `discovers`
 * rather than loosening the discovery expectation to tolerate them.
 */
const FIXTURE_PREAMBLE = {
  lines: [
    `import type { ProductionStudySessionPorts, StudyDashboardPorts, StudyOutboxPort, StudyParentControlPorts, StudyPortBundle } from './ports'`,
    `import { registry as parkingRegistry } from './portsProvenanceParkingFixture.generated'`,
    `declare function take(ports: StudyParentControlPorts): void`,
    `declare function panel(props: { ports: StudyParentControlPorts }): void`,
    `declare function takeWithThis(this: void, ports: StudyParentControlPorts): void`,
    `declare class Holder { constructor(ports: StudyParentControlPorts) }`,
    `export function parkAcrossModule(ports: StudyParentControlPorts) { parkingRegistry.leaked = ports }`,
    `declare const mixedProductionRole: ProductionStudySessionPorts['calendar'] & ProductionStudySessionPorts['checkpoint']`,
  ],
  discovers: [
    'take | (positional) | StudyParentControlPorts',
    'panel | ports | StudyParentControlPorts',
    'takeWithThis | (positional) | StudyParentControlPorts',
    'Holder | (positional) | StudyParentControlPorts',
    'parkAcrossModule | (positional) | StudyParentControlPorts',
  ],
} as const

/** The 1-based line one case occupies. Every case is emitted as a single line. */
const lineOfCase = (index: number) => FIXTURE_PREAMBLE.lines.length + index + 1

const fixtureText = [
  ...FIXTURE_PREAMBLE.lines,
  ...PROVENANCE_CASES.map(
    (provenanceCase, index) =>
      `export function case${index}${SHAPES[provenanceCase.shape ?? 'positional'].params} { ${provenanceCase.body} }`,
  ),
  '',
].join('\n')

function fixtureProgram(): ts.Program {
  const host = ts.createCompilerHost(parsedConfig.options, true)
  const getSourceFile = host.getSourceFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const readFile = host.readFile.bind(host)
  const virtualFiles = new Map([
    [FIXTURE_PATH, fixtureText],
    [PARKING_FIXTURE_PATH, parkingFixtureText],
    [TYPE_WRAPPER_FIXTURE_PATH, typeWrapperFixtureText],
    [TYPE_ALIAS_FIXTURE_PATH, typeAliasFixtureText],
    [INDEXED_HANDOFF_FIXTURE_PATH, indexedHandoffFixtureText],
  ])
  host.getSourceFile = (fileName, ...rest) =>
    virtualFiles.has(posix(fileName))
      ? ts.createSourceFile(
          fileName,
          virtualFiles.get(posix(fileName))!,
          ts.ScriptTarget.ES2022,
          true,
          fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        )
      : getSourceFile(fileName, ...rest)
  host.fileExists = (fileName) => virtualFiles.has(posix(fileName)) || fileExists(fileName)
  host.readFile = (fileName) => virtualFiles.get(posix(fileName)) ?? readFile(fileName)
  return ts.createProgram(FIXTURE_FILES, { ...parsedConfig.options, noEmit: true }, host)
}

function fullBundleReferencesOf(target: ts.Program, files: readonly string[]): readonly string[] {
  const { checker: targetChecker, narrowContractOf: narrowOf } = contractsOf(target)
  const references: string[] = []
  for (const fileName of files) {
    const source = target.getSourceFile(fileName)
    if (!source) continue
    const visit = (node: ts.Node) => {
      const isHeritageType = ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent)
      if (ts.isTypeNode(node) || isHeritageType) {
        const type = ts.isTypeNode(node)
          ? targetChecker.getTypeFromTypeNode(node)
          : targetChecker.getTypeAtLocation(node)
        const resolution = narrowOf(type, ts.isTypeNode(node) ? node : undefined)
        if (resolution.kind === 'full-bundle') references.push(at(node))
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return references
}

/**
 * FULL_BUNDLE_STILL_UNSUPPORTED.
 *
 * The three UI contracts remain building blocks and still exclude the safety role,
 * which the compiler asserts here. ProductionStudySessionPorts is a separately
 * approved five-role learner-session root; it does carry safety, but still excludes
 * the review queue, parent settings, adult-private notes, and outbox. Neither family
 * is authority to declare the complete nine-role StudyPortBundle in production.
 */
// @ts-expect-error the learner dashboard contract cannot supply the safety role
type DashboardExcludesSafety = StudyDashboardPorts['safety']
// @ts-expect-error the learner settings contract cannot supply the safety role
type SettingsExcludesSafety = StudySettingsPorts['safety']
// @ts-expect-error the parent control contract cannot supply the safety role
type ParentControlExcludesSafety = StudyParentControlPorts['safety']

/**
 * DASHBOARD_PREVIEW_READ_ONLY: NO.
 *
 * StudyDashboardPorts carries calendar.create because the component seeds the
 * local-development preview day through ensureLocalDevelopmentStudyDay. That is
 * pre-existing behaviour of the preview dashboard and is not what the verified
 * production dashboard does. The contract records what the current component
 * calls; do not read it as a read-only contract.
 */
const dashboardWritesToTheCalendar: keyof StudyDashboardPorts['calendar'] = 'create'

describe('narrow Study consumer contracts survive an AST census of their injection sites', () => {
  it('sweeps the real production program rather than an empty file list', () => {
    // Anti-vacuity: every assertion below is over `productionFiles`, so a
    // misresolved tsconfig would make all of them pass by finding nothing.
    expect(productionFiles.length).toBeGreaterThan(100)
    expect(census.length).toBeGreaterThan(0)
    expect(portsRoots.length).toBeGreaterThan(0)
    for (const consumer of CONSUMERS) {
      expect(productionFiles.map(posix)).toContain(posix(join(sourceRoot, consumer.module)))
    }
  })

  it('discovers its consumers from typed use, and reports exactly the reviewed set', () => {
    expect(consumerReport).toEqual(REVIEWED_CONSUMERS)
  })

  it('models every reference to a narrow Study consumer', () => {
    expect(unmodelled).toEqual([])
  })

  it('types every consumer reference as the narrow contract it declares', () => {
    expect(referencesOutsideCensus).toEqual([])
  })

  it('reports exactly the reviewed census of injection sites', () => {
    expect(censusReport).toEqual(REVIEWED_CENSUS)
  })

  it('erases no contract with a type assertion at an injection site', () => {
    expect(assertionsAtInjectionSites).toEqual([])
  })

  it('lets no consumer assert its way past the ports it was handed', () => {
    expect(consumerBodyEscapes).toEqual([])
  })

  it('discovers a narrow contract on a props object, and names the prop that carries it', () => {
    // Production now has one props-object consumer. The fixture still forces the
    // general rule over multiple props and contracts — through the same
    // `capabilityScope` the production sweep runs — instead of proving one shape only.
    const fixture = fixtureProgram()
    const roots = capabilityScope(fixture, [FIXTURE_PATH]).roots
    // The whole discovered set, not a per-case lookup: an extra root cannot hide in
    // a case nobody asked about, and a missing one cannot be excused by a sibling.
    const discovered = [
      ...new Set(roots.map((root) => `${root.consumer.exportName} | ${root.consumer.propName ?? '(positional)'} | ${root.consumer.contract}`)),
    ].sort()
    const expected = [
      ...new Set([
        ...FIXTURE_PREAMBLE.discovers,
        ...PROVENANCE_CASES.flatMap((provenanceCase, index) => [
          ...SHAPES[provenanceCase.shape ?? 'positional'].discovers.map((entry) => `case${index} | ${entry}`),
          ...(provenanceCase.alsoDiscovers ?? []),
        ]),
      ]),
    ].sort()
    expect(discovered).toEqual(expected)
    expect(
      [...new Set(roots.filter((root) => root.consumer.exportName === 'takeWithThis').map((root) => root.consumer.parameterIndex))],
    ).toEqual([0])
    // Anti-vacuity: some case really is a props object carrying two contracts, and
    // some case really does declare its contract on a prop rather than positionally.
    const propsRoots = discovered.filter((entry) => !entry.includes('(positional)'))
    expect(propsRoots.length).toBeGreaterThan(1)
    expect(new Set(propsRoots.map((entry) => entry.split(' | ')[0])).size).toBeLessThan(propsRoots.length)
  })

  it('follows the provenance forms it claims, and says where it stops', () => {
    const fixture = fixtureProgram()
    const source = fixture.getSourceFile(FIXTURE_PATH)
    if (!source) throw new Error('the provenance fixture is not in its own program')
    // The line arithmetic below only holds if the fixture parsed as one statement
    // per case, so both are checked before any verdict is read from it. The semantic
    // diagnostics are checked too: a case that no longer compiles would otherwise
    // report "free" and read as a documented boundary.
    expect(fixture.getSyntacticDiagnostics(source).map((diagnostic) => diagnostic.messageText)).toEqual([])
    expect(fixture.getSemanticDiagnostics(source).map((diagnostic) => `${diagnostic.start}: ${diagnostic.messageText}`)).toEqual([])
    expect(source.statements.length).toBe(FIXTURE_PREAMBLE.lines.length + PROVENANCE_CASES.length)

    const scope = capabilityScope(fixture, [FIXTURE_PATH])
    const reported = new Set(scope.findings().map((finding) => finding.line))
    const failedClosed = new Set(
      scope.unnameable.flatMap((entry) => {
        const match = entry.match(/:(\d+) —/)
        return match ? [Number(match[1])] : []
      }),
    )
    const verdicts = PROVENANCE_CASES.map(
      (provenanceCase, index) =>
        `${provenanceCase.id}: ${
          reported.has(lineOfCase(index)) ? 'caught' : failedClosed.has(lineOfCase(index)) ? 'unmodelled' : 'free'
        }`,
    )
    expect(verdicts).toEqual(
      PROVENANCE_CASES.map(
        (provenanceCase) => `${provenanceCase.id}: ${provenanceCase.unmodelled ? 'unmodelled' : provenanceCase.escapes ? 'caught' : 'free'}`,
      ),
    )
  })

  it('traces production-session roots through the reviewed Pick, Partial, alias, and projection wrappers', () => {
    const fixture = fixtureProgram()
    const source = fixture.getSourceFile(TYPE_WRAPPER_FIXTURE_PATH)
    const aliases = fixture.getSourceFile(TYPE_ALIAS_FIXTURE_PATH)
    if (!source || !aliases) throw new Error('the type-wrapper fixtures are not in their own program')

    for (const fixtureSource of [source, aliases]) {
      expect(fixture.getSyntacticDiagnostics(fixtureSource).map((diagnostic) => diagnostic.messageText)).toEqual([])
      expect(fixture.getSemanticDiagnostics(fixtureSource).map((diagnostic) => `${diagnostic.start}: ${diagnostic.messageText}`)).toEqual([])
    }
    expect(PROVENANCE_CASES).toHaveLength(117)
    expect(TYPE_WRAPPER_CASES).toHaveLength(40)
    expect(source.statements.length).toBe(
      TYPE_WRAPPER_PREAMBLE.length + TYPE_WRAPPER_CASES.length + FULL_BUNDLE_ALIAS_CASES.length,
    )

    const scope = capabilityScope(fixture, [TYPE_WRAPPER_FIXTURE_PATH])
    const reported = new Set(scope.findings().map((finding) => finding.line))
    const failedClosed = new Set(
      scope.unnameable.flatMap((entry) => {
        const match = entry.match(/:(\d+)/)
        return match ? [Number(match[1])] : []
      }),
    )
    const verdicts = TYPE_WRAPPER_CASES.map((wrapperCase, index) => {
      const line = typeWrapperLineOfCase(index)
      const verdict = reported.has(line) ? 'caught' : failedClosed.has(line) ? 'unmodelled' : 'free'
      return `${wrapperCase.id}: ${verdict}`
    })
    expect(verdicts).toEqual(TYPE_WRAPPER_CASES.map((wrapperCase) => `${wrapperCase.id}: ${wrapperCase.verdict}`))

    const {
      checker: fixtureChecker,
      narrowContractOf: semanticResolutionOf,
      typeNodeResolutionOf,
    } = contractsOf(fixture)
    for (const [index, wrapperCase] of TYPE_WRAPPER_CASES.entries()) {
      const declaration = source.statements.find(
        (statement): statement is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(statement) && statement.name?.text === `typeCase${index}`,
      )
      const parameterType = declaration?.parameters[0]?.type
      if (!parameterType) throw new Error(`typeCase${index} has no declared parameter type`)
      expect(`${wrapperCase.id}: ${typeNodeResolutionOf(parameterType).kind}`).toBe(
        `${wrapperCase.id}: ${wrapperCase.verdict === 'caught' ? 'safe' : 'unsafe'}`,
      )
    }

    const discovered = new Set(scope.roots.map((root) => root.consumer.exportName))
    for (const [index, wrapperCase] of TYPE_WRAPPER_CASES.entries()) {
      expect(discovered.has(`typeCase${index}`)).toBe(wrapperCase.verdict === 'caught')
    }

    const semanticReferenceResolutionOf = (name: string): NarrowResolution => {
      let declarationName: ts.Identifier | undefined
      for (const statement of aliases.statements) {
        if (!ts.isVariableStatement(statement)) continue
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === name) declarationName = declaration.name
        }
      }
      if (!declarationName) throw new Error(`${name} is missing from the semantic-reference fixture`)
      const type = fixtureChecker.getTypeAtLocation(declarationName)
      expect(type.flags & ts.TypeFlags.Object).not.toBe(0)
      expect((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference).not.toBe(0)
      expect(type.aliasSymbol).toBeUndefined()
      expect(type.aliasTypeArguments ?? []).toEqual([])
      expect(fixtureChecker.getTypeArguments(type as ts.TypeReference)).toHaveLength(1)
      return semanticResolutionOf(type)
    }

    expect(semanticReferenceResolutionOf('semanticProductionReference')).toMatchObject({
      kind: 'unsafe',
      contract: PRODUCTION_SESSION_CONTRACT,
    })
    expect(semanticReferenceResolutionOf('semanticFullBundleReference')).toEqual(FULL)

    const constrainedCaseIndex = TYPE_WRAPPER_CASES.findIndex(
      (wrapperCase) => wrapperCase.id === 'generic constrained production root',
    )
    const constrainedDeclaration = source.statements.find(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) && statement.name?.text === `typeCase${constrainedCaseIndex}`,
    )
    const constrainedParameter = constrainedDeclaration?.parameters[0]
    if (!constrainedParameter) throw new Error('the semantic constrained-production fixture is missing')
    const constrainedType = fixtureChecker.getTypeAtLocation(constrainedParameter)
    expect(constrainedType.flags & ts.TypeFlags.TypeParameter).not.toBe(0)
    const baseConstraint = fixtureChecker.getBaseConstraintOfType(constrainedType)
    if (!baseConstraint) throw new Error('the semantic constrained-production fixture lost its base constraint')
    expect(semanticResolutionOf(baseConstraint)).toMatchObject({
      kind: 'safe',
      contract: PRODUCTION_SESSION_CONTRACT,
    })
    expect(semanticResolutionOf(constrainedType)).toMatchObject({
      kind: 'unsafe',
      contract: PRODUCTION_SESSION_CONTRACT,
    })
  })

  it('recovers indexed projection syntax at every same-module hand-off form', () => {
    const fixture = fixtureProgram()
    const source = fixture.getSourceFile(INDEXED_HANDOFF_FIXTURE_PATH)
    if (!source) throw new Error('the indexed hand-off fixture is not in its own program')
    expect(fixture.getSyntacticDiagnostics(source).map((diagnostic) => diagnostic.messageText)).toEqual([])
    expect(fixture.getSemanticDiagnostics(source).map((diagnostic) => `${diagnostic.start}: ${diagnostic.messageText}`)).toEqual([])

    const handoffs = censusOf(fixture, [INDEXED_HANDOFF_FIXTURE_PATH])
    expect(handoffs.unsafe).toEqual([])
    expect(INDEXED_HANDOFF_CASES).toHaveLength(9)
    const reported = new Map<number, string[]>()
    for (const site of handoffs.sites) {
      const line = source.getLineAndCharacterOfPosition(site.expression.getStart(source)).line + 1
      reported.set(line, [...(reported.get(line) ?? []), `${site.contract} | ${textOf(site.expression)}`])
    }
    const verdicts = INDEXED_HANDOFF_CASES.map((handoffCase, index) => {
      const line = INDEXED_HANDOFF_PREAMBLE.length + index + 1
      return `${handoffCase.id}: ${[...(reported.get(line) ?? [])].sort().join(' + ') || 'nothing'}`
    })
    expect(verdicts).toEqual(
      INDEXED_HANDOFF_CASES.map(
        (handoffCase) => `${handoffCase.id}: ${PRODUCTION_SESSION_CONTRACT} | ${handoffCase.expression}`,
      ),
    )
  })

  it('traces full-bundle aliases and interface heritage instead of trusting the immediate name', () => {
    const fixture = fixtureProgram()
    const source = fixture.getSourceFile(TYPE_WRAPPER_FIXTURE_PATH)
    if (!source) throw new Error('the type-wrapper fixture is not in its own program')
    const reported = new Set(
      fullBundleReferencesOf(fixture, [TYPE_WRAPPER_FIXTURE_PATH]).map((reference) => Number(reference.split(':').at(-1))),
    )
    for (const [index] of FULL_BUNDLE_ALIAS_CASES.entries()) {
      expect(reported.has(fullBundleAliasLineOfCase(index))).toBe(true)
    }
    const heritageLine = TYPE_WRAPPER_PREAMBLE.findIndex((line) => line.startsWith('interface FullBundleHeritage')) + 1
    expect(heritageLine).toBeGreaterThan(0)
    expect(reported.has(heritageLine)).toBe(true)
  })

  it('follows an imported alias to cross-module state and sweeps the second fixture module', () => {
    const fixture = fixtureProgram()
    for (const fileName of FIXTURE_FILES) {
      const source = fixture.getSourceFile(fileName)
      if (!source) throw new Error(`fixture source is missing: ${fileName}`)
      expect(fixture.getSyntacticDiagnostics(source).map((diagnostic) => diagnostic.messageText)).toEqual([])
      expect(fixture.getSemanticDiagnostics(source).map((diagnostic) => `${diagnostic.start}: ${diagnostic.messageText}`)).toEqual([])
    }

    const wholeProgram = wholeProgramCapabilityScope(fixture, FIXTURE_FILES).findings().map((finding) => finding.message)
    expect(wholeProgram.filter((message) => message.includes('portsProvenanceParkingFixture.generated.ts:2'))).toEqual([
      expect.stringContaining('portsProvenanceParkingFixture.generated.ts:2'),
    ])

    // Restricting the scan to the consumer module leaves the parked assertion free.
    // This is the forcing control for the production call's whole-program file set.
    expect(
      capabilityScope(fixture, consumerModuleFiles(fixture, FIXTURE_FILES))
        .findings()
        .map((finding) => finding.message)
        .filter((message) => message.includes('portsProvenanceParkingFixture.generated.ts')),
    ).toEqual([])
  })

  it('sees every hand-over form its census claims, including the ones production never writes', () => {
    // `suppliedExpressions` decides what the census can see at all. Production has
    // four JSX sites plus one shorthand property inside an ordinary call. The fixture
    // keeps direct call/constructor arguments, named and shorthand properties, a
    // declared constant, and a declared class field independently forceable.
    const fixture = fixtureProgram()
    const source = fixture.getSourceFile(FIXTURE_PATH)
    if (!source) throw new Error('the provenance fixture is not in its own program')
    const byLine = new Map<number, string[]>()
    const handoffs = censusOf(fixture, [FIXTURE_PATH])
    for (const site of handoffs.sites) {
      const line = source.getLineAndCharacterOfPosition(site.expression.getStart(source)).line + 1
      byLine.set(line, [...(byLine.get(line) ?? []), `${site.contract} | ${textOf(site.expression)}`])
    }
    const render = (entries: readonly string[]) => [...entries].sort().join(' + ') || 'nothing'
    const reported = PROVENANCE_CASES.map(
      (provenanceCase, index) => `${provenanceCase.id}: ${render(byLine.get(lineOfCase(index)) ?? [])}`,
    )
    expect(reported).toEqual(
      PROVENANCE_CASES.map((provenanceCase) => `${provenanceCase.id}: ${render(provenanceCase.supplies ?? [])}`),
    )
    const unsafeLines = new Set(
      handoffs.unsafe.flatMap((entry) => {
        const match = entry.match(/:(\d+)/)
        return match ? [Number(match[1])] : []
      }),
    )
    expect([...unsafeLines].sort((left, right) => left - right)).toEqual(
      PROVENANCE_CASES.flatMap((provenanceCase, index) =>
        provenanceCase.unsafeHandoff ? [lineOfCase(index)] : [],
      ),
    )
    // Anti-vacuity: some case really did hand ports over.
    expect(PROVENANCE_CASES.filter((provenanceCase) => provenanceCase.supplies).length).toBeGreaterThan(4)
  })

  it('binds every declared narrow contract to a reported consumer, prop included', () => {
    // Per module: what the reported consumers claim must be exactly what the checker
    // declares there — contract *and* carrying prop. The dedupe that produces
    // CONSUMERS is the lossy step this catches, so a module declaring two narrow
    // contracts, or one contract on two different props, has to report both.
    const production = bindingReport(program, productionFiles)
    expect(production.claimed).toEqual(production.declared)

    // The fixture preserves the predecessor's props-object regression independently
    // of production's single durable-preparation shape. It includes compatible
    // multiple-prop declarations and deliberately rejected union/intersection forms.
    const fixture = fixtureProgram()
    const onFixture = bindingReport(fixture, [FIXTURE_PATH])
    expect(onFixture.claimed).toEqual(onFixture.declared)
    // Anti-vacuity: the fixture really does carry contracts on props, and really does
    // carry two different ones, so an empty or positional-only report cannot pass.
    const declaredOnFixture = onFixture.declared.join('\n')
    expect(declaredOnFixture).toContain('StudyParentControlPorts | ports')
    expect(declaredOnFixture).toContain('StudyDashboardPorts | dash')
    expect(declaredOnFixture).toContain('StudyParentControlPorts | (positional)')
  })

  it('leaves the pre-existing container casts out of scope while reviewing its narrow preparation', () => {
    // The container genuinely requires all nine roles and asserts to reach them.
    // Those casts are pre-existing and outside this card; they are recorded here so
    // that fixing them is a visible change rather than a silent one. They are not
    // injection sites themselves. The one reviewed container entry is instead the
    // ports hand-over to prepareDurableStudySession.
    const source = program.getSourceFile(join(sourceRoot, 'components', 'study', 'StudySessionContainer.tsx'))
    if (!source) throw new Error('StudySessionContainer is not in the program')
    let fullBundleAssertions = 0
    const visit = (node: ts.Node) => {
      if (isTypeErasure(node)) {
        const symbol = checker.getTypeFromTypeNode(node.type).getSymbol()
        if (symbol?.declarations?.includes(fullBundleDeclaration)) fullBundleAssertions += 1
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    expect(fullBundleAssertions).toBeGreaterThan(0)
    expect(censusReport.filter((entry) => entry.startsWith('components/study/StudySessionContainer.tsx'))).toEqual([
      'components/study/StudySessionContainer.tsx | ProductionStudySessionPorts | ports',
    ])
  })

  it('pins FULL_BUNDLE_STILL_UNSUPPORTED through declaration, alias, and heritage provenance', () => {
    const productionDirectory = `${posix(join(sourceRoot, 'study', 'production'))}/`
    const references = fullBundleReferencesOf(
      program,
      productionFiles.filter((fileName) => posix(fileName).startsWith(productionDirectory)),
    )
    expect(references).toEqual([])
  })

  it('pins DASHBOARD_PREVIEW_READ_ONLY: NO — the preview dashboard still writes blocks', () => {
    expect(dashboardWritesToTheCalendar).toBe('create')
  })
})
