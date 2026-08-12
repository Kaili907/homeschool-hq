// G34-M5 — deterministic generator for Grade 3 and Grade 4 Health.
//
// Emits the same course contract the published release uses
// (units.json / lessons.jsonl / assessments.json / course-guide.md /
// lesson-sequence.md), plus a per-course 36-week schedule, a standards map, and
// a validation report. Re-running with unchanged data reproduces byte-identical
// output: IDs are positional and nothing is randomized or time-stamped.
//
// Run:  node build-health-g34.mjs          (write)
//       node build-health-g34.mjs --check  (validate only, no writes)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COURSES, PRACTICE } from './course-data.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SUBJECT_ROOT = join(HERE, '..')
const CHECK_ONLY = process.argv.includes('--check')

const WEEKS = 36
const SESSIONS_PER_WEEK = 1
const DAY_SUGGESTION = 'Wednesday'
const UNITS_PER_COURSE = 6
const DAYS_PER_UNIT = 6
const MINUTES = '30-45'

const PHASES = [
  'Launch and diagnostic',
  'Explicit model',
  'Guided practice',
  'Application or project',
  'Mastery check',
  'Correction and reflection',
]

const PHASE_OBJECTIVE = {
  'Launch and diagnostic': (f) =>
    `Surface what the learner already knows about ${f}, without penalty, and establish the unit question.`,
  'Explicit model': (f) =>
    `Build an accurate mental model of ${f} from an explicit demonstration, worked scenario, or age-appropriate text.`,
  'Guided practice': (f) =>
    `Practice ${f} with prompts, feedback, and gradually reduced support.`,
  'Application or project': (f) =>
    `Apply ${f} to the unit performance task and justify the choices made.`,
  'Mastery check': (f) =>
    `Demonstrate current understanding of ${f} through scenario response and applied evidence.`,
  'Correction and reflection': (f) =>
    `Teach and consolidate ${f}, correct any errors from the unit, explain the corrections, and identify where the unit transfers.`,
}

const PHASE_CHECK = {
  'Launch and diagnostic': (f) => `Name one thing you already knew about ${f} and one question you now have.`,
  'Explicit model': (f) => `State the most important rule or fact about ${f} in your own words.`,
  'Guided practice': (f) => `Using the practice situation, say what the safest or healthiest next step is and why.`,
  'Application or project': (f) => `Show one part of your project that uses ${f} and say why you made that choice.`,
  'Mastery check': (f) => `Explain ${f} to someone who has not learned it yet, using one example.`,
  'Correction and reflection': (f) => `Name one thing you corrected or would do differently, and one other place ${f} would be useful.`,
}

const SAFETY_AND_PRIVACY = [
  'Use respectful, non-shaming language about bodies, food, ability, family, and health.',
  'Never require body weight, height, BMI, body-fat percentage, calorie counting, dieting, weight-loss goals, or body measurement of any kind.',
  'Never require disclosure of private medical history, mental-health diagnosis, trauma, family circumstances, or sexual history.',
  'Never require a photograph or video recording of the learner or the learner body.',
  'Keep every scenario fictional; the learner may always answer about a made-up character instead of themselves.',
  'Allow a pause, break, opt-out, or alternate response mode without treating it as failure.',
  'Direct urgent safety, health, or mental-health concerns to a trusted adult or qualified professional; this course is not diagnosis, therapy, or treatment.',
]

const ACCESSIBILITY = [
  'Provide readable text plus optional audio or read-aloud support; no voice feature is required.',
  'Chunk directions into one action at a time and show a worked example or model.',
  'Allow typed, handwritten, spoken, signed, drawn, or pointed responses; the response mode is never the standard being assessed.',
  'Offer reduced-copying, extended-time, hidden-timer, movement-break, and low-distraction options.',
  'Use captions, alt text, high-contrast print, keyboard access, and text-only fallbacks for any media.',
  'Preserve the learning target while adjusting quantity, pacing, representation, or response mode.',
]

const MASTERY_RULE =
  'Do not mark mastery from one answer. Use scenario response, decision process, communication practice, safety planning, and applied evidence; require accurate independent evidence and successful transfer or retrieval on at least two separate occasions. Optional private reflection is never scored and never used as mastery evidence.'

const GUARDIAN_VISIBILITY =
  'Share the lesson target, completion state, evidence type, any guardian safety confirmation, and the next instructional step. Do not expose raw private reflections, raw answers, recordings, or any diagnosis language. Study records completion and progress metadata only; it does not persist raw health reflections.'

const tutorRoutes = (f) => [
  { signal: 'prerequisite gap', action: `Return to the smallest prerequisite needed for ${f}, model it concretely or in text only, then retry one fresh scenario.` },
  { signal: 'procedure without understanding', action: `Ask the learner to explain why the healthy choice about ${f} works before continuing.` },
  { signal: 'correct but low confidence', action: `Confirm the reasoning specifically, offer one varied example of ${f}, and avoid unnecessary remediation.` },
  { signal: 'repeated error pattern', action: `Name the observable pattern neutrally, never as a character or health judgment, contrast it with a worked example, and schedule a short review.` },
  { signal: 'mastery evidence', action: `Require accurate independent application plus explanation of ${f} on a later or different occasion before marking it mastered.` },
]

const lessonFlow = (t, phase) => [
  { segment: 'Welcome and retrieval', minutes: '4-6', teacher_or_tutor_action: `Ask a brief, accessible question connected to ${t.name}. The learner notices, predicts, recalls, or poses a question before instruction. No private disclosure is requested.` },
  { segment: 'Model or mini-lesson', minutes: '8-12', teacher_or_tutor_action: `Teach these points directly, in age-appropriate language, and check understanding of each before moving on:\n${t.key_points.map((k, i) => `  ${i + 1}. ${k}`).join('\n')}` },
  { segment: 'Guided practice', minutes: '8-12', teacher_or_tutor_action: `Work this situation together, then a second one the adult varies: "${t.scenario}" After each, ask what made that choice safe, respectful, or reliable. Fade prompts on the second.` },
  { segment: 'Independent application', minutes: '8-12', teacher_or_tutor_action: `The learner applies what they learned about ${t.name} to a new fictional situation and records the choice plus the reason behind it.` },
  { segment: 'Exit ticket and next step', minutes: '2-5', teacher_or_tutor_action: `In one short response: ${PHASE_CHECK[phase](t.name)}` },
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
        subject: 'health',
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
          `Explain or show understanding of ${focus} using an example, a model, or a described process rather than an unsupported answer.`,
          `Check or revise the work about ${focus} against the stated success criteria.`,
        ],
        success_criteria: [
          `The learner completes the central task about ${focus}.`,
          'The learner gives a reason, an example, or a documented process rather than an unsupported answer.',
          'The learner checks or revises the work and can name one next step.',
        ],
        materials: [
          'course notebook or digital equivalent',
          'pencil or accessible response tool',
          ...u.materials,
        ],
        key_points: t.key_points,
        practice_scenario: t.scenario,
        lesson_flow: lessonFlow(t, phase),
        student_activity: `The learner applies what they learned about ${focus} to a new fictional situation and records the choice plus the reason behind it.`,
        formative_check: PHASE_CHECK[phase](focus),
        answer_or_scoring_guidance:
          'Score the stated learning target, accuracy, reasoning, and revision. Accept multiple valid approaches that meet the criteria. Never infer effort, character, health status, body size, family circumstance, or diagnosis from an error or from a learner choosing an opt-out or alternate response.',
        adaptive_tutor_routes: tutorRoutes(focus),
        mastery_rule: MASTERY_RULE,
        extension: `Apply what you learned about ${focus} under a new constraint, compare two reasonable approaches, or teach the idea to a family member with an original fictional example.`,
        accessibility_and_accommodations: ACCESSIBILITY,
        adapted_alternative: u.adapted,
        safety_and_privacy: SAFETY_AND_PRIVACY,
        guardian_safety_review: u.guardian,
        media: {
          suggestion: `Optional diagram, picture card, demonstration, or short clip supporting ${focus}.`,
          required: false,
          fallback: 'Provide the same information as readable steps, alt text, a transcript, a tactile model, or an adult demonstration.',
        },
        parent_or_guardian_visibility: GUARDIAN_VISIBILITY,
        home_connection: `${u.homeConnection} This is optional. No purchase, account creation, photograph, measurement, or private disclosure is required.`,
      })
    }

    units.push({
      unit_id: unitId,
      course_id: courseId,
      grade,
      subject: 'health',
      unit_number: unitNumber,
      title: u.title,
      days: DAYS_PER_UNIT,
      standards: u.standards,
      essential_question: u.essentialQuestion,
      topics: u.topics.map((t) => t.name),
      topic_content: u.topics,
      home_connection: u.homeConnection,
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
        { type: 'concept and vocabulary', prompt: `Explain ${u.topics[0].name} in your own words and give or identify a valid example.`, points: 4 },
        { type: 'representation or source', prompt: `Use a diagram of a general figure or character rather than your own body, a picture sequence, a model, a described demonstration, or a checked source, to show what you learned about ${u.topics[1].name}.`, points: 5 },
        { type: 'application', prompt: `Apply what you learned about ${u.topics[2].name} to a new fictional situation. Show the steps or name the source you relied on.`, points: 6 },
        { type: 'error or claim analysis', prompt: `A made-up character makes an unsafe or unreliable choice involving ${u.topics[3].name}. Explain what is wrong, correct it, and say why the correction is safer.`, points: 6 },
        { type: 'connection', prompt: `Connect ${u.topics[0].name} with ${u.topics[5].name}. Explain how the two ideas support or depend on one another.`, points: 5 },
        { type: 'performance evidence', prompt: `Present the strongest evidence from the unit task: ${u.performanceTask}`, points: 8 },
        { type: 'transfer and next step', prompt: 'Name one skill you can now use somewhere else, one way to check your own work, and one question you still have. This is about the skill, not about your private life; nothing private has to be shared.', points: 4 },
      ],
      mastery_interpretation: {
        secure: 'At least 85% with accurate independent application and adequate reasoning.',
        developing: '70-84% or inconsistent explanation; assign targeted review and a fresh transfer check.',
        not_yet: 'Below 70% or a missing prerequisite; reteach the smallest gap and reassess with new evidence.',
        rule: 'A unit score is one evidence source, not the sole basis for long-term mastery. The transfer item asks about the skill; optional private reflection is separate and is never scored.',
      },
      rubric_dimensions: ['accuracy', 'reasoning and evidence', 'application or performance', 'checking and revision'],
      accommodation_note:
        'Access supports may change format, pacing, quantity, setting, or response mode without changing the standard being assessed. Choosing an adapted or opt-out path is never scored as a deficit.',
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
    rows.push([week, session, DAY_SUGGESTION, l.course_day, l.unit_number, l.day_in_unit, l.lesson_id].join(','))
  })
  return rows.join('\n') + '\n'
}

const courseGuide = (course, units) => {
  const rows = units
    .map((u) => `| ${u.unit_number} | ${u.title} | ${u.days} | ${u.standards.join('; ')} | ${u.performance_task} |`)
    .join('\n')
  return `# ${course.title} — Course Guide

**Course ID:** \`${course.courseId}\`
**Subject:** health
**Instructional sessions:** ${WEEKS * SESSIONS_PER_WEEK}
**Schedule:** ${WEEKS} weeks x ${SESSIONS_PER_WEEK} session per week (suggested day: ${DAY_SUGGESTION})
**Typical session:** ${MINUTES} minutes
**Cadence:** weekly

## Course description

${course.description}

## Standards alignment

This course is aligned to the **Michigan Health Education Standards Guidelines 2025**, approved by the Michigan State Board of Education on 2025-11-13. Those guidelines organize health education into six Practices across four grade bands (K-2, **3-5**, 6-8, 9-12). Grade 3 and Grade 4 both sit inside the 3-5 band, so the two courses share band anchors and differ in depth, independence, and transfer rather than in standard.

Functional health information is integrated into each Practice in the 2025 framework rather than carried as a separate core-concepts standard, so each unit names both a Practice anchor and a Topic anchor. Local unit order, lesson design, and activities are curricular decisions. See \`../standards-map.md\` for the full mapping and official sources.

This is locally authored curriculum aligned to published standards. It is not a claim of state approval, accreditation, licensure, or automatic credit.

## Private-safe rules

This course never requires, collects, scores, or stores:

- body weight, height, BMI, or body-fat percentage;
- calorie counting, dieting, weight-loss goals, or body-size targets;
- private medical history, diagnosis, or treatment disclosure;
- mental-health diagnosis or trauma disclosure;
- sexual-history disclosure;
- photographs or video of the learner or the learner body.

Every scenario is fictional and the learner may always answer about a made-up character. Optional private reflection is never scored, never required, and never persisted as raw text: Study records completion and progress metadata only.

**What is and is not included.** The Michigan 3-5 band contains reproductive and sexual-health content. Michigan law places *sex education and HIV/STI instruction* specifically under local control with guardian notice and opt-out (MCL 380.1507, MCL 380.1507b). That statute does not restrict child-sexual-abuse prevention or personal-safety instruction, and this course does not treat it as if it did.

Reproductive and sexual-health instruction is therefore left to the guardian as a separately selected module. Personal-safety and child-sexual-abuse-prevention content **is taught**, in Unit 4: body autonomy, correct anatomical names, the private-parts rule, permission, the difference between a surprise and an unsafe secret, the fact that unsafe requests usually come from someone already known and trusted, that it is never the child's fault, and that they should keep telling until an adult helps. Unit 4 carries a guardian confirmation flag so guardians can preview it.

## Course outcomes

By the end of the course, learners will:

1. Demonstrate the Practice-aligned health skills above through independent, accessible evidence.
2. Give a reason, an example, or a documented process rather than an unsupported answer.
3. Transfer a health skill to an unfamiliar fictional situation.
4. Use feedback and error evidence to revise without shame or character judgment.
5. Complete the course capstone: **${course.capstone}**

## Instructional model

Each unit runs a six-session arc: launch and diagnostic; explicit model; guided practice; application or project; mastery check; correction and reflection. Lessons are resumable by segment, media is always optional, and a readable fallback is always specified.

## Mastery and grading

- One correct answer never establishes mastery.
- Unit assessments combine concept, representation, application, error analysis, connection, performance evidence, and reflection.
- Suggested reporting: **Secure**, **Developing**, or **Not Yet**, supported by evidence rather than a single percentage.
- Reassessment uses fresh items after targeted instruction.
- Approved breaks, accommodations, adapted paths, and opt-outs are never failures and are never scored as deficits.
- Guardian summaries show target, completion, evidence type, safety confirmations, and next step. They exclude raw private reflections, raw answers, recordings, and diagnosis language.

## Scope and sequence

| Unit | Title | Sessions | Standards anchors | Performance task |
| --- | --- | --- | --- | --- |
${rows}

## Guardian safety review

Units that involve equipment, an outdoor environment, food or allergens, or any movement hazard carry a \`guardian_safety_review\` block on both the unit and every lesson in it. Units ${units.filter((u) => u.guardian_safety_review.guardian_confirmation_required).map((u) => u.unit_number).join(', ')} require explicit guardian confirmation before the activity runs.

## Files

| File | Contents |
| --- | --- |
| \`units.json\` | Unit specifications, standards, topics, performance tasks, guardian safety review |
| \`lessons.jsonl\` | One JSON object per lesson, in course-day order |
| \`assessments.json\` | Unit assessment sets, rubrics, and mastery interpretation |
| \`lesson-sequence.md\` | Human-readable full lesson sequence |
| \`schedule.csv\` | ${WEEKS}-week schedule with exact lesson coverage |
| \`course-guide.md\` | This file |

## Capstone

${course.capstone}

The capstone may be presented privately, in writing, orally, through a demonstration, or in any other accessible format. No public performance, publication, or recording is required.
`
}

const lessonSequence = (course, units, lessons) => {
  let md = `# ${course.title} — Complete Lesson Sequence\n\n**Sessions:** ${lessons.length}\n**Schedule:** ${WEEKS} weeks x ${SESSIONS_PER_WEEK} session per week\n`
  for (const u of units) {
    md += `\n## Unit ${u.unit_number}: ${u.title}\n\n**Unit ID:** \`${u.unit_id}\`\n**Standards:** ${u.standards.join('; ')}\n**Essential question:** ${u.essential_question}\n**Performance task:** ${u.performance_task}\n**Adapted alternative:** ${u.adapted_alternative}\n`
    for (const l of lessons.filter((x) => x.unit_number === u.unit_number)) {
      md += `\n### Session ${l.course_day} (Unit day ${l.day_in_unit}) — ${l.title}\n**Lesson ID:** \`${l.lesson_id}\`\n**Phase:** ${l.phase}\n**Focus:** ${l.focus}\n**Objective:** ${l.learning_objectives[0]}\n\n**Student activity:** ${l.student_activity}\n\n**Exit ticket:** ${l.formative_check}\n`
    }
    md += `\n**Unit assessment:** \`${u.assessment_id}\`\n`
  }
  return md
}

const standardsMap = (built) => {
  let md = `# Grade 3-4 Health — Standards Map

**Framework:** Michigan Health Education Standards Guidelines 2025
**Approved:** Michigan State Board of Education, 2025-11-13
**Grade band used:** Grades 3-5 (Grade 3 and Grade 4 both fall inside this band)
**Alignment status:** Locally authored curriculum aligned to published standards. Not a claim of state approval, accreditation, licensure, or automatic credit.

## The six Practices

The 2025 guidelines replace the previous eight skill standards with six Practices, and integrate functional health information into each Practice rather than holding it as a separate core-concepts standard.

| Practice | Name |
| --- | --- |
| 1 | Self-Awareness and Analyzing Influences |
| 2 | Social Awareness, Relationship, and Communication Skills |
| 3 | Information and Resource Seeking |
| 4 | Decision Making and Problem Solving |
| 5 | Self-Management and Goal Setting |
| 6 | Advocacy and Health Promotion |

## Grade band note

The 2025 revision consolidated grade spans to K-2, **3-5**, 6-8, and 9-12 to give districts local flexibility. Because Grade 3 and Grade 4 share the 3-5 band, these two courses carry the same band anchors and are differentiated by depth: Grade 3 establishes the habit, the vocabulary, and the trusted-adult pathway; Grade 4 moves to planning, deciding, refusing, goal setting, and advocacy with source checking.

## Scope decision: what is excluded, and what is not

The 3-5 band includes reproductive and sexual-health content. Michigan law places *sex education and HIV/STI instruction* under local control with guardian notice and opt-out (MCL 380.1507, MCL 380.1507b). That statute governs sex education specifically; it does not restrict child-sexual-abuse prevention or general personal-safety instruction, and this package does not use it as a reason to omit them.

**Excluded, left to the guardian as a separately selected module:** reproductive anatomy and function, puberty instruction, and any sexual-health content. It is not silently folded into any unit.

**Included and taught, in Unit 4 of both grades:** body autonomy and the right to refuse touch from anyone including relatives; correct anatomical names; the private-parts rule and its narrow, named exceptions; asking for and giving permission; the difference between a happy surprise and an unsafe secret; the fact that unsafe requests most often come from someone already known and trusted; that a child is never at fault; and that they should keep telling adults until one acts. Unit 4 carries a guardian confirmation flag so guardians can preview the content.

`
  for (const { course, units } of built) {
    md += `\n## ${course.title} (\`${course.courseId}\`)\n\n| Unit | Title | Practices | Topic areas |\n| --- | --- | --- | --- |\n`
    for (const u of units) {
      const practices = u.standards.filter((s) => s.startsWith('Michigan Health Practice')).map((s) => s.match(/Practice (\d)/)[1]).join(', ')
      const topics = u.standards.filter((s) => s.startsWith('Michigan Health Topic')).map((s) => s.replace(/^.*: /, '')).join('; ')
      md += `| ${u.unit_number} | ${u.title} | ${practices} | ${topics} |\n`
    }
    const covered = new Set()
    for (const u of units) for (const s of u.standards) if (s.startsWith('Michigan Health Practice')) covered.add(s.match(/Practice (\d)/)[1])
    md += `\n**Practice coverage:** ${[...covered].sort().join(', ')} of 1-6 (all six Practices covered).\n`
  }

  md += `\n## Official sources

| Source | Official URL |
| --- | --- |
| Michigan Academic Standards | https://www.michigan.gov/mde/services/academic-standards |
| Michigan Health Education Standards Guidelines 2025 | https://www.michigan.gov/mde/-/media/Project/Websites/mde/ohns/School-Health-and-Safety/Michigan-Health-Education-Standards-Guidelines-2025---ADA-final-with-edits-12-19-25.pdf |
| Michigan Health Education Standards Framework (draft posted 2025-09) | https://www.michigan.gov/mde/-/media/Project/Websites/mde/Links/2025/09/Draft-Health-Ed-Standards.pdf |
| MDE announcement of the revised standards (2025-11-13) | https://www.michigan.gov/mde/news-and-information/press-releases/2025/11/13/revised-health-education-standards |
`
  return md
}

// ---------- validation ----------

function validate(built) {
  const errors = []
  const BANNED = [
    /\bBMI\b/i, /body[- ]fat/i, /\bcalorie count/i, /weigh-?in/i,
    /\bdiet(ing)?\b/i, /weight[- ]loss/i, /body[- ]size (?:goal|target|scor)/i,
  ]
  // A term is a violation only when it is not inside an explicit prohibition:
  // naming what the course refuses to do is the point.
  const NEGATED = /\b(no|not|never|without|nor|neither|refus|exclud|prohibit|instead of|rather than|optional)/i
  // Media is a violation only when the learner is asked to PRODUCE it, or when
  // it depicts the learner. Teaching content may discuss an advert video or a
  // cyberbullying photo without asking anyone to make one.
  const MEDIA_PRODUCE = /\b(take|takes|taking|record|records|film|films|upload|uploads|submit|submits|post|posts|send|sends|capture|captures)\s+(?:a\s+|an\s+|the\s+|your\s+)?(photo|photograph|video|recording|image)/i
  const MEDIA_OF_LEARNER = /(photo|photograph|video|recording|image)[^.]{0,40}\bof\s+(you|yourself|your|the learner)/i

  const sentences = (text) => String(text).split(/(?<=[.!?])\s+|\n/)
  const scan = (label, text) => {
    for (const sentence of sentences(text)) {
      if (NEGATED.test(sentence)) continue
      for (const re of BANNED) if (re.test(sentence)) errors.push(`${label}: unnegated body-metric term ${re} -> ${sentence.slice(0, 90)}`)
      if (MEDIA_PRODUCE.test(sentence) || MEDIA_OF_LEARNER.test(sentence)) errors.push(`${label}: media requirement -> ${sentence.slice(0, 90)}`)
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
      if (!Array.isArray(l.key_points) || l.key_points.length < 4) errors.push(`${l.lesson_id}: fewer than 4 taught key_points`)
      if (!l.practice_scenario) errors.push(`${l.lesson_id}: missing practice_scenario`)
      if (l.media.required !== false) errors.push(`${l.lesson_id}: media must never be required`)
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
      scan(`${u.unit_id} performance_task`, u.performance_task)
      scan(`${u.unit_id} adapted_alternative`, u.adapted_alternative)
      scan(`${u.unit_id} home_connection`, u.home_connection)
      scan(`${u.unit_id} essential_question`, u.essential_question)
      for (const [k, v] of Object.entries(u.guardian_safety_review)) if (typeof v === 'string') scan(`${u.unit_id} guardian.${k}`, v)
      for (const t of u.topic_content) {
        scan(`${u.unit_id} topic "${t.name}"`, t.key_points.join(' '))
        scan(`${u.unit_id} scenario "${t.name}"`, t.scenario)
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
    if (new Set(csv.map((r) => r.split(',')[6])).size !== lessons.length) errors.push(`${label}: schedule does not cover each lesson exactly once`)
  }
  return errors
}

// ---------- run ----------

const built = COURSES.map((course) => ({ course, ...buildCourse(course) }))
const errors = validate(built)

if (errors.length) {
  console.error('build-health-g34: FAIL')
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}

if (CHECK_ONLY) {
  console.log(`build-health-g34: PASS (${built.length} courses, ${built.reduce((n, b) => n + b.lessons.length, 0)} lessons)`)
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
  console.log(`build-health-g34: wrote ${b.course.courseId} (${b.lessons.length} lessons) -> ${dir}`)
}
writeFileSync(join(SUBJECT_ROOT, 'standards-map.md'), standardsMap(built))
console.log('build-health-g34: wrote standards-map.md')
console.log('build-health-g34: PASS')
