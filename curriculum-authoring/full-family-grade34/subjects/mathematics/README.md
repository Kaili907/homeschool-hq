# Manuel Academy - Grade 3 and Grade 4 Mathematics

Complete full-year mathematics curriculum for Grade 3 and Grade 4, authored against
verified Michigan mathematics standards and the Manuel Academy v1.0.0 curriculum
contract.

| | Grade 3 | Grade 4 |
| --- | --- | --- |
| Course ID | `ma-g3-mathematics` | `ma-g4-mathematics` |
| Units | 10 | 10 |
| Daily lessons | 180 | 180 |
| Schedule | 36 weeks x 5 days | 36 weeks x 5 days |
| Session length | 30-45 minutes | 40-55 minutes |
| Content standards covered | 25 of 25 | 28 of 28 |
| Requires the adaptive package | No | No |

## What is here

```
courses/grade-3/mathematics/     course-guide, units, lessons, assessments,
courses/grade-4/mathematics/     practice, projects, 36-week schedule,
                                 mastery evidence, teacher/parent guide,
                                 accessibility and no-media alternatives
standards/                       standards map (JSON + Markdown)
adaptive/                        capability map, adapter contract, Grade 3 fallback
indexes/                         course, unit, and lesson indexes
schemas/                         Grade 3/4 lesson schema profile
authoring/                       authored blueprints, generator, validator
validation/                      validation report (36 checks)
package-manifest.json            package manifest
PILOT_BLOCKERS.md                what is not resolved here
```

## Cadence

180 daily lesson opportunities across 36 weeks at 5 instructional days per week -
the same convention as the v1.0.0 mathematics courses. **No deviation was required
and none was taken.** Each unit is exactly 18 days, so ten units fill the year.

## The instructional arc

Every unit runs the same 18-day arc, and every day is typed by the kind of evidence
it produces:

`instruction` -> `guided-practice` -> `independent-evidence` -> `retrieval` ->
`project` -> `assessment` -> `reassessment`

This is what makes the canonical mastery rule enforceable rather than aspirational.
**One correct response cannot establish mastery.** Each unit supplies four
independent-evidence occasions on four separate days (days 5, 10, 11, 18), plus a
unit assessment on day 16 and a reassessment on day 17 that requires fresh items.
Guided success is recorded as supported and is never weighted as independent
evidence.

## Standards

Codes come from *Michigan K-12 Standards: Mathematics* (Michigan Department of
Education) and are written without cluster letters (`3.OA.1`, not `3.OA.A.1`),
matching the v1.0.0 Grade 5 course. Verified domain ceilings are enforced by the
validator: there is no `3.NBT.4`, no `3.G.3`, no `4.OA.6`, no `4.NBT.7`, and no
`4.G.4`, and none is used. See `standards/standards-map.md`.

The `MP.n` prefix is a Manuel Academy package convention carried over from v1.0.0.
The MDE document numbers the Standards for Mathematical Practice 1-8 under that
heading and does not print the string `MP.1`.

This is locally authored curriculum aligned to published standards. It is not a
claim of state approval, accreditation, licensure, or automatic credit.

## Adaptive Math

The frozen `adaptive-tutor/subjects/math` package (grade band 4-6, four sequences)
is referenced through a capability marker only - never copied, rewritten, or
modified. Seven Grade 4 units declare a genuine alignment; units 8, 9, and 10 do
not, because the frozen package contains nothing matching decimals, measurement
conversion, or angles.

**Grade 3 asserts no alignment at all and depends on nothing.** All 180 Grade 3
lessons resolve every adaptive route to the static lesson and help fallback. See
`adaptive/grade3-static-fallback.md`.

## Accessibility

No camera, no identifiable photograph, and no voice input is required anywhere in
either course. Every lesson has a complete text-only path, every representation is
described in words, every diagram is static and reduced-motion safe, and every task
works on a small touch screen or on paper.

## Privacy

Storing a learner's raw responses is never required. Every lesson declares what may
be persisted (target, evidence type, completion state, adult-observed result, next
step) and what must not (raw answers, free-text reflections, recordings, images,
diagnosis language).

## Regenerating and validating

```
cd authoring
python3 generate.py     # rebuild every artifact from the blueprints
python3 validate.py     # 36 checks; exit 0 on PASS
```

The blueprints in `authoring/` are the authored source of record. Generated files
should not be hand-edited; change the blueprint and regenerate.

## Boundaries

- Owns only `curriculum-authoring/full-family-grade34/subjects/mathematics/**`.
- No release path, no other subject, and no Study Engine source is modified.
- The v1.0.0 package is read as the schema, policy, and convention reference. It is
  not modified, and no Grade 5 content is copied or adapted.
- The frozen adaptive-math package is referenced, never altered.
