#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.map', '.svg', '.txt', '.webmanifest',
])

// This inventory is intentionally wider than the R2 gate. In particular,
// pinDigest also counts the emitted plural property name, pinDigests.
export const EXPANDED_TERMS = Object.freeze({
  answerIndex: /\banswerIndex\b/g,
  correctAnswer: /\bcorrectAnswer\b/g,
  expectedAnswer: /\bexpectedAnswer\b/g,
  PIN: /\bPIN\b/g,
  pinDigest: /\bpinDigests?\b/g,
  Tutor: /\bTutor\b/g,
  transcript: /transcript/gi,
  service_role: /\bservice_role\b/gi,
  'service-role': /\bservice-role\b/gi,
  localhost: /\blocalhost\b/gi,
  '127.0.0.1': /127\.0\.0\.1/g,
})

// Exact rules recovered from Learner Web Release R2.
export const R2_RULES = Object.freeze({
  adult_answer_authority: /(?:adultScoringAuthorityRef|answerAuthorityRef|restricted:adult)/gi,
  answer_index: /\banswerIndex\b/g,
  correct_answer_data: /\bcorrectAnswer\b/g,
  answer_key_locator: /(?:answerKeyRef|answer[-_ ]?keys?)/gi,
  scoring_locator: /(?:scoringAuthorityRef|scoringRef|scoring[-_ ]?guides?|\/scoring\/)/gi,
  pin: /\bPIN\b/g,
  tutor_transcript: /(?:tutorTranscript|tutor.{0,20}transcript|transcript.{0,20}tutor)/gi,
  service_role: /(?:SUPABASE_SERVICE_ROLE_KEY|service[-_ ]?role|serviceRole)/gi,
  localhost_production_dependency: /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)(?::\d+)?/gi,
})

function argumentsFor(argv) {
  const result = { root: 'dist', maps: null, pretty: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--root') result.root = argv[++index]
    else if (argument === '--maps') result.maps = argv[++index]
    else if (argument === '--pretty') result.pretty = true
    else throw new Error(`Unknown argument: ${argument}`)
  }
  return result
}

function textFiles(root) {
  const files = []
  function walk(directory) {
    for (const name of readdirSync(directory).sort()) {
      const file = join(directory, name)
      if (statSync(file).isDirectory()) walk(file)
      else if (TEXT_EXTENSIONS.has(extname(file))) files.push(file)
    }
  }
  walk(root)
  return files
}

function fresh(pattern) {
  return new RegExp(pattern.source, pattern.flags)
}

function matches(contents, pattern) {
  return [...contents.matchAll(fresh(pattern))]
}

function scanRules(root, files, rules) {
  const terms = {}
  const uniqueFiles = new Set()
  let totalOccurrences = 0
  let fileRuleHits = 0

  for (const [name, pattern] of Object.entries(rules)) {
    const findings = []
    let occurrences = 0
    for (const file of files) {
      const count = matches(readFileSync(file, 'utf8'), pattern).length
      if (count === 0) continue
      const path = relative(root, file)
      findings.push({ path, count })
      uniqueFiles.add(path)
      occurrences += count
      fileRuleHits += 1
    }
    totalOccurrences += occurrences
    terms[name] = { occurrences, fileCount: findings.length, files: findings }
  }

  return {
    totalOccurrences,
    fileRuleHits,
    uniqueFileCount: uniqueFiles.size,
    uniqueFiles: [...uniqueFiles].sort(),
    terms,
  }
}

function lineStarts(contents) {
  const starts = [0]
  for (let index = 0; index < contents.length; index += 1) {
    if (contents.charCodeAt(index) === 10) starts.push(index + 1)
  }
  return starts
}

function generatedPosition(starts, offset) {
  let low = 0
  let high = starts.length
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (starts[middle] <= offset) low = middle
    else high = middle
  }
  return { line: low + 1, column: offset - starts[low] }
}

async function sourceMapProvenance(root, mapsRoot, files) {
  const { TraceMap, originalPositionFor } = await import('@jridgewell/trace-mapping')
  const grouped = new Map()
  let mappedOccurrences = 0
  let unresolvedOccurrences = 0

  for (const file of files.filter((candidate) => extname(candidate) === '.js')) {
    const bundlePath = relative(root, file)
    const mapPath = join(mapsRoot, `${bundlePath}.map`)
    if (!existsSync(mapPath)) continue
    const contents = readFileSync(file, 'utf8')
    const starts = lineStarts(contents)
    const traceMap = new TraceMap(JSON.parse(readFileSync(mapPath, 'utf8')))

    for (const [token, pattern] of Object.entries(EXPANDED_TERMS)) {
      for (const match of matches(contents, pattern)) {
        const generated = generatedPosition(starts, match.index)
        const original = originalPositionFor(traceMap, generated)
        if (!original.source || !original.line) {
          unresolvedOccurrences += 1
          continue
        }
        mappedOccurrences += 1
        const source = original.source.replace(/^.*\/mac-web-sensitive-token-provenance-r1\//, '')
        const key = `${token}\u0000${bundlePath}\u0000${source}`
        const entry = grouped.get(key) ?? {
          token,
          bundle: bundlePath,
          source,
          count: 0,
          sourceLines: new Set(),
        }
        entry.count += 1
        entry.sourceLines.add(original.line)
        grouped.set(key, entry)
      }
    }
  }

  return {
    mappedOccurrences,
    unresolvedOccurrences,
    groups: [...grouped.values()]
      .map((entry) => ({ ...entry, sourceLines: [...entry.sourceLines].sort((a, b) => a - b) }))
      .sort((left, right) => (
        left.token.localeCompare(right.token) ||
        left.bundle.localeCompare(right.bundle) ||
        left.source.localeCompare(right.source)
      )),
  }
}

export async function audit(options = {}) {
  const root = resolve(options.root ?? 'dist')
  if (!existsSync(root)) throw new Error(`Build output is missing: ${root}`)
  const files = textFiles(root)
  const expanded = scanRules(root, files, EXPANDED_TERMS)
  const r2 = scanRules(root, files, R2_RULES)
  const maps = options.maps
    ? await sourceMapProvenance(root, resolve(options.maps), files)
    : null
  return {
    schemaVersion: 1,
    root,
    filesScanned: files.length,
    expanded,
    r2,
    sourceMapProvenance: maps,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    const options = argumentsFor(process.argv.slice(2))
    const report = await audit(options)
    process.stdout.write(`${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`)
  } catch (error) {
    process.stderr.write(`WEB_SENSITIVE_PROVENANCE_AUDIT_ERROR: ${error instanceof Error ? error.message : error}\n`)
    process.exitCode = 1
  }
}
