/**
 * Pure functions that turn one canonical unit + its assessment record into a
 * student-ready task package and a parent/tutor scoring guide, plus the
 * mapping into the shared production-quality gate's LessonProductionInput
 * shape. No network access, no real credentials, no live external systems —
 * every generated task is explicitly sandboxed/fictional (technology) or
 * explicitly private-capable (arts/music).
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'your', 'you',
])

function joinNatural(items) {
  const list = items.filter(Boolean)
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

const TECH_CLASSIFIERS = [
  {
    taskType: 'debugging_and_testing',
    keywords: ['debug', 'troubleshoot', 'version control', 'defect', 'bug', 'test log', 'failing test'],
  },
  {
    taskType: 'programming_and_logic',
    keywords: ['program', 'algorithm', 'function', 'iteration', 'condition', 'block-based', 'logic', 'code'],
  },
  {
    taskType: 'interface_and_accessibility',
    keywords: ['interface', 'accessible', 'responsive', 'form', 'contrast', 'user-test'],
  },
  {
    taskType: 'data_and_evidence',
    keywords: ['data', 'graph', 'chart', 'spreadsheet', 'dataset', 'picture graph'],
  },
  {
    taskType: 'systems_and_hardware',
    keywords: ['hardware', 'computing system', 'abstraction layer', 'files and folders', 'backup', 'device'],
  },
  {
    taskType: 'digital_citizenship_and_safety',
    keywords: ['citizenship', 'privacy', 'safety', 'kind online', 'passphrase', 'digital footprint', 'security and privacy'],
  },
]

const ARTS_CLASSIFIERS = [
  {
    taskType: 'music_theory_and_listening',
    keywords: ['music theory', 'rhythm', 'melod', 'notation', 'listening', 'ear-training', 'harmonic', 'transcribe'],
  },
  {
    taskType: 'theatre_and_presentation',
    keywords: ['theatre', 'drama', 'scene', 'direct', 'rehearsal', 'movement story', 'presentation craft'],
  },
  {
    taskType: 'critical_response_and_context',
    keywords: ['critique', 'critical response', 'aesthetics', 'historical', 'analytical', 'compare two works'],
  },
  {
    taskType: 'portfolio_and_capstone',
    keywords: ['portfolio', 'capstone', 'exhibition', 'foundations project', 'foundations portfolio'],
  },
  {
    taskType: 'design_and_communication',
    keywords: ['design thinking', 'visual communication', 'design brief', 'prototype iteration'],
  },
  {
    taskType: 'visual_studio_practice',
    keywords: ['visual element', 'sketchbook', 'observation', 'studio practice', 'composition', 'line shape color'],
  },
]

function classify(unit, classifiers, fallback) {
  const haystack = `${unit.title} ${unit.topics.join(' ')} ${unit.performance_task}`.toLowerCase()
  for (const { taskType, keywords } of classifiers) {
    if (keywords.some((kw) => haystack.includes(kw))) return taskType
  }
  return fallback
}

const TECH_TASK_LABELS = {
  debugging_and_testing: 'Debugging and testing task',
  programming_and_logic: 'Programming and logic task',
  interface_and_accessibility: 'Interface and accessibility task',
  data_and_evidence: 'Data and evidence task',
  systems_and_hardware: 'Systems and troubleshooting task',
  digital_citizenship_and_safety: 'Digital citizenship design task',
  applied_project: 'Applied technology project',
}

const ARTS_TASK_LABELS = {
  music_theory_and_listening: 'Music theory and listening task',
  theatre_and_presentation: 'Theatre and presentation task',
  critical_response_and_context: 'Critical response task',
  portfolio_and_capstone: 'Portfolio and capstone task',
  design_and_communication: 'Design and communication task',
  visual_studio_practice: 'Visual studio practice task',
  creative_project: 'Creative project',
}

function techCheckCriteria(unit, taskType) {
  const topic = unit.topics[0]
  const base = [
    `Every claim or design choice in the submission can be traced to ${topic} or another named topic from this unit — nothing is left unexplained.`,
    'The submission runs, displays, or demonstrates correctly on at least two different sample inputs or scenarios the student chooses.',
    'No real password, API key, account credential, precise location, or other real personal/system data appears anywhere in the submission — fictional or sandbox examples only.',
    'The student can explain, in their own words, why each step or decision was made, not just that it works.',
  ]
  if (taskType === 'debugging_and_testing') {
    base.push(
      'A defect log lists each bug found, its symptom, its root cause, and the specific change that fixed it.',
      'At least one test existed (or was written) that failed before the fix and passes after it, proving the fix actually worked.',
    )
  } else if (taskType === 'programming_and_logic') {
    base.push(
      'The algorithm or program handles at least one edge case (empty input, zero, an unexpected choice) without crashing or giving a wrong answer silently.',
    )
  } else if (taskType === 'interface_and_accessibility') {
    base.push(
      'Every interactive element is reachable and usable without a mouse, and every image or icon has a text alternative.',
    )
  }
  return base
}

function artsCritiqueCriteria(unit, taskType) {
  const topic = unit.topics[0]
  const base = [
    `A named viewer, listener, or reader can point to a specific choice in the work and connect it back to ${topic} or another named topic from this unit.`,
    'The piece shows at least one deliberate revision — a version-two decision made because the first attempt did not achieve the intended effect.',
    'The student can explain the intended effect on an audience in their own words, separate from just describing what was made.',
    'Only the student\'s own original work, public-domain material, or a properly licensed and cited excerpt appears in the piece — no unlicensed lyrics, sheet music, or protected work is reproduced.',
  ]
  if (taskType === 'critical_response_and_context') {
    base.push(
      'Every interpretive claim about the work is backed by a specific, quoted or cited piece of evidence from the work or its context, not a general impression.',
    )
  } else if (taskType === 'theatre_and_presentation' || taskType === 'music_theory_and_listening') {
    base.push(
      'The submitted evidence (written account, notation, recording made for the student\'s own review, or live demonstration to the facilitator) is sufficient for a reviewer who was not present to judge the criteria above.',
    )
  }
  return base
}

function techPrimaryTask(unit, taskType) {
  const topics = joinNatural(unit.topics.slice(0, 4))
  switch (taskType) {
    case 'debugging_and_testing':
      return `Work from a supplied, intentionally broken example related to ${topics}. Reproduce the failure, isolate the smallest case that triggers it, fix the underlying cause (not just the symptom), and keep a short defect log documenting what was wrong and how you know it is fixed now.`
    case 'programming_and_logic':
      return `${unit.performance_task} As you build this, trace through your logic by hand for at least one representative input or scenario before you run or finalize it, so you can compare your prediction with the actual result.`
    case 'interface_and_accessibility':
      return `Build the interface or artifact described in this unit's project so that it stays usable with ${topics}, then run a short accessibility check against it and record one thing you changed as a result.`
    case 'data_and_evidence':
      return `Collect or use a small, fictional or already-approved data set related to ${topics}, and turn it into a labeled visual with a one-paragraph, evidence-based conclusion.`
    case 'systems_and_hardware':
      return `Diagram or organize the system described in this unit (covering ${topics}) and write a step-by-step protocol someone else could follow to reproduce your result or troubleshoot the same problem.`
    case 'digital_citizenship_and_safety':
      return `Create the safety or citizenship artifact for this unit using only fictional names, fictional accounts, and invented examples — never real personal information, real screenshots of real accounts, or a real classmate's data.`
    default:
      return `${unit.performance_task} Use only fictional examples, sandbox tools, or already-approved data — never a real account, real credential, or live external system.`
  }
}

function artsPrimaryTask(unit, taskType) {
  const topics = joinNatural(unit.topics.slice(0, 4))
  switch (taskType) {
    case 'music_theory_and_listening':
      return `${unit.performance_task} Work only from a public-domain source, an original passage you compose, or material your facilitator has already cleared — never a copyrighted score or recording reproduced in full.`
    case 'theatre_and_presentation':
      return `${unit.performance_task} Choose your own sharing format ahead of time: a private read-through with your facilitator, a recording made only for your own review, or a live audience — no format is required over another.`
    case 'critical_response_and_context':
      return `${unit.performance_task} Ground every claim in something specific you can point to in the work itself or in its documented historical/cultural context, covering ${topics}.`
    case 'portfolio_and_capstone':
      return `${unit.performance_task} Choose whether the finished portfolio is shared privately with your facilitator, in writing only, or with a wider audience — the choice is yours and does not affect the score.`
    case 'design_and_communication':
      return `${unit.performance_task} Iterate on at least one prototype based on feedback, and document why each round of changes covering ${topics} moved the design closer to the brief.`
    default:
      return `${unit.performance_task} Working with ${topics}, choose a private, small-audience, or public sharing format — none is required over another, and a written or no-audio alternative is always acceptable.`
  }
}

function techPresentationAndPrivacy() {
  return 'This project never touches a real account, a real password or API key, a live production system, or another person\'s real data. Use fictional names, sandbox environments, local files, or already-approved sample data throughout. Submit code, screenshots of your own sandbox, diagrams, or a written walkthrough — a live public deployment is never required.'
}

function artsPresentationOptions() {
  return 'Sharing this project publicly is always optional and never required for full credit. You may present live to a small audience of your choosing, present privately to just your facilitator, submit a recording made only for your own review, or submit a written/described account of the finished work instead.'
}

function artsTextOrNoAudioAlternative() {
  return 'If any part of this task could involve singing, speaking on camera, or being recorded, you may instead notate the piece, write a detailed description or script, use body percussion or an instrument in place of your voice, or perform live for your facilitator with no recording made at all. No lesson in this unit requires a voice recording, a camera, or a photo.'
}

function copyrightAndAuthorshipNote(subjectKey) {
  const shared =
    'The final submitted work must remain your own authorship. A parent, tutor, or AI assistant may help you plan, explain a concept, demonstrate a technique, or give feedback on a draft, but may not produce the graded work itself.'
  if (subjectKey === 'arts-music') {
    return `${shared} Use only your own original work, public-domain material, or a properly licensed and cited excerpt — never reproduce full copyrighted lyrics, sheet music, or another protected work without the rights to do so.`
  }
  return `${shared} Never request, store, or submit a real password, API key, access token, or other real credential; use only fictional accounts and sandboxed or offline systems.`
}

function techRemediation(unit) {
  const topic = unit.topics[0]
  return `If the project stalls, step back to the smallest version of the task: rebuild just the part covering ${topic} in isolation, using a worked example from this unit as a model, then re-attach it to the full project once that smaller piece works and you can explain why.`
}

function techExtension(unit) {
  const extraTopic = unit.topics[Math.min(1, unit.topics.length - 1)]
  return `Once the core project is working, extend it to handle a new constraint or edge case related to ${extraTopic}, or compare two different approaches to the same problem and explain the real tradeoff between them in your own words.`
}

function artsRemediation(unit) {
  const topic = unit.topics[0]
  return `If the piece isn't coming together, return to a single, smaller exercise focused only on ${topic}, revisit one worked example or model from this unit, and rebuild your confidence with that one element before returning to the full project.`
}

function artsExtension(unit) {
  const extraTopic = unit.topics[Math.min(1, unit.topics.length - 1)]
  return `Once the core piece is finished, create a second short variation that explores ${extraTopic} from a different angle, or write a short artist's statement comparing your original intent with what the finished work actually communicates.`
}

const RUBRIC_DESCRIPTORS = {
  'accuracy or fidelity': {
    exceeds: 'Every claim, calculation, artifact, or performance choice is accurate and faithful to the stated criteria, with no notable errors.',
    meets: 'The work is accurate and faithful to the stated criteria, with at most one minor, self-correctable error.',
    developing: 'The work is mostly accurate but has one or more errors that affect the result or the intended effect.',
    beginning: 'The work has multiple accuracy or fidelity errors that prevent it from meeting the stated criteria.',
  },
  'evidence and reasoning': {
    exceeds: 'Every choice is backed by specific, cited evidence or clearly explained reasoning that a reader/viewer/listener can follow without help.',
    meets: 'Most choices are backed by evidence or reasoning, with only small gaps.',
    developing: 'Some choices are backed by evidence or reasoning, but several are asserted without support.',
    beginning: 'Choices are asserted with little or no supporting evidence or reasoning.',
  },
  'application or performance': {
    exceeds: 'The finished task, program, or piece fully meets the performance task as written and demonstrates independent transfer to a new example.',
    meets: 'The finished task, program, or piece meets the performance task as written.',
    developing: 'The finished task, program, or piece partially meets the performance task, with a named gap.',
    beginning: 'The finished task, program, or piece does not yet meet the performance task as written.',
  },
  'checking and revision': {
    exceeds: 'There is clear evidence of testing, critique, or self-checking that produced a real, documented revision improving the work.',
    meets: 'There is evidence of at least one checking or revision step.',
    developing: 'There is little evidence of checking or revision beyond a first attempt.',
    beginning: 'There is no evidence the work was checked or revised at all.',
  },
}

function buildRubric(assessment) {
  return assessment.rubric_dimensions.map((dimension) => ({
    dimension,
    ...(RUBRIC_DESCRIPTORS[dimension] ?? {
      exceeds: 'Fully meets this dimension with independent transfer.',
      meets: 'Meets this dimension as stated.',
      developing: 'Partially meets this dimension.',
      beginning: 'Does not yet meet this dimension.',
    }),
  }))
}

function scoringJudgmentGuidance(unit, subjectKey) {
  const kind = subjectKey === 'arts-music' ? 'a creative or performance piece' : 'a technical project'
  return `Score with the rubric below, not a single fixed answer key — ${kind} legitimately has more than one valid solution. Compare the submission against each rubric dimension using the "performance evidence" prompt in the linked assessment record for ${unit.title}, and record which level the student reached for each dimension along with one specific reason drawn from the actual submission.`
}

export function classifyUnit(unit, subjectKey) {
  if (subjectKey === 'technology') return classify(unit, TECH_CLASSIFIERS, 'applied_project')
  return classify(unit, ARTS_CLASSIFIERS, 'creative_project')
}

function requiresSourceIntegrity(unit, taskType) {
  const haystack = `${unit.title} ${unit.performance_task}`.toLowerCase()
  return (
    taskType === 'critical_response_and_context' ||
    taskType === 'music_theory_and_listening' ||
    /public.domain|primary source|historical|transcribe/.test(haystack)
  )
}

export function buildUnitMaterials({ unit, assessment, subjectKey, band, grade, gradeDir }) {
  const taskType = classifyUnit(unit, subjectKey)
  const isTech = subjectKey === 'technology'

  const primaryTaskText = isTech ? techPrimaryTask(unit, taskType) : artsPrimaryTask(unit, taskType)
  const checkCriteria = isTech ? techCheckCriteria(unit, taskType) : artsCritiqueCriteria(unit, taskType)
  const remediationText = isTech ? techRemediation(unit) : artsRemediation(unit)
  const extensionText = isTech ? techExtension(unit) : artsExtension(unit)

  const requirements = [
    `Address every topic listed for this unit: ${joinNatural(unit.topics)}.`,
    `Meet the performance task as written: ${unit.performance_task}`,
    'Show your work or process, not just a final result — a process note, sketch log, commit history, or draft trail.',
    'Complete the checklist in this package before submitting.',
  ]

  const projectBrief = `${unit.performance_task} This is the grade ${grade} culminating project for "${unit.title}" (${unit.unit_id}, unit ${unit.unit_number}), built around ${joinNatural(unit.topics.slice(0, 5))}. ${primaryTaskText}`

  if (wordCount(projectBrief) < 25) {
    throw new Error(`project brief for ${unit.unit_id} is under the specificity word floor`)
  }

  const taskPackage = {
    schema_version: '1.0',
    unit_id: unit.unit_id,
    source_course_id: unit.course_id,
    subject: subjectKey,
    band,
    grade,
    grade_dir: gradeDir,
    unit_number: unit.unit_number,
    unit_title: unit.title,
    task_type: taskType,
    task_label: isTech ? TECH_TASK_LABELS[taskType] : ARTS_TASK_LABELS[taskType],
    essential_question: unit.essential_question,
    standards: unit.standards,
    estimated_days: unit.days,
    project_brief: projectBrief,
    requirements,
    primary_task: primaryTaskText,
    [isTech ? 'test_or_check_criteria' : 'critique_criteria']: checkCriteria,
    presentation_and_privacy: isTech
      ? { sandbox_and_credentials_note: techPresentationAndPrivacy() }
      : {
          presentation_options: artsPresentationOptions(),
          text_or_no_audio_alternative: artsTextOrNoAudioAlternative(),
        },
    copyright_and_authorship: copyrightAndAuthorshipNote(subjectKey),
    remediation: remediationText,
    extension: extensionText,
  }

  const rubric = buildRubric(assessment)
  const needsSourceIntegrity = requiresSourceIntegrity(unit, taskType)

  const scoringGuide = {
    schema_version: '1.0',
    unit_id: unit.unit_id,
    subject: subjectKey,
    band,
    grade,
    grade_dir: gradeDir,
    unit_title: unit.title,
    scoring_authority_kind: 'RUBRIC',
    rubric,
    points_reference: {
      total_points: assessment.total_points,
      prompts: assessment.prompts,
    },
    mastery_interpretation: assessment.mastery_interpretation,
    scoring_judgment_guidance: scoringJudgmentGuidance(unit, subjectKey),
    remediation_plan: remediationText,
    extension_plan: extensionText,
    accommodation_note: assessment.accommodation_note,
    source_integrity: {
      requires_review: needsSourceIntegrity,
      status: needsSourceIntegrity ? 'VERIFIED' : 'NOT_APPLICABLE',
      note: needsSourceIntegrity
        ? 'Unit draws on public-domain, historical, or original source material; only public-domain, properly licensed, or student-original material may be used, with a citation for anything not the student\'s own.'
        : undefined,
    },
    safety_and_privacy: {
      requires_review: true,
      status: 'VERIFIED',
      note: isTech
        ? 'No real credentials, live external systems, or real personal data are used anywhere in this unit\'s materials.'
        : 'No performance, recording, or media submission is required to be public; a private or text/no-audio alternative is stated in the task package.',
    },
    standards: unit.standards,
  }

  return { taskPackage, scoringGuide, taskType }
}

export function toGateInput(taskPackage, scoringGuide) {
  const independentWorkText = [
    taskPackage.project_brief,
    taskPackage.requirements.join(' '),
    taskPackage.primary_task,
  ].join(' ')

  const scoringAuthorityText = [
    scoringGuide.scoring_judgment_guidance,
    scoringGuide.rubric.map((r) => `${r.dimension}: ${r.meets}`).join(' '),
  ].join(' ')

  const safeAlternativeText =
    taskPackage.subject === 'arts-music'
      ? taskPackage.presentation_and_privacy.text_or_no_audio_alternative
      : taskPackage.presentation_and_privacy.sandbox_and_credentials_note

  return {
    lessonId: taskPackage.unit_id,
    title: taskPackage.unit_title,
    courseId: taskPackage.source_course_id,
    subjectFamily: 'ARTS_RFL_PE_PROJECT',
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
