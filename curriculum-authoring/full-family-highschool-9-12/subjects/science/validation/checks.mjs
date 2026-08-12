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
  const NEGATION = /(never|neither|no|not|without|n't)\b/i
  // Clause scope, not sentence scope: a negation only cancels the clause it governs. `. ; : ,and
  // ,then` and a bare newline all open a new clause, so an earlier negated clause can no longer
  // hide an affirmative hazard instruction that follows it.
  const CLAUSE_BREAK = /[.;:\n]|,\s*(and|then|but|or)\s|\s(and|then)\s+(?=(connect|plug|light|pour|add|use|hold|place)\b)/gi
  const clauseBefore = (text, index) => {
    const head = text.slice(Math.max(0, index - 200), index)
    let start = 0
    for (const b of head.matchAll(CLAUSE_BREAK)) start = b.index + b[0].length
    return head.slice(start)
  }
  const affirmativeHitsIn = (text, re) => {
    const hits = []
    for (const m of text.matchAll(new RegExp(re, 'gi'))) {
      if (!NEGATION.test(clauseBefore(text, m.index))) hits.push(m[0])
    }
    return hits
  }
  const affirmativeHits = (re) => affirmativeHitsIn(whole, re)
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


  // ================================================================ H3 learner-use checks
  // The H2 review found two defects the H2 checks could not see: a hazard-bearing phenomenon
  // repeated on the ten days that carry no safety brief, and a non-food-grade chemical sharing
  // drinking equipment. Both are defect CLASSES, so the checks below detect the class.

  // Plain student-visible text, so windows and clause boundaries work on real prose rather than
  // on JSON escapes.
  const flatText = (value) => {
    const out = []
    const walk = (v) => {
      if (typeof v === 'string') out.push(v)
      else if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    walk(value)
    return out.join('\n')
  }
  const studentPlain = new Map(lessons.map((l) => [l.lesson_id, flatText(projectStudentLesson(l, policy))]))
  const studentStrings = (l) => { const out = []; const walk = (v) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk) }; walk(projectStudentLesson(l, policy)); return out }
  const briefOf = (l) => l.lesson_flow.find((s) => s.segment_id === 'safety-review')?.teacher_or_tutor_action ?? ''
  const hasBrief = (l) => briefOf(l).length > 0

  // --- A. Hazard-bearing text on days that carry no safety brief -----------------------------------
  // Only the hands-on days carry a safety review, but the unit phenomenon is repeated on all twelve
  // and unit extensions carry it with no day at all. Any student-visible naming of a material whose
  // hazard a learner could reproduce at a kitchen sink must carry a prohibition AND the context that
  // defers it to supervision or to data, in the same passage.
  const REPRODUCIBLE_HAZARD = /\b(steel wool|iron powder|iron filings|sodium|potassium|caesium|cesium|bleach|ammonia|drain cleaner|calcium chloride|ice-melt|hydrogen peroxide|cold pack|hand warmer|glow stick|smoke detector|smoke alarm|sealed (bag|jar|box|container|bottle))\b/gi
  const RULE_PROHIBITION = /\b(never|neither|not|no|do not|does not)\b/i
  const RULE_CONTEXT = /\b(adult|safety review|investigation|day 7|sealed|outside only|recorded data|published (data|footage|table)|data only|is handled|are handled)\b/i
  const unruled = []
  // The rule has to live in the SAME string the learner reads the material in. A window over the
  // whole projection let an unrelated neighbouring field supply the words and mask the gap.
  const scanUnbriefed = (label, strings) => {
    for (const text of strings) {
      for (const m of text.matchAll(REPRODUCIBLE_HAZARD)) {
        const near = text.slice(Math.max(0, m.index - 150), m.index + 600)
        if (!(RULE_PROHIBITION.test(near) && RULE_CONTEXT.test(text))) unruled.push(`${label}:${m[0]}`)
      }
    }
  }
  for (const l of lessons.filter((l) => !hasBrief(l))) scanUnbriefed(l.lesson_id, studentStrings(l))
  for (const u of set.units) scanUnbriefed(u.unit_id, (u.extensions ?? []).filter((e) => e.projection === 'student-safe').map((e) => e.value?.value ?? ''))
  check('unbriefed-hazard-text-carries-a-student-visible-rule', unruled.length === 0,
    fail(unruled, 'a hazard-bearing material is named in student-visible text on a day with no safety brief, with no prohibition and no deferral to supervision or data')
      ?? 'every hazard-bearing material named outside a safety brief carries its own prohibition and deferral')

  // --- B. Non-food-grade chemicals and food or drinking equipment ----------------------------------
  // A non-food grade may not touch anything that returns to eating or drinking. Disposable or
  // permanently designated non-food equipment is the only acceptable answer.
  const NON_FOOD_GRADE = /\b(ice-melt|ice melt|road salt|de-?icer|pool salt|non-food-grade|not food grade|technical grade|fertilis|fertiliz|garden lime)\b/i
  const FOOD_OR_DRINK_VESSEL = /\b(mug|tumbler|drinking (glass|cup)|water bottle|flask|straw|dinner plate|bowl|kitchen scale|baking (pan|tray)|food container|measuring (spoon|jug|cup)|cutlery|fork|teaspoon|saucepan|kettle|insulated (cup|mug)|clear cups?)\b/i
  const PERMANENTLY_NON_FOOD = /\b(disposable|single[- ]use|binned after|lab use only|non-food|never (used )?(for|with) (food|drink)|never (returns?|return) to (the kitchen|food|drinking)|stays in food use|never holds calcium chloride|only;? it never holds)\b/i
  const nonFoodGradeLessons = hazardLessons.filter((l) => NON_FOOD_GRADE.test(l.materials.join(' | ')))
  const sharedKit = []
  for (const l of nonFoodGradeLessons) {
    for (const m of l.materials) if (FOOD_OR_DRINK_VESSEL.test(m) && !PERMANENTLY_NON_FOOD.test(m)) sharedKit.push(`${l.lesson_id}: ${m.slice(0, 60)}`)
    if (!/returns? to food or drinking use|never returns? to (the kitchen|food)/i.test(studentPlain.get(l.lesson_id))) sharedKit.push(`${l.lesson_id}: no never-return-to-food rule reaches the learner`)
  }
  check('non-food-grade-chemicals-never-share-food-or-drinking-equipment', sharedKit.length === 0,
    fail(sharedKit, 'a non-food-grade chemical is run in food or drinking equipment with no permanent non-food designation')
      ?? `${nonFoodGradeLessons.length} lesson(s) carry a non-food grade; all run it in disposable or permanently non-food equipment`)

  // --- C. Water-temperature caps are a safe RANGE, not merely a number present ----------------------
  // The H2 check accepted any two-digit number next to "degrees Celsius", so "below 80 degrees
  // Celsius" would have passed. Every stated limit is now read and bounded.
  const SAFE_MAX_C = 50
  const CAP_VALUES = /\b(?:below|under|no more than|at most|not above|does not exceed)\s+(\d{1,3})\s*(?:degrees celsius|°\s*c)\b/gi
  const STOP_VALUES = /\bstop\w*\b[^.\n]{0,90}?\b(?:above|over|exceeds?|at)\s+(\d{1,3})\s*(?:degrees celsius|°\s*c)\b/gi
  const overCap = []
  for (const l of warmLessons) {
    const text = studentPlain.get(l.lesson_id)
    const caps = [...text.matchAll(CAP_VALUES)].map((m) => Number(m[1]))
    const stops = [...text.matchAll(STOP_VALUES)].map((m) => Number(m[1]))
    if (caps.length === 0) overCap.push(`${l.lesson_id}: no bounded cap, only a bare number`)
    for (const v of [...caps, ...stops]) if (v > SAFE_MAX_C) overCap.push(`${l.lesson_id}: permits ${v} C`)
  }
  check('water-temperature-limits-state-a-safe-numeric-range', overCap.length === 0,
    fail(overCap, `a learner-handling temperature limit is missing or exceeds ${SAFE_MAX_C} degrees Celsius`)
      ?? `${warmLessons.length} warm-water lessons bound every learner-handling limit at or below ${SAFE_MAX_C} degrees Celsius`)

  // --- D. Generic open-flame prohibition -----------------------------------------------------------
  // H2 banned only a fuel-fed flame. No lesson may direct the learner to light or operate ANY flame,
  // and the prohibition must be declared non-disableable rather than left implicit.
  const OPEN_FLAME_USE = /\b(light|lights|lighting|lit|ignite|ignites|igniting|strike|strikes)\s+(a|the)\s+(candle|match|flame|burner|lighter|hob|stove|gas)\b|\b(hold|holds|place|places|put|pass)\b[^.\n]{0,40}\b(in|into|over|above)\s+(a|the)\s+(flame|candle|burner|hob)\b|\bflame test\b|\bbunsen\b|\bspirit (burner|lamp)\b/
  const flameHits = affirmativeHits(OPEN_FLAME_USE.source)
  const flamePolicy = policy.safety_privacy.non_disableable_prohibitions.some((r) => /\bopen flame\b/i.test(r) && /\b(light|strike|operate)\b/i.test(r))
  check('no-open-flame-is-lit-or-operated-anywhere', flameHits.length === 0 && flamePolicy,
    flameHits.length ? `MATCHED: ${flameHits.slice(0, 3).join(' | ')}`
      : flamePolicy ? 'no lesson lights or operates a flame, and a generic open-flame prohibition is non-disableable'
        : 'no generic open-flame prohibition is declared non-disableable')

  // --- E. PPE actually reaches the learner and the materials list ----------------------------------
  // The eye-protection trigger is transcribed here independently of the builder, so a builder that
  // stops resolving PPE cannot validate itself.
  const EYE_TRIGGER = /\b(splash|spatter|sting\w* (the )?eyes?|eye protection|snap back|under tension|shatter|burst|spray)\b/i
  const eyeLessons = hazardLessons.filter((l) => l.safety_privacy.hazards.some((h) => h.kind === 'chemical' || EYE_TRIGGER.test(`${h.description} ${h.mitigation}`)))
  const gloveLessons = hazardLessons.filter((l) => l.safety_privacy.hazards.some((h) => /\bgloves?\b/i.test(h.mitigation)))
  const ppeGaps = []
  for (const l of eyeLessons) {
    if (!/EYE PROTECTION IS REQUIRED/i.test(studentPlain.get(l.lesson_id))) ppeGaps.push(`${l.lesson_id}: eye protection never required in student text`)
    if (!l.materials.some((m) => /eye protection/i.test(m) && !/^no eye protection/i.test(m))) ppeGaps.push(`${l.lesson_id}: eye protection absent from materials`)
  }
  for (const l of gloveLessons) {
    if (!l.materials.some((m) => /\bgloves?\b/i.test(m))) ppeGaps.push(`${l.lesson_id}: a mitigation requires gloves but they are not a material`)
    if (!/\bgloves?\b/i.test(studentPlain.get(l.lesson_id))) ppeGaps.push(`${l.lesson_id}: gloves required but never stated to the learner`)
  }
  check('required-ppe-reaches-the-learner-and-the-materials-list', ppeGaps.length === 0,
    fail(ppeGaps, 'PPE named in a mitigation never reaches the learner or the materials list')
      ?? `${eyeLessons.length} eye-protection lessons and ${gloveLessons.length} glove lessons carry their PPE in both places`)

  // --- F. The equal-credit alternative is real ------------------------------------------------------
  const altOf = (l) => (l.extensions ?? []).find((e) => e.namespace === 'manuel.academy/lab-alternative')?.value?.value ?? ''
  const altFaults = []
  for (const l of hazardLessons) {
    const alt = altOf(l)
    const text = studentPlain.get(l.lesson_id)
    if (alt.trim().length < 80) altFaults.push(`${l.lesson_id}: alternative is ${alt.trim().length} chars`)
    if (!text.includes(alt.trim())) altFaults.push(`${l.lesson_id}: alternative never reaches the learner`)
    const at = text.indexOf(alt.trim())
    if (at >= 0 && !/equal credit/i.test(text.slice(Math.max(0, at - 120), at))) altFaults.push(`${l.lesson_id}: alternative is not stated to carry equal credit`)
    // Clause-scoped, so "no battery, no alcohol" reads as the absence of equipment it plainly is.
    if (affirmativeHitsIn(alt, /\b(eye protection|goggles|gloves|thermometer|battery|flame|burner)\b/.source).length) altFaults.push(`${l.lesson_id}: alternative still requires special equipment`)
  }
  check('equal-credit-alternative-is-stated-and-needs-no-special-equipment', altFaults.length === 0,
    fail(altFaults, 'the no-special-equipment alternative is missing, hidden from the learner, unequal, or still needs equipment')
      ?? `${hazardLessons.length} hazard-bearing lessons state a full equal-credit alternative that needs no special equipment`)

  // --- G. Student brief and guardian record agree in BOTH directions --------------------------------
  // H2 checked only that the guardian record reached the learner. A brief that tells the learner
  // something the guardian record does not hold is the same defect facing the other way.
  const SUPERVISION_SENTENCE = {
    none: 'SUPERVISION: you may work on this independently. Tell an adult before you start anyway.',
    'nearby-adult': 'SUPERVISION: an adult must be within earshot and able to reach you. Do not start until they are.',
    'direct-adult': 'SUPERVISION: an adult must be beside you, watching, for the whole investigation. Do not start any step until they are there.',
  }
  const drift = []
  for (const l of hazardLessons) {
    const lines = briefOf(l).split('\n')
    const sp = l.safety_privacy
    const hz = lines.filter((x) => x.startsWith('HAZARD (')).map((x) => x.match(/^HAZARD \(([^)]+)\): ([\s\S]*)$/)?.slice(1) ?? [])
    const mit = lines.filter((x) => x.startsWith('MITIGATION: ')).map((x) => x.slice('MITIGATION: '.length))
    const stops = lines.filter((x) => x.startsWith('  STOP: ')).map((x) => x.slice('  STOP: '.length))
    if (hz.length !== sp.hazards.length) drift.push(`${l.lesson_id}: brief states ${hz.length} hazards, record holds ${sp.hazards.length}`)
    else if (!hz.every(([kind, desc], i) => kind === sp.hazards[i].kind && desc === sp.hazards[i].description)) drift.push(`${l.lesson_id}: a hazard in the brief is not the hazard in the record`)
    if (mit.length !== sp.hazards.length || !mit.every((m, i) => m === sp.hazards[i]?.mitigation)) drift.push(`${l.lesson_id}: a mitigation in the brief is not the mitigation in the record`)
    if (stops.length !== sp.stop_conditions.length || !stops.every((c, i) => c === sp.stop_conditions[i])) drift.push(`${l.lesson_id}: brief states ${stops.length} stop conditions, record holds ${sp.stop_conditions.length}`)
    if (!lines.includes(SUPERVISION_SENTENCE[sp.supervision])) drift.push(`${l.lesson_id}: the brief does not state the supervision level the record declares`)
    if (/an adult must be beside you/.test(briefOf(l)) && sp.guardian_visibility !== 'confirmation-required') drift.push(`${l.lesson_id}: direct supervision is promised to the learner but not confirmed with the guardian`)
  }
  check('student-brief-and-guardian-record-agree-both-ways', drift.length === 0,
    fail(drift, 'the learner brief and the guardian safety record state different hazards, mitigations, stop conditions, or supervision')
      ?? `${hazardLessons.length} hazard-bearing lessons state identical hazards, mitigations, stop conditions, and supervision to learner and guardian`)

  // --- H. Preview vs reinforcement at LESSON level ---------------------------------------------------
  // H2 checked units only. The same extension is projected to the learner on every lesson, so a
  // lesson that mislabels a forward-looking standard mis-teaches 12 times per unit.
  const lessonSemantic = []
  const unitById = new Map(set.units.map((u) => [u.unit_id, u]))
  for (const l of lessons) {
    const idx = unitIndex.get(l.unit_ref)
    const text = roleOf(l)
    if (!text) { lessonSemantic.push(`${l.lesson_id}: no standards-role text`); continue }
    if (text !== roleOf(unitById.get(l.unit_ref) ?? {})) lessonSemantic.push(`${l.lesson_id}: standards role differs from its unit`)
    for (const c of codesIn(text, 'Reinforced')) if (!(firstTaught.get(c) <= idx)) lessonSemantic.push(`${l.lesson_id}: ${c} called reinforcement but first taught at unit ${firstTaught.get(c) ?? '?'} of ${idx}`)
    for (const c of codesIn(text, 'Previewed')) {
      if (firstTaught.get(c) <= idx) lessonSemantic.push(`${l.lesson_id}: ${c} called a preview but already taught at unit ${firstTaught.get(c)}`)
      if (l.standards.some((s) => s.standard_id === c)) lessonSemantic.push(`${l.lesson_id}: ${c} is previewed and assessed in the same lesson`)
    }
  }
  check('lesson-preview-and-reinforcement-semantics-hold', lessonSemantic.length === 0,
    fail(lessonSemantic, 'a lesson labels forward-looking coverage as reinforcement, or drifts from its unit')
      ?? `all ${lessons.length} lessons carry their unit's standards role with preview and reinforcement the right way round`)

  // --- I. A negated clause cannot hide a hazard combination -----------------------------------------
  // Hazard pairs are read from the STRUCTURED materials and typed hazards, entry by entry, so a
  // negation in one entry ("stored away from steel wool") can never cancel a different entry, and
  // a negated sentence elsewhere in the prose can never suppress the pairing.
  const entriesNaming = (l, re) => [...l.materials, ...l.safety_privacy.hazards.map((h) => h.description)]
    .filter((entry) => affirmativeHitsIn(entry, re.source).length > 0)
  const SEPARATION_INSTRUCTION = /\b(away from|never (let it )?touch|kept? apart|different surface|out of the room|never [^.\n]{0,40}together|not [^.\n]{0,30}(in the same room|near)|before any|removed from the room)\b/i
  const PAIRS = [
    ['flammable liquid and an ignition source', FLAMMABLE, IGNITION],
    ['a self-heating metal and an ignition source', /\b(steel wool|iron powder|iron filings)\b/i, IGNITION],
  ]
  const hiddenPairs = []
  let pairsFound = 0
  for (const l of hazardLessons) {
    const sentences = studentPlain.get(l.lesson_id).split(/(?<=[.\n])\s*/)
    for (const [label, a, b] of PAIRS) {
      if (!entriesNaming(l, a).length || !entriesNaming(l, b).length) continue
      pairsFound += 1
      if (l.safety_privacy.supervision !== 'direct-adult') { hiddenPairs.push(`${l.lesson_id}: ${label} without direct adult supervision`); continue }
      if (!sentences.some((sn) => SEPARATION_INSTRUCTION.test(sn) && a.test(sn) && b.test(sn))) hiddenPairs.push(`${l.lesson_id}: ${label}`)
    }
  }
  check('hazard-combinations-are-read-structurally-not-from-negatable-prose', hiddenPairs.length === 0,
    fail(hiddenPairs, 'a hazard pair present in the materials or typed hazards carries no separation rule in student-visible text')
      ?? `${pairsFound} hazard pair(s) found in the structured fields; each carries a separation instruction naming both materials in one sentence`)


  // --- J. The non-disableable prohibitions must reach the learner ------------------------------------
  // They were declared in the policy set and in safety_privacy, both of which the 2.0.0 contract
  // strips from the student projection, so not one of them reached a learner.
  const prohibitions = policy.safety_privacy.non_disableable_prohibitions
  const prohibitionGaps = hazardLessons.filter((l) => {
    const text = studentPlain.get(l.lesson_id)
    return !prohibitions.every((rule) => text.includes(rule))
  })
  check('non-disableable-prohibitions-reach-the-learner', prohibitionGaps.length === 0,
    fail(prohibitionGaps.map((l) => l.lesson_id), 'a non-disableable prohibition never reaches the learner in student-visible text')
      ?? `all ${prohibitions.length} non-disableable prohibitions reach the learner in each of ${hazardLessons.length} hazard-bearing lessons`)

  // --- K. A hazardous item the brief tells the learner to handle must be on the materials list -------
  // Prep happens from the materials list. An item the safe order activates but the list omits is
  // a hazard the family never had notice to obtain, refuse, or supervise.
  const HANDLE_VERB = /\b(bend|bends|activate|activates|squeeze|squeezes|snap|snaps|hold|holds|use|uses|feel|feels|shake|shakes)\b/
  const unlistedHandled = []
  for (const l of hazardLessons) {
    const brief = briefOf(l)
    const listed = l.materials.join(' | ').toLowerCase()
    for (const term of ['cold pack', 'hand warmer', 'glow stick', 'smoke detector', 'smoke alarm']) {
      if (!brief.toLowerCase().includes(term) || listed.includes(term)) continue
      const handled = brief.split(/(?<=[.\n])\s*/).some((sn) => sn.toLowerCase().includes(term) && affirmativeHitsIn(sn, HANDLE_VERB.source).length > 0)
      if (handled) unlistedHandled.push(`${l.lesson_id}: ${term}`)
    }
  }
  check('hazardous-items-the-learner-handles-are-on-the-materials-list', unlistedHandled.length === 0,
    fail(unlistedHandled, 'the safe order tells the learner to handle a sealed commercial product the materials list never names')
      ?? 'every sealed commercial product the learner is told to handle is on the materials list')

  // --- L. The guardian note covers the fields safety_privacy has no room for -------------------------
  // safety_privacy carries hazards, supervision and stop conditions but no safe order and no
  // disposal, so the note that governs guardian sharing has to name them explicitly.
  const noteGaps = hazardLessons.filter((l) => !/safe order/i.test(l.guardian_visibility_note) || !/disposal/i.test(l.guardian_visibility_note)
    || !/\b(ppe|eye protection|protective)\b/i.test(l.guardian_visibility_note))
  check('guardian-note-covers-safe-order-disposal-and-ppe', noteGaps.length === 0,
    fail(noteGaps.map((l) => l.lesson_id), 'the guardian note omits the safe order, the disposal, or the PPE that safety_privacy cannot hold')
      ?? `${hazardLessons.length} hazard-bearing lessons direct the guardian to the safe order, the PPE, and the disposal before the session`)

  return { report, checks }
}
