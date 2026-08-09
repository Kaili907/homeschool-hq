import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import type { StudyDashboardPorts, StudyParentControlPorts, StudySettingsPorts } from './ports'

/**
 * StudyDashboardPorts, StudySettingsPorts, and StudyParentControlPorts narrow what
 * each Study surface may reach. A type assertion where the ports are handed over —
 * or anywhere inside the surface that received them — erases that narrowing and the
 * compiler says nothing.
 *
 * WHAT THIS FILE PROTECTS, EXACTLY:
 *
 *   1. every expression the checker types as one of the narrow contracts, wherever
 *      in the production program it appears;
 *   2. every property of a parameter's declared type that the checker resolves to
 *      one of the narrow contracts — `props: { ports: StudyDashboardPorts }` and a
 *      named `interface Props` alike — and that property alone, not its siblings;
 *      and
 *   3. inside every module that declares such a parameter, the values whose
 *      provenance runs back to one of those roots through the forms implemented
 *      below, tracked to a fixed point by symbol identity:
 *
 *        binding      const a = root · let a = root · a = root (later) ·
 *                     for (const a of [root]) · class C { field = root }
 *        destructure  const { k } = · const { k: renamed } = · const { ...rest } =
 *                     · const [a] = · and the same patterns nested
 *        object       { ...root } · { root } · { k: root } · { k: { root } }
 *        array        [root] · [root.k] · [...roots]  (index-blind: an array that
 *                     carries anywhere is treated as carrying everywhere)
 *        reads        a.k · a[0] · a['k'] · this.field · (a) · a! · a as T · <T>a ·
 *                     a satisfies T · (f(), a)
 *        joins        cond ? a : b · a ?? b · a || b · a && b
 *
 * Nothing wider. What is NOT covered, and is pinned below as a known survivor rather
 * than quietly implied to be covered:
 *
 *   - interprocedural laundering. `function launder(x: unknown) { return x as any }`
 *     called as `launder(ports)` passes the capability across a call boundary this
 *     file does not follow, in either direction. Object-literal methods and getters
 *     are the same boundary wearing a different hat.
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
 *
 * Eleven forms in all, each run against the parent commit's own guard first, and each
 * leaving `tsc --noEmit` and that guard at exit 0 while `safety` — a role no narrow
 * contract carries — was reachable.
 *
 * Copying a *parameter property* the same way is not a twelfth: `readonly leaked =
 * this.ports` inside StudyParentController is TS2729, so the compiler closes it.
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

// ── the contracts, resolved to declarations ───────────────────────────────────
// These four names are the only ones this file spells, and every later comparison
// is against the *declaration node* they resolve to. That is what makes an aliased
// import (`StudyPortBundle as Bundle`, `StudyDashboardPorts as DashPorts`)
// indistinguishable from the original here.

const NARROW_CONTRACTS = ['StudyDashboardPorts', 'StudySettingsPorts', 'StudyParentControlPorts'] as const
const FULL_BUNDLE = 'StudyPortBundle'

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

  const narrowByDeclaration = new Map<ts.Declaration, string>(
    NARROW_CONTRACTS.map((name) => [declarationOf(name) as ts.Declaration, name]),
  )
  const targetChecker = target.getTypeChecker()

  /** The narrow contract a type resolves to, by declaration identity — never by name. */
  const narrowContractOf = (type: ts.Type | undefined): string | null => {
    if (!type) return null
    for (const candidate of type.isUnion() ? type.types : [type]) {
      const symbol = candidate.aliasSymbol ?? candidate.getSymbol()
      for (const declaration of symbol?.declarations ?? []) {
        const name = narrowByDeclaration.get(declaration)
        if (name) return name
      }
    }
    return null
  }

  return { checker: targetChecker, narrowContractOf, fullBundleDeclaration: declarationOf(FULL_BUNDLE) }
}

const { narrowContractOf, fullBundleDeclaration } = contractsOf(program)

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

interface InjectionSite {
  readonly file: string
  readonly contract: string
  readonly expression: ts.Expression
}

const census: InjectionSite[] = []
const censusExpressions = new Set<ts.Node>()

for (const fileName of productionFiles) {
  const source = program.getSourceFile(fileName)
  if (!source) continue
  const visit = (node: ts.Node) => {
    for (const expression of suppliedExpressions(node)) {
      const contract = narrowContractOf(checker.getContextualType(expression))
      if (!contract) continue
      census.push({ file: underSource(fileName), contract, expression })
      censusExpressions.add(expression)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

const censusReport = census.map((site) => `${site.file} | ${site.contract} | ${textOf(site.expression)}`).sort()

/**
 * The reviewed census. Not a scope list — the sweep above does not consult it. It
 * is the record of which injections a human has looked at, so a fifth site, a
 * deleted site, or a moved site has to be read by someone before this file is
 * green again.
 */
const REVIEWED_CENSUS = [
  'App.tsx | StudyDashboardPorts | studyRuntime.ports',
  'App.tsx | StudySettingsPorts | studyRuntime.ports',
  'components/hub/ParentHub.tsx | StudyParentControlPorts | study.ports',
  'components/hub/StudyParentPanel.tsx | StudyParentControlPorts | ports',
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

/** The parameter a declaration belongs to, or null if it is not in a parameter list. */
function parameterOf(declaration: ts.Node): ts.ParameterDeclaration | null {
  let current: ts.Node = declaration
  while (ts.isBindingElement(current) || ts.isObjectBindingPattern(current) || ts.isArrayBindingPattern(current)) {
    current = current.parent
  }
  return ts.isParameter(current) ? current : null
}

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
    if (!exportName) {
      unnameable.push(`${at(declaration)} — a ${contract} parameter belongs to a callable this sweep cannot name`)
      return
    }
    const module = underSource(declaration.getSourceFile().fileName)
    roots.push({ declaration, consumer: { module, exportName, contract, propName } })
  }

  /** Members of an object-ish type, per union constituent so a narrow arm is not lost. */
  function propertiesOf(type: ts.Type): readonly ts.Symbol[] {
    const constituents = type.isUnionOrIntersection() ? type.types : [type]
    const found: ts.Symbol[] = []
    for (const constituent of constituents) {
      if (!(constituent.flags & ts.TypeFlags.Object)) continue
      found.push(...targetChecker.getPropertiesOfType(constituent))
    }
    return found
  }

  for (const source of sources) {
    const seed = (node: ts.Node) => {
      if ((ts.isParameter(node) || ts.isBindingElement(node)) && parameterOf(node)) {
        const type = targetChecker.getTypeAtLocation(node)
        const own = narrowOf(type)
        if (own) {
          absorb(carriageFor(node), everything())
          record(node, own, propKeyOf(node))
        } else {
          // A props object. The contract lives on a property of the declared type, so
          // only that property becomes a capability — a sibling prop of an unrelated
          // type is left alone, which is the whole point of asking the checker rather
          // than tainting the parameter wholesale.
          for (const property of propertiesOf(type)) {
            const contract = narrowOf(targetChecker.getTypeOfSymbolAtLocation(property, node))
            if (!contract) continue
            narrowProperties.add(property)
            carriageFor(node).members.add(property.name)
            record(node, contract, ts.isParameter(node) ? property.name : null)
          }
        }
      }
      ts.forEachChild(node, seed)
    }
    seed(source)
  }

  // `this.ports` on a parameter property resolves through the property name, so ask
  // for the symbol there rather than at the access expression.
  const symbolAt = (node: ts.Node) =>
    ts.isPropertyAccessExpression(node) ? targetChecker.getSymbolAtLocation(node.name) : targetChecker.getSymbolAtLocation(node)

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
      if (
        operator === ts.SyntaxKind.QuestionQuestionToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.AmpersandAmpersandToken
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
          } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const value = carriageOf(node.right)
            if (carries(value)) {
              for (const declaration of symbolAt(node.left)?.declarations ?? []) {
                growing = absorb(carriageFor(declaration), value) || growing
              }
            }
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
// Add a fifth surface that takes StudyDashboardPorts — as a parameter or as a prop
// on one — and it appears here on the next run; take the narrow type off an existing
// one and it disappears. Either way the reviewed snapshot stops matching.

const productionScope = capabilityScope(program, productionFiles)
const portsRoots = productionScope.roots
unmodelled.push(...productionScope.unnameable)

const describeConsumer = (consumer: Consumer) =>
  `${consumer.module} | ${consumer.exportName} | ${consumer.contract} | ${consumer.propName ?? '(positional)'}`

const consumerReport = [...new Set(portsRoots.map((root) => describeConsumer(root.consumer)))].sort()

/**
 * One entry per distinct contract *and* carrying prop, not one per module. A surface
 * whose props object declared two different narrow contracts would appear twice and
 * be swept twice, rather than the second one being dropped by a dedupe.
 */
const CONSUMERS: readonly Consumer[] = [
  ...new Map(portsRoots.map((root) => [describeConsumer(root.consumer), root.consumer])).values(),
]

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
    return portsExpressionInJsx(parent, consumer)
  }
  if (ts.isNewExpression(parent) && parent.expression === reference) {
    const first = parent.arguments?.[0]
    if (!first) {
      unmodelled.push(`${at(parent)} — new ${consumer.exportName}() supplies no ports argument`)
      return null
    }
    return portsExpressionInArgument(first, consumer)
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

const consumerModules = [...new Set(CONSUMERS.map((consumer) => join(sourceRoot, consumer.module)))]
const consumerBodyEscapes = capabilityScope(program, consumerModules)
  .findings()
  .map((finding) => finding.message)

// ── the provenance tracker, proven against a fixture ──────────────────────────
// Production consumers wrap nothing today, so nothing above would notice if the
// tracker stopped working. These cases run through `capabilityScope` — the same
// function, not a copy — over a synthetic module compiled against the real ports
// contracts. Three of them are the documented boundary: what this file does not
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
} as const

type ShapeName = keyof typeof SHAPES

interface ProvenanceCase {
  readonly id: string
  readonly shape?: ShapeName
  readonly body: string
  readonly escapes: boolean
  /** Roots this case declares beyond its own signature, as `owner | prop | contract`. */
  readonly alsoDiscovers?: readonly string[]
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

  // Array literal provenance.
  { id: 'array element', body: 'const w = [ports]; void (w[0] as any).safety', escapes: true },
  { id: 'array of a role', body: 'const w = [ports.calendar]; void (w[0] as any).start', escapes: true },
  { id: 'array of an alias', body: 'const a = ports; const w = [a]; void (w[0] as any).safety', escapes: true },
  { id: 'array spread', body: 'const w = [...[ports]]; void (w[0] as any).safety', escapes: true },
  { id: 'array read at a computed index', body: 'const w = [ports]; void (w[Number("0")] as any).safety', escapes: true },
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

  // Joins.
  { id: 'conditional join', body: 'const a = spare ? ports : ports.calendar; void (a as any).safety', escapes: true },
  {
    id: 'nullish join',
    body: 'const maybe: StudyParentControlPorts | undefined = ports; const a = maybe ?? spare; void (a as any)',
    escapes: true,
  },
  {
    id: 'logical-or join',
    body: 'const maybe: StudyParentControlPorts | undefined = ports; const a = maybe || spare; void (a as any)',
    escapes: true,
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

  // Two narrow contracts on one props object: both are seeded, neither is dropped.
  { id: 'first of two contracts', shape: 'twoContracts', body: 'void (props.dash as any).safety', escapes: true },
  { id: 'second of two contracts', shape: 'twoContracts', body: 'void (props.parent as any).safety', escapes: true },

  // Controls: values that never touch a capability.
  { id: 'unrelated local object', body: 'const other = { safety: spare }; void (other as any).safety; void ports.outbox', escapes: false },
  { id: 'unrelated local array', body: 'const other = [spare]; void (other[0] as any); void ports.outbox', escapes: false },
  // The documented boundary: both sides of a call, however the call is spelled.
  { id: 'helper laundering — outside the boundary', body: 'const launder = (x: unknown) => x as any; void launder(ports)', escapes: false },
  { id: 'object getter — outside the boundary', body: 'const w = { get p() { return ports } }; void (w.p as any).safety', escapes: false },
  { id: 'object method — outside the boundary', body: 'const w = { p() { return ports } }; void (w.p() as any).safety', escapes: false },
]

const FIXTURE_PATH = posix(join(sourceRoot, 'study', 'portsProvenanceFixture.generated.ts'))
const FIXTURE_HEADER = `import type { StudyDashboardPorts, StudyParentControlPorts, StudyPortBundle } from './ports'`
const fixtureText = [
  FIXTURE_HEADER,
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
  host.getSourceFile = (fileName, ...rest) =>
    posix(fileName) === FIXTURE_PATH
      ? ts.createSourceFile(fileName, fixtureText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
      : getSourceFile(fileName, ...rest)
  host.fileExists = (fileName) => posix(fileName) === FIXTURE_PATH || fileExists(fileName)
  host.readFile = (fileName) => (posix(fileName) === FIXTURE_PATH ? fixtureText : readFile(fileName))
  return ts.createProgram([FIXTURE_PATH], { ...parsedConfig.options, noEmit: true }, host)
}

/**
 * FULL_BUNDLE_STILL_UNSUPPORTED.
 *
 * The three narrow contracts are building blocks, not a production bundle. None of
 * them carries the safety role — the compiler asserts that here — so nothing
 * composed purely from them can supply it. A complete StudyPortBundle is still
 * produced only by the local-development and mounted preview factories.
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
    // Production has no props-object consumer, so the rule that finds one is proven
    // here — over the same `capabilityScope` the production sweep runs — rather than
    // being taken on trust until someone writes one.
    const fixture = fixtureProgram()
    const roots = capabilityScope(fixture, [FIXTURE_PATH]).roots
    // The whole discovered set, not a per-case lookup: an extra root cannot hide in
    // a case nobody asked about, and a missing one cannot be excused by a sibling.
    const discovered = [
      ...new Set(roots.map((root) => `${root.consumer.exportName} | ${root.consumer.propName ?? '(positional)'} | ${root.consumer.contract}`)),
    ].sort()
    const expected = [
      ...new Set(
        PROVENANCE_CASES.flatMap((provenanceCase, index) => [
          ...SHAPES[provenanceCase.shape ?? 'positional'].discovers.map((entry) => `case${index} | ${entry}`),
          ...(provenanceCase.alsoDiscovers ?? []),
        ]),
      ),
    ].sort()
    expect(discovered).toEqual(expected)
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
    expect(source.statements.length).toBe(PROVENANCE_CASES.length + 1)

    const reported = new Set(capabilityScope(fixture, [FIXTURE_PATH]).findings().map((finding) => finding.line))
    // Each case occupies one line, the header being line 1.
    const verdicts = PROVENANCE_CASES.map(
      (provenanceCase, index) => `${provenanceCase.id}: ${reported.has(index + 2) ? 'caught' : 'free'}`,
    )
    expect(verdicts).toEqual(PROVENANCE_CASES.map((provenanceCase) => `${provenanceCase.id}: ${provenanceCase.escapes ? 'caught' : 'free'}`))
  })

  it('binds each discovered consumer to the contract its own module declares', () => {
    // Per module: the contracts the sweep found there must be exactly the contracts
    // the reported consumers claim. A module carrying two narrow contracts therefore
    // has to report both.
    const declared = new Map<string, Set<string>>()
    for (const root of portsRoots) {
      const contracts = declared.get(root.consumer.module) ?? new Set<string>()
      contracts.add(root.consumer.contract)
      declared.set(root.consumer.module, contracts)
    }
    const bound = [...declared.keys()].sort().map((module) => {
      const contracts = new Set<string>()
      const source = program.getSourceFile(join(sourceRoot, module))
      const visit = (node: ts.Node) => {
        if (ts.isParameter(node) || ts.isBindingElement(node)) {
          const contract = narrowContractOf(checker.getTypeAtLocation(node))
          if (contract) contracts.add(contract)
        }
        ts.forEachChild(node, visit)
      }
      if (source) visit(source)
      return `${module} -> ${[...contracts].sort().join(', ') || 'no narrow contract'}`
    })
    expect(bound).toEqual(
      [...declared.keys()].sort().map((module) => `${module} -> ${[...declared.get(module)!].sort().join(', ')}`),
    )
  })

  it('leaves the pre-existing StudySessionContainer full-bundle casts out of scope', () => {
    // The container genuinely requires all nine roles and asserts to reach them.
    // Those casts are pre-existing and outside this card; they are recorded here so
    // that fixing them is a visible change rather than a silent one. They are not
    // injection sites: none of them supplies a narrow contract, which is why the
    // census above never sees them.
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
    expect(censusReport.filter((entry) => entry.startsWith('components/study/StudySessionContainer.tsx'))).toEqual([])
  })

  it('pins FULL_BUNDLE_STILL_UNSUPPORTED: no production module composes a complete bundle', () => {
    const productionDirectory = join(sourceRoot, 'study', 'production')
    const productionText = readdirSync(productionDirectory)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(productionDirectory, name), 'utf8'))
      .join('\n')
    expect(productionText).not.toMatch(/StudyPortBundle/)
  })

  it('pins DASHBOARD_PREVIEW_READ_ONLY: NO — the preview dashboard still writes blocks', () => {
    expect(dashboardWritesToTheCalendar).toBe('create')
  })
})
