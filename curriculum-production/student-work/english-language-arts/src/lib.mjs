// Shared library for generating Manuel Academy ELA student-work packages
// and scoring guides from the three ELA source branches. Plain ESM so it can
// be imported by both the generation script (tools/generate.mjs) and the
// vitest gate/unit tests without a build step.
//
// Read-only inputs live outside this package (canonical grades 5/7/8, the
// mac/g34-ela-r1 branch for grades 3-4, the mac/hs912-ela-r1 branch for
// grades 9-12). This module never writes to those locations.

import fs from 'node:fs'
import path from 'node:path'
import { buildDeliveredReading, buildLearnerWork } from './contentRepair.mjs'

export function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

export function loadJSONL(p) {
  return fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

// ---------------------------------------------------------------------------
// Student-voice rewriting: source lesson records are authored in third
// person for the teacher/tutor ("the learner attempts..."). Student-facing
// package text is lightly rewritten to second person. This is a mechanical
// substitution, not new content — it never changes what the task asks for.
// ---------------------------------------------------------------------------

const VOICE_REPLACEMENTS = [
  [/\bThe learner's\b/g, 'Your'],
  [/\bthe learner's\b/g, 'your'],
  [/\bThe learner\b/g, 'You'],
  [/\bthe learner\b/g, 'you'],
  [/\ba learner\b/g, 'you'],
  [/\blearners\b/g, 'you'],
]

export function toStudentVoice(text) {
  if (!text) return text
  let out = text
  for (const [pattern, replacement] of VOICE_REPLACEMENTS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

function block(present, text) {
  return text ? { present, text } : { present: false }
}

// ---------------------------------------------------------------------------
// Legacy source-reference metadata is read only to trace and verify the three
// pinned inputs. Learner delivery is built separately by contentRepair.mjs:
// complete Academy-original text is embedded inline, and neither public-domain
// nor rights-required source bodies are copied from the legacy banks.
// ---------------------------------------------------------------------------

function normalizeRights(rightsRaw, sourceType) {
  const r = (rightsRaw || sourceType || '').toLowerCase()
  if (r.includes('original')) return 'original'
  if (r.includes('public')) return 'public_domain'
  if (r.includes('required') || r.includes('licensed')) return 'rights_required'
  return 'unknown'
}

/**
 * Cross-checks a text reference against the source-of-truth bank file for
 * that branch, when one exists. Returns 'VERIFIED' | 'GAP' | 'NOT_APPLICABLE'.
 */
export function verifyTextIntegrity(textId, bankIndex) {
  if (!bankIndex) return 'NOT_APPLICABLE'
  const entry = bankIndex.get(textId)
  if (!entry) return 'GAP'
  return 'VERIFIED'
}

// ---------------------------------------------------------------------------
// Source adapters: g34 (grades 3-4), canonical (grades 5/7/8), hs912
// (grades 9-12) each use a different lesson schema. Each adapter normalizes
// one raw lesson record + its unit + (if it's an assessment day) its unit
// assessment record into a common LessonIR shape.
// ---------------------------------------------------------------------------

function commonFields(raw) {
  return {
    lessonId: raw.lesson_id,
    courseId: raw.course_id,
    grade: raw.grade,
    subject: raw.subject,
    unitNumber: raw.unit_number,
    unitTitle: raw.unit_title,
    dayInUnit: raw.day_in_unit,
    courseDay: raw.course_day,
    title: raw.title,
    phase: raw.phase,
    focus: raw.focus,
    estimatedMinutes: raw.estimated_minutes,
    standards: raw.standards || [],
    essentialQuestion: raw.essential_question,
    learningObjectives: raw.learning_objectives || [],
    successCriteria: raw.success_criteria || [],
    materials: raw.materials || [],
    studentActivity: raw.student_activity,
    formativeCheck: raw.formative_check,
    lessonFlow: (raw.lesson_flow || []).map((s) => ({
      segment: s.segment,
      minutes: s.minutes,
      action: s.teacher_or_tutor_action,
    })),
    extension: raw.extension,
    adaptiveTutorRoutes: (raw.adaptive_tutor_routes || []).map((r) => ({
      signal: r.signal,
      action: r.action,
    })),
    masteryRule: raw.mastery_rule,
    answerOrScoringGuidance: raw.answer_or_scoring_guidance,
    studentAuthorship: raw.student_authorship,
    safetyAndPrivacy: raw.safety_and_privacy || [],
    isUnitAssessmentDay: raw.phase === 'Unit assessment',
  }
}

function unitAssessmentPrompts(assessment) {
  if (!assessment) return undefined
  return (assessment.prompts || []).map((p) => ({
    type: p.type,
    points: p.points,
    fixedAnswer: !!p.fixed_answer,
    prompt: p.prompt,
  }))
}

export function adaptG34(raw, unit, assessment, textBankIndex, pdIndex) {
  const ir = commonFields(raw)
  ir.sourceSchemaVariant = 'g34'
  ir.unitPerformanceTask = unit?.performance_task
  ir.assessmentPrompts = unitAssessmentPrompts(assessment)
  ir.assessmentRubricDimensions = assessment?.rubric_dimensions
  ir.mastery = raw.mastery
  ir.fixedAnswerProtection = raw.fixed_answer_protection

  ir.textRefs = []
  const t = raw.text_reference
  if (t && t.text_id) {
    const rightsCategory = normalizeRights(t.rights, t.source_type)
    const bankEntry = rightsCategory === 'public_domain' ? pdIndex?.get(t.text_id) : textBankIndex?.get(t.text_id)
    const integrity =
      rightsCategory === 'public_domain'
        ? verifyTextIntegrity(t.text_id, pdIndex)
        : verifyTextIntegrity(t.text_id, textBankIndex)
    ir.textRefs.push({
      textId: t.text_id,
      title: t.title,
      form: t.genre,
      rightsCategory,
      substitutionPolicy: t.learner_or_family_selected_texts_permitted,
      sourceIntegrityStatus: integrity,
    })
    if (rightsCategory === 'original' && bankEntry?.text) {
      ir.embeddedOriginalText = {
        textId: t.text_id,
        title: bankEntry.title || t.title,
        form: bankEntry.genre || t.genre,
        text: bankEntry.text,
      }
    }
  }
  return ir
}

export function adaptCanonical(raw, unit, assessment) {
  const ir = commonFields(raw)
  ir.sourceSchemaVariant = 'canonical'
  ir.unitPerformanceTask = unit?.performance_task
  ir.assessmentPrompts = unitAssessmentPrompts(assessment)
  ir.assessmentRubricDimensions = assessment?.rubric_dimensions
  // The canonical grade-5/7/8 course package does not yet ship a concrete
  // anchor-text bank (no text_reference field, no text-bank file on disk) —
  // the facilitator selects a grade- and standard-appropriate text. There is
  // nothing to verify, so source integrity is NOT_APPLICABLE rather than a
  // fabricated VERIFIED/GAP call.
  ir.textRefs = []
  return ir
}

export function adaptHs912(raw, unit, assessment, textBankIndex) {
  const ir = commonFields(raw)
  ir.sourceSchemaVariant = 'hs912'
  ir.unitPerformanceTask = unit?.performance_task
  ir.assessmentPrompts = unitAssessmentPrompts(assessment)
  ir.assessmentRubricDimensions = assessment?.rubric_dimensions

  ir.textRefs = (raw.assigned_texts || []).map((t) => {
    const rightsCategory = normalizeRights(t.rights)
    return {
      textId: t.text_id,
      title: t.title,
      author: t.author,
      form: t.form,
      rightsCategory,
      accessibleRepresentation: t.accessible_representation,
      sourceIntegrityStatus: verifyTextIntegrity(t.text_id, textBankIndex),
    }
  })
  return ir
}

// ---------------------------------------------------------------------------
// Standing policy text used as a fallback when a source record doesn't carry
// its own per-lesson authorship statement. This is invariant program policy, not
// lesson-specific content, so stating it without per-lesson sourcing is safe.
// ---------------------------------------------------------------------------

export const STANDARD_AUTHORSHIP_POLICY =
  "You write your own response. A parent, tutor, or teacher may ask questions, model a skill on a different example, name a criterion, or restate the directions, but must not draft, dictate, outline, complete, reword, or supply sentences for your assessed work."

function sourceReferenceBlock(reading) {
  return {
    present: true,
    mode: 'academy-original-inline',
    text: reading.text,
    refs: [{
      textId: reading.textId,
      title: reading.title,
      author: reading.author,
      form: reading.form,
      rightsCategory: reading.rightsCategory,
      deliveryMode: reading.deliveryMode,
      learnerAvailable: reading.learnerAvailable,
      fullTextIncluded: reading.fullTextIncluded,
      rightsStatement: reading.rightsStatement,
      wordCount: reading.wordCount,
      sha256: reading.sha256,
      origin: reading.origin,
    }],
  }
}

export function buildStudentPackage(ir) {
  const reading = buildDeliveredReading(ir)
  const work = buildLearnerWork(ir, reading)
  const guidedSupport = [
    `Use this source-specific routine for “${reading.title}”:`,
    `1. Preview the title and paragraph structure; write what ${ir.focus} asks you to notice or do.`,
    '2. Mark one statement the source makes explicitly and one inference a reader could draw. Keep the two kinds of thinking separate.',
    `3. Test the inference with the evidence requirement in today's task. If the evidence is weak or incomplete, narrow or revise the inference.`,
    '4. Draft your own response. A facilitator may clarify directions or ask questions, but may not supply your claim, evidence choice, sentences, or revision.',
  ].join('\n')
  const remediation = [
    `If ${ir.focus} is not yet secure, return to “${reading.title}” before starting over:`,
    '- Evidence gap: underline the exact words that support the idea and label their paragraph or location.',
    '- Reasoning gap: complete the stem “This evidence matters because …” in your own words, then reread the question.',
    '- Overclaim: name what the source does not establish and narrow the conclusion to what the evidence can support.',
    '- Completion gap: compare the draft with each learner success criterion and repair one missing part at a time.',
  ].join('\n')
  return {
    schemaVersion: '2.0',
    packageId: `swk-${ir.lessonId}`,
    lessonRef: {
      lessonId: ir.lessonId,
      courseId: ir.courseId,
      grade: ir.grade,
      subject: ir.subject,
      unitNumber: ir.unitNumber,
      unitTitle: ir.unitTitle,
      dayInUnit: ir.dayInUnit,
      courseDay: ir.courseDay,
      phase: ir.phase,
      focus: ir.focus,
      title: ir.title,
      estimatedMinutes: ir.estimatedMinutes,
    },
    standards: ir.standards,
    studentTask: block(true, work.instruction),
    sourceReference: {
      ...sourceReferenceBlock(reading),
      text: reading.text,
    },
    guidedSupport: block(true, guidedSupport),
    independentEvidenceTask: block(true, work.independentText),
    deliverable: work.deliverable,
    learning_objectives: [
      `Use the delivered reading to apply ${ir.focus}.`,
      'Support a conclusion with located evidence and explain the reasoning.',
    ],
    lesson_success_criteria: work.successCriteria,
    completionCriteria: work.successCriteria,
    task_steps: work.taskSteps,
    writingTask: {
      required: work.writingRequired,
      prompt: work.question,
      deliverable: work.deliverable,
    },
    remediation: block(true, remediation),
    extension: block(true, `Apply ${ir.focus} to a different paragraph or a defensible alternative interpretation of “${reading.title}.” Compare the new result with your first response and explain which evidence changes, which reasoning still holds, and why.`),
  }
}

function rubricFromSuccessCriteria(ir) {
  return ir.successCriteria.map((c, i) => ({
    dimension: `criterion-${i + 1}`,
    description: c,
  }))
}

function acceptableAnswerCriteriaText(ir) {
  const reading = buildDeliveredReading(ir)
  const work = buildLearnerWork(ir, reading)
  const parts = [...ir.successCriteria, ...work.successCriteria]
  parts.push(
    `Evidence must be traceable to the delivered Academy-original text “${reading.title}” by paragraph number or another precise location rather than a general impression.`,
  )
  if (ir.masteryRule) parts.push(ir.masteryRule)
  return parts.join(' ')
}

export function buildScoringGuide(ir) {
  const doNotUse = [
    'Do not write, dictate, outline, or complete the learner\'s response.',
    'This rubric describes what to look for, not a single required answer — accept any response that meets the criteria.',
  ]

  return {
    schemaVersion: '1.0',
    guideId: `sg-${ir.lessonId}`,
    lessonRef: {
      lessonId: ir.lessonId,
      courseId: ir.courseId,
      grade: ir.grade,
      unitNumber: ir.unitNumber,
      unitTitle: ir.unitTitle,
      phase: ir.phase,
      title: ir.title,
    },
    scoringAuthority: {
      kind: 'RUBRIC',
      rubric: rubricFromSuccessCriteria(ir),
      scoringGuidance: ir.answerOrScoringGuidance,
      acceptableAnswerCriteria: block(true, acceptableAnswerCriteriaText(ir)),
    },
    masteryCriteria: ir.mastery || { rule: ir.masteryRule },
    authorshipPolicy: ir.studentAuthorship || STANDARD_AUTHORSHIP_POLICY,
    fixedAnswerProtection: undefined,
    doNotUse,
  }
}

// ---------------------------------------------------------------------------
// Course loading
// ---------------------------------------------------------------------------

export function buildTextBankIndex(bankPath, key = 'id') {
  if (!bankPath || !fs.existsSync(bankPath)) return null
  const raw = loadJSON(bankPath)
  const list = Array.isArray(raw) ? raw : raw.works || raw.texts || []
  const idx = new Map()
  for (const entry of list) {
    idx.set(entry[key] || entry.id || entry.text_id, entry)
  }
  return idx
}

export function loadCourse({ courseDir, adapter, textBankIndex, pdIndex }) {
  const lessons = loadJSONL(path.join(courseDir, 'lessons.jsonl'))
  const units = loadJSON(path.join(courseDir, 'units.json'))
  const assessments = loadJSON(path.join(courseDir, 'assessments.json'))

  const unitByNumber = new Map(units.map((u) => [u.unit_number, u]))
  const assessmentByUnit = new Map(assessments.map((a) => [a.unit_number, a]))

  return lessons.map((raw) => {
    const unit = unitByNumber.get(raw.unit_number)
    const assessment = raw.phase === 'Unit assessment' ? assessmentByUnit.get(raw.unit_number) : undefined
    return adapter(raw, unit, assessment, textBankIndex, pdIndex)
  })
}
