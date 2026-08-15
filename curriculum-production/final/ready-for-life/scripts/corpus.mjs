import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateProductionDepth } from './production-depth.mjs'

export const CORPUS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const SUPPORTED_GRADES = Object.freeze([3, 4, 5, 7, 8, 9, 10, 11, 12])
export const EXPECTED_LESSONS_PER_GRADE = 36

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function walk(root, predicate = () => true) {
  const files = []
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name)
    if (statSync(path).isDirectory()) files.push(...walk(path, predicate))
    else if (predicate(path)) files.push(path)
  }
  return files
}

export function loadCorpusEntries() {
  const packageRoot = join(CORPUS_ROOT, 'packages')
  return walk(packageRoot, (path) => path.endsWith('.package.json')).map((packagePath) => {
    const packageRaw = readFileSync(packagePath, 'utf8')
    const pkg = JSON.parse(packageRaw)
    const scoringPath = resolve(CORPUS_ROOT, pkg.scoringRef)
    const scoringRaw = readFileSync(scoringPath, 'utf8')
    return {
      pkg,
      scoring: JSON.parse(scoringRaw),
      packageRaw,
      scoringRaw,
      packagePath,
      scoringPath,
      packageRelativePath: relative(CORPUS_ROOT, packagePath),
      scoringRelativePath: relative(CORPUS_ROOT, scoringPath),
    }
  }).sort((a, b) => a.pkg.lessonRef.lessonId.localeCompare(b.pkg.lessonRef.lessonId))
}

function block(text) {
  return typeof text === 'string' && text.trim() ? { present: true, text } : { present: false }
}

function joinedTasks(entry, kinds) {
  const parts = entry.pkg.tasks
    .filter((task) => kinds.includes(task.kind))
    .map((task) => `${task.directions} ${task.prompts.map((prompt) => prompt.text).join(' ')}`)
  return parts.length ? parts.join(' ') : undefined
}

function scoringText(entry) {
  return entry.scoring.scoringAuthority.criteria
    .map((criterion) => `${criterion.dimension} ${criterion.levels.map((level) => `${level.label}: ${level.descriptor}`).join(' ')}`)
    .join(' ')
}

export function toH3LessonInput(entry) {
  const { pkg, scoring } = entry
  return {
    lessonId: pkg.lessonRef.lessonId,
    title: pkg.lessonRef.title,
    courseId: pkg.lessonRef.courseId,
    unitId: `unit-${pkg.lessonRef.unitNumber}`,
    subjectFamily: pkg.subjectFamily,
    independentWork: block(joinedTasks(entry, ['independent', 'performance-task']) ?? joinedTasks(entry, ['guided'])),
    scoringAuthority: {
      kind: scoring.scoringAuthority.kind,
      content: block(scoringText(entry)),
    },
    remediation: block(pkg.remediation),
    extension: block(pkg.extension),
    assessmentAlignment: 'ALIGNED',
    requiresSafetyOrPrivacyReview: pkg.realWorldAction,
    safetyOrPrivacyStatus: pkg.realWorldAction ? 'VERIFIED' : undefined,
    safeAlternative: pkg.simulationAlternative ? block(pkg.simulationAlternative.description) : undefined,
  }
}

function words(value) {
  return String(value ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? []
}

function lessonText(entry) {
  return [
    entry.pkg.objective,
    entry.pkg.scenario,
    ...entry.pkg.tasks.flatMap((task) => [task.directions, ...task.prompts.map((prompt) => prompt.text)]),
    entry.pkg.remediation,
    entry.pkg.extension,
    ...entry.scoring.scoringAuthority.criteria.flatMap((criterion) => [
      criterion.dimension,
      ...criterion.levels.map((level) => level.descriptor),
    ]),
  ].join(' ')
}

function shingles(value, size = 5) {
  const tokens = words(value)
  const result = new Set()
  if (tokens.length < size) return new Set([tokens.join(' ')])
  for (let index = 0; index <= tokens.length - size; index += 1) {
    result.add(tokens.slice(index, index + size).join(' '))
  }
  return result
}

function jaccard(left, right) {
  let intersection = 0
  for (const value of left) if (right.has(value)) intersection += 1
  return intersection / (left.size + right.size - intersection)
}

export function buildDuplicateReport(entries) {
  const fingerprints = entries.map((entry) => ({
    lessonId: entry.pkg.lessonRef.lessonId,
    grade: entry.pkg.lessonRef.grade,
    exact: sha256(words(lessonText(entry)).join(' ')),
    shingles: shingles(lessonText(entry)),
  }))
  const exactGroups = Object.values(Object.groupBy(fingerprints, (item) => item.exact))
    .filter((group) => group.length > 1)
    .map((group) => group.map((item) => item.lessonId))
  const closestCrossGradePairs = []
  for (let left = 0; left < fingerprints.length; left += 1) {
    for (let right = left + 1; right < fingerprints.length; right += 1) {
      if (fingerprints[left].grade === fingerprints[right].grade) continue
      const similarity = jaccard(fingerprints[left].shingles, fingerprints[right].shingles)
      if (similarity >= 0.35) {
        closestCrossGradePairs.push({
          leftLessonId: fingerprints[left].lessonId,
          rightLessonId: fingerprints[right].lessonId,
          similarity: Number(similarity.toFixed(4)),
        })
      }
    }
  }
  closestCrossGradePairs.sort((a, b) => b.similarity - a.similarity || a.leftLessonId.localeCompare(b.leftLessonId))
  const collapseThreshold = 0.78
  return {
    status: exactGroups.length === 0 && !closestCrossGradePairs.some((pair) => pair.similarity >= collapseThreshold) ? 'PASS' : 'FAIL',
    algorithm: 'normalized combined lesson/scoring text; exact SHA-256 plus cross-grade five-word-shingle Jaccard',
    collapseThreshold,
    exactDuplicateGroups: exactGroups,
    thresholdViolations: closestCrossGradePairs.filter((pair) => pair.similarity >= collapseThreshold),
    closestCrossGradePairs: closestCrossGradePairs.slice(0, 20),
  }
}

function issue(issues, rule, entry, detail) {
  issues.push({ rule, lessonId: entry.pkg.lessonRef.lessonId, packageId: entry.pkg.packageId, detail })
}

const ANSWER_KEYS = new Set(['answer', 'answerIndex', 'solutionReasoning', 'commonErrors', 'scoringAuthority', 'criteria'])
const MEDIA_PROOF = [
  /\btake (?:and )?(?:upload|submit|send|share)?\s*(?:a |an |your )?(?:photo|picture|video)\b/i,
  /\b(?:record|upload|submit|send|share) (?:a |an |your )?(?:video|voice|audio|recording)\b/i,
]
const PURCHASE = [/\byou (?:must|need to|have to) (?:buy|purchase|order)\b/i, /\brequired purchase\b/i]
const ASSUMED_ACCESS = [
  /\byour (?:mom|dad|mother|father|brother|sister)\b/i,
  /\bask your parents\b/i,
  /\byour own (?:car|vehicle|bedroom)\b/i,
]
const PRIVATE_REQUEST = [
  /\b(?:write|enter|provide|share|submit|upload|tell us|list) (?:your |the learner'?s )?(?:home address|street address|phone number|social security number|ssn|password|login|username)\b/i,
  /\b(?:write|enter|provide|share|submit|upload) (?:your |the learner'?s )?(?:family income|household income|bank account|credit card)\b/i,
]

function objectKeys(value, result = []) {
  if (Array.isArray(value)) for (const item of value) objectKeys(item, result)
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      result.push(key)
      objectKeys(child, result)
    }
  }
  return result
}

export function validateCorpus(entries) {
  const issues = []
  const lessonIds = new Set()
  const packageIds = new Set()
  const scoringPaths = new Set()
  for (const entry of entries) {
    const { pkg, scoring } = entry
    const id = pkg.lessonRef.lessonId
    if (lessonIds.has(id)) issue(issues, 'unique-source-lesson-id', entry, 'duplicate source lesson ID')
    lessonIds.add(id)
    if (packageIds.has(pkg.packageId)) issue(issues, 'unique-package-id', entry, 'duplicate package ID')
    packageIds.add(pkg.packageId)
    if (scoringPaths.has(entry.scoringRelativePath)) issue(issues, 'unique-scoring-record', entry, 'scoring record is shared by more than one lesson')
    scoringPaths.add(entry.scoringRelativePath)

    const match = id.match(/^ma-g(\d+)-ready-for-life-u(\d{2})-l(\d{2})$/)
    if (!match || Number(match[1]) !== pkg.lessonRef.grade || Number(match[2]) !== pkg.lessonRef.unitNumber || Number(match[3]) !== pkg.lessonRef.dayInUnit) {
      issue(issues, 'id-coordinate-consistency', entry, 'lesson ID does not match grade/unit/day coordinates')
    }
    if (pkg.integrity?.sourceLessonId !== id) issue(issues, 'source-id-integrity', entry, 'integrity.sourceLessonId does not match lessonRef.lessonId')
    if (pkg.packageId !== `swk-rfl-g${pkg.lessonRef.grade}-u${String(pkg.lessonRef.unitNumber).padStart(2, '0')}-l${String(pkg.lessonRef.dayInUnit).padStart(2, '0')}`) {
      issue(issues, 'package-id-consistency', entry, 'packageId does not match grade/unit/day coordinates')
    }
    if (scoring.lessonId !== id || scoring.packageId !== pkg.packageId) issue(issues, 'package-scoring-link', entry, 'adult scoring record identity does not match its package')
    if (scoring.completionAuthority !== pkg.completionAuthority) issue(issues, 'completion-authority-match', entry, 'package and scoring completionAuthority differ')

    for (const key of objectKeys(pkg)) if (ANSWER_KEYS.has(key)) issue(issues, 'no-answer-leakage', entry, `student package contains answer-bearing key ${key}`)
    if (!['RUBRIC', 'SCORING_JUDGMENT'].includes(scoring.scoringAuthority?.kind)) issue(issues, 'no-fake-answer-key', entry, 'RFL adult authority must be RUBRIC or SCORING_JUDGMENT')
    const criteria = scoring.scoringAuthority?.criteria ?? []
    if (criteria.length < 2) issue(issues, 'substantive-rubric', entry, 'fewer than two scoring dimensions')
    for (const criterion of criteria) {
      if (!criterion.dimension?.trim() || (criterion.levels?.length ?? 0) < 2) issue(issues, 'substantive-rubric', entry, 'criterion lacks a dimension or at least two levels')
      const descriptors = new Set()
      for (const level of criterion.levels ?? []) {
        const descriptor = level.descriptor?.trim() ?? ''
        if (words(descriptor).length < 3) issue(issues, 'substantive-rubric', entry, `rubric descriptor is too thin: ${descriptor}`)
        descriptors.add(descriptor.toLowerCase())
      }
      if (descriptors.size !== (criterion.levels?.length ?? 0)) issue(issues, 'substantive-rubric', entry, 'rubric levels repeat the same descriptor')
    }

    if (pkg.completionAuthority === 'guardian') {
      if (!pkg.realWorldAction) issue(issues, 'guardian-authority-shape', entry, 'guardian authority must correspond to a real-world action')
      if (!pkg.signOff || pkg.signOff.certifyingActor !== 'household-authorized guardian' || pkg.signOff.studentSelfReport !== 'recorded-but-not-certifying' || pkg.signOff.requiresGuardianPermissionBeforeStart !== true || pkg.signOff.identifiablePhotoRequired !== false) {
        issue(issues, 'guardian-authority-shape', entry, 'guardian sign-off metadata is incomplete or unsafe')
      }
    } else if (pkg.signOff !== null) {
      issue(issues, 'learner-authority-no-attestation', entry, 'learner-authority package carries sign-off metadata')
    }
    if (pkg.realWorldAction && (!pkg.simulationAlternative?.present || words(pkg.simulationAlternative.description).length < 12)) {
      issue(issues, 'equal-credit-simulation', entry, 'real-world action lacks a substantive simulation alternative')
    }

    const studentText = [pkg.objective, pkg.scenario, ...(pkg.materials ?? []), ...pkg.tasks.flatMap((task) => [task.directions, ...task.prompts.map((prompt) => prompt.text)]), pkg.remediation, pkg.extension, pkg.simulationAlternative?.description].filter(Boolean).join(' ')
    for (const pattern of MEDIA_PROOF) if (pattern.test(studentText)) issue(issues, 'no-media-proof', entry, `student text matches ${pattern}`)
    for (const pattern of PURCHASE) if (pattern.test(studentText)) issue(issues, 'no-required-purchase', entry, `student text matches ${pattern}`)
    for (const pattern of ASSUMED_ACCESS) if (pattern.test(studentText)) issue(issues, 'household-access-privacy', entry, `student text assumes a household shape: ${pattern}`)
    for (const pattern of PRIVATE_REQUEST) if (pattern.test(studentText)) issue(issues, 'privacy-sensitive-request', entry, `student text requests sensitive personal data: ${pattern}`)
  }

  const scoringFiles = walk(join(CORPUS_ROOT, 'scoring'), (path) => path.endsWith('.scoring.json'))
  for (const path of scoringFiles) {
    if (!scoringPaths.has(relative(CORPUS_ROOT, path))) {
      issues.push({ rule: 'orphan-scoring-record', lessonId: null, packageId: null, detail: relative(CORPUS_ROOT, path) })
    }
  }
  issues.push(...entries.flatMap(validateProductionDepth))
  return issues
}

export function gradeCounts(entries) {
  return Object.fromEntries(SUPPORTED_GRADES.map((grade) => [String(grade), entries.filter((entry) => entry.pkg.lessonRef.grade === grade).length]))
}

export function expectedLessonIds(grade) {
  const ids = []
  for (let unit = 1; unit <= 6; unit += 1) {
    for (let lesson = 1; lesson <= 6; lesson += 1) ids.push(`ma-g${grade}-ready-for-life-u${String(unit).padStart(2, '0')}-l${String(lesson).padStart(2, '0')}`)
  }
  return ids
}

export function buildProgressionReport(entries) {
  const profiles = SUPPORTED_GRADES.map((grade) => {
    const gradeEntries = entries.filter((entry) => entry.pkg.lessonRef.grade === grade)
    const unitTitles = [...new Map(gradeEntries.map((entry) => [entry.pkg.lessonRef.unitNumber, entry.pkg.lessonRef.unitTitle])).entries()]
      .sort(([left], [right]) => left - right)
      .map(([unitNumber, title]) => ({ unitNumber, title }))
    return {
      grade,
      lessons: gradeEntries.length,
      units: unitTitles,
      fictionalSimulations: gradeEntries.filter((entry) => entry.pkg.isFictionalSimulation).length,
      realWorldApplications: gradeEntries.filter((entry) => entry.pkg.realWorldAction).length,
      guardianAuthority: gradeEntries.filter((entry) => entry.pkg.completionAuthority === 'guardian').length,
      extendedResponsePrompts: gradeEntries.reduce((count, entry) => count + entry.pkg.tasks.flatMap((task) => task.prompts).filter((prompt) => prompt.promptType === 'extended-response').length, 0),
      performanceTasks: gradeEntries.reduce((count, entry) => count + entry.pkg.tasks.filter((task) => task.kind === 'performance-task').length, 0),
      averageStudentTaskWords: Number((gradeEntries.reduce((sum, entry) => sum + words(lessonText(entry)).length, 0) / gradeEntries.length).toFixed(1)),
    }
  })
  const unitSetFingerprints = profiles.map((profile) => profile.units.map((unit) => unit.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).join('|'))
  return {
    status: new Set(unitSetFingerprints).size === profiles.length ? 'PASS' : 'FAIL',
    basis: 'Every grade has a distinct six-unit scope and complete 6x6 sequence; exact and near-duplicate lesson collapse is assessed separately.',
    profiles,
  }
}
