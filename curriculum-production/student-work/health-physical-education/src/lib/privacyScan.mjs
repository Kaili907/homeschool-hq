/**
 * Privacy/safety scan for generated Health + PE student-work materials.
 *
 * Mirrors the posture the source branches already build to (see each
 * course's README: "never require weight, BMI, body-fat, calorie counting,
 * medical disclosure, sexual-history disclosure, a photo/video/voice
 * recording of the learner, or a public performance"). This scan re-checks
 * the *generated projection* — the packages and scoring guides this
 * generator writes — so a mapping bug here cannot silently reintroduce a
 * requirement the source content deliberately excludes.
 *
 * A banned term is a violation only when the sentence containing it is not
 * itself a stated prohibition/exclusion (naming what the course refuses to
 * require is the point, not a violation). This is a heuristic scan for
 * routing to human review, the same posture the gate module documents for
 * its own specificity heuristic — not a substitute for the human privacy
 * reviewer pass.
 */

// "Bodyweight" is also ordinary PE vocabulary (bodyweight exercises,
// controlling your body weight in space, no-equipment/"bodyweight only"
// workouts, "records what they did") that has nothing to do with measuring
// or recording a learner's weight. The body-metric patterns below only
// match when a collection verb directly governs the metric itself (e.g.
// "record your body weight"), not merely co-occurs somewhere in sentence.
const METRIC_OWNER = '(?:your|the learner\'?s|the student\'?s|my)?'
const COLLECTION_VERB = '(?:measure|record|report|log|track|enter|submit|input|calculate|state|provide)\\w*'

const BANNED_PATTERNS = [
  { id: 'body-weight', re: new RegExp(`\\b${COLLECTION_VERB}\\s+${METRIC_OWNER}\\s*body\\s*weight\\b|\\bweight[- ]loss\\b`, 'i') },
  { id: 'bmi', re: new RegExp(`\\b${COLLECTION_VERB}\\s+${METRIC_OWNER}\\s*(?:BMI|body[- ]mass[- ]index)\\b`, 'i') },
  { id: 'body-fat', re: new RegExp(`\\b${COLLECTION_VERB}\\s+${METRIC_OWNER}\\s*body[- ]fat\\b`, 'i') },
  { id: 'calorie-restriction', re: /\bcalorie(?:s)?\s+(?:count|counting|restrict|restriction|limit|goal)\b|\bcalorie[- ]restrict(?:ed|ion)?\b/i },
  { id: 'medical-disclosure', re: /\b(?:disclose|report|share|submit|reveal)\b[^.]{0,60}\bmedical\s+(?:history|diagnosis|record)\b|\bmedical\s+(?:history|diagnosis)\s+(?:disclosure|is required|must be)\b/i },
  { id: 'sexual-history-disclosure', re: /\bsexual\s+history\b/i },
  { id: 'media-proof', re: /\b(?:take|submit|upload|record|film|photograph)\b[^.]{0,60}\b(?:photo|photograph|picture|video|voice recording|audio recording)\b[^.]{0,60}\b(?:yourself|of you|of the learner|as proof|for credit|for a grade)\b/i },
  { id: 'public-performance', re: /\b(?:perform|present|demonstrate)\b[^.]{0,40}\bin front of\b[^.]{0,30}\b(?:class|peers|audience|group)\b/i },
  { id: 'fitness-test-score', re: /\b(?:fitness test|timed trial|repetition count|distance score)\b[^.]{0,40}\b(?:is scored|is recorded|is required|counts toward)\b/i },
]

const NEGATION_CUES = /\b(?:never|no\b|not\s+\w+|without|excluded|isn'?t|doesn'?t|don'?t|need not|optional|refuses?|prohibited|forbidden|nothing private|no purchase|no recording|only unless the guardian supplies)\b/i

function sentences(text) {
  return String(text).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

function collectStrings(value, path, out) {
  if (value == null) return
  if (typeof value === 'string') {
    if (value.trim()) out.push({ path, text: value })
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out))
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectStrings(v, path ? `${path}.${k}` : k, out)
  }
}

/**
 * @param {object} doc parsed JSON of a generated package or scoring-guide file
 * @param {string} fileLabel path/id for reporting
 * @returns {Array<{fileLabel:string, path:string, patternId:string, sentence:string}>}
 */
export function scanDocument(doc, fileLabel) {
  const strings = []
  collectStrings(doc, '', strings)
  const violations = []
  for (const { path, text } of strings) {
    for (const sentence of sentences(text)) {
      for (const { id, re } of BANNED_PATTERNS) {
        if (!re.test(sentence)) continue
        if (NEGATION_CUES.test(sentence)) continue
        violations.push({ fileLabel, path, patternId: id, sentence })
      }
    }
  }
  return violations
}
