export const STRUCTURED_PROJECTION_VERSION = 'manuel-academy.learner-structured-projection.v1'

const FORBIDDEN_KEY = /^(?:answerKeyRef|answerIndex|correctAnswer|scoringAuthorityRef|scoringRef|adultScoringGuide|adultRemediationOracle|teacherGuide|privateNotes?|serviceCredentials?|credentialSecret)$/i
const FORBIDDEN_LOCATOR = /(?:\/answer[-_]keys?\/|\/scoring\/|scoring[-_]guides?|teacher[-_]guides?)/i
const FORBIDDEN_MARKDOWN = /(?:^|\n)#{2,3}\s+(?:For the adult|Acceptable-answer criteria|Remediation)\b|Tutor\/scoring boundary|adult scoring sheet/i

const titleCase = (value) => String(value)
  .replaceAll('_', ' ')
  .replaceAll('-', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase())

const asText = (value) => {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && typeof value.text === 'string' && value.text.trim()) {
    return value.text.trim()
  }
  return null
}

const asStrings = (value) => Array.isArray(value)
  ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
  : []

const compactObject = (value) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== null),
)

const stableRef = (lessonRef, sourceRef, fallback) => {
  const local = typeof sourceRef === 'string' && sourceRef.trim() ? sourceRef.trim() : fallback
  return local.startsWith(`${lessonRef}#`) ? local : `${lessonRef}#${local}`
}

const projectChoices = (choices) => asStrings(choices)

function finalizeItemStats(sections, stats) {
  const items = sections.flatMap((section) => Array.isArray(section.items) ? section.items : [])
  stats.itemsProjected = items.length
  stats.choiceItemsProjected = items.filter((item) => Array.isArray(item.choices) && item.choices.length).length
  stats.choicesPreserved = items.reduce((sum, item) => sum + (Array.isArray(item.choices) ? item.choices.length : 0), 0)
}

function responseKindFor(itemKind, responseMode, choices = []) {
  if (itemKind === 'worked-example' || responseMode === 'instructional-example') return 'READ'
  if (choices.length || itemKind === 'multiple-choice') return 'CHOICE'
  const value = `${itemKind || ''} ${responseMode || ''}`.toLowerCase()
  if (/numeric|number|calculation|fixed/.test(value)) return 'NUMERIC'
  if (/short/.test(value)) return 'TEXT'
  return 'CONSTRUCTED_RESPONSE'
}

function projectWorkedSolution(item, sectionKind, stats) {
  if (!item.workedSolution) return null
  if (sectionKind !== 'instructional-example' || item.kind !== 'worked-example') {
    stats.adultFieldsRemoved += 1
    return null
  }
  const steps = asStrings(item.workedSolution.steps)
  const answer = asText(item.workedSolution.answer)
  if (!steps.length && !answer) return null
  stats.instructionalWorkedSolutions += 1
  return compactObject({ steps, answer })
}

function projectMathItem(item, section, lessonRef, itemIndex, stats) {
  const choices = projectChoices(item.choices)
  const workedSolution = projectWorkedSolution(item, section.kind, stats)
  stats.itemsProjected += 1
  stats.choicesPreserved += choices.length
  if (choices.length) stats.choiceItemsProjected += 1
  const responseKind = responseKindFor(item.kind, item.responseExpectation || item.responseType, choices)
  return compactObject({
    itemRef: stableRef(lessonRef, item.ref, `${section.sectionId || section.kind}-item-${itemIndex + 1}`),
    itemKind: asText(item.kind),
    itemType: asText(item.itemType),
    prompt: asText(item.prompt),
    choices: choices.length ? choices : undefined,
    responseType: item.kind === 'multiple-choice'
      ? 'single-choice'
      : item.kind === 'constructed-response'
        ? 'constructed-response'
        : item.kind === 'worked-example'
          ? 'instructional-example'
          : asText(item.responseType),
    responseKind,
    responseExpectation: asText(item.responseExpectation),
    standard: asText(item.standard),
    workedSolution: workedSolution || undefined,
  })
}

function projectMathSections(value, lessonRef, stats) {
  return (Array.isArray(value.sections) ? value.sections : []).map((section, sectionIndex) => {
    const items = (Array.isArray(section.items) ? section.items : [])
      .map((item, itemIndex) => projectMathItem(item, section, lessonRef, itemIndex, stats))
    return compactObject({
      sectionRef: stableRef(lessonRef, section.sectionId, `section-${sectionIndex + 1}`),
      sectionKind: asText(section.kind) || 'lesson-work',
      title: asText(section.title) || titleCase(section.kind || 'Lesson work'),
      directions: asText(section.directions),
      body: asText(section.directions),
      items,
      // Compatibility projection for the current read-only Lesson Player. Choice
      // values and response semantics live only in the structured items above.
      prompts: items.map((item) => item.prompt).filter(Boolean),
    })
  })
}

function projectTaskSections(value, lessonRef, stats) {
  const responseModes = new Map(
    (Array.isArray(value.responseScoring?.items) ? value.responseScoring.items : [])
      .filter((item) => typeof item?.ref === 'string')
      .map((item) => [item.ref, asText(item.responseMode)]),
  )
  return (Array.isArray(value.tasks) ? value.tasks : []).map((task, taskIndex) => {
    stats.taskGroupsProjected += 1
    const items = (Array.isArray(task.prompts) ? task.prompts : []).map((prompt, promptIndex) => {
      const choices = projectChoices(prompt.choices)
      stats.itemsProjected += 1
      stats.choicesPreserved += choices.length
      if (choices.length) stats.choiceItemsProjected += 1
      const responseKind = responseKindFor(prompt.promptType, responseModes.get(prompt.ref) || prompt.responseType, choices)
      return compactObject({
        itemRef: stableRef(lessonRef, prompt.ref, `${task.taskId || `task-${taskIndex + 1}`}-prompt-${promptIndex + 1}`),
        sourceItemRef: asText(prompt.ref),
        itemKind: 'prompt',
        itemType: asText(prompt.promptType),
        prompt: asText(prompt.text),
        choices: choices.length ? choices : undefined,
        responseType: responseModes.get(prompt.ref) || asText(prompt.responseType) || asText(prompt.promptType),
        responseKind,
        unit: asText(prompt.unit),
      })
    })
    return compactObject({
      sectionRef: stableRef(lessonRef, task.taskId, `task-${taskIndex + 1}`),
      sourceSectionRef: asText(task.taskId),
      sectionKind: asText(task.kind) || 'task',
      title: titleCase(task.kind || task.taskId || `Task ${taskIndex + 1}`),
      directions: asText(task.directions),
      body: asText(task.directions),
      items,
      prompts: items.map((item) => item.prompt).filter(Boolean),
    })
  })
}

function projectTaskSteps(value, lessonRef, stats) {
  const steps = asStrings(value.task_steps).map((text, index) => ({
    stepRef: `${lessonRef}#task-step-${index + 1}`,
    text,
  }))
  stats.taskStepsProjected += steps.length
  return steps
}

function projectElaSources(sourceReference, stats) {
  if (!sourceReference || typeof sourceReference !== 'object') return null
  const sources = (Array.isArray(sourceReference.refs) ? sourceReference.refs : []).map((source) => compactObject({
    sourceRef: asText(source.textId),
    title: asText(source.title),
    author: asText(source.author),
    sourceKind: asText(source.form),
    rightsCategory: asText(source.rightsCategory),
    obtainNote: asText(source.obtainNote),
    accessibleRepresentation: asText(source.accessibleRepresentation),
  }))
  stats.sourceMetadataPreserved += sources.length
  return compactObject({
    state: sourceReference.present === false ? 'not-present' : 'available',
    selectionMode: asText(sourceReference.mode),
    selectionInstructions: asText(sourceReference.text),
    sources,
  })
}

function projectStaticSocialSource(source) {
  if (!source || typeof source !== 'object') return null
  return compactObject({
    sourceRef: asText(source.sourceKey),
    repository: asText(source.repository),
    sourceKind: asText(source.kind),
    title: asText(source.title),
    sourceDate: asText(source.sourceDate),
    createdPublished: asText(source.createdPublished),
    creators: Array.isArray(source.creators) ? source.creators : asText(source.creators),
    url: asText(source.url),
    rightsAndAccess: asText(source.rightsAndAccess),
    verification: source.verification && typeof source.verification === 'object'
      ? compactObject({
          status: asText(source.verification.status),
          checkedOn: asText(source.verification.checkedOn),
          linkStatus: asText(source.verification.linkStatus),
        })
      : undefined,
    quotationStored: source.quotationStored === false ? false : undefined,
  })
}

function projectSocialSources(binding, socialSourceRegistry, stats) {
  if (binding.subject !== 'social-studies') return null
  const sourceKeys = asStrings(binding.sourceMetadataProvenance?.sourceKeys)
  const sources = sourceKeys
    .map((sourceKey) => projectStaticSocialSource(socialSourceRegistry?.[sourceKey]))
    .filter(Boolean)
  stats.sourceMetadataPreserved += sources.length
  const contract = binding.sourceReadinessContract || {}
  const dynamic = binding.sourceReadinessKind === 'DYNAMIC_SOURCE_REQUIRED'
    ? compactObject({
        contractId: asText(contract.contractId),
        contractVersion: Number.isInteger(contract.contractVersion) ? contract.contractVersion : undefined,
        attachSourceAction: asText(contract.attachSourceAction),
        becomesRunnableWhen: asText(contract.becomesRunnableWhen),
        requiredAttachmentFields: asStrings(contract.requiredAttachmentFields),
        attachmentState: binding.sourceMetadataProvenance?.attachmentRecorded === false ? 'not-attached' : undefined,
      })
    : undefined
  if (dynamic) stats.dynamicSourceContractsPreserved += 1
  return compactObject({
    readinessKind: asText(binding.sourceReadinessKind),
    runtimeState: asText(binding.sourceRuntimeState),
    policy: asText(contract.policy),
    lessonLaunchState: asText(contract.lessonLaunch),
    verificationState: asText(binding.sourceMetadataProvenance?.state),
    inventedMetadataPermitted: binding.sourceMetadataProvenance?.inventedMetadataPermitted === false ? false : undefined,
    quotedSourceTextStored: binding.sourceMetadataProvenance?.quotedSourceTextStored === false ? false : undefined,
    sourceKeys,
    sources,
    dynamic,
  })
}

function addTextSection(sections, lessonRef, key, title, body, prompts = [], responseKind = null) {
  const text = asText(body)
  const safePrompts = asStrings(prompts)
  if (!text && !safePrompts.length) return
  const section = compactObject({
    sectionRef: `${lessonRef}#${key}`,
    sectionKind: key,
    title,
    body: text,
    prompts: safePrompts,
  })
  if (responseKind && text) {
    section.items = [{
      itemRef: `${lessonRef}#${key}`,
      sourceItemRef: key,
      itemKind: key,
      prompt: text,
      responseType: responseKind,
      responseKind,
      choices: [],
    }]
  }
  sections.push(section)
}

function projectGeneralSections(value, lessonRef, stats) {
  const sections = []
  addTextSection(sections, lessonRef, 'lesson-goal', 'Lesson goal', value.objective)
  addTextSection(sections, lessonRef, 'learning-objectives', 'Learning objectives', null, value.learning_objectives)
  addTextSection(sections, lessonRef, 'scenario', 'Scenario', value.scenario || value.privacySafeScenario)
  addTextSection(sections, lessonRef, 'student-task', 'Student task', value.studentTask, [],
    value.subject === 'physical-education' ? 'ACTIVITY_EVIDENCE' : 'CONSTRUCTED_RESPONSE')
  addTextSection(sections, lessonRef, 'task-brief', 'Task brief', value.task_brief)
  addTextSection(sections, lessonRef, 'primary-task', 'Primary task', value.primary_task, [], 'ACTIVITY_EVIDENCE')
  addTextSection(sections, lessonRef, 'knowledge-check', 'Knowledge check', value.knowledgeCheck, [], 'CONSTRUCTED_RESPONSE')
  addTextSection(sections, lessonRef, 'independent-evidence', 'Independent evidence', value.independentEvidenceTask, [], 'CONSTRUCTED_RESPONSE')
  addTextSection(sections, lessonRef, 'adaptation-choices', 'Adaptation choices', value.adaptationChoices)
  addTextSection(sections, lessonRef, 'deliverable', 'Deliverable', value.deliverable)
  addTextSection(sections, lessonRef, 'extension', 'Extension', value.extensionChallenge || value.extension)
  addTextSection(sections, lessonRef, 'optional-reflection', 'Optional reflection', value.optionalReflection?.prompt)
  addTextSection(sections, lessonRef, 'media-fallback', 'Media fallback', value.media?.fallback)
  addTextSection(sections, lessonRef, 'safety-notes', 'Safety notes', null, value.safetyNotes)
  addTextSection(sections, lessonRef, 'accessibility-supports', 'Accessibility supports', null, value.accessibilitySupports)
  addTextSection(sections, lessonRef, 'accessibility-options', 'Accessibility options', null, value.accessibility_options)
  addTextSection(sections, lessonRef, 'task-accessibility-provisions', 'Task accessibility provisions', null,
    value.task_accessibility_provisions)
  addTextSection(sections, lessonRef, 'requirements', 'Requirements', null, value.requirements)
  addTextSection(sections, lessonRef, 'success-criteria', 'Success criteria', null,
    value.lesson_success_criteria || value.completionCriteria)
  addTextSection(sections, lessonRef, 'rubric-facing-criteria', 'Rubric-facing criteria', null,
    value.critique_criteria || value.test_or_check_criteria)
  addTextSection(sections, lessonRef, 'safety-and-privacy-rules', 'Safety and privacy rules', null,
    value.safety_and_privacy_rules)
  addTextSection(sections, lessonRef, 'copyright-and-authorship', 'Copyright and authorship',
    value.copyright_and_authorship)
  addTextSection(sections, lessonRef, 'never-requires', 'This lesson never requires', null, value.neverRequires)
  if (typeof value.sourceReference === 'string') {
    addTextSection(sections, lessonRef, 'source-reading', 'Source or reading', value.sourceReference)
  }

  const steps = projectTaskSteps(value, lessonRef, stats)
  if (steps.length) {
    sections.push({
      sectionRef: `${lessonRef}#task-steps`,
      sectionKind: 'task-steps',
      title: 'Task steps',
      steps,
      prompts: steps.map((step) => step.text),
    })
  }
  return sections
}

function initialStats() {
  return {
    itemsProjected: 0,
    choiceItemsProjected: 0,
    choicesPreserved: 0,
    sourceMetadataPreserved: 0,
    dynamicSourceContractsPreserved: 0,
    taskGroupsProjected: 0,
    taskStepsProjected: 0,
    instructionalWorkedSolutions: 0,
    adultFieldsRemoved: 0,
  }
}

export function projectJsonLearnerMaterial(value, binding, fallbackTitle, options = {}) {
  const stats = initialStats()
  const lessonRef = binding.lessonRef
  let sections
  if (Array.isArray(value.sections)) sections = projectMathSections(value, lessonRef, stats)
  else if (Array.isArray(value.tasks)) sections = projectTaskSections(value, lessonRef, stats)
  else sections = projectGeneralSections(value, lessonRef, stats)

  for (const adultKey of ['scoringRef', 'remediation', 'guidedSupport', 'trustedAdultNote']) {
    if (value[adultKey] !== undefined && value[adultKey] !== null) stats.adultFieldsRemoved += 1
  }

  const essentialQuestion = asText(value.essentialQuestion)
    || asText(value.essential_question)
    || asText(value.unit_context?.essential_question)
  const materials = asStrings(value.materials)
  const successCriteria = asStrings(value.lesson_success_criteria || value.completionCriteria)
  const rubricCriteria = asStrings(value.critique_criteria || value.test_or_check_criteria)
  const taskSteps = sections.find((section) => section.sectionKind === 'task-steps')?.steps
  const simulationDescription = asText(value.simulationAlternative?.description)
  const elaSources = projectElaSources(value.sourceReference, stats)
  const socialSources = projectSocialSources(binding, options.socialSourceRegistry, stats)
  if (elaSources?.selectionInstructions) {
    sections.unshift({
      sectionRef: `${lessonRef}#source-reading`,
      sectionKind: 'source-reading',
      title: 'Source or reading',
      body: elaSources.selectionInstructions,
      prompts: [],
    })
  }

  const material = compactObject({
    dtoVersion: STRUCTURED_PROJECTION_VERSION,
    materialRef: `production-material:${lessonRef}`,
    lessonRef,
    title: value.lessonRef?.title || value.title || value.lesson_title || fallbackTitle,
    subject: binding.subject,
    format: 'structured',
    essentialQuestion,
    materials: materials.length ? materials : undefined,
    successCriteria: successCriteria.length ? successCriteria : undefined,
    rubricCriteria: rubricCriteria.length ? rubricCriteria : undefined,
    taskSteps,
    simulationAlternative: simulationDescription
      ? { available: value.simulationAlternative?.present !== false, description: simulationDescription }
      : undefined,
    workMode: asText(value.work_mode),
    scoringMode: asText(value.responseScoring?.mode),
    activitySetup: value.activity_setup,
    learnerResource: value.learner_resource,
    keyPoints: asStrings(value.keyPoints),
    movementCues: asStrings(value.movementCues),
    technique: asText(value.ageAppropriateTechnique),
    spaceSetup: asText(value.spaceSetup),
    accessibleAdaptation: asText(value.accessibleAdaptation),
    noEquipmentAlternative: asText(value.lowSpaceNoEquipmentAlternative),
    commonErrorToWatchFor: asText(value.commonErrorToWatchFor),
    safetyRules: asStrings(value.safetyRules),
    stoppingRules: asStrings(value.stoppingRules),
    equipmentRequirements: value.equipmentRequirements,
    activitySteps: asStrings(value.activitySteps),
    sourceMetadata: elaSources || socialSources || undefined,
    sections,
  })
  finalizeItemStats(sections, stats)
  assertLearnerSafeMaterial(material)
  return { material, stats }
}

function markdownHeading(line) {
  const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
  return match ? { level: match[1].length, title: match[2].trim() } : null
}

function removeMarkdownSections(markdown, titles) {
  const lines = markdown.split('\n')
  const output = []
  let skipLevel = null
  let removed = 0
  for (const line of lines) {
    const heading = markdownHeading(line)
    if (skipLevel !== null) {
      if (heading && heading.level <= skipLevel) skipLevel = null
      else continue
    }
    if (heading && titles.some((pattern) => pattern.test(heading.title))) {
      skipLevel = heading.level
      removed += 1
      continue
    }
    output.push(line)
  }
  return { markdown: output.join('\n'), removed }
}

function sanitizeMarkdown(markdown, subject) {
  const titles = subject === 'social-studies'
    ? [/^(?:6\.\s*)?Acceptable-answer criteria$/i, /^(?:7\.\s*)?Remediation$/i]
    : [/^For the adult, before the session$/i]
  const stripped = removeMarkdownSections(markdown, titles)
  let safe = stripped.markdown
    .replace(/^\*\*Tutor\/scoring boundary:\*\*.*(?:\n|$)/gm, '')
    .replace(/^A submission meets the lesson target.*adult scoring sheet.*(?:\n|$)/gm, '')
  const inlineRemoved = safe === stripped.markdown ? 0 : 1
  safe = safe.replace(/\n{3,}/g, '\n\n').trim()
  return { markdown: safe, removed: stripped.removed + inlineRemoved }
}

function splitMarkdownSections(markdown, lessonRef) {
  const lines = markdown.split('\n')
  const sections = []
  let current = { title: 'Lesson overview', kind: 'lesson-overview', lines: [] }
  const flush = () => {
    const body = current.lines.join('\n').trim()
    if (!body) return
    sections.push({
      sectionRef: `${lessonRef}#${current.kind}-${sections.length + 1}`,
      sectionKind: current.kind,
      title: current.title,
      body,
      prompts: [],
    })
  }
  for (const line of lines) {
    const heading = /^(##)\s+(.+?)\s*$/.exec(line)
    if (heading) {
      flush()
      const title = heading[2].trim()
      current = {
        title,
        kind: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section',
        lines: [],
      }
    } else if (!/^#\s+/.test(line)) current.lines.push(line)
  }
  flush()
  return sections
}

function extractMarkdownValue(markdown, label) {
  const match = new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.+)$`, 'mi').exec(markdown)
  return match?.[1]?.trim() || null
}

function extractBulletsAfter(markdown, label) {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => new RegExp(`^\\*\\*${label}:\\*\\*\\s*$`, 'i').test(line.trim()))
  if (start < 0) return []
  const result = []
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s+|^\*\*[^*]+:\*\*/.test(line)) break
    const match = /^\s*-\s+(.+)$/.exec(line)
    if (match) result.push(match[1].trim())
    else if (result.length && line.trim()) break
  }
  return result
}

function extractRubric(markdown) {
  const lines = markdown.split('\n')
  const headingIndex = lines.findIndex((line) => /^##\s+(?:5\.\s+Rubric|How this is scored)\s*$/i.test(line))
  if (headingIndex < 0) return []
  const table = []
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^##\s+/.test(line)) break
    if (/^\|/.test(line) && !/^\|\s*(?:---|:?-+)/.test(line)) {
      table.push(line.split('|').slice(1, -1).map((cell) => cell.trim()))
    }
  }
  if (table.length < 2) return []
  const [headers, ...rows] = table
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])))
}

function attachMarkdownResponseItems(sections, markdown, lessonRef, subject) {
  for (const section of sections) {
    const questions = [...(section.body || '').matchAll(/^\*\*Q(\d+)\.\*\*\s*([^\n]+)/gm)]
    if (!questions.length) continue
    section.items = questions.map((match) => ({
      itemRef: `${lessonRef}#Q${match[1]}`,
      sourceItemRef: `Q${match[1]}`,
      itemKind: 'question',
      prompt: match[2].trim(),
      responseType: 'CONSTRUCTED_RESPONSE',
      responseKind: 'CONSTRUCTED_RESPONSE',
      choices: [],
    }))
  }
  if (subject === 'social-studies') {
    const prompt = markdown.match(/## 3\. Independent response\n\n([\s\S]*?)(?:\n\n## 4\.|$)/)?.[1]?.trim()
    if (prompt) {
      const target = sections.find((section) => /independent-response/i.test(section.sectionKind)) ?? sections.at(-1)
      target.items = [{
        itemRef: `${lessonRef}#independent-response`,
        sourceItemRef: 'independent-response',
        itemKind: 'independent-response',
        prompt,
        responseType: 'CONSTRUCTED_RESPONSE',
        responseKind: 'CONSTRUCTED_RESPONSE',
        choices: [],
      }]
    }
  }
}

export function projectMarkdownLearnerMaterial(markdown, binding, fallbackTitle, options = {}) {
  const stats = initialStats()
  const sanitized = sanitizeMarkdown(markdown, binding.subject)
  stats.adultFieldsRemoved += sanitized.removed
  const sections = splitMarkdownSections(sanitized.markdown, binding.lessonRef)
  attachMarkdownResponseItems(sections, sanitized.markdown, binding.lessonRef, binding.subject)
  const inlineMaterials = extractMarkdownValue(sanitized.markdown, 'Materials')
  const materials = inlineMaterials
    ? inlineMaterials.split(';').map((item) => item.trim()).filter(Boolean)
    : extractBulletsAfter(sanitized.markdown, 'Materials')
  const successCriteria = extractBulletsAfter(sanitized.markdown, 'Lesson-specific success criteria')
    .concat(extractBulletsAfter(sanitized.markdown, 'You have met the target when'))
  const rubricCriteria = extractRubric(sanitized.markdown)
  const sourceMetadata = projectSocialSources(binding, options.socialSourceRegistry, stats)
  const alternativeSection = sections.find((section) => /alternative|not-doing-the-hands-on/i.test(section.sectionKind))
  const material = compactObject({
    dtoVersion: STRUCTURED_PROJECTION_VERSION,
    materialRef: `production-material:${binding.lessonRef}`,
    lessonRef: binding.lessonRef,
    title: markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallbackTitle,
    subject: binding.subject,
    format: 'markdown',
    essentialQuestion: extractMarkdownValue(sanitized.markdown, binding.subject === 'science' ? 'Unit question' : 'Essential question'),
    materials: materials.length ? materials : undefined,
    successCriteria: successCriteria.length ? successCriteria : undefined,
    rubricCriteria: rubricCriteria.length ? rubricCriteria : undefined,
    simulationAlternative: alternativeSection
      ? { available: true, sectionRef: alternativeSection.sectionRef }
      : undefined,
    sourceMetadata: sourceMetadata || undefined,
    sections,
    markdown: sanitized.markdown,
  })
  finalizeItemStats(sections, stats)
  assertLearnerSafeMaterial(material)
  return { material, stats }
}

export function isLearnerSafeResourceRef(ref) {
  return typeof ref === 'string' && !FORBIDDEN_LOCATOR.test(ref)
}

export function assertLearnerSafeMaterial(material) {
  const visit = (value, path = '$', sectionKind = null, itemKind = null) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, sectionKind, itemKind))
      return
    }
    if (!value || typeof value !== 'object') {
      if (typeof value === 'string' && FORBIDDEN_LOCATOR.test(value)) {
        throw new Error(`Learner projection contains an adult locator at ${path}`)
      }
      return
    }
    const nextSectionKind = value.sectionKind || sectionKind
    const nextItemKind = value.itemKind || itemKind
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key)) throw new Error(`Learner projection contains forbidden key ${path}.${key}`)
      if (key === 'workedSolution' && (nextSectionKind !== 'instructional-example' || nextItemKind !== 'worked-example')) {
        throw new Error(`Learner projection contains a graded worked solution at ${path}.${key}`)
      }
      visit(item, `${path}.${key}`, nextSectionKind, nextItemKind)
    }
  }
  visit(material)
  if (typeof material.markdown === 'string' && FORBIDDEN_MARKDOWN.test(material.markdown)) {
    throw new Error(`Learner projection contains an adult-only markdown section for ${material.lessonRef}`)
  }
  return material
}

export function createProjectionStats() {
  return {
    projectionVersion: STRUCTURED_PROJECTION_VERSION,
    lessonsProjected: 0,
    itemsProjected: 0,
    choiceItemsProjected: 0,
    choicesPreserved: 0,
    sourceMetadataPreserved: 0,
    dynamicSourceContractsPreserved: 0,
    taskGroupsProjected: 0,
    taskStepsProjected: 0,
    instructionalWorkedSolutions: 0,
    adultFieldsRemoved: 0,
    adultResourceLocatorsRemoved: 0,
  }
}

export function mergeProjectionStats(total, addition) {
  total.lessonsProjected += 1
  for (const [key, value] of Object.entries(addition)) {
    if (typeof value === 'number' && key in total) total[key] += value
  }
  return total
}
