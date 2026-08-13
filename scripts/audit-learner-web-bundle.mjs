import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = 'dist'
if (!existsSync(root)) {
  console.error('LEARNER_WEB_BUNDLE_SECURITY FAIL: dist is missing')
  process.exit(1)
}

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt', '.webmanifest'])
const files = []
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (textExtensions.has(extname(path))) files.push(path)
  }
}
walk(root)

const rules = Object.freeze({
  adult_answer_authority: /(?:adultScoringAuthorityRef|answerAuthorityRef|restricted:adult)/i,
  answer_index: /\banswerIndex\b/,
  correct_answer_data: /\bcorrectAnswer\b/,
  answer_key_locator: /(?:answerKeyRef|answer[-_ ]?keys?)/i,
  scoring_locator: /(?:scoringAuthorityRef|scoringRef|scoring[-_ ]?guides?|\/scoring\/)/i,
  pin: /\bPIN\b/,
  tutor_transcript: /(?:tutorTranscript|tutor.{0,20}transcript|transcript.{0,20}tutor)/i,
  service_role: /(?:SUPABASE_SERVICE_ROLE_KEY|service[-_ ]?role|serviceRole)/i,
  localhost_production_dependency: /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)(?::\d+)?/i,
})

const findings = Object.fromEntries(Object.keys(rules).map((name) => [name, []]))
for (const path of files) {
  const contents = readFileSync(path, 'utf8')
  for (const [name, pattern] of Object.entries(rules)) {
    if (pattern.test(contents)) findings[name].push(relative(root, path))
  }
}

const counts = Object.fromEntries(Object.entries(findings).map(([name, paths]) => [name, paths.length]))
const failures = Object.entries(findings)
  .filter(([, paths]) => paths.length > 0)
  .map(([name, paths]) => ({ rule: name, files: paths }))
const report = {
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  filesScanned: files.length,
  counts,
  failures,
}
console.log(JSON.stringify(report, null, 2))
console.log(`LEARNER_WEB_BUNDLE_SECURITY ${report.status}`)
if (failures.length) process.exitCode = 1
