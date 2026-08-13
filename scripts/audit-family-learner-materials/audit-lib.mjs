import { createHash } from 'node:crypto'

export const SCALAR_KEYS = Object.freeze([
  'objective',
  'scenario',
  'privacySafeScenario',
  'studentTask',
  'knowledgeCheck',
  'adaptationChoices',
  'extensionChallenge',
  'trustedAdultNote',
  'task_brief',
  'primary_task',
  'deliverable',
  'essential_question',
  'remediation',
  'extension',
  'copyright_and_authorship',
])

export const ARRAY_KEYS = Object.freeze([
  'materials',
  'keyPoints',
  'movementCues',
  'completionCriteria',
  'accessibilitySupports',
  'neverRequires',
  'safetyNotes',
  'learning_objectives',
  'lesson_success_criteria',
  'task_steps',
  'requirements',
  'critique_criteria',
  'test_or_check_criteria',
  'safety_and_privacy_rules',
  'accessibility_options',
  'task_accessibility_provisions',
])

export function asText(value) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && typeof value.text === 'string' && value.text.trim()) {
    return value.text.trim()
  }
  return null
}

function titleize(key) {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** Exact in-memory equivalent of scripts/build-final-family-pilot-data.mjs. */
export function projectJsonMaterial(value, binding, fallbackTitle = binding.lessonRef) {
  const sections = []
  const add = (title, body, prompts = []) => {
    const text = asText(body)
    const safePrompts = prompts.filter((item) => typeof item === 'string' && item.trim())
    if (text || safePrompts.length) {
      sections.push({ title, ...(text ? { body: text } : {}), prompts: safePrompts })
    }
  }

  add('Lesson goal', value.objective)
  add('Scenario', value.scenario)
  for (const key of SCALAR_KEYS) {
    if (key === 'objective' || key === 'scenario') continue
    add(titleize(key), value[key])
  }
  for (const key of ARRAY_KEYS) {
    if (!Array.isArray(value[key])) continue
    add(titleize(key), null, value[key].filter((item) => typeof item === 'string'))
  }

  if (Array.isArray(value.sections)) {
    for (const section of value.sections) {
      const prompts = []
      for (const item of Array.isArray(section.items) ? section.items : []) {
        if (typeof item.prompt === 'string') {
          const choices = Array.isArray(item.choices) ? `\nChoices: ${item.choices.join(' · ')}` : ''
          prompts.push(`${item.prompt}${choices}`)
        }
        if (Array.isArray(item.workedSolution?.steps)) prompts.push(...item.workedSolution.steps)
      }
      add(section.title || section.kind || 'Lesson work', section.directions, prompts)
    }
  }

  if (Array.isArray(value.tasks)) {
    for (const task of value.tasks) {
      add(
        String(task.kind || task.taskId || 'Task').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        task.directions,
        (Array.isArray(task.prompts) ? task.prompts : []).map((prompt) => prompt.text).filter(Boolean),
      )
    }
  }

  add('Source or reading', value.sourceReference)
  add('Guided support', value.guidedSupport)
  add('Independent evidence', value.independentEvidenceTask)
  add('Equal-credit alternative', value.simulationAlternative?.description)
  add('Optional reflection', value.optionalReflection?.prompt)
  add('Media fallback', value.media?.fallback)

  return {
    materialRef: `production-material:${binding.lessonRef}`,
    lessonRef: binding.lessonRef,
    title: value.lessonRef?.title || value.title || value.lesson_title || fallbackTitle,
    subject: binding.subject,
    format: 'structured',
    sections,
  }
}

export function projectMarkdownMaterial(markdown, binding, fallbackTitle = binding.lessonRef) {
  return {
    materialRef: `production-material:${binding.lessonRef}`,
    lessonRef: binding.lessonRef,
    title: markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallbackTitle,
    subject: binding.subject,
    format: 'markdown',
    markdown,
  }
}

export function hashText(text) {
  return createHash('sha256').update(String(text)).digest('hex')
}

export function normalizedText(text) {
  return String(text ?? '').trim().replace(/\s+/g, ' ')
}

export function walk(value, visit, path = '$') {
  visit(value, path)
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${path}[${index}]`))
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) walk(item, visit, `${path}.${key}`)
  }
}

export function adultLeakPaths(value) {
  const paths = []
  const forbiddenKey = /^(answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex)$/i
  const forbiddenText = /(?:answer-keys|scoring-guide|teacher-guide)/i
  walk(value, (candidate, path) => {
    const key = path.split('.').at(-1)
    if (forbiddenKey.test(key) || (typeof candidate === 'string' && forbiddenText.test(candidate))) paths.push(path)
  })
  return paths
}

export function sourceChoices(value) {
  const rows = []
  walk(value, (candidate, path) => {
    if (candidate && typeof candidate === 'object' && Array.isArray(candidate.choices) && candidate.choices.length) {
      rows.push({ path, count: candidate.choices.length, promptType: candidate.promptType ?? candidate.kind ?? candidate.itemType ?? 'choice' })
    }
  })
  return rows
}

export function sourceResponseTypes(subject, value, markdown) {
  if (markdown !== null) return ['written-or-performance-offline']
  if (subject === 'mathematics') {
    return [...new Set((value.sections ?? []).flatMap((section) => (section.items ?? []).map((item) => item.kind ?? item.itemType ?? 'item')))].sort()
  }
  if (Array.isArray(value.tasks)) {
    return [...new Set(value.tasks.flatMap((task) => (task.prompts ?? []).map((prompt) => prompt.promptType ?? 'prompt')))].sort()
  }
  if (subject === 'english-language-arts') return ['source-reading', 'written-or-spoken-response']
  if (subject === 'health') return ['scenario-response', 'knowledge-check']
  if (subject === 'physical-education') return ['performance-or-adapted-response', 'knowledge-check']
  if (subject === 'technology') return ['project-artifact', 'test-or-check']
  if (subject === 'arts-and-music') return ['project-or-performance-artifact', 'critique']
  return ['written-or-performance-offline']
}

function markdownQuestionCount(markdown) {
  const scienceQuestions = [...markdown.matchAll(/^\*\*Q\d+\.\*\*/gm)].length
  if (scienceQuestions) return scienceQuestions
  if (/^## 3\. Independent response$/m.test(markdown)) return 2
  return [...markdown.matchAll(/(?:^|\n)(?:[-*]\s+|\*\*[^*?]+\?\*\*)/g)].length
}

export function sourceShape(subject, value, markdown) {
  if (markdown !== null) {
    return {
      sectionCount: [...markdown.matchAll(/^##\s+/gm)].length,
      itemCount: markdownQuestionCount(markdown),
      choiceItemCount: 0,
      responseTypes: sourceResponseTypes(subject, value, markdown),
      taskPresent: /(?:\*\*The task\.\*\*|## 3\. Independent response)/.test(markdown),
      rubricPresent: /(?:How this is scored|## 5\. Rubric)/i.test(markdown),
    }
  }

  const choices = sourceChoices(value)
  if (subject === 'mathematics') {
    const sections = value.sections ?? []
    return {
      sectionCount: sections.length,
      itemCount: sections.reduce((sum, section) => sum + (section.items?.length ?? 0), 0),
      choiceItemCount: choices.length,
      responseTypes: sourceResponseTypes(subject, value, null),
      taskPresent: sections.some((section) => (section.items?.length ?? 0) > 0),
      rubricPresent: false,
    }
  }
  if (Array.isArray(value.tasks)) {
    return {
      sectionCount: value.tasks.length,
      itemCount: value.tasks.reduce((sum, task) => sum + (task.prompts?.length ?? 0), 0),
      choiceItemCount: choices.length,
      responseTypes: sourceResponseTypes(subject, value, null),
      taskPresent: value.tasks.some((task) => (task.prompts?.length ?? 0) > 0),
      rubricPresent: Boolean(value.scoringRef || value.responseScoring),
    }
  }
  if (subject === 'english-language-arts') {
    const sourceRefs = value.sourceReference?.refs?.length ?? (asText(value.sourceReference) ? 1 : 0)
    return {
      sectionCount: ['studentTask', 'sourceReference', 'guidedSupport', 'independentEvidenceTask', 'remediation', 'extension'].filter((key) => value[key]?.present !== false && value[key] !== null && value[key] !== undefined).length,
      itemCount: 1 + sourceRefs,
      choiceItemCount: 0,
      responseTypes: sourceResponseTypes(subject, value, null),
      taskPresent: Boolean(asText(value.independentEvidenceTask)),
      rubricPresent: false,
    }
  }
  if (subject === 'health' || subject === 'physical-education') {
    return {
      sectionCount: ['privacySafeScenario', 'studentTask', 'knowledgeCheck', 'completionCriteria', 'adaptationChoices', 'optionalReflection'].filter((key) => value[key] !== null && value[key] !== undefined).length,
      itemCount: [value.studentTask, value.knowledgeCheck, value.optionalReflection?.prompt].filter((item) => typeof item === 'string' && item.trim()).length,
      choiceItemCount: 0,
      responseTypes: sourceResponseTypes(subject, value, null),
      taskPresent: Boolean(asText(value.studentTask)),
      rubricPresent: Array.isArray(value.completionCriteria) && value.completionCriteria.length > 0,
    }
  }
  const criteria = subject === 'technology' ? value.test_or_check_criteria : value.critique_criteria
  return {
    sectionCount: ['task_brief', 'primary_task', 'task_steps', 'requirements', 'deliverable', subject === 'technology' ? 'test_or_check_criteria' : 'critique_criteria'].filter((key) => value[key] !== null && value[key] !== undefined).length,
    itemCount: Array.isArray(value.task_steps) && value.task_steps.length ? value.task_steps.length : (asText(value.primary_task) ? 1 : 0),
    choiceItemCount: 0,
    responseTypes: sourceResponseTypes(subject, value, null),
    taskPresent: Boolean(asText(value.primary_task)),
    rubricPresent: Array.isArray(criteria) && criteria.length > 0,
  }
}

export function browserShape(material, source) {
  if (material.format === 'markdown') {
    return {
      sectionCount: source.sectionCount,
      itemCount: source.itemCount,
      choiceItemCount: 0,
      responseTypes: ['display-only-markdown'],
      interactiveResponseTypes: [],
      taskSemanticsPreserved: true,
      rubricSemanticsPreserved: true,
    }
  }
  return {
    sectionCount: material.sections.length,
    itemCount: material.sections.reduce((sum, section) => sum + section.prompts.length, 0),
    choiceItemCount: 0,
    responseTypes: ['display-only-string'],
    interactiveResponseTypes: [],
    taskSemanticsPreserved: false,
    rubricSemanticsPreserved: false,
  }
}

export function titlePhase(subject, value, markdown) {
  const title = markdown?.match(/^#\s+(.+)$/m)?.[1]?.trim()
    ?? value?.lessonRef?.title
    ?? value?.title
    ?? value?.lesson_title
    ?? ''
  const phase = value?.lessonRef?.phase ?? value?.blueprint?.phase ?? value?.phase
    ?? title.split(':')[0]
  return { title, phase }
}

export function actionableText(subject, value, markdown) {
  if (subject === 'mathematics') {
    return normalizedText((value.sections ?? []).flatMap((section) => (section.items ?? [])
      .filter((item) => item.kind !== 'worked-example')
      .map((item) => [item.prompt, ...(item.choices ?? [])].join('\n'))).join('\n'))
  }
  if (subject === 'english-language-arts') return normalizedText(asText(value.independentEvidenceTask))
  if (subject === 'health' || subject === 'physical-education') {
    return normalizedText([value.privacySafeScenario, value.studentTask, value.knowledgeCheck].filter(Boolean).join('\n'))
  }
  if (subject === 'ready-for-life' || subject === 'financial-literacy') {
    return normalizedText((value.tasks ?? []).flatMap((task) => (task.prompts ?? []).map((prompt) => prompt.text)).join('\n'))
  }
  if (subject === 'technology' || subject === 'arts-and-music') return normalizedText(value.primary_task)
  if (subject === 'science') {
    return normalizedText([...markdown.matchAll(/^\*\*Q\d+\.\*\*\s*([^\n]+)/gm)].map((match) => match[1]).join('\n'))
  }
  if (subject === 'social-studies') {
    return normalizedText(markdown.match(/## 3\. Independent response\n\n([\s\S]*?)\n\n## 4\./)?.[1])
  }
  return ''
}

export function emptyPromisedSections(value) {
  const findings = []
  for (const section of Array.isArray(value?.sections) ? value.sections : []) {
    if (Array.isArray(section.items) && section.items.length) continue
    const label = `${section.kind ?? ''} ${section.title ?? ''}`.toLowerCase()
    let code = 'OTHER_EMPTY_SECTION'
    if (/mastery/.test(label)) code = 'EMPTY_MASTERY_CHECK'
    else if (/independent/.test(label)) code = 'EMPTY_INDEPENDENT_PRACTICE'
    else if (/guided/.test(label)) code = 'EMPTY_GUIDED_PRACTICE'
    else if (/assessment|diagnostic|pre-assessment/.test(label)) code = 'EMPTY_ASSESSMENT'
    else if (/performance/.test(label)) code = 'EMPTY_PERFORMANCE_TASK'
    else if (/instruction|example/.test(label)) code = 'EMPTY_INSTRUCTION'
    else if (/source/.test(label)) code = 'EMPTY_SOURCE_REQUIREMENT'
    else if (/rubric|criteria/.test(label)) code = 'EMPTY_RUBRIC_OR_CRITERIA'
    findings.push({ code, kind: section.kind ?? null, title: section.title ?? null, directions: section.directions ?? null })
  }
  for (const task of Array.isArray(value?.tasks) ? value.tasks : []) {
    if (Array.isArray(task.prompts) && task.prompts.length) continue
    const label = `${task.kind ?? ''} ${task.taskId ?? ''}`.toLowerCase()
    const code = /assessment/.test(label) ? 'EMPTY_ASSESSMENT'
      : /performance/.test(label) ? 'EMPTY_PERFORMANCE_TASK'
        : 'OTHER_EMPTY_SECTION'
    findings.push({ code, kind: task.kind ?? null, title: task.taskId ?? null, directions: task.directions ?? null })
  }
  return findings
}

export function strictPlaceholder(raw) {
  return /(?:\bTODO\b|\bTBD\b|\bFIXME\b|lorem ipsum|\[placeholder\]|<placeholder>)/.test(raw)
}

export function inspectLesson({ binding, value, markdown, material }) {
  const { title, phase } = titlePhase(binding.subject, value, markdown)
  const action = actionableText(binding.subject, value, markdown)
  const emptySections = emptyPromisedSections(value)
  const choices = value ? sourceChoices(value) : []
  const findings = []
  let actionableClassification = action
    ? (['health', 'physical-education', 'ready-for-life', 'technology', 'arts-and-music'].includes(binding.subject)
        ? 'VALID_NONQUESTION_TASK'
        : 'ACTIONABLE_QUESTION_SET')
    : 'ZERO_ACTIONABLE_WORK_BLOCKER'

  if (!action) findings.push({ code: 'ZERO_ACTIONABLE_WORK', severity: 'BLOCKER' })

  if (value?.taskStepsRequired === true && (!Array.isArray(value.task_steps) || value.task_steps.length === 0)) {
    findings.push({ code: 'TASK_STEPS_MISSING', severity: 'BLOCKER' })
  }

  if (binding.subject === 'english-language-arts') {
    const generic = /^(?:Learner completes a new application of today's lesson|Attempt today's lesson without instruction|The learner attempts today's lesson once on their own|The learner completes a short diagnostic on today's lesson without help)/i.test(action)
    if (generic) {
      actionableClassification = 'ZERO_ACTIONABLE_WORK_BLOCKER'
      findings.push({ code: 'GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK', severity: 'BLOCKER' })
    }
    if (Array.isArray(value.sourceReference?.refs) && value.sourceReference.refs.length && !asText(value.sourceReference)) {
      findings.push({ code: 'ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION', severity: 'BLOCKER', count: value.sourceReference.refs.length })
    }
    findings.push({ code: 'ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE', severity: 'ADVISORY' })
  }

  if (binding.subject === 'mathematics') {
    const responseItems = (value.sections ?? []).flatMap((section) => (section.items ?? []).filter((item) => item.kind !== 'worked-example'))
    if (responseItems.length && responseItems.every((item) => /strategy|habit/i.test(`${item.itemType ?? ''} ${item.prompt ?? ''}`))) {
      actionableClassification = 'QUESTIONABLE_ACTIONABLE_WORK'
      findings.push({ code: 'MATH_STRATEGY_ONLY_DIAGNOSTIC', severity: 'BLOCKER', count: responseItems.length })
    }
  }

  for (const empty of emptySections) findings.push({ code: empty.code, severity: 'BLOCKER', section: empty })
  if (choices.length) {
    const flattened = binding.subject === 'mathematics'
    findings.push({
      code: flattened ? 'CHOICES_FLATTENED_TO_DISPLAY_TEXT' : 'CHOICES_DROPPED_FROM_BROWSER_STRUCTURE',
      severity: 'BLOCKER',
      choiceItems: choices.length,
      choices: choices.reduce((sum, row) => sum + row.count, 0),
    })
  }

  if (binding.sourceRuntimeState === 'PENDING_SOURCE_ATTACHMENT') {
    findings.push({ code: 'PENDING_SOURCE_ATTACHMENT', severity: 'LIMITATION' })
  }
  if (/concrete task above is built from this lesson's own question/i.test(markdown ?? '')) {
    findings.push({ code: 'SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP', severity: 'ADVISORY' })
  }
  if (/Learner completes a new application of/i.test(markdown ?? '')) {
    findings.push({ code: 'GENERIC_NEW_APPLICATION_TASK_SHELL', severity: 'ADVISORY' })
  }
  if (strictPlaceholder(markdown ?? JSON.stringify(value))) {
    findings.push({ code: 'PLACEHOLDER_OR_TEMPLATE_RESIDUE', severity: 'BLOCKER' })
  }

  if (binding.completionAuthority === 'GUARDIAN_ATTESTATION_REQUIRED') {
    const sourceAlternative = value?.simulationAlternative?.description
    if (!binding.equalCreditSimulation?.present || !binding.equalCreditSimulation?.description || !sourceAlternative) {
      findings.push({ code: 'ATTESTATION_EQUAL_CREDIT_PATH_MISSING', severity: 'BLOCKER' })
    }
  }

  const source = sourceShape(binding.subject, value, markdown)
  const browser = browserShape(material, source)
  findings.push({ code: 'RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP', severity: 'BLOCKER', sourceResponseTypes: source.responseTypes })

  const sourcePhase = String(phase).trim().toLowerCase()
  const titlePhaseText = title.split(':')[0].trim().toLowerCase()
  if (sourcePhase && titlePhaseText && sourcePhase !== titlePhaseText && !sourcePhase.includes(titlePhaseText) && !titlePhaseText.includes(sourcePhase)) {
    findings.push({ code: 'DECLARED_PHASE_TITLE_MISMATCH', severity: 'ADVISORY', phase, title })
  }

  const diagnostic = /diagnostic|baseline|pre-assessment|assessment|mastery|placement|starting point/i.test(`${title} ${phase} ${JSON.stringify(value?.blueprint ?? {})}`)
  return {
    title,
    phase,
    actionableClassification,
    actionableTextHash: hashText(action),
    actionableText: action,
    emptySections,
    findings,
    diagnostic: diagnostic ? {
      detected: true,
      evidenceItemCount: source.itemCount,
      scoringAuthorityPresent: Boolean(binding.scoringAuthorityRef),
      affectsOfficialWorkingLevel: false,
      role: /diagnostic|baseline|pre-assessment|starting point/i.test(`${title} ${phase}`) ? 'starting-point-or-informational' : 'lesson-evidence',
    } : { detected: false },
    sourceStructure: source,
    browserStructure: browser,
  }
}

/** Synthetic-fixture entry point used by the deterministic mutation controls. */
export function auditSyntheticLesson(fixture) {
  const binding = {
    lessonRef: fixture.lessonRef ?? 'synthetic-lesson',
    subject: fixture.subject ?? 'mathematics',
    sourceRuntimeState: fixture.sourceRuntimeState ?? 'READY',
    completionAuthority: fixture.completionAuthority ?? 'LEARNER_AUTHORITY',
    scoringAuthorityRef: fixture.scoringAuthorityRef ?? null,
    equalCreditSimulation: fixture.equalCreditSimulation,
  }
  const value = fixture.value ?? {}
  const markdown = fixture.markdown ?? null
  const material = fixture.projectedMaterial ?? (markdown === null
    ? projectJsonMaterial(value, binding)
    : projectMarkdownMaterial(markdown, binding))
  const result = inspectLesson({ binding, value, markdown, material })
  const leaks = adultLeakPaths(material)
  if (leaks.length) result.findings.push({ code: 'ADULT_SCORING_OR_ANSWER_LEAK', severity: 'BLOCKER', paths: leaks })
  return result
}

export function auditSyntheticAssessment(fixture) {
  const learnerMaterialExists = fixture.learnerMaterial !== null && fixture.learnerMaterial !== undefined
  let evidenceItemCount = 0
  if (learnerMaterialExists) {
    walk(fixture.learnerMaterial, (candidate) => {
      if (candidate && typeof candidate === 'object' && (typeof candidate.prompt === 'string' || typeof candidate.text === 'string')) evidenceItemCount += 1
    })
  }
  return {
    learnerMaterialExists,
    evidenceItemCount,
    usableLearnerMaterial: learnerMaterialExists && evidenceItemCount > 0,
    emptyAssessmentMaterial: !learnerMaterialExists || evidenceItemCount === 0,
  }
}

export function crossGradeDuplicateGroups(rows) {
  const buckets = new Map()
  for (const row of rows) {
    const bucket = buckets.get(row.actionableTextHash) ?? []
    bucket.push(row)
    buckets.set(row.actionableTextHash, bucket)
  }
  return [...buckets.entries()].flatMap(([hash, bucket]) => {
    const grades = [...new Set(bucket.map((row) => row.grade))].sort((left, right) => left - right)
    return grades.length > 1 ? [{ hash, grades, count: bucket.length }] : []
  })
}
