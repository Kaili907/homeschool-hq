/**
 * Recognises when two answer strings denote the same number in different forms.
 *
 * A review of the grades 5-12 corpus found items whose distractor pool
 * contained a value equal to the key but written differently (e.g. an
 * unsimplified fraction beside its reduced form). A learner choosing the
 * unsimplified form is right but scored wrong, so such items must never be
 * emitted. Parsing is deliberately narrow: anything not recognised returns
 * null and is treated as not comparable, so an unparsed string can never be
 * mistaken for an equal one.
 */

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
