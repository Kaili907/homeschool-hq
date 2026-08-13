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
// Text-reference / copyright discipline: every text reference is a pointer
// (id, title, author/creator, form, rights category, how to obtain it), never
// a reproduction of the work itself. This mirrors the policy already encoded
// in the source branches' own text banks (see e.g.
// grades/grade-3/public-domain-register.json: "No public-domain work is
// reproduced in this package," and courses/english-9/text-bank.json:
// "Nothing marked rights_required is reproduced in this package.").
// ---------------------------------------------------------------------------

function normalizeRights(rightsRaw, sourceType) {
  const r = (rightsRaw || sourceType || '').toLowerCase()
  if (r.includes('original')) return 'original'
  if (r.includes('public')) return 'public_domain'
  if (r.includes('required') || r.includes('licensed')) return 'rights_required'
  return 'unknown'
}

function obtainNoteFor(rightsCategory) {
  switch (rightsCategory) {
    case 'original':
      return 'Manuel Academy original text — ships with the course package; do not post it outside gated course delivery.'
    case 'public_domain':
      return 'Public-domain work. Obtain the text from a public-domain repository, a library, or a printed edition. It is not reproduced here.'
    case 'rights_required':
      return 'Rights-required work. Obtain a licensed or library copy. It is not reproduced here.'
    default:
      return 'Rights status unresolved for this reference — verify before use and do not reproduce the text until it is.'
  }
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
    const integrity =
      rightsCategory === 'public_domain'
        ? verifyTextIntegrity(t.text_id, pdIndex)
        : verifyTextIntegrity(t.text_id, textBankIndex)
    ir.textRefs.push({
      textId: t.text_id,
      title: t.title,
      form: t.genre,
      rightsCategory,
      obtainNote: obtainNoteFor(rightsCategory),
      substitutionPolicy: t.learner_or_family_selected_texts_permitted,
      sourceIntegrityStatus: integrity,
    })
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
      obtainNote: obtainNoteFor(rightsCategory),
      accessibleRepresentation: t.accessible_representation,
      sourceIntegrityStatus: verifyTextIntegrity(t.text_id, textBankIndex),
    }
  })
  return ir
}

// ---------------------------------------------------------------------------
// Standing policy text used as a fallback when a source record doesn't carry
// its own per-lesson authorship/fixed-answer statement (only the g34 and
// hs912 branches currently do). This is invariant program policy, not
// lesson-specific content, so stating it without per-lesson sourcing is safe.
// ---------------------------------------------------------------------------

export const STANDARD_AUTHORSHIP_POLICY =
  "You write your own response. A parent, tutor, or teacher may ask questions, model a skill on a different example, name a criterion, or restate the directions, but must not draft, dictate, outline, complete, reword, or supply sentences for your assessed work."

export const STANDARD_FIXED_ANSWER_NOTE =
  'Any fixed-answer or selected-response component of this lesson is scorer-visible only. Do not expose it on the learner-facing or tutor-facing surface before the learner responds.'

const REMEDIATION_SIGNAL_PRIORITY = [
  'prerequisite gap',
  'decoding or fluency barrier',
  'repeated error pattern',
  'answer without textual support',
]

function pickRemediationRoutes(routes) {
  if (!routes.length) return []
  const byPriority = REMEDIATION_SIGNAL_PRIORITY.map((sig) =>
    routes.find((r) => r.signal === sig),
  ).filter(Boolean)
  const rest = routes.filter((r) => !byPriority.includes(r))
  return [...byPriority, ...rest].slice(0, 3)
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function guidedSupportSegments(lessonFlow) {
  const excluded = /independent application|exit ticket|next step/i
  return lessonFlow.filter((s) => !excluded.test(s.segment || ''))
}

function studentTaskText(ir) {
  const parts = []
  parts.push(`Today's focus: ${ir.focus}.`)
  if (ir.essentialQuestion) parts.push(`Essential question: ${ir.essentialQuestion}`)
  if (ir.learningObjectives[0]) {
    parts.push(`By the end of this lesson you should be able to: ${toStudentVoice(ir.learningObjectives[0])}`)
  }
  if (ir.materials.length) {
    parts.push(`You'll need: ${ir.materials.join('; ')}.`)
  }
  return parts.join(' ')
}

// NOTE: guidedSupportText, independentEvidenceTaskText, and remediationText
// deliberately do NOT run their quoted source sentences through
// toStudentVoice(). Those sentences are authored as "The learner attempts X"
// (third-person singular subject + matching verb); a bare "the learner" ->
// "you" substitution leaves the old third-person verb behind ("You attempts
// X"), which is wrong. Fixing that generally requires re-conjugating an
// arbitrary verb, which a regex can't do reliably across 1,620 lessons of
// free text. So this content stays in the source's own third-person
// "the learner" voice, which is grammatically correct as written and is a
// normal register for task-card/coaching text (the "You'll need" / "Today's
// focus" framing in studentTask, and the extension field, are the parts
// composed to read as direct address, and those ARE voice-converted because
// they were checked against the corpus and don't hit this failure mode).

function independentEvidenceTaskText(ir) {
  if (ir.isUnitAssessmentDay && ir.assessmentPrompts?.length) {
    const openPrompts = ir.assessmentPrompts.filter((p) => !p.fixedAnswer)
    const lines = openPrompts.map(
      (p) => `- (${p.points} pts, ${p.type}) ${p.prompt}`,
    )
    const closedCount = ir.assessmentPrompts.length - openPrompts.length
    let text = `Unit assessment for ${ir.unitTitle}. Complete each prompt below in complete sentences, using evidence, reasoning, or a documented process:\n${lines.join('\n')}`
    if (closedCount > 0) {
      text += `\n\nThis assessment also includes ${closedCount} fixed-answer/selected-response item(s) delivered separately by your facilitator.`
    }
    return text
  }
  const base = ir.studentActivity || ir.formativeCheck
  if (!base) return undefined
  let text = repairFocusSubstitution(base, ir)
  if (ir.formativeCheck && ir.formativeCheck !== ir.studentActivity) {
    text += ` When finished: ${repairFocusSubstitution(ir.formativeCheck, ir)}`
  }
  // Some phases (e.g. "Performance task build") deliberately keep the daily
  // instruction terse because the substantive task is the multi-day unit
  // performance task itself — spell that out rather than leaving today's
  // task reading as a content-free placeholder.
  if (ir.unitPerformanceTask && /performance task/i.test(text)) {
    text += ` This unit's performance task: ${ir.unitPerformanceTask}`
  }
  // A handful of other short daily prompts (e.g. "Transfer challenge" days)
  // are terse for the same reason without naming "performance task" — fall
  // back to this lesson's own success criteria, which is always present,
  // lesson-specific, and exactly the right content for "what counts as done"
  // on a short task description.
  if (wordCount(text) < 25 && ir.successCriteria.length) {
    text += ` What this needs to show: ${ir.successCriteria.join(' ')}`
  }
  return text
}

// The g34 (grade 3-4) source branch authors its lesson_flow/adaptive_tutor_routes
// prose from templates like "the vocabulary {focus} requires" or "the smallest
// prerequisite {focus} depends on", which reads fine when `focus` is a short
// noun phrase but is ungrammatical when `focus` is a long clause (every grade
// 3-4 lesson's `focus` field is a clause, median 9 words: e.g. "what strong
// readers and writers do, and a no-penalty baseline"). That produces sentences
// like "the vocabulary what strong readers and writers do, and a no-penalty
// baseline requires". This is a source-branch authoring defect this package
// does not own the fix for (mac/g34-ela-r1), but since the broken text is an
// exact, known literal substring — the source's own `focus` field — it can be
// safely repaired here by swapping that literal occurrence for a short,
// context-neutral phrase that fits the same grammatical slot in every
// observed template.
function repairFocusSubstitution(text, ir) {
  if (!text || !ir.focus) return text
  // No length gate: even a short gerund/clause focus ("summarizing an
  // unfamiliar story independently") breaks these templates ("the vocabulary
  // <focus> requires" needs a plain noun, not a clause), so any literal
  // occurrence is replaced. This is a no-op when focus isn't a substring.
  return text.split(ir.focus).join("today's lesson")
}

function guidedSupportText(ir) {
  const segments = guidedSupportSegments(ir.lessonFlow)
  if (!segments.length) return undefined
  const lines = segments.map((s) => `- ${s.segment}: ${repairFocusSubstitution(s.action, ir)}`)
  let text = `Work through this with a facilitator, tutor, or on your own if you're ready:\n${lines.join('\n')}`
  const tips = pickRemediationRoutes(ir.adaptiveTutorRoutes).map(
    (r) => `- If ${r.signal}: ${repairFocusSubstitution(r.action, ir)}`,
  )
  if (tips.length) {
    text += `\n\nIf you get stuck:\n${tips.join('\n')}`
  }
  return text
}

function remediationText(ir) {
  const picked = pickRemediationRoutes(ir.adaptiveTutorRoutes)
  if (!picked.length) return undefined
  const lines = picked.map((r) => `- ${r.signal}: ${repairFocusSubstitution(r.action, ir)}`)
  return `Reteach paths for this lesson's target (${ir.focus}):\n${lines.join('\n')}`
}

function extensionText(ir) {
  if (!ir.extension) return undefined
  return repairFocusSubstitution(toStudentVoice(ir.extension), ir)
}

function sourceReferenceBlock(ir) {
  if (!ir.textRefs.length) {
    if (ir.sourceSchemaVariant === 'canonical') {
      return {
        present: true,
        mode: 'facilitator-selected',
        text: `This course does not ship a fixed anchor text for this lesson. Choose a grade-appropriate text that fits "${ir.unitTitle}" (${ir.focus}) and the standards ${ir.standards.join(', ')}. A facilitator may substitute a public-domain, library, licensed, or family-approved text at the same target; do not paste copyrighted text into the package.`,
      }
    }
    return { present: false }
  }
  return {
    present: true,
    refs: ir.textRefs.map((t) => ({
      textId: t.textId,
      title: t.title,
      author: t.author,
      form: t.form,
      rightsCategory: t.rightsCategory,
      obtainNote: t.obtainNote,
      accessibleRepresentation: t.accessibleRepresentation,
    })),
  }
}

export function buildStudentPackage(ir) {
  return {
    schemaVersion: '1.0',
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
    studentTask: block(true, studentTaskText(ir)),
    sourceReference: sourceReferenceBlock(ir),
    guidedSupport: block(true, guidedSupportText(ir)),
    independentEvidenceTask: block(true, independentEvidenceTaskText(ir)),
    remediation: block(true, remediationText(ir)),
    extension: block(true, extensionText(ir)),
  }
}

function rubricFromSuccessCriteria(ir) {
  return ir.successCriteria.map((c, i) => ({
    dimension: `criterion-${i + 1}`,
    description: c,
  }))
}

function acceptableAnswerCriteriaText(ir) {
  const parts = [...ir.successCriteria]
  if (ir.textRefs.length) {
    parts.push(
      'Evidence should be traceable to the assigned/selected text (a quote, a paraphrase with location, or a specific detail) rather than a general impression.',
    )
  }
  if (ir.masteryRule) parts.push(ir.masteryRule)
  return parts.join(' ')
}

export function buildScoringGuide(ir) {
  const hasFixedAnswerComponent = (ir.assessmentPrompts || []).some((p) => p.fixedAnswer)
  const doNotUse = [
    'Do not write, dictate, outline, or complete the learner\'s response.',
    'This rubric describes what to look for, not a single required answer — accept any response that meets the criteria.',
  ]
  if (hasFixedAnswerComponent) {
    doNotUse.push(
      'This lesson references fixed-answer/selected-response item(s). Their actual item text/options/keys are not yet authored in the source curriculum and are NOT fabricated here — do not invent or guess a key.',
    )
  }

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
    fixedAnswerProtection: ir.fixedAnswerProtection || (hasFixedAnswerComponent ? STANDARD_FIXED_ANSWER_NOTE : undefined),
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
