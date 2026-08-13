// Manuel Academy — external World Language course/pathway validator.
//
// Two layers, deliberately separated:
//
//   STRUCTURE  a small JSON Schema subset, read from schema/*.json so the field
//              list has exactly one home and cannot drift from this file.
//   RULES      the claims that JSON Schema cannot express — the ones that stop a
//              record from asserting credit, proficiency, or authorship it has no
//              evidence for. These are the point of the contract.
//
// Runs on plain node, no dependencies: this worktree has no node_modules, and a
// contract that can only be checked after an install is a contract nobody checks.
//
//   node validate-external-course.mjs                 examples + self-test
//   node validate-external-course.mjs <file>...       validate given files
//   node validate-external-course.mjs --self-test     negative fixtures only
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const VALIDATOR_SCHEMA_VERSION = 1
export const READY = 'WORLD_LANGUAGE_EXTERNAL_CONTRACT_READY'
export const BLOCKED = 'BLOCKED'

const HERE = dirname(fileURLToPath(import.meta.url))

const COURSE_SCHEMA_ID = 'manuel-academy-world-language-external-course-1.0'
const PATHWAY_SCHEMA_ID = 'manuel-academy-world-language-external-pathway-1.0'

/** Statuses at which a record represents a real enrolment rather than a plan. */
const ENROLLED_STATUSES = new Set(['enrolled', 'in-progress', 'completed'])

/** An unfilled template slot. Case-insensitive, but the inner token must be a
 *  bare identifier of 3+ characters, so `<name@example.com>` and ordinary prose
 *  survive while `<PROVIDER_LEGAL_NAME>` and `<provider_legal_name>` do not. */
const PLACEHOLDER = /<[A-Za-z][A-Za-z0-9_]{2,}>/

/** Evidence kinds that actually carry a grade. A receipt proves payment. */
const TRANSCRIPT_EVIDENCE_KINDS = new Set(['provider-transcript', 'report-card'])

/**
 * Manuel Academy's own elementary Japanese material. It is declared grades 3-4,
 * has zero authored lessons and ~40 contact hours a year (see
 * ../world-language-decision/existing-japanese-inventory.md). It may never appear
 * as evidence for high-school credit, so the paths are denied by name rather than
 * left to reviewer memory.
 */
const INTERNAL_SOURCE_DENYLIST = [
  'Japanese-Year-1-Curriculum.md',
  'src/curriculum/plans/japanese-year-1',
  'curriculum/plans/japanese-year-1',
]
const ELEMENTARY_COURSE_ID = /\bma-g[34]-/
/** The phrasings the same document travels under when the path is not quoted. */
const ELEMENTARY_PHRASE = /japanese[\s_-]*year[\s_-]*(1|one)|year[\s_-]*(1|one)[\s_-]*(japanese|curriculum)/i

/** ACTFL sub-levels at or above Michigan's stated target. */
const AT_OR_ABOVE_NOVICE_HIGH =
  /\b(novice\s+high|intermediate\s+(low|mid|high)|advanced|superior|distinguished)\b/i

/**
 * A proficiency band asserted in prose. The whole point of R5/R12 is that a level
 * comes from an instrument; a free-text sentence that reasons from contact hours
 * to a band reaches the same false claim by a side door. JLPT N-levels are
 * deliberately absent - "JLPT N5 score report" is a legitimate evidence
 * description, and the artifact fields are exempt anyway.
 */
const PROFICIENCY_IN_PROSE =
  /\b(novice|intermediate|advanced)\s+(low|mid|high)\b|\b(superior|distinguished)\b|\bCEFR\s*[ABC][12]\b/i

/** Prose asserting the Michigan Merit Curriculum is satisfied, in either order. */
const MMC_SATISFIED = new RegExp(
  '(michigan merit curriculum|\\bMMC\\b)[^.]{0,60}\\b(satisf(?:y|ies|ied)|meets?|met|fulfil(?:s|led|ls)?|closes?|covers?|covered)\\b'
  + '|\\b(satisf(?:y|ies|ied)|meets?|met|fulfil(?:s|led|ls)?|closes?|covers?|covered)\\b[^.]{0,60}(michigan merit curriculum|\\bMMC\\b)',
  'i')

const fail = (code, message, detail = {}) => ({ level: 'error', code, message, detail })
const warn = (code, message, detail = {}) => ({ level: 'warning', code, message, detail })

// ---------------------------------------------------------------- structure --

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

const typeMatches = (value, type) => {
  switch (type) {
    case 'object': return isPlainObject(value)
    case 'array': return Array.isArray(value)
    case 'string': return typeof value === 'string'
    case 'number': return typeof value === 'number' && Number.isFinite(value)
    case 'integer': return Number.isInteger(value)
    case 'boolean': return typeof value === 'boolean'
    case 'null': return value === null
    default: return false
  }
}

const deref = (node, root) => {
  if (!isPlainObject(node) || typeof node.$ref !== 'string') return node
  const path = node.$ref.replace(/^#\//, '').split('/')
  let cursor = root
  for (const key of path) cursor = cursor?.[key]
  return cursor ?? node
}

/**
 * The JSON Schema subset the contract's schema files are written in: type,
 * required, properties, additionalProperties:false, enum, const, items, minItems,
 * minLength, minimum, maximum, pattern, $ref into $defs. Anything outside that
 * subset is a schema-authoring error, not a data error — checkSchemaSubset below
 * catches it so a silently-ignored keyword can never weaken the contract.
 */
export function checkStructure(value, schema, root = schema, path = '$') {
  const out = []
  const node = deref(schema, root)
  if (!isPlainObject(node)) return out

  if ('const' in node && value !== node.const) {
    return [fail('SCHEMA_CONST', `${path} must be ${JSON.stringify(node.const)}`, { path, got: value })]
  }
  if (Array.isArray(node.enum) && !node.enum.some((option) => option === value)) {
    return [fail('SCHEMA_ENUM', `${path} is not one of the permitted values`, { path, got: value })]
  }
  if (node.type !== undefined) {
    const types = Array.isArray(node.type) ? node.type : [node.type]
    if (!types.some((t) => typeMatches(value, t))) {
      return [fail('SCHEMA_TYPE', `${path} must be ${types.join(' | ')}`, { path, got: value })]
    }
  }

  if (typeof value === 'string') {
    if (typeof node.pattern === 'string' && !new RegExp(node.pattern).test(value)) {
      out.push(fail('SCHEMA_PATTERN', `${path} does not match ${node.pattern}`, { path, got: value }))
    }
    if (Number.isInteger(node.minLength) && value.length < node.minLength) {
      out.push(fail('SCHEMA_MIN_LENGTH', `${path} is shorter than ${node.minLength}`, { path }))
    }
  }
  if (typeof value === 'number') {
    if (typeof node.minimum === 'number' && value < node.minimum) {
      out.push(fail('SCHEMA_MINIMUM', `${path} is below ${node.minimum}`, { path, got: value }))
    }
    if (typeof node.maximum === 'number' && value > node.maximum) {
      out.push(fail('SCHEMA_MAXIMUM', `${path} is above ${node.maximum}`, { path, got: value }))
    }
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(node.minItems) && value.length < node.minItems) {
      out.push(fail('SCHEMA_MIN_ITEMS', `${path} needs at least ${node.minItems} entries`, { path }))
    }
    if (node.items) {
      value.forEach((entry, i) => out.push(...checkStructure(entry, node.items, root, `${path}[${i}]`)))
    }
  }
  if (isPlainObject(value)) {
    for (const key of node.required ?? []) {
      if (!(key in value)) out.push(fail('SCHEMA_REQUIRED', `${path}.${key} is missing`, { path, key }))
    }
    const properties = node.properties ?? {}
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          out.push(fail('SCHEMA_ADDITIONAL', `${path}.${key} is not a contract field`, { path, key }))
        }
      }
    }
    for (const [key, sub] of Object.entries(properties)) {
      if (key in value) out.push(...checkStructure(value[key], sub, root, `${path}.${key}`))
    }
  }
  return out
}

const SUPPORTED_KEYWORDS = new Set([
  '$schema', '$id', '$ref', '$defs', 'title', 'description',
  'type', 'required', 'properties', 'additionalProperties',
  'enum', 'const', 'items', 'minItems', 'minLength', 'minimum', 'maximum', 'pattern',
])

/** A keyword this validator does not implement would be silently ignored, which
 *  would let the schema promise a constraint nothing enforces. Fail instead. */
export function checkSchemaSubset(schema, path = '$') {
  const out = []
  if (Array.isArray(schema)) {
    schema.forEach((entry, i) => out.push(...checkSchemaSubset(entry, `${path}[${i}]`)))
    return out
  }
  if (!isPlainObject(schema)) return out
  for (const [key, sub] of Object.entries(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key) && !/\.(properties|\$defs)$/.test(path)) {
      out.push(fail('SCHEMA_KEYWORD_UNSUPPORTED', `${path}.${key} is not implemented by this validator`, { path, key }))
    }
    if (isPlainObject(sub) || Array.isArray(sub)) out.push(...checkSchemaSubset(sub, `${path}.${key}`))
  }
  return out
}

// -------------------------------------------------------------------- rules --

const walkStrings = (value, visit, path = '$') => {
  if (typeof value === 'string') return visit(value, path)
  if (Array.isArray(value)) return value.forEach((v, i) => walkStrings(v, visit, `${path}[${i}]`))
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) walkStrings(v, visit, `${path}.${k}`)
  }
}

const allEvidence = (record) => Object.values(record.evidence ?? {}).flatMap((list) => (Array.isArray(list) ? list : []))

/**
 * The contract's honesty rules. Each returns findings; codes are stable.
 *
 * `context.inPathway` matters: a lone record cannot know how much credit the
 * whole sequence delivered, so a Novice-High-or-above claim is only assessable
 * inside a pathway (R12). Validating a record on its own is not a way around it.
 */
export function checkRecordRules(record, label = record?.record_id ?? '<record>', context = {}) {
  const out = []
  const at = (code, message, detail) => out.push(fail(code, `${label}: ${message}`, detail))
  const status = record.status

  // R1 - authorship may never drift toward Manuel Academy. Checked in BOTH word
  // orders: "Manuel Academy taught this" and "taught by Manuel Academy" are the
  // same lie, and the second is the more natural sentence.
  const statement = record.authorship?.statement ?? ''
  const VERBS = 'authored|wrote|created|developed|designed|delivered|instructed|graded|provided|teaches|taught|assesses|assessed'
  const CLAIMS_MA = new RegExp(
    `(manuel academy[^.]{0,40}\\b(?:${VERBS})\\b)|(\\b(?:${VERBS})\\b[^.]{0,40}manuel academy)`, 'i')
  if (CLAIMS_MA.test(statement)) {
    at('R1_AUTHORSHIP_CLAIMED', 'authorship.statement claims Manuel Academy authored, taught, or assessed the course',
      { statement })
  }

  // R2 - an unfilled template slot may not survive past status=template.
  if (status === 'template') {
    let found = false
    walkStrings(record, (s) => { if (PLACEHOLDER.test(s)) found = true })
    if (!found) at('R2_TEMPLATE_WITHOUT_PLACEHOLDER', 'status=template but no <PLACEHOLDER> remains; set a real status')
  } else {
    walkStrings(record, (s, path) => {
      if (PLACEHOLDER.test(s)) at('R2_PLACEHOLDER_NOT_FILLED', `unfilled placeholder at ${path}`, { path, value: s })
    })
  }

  // R3 - a real enrolment names a real provider.
  if (ENROLLED_STATUSES.has(status)) {
    const p = record.provider ?? {}
    if (p.selection_status === 'unselected' || p.kind === 'unselected' || !p.legal_name) {
      at('R3_PROVIDER_REQUIRED', `status=${status} requires a named, selected provider`, {
        selection_status: p.selection_status, kind: p.kind, legal_name: p.legal_name,
      })
    }
  }

  // R4 - credit is awarded on provider evidence, never on intent. The evidence
  // must be the KIND that carries a grade: a receipt proves payment, not study.
  const awarded = record.credit?.awarded
  if (awarded !== null && awarded !== undefined) {
    const transcriptEvidence = (record.evidence?.transcript ?? []).some(
      (e) => TRANSCRIPT_EVIDENCE_KINDS.has(e.kind) && e.verified_by_parent === true)
    const reasons = []
    if (status !== 'completed') reasons.push(`status is ${status}`)
    if (!record.final_grade?.reported) reasons.push('no final grade reported')
    if ((record.final_grade?.source ?? 'none') === 'none') reasons.push('final grade has no source')
    if (!transcriptEvidence) reasons.push('no parent-verified provider transcript or report card')
    if (!record.parent_verification?.verified_on) reasons.push('no parent verification date')
    if (reasons.length) at('R4_CREDIT_UNEVIDENCED', `credit.awarded is set but ${reasons.join('; ')}`, { reasons })
  }

  // R5 - proficiency is measured by an instrument, never inferred from hours.
  if (record.proficiency?.claimed_level) {
    const artifact = (record.evidence?.proficiency_artifact ?? []).some(
      (e) => e.kind === 'proficiency-score-report' && e.verified_by_parent === true,
    )
    const reasons = []
    if (!artifact) reasons.push('no parent-verified proficiency score report')
    if (!record.proficiency.framework) reasons.push('no framework named')
    if (!record.proficiency.assessed_on) reasons.push('no assessment date')
    if (reasons.length) {
      at('R5_PROFICIENCY_UNEVIDENCED', `proficiency.claimed_level is set but ${reasons.join('; ')}`, { reasons })
    }
  }

  // R6 - the elementary plan is not high-school evidence. A denylist of paths
  // plus the phrasings the same document travels under; it cannot catch every
  // paraphrase, so external-course-contract.md states its limits plainly.
  walkStrings(record, (s, path) => {
    const hit = INTERNAL_SOURCE_DENYLIST.some((needle) => s.includes(needle))
      || ELEMENTARY_COURSE_ID.test(s)
      || ELEMENTARY_PHRASE.test(s)
    if (hit) at('R6_ELEMENTARY_PLAN_NOT_HS_CREDIT', `internal elementary Japanese material cited at ${path}`, { path, value: s })
  })

  // R7 - no record may advance a graduation-completeness claim. The NOT_ escape
  // is scoped to the matched phrase: a sentence may quote the real verdict and
  // still go on to contradict it.
  walkStrings(record, (s, path) => {
    for (const match of s.matchAll(/(not[\s_-]?)?graduation[\s_-]?complete/gi)) {
      if (!match[1]) {
        at('R7_GRADUATION_CLAIM_FORBIDDEN', `graduation-completeness language at ${path}`, { path, value: s })
        break
      }
    }
  })

  // R8 - dates in order; a completed term has ended.
  const { start_date: start, end_date: end } = record.term ?? {}
  if (start && end && start > end) at('R8_TERM_DATES_INVERTED', `term.start_date ${start} is after term.end_date ${end}`)
  if (status === 'completed' && !end) at('R8_COMPLETED_WITHOUT_END_DATE', 'status=completed requires term.end_date')

  // R9 - completion tracking must be arithmetically possible.
  const { assignments_reported: reported, assignments_completed: done } = record.tracking ?? {}
  if (Number.isInteger(reported) && Number.isInteger(done) && done > reported) {
    at('R9_TRACKING_IMPOSSIBLE', `tracking reports ${done} completed of ${reported}`)
  }

  // R10 - evidence must say when it was obtained.
  for (const item of allEvidence(record)) {
    if (item.verified_by_parent === true && !item.obtained_on) {
      at('R10_VERIFIED_WITHOUT_DATE', `evidence "${item.description}" is verified but carries no obtained_on`)
    }
  }

  // R11 - a term cannot award more credit than it was planned to carry.
  // credit.awarded is the only credit that prints (transcript-model.md sect 3),
  // so it is the number that must not be free.
  if (typeof awarded === 'number' && typeof record.credit?.requested === 'number' && awarded > record.credit.requested) {
    at('R11_CREDIT_INFLATED', `credit.awarded ${awarded} exceeds credit.requested ${record.credit.requested}`)
  }

  // R12 - the substitution trap at record level. Michigan attaches Novice High
  // to TWO credits; no single term reaches it, and a record validated outside a
  // pathway cannot show the credits that would justify the claim.
  const level = record.proficiency?.claimed_level
  if (level && AT_OR_ABOVE_NOVICE_HIGH.test(level)) {
    if (!context.inPathway) {
      at('R12_PROFICIENCY_CLAIM_NEEDS_PATHWAY',
        `claimed_level "${level}" is at or above Novice High; assessable only within a pathway that shows 2.0 awarded credits`)
    } else if ((context.pathwayAwardedCredits ?? 0) < 2) {
      at('R12_PROFICIENCY_CLAIM_UNDERCREDITED',
        `claimed_level "${level}" on a pathway with ${context.pathwayAwardedCredits ?? 0} awarded credits`)
    }
  }

  // R13 - an enrolment with no syllabus is an enrolment nobody can describe.
  if (ENROLLED_STATUSES.has(status)) {
    const described = [...(record.evidence?.syllabus ?? []), ...(record.evidence?.other ?? [])]
      .some((e) => e.kind === 'syllabus' || e.kind === 'course-catalog-entry')
    if (!described) at('R13_NO_SOURCE_EVIDENCE', `status=${status} requires syllabus or course-catalog evidence`)
  }

  // R14 - progress must say where it is read from.
  if ((status === 'in-progress' || status === 'completed') && (record.tracking?.completion_source ?? 'none') === 'none') {
    at('R14_NO_COMPLETION_SOURCE', `status=${status} requires tracking.completion_source`)
  }

  // R15 - a proficiency band belongs in proficiency.*, gated by R5 and R12, and
  // nowhere else. Free text is not a second, ungated channel for the same claim.
  walkStrings(record, (value, path) => {
    if (path.startsWith('$.proficiency.')) return
    if (PROFICIENCY_IN_PROSE.test(value)) {
      at('R15_PROFICIENCY_IN_FREE_TEXT', `a proficiency band is asserted in prose at ${path}`, { path, value })
    }
  })

  // R16 - no record asserts that the MMC is satisfied. It does not bind this
  // family (decision-record.md sect 2 Option 3), so the claim is both unnecessary
  // and untrue.
  walkStrings(record, (value, path) => {
    if (MMC_SATISFIED.test(value)) {
      at('R16_MMC_SATISFACTION_CLAIMED', `prose claims the MMC is satisfied at ${path}`, { path, value })
    }
  })
  return out
}

/** Pathway strings excluding the records subtree, which its own rules cover. */
const walkPathwayStrings = (pathway, visit) => {
  for (const [key, value] of Object.entries(pathway)) {
    if (key === 'records') continue
    walkStrings(value, visit, `$.${key}`)
  }
}

/** The pathway's own declared target legitimately names a band; records never do. */
const PATHWAY_PROFICIENCY_FIELDS = new Set([
  '$.target.proficiency_target',
  '$.target.proficiency_target_basis',
  '$.transcript.proficiency_claim',
])

/** Pathway-level rules - the ones about the sequence rather than the term. */
export function checkPathwayRules(pathway) {
  const out = []
  const records = pathway.records ?? []

  // P1 - two years of the SAME language, or the college expectation is not met.
  const languages = new Set(records.map((r) => r.language?.iso_639_3))
  if (languages.size > 1) {
    out.push(fail('P1_PATHWAY_LANGUAGE_MISMATCH',
      'records span more than one language; the college expectation is two years of the same language',
      { languages: [...languages] }))
  } else if (languages.size === 1 && !languages.has(pathway.language?.iso_639_3)) {
    out.push(fail('P1_PATHWAY_LANGUAGE_MISMATCH', 'records do not match the pathway language',
      { pathway: pathway.language?.iso_639_3, records: [...languages] }))
  }

  // P2 - the sequence is contiguous and unique.
  const positions = records.map((r) => r.term?.sequence_position)
  const expected = records.map((_, i) => i + 1)
  if (JSON.stringify([...positions].sort((a, b) => a - b)) !== JSON.stringify(expected)) {
    out.push(fail('P2_SEQUENCE_NOT_CONTIGUOUS', 'term.sequence_position must be 1..n exactly once', { positions }))
  }
  if (records.length !== pathway.target?.semesters) {
    out.push(fail('P2_SEMESTER_COUNT_MISMATCH',
      `target.semesters is ${pathway.target?.semesters} but ${records.length} records are present`))
  }

  // P3 - requested credit sums to the stated target.
  const requested = records.reduce((sum, r) => sum + (r.credit?.requested ?? 0), 0)
  if (Math.abs(requested - (pathway.target?.credits ?? 0)) > 1e-9) {
    out.push(fail('P3_CREDIT_SUM_MISMATCH',
      `records request ${requested} credits against a target of ${pathway.target?.credits}`))
  }

  const awardedTotal = records.reduce((sum, r) => sum + (r.credit?.awarded ?? 0), 0)

  // P4 - the substitution trap, made mechanical. Michigan's Novice High target
  // attaches to two credits; ~90 hours of a Category IV language does not reach
  // it. A transcript claim needs an artifact AND a pathway that delivered two.
  const claim = pathway.transcript?.proficiency_claim
  if (claim) {
    const artifact = records.some((r) =>
      (r.evidence?.proficiency_artifact ?? []).some((e) => e.kind === 'proficiency-score-report' && e.verified_by_parent === true))
    if (!artifact) {
      out.push(fail('P4_PATHWAY_PROFICIENCY_UNEVIDENCED',
        'transcript.proficiency_claim is set but no record carries a parent-verified proficiency score report'))
    }
    if (AT_OR_ABOVE_NOVICE_HIGH.test(claim) && awardedTotal < 2) {
      out.push(fail('P4_NOVICE_HIGH_ON_UNDERCREDITED_PATHWAY',
        `transcript claims "${claim}" on ${awardedTotal} awarded credits; Michigan attaches Novice High to two`,
        { awarded: awardedTotal }))
    }
  }

  // P5 - below the college floor the pathway still validates, but says so.
  if ((pathway.target?.credits ?? 0) < 2) {
    out.push(warn('P5_COLLEGE_FLOOR_NOT_MET',
      `target.credits is ${pathway.target?.credits}; U-M (LSA) requires two years of the same language for admission and MSU names two in its college-prep curriculum`))
  }

  // P6 - no paid provider is endorsed in code. Belt and braces: the schema's
  // `const: null` normally rejects this first, so the self-test fixture for it
  // lands on SCHEMA_CONST. This survives a relaxed schema.
  if (pathway.provider_selection?.endorsed_provider !== null) {
    out.push(fail('P6_PROVIDER_ENDORSED_IN_CODE', 'provider_selection.endorsed_provider must stay null'))
  }

  // P7 - the sequence cannot award more than it set out to deliver. Without
  // this, R11 alone still lets four half-credit terms award 2.0 each.
  if (awardedTotal - (pathway.target?.credits ?? 0) > 1e-9) {
    out.push(fail('P7_PATHWAY_CREDIT_INFLATED',
      `records award ${awardedTotal} credits against a target of ${pathway.target?.credits}`))
  }

  // P8 - same as R15, one level up. Only the declared target and the gated
  // transcript claim may name a band.
  walkPathwayStrings(pathway, (value, path) => {
    if (PATHWAY_PROFICIENCY_FIELDS.has(path)) return
    if (PROFICIENCY_IN_PROSE.test(value)) {
      out.push(fail('P8_PROFICIENCY_IN_FREE_TEXT', `a proficiency band is asserted in prose at ${path}`, { path, value }))
    }
  })

  // P9 - same as R16. mmc_note is the field most likely to drift.
  walkPathwayStrings(pathway, (value, path) => {
    if (MMC_SATISFIED.test(value)) {
      out.push(fail('P9_MMC_SATISFACTION_CLAIMED', `prose claims the MMC is satisfied at ${path}`, { path, value }))
    }
  })

  records.forEach((record, i) => {
    out.push(...checkRecordRules(record, `${pathway.pathway_id}#${record.record_id ?? i}`, {
      inPathway: true,
      pathwayAwardedCredits: awardedTotal,
    }))
  })
  return out
}

// ------------------------------------------------------------------ drivers --

let schemaCache = null
export async function loadSchemas() {
  if (schemaCache) return schemaCache
  const [course, pathway] = await Promise.all([
    readFile(resolve(HERE, 'schema/external-course.schema.json'), 'utf8').then(JSON.parse),
    readFile(resolve(HERE, 'schema/external-pathway.schema.json'), 'utf8').then(JSON.parse),
  ])
  schemaCache = { course, pathway }
  return schemaCache
}

/** Rule checks run against documents that may already have failed structure, so
 *  a malformed shape must surface as a finding rather than a stack trace. */
const safely = (run) => {
  try { return run() } catch (error) {
    return [fail('RULE_CHECK_THREW', `rule evaluation failed: ${error.message}`)]
  }
}

/** Validate one already-parsed document; dispatches on schema_version. */
export async function validateDocument(doc) {
  const { course, pathway } = await loadSchemas()
  if (!isPlainObject(doc)) return [fail('NOT_AN_OBJECT', 'document is not a JSON object')]
  // Structure and rules BOTH run. Returning early on a schema slip would let an
  // author fix a typo, re-run, and only then meet the honesty findings - or read
  // a short structural report as a pass.
  if (doc.schema_version === COURSE_SCHEMA_ID) {
    return [...checkStructure(doc, course), ...safely(() => checkRecordRules(doc))]
  }
  if (doc.schema_version === PATHWAY_SCHEMA_ID) {
    const findings = checkStructure(doc, pathway)
    for (const record of doc.records ?? []) findings.push(...checkStructure(record, course))
    return [...findings, ...safely(() => checkPathwayRules(doc))]
  }
  return [fail('SCHEMA_VERSION_UNKNOWN', `unrecognised schema_version ${JSON.stringify(doc.schema_version)}`)]
}

export async function validateFile(path) {
  const doc = JSON.parse(await readFile(path, 'utf8'))
  return validateDocument(doc)
}

const clone = (v) => JSON.parse(JSON.stringify(v))

/**
 * Negative fixtures. Each mutates the good example into a specific dishonest
 * record and asserts the intended code fires. A rule with no fixture here is a
 * rule nobody has proven works.
 */
export async function selfTest() {
  const good = JSON.parse(await readFile(resolve(HERE, 'examples/japanese-2yr-pathway.planned.json'), 'utf8'))
  const template = JSON.parse(await readFile(resolve(HERE, 'examples/external-course.template.json'), 'utf8'))
  const verifiedArtifact = {
    kind: 'proficiency-score-report', description: 'score report', location: 'family file',
    obtained_on: '2028-06-01', verified_by_parent: true,
  }

  const cases = [
    ['template filled in only halfway', () => { const d = clone(template); d.status = 'enrolled'; return d }, 'R2_PLACEHOLDER_NOT_FILLED'],
    ['Manuel Academy named as author', () => { const d = clone(template); d.authorship.authored_by = 'manuel-academy'; return d }, 'SCHEMA_CONST'],
    ['authorship prose drifts to Manuel Academy', () => {
      const d = clone(good); d.records[0].authorship.statement = 'Manuel Academy authored this course.'; return d
    }, 'R1_AUTHORSHIP_CLAIMED'],
    ['enrolled with no provider', () => { const d = clone(good); d.records[0].status = 'enrolled'; return d }, 'R3_PROVIDER_REQUIRED'],
    ['credit awarded with no transcript', () => { const d = clone(good); d.records[0].credit.awarded = 0.5; return d }, 'R4_CREDIT_UNEVIDENCED'],
    ['proficiency claimed with no artifact', () => {
      const d = clone(good); d.records[0].proficiency.claimed_level = 'Novice High'; return d
    }, 'R5_PROFICIENCY_UNEVIDENCED'],
    ['elementary plan offered as evidence', () => {
      const d = clone(good)
      d.records[0].evidence.syllabus.push({
        kind: 'syllabus', description: 'house Japanese plan', location: 'Japanese-Year-1-Curriculum.md',
        obtained_on: null, verified_by_parent: false,
      })
      return d
    }, 'R6_ELEMENTARY_PLAN_NOT_HS_CREDIT'],
    ['graduation completeness asserted', () => {
      const d = clone(good); d.records[0].notes = ['This makes the programme graduation complete.']; return d
    }, 'R7_GRADUATION_CLAIM_FORBIDDEN'],
    ['completed with no end date', () => {
      const d = clone(good); d.records[0].status = 'completed'; return d
    }, 'R8_COMPLETED_WITHOUT_END_DATE'],
    ['more assignments done than set', () => {
      const d = clone(good); d.records[0].tracking.assignments_reported = 10; d.records[0].tracking.assignments_completed = 12; return d
    }, 'R9_TRACKING_IMPOSSIBLE'],
    ['evidence verified but undated', () => {
      const d = clone(good)
      d.records[0].evidence.syllabus.push({
        kind: 'syllabus', description: 'provider syllabus', location: 'family file',
        obtained_on: null, verified_by_parent: true,
      })
      return d
    }, 'R10_VERIFIED_WITHOUT_DATE'],
    ['authorship reversed into natural English', () => {
      const d = clone(good)
      d.records[0].authorship.statement = 'Japanese I. Designed, taught and assessed by Manuel Academy.'
      return d
    }, 'R1_AUTHORSHIP_CLAIMED'],
    ['lower-case placeholder left behind', () => {
      const d = clone(good); d.records[0].course.title = '<provider_course_title>'; return d
    }, 'R2_PLACEHOLDER_NOT_FILLED'],
    ['template with nothing left to fill', () => {
      const d = clone(good); d.records[0].status = 'template'; return d
    }, 'R2_TEMPLATE_WITHOUT_PLACEHOLDER'],
    ['a receipt standing in for a transcript', () => {
      const d = clone(good)
      const r = d.records[0]
      r.status = 'completed'
      r.credit.awarded = 0.5
      r.final_grade = { reported: 'B+', scale: 'A-F', source: 'provider-transcript' }
      r.parent_verification = { verified_by: 'Parent', verified_on: '2028-06-10', method: 'copy-of-document', statement: null }
      r.term.end_date = '2028-06-05'
      r.evidence.transcript.push({
        kind: 'receipt', description: 'payment receipt', location: 'family file',
        obtained_on: '2028-06-10', verified_by_parent: true,
      })
      return d
    }, 'R4_CREDIT_UNEVIDENCED'],
    ['elementary plan cited by paraphrase', () => {
      const d = clone(good)
      d.records[0].evidence.syllabus.push({
        kind: 'syllabus', description: 'Our own house Japanese Year 1 plan, grades 3-4',
        location: 'the family curriculum folder', obtained_on: null, verified_by_parent: false,
      })
      return d
    }, 'R6_ELEMENTARY_PLAN_NOT_HS_CREDIT'],
    ['graduation claim hidden behind the real verdict', () => {
      const d = clone(good)
      d.records[0].notes = ['Although the matrix still reads NOT_GRADUATION_COMPLETE, with this credit the programme is graduation complete.']
      return d
    }, 'R7_GRADUATION_CLAIM_FORBIDDEN'],
    ['term ends before it starts', () => {
      const d = clone(good); d.records[0].term.start_date = '2028-01-10'; d.records[0].term.end_date = '2027-06-01'; return d
    }, 'R8_TERM_DATES_INVERTED'],
    ['one semester awarding two credits', () => {
      const d = clone(good); d.records[0].credit.awarded = 2; return d
    }, 'R11_CREDIT_INFLATED'],
    ['Novice High on a lone record, no pathway', () => {
      const d = clone(good.records[0])
      d.proficiency = { claimed_level: 'Novice High', framework: 'ACTFL', artifact_ref: 'AAPPL 2028', assessed_on: '2028-06-01' }
      d.evidence.proficiency_artifact.push(verifiedArtifact)
      return d
    }, 'R12_PROFICIENCY_CLAIM_NEEDS_PATHWAY'],
    ['Novice High on a record inside an uncredited pathway', () => {
      const d = clone(good)
      d.records[0].proficiency = { claimed_level: 'Intermediate Low', framework: 'ACTFL', artifact_ref: 'OPI', assessed_on: '2028-06-01' }
      d.records[0].evidence.proficiency_artifact.push(verifiedArtifact)
      return d
    }, 'R12_PROFICIENCY_CLAIM_UNDERCREDITED'],
    ['enrolled with no syllabus', () => {
      const d = clone(good); d.records[0].status = 'enrolled'; return d
    }, 'R13_NO_SOURCE_EVIDENCE'],
    ['in progress with no progress source', () => {
      const d = clone(good); d.records[0].status = 'in-progress'; return d
    }, 'R14_NO_COMPLETION_SOURCE'],
    ['transcript proficiency claim with no artifact', () => {
      const d = clone(good); d.transcript.proficiency_claim = 'ACTFL Novice Mid'; return d
    }, 'P4_PATHWAY_PROFICIENCY_UNEVIDENCED'],
    ['pathway awarding more than its target', () => {
      const d = clone(good); d.records.forEach((r) => { r.credit.awarded = 0.6 }); return d
    }, 'P7_PATHWAY_CREDIT_INFLATED'],
    ['proficiency reasoned from contact hours in prose', () => {
      const d = clone(good)
      d.records[0].notes = ['400 contact hours completed, so the student is at Novice High.']
      return d
    }, 'R15_PROFICIENCY_IN_FREE_TEXT'],
    ['record prose claims the MMC is satisfied', () => {
      const d = clone(good)
      d.records[0].notes = ['This record satisfies the Michigan Merit Curriculum world language requirement.']
      return d
    }, 'R16_MMC_SATISFACTION_CLAIMED'],
    ['pathway prose claims the MMC is satisfied', () => {
      const d = clone(good)
      d.mmc_note = 'This pathway satisfies the Michigan Merit Curriculum world language requirement of two credits in full.'
      return d
    }, 'P9_MMC_SATISFACTION_CLAIMED'],
    ['pathway intent asserts a band', () => {
      const d = clone(good); d.intent = 'A sequence that leaves the student at Intermediate Low.'; return d
    }, 'P8_PROFICIENCY_IN_FREE_TEXT'],
    ['sequence numbers collide', () => {
      const d = clone(good); d.records[0].term.sequence_position = 4; return d
    }, 'P2_SEQUENCE_NOT_CONTIGUOUS'],
    ['a semester quietly dropped', () => {
      const d = clone(good); d.records.pop(); return d
    }, 'P2_SEMESTER_COUNT_MISMATCH'],
    ['records do not sum to the target', () => {
      const d = clone(good); d.records[0].credit.requested = 1; return d
    }, 'P3_CREDIT_SUM_MISMATCH'],
    ['target below the college floor', () => {
      const d = clone(good); d.target.credits = 1.5; return d
    }, 'P5_COLLEGE_FLOOR_NOT_MET'],
    ['pathway mixes two languages', () => {
      const d = clone(good); d.records[2].language = { name: 'Spanish', iso_639_1: 'es', iso_639_3: 'spa', notes: null }; return d
    }, 'P1_PATHWAY_LANGUAGE_MISMATCH'],
    ['Novice High on a half-credit pathway', () => {
      const d = clone(good)
      d.transcript.proficiency_claim = 'ACTFL Novice High'
      d.records[0].evidence.proficiency_artifact.push(verifiedArtifact)
      return d
    }, 'P4_NOVICE_HIGH_ON_UNDERCREDITED_PATHWAY'],
    ['a provider endorsed in code', () => {
      const d = clone(good); d.provider_selection.endorsed_provider = 'Some Paid Provider, Inc.'; return d
    }, 'SCHEMA_CONST'],
  ]

  const results = []
  for (const [name, build, expected] of cases) {
    const findings = await validateDocument(build())
    const caught = findings.some((f) => f.code === expected)
    results.push({ name, expected, caught, codes: findings.map((f) => f.code) })
  }
  return results
}

async function main(argv) {
  const args = argv.slice(2)
  const selfTestOnly = args.includes('--self-test')
  const files = args.filter((a) => !a.startsWith('--'))
  const findings = []
  let checked = 0

  const schemaFindings = [
    ...checkSchemaSubset((await loadSchemas()).course, 'course-schema'),
    ...checkSchemaSubset((await loadSchemas()).pathway, 'pathway-schema'),
  ]
  findings.push(...schemaFindings)

  if (!selfTestOnly) {
    const targets = files.length
      ? files
      : ['examples/japanese-2yr-pathway.planned.json', 'examples/external-course.template.json'].map((p) => resolve(HERE, p))
    for (const target of targets) {
      const result = await validateFile(target)
      checked += 1
      for (const f of result) findings.push({ ...f, file: target })
      const errs = result.filter((f) => f.level === 'error').length
      console.log(`${errs ? 'FAIL' : 'ok  '}  ${target}`)
      for (const f of result) console.log(`        ${f.level === 'error' ? 'E' : 'W'} ${f.code}: ${f.message}`)
    }
  }

  let selfTestFailures = 0
  if (!files.length || selfTestOnly) {
    console.log('\nself-test — every rule must reject its fixture')
    for (const r of await selfTest()) {
      if (!r.caught) selfTestFailures += 1
      console.log(`${r.caught ? 'ok  ' : 'FAIL'}  ${r.expected.padEnd(38)} ${r.name}`)
      if (!r.caught) console.log(`        got: ${r.codes.join(', ') || '(no findings)'}`)
    }
  }

  const errors = findings.filter((f) => f.level === 'error')
  const warnings = findings.filter((f) => f.level === 'warning')
  const status = errors.length === 0 && selfTestFailures === 0 ? READY : BLOCKED
  console.log(`\n${status}  documents=${checked} errors=${errors.length} warnings=${warnings.length} self-test-failures=${selfTestFailures}`)
  return status === READY ? 0 : 1
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv).then((code) => { process.exitCode = code })
}
