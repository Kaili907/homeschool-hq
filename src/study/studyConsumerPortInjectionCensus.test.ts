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
 *      in the production program it appears; and
 *   2. inside each discovered consumer, the narrow ports parameter and the
 *      same-function local bindings derived from it.
 *
 * Nothing wider. A value laundered through a helper declared elsewhere —
 * `function launder(x: unknown) { return x as any }; const p = launder(ports)` —
 * is outside this boundary and is pinned below as a known survivor rather than
 * quietly implied to be covered. This is not whole-program taint analysis and does
 * not claim to be.
 *
 * The predecessor read four named files as text and rejected three spellings of the
 * cast; its successor asked the checker instead but still tracked only expressions
 * that walked *directly* to the ports parameter, and still took its own list of
 * consumers as authoritative. Independent review got past both, and all three were
 * reproduced on this branch before this revision was written:
 *
 *   F1a `const alias = ports; void (alias as any).adultPrivate`
 *   F1b `const { ...spread } = ports; void (spread as any).safety`
 *   F2  delete a consumer from the hand-written scope list, then cast in its body
 *
 * All three left `tsc --noEmit` and the guard at exit 0 while withheld capabilities
 * were reachable. So the consumer set is now derived from typed use rather than
 * declared, and a small same-function alias tracker stands between the parameter
 * and the assertion rule.
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

// ── the consumers, discovered from typed use ──────────────────────────────────
// Nothing below is seeded with a component name or a module path. A consumer is
// whatever declares a parameter — directly, or through a destructured binding in
// its parameter list — whose type resolves by declaration identity to one of the
// narrow contracts. Add a fifth surface that takes StudyDashboardPorts and it
// appears here on the next run; take the narrow type off an existing one and it
// disappears. Either way the reviewed snapshot stops matching.

interface Consumer {
  readonly module: string
  readonly exportName: string
  readonly contract: string
}

interface PortsRoot {
  readonly declaration: ts.Declaration
  readonly consumer: Consumer
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

const portsRoots: PortsRoot[] = []

for (const fileName of productionFiles) {
  const source = program.getSourceFile(fileName)
  if (!source) continue
  const visit = (node: ts.Node) => {
    if (ts.isParameter(node) || ts.isBindingElement(node)) {
      const contract = narrowContractOf(checker.getTypeAtLocation(node))
      if (contract && parameterOf(node)) {
        const signature = enclosingSignature(node)
        const exportName = signature ? consumerNameOf(signature) : null
        if (!exportName) {
          unmodelled.push(`${at(node)} — a ${contract} parameter belongs to a callable this sweep cannot name`)
        } else {
          portsRoots.push({ declaration: node, consumer: { module: underSource(fileName), exportName, contract } })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

const consumerReport = [
  ...new Set(portsRoots.map((root) => `${root.consumer.module} | ${root.consumer.exportName} | ${root.consumer.contract}`)),
].sort()

const CONSUMERS: readonly Consumer[] = [
  ...new Map(portsRoots.map((root) => [`${root.consumer.module}|${root.consumer.exportName}`, root.consumer])).values(),
]

/**
 * The reviewed consumers. Like REVIEWED_CENSUS this is a record of what a human has
 * read, never an input: every sweep below runs off the discovered set above, so
 * deleting a line here cannot shrink what is checked — it can only fail this file.
 */
const REVIEWED_CONSUMERS = [
  'components/hub/StudyParentPanel.tsx | StudyParentPanel | StudyParentControlPorts',
  'components/study/StudyDashboard.tsx | StudyDashboard | StudyDashboardPorts',
  'components/study/StudySettings.tsx | StudySettings | StudySettingsPorts',
  'study/parentController.ts | StudyParentController | StudyParentControlPorts',
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
  const attribute = properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && textOf(property.name) === 'ports',
  )
  if (!attribute) {
    unmodelled.push(`${at(element)} — ${consumer.exportName} is rendered without an explicit ports prop`)
    return null
  }
  const initializer = attribute.initializer
  if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) {
    unmodelled.push(`${at(attribute)} — the ports prop on ${consumer.exportName} is not a braced expression`)
    return null
  }
  return initializer.expression
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
    return first
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
// A consumer can also widen its own parameter after receiving it. The alias tracker
// below starts at the discovered ports parameter and follows ordinary local
// bindings — `const a = ports`, `const { calendar } = ports`, `const { ...rest } =
// ports`, `const a = { ...ports }`, and aliases of those — to a fixed point, by
// symbol identity, so a binding in a different function is a different symbol and
// is never confused with the parameter.
//
// REASSIGNMENT (option A, conservative). A binding tainted once stays tainted for
// the rest of the file. `let p = ports; p = somethingElse; (p as any)` is therefore
// still reported. Deciding otherwise would need flow-sensitive reasoning whose
// failure mode is silence, and silence is the one answer this file must not give.
//
// The boundary stops at calls. A value passed to a helper declared elsewhere and
// asserted there is not seen, and the fixture below pins that as a known survivor.

interface BodyFinding {
  readonly line: number
  readonly message: string
}

function assertionsOverPorts(target: ts.Program, files: readonly string[]): readonly BodyFinding[] {
  const { checker: targetChecker, narrowContractOf: narrowOf } = contractsOf(target)
  const sources = files.map((file) => target.getSourceFile(file)).filter((source): source is ts.SourceFile => Boolean(source))

  const tainted = new Set<ts.Declaration>()
  for (const source of sources) {
    const visit = (node: ts.Node) => {
      if ((ts.isParameter(node) || ts.isBindingElement(node)) && narrowOf(targetChecker.getTypeAtLocation(node)) && parameterOf(node)) {
        tainted.add(node)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  // `this.ports` on a parameter property resolves through the property name, so ask
  // for the symbol there rather than at the access expression.
  const symbolAt = (node: ts.Node) =>
    ts.isPropertyAccessExpression(node) ? targetChecker.getSymbolAtLocation(node.name) : targetChecker.getSymbolAtLocation(node)

  const isTainted = (node: ts.Node) =>
    Boolean(symbolAt(node)?.declarations?.some((declaration) => tainted.has(declaration)))

  function derivesFromPorts(expression: ts.Expression): boolean {
    let node: ts.Node = expression
    for (;;) {
      if (isTainted(node)) return true
      if (ts.isObjectLiteralExpression(node)) {
        return node.properties.some((property) => ts.isSpreadAssignment(property) && derivesFromPorts(property.expression))
      }
      if (
        ts.isParenthesizedExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node) ||
        isTypeErasure(node)
      ) {
        node = node.expression
      } else return false
    }
  }

  /** Taints every name a binding pattern introduces, at the declaration each one owns. */
  function taintBinding(name: ts.BindingName, owner: ts.Declaration): boolean {
    if (ts.isIdentifier(name)) {
      if (tainted.has(owner)) return false
      tainted.add(owner)
      return true
    }
    let grew = false
    for (const element of name.elements) {
      if (ts.isOmittedExpression(element)) continue
      grew = taintBinding(element.name, element) || grew
    }
    return grew
  }

  for (let growing = true; growing; ) {
    growing = false
    for (const source of sources) {
      const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && node.initializer && derivesFromPorts(node.initializer)) {
          growing = taintBinding(node.name, node) || growing
        } else if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          derivesFromPorts(node.right)
        ) {
          for (const declaration of symbolAt(node.left)?.declarations ?? []) {
            if (!tainted.has(declaration)) {
              tainted.add(declaration)
              growing = true
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }

  const findings: BodyFinding[] = []
  for (const source of sources) {
    const visit = (node: ts.Node) => {
      if (isTypeErasure(node) && derivesFromPorts(node.expression)) {
        findings.push({
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          message: `${at(node)} — the ports handed to ${underSource(source.fileName)} are asserted to \`${textOf(node.type)}\``,
        })
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

const consumerModules = [...new Set(CONSUMERS.map((consumer) => join(sourceRoot, consumer.module)))]
const consumerBodyEscapes = assertionsOverPorts(program, consumerModules).map((finding) => finding.message)

// ── the alias tracker, proven against a fixture ───────────────────────────────
// Production consumers contain no aliases today, so nothing above would notice if
// the tracker stopped working. These cases run through `assertionsOverPorts` — the
// same function, not a copy — over a synthetic module compiled against the real
// ports contracts. The last two are the documented boundary: what this file does
// not claim to catch.

const ALIAS_CASES: readonly { readonly id: string; readonly body: string; readonly escapes: boolean }[] = [
  { id: 'direct alias', body: 'const a = ports; void (a as any).adultPrivate', escapes: true },
  { id: 'alias of alias', body: 'const a = ports; const b = a; void (b as any).outbox', escapes: true },
  { id: 'property alias', body: 'const a = ports.calendar; void (a as any).start', escapes: true },
  { id: 'named destructuring', body: 'const { calendar } = ports; void (calendar as any).resume', escapes: true },
  { id: 'rest destructuring', body: 'const { ...rest } = ports; void (rest as any).adultPrivate', escapes: true },
  { id: 'object spread', body: 'const a = { ...ports }; void (a as any).safety', escapes: true },
  { id: 'let binding', body: 'let a = ports; void (a as any).safety', escapes: true },
  { id: 'angle-bracket assertion', body: 'const a = ports; void (<any>a).safety', escapes: true },
  { id: 'double assertion', body: 'const a = ports; void (a as unknown as StudyPortBundle).safety', escapes: true },
  { id: 'assignment after declaration', body: 'let a: unknown; a = ports; void (a as any)', escapes: true },
  { id: 'still tainted after reassignment', body: 'let a: unknown = ports; a = spare; void (a as any)', escapes: true },
  { id: 'unrelated local', body: 'const other = { safety: spare }; void (other as any).safety; void ports.outbox', escapes: false },
  { id: 'helper laundering — outside the boundary', body: 'const launder = (x: unknown) => x as any; void launder(ports)', escapes: false },
]

const FIXTURE_PATH = posix(join(sourceRoot, 'study', 'portsAliasFixture.generated.ts'))
const FIXTURE_HEADER = `import type { StudyParentControlPorts, StudyPortBundle } from './ports'`
const fixtureText = [
  FIXTURE_HEADER,
  ...ALIAS_CASES.map(
    (aliasCase, index) => `export function case${index}(ports: StudyParentControlPorts, spare: unknown) { ${aliasCase.body} }`,
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

  it('follows same-function aliases of the ports parameter, and says where it stops', () => {
    const fixture = fixtureProgram()
    const source = fixture.getSourceFile(FIXTURE_PATH)
    if (!source) throw new Error('the alias fixture is not in its own program')
    // The line arithmetic below only holds if the fixture parsed as one statement
    // per case, so both are checked before any verdict is read from it.
    expect(fixture.getSyntacticDiagnostics(source).map((diagnostic) => diagnostic.messageText)).toEqual([])
    expect(source.statements.length).toBe(ALIAS_CASES.length + 1)

    const reported = new Set(assertionsOverPorts(fixture, [FIXTURE_PATH]).map((finding) => finding.line))
    // Each case occupies one line, the header being line 1.
    const verdicts = ALIAS_CASES.map((aliasCase, index) => `${aliasCase.id}: ${reported.has(index + 2) ? 'caught' : 'free'}`)
    expect(verdicts).toEqual(ALIAS_CASES.map((aliasCase) => `${aliasCase.id}: ${aliasCase.escapes ? 'caught' : 'free'}`))
  })

  it('binds each consumer ports parameter to its own narrow contract', () => {
    const bound = CONSUMERS.map((consumer) => {
      const contracts = new Set<string>()
      const source = program.getSourceFile(join(sourceRoot, consumer.module))
      const visit = (node: ts.Node) => {
        if (ts.isParameter(node) || ts.isBindingElement(node)) {
          const contract = narrowContractOf(checker.getTypeAtLocation(node))
          if (contract) contracts.add(contract)
        }
        ts.forEachChild(node, visit)
      }
      if (source) visit(source)
      return `${consumer.module} -> ${[...contracts].sort().join(', ') || 'no narrow contract'}`
    })
    expect(bound).toEqual(CONSUMERS.map((consumer) => `${consumer.module} -> ${consumer.contract}`))
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
