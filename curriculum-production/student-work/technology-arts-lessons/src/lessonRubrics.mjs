/**
 * Lesson-level rubric construction.
 *
 * A lesson rubric is not the unit rubric copied down. The unit assessment
 * scores a finished performance task; a single lesson scores whatever that
 * day's phase actually asked for — an honest prediction on a launch day, a
 * defect log on a correction day, testing evidence on a build day. So the
 * DIMENSION SET is chosen by work mode, and only the modes that genuinely
 * produce summative evidence carry the unit's own assessment dimensions.
 */

const D = {
  'baseline and honesty': {
    exceeds: 'The pre-instruction baseline is complete and candid — a made or described starting point, specific noticings, and a genuine open question — and is preserved intact for later comparison.',
    meets: 'A dated baseline response was made before instruction, with noticings and an open question recorded.',
    developing: 'A baseline exists but is thin, undated, or was partly filled in after instruction began.',
    beginning: 'No usable record of the starting point exists from before instruction.',
  },
  'prediction and honesty': {
    exceeds: 'The prior-knowledge record is complete and candid, including predictions that turned out wrong, and each break is marked rather than quietly corrected.',
    meets: 'A prediction was recorded before instruction and the outcome of checking it is stated.',
    developing: 'A prediction exists but was partly written or revised after seeing the answer, or the checking outcome is vague.',
    beginning: 'No usable record of prior thinking exists from before instruction.',
  },
  'accuracy or fidelity': {
    exceeds: 'Every step, value, or rendered choice is accurate and faithful to the stated criteria, with no notable errors.',
    meets: 'The work is accurate and faithful to the stated criteria, with at most one minor self-correctable error.',
    developing: 'The work is mostly accurate but has one or more errors that change the result or the intended effect.',
    beginning: 'Multiple accuracy or fidelity errors prevent the work from meeting the stated criteria.',
  },
  'evidence and reasoning': {
    exceeds: 'Every claim or choice is backed by specific evidence or clearly explained reasoning a reader can follow unaided.',
    meets: 'Most claims or choices are backed by evidence or reasoning, with only small gaps.',
    developing: 'Some claims are supported but several are asserted without support.',
    beginning: 'Claims are asserted with little or no supporting evidence or reasoning.',
  },
  'process documentation': {
    exceeds: 'The record shows the actual working order, including abandoned attempts and dead ends, in enough detail to reconstruct the session.',
    meets: 'The required log, trace, or notes are present and record what was done and why.',
    developing: 'Documentation exists but is thin, out of order, or written after the fact from memory.',
    beginning: 'Little or no record of the process was kept.',
  },
  'testing and verification': {
    exceeds: 'Test cases include normal, boundary, and deliberate-break inputs, each with expected against actual recorded and every failure resolved and re-run.',
    meets: 'The required cases were run with expected against actual recorded, and failures were addressed.',
    developing: 'Some checking occurred but cases are too few, results are unrecorded, or a known failure was left unresolved.',
    beginning: 'The work was submitted without evidence it was checked against any case.',
  },
  'design justification': {
    exceeds: 'Design choices are justified against a named alternative, with the trade-off stated in terms of the actual requirement.',
    meets: 'Design choices are explained with a stated reason.',
    developing: 'Choices are described but the reasoning is generic or does not connect to the requirement.',
    beginning: 'Design choices are unexplained.',
  },
  'craft and intent': {
    exceeds: 'The intended effect is stated in advance and the finished work demonstrably achieves it through identifiable, controlled choices.',
    meets: 'An intent was stated and the work pursues it with recognisable technique.',
    developing: 'Intent is present but the work only partly delivers it, or the connecting choices cannot be identified.',
    beginning: 'No stated intent, or the work does not pursue it.',
  },
  'critique and interpretation': {
    exceeds: 'Description precedes judgement throughout, and every interpretive claim points to something a reader could verify in the work itself.',
    meets: 'The response describes before judging and supports most claims with reference to the work.',
    developing: 'Judgement outruns description, or claims rest mainly on preference.',
    beginning: 'The response is opinion with no grounding in the work.',
  },
  independence: {
    exceeds: 'The work was completed unaided and the explanation shows the reasoning is genuinely the student\'s own, transferring to an unseen case.',
    meets: 'The work was completed without scaffold or prompts in view.',
    developing: 'The work required prompting or reference beyond what the task allowed.',
    beginning: 'The work could not proceed without step-by-step direction.',
  },
  'revision and correction': {
    exceeds: 'A documented revision traces symptom to cause to fix to passing check, and a pattern across errors is named with a countermeasure.',
    meets: 'At least one real revision is documented with what changed and how improvement can be told.',
    developing: 'A change was made but the cause or the evidence of improvement is missing.',
    beginning: 'No evidence the work was revisited or corrected.',
  },
  'transfer and connection': {
    exceeds: 'At least three ideas are related with the relationship named, and a worked example genuinely requires two of them together.',
    meets: 'Connections between unit ideas are drawn and labelled.',
    developing: 'Ideas are listed together but the relationships are unstated or incorrect.',
    beginning: 'No connections between ideas are made.',
  },
}

/** Dimension sets by work mode. Different phase, different scored thing. */
const MODE_DIMENSIONS = {
  PROBE: ['@probe', 'process documentation'],
  MODEL: ['accuracy or fidelity', 'evidence and reasoning', 'process documentation'],
  MODEL_A: ['accuracy or fidelity', 'evidence and reasoning', 'process documentation'],
  MODEL_B: ['accuracy or fidelity', 'evidence and reasoning', 'transfer and connection'],
  GUIDED: ['accuracy or fidelity', 'evidence and reasoning', 'process documentation'],
  GUIDED_A: ['accuracy or fidelity', 'evidence and reasoning', 'process documentation'],
  GUIDED_B: ['accuracy or fidelity', 'evidence and reasoning', 'independence'],
  APPLY: ['accuracy or fidelity', 'evidence and reasoning', '@make', 'independence'],
  BUILD: ['accuracy or fidelity', '@make', '@justify', 'revision and correction'],
  INVESTIGATE: ['evidence and reasoning', '@justify', 'process documentation'],
  RETEACH: ['accuracy or fidelity', 'transfer and connection', 'process documentation'],
  INCREMENT: ['process documentation', 'accuracy or fidelity', 'revision and correction'],
  DEMONSTRATE: ['accuracy or fidelity', 'evidence and reasoning', 'independence', '@make'],
  SYNTHESIZE: ['transfer and connection', 'evidence and reasoning', 'process documentation'],
  ASSESS: ['accuracy or fidelity', 'evidence and reasoning', 'independence', '@make'],
  CORRECT: ['revision and correction', 'evidence and reasoning', 'process documentation'],
}

/**
 * `@make` and `@justify` resolve differently by subject: a technology lesson
 * is scored on whether it was tested and why it was designed that way; an
 * arts lesson on whether the craft delivered the intent and how the work was
 * critiqued.
 */
function resolveDimension(name, isTech) {
  if (name === '@make') return isTech ? 'testing and verification' : 'craft and intent'
  if (name === '@justify') return isTech ? 'design justification' : 'critique and interpretation'
  // The technology launch task asks for an explicit prediction and checks it;
  // the arts launch task asks for a baseline response, noticings, and an open
  // question. Scoring the arts task on "prediction" would score something the
  // task never asked the student to produce.
  if (name === '@probe') return isTech ? 'prediction and honesty' : 'baseline and honesty'
  return name
}

export function buildLessonRubric(mode, isTech) {
  const names = MODE_DIMENSIONS[mode]
  if (!names) throw new Error(`no rubric dimension set for mode ${mode}`)
  return names.map((raw) => {
    const dimension = resolveDimension(raw, isTech)
    const descriptors = D[dimension]
    if (!descriptors) throw new Error(`no descriptors for dimension ${dimension}`)
    return { dimension, ...descriptors }
  })
}

export function rubricDimensionNames(mode, isTech) {
  return MODE_DIMENSIONS[mode].map((raw) => resolveDimension(raw, isTech))
}
