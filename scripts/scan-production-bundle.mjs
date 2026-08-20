import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const DEFAULT_DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const TEXT_EXTENSIONS = new Set([
  '.css', '.htm', '.html', '.js', '.json', '.map', '.mjs', '.svg', '.txt', '.webmanifest', '.xml',
])

const FORBIDDEN = [
  ['service-role credential', /(?:SUPABASE_SERVICE_ROLE_KEY|service[_-]?role[_-]?key)\s*[:=]\s*["'][A-Za-z0-9_.-]{16,}/i],
  ['provider secret key', /\b(?:sk_live|sk_test)_[A-Za-z0-9]{16,}/],
  ['JWT value', /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ['bearer token value', /Bearer\s+[A-Za-z0-9._~-]{24,}/i],
  ['raw parent PIN', /(?:["']parentPin["']|\bparentPin)\s*:\s*["']\d{4,12}["']/i],
  ['raw learner PIN', /(?:["']pin["']|\bpin)\s*:\s*["']\d{4,12}["']/i],
  ['correct-answer value', /(?:["'](?:correctAnswer|expectedAnswer|answerKey|answerIndex|scoringAuthorityRef)["']|\b(?:correctAnswer|expectedAnswer|answerKey|answerIndex|scoringAuthorityRef))\s*:\s*(?!null\b|false\b)["'\d[{]/i],
  ['repository package locator', /git\+[0-9a-f]{7,64}:[^\s"']+/i],
  ['server curriculum path', /curriculum-production[\\/]/i],
  ['server binding locator field', /(?:["'](?:productionPackageRef|productionSourceCommit)["']|\b(?:productionPackageRef|productionSourceCommit))\s*:/i],
  ['Windows developer path', /[A-Z]:\\(?:Users|ma-sec)\\[^"'\s]+/i],
  ['macOS developer path', /\/Users\/[a-z0-9._-]+\//i],
  ['Linux developer path', /\/home\/[a-z0-9._-]+\//i],
]

const DEV_ENDPOINT = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*)?/gi
const ALLOWED_LIBRARY_ENDPOINTS = new Set(['http://localhost:9999'])

async function textFiles(root) {
  const files = []
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(full)
      else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full)
    }
  }
  await visit(root)
  return files
}

export async function scanProductionBundle(root = DEFAULT_DIST) {
  let files
  try {
    files = await textFiles(root)
  } catch (cause) {
    if (cause && cause.code === 'ENOENT') throw new Error(`Production bundle is missing: ${root}`)
    throw cause
  }
  if (files.length === 0) throw new Error(`Production bundle has no text assets: ${root}`)

  const findings = []
  let bytes = 0
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    bytes += Buffer.byteLength(source)
    for (const [label, pattern] of FORBIDDEN) {
      if (pattern.test(source)) findings.push(`${path.relative(root, file)}: ${label}`)
    }
    for (const hit of source.match(DEV_ENDPOINT) ?? []) {
      if (!ALLOWED_LIBRARY_ENDPOINTS.has(hit)) findings.push(`${path.relative(root, file)}: dev endpoint ${hit}`)
    }
  }
  if (findings.length > 0) {
    throw new Error(`SEC-8 production bundle privacy scan failed:\n${[...new Set(findings)].join('\n')}`)
  }
  return Object.freeze({ files: files.length, bytes })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await scanProductionBundle(process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DIST)
  console.log(`SEC-8 bundle scan passed: ${result.files} files, ${result.bytes} bytes`)
}
