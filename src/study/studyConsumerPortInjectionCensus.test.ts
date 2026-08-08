import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import type { StudyDashboardPorts, StudyParentControlPorts, StudySettingsPorts } from './ports'

/**
 * StudyDashboardPorts, StudySettingsPorts, and StudyParentControlPorts narrow what
 * each Study surface may reach. A type assertion where the ports are handed over
 * erases that narrowing and the compiler says nothing.
 *
 * The predecessor guard read four named files as text and rejected three spellings
 * of the cast. Independent review found four ways past it, all reproduced on this
 * branch before this file was written:
 *
 *   E1  `ports={study.ports as Bundle}` behind `import type { StudyPortBundle as Bundle }`
 *   E2  `ports={studyRuntime.ports as unknown as StudyDashboardPorts}`
 *   E3  `(ports as any).adultPrivate` inside the consumer body
 *   E4  a fifth StudyDashboard render in a file the guard never opened
 *
 * All four left `tsc --noEmit` and the guard at exit 0. The first two are spelling
 * games, so this file stops reading spellings: it asks the TypeScript checker which
 * expressions are supplied to a narrow contract, and rejects assertion *nodes*
 * regardless of the type they name. The last two are census failures, so the site
 * list is generated from source on every run rather than maintained by hand.
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

// ── the contracts, resolved to declarations ───────────────────────────────────
// These four names are the only ones this file spells, and every later comparison
// is against the *declaration node* they resolve to. That is what makes an aliased
// import (`StudyPortBundle as Bundle`) indistinguishable from the original here.

const PORTS_MODULE = join(sourceRoot, 'study', 'ports.ts')
const NARROW_CONTRACTS = ['StudyDashboardPorts', 'StudySettingsPorts', 'StudyParentControlPorts'] as const
const FULL_BUNDLE = 'StudyPortBundle'

const portsSource = program.getSourceFile(PORTS_MODULE)
if (!portsSource) throw new Error(`the Study port contracts are not in the program: ${PORTS_MODULE}`)

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
const fullBundleDeclaration = declarationOf(FULL_BUNDLE)

/** The narrow contract a type resolves to, by declaration identity — never by name. */
function narrowContractOf(type: ts.Type | undefined): string | null {
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

type TypeErasure = ts.AsExpression | ts.TypeAssertion
const isTypeErasure = (node: ts.Node): node is TypeErasure =>
  ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)

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

// ── the consumers, discovered from their module paths ─────────────────────────
// The census above is blind in one direction: it finds expressions the checker
// already types as a narrow contract. If a consumer is rendered in a form that
// hides its ports expression — spread props, a namespace import, a computed
// module specifier — there is no expression to type, and silence would read as
// safety. So the consumers are also swept from the other end: every reference to
// them is found from their module path and must land on a census entry.
//
// This list is the definition of scope, not the census. Adding a fifth injection
// of any of these four changes the census without changing this list.

interface Consumer {
  readonly module: string
  readonly exportName: string
  readonly contract: string
}

const CONSUMERS: readonly Consumer[] = [
  { module: 'components/study/StudyDashboard.tsx', exportName: 'StudyDashboard', contract: 'StudyDashboardPorts' },
  { module: 'components/study/StudySettings.tsx', exportName: 'StudySettings', contract: 'StudySettingsPorts' },
  { module: 'components/hub/StudyParentPanel.tsx', exportName: 'StudyParentPanel', contract: 'StudyParentControlPorts' },
  { module: 'study/parentController.ts', exportName: 'StudyParentController', contract: 'StudyParentControlPorts' },
]

const consumerByPath = new Map(CONSUMERS.map((consumer) => [posix(join(sourceRoot, consumer.module)), consumer]))

function consumerFor(fromFile: string, specifier: string): Consumer | null {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    const consumer = consumerByPath.get(posix(candidate))
    if (consumer) return consumer
  }
  return null
}

/**
 * Forms this sweep does not model. Anything landing here fails the guard with a
 * file and line rather than being waved through — an unmodelled edge is the one
 * thing a census cannot survive silently.
 */
const unmodelled: string[] = []
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
      const consumer = consumerFor(fileName, node.moduleSpecifier.text)
      if (consumer) collectStaticBinding(node, consumer)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const consumer = consumerFor(fileName, node.moduleSpecifier.text)
      if (consumer) unmodelled.push(`${at(node)} — re-export of the ${consumer.exportName} module opens a second import path`)
    } else if (ts.isCallExpression(node)) {
      const specifier = node.arguments[0]
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if (isDynamicImport && (!specifier || !ts.isStringLiteral(specifier))) {
        unmodelled.push(`${at(node)} — dynamic import with a computed specifier could reach any module`)
      } else if ((isDynamicImport || isRequire) && specifier && ts.isStringLiteral(specifier)) {
        const consumer = consumerFor(fileName, specifier.text)
        if (consumer && isRequire) unmodelled.push(`${at(node)} — require() of the ${consumer.exportName} module`)
        else if (consumer) collectDynamicBinding(node, consumer)
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
// `(identity(ports) as Bundle)` expose their assertion. The boundary is the
// expression: a cast laundered through a helper defined elsewhere is out of reach
// of this file, and no data-flow analysis here pretends otherwise.

const assertionsAtInjectionSites = census.flatMap((site) => {
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (isTypeErasure(node)) found.push(`${at(node)} — ${site.contract} injection asserts to \`${textOf(node.type)}\``)
    ts.forEachChild(node, visit)
  }
  visit(site.expression)
  return found
})

// ── assertions inside the consumer bodies ─────────────────────────────────────
// A consumer can also widen its own parameter after receiving it. Only assertions
// whose expression walks back to the ports parameter are rejected; the file stays
// free to assert about anything else.

const portsParameters = new Set<ts.Declaration>()
for (const consumer of CONSUMERS) {
  const source = program.getSourceFile(join(sourceRoot, consumer.module))
  if (!source) throw new Error(`the ${consumer.exportName} module is not in the program`)
  const visit = (node: ts.Node) => {
    if ((ts.isParameter(node) || ts.isBindingElement(node)) && narrowContractOf(checker.getTypeAtLocation(node))) {
      portsParameters.add(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

function derivesFromPorts(expression: ts.Expression): boolean {
  let node: ts.Node = expression
  for (;;) {
    const symbol = checker.getSymbolAtLocation(node)
    if (symbol?.declarations?.some((declaration) => portsParameters.has(declaration))) return true
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

const consumerBodyEscapes = CONSUMERS.flatMap((consumer) => {
  const source = program.getSourceFile(join(sourceRoot, consumer.module))
  if (!source) return []
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (isTypeErasure(node) && derivesFromPorts(node.expression)) {
      found.push(`${at(node)} — ${consumer.exportName} asserts its ports to \`${textOf(node.type)}\``)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
})

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
    for (const consumer of CONSUMERS) {
      expect(productionFiles.map(posix)).toContain(posix(join(sourceRoot, consumer.module)))
    }
    expect(census.length).toBeGreaterThan(0)
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
