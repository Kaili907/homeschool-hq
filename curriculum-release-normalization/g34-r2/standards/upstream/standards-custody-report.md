# Standards and Custody Report — Grades 3/4 Release Candidate r1

Companion to [`validation/validation-report.md`](../validation/validation-report.md). This report
records where every standards citation in the candidate came from, where custody is thin, and which
questions the release contract left to convergence and how this assembly answered them.

Nothing here rewrites a lesson. Where a lane's authored content disagrees with
`curriculum-authoring/full-family-grade34/release/`, the authored content is kept verbatim and the
disagreement is recorded below.

## 1. Citation form: every lane emits strings, the release schema proposed objects

`release/lesson-schema.json` requires each `standards` entry to be an object with
`code_or_strand`, `source`, and `mapping_status`, and `release/validation-contract.md` requires a
run to roll up `canonical` / `unverified` / `human-review` counts.

**No lane emits that shape.** All 20 courses emit `standards` as an array of plain strings. Of
4757 standards citations across 1800 lessons, **0 carry a per-citation `mapping_status`.**

This is not recoverable by assembly: inferring a mapping status per citation would be inventing
review state that no author asserted. Consequences:

- [`schemas/lesson.schema.candidate.json`](../schemas/lesson.schema.candidate.json) models
  `standards` as `array of string`, because that is what exists. It is labelled a *candidate*
  precisely so this divergence is a decision someone makes, not one the assembly made silently.
- The validation report records `standards-mapping-status-reported` as **REPORTED**, not PASS —
  the contract's rollup cannot be produced from this content.
- `validation/validation-report.md` records `lesson-schema-compatibility` and
  `required-standards-and-objectives` as **FAIL**: all 1800 lessons fail `release/lesson-schema.json`.
- Promotion to a published release should either (a) accept string citations and drop the
  `mapping_status` requirement from the release schema, or (b) require the lanes to re-emit
  standards as objects. Option (b) is a lane task, not an assembly task.

### 1a. Two further release-schema divergences, surfaced by the conformance run

Running every lesson against `release/lesson-schema.json` turned up two mismatches beyond the
citation form. Neither is a content defect; both are the release schema being out of step with what
the lanes authored.

| Divergence | Lessons affected | What is actually true |
| --- | ---: | --- |
| `schema_version` is `{"const": "1.0"}` | 360 | The ELA lane emits `"1.1"`; the other 18 courses emit `"1.0"`. The candidate schema accepts both. |
| `subject` enum lists `arts-music` and `technology-computer-science` | 216 | The technology-arts lane emits the **canonical** `arts-and-music` and `technology`. The release schema still carries the matrix slugs it also told convergence to resolve (§5). |

The subject mismatch is the same open question as §5, reappearing in the schema rather than the
matrix: `release/lesson-schema.json` needs the same remap-to-canonical decision applied to it.

## 2. Two citation styles, both legitimate, neither reconciled

| Style | Courses | Example |
| --- | --- | --- |
| Exact standard code | mathematics, english-language-arts, science, social-studies (8 courses) | `3.NBT.1`, `4.RL.1`, `3-5-ETS1-1`, `4 – G1.0.1` |
| Named strand or grade-band anchor | health, physical-education, technology, arts-and-music, ready-for-life, financial-literacy (12 courses) | `Michigan Health Practice 3: Information and Resource Seeking` |

The strand style is what the underlying frameworks actually publish for those subjects — Michigan
health, PE, CS, and arts standards are organized by practice/strand rather than by per-grade
numbered code — so this is a property of the sources, not lane sloppiness. It does mean a
downstream standards report cannot join all 20 courses on a single code namespace.

Full per-course inventory: [`standards-inventory.json`](standards-inventory.json).

## 3. Custody gaps: eight of twenty courses ship no standards artifact

Lane-level standards maps carried into [`sources/`](sources/):

| Lane | Artifact | Courses covered |
| --- | --- | --- |
| release-standards | `standards-reference.md` (family-level, all 10 subjects) | — |
| mathematics | `standards/standards-map.json`, `standards/standards-map.md` | 2 |
| english-language-arts | `standards/standards-map.json`, `standards-reference.md`, `michigan-ela-g{3,4}.json` | 2 |
| health-physical-education | `health/standards-map.md`, `physical-education/standards-map.md` | 4 |
| technology-arts | `technology-computer-science/standards-map.md`, `arts-music/standards-map.md` | 4 |
| science-social-studies | **none** | 4 |
| ready-for-life-financial-literacy | **none** | 4 |

Two of the seven lanes shipped none, covering **8 of the 20 courses and 2148 of the 4757
standards citations**.

**Gap A — science and social-studies (4 courses, 1572 citations).** These courses cite exact codes
(`3-5-ETS1-1`, `4 – G1.0.1`) with no lane document stating which published Michigan/NGSS document
those codes were read from, or which were verified. The family-level
`release/standards-reference.md` covers the subjects generically; it is not a per-code verification
record. Codes should be checked against the live MDE and NGSS sources before any claim of alignment
is made to families.

**Gap B — ready-for-life and financial-literacy (4 courses, 576 citations).** These cite Manuel
Academy-internal unit anchors (`Manuel Academy RFL G3 Unit 1 — personal and shared space care`)
plus, for financial literacy, `Michigan Personal Finance foundations — introductory` and
`Grade N economics and mathematics connections`. For ready-for-life that is expected: it is a Manuel
Academy course with no external framework. For financial literacy it is the unresolved **Gap 1** the
release contract flagged — Michigan publishes no dedicated personal-finance standard for this grade
band. The lane authored to internal anchors rather than asserting a Michigan alignment it could not
support, which is the honest choice; the *policy* decision the release contract deferred to
convergence is still open and is recorded here rather than decided.

## 4. Health uses a newer framework than the published 5/7/8 courses

The health lane aligned to the **Michigan Health Education Standards Guidelines 2025** (six
Practices, grade spans consolidated to K–2 / **3–5** / 6–8 / 9–12, State Board approved
2025-11-13). The published Grade 5/7/8 health courses in the sealed 1.0.0 release carry pre-2025
anchors (`Michigan Health: Core Concepts`, `Accessing Information`, `Self-Management`).

The Grades 3/4 courses are aligned to the framework currently in force. The older courses were not
re-aligned — they are outside every lane's ownership and outside this assembly's. A family running
Grade 4 and Grade 5 health will see two different standards vocabularies. Recorded, not reconciled.

## 5. Naming: how this assembly answered the release contract's open question

`release-contract.md` left one question explicitly to convergence: the matrix used
`technology-computer-science` and `arts-music` as subject slugs, while the sealed 1.0.0 package and
`src/curriculum-authoring/v2/contracts.ts` use `technology` and `arts-and-music`.

**Answered as option (b) — remap to the canonical slugs — because the lane had already authored that
way.** The technology-arts lane emits `subject: "technology"` and `subject: "arts-and-music"` in
every lesson. All 20 courses therefore carry subject values drawn from the existing canonical
10-subject enum, and the candidate's directory layout keys on those values, matching the
`grades/grade-N/courses/<subject>/` shape the sealed release already uses. No canonical enum needs
extending.

**Course IDs still deviate from the matrix, and are kept as authored:**

| Matrix `course_id` | Authored `course_id` | Lesson ID prefix |
| --- | --- | --- |
| `ma-g3-technology-computer-science` | `ma-g3-tech-cs` | `ma-g3-tech-cs-u01-l01` |
| `ma-g4-technology-computer-science` | `ma-g4-tech-cs` | `ma-g4-tech-cs-u01-l01` |

Renaming these would mean rewriting 72 lesson IDs, 12 unit IDs, their schedule, and their unit and
assessment cross-references — a lesson rewrite, which this session does not do. The authored IDs are
consistent within themselves, unique across the candidate, and match the release lesson-ID pattern.
`release/course-matrix.json` is the file that is now stale, and it belongs to the release-standards
lane.

## 6. Two lanes authored inside the sealed release path

`mac/g34-science-social-r1` and `mac/g34-rfl-finlit-r1` authored their eight courses under
`curriculum-content/manuel-academy/1.0.0/grades/grade-{3,4}/courses/**` — inside the frozen Grades
5/7/8 package, which `release-contract.md` and both lanes' own boundaries forbid.

Handled by content reconciliation, not by merge: this assembly reads those files from the lane
commits and writes them into the candidate tree. **On this branch nothing under
`curriculum-content/manuel-academy/1.0.0/` is added, changed, or removed** — verified by the
`sealed-1.0.0-identity-untouched` check, which diffs the whole 1.0.0 subtree against the assembly
base.

The two source branches still carry the misplaced paths. Correcting them is the lane owners' call
and was deliberately not done here — this session does not modify source branches.

## 7. Health and PE ship as PENDING_FINAL_HEALTH_REVIEW

`ma-g3-health`, `ma-g4-health`, `ma-g3-physical-education`, and `ma-g4-physical-education` carry
`status: "PENDING_FINAL_HEALTH_REVIEW"` in `course-index.json` and `MANIFEST.json`. They are
included in full — every lesson, unit, assessment, and schedule entry is present and validates —
and are not hidden or held back.

What the marker means: the lane's own build validator verifies the private-safe guarantees on all
288 lessons (no body weight/height/BMI/body-fat, no calorie counting or weight-loss goals, no
medical or mental-health disclosure, no learner photo or video, fictional scenarios throughout, and
a `guardian_safety_review` block on every unit and lesson). The lane also documents a deliberate
scope decision: reproductive and sexual-health instruction is excluded and left to guardians as a
separately selected module, while child-sexual-abuse prevention and body autonomy **are** taught, in
Unit 4 of both grades behind a guardian confirmation flag. Those are content judgments that warrant
a named human reviewer before these two subjects reach families. No such sign-off exists yet, for
any subject — see §8 — but health and PE are the two where the absence is load-bearing.

## 7a. `course-matrix.json` is stale in a second way

Beyond the two `tech-cs` course IDs (§5), `release/course-matrix.json` assigns `days: 180` to all
20 courses. Actual cadence varies by subject: 180 lessons for mathematics and ELA, 108 for science,
social-studies and physical education, 72 for arts-and-music, 36 for health, ready-for-life,
technology and financial literacy — every one of them spread across the same 36-week year. The
matrix's `days` field is a planning placeholder that no lane honoured and that nothing now reads;
`course-index.json` and `schedules/schedule-index.json` carry the real per-course figures. The
matrix belongs to the release-standards lane and was not edited here.

## 8. What no one has signed off

- **No licensed-educator review** of any of the 20 courses. The math lane states this plainly for
  itself; it is true of the whole candidate. Treat as review-ready, not review-complete.
- **No live verification of standard codes** against MDE/NGSS sources in this run. The validator
  has no network access by design and checks internal consistency only.
- **No rendered-interface accessibility audit.** Accessibility is verified structurally in content
  (media optional on all 1800 lessons with a stated fallback, ≥6 accommodations per lesson) but has
  never been tested against a screen reader, keyboard-only navigation, or a real viewport.
- **No host integration.** Grades 3 and 4 do not exist in `AcademyGrade` (`src/types.ts`),
  `PILOT_GRADES` (`src/curriculum/family-pilot/source.node.ts`), or the `EXPECTED` counts in
  `scripts/build-curriculum.mjs`. This candidate is not served to anyone until a promotion session
  cuts a new release version — the 1.0.0 package is frozen and must stay so.
