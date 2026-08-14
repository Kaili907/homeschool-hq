# Validation Contract — Grades 9-12 Physical Education

`tools/validate-course.mjs` implements this contract and `tools/validate-course.test.mjs` proves each gate can fail. Run all three:

```bash
node curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/build-courses.mjs
node curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/validate-course.mjs
node --test curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/
```

The validator exits non-zero if any gate fails. It runs against `build/`, which is generated from `tools/course-data.mjs` — so a defect introduced in the authored data is caught on the next build, not only at review time.

## Gates

| Gate | Rule |
| --- | --- |
| `grade-progression` | Grades are exactly 9, 10, 11, 12; each course has 9 units and 108 lessons; grades 9-10 are Michigan PE **LEVEL 1** and grades 11-12 are **LEVEL 2**, on the course and on every lesson; no unit title is reused across grades, so no year is a relabelled copy of the year below. |
| `privacy-guard` | No required task, topic, materials list, or assessment prompt collects medical history, a diagnosis, household or family income, precise location, live tracking, wearable data, heart-rate exports, step counts, or sleep logs. Every lesson's guardian-visibility statement excludes body data. Study records learning and completion metadata, not surveillance. |
| `pe-inclusive-path` | Every unit carries an `inclusive_adaptation` and an `inclusion_guard`; every lesson carries an `inclusive_adaptation`, ≥5 accessibility entries, an explicit **seated** route, an explicit **solo** route, an adaptive-tutor route for a learner who **declines** a task, and a **stop-rule** route for pain, dizziness, breathlessness, or head impact. Every assessment states that an adapted performance is **full credit**. |
| `no-body-metrics` | No required field mentions BMI, body fat, body composition, body size or measurement, weigh-ins, weight loss/gain/goal/target/change, calories, diets, skinfold, waist, girth, percentiles, norm tables, fitness tests, or body scans. Every lesson's scoring guidance excludes body size, and every assessment's mastery rule forbids adjusting a score for body size. |
| `no-media-route` | Every lesson has `media.required === false` and a fallback; no required field demands a photograph, video, film, voice recording, selfie, or webcam. **No camera proof of performance anywhere.** |
| `no-public-performance` | No required field demands an audience, spectators, performing in front of a class or group, public performance, or competing against another person. |
| `guardian-safety` | Every unit and lesson carries a complete guardian block (equipment, environment, movement hazards, supervision note, confirmation flag). **Every unit that declares any movement hazard beyond "none" requires guardian confirmation** — this gate caught two dance units during authoring that declared turning, level changes, and travel but had the confirmation flag off. |
| `standards-mapping` | Every unit and lesson has ≥1 standards entry and ≥1 `standards_mapping` entry; every entry declares a framework, a Michigan PE **LEVEL**, and a `mapping_status` of `canonical`, `unverified`, or `human-review`. The run reports the count of each rather than passing silently. |
| `study-compatibility` | Every lesson carries the canonical required fields with `schema_version` `"1.0"`, a lesson id matching `^ma-g(9\|10\|11\|12)-physical-education-u[0-9]{2}-l[0-9]{2}$`, ≥3 learning objectives, ≥5 lesson-flow segments, and ≥2 safety entries; lesson ids are unique; each of the 108 course days resolves to exactly one lesson; every lesson is referenced by exactly one unit and every referenced id exists. |
| `multi-occasion-evidence` | Every lesson's `mastery_rule` and mastery-evidence tutor route require evidence across more than one occasion or setting, and every unit assessment states that one score is not the sole basis for mastery. |
| `transfer-evidence-authority` | All 216 second-pass lessons carry a valid `manuel-academy.pe-transfer-authority.v2` record for learner action, duration/continuity, rest authority, transfer, completion/evidence, equal credit, rubric, and adaptive/guardian expectations. The 96 R1-repaired lessons retain their authored unit-evidence marker. This gate performs no phrase matching. |
| `distinct-lessons` | No lesson is a relabelled copy of another. A 12-day unit runs its six topics over two passes; the second pass must carry the unit's transfer condition and its own objectives, activity, and check, so days 7-12 are a separate mastery occasion rather than a regenerated copy of days 1-6. |

## The negation heuristic, and its limit

The privacy, body-metric, media, and public-performance gates scan only **requirement fields** — the title, focus, objectives, success criteria, materials, lesson-flow actions, student activity, formative check, extension, home connection, unit topics, performance task, and assessment prompts. They deliberately do **not** scan `safety_and_privacy` or `accessibility_and_accommodations`, because those fields exist to state prohibitions and would otherwise be flagged for containing the very term they forbid.

Within a scanned field, a sentence that names a prohibited thing **in order to forbid it or to make it optional** is not treated as a violation. Two deliberate exclusions are worth naming because they look like false negatives and are not:

- **`bodyweight`** as one word is an exercise modality, not a measurement, and is not flagged.
- A bare **`weight`** appears legitimately as a Laban movement quality ("space, time, weight, and flow"), so only measurement and scoring phrasings — `weight loss`, `weight goal`, `weigh-in` — are flagged.

Both are pinned by tests, so the exclusions are asserted rather than assumed. This remains a keyword-and-negation heuristic: it catches a task that actually asks for a body metric or camera proof, and it is **not a substitute for reading the content**. Human review is still required.

### The demand override

Sentence-level negation has a hole: a real instruction can carry a negator in an unrelated clause, so *"Record your weight with no shoes on"* would read as a prohibition and pass. A sentence that instructs the learner to supply, log, or submit something — a demand frame such as `record your`, `log their`, `submit the learner's` — is therefore always reported, whatever else the sentence contains, and the negation suppression does not apply to it. A test pins that exact sentence as a failure.

Bare `weight` is deliberately not a prohibited term: it is a Laban movement quality (*space, time, weight, and flow*) and `bodyweight practice` is ordinary strength terminology. A **learner's** weight is neither, so `your/their/the learner's weight` and `body weight` are matched instead.

## Explicit non-goals

- It does not verify Michigan PE outcome codes against the live state source at validation time — no network access is assumed, and per-outcome codes were never legible. It checks that every entry declares a `mapping_status` honestly and reports the split. See [`standards-reference.md`](standards-reference.md).
- It does not check host integration, routing, catalog, enrolment, or identity — those are the release/convergence lane's scope.
- It does not claim accreditation, state approval, or credit. See [`pacing-and-credit.md`](pacing-and-credit.md).
