# Validation Report — manuel-academy-highschool-9-12-science

**Schema set:** 2.0.0  
**Overall:** **PASS**  
**Contract issues from `validateAuthoringSet`:** 0  
**Mission checks:** 63/63 passed

The contract check runs the repository's own validator,
`src/curriculum-authoring/v2/validation.ts`, against this authoring set. The mission checks below
cover requirements that validator does not know about: standards coverage, laboratory safety,
alternative paths, media independence, and data provenance.

| Check | Result | Detail |
| --- | --- | --- |
| schema-contract-valid | PASS | 0 issues from validateAuthoringSet |
| framework-has-71-performance-expectations | PASS | 71 standards |
| every-performance-expectation-covered | PASS | all 71 covered by a unit |
| four-courses-grades-9-12 | PASS | 9:ma-hs9-biology 10:ma-hs10-chemistry 11:ma-hs11-physics 12:ma-hs12-earth-space-environmental |
| each-course-108-sessions | PASS | ma-hs9-biology=108 ma-hs10-chemistry=108 ma-hs11-physics=108 ma-hs12-earth-space-environmental=108 |
| every-unit-has-an-investigation | PASS | 36 investigation lessons / 36 units |
| investigations-declare-hazards | PASS | all investigation lessons declare at least one typed hazard |
| investigations-declare-supervision | PASS | all investigation lessons declare a supervision level |
| chemical-hazards-require-direct-adult-supervision | PASS | 10 lessons carry a chemical hazard; 10 require direct adult supervision |
| every-lesson-states-an-alternative-path | PASS | lab-alternative extension present on every lesson |
| every-unit-states-an-alternative-path | PASS | lab-alternative extension present on every unit |
| multi-occasion-mastery-everywhere | PASS | every lesson requires >=2 occasions on >=2 dates with independent evidence and novel-context transfer |
| text-fallback-required-everywhere | PASS | all lessons |
| no-required-media-resources | PASS | every resource is optional and has a text fallback |
| all-resources-have-text-fallback | PASS | 10 resources |
| no-required-photo-or-video-proof | PASS | no affirmative match |
| no-mains-electricity-use | PASS | no affirmative match |
| no-laser-instruction | PASS | no affirmative match |
| no-learner-body-or-health-measurement | PASS | no match |
| tutor-authority-pinned | PASS | policy set pins all three tutor authority invariants to false |
| tutor-routes-use-controlled-signals-only | PASS | all routes |
| student-projection-carries-no-protected-fields | PASS | all 432 lessons project cleanly |
| all-refs-are-study-seam-safe | PASS | 472 identifiers |
| all-refs-unique | PASS | 472 unique of 472 |
| schedule-covers-every-lesson-once | PASS | scheduled=432 lessons=432 |
| assessments-aligned-to-unit-standards | PASS | 36 assessments |
| assessment-bands-ordered | PASS | not-yet < developing < secure for all interpretations |
| investigations-expose-student-visible-safety | PASS | 70 hazard-bearing lessons carry the full safety brief in student-visible text |
| desk-baseline-lessons-really-are-desk-based | PASS | no lesson understates its hazards |
| incompatible-hazards-require-operational-separation | PASS | 2 lesson(s) co-list a flammable liquid and an ignition source; all state operational separation in time and space |
| flammable-separation-covers-poured-samples-not-just-the-bottle | PASS | sample-level separation stated wherever the combination occurs |
| no-alcohol-or-fuel-fed-flame-demonstration | PASS | no fuel-fed flame demonstration anywhere in the package |
| no-water-as-the-fire-response | PASS | fire response never instructs water |
| every-hazard-bearing-lesson-declares-disposal | PASS | 70 lessons declare disposal |
| hazardous-disposal-is-open-cooled-and-never-sealed | PASS | no disposal instruction seals a reactive or warm material |
| hydrogen-generation-is-named-where-it-occurs | PASS | 2 lesson(s) run an acid-and-metal reaction; all name hydrogen and its flammability |
| sealed-commercial-products-are-never-opened | PASS | 100 lessons mention a sealed commercial product; all forbid opening it |
| strong-magnets-declare-the-ingestion-hazard | PASS | 2 magnet lessons state the ingestion hazard |
| soil-and-mould-work-never-shares-food-equipment | PASS | 6 contaminating-material lessons keep equipment out of food use |
| no-food-equipment-used-for-soil-or-mould-work | PASS | 6 contaminating-material lessons list no food equipment |
| warm-water-steps-carry-a-numeric-temperature-cap | PASS | 16 warm-water lessons state a numeric cap |
| temperature-is-never-judged-by-hand | PASS | temperature is judged with a thermometer everywhere |
| standards-group-labels-match-the-canonical-framework | PASS | all 71 topic labels match the canonical arrangement |
| every-science-performance-expectation-has-exactly-one-primary-owner | PASS | all 67 science performance expectations have exactly one owning unit; HS-ETS1-* is distributed across the four capstones by design |
| assessment-standards-are-taught-in-or-before-their-unit | PASS | 36 assessments carry only standards already taught |
| foundation-units-claim-no-performance-expectation | PASS | 4 foundation unit(s) declare no performance expectation instead of borrowing one |
| preview-and-reinforcement-semantics-hold | PASS | every reinforced standard was taught earlier and every previewed standard is taught later |
| safety-documentation-agrees-with-the-authored-hazards | PASS | chemical-hazard lessons=20 emotional-hazard units=8 investigations with an alternative=36 hazard-bearing lessons=70 non-disableable prohibitions=11 |
| unbriefed-hazard-text-carries-a-student-visible-rule | PASS | every hazard-bearing material named outside a safety brief carries its own prohibition and deferral |
| non-food-grade-chemicals-never-share-food-or-drinking-equipment | PASS | 2 lesson(s) carry a non-food grade; all run it in disposable or permanently non-food equipment |
| water-temperature-limits-state-a-safe-numeric-range | PASS | 16 warm-water lessons bound every learner-handling limit at or below 50 degrees Celsius |
| no-open-flame-is-lit-or-operated-anywhere | PASS | no lesson lights or operates a flame, and a generic open-flame prohibition is non-disableable |
| required-ppe-reaches-the-learner-and-the-materials-list | PASS | 24 eye-protection lessons and 12 glove lessons carry their PPE in both places |
| equal-credit-alternative-is-stated-and-needs-no-special-equipment | PASS | 70 hazard-bearing lessons state a full equal-credit alternative that needs no special equipment |
| student-brief-and-guardian-record-agree-both-ways | PASS | 70 hazard-bearing lessons state identical hazards, mitigations, stop conditions, and supervision to learner and guardian |
| lesson-preview-and-reinforcement-semantics-hold | PASS | all 432 lessons carry their unit's standards role with preview and reinforcement the right way round |
| hazard-combinations-are-read-structurally-not-from-negatable-prose | PASS | 2 hazard pair(s) found in the structured fields; each carries a separation instruction naming both materials in one sentence |
| non-disableable-prohibitions-reach-the-learner | PASS | all 11 non-disableable prohibitions reach the learner in each of 70 hazard-bearing lessons |
| hazardous-items-the-learner-handles-are-on-the-materials-list | PASS | every sealed commercial product the learner is told to handle is on the materials list |
| guardian-note-covers-safe-order-disposal-and-ppe | PASS | 70 hazard-bearing lessons direct the guardian to the safe order, the PPE, and the disposal before the session |
| handled-equipment-is-declared-on-the-materials-list | PASS | 70 hazard-bearing lessons declare every item their mitigations, safe order, and disposal activate |
| a-reserved-vessel-is-never-named-ambiguously-in-the-safe-order | PASS | 2 reserved vessel(s) found in the materials; every naming of one carries its reservation |
| equal-credit-alternative-states-no-expected-result | PASS | 70 hazard-bearing lessons state an alternative that pre-states no observation or result |

## What a PASS does and does not mean

A PASS verifies structural conformance to the 2.0.0 authoring contract, complete and non-duplicated
coverage of all 71 Michigan high school performance expectations, a declared investigation with typed
hazards and an alternative path in every unit, multi-occasion mastery on every lesson, clean student
projections, unique and stable identifiers, and full schedule coverage.

It does **not** claim state approval, accreditation, transcript credit, production host integration,
third-party content licensing, or that any individual learner has demonstrated proficiency.

