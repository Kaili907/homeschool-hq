# Standards Reference and Alignment Notes — Grades 3 and 4 English Language Arts

**Alignment date:** 2026-08-12
**Jurisdictional focus:** Michigan
**Grades:** 3 and 4
**Status:** Locally authored curriculum aligned to published standards. This package is not a claim of state approval, accreditation, licensure, or automatic credit.

## Alignment approach

Grade 3 and Grade 4 English Language Arts use grade-specific Michigan standards codes. Michigan adopted the Common Core English Language Arts standards verbatim as the Michigan Academic Standards, so the content of each code matches the corresponding Common Core standard. The enumeration used here was read from the Michigan-branded publication itself, not inferred from a Common Core copy.

Every code in each grade's catalog maps to at least one lesson, and every code cited by a lesson or unit exists in that grade's catalog. `standards/standards-map.json` is the generated evidence for both directions.

## Code order — read this before comparing against a state document

The Michigan document prints codes as **`<strand>.<grade>.<number>`**, for example `RL.3.1`, `RI.4.3`, `W.5.1a`. Its own explanatory note states that a standard is identified by strand, grade, and number in that order.

This package prints codes as **`<grade>.<strand>.<number>`**, for example `3.RL.1` and `4.RI.3`.

The transposed order is the existing Manuel Academy house convention. It is already in use for Grade 5 in `curriculum-content/manuel-academy/1.0.0`, where every ELA code appears as `5.RL.1`, `5.RI.10`, `5.W.9`, and so on, and the `RL.5.1` form appears nowhere. Grades 3 and 4 follow the house convention so that the whole Manuel Academy corpus indexes consistently.

`3.RL.1` and `RL.3.1` denote the same standard. Anyone verifying this package against a Michigan or Common Core document, or searching for a code online, should transpose the first two segments. Machine consumers should not assume a `^[A-Z]{1,2}\.` prefix pattern.

Sub-lettered codes, where this package uses them, keep the letter attached to the number: `4.W.9a`, not `4.W.a.9`.

## Official source list

| Source | Official URL |
| --- | --- |
| Michigan Academic Standards | https://www.michigan.gov/mde/services/academic-standards |
| Michigan English Language Arts Standards and Resources | https://www.michigan.gov/mde/services/academic-standards/mmc/curriculum/ela |

The full Michigan K-12 ELA standards document was read for this alignment. At the time of verification `michigan.gov` returned HTTP 403 to automated retrieval of its own PDF, so the document text was read from Michigan district-hosted copies of the same MDE publication, and the Grade 3 and Grade 4 enumerations were corroborated across two independent copies. Both URLs are recorded in `standards/michigan-ela-g3.json` and `standards/michigan-ela-g4.json` under `sources`.

## Codes deliberately absent

These codes are not authored anywhere in this package because the official text does not define them. Authoring them would fabricate a standard.

| Code | Reason |
| --- | --- |
| `3.RL.8`, `4.RL.8` | The official text reads "(Not applicable to literature)." |
| `3.W.9` | The official text reads "(Begins in grade 4)." Grade 4 has `4.W.9a` and `4.W.9b`. |
| `3.RF.1`, `3.RF.2`, `4.RF.1`, `4.RF.2` | Print Concepts and Phonological Awareness end after Grade 1. |
| `4.RF.3b` | `RF.4.3` has a single sub-point, `a`. There is no sub-point `b`. |

The existing Grade 5 package sets the precedent for silent omission rather than a placeholder entry: `5.RL.8` and `5.W.9`-style gaps are simply absent there as well.

## Grade 3 to Grade 4 progression

Grade 4 in this package is not Grade 3 with harder texts. The following genuine shifts, confirmed against the standards text, drive the separate Grade 4 unit sequence.

| Shift | Grade 3 | Grade 4 |
| --- | --- | --- |
| Literary meaning | central message, lesson, or moral | **theme**, plus **summarize** — summarizing is new |
| Informational structure | use text features and search tools to **locate** information | describe the **overall structure**: chronology, comparison, cause and effect, problem and solution |
| Reasoning in text | describe logical connections between sentences and paragraphs | explain how an **author uses reasons and evidence** to support points |
| Point of view | reader's own versus the author's | **firsthand versus secondhand** accounts of the same event |
| Complexity band | high end of the grades 2-3 band, independently | **in** the grades 4-5 band, with scaffolding authorized at the high end |
| Opinion writing | reasons that support the opinion | reasons **supported by facts and details**, with related ideas grouped |
| Writing sub-structure | four sub-points in W.2 and W.3 | five, adding precise language, sensory detail, and a conclusion that follows |
| Writing independence | "with guidance and support," task and purpose | produce independently for task, purpose, **and audience** |
| Evidence from texts | no W.9 at this grade | `4.W.9a` and `4.W.9b` — wholly new |
| Grammar | nine sub-points, largely naming and forming | seven, largely deploying and **correcting** fragments and run-ons |
| Word meaning | literal versus nonliteral; shades of meaning | named **figurative language**: similes, metaphors, idioms, adages, proverbs |
| Morphology | a known affix on a known word; beginning dictionaries | **Greek and Latin** affixes and roots; thesauruses and pronunciation |

## Foundational reading weighting

Foundational reading is present at both grades and is not phased out at Grade 4.

`RF.3` and `RF.4` are the only foundational standards at either grade. Grade 3 carries four discrete phonics sub-skills — common prefixes and derivational suffixes, Latin suffixes, multisyllable words, and irregularly spelled words — so Grade 3 gives word work a dedicated daily segment and a full unit. Grade 4 collapses to one integrated expectation: combine letter-sound correspondence, syllabication, and morphology to read unfamiliar multisyllabic words, in and out of context. Grade 4 therefore runs one consolidated morphology thread rather than four re-taught component strands, and the capacity released goes to the new analytic demands.

Fluency is textually identical at both grades. What changes is the complexity of the text, which is governed by the reading-band standards, not by the fluency standard. Fluency weighting is accordingly held roughly constant across the two courses.

## Frozen Manuel Academy baselines

Referenced, not embedded, renamed, rebuilt, or modified by this package.

| Artifact | SHA-256 | Role |
| --- | --- | --- |
| a5-adaptive-english-mvp-v0.2.0-20260216.zip | 474645929e9be3194601c0535d641dab55e8e79b7e10bbf00b3e667908874035 | Adaptive English intervention overlay for the Grade 4-6 band. See `policies/adaptive-english-boundary.md`. |

## What this alignment does not claim

A standards map proves that curriculum was authored against a verified code set and that coverage is complete in both directions. It does not establish state approval, accreditation, licensure, transcript credit, an individual learner's proficiency, or compliance with the requirements of any particular district or authorizer.
