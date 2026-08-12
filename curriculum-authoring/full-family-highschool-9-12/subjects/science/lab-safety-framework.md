# Home Laboratory Safety Framework — High School Science 9–12

This framework governs every investigation in the four courses. It is enforced in data, not only in
prose: each lesson carries a structured `safety_privacy` block, every hazard-bearing lesson also carries
the same information in text the **learner** sees, and `validation/validate.mjs` fails the build if the
invariants below are broken.

**The learner reads the safety brief, not just the guardian.** The 2.0.0 contract deliberately strips
`safety_privacy` from the student projection, so safety that lives only there reaches nobody who is
holding the materials. Every hazard-bearing lesson therefore opens with a student-visible
`safety-review` segment carrying the hazards, their mitigations, the supervision level, the required
PPE, the safe order, every stop condition, the disposal steps, and the equal-credit alternative in full.
`safety_privacy` remains the guardian record. `validate.mjs` compares the two and fails if any hazard,
mitigation, or stop condition in the guardian record is missing from what the learner sees.

## 1. Non-disableable prohibitions

These are declared once in `authoring-set/policy-set.json` and apply to every lesson. No unit, lesson,
tutor route, or extension can weaken them.

1. Never mix household cleaning products; bleach combined with ammonia or acid releases toxic gas.
2. Never connect any investigation to mains electricity; low-voltage cells only.
3. Never fully seal a reacting, fermenting, oxidising, or warm mixture in any container.
4. Never have a flammable liquid open in the same room as a flame, hob, pilot light, heater, lamp, charger, or battery.
5. Never use alcohol, or any other fuel, for a flame demonstration; no open-flame demonstration is used anywhere in this package.
6. Never cut, tear, puncture, or open a sealed commercial product — cold pack, hand warmer, glow stick, or smoke detector.
7. Never look at the sun directly or through any lens, filter, grating, or camera.
8. Never require a photograph, video, or voice recording as evidence of completion.
9. Never request or record a learner body measurement, health measurement, or medical history.
10. Never present invented measurements as real experimental results.

## 2. What is excluded from the whole package

No investigation in any of the four courses uses:

- a fume hood, or any procedure that would need one;
- concentrated strong acids or bases (only household vinegar, baking soda, and cabbage indicator);
- compressed gas cylinders;
- **open flame of any kind.** There is no flame test and no flame demonstration in any of the four
  courses. Chemistry Unit 2 identifies elements from published emission spectra and from a card-tube
  spectroscope pointed at an ordinary household lamp, which meets HS-PS1-1 without a flame, a fuel, or
  a heated metal salt;
- lasers of any kind — the wave optics unit uses a flashlight, an LED, and a CD grating;
- mains electricity — every electrical investigation uses a single 1.5 V or 9 V cell;
- radioactive sources — half-life is modelled with coins or dice;
- any chemical requiring institutional disposal;
- required dissection.

## 3. Hazard model

Every lesson declares typed hazards. The kinds available in the 2.0.0 contract are `physical`,
`chemical`, `online`, `financial`, `privacy`, and `emotional`. Each hazard carries a description and a
mitigation, so a guardian reads the risk and the control together.

| Supervision level | Meaning | When it is used |
| --- | --- | --- |
| `none` | Learner may work independently | Desk-based work; paper models; data analysis |
| `nearby-adult` | An adult is in earshot and can intervene | Mechanical work, outdoor work, soil, mild materials |
| `direct-adult` | An adult is present and actively supervising | Every chemical hazard; heat; electrical circuits; strong magnets |

| Guardian visibility | Meaning |
| --- | --- |
| `summary` | Target, completion, evidence type, next step |
| `confirmation-required` | Guardian must confirm the safety review before the session runs |
| `direct-observation` | Guardian observes the activity itself |

**Enforced invariant.** Any lesson declaring a `chemical` hazard must declare `direct-adult` supervision
*and* `confirmation-required` guardian visibility. `validate.mjs` checks this on all 432 lessons; it
holds for all 20 lessons that carry a chemical hazard.

**Day 9 is not a desk day.** Day 7 runs the investigation and Day 9 rebuilds the performance task with
the same materials, so Day 9 inherits the investigation's full hazard set, supervision level, guardian
visibility, stop conditions, and safety brief wherever the investigation declares a `physical` or
`chemical` hazard. That is 70 hazard-bearing lessons — 36 investigation days and 34 performance-task
days — and `validate.mjs` checks this on all 70 hazard-bearing lessons. The remaining lessons declare
the desk baseline, and the validator fails the build if a desk-baseline lesson lists a hands-on material.

## 4. Guardian-visible before, not after

Investigation lessons carry a `guardian_visibility_note` instructing the host to surface the hazard
list, the supervision level, and the stop conditions **before** the session, so the guardian can review
and choose the alternative path if they prefer. Hazards are never disclosed only in retrospect.

## 5. Stop conditions and first response

Every lesson in the package carries the global stop conditions, and they name the first action rather
than only "tell an adult":

- Stop for any injury, burn, spill, fume, or allergic reaction and tell the supervising adult.
- Stop if a material, tool, or step is not the one this lesson specifies.
- **Burn:** cool it under running cool water for 20 minutes. Not ice, not butter, not ointment.
- **Splash in an eye:** rinse with running water for 15 minutes, holding the eyelid open, before anything else.
- **Fumes:** leave the room, open a window from outside the room, and do not go back in to tidy up.
- **Fire:** *do not use water.* Get everyone out, close the door, and call the emergency number. Smother a
  very small contained flame with a metal pan lid or a fire blanket only if that is safe without reaching
  over it. Water spreads a burning liquid and conducts, so it is never the instruction anywhere in this
  package, and `validate.mjs` fails the build if it reappears.
- **Suspected swallowing** of a magnet, a battery, or any lesson material: treat it as an emergency and
  seek medical help at once, without waiting for symptoms.
- A pause, break, or switch to the alternative activity is never treated as failure.

Investigation lessons add their own specific conditions on top — for example, stopping if a bag becomes
firm, if a battery lead warms, if bubbles appear at an electrode, if the thermometer reads above 50 °C,
or if anyone looks toward the sun through an optical device. Temperature is judged with a thermometer
and never by touching the water; the validator fails the build if a hand test reappears.

## 5a. Safe order, incompatible materials, and disposal

Three defect classes are checked structurally rather than by wording:

- **Safe order.** Every investigation declares an ordered `sequence` the learner reads before touching
  anything. Where two hazards must not meet, the ordering, the timed gap, the change of surface, and the
  disposal of the *poured samples* are procedure steps, not notes in a mitigation field.
- **Incompatible materials.** Where a flammable liquid and an ignition source appear in one
  investigation — Chemistry Unit 3 is the only case — the separation is enforced at sample level.
  Stage A ends when every poured alcohol sample has gone down the drain, the cups are washed and dried,
  and the room has been ventilated for ten minutes; only then may a battery enter the room, and Stage B
  runs on a different surface with water-based samples only. The validator fails the build if a
  flammable liquid and an ignition source are co-listed without ordering, a timed gap, a change of
  surface, and sample-level disposal.
- **Disposal.** Every investigation declares a `disposal` step, and it reaches the learner. Nothing
  reactive, oxidising, warm, or gas-producing is ever sealed away: Chemistry Unit 4's steel wool cools
  and dries in an open dish overnight before it is rinsed and binned wet, loose, and cold. Chemistry
  Unit 4 also names hydrogen explicitly, because vinegar on steel wool generates it, and the validator
  fails the build if an acid-and-metal reaction runs without naming the gas.

## 6. The alternative path is first-class

Every one of the 36 investigations has a documented no-special-equipment alternative that meets the same
learning target. Alternatives are typically:

- analysis of a **published** dataset the family retrieves;
- a paper, clay, or coin-and-dice physical model;
- a kitchen-materials version with the hazardous element removed.

In Earth/Space Unit 2 the alternative is the **default** path and the outdoor version is explicitly
optional (outdoor solar measurement → published solar constant and stellar spectra).

Choosing the alternative is never recorded as a lesser outcome. Mastery evidence requirements are
identical on both paths.

## 7. Media, privacy, and body data

- **No camera or video proof.** Nothing requires a photograph, a video, or a voice recording.
- **Minimal persistence.** Lessons declare that stored metadata is limited to target, completion state,
  evidence type, and next step. No raw reflections, no free-text answers, no media.
- **No location disclosure.** Outdoor and field-adjacent work records habitat type, slope, or general
  conditions only — never an address, GPS coordinate, or identifiable landmark.
- **No body or health measurement.** This deserves specific mention because HS-LS1-3 (feedback
  mechanisms maintain homeostasis) invites it. Biology Unit 4 teaches homeostasis with plant systems,
  thermal models, and published **non-human** datasets. No pulse, blood pressure, body temperature,
  weight, height, BMI, breathing rate, or reaction-time measurement of the learner is requested anywhere
  in the package, and `validate.mjs` scans for it.
- **No family genetic or medical history.** Biology Unit 7 (inheritance) uses non-human specimens and
  fictional pedigrees, so no relative's genetic or health information is ever recorded.

## 8. Emotional safety

8 units are flagged with `emotional` hazards and paired with an explicit off-ramp: health and body
topics (Biology U4), heredity, disability, adoption and family history (Biology U8), extinction and
habitat loss (Biology U9), nuclear content (Chemistry U9), cosmological scale and deep time
(Earth/Space U3), climate change (Earth/Space U7), natural hazards (Earth/Space U8), and sustainability
and contested politics (Earth/Space U9). In each case the learner may pause, change case study, or move
to a paired response-and-design strand without penalty.

## 9. No fabricated experimental results

Every investigation declares a `manuel.academy/data-provenance` extension naming exactly where its
numbers come from. Two rules follow:

1. **No expected value is supplied before measurement.** Lessons never tell the learner what they
   "should" get.
2. **Published data is labelled as published.** Where a lesson uses real data the learner did not
   collect, it names the source and the family retrieves it.

The assessment scoring guidance makes this gradeable: performance-evidence prompts award **no credit**
for a quantity the learner did not measure, compute, or cite to a named source.
