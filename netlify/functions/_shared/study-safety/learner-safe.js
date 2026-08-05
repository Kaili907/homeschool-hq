/**
 * A6-5: one stop message for every non-clear classification. This string must
 * stay byte-identical to STUDY_LEARNER_STOP_MESSAGE in
 * src/study/safety/learnerSafe.ts — the browser rejects any learner block that
 * differs from its own catalog (src/study/safety/client.ts).
 */
export const STUDY_LEARNER_STOP_MESSAGE =
  'The lesson is paused for now. Please go get your dad so he can sit with you. You are not in trouble.'

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
    message: STUDY_LEARNER_STOP_MESSAGE,
    mayContinue: false,
    adultHelpState: 'proposed-not-delivered',
    emergencyGuidanceCode: 'seek-local-emergency-help-if-immediate-danger',
  }),
  uncertain: Object.freeze({
    messageCode: 'lesson-paused-adult-check-in',
    message: STUDY_LEARNER_STOP_MESSAGE,
    mayContinue: false,
    adultHelpState: 'proposed-not-delivered',
    emergencyGuidanceCode: 'none',
  }),
  invalid: Object.freeze({
    messageCode: 'lesson-paused-input-check',
    message: STUDY_LEARNER_STOP_MESSAGE,
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
