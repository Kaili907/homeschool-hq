#!/usr/bin/env node
/**
 * Independent, dependency-free check of the generated corpus: file counts,
 * required fields, the same specificity floor the shared production-quality
 * gate applies, no duplicate project briefs, and the privacy/copyright/
 * authorship constraints this session was scoped to. Run with:
 *   node tests/validate-corpus.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COURSES } from '../src/courses.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const failures = []
function check(condition, message) {
  if (!condition) failures.push(message)
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

let totalPackages = 0
let totalGuides = 0
const seenBriefs = new Set()

for (const course of COURSES) {
  const packagesDir = resolve(ROOT, 'packages', course.subjectKey, course.gradeDir)
  const scoringDir = resolve(ROOT, 'scoring-guides', course.subjectKey, course.gradeDir)

  const packageFiles = readdirSync(packagesDir).filter((f) => f.endsWith('.task-package.json'))
  const scoringFiles = readdirSync(scoringDir).filter((f) => f.endsWith('.scoring-guide.json'))

  check(
    packageFiles.length === 6,
    `${course.subjectKey} grade ${course.grade}: expected 6 task packages, found ${packageFiles.length}`,
  )
  check(
    scoringFiles.length === 6,
    `${course.subjectKey} grade ${course.grade}: expected 6 scoring guides, found ${scoringFiles.length}`,
  )

  for (const file of packageFiles) {
    totalPackages += 1
    const unitId = file.replace('.task-package.json', '')
    const pkg = JSON.parse(readFileSync(resolve(packagesDir, file), 'utf8'))
    const guidePath = resolve(scoringDir, `${unitId}.scoring-guide.json`)
    const guide = JSON.parse(readFileSync(guidePath, 'utf8'))
    totalGuides += 1

    check(pkg.unit_id === unitId, `${unitId}: unit_id field does not match filename`)
    check(guide.unit_id === unitId, `${unitId}: scoring guide unit_id does not match filename`)

    // Specificity floor (mirrors src/curriculum/production-quality/specificity.ts).
    check(wordCount(pkg.project_brief) >= 25, `${unitId}: project_brief under 25-word specificity floor`)
    check(wordCount(pkg.remediation) >= 25, `${unitId}: remediation under 25-word specificity floor`)
    check(wordCount(pkg.extension) >= 25, `${unitId}: extension under 25-word specificity floor`)

    // No duplicate project briefs across the whole corpus.
    check(!seenBriefs.has(pkg.project_brief), `${unitId}: project_brief duplicates another unit's brief`)
    seenBriefs.add(pkg.project_brief)

    // Subject-specific required content.
    if (pkg.subject === 'technology') {
      check(Array.isArray(pkg.test_or_check_criteria) && pkg.test_or_check_criteria.length >= 4, `${unitId}: missing/short test_or_check_criteria`)
      check(!!pkg.presentation_and_privacy?.sandbox_and_credentials_note, `${unitId}: missing sandbox_and_credentials_note`)
      const combined = JSON.stringify(pkg)
      const secretLikePattern = /\b(sk-[a-zA-Z0-9]{10,}|AKIA[0-9A-Z]{12,}|ghp_[a-zA-Z0-9]{20,}|[A-Za-z0-9+/]{32,}={0,2})\b/
      check(!secretLikePattern.test(combined), `${unitId}: possible actual secret/credential-shaped string in generated content`)
    } else if (pkg.subject === 'arts-music') {
      check(Array.isArray(pkg.critique_criteria) && pkg.critique_criteria.length >= 4, `${unitId}: missing/short critique_criteria`)
      check(!!pkg.presentation_and_privacy?.presentation_options, `${unitId}: missing presentation_options`)
      check(!!pkg.presentation_and_privacy?.text_or_no_audio_alternative, `${unitId}: missing text_or_no_audio_alternative`)
      const sentences = `${pkg.presentation_and_privacy.presentation_options} ${pkg.presentation_and_privacy.text_or_no_audio_alternative}`.split(/(?<=[.!?])\s+/)
      const badSentence = sentences.find((s) => /\brequired\b/i.test(s) && /\b(public|record|camera|photo)\b/i.test(s) && !/\b(never|no|optional|not)\b/i.test(s))
      check(!badSentence, `${unitId}: a single sentence implies a required public/recorded/photo component: "${badSentence}"`)
      check(/\boptional\b/i.test(pkg.presentation_and_privacy.presentation_options) || /\bnever\b.*\brequired\b/i.test(pkg.presentation_and_privacy.presentation_options), `${unitId}: presentation_options does not clearly state the choice is optional`)
    } else {
      failures.push(`${unitId}: unknown subject "${pkg.subject}"`)
    }

    check(!!pkg.copyright_and_authorship, `${unitId}: missing copyright_and_authorship`)
    check(/own authorship|own work/i.test(pkg.copyright_and_authorship), `${unitId}: copyright_and_authorship does not assert student authorship`)

    // Scoring guide structure.
    check(guide.scoring_authority_kind === 'RUBRIC', `${unitId}: scoring guide is not RUBRIC-authority`)
    check(Array.isArray(guide.rubric) && guide.rubric.length >= 1, `${unitId}: scoring guide missing rubric dimensions`)
    for (const dim of guide.rubric ?? []) {
      for (const level of ['exceeds', 'meets', 'developing', 'beginning']) {
        check(!!dim[level], `${unitId}: rubric dimension "${dim.dimension}" missing "${level}" descriptor`)
      }
    }
    check(guide.safety_and_privacy?.status === 'VERIFIED', `${unitId}: safety_and_privacy not VERIFIED`)
  }
}

check(totalPackages === 108, `expected 108 total task packages, found ${totalPackages}`)
check(totalGuides === 108, `expected 108 total scoring guides, found ${totalGuides}`)

if (failures.length > 0) {
  console.error(`FAILED — ${failures.length} issue(s):`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`PASSED — ${totalPackages} task packages and ${totalGuides} scoring guides validated.`)
