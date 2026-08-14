import { createHash } from 'node:crypto'

const JS_KEYWORDS = new Set([
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
  'new', 'null', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield',
])

const SEMANTIC_BUILTINS = new Set([
  'console', 'log', 'length', 'push', 'pop', 'shift', 'unshift', 'slice',
  'filter', 'map', 'reduce', 'find', 'some', 'every', 'join', 'trim',
  'tolowercase', 'touppercase', 'string', 'number', 'array', 'object', 'math',
])

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

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function lexProgram(program) {
  const source = String(program)
  const tokens = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]
    if (/\s/.test(char)) {
      index += 1
      continue
    }
    if (char === '/' && next === '/') {
      index = source.indexOf('\n', index + 2)
      if (index === -1) break
      continue
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2)
      index = end === -1 ? source.length : end + 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      const quote = char
      let value = quote
      index += 1
      while (index < source.length) {
        value += source[index]
        if (source[index] === '\\') {
          index += 1
          if (index < source.length) value += source[index]
        } else if (source[index] === quote) {
          index += 1
          break
        }
        index += 1
      }
      tokens.push({ kind: 'string', value })
      continue
    }
    const identifier = source.slice(index).match(/^[A-Za-z_$][\w$]*/)?.[0]
    if (identifier) {
      tokens.push({ kind: 'identifier', value: identifier })
      index += identifier.length
      continue
    }
    const number = source.slice(index).match(/^(?:\d+\.\d+|\d+)/)?.[0]
    if (number) {
      tokens.push({ kind: 'number', value: number })
      index += number.length
      continue
    }
    const operator = ['===', '!==', '>>>', '**=', '=>', '==', '!=', '<=', '>=',
      '++', '--', '+=', '-=', '*=', '/=', '&&', '||', '??', '**', '?.']
      .find((candidate) => source.startsWith(candidate, index))
    if (operator) {
      tokens.push({ kind: 'operator', value: operator })
      index += operator.length
      continue
    }
    tokens.push({ kind: 'punctuation', value: char })
    index += 1
  }
  return tokens
}

function splitTopLevelStatements(tokens) {
  const statements = []
  let start = 0
  let braces = 0
  let parentheses = 0
  let brackets = 0
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index].value
    if (token === '{') braces += 1
    else if (token === '}') braces -= 1
    else if (token === '(') parentheses += 1
    else if (token === ')') parentheses -= 1
    else if (token === '[') brackets += 1
    else if (token === ']') brackets -= 1
    const atTop = braces === 0 && parentheses === 0 && brackets === 0
    const declarationBlock = ['function', 'class'].includes(tokens[start]?.value)
    if (atTop && (token === ';' || (token === '}' && declarationBlock))) {
      statements.push(tokens.slice(start, index + 1))
      start = index + 1
    }
  }
  if (start < tokens.length) statements.push(tokens.slice(start))
  return statements.filter((statement) => statement.length > 0)
}

function declaredName(statement) {
  if (['const', 'let', 'var', 'function', 'class'].includes(statement[0]?.value)) {
    return statement.find((token, index) => index > 0 && token.kind === 'identifier')?.value ?? null
  }
  return null
}

function preliminaryShape(statement) {
  return statement.map((token) => {
    if (token.kind === 'string') return 'STRING'
    if (token.kind === 'number') return 'NUMBER'
    if (token.kind === 'identifier') {
      const lower = token.value.toLowerCase()
      return JS_KEYWORDS.has(lower) || SEMANTIC_BUILTINS.has(lower) ? lower : 'ID'
    }
    return token.value
  }).join(' ')
}

function isPureDeclaration(statement) {
  if (['function', 'class'].includes(statement[0]?.value)) return true
  if (!['const', 'let', 'var'].includes(statement[0]?.value)) return false
  const assignment = statement.findIndex((token) => token.value === '=')
  if (assignment === -1) return true
  for (let index = assignment + 1; index < statement.length; index += 1) {
    const token = statement[index]
    const next = statement[index + 1]
    if (['await', 'yield', 'new', '++', '--', '+=', '-=', '*=', '/='].includes(token.value)) return false
    if (token.kind === 'identifier' && next?.value === '(') return false
  }
  return true
}

function structureForStatement(statement, topLevelNames, ownName) {
  const identifiers = new Map()
  let nextIdentifier = 0
  return statement.map((token) => {
    if (token.kind === 'string') return 'STRING'
    if (token.kind === 'number') return 'NUMBER'
    if (token.kind !== 'identifier') return token.value
    const lower = token.value.toLowerCase()
    if (JS_KEYWORDS.has(lower) || SEMANTIC_BUILTINS.has(lower)) return lower
    if (token.value === ownName) return 'DECL'
    if (topLevelNames.has(token.value)) return 'TOP'
    if (!identifiers.has(token.value)) identifiers.set(token.value, `id${nextIdentifier++}`)
    return identifiers.get(token.value)
  }).join(' ')
}

function testRootNames(tests) {
  const names = new Set()
  for (const testCase of tests ?? []) {
    const tokens = lexProgram(testCase?.input ?? '')
    for (let index = 0; index < tokens.length - 1; index += 1) {
      if (tokens[index].kind === 'identifier' && tokens[index + 1].value === '(') names.add(tokens[index].value)
    }
  }
  return names
}

function programStructure(program, tests = []) {
  const statements = splitTopLevelStatements(lexProgram(program)).map((tokens, sourceIndex) => ({
    tokens,
    sourceIndex,
    name: declaredName(tokens),
    pure: isPureDeclaration(tokens),
  }))
  const byName = new Map(statements.filter((statement) => statement.name).map((statement) => [statement.name, statement]))
  const topLevelNames = new Set(byName.keys())
  for (const statement of statements) {
    statement.dependencies = new Set(statement.tokens
      .filter((token) => token.kind === 'identifier' && token.value !== statement.name && topLevelNames.has(token.value))
      .map((token) => token.value))
  }

  const roots = new Set(statements.filter((statement) => !statement.pure))
  for (const name of testRootNames(tests)) if (byName.has(name)) roots.add(byName.get(name))
  if (roots.size === 0) for (const statement of statements) roots.add(statement)
  const relevant = new Set(roots)
  const queue = [...roots]
  while (queue.length) {
    const statement = queue.pop()
    for (const dependency of statement.dependencies) {
      const provider = byName.get(dependency)
      if (provider && !relevant.has(provider)) {
        relevant.add(provider)
        queue.push(provider)
      }
    }
  }

  const nodes = [...relevant].map((statement) => ({
    ...statement,
    normalized: structureForStatement(statement.tokens, topLevelNames, statement.name),
  }))
  const independentDeclarations = nodes
    .filter((node) => node.pure && node.dependencies.size === 0)
    .sort((left, right) => left.normalized.localeCompare(right.normalized))
  const orderedNodes = nodes
    .filter((node) => !node.pure || node.dependencies.size > 0)
    .sort((left, right) => left.sourceIndex - right.sourceIndex)
  const serialized = [
    ...independentDeclarations.map((node) => `INDEPENDENT:${node.normalized}`),
    ...orderedNodes.map((node) => `${node.pure ? 'DEPENDENT' : 'EFFECT'}:${node.normalized}`),
  ].join('\n')
  return {
    serialized,
    fingerprint: sha256(serialized),
    relevantStatements: nodes.length,
    ignoredIrrelevantDeclarations: statements.filter((statement) => statement.pure && !relevant.has(statement)).length,
  }
}

function genericBehaviorTokens(value) {
  return lexProgram(value).map((token) => {
    if (token.kind === 'string') return 'STRING'
    if (token.kind === 'number') return 'NUMBER'
    if (token.kind === 'identifier') {
      const lower = token.value.toLowerCase()
      return JS_KEYWORDS.has(lower) || SEMANTIC_BUILTINS.has(lower) ? lower : 'ID'
    }
    return token.value
  })
}

function behaviorFingerprint(tests) {
  const cases = (tests ?? []).map((testCase) => {
    const input = genericBehaviorTokens(testCase?.input ?? '').join(' ')
    const expected = genericBehaviorTokens(testCase?.expected ?? '').join(' ')
    return `${input}=>${expected}`
  }).sort()
  return { fingerprint: sha256(cases.join('\n')), cases }
}

export function programFingerprints(program, tests = []) {
  const structure = programStructure(program, tests)
  return Object.freeze({
    semantic: structure.fingerprint,
    structure: structure.fingerprint,
    semanticTokens: structure.serialized.split(/\s+/).filter(Boolean),
    structureTokens: structure.serialized.split(/\s+/).filter(Boolean),
    relevantStatements: structure.relevantStatements,
    ignoredIrrelevantDeclarations: structure.ignoredIrrelevantDeclarations,
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
  const leftBehavior = behaviorFingerprint(left.tests)
  const rightBehavior = behaviorFingerprint(right.tests)
  if (a.fingerprint !== b.fingerprint) {
    return { equivalent: false, reason: 'PROGRAM_DEPENDENCY_STRUCTURE_DISTINCT', testBehaviorMatch: leftBehavior.fingerprint === rightBehavior.fingerprint }
  }
  return {
    equivalent: true,
    reason: a.ignoredIrrelevantDeclarations || b.ignoredIrrelevantDeclarations
      ? 'DEPENDENCY_SLICED_PROGRAM_EQUIVALENT'
      : 'PROGRAM_DEPENDENCY_STRUCTURE_EQUIVALENT',
    testBehaviorMatch: leftBehavior.fingerprint === rightBehavior.fingerprint,
    testBehaviorRole: 'CORROBORATING_NOT_BYPASS_AUTHORITY',
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

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]))
  }
  return value
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
  const matches = source.visibleSolutions.map((solution) => repairEquivalent(solution, protectedTask.expectedResponse))
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
        if (source.lessonId === protectedTask.lessonId) continue
        const comparison = protectedTask.analyzer === 'NON_CODE_DELIVERABLE_SEMANTICS_R3'
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
    a.protectedLessonId.localeCompare(b.protectedLessonId) || a.sourceLessonId.localeCompare(b.sourceLessonId),
  )
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
}) {
  const setup = material?.activitySetup
  const analyzer = setup?.activity_kind === 'CODE_OR_DEBUG'
    ? 'JAVASCRIPT_DEPENDENCY_SLICED_STRUCTURE_R3'
    : 'NON_CODE_DELIVERABLE_SEMANTICS_R3'
  const record = {
    lessonId: material.lessonRef,
    courseRef,
    workMode: material.workMode,
    scoringStance,
    protected: protectedTask,
    analyzer,
    taskType,
    focus,
    deliverable,
    centralInput: setup?.central_input ?? {},
    specification: setup?.expected_behavior_and_specification ?? [],
    starterCode: setup?.central_input?.starter_code ?? '',
    tests: setup?.test_cases ?? [],
    exactRepair: exactRepair ?? '',
    expectedResponse,
    visibleSolutionRefs: extractVisibleSolutionRefs(material),
    visibleSolutions: extractVisibleSolutions(material),
  }
  if (analyzer === 'NON_CODE_DELIVERABLE_SEMANTICS_R3') record.nonCodeSignatures = nonCodeSignatures(record)
  return record
}
