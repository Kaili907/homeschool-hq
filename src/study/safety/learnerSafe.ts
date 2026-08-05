import type { LearnerSafeSafetyResultV1, SafetyClassification } from '../contracts/safety'

/**
 * A6-5: one stop message for every non-clear classification. Identical wording
 * across urgent/uncertain/invalid is deliberate — the student surface must not
 * let the learner infer which check fired, and she is never left interpreting
 * a stop on her own.
 */
export const STUDY_LEARNER_STOP_MESSAGE =
  'The lesson is paused for now. Please go get your dad so he can sit with you. You are not in trouble.'

const RESULTS: Record<SafetyClassification, LearnerSafeSafetyResultV1> = {
  clear: {
    messageCode: 'study-safety-clear',
    message: 'You can continue when you are ready.',
    mayContinue: true,
    adultHelpState: 'not-needed',
    emergencyGuidanceCode: 'none',
  },
  urgent: {
    messageCode: 'lesson-paused-get-trusted-adult',
    message: STUDY_LEARNER_STOP_MESSAGE,
    mayContinue: false,
    adultHelpState: 'proposed-not-delivered',
    emergencyGuidanceCode: 'seek-local-emergency-help-if-immediate-danger',
  },
  uncertain: {
    messageCode: 'lesson-paused-adult-check-in',
    message: STUDY_LEARNER_STOP_MESSAGE,
    mayContinue: false,
    adultHelpState: 'proposed-not-delivered',
    emergencyGuidanceCode: 'none',
  },
  invalid: {
    messageCode: 'lesson-paused-input-check',
    message: STUDY_LEARNER_STOP_MESSAGE,
    mayContinue: false,
    adultHelpState: 'not-confirmed',
    emergencyGuidanceCode: 'none',
  },
}

export function learnerSafeResult(classification: SafetyClassification): LearnerSafeSafetyResultV1 {
  return RESULTS[classification]
}
