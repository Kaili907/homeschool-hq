# Normalization Report — `hs912-r2`

**Lane:** `mac/hs912-release-normalization-r2`
**Input:** `curriculum-release-candidates/hs912-r1`
**Classification:** `HS912_NORMALIZED_RELEASE_READY`

## 1. Scope

This lane owns `curriculum-release-normalization/hs912-r2/**` and writes nowhere else. It reads
the r1 candidate and does not modify it. No authoring lane's content is touched: no unit, lesson,
assessment, identifier, standards citation, credit value or schedule row was edited, renamed or
reworded. Every normalization is a release-layer registry derived from what the lanes delivered.

The published release at `curriculum-content/manuel-academy/1.0.0/`, the production release
registry, the Study Engine, `src/**`, `netlify/**`, `supabase/**`, `scripts/**` and
`package.json` are untouched, as is `release/`, which belongs to `mac/hs912-release-r1`.

## 2. Blocker B1 — `SCIENCE_ID_SCHEME_CONFLICT`

**Resolved by mapping, not renaming.** Full statement of the policy and its limits:
[`science/SCIENCE-ID-POLICY.md`](science/SCIENCE-ID-POLICY.md).

The registry covers all 40 high-school courses — 36 `IDENTITY` and 4 `ALIAS` — so a consumer
resolves every identifier the same way instead of resolving 36 by convention and 4 by special
case. `authored_course_id` is authoritative; `release_slot_id` is a release address. Child
identifiers resolve by prefix substitution, and that rule is published only because every
delivered unit, lesson and assessment id in all 40 courses was re-derived and confirmed to be
literally `<course_id>-uNN[-lNN|-assessment]`.

The four stable science ids are unchanged, which was the point: `release/authoring-boundaries.md`
§4 makes them stable once returned, and the parallel science review is reading them.

## 3. Blocker B2 — `STANDARD_UNTRACEABLE`, mathematics `MP.1`–`MP.7`

**Independently verified against the official source.** Full working:
[`standards/mathematics-mathematical-practice-custody.md`](standards/mathematics-mathematical-practice-custody.md).

The finding was that the mathematics lane cites `MP.1`–`MP.7` in 779 places and its own custody
documents evidence none of them. This lane re-fetched the primary document from `michigan.gov`
and hashed it before reading it. The SHA-256 is
`dbbd4e341a046f22fa4df1dec4af2fd06b35249ad3e3ff9734a3f03bcd6b1a54`, identical to the digest the
mathematics lane recorded, and the page count 94 also matches — so both lanes demonstrably read
the same bytes and this is a check on the math lane's extraction, not a competing transcription.

| Question | Answer |
| --- | --- |
| Are the practices in the official Michigan document? | **Yes.** Eight of them, headed "mathematics \| Standards for mathematical Practice", PDF pages 8–10. |
| Are the statements verbatim-quotable? | **Yes.** Transcribed in `standards/evidence/mathematical-practice-verbatim.txt`. |
| Does the document print the token `MP.1`? | **No.** `MP.N`, `MPN` and standalone `MP` occur **zero** times across all 94 pages. |
| How does it label them? | Bare ordinal `1`–`8` in the practice section; dotted ordinal `1.`–`8.` under "mathematical Practices" on the high-school overview pages. |
| Did the lane invent a standard? | **No.** |
| Is the citation token official? | **No.** It is a Common Core-community shorthand. |

So the seven citations move from `UNTRACEABLE` to `ALIAS_RESOLVED_VERBATIM`: *referent verbatim
in a digest-pinned official source, code form not printed by that source.* The class exists
precisely so those two facts cannot be collapsed, and the validator blocks if the count is ever
folded into `VERBATIM`.

The root cause is worth recording: the math lane's extraction covered the **content** standards —
156 across 22 domains, reconciled by count — and never touched the practice section, so nothing
downstream could evidence a practice code. That is a custody gap, not an instruction defect, which
is why nothing in `mathematics/**` changed.

Incidentally, `www.michigan.gov` returned HTTP 200 to a request carrying an ordinary browser user
agent. The HTTP 403 that the physical education lane hit, and that pushed it to search-engine
indexing, is a user-agent filter rather than an access restriction. Re-verifying physical
education is outside this lane's scope and was **not** attempted; the observation is recorded for
whoever owns that repair.

## 4. Normalized registries, counts and schedules

Counts are **observed by re-derivation and never asserted**. `course-matrix.json` leaves units and
lessons unbound by `count_policy`, so a divergence from a recommended session count is a recorded
observation, not a failure.

| | |
| --- | ---: |
| High-school courses | 40 (36 canonical shape, 4 native schema set 2.0.0) |
| Units | 312 |
| Lessons | 3,756 |
| Assessments | 312 |
| Courses normalized | 36 |
| Courses `PENDING_H3_IMPORT` | 4 |
| Session-count divergences | 15, all advisory |

Credit recommendations are carried forward from the matrix unchanged — 6.75 / 6.5 / 6.5 / 6.5 by
grade, 26.25 total. They are the matrix's recommendations, not a graduation tally, and they
establish no credit recognition.

Schedules are recorded as **two planes, deliberately not merged**. The canonical plane is four
per-grade CSVs covering 3,324 lessons across the nine canonical families, complete in both
directions: every scheduled reference resolves to a delivered lesson and every delivered lesson is
scheduled exactly once. The science plane is the native `schedules.json`, covering all 432 science
lessons exactly once. Synthesising canonical science rows would mean translating another lane's
record shape, which is authoring; the gap is named `SCIENCE_NOT_IN_CANONICAL_SCHEDULE` and is owed
at import.

Standards evidence, per family, after normalization:

| Family | verbatim | composite-verified | lane-declared unverified | alias-resolved | untraceable |
| --- | ---: | ---: | ---: | ---: | ---: |
| social-studies | 162 | 0 | 0 | 0 | 0 |
| mathematics | 156 | 0 | 0 | **7** | 0 |
| english-language-arts | 82 | 0 | 0 | 0 | 0 |
| arts-and-music | 20 | 0 | 0 | 0 | 0 |
| technology | 11 | 0 | 0 | 0 | 0 |
| financial-literacy | 8 | 0 | 0 | 0 | 0 |
| ready-for-life | 4 | 0 | 0 | 0 | 0 |
| health | 0 | 25 | 1 | 0 | 0 |
| physical-education | 0 | 0 | **10** | 0 | 0 |
| science | — | — | — | — | — |

**Two families still ship no verbatim-verified state standard, and one is entirely
self-declared unverified.** Normalization did not change that and must not be read as having
changed it. `DECLARED_UNVERIFIED` remains accepted and non-blocking under
`release/authoring-boundaries.md` §7 — an honest `UNVERIFIED` is acceptable, a plausible invented
code is not — and it remains, equally, not evidence of state-standard alignment. Science is the
one family left deliberately unclassified.

## 5. Coverage and the completeness question

World Language is `NOT_COVERED`, owner `DIRECTOR`, with a 0.5-credit irreducible remainder. The
validator re-derives that verdict from delivered content — no world-language course, unit, lesson
or assessment exists anywhere in the candidate — rather than copying the r1 verdict forward. All
four of the matrix's declared coverage gaps are carried across unchanged, and the validator blocks
if any verdict is altered or any gap dropped.

**No artifact in this lane claims graduation completeness.** The validator scans every file in the
lane for completeness claims and fails the run if one appears. The scan is polarity-aware: the
honest negated statement is read and allowed, and an affirmative claim carrying a stray trailing
negation is still caught. Both behaviours are proved by mutants.

## 6. What is proved

`validation/validate-normalization.mjs` checks every published number against an anchor **outside**
the file that publishes it: delivered content, `release/course-matrix.json`, the r1 per-family
coverage registries that the assembly built from each lane's own custody documents, git, and — with
`--verify-source` — the official standards document itself. Subject families are discovered by
walking the candidate, never read from a constant, so the "no such content exists" checks read the
disk rather than a list.

| # | Claim | Result |
| --- | --- | --- |
| 1 | The alias registry is total over exactly the 40 matrix-allocated slots, unique in both directions, and invents no slot | **PASS** — bijectivity follows from the two uniqueness checks |
| 2 | Every `authored_course_id` names a course that exists in delivered content, and every delivered course has an entry | **PASS** |
| 3 | No stable science identifier was renamed | **PASS** |
| 4 | Every `relationship`, `child_id_rule` and `child_id_rule_verified` label re-derives, as does the registry's own counts block | **PASS** |
| 5 | The prefix-substitution child-id rule holds for all 40 courses, and every delivered identifier class it cannot resolve is declared | **PASS** — 8 science `resource_id`s declared out of scope |
| 6 | Registry counts, course-row count, per-course counts, grades, credits and credit totals all re-derive; counts are not asserted | **PASS** |
| 7 | Every session-alignment verdict and recommended-session figure re-derives from the matrix | **PASS** — 15 divergences, all advisory |
| 8 | No lesson is orphaned or double-claimed, in either record shape | **PASS** |
| 9 | Every published schedule figure re-derives — rows, distinct lessons, duplicates, unresolved refs, courses scheduled, science schedule ids, and all eight coverage totals | **PASS** — 3,324 canonical + 432 science |
| 10 | The two schedule planes stay separate and the gap is declared | **PASS** |
| 11 | Each family's evidence class split re-derives **per class** from the r1 custody-derived registry, not merely as a sum | **PASS** |
| 12 | No family carries an untraceable citation | **PASS** — 0 |
| 13 | No family evidencing nothing verbatim claims otherwise, and each family's `standards_framework` matches the matrix | **PASS** |
| 14 | Science standards evidence is left unclassified | **PASS** |
| 15 | Every `ALIAS_RESOLVED_VERBATIM` citation is backed by the map; all eight practice statements match the frozen official transcription and appear in the evidence file | **PASS** |
| 16 | The pinned digest matches the mathematics lane's own custody record, and the source metadata has not drifted | **PASS** |
| 17 | The map records the `MP.N` code form as unprinted, records zero MP tokens in the source, and no practice claims an MP-prefixed printed label | **PASS** |
| 18 | No world-language directory, course id, subject field or matrix allocation exists anywhere in the candidate | **PASS** — re-derived from disk |
| 19 | No declared coverage gap is dropped and no requirement **field** changed, including the irreducible remainder | **PASS** |
| 20 | No file in this lane claims graduation completeness — every file scanned, no exemptions, polarity-aware | **PASS** |
| 21 | Science carries `PENDING_H3_IMPORT`, its provenance matches the candidate, and the moving H3 branch is not pinned | **PASS** |
| 22 | With `--verify-source`: the official document re-fetched from michigan.gov, digest matched, zero MP tokens, all eight statements present | **PASS** — run and passing |

`validation/mutation-test.py` damages a temporary copy of this lane — and, for the world-language
check, a copy of the candidate — **46** ways, and requires the named check to fire. **46/46
killed**, plus a false-positive guard confirming the honest negated completeness statement is read
and allowed.

One limit is stated rather than closed: without `--verify-source`, the practice transcription is
checked against a copy frozen in the validator rather than against the document's bytes. The run
emits `SOURCE_NOT_REFETCHED` when that is what happened.

## 7. What is not proved, and what is still owed

| # | Item | Owner | Blocking here |
| --- | --- | --- | --- |
| 1 | `release/validate-high-school.mjs` cannot pass this candidate until it reads the alias registry | `mac/hs912-release-r1` | No |
| 2 | The same validator's body-assessment denylist has a polarity defect — 432 inverted findings against compliant health lessons, recorded in r1's report §5 | `mac/hs912-release-r1` | No |
| 3 | Science record-shape translation, a unified per-grade schedule, a science standards-evidence classification, and resource-id addressing across the two schemes | science H3 import | No — `PENDING_H3_IMPORT` |
| 4 | `MP.N` code form: adopt the printed ordinal, or reference this map as custody of record; extend the extraction to cover the practice section; decide whether practice 8 should be cited | `mac/hs912-math-r1` | No |
| 5 | Physical education has no verbatim-verified state standard. The 403 that blocked its verification is a user-agent filter and the document is reachable | `mac/hs912-health-pe-r1` | No |
| 6 | 15 session-count divergences against matrix recommendations | `mac/hs912-release-r1` and the subject lanes | No |
| 7 | World Language, and whether the personal-finance half-credit is directed at it | `DIRECTOR` | No — `NOT_COVERED` stands |
| 8 | Grades 9–12 still cannot be served: roughly a dozen shared files hard-code the grade set `5\|7\|8` | integration owner | No |

Items 1 and 2 are the reason this classification is `HS912_NORMALIZED_RELEASE_READY` rather than
anything stronger. The normalization is complete and self-validating; the release lane's own gate
has two named repairs to make before it agrees, and softening another lane's gate from here would
have been the wrong fix.

## 8. Independent review

One read-only standards/release reviewer went over this lane adversarially. It re-fetched the
official document itself, re-derived every count, and designed its own corruptions rather than
re-running the mutation tests it was shown.

It confirmed both headline claims — the alias registry genuinely resolves B1 without renaming
anything, and the Mathematical Practice custody is correct down to the byte — and could not break
either. What it did break was this lane's account of its own proof machinery: the World Language
"re-derivation" was inert because it tested a constant instead of the disk, the standards evidence
class split was self-attested, and fourteen designed registry corruptions passed unnoticed.

Those findings were correct and are repaired. The evidence class split is now anchored to the r1
custody-derived registries, the world-language check reads the candidate, the completeness scan
lost both of its file exemptions and its loose negation rule, the child-id rule is scoped and its
unresolvable identifier class declared, and the mutation set grew from 26 to 46 with the
reviewer's own attacks among them. Full findings and disposition, including the two items it filed
as blocking:
[`validation/review-findings.md`](validation/review-findings.md).
