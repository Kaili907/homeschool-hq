(function runStandaloneDemo() {
  'use strict'

  const model = globalThis.MathDemoModel
  if (!model) throw new Error('Math demo model did not load.')

  const cardEl = document.querySelector('#demoCard')
  const promptEl = document.querySelector('#prompt')
  const choicesEl = document.querySelector('#choices')
  const feedbackEl = document.querySelector('#feedback')
  const reasonEl = document.querySelector('#reason')
  const reasonLabelEl = document.querySelector('#reasonLabel')
  const continueButtonEl = document.querySelector('#continue')
  const stepLabelEl = document.querySelector('#stepLabel')
  const evidenceCountEl = document.querySelector('#evidenceCount')
  const visualEl = document.querySelector('#visual')

  let state = model.createDemoState()

  const phaseLabels = {
    [model.PHASES.ASSESSMENT]: 'Assessment',
    [model.PHASES.REASONING_EVIDENCE]: 'Reasoning evidence',
    [model.PHASES.IDENTIFY_MISSING_CONCEPT]: 'Misconception response',
    [model.PHASES.UNCERTAINTY_CLARIFICATION]: 'Uncertainty clarification',
    [model.PHASES.TEACH_VISUALLY]: 'Visual reteaching',
    [model.PHASES.GUIDED_PRACTICE]: 'Guided practice',
    [model.PHASES.GUIDED_EVIDENCE]: 'Guided-practice evidence',
    [model.PHASES.INDEPENDENT_ATTEMPT]: 'Independent attempt',
    [model.PHASES.INDEPENDENT_EVIDENCE]: 'Independent evidence',
    [model.PHASES.REASSESS]: 'Reassessment',
    [model.PHASES.REASSESSMENT_EVIDENCE]: 'Reassessment evidence',
    [model.PHASES.ADVANCE]: 'Mastery checkpoint',
    [model.PHASES.CONTINUED_SUPPORT]: 'Continued support',
  }

  function isVisibleAndUsable(element) {
    if (!element || !element.isConnected || element.disabled) return false
    if (element.closest('[aria-hidden="true"]')) return false
    const style = getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
    return element.getClientRects().length > 0
  }

  function focusAfterRender(preferredTarget) {
    const candidates = [
      preferredTarget,
      promptEl,
      choicesEl.querySelector('button:not([disabled])'),
      continueButtonEl,
      feedbackEl,
    ]
    const target = candidates.find(isVisibleAndUsable)
    if (target) target.focus({ preventScroll: true })
  }

  function resetRenderedAttempt() {
    choicesEl.replaceChildren()
    choicesEl.classList.add('hidden')
    feedbackEl.textContent = ''
    feedbackEl.removeAttribute('data-feedback-class')
    reasonEl.value = ''
    reasonEl.setAttribute('aria-invalid', 'false')
    reasonEl.classList.add('hidden')
    reasonLabelEl.classList.add('hidden')
    continueButtonEl.classList.add('hidden')
    continueButtonEl.disabled = false
    continueButtonEl.onclick = null
    visualEl.replaceChildren()
    visualEl.classList.add('hidden')
  }

  function renderChart(digits, label) {
    visualEl.classList.remove('hidden')
    const chart = document.createElement('div')
    chart.className = 'place-grid'
    chart.setAttribute('role', 'img')
    chart.setAttribute('aria-label', label)
    ;['thousands', 'hundreds', 'tens', 'ones'].forEach((place, index) => {
      const cell = document.createElement('div')
      const placeName = document.createElement('span')
      const digit = document.createElement('strong')
      placeName.textContent = place
      digit.textContent = digits[index]
      cell.append(placeName, digit)
      chart.append(cell)
    })
    visualEl.append(chart)
  }

  function feedbackForAttempt(attempt) {
    switch (attempt.feedbackClass) {
      case 'correct-supported':
        return 'The selected answer matches, and this explanation provides current-item evidence. It is not mastery yet; one response does not establish mastery.'
      case 'correct-uncertain':
        return 'The selected answer matches, but you reported uncertainty or guessing. This remains uncertain evidence—not confident positive evidence or mastery credit.'
      case 'incorrect-supported-hypothesis':
        return 'This response gives one clue for a possible misconception, but one response is not enough to diagnose it. We will use neutral visual support and collect more evidence.'
      default:
        return 'This response does not provide enough evidence for a specific misconception. We will use neutral support and collect another observation.'
    }
  }

  function renderChoices(item) {
    choicesEl.classList.remove('hidden')
    item.choices.forEach((choice) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.choiceId = choice.id
      button.textContent = choice.text
      button.addEventListener('click', () => {
        state = model.selectAnswer(state, choice.id)
        renderQuestion(item, true)
      })
      choicesEl.append(button)
    })
  }

  function showReasoningControls() {
    reasonEl.classList.remove('hidden')
    reasonLabelEl.classList.remove('hidden')
    continueButtonEl.classList.remove('hidden')
    continueButtonEl.textContent = 'Submit reasoning'
    feedbackEl.textContent = 'Explain the current answer before any feedback is revealed.'
    continueButtonEl.onclick = submitCurrentReasoning
  }

  function renderQuestion(item, answerWasSelected = false) {
    resetRenderedAttempt()
    cardEl.dataset.itemId = item.id
    promptEl.textContent = item.prompt

    if (state.phase === model.PHASES.ASSESSMENT) {
      renderChart(['5', '0', '0', '2'], 'Place-value chart for 5,002')
    }

    if (answerWasSelected || state.attempt.selectedChoiceId) {
      showReasoningControls()
      focusAfterRender(reasonEl)
      return
    }

    renderChoices(item)
    focusAfterRender(promptEl)
  }

  function submitCurrentReasoning() {
    const result = model.submitReasoning(state, reasonEl.value)
    if (result.error) {
      feedbackEl.textContent = 'Add one sentence about your reasoning before continuing.'
      reasonEl.setAttribute('aria-invalid', 'true')
      focusAfterRender(reasonEl)
      return
    }
    state = result.state
    render()
  }

  function renderEvidenceFeedback() {
    resetRenderedAttempt()
    promptEl.textContent = phaseLabels[state.phase]
    feedbackEl.dataset.feedbackClass = state.attempt.feedbackClass
    feedbackEl.textContent = feedbackForAttempt(state.attempt)
    continueButtonEl.classList.remove('hidden')
    continueButtonEl.textContent =
      state.phase === model.PHASES.REASSESSMENT_EVIDENCE
        ? 'Show checkpoint result'
        : state.phase === model.PHASES.INDEPENDENT_EVIDENCE
          ? 'Continue to reassessment'
          : state.phase === model.PHASES.GUIDED_EVIDENCE
            ? 'Continue to independent attempt'
            : 'Continue to visual explanation'
    continueButtonEl.onclick = advanceFlow
    focusAfterRender(promptEl)
  }

  function renderVisualTeaching() {
    resetRenderedAttempt()
    cardEl.removeAttribute('data-item-id')
    promptEl.textContent =
      state.supportReason === 'correct-uncertain'
        ? 'Clarify the trade with a visual model'
        : 'Trace the regrouping visually'
    renderChart(
      ['4', '9', '9', '12'],
      'Place-value chart tracing one thousand through zero hundreds and zero tens to make twelve ones.',
    )
    const steps = document.createElement('ol')
    steps.className = 'teaching-steps'
    ;[
      'Trade 1 thousand for 10 hundreds.',
      'Trade 1 hundred for 10 tens.',
      'Trade 1 ten for 10 ones, making 12 ones.',
      'The digits now read 4 thousands, 9 hundreds, 9 tens, and 12 ones. The total value is still 5,002.',
    ].forEach((text) => {
      const item = document.createElement('li')
      item.textContent = text
      steps.append(item)
    })
    visualEl.append(steps)
    feedbackEl.textContent = 'The chart and written steps are the complete no-media explanation.'
    continueButtonEl.classList.remove('hidden')
    continueButtonEl.textContent = 'Continue to guided practice'
    continueButtonEl.onclick = advanceFlow
    focusAfterRender(promptEl)
  }

  function renderTerminal() {
    resetRenderedAttempt()
    cardEl.removeAttribute('data-item-id')
    if (state.phase === model.PHASES.ADVANCE) {
      promptEl.textContent = 'Mastery checkpoint illustrated—demo complete'
      feedbackEl.textContent =
        'This page-memory demonstration does not establish cross-session mastery. The aligned rule still requires secure evidence on at least 5 of 6 items across at least two sessions, and this is not a placement decision.'
    } else {
      promptEl.textContent = 'Continue reteaching with a new parallel example'
      feedbackEl.textContent =
        'The reassessment does not yet provide secure evidence. Continue with reteaching and a new parallel item rather than repeating the same numbers. This demo makes no diagnosis or placement decision.'
    }
    continueButtonEl.classList.remove('hidden')
    continueButtonEl.textContent = 'Restart demonstration'
    continueButtonEl.onclick = () => {
      state = model.createDemoState()
      render()
    }
    focusAfterRender(promptEl)
  }

  function advanceFlow() {
    state = model.continueFlow(state)
    render()
  }

  function render() {
    cardEl.dataset.phase = state.phase
    stepLabelEl.textContent = phaseLabels[state.phase]
    evidenceCountEl.textContent = `Evidence: ${state.evidenceTrace.length}`

    const item = model.itemForPhase(state.phase)
    if (item) {
      renderQuestion(item)
      return
    }

    if (
      state.phase === model.PHASES.REASONING_EVIDENCE ||
      state.phase === model.PHASES.IDENTIFY_MISSING_CONCEPT ||
      state.phase === model.PHASES.UNCERTAINTY_CLARIFICATION ||
      state.phase === model.PHASES.GUIDED_EVIDENCE ||
      state.phase === model.PHASES.INDEPENDENT_EVIDENCE ||
      state.phase === model.PHASES.REASSESSMENT_EVIDENCE
    ) {
      renderEvidenceFeedback()
      return
    }

    if (state.phase === model.PHASES.TEACH_VISUALLY) {
      renderVisualTeaching()
      return
    }

    renderTerminal()
  }

  render()
})()
