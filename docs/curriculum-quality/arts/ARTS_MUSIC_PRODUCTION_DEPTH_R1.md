# Arts + Music Full Production Depth R1

Status: `ARTS_MUSIC_PRODUCTION_DEPTH_R1_READY_FOR_CONVERGENCE`

## Scope

- Approved anchor base: `2a18b6007868f4bf55258ad3fd087c901ed47413`
- Canonical Arts/Music lessons before: 648
- Canonical Arts/Music lessons after: 648
- Canonical Arts/Music lessons rebuilt: 648
- Supported grades: 3, 4, 5, 7, 8, 9, 10, 11, 12
- Lesson count per grade: 72
- Course, unit, lesson, standard, provenance, and assessment identities: preserved

The repair is generator-driven. `src/artsProductionDepth.mjs` owns canonical
lesson-type classification, disciplinary teaching profiles, technique
sequences, work-block composition, learner-owned choices, focus-facing rubrics,
and observable remediation routes. `src/artsLearnerResources.mjs` owns complete
offline references and generated visual models. `generate.mjs` emits packages,
guides, assets, evidence, and Arts/Music checksums deterministically.

## Production depth

All 17 canonical R1 lesson families are present: visual-art concept, technique,
art analysis, art history/context, design, creation/studio, music concept,
rhythm, melody, listening, performance, composition, critique/reflection,
review, remediation, mastery, and project.

The 12 authored Arts phases each retain 54 lessons. Their learner work uses four
different shapes rather than one mechanical template:

| Work blocks | Lessons |
| ---: | ---: |
| 2 | 108 |
| 3 | 270 |
| 4 | 216 |
| 5 | 54 |

Every production contract supplies stable concepts, techniques, prerequisite
refs, defined vocabulary, focus-aware explanation, mechanism, tradeoff,
worked/non-example reasoning, ordered technique steps where instruction is
appropriate, phase-specific learner work, legitimate-variation rules, two
observable technique mismatches, two different teaching/retry routes, and a
closed data-only Tutor-readiness manifest. Probe and protected assessment
phases do not reveal the exact target solution before the attempt.

## Age language and access

Grades 3–5 receive chunked learner steps with a validated maximum of 32 words
per step. Grades 7–8 receive scannable middle-school Arts language with
constraints and choices separated. Grades 9–12 receive discipline-specific
studio, performance, analysis, critique, and portfolio language; they do not
receive elementary `task_steps`.

All 270 source-dependent lessons receive an attached resource. The corpus
contains 108 Academy-original models, 108 Academy-created scaffolds, and 54
Academy-original reference works. It includes 97 generated SVG models plus the
approved anchor SVG (98 required visual models total), each with embedded
image semantics and a verbal/tactile parallel. Music resources contain complete
locally performable notation or event maps. No required resource depends on an
outside search, account, paid tool, instrument, camera, microphone, recording,
or public presentation.

## Scoring and remediation authority

Every scoring guide uses a focus-facing rubric with explicit `OBJECTIVE` and
`JUDGMENT_BASED` criteria. No fixed creative answer is exposed. Difference from
an Academy model is never an error, resemblance earns no extra credit, and the
learner owns intent, interpretive choices, and the final revision decision.

Each lesson registers two observable mismatches and two distinct remediation
paths. Each path supplies different instruction, a supported bounded attempt,
a self-noticing cue, and a new transfer attempt. Style, mood, taste, ambiguity,
and model-different choices are excluded from technique-error authority.

## Verification

- Determinism tree hash before and after a clean second regeneration:
  `958c21055e8fa0b0fb31cb104c42b8a50b28783217227fc5a802f0552d9b8cbc`
- JSON schema: 1,968/1,968 package and guide files passed.
- Corpus validation: 984/984 combined Technology/Arts lesson pairs passed.
- Production quality gate: 984 READY, 0 needs review, 0 not ready.
- Arts production-depth validation: 648/648 lessons; 17 lesson families;
  12 Arts phases; all nine grades; 2/3/4/5-block shapes; passed.
- Duplicate/content spread: 0 exact duplicates; 0 sibling violations; maximum
  sibling similarity 0.5863 below the 0.6 ceiling.
- Learner audit: 648/648; 270/270 required references supplied; projection loss
  0; all five negative controls passed.
- Approved anchor regression: 7/7 passed.
- TypeScript: passed.
- Learner structured projection: 8,292 lessons projected; 25,848 adult fields
  removed; passed.
- Family-pilot-enabled production build: passed.
- Browser answer-authority audit: 322 course payloads, 0 authority-name
  occurrences, 0 findings; passed.
- Arts/Music checksums: 1,296/1,296 package and guide artifacts passed.

No Study Engine, Tutor V2 runtime, app/UI, deployment, admission, or course
scope change was made.

## Classification

`ARTS_MUSIC_PRODUCTION_DEPTH_R1_READY_FOR_CONVERGENCE`
