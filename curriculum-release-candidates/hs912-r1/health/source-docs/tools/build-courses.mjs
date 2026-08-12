#!/usr/bin/env node
// Expands course-data.mjs into the canonical Manuel Academy course shape used by
// curriculum-content/manuel-academy/1.0.0/grades/<grade>/courses/<subject>/.
//
// Output goes to ../build/ inside this subject's own tree. This session owns
// curriculum-authoring/full-family-highschool-9-12/subjects/health/** and writes
// nowhere else — importing the build output into the canonical package is the
// release/convergence lane's decision, not this lane's.
//
// Usage: node build-courses.mjs [outDir]

import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COURSES, OPTIONAL_MODULES, PRACTICE, TOPIC, anchor, SECTION_1 } from './course-data.mjs'

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_OUT = path.join(path.dirname(TOOLS_DIR), 'build')

// The canonical six-day unit arc used by the Grades 5/7/8 health courses.
const PHASES = [
  'Launch and diagnostic',
  'Explicit model',
  'Guided practice',
  'Application or project',
  'Mastery check',
  'Correction and reflection',
]

// Carried verbatim from the canonical package so imported lessons read the same.
const BASE_ACCESSIBILITY = [
  'Provide readable text plus optional audio or read-aloud support; no voice feature is required.',
  'Chunk directions into one action at a time and show a worked example or model.',
  'Allow typed, handwritten, spoken, drawn, manipulatives-based, or demonstrated responses when the standard permits.',
  'Offer reduced-copying, extended-time, hidden-timer, movement-break, and low-distraction options.',
  'Use captions, alt text, high-contrast print, keyboard access, and text-only fallbacks for media.',
  'Preserve the learning target while adjusting quantity, pacing, representation, or response mode.',
]

const BASE_SAFETY = [
  'Use respectful, non-shaming language.',
  'Allow a pause, break, or alternate response mode without treating it as failure.',
  'Do not require disclosure of private health, trauma, diagnosis, body, or family information.',
  'Use body-respect language; do not use dieting, calorie targets, weight cutting, weigh-ins, or body-size scoring.',
  'Do not require weight, BMI, body-fat, body measurement, calorie counts, diet goals, medical history, mental-health diagnosis, or sexual history at any point.',
  'Do not require a photograph, video, or voice recording of the learner as evidence; every task has a text, spoken-to-an-adult, or demonstrated alternative.',
  'This course teaches health information and does not diagnose; direct urgent safety or health concerns to a trusted adult or qualified professional.',
]

const MASTERY_RULE =
  'Do not mark mastery from one answer. Use scenario response, decision process, communication practice, safety plan, and private or minimally disclosive reflection; require accurate independent evidence and successful transfer or retrieval on at least two occasions separated by time or representation.'

const pad = (n) => String(n).padStart(2, '0')

function standardsFor(unit) {
  const list = unit.practices.flatMap((p) => unit.topics_codes.map((t) => anchor(p, t)))
  return unit.section_1 ? [...list, SECTION_1] : list
}

// mapping_status is set honestly: Practice names and Topic abbreviations were
// read verbatim from the official State Board source, so those anchors are
// canonical. Per-indicator numbers inside a Practice were never read and are
// never invented, so no lesson claims one.
function standardsMappingFor(unit) {
  const entries = unit.practices.flatMap((p) =>
    unit.topics_codes.map((t) => ({
      code: `12.${p}.${t}`,
      framework: 'Michigan Health Education Standards Guidelines 2025 (grades 9-12 band)',
      practice: PRACTICE[p],
      topic: TOPIC[t],
      mapping_status: 'canonical',
      note: 'Practice name and topic abbreviation verified against the official source; the band code follows the confirmed <terminal-grade>.<practice>.<TOPIC> pattern. No per-indicator number is claimed.',
    })),
  )
  if (unit.section_1) {
    entries.push({
      code: 'Section 1',
      framework: 'Michigan Health Education Standards Guidelines 2025',
      practice: null,
      topic: 'Content required by Michigan law',
      mapping_status: 'unverified',
      note: 'Section 1 (HIV instruction, CPR/AED, physiology and hygiene relating to substance use) is confirmed to exist and to be legally required; its internal numbering was not read from the source.',
    })
  }
  if (unit.section_3) {
    entries.push({
      code: '12.x.SE',
      framework: 'Michigan Health Education Standards Guidelines 2025 Section 3 (Sex Education)',
      practice: null,
      topic: TOPIC.SE,
      mapping_status: 'human-review',
      note: 'Section 3 is governed by MCL 380.1507 and MCL 380.1169. Content selection is a guardian and, in a district setting, a Sex Education Advisory Board decision; it is not settled by this authoring lane.',
    })
  }
  return entries
}

function buildLesson(course, unit, unitNumber, dayInUnit, courseDay) {
  const focus = unit.topics[dayInUnit - 1]
  const phase = PHASES[dayInUnit - 1]
  return {
    schema_version: '1.0',
    lesson_id: `${course.courseId}-u${pad(unitNumber)}-l${pad(dayInUnit)}`,
    course_id: course.courseId,
    grade: course.grade,
    subject: 'health',
    course_day: courseDay,
    unit_number: unitNumber,
    unit_title: unit.title,
    day_in_unit: dayInUnit,
    title: `${phase}: ${focus}`,
    phase,
    focus,
    estimated_minutes: '35–55',
    standards: standardsFor(unit),
    standards_mapping: standardsMappingFor(unit),
    essential_question: unit.essentialQuestion,
    learning_objectives: [
      `Explain ${focus} accurately using current, reliable health information rather than assumption or anecdote.`,
      `Apply ${focus} inside a fictional scenario, showing the reasoning, evidence, or decision process that produced the response.`,
      `Check and revise the work on ${focus} against stated success criteria and name the next step.`,
    ],
    success_criteria: [
      `The learner completes the central task about ${focus} without being asked for any private disclosure.`,
      'The learner gives evidence, reasoning, a documented process, or a cited source rather than an unsupported claim.',
      'The learner checks or revises the work and can identify a next step.',
    ],
    materials: unit.materials,
    lesson_flow: [
      {
        segment: 'Welcome and retrieval',
        minutes: '5–8',
        teacher_or_tutor_action: `Open with a short accessible prompt on “${focus}.” Ask the learner to recall, predict, or pose a question before instruction. Use a fictional example; do not ask about the learner's own situation.`,
      },
      {
        segment: 'Model or mini-lesson',
        minutes: '8–15',
        teacher_or_tutor_action: `Teach accurate, age-appropriate content on ${focus}. Model the health skill in play — analyzing an influence, evaluating a source, running a decision, communicating a boundary, or identifying a trusted support — and name the success criteria.`,
      },
      {
        segment: 'Guided practice',
        minutes: '10–18',
        teacher_or_tutor_action: `Work two supported scenarios about ${focus} together. After each, ask what evidence or reasoning supports the move. Fade prompting on the second scenario.`,
      },
      {
        segment: 'Independent application',
        minutes: '12–22',
        teacher_or_tutor_action: `Learner applies ${focus} to a new fictional scenario and records the response together with the reasoning, evidence, or decision process behind it.`,
      },
      {
        segment: 'Exit ticket and next step',
        minutes: '3–7',
        teacher_or_tutor_action: `In one concise response, show or explain the most important idea about ${focus}, then name one check that would catch a weak claim or an unsafe step.`,
      },
    ],
    student_activity: `Learner applies ${focus} to a new fictional scenario and records the response with the reasoning, evidence, or decision process behind it.`,
    formative_check: `In one concise response, show or explain the most important idea about ${focus}, then name one check that would catch a weak claim or an unsafe step.`,
    answer_or_scoring_guidance:
      'Score the stated learning target, accuracy, evidence and reasoning, and revision. Accept multiple valid approaches that meet the criteria. Never score body size, appearance, personal circumstances, or willingness to disclose. Do not infer effort, motivation, diagnosis, or character from an error.',
    adaptive_tutor_routes: [
      { signal: 'prerequisite gap', action: `Return to the smallest prerequisite needed for ${focus}, model it with a concrete or text-only representation, then retry one fresh scenario.` },
      { signal: 'procedure without understanding', action: `Ask the learner to explain why the approach to ${focus} works before continuing.` },
      { signal: 'correct but low confidence', action: `Confirm the reasoning specifically, offer one varied scenario about ${focus}, and avoid unnecessary remediation.` },
      { signal: 'repeated error pattern', action: 'Name the observable pattern neutrally, contrast it with a worked example, and schedule a short later review.' },
      { signal: 'learner discloses something private', action: 'Do not record it, do not treat it as assessment evidence, and route the learner to a trusted adult or qualified professional. Continue the lesson with the fictional scenario.' },
      { signal: 'mastery evidence', action: `Require accurate independent application plus explanation on a later or different occasion before marking ${focus} mastered.` },
    ],
    mastery_rule: MASTERY_RULE,
    extension: `Apply ${focus} under a new constraint, compare two approaches, or explain the idea to someone else with an original fictional example, without completing another learner's graded work.`,
    accessibility_and_accommodations: [...BASE_ACCESSIBILITY, unit.adapted],
    safety_and_privacy: [...BASE_SAFETY, unit.privacy],
    guardian_safety: unit.guardian,
    media: {
      suggestion: `Optional diagram, source excerpt, worked example, or short clip supporting ${focus}.`,
      required: false,
      fallback: 'Provide the same information as readable steps, alt text, a transcript, or an adult explanation. No lesson requires media to be completed.',
    },
    parent_or_guardian_visibility:
      'Share the lesson target, completion state, evidence type, and next instructional step. Do not expose raw reflections, raw answers, recordings, body data, or diagnosis language. For safety-critical or sensitive-content units, record only the guardian confirmation that was required.',
    home_connection: `Invite the learner to notice one safe, optional example of ${focus} in daily life. No purchase, account creation, photograph, recording, or private disclosure is required.`,
  }
}

function buildAssessment(course, unit, unitNumber) {
  return {
    assessment_id: `${course.courseId}-u${pad(unitNumber)}-assessment`,
    unit_number: unitNumber,
    unit_title: unit.title,
    standards: standardsFor(unit),
    total_points: 38,
    prompts: [
      { type: 'concept and vocabulary', prompt: `Explain ${unit.topics[0]} in your own words and give a valid example.`, points: 4 },
      { type: 'source or representation', prompt: `Use a cited source, diagram, model, or documented process to show understanding of ${unit.topics[1]}.`, points: 5 },
      { type: 'application', prompt: `Apply ${unit.topics[2]} in a new fictional situation. Show the decision process or cite the evidence used.`, points: 6 },
      { type: 'error or claim analysis', prompt: `Analyze a plausible error, weak claim, or unsafe choice involving ${unit.topics[3]}; correct it and explain why.`, points: 6 },
      { type: 'connection', prompt: `Connect ${unit.topics[4]} with ${unit.topics[5]}. Explain how the two support, constrain, or build on one another.`, points: 5 },
      { type: 'performance evidence', prompt: `Present the strongest evidence from the unit task: ${unit.performanceTask}`, points: 8 },
      { type: 'reflection and transfer', prompt: 'Identify one skill you can now transfer, one check that improves accuracy, and one next question.', points: 4 },
    ],
    mastery_interpretation: {
      secure: 'At least 85% with accurate independent application and adequate evidence and reasoning.',
      developing: '70–84% or inconsistent explanation; assign targeted review and a fresh transfer check on a later occasion.',
      not_yet: 'Below 70% or a missing prerequisite; reteach the smallest gap and reassess with new evidence.',
      rule: 'A unit score is one evidence source on one occasion, not the sole basis for long-term mastery.',
    },
    rubric_dimensions: ['accuracy of health information', 'evidence and reasoning', 'skill application', 'checking and revision'],
    accommodation_note:
      'Access supports may change format, pacing, quantity, setting, or response mode without changing the standard being assessed. No assessment requires disclosure, a recording, or any body measurement.',
    privacy_note: unit.privacy,
  }
}

function buildUnitRecord(course, unit, unitNumber, lessons) {
  return {
    unit_id: `${course.courseId}-u${pad(unitNumber)}`,
    course_id: course.courseId,
    grade: course.grade,
    subject: 'health',
    unit_number: unitNumber,
    title: unit.title,
    days: 6,
    standards: standardsFor(unit),
    standards_mapping: standardsMappingFor(unit),
    essential_question: unit.essentialQuestion,
    topics: unit.topics,
    performance_task: unit.performanceTask,
    materials: unit.materials,
    inclusive_adaptation: unit.adapted,
    privacy_guard: unit.privacy,
    guardian_safety: unit.guardian,
    required_by_michigan_law: Boolean(unit.section_1),
    lesson_ids: lessons.map((l) => l.lesson_id),
    assessment_id: `${course.courseId}-u${pad(unitNumber)}-assessment`,
  }
}

function courseGuide(course, units) {
  const lines = [
    `# ${course.title}`,
    '',
    `**Course id:** \`${course.courseId}\`  `,
    `**Grade:** ${course.grade}  `,
    `**Instructional days:** ${course.days} (6 units × 6 days)  `,
    `**Standards framework:** Michigan Health Education Standards Guidelines 2025, Grades 9-12 band`,
    '',
    course.description,
    '',
    `## Where this sits in the 9-12 arc`,
    '',
    course.focusStatement,
    '',
    '## Capstone',
    '',
    course.capstone,
    '',
    '## Privacy floor',
    '',
    'No lesson, task, or assessment in this course requires weight, BMI, body-fat, body measurement, calorie counts, diet or body-size goals, medical history, mental-health diagnosis, sexual history, a body photograph, or a voice or video recording. Every scenario is fictional. A learner who discloses something private is routed to a trusted adult; the disclosure is never recorded or used as assessment evidence. This course does not diagnose.',
    '',
    '## Units',
    '',
  ]
  for (const u of units) {
    lines.push(`### Unit ${u.unit_number} — ${u.title}`)
    lines.push('')
    lines.push(`*${u.essential_question}*`)
    lines.push('')
    lines.push(`- **Standards:** ${u.standards.join('; ')}`)
    lines.push(`- **Topics:** ${u.topics.join(', ')}`)
    lines.push(`- **Performance task:** ${u.performance_task}`)
    lines.push(`- **Inclusive adaptation:** ${u.inclusive_adaptation}`)
    lines.push(`- **Privacy guard:** ${u.privacy_guard}`)
    if (u.required_by_michigan_law) {
      lines.push(`- **Contains content required by Michigan law** (HESG Section 1). Guardians receive prior notification and may review all materials.`)
    }
    lines.push('')
    lines.push('**Guardian safety notice**')
    lines.push('')
    lines.push(`| Equipment | Environment | Movement hazards | Sensitive content | Guardian confirmation |`)
    lines.push(`| --- | --- | --- | --- | --- |`)
    lines.push(
      `| ${u.guardian_safety.equipment} | ${u.guardian_safety.environment} | ${u.guardian_safety.movement_hazards} | ${u.guardian_safety.sensitive_content_note} | ${u.guardian_safety.guardian_confirmation_required ? 'Required' : 'Not required'} |`,
    )
    lines.push('')
  }
  return lines.join('\n')
}

function lessonSequence(course, lessons) {
  const lines = [`# ${course.title} — Lesson Sequence`, '', `${course.days} instructional days.`, '', '| Day | Unit | Day in unit | Phase | Focus |', '| --- | --- | --- | --- | --- |']
  for (const l of lessons) lines.push(`| ${l.course_day} | ${l.unit_number} | ${l.day_in_unit} | ${l.phase} | ${l.focus} |`)
  return lines.join('\n') + '\n'
}

export function buildCourse(course) {
  const units = []
  const lessons = []
  const assessments = []
  let courseDay = 1
  course.units.forEach((unit, i) => {
    const unitNumber = i + 1
    const unitLessons = []
    for (let day = 1; day <= 6; day += 1) {
      unitLessons.push(buildLesson(course, unit, unitNumber, day, courseDay))
      courseDay += 1
    }
    units.push(buildUnitRecord(course, unit, unitNumber, unitLessons))
    assessments.push(buildAssessment(course, unit, unitNumber))
    lessons.push(...unitLessons)
  })
  return { units, lessons, assessments }
}

export function buildOptionalModule(mod) {
  const pseudoCourse = { courseId: 'ma-hs-health-se', grade: 12, days: mod.days }
  const lessons = []
  for (let day = 1; day <= 6; day += 1) {
    const l = buildLesson(pseudoCourse, mod.unit, 1, day, day)
    l.lesson_id = `${mod.moduleId}-l${pad(day)}`
    l.course_id = mod.moduleId
    l.grade = mod.recommendedGrade
    l.optional_guardian_activated = true
    l.scheduled_by_default = false
    lessons.push(l)
  }
  return {
    module_id: mod.moduleId,
    title: mod.title,
    recommended_grade: mod.recommendedGrade,
    days: mod.days,
    guardian_activation_required: true,
    scheduled_by_default: false,
    counts_toward_course_days: false,
    required_for_completion_or_credit: false,
    description: mod.description,
    standards: standardsFor(mod.unit),
    standards_mapping: standardsMappingFor(mod.unit),
    essential_question: mod.unit.essentialQuestion,
    topics: mod.unit.topics,
    performance_task: mod.unit.performanceTask,
    inclusive_adaptation: mod.unit.adapted,
    privacy_guard: mod.unit.privacy,
    guardian_safety: mod.unit.guardian,
    lessons,
  }
}

async function main() {
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT
  await rm(outDir, { recursive: true, force: true })
  const index = []
  for (const course of COURSES) {
    const { units, lessons, assessments } = buildCourse(course)
    const dir = path.join(outDir, `grade-${course.grade}`, 'courses', 'health')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'units.json'), JSON.stringify(units, null, 2) + '\n')
    await writeFile(path.join(dir, 'lessons.jsonl'), lessons.map((l) => JSON.stringify(l)).join('\n') + '\n')
    await writeFile(path.join(dir, 'assessments.json'), JSON.stringify(assessments, null, 2) + '\n')
    await writeFile(path.join(dir, 'course-guide.md'), courseGuide(course, units) + '\n')
    await writeFile(path.join(dir, 'lesson-sequence.md'), lessonSequence(course, lessons))
    index.push({
      course_id: course.courseId,
      grade: course.grade,
      subject: 'health',
      title: course.title,
      days: course.days,
      description: course.description,
      capstone: course.capstone,
      path: `grade-${course.grade}/courses/health`,
    })
    console.log(`built ${course.courseId}: ${units.length} units, ${lessons.length} lessons, ${assessments.length} assessments`)
  }
  await writeFile(path.join(outDir, 'course-index.json'), JSON.stringify(index, null, 2) + '\n')

  const modDir = path.join(outDir, 'optional-modules')
  await mkdir(modDir, { recursive: true })
  const modules = OPTIONAL_MODULES.map(buildOptionalModule)
  await writeFile(path.join(modDir, 'sex-education.json'), JSON.stringify(modules, null, 2) + '\n')
  console.log(`built ${modules.length} optional guardian-activated module(s), excluded from every course sequence`)
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
