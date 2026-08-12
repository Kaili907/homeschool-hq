# Validation Contract — Grades 9-12 Health

`tools/validate-course.mjs` implements this contract and `tools/validate-course.test.mjs` proves each gate can fail. Run both:

```bash
node curriculum-authoring/full-family-highschool-9-12/subjects/health/tools/build-courses.mjs
node curriculum-authoring/full-family-highschool-9-12/subjects/health/tools/validate-course.mjs
node --test curriculum-authoring/full-family-highschool-9-12/subjects/health/tools/
```

The validator exits non-zero if any gate fails. It runs against `build/`, which is generated from `tools/course-data.mjs` — so a defect introduced in the authored data is caught on the next build, not only at review time.

## Gates

| Gate | Rule |
| --- | --- |
| `grade-progression` | Grades are exactly 9, 10, 11, 12; each course has 6 units and 36 lessons; no unit title is reused across grades, so no year is a relabelled copy of the year below. |
| `health-privacy-guard` | No required task, topic, materials list, or assessment prompt asks for medical history, a diagnosis, sexual history, symptoms, medication, family income, or immigration status. Every unit carries a `privacy_guard`. Every lesson's `safety_and_privacy` carries the no-diagnosis and no-sexual-history statements. The sex-education module is guardian-activation gated, not scheduled by default, not counted toward course days, and not required for completion or credit. |
| `inclusive-path` | Every unit carries an `inclusive_adaptation`; every lesson carries ≥5 accessibility entries and an adaptive-tutor route for a learner who discloses something private. |
| `no-body-metrics` | No required field mentions BMI, body fat, body composition, body size or measurement, weigh-ins, weight loss/gain/goal/target/change, calories, diets, skinfold, waist, girth, percentiles, or norm tables. |
| `no-media-route` | Every lesson has `media.required === false` and a fallback; no required field demands a photograph, video, film, voice recording, selfie, or webcam. |
| `guardian-safety` | Every unit, lesson, and optional module carries a complete guardian block (equipment, environment, movement hazards, sensitive-content note, confirmation flag). Every unit carrying content required by Michigan law requires guardian confirmation. |
| `standards-mapping` | Every unit and lesson has ≥1 standards entry and ≥1 `standards_mapping` entry; every entry declares a framework and a `mapping_status` of `canonical`, `unverified`, or `human-review`. The run reports the count of each rather than passing silently. |
| `study-compatibility` | Every lesson carries the canonical required fields with `schema_version` `"1.0"`, a lesson id matching `^ma-g(9\|10\|11\|12)-health-u[0-9]{2}-l[0-9]{2}$`, ≥3 learning objectives, ≥5 lesson-flow segments, and ≥2 safety entries; lesson ids are unique; each of the 36 course days resolves to exactly one lesson; every lesson is referenced by exactly one unit and every referenced id exists. |
| `multi-occasion-evidence` | Every lesson's `mastery_rule` and mastery-evidence tutor route require evidence across more than one occasion, and every unit assessment states that one score is not the sole basis for mastery. |
| `distinct-lessons` | No lesson is a relabelled copy of another: two lessons may not share every field a learner acts on while differing only in id, title, phase, or day. |

## The negation heuristic, and its limit

The privacy, body-metric, and media gates scan only **requirement fields** — the title, focus, objectives, success criteria, materials, lesson-flow actions, student activity, formative check, extension, home connection, unit topics, performance task, and assessment prompts. They deliberately do **not** scan `safety_and_privacy` or `accessibility_and_accommodations`, because those fields exist to state prohibitions and would otherwise be flagged for containing the very term they forbid.

Within a scanned field, a sentence that names a prohibited thing **in order to forbid it** ("No calorie counts, weights, or body-size targets are used") is not treated as a violation. This is a keyword-and-negation heuristic. It is good enough to catch a task that actually asks for a body metric, and it is not a substitute for reading the content. **Human review is still required**, and the tests include a case asserting the heuristic does not fire on a prohibition, precisely so that its behaviour is pinned rather than assumed.

### The demand override

Sentence-level negation has a hole: a real instruction can carry a negator in an unrelated clause, so *"Record your weight with no shoes on"* would read as a prohibition and pass. A sentence that instructs the learner to supply, log, or submit something — a demand frame such as `record your`, `log their`, `submit the learner's` — is therefore always reported, whatever else the sentence contains, and the negation suppression does not apply to it. A test pins that exact sentence as a failure.

Bare `weight` is deliberately not a prohibited term: it is a Laban movement quality (*space, time, weight, and flow*) and `bodyweight practice` is ordinary strength terminology. A **learner's** weight is neither, so `your/their/the learner's weight` and `body weight` are matched instead.

## Explicit non-goals

- It does not verify Michigan standard codes against the live state source at validation time — no network access is assumed. It checks that every entry declares a `mapping_status` honestly and reports the split.
- It does not check host integration, routing, catalog, enrolment, or identity — those are the release/convergence lane's scope.
- It does not claim accreditation, state approval, or credit. See [`pacing-and-credit.md`](pacing-and-credit.md).
