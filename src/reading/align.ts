/**
 * MR reading fluency — sequence alignment of a recognition transcript against the
 * passage text.
 *
 * HONESTY FIRST. Browser SpeechRecognition is noisy, so everything this module
 * produces is an ESTIMATE and is labelled that way in the UI. We never accuse the
 * child of getting a word "wrong" — low-confidence spots become "words to practice."
 *
 * The core is a classic Needleman–Wunsch global alignment (match +1, mismatch −1,
 * gap −1) between the passage's word tokens and the transcript's word tokens. From
 * the aligned operation sequence we derive:
 *   - correct       : passage words matched in order  → the numerator of WCPM
 *   - substituted   : passage words the recognizer heard as something else
 *   - skipped       : passage words with no transcript counterpart (a skipped line)
 *   - repeated      : transcript repetitions of a passage word (a self-correct / stumble)
 *   - practiceWords : the passage words behind those three cases — never "wrong," just practice
 *
 * All logic here is PURE and deterministic (no time, no randomness) so it can be
 * unit-tested against scripted transcripts.
 */

export type AlignOpKind = 'match' | 'sub' | 'skip' | 'insert'

export interface AlignOp {
  kind: AlignOpKind
  /** passage word index (present for match/sub/skip). */
  pi?: number
  /** transcript word index (present for match/sub/insert). */
  ti?: number
}

export interface AlignmentResult {
  passageWordCount: number
  /** passage words matched in order — the WCPM numerator. */
  correct: number
  /** passage words the recognizer substituted for a different word. */
  substituted: number
  /** passage words with no transcript counterpart (skips). */
  skipped: number
  /** transcript repetitions of a passage word (a stumble that still read correctly). */
  repeated: number
  /** passage word indices flagged as practice candidates (sub + skip + repeated). */
  practiceIndices: number[]
  /** the surface-form passage words behind practiceIndices (deduped, order-preserved). */
  practiceWords: string[]
  /** the raw op sequence, for tests and inspection. */
  ops: AlignOp[]
}

/**
 * Normalize free text into comparable word tokens: lowercase, keep letters/digits
 * and inner apostrophes, split on everything else. Punctuation and case never count
 * against the child.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, '')) // strip leading/trailing apostrophes
    .filter((w) => w.length > 0)
}

const MATCH = 1
const MISMATCH = -1
const GAP = -1

/**
 * Align transcript tokens against passage tokens. `passageSurface`, when provided,
 * supplies the original-case passage words for the practiceWords list (falls back to
 * the normalized passage tokens).
 */
export function alignTokens(
  passage: string[],
  transcript: string[],
  passageSurface?: string[],
): AlignmentResult {
  const n = passage.length
  const m = transcript.length
  const surface = passageSurface && passageSurface.length === n ? passageSurface : passage

  // score[i][j] = best alignment score of passage[0..i) vs transcript[0..j)
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 0; i <= n; i++) score[i][0] = i * GAP
  for (let j = 0; j <= m; j++) score[0][j] = j * GAP

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = score[i - 1][j - 1] + (passage[i - 1] === transcript[j - 1] ? MATCH : MISMATCH)
      const up = score[i - 1][j] + GAP // passage word consumed, no transcript → skip
      const left = score[i][j - 1] + GAP // transcript word consumed, no passage → insert
      score[i][j] = Math.max(diag, up, left)
    }
  }

  // Traceback. Tie-break priority (diag → up → left) is fixed for determinism.
  const ops: AlignOp[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const isMatch = passage[i - 1] === transcript[j - 1]
      const diag = score[i - 1][j - 1] + (isMatch ? MATCH : MISMATCH)
      if (score[i][j] === diag) {
        ops.push({ kind: isMatch ? 'match' : 'sub', pi: i - 1, ti: j - 1 })
        i--
        j--
        continue
      }
    }
    if (i > 0 && score[i][j] === score[i - 1][j] + GAP) {
      ops.push({ kind: 'skip', pi: i - 1 })
      i--
      continue
    }
    // remaining case: left / insertion
    ops.push({ kind: 'insert', ti: j - 1 })
    j--
  }
  ops.reverse()

  // For each op, the passage index of the nearest match/sub before (prevPI) and after
  // (nextPI). An insertion sits between two passage anchors; if its transcript word
  // equals either anchor it is a REPETITION of that word (a self-correct / stumble),
  // regardless of which side the traceback happened to place it on.
  const prevPI = new Array<number>(ops.length).fill(-1)
  const nextPI = new Array<number>(ops.length).fill(-1)
  let carry = -1
  for (let k = 0; k < ops.length; k++) {
    prevPI[k] = carry
    if ((ops[k].kind === 'match' || ops[k].kind === 'sub') && ops[k].pi !== undefined) carry = ops[k].pi!
  }
  carry = -1
  for (let k = ops.length - 1; k >= 0; k--) {
    nextPI[k] = carry
    if ((ops[k].kind === 'match' || ops[k].kind === 'sub') && ops[k].pi !== undefined) carry = ops[k].pi!
  }

  // Classify.
  let correct = 0
  let substituted = 0
  let skipped = 0
  let repeated = 0
  const practice = new Set<number>()

  for (let k = 0; k < ops.length; k++) {
    const op = ops[k]
    if (op.kind === 'match') {
      correct++
    } else if (op.kind === 'sub') {
      substituted++
      practice.add(op.pi!)
    } else if (op.kind === 'skip') {
      skipped++
      practice.add(op.pi!)
    } else {
      // insert: repetition of an adjacent passage word, or a stray filler word (ignored).
      const w = transcript[op.ti!]
      let anchor = -1
      if (prevPI[k] >= 0 && passage[prevPI[k]] === w) anchor = prevPI[k]
      else if (nextPI[k] >= 0 && passage[nextPI[k]] === w) anchor = nextPI[k]
      if (anchor >= 0) {
        repeated++
        practice.add(anchor)
      }
    }
  }

  const practiceIndices = [...practice].sort((a, b) => a - b)
  const seen = new Set<string>()
  const practiceWords: string[] = []
  for (const idx of practiceIndices) {
    const w = surface[idx]
    const key = w.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      practiceWords.push(w)
    }
  }

  return {
    passageWordCount: n,
    correct,
    substituted,
    skipped,
    repeated,
    practiceIndices,
    practiceWords,
    ops,
  }
}

/**
 * Convenience: align raw passage text vs raw transcript text. Keeps the passage's
 * original surface words for the practice list.
 */
export function alignReading(passageText: string, transcriptText: string): AlignmentResult {
  const surface = passageText
    .replace(/[^A-Za-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length > 0)
  const passageTokens = surface.map((w) => w.toLowerCase())
  const transcriptTokens = tokenize(transcriptText)
  return alignTokens(passageTokens, transcriptTokens, surface)
}
