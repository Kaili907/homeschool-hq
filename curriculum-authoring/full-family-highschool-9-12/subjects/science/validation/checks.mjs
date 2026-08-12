/**
 * Contract and mission checks for the High School 9-12 science authoring set.
 *
 * Kept separate from the CLI so `validation/mutation-test.mjs` can run the same checks
 * against a deliberately damaged copy of the set and prove each check actually fires.
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../../..')
const { validateAuthoringSet, projectStudentLesson } = await import(
  resolve(repoRoot, 'src/curriculum-authoring/v2/validation.ts')
)

export function runChecks(set, frameworkDoc) {
  const lessons = set.lessons
  const checks = []
  const check = (name, pass, detail) => checks.push({ check: name, result: pass ? 'PASS' : 'FAIL', detail })

  const report = validateAuthoringSet(set)

  // ---------------------------------------------------------------- mission checks
  const policy = set.policy_sets[0]
  const framework = set.standard_frameworks[0]
  const frameworkIds = new Set(framework.standards.map((s) => s.standard_id))

  check('schema-contract-valid', report.valid, `${report.issues.length} issues from validateAuthoringSet`)
  check('framework-has-71-performance-expectations', framework.standards.length === 71, `${framework.standards.length} standards`)

  // Every framework PE is claimed as primary coverage by at least one unit.
  const unitPrimary = new Set()
  for (const u of set.units) for (const s of u.standards) unitPrimary.add(s.standard_id)
  const uncovered = [...frameworkIds].filter((id) => !unitPrimary.has(id))
  check('every-performance-expectation-covered', uncovered.length === 0,
    uncovered.length ? `uncovered: ${uncovered.join(', ')}` : 'all 71 covered by a unit')

  // Four courses, four grades, 108 sessions each.
  check('four-courses-grades-9-12',
    set.courses.length === 4 && [9, 10, 11, 12].every((g) => set.courses.some((c) => c.grade === g)),
    set.courses.map((c) => `${c.grade}:${c.course_id}`).join(' '))
  check('each-course-108-sessions',
    set.courses.every((c) => lessons.filter((l) => l.course_ref === c.course_id).length === 108),
    set.courses.map((c) => `${c.course_id}=${lessons.filter((l) => l.course_ref === c.course_id).length}`).join(' '))

  // Lab safety: every unit has a Day 7 investigation with hazards, and a stated alternative.
  const invLessons = lessons.filter((l) => l.day_in_unit === 7)
  check('every-unit-has-an-investigation', invLessons.length === set.units.length, `${invLessons.length} investigation lessons / ${set.units.length} units`)
  check('investigations-declare-hazards', invLessons.every((l) => l.safety_privacy.hazards.length > 0), 'all investigation lessons declare at least one typed hazard')
  check('investigations-declare-supervision',
    invLessons.every((l) => ['nearby-adult', 'direct-adult', 'none'].includes(l.safety_privacy.supervision)),
    'all investigation lessons declare a supervision level')

  // Chemical or thermal hazard implies direct adult supervision and guardian confirmation.
  const chemLessons = invLessons.filter((l) => l.safety_privacy.hazards.some((h) => h.kind === 'chemical'))
  const chemOk = chemLessons.every((l) => l.safety_privacy.supervision === 'direct-adult' && l.safety_privacy.guardian_visibility === 'confirmation-required')
  check('chemical-hazards-require-direct-adult-supervision', chemOk,
    `${chemLessons.length} lessons carry a chemical hazard; ${chemLessons.filter((l) => l.safety_privacy.supervision === 'direct-adult').length} require direct adult supervision`)

  // Every lesson carries a no-special-equipment alternative.
  const hasAlt = (l) => (l.extensions ?? []).some((e) => e.namespace === 'manuel.academy/lab-alternative' && e.value?.value?.trim())
  check('every-lesson-states-an-alternative-path', lessons.every(hasAlt), 'lab-alternative extension present on every lesson')
  check('every-unit-states-an-alternative-path', set.units.every(hasAlt), 'lab-alternative extension present on every unit')

  // Multi-occasion mastery.
  check('multi-occasion-mastery-everywhere',
    lessons.every((l) => l.mastery.minimum_occasions >= 2 && l.mastery.minimum_distinct_dates >= 2 &&
      l.mastery.independent_evidence_required === true && l.mastery.transfer_requirement === 'novel-context'),
    'every lesson requires >=2 occasions on >=2 dates with independent evidence and novel-context transfer')

  // Accessibility and media.
  check('text-fallback-required-everywhere', lessons.every((l) => l.accessibility.text_fallback === 'required'), 'all lessons')
  check('no-required-media-resources', set.resources.every((r) => r.required === false), 'every resource is optional and has a text fallback')
  check('all-resources-have-text-fallback', set.resources.every((r) => r.text_fallback?.trim()), `${set.resources.length} resources`)

  // Prohibited-content scans over the whole serialized package.
  const whole = JSON.stringify(set).toLowerCase()
  // A negated mention ("never require a photograph") is the safeguard, not a violation,
  // so a hit only counts when no negation appears in the preceding clause.
  const NEGATION = /(never|no|not|without|n't)\b[^.]{0,60}$/
  const affirmativeHits = (re) => {
    const hits = []
    for (const m of whole.matchAll(new RegExp(re, 'g'))) {
      if (!NEGATION.test(whole.slice(Math.max(0, m.index - 80), m.index))) hits.push(m[0])
    }
    return hits
  }
  const banned = [
    ['required-photo-or-video-proof', /require[sd]?\s+(a\s+)?(photo|photograph|video|voice recording)/],
    ['mains-electricity-use', /(plug|connect)[^.]{0,40}\b(wall|outlet|mains)\b/],
    ['laser-instruction', /\buse a laser|point the laser|with a laser pointer\b/],
  ]
  for (const [label, re] of banned) {
    const hits = affirmativeHits(re)
    check(`no-${label}`, hits.length === 0, hits.length ? `MATCHED: ${hits.slice(0, 3).join(' | ')}` : 'no affirmative match')
  }

  // No learner body or health measurement requested.
  const bodyRe = /(measure|record|take)\s+(your|the learner's|the student's)\s+(pulse|heart rate|blood pressure|body temperature|weight|height|bmi|breathing rate|reaction time)/
  check('no-learner-body-or-health-measurement', !bodyRe.test(whole), bodyRe.test(whole) ? 'MATCHED' : 'no match')

  // Tutor authority is pinned and never overridden.
  check('tutor-authority-pinned',
    policy.tutor_authority.reveals_answers === false &&
    policy.tutor_authority.gives_final_graded_answer === false &&
    policy.tutor_authority.controls_graded_work_policy === false,
    'policy set pins all three tutor authority invariants to false')
  const SIGNALS = { 'prerequisite-gap': 'prerequisite-reteach', 'procedure-without-understanding': 'conceptual-explanation',
    'correct-low-confidence': 'confidence-calibration', 'repeated-error-pattern': 'error-pattern-contrast',
    'mastery-evidence': 'mastery-evidence-collection' }
  check('tutor-routes-use-controlled-signals-only',
    lessons.every((l) => l.tutor_routes.every((r) => SIGNALS[r.signal] === r.strategy)), 'all routes')

  // Student projection must not leak protected material.
  const leak = lessons.find((l) => {
    const s = JSON.stringify(projectStudentLesson(l, policy))
    return ['scoring_guidance', 'mastery', 'tutor_routes', 'safety_privacy', 'guardian_visibility_note'].some((k) => s.includes(`"${k}"`))
  })
  check('student-projection-carries-no-protected-fields', !leak, leak ? `leak in ${leak.lesson_id}` : 'all 432 lessons project cleanly')

  // Stable refs: ids match the safe-reference pattern the Study seam enforces.
  const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/
  const allRefs = [...lessons.map((l) => l.lesson_id), ...set.units.map((u) => u.unit_id), ...set.courses.map((c) => c.course_id)]
  check('all-refs-are-study-seam-safe', allRefs.every((r) => SAFE_REF.test(r)), `${allRefs.length} identifiers`)
  check('all-refs-unique', new Set(allRefs).size === allRefs.length, `${new Set(allRefs).size} unique of ${allRefs.length}`)

  // Schedules cover every lesson exactly once.
  const scheduled = set.schedules.flatMap((s) => s.entries.flatMap((e) => e.lesson_refs))
  check('schedule-covers-every-lesson-once',
    scheduled.length === lessons.length && new Set(scheduled).size === lessons.length,
    `scheduled=${scheduled.length} lessons=${lessons.length}`)

  // Assessment alignment: every unit assessment carries its unit's standards.
  const byUnit = new Map(set.units.map((u) => [u.unit_id, u]))
  check('assessments-aligned-to-unit-standards',
    set.assessments.every((a) => {
      const u = byUnit.get(a.unit_ref)
      return u && JSON.stringify(a.standards.map((s) => s.standard_id).sort()) === JSON.stringify(u.standards.map((s) => s.standard_id).sort())
    }), `${set.assessments.length} assessments`)
  check('assessment-bands-ordered',
    set.assessment_interpretations.every((i) => i.not_yet_maximum_percent < i.developing_minimum_percent && i.developing_minimum_percent < i.secure_minimum_percent),
    'not-yet < developing < secure for all interpretations')

  // ================================================================ H2 safety and standards checks
  // These target defect CLASSES, not the strings that happen to be present today: a check fails when
  // the class of defect is reintroduced anywhere in the package, however it is worded.

  const DESK_HAZARD = 'Desk-based work only; no chemicals, heat, electricity, or tools are used in this lesson.'
  const isHazardBearing = (l) => l.safety_privacy.hazards.some((h) => h.description !== DESK_HAZARD)
  const hazardLessons = lessons.filter(isHazardBearing)
  const studentText = new Map(lessons.map((l) => [l.lesson_id, JSON.stringify(projectStudentLesson(l, policy))]))
  const fail = (list, label) => (list.length ? `${list.length} offender(s): ${list.slice(0, 4).join(', ')} [${label}]` : null)

  // --- 1. Student-visible safety ------------------------------------------------------------------
  // safety_privacy is stripped from the student projection by the 2.0.0 contract, so any lesson whose
  // guardian record declares a real hazard must also carry that hazard, its mitigation, its supervision
  // level, a safe order, every stop condition, disposal, and the alternative in text the learner sees.
  const REQUIRED_SAFETY_PARTS = ['HAZARD', 'MITIGATION', 'SUPERVISION', 'SAFE ORDER', 'STOP', 'DISPOSAL', 'ALTERNATIVE']
  const missingParts = hazardLessons.filter((l) => {
    const seen = studentText.get(l.lesson_id)
    if (!REQUIRED_SAFETY_PARTS.every((part) => seen.includes(part))) return true
    const sp = l.safety_privacy
    const carried = (text) => seen.includes(JSON.stringify(text).slice(1, -1))
    if (!sp.hazards.every((h) => carried(h.description) && carried(h.mitigation))) return true
    if (!sp.stop_conditions.every((c) => carried(c))) return true
    return !/SAFE ORDER 3\./.test(seen)
  })
  check('investigations-expose-student-visible-safety', missingParts.length === 0,
    fail(missingParts.map((l) => l.lesson_id), 'hazard, mitigation, supervision, safe order, stop, disposal or alternative missing from the student projection')
      ?? `${hazardLessons.length} hazard-bearing lessons carry the full safety brief in student-visible text`)

  // A desk lesson must not silently claim to be desk-based while its unit's performance task is hands-on:
  // every lesson that declares the desk baseline must also declare no chemical or supervision requirement.
  const falseDesk = lessons.filter((l) => !isHazardBearing(l) &&
    (l.safety_privacy.supervision !== 'none' || l.materials.some((m) => /battery|alcohol|peroxide|steel wool|magnet|soil|flame/i.test(m))))
  check('desk-baseline-lessons-really-are-desk-based', falseDesk.length === 0,
    fail(falseDesk.map((l) => l.lesson_id), 'declares the desk baseline while listing hands-on materials') ?? 'no lesson understates its hazards')

  // --- 2/3. Incompatible hazard combinations ------------------------------------------------------
  const FLAMMABLE = /\b(alcohol|isopropyl|isopropanol|ethanol|methylated|acetone|petrol|gasoline|lighter fluid|white spirit|nail polish remover)\b/i
  const IGNITION = /\b(battery|batteries|cell|electrode|lead[s]? into|flame|candle|match|lighter|hob|stove|cooktop|burner|heater|spark|charger|soldering)\b/i
  const SEPARATION_ORDER = /\bstage a\b[\s\S]*\bstage b\b|first[\s\S]{0,400}\bonly then\b|\bbefore any (battery|flame|ignition)/i
  const SEPARATION_TIME = /\b\d+\s*minutes?\b/i
  const SEPARATION_SPACE = /different surface|another room|out of the room|separate surface|\bmetres? from\b|\bmeters? from\b/i
  const SAMPLE_DISPOSAL = /(poured sample|every sample|each sample|every cup|the samples)[\s\S]{0,200}(down (a|the) (running )?(cold )?(tap|drain)|emptied|disposed)/i
  const coHazard = hazardLessons.filter((l) => {
    const mats = l.materials.join(' | ')
    return FLAMMABLE.test(mats) && IGNITION.test(mats)
  })
  const unseparated = coHazard.filter((l) => {
    const seen = studentText.get(l.lesson_id)
    return !(SEPARATION_ORDER.test(seen) && SEPARATION_TIME.test(seen) && SEPARATION_SPACE.test(seen) && SAMPLE_DISPOSAL.test(seen))
  })
  check('incompatible-hazards-require-operational-separation', unseparated.length === 0,
    fail(unseparated.map((l) => l.lesson_id), 'flammable liquid and an ignition source co-listed without ordering, a timed gap, a change of surface, and disposal of the POURED SAMPLES')
      ?? `${coHazard.length} lesson(s) co-list a flammable liquid and an ignition source; all state operational separation in time and space`)

  // Separation that governs only the source container is the defect this package shipped: an explicit
  // statement that the poured samples - not the bottle - end the flammable stage is required.
  const bottleOnly = coHazard.filter((l) => !/not (when )?the bottle is capped|not just the bottle|poured sample/i.test(studentText.get(l.lesson_id)))
  check('flammable-separation-covers-poured-samples-not-just-the-bottle', bottleOnly.length === 0,
    fail(bottleOnly.map((l) => l.lesson_id), 'separation is written for the source container only') ?? 'sample-level separation stated wherever the combination occurs')

  // No flammable liquid may be used as a fuel for a flame demonstration anywhere in the package.
  const FUELLED_FLAME = /(alcohol|ethanol|isopropyl|fuel|spirit)[^.]{0,60}(soaked|wick|burner|lamp|flame test|ignite)|(flame test|flame route|flame demonstration)[^.]{0,80}(alcohol|ethanol|isopropyl|fuel)/i
  check('no-alcohol-or-fuel-fed-flame-demonstration', !FUELLED_FLAME.test(whole),
    FUELLED_FLAME.test(whole) ? `MATCHED: ${whole.match(FUELLED_FLAME)[0]}` : 'no fuel-fed flame demonstration anywhere in the package')

  // Fire response must never be "water": water spreads a burning liquid and conducts.
  const WATER_ON_FIRE = /(water|liquid)[^.]{0,40}(within reach|nearby|to hand)[^.]{0,40}(flame|fire|burn)|(throw|pour|use) water[^.]{0,30}(on|onto)[^.]{0,20}(the )?(flame|fire)/i
  const waterHits = affirmativeHits(WATER_ON_FIRE.source)
  check('no-water-as-the-fire-response', waterHits.length === 0,
    waterHits.length ? `MATCHED: ${waterHits.slice(0, 2).join(' | ')}` : 'fire response never instructs water')

  // --- 4. Hazardous disposal ----------------------------------------------------------------------
  const REACTIVE = /\b(steel wool|peroxide|oxidis|oxidiz|calcium chloride|hand warmer|iron powder|hydrogen|ferment|yeast|decompos|mould|mold)\b/i
  const disposalOf = (l) => (studentText.get(l.lesson_id).match(/DISPOSAL: ([\s\S]*?)\\nALTERNATIVE/) ?? [, ''])[1]
  const noDisposal = hazardLessons.filter((l) => disposalOf(l).trim().length < 40)
  check('every-hazard-bearing-lesson-declares-disposal', noDisposal.length === 0,
    fail(noDisposal.map((l) => l.lesson_id), 'no disposal instruction reaches the learner') ?? `${hazardLessons.length} lessons declare disposal`)

  // A reactive, oxidising, warm, or gas-producing material must never be sealed away, and must have a
  // stated cool-down before it is binned.
  const AFFIRMATIVE_SEAL = /(dispose[^.]{0,40}|put[^.]{0,40}|place[^.]{0,40}|store[^.]{0,40})\bin a (sealed|closed|zip|resealable) (bag|jar|container|box)/i
  const badDisposal = hazardLessons.filter((l) => {
    const d = disposalOf(l)
    if (AFFIRMATIVE_SEAL.test(d)) return true
    const reactive = REACTIVE.test(l.materials.join(' ') + ' ' + l.safety_privacy.hazards.map((h) => h.description).join(' '))
    const neverSealed = /\b(never|not|no|nothing|none)\b[^.]{0,60}\b(seal|sealed|sealing|bag|bagged|cap|capped|cover|covered)\b|still sealed|open (dish|cup|container)|leave[^.]{0,40}open/i
    return reactive && !neverSealed.test(d)
  })
  check('hazardous-disposal-is-open-cooled-and-never-sealed', badDisposal.length === 0,
    fail(badDisposal.map((l) => l.lesson_id), 'disposal seals a reactive or warm material, or omits the never-seal rule') ?? 'no disposal instruction seals a reactive or warm material')

  // Hydrogen-generating chemistry must name the gas rather than treat it as pressure alone.
  const HYDROGEN_SOURCE = /\b(steel wool|iron)\b[\s\S]{0,120}\bvinegar\b|\bvinegar\b[\s\S]{0,120}\b(steel wool|iron)\b/i
  const hydrogenLessons = hazardLessons.filter((l) => HYDROGEN_SOURCE.test(l.materials.join(' | ')))
  const hazardLines = (l) => (l.lesson_flow.find((seg) => seg.segment_id === 'safety-review')?.teacher_or_tutor_action ?? '')
    .split('\n').filter((line) => line.startsWith('HAZARD') || line.startsWith('MITIGATION')).join(' ')
  const hydrogenSilent = hydrogenLessons.filter((l) => !/hydrogen/i.test(hazardLines(l)) || !/flammable|ignit/i.test(hazardLines(l)))
  check('hydrogen-generation-is-named-where-it-occurs', hydrogenSilent.length === 0,
    fail(hydrogenSilent.map((l) => l.lesson_id), 'an acid-and-metal reaction is run without naming hydrogen to the learner')
      ?? `${hydrogenLessons.length} lesson(s) run an acid-and-metal reaction; all name hydrogen and its flammability`)

  // Sealed commercial products are never opened.
  const SEALED_PRODUCT = /\b(cold pack|hand warmer|glow stick|smoke detector|smoke alarm)\b/i
  const sealedLessons = lessons.filter((l) => SEALED_PRODUCT.test(studentText.get(l.lesson_id)))
  const sealedUnguarded = sealedLessons.filter((l) => !/never (cut|open|tear|punctur|dismantl|bite|bitten)|not (cut|opened)|observed[^.]{0,40}outside|still sealed/i.test(studentText.get(l.lesson_id)))
  check('sealed-commercial-products-are-never-opened', sealedUnguarded.length === 0,
    fail(sealedUnguarded.map((l) => l.lesson_id), 'a sealed commercial product is shown to the learner with no do-not-open rule')
      ?? `${sealedLessons.length} lessons mention a sealed commercial product; all forbid opening it`)

  // Strong magnets carry an ingestion rule, not only a pinch rule.
  const magnetLessons = hazardLessons.filter((l) => /\bmagnet\b/i.test(l.materials.join(' | ')))
  const magnetUnguarded = magnetLessons.filter((l) => !/swallow|ingest|mouth/i.test(studentText.get(l.lesson_id)))
  check('strong-magnets-declare-the-ingestion-hazard', magnetUnguarded.length === 0,
    fail(magnetUnguarded.map((l) => l.lesson_id), 'a strong magnet is handled with no ingestion hazard stated') ?? `${magnetLessons.length} magnet lessons state the ingestion hazard`)

  // Soil, mould, and decomposition never share equipment with food.
  // Soil, mould, and reactive residue cannot be washed back into food service; raw egg can, and
  // Physics U3 already carries the wash-and-disinfect control, so it is deliberately not in this class.
  const CONTAMINATING = /\b(soil|mould|mold|decompos|compost|steel wool|oxidis|oxidiz)\b/i
  const FOOD_EQUIPMENT = /\b(baking pan|baking tray|kitchen scale|kitchen sink|dinner plate|food container)\b/i
  const NON_FOOD_RULE = /never (returns?|returned|be returned|return) to (kitchen or )?food use|non-food use|not (be )?used for food|never used for food|out of the kitchen|kept for (this investigation|non-food)/i
  const soilLessons = hazardLessons.filter((l) => CONTAMINATING.test(l.materials.join(' | ')))
  const soilShared = soilLessons.filter((l) => !NON_FOOD_RULE.test(studentText.get(l.lesson_id)))
  check('soil-and-mould-work-never-shares-food-equipment', soilShared.length === 0,
    fail(soilShared.map((l) => l.lesson_id), 'soil, mould, or reactive-residue work omits the never-return-to-food-use rule') ?? `${soilLessons.length} contaminating-material lessons keep equipment out of food use`)
  // ...and no lesson may affirmatively press food equipment into soil or mould service.
  const foodEquipInSoil = soilLessons.filter((l) => l.materials.some((m) => FOOD_EQUIPMENT.test(m) && !/never|not |non-food|kept for/i.test(m)))
  check('no-food-equipment-used-for-soil-or-mould-work', foodEquipInSoil.length === 0,
    fail(foodEquipInSoil.map((l) => l.lesson_id), 'a lesson handling soil, mould, or reactive residue lists kitchen food equipment as a material')
      ?? `${soilLessons.length} contaminating-material lessons list no food equipment`)

  // --- 5. Warm-water numeric caps -----------------------------------------------------------------
  const WARM_WATER = /\b(warm|hot)\s+(tap\s+)?water\b|water bath|warm sample/i
  const NUMERIC_CAP = /\bbelow \d{2} degrees celsius\b|\b\d{2} degrees celsius\b|\b\d{2}\s*°c\b/i
  const HAND_TEST = /(uncomfortable|too hot|comfortab\w*)\s+to\s+touch/i
  const warmLessons = hazardLessons.filter((l) => WARM_WATER.test(l.materials.join(' | ') + ' ' + studentText.get(l.lesson_id)))
  const uncapped = warmLessons.filter((l) => !NUMERIC_CAP.test(studentText.get(l.lesson_id)))
  check('warm-water-steps-carry-a-numeric-temperature-cap', uncapped.length === 0,
    fail(uncapped.map((l) => l.lesson_id), 'warm or hot water with no numeric cap in student-visible text') ?? `${warmLessons.length} warm-water lessons state a numeric cap`)
  const handTested = lessons.filter((l) => HAND_TEST.test(studentText.get(l.lesson_id)) || l.safety_privacy.stop_conditions.some((c) => HAND_TEST.test(c)))
  check('temperature-is-never-judged-by-hand', handTested.length === 0,
    fail(handTested.map((l) => l.lesson_id), 'a stop condition asks the learner to test water temperature by touching it') ?? 'temperature is judged with a thermometer everywhere')

  // --- 6. Standards group labels against the canonical framework ----------------------------------
  // Transcribed independently from the Michigan / NGSS high school topic arrangement, so a wrong label
  // in tools/standards_data.py cannot validate itself.
  const CANONICAL_GROUPS = {
    'Structure and Properties of Matter': ['HS-PS1-1', 'HS-PS1-3', 'HS-PS1-8', 'HS-PS2-6'],
    'Chemical Reactions': ['HS-PS1-2', 'HS-PS1-4', 'HS-PS1-5', 'HS-PS1-6', 'HS-PS1-7'],
    'Forces and Interactions': ['HS-PS2-1', 'HS-PS2-2', 'HS-PS2-3', 'HS-PS2-4', 'HS-PS2-5'],
    Energy: ['HS-PS3-1', 'HS-PS3-2', 'HS-PS3-3', 'HS-PS3-4', 'HS-PS3-5'],
    'Waves and Electromagnetic Radiation': ['HS-PS4-1', 'HS-PS4-2', 'HS-PS4-3', 'HS-PS4-4', 'HS-PS4-5'],
    'Structure and Function': ['HS-LS1-1', 'HS-LS1-2', 'HS-LS1-3'],
    'Matter and Energy in Organisms and Ecosystems': ['HS-LS1-5', 'HS-LS1-6', 'HS-LS1-7', 'HS-LS2-3', 'HS-LS2-4', 'HS-LS2-5'],
    'Interdependent Relationships in Ecosystems': ['HS-LS2-1', 'HS-LS2-2', 'HS-LS2-6', 'HS-LS2-7', 'HS-LS2-8', 'HS-LS4-6'],
    'Inheritance and Variation of Traits': ['HS-LS1-4', 'HS-LS3-1', 'HS-LS3-2', 'HS-LS3-3'],
    'Natural Selection and Evolution': ['HS-LS4-1', 'HS-LS4-2', 'HS-LS4-3', 'HS-LS4-4', 'HS-LS4-5'],
    'Space Systems': ['HS-ESS1-1', 'HS-ESS1-2', 'HS-ESS1-3', 'HS-ESS1-4'],
    'History of Earth': ['HS-ESS1-5', 'HS-ESS1-6', 'HS-ESS2-1'],
    "Earth's Systems": ['HS-ESS2-2', 'HS-ESS2-3', 'HS-ESS2-5', 'HS-ESS2-6', 'HS-ESS2-7'],
    'Weather and Climate': ['HS-ESS2-4', 'HS-ESS3-5'],
    'Human Sustainability': ['HS-ESS3-1', 'HS-ESS3-2', 'HS-ESS3-3', 'HS-ESS3-4', 'HS-ESS3-6'],
    'Engineering Design': ['HS-ETS1-1', 'HS-ETS1-2', 'HS-ETS1-3', 'HS-ETS1-4'],
  }
  const canonicalOf = new Map()
  for (const [group, codes] of Object.entries(CANONICAL_GROUPS)) for (const code of codes) canonicalOf.set(code, group)
  const mislabelled = framework.standards.filter((s) => canonicalOf.get(s.code) !== s.label)
  check('standards-group-labels-match-the-canonical-framework', mislabelled.length === 0 && canonicalOf.size === 71,
    mislabelled.length
      ? `${mislabelled.length} mislabelled: ${mislabelled.slice(0, 6).map((s) => `${s.code} is "${s.label}", canonical is "${canonicalOf.get(s.code)}"`).join('; ')}`
      : `all 71 topic labels match the canonical arrangement`)

  // --- 7/8. Teaching order, assessment alignment, preview vs reinforcement -------------------------
  const courseOrder = new Map(set.courses.map((c) => [c.course_id, c.order]))
  const orderedUnits = [...set.units].sort((a, b) => (courseOrder.get(a.course_ref) - courseOrder.get(b.course_ref)) || (a.order - b.order))
  const unitIndex = new Map(orderedUnits.map((u, i) => [u.unit_id, i + 1]))
  const firstTaught = new Map()
  for (const u of orderedUnits) {
    for (const s of u.standards) {
      if (s.mapping_status === 'canonical' && s.standard_id && !firstTaught.has(s.standard_id)) firstTaught.set(s.standard_id, unitIndex.get(u.unit_id))
    }
  }
  const ownerCount = new Map()
  for (const u of orderedUnits) {
    for (const st of u.standards) {
      if (st.mapping_status !== 'canonical' || !st.standard_id) continue
      ownerCount.set(st.standard_id, (ownerCount.get(st.standard_id) ?? []).concat(u.unit_id))
    }
  }
  // HS-ETS1-* is deliberately distributed across all four engineering capstones; every other
  // performance expectation has exactly one owning unit, so a second claim is a borrow.
  const multiOwned = [...ownerCount].filter(([id, owners]) => owners.length > 1 && !id.startsWith('hs-ets1-'))
  const scienceOwned = [...ownerCount].filter(([id]) => !id.startsWith('hs-ets1-')).length
  check('every-science-performance-expectation-has-exactly-one-primary-owner', multiOwned.length === 0,
    multiOwned.length
      ? `${multiOwned.length} standard(s) claimed by more than one unit: ${multiOwned.slice(0, 4).map(([id, owners]) => `${id} -> ${owners.join(' + ')}`).join('; ')}`
      : `all ${scienceOwned} science performance expectations have exactly one owning unit; HS-ETS1-* is distributed across the four capstones by design`)

  const earlyAssessed = []
  for (const a of set.assessments) {
    const idx = unitIndex.get(a.unit_ref)
    for (const s of a.standards) {
      if (s.mapping_status !== 'canonical') continue
      const taught = firstTaught.get(s.standard_id)
      if (taught === undefined || taught > idx) earlyAssessed.push(`${a.assessment_id}:${s.standard_id}`)
    }
  }
  check('assessment-standards-are-taught-in-or-before-their-unit', earlyAssessed.length === 0,
    fail(earlyAssessed, 'assessed before it is taught') ?? `${set.assessments.length} assessments carry only standards already taught`)

  // A unit with no performance expectation must say so rather than borrowing one.
  const borrowed = set.units.filter((u) => u.standards.some((s) => s.mapping_status !== 'canonical') && u.standards.length !== 1)
  const foundation = set.units.filter((u) => u.standards.every((s) => s.mapping_status !== 'canonical'))
  const foundationBad = foundation.filter((u) => !/claims no [^.]*performance expectation/i.test(u.standards[0].legacy_label ?? ''))
  check('foundation-units-claim-no-performance-expectation', borrowed.length === 0 && foundationBad.length === 0,
    fail([...borrowed, ...foundationBad].map((u) => u.unit_id), 'a unit without a performance expectation borrows or mislabels one')
      ?? `${foundation.length} foundation unit(s) declare no performance expectation instead of borrowing one`)

  // Reinforcement looks backwards, a preview looks forwards, and the two are never labelled the same.
  const roleOf = (entity) => (entity.extensions ?? []).find((e) => e.namespace === 'manuel.academy/standards-role')?.value?.value ?? ''
  const codesIn = (text, marker) => {
    const seg = text.split(marker)[1]
    if (seg === undefined) return []
    return (seg.split('.')[0].match(/HS-[A-Z]+\d-\d+/g) ?? []).map((c) => c.toLowerCase())
  }
  const semanticFaults = []
  for (const u of set.units) {
    const idx = unitIndex.get(u.unit_id)
    const text = roleOf(u)
    const back = codesIn(text, 'Reinforced')
    const fwd = codesIn(text, 'Previewed')
    for (const c of back) if (!(firstTaught.get(c) <= idx)) semanticFaults.push(`${u.unit_id}: ${c} called reinforcement but first taught at unit ${firstTaught.get(c) ?? '?'} of ${idx}`)
    for (const c of fwd) if (firstTaught.get(c) <= idx) semanticFaults.push(`${u.unit_id}: ${c} called a preview but already taught at unit ${firstTaught.get(c)}`)
    for (const c of fwd) if (u.standards.some((s) => s.standard_id === c)) semanticFaults.push(`${u.unit_id}: ${c} is previewed and assessed in the same unit`)
    for (const c of back) if (fwd.includes(c)) semanticFaults.push(`${u.unit_id}: ${c} is both reinforced and previewed`)
  }
  check('preview-and-reinforcement-semantics-hold', semanticFaults.length === 0,
    fail(semanticFaults, 'forward-looking coverage labelled as reinforcement, or the reverse')
      ?? 'every reinforced standard was taught earlier and every previewed standard is taught later')

  // --- 9. Safety documentation agrees with the authored hazards -----------------------------------
  const declared = (re) => { const m = frameworkDoc.match(re); return m ? Number(m[1]) : null }
  const chemicalLessonCount = hazardLessons.filter((l) => l.safety_privacy.hazards.some((h) => h.kind === 'chemical')).length
  const emotionalUnitCount = new Set(hazardLessons.filter((l) => l.safety_privacy.hazards.some((h) => h.kind === 'emotional')).map((l) => l.unit_ref)).size
  const docFacts = [
    ['chemical-hazard lessons', declared(/holds for all (\d+) lessons that carry a chemical hazard/), chemicalLessonCount],
    ['emotional-hazard units', declared(/(\d+) units are flagged with `emotional` hazards/), emotionalUnitCount],
    ['investigations with an alternative', declared(/Every one of the (\d+) investigations/), set.units.length],
    ['hazard-bearing lessons', declared(/checks this on all (\d+) hazard-bearing lessons/), hazardLessons.length],
    ['non-disableable prohibitions', (frameworkDoc.match(/^\d+\. Never /gm) ?? []).length, policy.safety_privacy.non_disableable_prohibitions.length],
  ]
  const docMismatch = docFacts.filter(([, d, a]) => d === null || d !== a)
  check('safety-documentation-agrees-with-the-authored-hazards', docMismatch.length === 0,
    docMismatch.length
      ? docMismatch.map(([label, d, a]) => `${label}: doc says ${d ?? 'nothing'}, package has ${a}`).join('; ')
      : docFacts.map(([label, , a]) => `${label}=${a}`).join(' '))

  return { report, checks }
}
