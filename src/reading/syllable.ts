/**
 * MR reading fluency — a lightweight, approximate English syllable splitter.
 *
 * Used ONLY for the "tap again for syllable-paced" pronunciation ("won-der-ful")
 * and its on-screen hint. English syllabification is genuinely hard; this is a
 * friendly heuristic, not a linguistics engine, and a wrong split just means the
 * tutor voice paces a familiar word slightly oddly — never a correctness signal.
 */

const VOWELS = 'aeiouy'

function isVowel(ch: string): boolean {
  return VOWELS.includes(ch)
}

/**
 * Split one word into syllable-ish chunks. Groups each vowel run with the
 * consonants that follow it, keeps a leading consonant cluster on the first
 * chunk, and never returns an empty chunk. Non-letters pass through unsplit.
 */
export function splitSyllables(word: string): string[] {
  const w = word.trim()
  if (w.length <= 3 || !/[a-z]/i.test(w)) return [w]

  const lower = w.toLowerCase()
  const chunks: string[] = []
  let cur = ''
  let sawVowelInCur = false

  for (let i = 0; i < w.length; i++) {
    const ch = lower[i]
    const vowel = isVowel(ch)
    // Start a new chunk at a vowel that begins a new vowel run, once the current
    // chunk already contains a vowel (i.e. a consonant boundary was crossed).
    const prevVowel = i > 0 ? isVowel(lower[i - 1]) : false
    if (vowel && !prevVowel && sawVowelInCur) {
      // break BEFORE the consonant that precedes this vowel, if any is buffered
      if (cur.length > 1 && !isVowel(lower[i - 1])) {
        const carry = cur.slice(-1)
        chunks.push(cur.slice(0, -1))
        cur = carry
      } else {
        chunks.push(cur)
        cur = ''
      }
      sawVowelInCur = false
    }
    cur += w[i]
    if (vowel) sawVowelInCur = true
  }
  if (cur) chunks.push(cur)

  // Merge any leading/trailing chunk that has no vowel into its neighbour.
  const merged: string[] = []
  for (const c of chunks) {
    if (merged.length > 0 && !/[aeiouy]/i.test(c)) {
      merged[merged.length - 1] += c
    } else if (merged.length > 0 && !/[aeiouy]/i.test(merged[merged.length - 1])) {
      merged[merged.length - 1] += c
    } else {
      merged.push(c)
    }
  }
  return merged.length > 0 ? merged : [w]
}

/** Hyphenated display form, e.g. "wonderful" → "won-der-ful". */
export function syllableHyphenate(word: string): string {
  return splitSyllables(word).join('-')
}

/** Space-separated form for the speak adapter to pace syllables ("won der ful"). */
export function syllableSpeech(word: string): string {
  return splitSyllables(word).join(' ')
}
