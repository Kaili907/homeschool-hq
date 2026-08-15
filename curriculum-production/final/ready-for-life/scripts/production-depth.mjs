import { READY_FOR_LIFE_SAMPLE } from '../../../../src/study/family-pilot/ready-for-life-director-preview/sample.ts'

export const PRODUCTION_DEPTH_VERSION = 'ready-for-life-production-depth-r1'
export const LOCAL_AUTHORITY = 'MANUEL_ACADEMY_LOCAL_COMPOSITION'
export const APPROVED_ANCHOR_ID = 'ma-g3-ready-for-life-u01-l04'

const ARTIFACT_WORDS = Object.freeze(['card', 'checklist', 'example', 'guide', 'plan', 'reference', 'sample', 'scenario', 'table', 'template', 'worksheet'])
const SENSITIVE_EVIDENCE = Object.freeze([
  'names, signatures, addresses, or exact locations',
  'account, identification, medical, product, or medicine details',
  'photos, audio, video, passwords, or private household schedules',
])

function words(value) {
  return String(value ?? '').trim().split(/\s+/).filter(Boolean)
}

function firstSentence(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.match(/^.*?(?:[.!?](?=\s|$)|$)/)?.[0]?.trim() ?? text
}

function topicFor(pkg) {
  return pkg.lessonRef.title.replace(/^[^:]+:\s*/, '').replace(/[.!?]+$/, '').trim()
}

function resourceId(pkg, suffix) {
  return `${pkg.packageId}-${suffix}`
}

function distinct(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))]
}

function taskText(task) {
  return [task.directions, ...task.prompts.map((prompt) => prompt.text)].join(' ')
}

function taskByKinds(pkg, kinds) {
  return pkg.tasks.find((task) => kinds.includes(task.kind)) ?? pkg.tasks[0]
}

function proficientChecks(scoring) {
  return scoring.scoringAuthority.criteria.map((criterion) => {
    const level = criterion.levels.find((candidate) => /proficient|meets|secure/i.test(candidate.label)) ?? criterion.levels[Math.min(1, criterion.levels.length - 1)]
    return `${criterion.dimension}: ${level.descriptor}`
  })
}

function familyFor(pkg) {
  const text = `${pkg.lessonRef.unitTitle} ${pkg.lessonRef.title}`.toLowerCase()
  if (/capstone|transition-to-adulthood|operating system|integrat/.test(text)) return 'capstone-integration'
  if (/laundry|clothing|clothes|garment/.test(text)) return 'clothing-laundry'
  if (/kitchen|food|meal|cook|nutrition|snack/.test(text)) return 'food-kitchen'
  if (/health|body|rest|sleep|wellness|appointment/.test(text)) return 'health-self-management'
  if (/transport|travel|route|community navigation/.test(text)) return 'transportation-community'
  if (/career|job|workplace|professional|resume|interview|postsecondary|pathway/.test(text)) return 'career-work'
  if (/housing|living arrangement|household independence|home operations|maintenance/.test(text)) return 'housing-independent-living'
  if (/civic|public system|legal|identification|record/.test(text)) return 'civic-public-systems'
  if (/digital|consumer|purchase|agreement/.test(text)) return 'digital-consumer'
  if (/communication|boundary|family teamwork|support network|problem solving/.test(text)) return 'communication-relationships'
  if (/planning|time|belonging|executive|routine|organization/.test(text)) return 'planning-organization'
  return 'home-care'
}

function durationFor(pkg) {
  const text = [pkg.objective, pkg.scenario, ...pkg.tasks.map(taskText)].join(' ').toLowerCase()
  const grade = pkg.lessonRef.grade
  const activeLearnerTime = grade <= 5 ? '25–35 minutes' : grade <= 8 ? '35–45 minutes' : '45–60 minutes'
  let elapsedWindow = 'One session'
  if (/three (?:real,? )?consecutive days|three-day|3-day/.test(text)) elapsedWindow = 'Three consecutive days; active work is divided across short daily check-ins'
  else if (/\bweek\b|seven days|7 days/.test(text)) elapsedWindow = 'Up to seven days; use only the check-ins explicitly named in the task'
  else if (/tomorrow|next morning|overnight|next day/.test(text)) elapsedWindow = 'Two short sessions across one day; no continuous monitoring'
  return {
    activeLearnerTime,
    elapsedWindow,
    sessionPattern: grade <= 5
      ? '5 minutes model, 5–7 minutes guided try, 10–15 minutes learner task, 5 minutes evidence and retry check'
      : '8–10 minutes model and planning, 8–10 minutes guided try, 20–30 minutes application, 7–10 minutes evidence and revision',
    adultTime: pkg.completionAuthority === 'guardian' ? '10–20 minutes for permission, required supervision or review, and physical-event attestation' : 'No adult time required unless the learner chooses support',
  }
}

function practicalGoalFor(pkg) {
  const topic = topicFor(pkg).toLowerCase()
  if (pkg.lessonRef.grade <= 5) return `I can practice ${topic}. I will do one step at a time and check one result.`
  return `I can complete a realistic ${topic} task, document the result with minimal private data, and revise a step that does not meet the lesson criteria.`
}

function localMaterialsFor(pkg) {
  const phantom = new RegExp(`\\b(?:${ARTIFACT_WORDS.join('|')})s?\\b`, 'i')
  const local = pkg.materials.filter((material) => !phantom.test(material))
  return distinct(local).map((label, index) => ({
    materialId: `${pkg.packageId}-local-${index + 1}`,
    label,
    delivery: /adult|guardian|household|real |home|kitchen|machine|appointment|community|local /i.test(label) ? 'adult-or-local' : 'learner-local',
    availabilityRule: 'Use only when already available, safe, permitted, and appropriate. The complete fictional route replaces unavailable real-world access.',
  }))
}

function standardResourceSet(pkg, scoring) {
  const topic = topicFor(pkg)
  const guided = taskByKinds(pkg, ['warm-up', 'guided'])
  const independent = taskByKinds(pkg, ['independent', 'performance-task', 'guided'])
  const reflection = taskByKinds(pkg, ['reflection'])
  const checks = proficientChecks(scoring)
  const ids = {
    model: resourceId(pkg, 'model-card'),
    steps: resourceId(pkg, 'step-card'),
    guided: resourceId(pkg, 'guided-card'),
    independent: resourceId(pkg, 'independent-card'),
    evidence: resourceId(pkg, 'evidence-record'),
    retry: resourceId(pkg, 'retry-pair'),
  }
  const baseResources = [
      {
        resourceId: ids.model,
        kind: 'model',
        title: `${topic} worked model`,
        purpose: 'Shows the starting condition, visible moves, reasoning, and success check before the learner begins.',
        content: [
          `Starting condition: ${firstSentence(pkg.scenario)}`,
          `Model move 1: Read the condition and name the exact ${topic.toLowerCase()} decision or action.`,
          `Model move 2: ${firstSentence(guided.directions)}`,
          `Model move 3: ${firstSentence(independent.directions)}`,
          `Model check: ${checks.join(' | ')}`,
        ],
      },
      {
        resourceId: ids.steps,
        kind: 'step-by-step-instruction',
        title: `${topic} action steps`,
        purpose: 'Provides the ordered directions used by the model, guided attempt, independent task, and retry.',
        content: pkg.lessonRef.grade <= 5
          ? [
              `1. Read the goal for ${topic.toLowerCase()}.`,
              `2. Watch the worked move on ${ids.model}.`,
              `3. Do one coached move on ${ids.guided}.`,
              `4. Complete the chosen route on ${ids.independent}.`,
              `5. Save the small record on ${ids.evidence}; use ${ids.retry} if a step is missed.`,
            ]
          : [
              `1. Read the goal, constraints, and privacy boundary for ${topic.toLowerCase()}.`,
              `2. Analyze the worked model and identify why its sequence meets the criteria.`,
              `3. Complete the guided case and use feedback before moving on.`,
              `4. Select the permitted real-life route or the complete fictional route.`,
              `5. Carry out the task, retaining only the minimum evidence named in the record.`,
              `6. Compare the result with the success checks and complete the correction loop when needed.`,
            ],
      },
      {
        resourceId: ids.guided,
        kind: 'guided-practice',
        title: `${topic} coached first attempt`,
        purpose: 'Carries the complete first attempt and a fresh correction turn.',
        content: [
          `Fictional practice condition: ${firstSentence(pkg.scenario)}`,
          `Coach direction: ${firstSentence(guided.directions)}`,
          `Learner prompt: ${guided.prompts[0]?.text ?? `Name the first useful move for ${topic.toLowerCase()}.`}`,
          'Feedback check: name the move completed, point to the matching success check, and identify one missing or uncertain step without judging the learner.',
          'Fresh correction turn: use the same fictional condition with one constraint changed; restate the changed constraint, redo only the affected step, and check the new result.',
        ],
      },
      {
        resourceId: ids.independent,
        kind: 'independent-task',
        title: `${topic} complete application`,
        purpose: 'Contains the lesson-specific application directions and prompts; it is the delivered card referenced by the learner flow.',
        content: [
          `Application direction: ${independent.directions}`,
          ...independent.prompts.map((prompt, index) => `Response ${index + 1} (${prompt.ref}): ${prompt.text}`),
          `Equal-access rule: ${pkg.simulationAlternative?.description ?? 'Use the fictional condition above and complete the same reasoning and evidence without private real-world details.'}`,
        ],
      },
      {
        resourceId: ids.evidence,
        kind: 'evidence-record',
        title: `${topic} minimal evidence record`,
        purpose: 'Defines exactly what the learner saves and what must not be collected.',
        content: [
          'Record only: selected route, completed step numbers, one non-sensitive result statement, and one revision if a step changed.',
          `Reflection: ${reflection?.prompts[0]?.text ?? `Which ${topic.toLowerCase()} step helped most, and why?`}`,
          `Success checks: ${checks.join(' | ')}`,
          `Do not collect: ${SENSITIVE_EVIDENCE.join('; ')}.`,
        ],
      },
      {
        resourceId: ids.retry,
        kind: 'retry',
        title: `${topic} supported and parallel retry cards`,
        purpose: 'Delivers a real correction loop rather than a direction to try again without support.',
        content: [
          `Contrast reteach: compare the model check on ${ids.model} with the missed or unsupported step; name the one observable difference.`,
          `Supported card: return to ${ids.guided}, complete the affected move with one coach prompt, and receive criterion-specific feedback.`,
          `Parallel card: use a fresh fictional ${topic.toLowerCase()} condition with one changed constraint; complete the same move without the coach prompt.`,
          `Exit check: the corrected move meets this lesson's checks — ${checks.join(' | ')}.`,
          `Return: resume at the next unfinished step on ${ids.independent}; a physical route resumes only when the authorized adult says it is safe.`,
        ],
      },
    ]
  const sourceText = [...pkg.materials, pkg.scenario, ...pkg.tasks.map(taskText)].join(' ')
  const artifactWords = ARTIFACT_WORDS.filter((word) => new RegExp(`\\b${word}s?\\b`, 'i').test(sourceText))
  const artifactResources = artifactWords.map((word) => ({
    resourceId: resourceId(pkg, `delivered-${word}`),
    kind: /example|sample/.test(word) ? 'model' : /scenario|card/.test(word) ? 'guided-practice' : /plan|table|template|worksheet/.test(word) ? 'independent-task' : 'reference',
    title: `${topic} delivered ${word}`,
    purpose: `Resolves the lesson's named ${word} so the learner is never directed to a phantom material.`,
    content: [
      `Starting information: ${firstSentence(pkg.scenario)}`,
      `Use steps: ${firstSentence(independent.directions)}`,
      ...independent.prompts.map((prompt, index) => `Field ${index + 1} (${prompt.ref}): ${prompt.text}`),
      `Check against: ${checks.join(' | ')}`,
    ],
  }))
  return {
    ids,
    artifactWords,
    artifactResolutionRefs: artifactResources.map((resource) => resource.resourceId),
    resources: [...baseResources, ...artifactResources],
  }
}

function composeStandardDepth(pkg, scoring) {
  const topic = topicFor(pkg)
  const goal = practicalGoalFor(pkg)
  const source = standardResourceSet(pkg, scoring)
  const independent = taskByKinds(pkg, ['independent', 'performance-task', 'guided'])
  const reflection = taskByKinds(pkg, ['reflection'])
  const checks = proficientChecks(scoring)
  const realRoute = pkg.realWorldAction ? {
    title: `${topic} — permitted real-life route`,
    completionAuthority: pkg.completionAuthority,
    permissionRule: pkg.completionAuthority === 'guardian'
      ? 'Do not begin the physical action until a household-authorized guardian gives permission and is available for the supervision or review named in this lesson.'
      : 'Use only a safe, permitted setting and the materials already available to you.',
    directionsResourceRef: source.ids.independent,
    steps: [
      'Confirm the setting, materials, and stop condition before acting.',
      independent.directions,
      'Complete the response prompts on the delivered independent card without recording private identifying details.',
      'Check the result against the delivered evidence record and correct any missed step.',
    ],
    completionCondition: pkg.completionAuthority === 'guardian'
      ? 'The learner submits the minimal process record; only the household-authorized guardian attests that the named physical action occurred.'
      : 'The learner submits the minimal process record and the completed application responses.',
  } : null
  const simulationRoute = {
    title: `${topic} — complete fictional route`,
    completionAuthority: 'learner',
    equalCredit: true,
    directionsResourceRef: source.ids.independent,
    directions: pkg.simulationAlternative?.description ?? `Complete the ${topic.toLowerCase()} task using the fictional condition and invented, non-sensitive details on the delivered independent card.`,
    completionCondition: 'Complete the same decision, procedure, evidence, and revision checks as the real-life route. No adult attests that a physical event occurred.',
  }
  return {
    version: PRODUCTION_DEPTH_VERSION,
    authorityBasis: LOCAL_AUTHORITY,
    lessonFamily: familyFor(pkg),
    practicalGoal: goal,
    duration: durationFor(pkg),
    materials: {
      providedResourceRefs: source.resources.map((resource) => resource.resourceId),
      referencedArtifactWords: source.artifactWords,
      artifactResolutionRefs: source.artifactResolutionRefs,
      localMaterials: localMaterialsFor(pkg),
      noPurchaseRule: 'No purchase is required. Use the complete fictional route when a local material, setting, source, or adult is unavailable.',
    },
    resources: source.resources,
    model: {
      title: `${topic} worked model`,
      startingCondition: firstSentence(pkg.scenario),
      actions: source.resources.find((resource) => resource.resourceId === source.ids.model).content.slice(1, 4),
      reasoning: `The model names the condition, follows the ordered ${topic.toLowerCase()} process, and checks the result instead of claiming success from effort alone.`,
      successCheck: checks,
      resourceRef: source.ids.model,
    },
    instruction: {
      presentationRule: pkg.lessonRef.grade <= 5 ? 'SHORT_CONCRETE_ONE_ACTION_PER_STEP' : 'INDEPENDENT_MULTI_STEP_WITH_EXPLICIT_CONSTRAINTS',
      steps: source.resources.find((resource) => resource.resourceId === source.ids.steps).content,
      resourceRef: source.ids.steps,
    },
    guidedFirstAttempt: {
      fictional: true,
      setup: firstSentence(pkg.scenario),
      prompt: taskByKinds(pkg, ['warm-up', 'guided']).prompts[0]?.text ?? `Name the first useful move for ${topic.toLowerCase()}.`,
      coachMoves: ['Ask the learner to name the condition.', 'Point to one model step only.', 'Give feedback against one observable success check.'],
      successCondition: checks[0],
      correctionTurn: `Use the fresh condition on ${source.ids.guided}: change one constraint, redo only the affected move, and state why the corrected move now meets the success check.`,
      resourceRef: source.ids.guided,
    },
    independentTask: {
      realLifeAppropriate: pkg.realWorldAction,
      realRoute,
      simulationRoute,
      privacyAlternative: 'The learner may use invented names, dates, amounts, organizations, spaces, and circumstances whenever real details are unnecessary or private.',
      resourceRef: source.ids.independent,
    },
    evidence: {
      learnerEvidence: ['selected route', 'completed step numbers', 'one non-sensitive result statement', 'one revision when a step changed'],
      reflectionPrompt: reflection?.prompts[0]?.text ?? `Which ${topic.toLowerCase()} step helped most, and what observable result did it produce?`,
      observableCriteria: checks,
      doNotCollect: SENSITIVE_EVIDENCE,
      resourceRef: source.ids.evidence,
    },
    retry: {
      trigger: 'Start the correction loop when a required step is missing, the reason does not match the condition, a safety or privacy boundary is crossed, or the evidence does not show the stated result.',
      targetedReteach: `Compare the missed move with the worked move on ${source.ids.model}; name one observable difference and review only the matching instruction step.`,
      supportedReattempt: `Complete the affected move on ${source.ids.guided} with one coach prompt and receive feedback tied to the success check.`,
      feedback: 'Name the observable move that now meets the check and the one move, if any, that still needs correction. Do not use shame, trait, effort, or character judgments.',
      parallelReattempt: `Complete the same move on the fresh parallel condition in ${source.ids.retry} without the coach prompt.`,
      exitCriterion: `The supported and parallel moves both meet the named success check: ${checks.join(' | ')}`,
      returnPath: `Resume at the next unfinished step on ${source.ids.independent}. A physical task resumes only with required permission and supervision; otherwise finish the equal-credit fictional route.`,
      resourceRef: source.ids.retry,
    },
    guardianInvolvement: {
      requiredForPhysicalRoute: pkg.completionAuthority === 'guardian',
      requiredForSimulationRoute: false,
      role: pkg.completionAuthority === 'guardian' ? 'Give permission; provide only the supervision, handling, review, or observation named in the lesson; attest only that the physical event occurred.' : 'Optional coach only; no guardian attestation is required.',
      learnerSelfReport: pkg.completionAuthority === 'guardian' ? 'recorded-but-not-certifying-for-physical-route' : 'certifying-for-learner-route',
      signOffBoundary: 'A guardian attestation certifies only that the named physical event occurred. It never scores the learner reflection or proves effort, honesty, maturity, responsibility, diagnosis, or character.',
    },
    safety: {
      stopRule: 'Stop the physical route when permission, supervision, a safe setting, or an expected material is missing, or when a new hazard appears. Continue only when the authorized adult resolves it; otherwise use the complete fictional route.',
      physicalBoundary: 'The learner follows the source safety notes and never performs adult-only handling, transport, account, legal, medical, heat, sharp-tool, electrical, chemical, or machine actions.',
      noShameRule: 'Describe only the observable step, condition, evidence, or revision. Never label the learner, household, body, ability, effort, maturity, responsibility, or character.',
    },
    privacy: {
      rule: 'Collect the smallest process record that shows the lesson steps. A learner may choose fictional details and may decline private disclosure without losing credit.',
      doNotCollect: SENSITIVE_EVIDENCE,
    },
    tutorBoundary: {
      may: ['read delivered resource cues', 'rehearse the ordered steps', 'coach the guided and retry cards', 'acknowledge saved learner evidence'],
      mayNot: ['grant permission', 'observe or claim a physical condition', 'direct unsafe handling', 'request sensitive evidence', 'impersonate a guardian', 'certify physical completion', 'invent a missing resource'],
      physicalCompletionRule: 'Tutor or AI may coach. Tutor or AI may not certify that a real-world physical action occurred.',
      missingResourceAction: 'Stop and name the unresolved resource. Do not fabricate it; use another complete delivered route only when every resource for that route resolves.',
    },
  }
}

function anchorResources(sample, pkg) {
  const ids = {
    risk: resourceId(pkg, 'risk-strip'),
    model: resourceId(pkg, 'model-card'),
    guided: resourceId(pkg, 'guided-card'),
    real: resourceId(pkg, 'home-check'),
    simulation: resourceId(pkg, 'scene-set'),
    evidence: resourceId(pkg, 'evidence-record'),
    retry: resourceId(pkg, 'retry-pair'),
  }
  return {
    ids,
    resources: [
      { resourceId: ids.risk, kind: 'reference', title: 'Five risk words and safe-or-unsure cues', purpose: 'Used by the model, guided attempt, both independent routes, and retry.', content: sample.riskWords.map((risk) => `${risk.label}: ${risk.cue}`) },
      { resourceId: ids.model, kind: 'model', title: sample.model.title, purpose: 'Shows the complete approved worked example.', content: [sample.model.startingCondition, ...sample.model.actions.map((action) => `${action.label}: ${action.detail}`), sample.model.criteriaCheck] },
      { resourceId: ids.guided, kind: 'guided-practice', title: sample.guidedAttempt.title, purpose: 'Carries the coached first attempt and fresh correction turn.', content: [sample.guidedAttempt.scenario, sample.guidedAttempt.prompt, ...sample.guidedAttempt.choices.map((choice) => `${choice.label} — ${choice.feedback}`), sample.guidedAttempt.correctionTurn, sample.guidedAttempt.releaseCondition] },
      { resourceId: ids.real, kind: 'independent-task', title: sample.independentTask.realPath.title, purpose: 'Delivers all five physical-route checkpoints and boundaries.', content: [...sample.independentTask.realPath.steps, ...sample.independentTask.realPath.checkpoints.map((checkpoint) => `Checkpoint: ${checkpoint}`), sample.independentTask.realPath.completionCondition] },
      { resourceId: ids.simulation, kind: 'independent-task', title: sample.independentTask.simulationPath.title, purpose: 'Delivers all six equal-credit invented scenes.', content: [sample.independentTask.simulationPath.directions, ...sample.independentTask.simulationPath.scenes.map((scene) => `${scene.id} — ${scene.title}: ${scene.description}`), sample.independentTask.simulationPath.completionCondition] },
      { resourceId: ids.evidence, kind: 'evidence-record', title: 'Spot, Stop, Ask minimal evidence record', purpose: 'Defines the privacy-bounded learner record and observable criteria.', content: [...sample.evidence.learnerEvidence, sample.evidence.reflectionPrompt, ...sample.evidence.observableCriteria, `Do not collect: ${sample.evidence.doNotCollect.join('; ')}.`] },
      { resourceId: ids.retry, kind: 'retry', title: 'Spot, Stop, Ask supported and parallel retry cards', purpose: 'Delivers the complete approved correction loop.', content: [sample.retry.trigger, sample.retry.targetedReteach, sample.retry.supportedReattempt, sample.retry.feedback, sample.retry.parallelReattempt, sample.retry.exitCriterion, sample.retry.returnPath] },
    ],
  }
}

function composeAnchorDepth(pkg) {
  const sample = READY_FOR_LIFE_SAMPLE
  const source = anchorResources(sample, pkg)
  return {
    version: PRODUCTION_DEPTH_VERSION,
    authorityBasis: sample.identity.authorityBasis,
    approvedAnchor: { sampleVersion: sample.identity.version, approvedLessonId: sample.identity.lessonId, preserved: true },
    lessonFamily: 'home-care',
    practicalGoal: sample.goal,
    duration: sample.duration,
    materials: {
      providedResourceRefs: Object.values(source.ids),
      referencedArtifactWords: [],
      artifactResolutionRefs: Object.values(source.ids),
      localMaterials: sample.materials.filter((material) => material.delivery === 'adult-local').map((material) => ({ materialId: material.id, label: material.label, delivery: material.delivery, availabilityRule: sample.safety.unavailablePath })),
      noPurchaseRule: sample.safety.unavailablePath,
    },
    resources: source.resources,
    model: { ...sample.model, resourceRef: source.ids.model },
    instruction: { presentationRule: 'SHORT_CONCRETE_ONE_ACTION_PER_STEP', steps: ['1. Spot: look from where you stand.', '2. Stop: do not touch or step over the item.', '3. Name: choose a risk word, safe, or unsure.', '4. Ask: tell the guardian; the adult handles any physical change.', '5. Check: look again from a safe place.'], resourceRef: source.ids.risk },
    guidedFirstAttempt: { ...sample.guidedAttempt, resourceRef: source.ids.guided },
    independentTask: {
      realLifeAppropriate: true,
      realRoute: { ...sample.independentTask.realPath, completionAuthority: sample.completion.realPathAuthority, directionsResourceRef: source.ids.real },
      simulationRoute: { ...sample.independentTask.simulationPath, directionsResourceRef: source.ids.simulation },
      privacyAlternative: sample.safety.unavailablePath,
      resourceRef: source.ids.simulation,
    },
    evidence: { ...sample.evidence, resourceRef: source.ids.evidence },
    retry: { ...sample.retry, resourceRef: source.ids.retry },
    guardianInvolvement: {
      requiredForPhysicalRoute: true,
      requiredForSimulationRoute: false,
      role: sample.completion.minimumGuardianEvidence.join('; '),
      learnerSelfReport: sample.completion.learnerSelfReport,
      signOffBoundary: 'The guardian certifies only the physical walkthrough. The guardian does not score the reflection or infer effort, honesty, maturity, responsibility, diagnosis, or character.',
    },
    safety: { ...sample.safety, noShameRule: 'Describe only the observable move and correction. Never label the learner, household, effort, maturity, responsibility, or character.' },
    privacy: { rule: sample.evidence.reflectionPrompt, doNotCollect: sample.evidence.doNotCollect },
    tutorBoundary: {
      may: sample.tutor.coachScope,
      mayNot: ['grant household permission', 'request private household details or media', 'observe or claim a physical condition', 'direct the learner to touch or move an item', 'impersonate a guardian', 'certify physical completion', 'invent a missing resource'],
      physicalCompletionRule: sample.tutor.completionAuthority,
      missingResourceAction: sample.tutor.missingResourceAction,
    },
  }
}

function learnerTasks(pkg, depth) {
  const model = depth.model.resourceRef
  const guided = depth.guidedFirstAttempt.resourceRef
  const independent = depth.independentTask.resourceRef
  const independentResources = distinct([depth.independentTask.realRoute?.directionsResourceRef, depth.independentTask.simulationRoute?.directionsResourceRef, independent]).join(' or ')
  const evidence = depth.evidence.resourceRef
  const isElementary = pkg.lessonRef.grade <= 5
  return [
    {
      taskId: 't1',
      kind: 'warm-up',
      directions: isElementary ? `Open ${model}. Watch one complete example.` : `Analyze the complete worked example on ${model} before beginning.`,
      prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Name the first move in the model and explain why it comes first.' }],
    },
    {
      taskId: 't2',
      kind: 'guided',
      directions: isElementary ? `Open ${guided}. Do the coached move.` : `Complete the fictional coached case on ${guided}, use criterion-specific feedback, and finish its fresh correction turn.`,
      prompts: [{ ref: 't2-p1', promptType: 'short-response', text: 'Name the move you completed and the success check it meets.' }],
    },
    {
      taskId: 't3',
      kind: pkg.realWorldAction ? 'performance-task' : 'independent',
      directions: isElementary ? `Open ${independentResources}. Choose one complete route. Follow its steps.` : `Choose the permitted real-life route or complete fictional route on ${independentResources}; follow every step and retain only the named minimal evidence.`,
      prompts: [
        { ref: 't3-p1', promptType: 'fixed-choice', text: 'Which complete route did you use?', choices: pkg.realWorldAction ? ['Permitted real-life route', 'Complete fictional route'] : ['Complete fictional route', 'Privacy-preserving fictional-detail route'] },
        { ref: 't3-p2', promptType: 'short-response', text: 'Record the completed step numbers and one non-sensitive result statement.' },
      ],
    },
    {
      taskId: 't4',
      kind: 'reflection',
      directions: isElementary ? `Open ${evidence}. Save one result and one reflection.` : `Complete the minimal evidence record on ${evidence}; omit or fictionalize private details.`,
      prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: depth.evidence.reflectionPrompt }],
    },
  ]
}

export function composeProductionPackage(sourcePackage, scoring) {
  const pkg = structuredClone(sourcePackage)
  pkg.standardsRefs = distinct(pkg.standardsRefs.filter((reference) => !/michigan|state standards?|state authority/i.test(reference)).concat('Manuel Academy local Ready for Life composition'))
  pkg.productionDepth = pkg.lessonRef.lessonId === APPROVED_ANCHOR_ID ? composeAnchorDepth(pkg) : composeStandardDepth(pkg, scoring)
  pkg.objective = pkg.productionDepth.practicalGoal
  pkg.scenario = pkg.productionDepth.model.startingCondition
  pkg.materials = [
    ...pkg.productionDepth.materials.providedResourceRefs.map((ref) => `Embedded resource: ${ref}`),
    ...pkg.productionDepth.materials.localMaterials.map((material) => `${material.delivery}: ${material.label}`),
  ]
  pkg.tasks = learnerTasks(pkg, pkg.productionDepth)
  pkg.remediation = `${pkg.productionDepth.retry.targetedReteach} ${pkg.productionDepth.retry.supportedReattempt} ${pkg.productionDepth.retry.feedback} ${pkg.productionDepth.retry.parallelReattempt} Exit: ${pkg.productionDepth.retry.exitCriterion} ${pkg.productionDepth.retry.returnPath}`
  if (pkg.lessonRef.lessonId === APPROVED_ANCHOR_ID) pkg.lessonRef.title = READY_FOR_LIFE_SAMPLE.identity.title
  return pkg
}

export function composeProductionScoring(sourceScoring, lessonId) {
  if (lessonId !== APPROVED_ANCHOR_ID) return structuredClone(sourceScoring)
  const scoring = structuredClone(sourceScoring)
  scoring.scoringAuthority.criteria = READY_FOR_LIFE_SAMPLE.evidence.observableCriteria.map((criterion, index) => ({
    dimension: ['Risk reasoning', 'Safety boundary', 'Complete route and revision', 'Privacy-bounded reflection'][index],
    levels: [
      { label: 'Emerging', descriptor: `The record does not yet show this observable criterion: ${criterion}` },
      { label: 'Proficient', descriptor: criterion },
      { label: 'Advanced', descriptor: `${criterion} The learner also explains how the checked move transfers to a fresh invented scene without adding private detail.` },
    ],
  }))
  return scoring
}

export function extendTaskSheetSchema(sourceSchema) {
  const schema = structuredClone(sourceSchema)
  schema.$id = 'https://manuel-academy.local/schema/rfl-production-depth-r1-task-sheet.schema.json'
  schema.title = 'Ready for Life production-depth R1 student task sheet'
  schema.description = `${sourceSchema.description} Every package also carries the complete Manuel Academy local production-depth composition used for learner delivery.`
  schema.required = distinct([...(schema.required ?? []), 'productionDepth'])
  schema.properties.productionDepth = {
    type: 'object',
    required: ['version', 'authorityBasis', 'lessonFamily', 'practicalGoal', 'duration', 'materials', 'resources', 'model', 'instruction', 'guidedFirstAttempt', 'independentTask', 'evidence', 'retry', 'guardianInvolvement', 'safety', 'privacy', 'tutorBoundary'],
    additionalProperties: false,
    properties: {
      version: { const: PRODUCTION_DEPTH_VERSION },
      authorityBasis: { const: LOCAL_AUTHORITY },
      approvedAnchor: { type: 'object' },
      lessonFamily: { type: 'string', minLength: 1 },
      practicalGoal: { type: 'string', minLength: 1 },
      duration: { type: 'object', required: ['activeLearnerTime', 'elapsedWindow', 'sessionPattern', 'adultTime'] },
      materials: { type: 'object', required: ['providedResourceRefs', 'referencedArtifactWords', 'artifactResolutionRefs', 'localMaterials', 'noPurchaseRule'] },
      resources: {
        type: 'array',
        minItems: 6,
        items: {
          type: 'object',
          required: ['resourceId', 'kind', 'title', 'purpose', 'content'],
          additionalProperties: false,
          properties: {
            resourceId: { type: 'string', minLength: 1 },
            kind: { enum: ['reference', 'model', 'step-by-step-instruction', 'guided-practice', 'independent-task', 'evidence-record', 'retry'] },
            title: { type: 'string', minLength: 1 },
            purpose: { type: 'string', minLength: 1 },
            content: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
          },
        },
      },
      model: { type: 'object' },
      instruction: { type: 'object', required: ['presentationRule', 'steps', 'resourceRef'] },
      guidedFirstAttempt: { type: 'object' },
      independentTask: { type: 'object', required: ['realLifeAppropriate', 'realRoute', 'simulationRoute', 'privacyAlternative', 'resourceRef'] },
      evidence: { type: 'object' },
      retry: { type: 'object', required: ['trigger', 'targetedReteach', 'supportedReattempt', 'feedback', 'parallelReattempt', 'exitCriterion', 'returnPath', 'resourceRef'] },
      guardianInvolvement: { type: 'object', required: ['requiredForPhysicalRoute', 'requiredForSimulationRoute', 'role', 'learnerSelfReport', 'signOffBoundary'] },
      safety: { type: 'object', required: ['stopRule', 'noShameRule'] },
      privacy: { type: 'object', required: ['rule', 'doNotCollect'] },
      tutorBoundary: { type: 'object', required: ['may', 'mayNot', 'physicalCompletionRule', 'missingResourceAction'] },
    },
  }
  return schema
}

export function validateProductionDepth(entry) {
  const issues = []
  const { pkg } = entry
  const depth = pkg.productionDepth
  const add = (rule, detail) => issues.push({ rule, lessonId: pkg.lessonRef.lessonId, packageId: pkg.packageId, detail })
  if (!depth || depth.version !== PRODUCTION_DEPTH_VERSION) return [{ rule: 'production-depth-present', lessonId: pkg.lessonRef.lessonId, packageId: pkg.packageId, detail: 'missing production-depth-r1 composition' }]
  if (depth.authorityBasis !== LOCAL_AUTHORITY) add('local-composition-authority', `unexpected authority ${depth.authorityBasis}`)
  if (!depth.practicalGoal?.trim()) add('practical-goal', 'missing practical goal')
  if (!depth.duration?.activeLearnerTime || !depth.duration?.elapsedWindow || !depth.duration?.sessionPattern) add('realistic-duration', 'duration is incomplete')
  const resources = new Map((depth.resources ?? []).map((resource) => [resource.resourceId, resource]))
  const requiredRefs = [
    ...(depth.materials?.providedResourceRefs ?? []),
    depth.model?.resourceRef,
    depth.instruction?.resourceRef,
    depth.guidedFirstAttempt?.resourceRef,
    depth.independentTask?.resourceRef,
    depth.evidence?.resourceRef,
    depth.retry?.resourceRef,
  ].filter(Boolean)
  for (const ref of requiredRefs) {
    const resource = resources.get(ref)
    if (!resource || !resource.title?.trim() || !resource.purpose?.trim() || !Array.isArray(resource.content) || resource.content.length === 0 || resource.content.some((line) => !String(line).trim())) add('material-completeness', `unresolved or empty resource ${ref}`)
  }
  for (const word of depth.materials?.referencedArtifactWords ?? []) {
    const resolved = (depth.materials?.artifactResolutionRefs ?? []).map((ref) => resources.get(ref)).filter(Boolean)
    if (!resolved.some((resource) => new RegExp(`\\b${word}\\b`, 'i').test(`${resource.resourceId} ${resource.title}`))) add('material-completeness', `named ${word} has no delivered resolution resource`)
  }
  for (const kind of ['model', 'guided-practice', 'independent-task', 'evidence-record', 'retry']) if (![...resources.values()].some((resource) => resource.kind === kind)) add('material-completeness', `missing delivered ${kind} resource`)
  if ((depth.model?.actions?.length ?? 0) < 2 || !depth.model?.startingCondition || !(Array.isArray(depth.model.successCheck) ? depth.model.successCheck.length : depth.model.criteriaCheck)) add('worked-model', 'model lacks starting condition, visible moves, or success check')
  if ((depth.instruction?.steps?.length ?? 0) < 4) add('step-by-step-instruction', 'fewer than four ordered steps')
  if (pkg.lessonRef.grade <= 5 && (depth.instruction.steps.length > 5 || depth.instruction.steps.some((step) => words(step).length > 30))) add('elementary-one-action', 'elementary instruction is not short and one-action')
  if (!depth.guidedFirstAttempt?.prompt || !depth.guidedFirstAttempt?.successCondition && !depth.guidedFirstAttempt?.releaseCondition || !depth.guidedFirstAttempt?.correctionTurn) add('guided-first-attempt', 'guided attempt lacks prompt, release check, or correction turn')
  if (!depth.independentTask?.simulationRoute?.equalCredit || depth.independentTask.simulationRoute.completionAuthority !== 'learner') add('independent-equal-credit-route', 'complete learner-authority simulation route is missing')
  if (pkg.realWorldAction && (!depth.independentTask.realRoute || !depth.independentTask.realRoute.completionCondition)) add('independent-real-life-task', 'real-life task lacks a complete real route')
  if ((depth.evidence?.learnerEvidence?.length ?? 0) < 2 || !depth.evidence?.reflectionPrompt || (depth.evidence?.doNotCollect?.length ?? 0) < 2) add('evidence-reflection', 'evidence or privacy-bounded reflection is incomplete')
  if (!depth.retry?.trigger || !depth.retry?.targetedReteach || !depth.retry?.supportedReattempt || !depth.retry?.feedback || !depth.retry?.parallelReattempt || !depth.retry?.exitCriterion || !depth.retry?.returnPath || depth.retry.supportedReattempt === depth.retry.parallelReattempt) add('real-retry-loop', 'retry lacks a distinct supported-to-parallel correction loop')
  if (pkg.completionAuthority === 'guardian' && (!depth.guardianInvolvement?.requiredForPhysicalRoute || depth.guardianInvolvement?.requiredForSimulationRoute || !/only|physical/i.test(depth.guardianInvolvement?.signOffBoundary ?? ''))) add('guardian-boundary', 'guardian physical-route boundary is incomplete')
  if (!depth.safety?.stopRule || !depth.safety?.noShameRule || !/observable|never label/i.test(depth.safety.noShameRule)) add('safety-no-shame', 'operational stop rule or no-shame boundary is missing')
  if (!/may not certify|cannot.*certify/i.test(depth.tutorBoundary?.physicalCompletionRule ?? '')) add('tutor-physical-boundary', 'Tutor physical-certification prohibition is missing')
  if ((depth.privacy?.doNotCollect?.length ?? 0) < 2 || !/fictional|invented|decline|smallest/i.test(depth.privacy?.rule ?? '')) add('privacy-minimization', 'privacy rule does not preserve a non-disclosure path')
  if (pkg.standardsRefs.some((reference) => /michigan|state standards?|state authority/i.test(reference))) add('no-state-authority', 'state authority was attached to local composition')
  if (pkg.lessonRef.lessonId === APPROVED_ANCHOR_ID && (!depth.approvedAnchor?.preserved || depth.practicalGoal !== READY_FOR_LIFE_SAMPLE.goal || depth.retry.parallelReattempt !== READY_FOR_LIFE_SAMPLE.retry.parallelReattempt || depth.independentTask.simulationRoute.scenes.length !== READY_FOR_LIFE_SAMPLE.independentTask.simulationPath.scenes.length)) add('approved-anchor-preserved', 'approved sample contract drifted')
  return issues
}

export function buildProductionDepthReport(entries) {
  const issues = entries.flatMap(validateProductionDepth)
  const domains = [...new Set(entries.map((entry) => entry.pkg.productionDepth.lessonFamily))].sort()
  const representativeLessons = []
  for (const grade of [...new Set(entries.map((entry) => entry.pkg.lessonRef.grade))].sort((a, b) => a - b)) {
    const gradeEntries = entries.filter((entry) => entry.pkg.lessonRef.grade === grade).sort((a, b) => a.pkg.lessonRef.unitNumber - b.pkg.lessonRef.unitNumber || a.pkg.lessonRef.dayInUnit - b.pkg.lessonRef.dayInUnit)
    for (const unit of [...new Set(gradeEntries.map((entry) => entry.pkg.lessonRef.unitNumber))]) {
      const entry = gradeEntries.find((candidate) => candidate.pkg.lessonRef.unitNumber === unit && candidate.pkg.lessonRef.dayInUnit === 4) ?? gradeEntries.find((candidate) => candidate.pkg.lessonRef.unitNumber === unit)
      representativeLessons.push({ lessonId: entry.pkg.lessonRef.lessonId, grade, unit, family: entry.pkg.productionDepth.lessonFamily, status: validateProductionDepth(entry).length === 0 ? 'PASS' : 'FAIL' })
    }
  }
  const countPassing = (rule) => entries.filter((entry) => !validateProductionDepth(entry).some((issue) => issue.rule === rule)).length
  return {
    schemaVersion: '1.0',
    version: PRODUCTION_DEPTH_VERSION,
    status: issues.length === 0 ? 'PASS' : 'FAIL',
    authorityBasis: LOCAL_AUTHORITY,
    lessonsBefore: entries.length,
    lessonsAfter: entries.length,
    lessonsRebuilt: entries.filter((entry) => entry.pkg.productionDepth?.version === PRODUCTION_DEPTH_VERSION).length,
    lessonFamilies: domains,
    coverage: {
      materialCompleteness: countPassing('material-completeness'),
      models: countPassing('worked-model'),
      guided: countPassing('guided-first-attempt'),
      independent: countPassing('independent-equal-credit-route'),
      retry: countPassing('real-retry-loop'),
      safety: countPassing('safety-no-shame'),
      privacy: countPassing('privacy-minimization'),
      guardianBoundary: countPassing('guardian-boundary'),
    },
    approvedAnchor: { lessonId: APPROVED_ANCHOR_ID, status: issues.some((issue) => issue.rule === 'approved-anchor-preserved') ? 'FAIL' : 'PRESERVED' },
    representativeCoverage: { strategy: 'Day 4 application lesson from every grade and unit; fallback to first unit lesson.', lessonCount: representativeLessons.length, grades: [...new Set(representativeLessons.map((row) => row.grade))], families: [...new Set(representativeLessons.map((row) => row.family))].sort(), lessons: representativeLessons },
    issueCount: issues.length,
    issues,
  }
}
