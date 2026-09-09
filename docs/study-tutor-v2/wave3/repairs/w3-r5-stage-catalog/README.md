# W3-R5 approved learner-stage catalog

Session: `STUDY-TUTOR-V2-W3-R5`

## Outcome

W3-R5 supplies the committed Study-approved foundation that W3-11 deliberately
did not own. Commercial mode now constructs its learner-stage policy registry
from four canonical profiles and one reviewed static fallback. There is no
commercial API parameter for caller-installed profiles or fallback content.

The catalog identity is
`study-tutor-v2.learner-stage-catalog.v1`; every profile pins policy revision
`policy-revision:study-learner-stage-foundation-v1` and Study approval
`approval:study-learner-stage-foundation-v1`.

## Approved profiles

All limits are inclusive. The adult-review threshold uses W3-11's
`either-limit` semantics: reaching either unresolved-attempt or consecutive
unresolved-turn limit requires routing back to Study. It never grants Tutor or
the provider permission to contact an adult.

| Learner stage ref | Profile ref | Response words | Steps | Hint depth | Density | Visual complexity | Break policy (first / cooldown / max) | Modalities (max) | Adult review (attempts / turns) |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| `learner-stage:early-elementary` | `stage-profile:early-elementary-v1` | 60 | 2 | `nudge` | `sparse` | `single-focus` | 4 / 3 / 1 | text, image (2) | 3 / 5 |
| `learner-stage:upper-elementary` | `stage-profile:upper-elementary-v1` | 90 | 3 | `concept-cue` | `moderate` | `linked-elements` | 4 / 3 / 2 | text, image, diagram, audio (3) | 4 / 6 |
| `learner-stage:middle-grades` | `stage-profile:middle-grades-v1` | 120 | 4 | `concept-cue` | `moderate` | `linked-elements` | 3 / 2 / 2 | text, image, diagram, audio (3) | 5 / 8 |
| `learner-stage:secondary` | `stage-profile:secondary-v1` | 240 | 8 | `guided-step` | `dense` | `multi-part` | 2 / 1 / 3 | text, image, diagram, audio, video (5) | 8 / 12 |

## Reviewed W3-01 routing mapping

The mapping is explicit data, complete for the canonical catalog, and uses the
exact broad routing-stage literals supported by W3-01.

| Trusted learner stage ref | W3-01 routing stage class |
| --- | --- |
| `learner-stage:early-elementary` | `EARLY_ELEMENTARY` |
| `learner-stage:upper-elementary` | `UPPER_ELEMENTARY` |
| `learner-stage:middle-grades` | `MIDDLE_GRADES` |
| `learner-stage:secondary` | `SECONDARY` |

This mapping does not derive learner stage. Study supplies the trusted
`learnerStageRef`; the catalog only verifies that the reference is approved and
returns its reviewed broad routing class.

## Authority separation

The catalog binding contains only its fixed contract identity, trusted Study
source, catalog version, policy revision, and learner-stage reference. It has no
field for:

- nominal grade;
- official working level;
- curriculum grade;
- learner prose, voice, image, or behavior; or
- provider-selected profile, bounds, revision, or routing class.

Exact validation rejects any such field. A grade or working-level change is not
a learner-stage change, and a learner-stage selection changes neither grade,
working level, nor curriculum placement.

## Closed failure behavior

Malformed bindings, unknown stages, catalog-version mismatch, and policy-
revision mismatch return only the reviewed static fallback descriptor. Every
such result fixes `adaptiveTutorAllowed`, `providerInvocationAllowed`, and
`tutorMayProceed` to `false`. No nearest-stage selection, provider default, or
unapproved caller profile is consulted.
