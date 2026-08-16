export const MAX_EXCHANGES = 6
export const DEFAULT_DAILY_CAP = 20

export const SCRIPTED_FLAG_REPLY =
  "That sounds like something to talk to your dad about — let's flag him."
export const CLOSEOUT_REPLY = "Let's flag this one for Dad — you've worked hard on it."
export const NAPPING_REPLY = "The tutor's napping — ask Dad!"

const CONCERNING = [
  'kill myself', 'kill me', 'want to die', 'wanna die', 'end my life', 'suicide',
  'hurt myself', 'hurting myself', 'cut myself', 'cutting myself', 'hate myself',
  'hate my life', 'nobody loves me', 'no one loves me', 'want to run away',
  'hits me', 'hit me', 'hurts me', 'touched me', 'abuse', "i'm scared", 'im scared', 'so scared',
]

export function isConcerning(text: string): boolean {
  const normalized = ` ${text.toLowerCase().replace(/[^a-z'\s]/g, ' ').replace(/\s+/g, ' ')} `
  return CONCERNING.some((phrase) =>
    normalized.includes(` ${phrase} `) || normalized.includes(`${phrase} `) || normalized.includes(` ${phrase}`))
}
