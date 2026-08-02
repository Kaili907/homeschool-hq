import type { LearnerSafeSafetyResultV1, SafetyClassification } from '../contracts/safety'

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
    message: 'The lesson is paused. Please get a trusted adult who can help right now. You are not in trouble.',
    mayContinue: false,
    adultHelpState: 'proposed-not-delivered',
    emergencyGuidanceCode: 'seek-local-emergency-help-if-immediate-danger',
  },
  uncertain: {
    messageCode: 'lesson-paused-adult-check-in',
    message: 'The lesson is paused. Please ask a trusted adult to check in with you. You are not in trouble.',
    mayContinue: false,
    adultHelpState: 'proposed-not-delivered',
    emergencyGuidanceCode: 'none',
  },
  invalid: {
    messageCode: 'lesson-paused-input-check',
    message: 'The lesson is paused. Please ask a trusted adult to help check what happened. You are not in trouble.',
    mayContinue: false,
    adultHelpState: 'not-confirmed',
    emergencyGuidanceCode: 'none',
  },
}

export function learnerSafeResult(classification: SafetyClassification): LearnerSafeSafetyResultV1 {
  return RESULTS[classification]
}
