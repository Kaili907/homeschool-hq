# Independent Review — findings and disposition

One read-only standards/release reviewer went over this lane adversarially. Its named targets
were the alias registry's totality, the Mathematical Practice custody claim, the honesty of the
new `ALIAS_RESOLVED_VERBATIM` class, and the validator's own proof machinery.

It re-fetched the official Michigan document itself, re-derived every count from the r1
candidate, and designed its own corruptions rather than re-running the mutation tests it was
shown. Its most valuable output was a set of registry corruptions that the validator as it then
stood did not catch.

## What it confirmed

Independently re-derived and matching: the source digest and 94-page count; zero occurrences of
`MP`, `MP.N` or `MPN` across the document; the eight practice statements character-exact against
the evidence file; the page-82 restatement; the alias registry total and bijective over exactly
the 40 matrix-allocated high-school ids with no Grade 8 anchor leakage; no stable science id
renamed and no invented course id anywhere; the child-id shape holding with zero violations over
312 units, 3,756 lessons and 312 assessments in both record shapes; the counts 40 / 312 / 3,756 /
312 and the schedule figures 3,324 + 432; credits 6.75 / 6.5 / 6.5 / 6.5 = 26.25; physical
education and health not upgraded from their r1 evidence classes; and the
`ALIAS_RESOLVED_VERBATIM` class keeping the two facts separate everywhere it checked.

It attacked both headline claims — the alias resolution of B1 and the Mathematical Practice
custody repair for B2 — and could not break either.

It also observed that `mac/hs912-science-h3` had moved to `e7551b95` during the session and had
**not** renamed the four stable course ids, which is direct evidence for this lane's claim that
the alias registry survives the import as keyed.

## Findings and disposition

| # | Severity as filed | Finding | Disposition |
| --- | --- | --- | --- |
| F1 | BLOCKING | The World Language "re-derivation" was inert. `deliveredSubjects` was built from a hard-coded family list inside the validator, so the hint pattern was tested against a compile-time constant and could never match. The reviewer planted four complete world-language courses in a copy of the candidate and the validator still reported `blocking: 0` and the note "no world-language course … exists". | **Fixed.** Families are now discovered by walking the candidate. The check reads directory names, delivered course ids, `subject` fields inside delivered records, and the matrix's own allocations. The reviewer's exact attack is now mutant `plant world-language content in the candidate`, run against a mutated copy of the candidate through a new `--candidate` flag, and it is killed. |
| F2 | BLOCKING | `NORMALIZATION-REPORT.md` §8 cited `validation/review-findings.md`, which did not exist — the report was written before the review ran. | **Fixed.** This file. |
| F3 | BLOCKING | 14 of 14 designed registry corruptions survived. Root cause: `checkStandards` re-derived only the *sum* of the evidence classes and that `UNTRACEABLE === 0`; the split across `VERBATIM` / `COMPOSITE_VERIFIED` / `DECLARED_UNVERIFIED` was never checked against anything, so evidence strength could be inflated or destroyed freely. Several other published numbers — the alias registry's own counts block, relationship and child-rule labels, most schedule figures, `courses[]` length, coverage requirement fields other than `verdict`, `standards_framework`, and the manifest's science provenance — were likewise self-attested. | **Fixed.** The class split is now re-derived per class from the r1 per-family coverage registries, which the assembly built from each lane's own custody documents — an anchor outside this lane. Every other number the reviewer named is now re-derived from delivered content, the matrix, or git. Twelve of its fourteen corruptions are now mutants in `mutation-test.py` under their own labels; all are killed. |
| F3b | SUBSTANTIVE | The practice statements were checked only between two in-lane artifacts (the map and the evidence file), so corrupting both together passed. Nothing bound either to the digest-pinned bytes. | **Fixed, with a stated limit.** The eight statements are frozen in the validator, so damaging map and evidence together fires (`corrupt a practice statement in map and evidence together`). `--verify-source` re-fetches the document and re-checks digest, `MP`-token count and all eight statements against the live bytes; it passes. Offline runs emit `SOURCE_NOT_REFETCHED` rather than implying the bytes were seen. |
| F4 | SUBSTANTIVE | The negation heuristic was bypassable: any affirmative completeness claim containing an earlier "no"/"not" anywhere in the sentence passed. The reviewer's demonstration sentence opened with "There is no remaining doubt:" and then asserted completeness outright; it was silently counted as a negated statement. (The sentence is not reproduced here — this file is scanned too, and it is built at runtime in `mutation-test.py` instead.) | **Fixed.** The negation must now sit within 40 characters before the claim with no clause break (`:`, `;`, `—`, "but", "though", "however") between. The reviewer's exact sentence is mutant `claim completeness behind a stray negation` and is killed; the honest negated statement is still allowed, asserted separately as a false-positive guard. `CLAIM_PATTERNS` also gained the "meets/satisfies every requirement" family, which previously matched nothing. |
| F5 | SUBSTANTIVE | The completeness scan skipped two files by name, and appending a claim to `mutation-test.py` passed. | **Fixed.** Both exemptions are gone; the scan now covers every file in the lane. Neither the validator nor the mutation tests contain text their own patterns match — the mutation strings are assembled from fragments at runtime and the patterns are written so they do not match their own source. |
| F6 | SUBSTANTIVE | The published child-id rule was not total over delivered identifiers. Eight science `resource_id`s embed a course id without being prefixed by it (`res-ma-hs9-biology-data-sources`); prefix substitution cannot resolve them and a naive substring rewrite emits an id no record provides. The registry and README stated the rule generally; only `SCIENCE-ID-POLICY.md` scoped it correctly. | **Fixed.** `child_id_rule_definition` is now explicitly scoped to unit, lesson and assessment ids. A new `non_resolving_identifier_classes` block names `resource_id`, explains why substring rewriting is unsafe, lists all eight, and assigns them to the H3 import. `additional_prefixed_identifier_classes` records that `prompt_id`, `interpretation_id` and `schedule_id` do resolve. The validator enumerates delivered resource ids and blocks if one is undeclared; mutant `stop declaring the non-resolving identifier class` is killed. |
| F7 | SUBSTANTIVE | The custody document restated the 779 figure as "units, lessons **and assessments**". Re-derived: units 41 + lessons 738 = 779; assessments add 41 for 820. The added word made the sentence false in the one document whose subject is census precision. | **Fixed.** The document now gives the split and states the scope it kept. |
| F8 | MINOR | `ALIAS_NOT_BIJECTIVE` was tautological — both maps were built from the same array, so given the uniqueness checks it could never fire. The report listed "bijective" as separately proved. | **Fixed.** The tautological check is removed and claim #1 in the report now attributes bijectivity to the uniqueness checks, which do the work. |
| F9 | MINOR | `courses[]` length was never compared to the delivered course count, which is why deleting five rows survived. | **Fixed.** `COURSE_ROWS_MISSING`, plus a per-slot cross-check against the alias registry. |
| F10 | MINOR | An unknown `authored_course_id` produced an uncaught `TypeError` rather than a finding, emitting no JSON under `--format json`. | **Fixed.** Guarded; it now reports `COURSE_ROW_UNKNOWN`. The mutation harness also treats a crash as a distinct `VALIDATOR_CRASHED` result rather than a parse failure. |
| F11 | MINOR | `successor_sha_observed` was stale — H3 had moved. | **Fixed as an observation, not a pin.** The field carries `successor_sha_observed_at`, the validator re-derives the current SHA from git and reports `H3_MOVED` as an **advisory** — a moving branch moving is expected, not a defect — and additionally reads the successor's manifest read-only to confirm the four stable ids are unchanged. |
| F12 | MINOR | The `totality` note was accurate as scoped to 40 high-school courses, but the matrix carries 50; a consumer resolving the whole matrix still meets ten Grade 8 anchor ids with no entry. | **Fixed.** `totality` now says so explicitly. |

## What remains true after the repairs

The reviewer's bottom line was that both headline claims were substantively correct and that what
did not hold was this lane's account of its own proof machinery. That was a fair reading of the
lane as it then stood, and the repairs above are aimed at exactly that gap rather than at the
wording that described it.

The mutation set grew from 26 to 46. The twelve corruptions the reviewer designed and could not
get caught are now named mutants. One limit is stated rather than closed: without `--verify-source`
the practice transcription is checked against a copy frozen in the validator, not against the
document's bytes. The run says which of the two happened.
