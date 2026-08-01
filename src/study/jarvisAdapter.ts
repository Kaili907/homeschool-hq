export type StudyJarvisIntent =
  | 'speak-approved-response'
  | 'show-approved-teaching-step'
  | 'offer-break'
  | 'toggle-captions'
  | 'toggle-transient-transcript'

const PRIVILEGED_INTENT = /assign|create|delete|mastery|grade|mark[-_ ]?complete|open[-_ ]?url|tool[-_ ]?call|privileged/i
const LOCAL_PROVIDER_KEY_NAME = /(?:anthropic|openai|elevenlabs|provider).*(?:api[-_ ]?key|token)|(?:api[-_ ]?key|token).*(?:anthropic|openai|elevenlabs|provider)/i

export function assertAllowedStudyJarvisIntent(value: string): asserts value is StudyJarvisIntent {
  const allowed: readonly string[] = [
    'speak-approved-response',
    'show-approved-teaching-step',
    'offer-break',
    'toggle-captions',
    'toggle-transient-transcript',
  ]
  if (!allowed.includes(value) || PRIVILEGED_INTENT.test(value)) {
    throw new Error('Jarvis privileged action attempt rejected.')
  }
}

/** Checks names only and never reads or prints a stored secret value. */
export function assertNoBrowserLocalProviderKeyNames(keyNames: readonly string[]): void {
  if (keyNames.some((key) => LOCAL_PROVIDER_KEY_NAME.test(key))) {
    throw new Error('Browser-local provider keys are not allowed for Study.')
  }
}

export interface StudyJarvisPresentation {
  readonly visibleText: string
  readonly audioText: string | null
  readonly captionsAlwaysVisible: true
  readonly lessonMayContinueWithoutMedia: true
  readonly transcriptIncluded: false
}

export function approvedJarvisPresentation(
  visibleText: string,
  options: { readonly noAudio: boolean; readonly mediaAvailable: boolean },
): StudyJarvisPresentation {
  if (/\bACTION\s*:|<tool|javascript:/i.test(visibleText)) {
    throw new Error('Unapproved Jarvis action syntax rejected.')
  }
  return {
    visibleText,
    audioText: options.noAudio || !options.mediaAvailable ? null : visibleText,
    captionsAlwaysVisible: true,
    lessonMayContinueWithoutMedia: true,
    transcriptIncluded: false,
  }
}
