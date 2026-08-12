# Standards Reference and Alignment Notes — Grades 3/4

**Alignment date:** 2026-08-12
**Jurisdictional focus:** Michigan (matches the Grades 5/7/8 canonical package)
**Status:** Locally authored curriculum aligned to published standards; this package is not a claim of state approval, accreditation, licensure, or automatic credit.

## Verification method and its limits

This session verified sources using live web search against `michigan.gov`. Direct page/PDF fetch of `michigan.gov` returned `HTTP 403` for every URL attempted (bot-protection on the host, not a broken link) — search-engine indexing of the same pages was used instead, which does reflect current, live content, but does not let this session quote exact PDF text. **No code inside a PDF was fetched and transcribed by this session.** Where a subject's granular per-standard codes were legible in search snippets (Math domains, confirmed Grade 3 NGSS-style science performance-expectation IDs), they are reported below as illustrative and still require the authoring lane to open the source PDF and confirm the exact code before it is written into a lesson. Where codes were not legible, they are marked `UNVERIFIED` — the source is real and current, but this session did not read specific codes off it.

**Rule for subject lanes:** every `standards` entry a lesson/unit/course carries must set `mapping_status` to one of `canonical` (code confirmed against the cited official source), `unverified` (source cited, exact code not yet confirmed), or `human-review` (ambiguous / no official code exists) — this mirrors the existing `mapping_status` enum in [`src/curriculum-authoring/v2/contracts.ts`](../../../../src/curriculum-authoring/v2/contracts.ts). A lesson may ship with `unverified` entries during drafting but the release validator (see [`validation-contract.md`](validation-contract.md)) will require lanes to report how many remain before convergence sign-off.

## Official source list

| Subject | Official URL | Confirmed live (search-indexed 2026-08-12) |
| --- | --- | --- |
| Michigan Academic Standards (portal) | https://www.michigan.gov/mde/services/academic-standards | Yes |
| Mathematics | https://www.michigan.gov/mde/services/academic-standards/mmc/curriculum/math (grade PDFs, e.g. `3rd_Math_357689_7.pdf`, `4th_Math`) | Yes |
| English Language Arts | https://www.michigan.gov/-/media/Project/Websites/mde/Literacy/Content-Standards/ELA_Standards.pdf | Yes |
| Science | https://www.michigan.gov/-/media/Project/Websites/mde/Literacy/Content-Standards/Science_Standards.pdf (Nov 2015) | Yes |
| Social Studies | https://www.michigan.gov/-/media/Project/Websites/mde/Year/2018/06/21/SS_May_2018_Public_Final.pdf (K-12, May 2018); grade-specific GLCE PDFs `3rdgradeSSGLCE.pdf`, `4thgradeSSGLCE.pdf` | Yes |
| Health Education | https://www.michigan.gov/mde/-/media/Project/Websites/mde/ohns/School-Health-and-Safety/Michigan-Health-Education-Standards-Guidelines-2025---ADA-final-with-edits-12-19-25.pdf | Yes — finalized Dec 19, 2025 |
| Physical Education | https://www.michigan.gov/mde/-/media/Project/Websites/mde/2019/02/22/K_12_PE_Standards_Aug_17_ADA_compliance918.pdf (adopted 2017) | Yes |
| Computer Science | https://www.michigan.gov/mde/services/academic-standards/michigan-k-12-computer-science-standards (adopted by State Board May 14, 2019) | Yes |
| Visual, Performing, and Applied Arts | https://www.michigan.gov/mde/services/academic-standards/mmc/curriculum/arts | Yes |
| Personal Finance / Financial Literacy | https://www.michigan.gov/mde/services/academic-standards/personal-finance | Yes — **see Gap 1 below; this source does not cover Grades 3/4** |
| Ready for Life | *(no discrete Michigan academic-standards page — see below)* | N/A |

## Per-subject structural notes (confirmed)

Each heading below is a stable anchor target for `course-matrix.json`'s `standards_ref` field (e.g. `standards-reference.md#mathematics`).

### Mathematics

Michigan hosts Common-Core-aligned, per-grade PDFs (`3rd_Math`, `4th_Math`, etc.). Confirmed domain structure: Operations & Algebraic Thinking (OA), Number & Operations in Base Ten (NBT), Number & Operations — Fractions (NF, introduced Grade 3), Measurement & Data (MD), Geometry (G). Same domain letters as the canonical Grade 5 course uses.

### English Language Arts

Michigan hosts a single K–5 CCSS-aligned document (not one PDF per grade) covering Reading (Literature, Informational Text, Foundational Skills), Writing, Speaking & Listening, and Language strands, reflecting the single-teacher elementary model. Same approach the canonical package used for Grade 5 ELA.

### Science

Michigan's K-12 Science Standards (Nov 2015) are NGSS-derived. Unlike the Grades 6–8 middle-school band the canonical package split locally, **elementary grades carry individual grade-level performance expectations** (confirmed via indexed search: Grade 3 codes exist in the `3-PS2`, `3-LS1`, `3-LS3`, `3-LS4` families; Grade 4 will have its own `4-...` family). Assessment guidance groups K-2/3-5/6-8/9-12 into bands, but the standards themselves are per-grade for elementary — this release therefore expects **Grade 3 and Grade 4 to each get their own standard codes**, not a merged 3–5 treatment, consistent with how the canonical package treated Grade 5 individually.

### Social Studies

Confirmed structural fact: **Grades K–4 use a different coding convention than Grades 5+.** Format is `{grade} – {Category}{n}.{standard}.{expectation}` (example seen in search results: `4 – C5.0.3` = Grade 4, Civics category 5, expectation 3), organized by discipline (history, civics, economics, geography) rather than the numbered-standard style used from Grade 5 up. Grade-specific GLCE PDFs exist for both Grade 3 and Grade 4. The Grade 3 Michigan course is traditionally Michigan studies/local community and geography; Grade 4 traditionally covers U.S. regions — the authoring lane must confirm exact unit-level scope against the grade-specific PDFs, not this document.

### Health Education

The finalized Dec 2025 guidelines use **grade-span structure**, not individual grade levels: Grades 3 and 4 both fall under the "Grade Span 3–5 (by the end of Grade 5)" indicators. This is a real change from the PE and Science pattern above — a Grade-3-only or Grade-4-only health standard citation does not exist; lessons should cite the 3–5 span indicator and let the lane's own scope-and-sequence decide grade placement within the span, exactly as the canonical package already does for Grades 7/8 science banding.

### Physical Education

The 2017-adopted standards use **individual grade levels** through Grade 8 (confirmed: "grades 3, 4, and 5... have their own specific grade-level standards"). Grade 3 and Grade 4 each get distinct standard citations.

### Technology / Computer Science

Adopted by the State Board May 14, 2019 (Michigan became the 32nd state to adopt K-12 CS standards). Standards are organized into levels, not single grades: **Level 1B = "Upper Elementary," Grades 3–5.** Both Grade 3 and Grade 4 cite the same Level 1B band. The word "DRAFT" appears in some archived filenames from the 2019 adoption process — this reflects the pre-adoption filename, not draft/unadopted status at that time. **However, this session's independent review found MDE now hosts a separate "Computer Science Standards – Archive" page distinct from the live standards page, and 2025 legislative activity (HB 5649, signed Jan 2025) is expanding CS course-offering requirements for high schools.** That archive page's existence is a real signal the 2019 content may have been revised or reorganized since — this session could not fetch its contents to confirm either way (see "Verification method" above). **Treat "adopted 2019, Level 1B = Grades 3-5" as `mapping_status: unverified`, not `canonical`, until the technology-computer-science lane opens the live MDE CS standards page directly and confirms the current structure.**

### Arts / Music

Michigan Visual, Performing, and Applied Arts standards provide K-5 grade-level content expectations (last confirmed updated 2024) across Visual Arts, Music, Dance, and Theater. Grade 3 and Grade 4 each get distinct grade-level content expectations. Note: MCL Section 33 imposes a scheduling requirement (≥60 minutes/week of visual-art-or-music instruction) that is a compliance/scheduling fact, not a content standard — do not encode it as a `standard_id`.

### Financial Literacy

No dedicated Michigan standard exists for this grade band — see Gap 1 below.

### Ready for Life

Michigan has no discrete "Ready for Life" academic-standards page; this mirrors the canonical package's treatment (health/PE/CS/arts anchors, local sequencing). The Grade 3/4 Ready for Life course should anchor to the Health Education and Physical Education strand sources above for any life-skills/safety content that overlaps those domains, and is otherwise a locally authored curricular decision — consistent with the frozen `a5-ready-for-life-v1.zip` baseline's treatment for Grade 5.

## Gaps and UNVERIFIED items (do not invent codes for these)

1. **Financial Literacy, Grades 3/4 — no dedicated Michigan standard exists.** Search confirms Michigan's personal-finance framework (MCL 380.1278a; MDE personal-finance content expectations) targets **Grades 9-12**, satisfiable starting in Grade 8 — this is exactly what the canonical package's Grade 8 course already covers (PF1–PF7). There is no equivalent MDE elementary personal-finance framework. The closest official Michigan anchor for Grade 3/4 financial-literacy content is the **Economics strand within the K-4 Social Studies GLCEs** (category `E`, e.g., wants/needs, goods/services, resources — exact codes not enumerated here; confirm against the Grade 3/4 Social Studies GLCE PDFs). A convergence-time policy decision is needed: either (a) scope the Grade 3/4 Financial Literacy course to the Social Studies Economics strand only, citing that as its Michigan alignment, or (b) supplement with a clearly-labeled **non-Michigan** national framework (e.g., Jump$tart Coalition K-12 standards) with an explicit disclosure matching the canonical package's existing Grade 8 disclosure pattern ("this package supplies aligned curriculum... but possession or import alone does not establish proficiency or credit"). Until that decision is made, all Financial Literacy Grade 3/4 standards entries must use `mapping_status: human-review`.
2. **Exact per-lesson standard codes for every subject** are not enumerated in this document by design — see [`release-contract.md`](release-contract.md) (no lesson content is authored in this session) and the "Verification method" note above. Subject lanes must pull exact codes from the cited official source per lesson and set `mapping_status` accordingly; `unverified` entries are acceptable in drafts but must be tracked and reduced before convergence sign-off.
3. **Grade 4 science exact performance-expectation codes** were not individually confirmed in this session (only the Grade 3 `3-PS2`/`3-LS` family was legible in search results). The science lane must confirm Grade 4's own family (expected `4-...` prefix by analogy with NGSS structure) against the source PDF.
4. **Computer Science standards currency (2019 adoption) is not fully confirmed.** An independent review of this document found MDE now hosts a "Computer Science Standards – Archive" page separate from the live standards page, plus 2025 legislative activity (HB 5649) expanding CS requirements — signals the 2019 content may have changed. See the [Technology / Computer Science](#technology--computer-science) section above. Treat as `mapping_status: unverified` until the technology-computer-science lane confirms the current live standard directly.

## Frozen Manuel Academy baselines (unchanged; referenced from the canonical package, not this release)

This release introduces no new frozen baseline artifacts. If a Grade 3/4 lane later needs a frozen overlay analogous to the Grade 5 math/English/Ready-for-Life baselines, that is a subject-lane decision requiring its own artifact custody record — it is not created here.
