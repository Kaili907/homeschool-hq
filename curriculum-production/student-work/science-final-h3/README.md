# Science — final student work packages (High School H3)

Student-ready work packages for every supported Science grade: **972 lessons across 9 courses**,
grades 3, 4, 5, 7, 8 and High School Biology, Chemistry, Physics, and Earth/Space/Environmental
Science.

Each lesson gets three artefacts:

| Path | Audience | What it is |
| --- | --- | --- |
| `packages/<course>/student-sheets/<lesson>.md` | learner | Safety brief, blank data sheet, both alternative paths, analysis questions, rubric, reteach prompts, extension |
| `packages/<course>/scoring/<lesson>.md` | supervising adult | Scoring authority, the topic content key, expected reasoning per question, non-negotiables, reteach routes, guardian safety record |
| `packages/<course>/work-packages.jsonl` | the app | One JSON object per lesson, the machine record behind both sheets |

## The two rules everything else follows from

**Nothing here is an observation.** This package supplies no measurement, no result, and no expected
value anywhere — not in the student sheets, not in the scoring sheets, not in the JSONL. Every
recording cell ships blank, because a printed number in a data table is indistinguishable from a
result, and the curriculum's own policy set forbids presenting invented measurements as real ones.
Where a lesson's analysis can be done without performing the activity, the package routes the learner
to data the curriculum source *names* as published and makes them record its provenance. It never
prints the data itself.

**Nothing here is scored without a content key.** Every lesson's scoring sheet carries the accepted
relationships its topic asserts, the fixed facts where the answer genuinely is fixed, the alternative
framings that must also be accepted, and the specific wrong claims that make work incorrect however
well it is argued. A criterion tells an adult what to look for; the key tells them what is true. The
keys are hand-authored, adult-facing only, and they state what the curriculum teaches — never what a
learner measured, and never what a measurement should come out at. See
`policy/correctness/README.md`.

**Nothing here requires an unsafe home experiment.** Every lesson carries a student-visible safety
brief and an equal-credit alternative that needs no special equipment, no heat, no chemical, no mains
electricity, and no cutting tool. Choosing the alternative never lowers the score ceiling, and
switching to it mid-lesson is recorded as a path choice, never as an incomplete.

## Sources

Read-only, at pinned commits, so the build reproduces regardless of where the branches move next.

| Grades | Lineage | Commit |
| --- | --- | --- |
| 3, 4 | `mac/g34-science-social-r1` (the reviewed safety fix) | `4c6ca4e` |
| 5, 7, 8 | canonical curriculum release 1.0.0 (immutable import) | `4056e31` |
| 9–12 | `mac/hs912-science-h3` — the **H3** learner-use safety fix | `e7551b9` |

H3 supersedes H2 for High School. This tree exists because H2-derived High School student sheets must
not keep shipping after the safety source changed: every High School blob is read at `e7551b9`, and
neither the superseded H2 fix `265ea3a` nor the failed base candidate `f58f7f1` is read anywhere.
`MANIFEST.json` records the SHA-256 of every blob the build actually read, and
`hs-safety-from-h3-only` fails if any High School package is ever built from either of them.

### What H3 changed, and where it lands here

| H3 finding | Where it reaches a learner or adult in this package |
| --- | --- |
| Steel-wool phenomenon reframed to recorded data, with a student-visible rule on any hazard-bearing material named in a phenomenon | the unit phenomenon carried in `instruction`; `hazard-phenomenon-never-reaches-a-learner-unbriefed` |
| Calcium chloride routed through disposable cups, a disposable stirrer, and a tray, never returning to food use | Chemistry Unit 6 materials, hazards, safe order, and disposal; `non-food-grade-route-never-shares-food-equipment` |
| Gloves, waterproof dressings, and the glow stick resolved onto the materials list | `ppe-named-in-a-mitigation-is-on-the-materials-list` |
| Eleven non-disableable prohibitions, not ten, reaching the learner | `policy/safety-floor.json`; `prohibitions-on-every-sheet` |
| The guardian note naming the safe order, the PPE, and the disposal | the Guardian safety record on every scoring sheet; `guardian-record-names-safe-order-ppe-and-disposal` |

The eleventh prohibition — the unconditional open-flame clause H3 added — is the one clause in this
package whose grades 3–5 restatement is newly authored rather than carried over. It is in
`ELEMENTARY_SAFETY_VARIANTS`, and like every other variant it is strictly more restrictive than the
adult clause: it forbids lighting anything for a lesson and operating the cooker for one at all, with
or without an adult, where the adult clause is scoped to investigations in this package.

## The safety floor, and why Grades 5/7/8 need one

The canonical Grade 5/7/8 Science source carries four generic safety bullets, no equal-credit
investigation alternative, and no guardian acknowledgement — the two protections both sibling packages
carry. Rather than author new safety policy for those grades, `policy/safety-floor.json` **imports** the
already-reviewed clauses: the eleven non-disableable prohibitions and the global stop conditions from
the H3 policy set, and the adult-approval, no-mains/flame/chemical, text-only-path, and no-camera clauses
from the Grade 3/4 fix. Every clause carries the commit it came from, and
`safety-floor-traceable-to-source` re-reads those commits and fails if a clause has drifted. The floor
is additive only — it never relaxes a clause a lesson already states.

Grades 3–5 read a restatement of every prohibition and stop condition at their reading age. Each
variant is strictly more restrictive than the adult clause it replaces — the fire instruction, for
instance, is unconditional evacuation with no smothering option — and the adult clause still reaches
the guardian on the scoring sheet. The build fails if a floor clause has no variant, and
`elementary-safety-is-banded-and-stricter` fails if adult wording ever reaches an elementary sheet.

Full text: `policy/scoring-and-safety-policy.md`. What this package does **not** resolve, and why:
`reports/open-gaps.md`.

## Build and verify

```bash
python3 curriculum-production/student-work/science-final-h3/tools/build_student_work.py
```

```bash
node curriculum-production/student-work/science-final-h3/validation/validate-safety.mjs
```

```bash
node curriculum-production/student-work/science-final-h3/validation/run-production-quality-gate.mjs
```

```bash
node curriculum-production/student-work/science-final-h3/validation/mutation-test.mjs
```

```bash
node curriculum-production/student-work/science-final-h3/validation/verify-checksums.mjs
```

- **`validate-safety.mjs`** runs 34 checks that re-derive their expectations from the pinned source
  blobs, the hand-authored correctness keys, and the rendered markdown, not from the packages' own
  assurance flags — a package cannot pass by asserting that it passes. Report:
  `reports/safety-gate.md`.
- **`run-production-quality-gate.mjs`** runs the repo's own gate (`src/curriculum/production-quality`)
  over all 972 lessons. It imports the committed TypeScript directly through a small loader hook, so
  the gate that runs is the gate, not a copy. Report: `reports/production-quality-gate.md`.
- **`mutation-test.mjs`** reintroduces one defect per check and requires that named check to fail.
- **`verify-checksums.mjs`** confirms the committed tree matches `SHA256SUMS.txt`.

The build is deterministic: no clock, no randomness, sorted iteration. Rebuilding from the same pinned
sources reproduces `SHA256SUMS.txt` byte for byte.

## Scientific correctness authority

The largest finding of the independent review — that the rubric could score reasoning and internal
consistency but nothing could catch a scientifically false answer — is closed. 486 topic keys, one per
`(course, unit, focus)` and 54 per course, cover all 972 lessons. The 432 High School keys were
**repinned** from H2 to H3 rather than re-authored: every field a key is keyed on and authored against —
`unit_ref`, `focus`, `phase`, `title`, `essential_question`, `learning_objectives`, `success_criteria` —
is byte-identical across the two commits on all 432 lessons, and H3 changed only `materials`,
`lesson_flow`, `safety_privacy`, `extensions`, and `guardian_visibility_note`. Each repinned file records
`repinned_from` and `repin_basis`, and `correctness-keys-repinned-on-identical-topic-basis` re-derives
that comparison from both pinned commits on every gate run rather than trusting the recorded basis. Each lesson carries between two and
five forms of authority, selected from what the lesson actually is:

| Form | Lessons | Applies when |
| --- | --- | --- |
| `ACCEPTED_RELATIONSHIPS` | 972 | always — the relationships and models the learning target asserts |
| `EXPECTED_REASONING_CRITERIA` | 972 | always — claim-and-evidence criteria, per analysis question |
| `RUBRIC_CORRECTNESS_CONSTRAINT` | 972 | always — the disqualifying errors bound the `Scientific correctness` row |
| `FIXED_FACTUAL` | 520 | the topic has an answer that genuinely is fixed |
| `SUPPLIED_DATA_ANSWER_AUTHORITY` | 288 | the source names published data; the named source and its pinned resource are the authority |
| `INVESTIGATION_CRITERIA` | 162 | the lesson is an investigation — method and conclusion criteria only |

Three rules the keys are held to, each by a check that fails the build or the gate:

- **A key never states an observation.** No expected value, no reading, nothing attributed to a
  learner. A published constant is a property of the world and is allowed; a measurement someone is
  supposed to obtain is not.
- **On investigation days the key bounds the conclusion, never the observations.** A reading that
  disagrees with an accepted relationship is data. A conclusion that restates a disqualifying error as
  established science is `Not yet`.
- **The key is adult-facing.** No relationship and no disqualifying error appears on any learner
  sheet, so open explanation is not converted into a fill-in-the-blank.

## Known gaps

The same review produced three further findings that are curriculum decisions rather than build
defects — a derived rather than authored alternative for Grades 3–8, a Grade 8 clause stricter than
Grade 9, and notice volume on desk days. Each is written up in `reports/open-gaps.md` with what
closing it requires. Two of them are deliberately left alone here, because relaxing a reviewed safety
clause or trimming safety coverage is not a call a build should make on its own.

## What the gate's three carried statuses mean

The production-quality gate deliberately refuses to guess three things. Each is supplied from a check
the build actually ran, and each is re-verified independently by the safety gate:

- **`assessmentAlignment: ALIGNED`** — every stated learning objective is served by at least one
  analysis question, and every question maps back to a stated objective. Objective-level alignment
  only; standards-level mapping stays with the source's own `mapping_status`.
- **`safetyOrPrivacyStatus: VERIFIED`** — every hazard, mitigation, and stop condition in the guardian
  record also appears in what the learner reads, and the brief states supervision, protective
  equipment, disposal, and the alternative.
- **`sourceIntegrityStatus`** — `VERIFIED` only where the curriculum source itself names published
  data, carries a provenance statement, and resolves to a data-source resource that exists;
  `NOT_APPLICABLE` where the lesson uses no external data. No third-party content is embedded
  anywhere, so there is no copy to drift.
