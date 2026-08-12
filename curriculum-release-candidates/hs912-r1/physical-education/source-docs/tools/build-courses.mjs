#!/usr/bin/env node
// Expands course-data.mjs into the canonical Manuel Academy course shape used by
// curriculum-content/manuel-academy/1.0.0/grades/<grade>/courses/<subject>/.
//
// Output goes to ../build/ inside this subject's own tree. This session owns
// curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/**
// and writes nowhere else — importing the build output into the canonical
// package is the release/convergence lane's decision, not this lane's.
//
// Usage: node build-courses.mjs [outDir]

import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COURSES, STANDARD, LEVEL, anchor } from './course-data.mjs'

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_OUT = path.join(path.dirname(TOOLS_DIR), 'build')

// The canonical twelve-day unit arc used by the Grades 5/7/8 PE courses.
const PHASES = [
  'Launch and diagnostic',
  'Concept model A',
  'Guided practice A',
  'Independent application A',
  'Concept model B',
  'Guided practice B',
  'Investigation or close reading',
  'Reteach and varied practice',
  'Performance task build',
  'Synthesis and review',
  'Unit assessment',
  'Correction and reflection',
]

const BASE_ACCESSIBILITY = [
  'Provide readable text plus optional audio or read-aloud support; no voice feature is required.',
  'Chunk directions into one action at a time and show a worked example or model.',
  'Allow typed, handwritten, spoken, drawn, demonstrated, or described responses when the standard permits.',
  'Offer reduced-copying, extended-time, hidden-timer, rest-break, and low-distraction options.',
  'Use captions, alt text, high-contrast print, keyboard access, and text-only fallbacks for media.',
  'Preserve the learning target while adjusting quantity, pacing, intensity, range, equipment, or response mode.',
  'Every movement task has a seated, supported, reduced-range, reduced-pace, and solo version that reaches the same standard.',
]

const BASE_SAFETY = [
  'Use respectful, non-shaming language about bodies, ability, and effort.',
  'Allow a pause, rest, break, or alternate response mode without treating it as failure.',
  'Check space, footwear, surface, weather, and equipment before movement.',
  'Stop for pain, dizziness, breathing difficulty, head impact, or unsafe conditions and tell an adult.',
  'Score skill, strategy, self-management, consistency, and reflection — never body size, weight, weight change, body composition, appearance, or comparison with another person.',
  'Do not require weight, BMI, body-fat, body measurement, fitness-test norms, percentile ranks, calorie counts, or diet goals at any point.',
  'Do not require a photograph, video, or voice recording of the learner as evidence; described, written, and demonstrated-to-one-adult evidence is the intended route.',
  'Do not require performance in front of an audience, a group, or spectators.',
]

const MASTERY_RULE =
  'Do not mark mastery from one session. Use safe participation, skill cues, tactical decisions, self-management, personal progress against the learner’s own stated task, and self-assessment — without body-size scoring; require accurate independent evidence and successful transfer or retrieval on at least two occasions separated by time or setting.'

const pad = (n) => String(n).padStart(2, '0')

const standardsFor = (course, unit) => unit.standards.map((s) => anchor(s, course.level))

// mapping_status is set honestly: the five standard statements were read from
// the official MDE document via search indexing (michigan.gov returns HTTP 403
// to direct fetch), and the LEVEL 1 / LEVEL 2 structure for grades 9-12 is
// confirmed. Per-outcome codes were never legible and are never invented.
const standardsMappingFor = (course, unit) =>
  unit.standards.map((s) => ({
    code: `Standard ${s} / LEVEL ${course.level}`,
    framework: 'Michigan K-12 Physical Education Standards (State Board approved 2017)',
    standard: STANDARD[s],
    level: LEVEL[course.level],
    mapping_status: 'unverified',
    note: 'Standard statement and the grades 9-12 LEVEL 1 / LEVEL 2 structure confirmed against the official MDE source; per-outcome codes were not legible from that source and none is claimed.',
  }))

function buildLesson(course, unit, unitNumber, dayInUnit, courseDay) {
  const focus = unit.topics[(dayInUnit - 1) % unit.topics.length]
  const phase = PHASES[dayInUnit - 1]

  // A 12-day unit carries six topics across two passes. Days 1-6 acquire each
  // topic; days 7-12 revisit the same six under the unit's own transfer
  // condition. The second pass is a separate mastery occasion, not a repeat, so
  // every field below that a learner acts on is written for its own cycle —
  // identical text across the two passes would make the multi-occasion mastery
  // rule a formality.
  const cycle = dayInUnit <= unit.topics.length ? 1 : 2
  const transfer = unit.secondPass

  const objectives =
    cycle === 1
      ? [
          `Perform, adapt, or describe ${focus} safely at an intensity, range, and pace the learner sets.`,
          `Explain the movement, tactical, or training principle behind ${focus} and why it works.`,
          `Self-assess ${focus} against stated criteria and name the next adjustment, without comparing to any other person.`,
        ]
      : [
          `Sustain ${focus} ${transfer}, holding the critical features when conditions stop being ideal.`,
          `Explain what changed about ${focus} under that demand, and which cue or principle held and which broke down first.`,
          `Judge the learner's own ${focus} against the criteria a second time and account for the difference from the first pass.`,
        ]

  const criteria =
    cycle === 1
      ? [
          `The learner completes or fully describes the ${focus} task using a version their body and setting allow.`,
          'The learner gives a cue, principle, tactic, or documented process rather than an unexplained result.',
          'The learner self-assesses against the stated criteria and identifies one next adjustment.',
        ]
      : [
          `The learner holds ${focus} ${transfer}, in whatever version their body and setting allow.`,
          'The learner names what degraded first and why, rather than reporting only whether it worked.',
          'The learner compares this occasion with the earlier one and says what actually changed.',
        ]

  const flow =
    cycle === 1
      ? [
          {
            segment: 'Safety check and warm-up',
            minutes: '6–10',
            teacher_or_tutor_action: `Run the space, surface, footwear, and equipment check, then a learner-led warm-up. Restate the stop rule before any work on ${focus}.`,
          },
          {
            segment: 'Model or mini-lesson',
            minutes: '8–12',
            teacher_or_tutor_action: `Teach the cues, principle, or tactic behind ${focus}. Demonstrate or describe it, name the critical features, and show at least one adapted version alongside the standard version — not after it.`,
          },
          {
            segment: 'Guided practice',
            minutes: '10–18',
            teacher_or_tutor_action: `Practise ${focus} with feedback on cues and decisions only. Feedback addresses the movement or the choice, never the learner's body, size, or appearance. Fade prompting as control improves.`,
          },
          {
            segment: 'Independent application',
            minutes: '12–25',
            teacher_or_tutor_action: `Learner applies ${focus} in a new situation at a self-set intensity and records what they did, what they noticed, and what they would adjust.`,
          },
          {
            segment: 'Cool-down, reflection, and next step',
            minutes: '5–8',
            teacher_or_tutor_action: `Cool down, then in one concise response explain the key idea behind ${focus} and name one adjustment for next session. No recording or photograph is taken.`,
          },
        ]
      : [
          {
            segment: 'Safety check and warm-up',
            minutes: '6–10',
            teacher_or_tutor_action: `Run the space, surface, footwear, and equipment check, then a learner-led warm-up. Restate the stop rule, and name the added demand explicitly before starting: ${focus} ${transfer}.`,
          },
          {
            segment: 'Recall and raise the demand',
            minutes: '8–12',
            teacher_or_tutor_action: `Have the learner restate the critical features of ${focus} from the earlier pass before any demonstration. Then introduce the transfer condition and ask which feature they expect to lose first, and why. Keep the adapted version available on equal terms.`,
          },
          {
            segment: 'Practice under the transfer condition',
            minutes: '10–18',
            teacher_or_tutor_action: `Work ${focus} ${transfer}. Feedback stays on the cue or the decision, never on the learner's body, size, or appearance. Reduce the demand rather than the standard if control breaks down, and say that is the intended response, not a failure.`,
          },
          {
            segment: 'Independent transfer and comparison',
            minutes: '12–25',
            teacher_or_tutor_action: `Learner works ${focus} independently under the condition at a self-set intensity, then records what held, what degraded first, and how this occasion differed from the earlier one.`,
          },
          {
            segment: 'Cool-down, reflection, and next step',
            minutes: '5–8',
            teacher_or_tutor_action: `Cool down, then in one concise response account for the difference between the two occasions of ${focus} and name the adjustment that carries forward. No recording or photograph is taken.`,
          },
        ]

  return {
    schema_version: '1.0',
    lesson_id: `${course.courseId}-u${pad(unitNumber)}-l${pad(dayInUnit)}`,
    course_id: course.courseId,
    grade: course.grade,
    subject: 'physical-education',
    course_day: courseDay,
    unit_number: unitNumber,
    unit_title: unit.title,
    day_in_unit: dayInUnit,
    cycle,
    transfer_condition: cycle === 2 ? transfer : null,
    title: cycle === 1 ? `${phase}: ${focus}` : `${phase}: ${focus} under transfer`,
    phase,
    focus,
    estimated_minutes: '35–60',
    pe_level: course.level,
    standards: standardsFor(course, unit),
    standards_mapping: standardsMappingFor(course, unit),
    essential_question: unit.essentialQuestion,
    learning_objectives: objectives,
    success_criteria: criteria,
    materials: unit.materials,
    lesson_flow: flow,
    student_activity:
      cycle === 1
        ? `Learner applies ${focus} in a new situation at a self-set intensity and records what they did, noticed, and would adjust.`
        : `Learner works ${focus} ${transfer} at a self-set intensity, then records what held, what degraded first, and how this occasion differed from the earlier one.`,
    formative_check:
      cycle === 1
        ? `In one concise response, explain the key idea behind ${focus} and name one adjustment for the next session.`
        : `In one concise response, say which feature of ${focus} degraded first under the added demand, why, and what you would change before the next attempt.`,
    answer_or_scoring_guidance:
      'Score safe participation, skill cues, tactical reasoning, self-management, and revision. Accept any version of the task the learner’s body and setting allow as full credit. Never score body size, weight, body composition, appearance, speed alone, or comparison with another person.',
    adaptive_tutor_routes: [
      { signal: 'prerequisite gap', action: `Return to the simplest version of ${focus} — slower, smaller range, closer target, or seated — then rebuild.` },
      { signal: 'procedure without understanding', action: `Ask the learner to explain the cue or tactic behind ${focus} before adding intensity or complexity.` },
      { signal: 'correct but low confidence', action: `Confirm the specific cue that worked, offer one varied application of ${focus}, and avoid unnecessary remediation.` },
      { signal: 'repeated error pattern', action: 'Name the observable movement pattern neutrally, contrast it with the critical features, and schedule varied practice.' },
      { signal: 'pain, dizziness, breathlessness, or head impact', action: 'Stop immediately, tell an adult, and do not resume in this session. This is never recorded as a failed attempt.' },
      { signal: 'learner declines a task', action: `Offer the adapted, seated, solo, or described version of ${focus}; the alternate route is full credit and is not logged as a refusal.` },
      ...(cycle === 2
        ? [{ signal: 'transfer condition is too much today', action: `Drop back to the first-pass version of ${focus} for this session and re-attempt the added demand on a later occasion. Reducing the demand is the correct response and is scored as full participation.` }]
        : []),
      { signal: 'mastery evidence', action: `Require accurate independent performance or description plus explanation on a later occasion or in a different setting before marking ${focus} mastered.` },
    ],
    mastery_rule: MASTERY_RULE,
    extension:
      cycle === 1
        ? `Apply ${focus} under a new constraint, in a different activity, or teach the cue to someone else — without completing another learner's graded work.`
        : `Design the next progression of ${focus} yourself, or coach the transfer condition to someone else so that they succeed with it — without completing another learner's graded work.`,
    accessibility_and_accommodations: [...BASE_ACCESSIBILITY, unit.adapted],
    safety_and_privacy: [...BASE_SAFETY, unit.inclusion],
    inclusive_adaptation: unit.adapted,
    guardian_safety: unit.guardian,
    media: {
      suggestion: `Optional diagram, described demonstration, or short clip supporting ${focus}.`,
      required: false,
      fallback: 'Provide the same information as readable steps, cue lists, alt text, a transcript, or an adult demonstration. No lesson requires media, and no learner media is ever produced.',
    },
    parent_or_guardian_visibility:
      'Share the lesson target, completion state, evidence type, and next instructional step. Do not expose body data, fitness scores, photographs, video, recordings, or comparisons with other learners. For safety-critical units, record only the guardian confirmation that was required.',
    home_connection:
      cycle === 1
        ? `Invite the learner to notice or try one safe, optional example of ${focus} in daily life. No purchase, account creation, photograph, recording, or public performance is required.`
        : `Invite the learner to notice where ${focus} shows up outside the session under real conditions. No purchase, account creation, photograph, recording, or public performance is required.`,
  }
}

function buildAssessment(course, unit, unitNumber) {
  return {
    assessment_id: `${course.courseId}-u${pad(unitNumber)}-assessment`,
    unit_number: unitNumber,
    unit_title: unit.title,
    standards: standardsFor(course, unit),
    total_points: 38,
    prompts: [
      { type: 'concept and cues', prompt: `Explain the critical features or key principle of ${unit.topics[0]} in your own words.`, points: 4 },
      { type: 'demonstration or description', prompt: `Demonstrate or fully describe ${unit.topics[1]} using a version your body and setting allow. A described or adapted version earns full credit.`, points: 5 },
      { type: 'application', prompt: `Apply ${unit.topics[2]} in a new situation and explain the decision or adjustment you made.`, points: 6 },
      { type: 'analysis or correction', prompt: `Analyze a plausible technique fault, tactical error, or unsafe choice involving ${unit.topics[3]}; correct it and explain why.`, points: 6 },
      { type: 'connection', prompt: `Connect ${unit.topics[4]} with ${unit.topics[5]} and explain how one affects the other.`, points: 5 },
      { type: 'performance evidence', prompt: `Present the strongest evidence from the unit task: ${unit.performanceTask}`, points: 8 },
      { type: 'reflection and transfer', prompt: 'Identify one thing you can now do or direct yourself, one adjustment that improved it, and one next goal you set for yourself.', points: 4 },
    ],
    mastery_interpretation: {
      secure: 'At least 85% with safe, independent application and adequate explanation of cues, tactics, or training reasoning.',
      developing: '70–84% or inconsistent explanation; assign varied practice and a fresh transfer check on a later occasion.',
      not_yet: 'Below 70% or a missing prerequisite; reteach the simplest version and reassess with new evidence.',
      rule: 'A unit score is one evidence source on one occasion, not the sole basis for long-term mastery. Never adjust a score for body size, weight, or appearance.',
    },
    rubric_dimensions: ['safe participation and self-management', 'skill cues or movement quality', 'tactical or training reasoning', 'self-assessment and revision'],
    accommodation_note:
      'Access supports may change format, pacing, intensity, range, equipment, setting, or response mode without changing the standard being assessed. An adapted or described performance is full credit, not partial credit.',
    inclusion_note: unit.inclusion,
  }
}

function buildUnitRecord(course, unit, unitNumber, lessons) {
  return {
    unit_id: `${course.courseId}-u${pad(unitNumber)}`,
    course_id: course.courseId,
    grade: course.grade,
    subject: 'physical-education',
    unit_number: unitNumber,
    title: unit.title,
    days: 12,
    pe_level: course.level,
    standards: standardsFor(course, unit),
    standards_mapping: standardsMappingFor(course, unit),
    essential_question: unit.essentialQuestion,
    topics: unit.topics,
    performance_task: unit.performanceTask,
    materials: unit.materials,
    inclusive_adaptation: unit.adapted,
    inclusion_guard: unit.inclusion,
    guardian_safety: unit.guardian,
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
    `**Michigan PE level:** LEVEL ${course.level}  `,
    `**Instructional days:** ${course.days} (9 units × 12 days)  `,
    `**Standards framework:** Michigan K-12 Physical Education Standards (2017), grades 9-12 LEVEL ${course.level}`,
    '',
    course.description,
    '',
    '## Where this sits in the 9-12 arc',
    '',
    course.focusStatement,
    '',
    '## Capstone',
    '',
    course.capstone,
    '',
    '## Participation floor',
    '',
    'Nothing in this course scores body size, weight, weight change, body composition, or appearance. No fitness-test norm table, percentile, or peer comparison is used. No photograph, video, or voice recording of the learner is required or accepted as a requirement. No task requires performing in front of an audience. Every unit carries an inclusive adaptation that reaches the same standard by another route, and an adapted or described performance is full credit rather than partial credit.',
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
    lines.push(`- **Inclusion guard:** ${u.inclusion_guard}`)
    lines.push('')
    lines.push('**Guardian safety notice**')
    lines.push('')
    lines.push('| Equipment | Environment | Movement hazards | Supervision | Guardian confirmation |')
    lines.push('| --- | --- | --- | --- | --- |')
    lines.push(
      `| ${u.guardian_safety.equipment} | ${u.guardian_safety.environment} | ${u.guardian_safety.movement_hazards} | ${u.guardian_safety.supervision_note} | ${u.guardian_safety.guardian_confirmation_required ? 'Required' : 'Not required'} |`,
    )
    lines.push('')
  }
  return lines.join('\n')
}

function lessonSequence(course, lessons) {
  const lines = [`# ${course.title} — Lesson Sequence`, '', `${course.days} instructional days (Michigan PE LEVEL ${course.level}).`, '', '| Day | Unit | Day in unit | Phase | Focus |', '| --- | --- | --- | --- | --- |']
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
    for (let day = 1; day <= 12; day += 1) {
      unitLessons.push(buildLesson(course, unit, unitNumber, day, courseDay))
      courseDay += 1
    }
    units.push(buildUnitRecord(course, unit, unitNumber, unitLessons))
    assessments.push(buildAssessment(course, unit, unitNumber))
    lessons.push(...unitLessons)
  })
  return { units, lessons, assessments }
}

async function main() {
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT
  await rm(outDir, { recursive: true, force: true })
  const index = []
  for (const course of COURSES) {
    const { units, lessons, assessments } = buildCourse(course)
    const dir = path.join(outDir, `grade-${course.grade}`, 'courses', 'physical-education')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'units.json'), JSON.stringify(units, null, 2) + '\n')
    await writeFile(path.join(dir, 'lessons.jsonl'), lessons.map((l) => JSON.stringify(l)).join('\n') + '\n')
    await writeFile(path.join(dir, 'assessments.json'), JSON.stringify(assessments, null, 2) + '\n')
    await writeFile(path.join(dir, 'course-guide.md'), courseGuide(course, units) + '\n')
    await writeFile(path.join(dir, 'lesson-sequence.md'), lessonSequence(course, lessons))
    index.push({
      course_id: course.courseId,
      grade: course.grade,
      subject: 'physical-education',
      title: course.title,
      days: course.days,
      pe_level: course.level,
      description: course.description,
      capstone: course.capstone,
      path: `grade-${course.grade}/courses/physical-education`,
    })
    console.log(`built ${course.courseId} (LEVEL ${course.level}): ${units.length} units, ${lessons.length} lessons, ${assessments.length} assessments`)
  }
  await writeFile(path.join(outDir, 'course-index.json'), JSON.stringify(index, null, 2) + '\n')
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
