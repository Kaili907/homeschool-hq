# Manuel Academy — Grades 9–12 Release Normalization `hs912-r2`

**Lane:** `mac/hs912-release-normalization-r2`
**Input:** `curriculum-release-candidates/hs912-r1` (assembled by `mac/hs912-assembly-r1`, status `BLOCKED`)
**Normalized on:** 2026-08-12
**Classification:** `HS912_NORMALIZED_RELEASE_READY`

This directory is a **release-layer normalization**, not content and not a release. Nothing here
is served. It resolves the two blockers the r1 assembly named, and it does so without editing a
single unit, lesson, assessment, identifier, standards citation or credit value in any authoring
lane.

## What was blocked, and what changed

| r1 blocker | Resolution | Artifact |
| --- | --- | --- |
| `SCIENCE_ID_SCHEME_CONFLICT` — the lane returns `ma-hs9-biology`, the matrix allocates `ma-g9-science` | A total, bidirectional course-id alias registry. **No stable id renamed.** | [`registries/course-id-alias-registry.json`](registries/course-id-alias-registry.json), [`science/SCIENCE-ID-POLICY.md`](science/SCIENCE-ID-POLICY.md) |
| `STANDARD_UNTRACEABLE` — mathematics cites `MP.1`–`MP.7` in 779 places with no custody | The official Michigan document was re-fetched, its digest matched against the math lane's own custody record, and the practice section read. Citations reclassified `UNTRACEABLE` → `ALIAS_RESOLVED_VERBATIM`. **No mathematics instruction edited.** | [`standards/mathematics-mathematical-practice-custody.md`](standards/mathematics-mathematical-practice-custody.md), [`standards/mathematical-practice-map.json`](standards/mathematical-practice-map.json) |

## What is here

| Path | What it is |
| --- | --- |
| `registries/course-id-alias-registry.json` | All 40 high-school courses. 36 `IDENTITY`, 4 `ALIAS`. Unit, lesson and assessment ids resolve by verified prefix substitution; the one delivered identifier class that cannot (`resource_id`) is declared rather than mis-resolved. |
| `registries/release-course-registry.json` | Per-course normalized record: observed counts, credit, recommended sessions, alignment verdict, schedule plane. |
| `registries/standards-evidence-registry.json` | Per-family standards evidence by class, with the `ALIAS_RESOLVED_VERBATIM` class defined and bounded. |
| `registries/coverage-requirements-registry.json` | MMC requirement verdicts carried forward unchanged, with the World Language guard. |
| `registries/schedule-registry.json` | Both schedule planes, recorded separately, with the science scheduling gap named. |
| `standards/mathematical-practice-map.json` | All eight practices, official ordinal, printed label form, verbatim statement, pinned digest. |
| `standards/evidence/mathematical-practice-verbatim.txt` | The transcribed practice statements and the digest they came from. |
| `science/SCIENCE-ID-POLICY.md` | `ALIAS_NOT_RENAME`, stated and bounded. |
| `tools/build-normalization.py` | Derives every registry from the r1 candidate. Read-only on its input. |
| `validation/` | The validator, its captured output, the mutation tests that prove the checks fire, and the independent review's findings with their disposition. |
| `NORMALIZATION-REPORT.md` | What was proved, what was not, what is still owed and by whom. |

## Running the checks

```bash
node curriculum-release-normalization/hs912-r2/validation/validate-normalization.mjs
```

```bash
python3 curriculum-release-normalization/hs912-r2/validation/mutation-test.py
```

Every published number is checked against an anchor **outside** the file that publishes it:
delivered content, `release/course-matrix.json`, the r1 custody-derived coverage registries, and
git. Families are discovered by walking the candidate, never read from a constant, so the "no such
content exists" checks actually read the disk. `--verify-source` re-fetches the official Michigan
standards document and re-checks the digest, the absence of `MP` tokens and all eight practice
statements against the live bytes; without it, the transcription is checked against a copy frozen
in the validator and the run says so.

The mutation tests damage a temporary copy of this lane — and, for the world-language check, of
the candidate — 46 different ways and require the matching check to fire. They also assert that
one false positive does **not** fire: the honest negated completeness statement must be readable.
The completeness scan covers every file in the lane with **no exemptions**.

## The headline, stated plainly

**This programme is not graduation-complete against the Michigan Merit Curriculum, and nothing in
this directory claims that it is.** World Language remains `NOT_COVERED` with an irreducible
0.5-credit remainder and is a Director decision; the validator re-derives that verdict from
delivered content rather than copying it forward, and blocks if any file in this lane makes a
completeness claim.

Science is `PENDING_H3_IMPORT`. Its four courses are aliased, counted and scheduled on their own
terms, and deliberately left unclassified for standards evidence until the import lands.

Physical education's ten citations are 10-of-10 lane-declared `UNVERIFIED`, and health's are
composite lane labels plus one declared `UNVERIFIED`. Those are accepted, non-blocking values —
and they are not evidence of state-standard alignment. They should not be read as equivalent to
social studies' 162 verbatim codes.
