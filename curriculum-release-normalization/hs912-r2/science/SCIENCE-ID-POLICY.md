# Science Identifier Policy — `ALIAS_NOT_RENAME`

**Lane:** `mac/hs912-release-normalization-r2`
**Resolves:** `SCIENCE_ID_SCHEME_CONFLICT` (`hs912-r1` blocker B1)
**Science status after this lane:** `PENDING_H3_IMPORT`

## The conflict

`release/course-matrix.json` allocates four science slots. The science lane delivered four
courses under repository schema set `2.0.0` with identifiers named after the course rather than
the grade slot.

| Grade | Slot allocated by the matrix | Identifier the lane actually returned |
| --- | --- | --- |
| 9 | `ma-g9-science` | `ma-hs9-biology` |
| 10 | `ma-g10-science` | `ma-hs10-chemistry` |
| 11 | `ma-g11-science` | `ma-hs11-physics` |
| 12 | `ma-g12-science` | `ma-hs12-earth-space-environmental` |

## The policy

**Neither name is rewritten into the other. Both resolve through a registry.**

`release/authoring-boundaries.md` §4 makes identifiers stable once a builder returns a course.
Renaming `ma-hs9-biology` to `ma-g9-science` would break that rule, would diverge from what the
science review lane is reading, and would silently rewrite content this lane does not own.
Renaming in the other direction would put a course id in the release that the matrix never
allocated.

So the conflict is resolved where it actually lives — at the release layer, in
[`../registries/course-id-alias-registry.json`](../registries/course-id-alias-registry.json):

- **`authored_course_id` is authoritative.** It names the content and it is stable.
- **`release_slot_id` is an address.** It names a position in the release that the matrix
  allocated.
- Resolution is bidirectional and **total over all 40 high-school courses**, not just the four
  exceptions. The 36 canonical courses carry `relationship: IDENTITY`. A consumer therefore
  resolves every id the same way and never has to know which courses are special.

## Child identifiers

Unit, lesson and assessment ids resolve by prefix substitution:

```
ma-hs9-biology-u01-l01   <->   ma-g9-science-u01-l01
```

That rule is published only because it is *verified*, not assumed. Every delivered unit, lesson
and assessment identifier in all 40 courses is literally `<course_id>-uNN`,
`<course_id>-uNN-lNN`, or `<course_id>-uNN-assessment` — checked by re-derivation in
`validation/validate-normalization.mjs`, and the check is proved live by the
`falsify a child-id-rule claim` mutant. If a future import breaks the shape, the rule stops
being published rather than quietly producing wrong ids.

## What this policy does not do

- It does not translate the schema-set `2.0.0` lesson record shape. Science delivers
  `accessibility`, `safety_privacy`, `mastery`, `scoring_guidance`, `tutor_routes`; the contract
  shape expects `accessibility_and_accommodations`, `safety_and_privacy`, `mastery_rule`,
  `answer_or_scoring_guidance`, `adaptive_tutor_routes`. Translating records is authoring. It is
  owed at import.
- It does not put science into the canonical per-grade schedules. Science is scheduled
  completely on its own native plane, and the two planes are recorded separately with the gap
  named (`SCIENCE_NOT_IN_CANONICAL_SCHEDULE`).
- It does not classify science standards evidence. Building a release-layer classification for
  content that is about to be re-imported would key the registry to a superseded input. Science
  is the one family whose standards classes are explicitly `null`, and the validator blocks if
  anyone fills them in early.

## H3

Science carries `PENDING_H3_IMPORT`. `mac/hs912-science-h3` is a moving branch and **this lane
does not wait for it and does not pin it**. `MANIFEST.json` records the observed H3 commit as an
observation that will go stale by design — it moved past the `mac/hs912-science-h2` commit the
candidate imported during this session, and the validator reports that movement as an advisory
rather than a defect, because a moving branch moving is not a defect.

What the validator does check, read-only, is that the successor still carries all four stable
course ids. It does, before and after the move.

The durable artifact is the alias registry, not any commit id. It survives the import because it
is keyed on the stable authored identifiers, which are what the H3 lane is contractually not
allowed to change.

At import, three things become owed and none of them is owed now: the record-shape translation,
a unified per-grade schedule, and a science standards-evidence classification.
