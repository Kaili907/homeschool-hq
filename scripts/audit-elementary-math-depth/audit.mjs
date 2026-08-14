#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(SCRIPT_DIR, '../..')
const MATH_ROOT = join(ROOT, 'curriculum-production/final/mathematics')
const ACTIVE = join(MATH_ROOT, 'active')
const OUTPUT = join(ROOT, 'docs/curriculum-quality/elementary-math/audit-r1')
const GRADES = [3, 4, 5]
const AUTHORITATIVE_BASE = '56dd8a45fee1ca03dd5f83e1466c9f081824d6b9'
const AUDIT_VERSION = 'elementary-math-depth-audit-r1'

const ENGINEERING_PHRASES = [
  'instructional example',
  'diagnostic evidence',
  'mastery state',
  'advisory only',
  'response kind',
  'active segment',
]

const TEACHER_LANGUAGE = [
  'teaching adult',
  'teaching parent',
  'hand this section in',
  'mastery check',
  'unit assessment',
  'reassessment',
  'diagnostic',
  'publication',
  'presentation',
  'independently-timed',
  'graded coverage',
]

const ADVANCED_NON_MATH_VOCABULARY = [
  'diagnostic',
  'generalization',
  'generalize',
  'instructional',
  'mastery',
  'publication',
  'reassessment',
  'representation',
  'synthesis',
  'consolidation',
  'independently-timed',
  'response expectation',
  'quantities',
]

const REMEDIATION_PROFILES = new Set([
  'error-analysis-and-repair',
  'reteach',
  'targeted-correction',
  'targeted-correction-and-reassessment',
])

const TYPE_BY_PROFILE = {
  'diagnostic-launch': 'diagnostic',
  'retrieval-and-fluency': 'review',
  'synthesis-and-review': 'review',
  consolidation: 'review',
  'assessment-preparation': 'review',
  'error-analysis-and-repair': 'remediation',
  reteach: 'remediation',
  'targeted-correction': 'remediation',
  'targeted-correction-and-reassessment': 'remediation',
  'independent-evidence': 'mastery',
  'independent-evidence-varied': 'mastery',
  'independent-application': 'mastery',
  'unit-assessment': 'assessment-like',
}

const OTHER_PROFILES = new Set([
  'applied-problem-solving',
  'concept-extension',
  'investigation',
  'problem-seminar',
  'performance-planning',
  'performance-build',
  'transfer',
  'transfer-reflection-publication',
  'publication-reflection',
])

// This matrix operationalizes the proposed richer standard for this audit. It
// deliberately varies by lesson purpose; a unit assessment is not penalized
// for omitting worked examples, and a planning day is not treated as a quiz.
const PROFILE_TARGETS = {
  diagnostic: { teaching: 1, worked: 1, guided: 0, independent: 5, mastery: 3, remediation: 0, challenge: 0 },
  normal: { teaching: 1, worked: 2, guided: 4, independent: 5, mastery: 3, remediation: 0, challenge: 0 },
  review: { teaching: 0, worked: 0, guided: 0, independent: 8, mastery: 4, remediation: 0, challenge: 0 },
  remediation: { teaching: 1, worked: 2, guided: 4, independent: 3, mastery: 0, remediation: 3, challenge: 0 },
  mastery: { teaching: 0, worked: 0, guided: 0, independent: 6, mastery: 3, remediation: 0, challenge: 0 },
  assessment: { teaching: 0, worked: 0, guided: 0, independent: 0, mastery: 8, remediation: 0, challenge: 0 },
  other: { teaching: 1, worked: 2, guided: 2, independent: 4, mastery: 0, remediation: 0, challenge: 2 },
}

const PROFILE_TARGET_OVERRIDES = {
  'error-analysis-and-repair': { mastery: 0 },
  reteach: { mastery: 0 },
  'targeted-correction': { mastery: 0 },
  'targeted-correction-and-reassessment': { independent: 0, mastery: 3 },
  'performance-planning': { independent: 0, mastery: 0, worked: 2, guided: 3, challenge: 2 },
  'performance-build': { teaching: 0, worked: 0, guided: 3, independent: 5, mastery: 0, challenge: 2 },
  'transfer-reflection-publication': { guided: 0, independent: 4 },
  'publication-reflection': { guided: 0, independent: 4 },
  transfer: { guided: 0, independent: 5 },
  'concept-extension': { mastery: 0, challenge: 2 },
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function round(value, places = 2) {
  const factor = 10 ** places
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function promptTemplate(value) {
  return normalizeText(value)
    .replace(/\b[a-z]\b/g, '<v>')
    .replace(/-?\$?\d[\d,]*(?:\.\d+)?(?:\/\d+)?%?/g, '<n>')
    .replace(/[^\p{L}<>]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function words(value) {
  return String(value ?? '').match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []
}

function sentences(value) {
  const cleaned = String(value ?? '').replace(/\b(?:Mr|Mrs|Dr)\./g, (match) => match.replace('.', ''))
  return cleaned.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean)
}

function syllablesInWord(value) {
  const word = value.toLowerCase().replace(/[^a-z]/g, '')
  if (word.length <= 3) return word.length ? 1 : 0
  const trimmed = word.replace(/(?:es|ed|e)$/i, '')
  const groups = trimmed.match(/[aeiouy]+/g)
  return Math.max(1, groups?.length ?? 1)
}

function readability(value) {
  const tokenList = words(value)
  const sentenceList = sentences(value)
  if (tokenList.length === 0) return { words: 0, sentences: 0, avgSentenceWords: 0, fleschKincaidGrade: null }
  const syllables = tokenList.reduce((sum, word) => sum + syllablesInWord(word), 0)
  const sentenceCount = Math.max(1, sentenceList.length)
  const grade = 0.39 * (tokenList.length / sentenceCount) + 11.8 * (syllables / tokenList.length) - 15.59
  return {
    words: tokenList.length,
    sentences: sentenceList.length,
    avgSentenceWords: round(tokenList.length / sentenceCount),
    fleschKincaidGrade: round(Math.max(0, grade)),
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return round(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower))
}

function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((total, value) => total + value, 0)
  return {
    n: sorted.length,
    min: sorted[0] ?? null,
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    max: sorted.at(-1) ?? null,
    mean: sorted.length ? round(sum / sorted.length) : null,
  }
}

function histogram(values) {
  const result = {}
  for (const value of values) result[value] = (result[value] ?? 0) + 1
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => Number(a) - Number(b)))
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function lessonRecords() {
  const records = []
  for (const grade of GRADES) {
    const packageDir = join(ACTIVE, 'packages', `grade-${String(grade).padStart(2, '0')}`)
    const keyDir = join(ACTIVE, 'answer-keys', `grade-${String(grade).padStart(2, '0')}`)
    const names = (await readdir(packageDir)).filter((name) => name.endsWith('.package.json')).sort()
    for (const name of names) {
      const packagePath = join(packageDir, name)
      const pkg = await readJson(packagePath)
      const keyName = `${pkg.lessonRef.lessonId}.key.json`
      const keyPath = join(keyDir, keyName)
      records.push({
        grade,
        pkg,
        key: await readJson(keyPath),
        packagePath: relative(ROOT, packagePath),
        keyPath: relative(ROOT, keyPath),
      })
    }
  }
  return records.sort((a, b) => a.grade - b.grade || a.pkg.lessonRef.courseDay - b.pkg.lessonRef.courseDay)
}

function classifyLessonType(profile) {
  if (TYPE_BY_PROFILE[profile]) return TYPE_BY_PROFILE[profile]
  if (OTHER_PROFILES.has(profile)) return 'other'
  return 'normal concept'
}

function targetsFor(profile, lessonType) {
  const baseKey = lessonType === 'normal concept'
    ? 'normal'
    : lessonType === 'assessment-like'
      ? 'assessment'
      : lessonType
  return { ...PROFILE_TARGETS[baseKey], ...(PROFILE_TARGET_OVERRIDES[profile] ?? {}) }
}

function countSections(pkg) {
  const count = (kind) => pkg.sections
    .filter((section) => section.kind === kind)
    .reduce((sum, section) => sum + section.items.length, 0)
  const allItems = pkg.sections.flatMap((section) => section.items)
  const explicitRemediation = pkg.sections
    .filter((section) => section.kind === 'remediation' || section.kind === 'reteach')
    .reduce((sum, section) => sum + section.items.length, 0)
  return {
    teachingExplanationBlocks: pkg.sections.filter((section) => section.kind === 'instructional-example').length,
    workedExamples: allItems.filter((item) => item.kind === 'worked-example').length,
    guidedItems: count('guided-practice'),
    independentItems: count('independent-practice'),
    masteryItems: count('mastery-check'),
    remediationItems: explicitRemediation,
    remediationProfileItems: REMEDIATION_PROFILES.has(pkg.blueprint.profile)
      ? allItems.filter((item) => item.kind !== 'worked-example').length
      : 0,
    challengeExtensionItems: count('extension'),
    totalLearnerItems: allItems.length,
    totalScoredItems: allItems.filter((item) => item.kind !== 'worked-example').length,
  }
}

function workedExampleDepth(pkg) {
  const examples = pkg.sections.flatMap((section) => section.items)
    .filter((item) => item.kind === 'worked-example')
  const details = examples.map((item) => {
    const steps = item.workedSolution?.steps ?? []
    const normalizedAnswer = normalizeText(item.workedSolution?.answer)
    const substantive = steps.filter((step) => {
      const normalized = normalizeText(step).replace(/[.]/g, '')
      return words(step).length >= 4 && normalized !== normalizedAnswer
    })
    const reasoningMarkers = steps.filter((step) => /\b(because|so|therefore|since|nearer|means|shows|reason|first|then|next|compare|check|correct)\b/i.test(step)).length
    let quality = 'WEAK'
    if (steps.length >= 3 && substantive.length >= 2 && reasoningMarkers >= 1) quality = 'STRONG'
    else if (steps.length >= 2 && substantive.length >= 1) quality = 'ADEQUATE'
    return {
      ref: item.ref,
      stepCount: steps.length,
      substantiveStepCount: substantive.length,
      reasoningMarkerSteps: reasoningMarkers,
      answerOnly: steps.length === 0 || substantive.length === 0,
      quality,
    }
  })
  return {
    examples: details,
    stepCount: distribution(details.map((detail) => detail.stepCount)),
    answerOnlyCount: details.filter((detail) => detail.answerOnly).length,
    weakCount: details.filter((detail) => detail.quality === 'WEAK').length,
    adequateCount: details.filter((detail) => detail.quality === 'ADEQUATE').length,
    strongCount: details.filter((detail) => detail.quality === 'STRONG').length,
  }
}

function learnerTextFields(pkg) {
  const fields = [
    { location: 'lessonRef.title', kind: 'title', text: pkg.lessonRef.title },
    { location: 'lessonRef.focus', kind: 'focus', text: pkg.lessonRef.focus },
  ]
  for (const section of pkg.sections) {
    fields.push({ location: `sections.${section.sectionId}.title`, kind: 'section-title', text: section.title })
    fields.push({ location: `sections.${section.sectionId}.directions`, kind: 'directions', text: section.directions })
    for (const item of section.items) {
      fields.push({ location: item.ref, kind: 'prompt', text: item.prompt })
      for (const [index, choice] of (item.choices ?? []).entries()) {
        fields.push({ location: `${item.ref}.choices.${index}`, kind: 'choice', text: choice })
      }
      for (const [index, step] of (item.workedSolution?.steps ?? []).entries()) {
        fields.push({ location: `${item.ref}.workedSolution.steps.${index}`, kind: 'worked-step', text: step })
      }
      if (item.responseExpectation) {
        fields.push({ location: `${item.ref}.responseExpectation`, kind: 'response-expectation', text: item.responseExpectation })
      }
    }
  }
  return fields.filter((field) => typeof field.text === 'string' && field.text.trim() !== '')
}

function readabilityFindingsFor(pkg) {
  const grade = pkg.lessonRef.grade
  const sentenceLimit = grade === 3 ? 18 : grade === 4 ? 20 : 22
  const directionLimit = grade === 3 ? 18 : grade === 4 ? 20 : 22
  const paragraphLimit = grade === 3 ? 45 : grade === 4 ? 50 : 55
  const findings = []
  const fields = learnerTextFields(pkg)
  for (const field of fields) {
    const normalized = normalizeText(field.text)
    const fieldWords = words(field.text)
    for (const phrase of ENGINEERING_PHRASES) {
      const pattern = new RegExp(`\\b${phrase.replace(/ /g, '\\s+')}s?\\b`, 'i')
      if (pattern.test(field.text)) {
        findings.push({ code: 'ENGINEERING_LANGUAGE', phrase, ...field })
      }
    }
    for (const phrase of TEACHER_LANGUAGE) {
      if (normalized.includes(phrase)) findings.push({ code: 'TEACHER_FACING_LANGUAGE', phrase, ...field })
    }
    for (const term of ADVANCED_NON_MATH_VOCABULARY) {
      if (normalized.includes(term)) findings.push({ code: 'UNEXPLAINED_NON_MATH_VOCABULARY', phrase: term, ...field })
    }
    for (const sentence of sentences(field.text)) {
      const length = words(sentence).length
      if (length > sentenceLimit) {
        findings.push({ code: 'LONG_SENTENCE', wordCount: length, threshold: sentenceLimit, sentence, ...field })
      }
    }
    if (fieldWords.length > paragraphLimit) {
      findings.push({ code: 'LONG_PARAGRAPH', wordCount: fieldWords.length, threshold: paragraphLimit, ...field })
    }
    if (field.kind === 'directions') {
      const clauseMarkers = field.text.match(/\b(and|then|before|after|while|if|so that|but|when)\b/gi) ?? []
      const imperativeCount = field.text.match(/(?:^|[.!?]\s+)(read|study|work|show|try|write|explain|compare|find|fill|talk|say|decide|plan|carry|set|use|notice|argue|stop|check)\b/gi)?.length ?? 0
      if (fieldWords.length > directionLimit || sentences(field.text).length > 2) {
        findings.push({ code: 'DENSE_DIRECTIONS', wordCount: fieldWords.length, threshold: directionLimit, ...field })
      }
      if (clauseMarkers.length >= 2 || (clauseMarkers.length >= 1 && imperativeCount >= 2)) {
        findings.push({ code: 'MULTI_CLAUSE_DIRECTIONS', clauseMarkers: clauseMarkers.length, imperativeCount, ...field })
      }
    }
  }
  const combined = fields.map((field) => field.text).join(' ')
  return {
    sentenceWordLimit: sentenceLimit,
    findings,
    advisoryMachineReadability: readability(combined),
  }
}

function duplicateGroups(items, keyFn) {
  const groups = new Map()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    const current = groups.get(key) ?? []
    current.push(item.ref)
    groups.set(key, current)
  }
  return [...groups.entries()]
    .filter(([, refs]) => refs.length > 1)
    .map(([signature, refs]) => ({ signature, refs }))
    .sort((a, b) => b.refs.length - a.refs.length || a.signature.localeCompare(b.signature))
}

function questionAnalysis(pkg) {
  const items = pkg.sections.flatMap((section) => section.items)
  const scored = items.filter((item) => item.kind !== 'worked-example')
  const examples = items.filter((item) => item.kind === 'worked-example')
  const exactWithin = duplicateGroups(scored, (item) => normalizeText(item.prompt))
  const nearWithin = duplicateGroups(scored, (item) => `${item.itemType}|${promptTemplate(item.prompt)}`)
  const shownAnswerReuse = []
  const examplesByPrompt = new Map(examples.map((item) => [normalizeText(item.prompt), item.ref]))
  for (const item of scored) {
    const exampleRef = examplesByPrompt.get(normalizeText(item.prompt))
    if (exampleRef) shownAnswerReuse.push({ exampleRef, scoredRef: item.ref, prompt: item.prompt })
  }
  const passiveQuestionList = examples.length === 0
    && pkg.sections.every((section) => ['independent-practice', 'mastery-check'].includes(section.kind))
  return {
    distinctItemTypes: new Set(scored.map((item) => item.itemType)).size,
    distinctStandards: new Set(scored.map((item) => item.standard)).size,
    distinctDifficulties: [...new Set(scored.map((item) => item.difficulty))].sort(),
    itemKinds: Object.fromEntries([...new Set(scored.map((item) => item.kind))].sort().map((kind) => [kind, scored.filter((item) => item.kind === kind).length])),
    constructedResponseItems: scored.filter((item) => item.kind === 'constructed-response').length,
    multipleChoiceItems: scored.filter((item) => item.kind === 'multiple-choice').length,
    promptTemplateCount: new Set(scored.map((item) => `${item.itemType}|${promptTemplate(item.prompt)}`)).size,
    exactDuplicateGroupsWithinLesson: exactWithin,
    nearDuplicateGroupsWithinLesson: nearWithin,
    passiveQuestionList,
    shownAnswerReuse,
    promptBankSignature: createHash('sha256').update(scored.map((item) => `${item.itemType}|${promptTemplate(item.prompt)}`).sort().join('\n')).digest('hex'),
  }
}

function findForbiddenAnswerKeys(value, path = '', inWorkedSolution = false) {
  const findings = []
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findings.push(...findForbiddenAnswerKeys(entry, `${path}.${index}`, inWorkedSolution)))
    return findings
  }
  if (!value || typeof value !== 'object') return findings
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key
    const nextInWorked = inWorkedSolution || key === 'workedSolution'
    if (!nextInWorked && ['answer', 'answerIndex', 'correctAnswer', 'solutionReasoning', 'referenceExample', 'commonErrors', 'verification'].includes(key)) {
      findings.push(nextPath)
    }
    findings.push(...findForbiddenAnswerKeys(nested, nextPath, nextInWorked))
  }
  return findings
}

function answerLeakage(pkg, question) {
  const forbiddenFields = findForbiddenAnswerKeys(pkg.sections, 'sections')
  // An instructional worked solution is supposed to state its answer. Verbal
  // leakage means an answer disclosure outside that explicitly modeled space.
  const verbalLeaks = learnerTextFields(pkg).filter((field) => field.kind !== 'worked-step'
    && /\b(?:the|correct) answer is\b|\banswer\s*:\s*[-$\d]/i.test(field.text))
  return {
    forbiddenAnswerFields: forbiddenFields,
    verbalAnswerLeaks: verbalLeaks,
    shownWorkedAnswerReusedAsScoredPrompt: question.shownAnswerReuse,
    adultAnswerLeak: forbiddenFields.length > 0 || verbalLeaks.length > 0,
    anyAnswerLeakage: forbiddenFields.length > 0 || verbalLeaks.length > 0 || question.shownAnswerReuse.length > 0,
  }
}

function deficiencyCodes(counts, targets, worked, readabilityResult) {
  const codes = []
  if (counts.teachingExplanationBlocks < targets.teaching || worked.weakCount > 0 || worked.answerOnlyCount > 0) codes.push('NEEDS_MORE_EXPLANATION')
  if (counts.workedExamples < targets.worked) codes.push('NEEDS_MORE_WORKED_EXAMPLES')
  if (counts.guidedItems < targets.guided) codes.push('NEEDS_GUIDED_PRACTICE')
  if (counts.independentItems < targets.independent) codes.push('NEEDS_INDEPENDENT_DEPTH')
  if (counts.masteryItems < targets.mastery) codes.push('NEEDS_MASTERY_DEPTH')
  if (counts.remediationItems < targets.remediation) codes.push('NEEDS_REMEDIATION')
  if (counts.challengeExtensionItems < targets.challenge) codes.push('NEEDS_CHALLENGE_DEPTH')
  if (readabilityResult.findings.some((finding) => ['LONG_SENTENCE', 'DENSE_DIRECTIONS', 'UNEXPLAINED_NON_MATH_VOCABULARY', 'TEACHER_FACING_LANGUAGE', 'ENGINEERING_LANGUAGE'].includes(finding.code))) {
    codes.push('LANGUAGE_TOO_ADVANCED')
  }
  return [...new Set(codes)]
}

function depthClassification(codes) {
  if (codes.length === 0) return 'DEEP_ENOUGH'
  if (codes.length === 1) return codes[0]
  return 'MULTIPLE_DEFECTS'
}

function negativeControls(counts, worked, question, readabilityResult, leakage) {
  return {
    oneWorkedExampleOnly: counts.workedExamples === 1,
    answerOnlyExample: worked.answerOnlyCount > 0,
    twoIndependentQuestions: counts.independentItems === 2,
    emptyMastery: counts.masteryItems === 0,
    noExplicitRemediation: counts.remediationItems === 0,
    // Section labels are included because they are learner-visible navigation
    // language even when the literal directions sentence is plain.
    engineeringLanguageDirection: readabilityResult.findings.some((finding) => finding.code === 'ENGINEERING_LANGUAGE' && ['directions', 'section-title'].includes(finding.kind)),
    duplicateQuestionBankWithinLesson: question.exactDuplicateGroupsWithinLesson.length > 0 || question.nearDuplicateGroupsWithinLesson.length > 0,
    adultAnswerLeak: leakage.adultAnswerLeak,
  }
}

function groupCounts(values, keyFn) {
  const result = {}
  for (const value of values) {
    const key = keyFn(value)
    result[key] = (result[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)))
}

function enumCounts(values, keys) {
  const observed = groupCounts(values, (value) => value)
  return Object.fromEntries(keys.map((key) => [key, observed[key] ?? 0]))
}

function sourceFamilyFor(finding) {
  const grade = finding.grade
  const unit = finding.unitNumber
  if (grade <= 4) {
    return {
      compositionFamily: 'g34-phase-blueprint',
      compositionSource: 'curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/blueprint.ts',
      compositionRepairSource: 'curriculum-production/student-work/mathematics-g34/src/blueprint.ts',
      compositionRepairSourcePresentAtBase: false,
      itemBankFamily: `g${grade}-unit-${String(unit).padStart(2, '0')}`,
      itemBankSource: `curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/g34/grade${grade}Unit${unit}.ts`,
      itemBankRepairSource: `curriculum-production/student-work/mathematics-g34/src/g34/grade${grade}Unit${unit}.ts`,
      itemBankRepairSourcePresentAtBase: false,
      upstreamInput: { branch: 'mac/g34-math-production-r1', revision: 'c3b24f047b8aebd5e08f9b8022eef20ea187e190' },
      emitterSource: 'curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/emit.ts',
    }
  }
  return {
    compositionFamily: 'g5-12-phase-blueprint',
    compositionSource: 'curriculum-production/final/mathematics/evidence/oracle-sources/grades-05-12/src/blueprint.ts',
    compositionRepairSource: 'upstream mac/math-production-materials-r1 source tree (blueprint.ts)',
    compositionRepairSourcePresentAtBase: false,
    itemBankFamily: `g5-unit-${String(unit).padStart(2, '0')}`,
    itemBankSource: `src/curriculum/grade5MathUnit${unit}Generator.ts`,
    itemBankRepairSource: `src/curriculum/grade5MathUnit${unit}Generator.ts`,
    itemBankRepairSourcePresentAtBase: true,
    upstreamInput: { branch: 'mac/math-production-materials-r1', revision: '314f517f98a5d4a10415676f49576f526cd1f1d9' },
    adapterSource: 'curriculum-production/final/mathematics/evidence/oracle-sources/grades-05-12/src/canonicalItemBank.ts',
    emitterSource: 'curriculum-production/final/mathematics/evidence/oracle-sources/grades-05-12/src/emit.ts',
  }
}

function buildGeneratorFamilies(findings) {
  const composition = []
  for (const family of ['g34-phase-blueprint', 'g5-12-phase-blueprint']) {
    const scoped = findings.filter((finding) => sourceFamilyFor(finding).compositionFamily === family)
    composition.push({
      family,
      source: sourceFamilyFor(scoped[0]).compositionSource,
      repairSource: sourceFamilyFor(scoped[0]).compositionRepairSource,
      repairSourcePresentAtBase: sourceFamilyFor(scoped[0]).compositionRepairSourcePresentAtBase,
      upstreamInput: sourceFamilyFor(scoped[0]).upstreamInput,
      grades: [...new Set(scoped.map((finding) => finding.grade))],
      lessons: scoped.length,
      profiles: groupCounts(scoped, (finding) => finding.profile),
      defectLessons: groupCounts(scoped.flatMap((finding) => finding.defectCodes.map((code) => ({ code, lessonId: finding.lessonId }))), (entry) => entry.code),
      responsibility: 'section composition, section counts, shared learner-facing titles and directions',
    })
  }
  const itemFamilies = []
  for (const grade of GRADES) {
    for (let unit = 1; unit <= 10; unit += 1) {
      const scoped = findings.filter((finding) => finding.grade === grade && finding.unitNumber === unit)
      const source = sourceFamilyFor(scoped[0])
      itemFamilies.push({
        family: source.itemBankFamily,
        source: source.itemBankSource,
        repairSource: source.itemBankRepairSource,
        repairSourcePresentAtBase: source.itemBankRepairSourcePresentAtBase,
        upstreamInput: source.upstreamInput,
        grade,
        unit,
        lessons: scoped.length,
        lessonIds: scoped.map((finding) => finding.lessonId),
        distinctItemTypes: [...new Set(scoped.flatMap((finding) => finding.itemTypes))].sort(),
        languageFindingCount: scoped.reduce((sum, finding) => sum + finding.readability.findingCount, 0),
        duplicateAffectedLessons: scoped.filter((finding) => finding.duplication.anyWithinLesson || finding.duplication.duplicateBankClusterSize > 1).length,
        weakWorkedExampleLessons: scoped.filter((finding) => finding.workedExampleDepth.weakCount > 0 || finding.workedExampleDepth.answerOnlyCount > 0).length,
        responsibility: 'prompt templates, worked-example definitions, distractors, item vocabulary, and question variety',
      })
    }
  }
  return {
    auditVersion: AUDIT_VERSION,
    authoritativeBase: AUTHORITATIVE_BASE,
    compositionFamilies: composition,
    itemBankFamilies: itemFamilies,
    integrationFamily: {
      source: 'curriculum-production/final/mathematics/build.py',
      responsibility: 'derived schedules, manifests, and checksums only; not a curriculum-content repair surface',
    },
  }
}

function buildRepairPlan(findings) {
  const stages = [
    {
      stage: 1,
      mode: 'serialized-shared-composition',
      builders: [
        {
          builderId: 'COMPOSITION_G34',
          owns: ['curriculum-production/student-work/mathematics-g34/src/blueprint.ts'],
          sourceSnapshot: 'curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/blueprint.ts',
          prerequisite: 'Recover the canonical source tree from mac/g34-math-production-r1@c3b24f047b8aebd5e08f9b8022eef20ea187e190; do not edit the vendored evidence snapshot as the repair source.',
          grades: [3, 4],
          lessonCount: findings.filter((finding) => finding.grade <= 4).length,
          lessonIds: findings.filter((finding) => finding.grade <= 4).map((finding) => finding.lessonId),
          purpose: 'Raise type-aware section depth and replace shared teacher/engineering directions.',
        },
        {
          builderId: 'COMPOSITION_G5',
          owns: ['upstream mac/math-production-materials-r1 source tree (blueprint.ts)'],
          sourceSnapshot: 'curriculum-production/final/mathematics/evidence/oracle-sources/grades-05-12/src/blueprint.ts',
          prerequisite: 'Recover the canonical composition source from mac/math-production-materials-r1@314f517f98a5d4a10415676f49576f526cd1f1d9; do not edit the vendored evidence snapshot as the repair source.',
          grades: [5],
          lessonCount: findings.filter((finding) => finding.grade === 5).length,
          lessonIds: findings.filter((finding) => finding.grade === 5).map((finding) => finding.lessonId),
          purpose: 'Raise Grade 5 type-aware section depth and replace shared teacher/engineering directions without changing other grades.',
        },
      ],
      overlapPolicy: 'Builders own different blueprint files. Run before unit-bank work because composition changes every derived package in scope.',
    },
    {
      stage: 2,
      mode: 'parallel-non-overlapping-unit-builders',
      builders: [],
      overlapPolicy: 'Exactly one builder per grade/unit. Each owns 18 lesson IDs and one unit item-bank source; no lesson ID or source file overlaps another builder.',
    },
    {
      stage: 3,
      mode: 'serialized-integration',
      builders: [{
        builderId: 'INTEGRATION_REBUILD_VALIDATE',
        owns: [
          'curriculum-production/final/mathematics/active/packages/grade-03',
          'curriculum-production/final/mathematics/active/packages/grade-04',
          'curriculum-production/final/mathematics/active/packages/grade-05',
          'curriculum-production/final/mathematics/active/answer-keys/grade-03',
          'curriculum-production/final/mathematics/active/answer-keys/grade-04',
          'curriculum-production/final/mathematics/active/answer-keys/grade-05',
          'curriculum-production/final/mathematics/schedules/grade-03.csv',
          'curriculum-production/final/mathematics/schedules/grade-04.csv',
          'curriculum-production/final/mathematics/schedules/grade-05.csv',
        ],
        lessonCount: findings.length,
        purpose: 'Regenerate once after all source changes, run correctness/answer-leak/readability gates, and reconcile manifests/checksums.',
      }],
      overlapPolicy: 'The integration builder is the only owner of derived active packages and keys; unit builders must not commit generated package files.',
    },
  ]
  for (const grade of GRADES) {
    for (let unit = 1; unit <= 10; unit += 1) {
      const scoped = findings.filter((finding) => finding.grade === grade && finding.unitNumber === unit)
      const source = sourceFamilyFor(scoped[0])
      stages[1].builders.push({
        builderId: `G${grade}_U${String(unit).padStart(2, '0')}_ITEM_BANK`,
        owns: [source.itemBankRepairSource],
        sourceSnapshot: source.itemBankRepairSourcePresentAtBase ? source.itemBankRepairSource : source.itemBankSource,
        prerequisite: source.itemBankRepairSourcePresentAtBase
          ? null
          : `Recover ${source.itemBankRepairSource} from ${source.upstreamInput.branch}@${source.upstreamInput.revision}.`,
        grade,
        unit,
        lessonCount: scoped.length,
        lessonIds: scoped.map((finding) => finding.lessonId),
        currentDefectLessons: groupCounts(scoped.flatMap((finding) => finding.defectCodes.map((code) => ({ code }))), (entry) => entry.code),
        languageFindingCount: scoped.reduce((sum, finding) => sum + finding.readability.findingCount, 0),
        duplicationAffectedLessons: scoped.filter((finding) => finding.duplication.anyWithinLesson || finding.duplication.duplicateBankClusterSize > 1).length,
        purpose: 'Deepen worked reasoning, diversify prompt templates/contexts, and simplify item-specific learner language.',
      })
    }
  }
  return {
    auditVersion: AUDIT_VERSION,
    repairPerformed: false,
    lessonUniverse: findings.length,
    stages,
    safetyRules: [
      'Preserve lesson IDs, schedule days, standards, and separate answer-key authority.',
      'Do not let parallel builders edit shared blueprints, emitters, active packages, schedules, manifests, or checksums.',
      'Re-run this audit after integration and require zero forbidden learner answer fields.',
      'Review machine readability findings as advisory evidence; human elementary-math review remains authoritative.',
    ],
    repairPrerequisites: [
      'The authoritative base retains Grade 3/4 generator code as an evidence snapshot, while the canonical repair source tree is absent. Restore it from mac/g34-math-production-r1@c3b24f047b8aebd5e08f9b8022eef20ea187e190 before repair.',
      'The Grade 5 unit generator files are present, but the shared Grade 5-12 composition pipeline is retained only as an evidence snapshot. Restore its canonical source from mac/math-production-materials-r1@314f517f98a5d4a10415676f49576f526cd1f1d9 before composition repair.',
    ],
  }
}

function tutorInventory(records, findings) {
  const answers = records.flatMap((record) => record.key.answers ?? [])
  const scoredItems = records.flatMap((record) => record.pkg.sections.flatMap((section) => section.items).filter((item) => item.kind !== 'worked-example'))
  const withCommonErrors = answers.filter((answer) => Array.isArray(answer.commonErrors) && answer.commonErrors.length > 0)
  const commonErrorsWithRemediation = withCommonErrors.filter((answer) => answer.commonErrors.every((error) => typeof error.remediation === 'string' && error.remediation.trim() !== ''))
  return {
    conceptIds: {
      status: 'PARTIAL_DERIVATION_ONLY',
      coverage: { scoredItems: scoredItems.length, withItemType: scoredItems.filter((item) => item.itemType).length, withStandard: scoredItems.filter((item) => item.standard).length, explicitConceptId: 0 },
      gap: 'itemType plus standard can form a provisional concept key, but no stable canonical conceptId or concept-version field exists.',
    },
    prerequisites: {
      status: 'GAP',
      coverage: { lessons: findings.length, explicitPrerequisiteLists: 0 },
      gap: 'Course order can suggest earlier material, but no prerequisite edge, required concept, or minimum mastery threshold is encoded.',
    },
    misconceptionMetadata: {
      status: 'PARTIAL_ADULT_KEY_ONLY',
      coverage: { keyedAnswers: answers.length, answersWithCommonErrors: withCommonErrors.length, answersWhoseErrorsAllHaveRemediation: commonErrorsWithRemediation.length, explicitMisconceptionIds: 0 },
      gap: 'Adult keys carry observed/likelyCause/remediation prose, but there are no stable misconception IDs, trigger signatures, severities, or cross-item mappings.',
    },
    phaseInformation: {
      status: 'DERIVABLE',
      coverage: { lessons: findings.length, withLessonPhase: findings.filter((finding) => finding.phase).length, withBlueprintProfile: findings.filter((finding) => finding.profile).length, withSectionKinds: findings.filter((finding) => finding.sectionKinds.length > 0).length },
      gap: 'Phase and section order are present, but no Tutor V2 state transition or retry policy is encoded.',
    },
    answerPolicy: {
      status: 'PARTIAL_ADULT_KEY_ONLY',
      coverage: { scoredItems: scoredItems.length, keyedAnswers: answers.length, withAnswerType: answers.filter((answer) => answer.answerType).length, withVerificationMethod: answers.filter((answer) => answer.verification?.method).length, explicitLearnerHintPolicy: 0 },
      gap: 'Separate answer authority is strong, but hint timing, reveal rules, attempt limits, acceptable equivalent forms, and adult-only access policy are not a complete runtime contract.',
    },
    agePolicy: {
      status: 'GAP',
      coverage: { lessons: findings.length, withGrade: findings.filter((finding) => finding.grade).length, explicitAgePolicy: 0, explicitReadabilityBand: 0 },
      gap: 'Grade is present, but no age band, vocabulary policy, sentence/direction limits, or child/adult visibility tag exists.',
    },
  }
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function distCell(dist) {
  return `${dist.min} / ${dist.p25} / ${dist.median} / ${dist.p75} / ${dist.max} (mean ${dist.mean})`
}

function buildReport(summary, readabilitySummary, generatorFamilies, repairPlan, tutor, findings) {
  const types = summary.lessonTypes
  const classifications = summary.depthClassifications
  const negative = summary.negativeControls
  const lines = [
    '# Elementary Math Depth + Readability Audit R1',
    '',
    `**Status:** ${summary.status}`,
    '',
    `**Authoritative base:** \`${AUTHORITATIVE_BASE}\``,
    '',
    `**Scope:** ${summary.lessonsAudited} active Mathematics lessons: Grade 3 ${summary.byGrade['3'].lessons}, Grade 4 ${summary.byGrade['4'].lessons}, Grade 5 ${summary.byGrade['5'].lessons}. Production curriculum was read only; this audit does not repair it.`,
    '',
    '## Executive finding',
    '',
    `${classifications.DEEP_ENOUGH} lessons meet the operational richer standard and ${summary.tooThin.lessons} are structurally too thin for their lesson type. The corpus is consistently engineered as a compact worksheet bank: many lessons contain only one worked example, explicit learner-facing remediation items are absent, and shared blueprint directions expose adult/engineering vocabulary. Assessment and review days were evaluated against their own targets, not concept-lesson targets.`,
    '',
    '## Re-derived inventory',
    '',
    markdownTable(
      ['Grade', 'Schedule rows', 'Active package files', 'Unique lesson IDs', 'Answer keys', 'Result'],
      GRADES.map((grade) => {
        const row = summary.byGrade[String(grade)].inventory
        return [grade, row.scheduleRows, row.packageFiles, row.uniqueLessonIds, row.answerKeys, row.reconciled ? 'RECONCILED' : 'MISMATCH']
      }),
    ),
    '',
    `Total: **${summary.lessonsAudited}**. Expected 540; exact match: **${summary.inventoryReconciled ? 'yes' : 'no'}**.`,
    '',
    '## Type-aware richer standard',
    '',
    'Counts below are audit thresholds, not production repairs. “Remediation” means an explicit learner-facing remediation/reteach item, not adult-only prose in an answer key. “Remediation-profile items” are also recorded separately so targeted-correction lessons are not mistaken for having no corrective purpose.',
    '',
    markdownTable(
      ['Lesson type', 'Teaching blocks', 'Worked', 'Guided', 'Independent', 'Mastery', 'Explicit remediation', 'Challenge'],
      Object.entries(PROFILE_TARGETS).map(([type, target]) => [type, target.teaching, target.worked, target.guided, target.independent, target.mastery, target.remediation, target.challenge]),
    ),
    '',
    `Type counts: normal concept **${types['normal concept'] ?? 0}**, diagnostic **${types.diagnostic ?? 0}**, review **${types.review ?? 0}**, remediation **${types.remediation ?? 0}**, mastery **${types.mastery ?? 0}**, assessment-like **${types['assessment-like'] ?? 0}**, other **${types.other ?? 0}**.`,
    '',
    '## Question-bank distribution',
    '',
    'Cells show min / p25 / median / p75 / max (mean).',
    '',
    markdownTable(
      ['Grade', 'Worked examples', 'Guided items', 'Independent items', 'Mastery items', 'Explicit remediation'],
      GRADES.map((grade) => {
        const d = summary.byGrade[String(grade)].distributions
        return [grade, distCell(d.workedExamples), distCell(d.guidedItems), distCell(d.independentItems), distCell(d.masteryItems), distCell(d.remediationItems)]
      }),
    ),
    '',
    'Full p10/p90 values and histograms are in `grade-summary.json`.',
    '',
    `Question variety per lesson: distinct item types ${distCell(summary.questionVariety.distinctItemTypesPerLesson)}; distinct prompt templates ${distCell(summary.questionVariety.promptTemplatesPerLesson)}. **${summary.questionVariety.lessonsWithOnePromptTemplate}** lessons have multiple scored items but only one parameterized prompt template.`,
    '',
    '## Depth classification',
    '',
    markdownTable(['Classification', 'Lessons'], Object.entries(classifications).map(([key, value]) => [key, value])),
    '',
    `Thin-bank lessons: **${summary.tooThin.lessons}**. By grade: G3 ${summary.tooThin.byGrade['3'] ?? 0}, G4 ${summary.tooThin.byGrade['4'] ?? 0}, G5 ${summary.tooThin.byGrade['5'] ?? 0}.`,
    '',
    '## Negative controls',
    '',
    markdownTable(['Control', 'Lessons detected'], Object.entries(negative).map(([key, value]) => [key, value])),
    '',
    '## Worked-example depth and reasoning',
    '',
    `There are ${summary.totals.workedExamples} worked examples. Step-count distribution is ${distCell(summary.workedExampleStepDistribution)}. Answer-only examples: **${summary.workedExamples.answerOnly}**; weak: **${summary.workedExamples.weak}**; adequate: **${summary.workedExamples.adequate}**; strong: **${summary.workedExamples.strong}**. A worked example is strong only when it has at least three steps, at least two substantive steps, and an explicit reasoning/sequence marker.`,
    '',
    '## Readability',
    '',
    `The audit recorded **${readabilitySummary.totalFindings}** field-level readability findings affecting **${readabilitySummary.lessonsAffected}** lessons. Engineering-language findings: **${readabilitySummary.byCode.ENGINEERING_LANGUAGE ?? 0}**; teacher-facing language: **${readabilitySummary.byCode.TEACHER_FACING_LANGUAGE ?? 0}**; long sentences: **${readabilitySummary.byCode.LONG_SENTENCE ?? 0}**; dense directions: **${readabilitySummary.byCode.DENSE_DIRECTIONS ?? 0}**; multi-clause directions: **${readabilitySummary.byCode.MULTI_CLAUSE_DIRECTIONS ?? 0}**.`,
    '',
    'The checks are subject-aware: mathematical vocabulary such as numerator, denominator, product, expression, estimate, and evaluate is not automatically treated as age-inappropriate. The vocabulary flags focus on curriculum-engineering and adult workflow terms. Flesch–Kincaid values are stored as advisory machine evidence only and never decide a lesson classification by themselves.',
    '',
    '## Duplication and passive structure',
    '',
    `Exact within-lesson prompt duplicate groups affect **${summary.duplication.lessonsWithExactWithinLesson}** lessons; parameter-template near-duplicate groups affect **${summary.duplication.lessonsWithNearWithinLesson}**; identical template-bank clusters affect **${summary.duplication.lessonsInDuplicateBankClusters}** lessons across **${summary.duplication.duplicateBankClusters}** clusters. Exact prompt reuse across lessons affects **${summary.duplication.lessonsWithCrossLessonExactPromptReuse}** lessons. Passive question-list structure appears in **${summary.passiveQuestionListLessons}** lessons; those are mostly review/assessment profiles, but the structure remains a learner-experience risk when not paired with active explanation elsewhere.`,
    '',
    '## Answer leakage',
    '',
    `Forbidden adult answer fields in learner packages: **${summary.answerLeakage.forbiddenFieldLessons} lessons**. Verbal answer disclosures: **${summary.answerLeakage.verbalLeakLessons} lessons**. Reuse of an answered worked-example prompt as a scored prompt in the same lesson: **${summary.answerLeakage.shownAnswerReuseLessons} lessons**. Adult answer keys remain separately stored.`,
    '',
    '## Generator families and repair ownership',
    '',
    `Two shared composition families drive section counts and directions: \`${generatorFamilies.compositionFamilies[0].family}\` for ${generatorFamilies.compositionFamilies[0].lessons} Grade 3/4 lessons and \`${generatorFamilies.compositionFamilies[1].family}\` for ${generatorFamilies.compositionFamilies[1].lessons} Grade 5 lessons. Thirty grade/unit item-bank families drive prompt templates, examples, distractors, and vocabulary. Exact source paths and per-family counts are in \`generator-families.json\`.`,
    '',
    `The repair plan contains **${repairPlan.stages[1].builders.length}** parallel, non-overlapping grade/unit builders of 18 lessons each, bracketed by two shared-composition builders and one serialized integration builder. Unit builders own source banks only; the integration builder alone owns regenerated packages and keys. The Grade 3/4 canonical source tree and shared Grade 5-12 composition source are not present at this base; the plan records the exact upstream input revisions that must be restored instead of editing evidence snapshots.`,
    '',
    '## Tutor V2 readiness inventory',
    '',
    markdownTable(['Metadata', 'Status', 'Gap'], Object.entries(tutor).map(([key, value]) => [key, value.status, value.gap])),
    '',
    '## Evidence files',
    '',
    '- `lesson-findings.jsonl`: one complete record per active lesson.',
    '- `grade-summary.json`: reconciled counts, distributions, classifications, controls, and Tutor inventory.',
    '- `generator-families.json`: shared composition and 30 unit-bank family attributions.',
    '- `readability-findings.json`: every field-level readability finding plus advisory machine scores.',
    '- `bulk-repair-plan.json`: staged, non-overlapping repair ownership without curriculum changes.',
    '',
    '## Audit limits',
    '',
    '- Near-duplicate detection is deterministic template analysis, not a claim that all repeated drill forms are pedagogically invalid.',
    '- Readability rules identify review candidates; human elementary-math judgment remains authoritative.',
    '- The audit verifies package structure and adult-key separation but does not run the future Tutor V2 runtime.',
    '',
    `**Final classification: ${summary.finalClassification}**`,
    '',
  ]
  return lines.join('\n')
}

async function scheduleInventory(grade) {
  const schedulePath = join(MATH_ROOT, 'schedules', `grade-${String(grade).padStart(2, '0')}.csv`)
  const lines = (await readFile(schedulePath, 'utf8')).trim().split('\n')
  const rows = lines.slice(1).map((line) => line.split(','))
  const activeRows = rows.filter((row) => row[4] === 'ACTIVE')
  return { scheduleRows: activeRows.length, scheduleLessonIds: activeRows.map((row) => row[1]) }
}

async function main() {
  const records = await lessonRecords()
  if (records.length !== 540) throw new Error(`Expected 540 active Grade 3-5 packages, found ${records.length}`)

  const findings = records.map((record) => {
    const { pkg } = record
    const lessonType = classifyLessonType(pkg.blueprint.profile)
    const targets = targetsFor(pkg.blueprint.profile, lessonType)
    const counts = countSections(pkg)
    const worked = workedExampleDepth(pkg)
    const readable = readabilityFindingsFor(pkg)
    const question = questionAnalysis(pkg)
    const leakage = answerLeakage(pkg, question)
    const codes = deficiencyCodes(counts, targets, worked, readable)
    const source = sourceFamilyFor({ grade: pkg.lessonRef.grade, unitNumber: pkg.lessonRef.unitNumber })
    const allItems = pkg.sections.flatMap((section) => section.items)
    return {
      auditVersion: AUDIT_VERSION,
      authoritativeBase: AUTHORITATIVE_BASE,
      lessonId: pkg.lessonRef.lessonId,
      packagePath: record.packagePath,
      answerKeyPath: record.keyPath,
      grade: pkg.lessonRef.grade,
      unitNumber: pkg.lessonRef.unitNumber,
      courseDay: pkg.lessonRef.courseDay,
      dayInUnit: pkg.lessonRef.dayInUnit,
      title: pkg.lessonRef.title,
      phase: pkg.lessonRef.phase,
      profile: pkg.blueprint.profile,
      lessonType,
      sectionKinds: pkg.sections.map((section) => section.kind),
      standards: pkg.standards,
      itemTypes: [...new Set(allItems.map((item) => item.itemType))].sort(),
      targets,
      counts,
      workedExampleDepth: worked,
      questionVariety: {
        distinctItemTypes: question.distinctItemTypes,
        distinctStandards: question.distinctStandards,
        distinctDifficulties: question.distinctDifficulties,
        itemKinds: question.itemKinds,
        constructedResponseItems: question.constructedResponseItems,
        multipleChoiceItems: question.multipleChoiceItems,
        promptTemplateCount: question.promptTemplateCount,
        passiveQuestionList: question.passiveQuestionList,
      },
      duplication: {
        exactDuplicateGroupsWithinLesson: question.exactDuplicateGroupsWithinLesson,
        nearDuplicateGroupsWithinLesson: question.nearDuplicateGroupsWithinLesson,
        anyWithinLesson: question.exactDuplicateGroupsWithinLesson.length > 0 || question.nearDuplicateGroupsWithinLesson.length > 0,
        promptBankSignature: question.promptBankSignature,
        duplicateBankClusterSize: 1,
        crossLessonExactPromptReuseCount: 0,
      },
      answerLeakage: leakage,
      readability: {
        findingCount: readable.findings.length,
        findingCodes: groupCounts(readable.findings, (finding) => finding.code),
        advisoryMachineReadability: readable.advisoryMachineReadability,
      },
      defectCodes: codes,
      depthClassification: depthClassification(codes),
      negativeControls: negativeControls(counts, worked, question, readable, leakage),
      generatorFamily: source,
    }
  })

  const bankClusters = new Map()
  for (const finding of findings) {
    const list = bankClusters.get(finding.duplication.promptBankSignature) ?? []
    list.push(finding.lessonId)
    bankClusters.set(finding.duplication.promptBankSignature, list)
  }
  for (const finding of findings) {
    finding.duplication.duplicateBankClusterSize = bankClusters.get(finding.duplication.promptBankSignature).length
  }

  const exactPromptLessons = new Map()
  for (const record of records) {
    const lessonId = record.pkg.lessonRef.lessonId
    const prompts = new Set(record.pkg.sections.flatMap((section) => section.items)
      .filter((item) => item.kind !== 'worked-example')
      .map((item) => normalizeText(item.prompt)))
    for (const prompt of prompts) {
      const lessons = exactPromptLessons.get(prompt) ?? new Set()
      lessons.add(lessonId)
      exactPromptLessons.set(prompt, lessons)
    }
  }
  const reusedExactPrompts = [...exactPromptLessons.entries()].filter(([, lessons]) => lessons.size > 1)
  for (const finding of findings) {
    finding.duplication.crossLessonExactPromptReuseCount = reusedExactPrompts.filter(([, lessons]) => lessons.has(finding.lessonId)).length
  }

  const allReadabilityFindings = records.flatMap((record) => {
    const result = readabilityFindingsFor(record.pkg)
    return result.findings.map((finding) => ({
      lessonId: record.pkg.lessonRef.lessonId,
      grade: record.pkg.lessonRef.grade,
      unitNumber: record.pkg.lessonRef.unitNumber,
      courseDay: record.pkg.lessonRef.courseDay,
      ...finding,
    }))
  })
  const readabilitySummary = {
    auditVersion: AUDIT_VERSION,
    authoritativeBase: AUTHORITATIVE_BASE,
    authority: 'Rule findings and Flesch-Kincaid scores are review signals only; human elementary-math judgment is authoritative.',
    thresholds: {
      sentenceWords: { grade3: 18, grade4: 20, grade5: 22 },
      directionWords: { grade3: 18, grade4: 20, grade5: 22 },
      paragraphWords: { grade3: 45, grade4: 50, grade5: 55 },
    },
    subjectAwarePolicy: {
      automaticallyAllowedMathematicsVocabulary: ['numerator', 'denominator', 'product', 'expression', 'estimate', 'evaluate', 'multiple', 'factor', 'fraction', 'decimal'],
      targetedNonMathVocabulary: ADVANCED_NON_MATH_VOCABULARY,
      engineeringPhrases: ENGINEERING_PHRASES,
      teacherFacingPhrases: TEACHER_LANGUAGE,
    },
    totalFindings: allReadabilityFindings.length,
    lessonsAffected: new Set(allReadabilityFindings.map((finding) => finding.lessonId)).size,
    byGrade: Object.fromEntries(GRADES.map((grade) => [grade, allReadabilityFindings.filter((finding) => finding.grade === grade).length])),
    byCode: groupCounts(allReadabilityFindings, (finding) => finding.code),
    byPhrase: groupCounts(allReadabilityFindings.filter((finding) => finding.phrase), (finding) => finding.phrase),
    lessonMachineReadability: findings.map((finding) => ({ lessonId: finding.lessonId, grade: finding.grade, ...finding.readability.advisoryMachineReadability })),
    findings: allReadabilityFindings,
  }

  const byGrade = {}
  for (const grade of GRADES) {
    const scoped = findings.filter((finding) => finding.grade === grade)
    const schedule = await scheduleInventory(grade)
    const packageLessonIds = scoped.map((finding) => finding.lessonId)
    const unique = new Set(packageLessonIds)
    const keyCount = records.filter((record) => record.grade === grade).length
    const inventory = {
      scheduleRows: schedule.scheduleRows,
      packageFiles: scoped.length,
      uniqueLessonIds: unique.size,
      answerKeys: keyCount,
      reconciled: schedule.scheduleRows === 180 && scoped.length === 180 && unique.size === 180 && keyCount === 180
        && schedule.scheduleLessonIds.every((lessonId) => unique.has(lessonId)),
    }
    const fieldMap = {
      teachingExplanationBlocks: 'teachingExplanationBlocks',
      workedExamples: 'workedExamples',
      guidedItems: 'guidedItems',
      independentItems: 'independentItems',
      masteryItems: 'masteryItems',
      remediationItems: 'remediationItems',
      remediationProfileItems: 'remediationProfileItems',
      challengeExtensionItems: 'challengeExtensionItems',
    }
    const distributions = {}
    const histograms = {}
    for (const [label, field] of Object.entries(fieldMap)) {
      const values = scoped.map((finding) => finding.counts[field])
      distributions[label] = distribution(values)
      histograms[label] = histogram(values)
    }
    byGrade[grade] = {
      lessons: scoped.length,
      inventory,
      lessonTypes: groupCounts(scoped, (finding) => finding.lessonType),
      depthClassifications: groupCounts(scoped, (finding) => finding.depthClassification),
      distributions,
      histograms,
      questionVariety: {
        distinctItemTypesPerLesson: distribution(scoped.map((finding) => finding.questionVariety.distinctItemTypes)),
        distinctStandardsPerLesson: distribution(scoped.map((finding) => finding.questionVariety.distinctStandards)),
        promptTemplatesPerLesson: distribution(scoped.map((finding) => finding.questionVariety.promptTemplateCount)),
        constructedResponseItemsPerLesson: distribution(scoped.map((finding) => finding.questionVariety.constructedResponseItems)),
        lessonsWithOnePromptTemplate: scoped.filter((finding) => finding.questionVariety.promptTemplateCount === 1 && finding.counts.totalScoredItems > 1).length,
      },
      tooThin: scoped.filter((finding) => finding.defectCodes.some((code) => code !== 'LANGUAGE_TOO_ADVANCED')).length,
      languageAffectedLessons: scoped.filter((finding) => finding.readability.findingCount > 0).length,
    }
  }

  const allExamples = findings.flatMap((finding) => finding.workedExampleDepth.examples)
  const duplicateClusterEntries = [...bankClusters.entries()].filter(([, ids]) => ids.length > 1)
  const summary = {
    auditVersion: AUDIT_VERSION,
    auditDate: '2026-08-14',
    authoritativeBase: AUTHORITATIVE_BASE,
    scope: { subject: 'mathematics', grades: GRADES, activeOnly: true, reserveExcluded: true },
    status: Object.values(byGrade).every((grade) => grade.inventory.reconciled) ? 'COMPLETE' : 'INCONCLUSIVE',
    lessonsAudited: findings.length,
    inventoryReconciled: Object.values(byGrade).every((grade) => grade.inventory.reconciled),
    byGrade,
    lessonTypes: enumCounts(findings.map((finding) => finding.lessonType), ['normal concept', 'diagnostic', 'review', 'remediation', 'mastery', 'assessment-like', 'other']),
    returnTypeRollup: {
      normalLessons: findings.filter((finding) => finding.lessonType === 'normal concept').length,
      diagnostics: findings.filter((finding) => finding.lessonType === 'diagnostic').length,
      reviews: findings.filter((finding) => finding.lessonType === 'review').length,
      otherTypes: findings.filter((finding) => !['normal concept', 'diagnostic', 'review'].includes(finding.lessonType)).length,
    },
    depthClassifications: enumCounts(findings.map((finding) => finding.depthClassification), [
      'DEEP_ENOUGH',
      'NEEDS_MORE_EXPLANATION',
      'NEEDS_MORE_WORKED_EXAMPLES',
      'NEEDS_GUIDED_PRACTICE',
      'NEEDS_INDEPENDENT_DEPTH',
      'NEEDS_MASTERY_DEPTH',
      'NEEDS_REMEDIATION',
      'LANGUAGE_TOO_ADVANCED',
      'MULTIPLE_DEFECTS',
    ]),
    totals: {
      teachingExplanationBlocks: findings.reduce((sum, finding) => sum + finding.counts.teachingExplanationBlocks, 0),
      workedExamples: findings.reduce((sum, finding) => sum + finding.counts.workedExamples, 0),
      guidedItems: findings.reduce((sum, finding) => sum + finding.counts.guidedItems, 0),
      independentItems: findings.reduce((sum, finding) => sum + finding.counts.independentItems, 0),
      masteryItems: findings.reduce((sum, finding) => sum + finding.counts.masteryItems, 0),
      remediationItems: findings.reduce((sum, finding) => sum + finding.counts.remediationItems, 0),
      remediationProfileItems: findings.reduce((sum, finding) => sum + finding.counts.remediationProfileItems, 0),
      challengeExtensionItems: findings.reduce((sum, finding) => sum + finding.counts.challengeExtensionItems, 0),
    },
    overallDistributions: Object.fromEntries([
      ['workedExamples', findings.map((finding) => finding.counts.workedExamples)],
      ['guidedItems', findings.map((finding) => finding.counts.guidedItems)],
      ['independentItems', findings.map((finding) => finding.counts.independentItems)],
      ['masteryItems', findings.map((finding) => finding.counts.masteryItems)],
      ['remediationItems', findings.map((finding) => finding.counts.remediationItems)],
    ].map(([key, values]) => [key, distribution(values)])),
    workedExampleStepDistribution: distribution(allExamples.map((example) => example.stepCount)),
    workedExamples: {
      answerOnly: allExamples.filter((example) => example.answerOnly).length,
      weak: allExamples.filter((example) => example.quality === 'WEAK').length,
      adequate: allExamples.filter((example) => example.quality === 'ADEQUATE').length,
      strong: allExamples.filter((example) => example.quality === 'STRONG').length,
    },
    tooThin: {
      lessons: findings.filter((finding) => finding.defectCodes.some((code) => code !== 'LANGUAGE_TOO_ADVANCED')).length,
      byGrade: groupCounts(findings.filter((finding) => finding.defectCodes.some((code) => code !== 'LANGUAGE_TOO_ADVANCED')), (finding) => finding.grade),
      byDefect: groupCounts(findings.flatMap((finding) => finding.defectCodes.filter((code) => code !== 'LANGUAGE_TOO_ADVANCED').map((code) => ({ code }))), (entry) => entry.code),
      lessonIds: findings.filter((finding) => finding.defectCodes.some((code) => code !== 'LANGUAGE_TOO_ADVANCED')).map((finding) => finding.lessonId),
    },
    negativeControls: Object.fromEntries(Object.keys(findings[0].negativeControls).map((key) => [key, findings.filter((finding) => finding.negativeControls[key]).length])),
    duplication: {
      lessonsWithExactWithinLesson: findings.filter((finding) => finding.duplication.exactDuplicateGroupsWithinLesson.length > 0).length,
      lessonsWithNearWithinLesson: findings.filter((finding) => finding.duplication.nearDuplicateGroupsWithinLesson.length > 0).length,
      duplicateBankClusters: duplicateClusterEntries.length,
      lessonsInDuplicateBankClusters: findings.filter((finding) => finding.duplication.duplicateBankClusterSize > 1).length,
      lessonsWithCrossLessonExactPromptReuse: findings.filter((finding) => finding.duplication.crossLessonExactPromptReuseCount > 0).length,
      crossLessonExactPromptGroups: reusedExactPrompts.length,
      duplicateBankClusterMembers: duplicateClusterEntries.map(([signature, lessonIds]) => ({ signature, lessonIds })),
    },
    passiveQuestionListLessons: findings.filter((finding) => finding.questionVariety.passiveQuestionList).length,
    questionVariety: {
      distinctItemTypesPerLesson: distribution(findings.map((finding) => finding.questionVariety.distinctItemTypes)),
      distinctStandardsPerLesson: distribution(findings.map((finding) => finding.questionVariety.distinctStandards)),
      promptTemplatesPerLesson: distribution(findings.map((finding) => finding.questionVariety.promptTemplateCount)),
      constructedResponseItemsPerLesson: distribution(findings.map((finding) => finding.questionVariety.constructedResponseItems)),
      lessonsWithOnePromptTemplate: findings.filter((finding) => finding.questionVariety.promptTemplateCount === 1 && finding.counts.totalScoredItems > 1).length,
    },
    answerLeakage: {
      forbiddenFieldLessons: findings.filter((finding) => finding.answerLeakage.forbiddenAnswerFields.length > 0).length,
      verbalLeakLessons: findings.filter((finding) => finding.answerLeakage.verbalAnswerLeaks.length > 0).length,
      shownAnswerReuseLessons: findings.filter((finding) => finding.answerLeakage.shownWorkedAnswerReusedAsScoredPrompt.length > 0).length,
      adultAnswerLeakLessons: findings.filter((finding) => finding.answerLeakage.adultAnswerLeak).map((finding) => finding.lessonId),
    },
    readability: {
      totalFindings: readabilitySummary.totalFindings,
      lessonsAffected: readabilitySummary.lessonsAffected,
      byCode: readabilitySummary.byCode,
    },
    targetStandard: { baseTargets: PROFILE_TARGETS, profileOverrides: PROFILE_TARGET_OVERRIDES },
    tutorReadiness: tutorInventory(records, findings),
    finalClassification: Object.values(byGrade).every((grade) => grade.inventory.reconciled)
      ? 'ELEMENTARY_MATH_DEPTH_AUDIT_COMPLETE'
      : 'AUDIT_INCONCLUSIVE',
    auditBlockers: [],
    repairPrerequisites: [
      'Restore the Grade 3/4 canonical generator source from mac/g34-math-production-r1@c3b24f047b8aebd5e08f9b8022eef20ea187e190 before repair.',
      'Restore the shared Grade 5-12 composition source from mac/math-production-materials-r1@314f517f98a5d4a10415676f49576f526cd1f1d9 before composition repair.',
    ],
  }

  const generatorFamilies = buildGeneratorFamilies(findings)
  const repairPlan = buildRepairPlan(findings)
  await mkdir(OUTPUT, { recursive: true })
  await writeFile(join(OUTPUT, 'lesson-findings.jsonl'), `${findings.map((finding) => JSON.stringify(finding)).join('\n')}\n`)
  await writeFile(join(OUTPUT, 'grade-summary.json'), stableJson(summary))
  await writeFile(join(OUTPUT, 'generator-families.json'), stableJson(generatorFamilies))
  await writeFile(join(OUTPUT, 'readability-findings.json'), stableJson(readabilitySummary))
  await writeFile(join(OUTPUT, 'bulk-repair-plan.json'), stableJson(repairPlan))
  await writeFile(join(OUTPUT, 'ELEMENTARY_MATH_DEPTH_AUDIT_R1.md'), buildReport(summary, readabilitySummary, generatorFamilies, repairPlan, summary.tutorReadiness, findings))

  process.stdout.write(stableJson({
    output: relative(ROOT, OUTPUT),
    lessonsAudited: findings.length,
    byGrade: Object.fromEntries(GRADES.map((grade) => [grade, byGrade[grade].lessons])),
    lessonTypes: summary.lessonTypes,
    classifications: summary.depthClassifications,
    tooThin: summary.tooThin.lessons,
    readabilityFindings: readabilitySummary.totalFindings,
    finalClassification: summary.finalClassification,
  }))
}

await main()
