# Manuel Academy High School 9–12 — Release Contract

**Contract ID:** `manuel-academy-high-school-9-12-release-contract`
**Owner:** `mac/hs912-release-r1`
**Authored:** 2026-08-12
**Anchor release:** `curriculum-content/manuel-academy/1.0.0` (read-only)
**Status:** `HIGH_SCHOOL_RELEASE_CONTRACT_READY`

This is the controlling document for the Manuel Academy Grades 8–12 continuous
programme. It governs the seven subject sessions authoring Grades 9–12 and the
later assembly step that turns their output into a curriculum release.

It contains **no subject content**. Units, lessons and assessments belong to the
subject sessions.

## 1. What this contract covers

| Artifact | Purpose |
| --- | --- |
| `high-school-release-contract.md` | This document. Scope, decisions, gates. |
| `course-matrix.json` | The 50-course matrix: 10 Grade 8 anchors + 40 new Grade 9–12 courses, with owners, prerequisites, credit, and declared coverage gaps. Machine-readable. |
| `standards-reference.md` | Verified official Michigan sources, code formats, and an explicit list of what could **not** be verified. |
| `credit-coverage-map.md` | The Michigan Merit Curriculum coverage audit and its rulings. |
| `grade8-to-grade9-handoff.md` | Per-family exit and entry expectations, and every named discontinuity at the Grade 8 → 9 seam. |
| `authoring-boundaries.md` | Directory ownership, frozen paths, identifier rules, downstream obligations. |
| `validation-contract.md` | The 25 proof obligations and the check that proves each. |
| `validate-high-school.mjs` | The validator. |
| `validate-high-school.test.ts` | Its tests. |
| `validate-high-school.vitest.config.mjs` | Test config, since the root vitest projects do not include this tree. |

## 2. Programme shape

Ten subject families × five grades = 50 courses. **Grade 8 is the anchor and is
frozen**; Grades 9–12 are newly authored. No grade is skipped in any family — the
validator proves this on every run.

| Family | G8 anchor (frozen) | Grade 9 | Grade 10 | Grade 11 | Grade 12 |
| --- | --- | --- | --- | --- | --- |
| Mathematics | Grade 8 Mathematics | Algebra I | Geometry | Algebra II | Precalculus with Statistics |
| English Language Arts | Grade 8 ELA | English 9 | English 10 | English 11 | English 12 |
| Science | Grade 8 Science | Biology | Chemistry | Physics | Earth, Space, and Environmental Systems |
| Social Studies | Grade 8 Social Studies | U.S. History and Geography (1870–present) | World History and Geography | Civics and Economics | Contemporary Global Issues and Civic Capstone |
| Health | Grade 8 Health | Health and Wellness I | Health II | Health III | Health IV |
| Physical Education | Grade 8 PE | Personal Fitness and Lifetime Activity | Team, Individual and Dual Activities | Strength, Conditioning and Training Design | Lifelong Wellness Capstone |
| Ready for Life | Grade 8 Ready for Life | Personal Management and Learning Systems | Career Exploration and Workplace Communication | Postsecondary Planning and Portfolio | Independent Adult Living Capstone |
| Technology and Computer Science | Grade 8 Technology | CS Principles and Digital Citizenship | Programming I | Data, Systems and Applied Computing | Cybersecurity, AI Literacy and Capstone |
| Arts and Music | Grade 8 Arts and Music | Foundations of Visual and Media Arts | Music, Theatre and Performance Foundations | Studio Art, Composition and Applied Design | Arts Capstone: Portfolio and Exhibition |
| Financial Literacy | Grade 8 Financial Literacy | Personal Finance | Consumer Economics and Credit | Investing, Insurance and Risk Management | Financial Transition to Adulthood |

High-school courses are **named courses, not renamed grade levels**. Grade
placement is preserved so that continuity is provable, but "Grade 9 Math" does not
exist — Algebra I does.

## 3. The three classifications

Every claim in this wave carries one of these. Mixing them is the most common way a
curriculum document becomes misleading.

| Classification | Meaning | Where it is recorded |
| --- | --- | --- |
| `STATE_REQUIREMENT` | A Michigan Merit Curriculum graduation credit requirement, cited to statute | `credit-coverage-map.md` |
| `STATE_STANDARD` | A content expectation in a published Michigan Academic Standards document, cited verbatim | `standards-reference.md`, and each family's `standards-coverage.md` |
| `MANUEL_ACADEMY_COURSE_DESIGN_DECISION` | A local curricular choice Michigan does not mandate | `course-matrix.json`, this document |

**Every course sequence in §2 is a Manuel Academy course-design decision.** Michigan
requires that Algebra I, Geometry and Algebra II be *completed*; MCL
380.1278a(1)(a)(i) states expressly that it "does not require completion of
mathematics courses in any particular sequence". The same is true of the order of
U.S. and world history. What Michigan mandates is content and credit, not order.

## 4. Design decisions and why

1. **Grade 9 is U.S. History, Grade 10 is World History** — the reverse of the more
   common Michigan pattern. The published Grade 8 course ends mid-narrative with a
   unit titled "Civic Inquiry and Bridge to 1870–1898". Putting World History in
   Grade 9 would leave that bridge dangling a full year. This closes the seam.
2. **Science steps from 108 to 180 sessions at Grade 9.** A full high-school science
   credit with laboratory work does not fit a three-times-weekly cadence. This is a
   deliberate intensity change, declared in the handoff rather than discovered.
3. **The VPAA credit is carried across Grades 9 and 10** (0.5 + 0.5), and Grades 11
   and 12 carry a **second** arts credit. That second credit is not decoration: it
   is the only substitutable World Language credit the programme has. See §6.
4. **Grade 12 mathematics is mandatory, not a capstone flourish.** The final-year
   mathematics requirement is a scheduling constraint that four banked credits do
   not satisfy.
5. **Grade 9 repeats high-school Personal Finance** even though Grade 8 covers
   PF1–PF7, because a credit determination depends on a specific learner's
   demonstrated proficiency, which a curriculum package cannot establish.
6. **Health and PE both sit at Grade 9 at 0.5 each** to form the single combined
   credit Michigan requires.

## 5. Boundaries

- `curriculum-content/manuel-academy/1.0.0/**` is **read-only**.
- The Study Engine is **not rebuilt**. `adaptive-tutor/**`, `src/**`, `netlify/**`
  and `supabase/**` are untouched by this wave.
- `package.json`, `vite.config.ts` and `scripts/**` are untouched — ten sessions
  editing shared build files concurrently would collide.
- No session authors subject content in `release/`.

Full detail, including the per-family directory map, is in
`authoring-boundaries.md`.

## 6. Graduation coverage — the headline

**This programme is NOT graduation-complete against the Michigan Merit
Curriculum.** The full audit with citations is in `credit-coverage-map.md`; the
summary:

- **Covered:** ELA (4), Mathematics (4, including the final-year course), Science
  (4 against 3 required), Social Studies (4 against 3, including economics and
  civics as distinct half-credit components), Health and PE (1 combined), VPAA (1),
  Personal Finance (0.5).
- **Partially covered:** the **online learning experience**. Not credit-bearing, so
  it never appears in a credit tally. Assigned to `ma-g9-technology` by this
  contract; becomes covered when the Technology session delivers it.
- **Not covered:** **World Language, 2 credits.** No such subject family exists. At
  most 1.0 credit is substitutable by additional arts instruction or a
  department-approved formal CTE programme, and at most a further 0.5 if the
  Director directs the personal finance half-credit here. **At least 0.5 credit of
  genuine language study at Novice High proficiency has no home.**
- **Requires Director decision:** the World Language gap; which credit personal
  finance displaces; the Ready for Life standards anchor; whether Grade 8 personal
  finance proficiency was established; and whether the MMC is treated as binding at
  all.

Two findings are worth restating because they are counter-intuitive and easy to get
wrong:

- **Personal finance displaces, it does not add.** The total stays at 18 credits.
  The half-credit must come out of mathematics, arts, or world language, as the
  board determines. An audit that adds it on top is wrong by half a credit in two
  directions at once.
- **Only one of the two World Language credits is substitutable**, and the arts
  substitution must be arts instruction *in addition to* the required VPAA credit.
  The same arts credit cannot be counted twice.

This contract will not report graduation completeness while a requirement remains
`NOT_COVERED`, and the validator enforces that (`COMPLETENESS_CLAIMED_OVER_GAP`).

## 7. Standards sourcing

Verified official sources, code formats and verbatim examples are in
`standards-reference.md`. Three caveats bind subject sessions directly:

- **ELA:** the dotted high-school codes (`RL.9-10.1`) were **not found verbatim** in
  any MDE document — Michigan renders high-school ELA as grade-band columns. Do not
  hard-code them as MDE-verbatim.
- **Science:** Michigan defines **no Grade 8 checkpoint**. Grade 8 sits inside the
  6–8 band. Manuel Academy must define its own seam and say so.
- **Ready for Life:** no coded MDE standards set could be verified. The family must
  either bind to an official framework or state that it is locally defined.

An honest `UNVERIFIED` is acceptable. A plausible invented standards code is a
contract violation.

## 8. Validation gate

```bash
node curriculum-authoring/full-family-highschool-9-12/release/validate-high-school.mjs --format operator
```

25 proof obligations, each mapped to a named check in `validation-contract.md`,
covering grade continuity, expected courses, identifier uniqueness and stability,
schedule references resolving exactly once in both directions, prerequisite
coherence and acyclicity, the Grade 8 → 9 seam, Grade 9 → 12 progression, standards
traceability, assessment and mastery policy, multi-occasion mastery, accessibility,
privacy, safety, no-media alternatives, Study-compatible structure, and honest
coverage reporting.

**Counts are derived, never asserted.** No lesson or unit total is fixed by this
contract, and the validator *fails* if a future edit pins one before builders
return.

Current state: contract mode passes with zero blocking findings; assembly mode
correctly blocks with `ASSEMBLY_INCOMPLETE` because no subject session has
returned.

## 9. Downstream obligations this wave creates

Grades 9–12 cannot be served by the runtime as written. Roughly a dozen shared
files hard-code the grade set `5|7|8`, including `AcademyGrade` in `src/types.ts`,
the identifier regular expressions in `src/academy/` and
`src/admin/curriculum-validation/`, the published lesson schema's `grade` enum, and
the `EXPECTED` counts in `scripts/build-curriculum.mjs`. The full table is in
`authoring-boundaries.md` §5.

**No session in this wave performs those changes** — they live in shared files
outside this wave's ownership, and the Study Engine is explicitly not being
rebuilt. They are recorded as required follow-on work for the integration owner.

Grades 10, 11 and 12 are the first **two-digit** grades this programme has
produced. Every existing pattern is single-digit. The naive fix
`ma-g(5|7|8|9|10|11|12)` is wrong — the alternation can match a bare `1`. Use
`(?:5|7|8|9|1[0-2])`. The validator asserts both directions of this on every run so
the mistake cannot pass silently.

## 10. Open items owned by the Director

| Item | Blocking what |
| --- | --- |
| World Language — create an eleventh family, source externally, or accept the gap | Any claim of MMC completeness |
| Which credit the personal finance half-credit displaces | The final credit arithmetic |
| Ready for Life standards anchor | Standards traceability for that family |
| Grade 8 personal finance proficiency evidence | Whether Grade 9 Personal Finance is a repeat or an extension |
| Whether the MMC is treated as binding at all | The framing of the whole audit |
| Annual programme load review (26.25 recommended credits; ~1,150 sessions per year) | Nothing yet — but review before Grade 10 |
