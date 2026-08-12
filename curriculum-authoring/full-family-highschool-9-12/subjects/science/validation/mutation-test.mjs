/**
 * Mutation tests for the H2 safety and standards checks.
 *
 * A check that never fails is decoration. Each mutant below reintroduces one defect class
 * that shipped in the base package, and the named check must go FAIL. A surviving mutant
 * means the check is asserting a string rather than detecting the defect.
 *
 * Run from the repository root:
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning \
 *     curriculum-authoring/full-family-highschool-9-12/subjects/science/validation/mutation-test.mjs
 */
import { runChecks } from './checks.mjs'
import { loadSet, loadFrameworkDoc } from './validate.mjs'

const clone = (value) => JSON.parse(JSON.stringify(value))
const baseline = loadSet()
const baselineDoc = loadFrameworkDoc()

const lessonsOf = (set, predicate) => set.lessons.filter(predicate)
const safetySegment = (lesson) => lesson.lesson_flow.find((s) => s.segment_id === 'safety-review')
const withSafety = (set) => lessonsOf(set, (l) => safetySegment(l) !== undefined)
const find = (set, id) => set.lessons.find((l) => l.lesson_id === id)
const editSafety = (lesson, fn) => {
  const seg = safetySegment(lesson)
  seg.teacher_or_tutor_action = fn(seg.teacher_or_tutor_action)
}

const MUTANTS = [
  {
    name: 'safety-brief-removed-from-the-student-projection',
    kills: 'investigations-expose-student-visible-safety',
    why: 'the base package kept every hazard in safety_privacy only, which the contract strips from the learner',
    apply(set) {
      for (const lesson of withSafety(set)) lesson.lesson_flow = lesson.lesson_flow.filter((s) => s.segment_id !== 'safety-review')
    },
  },
  {
    name: 'one-hazard-dropped-from-an-otherwise-complete-brief',
    kills: 'investigations-expose-student-visible-safety',
    why: 'a brief that silently omits one of the declared hazards is worse than an obviously absent one',
    apply(set) {
      const lesson = find(set, 'ma-hs10-chemistry-u03-l07')
      const dropped = lesson.safety_privacy.hazards[2]
      editSafety(lesson, (t) => t.split('\n').filter((line) => !line.includes(dropped.description) && !line.includes(dropped.mitigation)).join('\n'))
    },
  },
  {
    name: 'stop-conditions-dropped-from-the-brief',
    kills: 'investigations-expose-student-visible-safety',
    why: 'stop conditions are the learner\'s abort switch and must survive the projection',
    apply(set) {
      const lesson = find(set, 'ma-hs9-biology-u02-l07')
      editSafety(lesson, (t) => t.split('\n').filter((line) => !line.startsWith('  STOP:')).join('\n'))
    },
  },
  {
    name: 'alcohol-battery-separation-reverts-to-the-source-bottle',
    kills: 'flammable-separation-covers-poured-samples-not-just-the-bottle',
    why: 'the shipped defect: capping the bottle was treated as ending the flammable stage while poured cups stayed out',
    apply(set) {
      for (const lesson of withSafety(set)) {
        editSafety(lesson, (t) => t
          .replace(/not \(?when \)?the bottle is capped/gi, 'once the bottle is capped')
          .replace(/not just the bottle/gi, 'the bottle')
          .replace(/POURED SAMPLE/g, 'BOTTLE')
          .replace(/poured sample/gi, 'bottle'))
      }
    },
  },
  {
    name: 'timed-and-spatial-separation-removed',
    kills: 'incompatible-hazards-require-operational-separation',
    why: 'ordering alone does not separate a flammable vapour from an ignition source',
    apply(set) {
      for (const lesson of withSafety(set)) {
        editSafety(lesson, (t) => t.replace(/for at least ten minutes/gi, 'briefly').replace(/\b\d+\s*minutes?\b/gi, 'a moment').replace(/DIFFERENT surface/gi, 'the same surface').replace(/different surface/gi, 'the same surface'))
      }
    },
  },
  {
    name: 'alcohol-fuelled-flame-demonstration-reintroduced',
    kills: 'no-alcohol-or-fuel-fed-flame-demonstration',
    why: 'the base package left the flame route unspecified, which steers a home toward an alcohol-soaked wick',
    apply(set) {
      const lesson = find(set, 'ma-hs10-chemistry-u02-l07')
      lesson.materials.push('an alcohol-soaked cotton wick for the flame test')
    },
  },
  {
    name: 'water-restored-as-the-fire-response',
    kills: 'no-water-as-the-fire-response',
    why: 'the base package told a family to keep water within reach of a flame test',
    apply(set) {
      const lesson = find(set, 'ma-hs10-chemistry-u02-l07')
      editSafety(lesson, (t) => t + '\nMITIGATION: keep water within reach of the flame in case of fire.')
    },
  },
  {
    name: 'warm-steel-wool-sealed-in-a-bag-again',
    kills: 'hazardous-disposal-is-open-cooled-and-never-sealed',
    why: 'the base package instructed sealing actively oxidising steel wool in a plastic bag',
    apply(set) {
      for (const lesson of withSafety(set)) {
        editSafety(lesson, (t) => t.replace(/DISPOSAL: [\s\S]*?\nALTERNATIVE/, 'DISPOSAL: Dispose of it in a sealed bag when the run is finished.\nALTERNATIVE'))
      }
    },
  },
  {
    name: 'disposal-removed-entirely',
    kills: 'every-hazard-bearing-lesson-declares-disposal',
    why: '34 of 36 investigations shipped with no disposal instruction at all',
    apply(set) {
      for (const lesson of withSafety(set)) editSafety(lesson, (t) => t.replace(/DISPOSAL: [\s\S]*?\nALTERNATIVE/, 'DISPOSAL: -\nALTERNATIVE'))
    },
  },
  {
    name: 'hydrogen-generation-goes-unnamed',
    kills: 'hydrogen-generation-is-named-where-it-occurs',
    why: 'the base package treated an inflating bag as pressure and never named the flammable gas',
    apply(set) {
      for (const lesson of withSafety(set)) editSafety(lesson, (t) => t.replace(/hydrogen/gi, 'gas').replace(/flammable/gi, 'notable'))
    },
  },
  {
    name: 'numeric-water-cap-replaced-by-a-hand-test',
    kills: 'warm-water-steps-carry-a-numeric-temperature-cap',
    why: 'the base package left "hot water from the tap" uncapped in Chemistry Unit 4',
    apply(set) {
      for (const lesson of withSafety(set)) {
        editSafety(lesson, (t) => t.replace(/below \d{2} degrees celsius/gi, 'comfortably warm').replace(/\d{2} degrees celsius/gi, 'a safe temperature'))
        lesson.materials = lesson.materials.map((m) => m.replace(/below \d{2} degrees Celsius/gi, 'comfortably warm'))
      }
    },
  },
  {
    name: 'temperature-judged-by-touching-the-water',
    kills: 'temperature-is-never-judged-by-hand',
    why: 'three units shipped a stop condition that told the learner to test the water by touching it',
    apply(set) {
      const lesson = find(set, 'ma-hs11-physics-u06-l07')
      lesson.safety_privacy.stop_conditions.push('Stop if water is hot enough to be uncomfortable to touch.')
    },
  },
  {
    name: 'magnet-ingestion-hazard-removed',
    kills: 'strong-magnets-declare-the-ingestion-hazard',
    why: 'the base package covered pinching and bank cards but not the surgical emergency',
    apply(set) {
      for (const lesson of withSafety(set)) editSafety(lesson, (t) => t.replace(/swallow\w*/gi, 'handle').replace(/\bingest\w*/gi, 'handle').replace(/\bmouth\b/gi, 'hand'))
    },
  },
  {
    name: 'sealed-commercial-product-loses-its-do-not-open-rule',
    kills: 'sealed-commercial-products-are-never-opened',
    why: 'the cold pack, hand warmer, glow stick, and smoke detector are shown to the learner on all 12 days',
    apply(set) {
      for (const lesson of set.lessons) {
        for (const seg of lesson.lesson_flow) {
          seg.teacher_or_tutor_action = seg.teacher_or_tutor_action
            .replace(/never cut[^.]*\./gi, '').replace(/never (torn|opened|punctured)[^.]*\./gi, '')
            .replace(/observed sealed[^.]*\./gi, '').replace(/still sealed/gi, '')
            .replace(/OBSERVED FROM THE OUTSIDE ONLY[^.]*\./gi, '')
            .replace(/never be cut[^.]*\./gi, '').replace(/never bitten[^.]*\./gi, '')
            .replace(/never cut, torn, punctured, bitten, dismantled, or opened/gi, 'examined')
            .replace(/never cut, bite, open, or mouth a glow stick/gi, 'use a glow stick')
            .replace(/never opened, dismantled, or taken apart/gi, 'examined')
        }
        lesson.materials = lesson.materials.map((m) => m.replace(/OBSERVED SEALED and never opened/gi, 'for observation'))
      }
    },
  },
  {
    name: 'soil-and-mould-work-returns-to-the-kitchen-scale',
    kills: 'no-food-equipment-used-for-soil-or-mould-work',
    why: 'the base package weighed mould-colonised matter on the family kitchen scale',
    apply(set) {
      const lesson = find(set, 'ma-hs9-biology-u06-l07')
      lesson.materials.push('kitchen scale')
    },
  },
  {
    name: 'six-standards-group-labels-flipped-back',
    kills: 'standards-group-labels-match-the-canonical-framework',
    why: 'HS-LS1-5/6/7 and HS-LS2-3/4/5 shipped labelled "Energy" instead of their own topic',
    apply(set) {
      for (const standard of set.standard_frameworks[0].standards) {
        if (['HS-LS1-5', 'HS-LS1-6', 'HS-LS1-7', 'HS-LS2-3', 'HS-LS2-4', 'HS-LS2-5'].includes(standard.code)) standard.label = 'Energy'
      }
    },
  },
  {
    name: 'unit-1-assessment-borrows-a-standard-taught-later',
    kills: 'assessment-standards-are-taught-in-or-before-their-unit',
    why: 'Unit 1 assessments shipped tagged to HS-PS2-1 and HS-ESS3-5, both taught later in their own course',
    apply(set) {
      const assessment = set.assessments.find((a) => a.unit_ref === 'ma-hs11-physics-u01')
      assessment.standards = [{ framework_ref: 'michigan-science-standards-2015', standard_id: 'hs-ps2-1', mapping_status: 'canonical' }]
    },
  },
  {
    name: 'a-forward-looking-standard-is-called-reinforcement',
    kills: 'preview-and-reinforcement-semantics-hold',
    why: 'fourteen forward-looking entries shipped labelled as reinforcement',
    apply(set) {
      const unit = set.units.find((u) => u.unit_id === 'ma-hs9-biology-u01')
      const role = unit.extensions.find((e) => e.namespace === 'manuel.academy/standards-role')
      role.value.value = role.value.value.replace(/Previewed \(taught later in the sequence; touched here to build readiness, never assessed here\)/, 'Reinforced (already taught in or before this unit, and assessed only where it is primary)')
    },
  },
  {
    name: 'foundation-unit-borrows-a-performance-expectation',
    kills: 'every-science-performance-expectation-has-exactly-one-primary-owner',
    why: 'a unit that teaches no performance expectation used to inherit one from its spiral list, creating a second owner',
    apply(set) {
      const unit = set.units.find((u) => u.unit_id === 'ma-hs11-physics-u01')
      unit.standards = [{ framework_ref: 'michigan-science-standards-2015', standard_id: 'hs-ps2-1', mapping_status: 'canonical' }]
    },
  },
  {
    name: 'day-9-understates-its-hazards',
    kills: 'desk-baseline-lessons-really-are-desk-based',
    why: 'Day 9 rebuilt the performance task while declaring "no chemicals, heat, electricity, or tools"',
    apply(set) {
      const lesson = find(set, 'ma-hs10-chemistry-u03-l09')
      lesson.lesson_flow = lesson.lesson_flow.filter((s) => s.segment_id !== 'safety-review')
      lesson.safety_privacy.hazards = [{
        kind: 'physical',
        description: 'Desk-based work only; no chemicals, heat, electricity, or tools are used in this lesson.',
        mitigation: 'Materials are notebook, writing tool, and printed or on-screen text. Any hands-on extension defers to the unit investigation\'s safety review.',
      }]
      lesson.safety_privacy.supervision = 'direct-adult'
    },
  },
  {
    name: 'foundation-unit-legacy-label-claims-a-standard',
    kills: 'foundation-units-claim-no-performance-expectation',
    why: 'a foundation unit must say plainly that it claims no performance expectation',
    apply(set) {
      const unit = set.units.find((u) => u.unit_id === 'ma-hs9-biology-u01')
      unit.standards[0].legacy_label = 'Practice foundation aligned to the engineering design strand.'
    },
  },
  {
    name: 'safety-documentation-count-drifts-from-the-package',
    kills: 'safety-documentation-agrees-with-the-authored-hazards',
    why: 'the framework claimed 11 chemical-hazard lessons and 4 emotional-hazard units when neither matched',
    doc: (text) => text.replace('holds for all 20 lessons that carry a chemical hazard', 'holds for all 11 lessons that carry a chemical hazard'),
    apply() {},
  },
]

const { checks: cleanChecks } = runChecks(clone(baseline), baselineDoc)
const cleanFailures = cleanChecks.filter((c) => c.result === 'FAIL')
if (cleanFailures.length) {
  console.log('BASELINE IS NOT CLEAN; mutation results would be meaningless:')
  for (const c of cleanFailures) console.log(`  FAIL ${c.check} - ${c.detail}`)
  process.exit(1)
}

let killed = 0
const survivors = []
for (const mutant of MUTANTS) {
  const set = clone(baseline)
  mutant.apply(set)
  const doc = mutant.doc ? mutant.doc(baselineDoc) : baselineDoc
  const { checks } = runChecks(set, doc)
  const target = checks.find((c) => c.check === mutant.kills)
  if (!target) {
    survivors.push(`${mutant.name}: no check named ${mutant.kills}`)
    console.log(`  SURVIVED  ${mutant.name} -> ${mutant.kills} does not exist`)
    continue
  }
  if (target.result === 'FAIL') {
    killed += 1
    console.log(`  killed    ${mutant.name} -> ${mutant.kills}`)
  } else {
    survivors.push(`${mutant.name}: ${mutant.kills} still passed`)
    console.log(`  SURVIVED  ${mutant.name} -> ${mutant.kills} still PASSED`)
  }
}

console.log(`\nMUTANTS: ${killed}/${MUTANTS.length} killed`)
for (const s of survivors) console.log(`  survivor: ${s}`)
process.exit(survivors.length === 0 ? 0 : 1)
