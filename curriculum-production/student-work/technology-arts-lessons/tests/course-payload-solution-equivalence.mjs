import { createHash } from 'node:crypto'
import { parse } from 'acorn'

const TEXT_STOP_WORDS = new Set([
  'a', 'all', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'by', 'each',
  'for', 'from', 'has', 'in', 'is', 'it', 'makes', 'of', 'on', 'so', 'that',
  'the', 'then', 'this', 'three', 'to', 'uses', 'using', 'was', 'with',
])

const TEXT_SYNONYMS = new Map([
  ['begins', 'start'], ['begin', 'start'], ['began', 'start'], ['starts', 'start'],
  ['starting', 'start'], ['initializes', 'start'], ['initializing', 'start'],
  ['initialise', 'start'], ['initialize', 'start'], ['continues', 'continue'],
  ['counter', 'index'], ['cursor', 'index'], ['position', 'index'], ['loop', 'iteration'],
  ['zero', '0'], ['first', '0'], ['retains', 'keep'], ['retained', 'keep'],
  ['keeps', 'keep'], ['returns', 'return'], ['returned', 'return'],
  ['checks', 'check'], ['checking', 'check'], ['tests', 'test'],
  ['values', 'value'], ['records', 'record'], ['items', 'item'],
  ['assignments', 'assignment'], ['adds', 'add'], ['combines', 'add'],
])

const FIXED_AUTHORITY_KEY = /^(?:(?:single_)?accepted_conclusion|answer_key|canonical_response|correct_answer|exact_reference_artifact|exact_repair|(?:fixed_)?expected_response|fixed_response|model_answer|reference_artifact|required_repair|specific_required_repair|trusted_response)$/i
const FIXED_AUTHORITY_MARKER = /(?:FIXED|SINGLE_ACCEPTED|EXACT_REFERENCE|REQUIRED_REPAIR|ANSWER_KEY)/i
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]))
  }
  return value
}

function parseProgram(program) {
  return parse(String(program), {
    ecmaVersion: 'latest',
    sourceType: 'script',
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
  })
}

class Scope {
  constructor(parent, kind, state) {
    this.parent = parent
    this.kind = kind
    this.state = state
    this.bindings = new Map()
  }

  define(name, declarationKind = 'lexical') {
    if (!this.bindings.has(name)) {
      this.bindings.set(name, { id: `@binding:${this.state.nextBinding++}`, declarationKind, name })
    }
    return this.bindings.get(name)
  }

  resolve(name) {
    return this.bindings.get(name) ?? this.parent?.resolve(name) ?? null
  }
}

function patternNames(pattern, names = []) {
  if (!pattern) return names
  if (pattern.type === 'Identifier') names.push(pattern.name)
  else if (pattern.type === 'RestElement') patternNames(pattern.argument, names)
  else if (pattern.type === 'AssignmentPattern') patternNames(pattern.left, names)
  else if (pattern.type === 'ArrayPattern') pattern.elements.forEach((entry) => patternNames(entry, names))
  else if (pattern.type === 'ObjectPattern') pattern.properties.forEach((entry) =>
    patternNames(entry.type === 'RestElement' ? entry.argument : entry.value, names))
  return names
}

function predeclareStatements(statements, scope) {
  for (const statement of statements ?? []) {
    if (statement.type === 'VariableDeclaration') {
      for (const declaration of statement.declarations) {
        for (const name of patternNames(declaration.id)) scope.define(name, statement.kind)
      }
    } else if (statement.type === 'FunctionDeclaration' && statement.id) {
      scope.define(statement.id.name, 'function')
    } else if (statement.type === 'ClassDeclaration' && statement.id) {
      scope.define(statement.id.name, 'class')
    }
  }
}

function literalValue(node) {
  if (node.regex) return { regex: node.regex.pattern, flags: node.regex.flags }
  if (typeof node.value === 'string') return node.value.length === 0 ? 'STRING_EMPTY' : 'STRING'
  if (typeof node.value === 'number') return Object.is(node.value, -0) ? '-0' : node.value
  if (typeof node.value === 'bigint') return `${node.value}n`
  return node.value
}

function isPureExpression(node) {
  if (!node) return true
  switch (node.type) {
    case 'Literal':
    case 'Identifier':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return true
    case 'ArrayExpression':
      return node.elements.every(isPureExpression)
    case 'ObjectExpression':
      return node.properties.every((property) => property.type === 'Property' && !property.computed && isPureExpression(property.value))
    case 'UnaryExpression':
      return node.operator !== 'delete' && isPureExpression(node.argument)
    case 'BinaryExpression':
    case 'LogicalExpression':
      return isPureExpression(node.left) && isPureExpression(node.right)
    case 'ConditionalExpression':
      return isPureExpression(node.test) && isPureExpression(node.consequent) && isPureExpression(node.alternate)
    case 'TemplateLiteral':
      return node.expressions.every(isPureExpression)
    default:
      return false
  }
}

function isPureTopLevelDeclaration(statement) {
  if (statement.type === 'FunctionDeclaration') return true
  if (statement.type !== 'VariableDeclaration') return false
  return statement.declarations.every((declaration) => isPureExpression(declaration.init))
}

function canonicalPropertyKey(node, scope, state, references, computed) {
  if (computed) return canonicalNode(node, scope, state, references)
  if (node.type === 'Identifier') return { t: 'PropertyName', name: node.name }
  if (node.type === 'Literal') return { t: 'PropertyName', name: String(node.value) }
  return canonicalNode(node, scope, state, references)
}

function canonicalPattern(node, scope, state, references) {
  if (!node) return null
  if (node.type === 'Identifier') {
    const binding = scope.resolve(node.name) ?? scope.define(node.name, 'pattern')
    return { t: 'BindingPattern', binding: binding.id, scope: scope.kind, declarationKind: binding.declarationKind }
  }
  if (node.type === 'RestElement') return { t: 'RestElement', argument: canonicalPattern(node.argument, scope, state, references) }
  if (node.type === 'AssignmentPattern') return {
    t: 'AssignmentPattern',
    left: canonicalPattern(node.left, scope, state, references),
    right: canonicalNode(node.right, scope, state, references),
  }
  if (node.type === 'ArrayPattern') return { t: 'ArrayPattern', elements: node.elements.map((entry) => canonicalPattern(entry, scope, state, references)) }
  if (node.type === 'ObjectPattern') return {
    t: 'ObjectPattern',
    properties: node.properties.map((property) => property.type === 'RestElement'
      ? canonicalPattern(property, scope, state, references)
      : {
          t: 'PatternProperty',
          key: canonicalPropertyKey(property.key, scope, state, references, property.computed),
          value: canonicalPattern(property.value, scope, state, references),
        }),
  }
  return canonicalNode(node, scope, state, references)
}

function canonicalStatements(statements, scope, state, references) {
  predeclareStatements(statements, scope)
  return statements.map((statement) => canonicalNode(statement, scope, state, references))
}

function blockHasLexicalBoundary(block) {
  return block.body.some((statement) =>
    (statement.type === 'VariableDeclaration' && statement.kind !== 'var') ||
    statement.type === 'ClassDeclaration' || statement.type === 'FunctionDeclaration')
}

function canonicalControlledBody(node, scope, state, references) {
  if (node.type !== 'BlockStatement') return canonicalNode(node, scope, state, references)
  if (blockHasLexicalBoundary(node)) return canonicalNode(node, scope, state, references)
  const body = node.body.map((statement) => canonicalNode(statement, scope, state, references))
  return body.length === 1 ? body[0] : { t: 'StatementSequence', body }
}

function canonicalFunction(node, parentScope, state, references) {
  const scope = new Scope(parentScope, 'function', state)
  if (node.type === 'FunctionExpression' && node.id) scope.define(node.id.name, 'function-name')
  for (const parameter of node.params) for (const name of patternNames(parameter)) scope.define(name, 'parameter')
  predeclareStatements(node.body.type === 'BlockStatement' ? node.body.body : [], scope)
  return {
    t: node.type,
    async: Boolean(node.async),
    generator: Boolean(node.generator),
    params: node.params.map((parameter) => canonicalPattern(parameter, scope, state, references)),
    body: node.body.type === 'BlockStatement'
      ? canonicalStatements(node.body.body, scope, state, references)
      : canonicalNode(node.body, scope, state, references),
    scope: scope.kind,
  }
}

function canonicalNode(node, scope, state, references) {
  if (!node) return null
  switch (node.type) {
    case 'Program':
      return { t: 'Program', body: canonicalStatements(node.body, scope, state, references) }
    case 'Identifier': {
      const binding = scope.resolve(node.name)
      if (binding) {
        references.add(binding.id)
        return { t: 'BindingReference', ref: binding.id }
      }
      return { t: 'GlobalReference', name: node.name }
    }
    case 'PrivateIdentifier':
      return { t: 'PrivateIdentifier', name: node.name }
    case 'Literal':
      return { t: 'Literal', value: literalValue(node) }
    case 'ExpressionStatement':
      return { t: 'ExpressionStatement', expression: canonicalNode(node.expression, scope, state, references) }
    case 'VariableDeclaration':
      for (const declaration of node.declarations) {
        for (const name of patternNames(declaration.id)) scope.define(name, node.kind)
      }
      return {
        t: 'VariableDeclaration', kind: node.kind,
        declarations: node.declarations.map((declaration) => ({
          t: 'VariableDeclarator',
          id: canonicalPattern(declaration.id, scope, state, references),
          init: canonicalNode(declaration.init, scope, state, references),
        })),
      }
    case 'FunctionDeclaration': {
      const binding = scope.resolve(node.id.name)
      return { t: 'FunctionDeclaration', binding: binding.id, function: canonicalFunction(node, scope, state, references) }
    }
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return canonicalFunction(node, scope, state, references)
    case 'ClassDeclaration': {
      const binding = scope.resolve(node.id.name)
      const classScope = new Scope(scope, 'class', state)
      return {
        t: 'ClassDeclaration', binding: binding.id, scope: classScope.kind,
        superClass: canonicalNode(node.superClass, scope, state, references),
        body: canonicalNode(node.body, classScope, state, references),
      }
    }
    case 'ClassExpression': {
      const classScope = new Scope(scope, 'class', state)
      if (node.id) classScope.define(node.id.name, 'class-name')
      return {
        t: 'ClassExpression', scope: classScope.kind,
        name: node.id ? canonicalPattern(node.id, classScope, state, references) : null,
        superClass: canonicalNode(node.superClass, scope, state, references),
        body: canonicalNode(node.body, classScope, state, references),
      }
    }
    case 'ClassBody':
      return { t: 'ClassBody', body: node.body.map((entry) => canonicalNode(entry, scope, state, references)) }
    case 'MethodDefinition':
    case 'PropertyDefinition':
      return {
        t: node.type, kind: node.kind ?? 'field', static: Boolean(node.static), computed: Boolean(node.computed),
        key: canonicalPropertyKey(node.key, scope, state, references, node.computed),
        value: canonicalNode(node.value, scope, state, references),
      }
    case 'StaticBlock': {
      const staticScope = new Scope(scope, 'static-block', state)
      return { t: 'StaticBlock', scope: staticScope.kind, body: canonicalStatements(node.body, staticScope, state, references) }
    }
    case 'BlockStatement': {
      const blockScope = new Scope(scope, 'block', state)
      return { t: 'BlockStatement', scope: blockScope.kind, body: canonicalStatements(node.body, blockScope, state, references) }
    }
    case 'ReturnStatement':
    case 'ThrowStatement':
      return { t: node.type, argument: canonicalNode(node.argument, scope, state, references) }
    case 'IfStatement':
      return {
        t: 'IfStatement',
        test: canonicalNode(node.test, scope, state, references),
        consequent: canonicalControlledBody(node.consequent, scope, state, references),
        alternate: node.alternate ? canonicalControlledBody(node.alternate, scope, state, references) : null,
      }
    case 'ForStatement': {
      const loopScope = node.init?.type === 'VariableDeclaration' && node.init.kind !== 'var'
        ? new Scope(scope, 'loop', state)
        : scope
      return {
        t: 'ForStatement',
        scope: loopScope.kind,
        init: canonicalNode(node.init, loopScope, state, references),
        test: canonicalNode(node.test, loopScope, state, references),
        update: canonicalNode(node.update, loopScope, state, references),
        body: canonicalControlledBody(node.body, loopScope, state, references),
      }
    }
    case 'ForInStatement':
    case 'ForOfStatement': {
      const loopScope = node.left?.type === 'VariableDeclaration' && node.left.kind !== 'var'
        ? new Scope(scope, 'loop', state)
        : scope
      return {
        t: node.type,
        await: Boolean(node.await),
        scope: loopScope.kind,
        left: canonicalNode(node.left, loopScope, state, references),
        right: canonicalNode(node.right, loopScope, state, references),
        body: canonicalControlledBody(node.body, loopScope, state, references),
      }
    }
    case 'WhileStatement':
    case 'DoWhileStatement':
      return {
        t: node.type,
        test: canonicalNode(node.test, scope, state, references),
        body: canonicalControlledBody(node.body, scope, state, references),
      }
    case 'BinaryExpression':
    case 'LogicalExpression':
    case 'AssignmentExpression':
      return {
        t: node.type, operator: node.operator,
        left: canonicalNode(node.left, scope, state, references),
        right: canonicalNode(node.right, scope, state, references),
      }
    case 'UnaryExpression':
    case 'UpdateExpression':
      return {
        t: node.type, operator: node.operator, prefix: Boolean(node.prefix),
        argument: canonicalNode(node.argument, scope, state, references),
      }
    case 'ConditionalExpression':
      return {
        t: 'ConditionalExpression',
        test: canonicalNode(node.test, scope, state, references),
        consequent: canonicalNode(node.consequent, scope, state, references),
        alternate: canonicalNode(node.alternate, scope, state, references),
      }
    case 'CallExpression':
    case 'NewExpression':
      return {
        t: node.type,
        optional: Boolean(node.optional),
        callee: canonicalNode(node.callee, scope, state, references),
        arguments: node.arguments.map((argument) => canonicalNode(argument, scope, state, references)),
      }
    case 'MemberExpression':
      return {
        t: 'MemberExpression', optional: Boolean(node.optional), computed: Boolean(node.computed),
        object: canonicalNode(node.object, scope, state, references),
        property: node.computed
          ? canonicalNode(node.property, scope, state, references)
          : { t: 'PropertyName', name: node.property.name },
      }
    case 'ArrayExpression':
      return { t: 'ArrayExpression', elements: node.elements.map((element) => canonicalNode(element, scope, state, references)) }
    case 'ObjectExpression':
      return {
        t: 'ObjectExpression',
        properties: node.properties.map((property) => canonicalNode(property, scope, state, references)),
      }
    case 'Property':
      return {
        t: 'Property', kind: node.kind, method: Boolean(node.method), shorthand: Boolean(node.shorthand),
        computed: Boolean(node.computed),
        key: canonicalPropertyKey(node.key, scope, state, references, node.computed),
        value: canonicalNode(node.value, scope, state, references),
      }
    case 'TemplateLiteral':
      return {
        t: 'TemplateLiteral',
        quasis: node.quasis.map((quasi) => quasi.value.cooked?.length ? 'STRING' : 'STRING_EMPTY'),
        expressions: node.expressions.map((expression) => canonicalNode(expression, scope, state, references)),
      }
    case 'TaggedTemplateExpression':
      return { t: 'TaggedTemplateExpression', tag: canonicalNode(node.tag, scope, state, references), quasi: canonicalNode(node.quasi, scope, state, references) }
    case 'SequenceExpression':
      return { t: 'SequenceExpression', expressions: node.expressions.map((expression) => canonicalNode(expression, scope, state, references)) }
    case 'AwaitExpression':
    case 'YieldExpression':
    case 'SpreadElement':
      return { t: node.type, delegate: Boolean(node.delegate), argument: canonicalNode(node.argument, scope, state, references) }
    case 'ChainExpression':
      return { t: 'ChainExpression', expression: canonicalNode(node.expression, scope, state, references) }
    case 'EmptyStatement':
    case 'DebuggerStatement':
      return { t: node.type }
    case 'BreakStatement':
    case 'ContinueStatement':
      return { t: node.type, label: node.label?.name ?? null }
    case 'LabeledStatement':
      return { t: 'LabeledStatement', label: node.label.name, body: canonicalNode(node.body, scope, state, references) }
    case 'SwitchStatement':
      return {
        t: 'SwitchStatement', discriminant: canonicalNode(node.discriminant, scope, state, references),
        cases: node.cases.map((entry) => ({
          t: 'SwitchCase', test: canonicalNode(entry.test, scope, state, references),
          consequent: entry.consequent.map((statement) => canonicalNode(statement, scope, state, references)),
        })),
      }
    case 'TryStatement':
      return {
        t: 'TryStatement',
        block: canonicalNode(node.block, scope, state, references),
        handler: canonicalNode(node.handler, scope, state, references),
        finalizer: canonicalNode(node.finalizer, scope, state, references),
      }
    case 'CatchClause': {
      const catchScope = new Scope(scope, 'catch', state)
      for (const name of patternNames(node.param)) catchScope.define(name, 'catch')
      return {
        t: 'CatchClause', param: canonicalPattern(node.param, catchScope, state, references),
        body: canonicalNode(node.body, catchScope, state, references),
      }
    }
    default: {
      const result = { t: node.type }
      for (const key of Object.keys(node).sort()) {
        if (['type', 'start', 'end', 'loc', 'raw'].includes(key)) continue
        const value = node[key]
        result[key] = Array.isArray(value)
          ? value.map((entry) => entry?.type ? canonicalNode(entry, scope, state, references) : entry)
          : value?.type ? canonicalNode(value, scope, state, references) : value
      }
      return result
    }
  }
}

function declaredTopLevelBindingIds(statement, programScope) {
  if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') {
    return statement.id ? [programScope.resolve(statement.id.name)?.id].filter(Boolean) : []
  }
  if (statement.type !== 'VariableDeclaration') return []
  return statement.declarations.flatMap((declaration) => patternNames(declaration.id))
    .map((name) => programScope.resolve(name)?.id).filter(Boolean)
}

function testRootNames(tests) {
  const names = new Set()
  for (const testCase of tests ?? []) {
    const input = String(testCase?.input ?? '')
    try {
      const ast = parseProgram(input)
      const visit = (node, parent = null) => {
        if (!node || typeof node !== 'object') return
        if (node.type === 'CallExpression' && node.callee.type === 'Identifier') names.add(node.callee.name)
        for (const [key, value] of Object.entries(node)) {
          if (['start', 'end', 'loc'].includes(key) || value === parent) continue
          if (Array.isArray(value)) value.forEach((entry) => visit(entry, node))
          else if (value?.type) visit(value, node)
        }
      }
      visit(ast)
    } catch {
      for (const match of input.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) names.add(match[1])
    }
  }
  return names
}

function canonicalExpectedBehavior(value) {
  const text = String(value ?? '').trim()
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return { t: 'ExpectedNumber', value: Number(text) }
  if (/^(?:true|false)$/.test(text)) return { t: 'ExpectedBoolean', value: text === 'true' }
  if (text === 'null') return { t: 'ExpectedNull' }
  if (/^["'`].*["'`]$/s.test(text)) return { t: 'ExpectedString' }
  return { t: 'ExpectedText' }
}

function alphaNormalize(value, identities = new Map()) {
  if (Array.isArray(value)) return value.map((entry) => alphaNormalize(entry, identities))
  if (!value || typeof value !== 'object') return value
  const result = {}
  for (const [key, entry] of Object.entries(value)) {
    if ((key === 'binding' || key === 'ref') && typeof entry === 'string' && entry.startsWith('@binding:')) {
      if (!identities.has(entry)) identities.set(entry, `B${identities.size}`)
      result[key] = identities.get(entry)
    } else {
      result[key] = alphaNormalize(entry, identities)
    }
  }
  return result
}

function collectRepairLocations(value, path = [], enclosingFunction = 'PROGRAM', locations = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectRepairLocations(entry, [...path, index], enclosingFunction, locations))
    return locations
  }
  if (!value || typeof value !== 'object') return locations
  const nextFunction = value.t === 'FunctionDeclaration' && value.binding ? value.binding : enclosingFunction
  if (['AssignmentExpression', 'BinaryExpression', 'LogicalExpression', 'UpdateExpression', 'VariableDeclarator'].includes(value.t)) {
    const operation = sha256(JSON.stringify(value)).slice(0, 16)
    locations.push(`${nextFunction}:${path.join('.')}:${value.t}:${value.operator ?? ''}:${operation}`)
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'binding' || key === 'ref') continue
    collectRepairLocations(entry, [...path, key], nextFunction, locations)
  }
  return locations
}

function programStructure(program, tests = []) {
  let ast
  try {
    ast = parseProgram(program)
  } catch (error) {
    return {
      serialized: `PARSE_ERROR:${error.message}`,
      fingerprint: sha256(`PARSE_ERROR:${error.message}`),
      relevantStatements: 0,
      ignoredIrrelevantDeclarations: 0,
      repairLocations: [],
      parseError: error.message,
    }
  }

  const state = { nextBinding: 0 }
  const programScope = new Scope(null, 'program', state)
  predeclareStatements(ast.body, programScope)
  const descriptors = ast.body.map((statement, sourceIndex) => {
    const references = new Set()
    const canonical = canonicalNode(statement, programScope, state, references)
    const bindings = declaredTopLevelBindingIds(statement, programScope)
    return {
      statement, sourceIndex, canonical, references, bindings,
      pure: isPureTopLevelDeclaration(statement),
    }
  })
  const providerByBinding = new Map(descriptors.flatMap((descriptor) => descriptor.bindings.map((binding) => [binding, descriptor])))
  const descriptorByName = new Map()
  for (const descriptor of descriptors) {
    for (const binding of descriptor.bindings) {
      const named = [...programScope.bindings].find(([, candidate]) => candidate.id === binding)?.[0]
      if (named) descriptorByName.set(named, descriptor)
    }
  }

  const roots = new Set(descriptors.filter((descriptor) => !descriptor.pure))
  const namedTestRoots = [...testRootNames(tests)]
  for (const name of namedTestRoots) if (descriptorByName.has(name)) roots.add(descriptorByName.get(name))
  if (roots.size === 0) descriptors.forEach((descriptor) => roots.add(descriptor))
  const relevant = new Set(roots)
  const queue = [...roots]
  while (queue.length) {
    const descriptor = queue.pop()
    for (const reference of descriptor.references) {
      const provider = providerByBinding.get(reference)
      if (provider && !relevant.has(provider)) {
        relevant.add(provider)
        queue.push(provider)
      }
    }
  }

  const nodes = descriptors.filter((descriptor) => relevant.has(descriptor)).map((descriptor) => descriptor.canonical)
  const testCases = (tests ?? []).map((testCase) => canonicalExpectedBehavior(testCase?.expected))
  const declarationRoles = new Map()
  const roleCounts = new Map()
  for (const descriptor of descriptors) {
    if (descriptor.bindings.length === 0) continue
    const kind = descriptor.statement.type
    const ordinal = roleCounts.get(kind) ?? 0
    roleCounts.set(kind, ordinal + 1)
    for (const binding of descriptor.bindings) declarationRoles.set(binding, `${kind}:${ordinal}`)
  }
  const testRootRoles = namedTestRoots
    .map((name) => programScope.resolve(name)?.id)
    .filter(Boolean)
    .map((binding) => declarationRoles.get(binding))
    .filter(Boolean)
  const normalized = alphaNormalize({
    t: 'SemanticProgram', scope: 'program', nodes, tests: testCases, testRootRoles,
  })
  const serialized = JSON.stringify(normalized)
  return {
    serialized,
    fingerprint: sha256(serialized),
    relevantStatements: nodes.length,
    ignoredIrrelevantDeclarations: descriptors.filter((descriptor) => descriptor.pure && !relevant.has(descriptor)).length,
    repairLocations: collectRepairLocations(normalized),
    parseError: null,
  }
}

export function programFingerprints(program, tests = []) {
  const structure = programStructure(program, tests)
  return Object.freeze({
    semantic: structure.fingerprint,
    structure: structure.fingerprint,
    semanticTokens: structure.serialized.split(/(?=[{},:[\]])|(?<=[{},:[\]])/).filter(Boolean),
    structureTokens: structure.serialized.split(/(?=[{},:[\]])|(?<=[{},:[\]])/).filter(Boolean),
    relevantStatements: structure.relevantStatements,
    ignoredIrrelevantDeclarations: structure.ignoredIrrelevantDeclarations,
    repairLocations: structure.repairLocations,
    parseError: structure.parseError,
  })
}

function words(value) {
  return String(value).toLowerCase().match(/>=|<=|===|!==|==|!=|\+=|-=|\+|-|\*|\/|\b\d+(?:\.\d+)?\b|[a-z_$][\w$]*(?:\.[a-z_$][\w$]*)*/g) ?? []
}

export function normalizedRepairTokens(value) {
  const identifiers = new Map()
  let nextIdentifier = 0
  return words(value)
    .map((token) => TEXT_SYNONYMS.get(token) ?? token)
    .filter((token) => !TEXT_STOP_WORDS.has(token))
    .map((token) => {
      if (/^(?:>=|<=|===|!==|==|!=|\+=|-=|\+|-|\*|\/|\d)/.test(token)) return token
      if (['start', 'index', 'iteration', 'continue', 'keep', 'return', 'check', 'test', 'value', 'record', 'item', 'assignment', 'add'].includes(token)) return token
      if (!identifiers.has(token)) identifiers.set(token, `term${nextIdentifier++}`)
      return identifiers.get(token)
    })
}

function jaccard(left, right) {
  const a = new Set(left)
  const b = new Set(right)
  if (a.size === 0 || b.size === 0) return 0
  let overlap = 0
  for (const token of a) if (b.has(token)) overlap += 1
  return overlap / (a.size + b.size - overlap)
}

function repairOperationSignals(value) {
  const text = String(value).toLowerCase().replace(/\s+/g, ' ')
  const normalized = normalizedRepairTokens(value)
  const signals = new Set()
  if (/\b(?:index|position|cursor|counter|iteration)\b.{0,36}\b(?:0|zero)\b|\b(?:start|begin)\w*\b.{0,30}\b(?:0|zero)\b/.test(text)) signals.add('LOOP_INITIALIZER_ZERO')
  if (/(?:>=|at least|through)\s*(?:0|zero)\b/.test(text)) signals.add('INCLUSIVE_ZERO_BOUND')
  if (/\b(?:values?|items?)\s*\[\s*0\s*\]|\bfirst\s+(?:value|item|element)\b/.test(text)) signals.add('INITIALIZE_FROM_FIRST_ELEMENT')
  if (/\b(?:label|accessible name)\b/.test(text) && /\b(?:check|filter|inspect|use)\w*\b/.test(text)) signals.add('READ_LABEL_FIELD')
  if (/\b(?:current|latest|prior|previous)\b.{0,40}\b(?:delta|change|update)\b|\b(?:delta|change|update)\b.{0,40}\b(?:current|latest|prior|previous)\b/.test(text)) signals.add('ACCUMULATE_LATEST_STATE')
  if (/\bthis\.[a-z_$][\w$]*\b.{0,24}\b(?:amount|delta|change)\b/.test(text)) signals.add('ACCUMULATE_OBJECT_STATE')
  if (/\b(?:total|sum)\b.{0,30}\b(?:record|item)\b/.test(text)) signals.add('AGGREGATE_RECORD_FIELD')
  for (let index = 0; index < normalized.length - 2; index += 1) {
    if (['+', '-', '>=', '<=', '==', '==='].includes(normalized[index + 1])) {
      signals.add(`EXPRESSION:${normalized.slice(index, index + 3).join(':')}`)
    }
  }
  return signals
}

export function repairEquivalent(left, right) {
  const a = normalizedRepairTokens(left)
  const b = normalizedRepairTokens(right)
  if (a.length === 0 || b.length === 0) return { equivalent: false, similarity: 0, reason: 'EMPTY_REPAIR' }
  if (a.join(' ') === b.join(' ')) return { equivalent: true, similarity: 1, reason: 'NORMALIZED_REPAIR_EXACT' }
  const leftSignals = repairOperationSignals(left)
  const rightSignals = repairOperationSignals(right)
  const sharedSignal = [...leftSignals].find((signal) => rightSignals.has(signal))
  if (sharedSignal) return { equivalent: true, similarity: 1, reason: `SAME_REPAIR_OPERATION:${sharedSignal}` }
  const similarity = jaccard(a, b)
  return {
    equivalent: similarity >= 0.58,
    similarity,
    reason: similarity >= 0.58 ? 'REPAIR_SEMANTICS_EQUIVALENT' : 'REPAIR_MATERIALLY_DISTINCT',
  }
}

export function fixtureEquivalent(left, right) {
  const a = programStructure(left.starterCode, left.tests)
  const b = programStructure(right.starterCode, right.tests)
  if (a.parseError || b.parseError) {
    return { equivalent: false, reason: 'JAVASCRIPT_PARSE_FAILURE', leftParseError: a.parseError, rightParseError: b.parseError }
  }
  if (a.fingerprint !== b.fingerprint) {
    return { equivalent: false, reason: 'AST_SCOPE_BINDING_BEHAVIOR_DISTINCT' }
  }
  return {
    equivalent: true,
    reason: a.ignoredIrrelevantDeclarations || b.ignoredIrrelevantDeclarations
      ? 'DEPENDENCY_SLICED_AST_EQUIVALENT'
      : 'AST_SCOPE_BINDING_BEHAVIOR_EQUIVALENT',
    repairLocationMatch: JSON.stringify(a.repairLocations) === JSON.stringify(b.repairLocations),
  }
}

export function compareSolutionExposure(source, protectedTask) {
  const fixture = fixtureEquivalent(source, protectedTask)
  if (!fixture.equivalent) return { exposed: false, fixture, repair: null }
  const repairs = source.visibleSolutions.map((solution) => ({
    solution,
    result: repairEquivalent(solution, protectedTask.exactRepair),
  }))
  const matched = repairs.find((entry) => entry.result.equivalent)
  return {
    exposed: Boolean(matched),
    fixture,
    repair: matched?.result ?? repairs[0]?.result ?? null,
    matchedSolution: matched?.solution ?? null,
  }
}

function normalizedTaskText(value) {
  return words(value).map((token) => TEXT_SYNONYMS.get(token) ?? token).filter((token) => !TEXT_STOP_WORDS.has(token))
}

export function nonCodeSignatures(record) {
  const centralInput = JSON.stringify(canonicalJson(record.centralInput ?? {}))
  const taskIdentity = [record.taskType, ...normalizedTaskText(record.focus), ...normalizedTaskText(centralInput)]
  const artifact = normalizedTaskText(record.deliverable)
  const specification = normalizedTaskText(JSON.stringify(record.specification ?? []))
  return {
    taskIdentity: sha256(taskIdentity.join(' ')),
    artifact: sha256(artifact.join(' ')),
    specification: sha256(specification.join(' ')),
  }
}

export function compareNonCodeSolutionExposure(source, protectedTask) {
  const sourceSignatures = source.nonCodeSignatures ?? nonCodeSignatures(source)
  const protectedSignatures = protectedTask.nonCodeSignatures ?? nonCodeSignatures(protectedTask)
  const taskMatch = sourceSignatures.taskIdentity === protectedSignatures.taskIdentity
  const artifactMatch = sourceSignatures.artifact === protectedSignatures.artifact
  const specificationMatch = sourceSignatures.specification === protectedSignatures.specification
  if (!taskMatch || !artifactMatch || !specificationMatch) {
    return { exposed: false, reason: 'NON_CODE_TASK_REQUIRES_NEW_REASONING', taskMatch, artifactMatch, specificationMatch }
  }
  if (!protectedTask.expectedResponse) {
    return { exposed: false, reason: 'NO_FIXED_PROTECTED_RESPONSE_AUTHORITY', taskMatch, artifactMatch, specificationMatch }
  }
  const matches = source.visibleSolutions.map((solution) => responseEquivalent(solution, protectedTask.expectedResponse))
  const matched = matches.find((result) => result.equivalent)
  return {
    exposed: Boolean(matched),
    reason: matched ? 'NON_CODE_EXEMPLAR_DIRECTLY_SOLVES_DELIVERABLE' : 'NON_CODE_RESPONSE_MATERIALLY_DISTINCT',
    taskMatch,
    artifactMatch,
    specificationMatch,
    response: matched ?? matches[0] ?? null,
  }
}

function responseEquivalent(left, right) {
  const normalize = (value) => words(value)
    .map((token) => TEXT_SYNONYMS.get(token) ?? token)
    .filter((token) => !TEXT_STOP_WORDS.has(token))
  const a = normalize(left)
  const b = normalize(right)
  if (a.length === 0 || b.length === 0) return { equivalent: false, similarity: 0, reason: 'EMPTY_RESPONSE' }
  if (a.join(' ') === b.join(' ')) return { equivalent: true, similarity: 1, reason: 'FIXED_RESPONSE_EXACT' }
  const similarity = jaccard(a, b)
  const overlap = [...new Set(a)].filter((token) => new Set(b).has(token)).length
  const equivalent = overlap >= 3 && similarity >= 0.72
  return {
    equivalent,
    similarity,
    reason: equivalent ? 'FIXED_RESPONSE_PARAPHRASE' : 'RESPONSE_REQUIRES_INDEPENDENT_REASONING',
  }
}

function fixedAuthorityRefs(guide) {
  const refs = []
  function visit(value, path = [], fixedContext = false) {
    if (!value || typeof value !== 'object') return
    const marker = Object.entries(value).some(([key, entry]) =>
      /^(?:authority_kind|response_authority|scoring_authority_kind|type)$/i.test(key) && FIXED_AUTHORITY_MARKER.test(String(entry)))
    const inTrustedReference = path.at(-1) === 'trusted_solution_reference'
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = [...path, key]
      const fixedKey = FIXED_AUTHORITY_KEY.test(key)
      const authoritative = fixedContext || marker || inTrustedReference
      if (typeof entry === 'string' && (fixedKey || (authoritative && /(?:response|answer|conclusion|artifact|repair)/i.test(key)))) {
        if (entry.trim()) refs.push({ path: nextPath.join('.'), value: entry.trim(), key })
      } else if (Array.isArray(entry) && (fixedKey || authoritative)) {
        if (entry.length) refs.push({ path: nextPath.join('.'), value: JSON.stringify(canonicalJson(entry)), key })
      } else if (entry && typeof entry === 'object') {
        visit(entry, nextPath, authoritative || fixedKey)
      }
    }
  }
  visit(guide)
  return [...new Map(refs.map((entry) => [`${entry.path}\u0000${entry.value}`, entry])).values()]
}

export function classifySolutionAuthority({ material, guide, packageData = {} }) {
  const adultAuthorityRefs = fixedAuthorityRefs(guide ?? {})
  const learnerVisibleRefs = extractVisibleSolutionRefs(material)
  const setup = material?.activitySetup ?? packageData?.activity_setup ?? {}
  const isCode = setup.activity_kind === 'CODE_OR_DEBUG'
  const instructionalModel =
    (material?.workMode ?? packageData?.work_mode) === 'MODEL' &&
    (packageData?.scoring_stance ?? '') === 'FORMATIVE_NO_PENALTY' &&
    setup?.debugging_target?.solution_status === 'INSTRUCTIONAL_WORKED_EXAMPLE'
  const protectedTask = adultAuthorityRefs.length > 0 && !instructionalModel
  return {
    protected: protectedTask,
    analyzer: isCode ? 'JAVASCRIPT_SCOPE_BINDING_AST_R4' : 'NON_CODE_AUTHORITY_DELIVERABLE_R4',
    authorityKind: adultAuthorityRefs.length
      ? isCode ? 'EXECUTABLE_REPAIR_AUTHORITY' : 'FIXED_RESPONSE_OR_ARTIFACT_AUTHORITY'
      : 'OPEN_ENDED_RUBRIC_AUTHORITY',
    reason: protectedTask
      ? isCode ? 'PROTECTED_EXECUTABLE_REPAIR_AUTHORITY' : 'PROTECTED_DYNAMIC_FIXED_RESPONSE_AUTHORITY'
      : instructionalModel
        ? 'EXPLICIT_NON_PROTECTED_LABELLED_MODEL_FORMATIVE_NO_PENALTY'
        : 'EXPLICIT_NON_PROTECTED_OPEN_ENDED_RUBRIC_NO_FIXED_RESPONSE_AUTHORITY',
    expectedResponse: adultAuthorityRefs[0]?.value ?? '',
    adultAuthorityRefs,
    learnerVisibleRefs,
    inspectedLearnerAndAdultAuthority: true,
  }
}

export function findCoursePayloadExposures(records) {
  const byCourse = new Map()
  for (const record of records) {
    const bucket = byCourse.get(record.courseRef) ?? []
    bucket.push(record)
    byCourse.set(record.courseRef, bucket)
  }
  const exposures = []
  for (const [courseRef, courseRecords] of byCourse) {
    const protectedTasks = courseRecords.filter((record) => record.protected)
    const sources = courseRecords.filter((record) => record.visibleSolutions.length > 0)
    for (const protectedTask of protectedTasks) {
      for (const source of sources) {
        const comparison = protectedTask.analyzer === 'NON_CODE_AUTHORITY_DELIVERABLE_R4'
          ? compareNonCodeSolutionExposure(source, protectedTask)
          : compareSolutionExposure(source, protectedTask)
        if (comparison.exposed) {
          exposures.push({
            courseRef,
            protectedLessonId: protectedTask.lessonId,
            sourceLessonId: source.lessonId,
            sourceWorkMode: source.workMode,
            protectedScoringStance: protectedTask.scoringStance,
            analyzer: protectedTask.analyzer,
            ...comparison,
          })
        }
      }
    }
  }
  return exposures.sort((a, b) =>
    a.protectedLessonId.localeCompare(b.protectedLessonId) || a.sourceLessonId.localeCompare(b.sourceLessonId))
}

export function extractVisibleSolutionRefs(material) {
  const solutions = []
  const explicitSolutionKey = /(?:passing[_-]?change|corrected[_-]?(?:program|code)|worked[_-]?example|model[_-]?(?:answer|response)|solution|answer|exact[_-]?repair)/i
  const repairDisclosureCue = /\b(?:the\s+(?:fix|repair|solution)\s+is|change\b.{0,60}\bto\b|replace\b.{0,60}\bwith\b|assign\b.{0,60}\bback\b|(?:iteration|loop|index|position|counter)\s+(?:starts?|begins?|continues?)\b|use\s+if\s*\(|\bif\s*\([^)]*(?:>=|<=|===|==)[^)]*\)|\b(?:index|position)\s*(?:=|>=|<=)\s*-?\d+)/i

  function visit(value, path = []) {
    if (typeof value === 'string') {
      const key = path.at(-1) ?? ''
      if (explicitSolutionKey.test(key) || repairDisclosureCue.test(value)) solutions.push({ path: path.join('.'), value })
      return
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...path, String(index)]))
      return
    }
    if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) visit(entry, [...path, key])
    }
  }

  visit(material)
  return [...new Map(solutions.map((entry) => [`${entry.path}\u0000${entry.value}`, entry])).values()]
}

export function extractVisibleSolutions(material) {
  return [...new Set(extractVisibleSolutionRefs(material).map((entry) => entry.value))]
}

export function recordFromMaterial({
  material,
  courseRef,
  exactRepair,
  expectedResponse = '',
  protectedTask = false,
  scoringStance = '',
  taskType = '',
  focus = '',
  deliverable = '',
  authorityClassification = null,
}) {
  const setup = material?.activitySetup
  const analyzer = authorityClassification?.analyzer ?? (setup?.activity_kind === 'CODE_OR_DEBUG'
    ? 'JAVASCRIPT_SCOPE_BINDING_AST_R4'
    : 'NON_CODE_AUTHORITY_DELIVERABLE_R4')
  const record = {
    lessonId: material.lessonRef,
    courseRef,
    workMode: material.workMode,
    scoringStance,
    protected: authorityClassification?.protected ?? protectedTask,
    analyzer,
    authorityKind: authorityClassification?.authorityKind ?? null,
    authorityReason: authorityClassification?.reason ?? null,
    taskType,
    focus,
    deliverable,
    centralInput: setup?.central_input ?? {},
    specification: setup?.expected_behavior_and_specification ?? [],
    starterCode: setup?.central_input?.starter_code ?? '',
    tests: setup?.test_cases ?? [],
    exactRepair: exactRepair ?? authorityClassification?.expectedResponse ?? '',
    expectedResponse: expectedResponse || authorityClassification?.expectedResponse || '',
    visibleSolutionRefs: extractVisibleSolutionRefs(material),
    visibleSolutions: extractVisibleSolutions(material),
  }
  if (analyzer === 'NON_CODE_AUTHORITY_DELIVERABLE_R4') record.nonCodeSignatures = nonCodeSignatures(record)
  return record
}
