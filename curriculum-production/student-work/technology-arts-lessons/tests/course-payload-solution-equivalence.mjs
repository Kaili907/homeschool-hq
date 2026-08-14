import { createHash } from 'node:crypto'

const JS_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'null', 'of',
  'return', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try',
  'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield', 'async',
  'await', 'console', 'log', 'length', 'push', 'filter', 'reduce', 'trim',
])

const REPAIR_STOP_WORDS = new Set([
  'a', 'all', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'by', 'each',
  'for', 'from', 'has', 'in', 'is', 'it', 'makes', 'of', 'on', 'so', 'that',
  'the', 'then', 'this', 'three', 'to', 'uses', 'using', 'was', 'with',
])

const REPAIR_SYNONYMS = new Map([
  ['begins', 'start'], ['begin', 'start'], ['began', 'start'], ['starts', 'start'],
  ['starting', 'start'], ['initializes', 'start'], ['initializing', 'start'],
  ['initialise', 'start'], ['initialize', 'start'], ['continues', 'continue'],
  ['counter', 'index'], ['loop', 'iteration'], ['zero', '0'],
  ['retains', 'keep'], ['retained', 'keep'], ['keeps', 'keep'],
  ['returns', 'return'], ['returned', 'return'], ['checks', 'check'],
  ['checking', 'check'], ['tests', 'test'], ['values', 'value'],
  ['records', 'record'], ['items', 'item'], ['assignments', 'assignment'],
])

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function stripProgramNoise(program) {
  return String(program)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()
}

function programTokens(program, { eraseLiterals = false } = {}) {
  const clean = stripProgramNoise(program)
  const raw = clean.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|(?:\d+\.\d+|\d+)|[A-Za-z_$][\w$]*|===|!==|==|!=|<=|>=|=>|\+\+|--|\+=|-=|\*=|\/=|&&|\|\||\?\?|\*\*|[{}()[\].,;:+\-*/%<>=!?]/g) ?? []
  const identifiers = new Map()
  let nextIdentifier = 0
  return raw.map((token) => {
    if (/^["'`]/.test(token)) {
      return eraseLiterals ? 'STRING' : `STRING:${token.slice(1, -1).toLowerCase().replace(/\s+/g, ' ')}`
    }
    if (/^\d/.test(token)) return eraseLiterals ? 'NUMBER' : `NUMBER:${token}`
    if (/^[A-Za-z_$]/.test(token)) {
      const lower = token.toLowerCase()
      if (JS_WORDS.has(lower)) return lower
      if (!identifiers.has(lower)) identifiers.set(lower, `id${nextIdentifier++}`)
      return identifiers.get(lower)
    }
    return token
  })
}

export function programFingerprints(program) {
  const semanticTokens = programTokens(program)
  const structureTokens = programTokens(program, { eraseLiterals: true })
  return Object.freeze({
    semantic: sha256(semanticTokens.join(' ')),
    structure: sha256(structureTokens.join(' ')),
    semanticTokens,
    structureTokens,
  })
}

function words(value) {
  return String(value).toLowerCase().match(/>=|<=|===|!==|==|!=|\+=|-=|\+|-|\*|\/|\b\d+(?:\.\d+)?\b|[a-z_$][\w$]*(?:\.[a-z_$][\w$]*)*/g) ?? []
}

export function normalizedRepairTokens(value) {
  return words(value)
    .map((token) => REPAIR_SYNONYMS.get(token) ?? token)
    .filter((token) => !REPAIR_STOP_WORDS.has(token))
}

function jaccard(left, right) {
  const a = new Set(left)
  const b = new Set(right)
  if (a.size === 0 || b.size === 0) return 0
  let overlap = 0
  for (const token of a) if (b.has(token)) overlap += 1
  return overlap / (a.size + b.size - overlap)
}

function editSignals(value) {
  const text = String(value).toLowerCase().replace(/\s+/g, ' ')
  const signals = new Set()
  const patterns = [
    [/\b(?:index|position)\s*(?:=|at|from|to|starts? at|begins? at)\s*(-?\d+)\b/g, 'INDEX_VALUE'],
    [/\b(?:position|index)\s*(>=|<=|>|<)\s*(-?\d+)\b/g, 'INDEX_BOUND'],
    [/\b([a-z_$][\w$]*(?:\.[a-z_$][\w$]*)?)\s*(\+=|-=|=|\+|-)\s*([a-z_$][\w$]*(?:\.[a-z_$][\w$]*)?|\d+)\b/g, 'EXPRESSION'],
    [/\b(?:checks?|tests?|inspect(?:s|ing)?)\s+([a-z_$][\w$]*(?:\.[a-z_$][\w$]*)+)\b/g, 'FIELD'],
  ]
  for (const [pattern, kind] of patterns) {
    for (const match of text.matchAll(pattern)) {
      signals.add(`${kind}:${match.slice(1).join(':')}`)
    }
  }
  return signals
}

export function repairEquivalent(left, right) {
  const a = normalizedRepairTokens(left)
  const b = normalizedRepairTokens(right)
  if (a.length === 0 || b.length === 0) return { equivalent: false, similarity: 0, reason: 'EMPTY_REPAIR' }
  if (a.join(' ') === b.join(' ')) return { equivalent: true, similarity: 1, reason: 'NORMALIZED_REPAIR_EXACT' }
  const leftSignals = editSignals(left)
  const rightSignals = editSignals(right)
  const sharedSignal = [...leftSignals].find((signal) => rightSignals.has(signal))
  if (sharedSignal) return { equivalent: true, similarity: 1, reason: `SAME_EDIT:${sharedSignal}` }
  const similarity = jaccard(a, b)
  return {
    equivalent: similarity >= 0.52,
    similarity,
    reason: similarity >= 0.52 ? 'REPAIR_WORDING_EQUIVALENT' : 'REPAIR_MATERIALLY_DISTINCT',
  }
}

function normalizedTestTokens(tests, { eraseLiterals = false } = {}) {
  return (tests ?? []).flatMap((test) => {
    const tokens = words(`${test?.input ?? ''} ${test?.expected ?? ''}`)
    return tokens.map((token) => {
      if (eraseLiterals && /^\d/.test(token)) return 'NUMBER'
      return REPAIR_SYNONYMS.get(token) ?? token
    })
  })
}

export function fixtureEquivalent(left, right) {
  const a = programFingerprints(left.starterCode)
  const b = programFingerprints(right.starterCode)
  const starterReason = a.semantic === b.semantic
    ? 'NORMALIZED_STARTER_EXACT'
    : a.structure === b.structure
      ? 'STARTER_STRUCTURE_WITH_COSMETIC_FIXTURE_CHANGE'
      : null
  if (!starterReason) return { equivalent: false, reason: 'PROGRAM_STRUCTURE_DISTINCT', testSimilarity: 0 }
  const testSimilarity = jaccard(
    normalizedTestTokens(left.tests, { eraseLiterals: true }),
    normalizedTestTokens(right.tests, { eraseLiterals: true }),
  )
  return {
    equivalent: testSimilarity >= 0.5,
    reason: testSimilarity >= 0.5 ? starterReason : 'TEST_FIXTURE_MATERIALLY_DISTINCT',
    testSimilarity,
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
        const comparison = compareSolutionExposure(source, protectedTask)
        if (comparison.exposed) {
          exposures.push({
            courseRef,
            protectedLessonId: protectedTask.lessonId,
            sourceLessonId: source.lessonId,
            sourceWorkMode: source.workMode,
            protectedScoringStance: protectedTask.scoringStance,
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

export function extractVisibleSolutions(material) {
  const solutions = []
  const explicitSolutionKey = /(?:passing[_-]?change|corrected[_-]?(?:program|code)|solution|answer|exact[_-]?repair)/i
  const repairDisclosureCue = /\b(?:the\s+(?:fix|repair|solution)\s+is|change\b.{0,60}\bto\b|replace\b.{0,60}\bwith\b|assign\b.{0,60}\bback\b|(?:iteration|loop|index|position|counter)\s+(?:starts?|begins?|continues?)\b|use\s+if\s*\(|\bif\s*\([^)]*(?:>=|<=|===|==)[^)]*\)|\b(?:index|position)\s*(?:=|>=|<=)\s*-?\d+)/i

  function visit(value, path = []) {
    if (typeof value === 'string') {
      const key = path.at(-1) ?? ''
      if (explicitSolutionKey.test(key) || repairDisclosureCue.test(value)) solutions.push(value)
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
  return [...new Set(solutions)]
}

export function recordFromMaterial({ material, courseRef, exactRepair, protectedTask = false, scoringStance = '' }) {
  const setup = material?.activitySetup
  return {
    lessonId: material.lessonRef,
    courseRef,
    workMode: material.workMode,
    scoringStance,
    protected: protectedTask,
    starterCode: setup?.central_input?.starter_code ?? '',
    tests: setup?.test_cases ?? [],
    exactRepair: exactRepair ?? '',
    visibleSolutions: extractVisibleSolutions(material),
  }
}
