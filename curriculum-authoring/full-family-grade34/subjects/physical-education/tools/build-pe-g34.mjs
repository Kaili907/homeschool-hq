// G34-M5 — deterministic generator for Grade 3 and Grade 4 Physical Education.
//
// Emits the same course contract the published release uses, plus a per-course
// 36-week schedule, a standards map, and validation. Re-running with unchanged
// data reproduces byte-identical output.
//
// Run:  node build-pe-g34.mjs          (write)
//       node build-pe-g34.mjs --check  (validate only, no writes)
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COURSES, PE } from './course-data.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SUBJECT_ROOT = join(HERE, '..')
const CHECK_ONLY = process.argv.includes('--check')

const WEEKS = 36
const SESSIONS_PER_WEEK = 3
const DAY_SUGGESTIONS = ['Monday', 'Wednesday', 'Friday']
const UNITS_PER_COURSE = 9
const DAYS_PER_UNIT = 12
const MINUTES = '30-50'

// Same twelve-session arc the published Grade 5/7/8 PE courses use, so families
// moving between grades meet the same weekly shape.
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

const PHASE_OBJECTIVE = {
  'Launch and diagnostic': (f) => `Surface current control and understanding of ${f}, without scoring or comparison, and establish the unit question.`,
  'Concept model A': (f) => `Learn the movement cues for ${f} from an explicit demonstration and a described breakdown.`,
  'Guided practice A': (f) => `Practice ${f} with cues, feedback, and gradually reduced support.`,
  'Independent application A': (f) => `Apply ${f} independently in a new movement task and name the cue that helped.`,
  'Concept model B': (f) => `Extend the model for ${f} to a harder or different condition.`,
  'Guided practice B': (f) => `Practice ${f} under a varied condition with feedback focused on control rather than outcome.`,
  'Investigation or close reading': (f) => `Investigate why the cues for ${f} work, using observation, a diagram, or an accessible text.`,
  'Reteach and varied practice': (f) => `Reteach the weakest cue for ${f} and practice it in at least two different ways.`,
  'Performance task build': (f) => `Build the unit performance task, using ${f} as one of its components.`,
  'Synthesis and review': (f) => `Connect ${f} to the other skills in the unit and review the whole set.`,
  'Unit assessment': (f) => `Demonstrate current competency and understanding, including ${f}, through applied evidence and explanation.`,
  'Correction and reflection': (f) => `Correct the cue or decision that caused difficulty with ${f} and reflect on where it transfers.`,
}

const SAFETY_AND_PRIVACY = [
  'Use respectful, non-shaming language about bodies, ability, size, speed, and coordination.',
  'Never require or record body weight, height, BMI, body-fat percentage, or any body measurement.',
  'Never require a fitness test, a timed trial, a repetition count, a distance score, or any ranking of one learner against another.',
  'Never require a photograph, video, or any recording of the learner as proof of participation or performance.',
  'Never require a public performance, an audience, or a demonstration in front of peers; sharing is always the learner choice.',
  'Progress is compared only against the learner own earlier work, and only when the learner chooses to track it.',
  'Allow rest, a break, an adapted path, or an opt-out at any point without treating it as failure.',
  'Stop activity and seek a trusted adult or qualified professional for pain, dizziness, breathing difficulty, or injury; this course is not medical advice.',
]

const ACCESSIBILITY = [
  'Provide readable text plus optional audio or read-aloud support; no voice feature is required.',
  'Chunk directions into one action at a time and show or describe a model before practice.',
  'Allow demonstrated, described, drawn, spoken, signed, or written evidence; the response mode is never the standard being assessed.',
  'Offer reduced-repetition, extended-time, hidden-timer, rest-break, and low-stimulation options.',
  'Use captions, alt text, high-contrast print, keyboard access, and text-only fallbacks for any media.',
  'Preserve the movement target while adjusting equipment, distance, speed, force, duration, or support.',
]

const MASTERY_RULE =
  'Do not mark mastery from one attempt. Use observed control, cue use, decision-making, explanation, and applied performance; require accurate independent evidence and successful transfer on at least two separate occasions. Mastery is never determined by speed, distance, repetition count, body measurement, or comparison with another learner.'

const GUARDIAN_VISIBILITY =
  'Share the lesson target, completion state, evidence type, the guardian safety confirmation for equipment and environment, and the next instructional step. Do not expose recordings, images, body data, or health information. Study records completion and progress metadata only; it does not perform or persist physical measurement or fitness tracking.'

const tutorRoutes = (f) => [
  { signal: 'prerequisite gap', action: `Return to the simplest version of ${f} — slower, closer, larger, or supported — then retry one fresh attempt.` },
  { signal: 'procedure without understanding', action: `Ask the learner to name the cue for ${f} and say why it works before continuing.` },
  { signal: 'correct but low confidence', action: `Confirm the specific cue the learner executed well for ${f}, offer one varied condition, and avoid unnecessary remediation.` },
  { signal: 'repeated error pattern', action: `Name the observable movement pattern neutrally, never as a comment on the learner body, effort, or character, contrast it with a demonstration, and schedule short varied practice.` },
  { signal: 'mastery evidence', action: `Require controlled independent performance of ${f} plus an explanation on a later or different occasion before marking it mastered.` },
]

const PHASE_PRACTICE = {
  'Launch and diagnostic': (t) => `explores ${t.name} freely so the facilitator can see what they already control, with no correction and no scoring`,
  'Concept model A': (t) => `tries ${t.name} slowly and in isolation, pausing after each attempt to name the cue they used`,
  'Guided practice A': (t) => `repeats ${t.name} with the facilitator prompting one cue at a time, then fading the prompt`,
  'Independent application A': (t) => `uses ${t.name} in a simple self-directed task with no prompting, then reports which cue carried it`,
  'Concept model B': (t) => `sees ${t.name} demonstrated again with one element changed (speed, level, direction, or object), and names what changed`,
  'Guided practice B': (t) => `practises ${t.name} with that changed element, supported by prompts that fade across attempts`,
  'Investigation or close reading': (t) => `investigates why the cues for ${t.name} work, testing one cue deliberately with and without it and describing the difference`,
  'Reteach and varied practice': (t) => `reteaches the cue that slipped, then practises ${t.name} across at least two different set-ups`,
  'Performance task build': (t) => `builds their portion of the unit performance task using ${t.name}, and justifies each choice`,
  'Synthesis and review': (t) => `combines ${t.name} with an earlier skill from the unit and explains how the cues interact`,
  'Unit assessment': (t) => `demonstrates ${t.name} independently as unit evidence, at a self-selected challenge level`,
  'Correction and reflection': (t) => `corrects one specific cue in ${t.name}, re-attempts it, and names where this skill transfers`,
}

const PHASE_COOLDOWN = {
  'Launch and diagnostic': (t) => `names one thing about ${t.name} that already felt comfortable and one that felt new`,
  'Concept model A': (t) => `restates the cues for ${t.name} in their own words`,
  'Guided practice A': (t) => `names which cue for ${t.name} needed the most prompting`,
  'Independent application A': (t) => `names the cue that carried ${t.name} without any prompting`,
  'Concept model B': (t) => `describes what changed when one element of ${t.name} was varied`,
  'Guided practice B': (t) => `names which cue mattered more once ${t.name} got harder`,
  'Investigation or close reading': (t) => `explains why one cue for ${t.name} works, using what they tested`,
  'Reteach and varied practice': (t) => `names the cue they reteached and what changed in ${t.name} afterwards`,
  'Performance task build': (t) => `explains one choice they made in the performance task and the reason behind it`,
  'Synthesis and review': (t) => `explains how ${t.name} connects to another skill in this unit`,
  'Unit assessment': (t) => `names the cue they relied on most during ${t.name} today`,
  'Correction and reflection': (t) => `names the correction they made to ${t.name} and one other activity it would help in`,
}

const lessonFlow = (t, phase) => [
  { segment: 'Safety and area check', minutes: '3-5', teacher_or_tutor_action: 'Confirm the space, surface, footwear, and equipment are safe, review the boundaries, and confirm the guardian safety review for this unit before any movement begins.' },
  { segment: 'Warm-up and readiness', minutes: '5-8', teacher_or_tutor_action: `Lead a gradual warm-up that prepares the body for ${t.name}. The learner sets their own intensity and may rest at any point.` },
  { segment: 'Model and cues', minutes: '5-8', teacher_or_tutor_action: `Demonstrate or describe ${t.name} and teach these cues explicitly, checking each before moving on:\n${t.cues.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}` },
  { segment: 'Practice and application', minutes: '12-20', teacher_or_tutor_action: `The learner ${PHASE_PRACTICE[phase](t)}, at a self-selected challenge level and using the adapted alternative whenever it fits better. Watch for the common error: ${t.common_error} Feedback names the cue, never the learner body or ability.` },
  { segment: 'Cool-down and reflection', minutes: '4-8', teacher_or_tutor_action: `Cool down, then the learner ${PHASE_COOLDOWN[phase](t)}, and names one thing to adjust next time. No score, time, count, or measurement is recorded.` },
]

function buildCourse(course) {
  const { grade, courseId, units: unitData } = course
  const units = []
  const lessons = []
  const assessments = []
  let courseDay = 0

  unitData.forEach((u, ui) => {
    const unitNumber = ui + 1
    const nn = String(unitNumber).padStart(2, '0')
    const unitId = `${courseId}-u${nn}`
    const lessonIds = []

    for (let d = 1; d <= DAYS_PER_UNIT; d++) {
      courseDay += 1
      const phase = PHASES[d - 1]
      const t = u.topics[(d - 1) % u.topics.length]
      const focus = t.name
      const lessonId = `${unitId}-l${String(d).padStart(2, '0')}`
      lessonIds.push(lessonId)

      lessons.push({
        schema_version: '1.0',
        lesson_id: lessonId,
        course_id: courseId,
        grade,
        subject: 'physical-education',
        course_day: courseDay,
        unit_number: unitNumber,
        unit_title: u.title,
        day_in_unit: d,
        title: `${phase}: ${focus}`,
        phase,
        focus,
        estimated_minutes: MINUTES,
        standards: u.standards,
        essential_question: u.essentialQuestion,
        learning_objectives: [
          PHASE_OBJECTIVE[phase](focus),
          `Use the movement cues for ${focus} and explain or show why they work.`,
          `Adjust the task, equipment, or support for ${focus} so it is safe and achievable, and describe the adjustment.`,
        ],
        success_criteria: [
          `The learner takes part in the task about ${focus} at a self-selected challenge level.`,
          `The learner uses or names the movement cues for ${focus}.`,
          'The learner identifies one adjustment or next step. No score, time, count, or measurement is required.',
        ],
        materials: ['open, cleared movement space', 'water available throughout', 'unit equipment listed in the guardian safety review'],
        cues: t.cues,
        common_error: t.common_error,
        lesson_flow: lessonFlow(t, phase),
        student_activity: `The learner practises ${focus} at a self-selected challenge level, using the adapted alternative whenever it fits better, and names the cue that helped.`,
        formative_check: `The learner names one cue that helped with ${focus} and one adjustment for next time, by demonstrating, describing, drawing, or writing.`,
        answer_or_scoring_guidance:
          'Score cue use, control, decision-making, and explanation. Never score speed, distance, repetitions, body measurement, or comparison with another learner. Choosing the adapted path, a rest, or an opt-out is never scored as a deficit. Never infer effort, character, or ability from a movement outcome.',
        adaptive_tutor_routes: tutorRoutes(focus),
        mastery_rule: MASTERY_RULE,
        extension: `Apply ${focus} under one new condition of the learner choosing — different equipment, space, speed, or partner — and describe what changed.`,
        accessibility_and_accommodations: ACCESSIBILITY,
        adapted_alternative: u.adapted,
        safety_and_privacy: SAFETY_AND_PRIVACY,
        guardian_safety_review: u.guardian,
        media: {
          suggestion: `Optional diagram, cue card, or adult demonstration supporting ${focus}.`,
          required: false,
          fallback: 'Provide the same information as readable cue steps, alt text, a transcript, or a live adult demonstration. No recording of the learner is made.',
        },
        parent_or_guardian_visibility: GUARDIAN_VISIBILITY,
        home_connection: `Invite the learner to enjoy one safe, optional activity that practises ${focus}. No purchase, account creation, recording, measurement, or public performance is required.`,
      })
    }

    units.push({
      unit_id: unitId,
      course_id: courseId,
      grade,
      subject: 'physical-education',
      unit_number: unitNumber,
      title: u.title,
      days: DAYS_PER_UNIT,
      standards: u.standards,
      essential_question: u.essentialQuestion,
      topics: u.topics.map((x) => x.name),
      topic_content: u.topics,
      performance_task: u.performanceTask,
      adapted_alternative: u.adapted,
      guardian_safety_review: u.guardian,
      lesson_ids: lessonIds,
      assessment_id: `${unitId}-assessment`,
    })

    assessments.push({
      assessment_id: `${unitId}-assessment`,
      unit_number: unitNumber,
      unit_title: u.title,
      standards: u.standards,
      total_points: 38,
      prompts: [
        { type: 'cue and vocabulary', prompt: `Name the movement cues for ${u.topics[0].name} and explain what each one does.`, points: 4 },
        { type: 'demonstration or representation', prompt: `Show, describe, or diagram ${u.topics[1].name}. A demonstration, a spoken description, and a drawing are equally valid.`, points: 5 },
        { type: 'application', prompt: `Apply ${u.topics[2].name} in a new movement task at a challenge level you select. Control and cue use are assessed, not speed, distance, or count.`, points: 6 },
        { type: 'error or decision analysis', prompt: `A made-up learner is struggling with ${u.topics[3].name}. Identify the likely cue or decision at fault, correct it, and explain why the correction helps.`, points: 6 },
        { type: 'connection', prompt: `Connect ${u.topics[0].name} with ${u.topics[5].name}. Explain how one supports the other.`, points: 5 },
        { type: 'performance evidence', prompt: `Present the strongest evidence from the unit task: ${u.performanceTask}`, points: 8 },
        { type: 'adaptation and choice', prompt: 'Describe one way you adapted a task so it worked for you, and one activity from this unit you would choose to do again. There is no wrong answer here.', points: 4 },
      ],
      mastery_interpretation: {
        secure: 'At least 85% with controlled independent application, accurate cue use, and adequate explanation.',
        developing: '70-84% or inconsistent cue use; assign targeted varied practice and a fresh transfer check.',
        not_yet: 'Below 70% or a missing prerequisite movement; reteach the simplest version and reassess with new evidence.',
        rule: 'A unit score is one evidence source, not the sole basis for long-term mastery. No part of this score may derive from speed, distance, repetition count, body measurement, or comparison with another learner.',
      },
      rubric_dimensions: ['cue use and control', 'movement concepts and decisions', 'application or performance', 'responsibility, safety, and inclusion'],
      accommodation_note:
        'Access supports may change equipment, distance, speed, force, duration, setting, or response mode without changing the standard being assessed. Using the adapted alternative is a full-credit path, never a reduced one.',
    })
  })

  return { units, lessons, assessments }
}

// ---------- renderers ----------

const scheduleCsv = (lessons) => {
  const rows = ['week,session_in_week,day_suggestion,course_day,unit_number,day_in_unit,lesson_id']
  lessons.forEach((l, i) => {
    const week = Math.floor(i / SESSIONS_PER_WEEK) + 1
    const session = (i % SESSIONS_PER_WEEK) + 1
    rows.push([week, session, DAY_SUGGESTIONS[i % SESSIONS_PER_WEEK], l.course_day, l.unit_number, l.day_in_unit, l.lesson_id].join(','))
  })
  return rows.join('\n') + '\n'
}

const courseGuide = (course, units) => {
  const rows = units
    .map((u) => `| ${u.unit_number} | ${u.title} | ${u.days} | ${u.standards.map((s) => s.match(/Standard (\d)/)[1]).join(', ')} | ${u.performance_task} |`)
    .join('\n')
  return `# ${course.title} — Course Guide

**Course ID:** \`${course.courseId}\`
**Subject:** physical-education
**Instructional sessions:** ${WEEKS * SESSIONS_PER_WEEK}
**Schedule:** ${WEEKS} weeks x ${SESSIONS_PER_WEEK} sessions per week (suggested days: ${DAY_SUGGESTIONS.join(', ')})
**Typical session:** ${MINUTES} minutes
**Cadence:** three times weekly

## Course description

${course.description}

## Standards alignment

This course is aligned to the **Michigan K-12 Physical Education Standards** (Michigan State Board of Education, approved May 2017), which carry five standards:

| # | Standard |
| --- | --- |
| 1 | Demonstrates competency in a variety of motor skills and movement patterns. |
| 2 | Applies knowledge of concepts, principles, strategies and tactics related to movement and physical activities. |
| 3 | Demonstrates the knowledge and skills to achieve and maintain a health-enhanced level of physical fitness. |
| 4 | Exhibits responsible personal and social behavior that respects self and others. |
| 5 | Recognizes the value of physical activity for health, enjoyment, challenge, self-expression and/or other benefits. |

Local unit order, lesson design, equipment choices, and activities are curricular decisions. See \`../standards-map.md\` for the full mapping and the official source.

This is locally authored curriculum aligned to published standards. It is not a claim of state approval, accreditation, licensure, or automatic credit.

## Private-safe and body-safe rules

This course never requires, collects, scores, or stores:

- body weight, height, BMI, body-fat percentage, or any body measurement;
- a fitness test, timed trial, repetition count, distance score, or ranking between learners;
- a photograph, video, or any recording of the learner as proof of participation or performance;
- a public performance, an audience, or a demonstration in front of peers.

Progress is compared only against the learner own earlier work, and only when the learner chooses to track it. Study records completion and progress metadata only; it performs no physical measurement and no fitness tracking.

## Inclusion and adapted alternatives

Every unit carries an \`adapted_alternative\` that is repeated on all ${DAYS_PER_UNIT} of its lessons. These are movement-specific, not generic: each names the concrete seated, supported, reduced-range, slower, larger-object, or role-based path that reaches the same standard. Using an adapted alternative is a full-credit path, never a reduced one, and any rule may be changed to include a learner rather than excluding them.

## Course outcomes

By the end of the course, learners will:

1. Demonstrate competency in the motor skills and movement patterns above, at a self-selected challenge level.
2. Apply movement concepts, strategies, and tactics, and explain the decisions behind them.
3. Understand health-related fitness and judge their own effort without measurement or comparison.
4. Exhibit responsible, safe, inclusive behavior toward themselves and others.
5. Identify activity they value and will keep doing, and complete the capstone: **${course.capstone}**

## Instructional model

Each unit runs a twelve-session arc: launch and diagnostic; concept model A; guided practice A; independent application A; concept model B; guided practice B; investigation; reteach and varied practice; performance task build; synthesis and review; unit assessment; correction and reflection. Every session opens with a safety and area check and closes with a cool-down.

## Mastery and grading

- One attempt never establishes mastery.
- No part of any score may derive from speed, distance, repetition count, body measurement, or comparison with another learner.
- Suggested reporting: **Secure**, **Developing**, or **Not Yet**, supported by observed cue use and explanation.
- Approved breaks, rest, adapted paths, and opt-outs are never failures and are never scored as deficits.
- Guardian summaries show target, completion, evidence type, safety confirmations, and next step. They exclude recordings, images, body data, and health information.

## Scope and sequence

| Unit | Title | Sessions | Standards | Performance task |
| --- | --- | --- | --- | --- |
${rows}

## Guardian safety review

Every unit carries a \`guardian_safety_review\` block on the unit and on all ${DAYS_PER_UNIT} of its lessons, covering equipment, environment, movement hazards, and any food or allergen note. All ${units.length} units require explicit guardian confirmation of the space and equipment before activity begins, and each session opens with a safety and area check.

## Files

| File | Contents |
| --- | --- |
| \`units.json\` | Unit specifications, standards, topics, performance tasks, adapted alternatives, guardian safety review |
| \`lessons.jsonl\` | One JSON object per lesson, in course-day order |
| \`assessments.json\` | Unit assessment sets, rubrics, and mastery interpretation |
| \`lesson-sequence.md\` | Human-readable full lesson sequence |
| \`schedule.csv\` | ${WEEKS}-week schedule with exact lesson coverage |
| \`course-guide.md\` | This file |

## Capstone

${course.capstone}
`
}

const lessonSequence = (course, units, lessons) => {
  let md = `# ${course.title} — Complete Lesson Sequence\n\n**Sessions:** ${lessons.length}\n**Schedule:** ${WEEKS} weeks x ${SESSIONS_PER_WEEK} sessions per week\n`
  for (const u of units) {
    md += `\n## Unit ${u.unit_number}: ${u.title}\n\n**Unit ID:** \`${u.unit_id}\`\n**Standards:** ${u.standards.join('; ')}\n**Essential question:** ${u.essential_question}\n**Performance task:** ${u.performance_task}\n**Adapted alternative:** ${u.adapted_alternative}\n**Guardian safety review:** equipment — ${u.guardian_safety_review.equipment} Environment — ${u.guardian_safety_review.environment} Hazards — ${u.guardian_safety_review.movement_hazards}\n`
    for (const l of lessons.filter((x) => x.unit_number === u.unit_number)) {
      md += `\n### Session ${l.course_day} (Unit day ${l.day_in_unit}) — ${l.title}\n**Lesson ID:** \`${l.lesson_id}\`\n**Phase:** ${l.phase}\n**Focus:** ${l.focus}\n**Objective:** ${l.learning_objectives[0]}\n\n**Student activity:** ${l.student_activity}\n\n**Exit ticket:** ${l.formative_check}\n`
    }
    md += `\n**Unit assessment:** \`${u.assessment_id}\`\n`
  }
  return md
}

const standardsMap = (built) => {
  let md = `# Grade 3-4 Physical Education — Standards Map

**Framework:** Michigan K-12 Physical Education Standards
**Approved:** Michigan State Board of Education, May 2017
**Alignment status:** Locally authored curriculum aligned to published standards. Not a claim of state approval, accreditation, licensure, or automatic credit.

## The five standards

| # | Standard |
| --- | --- |
| 1 | Demonstrates competency in a variety of motor skills and movement patterns. |
| 2 | Applies knowledge of concepts, principles, strategies and tactics related to movement and physical activities. |
| 3 | Demonstrates the knowledge and skills to achieve and maintain a health-enhanced level of physical fitness. |
| 4 | Exhibits responsible personal and social behavior that respects self and others. |
| 5 | Recognizes the value of physical activity for health, enjoyment, challenge, self-expression and/or other benefits. |

## Anchor encoding note

The published Grade 5, 7, and 8 physical education courses encode these standards as \`["Michigan PE Standards 1", "2", "4"]\`, where standards 2-5 appear as bare numeric strings. The v2 authoring compatibility importer classifies those bare labels \`CONTENT_CORRECTION_REQUIRED\` because no canonical identifier can be inferred from them. These Grade 3-4 courses write each anchor as a complete, self-describing label instead, so no correction pass is needed at import.

## Elementary movement content

Unit content follows the movement concepts and locomotor vocabulary named in the standards themselves: self-space and general space; directions; levels; pathways; and the locomotor set walk, run, leap, jump, skip, hop, gallop, slide, chase, flee, and dodge. Grade 3 establishes each pattern in stable conditions; Grade 4 combines patterns and applies them in dynamic space and under light pressure.

`
  for (const { course, units } of built) {
    md += `\n## ${course.title} (\`${course.courseId}\`)\n\n| Unit | Title | Standards |\n| --- | --- | --- |\n`
    for (const u of units) {
      md += `| ${u.unit_number} | ${u.title} | ${u.standards.map((s) => s.match(/Standard (\d)/)[1]).join(', ')} |\n`
    }
    const covered = new Set()
    for (const u of units) for (const s of u.standards) covered.add(s.match(/Standard (\d)/)[1])
    md += `\n**Standard coverage:** ${[...covered].sort().join(', ')} of 1-5 (all five standards covered).\n`
  }

  md += `\n## What these courses deliberately do not assess

Michigan Standard 3 concerns health-enhancing fitness. These courses teach fitness *knowledge* and *self-judged effort*, and deliberately do not use fitness testing, timed trials, repetition scoring, distance scoring, ranking, or any body measurement as evidence. That is a Manuel Academy private-safe decision layered on top of the standard, not a gap in coverage: Standard 3 is evidenced through explanation, planning, and self-selected participation instead.

## Official sources

| Source | Official URL |
| --- | --- |
| Michigan Academic Standards | https://www.michigan.gov/mde/services/academic-standards |
| Michigan K-12 Physical Education Standards (May 2017) | https://www.michigan.gov/mde/-/media/Project/Websites/mde/2019/02/22/K_12_PE_Standards_Aug_17_ADA_compliance918.pdf |
| State Board approval item, K-12 Physical Education Standards | https://www.michigan.gov/-/media/Project/Websites/mde/2017/08/31/Item_N_K-12_Physical_Education_Standards.pdf |
`
  return md
}

// ---------- validation ----------

function validate(built) {
  const errors = []
  const BANNED = [
    /\bBMI\b/i, /body[- ]fat/i, /\bcalorie/i, /weigh-?in/i, /weight[- ]loss/i,
    /\bfitness test/i, /\bpacer test/i, /\btimed trial/i, /\bmile time/i,
    /\brepetition count/i, /\bdistance score/i,
  ]
  const NEGATED = /\b(no|not|never|without|nor|neither|refus|exclud|prohibit|instead of|rather than|optional)/i
  const MEDIA_PRODUCE = /\b(take|takes|taking|record|records|film|films|upload|uploads|submit|submits|post|posts|send|sends|capture|captures)\s+(?:a\s+|an\s+|the\s+|your\s+)?(photo|photograph|video|recording|image)/i
  const MEDIA_OF_LEARNER = /(photo|photograph|video|recording|image)[^.]{0,40}\bof\s+(you|yourself|your|the learner)/i
  const PUBLIC_PERF = /\baudience\b|public performance|in front of (?:the )?(?:class|peers|others|everyone)/i

  const sentences = (text) => String(text).split(/(?<=[.!?])\s+|\n/)
  const scan = (label, text) => {
    for (const sentence of sentences(text)) {
      if (NEGATED.test(sentence)) continue
      for (const re of BANNED) if (re.test(sentence)) errors.push(`${label}: unnegated body-metric term ${re} -> ${sentence.slice(0, 90)}`)
      if (MEDIA_PRODUCE.test(sentence) || MEDIA_OF_LEARNER.test(sentence)) errors.push(`${label}: media requirement -> ${sentence.slice(0, 90)}`)
      if (PUBLIC_PERF.test(sentence)) errors.push(`${label}: public-performance requirement -> ${sentence.slice(0, 90)}`)
    }
  }

  const allIds = new Set()

  for (const { course, units, lessons, assessments } of built) {
    const label = course.courseId
    if (lessons.length !== WEEKS * SESSIONS_PER_WEEK) errors.push(`${label}: ${lessons.length} lessons != ${WEEKS * SESSIONS_PER_WEEK}`)
    if (units.length !== UNITS_PER_COURSE) errors.push(`${label}: ${units.length} units != ${UNITS_PER_COURSE}`)
    if (assessments.length !== UNITS_PER_COURSE) errors.push(`${label}: ${assessments.length} assessments != ${UNITS_PER_COURSE}`)
    scan(`${label} description`, course.description)
    scan(`${label} capstone`, course.capstone)

    lessons.forEach((l, i) => {
      if (l.course_day !== i + 1) errors.push(`${l.lesson_id}: course_day ${l.course_day} != ${i + 1}`)
      if (allIds.has(l.lesson_id)) errors.push(`duplicate lesson_id ${l.lesson_id}`)
      allIds.add(l.lesson_id)
      for (const f of ['lesson_id', 'course_id', 'grade', 'subject', 'course_day', 'unit_number', 'day_in_unit', 'title', 'standards'])
        if (l[f] === undefined || l[f] === null) errors.push(`${l.lesson_id}: missing Study field ${f}`)
      if (!l.adapted_alternative) errors.push(`${l.lesson_id}: missing adapted_alternative`)
      if (!l.guardian_safety_review) errors.push(`${l.lesson_id}: missing guardian_safety_review`)
      if (!Array.isArray(l.cues) || l.cues.length < 3) errors.push(`${l.lesson_id}: fewer than 3 taught cues`)
      if (!l.common_error) errors.push(`${l.lesson_id}: missing common_error`)
      if (l.media.required !== false) errors.push(`${l.lesson_id}: media must never be required`)
      for (const st of l.standards) if (!/^Michigan PE Standard [1-5]: /.test(st)) errors.push(`${l.lesson_id}: non-canonical standard label "${st}"`)
      scan(l.lesson_id, JSON.stringify({ ...l, safety_and_privacy: [], accessibility_and_accommodations: [] }))
    })

    // Unit-level prose is graded evidence and must be scanned too — the earlier
    // build scanned only lesson bodies, which let a performance task through.
    for (const u of units) {
      if (allIds.has(u.unit_id)) errors.push(`duplicate unit_id ${u.unit_id}`)
      allIds.add(u.unit_id)
      if (u.lesson_ids.length !== DAYS_PER_UNIT) errors.push(`${u.unit_id}: ${u.lesson_ids.length} lesson_ids != ${DAYS_PER_UNIT}`)
      for (const id of u.lesson_ids) if (!lessons.some((l) => l.lesson_id === id)) errors.push(`${u.unit_id}: dangling lesson ref ${id}`)
      if (!assessments.some((a) => a.assessment_id === u.assessment_id)) errors.push(`${u.unit_id}: dangling assessment ref`)
      if (!u.adapted_alternative) errors.push(`${u.unit_id}: missing adapted_alternative`)
      const g = u.guardian_safety_review
      for (const f of ['equipment', 'environment', 'movement_hazards', 'guardian_confirmation_required'])
        if (g[f] === undefined) errors.push(`${u.unit_id}: guardian_safety_review missing ${f}`)
      scan(`${u.unit_id} performance_task`, u.performance_task)
      scan(`${u.unit_id} adapted_alternative`, u.adapted_alternative)
      scan(`${u.unit_id} essential_question`, u.essential_question)
      for (const [k, v] of Object.entries(g)) if (typeof v === 'string') scan(`${u.unit_id} guardian.${k}`, v)
      for (const t of u.topic_content) {
        scan(`${u.unit_id} topic "${t.name}"`, t.cues.join(' '))
        scan(`${u.unit_id} common_error "${t.name}"`, t.common_error)
      }
    }

    for (const a of assessments) {
      const sum = a.prompts.reduce((n, p) => n + p.points, 0)
      if (sum !== a.total_points) errors.push(`${a.assessment_id}: points ${sum} != ${a.total_points}`)
      for (const p of a.prompts) scan(`${a.assessment_id} prompt "${p.type}"`, p.prompt)
    }

    const csv = scheduleCsv(lessons).trim().split('\n').slice(1)
    if (csv.length !== lessons.length) errors.push(`${label}: schedule rows ${csv.length} != lessons ${lessons.length}`)
    const weeks = new Set(csv.map((r) => r.split(',')[0]))
    if (weeks.size !== WEEKS) errors.push(`${label}: schedule spans ${weeks.size} weeks != ${WEEKS}`)
    for (const w of weeks) {
      const n = csv.filter((r) => r.split(',')[0] === w).length
      if (n !== SESSIONS_PER_WEEK) errors.push(`${label}: week ${w} has ${n} sessions != ${SESSIONS_PER_WEEK}`)
    }
    if (new Set(csv.map((r) => r.split(',')[6])).size !== lessons.length) errors.push(`${label}: schedule does not cover each lesson exactly once`)
  }
  return errors
}

// ---------- run ----------

const built = COURSES.map((course) => ({ course, ...buildCourse(course) }))
const errors = validate(built)

if (errors.length) {
  console.error('build-pe-g34: FAIL')
  for (const e of errors.slice(0, 40)) console.error('  - ' + e)
  if (errors.length > 40) console.error(`  ... and ${errors.length - 40} more`)
  process.exit(1)
}

if (CHECK_ONLY) {
  console.log(`build-pe-g34: PASS (${built.length} courses, ${built.reduce((n, b) => n + b.lessons.length, 0)} lessons)`)
  process.exit(0)
}

for (const b of built) {
  const dir = join(SUBJECT_ROOT, `grade-${b.course.grade}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'units.json'), JSON.stringify(b.units, null, 2) + '\n')
  writeFileSync(join(dir, 'assessments.json'), JSON.stringify(b.assessments, null, 2) + '\n')
  writeFileSync(join(dir, 'lessons.jsonl'), b.lessons.map((l) => JSON.stringify(l)).join('\n') + '\n')
  writeFileSync(join(dir, 'course-guide.md'), courseGuide(b.course, b.units))
  writeFileSync(join(dir, 'lesson-sequence.md'), lessonSequence(b.course, b.units, b.lessons))
  writeFileSync(join(dir, 'schedule.csv'), scheduleCsv(b.lessons))
  console.log(`build-pe-g34: wrote ${b.course.courseId} (${b.lessons.length} lessons) -> ${dir}`)
}
writeFileSync(join(SUBJECT_ROOT, 'standards-map.md'), standardsMap(built))
console.log('build-pe-g34: wrote standards-map.md')
console.log('build-pe-g34: PASS')
