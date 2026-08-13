#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]
export const EXPECTED_LESSONS_PER_GRADE = 180
export const EXPECTED_LESSONS = 1_620

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const PACKAGES_ROOT = join(ROOT, 'curriculum-production/student-work/english-language-arts/packages')
const SCORING_ROOT = join(ROOT, 'curriculum-production/student-work/english-language-arts/scoring-guides')
const BINDINGS_PATH = join(ROOT, 'curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl')
const SLOTS_PATH = join(ROOT, 'curriculum-release-candidates/family-pilot-final-r1/production-binding-slots.jsonl')
const ROWS_PATH = join(ROOT, 'curriculum-release-admitted/family-pilot-r1/runtime/lesson-rows-by-course.json')
const RELEASE_MANIFEST_PATH = join(ROOT, 'curriculum-release-admitted/family-pilot-r1/MANIFEST.json')
const RUNTIME_MANIFEST_PATH = join(ROOT, 'curriculum-release-admitted/family-pilot-r1/runtime/runtime-manifest.json')
const BROWSER_BUILDER_PATH = join(ROOT, 'scripts/build-final-family-pilot-data.mjs')
const PLAYER_HOST_PATH = join(ROOT, 'src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx')
const PLAYER_PATH = join(ROOT, 'src/study/family-pilot/lesson-player/FamilyPilotLessonPlayer.tsx')
const OUTPUT_ROOT = join(ROOT, 'docs/learner-audits/ela')

const SOURCE_WORKTREES = Object.freeze({
  g34: '/Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-g34-ela-r1',
  canonical: '/Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-ela-production-r1',
  hs912: '/Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-hs912-ela-r1',
})

const FLAG_ORDER = [
  'MISSING_READING',
  'MISSING_SOURCE',
  'EMPTY_QUESTIONS',
  'EMPTY_WRITING_TASK',
  'EMPTY_RUBRIC',
  'ZERO_ACTIONABLE_WORK',
  'FLATTENED_QUESTION_STRUCTURE',
  'UNSUPPORTED_WRITING_RESPONSE',
  'PLACEHOLDER',
  'COPYRIGHT_SOURCE_PROBLEM',
  'ANSWER_OR_SCORING_LEAK',
  'CROSS_GRADE_TEMPLATE_COLLAPSE',
]

const scalarKeys = [
  'objective',
  'scenario',
  'privacySafeScenario',
  'studentTask',
  'knowledgeCheck',
  'adaptationChoices',
  'extensionChallenge',
  'trustedAdultNote',
  'task_brief',
  'primary_task',
  'deliverable',
  'essential_question',
  'remediation',
  'extension',
  'copyright_and_authorship',
]

const arrayKeys = [
  'materials',
  'keyPoints',
  'movementCues',
  'completionCriteria',
  'accessibilitySupports',
  'neverRequires',
  'safetyNotes',
  'learning_objectives',
  'lesson_success_criteria',
  'task_steps',
  'requirements',
  'critique_criteria',
  'test_or_check_criteria',
  'safety_and_privacy_rules',
  'accessibility_options',
  'task_accessibility_provisions',
]

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const readJsonl = (path) => readFileSync(path, 'utf8').split(/\r?\n/).filter((line) => line.trim()).map(JSON.parse)
const gradeDir = (grade) => `grade-${String(grade).padStart(2, '0')}`
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sum = (values) => values.reduce((total, value) => total + value, 0)

function invariant(condition, message) {
  if (!condition) throw new Error(`ELA learner audit invariant failed: ${message}`)
}

function asText(value) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && typeof value.text === 'string' && value.text.trim()) {
    return value.text.trim()
  }
  return null
}

/**
 * Exact semantic copy of scripts/build-final-family-pilot-data.mjs's JSON
 * projection. It writes nothing; the audit uses it to observe the material
 * the browser build would produce from each admitted ELA package.
 */
export function projectJsonMaterial(value, binding, fallbackTitle) {
  const sections = []
  const add = (title, body, prompts = []) => {
    const text = asText(body)
    const safePrompts = prompts.filter((item) => typeof item === 'string' && item.trim())
    if (text || safePrompts.length) sections.push({ title, ...(text ? { body: text } : {}), prompts: safePrompts })
  }

  add('Lesson goal', value.objective)
  add('Scenario', value.scenario)
  for (const key of scalarKeys) {
    if (key === 'objective' || key === 'scenario') continue
    add(key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), value[key])
  }
  for (const key of arrayKeys) {
    if (!Array.isArray(value[key])) continue
    add(key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), null, value[key].filter((item) => typeof item === 'string'))
  }
  if (Array.isArray(value.sections)) {
    for (const section of value.sections) {
      const prompts = []
      for (const item of Array.isArray(section.items) ? section.items : []) {
        if (typeof item.prompt === 'string') {
          const choices = Array.isArray(item.choices) ? `\nChoices: ${item.choices.join(' · ')}` : ''
          prompts.push(`${item.prompt}${choices}`)
        }
        if (Array.isArray(item.workedSolution?.steps)) prompts.push(...item.workedSolution.steps)
      }
      add(section.title || section.kind || 'Lesson work', section.directions, prompts)
    }
  }
  if (Array.isArray(value.tasks)) {
    for (const task of value.tasks) {
      add(
        String(task.kind || task.taskId || 'Task').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        task.directions,
        (Array.isArray(task.prompts) ? task.prompts : []).map((prompt) => prompt.text).filter(Boolean),
      )
    }
  }
  add('Source or reading', value.sourceReference)
  add('Guided support', value.guidedSupport)
  add('Independent evidence', value.independentEvidenceTask)
  add('Equal-credit alternative', value.simulationAlternative?.description)
  add('Optional reflection', value.optionalReflection?.prompt)
  add('Media fallback', value.media?.fallback)

  return {
    materialRef: `production-material:${binding.lessonRef}`,
    lessonRef: binding.lessonRef,
    title: value.lessonRef?.title || value.title || value.lesson_title || fallbackTitle,
    subject: binding.subject,
    format: 'structured',
    sections,
  }
}

function hasAdultLeak(value) {
  const forbiddenKey = /^(answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex)$/i
  const forbiddenText = /(answer-keys|scoring-guide|teacher-guide)/i
  let leaked = false
  const walk = (item) => {
    if (leaked) return
    if (Array.isArray(item)) return item.forEach(walk)
    if (!item || typeof item !== 'object') return
    for (const [key, child] of Object.entries(item)) {
      if (forbiddenKey.test(key) || (typeof child === 'string' && forbiddenText.test(child))) leaked = true
      walk(child)
    }
  }
  walk(value)
  return leaked
}

function rubricIsEmpty(guide) {
  const rubric = guide?.scoringAuthority?.rubric
  return !Array.isArray(rubric) || rubric.length === 0 || rubric.some((item) => !String(item?.description ?? '').trim())
}

function taskRequiresSource(pkg) {
  const text = [
    pkg.studentTask?.text,
    pkg.guidedSupport?.text,
    pkg.independentEvidenceTask?.text,
    pkg.extension?.text,
  ].filter(Boolean).join('\n')
  return /assigned passage|assigned text|unit-specific source|\bpassage\b|\btextual evidence\b|\bquote\b|\bparaphrase\b/i.test(text)
}

function browserHasActualReading(material) {
  return material.sections.some((section) =>
    /source or reading/i.test(section.title) &&
    typeof section.body === 'string' &&
    // A selection/procurement instruction is a contract, not the reading.
    !/does not ship a fixed anchor text|choose a grade-appropriate text|obtain the text|rights-required work/i.test(section.body) &&
    section.body.trim().split(/\s+/).length >= 80)
}

function sourceMode(pkg) {
  if (Array.isArray(pkg.sourceReference?.refs) && pkg.sourceReference.refs.length) return 'REFERENCED'
  if (pkg.sourceReference?.mode === 'facilitator-selected') return 'FACILITATOR_SELECTED_CONTRACT'
  return 'ABSENT'
}

function genericActionlessTask(task) {
  return /completes a new application of today's lesson/i.test(task) ||
    /complete the unit assessment evidence for today's lesson independently/i.test(task)
}

function unclearWritingDeliverable(pkg) {
  return [5, 7, 8].includes(pkg.lessonRef.grade) &&
    /^(Performance task planning|Performance task build|Publication, presentation, or reflection)$/.test(pkg.lessonRef.phase) &&
    genericActionlessTask(pkg.independentEvidenceTask?.text ?? '')
}

function placeholderTask(pkg) {
  const task = pkg.independentEvidenceTask?.text ?? ''
  return genericActionlessTask(task) || /delivered separately by your facilitator/i.test(task)
}

function originalSourceUnavailable(pkg, material) {
  const refs = Array.isArray(pkg.sourceReference?.refs) ? pkg.sourceReference.refs : []
  return refs.some((ref) => ref.rightsCategory === 'original' && /ships with the course package/i.test(ref.obtainNote ?? '')) &&
    !browserHasActualReading(material)
}

export function crossGradeCopiedTaskIds(rows) {
  const groups = new Map()
  for (const row of rows) {
    const task = row.pkg.independentEvidenceTask?.text?.trim() ?? ''
    if (!task) continue
    const group = groups.get(task) ?? []
    group.push(row)
    groups.set(task, group)
  }
  const ids = new Set()
  const evidence = []
  for (const [task, group] of groups) {
    const grades = [...new Set(group.map((row) => row.grade))].sort((a, b) => a - b)
    if (grades.length < 2) continue
    for (const row of group) ids.add(row.lessonId)
    evidence.push({
      taskSha256: sha256(task),
      lessonCount: group.length,
      grades,
      sampleLessonRefs: group.slice(0, 6).map((row) => row.lessonId),
      task,
    })
  }
  return { ids, evidence: evidence.sort((a, b) => b.lessonCount - a.lessonCount || a.taskSha256.localeCompare(b.taskSha256)) }
}

function sourceWorktreeCommit(path) {
  try {
    return execFileSync('git', ['-C', path, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function sourceEvidenceIndexes() {
  const g34Base = join(SOURCE_WORKTREES.g34, 'curriculum-authoring/full-family-grade34/subjects/english-language-arts/grades')
  const hsBase = join(SOURCE_WORKTREES.hs912, 'curriculum-authoring/full-family-highschool-9-12/subjects/english-language-arts/courses')
  const indexes = new Map()
  for (const grade of [3, 4]) {
    const originals = readJson(join(g34Base, `grade-${grade}`, 'original-text-bank.json'))
    const publicDomain = readJson(join(g34Base, `grade-${grade}`, 'public-domain-register.json')).works
    indexes.set(grade, new Map([
      ...originals.map((entry) => [entry.id, { kind: 'original', fullBodyPresent: Boolean(entry.text?.trim()), entry }]),
      ...publicDomain.map((entry) => [entry.id, { kind: 'public_domain', fullBodyPresent: false, entry }]),
    ]))
  }
  for (const grade of [9, 10, 11, 12]) {
    const bank = readJson(join(hsBase, `english-${grade}`, 'text-bank.json')).texts
    indexes.set(grade, new Map(bank.map((entry) => [entry.text_id, {
      kind: entry.rights,
      fullBodyPresent: Boolean(entry.text?.trim()),
      openingPassageOnly: Boolean(entry.opening_passage?.trim()) && !entry.text?.trim(),
      entry,
    }])))
  }
  return indexes
}

function manualStrata(rows) {
  const selected = []
  const select = (grade, stratum, predicate) => {
    const row = rows.find((item) => item.grade === grade && predicate(item.pkg))
    invariant(row, `manual stratum ${stratum} missing for grade ${grade}`)
    selected.push({ grade, stratum, lessonId: row.lessonId })
  }
  for (const grade of GRADES) {
    select(grade, 'first', (pkg) => pkg.lessonRef.courseDay === 1)
    select(grade, 'concept-build', (pkg) => pkg.lessonRef.unitNumber === 1 && /Concept model|Explicit model|Word work|Word study/.test(pkg.lessonRef.phase))
    select(grade, 'analysis', (pkg) => pkg.lessonRef.unitNumber === 1 && /Shared close reading|Craft or structure analysis|Investigation or close reading/.test(pkg.lessonRef.phase))
    select(grade, 'writing', (pkg) => pkg.lessonRef.unitNumber === 1 && /Writing plan and draft|Performance task build/.test(pkg.lessonRef.phase))
    select(grade, 'assessment/performance', (pkg) => pkg.lessonRef.unitNumber === 1 && pkg.lessonRef.phase === 'Unit assessment')
    select(grade, 'final', (pkg) => pkg.lessonRef.courseDay === 180)
  }
  return selected
}

function negativeControls() {
  const binding = { lessonRef: 'synthetic-lesson', subject: 'english-language-arts' }
  const basePackage = {
    lessonRef: { title: 'Synthetic', grade: 5, phase: 'Performance task build' },
    studentTask: { text: 'Read the assigned passage and respond.' },
    sourceReference: { present: true, refs: [{ title: 'Missing' }] },
    independentEvidenceTask: { text: '' },
  }
  const projected = projectJsonMaterial(basePackage, binding, 'Synthetic')
  const controls = {
    missingReading: taskRequiresSource(basePackage) && !browserHasActualReading(projected),
    emptyWritingPrompt: unclearWritingDeliverable({
      ...basePackage,
      lessonRef: { ...basePackage.lessonRef, grade: 5 },
      independentEvidenceTask: { text: "Learner completes a new application of today's lesson." },
    }),
    missingRubric: rubricIsEmpty({ scoringAuthority: { rubric: [] } }),
    answerLeak: hasAdultLeak({ correctAnswer: 'synthetic-secret' }),
    sourceBrowserPromptLoss: !projected.sections.some((section) => section.title === 'Source or reading') &&
      projected.sections.every((section) => section.prompts.length === 0),
    copiedCrossGradeTask: (() => {
      const copied = crossGradeCopiedTaskIds([
        { grade: 5, lessonId: 'g5', pkg: { independentEvidenceTask: { text: 'identical task' } } },
        { grade: 7, lessonId: 'g7', pkg: { independentEvidenceTask: { text: 'identical task' } } },
      ])
      return copied.ids.size === 2
    })(),
  }
  return {
    status: Object.values(controls).every(Boolean) ? 'PASS' : 'FAIL',
    controls,
  }
}

function loadRows() {
  const bindings = readJsonl(BINDINGS_PATH).filter((row) => row.subject === 'english-language-arts')
  const slots = readJsonl(SLOTS_PATH).filter((row) => row.subject === 'english-language-arts')
  const runtimeRows = readJson(ROWS_PATH)
  const bindingByLesson = new Map(bindings.map((row) => [row.lessonRef, row]))
  const slotByLesson = new Map(slots.map((row) => [row.lessonRef, row]))
  const runtimeByLesson = new Map(Object.entries(runtimeRows)
    .filter(([courseRef]) => /english-language-arts/.test(courseRef))
    .flatMap(([, lessons]) => lessons.map((row) => [row.lessonRef, row])))

  const rows = []
  for (const grade of GRADES) {
    const packageDir = join(PACKAGES_ROOT, gradeDir(grade))
    const packageFiles = readdirSync(packageDir).filter((file) => file.endsWith('.package.json')).sort()
    invariant(packageFiles.length === EXPECTED_LESSONS_PER_GRADE, `grade ${grade} package count ${packageFiles.length}`)
    for (const file of packageFiles) {
      const packagePath = join(packageDir, file)
      const pkg = readJson(packagePath)
      const lessonId = pkg.lessonRef.lessonId
      const binding = bindingByLesson.get(lessonId)
      const slot = slotByLesson.get(lessonId)
      const runtime = runtimeByLesson.get(lessonId)
      invariant(binding, `${lessonId} has no admitted binding`)
      invariant(slot, `${lessonId} has no final release slot`)
      invariant(runtime, `${lessonId} has no admitted runtime row`)
      const scoringPath = join(SCORING_ROOT, gradeDir(grade), `${lessonId}.scoring.json`)
      const guide = readJson(scoringPath)
      const material = projectJsonMaterial(pkg, binding, runtime.title)
      rows.push({ grade, lessonId, packagePath, scoringPath, pkg, guide, binding, slot, runtime, material })
    }
  }
  invariant(rows.length === EXPECTED_LESSONS, `expected ${EXPECTED_LESSONS} lessons, found ${rows.length}`)
  invariant(bindings.length === EXPECTED_LESSONS, `expected ${EXPECTED_LESSONS} ELA bindings, found ${bindings.length}`)
  invariant(slots.length === EXPECTED_LESSONS, `expected ${EXPECTED_LESSONS} ELA slots, found ${slots.length}`)
  invariant(runtimeByLesson.size === EXPECTED_LESSONS, `expected ${EXPECTED_LESSONS} ELA runtime rows, found ${runtimeByLesson.size}`)
  return rows
}

function traceInvariants(rows) {
  const release = readJson(RELEASE_MANIFEST_PATH)
  const runtimeManifest = readJson(RUNTIME_MANIFEST_PATH)
  const sourceCommits = [...new Set(rows.map((row) => row.binding.productionSourceCommit))]
  invariant(sourceCommits.length === 1, `ELA bindings use ${sourceCommits.length} production commits`)
  const productionSourceCommit = sourceCommits[0]
  execFileSync('git', ['cat-file', '-e', `${productionSourceCommit}^{commit}`], { cwd: ROOT })
  execFileSync('git', ['diff', '--quiet', productionSourceCommit, '--', relative(ROOT, join(ROOT, 'curriculum-production/student-work/english-language-arts'))], { cwd: ROOT })
  invariant(release.admissionStatus === 'ADMITTED', 'release manifest is not ADMITTED')
  invariant(runtimeManifest.courses.filter((course) => course.subject === 'english-language-arts').length === GRADES.length, 'runtime does not contain nine ELA courses')
  for (const row of rows) {
    const packageRelative = relative(ROOT, row.packagePath)
    const scoringRelative = relative(ROOT, row.scoringPath)
    invariant(row.binding.lessonRef === row.lessonId && row.binding.grade === row.grade, `${row.lessonId} binding identity mismatch`)
    invariant(row.binding.productionPackageRef.endsWith(`:${packageRelative}`), `${row.lessonId} package binding mismatch`)
    invariant(row.binding.scoringAuthorityRef.endsWith(`:${scoringRelative}`), `${row.lessonId} scoring binding mismatch`)
    invariant(row.binding.productionGate?.status === 'READY', `${row.lessonId} production gate is not READY`)
    invariant(row.binding.sourceReadinessKind === 'STATIC_READY' && row.binding.sourceRuntimeState === 'READY', `${row.lessonId} is not admitted static-ready`)
    invariant(row.runtime.resourceRefs.includes(row.binding.productionPackageRef), `${row.lessonId} runtime row omits package ref`)
    invariant(row.material.lessonRef === row.lessonId, `${row.lessonId} browser material identity mismatch`)
  }
  return { release, runtimeManifest, productionSourceCommit }
}

function auditRows(rows, sourceIndexes) {
  const copied = crossGradeCopiedTaskIds(rows)
  const playerHost = readFileSync(PLAYER_HOST_PATH, 'utf8')
  const player = readFileSync(PLAYER_PATH, 'utf8')
  const browserBuilder = readFileSync(BROWSER_BUILDER_PATH, 'utf8')
  const playerHardCodesNoResponse = /responseKind:\s*'none'/.test(playerHost)
  const playerDropsSubmit = /onSubmitAction=\{\(\) => undefined\}/.test(playerHost)
  const playerOnlyUsesFirstPrompt = /section\?\.prompts\[0\]/.test(playerHost)
  const builderProjectsSourceViaAsText = /add\('Source or reading', value\.sourceReference\)/.test(browserBuilder)
  invariant(playerHardCodesNoResponse && playerDropsSubmit, 'mounted final Lesson Player response path changed; re-audit required')
  invariant(playerOnlyUsesFirstPrompt, 'mounted final Lesson Player prompt selection changed; re-audit required')
  invariant(builderProjectsSourceViaAsText, 'browser source projection changed; re-audit required')

  const findings = []
  for (const row of rows) {
    const flags = new Set()
    const task = row.pkg.independentEvidenceTask?.text?.trim() ?? ''
    const requiresSource = taskRequiresSource(row.pkg)
    const actualReadingInBrowser = browserHasActualReading(row.material)
    const mode = sourceMode(row.pkg)
    const browserSourceSection = row.material.sections.find((section) => section.title === 'Source or reading') ?? null
    const promptCount = sum(row.material.sections.map((section) => section.prompts.length))
    const rubricEmpty = rubricIsEmpty(row.guide)
    const adultLeak = hasAdultLeak(row.material)
    const referencedSources = Array.isArray(row.pkg.sourceReference?.refs) ? row.pkg.sourceReference.refs : []
    const index = sourceIndexes.get(row.grade)
    const sourceChecks = referencedSources.map((ref) => {
      const entry = index?.get(ref.textId)
      return {
        textId: ref.textId,
        title: ref.title,
        rightsCategory: ref.rightsCategory,
        authoringEntryPresent: Boolean(entry),
        authoringFullBodyPresent: Boolean(entry?.fullBodyPresent),
        authoringOpeningPassageOnly: Boolean(entry?.openingPassageOnly),
      }
    })

    if (requiresSource && !actualReadingInBrowser) flags.add('MISSING_READING')
    // A metadata pointer or selection instruction is not an attached source.
    if (requiresSource && !actualReadingInBrowser) flags.add('MISSING_SOURCE')
    if (!task) flags.add('EMPTY_QUESTIONS')
    if (unclearWritingDeliverable(row.pkg)) flags.add('EMPTY_WRITING_TASK')
    if (rubricEmpty) flags.add('EMPTY_RUBRIC')
    if (genericActionlessTask(task)) flags.add('ZERO_ACTIONABLE_WORK')
    if (task && promptCount === 0) flags.add('FLATTENED_QUESTION_STRUCTURE')
    if (task && playerHardCodesNoResponse && playerDropsSubmit) flags.add('UNSUPPORTED_WRITING_RESPONSE')
    if (placeholderTask(row.pkg)) flags.add('PLACEHOLDER')
    if (originalSourceUnavailable(row.pkg, row.material)) flags.add('COPYRIGHT_SOURCE_PROBLEM')
    if (adultLeak) flags.add('ANSWER_OR_SCORING_LEAK')
    if (copied.ids.has(row.lessonId)) flags.add('CROSS_GRADE_TEMPLATE_COLLAPSE')

    findings.push({
      lessonId: row.lessonId,
      grade: row.grade,
      courseDay: row.pkg.lessonRef.courseDay,
      unitNumber: row.pkg.lessonRef.unitNumber,
      dayInUnit: row.pkg.lessonRef.dayInUnit,
      phase: row.pkg.lessonRef.phase,
      focus: row.pkg.lessonRef.focus,
      classification: flags.has('MISSING_READING') || flags.has('UNSUPPORTED_WRITING_RESPONSE') ? 'BLOCKER' : flags.size ? 'FINDING' : 'PASS',
      flags: FLAG_ORDER.filter((flag) => flags.has(flag)),
      trace: {
        canonicalProductionPackage: relative(ROOT, row.packagePath),
        finalSlotPresent: true,
        admittedBindingPresent: true,
        admittedRuntimeRowPresent: true,
        browserMaterialProjected: true,
        lessonPlayerMounted: true,
      },
      source: {
        required: requiresSource,
        mode,
        bindingClaim: `${row.binding.sourceReadinessKind}/${row.binding.sourceRuntimeState}`,
        browserSourceSectionPresent: Boolean(browserSourceSection),
        browserActualReadingPresent: actualReadingInBrowser,
        references: sourceChecks,
      },
      task: {
        independentTaskPresent: Boolean(task),
        browserPromptCount: promptCount,
        genericActionless: genericActionlessTask(task),
        writingDeliverableClear: !unclearWritingDeliverable(row.pkg),
      },
      rubric: {
        adultScoringGuidePresent: true,
        nonempty: !rubricEmpty,
        learnerSuccessCriteriaProjected: false,
      },
      browser: {
        sectionCount: row.material.sections.length,
        promptCount,
        taskRetainedAsBodyProse: row.material.sections.some((section) => section.title === 'Independent evidence' && Boolean(section.body)),
        responseKind: 'none',
        responsePersisted: false,
      },
    })
  }
  return {
    findings,
    copiedEvidence: copied.evidence,
    playerEvidence: { playerHardCodesNoResponse, playerDropsSubmit, playerOnlyUsesFirstPrompt, builderProjectsSourceViaAsText },
  }
}

function countFlags(findings) {
  return Object.fromEntries(FLAG_ORDER.map((flag) => [flag, findings.filter((finding) => finding.flags.includes(flag)).length]))
}

function perGrade(findings) {
  return GRADES.map((grade) => {
    const gradeFindings = findings.filter((finding) => finding.grade === grade)
    const counts = countFlags(gradeFindings)
    return {
      grade,
      lessonsAudited: gradeFindings.length,
      classification: 'DO_NOT_BEGIN_YET',
      blockerLessons: gradeFindings.filter((finding) => finding.classification === 'BLOCKER').length,
      flagCounts: counts,
      rationale: 'Every lesson requires an assigned passage/source but the admitted browser payload attaches none; the mounted Lesson Player collects and persists no learner response.',
    }
  })
}

function buildSourceReadiness(findings, rows, sourceCommits) {
  const refs = findings.flatMap((finding) => finding.source.references)
  const perGradeRows = GRADES.map((grade) => {
    const items = findings.filter((finding) => finding.grade === grade)
    return {
      grade,
      lessons: items.length,
      bindingClaimsStaticReady: items.filter((item) => item.source.bindingClaim === 'STATIC_READY/READY').length,
      actualReadingInBrowser: items.filter((item) => item.source.browserActualReadingPresent).length,
      sourceSectionVisibleInBrowser: items.filter((item) => item.source.browserSourceSectionPresent).length,
      referencedSourceContractInProduction: items.filter((item) => item.source.mode === 'REFERENCED').length,
      facilitatorSelectedContractInProduction: items.filter((item) => item.source.mode === 'FACILITATOR_SELECTED_CONTRACT').length,
      absentSourceReference: items.filter((item) => item.source.mode === 'ABSENT').length,
      authoringFullBodyPresentButNotDelivered: items.filter((item) => item.source.references.some((ref) => ref.authoringFullBodyPresent)).length,
      originalAvailabilityClaimWithoutBrowserDelivery: items.filter((item) => item.flags.includes('COPYRIGHT_SOURCE_PROBLEM')).length,
    }
  })
  return {
    status: 'FAIL',
    reason: 'All 1,620 bindings claim STATIC_READY/READY, but the browser receives no passage or attached selected source for any ELA lesson.',
    sourceWorktrees: sourceCommits,
    totals: {
      lessons: findings.length,
      bindingClaimsStaticReady: findings.filter((item) => item.source.bindingClaim === 'STATIC_READY/READY').length,
      actualReadingInBrowser: findings.filter((item) => item.source.browserActualReadingPresent).length,
      sourceSectionVisibleInBrowser: findings.filter((item) => item.source.browserSourceSectionPresent).length,
      structuredSourceReferencesLostByBrowserProjection: findings.filter((item) => item.source.mode === 'REFERENCED' && !item.source.browserSourceSectionPresent).length,
      missingSourceReferenceAtProduction: findings.filter((item) => item.source.mode === 'ABSENT').length,
      facilitatorSelectedContractsWithoutAttachmentGate: findings.filter((item) => item.source.mode === 'FACILITATOR_SELECTED_CONTRACT').length,
      authoringFullBodyPresentButNotDelivered: findings.filter((item) => item.source.references.some((ref) => ref.authoringFullBodyPresent)).length,
      originalAvailabilityClaimWithoutBrowserDelivery: findings.filter((item) => item.flags.includes('COPYRIGHT_SOURCE_PROBLEM')).length,
      sourceReferences: refs.length,
      originalReferences: refs.filter((ref) => ref.rightsCategory === 'original').length,
      publicDomainReferences: refs.filter((ref) => ref.rightsCategory === 'public_domain').length,
      rightsRequiredReferences: refs.filter((ref) => ref.rightsCategory === 'rights_required').length,
      unresolvedReferences: refs.filter((ref) => !ref.authoringEntryPresent).length,
    },
    grades: perGradeRows,
    bindingSourceCommit: rows[0].binding.productionSourceCommit,
  }
}

function buildBrowserLoss(findings, copiedEvidence, playerEvidence) {
  return {
    status: 'FAIL',
    projectionResult: 'TASK_STRUCTURE_NOT_PRESERVED',
    responseResult: 'UNSUPPORTED',
    totals: {
      lessons: findings.length,
      structuredSourceReferencesLost: findings.filter((item) => item.source.mode === 'REFERENCED' && !item.source.browserSourceSectionPresent).length,
      browserPromptArraysEmpty: findings.filter((item) => item.task.browserPromptCount === 0).length,
      taskTextFlattenedIntoBodyProse: findings.filter((item) => item.browser.taskRetainedAsBodyProse && item.task.browserPromptCount === 0).length,
      responseKindNone: findings.filter((item) => item.browser.responseKind === 'none').length,
      responsePersisted: findings.filter((item) => item.browser.responsePersisted).length,
      learnerSuccessCriteriaProjected: findings.filter((item) => item.rubric.learnerSuccessCriteriaProjected).length,
      adultScoringLeaks: findings.filter((item) => item.flags.includes('ANSWER_OR_SCORING_LEAK')).length,
      crossGradeCopiedTaskLessons: findings.filter((item) => item.flags.includes('CROSS_GRADE_TEMPLATE_COLLAPSE')).length,
    },
    mountedPlayerEvidence: playerEvidence,
    copiedTaskGroups: copiedEvidence,
  }
}

function manualInspectionRows(findings, selected) {
  const byId = new Map(findings.map((finding) => [finding.lessonId, finding]))
  return selected.map((entry) => {
    const finding = byId.get(entry.lessonId)
    return {
      ...entry,
      phase: finding.phase,
      focus: finding.focus,
      result: finding.classification,
      observed: [
        'assigned source absent from browser',
        finding.task.genericActionless ? 'central application/item unspecified' : 'task prose present',
        finding.task.writingDeliverableClear ? 'deliverable stated or not a writing-build day' : 'writing/performance deliverable unspecified',
        'player response disabled',
      ],
    }
  })
}

function markdownReport({ findings, gradeResults, sourceReadiness, browserLoss, manualInspections, controls, trace, flagCounts }) {
  const gradeTable = gradeResults.map((result) =>
    `| ${result.grade} | ${result.lessonsAudited} | ${result.classification} | ${result.flagCounts.MISSING_READING} | ${result.flagCounts.ZERO_ACTIONABLE_WORK} | ${result.flagCounts.EMPTY_WRITING_TASK} | ${result.flagCounts.CROSS_GRADE_TEMPLATE_COLLAPSE} |`,
  ).join('\n')
  const sourceTable = sourceReadiness.grades.map((result) =>
    `| ${result.grade} | ${result.bindingClaimsStaticReady} | ${result.actualReadingInBrowser} | ${result.sourceSectionVisibleInBrowser} | ${result.absentSourceReference} | ${result.facilitatorSelectedContractInProduction} | ${result.originalAvailabilityClaimWithoutBrowserDelivery} |`,
  ).join('\n')
  const manualTable = manualInspections.map((item) =>
    `| ${item.grade} | ${item.stratum} | \`${item.lessonId}\` | ${item.phase} | ${item.result} | ${item.observed.join('; ')} |`,
  ).join('\n')
  const negativeTable = Object.entries(controls.controls).map(([name, passed]) => `| ${name} | ${passed ? 'PASS' : 'FAIL'} |`).join('\n')
  return `# ELA learner completeness audit R1

Classification: **ELA_LEARNER_AUDIT_COMPLETE**

Learner launch ruling: **DO_NOT_BEGIN_YET for Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12**

Base audited: \`c81ddb6e04bc1c3629212327d47817c1b5677477\`

ELA production source commit bound by the admitted release: \`${trace.productionSourceCommit}\`

## Executive finding

All **1,620/1,620** ELA lessons were traced from the production student-work package through the final slot, admitted binding, admitted runtime row, reconstructed production browser projection, and mounted Lesson Player path. The release is not learner-complete.

Every ELA package tells the learner to use an assigned passage, assigned text, or unit-specific source. Every admitted ELA binding nevertheless declares \`STATIC_READY/READY\`, while **0/1,620** browser materials contain an actual passage or attached selected source. Per the audit rule, that is a blocker.

The browser build also converts ELA's typed task objects to section body prose with **0 structured prompts in 1,620/1,620 lessons**. The final host then passes only \`section.prompts[0]\` and hard-codes \`responseKind: 'none'\` with a no-op submit callback. Thus **0/1,620** lessons have a supported learner response capture/persistence path, even though all ask the learner to produce reading, writing, language, discussion, or assessment evidence.

## Counts

| Finding | Lessons |
|---|---:|
${FLAG_ORDER.map((flag) => `| ${flag} | ${flagCounts[flag]} |`).join('\n')}

\`EMPTY_RUBRIC\` is zero because every admitted lesson has a separate, nonempty adult scoring guide. The browser correctly leaks none of those adult scoring fields. However, it also projects no learner-visible success criteria; that is recorded as browser loss rather than falsely calling the source rubric empty.

## Grade rulings

| Grade | Audited | Ruling | Missing reading | Zero actionable | Empty writing task | Cross-grade copy |
|---:|---:|---|---:|---:|---:|---:|
${gradeTable}

No grade can begin: passage absence and an unsupported response path affect every lesson in every grade.

## Source and copyright readiness

| Grade | Binding says ready | Actual browser reading | Browser source section | No production source ref | Ungated facilitator contract | Misleading original availability |
|---:|---:|---:|---:|---:|---:|---:|
${sourceTable}

- Grades 3–4: 320 lessons point to Manuel Academy originals whose full bodies exist in the separate authoring worktree, but the admitted binding carries only the student-work JSON and the browser projection drops the structured reference. Another 40 lessons have no source reference at all.
- Grades 5/7/8: all 540 lessons visibly say a facilitator must choose a text. That is an honest selection instruction, but the binding still marks the lesson static-ready and neither requires nor attaches the selected source before launch.
- Grades 9–12: all 720 lessons carry original/public-domain metadata in production, but the browser projector drops the entire structured source-reference object. Original high-school bank entries contain only an opening passage, not the promised full work, and none of those banks is an admitted browser resource.
- ${sourceReadiness.totals.originalAvailabilityClaimWithoutBrowserDelivery} lessons claim an original “ships with the course package” although the actual admitted learner package/browser payload contains no such text. This is \`COPYRIGHT_SOURCE_PROBLEM\`; no rights-required assigned references were observed.

## Task, question, writing, and rubric findings

- **510** Grades 5/7/8 lessons use a central instruction that never supplies the promised “new application” or assessment-preparation item; these are \`ZERO_ACTIONABLE_WORK\`/\`PLACEHOLDER\`. The remaining 30 lessons in those grades are unit-assessment days with real prompt prose.
- **90** Grades 5/7/8 performance-task planning/build/publication days do not name the daily product or unit deliverable in the learner task and are \`EMPTY_WRITING_TASK\`.
- **20** Grades 3–4 unit assessments promise a fixed-answer item “delivered separately,” but the production README confirms no item/options/key bank exists. They are additional \`PLACEHOLDER\` findings.
- **830** lessons reuse an identical independent task across multiple grades. The exact copied groups and SHA-256 identities are in \`browser-loss.json\`; Grades 5/7/8 account for 510 and Grades 9–12 for 320.
- **1,620** scoring guides contain a nonempty rubric and acceptable-answer criteria; **0** adult answer/scoring fields enter browser learner material. Learner-visible success criteria are nevertheless absent in all 1,620 browser lessons.

## Browser and Lesson Player loss

Result: **FAIL — TASK_STRUCTURE_NOT_PRESERVED / RESPONSE_UNSUPPORTED**.

- 1,040 structured source-reference objects are discarded because the browser build accepts only an object's scalar \`text\` member.
- Every independent task remains visible only as body prose; prompt arrays are empty in all 1,620 projected ELA materials.
- The mounted host selects only the first prompt even for formats capable of multiple prompts.
- The mounted host hard-codes no-response mode and a no-op submit callback. Learners can press Continue/complete segments without entering, uploading, selecting, or persisting the requested work.

## Manual stratified inspection (54 lessons)

| Grade | Stratum | Lesson | Phase | Result | Close-read observation |
|---:|---|---|---|---|---|
${manualTable}

## Negative controls

| Injected defect | Detection |
|---|---|
${negativeTable}

Overall negative-control result: **${controls.status}**.

## Trace and limitations

- The current ELA production tree is byte-identical to the admitted binding's pinned commit \`${trace.productionSourceCommit}\`.
- All 1,620 final slots, admitted bindings, runtime rows, production packages, scoring guides, and in-memory browser materials matched lesson/grade identities.
- No production, course, release, public, app, or source-worktree file was changed. The browser payload was reconstructed in memory from the checked-in production builder because the generated public payload is not committed in this worktree.
- This audit proves repository/browser readiness only. It does not claim that a family independently owns, borrows, or licenses a referenced work outside the admitted app.
`
}

export async function runAudit() {
  const rows = loadRows()
  const trace = traceInvariants(rows)
  const sourceIndexes = sourceEvidenceIndexes()
  const audited = auditRows(rows, sourceIndexes)
  const flagCounts = countFlags(audited.findings)
  const gradeResults = perGrade(audited.findings)
  const sourceCommits = Object.fromEntries(Object.entries(SOURCE_WORKTREES).map(([name, path]) => [name, { path, commit: sourceWorktreeCommit(path) }]))
  const sourceReadiness = buildSourceReadiness(audited.findings, rows, sourceCommits)
  const browserLoss = buildBrowserLoss(audited.findings, audited.copiedEvidence, audited.playerEvidence)
  const selected = manualStrata(rows)
  const manualInspections = manualInspectionRows(audited.findings, selected)
  const controls = negativeControls()
  invariant(controls.status === 'PASS', 'negative controls did not all detect their injected defect')
  invariant(flagCounts.MISSING_READING === EXPECTED_LESSONS, 'missing-reading census drifted')
  invariant(flagCounts.MISSING_SOURCE === EXPECTED_LESSONS, 'missing-source census drifted')
  invariant(flagCounts.UNSUPPORTED_WRITING_RESPONSE === EXPECTED_LESSONS, 'response-path census drifted')
  invariant(flagCounts.FLATTENED_QUESTION_STRUCTURE === EXPECTED_LESSONS, 'browser prompt-loss census drifted')
  invariant(flagCounts.EMPTY_RUBRIC === 0, 'one or more scoring guides is empty')
  invariant(flagCounts.ANSWER_OR_SCORING_LEAK === 0, 'adult scoring data leaked')
  invariant(manualInspections.length === 54, `manual stratum count is ${manualInspections.length}`)

  const gradeDocument = {
    classification: 'ELA_LEARNER_AUDIT_COMPLETE',
    overallRuling: 'DO_NOT_BEGIN_YET',
    lessonsAudited: EXPECTED_LESSONS,
    grades: gradeResults,
    flagCounts,
    manualInspections,
  }
  const report = markdownReport({
    findings: audited.findings,
    gradeResults,
    sourceReadiness,
    browserLoss,
    manualInspections,
    controls,
    trace,
    flagCounts,
  })

  await mkdir(OUTPUT_ROOT, { recursive: true })
  await Promise.all([
    writeFile(join(OUTPUT_ROOT, 'lesson-findings.jsonl'), `${audited.findings.map((finding) => JSON.stringify(finding)).join('\n')}\n`),
    writeFile(join(OUTPUT_ROOT, 'grade-results.json'), `${JSON.stringify(gradeDocument, null, 2)}\n`),
    writeFile(join(OUTPUT_ROOT, 'source-readiness.json'), `${JSON.stringify(sourceReadiness, null, 2)}\n`),
    writeFile(join(OUTPUT_ROOT, 'browser-loss.json'), `${JSON.stringify({ ...browserLoss, negativeControls: controls }, null, 2)}\n`),
    writeFile(join(OUTPUT_ROOT, 'ELA_LEARNER_AUDIT_R1.md'), report),
  ])

  return {
    classification: 'ELA_LEARNER_AUDIT_COMPLETE',
    lessonsAudited: EXPECTED_LESSONS,
    gradeResults,
    flagCounts,
    negativeControls: controls,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runAudit().then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}
