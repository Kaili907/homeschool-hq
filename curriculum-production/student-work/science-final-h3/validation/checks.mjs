/**
 * Safety and no-fabrication checks for the Science student-work packages.
 *
 * Each check re-derives its expectation from a pinned source blob or from the
 * rendered student sheet, not from the package's own assurance flags — a
 * package cannot pass by asserting that it passes. Checks are written against
 * the defect class, not against the current wording, so `mutation-test.mjs` can
 * reintroduce a defect and require the named check to fail.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ROOT, loadSharedBlocks, readPinnedSource, resolveSafetyBrief } from './packages.mjs'

const HS_FAILED_BASE_COMMIT = 'f58f7f1eec0a0f93801df4978c00511ec98cc95e'
/** H2 shipped student-visible defects H3 closed. A High School sheet built from it is stale. */
const HS_SUPERSEDED_H2_COMMIT = '265ea3a75740ccbeea0dfa02c723514779def052'

/** Requirement text that would put a learner in front of a real hazard at home. */
const UNSAFE_REQUIREMENT_PATTERNS = [
  { id: 'open-flame', pattern: /\b(open flame|bunsen|spirit burner|blowtorch|candle flame)\b/i },
  { id: 'mains-electricity', pattern: /\b(mains electricity|wall socket|wall outlet|power outlet)\b/i },
  { id: 'concentrated-reagent', pattern: /\bconcentrated (acid|base|alkali|hydrochloric|sulfuric|sulphuric|ammonia)\b/i },
  { id: 'fume-hood', pattern: /\bfume hood\b/i },
  { id: 'laser', pattern: /\blaser\b/i },
  { id: 'mercury', pattern: /\bmercury (thermometer|metal)\b/i },
  { id: 'radioactive', pattern: /\bradioactive (source|sample|material)\b/i },
  { id: 'dissection', pattern: /\bdissect(ion|ing|ed)?\b/i },
  { id: 'mixed-cleaners', pattern: /\bmix\b[^.]{0,40}\b(bleach|ammonia|drain cleaner)\b/i },
]

/** A negation anywhere in the same sentence means the text is excluding the risk. */
const NEGATION = /\b(no|not|never|without|avoid|avoids|avoided|excludes|excluded|instead of|rather than|only)\b/i

/** The sentence a match sits in — negation is scoped to it, not to the whole text. */
function sentenceAround(text, index) {
  const start = text.lastIndexOf('.', index - 1) + 1
  const rawEnd = text.indexOf('.', index)
  const end = rawEnd === -1 ? text.length : rawEnd + 1
  return text.slice(start, end)
}

/**
 * Every match of `pattern` in `text` whose own sentence does not negate it.
 *
 * Scanning only the first match is a real hole: a sheet that opens with "you
 * never have to send a photo" would mask a later demand for one.
 */
function unnegatedMatches(text, pattern) {
  const global = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`)
  const hits = []
  for (const match of text.matchAll(global)) {
    if (NEGATION.test(sentenceAround(text, match.index))) continue
    hits.push(match)
  }
  return hits
}

function requiresUnsafely(text) {
  const hits = []
  for (const { id, pattern } of UNSAFE_REQUIREMENT_PATTERNS) {
    if (unnegatedMatches(text, pattern).length > 0) hits.push(id)
  }
  return hits
}

/**
 * Wording that would turn a content key into a supplied observation. A key may
 * carry a published constant — the freezing point of water, the age of Earth —
 * because that is a property of the world. It may never carry a value
 * attributed to a learner, or a value a measurement is expected to produce.
 */
const FABRICATED_OBSERVATION_PATTERNS = [
  /\b(?:the )?learner (?:should|will|is expected to|ought to) (?:get|obtain|measure|observe|record|find|see)\b/i,
  /\byou (?:should|will) (?:get|obtain|measure|observe|record|find)\b/i,
  /\bexpected (?:value|result|reading|measurement|answer|observation)\b/i,
  /\bshould (?:come out|read|measure)\b/i,
  /\bthe (?:result|answer|reading) (?:will|should) be\b/i,
  /\b(?:we|i) (?:measured|observed|recorded|obtained)\b/i,
  /\bin (?:our|my|the) (?:trial|experiment|run|test)\b/i,
  /\btypical(?:ly)? (?:reads|measures|comes out)\b/i,
  /\b(?:the )?(?:correct|model) answer is\b/i,
]

/** Every string a topic key carries, flattened for scanning. */
function keyStrings(topic) {
  return [
    ...(topic.fixed_facts ?? []),
    ...(topic.relationships ?? []),
    ...(topic.accepted_alternative_framings ?? []),
    ...(topic.disqualifying_errors ?? []),
    topic.out_of_scope ?? '',
  ].filter((entry) => typeof entry === 'string' && entry.length > 0)
}

function sameList(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false
  return left.length === right.length && left.every((entry, index) => entry === right[index])
}

function fail(problems, pkg, detail) {
  problems.push(`${pkg.lesson_id}: ${detail}`)
}

/**
 * Every check receives { packages, sheets, scoring, floor, blocks, sources }
 * and returns a list of problem strings. Empty means the check passed.
 */
export const CHECKS = [
  {
    id: 'no-prefilled-observations',
    description:
      'No recording cell, provenance cell, or write-here box in any student sheet arrives with content in it.',
    run({ packages, sheets }) {
      const problems = []
      for (const pkg of packages) {
        const sheet = sheets.get(pkg.lesson_id)
        for (const line of sheet.split('\n')) {
          if (!line.startsWith('|')) continue
          const cells = line.slice(1, -1).split('|')
          // Header and separator rows are the only table rows allowed content.
          const isSeparator = cells.every((cell) => /^\s*-{3,}\s*$/.test(cell))
          if (isSeparator) continue
          const filled = cells.filter((cell) => cell.trim().length > 0)
          if (filled.length === 0) continue
          // A header row restates the column names; a data row must be blank.
          const isHeader = filled.length === cells.length
          if (!isHeader) fail(problems, pkg, `partially pre-filled table row: ${line.trim()}`)
        }
        const answered = sheet
          .split('\n')
          .filter((line) => line.startsWith('>') && line.slice(1).trim().length > 0)
        if (answered.length > 0) {
          fail(problems, pkg, `write-here box arrived with content: ${answered[0].slice(0, 80)}`)
        }
      }
      return problems
    },
  },
  {
    id: 'no-supplied-dataset-embedded',
    description:
      'The supplied-data path names where to retrieve published data and never embeds a dataset of its own.',
    run({ packages }) {
      const problems = []
      for (const pkg of packages) {
        const supplied = pkg.supplied_data_alternative
        const provenance = supplied.source_declared_provenance ?? ''
        // Three or more bare numbers in one statement is a table, not a pointer.
        const numbers = provenance.match(/(?<![\w-])\d+(?:\.\d+)?(?![\w%-])/g) ?? []
        if (numbers.length >= 3) {
          fail(problems, pkg, `supplied-data provenance embeds a dataset: ${provenance.slice(0, 90)}`)
        }
        if (supplied.published_data_named_by_source && !supplied.course_data_source_reference) {
          fail(problems, pkg, 'names published data but points at no data-source resource')
        }
      }
      return problems
    },
  },
  {
    id: 'student-visible-safety-parity',
    description:
      'Every hazard, mitigation, stop condition, and safety clause in the pinned source lesson also appears in the rendered student sheet.',
    run({ packages, sheets, sources }) {
      const problems = []
      for (const pkg of packages) {
        const source = sources.get(pkg.lesson_id)
        const sheet = sheets.get(pkg.lesson_id)
        const safety = source.safety_privacy
        if (safety) {
          for (const hazard of safety.hazards ?? []) {
            if (!sheet.includes(hazard.description)) {
              fail(problems, pkg, `hazard missing from student sheet: ${hazard.description.slice(0, 60)}`)
            }
            if (!sheet.includes(hazard.mitigation)) {
              fail(problems, pkg, `mitigation missing from student sheet: ${hazard.mitigation.slice(0, 60)}`)
            }
          }
          for (const condition of safety.stop_conditions ?? []) {
            if (!sheet.includes(condition)) {
              fail(problems, pkg, `stop condition missing from student sheet: ${condition.slice(0, 60)}`)
            }
          }
        }
        for (const clause of source.safety_and_privacy ?? []) {
          if (!sheet.includes(clause)) {
            fail(problems, pkg, `safety clause missing from student sheet: ${clause.slice(0, 60)}`)
          }
        }
      }
      return problems
    },
  },
  {
    id: 'hs-safety-from-h3-only',
    description:
      'Every High School safety brief carries the H3 safety-review text, and no lesson falls back to the superseded H2 fix or the failed base candidate.',
    run({ packages, sheets, sources }) {
      const problems = []
      const hsPackages = packages.filter((pkg) => pkg.course_id.startsWith('ma-hs'))
      if (hsPackages.length === 0) return ['no High School packages found at all']

      let carried = 0
      for (const pkg of hsPackages) {
        if (pkg.source.commit === HS_FAILED_BASE_COMMIT) {
          fail(problems, pkg, 'built from the failed base High School candidate')
        }
        if (pkg.source.commit === HS_SUPERSEDED_H2_COMMIT) {
          fail(problems, pkg, 'built from the superseded H2 safety fix, not H3')
        }
        const source = sources.get(pkg.lesson_id)
        const segment = (source.lesson_flow ?? []).find(
          (entry) => entry.segment_id === 'safety-review',
        )
        if (!segment) continue
        carried += 1
        const brief = pkg.safety_brief.h3_safety_segment_verbatim ?? ''
        if (brief !== segment.teacher_or_tutor_action) {
          fail(problems, pkg, 'H3 safety-review segment is not carried verbatim')
        }
        // The safe order and stop conditions H3 authored must reach the sheet.
        for (const step of pkg.safety_brief.safe_order ?? []) {
          if (!sheets.get(pkg.lesson_id).includes(step)) {
            fail(problems, pkg, `safe-order step missing from student sheet: ${step.slice(0, 50)}`)
          }
        }
      }
      if (carried === 0) {
        problems.push('no High School lesson carried an H3 safety-review segment')
      }
      return problems
    },
  },
  {
    id: 'hs-base-candidate-defects-absent',
    description:
      'None of the defects the H2 or H3 fixes removed — flame demonstration, water on a fire, uncapped hot water, sealing a reacting mixture — reappears in any student sheet.',
    run({ packages, sheets }) {
      const problems = []
      const defects = [
        { id: 'flame-test', pattern: /\bflame test\b/i },
        { id: 'alcohol-flame', pattern: /\balcohol[^.]{0,40}\bflame\b/i },
        { id: 'water-on-fire', pattern: /\bwater within reach\b/i },
        { id: 'hand-tested-water', pattern: /\btest the water(?: temperature)? with your hand\b/i },
        { id: 'seal-reacting-mixture', pattern: /\bseal(?:ed)? (?:it |the )?(?:reacting|fermenting|oxidising) [^.]{0,30}\bbag\b/i },
      ]
      for (const pkg of packages) {
        const sheet = sheets.get(pkg.lesson_id)
        for (const defect of defects) {
          for (const match of unnegatedMatches(sheet, defect.pattern)) {
            fail(problems, pkg, `base-candidate defect '${defect.id}' present: ${match[0]}`)
          }
        }
      }
      return problems
    },
  },
  {
    id: 'fire-response-never-water',
    description:
      'The fire stop condition never instructs anyone to use water, in either the adult or the grades 3-5 wording.',
    run({ packages, sheets }) {
      const problems = []
      for (const pkg of packages) {
        let seen = false
        for (const line of sheets.get(pkg.lesson_id).split('\n')) {
          if (!/^-?\s*(a )?fire:/i.test(line.trim())) continue
          seen = true
          if (!/(do not use water|never throw water)/i.test(line)) {
            fail(problems, pkg, `fire response does not forbid water: ${line.trim().slice(0, 80)}`)
          }
        }
        if (!seen) fail(problems, pkg, 'student sheet carries no fire stop condition')
      }
      return problems
    },
  },
  {
    id: 'no-unsafe-home-experimentation',
    description:
      'Nothing a learner is asked to gather, do, or extend requires an open flame, mains electricity, a concentrated reagent, a fume hood, a laser, a radioactive source, or dissection.',
    run({ packages }) {
      const problems = []
      for (const pkg of packages) {
        const required = [
          ...pkg.materials,
          ...(pkg.safety_brief.safe_order ?? []),
          pkg.data_sheet.lesson_task_verbatim,
          ...pkg.extension.options,
        ]
        for (const text of required) {
          for (const hit of requiresUnsafely(text ?? '')) {
            fail(problems, pkg, `required work involves '${hit}': ${String(text).slice(0, 80)}`)
          }
        }
      }
      return problems
    },
  },
  {
    id: 'equal-credit-alternative-is-safe',
    description:
      'Every lesson has a non-empty equal-credit alternative, and no alternative itself requires a hazardous step.',
    run({ packages, blocks }) {
      const problems = []
      for (const pkg of packages) {
        const alternative = pkg.equal_credit_safe_alternative
        if (!alternative.text || alternative.text.trim().length === 0) {
          fail(problems, pkg, 'no equal-credit alternative')
          continue
        }
        for (const hit of requiresUnsafely(alternative.text)) {
          fail(problems, pkg, `equal-credit alternative involves '${hit}'`)
        }
        const guarantees = blocks.lists[alternative.guarantees_ref] ?? []
        if (guarantees.length === 0) fail(problems, pkg, 'alternative states no guarantees')
        if (!blocks.text[alternative.equal_credit_rule_ref]) {
          fail(problems, pkg, 'alternative states no equal-credit rule')
        }
      }
      return problems
    },
  },
  {
    id: 'hands-on-lessons-carry-a-real-alternative',
    description:
      'Any lesson that has the learner handle materials offers an actual alternative activity, not a note that this lesson needs no equipment.',
    run({ packages }) {
      const problems = []
      for (const pkg of packages) {
        if (!pkg.data_bearing) continue
        const alternative = pkg.equal_credit_safe_alternative
        if (alternative.is_no_equipment_note) {
          fail(
            problems,
            pkg,
            'hands-on lesson offers only a no-equipment note in place of an alternative path',
          )
        }
        // Where the source names one generic path for the whole course, the
        // package has to supply a concrete task or the alternative is a policy
        // sentence the family cannot act on.
        if (!pkg.course_id.startsWith('ma-hs') && !alternative.derived_task) {
          fail(problems, pkg, 'hands-on lesson has no concrete alternative task, only the source policy sentence')
        }
      }
      return problems
    },
  },
  {
    id: 'alternative-promise-matches-package',
    description:
      'An alternative that promises supplied or provided material is accompanied by the clarification that this package prints none of it.',
    run({ packages, sheets, blocks }) {
      const problems = []
      for (const pkg of packages) {
        const alternative = pkg.equal_credit_safe_alternative
        if (!/\b(supplied|provided)\b/i.test(alternative.text)) continue
        const clarification = blocks.text[alternative.clarification_ref]
        if (!clarification) {
          fail(problems, pkg, 'alternative promises supplied material with no clarification')
          continue
        }
        if (!sheets.get(pkg.lesson_id).includes(clarification)) {
          fail(problems, pkg, 'clarification is not rendered on the student sheet')
        }
      }
      return problems
    },
  },
  {
    id: 'prohibitions-on-every-sheet',
    description:
      'Every non-disableable prohibition the pinned policy set declares — eleven at H3, up from ten at H2 — appears on every student sheet, in the wording for that grade band.',
    run({ packages, sheets, floor }) {
      const problems = []
      if (floor.non_disableable_prohibitions.length === 0) {
        return ['the safety floor declares no prohibitions']
      }
      for (const pkg of packages) {
        const sheet = sheets.get(pkg.lesson_id)
        for (const item of floor.non_disableable_prohibitions) {
          const expected =
            pkg.band === 'elementary' ? item.elementary_text || item.text : item.text
          if (!sheet.includes(expected)) {
            fail(problems, pkg, `prohibition missing: ${expected.slice(0, 50)}`)
          }
        }
      }
      return problems
    },
  },
  {
    id: 'brief-states-supervision-ppe-disposal',
    description:
      'Every student sheet states who must be present, what protective equipment is needed, and how to clear up.',
    run({ packages, sheets, floor, blocks }) {
      const problems = []
      for (const pkg of packages) {
        const sheet = sheets.get(pkg.lesson_id)
        const brief = resolveSafetyBrief(pkg.safety_brief, floor, blocks, pkg.band)
        if (!sheet.includes(brief.supervision_plain_words)) {
          fail(problems, pkg, 'supervision level not stated in plain words')
        }
        if (!brief.required_ppe || !sheet.includes(brief.required_ppe)) {
          fail(problems, pkg, 'protective-equipment position missing')
        }
        if (!brief.disposal || !sheet.includes(brief.disposal)) {
          fail(problems, pkg, 'disposal step missing')
        }
        if (!sheet.includes(brief.pause_rule)) fail(problems, pkg, 'pause rule missing')
      }
      return problems
    },
  },
  {
    id: 'chemical-hazard-needs-direct-adult',
    description:
      'Any lesson declaring a chemical hazard declares direct-adult supervision, as the H3 framework requires.',
    run({ packages }) {
      const problems = []
      for (const pkg of packages) {
        const hazards = pkg.safety_brief.hazards ?? []
        if (!hazards.some((hazard) => hazard.kind === 'chemical')) continue
        if (pkg.safety_brief.supervision_level !== 'direct-adult') {
          fail(
            problems,
            pkg,
            `chemical hazard with supervision '${pkg.safety_brief.supervision_level}'`,
          )
        }
      }
      return problems
    },
  },
  {
    id: 'no-camera-or-body-data-required',
    description:
      'No sheet requires a photograph, video, voice recording, or any body or health measurement as evidence.',
    run({ packages, sheets }) {
      const problems = []
      const demands = [
        /\b(take|record|upload|submit|send)\b[^.]{0,40}\b(photo|photograph|video|voice recording)\b/i,
        /\b(measure|record)\b[^.]{0,30}\byour (weight|height|pulse|heart rate|blood)\b/i,
      ]
      for (const pkg of packages) {
        const sheet = sheets.get(pkg.lesson_id)
        for (const demand of demands) {
          for (const match of unnegatedMatches(sheet, demand)) {
            fail(problems, pkg, `demands private media or body data: ${match[0].slice(0, 60)}`)
          }
        }
      }
      return problems
    },
  },
  {
    id: 'safety-floor-traceable-to-source',
    description:
      'Every clause in the safety floor appears verbatim in the committed source it is attributed to.',
    run({ floor }) {
      const problems = []
      const hsCommit = floor.attribution['hs-h3'].commit
      const g34Commit = floor.attribution.g34.commit
      const policySet = JSON.parse(
        readPinnedSource(
          hsCommit,
          'curriculum-authoring/full-family-highschool-9-12/subjects/science/authoring-set/policy-set.json',
        ),
      )
      const declared = new Set([
        ...policySet.safety_privacy.non_disableable_prohibitions,
        ...policySet.safety_privacy.required_privacy_declarations,
      ])
      for (const item of [
        ...floor.non_disableable_prohibitions,
        ...floor.required_privacy_declarations,
      ]) {
        if (!declared.has(item.text)) {
          problems.push(`floor clause not in the H3 policy set: ${item.text.slice(0, 60)}`)
        }
      }

      const g34 = readPinnedSource(
        g34Commit,
        'curriculum-content/manuel-academy/1.0.0/grades/grade-3/courses/science/lessons.jsonl',
      )
      for (const item of [
        ...floor.elementary_investigation_clauses,
        ...floor.equal_credit_alternative_clauses,
        ...floor.guardian_acknowledgement_clauses,
      ]) {
        if (!g34.includes(JSON.stringify(item.text).slice(1, -1))) {
          problems.push(`floor clause not in the Grade 3/4 source: ${item.text.slice(0, 60)}`)
        }
      }

      const hsLessons = readPinnedSource(
        hsCommit,
        'curriculum-authoring/full-family-highschool-9-12/subjects/science/authoring-set/lessons/ma-hs9-biology.lessons.jsonl',
      )
      for (const item of floor.global_stop_conditions) {
        if (!hsLessons.includes(JSON.stringify(item.text).slice(1, -1))) {
          problems.push(`stop condition not in the H3 lessons: ${item.text.slice(0, 60)}`)
        }
      }
      return problems
    },
  },
  {
    id: 'canonical-grades-carry-imported-floor',
    description:
      'Grades 5, 7, and 8 — whose canonical source carries no investigation alternative or guardian acknowledgement — render the imported Grade 3/4 clauses.',
    run({ packages, sheets, floor }) {
      const problems = []
      const imported = floor.elementary_investigation_clauses.map((item) => item.text)
      if (imported.length === 0) return ['no elementary clauses were imported at all']
      for (const pkg of packages) {
        if (!['ma-g5-science', 'ma-g7-science', 'ma-g8-science'].includes(pkg.course_id)) continue
        const sheet = sheets.get(pkg.lesson_id)
        for (const clause of imported) {
          if (!sheet.includes(clause)) {
            fail(problems, pkg, `imported floor clause missing: ${clause.slice(0, 50)}`)
          }
        }
        if (!pkg.safety_brief.guardian_acknowledgement) {
          fail(problems, pkg, 'no guardian acknowledgement')
        }
      }
      return problems
    },
  },
  {
    id: 'scoring-authority-forbids-unearned-numbers',
    description:
      'Every scoring sheet forbids awarding credit for a value the learner did not measure, calculate, or cite, and supplies no model answer.',
    run({ packages, scoring, blocks }) {
      const problems = []
      const nonNegotiables = blocks.lists['scoring-non-negotiables']
      const rule = nonNegotiables.find((item) => /did not measure/i.test(item))
      if (!rule) return ['the scoring policy no longer forbids crediting unearned numbers']
      for (const pkg of packages) {
        const sheet = scoring.get(pkg.lesson_id)
        if (!sheet.includes(rule)) fail(problems, pkg, 'scoring sheet omits the unearned-number rule')
        if (!sheet.includes(blocks.text[pkg.expected_reasoning.no_fixed_answer_key_ref])) {
          fail(problems, pkg, 'scoring sheet omits the no-answer-key statement')
        }
        if (/^\s*(model answer|expected value|correct answer)\s*:/im.test(sheet)) {
          fail(problems, pkg, 'scoring sheet supplies a model answer')
        }
      }
      return problems
    },
  },
  {
    id: 'elementary-safety-is-banded-and-stricter',
    description:
      'Grades 3-5 read a restatement of every prohibition and stop condition, never the adult wording, never a conditional fire-fighting instruction — and the adult wording still reaches the guardian.',
    run({ packages, sheets, scoring, floor }) {
      const problems = []
      const banded = [...floor.non_disableable_prohibitions, ...floor.global_stop_conditions]
      const elementary = packages.filter((pkg) => pkg.band === 'elementary')
      if (elementary.length === 0) return ['no elementary packages found at all']

      for (const item of banded) {
        if (!item.elementary_text) {
          problems.push(`floor clause has no grades 3-5 variant: ${item.text.slice(0, 60)}`)
        }
      }

      for (const pkg of elementary) {
        const sheet = sheets.get(pkg.lesson_id)
        for (const item of banded) {
          if (!item.elementary_text) continue
          if (!sheet.includes(item.elementary_text)) {
            fail(problems, pkg, `grades 3-5 wording missing: ${item.elementary_text.slice(0, 50)}`)
          }
          if (sheet.includes(item.text)) {
            fail(problems, pkg, `adult wording reached an elementary sheet: ${item.text.slice(0, 50)}`)
          }
        }
        // A child is never asked to judge whether fighting a fire is safe.
        if (/smother|fire blanket|pan lid|only if that is safe/i.test(sheet)) {
          fail(problems, pkg, 'elementary sheet carries a conditional fire-fighting instruction')
        }
        const adultCopy = scoring.get(pkg.lesson_id)
        for (const item of floor.non_disableable_prohibitions) {
          if (!adultCopy.includes(item.text)) {
            fail(problems, pkg, `adult prohibition wording missing from the scoring sheet: ${item.text.slice(0, 40)}`)
          }
        }
      }
      return problems
    },
  },
  {
    id: 'unspecified-procedure-needs-direct-supervision',
    description:
      'A hands-on lesson whose procedure and hazards are family-chosen rather than prescribed requires an adult present and watching, not merely within earshot.',
    run({ packages }) {
      const problems = []
      for (const pkg of packages) {
        if (!pkg.data_bearing) continue
        // Only lessons the package itself declares unprescribed. Where the
        // curriculum authored the procedure and the hazards, its own
        // supervision determination stands.
        if (pkg.safety_brief.safe_order_note_ref !== 'k8-safe-order-note') continue
        if (pkg.safety_brief.supervision_level !== 'direct-adult') {
          fail(
            problems,
            pkg,
            `unprescribed hands-on work with supervision '${pkg.safety_brief.supervision_level}'`,
          )
        }
      }
      return problems
    },
  },
  {
    id: 'tree-matches-checksums',
    description:
      'Every file recorded in SHA256SUMS.txt is present and unchanged, so the gate can never report PASS over a half-written tree.',
    run() {
      const problems = []
      const sums = readFileSync(join(ROOT, 'SHA256SUMS.txt'), 'utf8')
        .split('\n')
        .filter((line) => line.trim().length > 0)
      if (sums.length === 0) return ['SHA256SUMS.txt is empty']
      for (const line of sums) {
        const [digest, relative] = line.split('  ')
        const path = join(ROOT, relative)
        if (!existsSync(path)) {
          problems.push(`missing since build: ${relative}`)
          continue
        }
        const actual = createHash('sha256').update(readFileSync(path)).digest('hex')
        if (actual !== digest) problems.push(`changed since build: ${relative}`)
      }
      return problems
    },
  },
  {
    id: 'every-lesson-covered',
    description:
      'Every lesson in every pinned source course has exactly one package, one student sheet, and one scoring sheet.',
    run({ packages, sheets, scoring, sources, manifest }) {
      const problems = []
      const expected = manifest.courses.reduce((total, course) => total + course.lessons, 0)
      if (packages.length !== expected) {
        problems.push(`manifest claims ${expected} lessons; ${packages.length} packages exist`)
      }
      for (const pkg of packages) {
        if (!sources.has(pkg.lesson_id)) {
          fail(problems, pkg, 'no matching lesson in the pinned source')
        }
        if (!sheets.has(pkg.lesson_id)) fail(problems, pkg, 'no student sheet')
        if (!scoring.has(pkg.lesson_id)) fail(problems, pkg, 'no scoring sheet')
      }
      const ids = new Set(packages.map((pkg) => pkg.lesson_id))
      if (ids.size !== packages.length) problems.push('duplicate lesson ids among packages')
      for (const [lessonId] of sources) {
        if (!ids.has(lessonId)) problems.push(`source lesson has no package: ${lessonId}`)
      }
      return problems
    },
  },
  {
    id: 'objective-questions-distinct-and-mapped',
    description:
      'Every stated objective is matched to a question type by exact template, and no lesson asks the same question twice.',
    run({ packages }) {
      const problems = []
      for (const pkg of packages) {
        const unmapped = pkg.assurances.unmapped_objective_templates ?? []
        for (const stem of unmapped) {
          fail(problems, pkg, `objective fell through to the keyword fallback: ${stem.slice(0, 70)}`)
        }
        const prompts = pkg.analysis_questions.map((question) => question.prompt)
        if (new Set(prompts).size !== prompts.length) {
          fail(problems, pkg, 'two analysis questions share the same prompt')
        }
        const objectiveKinds = pkg.analysis_questions
          .slice(0, pkg.learning_objectives.length)
          .map((question) => question.kind)
        if (new Set(objectiveKinds).size !== objectiveKinds.length) {
          fail(problems, pkg, 'two stated objectives collapsed into one question type')
        }
      }
      return problems
    },
  },
  {
    id: 'analysis-questions-cover-every-objective',
    description:
      'Every stated learning objective is served by at least one analysis question, and every question maps to a stated objective.',
    run({ packages }) {
      const problems = []
      for (const pkg of packages) {
        const objectives = pkg.learning_objectives.length
        const covered = new Set(pkg.analysis_questions.map((question) => question.objective_index))
        for (const question of pkg.analysis_questions) {
          if (question.objective_index < 0 || question.objective_index >= objectives) {
            fail(problems, pkg, `question ${question.id} maps outside the objective list`)
          }
        }
        for (let index = 0; index < objectives; index += 1) {
          if (!covered.has(index)) fail(problems, pkg, `objective ${index + 1} has no question`)
        }
      }
      return problems
    },
  },
  {
    id: 'correctness-authority-on-every-lesson',
    description:
      'Every lesson carries a scientific correctness authority whose content matches the hand-authored key for its topic, verbatim, and every authored key is used by a lesson.',
    run({ packages, correctness }) {
      const problems = []
      const used = new Set()
      for (const pkg of packages) {
        const authority = pkg.scientific_correctness_authority
        if (!authority) {
          fail(problems, pkg, 'no scientific correctness authority')
          continue
        }
        const topic = correctness.get(authority.topic_key)
        if (!topic) {
          fail(problems, pkg, `topic key is not authored anywhere: ${authority.topic_key}`)
          continue
        }
        used.add(authority.topic_key)
        if (topic.__courseId !== pkg.course_id) {
          fail(problems, pkg, `topic key belongs to ${topic.__courseId}`)
        }
        if (topic.__sourceCommit !== pkg.source.commit) {
          fail(problems, pkg, 'authored key was written against a different source commit')
        }
        for (const field of [
          'fixed_facts',
          'relationships',
          'accepted_alternative_framings',
          'disqualifying_errors',
        ]) {
          if (!sameList(authority[field], topic[field])) {
            fail(problems, pkg, `${field} does not match the authored key`)
          }
        }
        if (authority.out_of_scope !== topic.out_of_scope) {
          fail(problems, pkg, 'grade boundary does not match the authored key')
        }
        if ((authority.relationships ?? []).length < 2) {
          fail(problems, pkg, 'fewer than two accepted relationships authored')
        }
        if ((authority.disqualifying_errors ?? []).length < 2) {
          fail(problems, pkg, 'fewer than two disqualifying errors authored')
        }
        if (!authority.out_of_scope) fail(problems, pkg, 'no grade boundary authored')
      }
      for (const key of correctness.keys()) {
        if (!used.has(key)) problems.push(`authored key matches no lesson: ${key}`)
      }
      return problems
    },
  },
  {
    id: 'correctness-key-states-no-observation',
    description:
      'No authored correctness key, and nothing rendered from one, states a measurement a learner is expected to obtain or a result attributed to a learner.',
    run({ packages, scoring, correctness, blocks }) {
      const problems = []
      for (const [key, topic] of correctness) {
        for (const text of keyStrings(topic)) {
          for (const pattern of FABRICATED_OBSERVATION_PATTERNS) {
            if (pattern.test(text)) {
              problems.push(`${key}: key attributes a result to a learner — ${text.slice(0, 70)}`)
            }
          }
        }
      }
      for (const pkg of packages) {
        const sheet = scoring.get(pkg.lesson_id) ?? ''
        const start = sheet.indexOf('## Scientific correctness authority')
        if (start === -1) {
          fail(problems, pkg, 'scoring sheet renders no correctness authority section')
          continue
        }
        const rest = sheet.slice(start)
        const end = rest.indexOf('\n## ', 1)
        let section = end === -1 ? rest : rest.slice(0, end)
        // Two things in the rendered section are not authored here and must
        // come out before scanning. The shared framing blocks state the rule
        // being enforced — "nothing states what a measurement should come out
        // at" — and scanning them flags the prohibition as the violation. The
        // source's own provenance line is carried verbatim by requirement, and
        // some of those lines disclaim an expected value in as many words.
        // Both are covered by their own checks: `no-supplied-dataset-embedded`
        // scans the provenance for embedded data, and
        // `supplied-data-authority-pins-provenance` holds it to the source.
        // What is left is what this package authored.
        for (const id of [
          'correctness-authority-headline',
          'investigation-correctness-rule',
          'supplied-data-answer-authority',
        ]) {
          const text = blocks.text[id]
          if (text) section = section.split(text).join(' ')
        }
        const provenance = pkg.supplied_data_alternative?.source_declared_provenance
        if (provenance) section = section.split(provenance).join(' ')
        for (const pattern of FABRICATED_OBSERVATION_PATTERNS) {
          if (pattern.test(section)) {
            fail(problems, pkg, 'rendered correctness section states an expected measurement')
          }
        }
      }
      return problems
    },
  },
  {
    id: 'correctness-authority-is-adult-facing',
    description:
      'Every authored relationship and disqualifying error is printed on the adult scoring sheet, and no disqualifying error reaches the learner sheet.',
    run({ packages, sheets, scoring }) {
      const problems = []
      for (const pkg of packages) {
        const authority = pkg.scientific_correctness_authority
        if (!authority) continue
        const adult = scoring.get(pkg.lesson_id) ?? ''
        const learner = sheets.get(pkg.lesson_id) ?? ''
        if (!authority.adult_facing_only) {
          fail(problems, pkg, 'authority is not marked adult-facing')
        }
        for (const statement of [...authority.relationships, ...authority.fixed_facts]) {
          if (!adult.includes(statement)) {
            fail(problems, pkg, `scoring sheet omits an authored statement: ${statement.slice(0, 60)}`)
          }
        }
        for (const error of authority.disqualifying_errors) {
          if (!adult.includes(error)) {
            fail(problems, pkg, `scoring sheet omits a disqualifying error: ${error.slice(0, 60)}`)
          }
          if (learner.includes(error)) {
            fail(problems, pkg, `disqualifying error reached the learner sheet: ${error.slice(0, 60)}`)
          }
        }
        for (const statement of authority.relationships) {
          if (learner.includes(statement)) {
            fail(problems, pkg, `content key statement reached the learner sheet: ${statement.slice(0, 60)}`)
          }
        }
      }
      return problems
    },
  },
  {
    id: 'investigation-days-bound-conclusions-not-observations',
    description:
      'Every investigation day states that the content key bounds the conclusion and that a recorded observation is never scored against it; no desk day claims to be one.',
    run({ packages, scoring, blocks }) {
      const problems = []
      const rule = blocks.text['investigation-correctness-rule']
      if (!rule || !/do not score any recorded measurement against it/i.test(rule)) {
        problems.push('the investigation rule no longer forbids scoring observations against the key')
      }
      for (const pkg of packages) {
        const authority = pkg.scientific_correctness_authority
        if (!authority) continue
        const forms = authority.authority_forms ?? []
        const adult = scoring.get(pkg.lesson_id) ?? ''
        if (pkg.data_bearing) {
          if (!forms.includes('INVESTIGATION_CRITERIA')) {
            fail(problems, pkg, 'investigation day carries no investigation criteria')
          }
          if (rule && !adult.includes(rule)) {
            fail(problems, pkg, 'investigation scoring sheet omits the observations-are-not-scored rule')
          }
        } else if (forms.includes('INVESTIGATION_CRITERIA')) {
          fail(problems, pkg, 'desk day claims investigation criteria')
        }
      }
      return problems
    },
  },
  {
    id: 'supplied-data-authority-pins-provenance',
    description:
      'Every lesson whose source names published data carries a supplied-data answer authority that pins the named resource and the source provenance verbatim, and no other lesson claims one.',
    run({ packages, scoring, sources }) {
      const problems = []
      for (const pkg of packages) {
        const authority = pkg.scientific_correctness_authority
        if (!authority) continue
        const supplied = authority.supplied_data_answer_authority
        const declared = pkg.supplied_data_alternative?.published_data_named_by_source === true
        if (!declared) {
          if (supplied) fail(problems, pkg, 'claims supplied-data authority with no published data named')
          continue
        }
        if (!supplied) {
          fail(problems, pkg, 'source names published data but no supplied-data authority is carried')
          continue
        }
        if (!supplied.data_source_resource) {
          fail(problems, pkg, 'supplied-data authority pins no data-source resource')
        } else {
          const record = sources.get(pkg.lesson_id)
          const known = new Set([
            `res-${pkg.course_id}-data-sources`,
            ...(record?.resource_refs ?? []),
          ])
          if (!known.has(supplied.data_source_resource)) {
            fail(problems, pkg, `pinned resource is not one the source names: ${supplied.data_source_resource}`)
          }
          if (!(scoring.get(pkg.lesson_id) ?? '').includes(supplied.data_source_resource)) {
            fail(problems, pkg, 'scoring sheet does not print the pinned data-source resource')
          }
        }
        const provenance = pkg.supplied_data_alternative.source_declared_provenance
        if (supplied.source_declared_provenance !== provenance) {
          fail(problems, pkg, 'supplied-data provenance is not carried verbatim from the source')
        }
        if (provenance && !(scoring.get(pkg.lesson_id) ?? '').includes(provenance)) {
          fail(problems, pkg, 'scoring sheet does not print the declared provenance')
        }
      }
      return problems
    },
  },
  {
    id: 'rubric-correctness-criterion-bound-to-key',
    description:
      'The Scientific correctness rubric row is judged against the topic content key, and no sheet still tells a reader that the package ships no key.',
    run({ packages, sheets, scoring, blocks }) {
      const problems = []
      const criterion = (blocks.rubric_criteria ?? []).find(
        (entry) => entry.criterion === 'Scientific correctness',
      )
      if (!criterion) {
        problems.push('the rubric no longer carries a Scientific correctness criterion')
        return problems
      }
      if (!/topic content key/i.test(criterion.not_yet)) {
        problems.push('the Scientific correctness Not yet level does not reference the topic content key')
      }
      if (!/disqualifying error/i.test(criterion.not_yet)) {
        problems.push('the Scientific correctness Not yet level does not reference the disqualifying errors')
      }
      const threshold = blocks.text['rubric-threshold'] ?? ''
      if (/ships none/i.test(threshold) || /this package ships no/i.test(threshold)) {
        problems.push('the rubric threshold still tells the reader that no content key ships')
      }
      if (!/topic content key/i.test(threshold)) {
        problems.push('the rubric threshold does not point the reader at the topic content key')
      }
      for (const pkg of packages) {
        for (const [label, text] of [
          ['student sheet', sheets.get(pkg.lesson_id) ?? ''],
          ['scoring sheet', scoring.get(pkg.lesson_id) ?? ''],
        ]) {
          if (/not against a fixed answer key, because this package ships none/i.test(text)) {
            fail(problems, pkg, `${label} still claims no content key ships`)
          }
        }
      }
      return problems
    },
  },
  {
    id: 'correctness-keys-repinned-on-identical-topic-basis',
    description:
      'A correctness key repinned onto a newer source commit rather than re-authored is only accepted where every field the key is keyed on and authored against is byte-identical across the two commits.',
    run({ packages, correctness }) {
      const problems = []
      // Fields a topic key is keyed on, or was authored against. A change in any
      // of them means the key has to be re-read by a human, not repinned.
      const BASIS_FIELDS = [
        'unit_ref',
        'focus',
        'phase',
        'title',
        'essential_question',
        'learning_objectives',
        'success_criteria',
      ]
      const repinned = new Map()
      for (const pkg of packages) {
        const authored = pkg.scientific_correctness_authority?.authored ?? {}
        if (!authored.repinned_from) continue
        repinned.set(pkg.course_id, {
          from: authored.repinned_from,
          to: authored.source_commit,
          path: pkg.source.path,
          basis: authored.repin_basis ?? '',
        })
        if (authored.source_commit !== pkg.source.commit) {
          fail(
            problems,
            pkg,
            `repinned key sits on ${authored.source_commit.slice(0, 7)} but the package was built from ${pkg.source.commit.slice(0, 7)}`,
          )
        }
        if (authored.repinned_from === authored.source_commit) {
          fail(problems, pkg, 'key records a repin from the commit it already sat on')
        }
        if (!authored.repin_basis) {
          fail(problems, pkg, 'key was repinned with no recorded basis')
        }
      }
      if (repinned.size === 0) return problems

      for (const [courseId, entry] of [...repinned].sort()) {
        const read = (commit) => {
          const byId = new Map()
          for (const line of readPinnedSource(commit, entry.path).split('\n')) {
            if (!line.trim()) continue
            const record = JSON.parse(line)
            byId.set(record.lesson_id, record)
          }
          return byId
        }
        const before = read(entry.from)
        const after = read(entry.to)
        if (before.size !== after.size) {
          problems.push(`${courseId}: lesson count changed across the repin`)
          continue
        }
        for (const [lessonId, oldLesson] of [...before].sort()) {
          const newLesson = after.get(lessonId)
          if (!newLesson) {
            problems.push(`${courseId}: ${lessonId} does not exist at the repinned commit`)
            continue
          }
          for (const field of BASIS_FIELDS) {
            if (JSON.stringify(oldLesson[field]) !== JSON.stringify(newLesson[field])) {
              problems.push(
                `${courseId}: ${lessonId} '${field}' changed across the repin, so the key cannot be repinned unread`,
              )
            }
          }
        }
      }
      return problems
    },
  },
  {
    id: 'hazard-phenomenon-never-reaches-a-learner-unbriefed',
    description:
      'Every unit phenomenon that reaches a learner surface — the printed sheet or the instruction the app renders — and names a hazard-bearing material carries the H3 student-visible SAFETY rule with it.',
    run({ packages, sheets }) {
      const problems = []
      // The material classes H3 named as hazard-bearing when a phenomenon
      // mentions them, not only the sealed commercial products H2 covered.
      const HAZARD_MATERIAL =
        /\b(steel wool|finely divided iron|sodium|potassium|reactive metal|bleach|ammonia|drain cleaner|cleaning product|sealed bag|glow stick|cold pack|hand warmer|smoke detector|carbonated|fizzy water|pressuris)/i
      let scanned = 0
      let hazardBearing = 0
      for (const pkg of packages) {
        for (const [surface, text] of [
          ['instruction', pkg.instruction ?? ''],
          ['student sheet', sheets.get(pkg.lesson_id) ?? ''],
        ]) {
          const index = text.indexOf('Anchoring phenomenon')
          if (index === -1) continue
          scanned += 1
          const line = text.slice(index).split('\n')[0]
          if (!HAZARD_MATERIAL.test(line)) continue
          hazardBearing += 1
          if (!/\bSAFETY:/.test(line)) {
            fail(
              problems,
              pkg,
              `${surface} phenomenon names a hazard-bearing material with no student-visible SAFETY rule: ${line.slice(0, 90)}`,
            )
          }
        }
      }
      // A check that saw nothing proves nothing. Both counts have to be real,
      // or the phenomenon has stopped reaching learners and this check is stale.
      if (scanned === 0) problems.push('no learner surface carries a unit phenomenon at all')
      else if (hazardBearing === 0) {
        problems.push('no phenomenon on any learner surface names a hazard-bearing material')
      }
      return problems
    },
  },
  {
    id: 'non-food-grade-route-never-shares-food-equipment',
    description:
      'Any lesson whose pinned source declares a non-food-grade material carries the H3 never-return-to-food-use rule to the learner in its hazard, its safe order, and its disposal.',
    run({ packages, sheets }) {
      const problems = []
      const NON_FOOD_GRADE = /\bnot a food grade\b|\bnon-food[- ]grade\b/i
      const FOOD_USE_RULE = /never return(?:s|ed)? to food or drinking use|returns? to food or drinking use/i
      let covered = 0
      for (const pkg of packages) {
        const hazards = pkg.safety_brief.hazards ?? []
        const flagged = hazards.filter(
          (hazard) =>
            NON_FOOD_GRADE.test(hazard.description) || NON_FOOD_GRADE.test(hazard.mitigation),
        )
        if (flagged.length === 0) continue
        covered += 1
        const sheet = sheets.get(pkg.lesson_id)
        for (const hazard of flagged) {
          if (!sheet.includes(hazard.description)) {
            fail(problems, pkg, 'non-food-grade hazard is not stated to the learner')
          }
          if (!sheet.includes(hazard.mitigation)) {
            fail(problems, pkg, 'non-food-grade mitigation is not stated to the learner')
          }
        }
        const safeOrder = (pkg.safety_brief.safe_order ?? []).join(' ')
        if (!FOOD_USE_RULE.test(safeOrder)) {
          fail(problems, pkg, 'the safe order does not carry the never-return-to-food-use rule')
        }
        if (!FOOD_USE_RULE.test(pkg.safety_brief.disposal ?? '')) {
          fail(problems, pkg, 'the disposal does not carry the never-return-to-food-use rule')
        }
      }
      if (covered === 0) {
        problems.push('no lesson declares a non-food-grade material, so this check saw nothing')
      }
      return problems
    },
  },
  {
    id: 'ppe-named-in-a-mitigation-is-on-the-materials-list',
    description:
      'Protective equipment a mitigation tells the learner to wear — eye protection, gloves, a waterproof dressing — is resolved onto that lesson’s materials list, so it is not assumed to be already at hand.',
    run({ packages }) {
      const problems = []
      const PPE = [
        { id: 'eye protection', named: /\beye protection\b|\bsafety (?:glasses|goggles)\b/i, listed: /\beye protection\b|\bsafety (?:glasses|goggles)\b/i },
        { id: 'gloves', named: /\bgloves?\b/i, listed: /\bgloves?\b/i },
        { id: 'waterproof dressing', named: /\bwaterproof dressing\b/i, listed: /\bwaterproof dressing\b/i },
      ]
      let covered = 0
      for (const pkg of packages) {
        const hazards = pkg.safety_brief.hazards ?? []
        if (hazards.length === 0) continue
        const mitigations = hazards.map((hazard) => hazard.mitigation).join(' ')
        const materials = (pkg.materials ?? []).join(' ')
        for (const item of PPE) {
          if (!unnegatedMatches(mitigations, item.named).length) continue
          covered += 1
          if (!item.listed.test(materials) && !item.listed.test(pkg.safety_brief.required_ppe ?? '')) {
            fail(problems, pkg, `mitigation requires ${item.id}, which is on no materials list`)
          }
        }
      }
      if (covered === 0) problems.push('no mitigation names protective equipment, so this check saw nothing')
      return problems
    },
  },
  {
    id: 'guardian-record-names-safe-order-ppe-and-disposal',
    description:
      'On every hazard-bearing lesson the adult record states the safe order, the protective equipment, and the disposal, resolved exactly as the learner reads them — the three things H3 found the guardian note had no field for.',
    run({ packages, scoring, floor, blocks }) {
      const problems = []
      let covered = 0
      for (const pkg of packages) {
        if ((pkg.safety_brief.hazards ?? []).length === 0) continue
        covered += 1
        const adultCopy = scoring.get(pkg.lesson_id) ?? ''
        const brief = resolveSafetyBrief(pkg.safety_brief, floor, blocks, pkg.band)
        const record = pkg.guardian_record ?? {}

        for (const step of brief.safe_order ?? []) {
          if (!(record.safe_order ?? []).includes(step)) {
            fail(problems, pkg, `safe-order step missing from the guardian record: ${step.slice(0, 50)}`)
          }
          if (!adultCopy.includes(step)) {
            fail(problems, pkg, `safe-order step missing from the scoring sheet: ${step.slice(0, 50)}`)
          }
        }
        for (const [label, learnerText, recorded] of [
          ['protective equipment', brief.required_ppe, record.required_ppe],
          ['disposal', brief.disposal, record.disposal_instruction],
        ]) {
          if (!learnerText) {
            fail(problems, pkg, `${label} is not stated to the learner at all`)
            continue
          }
          if (recorded !== learnerText) {
            fail(problems, pkg, `${label} in the guardian record differs from what the learner reads`)
          }
          if (!adultCopy.includes(learnerText)) {
            fail(problems, pkg, `${label} missing from the scoring sheet`)
          }
        }
      }
      if (covered === 0) problems.push('no hazard-bearing lesson found, so this check saw nothing')
      return problems
    },
  },
]

export function checkIds() {
  return CHECKS.map((check) => check.id)
}

export { loadSharedBlocks }
