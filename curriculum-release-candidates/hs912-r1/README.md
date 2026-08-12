# Manuel Academy — Grades 8–12 Release Candidate `hs912-r1`

**Assembled by:** `mac/hs912-assembly-r1`
**Assembled on:** 2026-08-12
**Contract:** `manuel-academy-high-school-9-12-release-contract` (see `release/`)
**Status:** `BLOCKED` — two named blockers, both owned by other lanes. See `assembly-report.md` §6.

This directory is a *release candidate*, not a release. Nothing here is served. The
published release at `curriculum-content/manuel-academy/1.0.0/` is untouched, and so is
the Study Engine (`src/**`, `adaptive-tutor/**`, `netlify/**`, `supabase/**`).

## What is here

| Path | Origin |
| --- | --- |
| `release/` | Verbatim copy of `mac/hs912-release-r1`. Contract, course matrix, coverage audit, handoff, and the lane's own validator. **Not edited here.** |
| `<family>/grade-9…12/` | Course artifacts imported verbatim from the owning lane and moved into the contract's canonical layout. |
| `<family>/source-docs/` | Verbatim copies of the lane's own family-level documents — READMEs, standards custody, progression notes, validators, validation reports. |
| `<family>/standards-coverage.md` | **Derived.** A per-family standards registry built by classifying every cited standards string against that family's own custody documents. |
| `science/` | Verbatim import of `mac/hs912-science-h2` in its native schema-set 2.0.0 authoring set. **Not normalised.** See `science/PENDING-H2-REVIEW.md`. |
| `schedules/grade-9…12/daily-schedule.csv` | **Derived.** One row per delivered lesson in the nine normalised families. |
| `credit-content-matrix.md` | **Derived.** Credit recommendation and delivered content, per family and grade. |
| `MANIFEST.json`, `INPUT-SHAS.json` | Exact committed inputs, derived counts, per-course status. |
| `validation/` | The assembly validator and captured output from both validators. |
| `assembly-report.md` | What was proved, what was not, and what blocks. |

## Running the checks

```bash
node curriculum-release-candidates/hs912-r1/validation/validate-assembly.mjs
```

```bash
node curriculum-release-candidates/hs912-r1/release/validate-high-school.mjs --mode assembly --format operator
```

The second command runs the release lane's own validator against this candidate. Its
output is captured in `validation/`, including one finding class this session believes
to be a validator defect rather than a content defect — `assembly-report.md` §5.

## The headline, stated plainly

**This programme is not graduation-complete against the Michigan Merit Curriculum, and
this release candidate does not claim that it is.** World Language remains `NOT_COVERED`
with an irreducible 0.5-credit remainder and is a Director decision. Personal Finance is
carried by the financial-literacy family and is separate from the economics component of
social studies; it *displaces* a credit rather than adding one. The full audit, with
citations, is `release/credit-coverage-map.md`.
