/**
 * Recognises when two answer strings denote the same number in different forms.
 *
 * A review of the corpus found items whose distractor pool contained a value
 * equal to the key but written differently — "sqrt(576)" beside "24", "32/40"
 * beside "4/5". A learner choosing the unsimplified form is right but scored
 * wrong, so such items must never be emitted. Parsing is deliberately narrow:
 * anything not recognised returns null and is treated as not comparable, so an
 * unparsed string can never be mistaken for an equal one.
 */

const RADICAL = /^\s*(-?\d+(?:\.\d+)?)?\s*(?:√|sqrt)\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?\s*$/
const FRACTION = /^\s*(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)\s*$/
const PLAIN = /^\s*(-?\d+(?:\.\d+)?)\s*$/

/** Normalises the leading minus signs the corpus renders with U+2212. */
const normalizeMinus = (text: string): string => text.replace(/[−–—]/g, '-')

export function numericValue(text: string): number | null {
  const source = normalizeMinus(text)

  const plain = PLAIN.exec(source)
  if (plain) return Number(plain[1])

  const fraction = FRACTION.exec(source)
  if (fraction) {
    const denominator = Number(fraction[2])
    if (denominator === 0) return null
    return Number(fraction[1]) / denominator
  }

  const radical = RADICAL.exec(source)
  if (radical) {
    const coefficient = radical[1] === undefined || radical[1] === '' ? 1 : Number(radical[1])
    const value = coefficient * Math.sqrt(Number(radical[2]))
    return Number.isFinite(value) ? value : null
  }

  return null
}

/** True when both strings parse to the same number but are written differently. */
export function isEquivalentButDifferent(left: string, right: string): boolean {
  if (left === right) return false
  const a = numericValue(left)
  const b = numericValue(right)
  if (a === null || b === null) return false
  return Math.abs(a - b) < 1e-9
}

/** True when any choice duplicates the correct answer's value in another form. */
export function hasEquivalentDistractor(
  choices: readonly string[],
  correctAnswer: string,
): boolean {
  return choices.some((choice) => isEquivalentButDifferent(choice, correctAnswer))
}
