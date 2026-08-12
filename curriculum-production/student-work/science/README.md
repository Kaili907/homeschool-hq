# Science — student work packages

Student-ready work packages for every supported Science grade: **972 lessons across 9 courses**,
grades 3, 4, 5, 7, 8 and High School Biology, Chemistry, Physics, and Earth/Space/Environmental
Science.

Each lesson gets three artefacts:

| Path | Audience | What it is |
| --- | --- | --- |
| `packages/<course>/student-sheets/<lesson>.md` | learner | Safety brief, blank data sheet, both alternative paths, analysis questions, rubric, reteach prompts, extension |
| `packages/<course>/scoring/<lesson>.md` | supervising adult | Scoring authority, expected reasoning per question, non-negotiables, reteach routes, guardian safety record |
| `packages/<course>/work-packages.jsonl` | the app | One JSON object per lesson, the machine record behind both sheets |

## The two rules everything else follows from

**Nothing here is an observation.** This package supplies no measurement, no result, and no expected
value anywhere — not in the student sheets, not in the scoring sheets, not in the JSONL. Every
recording cell ships blank, because a printed number in a data table is indistinguishable from a
result, and the curriculum's own policy set forbids presenting invented measurements as real ones.
Where a lesson's analysis can be done without performing the activity, the package routes the learner
to data the curriculum source *names* as published and makes them record its provenance. It never
prints the data itself.

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
| 9–12 | `mac/hs912-science-h2` — the **H2** safety fix | `265ea3a` |

The failed base High School candidate `f58f7f1` is **not read by this build**. `MANIFEST.json` records
the SHA-256 of every blob the build actually read, and the `hs-safety-from-h2-only` check fails if any
High School package is ever built from it.

## The safety floor, and why Grades 5/7/8 need one

The canonical Grade 5/7/8 Science source carries four generic safety bullets, no equal-credit
investigation alternative, and no guardian acknowledgement — the two protections both sibling packages
carry. Rather than author new safety policy for those grades, `policy/safety-floor.json` **imports** the
already-reviewed clauses: the ten non-disableable prohibitions and the global stop conditions from the
H2 policy set, and the adult-approval, no-mains/flame/chemical, text-only-path, and no-camera clauses
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
python3 curriculum-production/student-work/science/tools/build_student_work.py
```

```bash
node curriculum-production/student-work/science/validation/validate-safety.mjs
```

```bash
node curriculum-production/student-work/science/validation/run-production-quality-gate.mjs
```

```bash
node curriculum-production/student-work/science/validation/mutation-test.mjs
```

```bash
node curriculum-production/student-work/science/validation/verify-checksums.mjs
```

- **`validate-safety.mjs`** runs 20 checks that re-derive their expectations from the pinned source
  blobs and the rendered markdown, not from the packages' own assurance flags — a package cannot pass
  by asserting that it passes. Report: `reports/safety-gate.md`.
- **`run-production-quality-gate.mjs`** runs the repo's own gate (`src/curriculum/production-quality`)
  over all 972 lessons. It imports the committed TypeScript directly through a small loader hook, so
  the gate that runs is the gate, not a copy. Report: `reports/production-quality-gate.md`.
- **`mutation-test.mjs`** reintroduces one defect per check and requires that named check to fail.
- **`verify-checksums.mjs`** confirms the committed tree matches `SHA256SUMS.txt`.

The build is deterministic: no clock, no randomness, sorted iteration. Rebuilding from the same pinned
sources reproduces `SHA256SUMS.txt` byte for byte.

## Known gaps

An independent safety and scoring review of this package produced four findings that are curriculum
decisions rather than build defects — no per-lesson content key to catch wrong science, a derived
rather than authored alternative for Grades 3–8, a Grade 8 clause stricter than Grade 9, and notice
volume on desk days. Each is written up in `reports/open-gaps.md` with what closing it requires. Two
of them are deliberately left alone here, because relaxing a reviewed safety clause or trimming safety
coverage is not a call a build should make on its own.

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
