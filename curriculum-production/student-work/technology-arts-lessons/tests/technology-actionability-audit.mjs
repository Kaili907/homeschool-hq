#!/usr/bin/env node
/**
 * Technology/CS final learner-content actionability audit.
 *
 * Reads generated task packages as a learner receives them, independently of
 * the generator helpers. Fails when an input, tool route, expected behavior,
 * check, debugging target, privacy boundary, or equal-credit alternative is
 * missing. Writes the production evidence report consumed by convergence.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const PACKAGES = resolve(ROOT, 'packages/technology')
const EVIDENCE = resolve(ROOT, 'technology-content-repair-evidence.json')

const packagePaths = readdirSync(PACKAGES)
  .sort()
  .flatMap((gradeDir) =>
    readdirSync(resolve(PACKAGES, gradeDir))
      .filter((file) => file.endsWith('.task-package.json'))
      .sort()
      .map((file) => resolve(PACKAGES, gradeDir, file)),
  )

const packages = packagePaths.map((path) => JSON.parse(readFileSync(path, 'utf8')))
const failures = []
const fail = (id, code, detail) => failures.push({ lesson_id: id, code, detail })

const PLACEHOLDER_SHELL =
  /\b(todo|tbd|tba|placeholder|lorem ipsum|insert (text|code|data|link)|fill in later|teacher will provide|source to be supplied|download the starter|find (a|an|some) (example|dataset|website) online|prepared artifact|provided worked model)\b/i
const PAID_OR_ACCOUNT_DEPENDENCY =
  /\b(must|required to|have to)\b[^.]{0,80}\b(sign in|create an account|subscribe|purchase|buy|paid|credit card|post publicly|upload publicly)\b/i
const CREDENTIAL_LITERAL = [
  /\bsk-[A-Za-z0-9]{16,}/,
  /\bAKIA[0-9A-Z]{12,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}/,
]

let missingCentralInputs = 0
let unrunnableRequiredTasks = 0
let placeholderShells = 0
let codeOrDebugActivities = 0
let starterCodeComplete = 0
let noInstallOrPaperMethods = 0
let equalCreditAlternatives = 0
let privacySecurityComplete = 0

for (const pkg of packages) {
  const id = pkg.lesson_id
  const setup = pkg.activity_setup
  let missing = false
  let unrunnable = false

  if (!setup || !setup.central_input || Object.keys(setup.central_input).length < 3) {
    fail(id, 'MISSING_CENTRAL_INPUT', 'activity_setup.central_input is absent or too thin')
    missing = true
  }
  if (!Array.isArray(setup?.expected_behavior_and_specification) || setup.expected_behavior_and_specification.length < 4) {
    fail(id, 'MISSING_SPECIFICATION', 'fewer than four expected behavior/specification statements')
    unrunnable = true
  }
  if (!Array.isArray(setup?.test_cases) || setup.test_cases.length < 3 || setup.test_cases.some((test) => !test.input || !test.expected)) {
    fail(id, 'MISSING_TEST_CASES', 'three input/expected test cases are required')
    unrunnable = true
  }
  const methodText = JSON.stringify(setup?.execution_method ?? {})
  if (!/(paper|hand-trace|notes app|browser)/i.test(methodText) || /(install required|paid account)/i.test(methodText)) {
    fail(id, 'UNAVAILABLE_EXECUTION_METHOD', 'no browser/local/manual no-install execution path')
    unrunnable = true
  } else {
    noInstallOrPaperMethods += 1
  }
  const debug = setup?.debugging_target
  if (!debug?.observed_failure || !debug?.target || !debug?.passing_change) {
    fail(id, 'MISSING_DEBUGGING_TARGET', 'observed failure, target, and passing change are all required')
    unrunnable = true
  }
  const alternativeText = JSON.stringify(setup?.equal_credit_alternative ?? {})
  if (!/(same score|identical credit|same specification|exactly the same score)/i.test(alternativeText)) {
    fail(id, 'UNEQUAL_OR_MISSING_ALTERNATIVE', 'manual/pseudocode alternative is not explicitly equal credit')
    unrunnable = true
  } else {
    equalCreditAlternatives += 1
  }

  if (setup?.activity_kind === 'CODE_OR_DEBUG') {
    codeOrDebugActivities += 1
    const central = setup.central_input ?? {}
    if (!central.starter_code || !central.starter_code_language || !Array.isArray(central.input_data) || central.input_data.length < 3) {
      fail(id, 'INCOMPLETE_STARTER_CODE', 'language, complete code, and three inline inputs are required')
      unrunnable = true
    } else {
      try {
        // Parse only. The starter intentionally exhibits the documented defect.
        new Function(central.starter_code)
        starterCodeComplete += 1
      } catch (error) {
        fail(id, 'STARTER_CODE_SYNTAX', String(error))
        unrunnable = true
      }
    }
  }

  const learnerText = JSON.stringify({
    task_brief: pkg.task_brief,
    primary_task: pkg.primary_task,
    requirements: pkg.requirements,
    deliverable: pkg.deliverable,
    activity_setup: setup,
    criteria: pkg.test_or_check_criteria,
    presentation_and_privacy: pkg.presentation_and_privacy,
  })
  if (PLACEHOLDER_SHELL.test(learnerText)) {
    fail(id, 'PLACEHOLDER_SHELL', learnerText.match(PLACEHOLDER_SHELL)?.[0] ?? 'placeholder')
    placeholderShells += 1
  }
  if (PAID_OR_ACCOUNT_DEPENDENCY.test(learnerText)) {
    fail(id, 'PAID_OR_ACCOUNT_DEPENDENCY', learnerText.match(PAID_OR_ACCOUNT_DEPENDENCY)?.[0] ?? 'dependency')
    unrunnable = true
  }
  for (const pattern of CREDENTIAL_LITERAL) {
    if (pattern.test(learnerText)) fail(id, 'CREDENTIAL_LITERAL', String(pattern))
  }
  const privacy = pkg.presentation_and_privacy?.sandbox_and_credentials_note ?? ''
  if (
    /never use a real password/i.test(privacy) &&
    /do not sign into, probe, scan/i.test(privacy) &&
    /fictional|made-up/i.test(privacy) &&
    !CREDENTIAL_LITERAL.some((pattern) => pattern.test(learnerText))
  ) {
    privacySecurityComplete += 1
  } else {
    fail(id, 'PRIVACY_SECURITY_GAP', 'credential, live-system, and fictional-data controls are required')
  }

  if (missing) missingCentralInputs += 1
  if (unrunnable) unrunnableRequiredTasks += 1
}

const actionableLessons = packages.length - new Set(failures.map((failure) => failure.lesson_id)).size
const proofSamples = {
  starter_code: packages.filter((pkg) => pkg.activity_setup?.activity_kind === 'CODE_OR_DEBUG').slice(0, 3).map((pkg) => pkg.lesson_id),
  tool_environment: packages.slice(0, 3).map((pkg) => pkg.lesson_id),
  equal_credit_alternative: packages.slice(-3).map((pkg) => pkg.lesson_id),
  privacy_security: packages.filter((pkg) => /privacy|security|passphrase/i.test(pkg.focus)).slice(0, 3).map((pkg) => pkg.lesson_id),
}

const report = {
  schema_version: '1.0',
  scope: 'Technology/Computer Science lesson task packages only',
  source_audit_baseline: {
    lessons: 336,
    blocked_by_missing_central_inputs_or_tools: 168,
    unrunnable_code_or_debug_tasks: 87,
    placeholder_or_template_findings: 170,
    credential_public_post_or_media_proof_problems: 0,
    safety_rules_present: 336,
  },
  result: {
    lessons: packages.length,
    actionable_lessons: actionableLessons,
    missing_central_inputs: missingCentralInputs,
    unrunnable_required_tasks: unrunnableRequiredTasks,
    placeholder_shells: placeholderShells,
    code_or_debug_activities_by_conservative_focus_scan: codeOrDebugActivities,
    code_or_debug_activities_with_complete_parseable_starter_code: starterCodeComplete,
    lessons_with_no_install_browser_or_paper_method: noInstallOrPaperMethods,
    lessons_with_equal_credit_manual_alternative: equalCreditAlternatives,
    lessons_with_privacy_and_security_controls: privacySecurityComplete,
    failures: failures.length,
  },
  proof_samples: proofSamples,
  audit_method: {
    central_inputs: 'Requires a non-thin inline central_input object in every generated Technology package.',
    starter_code: 'CODE_OR_DEBUG activities require JavaScript language, complete parseable starter code, and at least three inline inputs.',
    tool_environment: 'Requires a browser, paper, hand-trace, or notes-app route and rejects installation/paid-account dependencies.',
    alternatives: 'Requires an explicitly same-score or identical-credit manual/pseudocode route in every lesson.',
    placeholders: `Rejects ${PLACEHOLDER_SHELL.source}.`,
    privacy_security: 'Requires no-real-password, no-live-system, fictional-data language and scans for credential-shaped literals.',
  },
  corpus_sha256: createHash('sha256')
    .update(packages.map((pkg) => JSON.stringify(pkg)).join('\n'))
    .digest('hex'),
}

writeFileSync(EVIDENCE, JSON.stringify(report, null, 2) + '\n')

console.log(`Technology actionability: ${actionableLessons}/${packages.length} actionable.`)
console.log(`Missing central inputs: ${missingCentralInputs}`)
console.log(`Unrunnable required tasks: ${unrunnableRequiredTasks}`)
console.log(`Placeholder shells: ${placeholderShells}`)
console.log(`Code/debug starter-code contracts: ${starterCodeComplete}/${codeOrDebugActivities}`)
console.log(`Equal-credit alternatives: ${equalCreditAlternatives}/${packages.length}`)
console.log(`Privacy/security controls: ${privacySecurityComplete}/${packages.length}`)
console.log(`Evidence: ${EVIDENCE}`)
if (failures.length > 0) {
  console.error(`TECHNOLOGY ACTIONABILITY FAILURES (${failures.length}):`)
  for (const failure of failures.slice(0, 60)) console.error(`  - ${failure.lesson_id} ${failure.code}: ${failure.detail}`)
  if (failures.length > 60) console.error(`  ... and ${failures.length - 60} more`)
  process.exitCode = 1
} else {
  console.log('TECHNOLOGY ACTIONABILITY AUDIT: PASS')
}
