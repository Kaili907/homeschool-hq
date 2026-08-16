/**
 * Content-only executable-lesson gate for the 972-lesson Science corpus.
 *
 * This gate intentionally does not inspect projection, UI response capture,
 * scoring, or global release admission.  Those surfaces are outside this
 * repair's authority.  It writes the production evidence requested by the
 * learner-content repair mission.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { ROOT, loadAllPackages, studentSheet } from './packages.mjs'

const H4 = 'a86780a315b5a6ba4f134f35b7033f35707b0e52'
const H4_LINEAGE = 'hs912-science-h4'
const packages = loadAllPackages()
const problems = []
const byCourseUnit = new Map()

const add = (pkg, code, detail) => {
  problems.push({ lessonId: pkg.lesson_id, code, detail })
}

for (const pkg of packages) {
  const content = pkg.executable_content
  const sheet = studentSheet(pkg)
  if (!content || content.completion_mode !== 'PACKAGE_ALONE' || !content.placeholder_free) {
    add(pkg, 'PLACEHOLDER', 'missing package-alone, placeholder-free executable content')
    continue
  }
  if (
    !content.inputs_complete ||
    (content.science_brief ?? []).length < 2 ||
    (content.supplied_evidence?.rows ?? []).length < 2 ||
    (content.bound_task?.steps ?? []).length < 4
  ) {
    add(pkg, 'MISSING_DATA', 'science brief, evidence record, or bound steps are incomplete')
  }
  const questionText = (pkg.analysis_questions ?? []).map((question) => question.prompt).join(' ')
  if (
    /task (?:you|the learner) (?:has|have) not (?:seen|worked)|case .* not worked before|selected-response, constructed-response/i.test(
      questionText,
    ) ||
    /new application of .* and records both the result/.test(pkg.data_sheet?.lesson_task_verbatim ?? '')
  ) {
    add(pkg, 'PLACEHOLDER', 'an analysis prompt still requires an unspecified case, choice set, or application')
  }
  if (!(content.unit_connections ?? []).length || !content.unit_performance_task) {
    add(pkg, 'MISSING_DATA', 'unit-connection or performance-task input is absent')
  }
  if (pkg.data_bearing && (!content.materials_complete || !(pkg.materials ?? []).length)) {
    add(pkg, 'MISSING_MATERIALS', 'investigation materials are absent')
  }
  const alternative = content.equal_credit_route
  const evidenceCount = content.supplied_evidence?.rows?.length ?? 0
  if (
    !alternative?.complete ||
    !(alternative.materials ?? []).length ||
    (pkg.data_bearing && !(alternative.procedure ?? []).length) ||
    !pkg.supplied_data_alternative?.delivery_status?.startsWith('DELIVERED_') ||
    !pkg.equal_credit_safe_alternative?.text ||
    !pkg.equal_credit_safe_alternative?.derived_task
  ) {
    add(pkg, 'NONFUNCTIONAL_ALTERNATIVE', 'equal-credit route lacks inputs, materials, or procedure')
  }
  if (content.physical_result_disclosed_before_collection !== false) {
    add(pkg, 'EXPECTED_RESULT_LEAK', 'physical result timing is not protected')
  }
  const referencedEvidenceIds = JSON.stringify(content).match(/\bE(\d+)\b/g) ?? []
  if (
    referencedEvidenceIds.some(
      (reference) => Number.parseInt(reference.slice(1), 10) > evidenceCount,
    )
  ) {
    add(pkg, 'MISSING_DATA', 'task references an evidence ID that the package does not supply')
  }
  if (
    !sheet.includes('The science information and exact work for this lesson') ||
    !sheet.includes(content.case.claim_to_test) ||
    !sheet.includes(content.bound_task.question) ||
    !sheet.includes('Equal-credit route — complete and delivered here')
  ) {
    add(pkg, 'PLACEHOLDER', 'machine content is not fully rendered for the learner')
  }

  if (pkg.grade >= 9) {
    const authority = pkg.scientific_correctness_authority?.authored ?? {}
    if (
      pkg.source.commit !== H4 ||
      pkg.source.lineage !== H4_LINEAGE ||
      pkg.safety_brief.lineage !== H4_LINEAGE ||
      authority.source_commit !== H4
    ) {
      add(pkg, 'H4_LINEAGE', 'one or more High School authority fields are not exact H4')
    }
    if (
      pkg.data_bearing &&
      (!alternative?.does_not_predict_physical_route ||
        !alternative?.input?.independent_from_physical_route)
    ) {
      add(pkg, 'EXPECTED_RESULT_LEAK', 'High School model route is not independent of the H4 physical route')
    }
    const key = `${pkg.course_id}::${pkg.unit_number}`
    const entry = byCourseUnit.get(key) ?? []
    entry.push(pkg)
    byCourseUnit.set(key, entry)
  }

  if (pkg.assurances?.safety_completeness !== 'VERIFIED') {
    add(pkg, 'SAFETY', 'student-visible safety parity is not verified')
  }
}

const hsProof = []
for (const [key, unitPackages] of [...byCourseUnit.entries()].sort()) {
  const day7 = unitPackages.find((pkg) => pkg.day_in_unit === 7)
  const day9 = unitPackages.find((pkg) => pkg.day_in_unit === 9)
  const primary = day7?.executable_content?.primary_route
  const alternative = day7?.executable_content?.equal_credit_route
  const continuation = day9?.executable_content
  const pass = Boolean(
    day7 &&
      day9 &&
      primary?.kind === 'H4_PHYSICAL_INVESTIGATION' &&
      primary.complete &&
      alternative?.kind === 'DELIVERED_MODEL_DATA_ALTERNATIVE' &&
      alternative.complete &&
      alternative.input?.rows?.length >= 4 &&
      continuation?.inputs_complete &&
      continuation?.equal_credit_route?.complete,
  )
  hsProof.push({
    courseId: day7?.course_id,
    unit: day7?.unit_number,
    day7: day7?.lesson_id,
    day9: day9?.lesson_id,
    primaryRoute: primary?.kind,
    alternativeRows: alternative?.input?.rows?.length ?? 0,
    status: pass ? 'PASS' : 'FAIL',
  })
  if (!pass && day7) add(day7, 'HS_INVESTIGATION', `unit proof failed for ${key}`)
}

const counts = Object.fromEntries(
  [
    'PLACEHOLDER',
    'MISSING_DATA',
    'MISSING_MATERIALS',
    'NONFUNCTIONAL_ALTERNATIVE',
    'EXPECTED_RESULT_LEAK',
    'H4_LINEAGE',
    'SAFETY',
    'HS_INVESTIGATION',
  ].map((code) => [code, problems.filter((problem) => problem.code === code).length]),
)

const b1Ids = [
  'ma-hs12-earth-space-environmental-u05-l07',
  'ma-hs12-earth-space-environmental-u05-l09',
]
const b2b3Ids = ['ma-hs10-chemistry-u06-l07', 'ma-hs10-chemistry-u06-l09']
const byId = new Map(packages.map((pkg) => [pkg.lesson_id, pkg]))
const b1 = b1Ids.every((id) => {
  const text = `${byId.get(id)?.materials?.join(' ')} ${studentSheet(byId.get(id))}`
  return /apron/i.test(text) && /tray/i.test(text) && /dropper/i.test(text)
})
const b2 = b2b3Ids.every((id) => {
  const pkg = byId.get(id)
  const text = studentSheet(pkg)
  return (
    /no direction or size of change is supplied in advance/i.test(text) &&
    !/observe cooling|observe warming|mild warming/i.test(text)
  )
})
const b3 = b2b3Ids.every((id) => {
  const text = studentSheet(byId.get(id))
  return (
    /calcium chloride goes ONLY in the DISPOSABLE double cup/i.test(text) &&
    /insulated drinking cup holds ONLY the Epsom-salt, baking-soda, and vinegar trials/i.test(text)
  )
})

const report = {
  gate: 'science-executable-learner-content-r1',
  scope: 'Science learner content only; projection, UI, scoring, and global admission excluded',
  totalLessons: packages.length,
  lessonsRepaired: packages.filter(
    (pkg) => pkg.assurances?.package_alone_inputs_complete && pkg.assurances?.placeholder_free_learner_work,
  ).length,
  status:
    packages.length === 972 &&
    problems.length === 0 &&
    hsProof.length === 36 &&
    hsProof.every((proof) => proof.status === 'PASS') &&
    b1 &&
    b2 &&
    b3
      ? 'PASS'
      : 'FAIL',
  counts,
  highSchoolInvestigations: {
    total: hsProof.length,
    executable: hsProof.filter((proof) => proof.status === 'PASS').length,
    proof: hsProof,
  },
  h4Lineage: {
    expectedCommit: H4,
    expectedLineage: H4_LINEAGE,
    highSchoolLessons: packages.filter((pkg) => pkg.grade >= 9).length,
    exact: counts.H4_LINEAGE === 0,
  },
  safety: {
    verifiedLessons: packages.filter((pkg) => pkg.assurances?.safety_completeness === 'VERIFIED').length,
    findings: counts.SAFETY,
    b1Closed: b1,
    b2Closed: b2,
    b3Closed: b3,
  },
  expectedResult: {
    protectedLessons: packages.filter(
      (pkg) => pkg.executable_content?.physical_result_disclosed_before_collection === false,
    ).length,
    findings: counts.EXPECTED_RESULT_LEAK,
  },
  problems,
}

writeFileSync(join(ROOT, 'reports/learner-content-gate.json'), `${JSON.stringify(report, null, 2)}\n`)

const lines = [
  '# Science executable learner-content gate',
  '',
  `Status: **${report.status}** · ${report.totalLessons} lessons`,
  '',
  `- Package-alone lessons: ${report.lessonsRepaired}/${report.totalLessons}`,
  `- Placeholder shells: ${counts.PLACEHOLDER}`,
  `- Missing required input/data: ${counts.MISSING_DATA}`,
  `- Missing investigation materials: ${counts.MISSING_MATERIALS}`,
  `- Nonfunctional alternatives: ${counts.NONFUNCTIONAL_ALTERNATIVE}`,
  `- High School investigations executable: ${report.highSchoolInvestigations.executable}/${report.highSchoolInvestigations.total}`,
  `- Exact H4 High School lineage: ${report.h4Lineage.exact ? 'PASS' : 'FAIL'} (${report.h4Lineage.highSchoolLessons} lessons)`,
  `- Safety findings: ${report.safety.findings}; B1/B2/B3: ${b1 && b2 && b3 ? 'CLOSED' : 'OPEN'}`,
  `- Expected-result findings: ${report.expectedResult.findings}`,
  '',
  '## High School investigation proof',
  '',
  '| Course | Unit | Day 7 | Day 9 | Primary | Alternative rows | Status |',
  '| --- | ---: | --- | --- | --- | ---: | --- |',
  ...hsProof.map(
    (proof) =>
      `| ${proof.courseId} | ${proof.unit} | ${proof.day7} | ${proof.day9} | ${proof.primaryRoute} | ${proof.alternativeRows} | ${proof.status} |`,
  ),
]
if (problems.length) {
  lines.push('', '## Problems', '')
  for (const problem of problems.slice(0, 100)) {
    lines.push(`- \`${problem.lessonId}\` — ${problem.code}: ${problem.detail}`)
  }
}
writeFileSync(join(ROOT, 'reports/learner-content-gate.md'), `${lines.join('\n')}\n`)

console.log(
  `learner content gate: ${report.status} — lessons ${report.lessonsRepaired}/${report.totalLessons}, ` +
    `placeholders ${counts.PLACEHOLDER}, data ${counts.MISSING_DATA}, materials ${counts.MISSING_MATERIALS}, ` +
    `alternatives ${counts.NONFUNCTIONAL_ALTERNATIVE}, HS ${report.highSchoolInvestigations.executable}/${report.highSchoolInvestigations.total}`,
)
process.exit(report.status === 'PASS' ? 0 : 1)
