# Manuel Academy — High School Science, Grades 9–12

A four-course science progression for Grades 9–12, authored to **Curriculum Authoring Schema Set
2.0.0** and aligned to the **Michigan Science Standards (November 2015)**.

| | |
| --- | --- |
| Courses | 4 (Grades 9, 10, 11, 12) |
| Units | 36 (9 per course) |
| Lesson blueprints | 432 (108 per course) |
| Unit assessments | 36, each with a protected interpretation |
| Schedules | 4 (36 weeks × 3 sessions) |
| Standards coverage | all 71 Michigan high school performance expectations |
| Contract validation | `validateAuthoringSet` — 0 issues |
| Mission validation | 27/27 checks pass |

## The sequence

| Year | Course | Credit role |
| --- | --- | --- |
| 9 | **Biology** | The credit MCL 380.1278b(1)(b) names explicitly |
| 10 | **Chemistry** | Satisfies the chemistry-or-physics credit by name |
| 11 | **Physics** | Third science credit |
| 12 | **Earth, Space, and Environmental Systems** | Encouraged fourth credit; covers the 19 HS-ESS performance expectations a three-year sequence normally drops |

Read [`sequence-design.md`](sequence-design.md) first — it separates what Michigan actually requires
from what is merely conventional, and marks every Manuel Academy decision as a local choice.

## Documents

| File | What it is |
| --- | --- |
| [`sequence-design.md`](sequence-design.md) | Why this sequence; statutory analysis; Grade 8 handoff; rejected options |
| [`standards-alignment.md`](standards-alignment.md) | All 71 performance expectations with MDE statements and owning units (generated) |
| [`lab-safety-framework.md`](lab-safety-framework.md) | Hazard model, prohibitions, supervision levels, alternative paths |
| [`study-integration.md`](study-integration.md) | How these courses meet the Study Engine seam, and what integration work remains |
| [`course-guides/`](course-guides/) | Per-course unit tables, phenomena, investigations, hazards, alternatives (generated) |
| [`validation/validation-report.md`](validation/validation-report.md) | Validation evidence (generated) |

## Authoring set

`authoring-set/` holds the machine-readable entities: `manifest.json`, `policy-set.json`,
`standard-framework.json`, `courses.json`, `units.json`, `assessments.json`,
`assessment-interpretations.json`, `schedules.json`, `resources.json`, and one JSONL of lesson
blueprints per course under `lessons/`.

## Rebuilding and validating

```bash
python3 curriculum-authoring/full-family-highschool-9-12/subjects/science/tools/build_authoring_set.py
python3 curriculum-authoring/full-family-highschool-9-12/subjects/science/tools/build_docs.py
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  curriculum-authoring/full-family-highschool-9-12/subjects/science/validation/validate.mjs
```

The hand-authored source is `tools/course_spec.py`; everything else in `authoring-set/`,
`course-guides/`, `standards-alignment.md`, and the validation report is generated from it.
`tools/standards_data.py` is transcribed standards data and is not edited by hand.

## Scope and status

- **Status:** `draft` in the manifest. This is an authoring package, not a published release.
- **Not wired to the app.** Nothing loads `curriculum-authoring/**` today. The published release at
  `curriculum-content/manuel-academy/1.0.0` is sealed, checksum-manifested, and untouched by this work.
- **No claim of approval or credit.** Michigan alignment here is a voluntary quality choice for a home
  school that the Michigan Merit Curriculum does not legally bind. See `sequence-design.md` §1.2 and §10.
