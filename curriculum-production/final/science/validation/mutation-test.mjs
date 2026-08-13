/**
 * Proves the safety gate is not vacuous.
 *
 *   node curriculum-production/final/science/validation/mutation-test.mjs
 *
 * For each check, reintroduce exactly one defect of the class that check exists
 * to catch, then require that named check to report a problem. A check that
 * still passes on its own mutant is not testing anything, and the run fails.
 */

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { CHECKS } from './checks.mjs'
import {
  ROOT,
  loadAllPackages,
  loadCorrectnessKeys,
  loadSafetyFloor,
  loadSharedBlocks,
  scoringSheet,
  studentSheet,
} from './packages.mjs'
import { runSafetyGate } from './validate-safety.mjs'

const basePackages = loadAllPackages().map((pkg) => ({
  ...pkg,
  __sheet: studentSheet(pkg),
  __scoring: scoringSheet(pkg),
}))
const baseFloor = loadSafetyFloor()
const baseBlocks = loadSharedBlocks()
const baseCorrectness = loadCorrectnessKeys()

const find = (packages, predicate) => packages.find(predicate)
const secondary = (packages) => packages.find((pkg) => pkg.band !== 'elementary')

/** Replaces the first line matching `pattern` in a sheet. */
function editSheet(pkg, pattern, replacement) {
  const lines = pkg.__sheet.split('\n')
  const index = lines.findIndex((line) => pattern.test(line))
  if (index === -1) throw new Error(`mutation target not found for ${pkg.lesson_id}: ${pattern}`)
  if (replacement === null) lines.splice(index, 1)
  else lines[index] = replacement
  pkg.__sheet = lines.join('\n')
}

const MUTATIONS = [
  {
    check: 'no-prefilled-observations',
    description: 'fill one cell of a blank record table with a plausible-looking reading',
    apply(state) {
      const pkg = find(state.packages, (entry) => entry.work_type === 'INVESTIGATION_DATA_SHEET')
      editSheet(pkg, /^\|(?:\s+\|){6}$/, '|   | poured the sample | 24.5 |   |   |   |')
    },
  },
  {
    check: 'no-supplied-dataset-embedded',
    description: 'embed a small dataset in the supplied-data provenance statement',
    apply(state) {
      const pkg = find(state.packages, (entry) => entry.assurances.source_integrity_required)
      pkg.supplied_data_alternative = {
        ...pkg.supplied_data_alternative,
        source_declared_provenance: 'Use these readings: 12.4, 18.9, 27.1 and compare them.',
      }
    },
  },
  {
    check: 'student-visible-safety-parity',
    description: 'drop a hazard mitigation from the rendered student sheet',
    apply(state) {
      const pkg = find(
        state.packages,
        (entry) => (entry.safety_brief.hazards ?? []).length > 0 && entry.__sheet.includes('What stops it:'),
      )
      editSheet(pkg, /^ {2}- What stops it: /, null)
    },
  },
  {
    check: 'hs-safety-from-h4-only',
    description: 'paraphrase the H4 safety-review segment instead of carrying it verbatim',
    apply(state) {
      const pkg = find(
        state.packages,
        (entry) => entry.course_id.startsWith('ma-hs') && entry.safety_brief.h4_safety_segment_verbatim,
      )
      pkg.safety_brief = {
        ...pkg.safety_brief,
        h4_safety_segment_verbatim: 'Be careful with the materials and ask an adult if unsure.',
      }
    },
  },
  {
    check: 'hs-base-candidate-defects-absent',
    description: 'reintroduce the flame test the H2 fix removed',
    apply(state) {
      const pkg = state.packages[0]
      pkg.__sheet = `${pkg.__sheet}\n\nHold the wire loop in the burner and record the flame test colour.\n`
    },
  },
  {
    check: 'fire-response-never-water',
    description: 'restore "water within reach" as the fire response',
    apply(state) {
      const pkg = secondary(state.packages)
      editSheet(pkg, /^- Fire: do not use water/, '- Fire: keep water within reach and douse the flame.')
    },
  },
  {
    check: 'no-unsafe-home-experimentation',
    description: 'add a concentrated reagent to a lesson materials list',
    apply(state) {
      const pkg = state.packages[0]
      pkg.materials = [...pkg.materials, 'concentrated hydrochloric acid, 200 mL']
    },
  },
  {
    check: 'equal-credit-alternative-is-safe',
    description: 'remove a lesson equal-credit alternative entirely',
    apply(state) {
      const pkg = state.packages[0]
      pkg.equal_credit_safe_alternative = { ...pkg.equal_credit_safe_alternative, text: '' }
    },
  },
  {
    check: 'hands-on-lessons-carry-a-real-alternative',
    description: 'replace an investigation alternative with a no-equipment note',
    apply(state) {
      const pkg = find(state.packages, (entry) => entry.data_bearing)
      pkg.equal_credit_safe_alternative = {
        ...pkg.equal_credit_safe_alternative,
        is_no_equipment_note: true,
      }
    },
  },
  {
    check: 'alternative-promise-matches-package',
    description: 'promise supplied material with no clarification that none is shipped',
    apply(state) {
      const pkg = find(state.packages, (entry) =>
        /\b(supplied|provided)\b/i.test(entry.equal_credit_safe_alternative.text),
      )
      pkg.equal_credit_safe_alternative = {
        ...pkg.equal_credit_safe_alternative,
        clarification_ref: '',
      }
    },
  },
  {
    check: 'prohibitions-on-every-sheet',
    description: 'drop the mains-electricity prohibition from one student sheet',
    apply(state) {
      const pkg = secondary(state.packages)
      editSheet(pkg, /^- Never connect any investigation to mains electricity/, null)
    },
  },
  {
    check: 'brief-states-supervision-ppe-disposal',
    description: 'remove the clearing-up instruction from one student sheet',
    apply(state) {
      const pkg = state.packages[0]
      editSheet(pkg, /^\*\*Clearing up\.\*\*/, null)
    },
  },
  {
    check: 'chemical-hazard-needs-direct-adult',
    description: 'downgrade a chemical-hazard lesson to a nearby adult',
    apply(state) {
      const pkg = find(state.packages, (entry) =>
        (entry.safety_brief.hazards ?? []).some((hazard) => hazard.kind === 'chemical'),
      )
      pkg.safety_brief = { ...pkg.safety_brief, supervision_level: 'nearby-adult' }
    },
  },
  {
    check: 'no-camera-or-body-data-required',
    description: 'require a photograph as evidence of completion',
    apply(state) {
      const pkg = state.packages[0]
      pkg.__sheet = `${pkg.__sheet}\n\nTake a photograph of your finished setup and submit it as evidence.\n`
    },
  },
  {
    check: 'safety-floor-traceable-to-source',
    description: 'soften a floor prohibition so it no longer matches the H4 policy set',
    apply(state) {
      state.floor = structuredClone(state.floor)
      state.floor.non_disableable_prohibitions[1] = {
        text: 'Try not to use mains electricity if you can avoid it.',
        source: 'hs-h3',
      }
    },
  },
  {
    check: 'canonical-grades-carry-imported-floor',
    description: 'drop an imported Grade 3/4 clause from a Grade 5 sheet',
    apply(state) {
      const pkg = find(state.packages, (entry) => entry.course_id === 'ma-g5-science')
      editSheet(pkg, /^- A responsible adult reviews and approves every investigation/, null)
    },
  },
  {
    check: 'scoring-authority-forbids-unearned-numbers',
    description: 'remove the unearned-number rule from a scoring sheet',
    apply(state) {
      const pkg = state.packages[0]
      pkg.__scoring = pkg.__scoring
        .split('\n')
        .filter((line) => !/did not measure, calculate, or cite/.test(line))
        .join('\n')
    },
  },
  {
    check: 'elementary-safety-is-banded-and-stricter',
    description: 'ship the adult fire instruction, with its smothering option, to a grade 3 sheet',
    apply(state) {
      const pkg = find(state.packages, (entry) => entry.band === 'elementary')
      const adultFire = state.floor.global_stop_conditions.find((item) =>
        /^Fire:/.test(item.text),
      )
      editSheet(pkg, /^- A fire: get everyone out/, `- ${adultFire.text}`)
    },
  },
  {
    check: 'unspecified-procedure-needs-direct-supervision',
    description: 'drop a family-chosen investigation back to an adult within earshot',
    apply(state) {
      const pkg = find(
        state.packages,
        (entry) => entry.data_bearing && entry.safety_brief.safe_order_note_ref === 'k8-safe-order-note',
      )
      pkg.safety_brief = { ...pkg.safety_brief, supervision_level: 'nearby-adult' }
    },
  },
  {
    check: 'tree-matches-checksums',
    description: 'record a checksum for a file that is not in the tree',
    apply(state) {
      state.extraChecksum = true
    },
  },
  {
    check: 'every-lesson-covered',
    description: 'ship one fewer package than the sources contain',
    apply(state) {
      state.packages = state.packages.slice(1)
    },
  },
  {
    check: 'objective-questions-distinct-and-mapped',
    description: 'collapse two stated objectives onto one question prompt',
    apply(state) {
      const pkg = state.packages[0]
      const [first, second] = pkg.analysis_questions
      pkg.analysis_questions = [
        first,
        { ...second, kind: first.kind, prompt: first.prompt },
        ...pkg.analysis_questions.slice(2),
      ]
    },
  },
  {
    check: 'analysis-questions-cover-every-objective',
    description: 'leave one stated objective with no analysis question',
    apply(state) {
      const pkg = state.packages[0]
      const orphan = pkg.learning_objectives.length - 1
      pkg.analysis_questions = pkg.analysis_questions.filter(
        (question) => question.objective_index !== orphan,
      )
    },
  },
  {
    check: 'correctness-authority-on-every-lesson',
    description: 'ship a lesson whose content key does not match the authored file',
    apply(state) {
      const pkg = state.packages[0]
      pkg.scientific_correctness_authority = {
        ...pkg.scientific_correctness_authority,
        relationships: ['Something the authored key does not say.'],
      }
    },
  },
  {
    check: 'correctness-key-states-no-observation',
    description: 'author an expected measurement into a content key',
    apply(state) {
      const [key, topic] = [...state.correctness][0]
      state.correctness.set(key, {
        ...topic,
        relationships: [
          ...topic.relationships,
          'The learner should measure a value close to 24.5 and compare it.',
        ],
      })
    },
  },
  {
    check: 'correctness-authority-is-adult-facing',
    description: 'leak a disqualifying error onto the learner sheet',
    apply(state) {
      const pkg = state.packages[0]
      const error = pkg.scientific_correctness_authority.disqualifying_errors[0]
      pkg.__sheet = `${pkg.__sheet}\n\nCommon mistake to avoid: ${error}\n`
    },
  },
  {
    check: 'investigation-days-bound-conclusions-not-observations',
    description: 'drop the observations-are-not-scored rule from an investigation scoring sheet',
    apply(state) {
      const pkg = find(state.packages, (entry) => entry.data_bearing)
      const rule = state.blocks.text['investigation-correctness-rule']
      pkg.__scoring = pkg.__scoring.split(rule).join('Score the investigation against the key above.')
    },
  },
  {
    check: 'supplied-data-authority-pins-provenance',
    description: 'drop the pinned data-source resource from a supplied-data lesson',
    apply(state) {
      const pkg = find(
        state.packages,
        (entry) => entry.scientific_correctness_authority.supplied_data_answer_authority,
      )
      pkg.scientific_correctness_authority = {
        ...pkg.scientific_correctness_authority,
        supplied_data_answer_authority: {
          ...pkg.scientific_correctness_authority.supplied_data_answer_authority,
          data_source_resource: '',
        },
      }
    },
  },
  {
    check: 'rubric-correctness-criterion-bound-to-key',
    description: 'restore the rubric wording that told the reader no content key ships',
    apply(state) {
      state.blocks.text['rubric-threshold'] =
        'A submission meets the lesson target when every criterion is at Meets or above. ' +
        'Scientific correctness is judged against the lesson\'s stated learning target, success ' +
        'criteria, and course guide — not against a fixed answer key, because this package ships none.'
    },
  },
  {
    check: 'correctness-keys-repinned-on-identical-topic-basis',
    description: 'leave a repinned correctness key on the superseded H3 commit the package no longer reads',
    apply(state) {
      const pkg = find(
        state.packages,
        (entry) => entry.scientific_correctness_authority?.authored?.repinned_from,
      )
      const authored = pkg.scientific_correctness_authority.authored
      pkg.scientific_correctness_authority = {
        ...pkg.scientific_correctness_authority,
        authored: { ...authored, source_commit: authored.repinned_from },
      }
    },
  },
  {
    check: 'hazard-phenomenon-never-reaches-a-learner-unbriefed',
    description: 'strip the H4 SAFETY rule off a phenomenon that names finely divided iron',
    apply(state) {
      const pkg = find(
        state.packages,
        (entry) => /Anchoring phenomenon[^\n]*steel wool/i.test(entry.instruction ?? ''),
      )
      pkg.instruction = pkg.instruction
        .split('\n')
        .map((line) =>
          line.startsWith('Anchoring phenomenon') ? line.split(' SAFETY:')[0] : line,
        )
        .join('\n')
    },
  },
  {
    check: 'non-food-grade-route-never-shares-food-equipment',
    description: 'drop the never-return-to-food-use rule from a non-food-grade disposal',
    apply(state) {
      const pkg = find(state.packages, (entry) =>
        (entry.safety_brief.hazards ?? []).some((hazard) =>
          /not a food grade/i.test(hazard.description),
        ),
      )
      pkg.safety_brief = {
        ...pkg.safety_brief,
        disposal: 'Pour everything down the drain with the tap running and wash the cups.',
      }
    },
  },
  {
    check: 'ppe-named-in-a-mitigation-is-on-the-materials-list',
    description: 'require gloves in a mitigation but leave them off the materials list',
    apply(state) {
      const pkg = find(state.packages, (entry) =>
        (entry.safety_brief.hazards ?? []).some((hazard) => /\bgloves?\b/i.test(hazard.mitigation)),
      )
      pkg.materials = (pkg.materials ?? []).filter((item) => !/\bgloves?\b/i.test(item))
      pkg.safety_brief = {
        ...pkg.safety_brief,
        required_ppe: (pkg.safety_brief.required_ppe ?? '').replace(/ and gloves| gloves,?/gi, ''),
      }
    },
  },
  {
    check: 'guardian-record-names-safe-order-ppe-and-disposal',
    description: 'blank the disposal in the guardian record while the learner still reads one',
    apply(state) {
      const pkg = find(
        state.packages,
        (entry) => (entry.safety_brief.hazards ?? []).length > 0,
      )
      pkg.guardian_record = { ...pkg.guardian_record, disposal_instruction: '' }
    },
  },
  {
    check: 'no-path-states-what-will-be-observed',
    description: 'have an alternative path promise the learner they will observe warming',
    apply(state) {
      const pkg = state.packages[0]
      pkg.equal_credit_safe_alternative = {
        ...pkg.equal_credit_safe_alternative,
        text: `${pkg.equal_credit_safe_alternative.text} Use the mild salts to observe warming.`,
      }
    },
  },
  {
    check: 'h4-b1-b2-b3-closed-on-rendered-sheets',
    description: 'remove the H4-declared dropper from one B1 learner sheet',
    apply(state) {
      const pkg = find(
        state.packages,
        (entry) => entry.lesson_id === 'ma-hs12-earth-space-environmental-u05-l07',
      )
      pkg.__sheet = pkg.__sheet.replace(/dropper/gi, 'pipette')
    },
  },
]

const checkIds = new Set(CHECKS.map((check) => check.id))
const mutated = new Set(MUTATIONS.map((mutation) => mutation.check))
const uncovered = [...checkIds].filter((id) => !mutated.has(id))

const results = []
for (const mutation of MUTATIONS) {
  const state = {
    packages: basePackages.map((pkg) => structuredClone(pkg)),
    floor: baseFloor,
    blocks: structuredClone(baseBlocks),
    correctness: new Map(
      [...baseCorrectness].map(([key, topic]) => [key, structuredClone(topic)]),
    ),
  }
  mutation.apply(state)
  const sumsPath = join(ROOT, 'SHA256SUMS.txt')
  const originalSums = state.extraChecksum ? readFileSync(sumsPath, 'utf8') : null
  if (state.extraChecksum) {
    appendFileSync(sumsPath, `${'0'.repeat(64)}  packages/not-a-real-file.md\n`, 'utf8')
  }
  let report
  try {
    report = runSafetyGate({
      packages: state.packages,
      floor: state.floor,
      blocks: state.blocks,
      correctness: state.correctness,
    })
  } finally {
    if (originalSums !== null) writeFileSync(sumsPath, originalSums, 'utf8')
  }
  const target = report.results.find((result) => result.id === mutation.check)
  const killed = target?.status === 'FAIL'
  results.push({ check: mutation.check, description: mutation.description, killed })
  console.log(
    `${killed ? 'killed  ' : 'SURVIVED'} ${mutation.check} — ${mutation.description}`,
  )
}

const survivors = results.filter((result) => !result.killed)
if (uncovered.length > 0) {
  console.log(`\nchecks with no mutant: ${uncovered.join(', ')}`)
}
console.log(`\n${results.length - survivors.length}/${results.length} mutants killed`)

const ok = survivors.length === 0 && uncovered.length === 0
process.exit(ok ? 0 : 1)
