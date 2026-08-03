const RESULTS = Object.freeze({
  clear: Object.freeze({
    messageCode: 'study-safety-clear',
    message: 'You can continue when you are ready.',
    mayContinue: true,
    adultHelpState: 'not-needed',
    emergencyGuidanceCode: 'none',
  }),
  urgent: Object.freeze({
    messageCode: 'lesson-paused-get-trusted-adult',
    message: 'The lesson is paused. Please get a trusted adult who can help right now. You are not in trouble.',
    mayContinue: false,
    adultHelpState: 'proposed-not-delivered',
    emergencyGuidanceCode: 'seek-local-emergency-help-if-immediate-danger',
  }),
  uncertain: Object.freeze({
    messageCode: 'lesson-paused-adult-check-in',
    message: 'The lesson is paused. Please ask a trusted adult to check in with you. You are not in trouble.',
    mayContinue: false,
    adultHelpState: 'proposed-not-delivered',
    emergencyGuidanceCode: 'none',
  }),
  invalid: Object.freeze({
    messageCode: 'lesson-paused-input-check',
    message: 'The lesson is paused. Please ask a trusted adult to help check what happened. You are not in trouble.',
    mayContinue: false,
    adultHelpState: 'not-confirmed',
    emergencyGuidanceCode: 'none',
  }),
})

export function learnerSafeResult(classification, adultHelpConfirmed = false) {
  const base = RESULTS[classification] ?? RESULTS.invalid
  if (classification === 'urgent' || classification === 'uncertain') {
    return Object.freeze({
      ...base,
      adultHelpState: adultHelpConfirmed ? 'proposed-not-delivered' : 'not-confirmed',
    })
  }
  return base
}

export function learnerWireResult(classification, adultHelpConfirmed = false) {
  const safeClassification = ['urgent', 'uncertain', 'clear'].includes(classification)
    ? classification
    : 'invalid'
  return Object.freeze({
    schemaVersion: 1,
    classification: safeClassification,
    learner: learnerSafeResult(safeClassification, adultHelpConfirmed),
    continueToTutorCore: safeClassification === 'clear',
  })
}
