(function attachMathDemoModel(root) {
  'use strict'

  const PHASES = Object.freeze({
    ASSESSMENT: 'assessment',
    REASONING_EVIDENCE: 'reasoning-evidence',
    IDENTIFY_MISSING_CONCEPT: 'identify-missing-concept',
    UNCERTAINTY_CLARIFICATION: 'uncertainty-clarification',
    TEACH_VISUALLY: 'teach-visually',
    GUIDED_PRACTICE: 'guided-practice',
    GUIDED_EVIDENCE: 'guided-evidence',
    INDEPENDENT_ATTEMPT: 'independent-attempt',
    INDEPENDENT_EVIDENCE: 'independent-evidence',
    REASSESS: 'reassess',
    REASSESSMENT_EVIDENCE: 'reassessment-evidence',
    ADVANCE: 'advance',
    CONTINUED_SUPPORT: 'continued-support',
  })

  const ITEMS = Object.freeze({
    assessment: Object.freeze({
      id: 'demo-pv-diagnostic-01',
      prompt: 'To begin 5,002 − 187, where does the first available unit for regrouping come from?',
      choices: Object.freeze([
        Object.freeze({ id: 'ones', text: 'Ones place' }),
        Object.freeze({ id: 'tens', text: 'Tens place' }),
        Object.freeze({ id: 'hundreds', text: 'Hundreds place' }),
        Object.freeze({ id: 'thousands', text: 'Thousands place' }),
      ]),
      correctChoiceId: 'thousands',
      misconceptionSignals: Object.freeze({
        ones: 'math-mis-pv-borrow-zero',
        tens: 'math-mis-pv-borrow-zero',
        hundreds: 'math-mis-pv-borrow-zero',
      }),
    }),
    guided: Object.freeze({
      id: 'math-pv-g04',
      prompt: 'What is 70,003 − 28,746?',
      choices: Object.freeze([
        Object.freeze({ id: 'A', text: '41,257' }),
        Object.freeze({ id: 'B', text: '42,743' }),
        Object.freeze({ id: 'C', text: '58,657' }),
        Object.freeze({ id: 'D', text: '41,343' }),
      ]),
      correctChoiceId: 'A',
      misconceptionSignals: Object.freeze({
        B: 'math-mis-pv-big-minus-small',
        C: 'math-mis-pv-borrow-zero',
        D: 'math-mis-pv-borrow-zero',
      }),
    }),
    independent: Object.freeze({
      id: 'math-pv-m03',
      prompt: 'What is 80,010 − 46,875?',
      choices: Object.freeze([
        Object.freeze({ id: 'A', text: '33,135' }),
        Object.freeze({ id: 'B', text: '34,245' }),
        Object.freeze({ id: 'C', text: '44,865' }),
        Object.freeze({ id: 'D', text: '33,245' }),
      ]),
      correctChoiceId: 'A',
      misconceptionSignals: Object.freeze({
        B: 'math-mis-pv-borrow-zero',
        C: 'math-mis-pv-big-minus-small',
        D: 'math-mis-pv-borrow-zero',
      }),
    }),
    reassessment: Object.freeze({
      id: 'math-pv-m02',
      prompt: 'What is 48,796 + 36,587?',
      choices: Object.freeze([
        Object.freeze({ id: 'A', text: '84,273' }),
        Object.freeze({ id: 'B', text: '85,383' }),
        Object.freeze({ id: 'C', text: '85,283' }),
        Object.freeze({ id: 'D', text: '84,383' }),
      ]),
      correctChoiceId: 'B',
      misconceptionSignals: Object.freeze({
        A: 'math-mis-pv-regroup-changes-number',
        C: 'math-mis-pv-left-align',
        D: 'math-mis-pv-regroup-changes-number',
      }),
    }),
  })

  const QUESTION_PHASE_TO_ITEM = Object.freeze({
    [PHASES.ASSESSMENT]: ITEMS.assessment,
    [PHASES.GUIDED_PRACTICE]: ITEMS.guided,
    [PHASES.INDEPENDENT_ATTEMPT]: ITEMS.independent,
    [PHASES.REASSESS]: ITEMS.reassessment,
  })

  const FEEDBACK_PHASES = Object.freeze({
    [PHASES.GUIDED_PRACTICE]: PHASES.GUIDED_EVIDENCE,
    [PHASES.INDEPENDENT_ATTEMPT]: PHASES.INDEPENDENT_EVIDENCE,
    [PHASES.REASSESS]: PHASES.REASSESSMENT_EVIDENCE,
  })

  function blankAttempt(itemId) {
    return {
      itemId,
      selectedChoiceId: null,
      reasoning: '',
      correct: null,
      explicitlyUncertain: false,
      feedbackClass: 'unsubmitted',
      misconceptionSignal: null,
      submitted: false,
    }
  }

  function itemForPhase(phase) {
    return QUESTION_PHASE_TO_ITEM[phase] ?? null
  }

  function beginPhase(state, phase) {
    const item = itemForPhase(phase)
    return {
      ...state,
      phase,
      currentItemId: item?.id ?? null,
      attempt: blankAttempt(item?.id ?? null),
    }
  }

  function createDemoState() {
    return beginPhase(
      {
        phase: PHASES.ASSESSMENT,
        currentItemId: null,
        attempt: blankAttempt(null),
        evidenceTrace: [],
        confidentEvidenceCount: 0,
        supportReason: null,
      },
      PHASES.ASSESSMENT,
    )
  }

  function selectAnswer(state, choiceId) {
    const item = itemForPhase(state.phase)
    if (!item || !item.choices.some((choice) => choice.id === choiceId)) return state
    return {
      ...state,
      attempt: {
        ...blankAttempt(item.id),
        selectedChoiceId: choiceId,
      },
    }
  }

  function isExplicitlyUncertain(reasoning) {
    const normalized = String(reasoning)
      .toLowerCase()
      .replace(/[’]/g, "'")
      .replace(/\bi (?:did not|didn't) guess\b/g, '')
      .replace(/\bdo not guess\b/g, '')

    return [
      /\b(?:i(?:'m| am)\s+)?not sure\b/,
      /\b(?:i(?:'m| am)\s+)?unsure\b/,
      /\b(?:i(?:'m| am)\s+)?uncertain\b/,
      /\b(?:i(?:'m| am)\s+)?not certain\b/,
      /\bi (?:do not|don't) know\b/,
      /\bi guessed\b/,
      /\bi (?:am|'m) guessing\b/,
      /\brandom guess\b/,
      /\bpicked at random\b/,
    ].some((pattern) => pattern.test(normalized))
  }

  function classifyAttempt(item, choiceId, reasoning) {
    const correct = choiceId === item.correctChoiceId
    const explicitlyUncertain = isExplicitlyUncertain(reasoning)
    const misconceptionSignal = item.misconceptionSignals[choiceId] ?? null
    let feedbackClass = 'incorrect-insufficient-evidence'

    if (correct && explicitlyUncertain) feedbackClass = 'correct-uncertain'
    else if (correct) feedbackClass = 'correct-supported'
    else if (misconceptionSignal) feedbackClass = 'incorrect-supported-hypothesis'

    return { correct, explicitlyUncertain, feedbackClass, misconceptionSignal }
  }

  function assessmentFeedbackPhase(feedbackClass) {
    if (feedbackClass === 'correct-uncertain') return PHASES.UNCERTAINTY_CLARIFICATION
    if (feedbackClass.startsWith('incorrect-')) return PHASES.IDENTIFY_MISSING_CONCEPT
    return PHASES.REASONING_EVIDENCE
  }

  function submitReasoning(state, reasoning) {
    const item = itemForPhase(state.phase)
    const trimmedReasoning = String(reasoning).trim()
    if (!item || !state.attempt.selectedChoiceId) return { state, error: 'answer-required' }
    if (!trimmedReasoning) return { state, error: 'reasoning-required' }

    const classification = classifyAttempt(item, state.attempt.selectedChoiceId, trimmedReasoning)
    const completedAttempt = {
      ...state.attempt,
      ...classification,
      reasoning: trimmedReasoning,
      submitted: true,
    }
    const evidenceEntry = Object.freeze({ ...completedAttempt })
    const feedbackPhase =
      state.phase === PHASES.ASSESSMENT
        ? assessmentFeedbackPhase(classification.feedbackClass)
        : FEEDBACK_PHASES[state.phase]

    return {
      error: null,
      state: {
        ...state,
        phase: feedbackPhase,
        attempt: completedAttempt,
        evidenceTrace: [...state.evidenceTrace, evidenceEntry],
        confidentEvidenceCount:
          state.confidentEvidenceCount + (classification.feedbackClass === 'correct-supported' ? 1 : 0),
        supportReason:
          state.phase === PHASES.ASSESSMENT ? classification.feedbackClass : state.supportReason,
      },
    }
  }

  function continueFlow(state) {
    switch (state.phase) {
      case PHASES.REASONING_EVIDENCE:
      case PHASES.IDENTIFY_MISSING_CONCEPT:
      case PHASES.UNCERTAINTY_CLARIFICATION:
        return beginPhase(state, PHASES.TEACH_VISUALLY)
      case PHASES.TEACH_VISUALLY:
        return beginPhase(state, PHASES.GUIDED_PRACTICE)
      case PHASES.GUIDED_EVIDENCE:
        return beginPhase(state, PHASES.INDEPENDENT_ATTEMPT)
      case PHASES.INDEPENDENT_EVIDENCE:
        return beginPhase(state, PHASES.REASSESS)
      case PHASES.REASSESSMENT_EVIDENCE:
        return beginPhase(
          state,
          state.attempt.feedbackClass === 'correct-supported'
            ? PHASES.ADVANCE
            : PHASES.CONTINUED_SUPPORT,
        )
      default:
        return state
    }
  }

  root.MathDemoModel = Object.freeze({
    PHASES,
    ITEMS,
    beginPhase,
    classifyAttempt,
    continueFlow,
    createDemoState,
    isExplicitlyUncertain,
    itemForPhase,
    selectAnswer,
    submitReasoning,
  })
})(globalThis)
