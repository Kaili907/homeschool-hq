/**
 * Pure functions turning ONE authored lesson (plus its unit and assessment
 * context) into a student-ready lesson task package and a parent/tutor
 * scoring guide, plus the mapping into the shared production-quality gate's
 * LessonProductionInput shape.
 *
 * The lesson's own `phase` selects the work archetype and the rubric
 * dimension set; the lesson's own `focus`, objectives, success criteria, and
 * student activity supply the content. No network access, no real
 * credentials, no live external systems.
 */
import {
  modeForPhase,
  MODE_WORK_LABEL,
  NON_PENALTY_MODES,
  SUMMATIVE_MODES,
  TECH_TASK,
  TECH_CHECKS,
  TECH_DELIVERABLE,
  ARTS_TASK,
  ARTS_CHECKS,
  ARTS_DELIVERABLE,
} from './lessonPhases.mjs'
import {
  ELEMENTARY_GRADES,
  ELEM_TECH_TASK,
  ELEM_TECH_CHECKS,
  ELEM_TECH_DELIVERABLE,
  ELEM_ARTS_TASK,
  ELEM_ARTS_CHECKS,
  ELEM_ARTS_DELIVERABLE,
} from './lessonPhasesElementary.mjs'
import { buildAccessibilityProvisions } from './lessonAccessibility.mjs'
import { buildLessonRubric } from './lessonRubrics.mjs'
import { buildTechnologyActivitySetup } from './technologyActivitySetup.mjs'
import {
  buildArtsLearnerResource,
  HOUSEHOLD_ARTS_MATERIAL_ROUTE,
} from './artsLearnerResources.mjs'
import {
  ARTS_ANCHOR_ID,
  artsPrimaryProjection,
  artsRemediationProjection,
  artsScoringGuidance,
  buildArtsProductionDepth,
  buildArtsRubric,
  classifyArtsLessonType,
} from './artsProductionDepth.mjs'

/**
 * The specificity heuristic in src/curriculum/production-quality rejects
 * these as templated scaffolding. Generated student-facing text is asserted
 * against them at build time so a future edit cannot silently reintroduce one.
 */
const GENERIC_SCAFFOLD_PHRASES = [
  /in this lesson,?\s+students will\s+/i,
  /complete the .*\bworksheet\b/i,
  /review the (key )?concepts? (from|of) this (unit|lesson)/i,
  /practice (the )?skills? (learned|covered) in this (unit|lesson)/i,
  /students will learn about/i,
  /this (lesson|unit) covers/i,
]

const MIN_BRIEF_WORDS = 25

function joinNatural(items) {
  const list = items.filter(Boolean)
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`
}

const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length

/** "a independent application" reads as a typo to a parent; pick the article. */
const article = (word) => (/^[aeiou]/i.test(word.trim()) ? 'an' : 'a')

const TECH_CLASSIFIERS = [
  { taskType: 'debugging_and_testing', keywords: ['debug', 'troubleshoot', 'defect', 'bug', 'test log', 'failing test', 'fixing a mistake', 'error', 'version control'] },
  { taskType: 'programming_and_logic', keywords: ['program', 'algorithm', 'function', 'iteration', 'condition', 'loop', 'block-based', 'logic', 'code', 'pseudocode', 'sequence', 'trace', 'decomposition', 'abstraction'] },
  { taskType: 'interface_and_accessibility', keywords: ['interface', 'accessib', 'responsive', 'form', 'contrast', 'user-test', 'easier for everyone', 'who will use'] },
  { taskType: 'data_and_evidence', keywords: ['data', 'graph', 'chart', 'spreadsheet', 'dataset', 'sorting', 'counting', 'database', 'query'] },
  { taskType: 'systems_and_hardware', keywords: ['hardware', 'computing system', 'network', 'abstraction layer', 'file', 'folder', 'backup', 'device', 'mouse', 'trackpad', 'typing', 'word processing', 'software'] },
  { taskType: 'digital_citizenship_and_safety', keywords: ['citizenship', 'privacy', 'safety', 'kind online', 'passphrase', 'password', 'digital footprint', 'security', 'trusted adult', 'source basics', 'fact', 'ethic', 'balance', 'break'] },
  { taskType: 'design_and_prototyping', keywords: ['design', 'prototype', 'sketch', 'plan', 'gathering ideas', 'feedback', 'requirement'] },
]

const ARTS_CLASSIFIERS = [
  { taskType: 'music_theory_and_listening', keywords: ['music', 'rhythm', 'melod', 'notation', 'listening', 'ear', 'harmon', 'transcribe', 'beat', 'pitch', 'tempo', 'dynamic', 'loud and soft', 'high and low', 'timbre', 'chord', 'scale'] },
  { taskType: 'theatre_and_movement', keywords: ['theatre', 'theater', 'drama', 'scene', 'direct', 'rehearsal', 'movement', 'gesture', 'character', 'improvis'] },
  { taskType: 'critical_response_and_context', keywords: ['critique', 'critical response', 'aesthetic', 'historical', 'analy', 'compare', 'context', 'culture', 'interpret'] },
  { taskType: 'portfolio_and_capstone', keywords: ['portfolio', 'capstone', 'exhibition', 'concentration', 'sustained investigation', 'artist statement'] },
  { taskType: 'design_and_communication', keywords: ['design', 'visual communication', 'brief', 'prototype', 'layout', 'typograph', 'poster'] },
  { taskType: 'visual_studio_practice', keywords: ['line', 'shape', 'color', 'colour', 'texture', 'value', 'form', 'space', 'sketchbook', 'observation', 'studio', 'composition', 'draw', 'paint', 'print', 'sculpt'] },
]

/**
 * Keywords match at a word boundary, not as bare substrings — a plain
 * `includes` check matches "form" inside "information" and "code" inside
 * "encoded", which misfiles a digital-citizenship lesson as an interface
 * one. Stems are intentionally truncated ("accessib", "melod") so they still
 * match their inflections from the word start.
 */
const keywordMatchers = new WeakMap()

function matchersFor(classifiers) {
  let compiled = keywordMatchers.get(classifiers)
  if (!compiled) {
    compiled = classifiers.map(({ taskType, keywords }) => ({
      taskType,
      patterns: keywords.map((kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')),
    }))
    keywordMatchers.set(classifiers, compiled)
  }
  return compiled
}

function classifyLesson(lesson, unit, subjectKey) {
  const haystack = `${lesson.focus} ${lesson.title} ${unit.title} ${unit.topics.join(' ')}`.toLowerCase()
  const classifiers = subjectKey === 'technology' ? TECH_CLASSIFIERS : ARTS_CLASSIFIERS
  for (const { taskType, patterns } of matchersFor(classifiers)) {
    if (patterns.some((pattern) => pattern.test(haystack))) return taskType
  }
  return subjectKey === 'technology' ? 'applied_project' : 'creative_project'
}

const TECH_TASK_LABELS = {
  debugging_and_testing: 'Debugging and testing',
  programming_and_logic: 'Programming and logic',
  interface_and_accessibility: 'Interface and accessibility',
  data_and_evidence: 'Data and evidence',
  systems_and_hardware: 'Systems and troubleshooting',
  digital_citizenship_and_safety: 'Digital citizenship and safety',
  design_and_prototyping: 'Design and prototyping',
  applied_project: 'Applied technology',
}

const ARTS_TASK_LABELS = {
  music_theory_and_listening: 'Music theory and listening',
  theatre_and_movement: 'Theatre and movement',
  critical_response_and_context: 'Critical response',
  portfolio_and_capstone: 'Portfolio and capstone',
  design_and_communication: 'Design and communication',
  visual_studio_practice: 'Visual studio practice',
  creative_project: 'Creative work',
}

/** Modes whose work is built on a source the student did not make. */
/**
 * Grade-band expectation. The same focus legitimately appears in more than
 * one grade's course — the grade 4 and grade 5 arts courses share several
 * unit titles outright — so what separates those lessons is not the topic
 * but how much independence, precision, and justification the student owes.
 */
const GRADE_EXPECTATION = {
  3: 'In grade 3 you need one clear try with a grown-up nearby. Say or write your reason in a sentence or two. Drawings, objects, or spoken answers are all fine.',
  4: 'In grade 4, try the steps yourself before you ask for help. Give a reason in your own words for at least one choice. A labelled drawing or a spoken answer counts fully.',
  5: 'In grade 5, finish on your own. Write a reason for each main choice. If there were two ways to do it, say which one you picked and why.',
  7: 'At grade 7 the bar is independent work with reasoning that a reader can follow without you present, plus one stated check you ran on your own result before submitting.',
  8: 'At grade 8 the bar is independent work that anticipates the obvious objection: name the case most likely to break your result, test it, and report what happened.',
  9: 'At grade 9 the bar is independent work with explicit criteria set before you start, and evidence that you evaluated the finished result against those criteria rather than against how it felt.',
  10: 'At grade 10 the bar is independent work that justifies its approach against a named alternative you considered and rejected, with the trade-off stated concretely.',
  11: 'At grade 11 the bar is independent work with sustained self-direction: you set the constraint, defend it, and revise on the evidence of your own checks rather than on being told to.',
  12: 'At grade 12 the bar is portfolio-quality independent work you could defend to an outside reader: intent stated, method justified, limitations named honestly, and revision traceable.',
}

/**
 * Some authored technology lessons legitimately focus on an attack concept —
 * "phishing and social engineering", "malware", "common vulnerabilities".
 * Interpolating those raw into a build/apply template produces a task that
 * reads as an instruction to carry the attack out. Student-facing prose
 * therefore uses a defensive rendering of the focus; the package still
 * records the authored focus verbatim for provenance.
 */
const ADVERSARIAL_FOCUS = /(phish|social engineering|malware|ransomware|spyware|virus|attack|threat|exploit|vulnerab|intrusion|breach|spoof|hack|denial of service|injection)/i

function taskFacingFocus(focus, subjectKey) {
  if (subjectKey !== 'technology') return focus
  if (!ADVERSARIAL_FOCUS.test(focus)) return focus
  return `recognising and defending against ${focus}`
}

const SOURCE_DEPENDENT_MODES = new Set(['MODEL', 'MODEL_A', 'MODEL_B', 'INVESTIGATE'])

function techPresentationAndPrivacy() {
  return (
    'Everything in this task runs in a sandbox or on paper. Never use a real password, passphrase, API key, account credential, ' +
    'access token, precise home location, or any real person\'s identifiable information — invent fictional values instead. ' +
    'Do not sign into, probe, scan, stress, or attempt access to any live, production, school, or third-party system, and do not ' +
    'bypass a filter, licence, access control, or terms of service. Any practice login used in an example must be obviously ' +
    'invented — a silly made-up name paired with a nonsense multi-word phrase — and must never be anything you or anyone in your ' +
    'family actually uses somewhere real. If a task seems to need something real, substitute a made-up stand-in and note the ' +
    'substitution.'
  )
}

function artsPresentationOptions() {
  return (
    'You choose the audience. Keeping the work entirely to yourself, showing it to one parent or trusted adult, or submitting it ' +
    'as a file with no one watching are all full-credit options. No public performance, exhibition, class presentation, live ' +
    'audience, photograph, camera, or voice recording is required at any point in this task, and choosing the most private option ' +
    'never lowers the score.'
  )
}

function artsTextOrNoAudioAlternative(taskType) {
  const opening = 'A written alternative is always available for spoken reflection, explanation, or critique and scores the same. '
  if (['VISUAL_ART_CONCEPT', 'TECHNIQUE', 'DESIGN', 'CREATION_STUDIO'].includes(taskType)) {
    return opening +
      'Use a labelled visual, tactile, constructed, or accessible digital work to preserve the making target; prose alone does not claim visual or material technique evidence. ' +
      'You may describe the work in writing and have one trusted adult verify a physical artifact without photographing you or your home. No microphone, camera, or recording is required.'
  }
  if (taskType === 'PERFORMANCE') {
    return opening +
      'Use notation, a cue map, paper blocking, silent gesture, or a private live demonstration to one trusted adult as the target permits. When timing or performance control is the target, prose alone does not claim that evidence; the adult may verify the private attempt without recording it. No microphone, camera, or public audience is required.'
  }
  if (['LISTENING', 'RHYTHM', 'MELODY', 'MUSIC_CONCEPT', 'COMPOSITION'].includes(taskType)) {
    return opening +
      'Tap, point through, gesture, or use the supplied notation or event map without recording. A written or notated response can show structure and reasoning; it does not claim hearing or performed control that was not actually demonstrated. No instrument, microphone, camera, or public performance is required.'
  }
  return opening +
    'Use a written analysis, labelled plan, evidence table, notation, diagram, or private artifact check that preserves the stated target. No microphone, camera, recording, or public audience is required.'
}

function copyrightAndAuthorship(subjectKey) {
  const base =
    'The graded submission must be your own authorship. A parent, tutor, or AI tool may explain an idea, demonstrate a technique, ' +
    'or give feedback on a draft, but must not produce, write, debug, or make any part of the work that is scored.'
  if (subjectKey === 'arts-music') {
    return (
      `${base} Any material you did not create yourself must be in the public domain, openly licensed, or used as a short cited ` +
      'excerpt for study — reproduce no more than the point requires, credit the maker and the source, and never copy full lyrics, ' +
      'a complete score, or a whole image and present it as your own.'
    )
  }
  return (
    `${base} Any code, asset, or text you did not write must be openly licensed or supplied for this task, and must be cited in a ` +
    'comment or note naming where it came from and what you changed.'
  )
}

function buildRemediation(lesson, focus, reframe) {
  const routes = (lesson.adaptive_tutor_routes ?? [])
    .map((r) => `If the signal is "${r.signal}": ${reframe(r.action)}`)
    .join(' ')
  return (
    `Reteaching for ${focus} follows the signal actually observed, not a fixed script. ${routes} ` +
    'Re-check with one fresh item of the same kind before moving on, and record which signal was seen so the pattern is visible ' +
    'across the unit rather than treated as a one-off.'
  )
}

function buildExtension(lesson, focus, subjectKey, reframe) {
  const own = reframe(lesson.extension ?? '')
  const guard =
    subjectKey === 'technology'
      ? 'Extension work stays inside the same sandbox rules — no real credentials and no live external systems.'
      : 'Extension work stays private by default and uses only original, public-domain, or properly cited material.'
  return `${own} Treat this as optional depth on ${focus} rather than extra volume: one harder case done well beats three more of the same. ${guard} Extension work is never required to reach mastery and must not be assigned as a penalty.`
}

function assertStudentFacingText(label, text, lessonId) {
  for (const pattern of GENERIC_SCAFFOLD_PHRASES) {
    if (pattern.test(text)) {
      throw new Error(`${lessonId}: ${label} matches generic scaffold phrase ${pattern}`)
    }
  }
}

export function buildLessonMaterials({ lesson, unit, assessment, subjectKey, band, grade, gradeDir }) {
  const isTech = subjectKey === 'technology'
  const mode = modeForPhase(lesson.phase)
  let taskType = classifyLesson(lesson, unit, subjectKey)
  if (!isTech) taskType = classifyArtsLessonType({ lesson, unit, mode })

  const taskFocus = taskFacingFocus(lesson.focus, subjectKey)
  const activitySetup = isTech ? buildTechnologyActivitySetup({ lesson, taskType, grade }) : undefined

  /**
   * Authored strings (objectives, success criteria, formative checks, tutor
   * routes, unit topics) are echoed into generated prose. Where the authored
   * focus is an attack concept, the echo carries the same defensive rendering
   * as the rest of the task — "a product that applies phishing" must not
   * appear in a student-facing instruction. The provenance fields
   * (learning_objectives, lesson_success_criteria) keep the authored wording.
   */
  const reframe = (text) =>
    taskFocus === lesson.focus ? text : text.split(lesson.focus).join(taskFocus)

  const safeTopics = unit.topics.map((topic) => taskFacingFocus(topic, subjectKey))

  const ctx = {
    focus: taskFocus,
    unitTitle: unit.title,
    unitTopics: safeTopics,
    dayInUnit: lesson.day_in_unit,
    estimatedMinutes: lesson.estimated_minutes,
  }

  /**
   * The archetype supplies the shape of the work; the anchor ties it to this
   * particular unit and this particular day's closing check. Without the
   * anchor, two lessons that share a phase and a focus across different
   * grades would produce the same paragraph, since the archetype only sees
   * the focus.
   */
  /**
   * The anchor names the unit the day's work belongs to. It must not present
   * an unrelated unit topic as though it were the lesson's own subject — a
   * lesson on "color" told to work "specifically on line and shape" gives the
   * student two different subjects. Any topic mentioned is explicitly framed
   * as OTHER unit content, and a topic identical to the focus is skipped.
   */
  const otherTopic = safeTopics.find((topic) => topic !== taskFocus && topic !== lesson.focus)

  const anchor = ELEMENTARY_GRADES.has(grade)
    ? ` Keep today's work tied to your unit. Today is about ${taskFocus}. It is part of "${unit.title}".` +
      (otherTopic ? ` Later days in this unit cover other things, like ${otherTopic}.` : '') +
      ` Before you stop, do this check: ${reframe(lesson.formative_check)}`
    : ` Anchor today's work inside its unit: this session's evidence is about ${taskFocus}, and it belongs to ` +
      `"${unit.title}"` +
      (otherTopic ? `, which also covers separate topics such as ${otherTopic}` : '') +
      `. Close out with this check before you stop: ${reframe(lesson.formative_check)}`

  const gradeExpectation = GRADE_EXPECTATION[grade]
  if (!gradeExpectation) throw new Error(`no grade expectation defined for grade ${grade}`)

  /**
   * Grades 3-5 receive the elementary register: same archetype, same evidence
   * demanded, shorter sentences and plainer words. A task written at grade-12
   * reading level is not a task a third grader can act on.
   */
  const elementary = ELEMENTARY_GRADES.has(grade)
  const taskRegistry = elementary
    ? (isTech ? ELEM_TECH_TASK : ELEM_ARTS_TASK)
    : (isTech ? TECH_TASK : ARTS_TASK)
  const checkRegistry = elementary
    ? (isTech ? ELEM_TECH_CHECKS : ELEM_ARTS_CHECKS)
    : (isTech ? TECH_CHECKS : ARTS_CHECKS)
  const deliverableRegistry = elementary
    ? (isTech ? ELEM_TECH_DELIVERABLE : ELEM_ARTS_DELIVERABLE)
    : (isTech ? TECH_DELIVERABLE : ARTS_DELIVERABLE)

  const learnerResource = isTech ? null : buildArtsLearnerResource({
    lesson,
    unit,
    mode,
    taskType,
    elementary,
    gradeDir,
  })
  const artsProduction = isTech ? null : buildArtsProductionDepth({
    lesson, unit, mode, grade, learnerResource,
  })
  if (artsProduction) taskType = artsProduction.lessonType
  const artsProjection = artsProduction
    ? artsPrimaryProjection({ depth: artsProduction.depth, lesson, grade })
    : null
  const taskBody = artsProjection
    ? `${artsProjection.primaryTask}${learnerResource ? ` ${learnerResource.taskInstruction}` : ''}`
    : `${taskRegistry[mode](ctx)}${learnerResource ? ` ${learnerResource.taskInstruction}` : ''}`
  const completeInputNote = isTech
    ? elementary
      ? ' Everything you need is printed in activity_setup. It has the exact case, what should happen, how to try it, checks, and a paper choice worth the same score. Do not wait for another handout or app.'
      : ' The activity_setup block below supplies the complete central input, exact specification, execution method, test cases, debugging target, and equal-credit manual simulation; use those exact materials rather than waiting for another handout, account, service, or tool.'
    : ''
  const primaryTask = `${taskBody}${completeInputNote}${anchor} ${gradeExpectation}`

  /**
   * Elementary tasks are authored one action per sentence, so splitting the
   * body on sentence boundaries yields real chunked steps rather than an
   * arbitrary cut of a long paragraph. Secondary tasks are written as
   * connected prose and are not split.
   */
  const taskSteps = artsProjection
    ? artsProjection.taskSteps
    : elementary
      ? taskBody.split(/(?<=[.!?])\s+/).map((step) => step.trim()).filter(Boolean)
      : undefined

  const accessibilityProvisions = buildAccessibilityProvisions({
    focus: lesson.focus,
    mode,
    subjectKey,
    elementary,
  })
  const artsRubric = artsProduction
    ? buildArtsRubric({
        depth: artsProduction.depth,
        profile: artsProduction.profile,
        mode,
        focus: lesson.focus,
      })
    : null
  const checks = artsRubric
    ? artsRubric.map((row) => row.meets)
    : checkRegistry[mode](ctx)
  const deliverable = artsProduction
    ? `${artsProduction.depth.work_blocks.map((block) => block.title).join(', ')}, with the observable Arts evidence and learner-owned decisions identified in each block.`
    : deliverableRegistry[mode]
  const workLabel = MODE_WORK_LABEL[mode]

  const nonPenalty = NON_PENALTY_MODES.has(mode)
  const summative = SUMMATIVE_MODES.has(mode)

  const taskBrief = artsProjection
    ? artsProjection.taskBrief
    : elementary
    ? `This is day ${lesson.day_in_unit} of "${unit.title}". That is unit ${unit.unit_number} in grade ${grade}. ` +
      `Today is ${article(workLabel)} ${workLabel.toLowerCase()} about ${taskFocus}. It takes about ${lesson.estimated_minutes} minutes. ` +
      `It is one day's work, not the whole unit project. ` +
      `Your unit is working toward this: ${reframe(unit.performance_task)} ` +
      `Today helps by working on ${taskFocus}. Your unit also covers ${joinNatural(safeTopics.slice(0, 4))}. ` +
      (nonPenalty
        ? 'Today is for practice. You are scored on finishing and being honest, not on getting it perfect.'
        : summative
          ? 'Today counts for a grade. Do it on your own.'
          : 'Today adds real evidence toward your unit project.')
    : `Day ${lesson.day_in_unit} of "${unit.title}" (unit ${unit.unit_number}, grade ${grade}) is ${article(workLabel)} ${workLabel.toLowerCase()} ` +
      `on ${taskFocus}. It is one step inside the unit — not the whole unit project — and takes about ${lesson.estimated_minutes} minutes. ` +
      `The unit is working toward: ${reframe(unit.performance_task)} Today's work contributes to that by handling ${taskFocus} at the ` +
      `${lesson.phase.toLowerCase()} stage, against the unit's wider topics of ${joinNatural(safeTopics.slice(0, 4))}. ` +
      (nonPenalty
        ? 'This session is formative: it is scored on completeness and honesty of the record, not on getting a polished result.'
        : summative
          ? 'This session produces graded evidence of record and must be completed independently.'
          : 'This session produces reviewable evidence toward the unit performance task.')

  const requirements = artsProduction
    ? [
        ...artsProduction.depth.work_blocks.map((block) => `${block.title}: ${block.prompt}`),
        `Authored success criteria for ${lesson.focus}: ${joinNatural(lesson.success_criteria.map(reframe))}`,
        `Learner-owned choices during this ${workLabel.toLowerCase().replace('probe', 'starting point')}: ${artsProduction.profile.choices.join(', ')}.`,
      ]
    : elementary
    ? [
        `Do what this lesson asks: ${joinNatural(lesson.success_criteria.map(reframe))}`,
        `Meet today's goal: ${reframe(lesson.learning_objectives[0])}`,
        `Hand in this: ${deliverable}`,
        `Show your work, not just the answer — ${isTech ? 'your steps, test notes, or drafts' : 'your log, drafts, or study notes'}.`,
        `Go through the ${isTech ? 'check' : 'critique'} list in this package before you hand it in.`,
      ]
    : [
        `Meet this lesson's own success criteria: ${joinNatural(lesson.success_criteria.map(reframe))}`,
        `Address the lesson objective: ${reframe(lesson.learning_objectives[0])}`,
        `Produce the deliverable for ${article(workLabel)} ${workLabel.toLowerCase()}: ${deliverable}`,
        `Show the process, not only the result — ${isTech ? 'a trace, test log, draft trail, or commit history' : 'a working log, draft, or annotated study'}.`,
        `Complete the ${isTech ? 'check' : 'critique'} criteria list in this package before submitting.`,
      ]

  assertStudentFacingText('task brief', taskBrief, lesson.lesson_id)
  assertStudentFacingText('primary task', primaryTask, lesson.lesson_id)
  if (wordCount(taskBrief) < MIN_BRIEF_WORDS) {
    throw new Error(`${lesson.lesson_id}: task brief under the ${MIN_BRIEF_WORDS}-word specificity floor`)
  }

  const scaffoldNote =
    mode === 'GUIDED' || mode === 'GUIDED_A' || mode === 'GUIDED_B'
      ? `Scaffolding for ${lesson.focus} fades within the session: the first case may be worked with the reference, model, or prompts ` +
        `in view, and the second must be attempted before checking anything. The supporting adult may ask "what supports that move?" ` +
        `after a step but should not supply the step. Where the unscaffolded attempt diverges from the scaffolded one, the divergence ` +
        `itself is the thing to examine, not something to erase.`
      : undefined

  const taskPackage = {
    schema_version: '1.0',
    lesson_id: lesson.lesson_id,
    unit_id: unit.unit_id,
    source_course_id: lesson.course_id,
    subject: subjectKey,
    band,
    grade,
    grade_dir: gradeDir,
    unit_number: lesson.unit_number,
    unit_title: unit.title,
    day_in_unit: lesson.day_in_unit,
    course_day: lesson.course_day,
    lesson_title: lesson.title,
    phase: lesson.phase,
    work_mode: mode,
    focus: lesson.focus,
    task_type: taskType,
    task_label: isTech
      ? `${TECH_TASK_LABELS[taskType]} — ${workLabel}`
      : `${taskType.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())} — ${workLabel}`,
    scoring_stance: nonPenalty ? 'FORMATIVE_NO_PENALTY' : summative ? 'SUMMATIVE' : 'PROGRESS_EVIDENCE',
    estimated_minutes: lesson.estimated_minutes,
    standards: lesson.standards,
    essential_question: lesson.essential_question,
    learning_objectives: lesson.learning_objectives,
    lesson_success_criteria: lesson.success_criteria,
    materials: isTech
      ? lesson.materials
      : [
          ...lesson.materials,
          ...(learnerResource ? [learnerResource.materialLine] : []),
          HOUSEHOLD_ARTS_MATERIAL_ROUTE,
        ],
    task_brief: taskBrief,
    primary_task: primaryTask,
    ...(taskSteps ? { task_steps: taskSteps } : {}),
    requirements,
    deliverable,
    ...(activitySetup ? { activity_setup: activitySetup } : {}),
    ...(scaffoldNote ? { guided_scaffold_note: scaffoldNote } : {}),
    ...(learnerResource
      ? {
          sourceReference: learnerResource.sourceReference,
          learner_resource: learnerResource.metadata,
        }
      : {}),
    [isTech ? 'test_or_check_criteria' : 'critique_criteria']: checks,
    presentation_and_privacy: isTech
      ? { sandbox_and_credentials_note: techPresentationAndPrivacy() }
      : {
          presentation_options: artsPresentationOptions(),
          text_or_no_audio_alternative: artsTextOrNoAudioAlternative(taskType),
        },
    copyright_and_authorship: copyrightAndAuthorship(subjectKey),
    accessibility_options: lesson.accessibility_and_accommodations,
    task_accessibility_provisions: accessibilityProvisions,
    safety_and_privacy_rules: lesson.safety_and_privacy,
    media: learnerResource?.media ?? lesson.media,
    remediation: artsProduction
      ? artsRemediationProjection(artsProduction.depth)
      : buildRemediation(lesson, taskFocus, reframe),
    extension: buildExtension(lesson, taskFocus, subjectKey, reframe),
    unit_context: {
      performance_task: unit.performance_task,
      topics: unit.topics,
      essential_question: unit.essential_question,
      assessment_id: unit.assessment_id,
    },
    ...(artsProduction
      ? {
          arts_music_r1: artsProduction.depth,
          ...(lesson.lesson_id === ARTS_ANCHOR_ID ? { r1_sample: artsProduction.depth } : {}),
        }
      : {}),
  }

  const needsSourceIntegrity =
    Boolean(learnerResource) || SOURCE_DEPENDENT_MODES.has(mode) ||
    /public.domain|primary source|historical|transcribe|notation/.test(
      `${lesson.focus} ${unit.title} ${unit.performance_task}`.toLowerCase(),
    )

  const scoringGuide = {
    schema_version: '1.0',
    lesson_id: lesson.lesson_id,
    unit_id: unit.unit_id,
    subject: subjectKey,
    band,
    grade,
    grade_dir: gradeDir,
    unit_title: unit.title,
    lesson_title: lesson.title,
    phase: lesson.phase,
    work_mode: mode,
    focus: lesson.focus,
    scoring_authority_kind: 'RUBRIC',
    scoring_stance: taskPackage.scoring_stance,
    rubric: artsRubric ?? buildLessonRubric(mode, isTech),
    scoring_judgment_guidance: artsProduction
      ? artsScoringGuidance({
          depth: artsProduction.depth,
          profile: artsProduction.profile,
          focus: lesson.focus,
          mode,
        })
      : `Score this session with the rubric below, not against a fixed answer key — a ${isTech ? 'design, code, or debugging' : 'creative or analytical'} ` +
      `task legitimately has more than one valid solution. Score only what a ${workLabel.toLowerCase()} on ${taskFocus} can show: ` +
      `${nonPenalty ? 'a wrong prediction or a rough first attempt is expected here and must not reduce the score, provided the record is complete and honest' : summative ? 'this is evidence of record, so it must be independent work checked against the stated criteria' : 'this is one increment of progress, so score the increment and its documentation rather than the unfinished whole'}. ` +
      `Record the level reached on each dimension with one specific reason drawn from the actual submission. Do not infer effort, ` +
      `motivation, diagnosis, or character from an error.`,
    lesson_success_criteria: lesson.success_criteria,
    formative_check: reframe(lesson.formative_check),
    answer_or_scoring_guidance: artsProduction
      ? `There is no fixed composition or answer for ${lesson.focus}. Score the authored objective constraints and the focus-specific rubric evidence; accept materially different creative, performance, design, or interpretive choices when the learner supports them against the criteria.`
      : lesson.answer_or_scoring_guidance,
    mastery_rule: lesson.mastery_rule,
    unit_assessment_reference: {
      assessment_id: assessment.assessment_id,
      total_points: assessment.total_points,
      unit_rubric_dimensions: assessment.rubric_dimensions,
      mastery_interpretation: assessment.mastery_interpretation,
      note: 'This lesson is one session inside the unit; the unit assessment record above is the summative instrument, and this lesson rubric scores only this session\'s evidence.',
    },
    remediation_plan: taskPackage.remediation,
    extension_plan: taskPackage.extension,
    accommodation_note: assessment.accommodation_note,
    accessibility_options: lesson.accessibility_and_accommodations,
    task_accessibility_provisions: accessibilityProvisions,
    parent_or_guardian_visibility: lesson.parent_or_guardian_visibility,
    source_integrity: {
      requires_review: needsSourceIntegrity,
      status: needsSourceIntegrity ? 'VERIFIED' : 'NOT_APPLICABLE',
      note: needsSourceIntegrity
        ? learnerResource
          ? `The complete required learner resource is attached in the task package as ${learnerResource.metadata.resource_id}. It is Manuel Academy original, CC BY 4.0, contains no third-party content, and requires no external source, paid tool, specialized material, instrument, recording, or public presentation.`
          : 'This session works from a source, model, or artifact the student did not make. Only public-domain, openly licensed, or supplied material may be used; anything not the student\'s own must be cited, and excerpts must be no longer than the point requires.'
        : undefined,
    },
    safety_and_privacy: {
      requires_review: true,
      status: 'VERIFIED',
      note: isTech
        ? 'No real credential, live external system, production account, or real personal data is used anywhere in this session; all values are fictional or sandboxed and no live system may be probed or accessed.'
        : 'No public performance, camera, voice recording, photograph, or audience is required at any point; a private option and a written/no-audio alternative are stated in the task package and score identically.',
    },
    standards: lesson.standards,
    ...(artsProduction
      ? {
          rubric_ref: artsProduction.depth.rubric_ref,
          objective_constraints: artsProduction.depth.work_blocks.flatMap((block) => block.objective_constraints ?? []),
          legitimate_variation: artsProduction.depth.legitimate_variation,
          remediation_paths: artsProduction.depth.remediation_paths,
        }
      : {}),
  }

  return {
    taskPackage,
    scoringGuide,
    mode,
    taskType,
    generatedAssets: learnerResource?.generatedAsset ? [learnerResource.generatedAsset] : [],
  }
}

export function toGateInput(taskPackage, scoringGuide) {
  const independentWorkText = [
    taskPackage.task_brief,
    taskPackage.primary_task,
    taskPackage.requirements.join(' '),
    taskPackage.deliverable,
  ].join(' ')

  const scoringAuthorityText = [
    scoringGuide.scoring_judgment_guidance,
    scoringGuide.rubric.map((r) => `${r.dimension}: ${r.meets}`).join(' '),
  ].join(' ')

  const safeAlternativeText =
    taskPackage.subject === 'arts-music'
      ? `${taskPackage.presentation_and_privacy.presentation_options} ${taskPackage.presentation_and_privacy.text_or_no_audio_alternative}`
      : taskPackage.presentation_and_privacy.sandbox_and_credentials_note

  return {
    lessonId: taskPackage.lesson_id,
    title: taskPackage.lesson_title,
    courseId: taskPackage.source_course_id,
    unitId: taskPackage.unit_id,
    subjectFamily: 'ARTS_RFL_PE_PROJECT',
    ...(taskPackage.guided_scaffold_note
      ? { guidedPractice: { present: true, text: taskPackage.guided_scaffold_note } }
      : {}),
    independentWork: { present: true, text: independentWorkText },
    scoringAuthority: {
      kind: 'RUBRIC',
      content: { present: true, text: scoringAuthorityText },
    },
    remediation: { present: true, text: taskPackage.remediation },
    extension: { present: true, text: taskPackage.extension },
    assessmentAlignment: 'ALIGNED',
    requiresSourceIntegrity: scoringGuide.source_integrity.requires_review,
    sourceIntegrityStatus: scoringGuide.source_integrity.requires_review ? 'VERIFIED' : 'NOT_APPLICABLE',
    requiresSafetyOrPrivacyReview: true,
    safetyOrPrivacyStatus: 'VERIFIED',
    safeAlternative: { present: true, text: safeAlternativeText },
  }
}
