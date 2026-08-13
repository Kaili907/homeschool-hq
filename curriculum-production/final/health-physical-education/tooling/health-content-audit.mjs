#!/usr/bin/env node
/** Independent acceptance audit for Health Content Repair R1. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { scanDocument } from '../src/lib/privacyScan.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = resolve(ROOT, '../../..')
const BASE = 'c81ddb6e04bc1c3629212327d47817c1b5677477'
const H2 = 'mac/g3-health-h2@50399a6fb6ae095907c0fde25db2a15ca85c6f1f'
const GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]
const REPAIR_GRADES = new Set([5, 7, 8, 9, 10, 11, 12])
const EXPECTED = { lessons: 324, repaired: 252 }
const REPORT = resolve(ROOT, 'reports/health-content-repair-r1.json')
const WRITE = process.argv.includes('--write')

const oldTaskScaffold = /Learner (?:completes a new application|applies .+ to a new fictional scenario)\b/i
const oldCheckScaffold = /In one concise response, show or explain the most important idea about .+ (?:then|;) identify|name one check that would catch/i
const actionVerb = /\b(?:annotate|analyze|apply|build|choose|classify|compare|complete|correct|create|draft|explain|identify|list|make|mark|name|produce|propose|record|route|say|show|state|underline|what|write)\b/i
const privateDisclosure = /\b(?:describe|disclose|document|list|record|report|share|submit|tell|write)\b[^.!?]{0,90}\b(?:your|learner'?s|student'?s)\b[^.!?]{0,40}\b(?:family|household|home|medical|mental[- ]health|sexual|relationship|diagnosis|trauma|medication)\b/i
const unsafeRequirement = /\b(?:must|required?|have to|for credit|for a grade)\b[^.!?]{0,90}\b(?:diet|weigh|body size|body measurement|appearance|private health|family history|diagnosis|sexual history|camera|photograph|video|voice recording)\b/i

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir).sort()) {
    const path = resolve(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

function words(text) {
  return typeof text === 'string' ? text.trim().split(/\s+/).filter(Boolean).length : 0
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function gitShow(commit, path) {
  return execFileSync('git', ['show', `${commit}:${path}`], { cwd: REPO })
}

function activeText(pkg) {
  return [
    ...(pkg.keyPoints ?? []),
    pkg.privacySafeScenario,
    pkg.studentTask,
    pkg.knowledgeCheck,
    ...(pkg.completionCriteria ?? []),
    pkg.adaptationChoices,
  ].filter((value) => typeof value === 'string' && value.trim()).join('\n')
}

function main() {
  const packageRoot = resolve(ROOT, 'packages/health')
  const guideRoot = resolve(ROOT, 'scoring-guides/health')
  const files = walk(packageRoot).filter((path) => /\/ma-g\d+-health-u\d+-l\d+\.json$/.test(path))
  assert.equal(files.length, EXPECTED.lessons)

  const results = []
  const privacyFindings = []
  const safetyFindings = []
  const repairedFacts = new Set()
  let repaired = 0
  let meaningful = 0
  let actionable = 0
  let completionReady = 0
  let alternatives = 0
  let placeholders = 0
  let h2PackageExact = 0
  let h2GuideExact = 0

  for (const path of files) {
    const pkg = JSON.parse(readFileSync(path, 'utf8'))
    const rel = relative(REPO, path)
    assert.equal(pkg.kind, 'lesson-task-card')
    assert.equal(pkg.subject, 'health')
    assert(GRADES.includes(pkg.grade))

    const instructionWords = (pkg.keyPoints ?? []).reduce((sum, point) => sum + words(point), 0)
    const hasMeaningfulInstruction = Array.isArray(pkg.keyPoints)
      && pkg.keyPoints.filter((point) => words(point) >= 8).length >= 2
      && instructionWords >= 25
    if (hasMeaningfulInstruction) meaningful += 1

    const taskEvidence = [pkg.privacySafeScenario, pkg.studentTask, pkg.knowledgeCheck].filter(Boolean).join(' ')
    const hasActionableTask = words(taskEvidence) >= 30
      && actionVerb.test(taskEvidence)
      && /fictional|supplied|scenario|case/i.test(taskEvidence)
    if (hasActionableTask) actionable += 1

    const hasCriteria = Array.isArray(pkg.completionCriteria)
      && pkg.completionCriteria.length >= 3
      && pkg.completionCriteria.every((criterion) => words(criterion) >= 8)
    if (hasCriteria) completionReady += 1
    if (words(pkg.adaptationChoices) >= 8) alternatives += 1

    const placeholder = !hasMeaningfulInstruction
      || oldTaskScaffold.test(pkg.studentTask ?? '')
      || oldCheckScaffold.test(pkg.knowledgeCheck ?? '')
    if (placeholder) placeholders += 1

    const docPrivacy = scanDocument(pkg, rel)
    privacyFindings.push(...docPrivacy.map((finding) => ({ lessonId: pkg.lessonId, ...finding })))
    const learnerText = activeText(pkg)
    if (privateDisclosure.test(learnerText)) safetyFindings.push({ lessonId: pkg.lessonId, rule: 'private-disclosure-requirement' })
    if (unsafeRequirement.test(learnerText)) safetyFindings.push({ lessonId: pkg.lessonId, rule: 'unsafe-health-evidence-requirement' })

    if (REPAIR_GRADES.has(pkg.grade)) {
      repaired += 1
      assert.equal(pkg.contentProvenance?.repairLane, 'mac/health-content-repair-r1', `${pkg.lessonId}: missing repair provenance`)
      assert(words(pkg.contentProvenance?.objective) >= 5, `${pkg.lessonId}: missing objective trace`)
      repairedFacts.add(pkg.keyPoints[0])
    } else {
      assert.equal(pkg.contentProvenance, undefined, `${pkg.lessonId}: grade 3/4 was altered by repair layer`)
    }

    if (pkg.grade === 3) {
      assert.equal(pkg.sourceProvenance?.sourceBranch, H2)
      const currentPackage = readFileSync(path)
      assert.deepEqual(currentPackage, gitShow(BASE, rel), `${pkg.lessonId}: Grade 3 H2 package bytes changed`)
      h2PackageExact += 1

      const guidePath = resolve(guideRoot, 'grade-03', `${pkg.lessonId}.json`)
      const guideRel = relative(REPO, guidePath)
      assert.deepEqual(readFileSync(guidePath), gitShow(BASE, guideRel), `${pkg.lessonId}: Grade 3 H2 guide bytes changed`)
      h2GuideExact += 1
    }

    results.push({
      lessonId: pkg.lessonId,
      grade: pkg.grade,
      meaningfulInstruction: hasMeaningfulInstruction,
      actionableTask: hasActionableTask,
      completionCriteria: hasCriteria,
      safeAlternative: words(pkg.adaptationChoices) >= 8,
      placeholder,
    })
  }

  assert.equal(repaired, EXPECTED.repaired)
  assert.equal(repairedFacts.size, EXPECTED.repaired, 'every repaired lesson must have a distinct objective-specific primary teaching point')
  assert.equal(meaningful, EXPECTED.lessons)
  assert.equal(actionable, EXPECTED.lessons)
  assert.equal(completionReady, EXPECTED.lessons)
  assert.equal(alternatives, EXPECTED.lessons)
  assert.equal(placeholders, 0)
  assert.equal(privacyFindings.length, 0)
  assert.equal(safetyFindings.length, 0)
  assert.equal(h2PackageExact, 36)
  assert.equal(h2GuideExact, 36)

  const correctedPhrases = [
    ['ma-g3-health-u01-l02', "neighbor's dog"],
    ['ma-g3-health-u02-l05', 'groceries'],
    ['ma-g3-health-u02-l06', 'stovetop'],
    ['ma-g3-health-u02-l06', 'cutting board'],
    ['ma-g3-health-u03-l02', 'caregiver'],
    ['ma-g3-health-u04-l04', 'Telling is always the right thing to do'],
    ['ma-g3-health-u04-l04', 'mom'],
    ['ma-g3-health-u05-l03', 'crosswalks'],
    ['ma-g3-health-u05-l03', 'curb'],
    ['ma-g3-health-u05-l06', "Sam's parents"],
    ['ma-g3-health-u06-l02', 'candy'],
    ['ma-g3-health-u06-l02', 'pills'],
    ['ma-g3-health-u06-l03', 'health organizations'],
    ['ma-g3-health-u06-l05', 'construction site'],
  ]
  for (const [lessonId, phrase] of correctedPhrases) {
    const result = results.find((item) => item.lessonId === lessonId)
    const path = files.find((item) => item.endsWith(`/${lessonId}.json`))
    assert(result && readFileSync(path, 'utf8').includes(phrase), `${lessonId}: missing H2 correction ${phrase}`)
  }

  const byGrade = Object.fromEntries(GRADES.map((grade) => {
    const rows = results.filter((row) => row.grade === grade)
    return [String(grade), {
      lessons: rows.length,
      meaningfulInstruction: rows.filter((row) => row.meaningfulInstruction).length,
      actionableTask: rows.filter((row) => row.actionableTask).length,
      completionCriteria: rows.filter((row) => row.completionCriteria).length,
      safeAlternative: rows.filter((row) => row.safeAlternative).length,
      placeholders: rows.filter((row) => row.placeholder).length,
    }]
  }))

  const packageDigest = sha256(files.map((path) => sha256(readFileSync(path))).join('\n'))
  const evidence = {
    audit: 'HEALTH CONTENT REPAIR R1',
    classification: 'HEALTH_CONTENT_READY_FOR_CONVERGENCE',
    base: BASE,
    scope: 'Health lesson content only; projection, UI, scoring, and global admission are excluded.',
    totals: {
      lessons: results.length,
      lessonsRepaired: repaired,
      meaningfulInstruction: meaningful,
      actionableSafeTask: actionable,
      completionCriteria: completionReady,
      safeAlternatives: alternatives,
      placeholdersAfter: placeholders,
    },
    privacyProof: { violations: privacyFindings.length, findings: privacyFindings },
    safetyProof: { violations: safetyFindings.length, findings: safetyFindings },
    grade3H2Proof: {
      provenance: H2,
      exactPackageByteMatchesAgainstBase: h2PackageExact,
      exactScoringGuideByteMatchesAgainstBase: h2GuideExact,
      correctedPhraseControls: correctedPhrases.length,
      result: 'PASS',
    },
    activityProof: {
      actionableTasks: actionable,
      completionCriteria: completionReady,
      safeAlternatives: alternatives,
      uniqueRepairedPrimaryTeachingPoints: repairedFacts.size,
      result: 'PASS',
    },
    authoritativeReferenceBasis: [
      { scope: 'health literacy', title: 'CDC — What Is Health Literacy?', url: 'https://www.cdc.gov/health-literacy/php/about/index.html' },
      { scope: 'source and claim evaluation', title: 'NIH — How to Evaluate Trustworthiness in Science', url: 'https://www.nih.gov/about-nih/science-health-public-trust/tools/how-evaluate-trustworthiness-science' },
      { scope: 'mental-health literacy and help-seeking', title: 'CDC — Mental Health Education', url: 'https://www.cdc.gov/healthy-youth/mental-health/mental-health-education.html' },
      { scope: 'sleep and circadian concepts', title: 'NICHD — Sleep', url: 'https://www.nichd.nih.gov/health/topics/sleep' },
      { scope: 'consent and coercion prevention', title: 'HHS ACF — Let’s Talk Consent', url: 'https://teenpregnancy.acf.hhs.gov/resources/lets-talk-consent' },
      { scope: 'HIV transmission, testing, and treatment', title: 'CDC — About HIV', url: 'https://www.cdc.gov/hiv/about/index.html' },
      { scope: 'medicine safety', title: 'FDA — Buying & Using Medicine Safely', url: 'https://www.fda.gov/drugs/information-consumers-and-patients-drugs/buying-using-medicine-safely' },
      { scope: 'opioid overdose and naloxone awareness', title: 'SAMHSA — Opioid Overdose Prevention and Reversal', url: 'https://www.samhsa.gov/substance-use/treatment/overdose-prevention' },
      { scope: 'food safety', title: 'CDC — Preventing Food Poisoning', url: 'https://www.cdc.gov/food-safety/prevention/index.html' },
      { scope: 'concussion stop and return-to-activity rule', title: 'CDC HEADS UP — Returning to Sports', url: 'https://www.cdc.gov/heads-up/guidelines/returning-to-sports.html' },
    ],
    byGrade,
    packageDigest: { algorithm: 'SHA-256', value: packageDigest },
  }
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`
  if (WRITE) {
    mkdirSync(dirname(REPORT), { recursive: true })
    writeFileSync(REPORT, serialized)
  } else {
    assert.equal(readFileSync(REPORT, 'utf8'), serialized, `${relative(REPO, REPORT)} is stale`)
  }

  console.log(`Health lessons: ${results.length}; repaired: ${repaired}.`)
  console.log(`Meaningful instruction: ${meaningful}; actionable tasks: ${actionable}; placeholders: ${placeholders}.`)
  console.log(`Privacy: ${privacyFindings.length}; safety: ${safetyFindings.length}; Grade 3 H2 exact trace: PASS.`)
}

main()
