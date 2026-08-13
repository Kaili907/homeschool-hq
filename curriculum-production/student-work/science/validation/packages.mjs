/**
 * Shared loading and projection for the Science student-work validators.
 *
 * `projectToGateInput` is the only place a work package is turned into the
 * gate's `LessonProductionInput`. It lives here rather than in the build so the
 * projection is written once, in the language that runs the gate.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
export const REPO_ROOT = dirname(dirname(dirname(ROOT)))

export function loadJson(relative) {
  return JSON.parse(readFileSync(join(ROOT, relative), 'utf8'))
}

export function loadManifest() {
  return loadJson('MANIFEST.json')
}

export function loadSharedBlocks() {
  return loadJson('policy/shared-blocks.json')
}

export function loadSafetyFloor() {
  return loadJson('policy/safety-floor.json')
}

/**
 * The hand-authored scientific correctness keys, read straight from
 * `policy/correctness/` rather than from the packages that embed them. A
 * package claiming a key it was not built from has to be detectable.
 */
export function loadCorrectnessKeys() {
  const dir = join(ROOT, 'policy', 'correctness')
  const topics = new Map()
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.correctness.json'))
    .sort()
  for (const name of files) {
    const document = JSON.parse(readFileSync(join(dir, name), 'utf8'))
    for (const topic of document.topics) {
      const unit = String(topic.unit).padStart(2, '0')
      topics.set(`${document.course_id}-u${unit}::${topic.focus}`, {
        ...topic,
        __file: `policy/correctness/${name}`,
        __courseId: document.course_id,
        __sourceCommit: document.source_commit,
      })
    }
  }
  return topics
}

export function courseIds() {
  return readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

export function loadCoursePackages(courseId) {
  const raw = readFileSync(join(ROOT, 'packages', courseId, 'work-packages.jsonl'), 'utf8')
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
}

export function loadAllPackages() {
  return courseIds().flatMap((courseId) => loadCoursePackages(courseId))
}

export function studentSheet(pkg) {
  return readFileSync(
    join(ROOT, 'packages', pkg.course_id, 'student-sheets', `${pkg.lesson_id}.md`),
    'utf8',
  )
}

export function scoringSheet(pkg) {
  return readFileSync(
    join(ROOT, 'packages', pkg.course_id, 'scoring', `${pkg.lesson_id}.md`),
    'utf8',
  )
}

/** Reads a blob from the pinned source commit the package declares. */
export function readPinnedSource(commit, path) {
  return execFileSync('git', ['show', `${commit}:${path}`], {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024 * 64,
  }).toString('utf8')
}

const normalise = (text) => (text ?? '').replace(/\s+/g, ' ').trim()

export function resolveSafetyBrief(brief, floor, blocks, band = 'secondary') {
  const pick = (items) =>
    items.map((item) => (band === 'elementary' ? item.elementary_text || item.text : item.text))
  const text = blocks.text
  const resolved = { ...brief }
  resolved.headline = text[brief.headline_ref]
  resolved.pause_rule = text[brief.pause_rule_ref]
  resolved.equal_credit_rule = text[brief.equal_credit_rule_ref]
  if (brief.required_ppe_ref) resolved.required_ppe = text[brief.required_ppe_ref]
  if (brief.hazard_note_ref) resolved.hazard_note = text[brief.hazard_note_ref]
  resolved.safe_order_note = brief.safe_order_note_ref ? text[brief.safe_order_note_ref] : ''
  if (brief.disposal_ref) resolved.disposal = text[brief.disposal_ref]
  if (brief.stop_conditions_from_floor) {
    resolved.stop_conditions = pick(floor.global_stop_conditions)
  }
  if (brief.prohibitions_from_floor) {
    resolved.prohibitions = pick(floor.non_disableable_prohibitions)
  }
  if (brief.privacy_from_floor) {
    resolved.privacy = floor.required_privacy_declarations.map((item) => item.text)
  }
  return resolved
}

/**
 * Projects a work package into the gate's generic lesson contract.
 *
 * Every status the gate cannot verify on its own is carried from a check the
 * build actually ran, not asserted here: objective alignment from the
 * question-to-objective coverage check, safety from the student-visibility
 * comparison against the guardian record, and source integrity only where the
 * curriculum source itself names published data.
 */
export function projectToGateInput(pkg, blocks) {
  const text = blocks.text
  const lists = blocks.lists

  const independentWork = [
    pkg.data_sheet.lesson_task_verbatim,
    text[pkg.data_sheet.no_supplied_values_rule_ref],
    ...pkg.analysis_questions.map((question) => question.prompt),
  ].join('\n')

  const scoringAuthorityText = [
    pkg.expected_reasoning.source_scoring_guidance_verbatim,
    ...blocks.rubric_criteria.map((criterion) => `${criterion.criterion}: ${criterion.meets}`),
    text[pkg.rubric.threshold_ref],
  ].join(' ')

  return {
    lessonId: pkg.lesson_id,
    title: pkg.title,
    courseId: pkg.course_id,
    unitId: pkg.unit_id,
    subjectFamily: 'SCIENCE',
    instruction: { present: true, text: normalise(pkg.instruction) },
    independentWork: { present: true, text: normalise(independentWork) },
    scoringAuthority: {
      kind: 'RUBRIC',
      content: { present: true, text: normalise(scoringAuthorityText) },
    },
    remediation: {
      present: true,
      text: normalise(lists[pkg.remediation.student_visible_if_stuck_ref].join(' ')),
    },
    extension: { present: true, text: normalise(pkg.extension.options.join(' ')) },
    assessmentAlignment: pkg.assurances.objective_alignment_verified ? 'ALIGNED' : 'UNKNOWN',
    requiresSourceIntegrity: pkg.assurances.source_integrity_required,
    sourceIntegrityStatus: pkg.assurances.source_integrity_status,
    requiresSafetyOrPrivacyReview: true,
    safetyOrPrivacyStatus: pkg.assurances.safety_completeness,
    safeAlternative: {
      present: Boolean(pkg.equal_credit_safe_alternative.text),
      text: normalise(
        `${pkg.equal_credit_safe_alternative.text} ${text[pkg.equal_credit_safe_alternative.equal_credit_rule_ref]}`,
      ),
    },
  }
}
