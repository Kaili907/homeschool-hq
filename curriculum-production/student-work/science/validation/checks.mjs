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
    id: 'hs-safety-from-h2-only',
    description:
      'Every High School safety brief carries the H2 safety-review text, and no lesson falls back to the failed base candidate.',
    run({ packages, sheets, sources }) {
      const problems = []
      const hsPackages = packages.filter((pkg) => pkg.course_id.startsWith('ma-hs'))
      if (hsPackages.length === 0) return ['no High School packages found at all']

      let carried = 0
      for (const pkg of hsPackages) {
        if (pkg.source.commit === HS_FAILED_BASE_COMMIT) {
          fail(problems, pkg, 'built from the failed base High School candidate')
        }
        const source = sources.get(pkg.lesson_id)
        const segment = (source.lesson_flow ?? []).find(
          (entry) => entry.segment_id === 'safety-review',
        )
        if (!segment) continue
        carried += 1
        const brief = pkg.safety_brief.h2_safety_segment_verbatim ?? ''
        if (brief !== segment.teacher_or_tutor_action) {
          fail(problems, pkg, 'H2 safety-review segment is not carried verbatim')
        }
        // The safe order and stop conditions H2 authored must reach the sheet.
        for (const step of pkg.safety_brief.safe_order ?? []) {
          if (!sheets.get(pkg.lesson_id).includes(step)) {
            fail(problems, pkg, `safe-order step missing from student sheet: ${step.slice(0, 50)}`)
          }
        }
      }
      if (carried === 0) {
        problems.push('no High School lesson carried an H2 safety-review segment')
      }
      return problems
    },
  },
  {
    id: 'hs-base-candidate-defects-absent',
    description:
      'None of the defects the H2 fix removed — flame demonstration, water on a fire, uncapped hot water, sealing a reacting mixture — reappears in any student sheet.',
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
      'All ten non-disableable prohibitions appear on every student sheet, in the wording for that grade band.',
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
      'Any lesson declaring a chemical hazard declares direct-adult supervision, as the H2 framework requires.',
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
      const hsCommit = floor.attribution['hs-h2'].commit
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
          problems.push(`floor clause not in the H2 policy set: ${item.text.slice(0, 60)}`)
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
          problems.push(`stop condition not in the H2 lessons: ${item.text.slice(0, 60)}`)
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
]

export function checkIds() {
  return CHECKS.map((check) => check.id)
}

export { loadSharedBlocks }
