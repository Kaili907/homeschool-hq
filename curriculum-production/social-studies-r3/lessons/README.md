# R3 production lessons

One authored lesson.

| Lesson | Grade | Unit | Course day | Status |
| --- | --- | --- | --- | --- |
| `grade-03/ma-g3-social-studies-u08-l07.lesson.json` | 3 | 8, day 7 | 91 of 108 | `READY_FOR_GATE` |

Lessons land here as `grade-NN/<lessonRef>.lesson.json` and must satisfy the model
schema, the production envelope schema, and the ordered rhythm rule before the
manifest may count them. See `../PROMOTION.md`.

`SOCIAL_STUDIES_PRODUCTION_R3.manifest.json` records `lessons.authored` and
`lessons.admitted`; the verifier fails if either disagrees with what is actually
on disk.
