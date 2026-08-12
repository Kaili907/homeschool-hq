#!/usr/bin/env node
/**
 * Post-generation validator. Re-reads every emitted file (does not trust
 * generate.mjs's own in-memory bookkeeping) and checks:
 *
 *   - no-answer-leakage: packages/ never carries an answer/rubric-bearing key
 *   - manifest totals match the actual file count on disk
 *   - every item in the manifest reports productionReadiness READY
 *   - privacy scan re-run over every file on disk reports zero violations
 *
 * Run: node tooling/validate.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanDocument } from '../src/lib/privacyScan.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const FORBIDDEN_PACKAGE_KEYS = [
  'answer_or_scoring_guidance',
  'mastery_rule',
  'adaptive_tutor_routes',
  'masteryInterpretation',
  'rubricDimensions',
  'scoringGuidance',
  'guardianOrParentVisibility',
]

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = resolve(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (entry.endsWith('.json')) out.push(p)
  }
  return out
}

function main() {
  const errors = []
  const packageFiles = walk(resolve(ROOT, 'packages'))
  const guideFiles = walk(resolve(ROOT, 'scoring-guides'))
  let privacyViolations = 0
  let notReady = 0

  for (const file of packageFiles) {
    const doc = JSON.parse(readFileSync(file, 'utf8'))
    const label = file.replace(ROOT + '/', '')
    for (const key of FORBIDDEN_PACKAGE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(doc, key)) {
        errors.push(`${label}: forbidden answer-bearing key "${key}" leaked into a student package`)
      }
    }
    if (doc.productionReadiness?.status !== 'READY') notReady += 1
    privacyViolations += scanDocument(doc, label).length
  }

  for (const file of guideFiles) {
    const doc = JSON.parse(readFileSync(file, 'utf8'))
    const label = file.replace(ROOT + '/', '')
    privacyViolations += scanDocument(doc, label).length
  }

  if (packageFiles.length !== guideFiles.length) {
    errors.push(`package/scoring-guide count mismatch: ${packageFiles.length} packages vs ${guideFiles.length} scoring guides`)
  }

  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'corpus-manifest.json'), 'utf8'))
  if (manifest.totals.items !== packageFiles.length) {
    errors.push(`manifest totals.items (${manifest.totals.items}) does not match files on disk (${packageFiles.length})`)
  }
  if (notReady > 0) errors.push(`${notReady} package(s) do not report productionReadiness.status === READY`)
  if (privacyViolations > 0) errors.push(`${privacyViolations} privacy-scan violation(s) found on re-scan of files on disk`)

  console.log(`Checked ${packageFiles.length} packages + ${guideFiles.length} scoring guides.`)
  if (errors.length) {
    console.error(`\n${errors.length} VALIDATION FAILURE(S):`)
    for (const e of errors) console.error(` - ${e}`)
    process.exitCode = 1
  } else {
    console.log('All checks passed: no answer leakage, all READY, zero privacy-scan violations.')
  }
}

main()
