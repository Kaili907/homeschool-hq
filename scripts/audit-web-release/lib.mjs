import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

export const RULES = Object.freeze({
  answerAuthority: 'BROWSER_ANSWER_AUTHORITY',
  learnerPin: 'BROWSER_LEARNER_PIN_MATERIAL',
  tutorTranscript: 'BROWSER_RAW_TUTOR_TRANSCRIPT',
  serviceRole: 'BROWSER_SERVICE_ROLE_CREDENTIAL',
  localhost: 'BROWSER_LOCAL_DEV_ENDPOINT',
  functionSurface: 'NETLIFY_FUNCTION_SURFACE',
  quality: 'QUALITY_GATE_FAILURE',
  defaultOff: 'FAMILY_PILOT_DEFAULT_OFF',
  build: 'WEB_RELEASE_BUILD_FAILURE',
})

// This list is deliberately closed. Adding a handler is a security-surface change and
// must update this reviewable inventory in the same change.
export const ALLOWED_NETLIFY_FUNCTIONS = Object.freeze([
  'admin-access',
  'admin-audit',
  'admin-authorization',
  'admin-configuration',
  'admin-correlations',
  'admin-costs',
  'admin-curriculum',
  'admin-engine-performance',
  'admin-health',
  'admin-learners',
  'admin-overview',
  'admin-production-readiness',
  'admin-provider-pricing-terms',
  'admin-safety-operations',
  'admin-study-operations',
  'anthropic',
  'production-item-assessment',
  'study-academic-runtime',
  'study-adult-review',
  'study-adult-review-deliver',
  'study-adult-review-health',
  'study-adult-review-scheduled-worker',
  'study-adult-review-worker',
  'study-bound-content',
  'study-parent-notifications',
  'study-production-readiness',
  'study-safety-classify',
  'study-session-issue',
  'study-session-telemetry-deliver',
  'study-session-verify',
  'tts',
])

const ANSWER_FIELDS = new Set([
  'adultScoringAuthorityRef',
  'answerAuthorityRef',
  'answerIndex',
  'answerKey',
  'answerKeyRef',
  'correctAnswer',
  'correctChoice',
  'expectedAnswer',
  'restrictedAuthorityRef',
  'scoringAuthorityRef',
  'scoringRef',
])
const PIN_FIELDS = new Set(['learnerPin', 'parentPin', 'pin', 'pinDigest', 'pinDigests', 'rawPin', 'studentPin'])
const TRANSCRIPT_FIELDS = new Set([
  'rawTutorTranscript',
  'transcript',
  'transcriptText',
  'tutorChats',
  'tutorTranscript',
])
const SERVICE_ROLE_FIELDS = new Set([
  'serviceKey',
  'serviceRole',
  'serviceRoleCredential',
  'serviceRoleKey',
  'supabaseServiceRoleKey',
  'SUPABASE_SERVICE_ROLE_KEY',
])
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg', '.webmanifest'])
const FUNCTION_EXTENSIONS = new Set(['.cjs', '.js', '.mjs', '.ts'])
const ALLOWED_FUNCTION_DIRECTORY_METADATA = new Set(['README.md'])
const LOCAL_URL = /\bhttps?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:\/[^\s'"`]*)?/i
const ANSWER_LOCATOR = /(?:^|[/\\])(?:answer[-_ ]?keys?|scoring[-_ ]?(?:authority|guides?))(?:[/\\]|$)|^restricted:(?:adult|scoring)/i

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length
}

function add(findings, rule, file, detail, evidence, line = null) {
  const key = `${rule}\0${file}\0${line ?? ''}\0${evidence}`
  if (findings.some((finding) => finding.key === key)) return
  findings.push({ key, rule, file, line, detail, evidence })
}

function decodeQuoted(raw, quote) {
  if (quote === '"') {
    try { return JSON.parse(raw) } catch { return raw.slice(1, -1) }
  }
  return raw.slice(1, -1)
    .replace(/\\(['\\`])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
}

function regexCanStart(text, index) {
  let cursor = index - 1
  while (cursor >= 0 && /\s/.test(text[cursor])) cursor -= 1
  if (cursor < 0) return true
  if ('=(:,[!&|?{;'.includes(text[cursor])) return true
  if (text[cursor] === '>' && text[cursor - 1] === '=') return true
  const prefix = text.slice(0, cursor + 1).match(/([A-Za-z_$][\w$]*)$/)?.[1]
  return ['case', 'delete', 'return', 'throw', 'typeof', 'void', 'yield'].includes(prefix ?? '')
}

/**
 * Produces executable-only text with comments, strings, templates and regex
 * literals blanked. String tokens are returned separately with their syntactic
 * position so a denied-name list is not confused with an object field/access.
 */
export function lexExecutableJavaScript(text) {
  // Keep UTF-16 indices aligned with String#slice/match offsets even when a
  // minified bundle contains emoji or other surrogate pairs.
  const chars = text.split('')
  const strings = []
  let index = 0
  const blank = (start, end) => {
    for (let cursor = start; cursor < end; cursor += 1) {
      if (chars[cursor] !== '\n' && chars[cursor] !== '\r') chars[cursor] = ' '
    }
  }

  while (index < text.length) {
    const current = text[index]
    const next = text[index + 1]
    if (current === '/' && next === '/') {
      const start = index
      index += 2
      while (index < text.length && text[index] !== '\n') index += 1
      blank(start, index)
      continue
    }
    if (current === '/' && next === '*') {
      const start = index
      index += 2
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1
      index = Math.min(text.length, index + 2)
      blank(start, index)
      continue
    }
    if (current === '/' && next !== '/' && next !== '*' && regexCanStart(text, index)) {
      const start = index
      index += 1
      let inClass = false
      while (index < text.length) {
        if (text[index] === '\\') { index += 2; continue }
        if (text[index] === '[') inClass = true
        else if (text[index] === ']') inClass = false
        else if (text[index] === '/' && !inClass) {
          index += 1
          while (/[A-Za-z]/.test(text[index] ?? '')) index += 1
          break
        }
        if (text[index] === '\n') break
        index += 1
      }
      blank(start, index)
      continue
    }
    if (current === '"' || current === "'" || current === '`') {
      const quote = current
      const start = index
      index += 1
      while (index < text.length) {
        if (text[index] === '\\') { index += 2; continue }
        if (text[index] === quote) { index += 1; break }
        index += 1
      }
      const raw = text.slice(start, index)
      strings.push({
        start,
        end: index,
        value: decodeQuoted(raw, quote),
        quote,
      })
      blank(start, index)
      continue
    }
    index += 1
  }
  return { code: chars.join(''), strings }
}

function nextNonSpace(text, start) {
  let cursor = start
  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1
  return { char: text[cursor] ?? '', index: cursor }
}

function previousNonSpace(text, start) {
  let cursor = start
  while (cursor >= 0 && /\s/.test(text[cursor])) cursor -= 1
  return { char: text[cursor] ?? '', index: cursor }
}

function credentialShaped(value) {
  if (/^(?:sb_secret_|sk_(?:live|test)_|service_role[.:_-])[A-Za-z0-9._~-]{8,}$/i.test(value)) return true
  const parts = value.split('.')
  if (parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return false
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

function isValueBearingKey(text, token) {
  const after = nextNonSpace(text, token.end)
  if (after.char === ':') return true
  const before = previousNonSpace(text, token.start - 1)
  return before.char === '[' && after.char === ']'
}

function localhostIsRuntimeEndpoint(code, token) {
  const before = code.slice(Math.max(0, token.start - 180), token.start)
  const after = code.slice(token.end, Math.min(code.length, token.end + 100))
  return /(?:fetch|axios|endpoint|baseUrl|baseURL|origin|serverUrl|serverURL|createClient|WebSocket|EventSource|new\s+URL)\W{0,120}$/i.test(before) ||
    /^[\s,)};]*(?:\.then|\.json|\.text)?/.test(after) && /(?:fetch|URL|endpoint|client)/i.test(before)
}

function answerLocatorIsLive(code, token) {
  const before = code.slice(Math.max(0, token.start - 180), token.start)
  return /(?:answer|scoring|authority|correct|restricted)(?:Ref|Path|Url|URL|Locator)?\W{0,120}$/i.test(before) ||
    /(?:fetch|hasRestrictedAuthority|loadAuthority|resolveAuthority|return)\W{0,100}$/i.test(before)
}

function scanJavaScript(text, file, findings) {
  const { code, strings } = lexExecutableJavaScript(text)
  const tutorBearingModule = /(?:\/api\/anthropic|mode.{0,20}tutor|Tutor Core|tutorChats)/i.test(text)

  for (const name of ANSWER_FIELDS) {
    const pattern = new RegExp(`\\b${name}\\b`, 'g')
    for (const match of code.matchAll(pattern)) {
      add(findings, RULES.answerAuthority, file, 'Executable browser code carries or consumes correctness authority.', name, lineAt(text, match.index))
    }
  }
  for (const name of PIN_FIELDS) {
    const pattern = new RegExp(`\\b${name}\\b`, 'g')
    for (const match of code.matchAll(pattern)) {
      add(findings, RULES.learnerPin, file, 'Executable browser code carries learner/household PIN material.', name, lineAt(text, match.index))
    }
  }
  for (const name of TRANSCRIPT_FIELDS) {
    if (name === 'transcript' && !tutorBearingModule) continue
    const pattern = new RegExp(`\\b${name}\\b`, 'g')
    for (const match of code.matchAll(pattern)) {
      add(findings, RULES.tutorTranscript, file, 'Executable browser code carries raw Tutor conversation material.', name, lineAt(text, match.index))
    }
  }
  for (const name of SERVICE_ROLE_FIELDS) {
    const pattern = new RegExp(`\\b${name}\\b`, 'g')
    for (const match of code.matchAll(pattern)) {
      add(findings, RULES.serviceRole, file, 'Executable browser code carries a service-role credential field.', name, lineAt(text, match.index))
    }
  }

  for (const token of strings) {
    const value = token.value
    const valueBearingKey = isValueBearingKey(text, token)
    if (valueBearingKey && ANSWER_FIELDS.has(value)) {
      add(findings, RULES.answerAuthority, file, 'A quoted executable property carries or consumes correctness authority.', value, lineAt(text, token.start))
    }
    if (valueBearingKey && PIN_FIELDS.has(value)) {
      add(findings, RULES.learnerPin, file, 'A quoted executable property carries PIN material.', value, lineAt(text, token.start))
    }
    if (valueBearingKey && TRANSCRIPT_FIELDS.has(value) && (value !== 'transcript' || tutorBearingModule)) {
      add(findings, RULES.tutorTranscript, file, 'A quoted executable property carries raw Tutor conversation material.', value, lineAt(text, token.start))
    }
    if (valueBearingKey && SERVICE_ROLE_FIELDS.has(value)) {
      add(findings, RULES.serviceRole, file, 'A quoted executable property accesses a service-role credential.', value, lineAt(text, token.start))
    }
    if (ANSWER_LOCATOR.test(value) && answerLocatorIsLive(code, token)) {
      add(findings, RULES.answerAuthority, file, 'Browser output contains a live adult answer/scoring locator.', value.slice(0, 120), lineAt(text, token.start))
    }
    if (credentialShaped(value)) {
      add(findings, RULES.serviceRole, file, 'Browser output contains a service-role credential-shaped value.', '[redacted credential shape]', lineAt(text, token.start))
    }
    if (LOCAL_URL.test(value) && localhostIsRuntimeEndpoint(code, token)) {
      add(findings, RULES.localhost, file, 'Production browser code depends on a loopback/dev-only runtime endpoint.', value.slice(0, 120), lineAt(text, token.start))
    }
  }
}

function jsonScalarIsPresent(value) {
  return value !== null && value !== undefined && value !== false && value !== ''
}

function scanJsonValue(value, file, findings, path = '$', tutorContext = false) {
  if (typeof value === 'string') {
    if (ANSWER_LOCATOR.test(value) && /(?:answer|scoring|authority|resourceRefs?|locator|path|url)/i.test(path)) {
      add(findings, RULES.answerAuthority, file, 'Browser JSON contains an adult answer/scoring locator.', `${path}=${value.slice(0, 100)}`)
    }
    if (credentialShaped(value)) add(findings, RULES.serviceRole, file, 'Browser JSON contains a service-role credential-shaped value.', `${path}=[redacted]`)
    if (LOCAL_URL.test(value) && /(?:endpoint|baseurl|origin|server|url)$/i.test(path)) {
      add(findings, RULES.localhost, file, 'Browser JSON config requires a loopback/dev-only endpoint.', `${path}=${value.slice(0, 100)}`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanJsonValue(item, file, findings, `${path}[${index}]`, tutorContext))
    return
  }
  if (!value || typeof value !== 'object') return
  const nextTutorContext = tutorContext || Object.keys(value).some((key) => /tutor/i.test(key))
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`
    if (ANSWER_FIELDS.has(key) && jsonScalarIsPresent(child)) {
      add(findings, RULES.answerAuthority, file, 'Browser JSON carries executable correctness authority.', childPath)
    }
    if (PIN_FIELDS.has(key) && jsonScalarIsPresent(child)) {
      add(findings, RULES.learnerPin, file, 'Browser JSON carries learner/household PIN material.', childPath)
    }
    if (TRANSCRIPT_FIELDS.has(key) && (key !== 'transcript' || nextTutorContext) && jsonScalarIsPresent(child)) {
      add(findings, RULES.tutorTranscript, file, 'Browser JSON carries raw Tutor conversation material.', childPath)
    }
    if (SERVICE_ROLE_FIELDS.has(key) && jsonScalarIsPresent(child)) {
      add(findings, RULES.serviceRole, file, 'Browser JSON carries a service-role credential field.', childPath)
    }
    scanJsonValue(child, file, findings, childPath, nextTutorContext)
  }
}

function walkFiles(directory) {
  const files = []
  if (!existsSync(directory)) return files
  for (const name of readdirSync(directory).sort()) {
    const file = join(directory, name)
    if (statSync(file).isDirectory()) files.push(...walkFiles(file))
    else files.push(file)
  }
  return files
}

export function scanBrowserOutput(root) {
  const findings = []
  if (!existsSync(root)) {
    add(findings, RULES.build, relative(process.cwd(), root) || root, 'Browser output directory is missing.', 'dist missing')
    return { filesScanned: 0, findings: findings.map(({ key: _key, ...finding }) => finding) }
  }
  const files = walkFiles(root).filter((file) => TEXT_EXTENSIONS.has(extname(file).toLowerCase()))
  for (const absolute of files) {
    const file = relative(root, absolute)
    const text = readFileSync(absolute, 'utf8')
    if (extname(absolute) === '.json' || extname(absolute) === '.webmanifest') {
      try { scanJsonValue(JSON.parse(text), file, findings) } catch { scanJavaScript(text, file, findings) }
    } else if (extname(absolute) === '.js' || extname(absolute) === '.mjs') {
      scanJavaScript(text, file, findings)
    } else {
      for (const match of text.matchAll(new RegExp(LOCAL_URL.source, 'gi'))) {
        if (/(?:endpoint|baseurl|fetch|websocket)/i.test(text.slice(Math.max(0, match.index - 100), match.index))) {
          add(findings, RULES.localhost, file, 'Browser asset config requires a loopback/dev-only endpoint.', match[0], lineAt(text, match.index))
        }
      }
      for (const match of text.matchAll(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
        if (credentialShaped(match[0])) add(findings, RULES.serviceRole, file, 'Browser asset contains a service-role credential-shaped value.', '[redacted credential shape]', lineAt(text, match.index))
      }
    }
  }
  return {
    filesScanned: files.length,
    findings: findings.map(({ key: _key, ...finding }) => finding),
  }
}

function filesystemEntryKind(stat) {
  if (stat.isSymbolicLink()) return 'symbolic-link'
  if (stat.isFile()) return 'regular-file'
  if (stat.isDirectory()) return 'directory'
  if (stat.isFIFO()) return 'fifo'
  if (stat.isSocket()) return 'socket'
  if (stat.isBlockDevice()) return 'block-device'
  if (stat.isCharacterDevice()) return 'character-device'
  return 'other'
}

export function inspectNetlifyFunctionSurface(functionsRoot, allowlist = ALLOWED_NETLIFY_FUNCTIONS) {
  const findings = []
  const candidates = []
  const entries = []
  const forbiddenEntries = []
  const allowed = new Set(allowlist)
  const allowedFiles = new Set(allowlist.map((name) => `${name}.js`))
  let rootKind = 'missing'
  try {
    rootKind = filesystemEntryKind(lstatSync(functionsRoot))
  } catch {
    // Missing/unreadable roots remain a closed missing inventory.
  }
  const directoryPresent = rootKind === 'directory'

  if (rootKind !== 'missing' && !directoryPresent) {
    forbiddenEntries.push(Object.freeze({
      file: '.', kind: rootKind, callable: false, permitted: false, name: null,
    }))
  }

  if (directoryPresent) {
    for (const file of readdirSync(functionsRoot).sort()) {
      const stat = lstatSync(join(functionsRoot, file))
      const kind = filesystemEntryKind(stat)
      const extension = extname(file)
      const callable = kind === 'regular-file' && FUNCTION_EXTENSIONS.has(extension)
      const name = callable ? file.slice(0, -extension.length) : null
      const permitted = kind === 'regular-file' &&
        (allowedFiles.has(file) || ALLOWED_FUNCTION_DIRECTORY_METADATA.has(file))
      const entry = Object.freeze({ file, kind, callable, permitted, name })
      entries.push(entry)
      if (callable) candidates.push({ name, file })
      if (!permitted) forbiddenEntries.push(entry)
    }
  }

  for (const entry of forbiddenEntries) {
    add(
      findings,
      RULES.functionSurface,
      entry.file,
      entry.kind === 'regular-file'
        ? 'The callable directory contains an unexpected regular entry.'
        : `The callable directory contains a forbidden ${entry.kind} entry.`,
      `${entry.kind}:${entry.file}`,
    )
  }
  for (const candidate of candidates) {
    const helperOrTest = /(?:^|[._-])(?:test|spec|fixture|helper)(?:[._-]|$)/i.test(candidate.name) ||
      /(?:resolver|helper)$/i.test(candidate.name)
    if ((helperOrTest || !allowed.has(candidate.name)) &&
      !forbiddenEntries.some((entry) => entry.file === candidate.file)) {
      add(
        findings,
        RULES.functionSurface,
        candidate.file,
        helperOrTest
          ? 'A test/helper file would be emitted as a callable Netlify function.'
          : 'A callable Netlify function is not explicitly allowlisted.',
        candidate.name,
      )
    }
  }
  for (const required of allowlist) {
    if (!candidates.some((candidate) => candidate.name === required)) {
      add(findings, RULES.functionSurface, relative(process.cwd(), functionsRoot), 'An allowlisted Netlify entrypoint is missing.', required)
    }
  }
  return {
    directoryPresent,
    entries,
    callable: candidates.map((candidate) => candidate.name).sort(),
    allowlisted: [...allowlist],
    forbiddenEntries,
    findings: findings.map(({ key: _key, ...finding }) => finding),
  }
}

export function configuredNetlifyFunctionsPath(configText) {
  let section = ''
  for (const line of configText.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (/^\[.+\]$/.test(trimmed)) section = trimmed
    if (section !== '[build]') continue
    const match = trimmed.match(/^functions\s*=\s*["']([^"']+)["']$/)
    if (match) return match[1]
  }
  return 'netlify/functions'
}

export function inspectFamilyPilotDefaultOff(configText, flagSourceText) {
  const findings = []
  let section = ''
  const assignments = []
  for (const [index, line] of configText.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (/^\[.+\]$/.test(trimmed)) section = trimmed
    const match = trimmed.match(/^VITE_FAMILY_PILOT_ENABLED\s*=\s*(.+)$/)
    if (match) assignments.push({ section, value: match[1].trim(), line: index + 1 })
  }
  if (assignments.length === 0) {
    add(findings, RULES.defaultOff, 'netlify.toml', 'The pilot needs an explicit named-branch assignment.', 'assignments=0')
  }
  for (const assignment of assignments) {
    if (!/^\[context\."[^"]+"\.environment\]$/.test(assignment.section) || assignment.value !== '"true"') {
      add(findings, RULES.defaultOff, 'netlify.toml', 'The pilot may be enabled only by the exact literal in one named branch context.', `${assignment.section} ${assignment.value}`, assignment.line)
    }
  }

  const source = lexExecutableJavaScript(flagSourceText).code
  const exactLiteralCheck = /function\s+isFamilyPilotEnabled\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{\s*return\s+[A-Za-z_$][\w$]*\s*===\s*['"]true['"]\s*;?\s*\}/.test(flagSourceText)
  if (!exactLiteralCheck || /Boolean\s*\(|!!/.test(source)) {
    add(findings, RULES.defaultOff, 'src/study/familyPilotFlag.ts', 'The host flag must enable only on exact literal true.', 'strict-literal-check-missing')
  }
  return { assignments, findings: findings.map(({ key: _key, ...finding }) => finding) }
}

export function defaultCommandRunner(command, options = {}) {
  return spawnSync(command, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    shell: true,
    stdio: 'inherit',
  }).status ?? 1
}

export function runRequiredCommand(command, runner, options = {}) {
  const status = runner(command, options)
  return { command, status, passed: status === 0 }
}

export function summarizeFindings(findings) {
  const byRule = {}
  for (const finding of findings) byRule[finding.rule] = (byRule[finding.rule] ?? 0) + 1
  return byRule
}
