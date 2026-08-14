import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.env.VITE_FAMILY_PILOT_ENABLED !== 'true') {
  console.log(JSON.stringify({ status: 'NOT_APPLICABLE', reason: 'family-pilot-build-disabled' }, null, 2))
  process.exit(0)
}

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dist = join(root, 'dist')
const names = [
  'answerIndex', 'correctAnswer', 'expectedAnswer', 'acceptedAnswers',
  'solutionKey', 'answerKey', 'answerKeyMap', 'correctChoice', 'correctOption',
]
const namePattern = names.join('|')
const executableAuthority = new RegExp(
  String.raw`(?:\.|\?\.)\s*(?:${namePattern})\b|\[\s*['"](?:${namePattern})['"]\s*\]|(?:^|[,;{])\s*(?:['"](?:${namePattern})['"]|(?:${namePattern}))\s*:`,
  'm',
)
const serverImplementation = /production-item-resolver|scoreResolvedProductionItem|evaluateComputation|normalizeShortResponse/
const forbiddenDataKeys = new Set(names.map((name) => name.toLocaleLowerCase('en-US')))

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

function findDataAuthority(value, path = '$') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = findDataAuthority(value[index], `${path}[${index}]`)
      if (hit) return hit
    }
    return null
  }
  if (!value || typeof value !== 'object') return null
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenDataKeys.has(key.toLocaleLowerCase('en-US'))) return `${path}.${key}`
    const hit = findDataAuthority(child, `${path}.${key}`)
    if (hit) return hit
  }
  return null
}

const findings = []
const scanned = { chunks: 0, maps: 0, coursePayloads: 0, workers: 0 }
const occurrences = Object.fromEntries(names.map((name) => [name, 0]))
function countNames(source) {
  for (const name of names) occurrences[name] += source.match(new RegExp(name, 'gi'))?.length ?? 0
}
for (const path of files(dist)) {
  const file = relative(dist, path).replaceAll('\\', '/')
  if (path.endsWith('.js')) {
    scanned.chunks += 1
    if (/worker/i.test(file)) scanned.workers += 1
    const source = readFileSync(path, 'utf8')
    countNames(source)
    if (executableAuthority.test(source)) findings.push(`${file}: executable answer authority`)
    if (serverImplementation.test(source)) findings.push(`${file}: trusted resolver implementation`)
    continue
  }
  if (path.endsWith('.map')) {
    scanned.maps += 1
    const source = readFileSync(path, 'utf8')
    countNames(source)
    if (executableAuthority.test(source) || serverImplementation.test(source)) {
      findings.push(`${file}: source-map answer authority`)
    }
    continue
  }
  if (!path.endsWith('.json') || !file.includes('/courses/')) continue
  scanned.coursePayloads += 1
  const source = readFileSync(path, 'utf8')
  countNames(source)
  const hit = findDataAuthority(JSON.parse(source))
  if (hit) findings.push(`${file}: learner data authority at ${hit}`)
}

const result = {
  status: findings.length === 0 ? 'PASS' : 'FAIL',
  ...scanned,
  answerIndex: occurrences.answerIndex,
  correctAnswer: occurrences.correctAnswer,
  expectedAnswer: occurrences.expectedAnswer,
  authorityNameOccurrences: occurrences,
  admittedAuthority: findings.length,
  findings,
}
console.log(JSON.stringify(result, null, 2))
if (findings.length) process.exitCode = 1
