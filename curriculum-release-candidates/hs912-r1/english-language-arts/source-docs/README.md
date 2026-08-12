# Manuel Academy — High School English Language Arts, Grades 9-12

Four continuous courses extending the published Grade 8 ELA course into a complete
high-school sequence:

`ma-g8-english-language-arts` (published, untouched)
→ **English 9** → **English 10** → **English 11** → **English 12**

## Why this lane sits outside `curriculum-content/`

`curriculum-content/manuel-academy/1.0.0/` is an immutable published release. Its build
script states the source release "is NEVER edited here," and both `scripts/build-curriculum.mjs`
and `tests/curriculum-content.test.js` pin it to exactly `grades: ['5','7','8']`,
30 courses, 232 units, and 2736 lessons. Adding grades 9-12 to that tree would break the
published release invariants and the production build.

This lane is therefore authoring-stage content held separately. It is written to the same
lesson shape as the published release so that a later release cycle can promote it through
the existing curriculum authoring, validation, approval, staging, and publishing pipeline
without reshaping a single lesson.

**Nothing in this lane modifies the Study Engine, the Family Pilot integration, the app or
router, other high-school subject lanes, the Grade 8 canonical curriculum, or the
Grades 5/7/8 canonical release.**

## Layout

```
standards/
  michigan-ela-9-12-standards.json   84 verbatim standards, both HS bands
  standards-custody.md               how they were obtained, hashed, and what is local
progression/
  grade-8-to-english-9-handoff.md    what Grade 8 leaves; what English 9 picks up
  rigor-progression-9-12.md          why English 12 is not English 10 with harder texts
courses/<slug>/
  course-guide.md                    course description, scope and sequence, policies
  units.json                         10 units, standards alignment, performance tasks
  lessons.jsonl                      180 lesson blueprints, one JSON object per line
  assessments.json                   10 unit assessments with rubrics and mastery rules
  text-bank.json                     catalogued texts with rights and citation metadata
  daily-schedule.csv                 180-day schedule (36 weeks x 5)
  lesson-sequence.md                 human-readable sequence
authoring/                           deterministic generators for the above
validation/
  validate.mjs                       303 mechanical checks
  validation-report.md               latest run
```

## Totals

| | Count |
| --- | --- |
| Courses | 4 |
| Units | 40 (10 per course) |
| Lessons | 720 (180 per course) |
| Unit assessments | 40 |
| Catalogued texts | 49 |
| Standards in corpus | 84 (82 applicable; RL.8 is "not applicable to literature" in both bands) |
| Unit assessment weight | 43 / 48 / 54 / 62 points (Grade 8 baseline: 38) |
| Distinct lesson shapes | 18 per course, one per phase of the unit arc |

## Standards

Verified against the official Michigan Department of Education publication *Michigan K-12
Standards: English Language Arts*, retrieved in-session and hashed
(`sha256:5d340bbe…4863`). No standard was reconstructed from memory. See
`standards/standards-custody.md` for the full retrieval chain, the pages read, and an
explicit statement of what is verbatim versus what is local repository convention.

Michigan publishes high-school ELA as two bands (9-10, 11-12) rather than four grade-level
sets. The distribution of standards 1-9 across the two years of a band is a Manuel Academy
curricular decision and is documented, not implied — the same disclosure the published
release makes about Michigan's grades 6-8 science band.

## Source and copyright boundary

Three rights categories, enforced by the validator:

- **original** — written for Manuel Academy; Academy-held rights; reproducible in full.
- **public_domain** — US public domain (pre-1929 publication or federal government work);
  reproducible in full.
- **rights_required** — named by a standard as an example but still in copyright. The text
  is **never** reproduced here. A public-domain substitute meeting the same standard is
  supplied, and families may substitute the named work if they hold access.

No copyrighted novel, play, article, poem, or lyric is reproduced anywhere in this lane.

Texts are **assigned, not merely catalogued**. Every unit names the 2-3 texts it teaches,
every lesson carries those texts with full citation and an accessible-representation note,
and the validator asserts that every assignable text is taught by at least one unit and
that no `rights_required` work is ever assigned. Standards that name a required *kind* of
text are checked for instantiation rather than trusted — for example `11-12.RL.7`'s
"at least one play by Shakespeare and one play by an American dramatist" is asserted
against English 11 Unit 9 (*Macbeth* + Glaspell's *Trifles*) and English 12 Unit 7
(*Hamlet* + O'Neill's *The Emperor Jones*).

## Student authorship

The learner writes every assessed response. The tutor may explain, question, critique, and
suggest a direction for revision; it may not draft, rewrite, or supply sentences for an
assessed response. Every lesson carries an explicit tutor route that declines a request for
the answer. Supported work is recorded as guided evidence; mastery requires independent
evidence on at least two occasions. Answer and scoring guidance lives only in adult-facing
fields (`answer_or_scoring_guidance`, `adaptive_tutor_routes`, `mastery_interpretation`) —
the same three fields the published release's content boundary already withholds from
student chunks.

Raw student essays are not persisted into Family Pilot metadata. Guardian-visible records
carry target, completion state, evidence type, and next step only.

## Accessibility

Text-first throughout. No voice recording required. No video required. Any presentation may
be delivered privately to the facilitator. Media is optional everywhere and always carries a
readable fallback, captions, transcripts, and alt text. Every assigned text has an accessible
reading representation. Access supports never change the standard being assessed.

## Study Engine compatibility

These courses are authored **for the existing Study Engine**. No session state machine,
checkpoint system, mastery engine, Tutor Core, or Family Pilot progress store is introduced
or duplicated by this lane. Compatibility rests on matching the published release's shapes:

- Lesson objects carry the same required fields as `curriculum-content/.../schemas/lesson.schema.json`.
- Every lesson has at least five `lesson_flow` segments, so segment-level resume works unchanged.
- The same three protected adult-only fields are used, so the existing public-content
  boundary in `scripts/build-curriculum.mjs` withholds exactly the right things.
- 10 units x 18 days x 5 weekdays = the same 36-week family schedule shape as grades 5/7/8.

The one shape difference is deliberate and documented: `lesson.schema.json` pins
`grade` to `[5,7,8]` and `lesson_id` to `^ma-g(5|7|8)-`. That schema belongs to the frozen
release and is **not** edited here. Promoting this lane into a published release will
require widening those two constraints in a release-owned change — this is recorded as a
pilot blocker rather than silently patched.

## Validate

```
node validation/validate.mjs
```

## Regenerate

```
python3 authoring/generate_courses.py
```

Generation is deterministic: the same blueprints, rigor profiles, and text banks produce
byte-identical output.
