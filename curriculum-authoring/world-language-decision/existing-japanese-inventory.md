# Existing Japanese Content — Exact Inventory

**Lane:** `mac/world-language-decision-r1`
**Inventory date:** 2026-08-12
**Method:** exhaustive repository scan. Every artifact below was opened and read; nothing is inferred from filenames.

## Scan method and scope

```
find . -iname '*japan*'                     → 2 files
grep -ril 'spanish|french|latin|german|mandarin|american sign'
                                            → 0 language-course artifacts
grep -rn 'japanese' src/ scripts/           → 6 runtime references
```

The scan covers the whole worktree at `df931cca`. No `curriculum-authoring/` tree
existed before this lane created it.

## A. Curriculum artifacts — the whole corpus

| # | Path | Bytes | Lines | Kind | Declared grades |
| ---: | --- | ---: | ---: | --- | --- |
| 1 | `Japanese-Year-1-Curriculum.md` | 5,185 | 56 | narrative plan, repo root | 3rd & 4th grader (in prose) |
| 2 | `src/curriculum/plans/japanese-year-1.md` | 6,489 | 90 | hub-parseable plan doc | `grades: 3,4` (frontmatter) |
| | **total** | **11,674** | **146** | **2 files** | |

**The two files are one document in two renderings.** A diff of file 2 (frontmatter
stripped) against file 1 shows the difference is entirely structural: file 1 groups
scope by quarter (`### Q1 (Weeks 1–9)`), file 2 re-cuts the identical scope into
week-anchored blocks the hub parser can resolve a pointer against. Prose, goals,
materials, grading and the closing note are byte-identical. **This is one source
document, not two.**

### What file 2 actually contains

| Measure | Count |
| --- | ---: |
| `## Week N` anchor blocks | 8 |
| Weeks anchored | 1, 9, 10, 18, 19, 27, 28, 36 |
| Weeks in the stated scope | 36 |
| Weeks with no authored block | **28** |
| `✋` manual/checkable items | 20 |
| Authored lessons | **0** |
| Units (`units.json` shape) | **0** |
| Assessments (`assessments.json` shape) | **0** |
| Standards citations of any kind | **0** |

The 8 blocks are quarter kickoffs and quarter checks. The 28 intervening weeks are
covered by a recurring instruction — "~3 new chars/week", "daily aisatsu ritual
continues" — not by authored content. **This is a scope outline, not a lesson corpus.**

## B. Declared level and cadence

Read verbatim from the source:

- Frontmatter: `grades: 3,4`
- Title: "Japanese — Year 1 Curriculum (3rd & 4th Grader, Together)"
- Goals header: "Year 1 goals (realistic for 8–9 year olds)"
- Cadence: "10–15 min daily, Mon–Thu" + a 15–20 min Friday culture block
- Instructor model: "You don't need to speak Japanese to run this: you're the coach"

**Annual contact time, computed from the document's own numbers:**

```
Mon–Thu:  4 days × 12 min × 36 weeks = 1,728 min
Friday:   1 day  × 18 min × 36 weeks =   648 min
                                        ─────────
total                                   2,376 min ≈ 39.6 contact hours/year
```

## C. Terminal outcomes claimed by the document

By June of Year 1: all 46 hiragana read and written + dakuten; katakana for own
name and common words; count/colors/family/animals/foods; greeting exchange; a
memorized `jikoshōkai` self-introduction; "genuinely like Japanese."

The document names the last item as "the real goal — Year 1 wins on enthusiasm, not
volume." That is an honest statement of an elementary enrichment aim, and it is the
correct aim for the learners it was written for.

## D. Runtime references — 6, all elementary-scoped or inert

| Path | Reference | State |
| --- | --- | --- |
| `src/curriculum/hubModel.ts:37` | `{ id: 'japanese', label: 'Japanese' }` | **Excluded from grades 10 and 12** — the function returns a different 5-subject list for those grades |
| `src/curriculum/hubModel.test.ts:23` | `expect(expectedSubjects('10')…).not.toContain('japanese')` | The exclusion is **asserted by a test** (not executed in this lane — no `node_modules` in this worktree) |
| `src/missions.ts:38` | `JAPANESE_ITEM` — "The 11:30 Japanese block the 6th grader now joins" | manual daily mission item |
| `src/missions.test.ts:121` | Japanese in the Monday mission set | test |
| `src/tutor/tutorState.ts:63` | `{ slot: 'japanese', hint: 'hiragana trainer (coming soon)' }` | **not built** |
| `src/types.ts:588` | `VoiceSlot` — "`japanese` exists now but is unused until the hiragana trainer ships" | **inert** |

Two things follow. First, the highest grade the Japanese content reaches in the
running product is **Grade 6**, by way of the missions block — and the hub model
affirmatively excludes it at Grade 10 with a test guarding that exclusion. Second,
the only piece of Japanese software ever designed — the hiragana trainer — **does
not exist**; both references to it say so in their own comments.

## E. No other language exists

No Spanish, French, Latin, German, Mandarin, or ASL content of any kind. The grep
hits for those terms are incidental prose in social-studies units and in
`credit-coverage-map.md`. **Japanese is the whole of Manuel Academy's world-language
corpus.**

## F. The Grade 8 anchor has no language course

`curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/` contains exactly
ten course directories, matching the ten-family model. There is no language course.
The published `course-index.json` (30 courses across Grades 5, 7, 8) contains no
Japanese entry and no world-language entry.

Consequence for the "credits may be earned in grades K–12" allowance: **there is no
banked, evidenced prior language credit to carry forward.** The allowance is real
and useful going forward, but nothing in the published release can be drawn against
it today.

## G. The source document already reached this lane's conclusion

`Japanese-Year-1-Curriculum.md` closes with a section titled "One note on the big
girls":

> Your sophomore needs 2 world-language credits of the same language for a
> college-ready transcript. Sitting in on her sisters' 12 minutes won't earn that —
> she'd need a genuine high-school-level course (online provider or community
> college dual enrollment).

The author of the existing Japanese content stated, in the content itself, that it
does not carry high-school credit and that an external provider would be needed.
**This lane's finding is not a new objection. It is a confirmation of the design
intent already recorded in the source.**

That note frames the need around college admission rather than the MMC, and it is
family planning context rather than an authority on any requirement — the same
standing `credit-coverage-map.md` §E assigns it. It is cited here as evidence of
prior awareness, nothing more.

## H. Inventory verdict

**INSUFFICIENT for Grades 8–12 world-language credit.** Not marginal — short on
every independent axis at once:

| Axis | Present | Needed for 1.0 HS credit | Ratio |
| --- | --- | --- | ---: |
| Target learner | ages 8–9 (Gr 3–4) | Grades 8–12 | wrong band |
| Authored lessons | 0 | ~108–180 | 0 |
| Units | 0 | 6–10 | 0 |
| Assessments | 0 | 6–10 | 0 |
| Standards citations | 0 | full MDE standards map | 0 |
| Annual contact hours | ~40 | ~108–180 | ~0.25× |
| Course-guide / normalized artifacts | 0 of 5 | 5 | 0 |
| Sequence years available | 1 | 2 (same language) | 0.5× |

The gap is not a content-volume problem that more authoring hours would close on
the existing base. The existing base is **correctly built for a different learner**
and would have to be replaced rather than extended.

## I. What the existing content IS worth

Recorded so the asset is not written off:

1. **It is a working elementary lane.** Grades 3–4 (and the Grade 6 joiner) have a
   running daily Japanese block. Nothing here recommends changing it.
2. **It seeds the K–12 allowance.** MCL 380.1278a(2) permits world-language credit
   earned in grades K–12. The younger learners are accumulating genuine language
   study now. If it is assessed and evidenced against high-school expectations
   later, that is a real future credit — for *them*, not for a current
   high-schooler.
3. **It establishes Japanese as the house language.** If a high-school lane is ever
   built or bought, Japanese has continuity, materials, and family motivation behind
   it. Language choice is the one decision already made.
4. **The hiragana trainer spec is still a good idea** — as an elementary support
   tool, which is what `tutorState.ts` says it is.
