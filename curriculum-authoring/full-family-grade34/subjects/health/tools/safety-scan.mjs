// G34-M5 — content safety scan for Grade 3/4 Health.
//
// Split out of build-health-g34.mjs so the rules can be exercised directly by
// tools/safety-scan.test.mjs without running a build.
//
// Two categories are checked:
//   - body-metric terms (BMI, weigh-ins, dieting, weight-loss goals, ...)
//   - media the learner is asked to produce, or media depicting the learner
//
// Both are legitimate inside an explicit prohibition — naming what the course
// refuses to do is the point — so a match is excused when a negation scopes
// over it. Scope is resolved lexically rather than by testing the whole
// sentence for a negation substring:
//
//   1. Cues are matched as whole words. `no` never matches "now", "note",
//      "nose", "normal", or "notebook"; `nor` never matches "normal"; `not`
//      never matches "nothing else" as a stand-in for a real prohibition.
//   2. Scope is forward-only and clause-bounded. A negation excuses a term
//      only when it sits in the same clause and *before* the term, so a
//      negation in one clause cannot launder a banned term in a later,
//      unrelated clause of the same sentence.
//
// Known limit, deliberately not guessed at: scope is not resolved across a
// plain comma, because a prohibition normally distributes over the list it
// introduces ("no body measurement, calorie counting, or dieting"). A new
// predicate joined by ", and"/", or" does break scope when it starts with one
// of the collection verbs below, which is the case that would otherwise smuggle
// a requirement in behind a prohibition.

export const BANNED = [
  /\bBMI\b/i, /body[- ]fat/i, /\bcalorie count/i, /weigh-?in/i,
  /\bdiet(ing)?\b/i, /weight[- ]loss/i, /body[- ]size (?:goal|target|scor)/i,
]

export const MEDIA_PRODUCE =
  /\b(take|takes|taking|record|records|film|films|upload|uploads|submit|submits|post|posts|send|sends|capture|captures)\s+(?:a\s+|an\s+|the\s+|your\s+)?(photo|photograph|video|recording|image)/i

export const MEDIA_OF_LEARNER =
  /(photo|photograph|video|recording|image)[^.]{0,40}\bof\s+(you|yourself|your|the learner)/i

// Whole-word negation cues. Stems cover inflections (refuse/refuses/refusal)
// but still anchor on both ends, so they cannot fire on an unrelated word.
const NEGATION_CUE =
  /\b(?:no|not|never|none|nothing|nobody|nowhere|nor|neither|without|cannot|non-\w+|refus\w*|exclud\w*|prohibit\w*|forbid\w*|disallow\w*|optional\w*|opt-out|opt out|instead of|rather than)\b/i

// Verbs that mark a new demand rather than another item in a prohibited list.
const COLLECT_VERB =
  'record|records|log|logs|take|takes|measure|measures|count|counts|weigh|weighs|track|tracks|submit|submits|require|requires|enter|enters|report|reports|write|writes|photograph|photographs|upload|uploads'

// Scope-breaking boundaries: strong punctuation, contrastive and subordinating
// conjunctions, and a coordinated clause that opens a fresh demand. `instead`
// is deliberately absent: `instead of` is itself a cue, and breaking on the
// bare word would strip the cue out of the clause it governs.
const CLAUSE_BREAK = new RegExp(
  '(?:[;:]|—|–|--)' +
    '|\\b(?:but|however|yet|although|though|whereas|while|otherwise|because|since|which|who)\\b' +
    `|,\\s*(?:and|or)\\s+(?:${COLLECT_VERB})\\b`,
  'gi',
)

const splitSentences = (text) => String(text).split(/(?<=[.!?])\s+|\n/)
const splitClauses = (sentence) => sentence.split(CLAUSE_BREAK)

// Index of the earliest negation cue in a clause, or -1 when it carries none.
export function negationIndex(clause) {
  const m = NEGATION_CUE.exec(clause)
  return m ? m.index : -1
}

// Returns a list of finding strings. Empty means the text is clean.
export function scanText(label, text) {
  const findings = []
  for (const sentence of splitSentences(text)) {
    for (const clause of splitClauses(sentence)) {
      if (!clause) continue
      const guard = negationIndex(clause)
      const excused = (index) => guard !== -1 && guard < index
      for (const re of BANNED) {
        const m = re.exec(clause)
        if (m && !excused(m.index)) {
          findings.push(`${label}: unnegated body-metric term ${re} -> ${clause.trim().slice(0, 90)}`)
        }
      }
      for (const re of [MEDIA_PRODUCE, MEDIA_OF_LEARNER]) {
        const m = re.exec(clause)
        if (m && !excused(m.index)) {
          findings.push(`${label}: media requirement -> ${clause.trim().slice(0, 90)}`)
          break
        }
      }
    }
  }
  return findings
}
