# Assembly Report — Grades 8–12 Release Candidate `hs912-r1`

**Session:** `mac/hs912-assembly-r1`
**Date:** 2026-08-12
**Classification:** `BLOCKED`

## 1. Inputs, resolved to exact commits

| Lane branch | SHA | Imported into this candidate |
| --- | --- | --- |
| `mac/hs912-release-r1` | `5150dfe484ca640f006bdda2132d476556edd93e` | `release/` — contract, matrix, coverage audit, handoff, validator |
| `mac/hs912-math-r1` | `2b716171035c5f9029207bd8f5f45bc64a0eeab7` | `mathematics/` |
| `mac/hs912-ela-r1` | `42f2505bb04d831c4aefc195a7ce03edb2d7b1d9` | `english-language-arts/` |
| `mac/hs912-science-h2` | `265ea3a75740ccbeea0dfa02c723514779def052` | `science/` — verbatim, not normalised |
| `mac/hs912-social-studies-r1` | `fa4410d70e8e91eb1f673a9d0089065fb59a9d76` | `social-studies/` |
| `mac/hs912-health-pe-r1` | `e39e2b343c41a1a800825651159e0e962d5288d7` | `health/`, `physical-education/` |
| `mac/hs912-rfl-finlit-r1` | `481296a9e794770348881b43bd0d1fa4f794db29` | `ready-for-life/`, `financial-literacy/` |
| `mac/hs912-tech-arts-r1` | `627b41c0e794ce31bc5ab7501aec1015930ccbf3` | `technology/`, `arts-and-music/` |

**Not imported:** `mac/hs912-science-r1` @ `f58f7f1eec0a0f93801df4978c00511ec98cc95e`, the
superseded science candidate. Science comes from H2 only.

Ownership across the eight branches is disjoint — every delivered file belongs to exactly one
subject family — so no content conflict had to be resolved. **No branch was merged.** Each
lane's subject subtree was read out of its commit with `git archive` and the artifacts were
copied into this directory.

## 2. What the assembly did to the imported files

| Action | Applied to |
| --- | --- |
| Copied byte-for-byte | every `units.json`, `lessons.jsonl`, `assessments.json`, `course-guide.md`, `lesson-sequence.md`, every family-level document (into `<family>/source-docs/`), and the whole of `release/` and `science/` |
| Moved into the contract's canonical path | the nine normalised families' course directories, which lanes had delivered at `courses/grade-N/`, `courses/<name>-N/`, `build/grade-N/courses/<subject>/`, `grades/grade-N/courses/<subject>/` and `grade-0N/` |
| Newly derived | `<family>/standards-coverage.md`, `schedules/grade-N/daily-schedule.csv`, `credit-content-matrix.md`, `MANIFEST.json`, `INPUT-SHAS.json`, `validation/` |

No lesson, unit, assessment, identifier, standards citation or credit value was edited,
renamed or reworded. The three derived content indexes are derived from the imported files
alone and each records its derivation.

## 3. The nine normalised families

36 courses, 276 units, 3,324 lessons, 276 assessments, four grade schedules.

Every lane already emitted contract-conformant identifiers (`ma-g<grade>-<family>`,
`…-uNN`, `…-uNN-lNN`, `…-uNN-assessment`), so the move needed no identifier work.

## 4. What is proved

`validation/validate-assembly.mjs` proves the following and its output is captured in
`validation/assembly-validation.txt`.

| # | Claim | Result |
| --- | --- | --- |
| 1 | No grade 8–12 is skipped in any of the ten families | **PASS** — 10 published Grade 8 anchors, 40 authored Grade 9–12 courses |
| 2 | Grade 8 → 9 handoff exists for every family | **PASS** — all ten named in `release/grade8-to-grade9-handoff.md`, all ten also carry a family-level seam document |
| 3 | Course, unit, lesson and assessment ids are unique and well formed | **PASS** across the 36 normalised courses; two-digit grades handled |
| 4 | Every lesson is claimed by exactly one unit; no orphans, no double claims | **PASS** |
| 5 | Schedules are complete in both directions | **PASS** — 3,324 references, each resolving to exactly one delivered lesson, each lesson scheduled exactly once |
| 6 | Mastery is evidenced on more than one occasion in every unit | **PASS** — every unit has ≥2 lessons and a distinct unit assessment |
| 7 | Standards are traceable to the owning lane's own custody documents | **FAIL for mathematics only** — see §6 |
| 8 | Every delivered course has a credit recommendation and a matrix row | **PASS** |
| 9 | Grade 12 is substantive | **PASS** — no family's Grade 12 is smaller than its Grade 11; every Grade 12 carries ≥6 units; `ma-g12-mathematics` carries the final-year mathematics requirement |
| 10 | Personal Finance stays separate from economics | **PASS** — `ma-g9-financial-literacy` carries `MMC_PERSONAL_FINANCE`; `ma-g11-social-studies` carries `MMC_SOCIAL_STUDIES_ECONOMICS`; no course claims both |
| 11 | World Language stays uncovered | **PASS** — `MMC_WORLD_LANGUAGE` is `NOT_COVERED`, owner `DIRECTOR`; no world-language course exists in this candidate |
| 12 | Graduation completeness is not falsely claimed | **PASS** — verdict is `NOT_GRADUATION_COMPLETE` while a `NOT_COVERED` requirement stands |
| 13 | Health/PE body-assessment policy is honoured | **PASS** — no lesson instructs a prohibited body assessment outside a prohibition |
| 14 | Science is internally coherent on its own terms | **PASS** — 4 courses, 36 units, 432 lessons, 36 assessments, unique ids, no orphans, native schedule covers every lesson exactly once |

## 5. The standards registries, and why they are built the way they are

`release/validate-high-school.mjs` reads a family's standards registry as *every backticked
token in `<family>/standards-coverage.md`*. Only two lanes shipped a file by that name, and
neither used backticks, so no family had a registry the release validator could read. Building
one was unavoidable. Building one carelessly would have made the traceability check vacuous.

Each `<family>/standards-coverage.md` therefore enumerates every standards string cited by a
delivered unit or lesson in that family and classifies it against that family's own custody
documents, which sit verbatim beside it in `source-docs/`:

| Class | Rule | Backticked? |
| --- | --- | --- |
| `VERBATIM` | the whole string occurs in the lane's custody documents | yes |
| `COMPOSITE_VERIFIED` | a lane-composed label every component of which is evidenced — either verbatim, or restated from at least two published vocabulary words, or a code token whose alphabetic suffix and whose construction template the lane publishes | yes |
| `DECLARED_UNVERIFIED` | the lane marked the citation `UNVERIFIED` itself | yes |
| `UNTRACEABLE` | none of the above | **no** — deliberately left unquoted so the validator rejects it |

Counts: mathematics 156 verbatim / 7 untraceable; english-language-arts 82 / 0; social-studies
162 / 0; arts-and-music 20 / 0; technology 11 / 0; financial-literacy 8 / 0; ready-for-life 4 / 0;
health 0 verbatim / 26 composite-verified / 0 untraceable; physical-education 0 / 10 / 0.

Health and physical education cite lane-composed labels rather than bare state codes —
`Michigan HESG 2025 Grades 9-12 [12.1.BEPA] Balanced Eating and Physical Activity — Self-Awareness
and Analyzing Influences`. Every semantic part of that label is published by the health lane:
the topic abbreviation `BEPA`, the topic name, the practice name, and the code template
`12.<practice>.<TOPIC>` with its confirmed official examples. The wrapper is a lane label, not a
state code, and the coverage file says so. Readers who want the stricter reading should note
that the health lane's own standards reference already records part of the HESG as `unverified`
because `www.michigan.gov` returns HTTP 403 to direct fetch.

### A validator defect, reported rather than worked around

`release/validate-high-school.mjs` matches the Health/PE body-assessment denylist against the
whole lesson JSON blob without regard to polarity. Every health lesson carries the compliant
safety line *"Use body-respect language; do not use dieting, calorie targets, weight cutting,
weigh-ins, or body-size scoring"*, and the validator reports each one as a violation — 432
findings, all of them backwards. `checkBodyAssessment` in `validation/validate-assembly.mjs`
does the same check sentence-by-sentence and skips negated sentences; it finds nothing.

The release validator is **not** edited by this session. `release/` belongs to
`mac/hs912-release-r1`, and softening another lane's gate to make an assembly pass would be the
wrong repair in any case. The fix belongs to the release lane.

## 6. Blockers

Both are structural, both are owned elsewhere, and neither can be fixed by an assembly session
without overstepping `release/authoring-boundaries.md`.

### B1 — `SCIENCE_ID_SCHEME_CONFLICT`

The science lane delivers `ma-hs9-biology`, `ma-hs10-chemistry`, `ma-hs11-physics`,
`ma-hs12-earth-space-environmental` under repository schema set `2.0.0`.
`release/course-matrix.json` allocates `ma-g9-science` … `ma-g12-science`, and
`authoring-boundaries.md` §4 says subject sessions do not invent course ids and that ids are
stable once returned. The lesson record shape differs too. Renaming would break stability and
would diverge from what the parallel H2 review is reading; translating the record shape would
be authoring, not importing. Science is therefore imported verbatim and carries
`PENDING_H2_REVIEW`. Detail and the three possible resolutions: `science/PENDING-H2-REVIEW.md`.

Consequence: the release validator sees 36 of the 40 courses the matrix expects and reports
`ASSEMBLY_INCOMPLETE`. That finding is correct as stated.

### B2 — `STANDARD_UNTRACEABLE`, mathematics `MP.1`–`MP.7`

Mathematics lessons and units cite `MP.1` through `MP.7` in 779 places. The mathematics lane's
`standards-custody.md` documents retrieval of two official Michigan PDFs with SHA-256 digests
and a per-domain count reconciliation across 22 high-school domains — and the Standards for
Mathematical Practice are in neither the extracted `michigan-hs-mathematics-standards.json` nor
`standards-map.md`. The codes are real in the wider framework, but this lane has not evidenced
them, and `authoring-boundaries.md` §7 requires an unevidenced code to be recorded as
`UNVERIFIED` rather than cited bare. Fixing it is a one-line-per-citation change owned by
`mac/hs912-math-r1`: either extract and cite the practice standards from the official document,
or mark the citations `UNVERIFIED`.

## 7. Advisory findings

Eleven courses deliver a different session count from the matrix's recommendation — social
studies 108 against 180 in all four grades, technology 36–48 against 90, health Grade 9 36
against 90, financial literacy Grade 9 72 against 90, physical education Grade 9 108 against
90. `course-matrix.json` deliberately leaves unit and lesson counts unbound
(`count_policy`), so these are recommendations rather than requirements and none of them
blocks. They do change the credit arithmetic's plausibility, and the release lane should
either revise the recommendations or ask the lanes to close the gap before a release manifest
pins the numbers.

## 8. What this candidate does not do

- It does not modify `curriculum-content/manuel-academy/1.0.0/**`, the production release
  registry, the Study Engine, `src/**`, `netlify/**`, `supabase/**`, `package.json`,
  `vite.config.ts` or `scripts/**`.
- It does not activate anything. Grades 9–12 still cannot be served: roughly a dozen shared
  files hard-code the grade set `5|7|8`, listed in `release/authoring-boundaries.md` §5. That
  work belongs to the integration owner.
- It does not claim graduation completeness, and it does not decide whether the Michigan Merit
  Curriculum binds this family at all.
