# Home Laboratory Safety Framework — High School Science 9–12

This framework governs every investigation in the four courses. It is enforced in data, not only in
prose: each lesson carries a structured `safety_privacy` block, and `validation/validate.mjs` fails the
build if the invariants below are broken.

## 1. Non-disableable prohibitions

These are declared once in `authoring-set/policy-set.json` and apply to every lesson. No unit, lesson,
tutor route, or extension can weaken them.

1. Never mix household cleaning products; bleach combined with ammonia or acid releases toxic gas.
2. Never connect any investigation to mains electricity; low-voltage cells only.
3. Never look at the sun directly or through any lens, filter, grating, or camera.
4. Never require a photograph, video, or voice recording as evidence of completion.
5. Never request or record a learner body measurement, health measurement, or medical history.
6. Never present invented measurements as real experimental results.

## 2. What is excluded from the whole package

No investigation in any of the four courses uses:

- a fume hood, or any procedure that would need one;
- concentrated strong acids or bases (only household vinegar, baking soda, and cabbage indicator);
- compressed gas cylinders;
- open-flame glassware heating (the single optional flame activity is adult-performed, outdoors, with
  pinches of ordinary salt, and the default path for that unit uses published data instead);
- mercury thermometers;
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
currently holds for all 11 lessons that carry a chemical hazard.

## 4. Guardian-visible before, not after

Investigation lessons carry a `guardian_visibility_note` instructing the host to surface the hazard
list, the supervision level, and the stop conditions **before** the session, so the guardian can review
and choose the alternative path if they prefer. Hazards are never disclosed only in retrospect.

## 5. Stop conditions

Three stop conditions apply to every lesson in the package:

- Stop for any injury, burn, spill, fume, or allergic reaction and tell the supervising adult.
- Stop if a material, tool, or step is not the one this lesson specifies.
- A pause, break, or switch to the alternative activity is never treated as failure.

Investigation lessons add their own specific conditions on top — for example, stopping if a sealed bag
becomes taut, if a battery lead warms, if water exceeds 50 °C, or if anyone looks toward the sun through
an optical device.

## 6. The alternative path is first-class

Every one of the 36 investigations has a documented no-special-equipment alternative that meets the same
learning target. Alternatives are typically:

- analysis of a **published** dataset the family retrieves;
- a paper, clay, or coin-and-dice physical model;
- a kitchen-materials version with the hazardous element removed.

In two units the alternative is the **default** path and the hands-on version is explicitly optional:
Chemistry Unit 2 (flame colours → published spectra and periodic-trend data) and Earth/Space Unit 2
(outdoor solar measurement → published solar constant and stellar spectra).

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

Four topics are flagged with `emotional` hazards and paired with an explicit off-ramp: extinction and
habitat loss (Biology U9), nuclear content (Chemistry U9), climate change (Earth/Space U7), and natural
hazards (Earth/Space U8). In each case the learner may pause, change case study, or move to a
paired response-and-design strand without penalty.

## 9. No fabricated experimental results

Every investigation declares a `manuel.academy/data-provenance` extension naming exactly where its
numbers come from. Two rules follow:

1. **No expected value is supplied before measurement.** Lessons never tell the learner what they
   "should" get.
2. **Published data is labelled as published.** Where a lesson uses real data the learner did not
   collect, it names the source and the family retrieves it.

The assessment scoring guidance makes this gradeable: performance-evidence prompts award **no credit**
for a quantity the learner did not measure, compute, or cite to a named source.
