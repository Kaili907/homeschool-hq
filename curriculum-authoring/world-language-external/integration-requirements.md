# Integration Requirements — introducing an eleventh subject

**For final convergence. No change in this list is performed by this lane.**
`src/**` and `curriculum-release-candidates/**` are untouched on `mac/world-language-external-r2`.

## 1. The decision convergence must make first

There are two ways to carry world language, and they differ in cost by an order of
magnitude. **Choose before touching any file.**

| | **A — eleventh `ACADEMY_SUBJECTS` member** | **B — external-coursework registry beside the ten** |
| --- | --- | --- |
| Shape | `world-language` joins the closed subject tuple | external records live in their own store; the ten stay closed |
| Content | **None.** Every content surface gains a subject with zero lessons | No content surface changes |
| Sites to change | 5 type/domain sites + 2 contract artifacts (§2) | transcript surface only |
| Risk | Empty-subject regressions across levels, analytics, and studio UI (§3) | Transcript must be taught about a second record kind |
| Honest? | Yes, if the emptiness is explicit | Yes |

**This lane recommends B, and specifies A** — because the session brief asks for the
eleventh subject, and because B is only cheaper until the Director decides to author
in-house Japanese, at which point A is needed anyway. What follows is A, complete. If B
is chosen, §2 and §3 drop away and only §4 applies.

The distinction that makes either honest: `ACADEMY_SUBJECTS` is the domain of **subjects
Manuel Academy publishes content for**. World language, under this contract, is a subject
Manuel Academy *records* but does not publish. Adding it to that tuple without saying so
makes the tuple mean two different things at once.

## 2. Every site carrying the ten-subject domain

Verified against the working tree at `mac/world-language-external-r2`. Seven sites carry the
subject domain — five in `src/**` and two in the release contract. **Only site 1 is the typed
source of truth**; the other six are hand copies that drift silently.

| # | Site | Current | Required for option A |
| ---: | --- | --- | --- |
| 1 | [`src/types.ts:47`](../../src/types.ts) `ACADEMY_SUBJECTS` | closed 10-tuple, source of truth | add `'world-language'` |
| 2 | [`src/sync/provenance.ts:25`](../../src/sync/provenance.ts) | hand-copied `Set`, comment says "mirrors ACADEMY_SUBJECTS" | add, **in the same commit** |
| 3 | [`src/academy/contentTypes.ts:151`](../../src/academy/contentTypes.ts) `ACADEMY_SUBJECT_LABELS` | `Record<string, string>` — untyped | add `'world-language': 'World Language'` |
| 4 | [`src/admin/curriculum/studioEditorModel.ts:10`](../../src/admin/curriculum/studioEditorModel.ts) `SUBJECTS` | separate 10-tuple | decide: authorable or not (§3.4) |
| 5 | [`src/curriculum-authoring/v2/contracts.ts:23`](../../src/curriculum-authoring/v2/contracts.ts) `subject` enum | separate 10-tuple | decide: authorable or not (§3.4) |
| 6 | `curriculum-release-candidates/hs912-r1/release/course-matrix.json` `subject_families` | 10 entries | see §3.5 — **do not simply append** |
| 7 | `…/release/validate-high-school.mjs:23` `SUBJECT_FAMILIES` | frozen 10-list | see §3.5 |

**Site 2 is the sharp edge.** `provenance.ts` validates untrusted sync payloads against its
own copy of the domain. Adding world language to `types.ts` alone means a payload carrying
`workingLevels['world-language']` is accepted by the type system and **rejected at sync**;
adding it to `provenance.ts` alone means the reverse. They must move together or profiles
diverge between devices.

**Site 3 fails soft, which is worse.** Every call site is
`ACADEMY_SUBJECT_LABELS[subject] ?? subject` ([`learnerAnalyticsModel.ts:352`](../../src/admin/learnerAnalyticsModel.ts),
[`AcademyLevelsPanel.tsx:91`](../../src/components/hub/AcademyLevelsPanel.tsx),
[`AcademyRouter.tsx:217`](../../src/components/academy/AcademyRouter.tsx)). A missing label
does not throw — it renders the raw slug `world-language` to a parent. No test catches it.

## 3. What an empty eleventh subject does to live surfaces

Option A introduces the first subject with **no published content at any level**. These are
consequences, not hypotheticals.

### 3.1 Working levels
`WorkingLevels` is `Partial<Record<AcademySubject, AcademyGrade>>` ([`types.ts`](../../src/types.ts)),
and `AcademyGrade` is `'5' | '7' | '8'` — levels the release publishes content for. There is
no world-language content at any level, so **every value is inert.** Convergence must either
exclude the subject from level assignment or accept a permanently unassignable row.
`academyAuthorization` ([`provenance.ts:638`](../../src/sync/provenance.ts)) iterates the whole
domain and will now compute an authorization for a subject with no courses to authorize.

### 3.2 Parent-facing level panel
[`AcademyLevelsPanel.tsx:69`](../../src/components/hub/AcademyLevelsPanel.tsx) maps the full
tuple. An eleventh row appears immediately, offering a level selection that serves nothing.
Requires an explicit "external — not levelled here" presentation, or exclusion.

### 3.3 Analytics
[`learnerAnalyticsModel.ts:350`](../../src/admin/learnerAnalyticsModel.ts) maps the tuple into
`WorkingLevelEvidence[]`. `workingLevel.test.ts:123` asserts
`entries).toHaveLength(ACADEMY_SUBJECTS.length)` — **derived from the tuple, so it will pass
green while the surface gains a meaningless row.** A passing test suite is not evidence here.

### 3.4 Authoring surfaces (sites 4 and 5)
`studioEditorModel` and the v2 contracts define what may be **authored**. Under this contract
world language is precisely what Manuel Academy does *not* author. The defensible choice is
to **leave 4 and 5 at ten** and document the asymmetry: the runtime knows about eleven
subjects, the authoring pipeline accepts ten. Adding world language to the authoring enums
creates a path for exactly the fabrication this lane exists to prevent.

### 3.5 Release contract (sites 6 and 7)
`course-matrix.json` carries `"continuity_rule": "Every subject family must publish exactly
one course in every grade of the span. No grade may be skipped."` Appending world language as
an eleventh `subject_families` entry **makes the release candidate structurally invalid** —
`validate-high-school.mjs` iterates `SUBJECT_FAMILIES` at lines 162, 197, 327, 645 expecting a
course per grade, and there are none.

Convergence must therefore add a distinct concept rather than an eleventh family — an
`external_subject_families` block exempt from the continuity rule, with its own validator
path — or leave the release contract at ten and carry world language only on the transcript.
**Appending to `subject_families` is the one change that must not be made.**

## 4. Transcript and coverage obligations (apply under A and B alike)

| # | Obligation |
| --- | --- |
| 4.1 | Transcript rendering implements [`transcript-model.md`](transcript-model.md) §2–3: separate section, provider name as a column, scale printed with the grade, blanks where sources are null. |
| 4.2 | `credit.awarded` is the **only** credit field that prints. `credit.requested` is a plan. |
| 4.3 | Proficiency prints only from `proficiency.*` with its artifact; never derived from credit or hours. |
| 4.4 | `course-matrix.json` `declared_coverage_gaps[MMC_WORLD_LANGUAGE]` stays `NOT_COVERED` **until real awarded credit exists**, and even then the verdict change is a Director decision, not a consequence of data entry. |
| 4.5 | `graduation_completeness.verdict` stays `NOT_GRADUATION_COMPLETE`. Nothing in this contract advances it. |
| 4.6 | `validate-external-course.mjs` runs in whatever validation gate convergence uses. It is dependency-free and exits non-zero on `BLOCKED`. |
| 4.7 | The `wl-ext-*` identifier grammar stays outside the `ma-g<grade>-<subject>` patterns in `academyRoute.ts`, `src/admin/curriculum-validation/model.ts`, and `workingLevel.ts`. External records must not be routable as academy courses. |

## 5. Ordering

1. Director chooses option A or B, and chooses a provider (§4 of [`japanese-two-year-pathway.md`](japanese-two-year-pathway.md)).
2. If A: sites 1–3 in **one commit**, with a test asserting sites 1 and 2 agree by
   construction — the drift in §2 is the defect most likely to reach production.
3. Sites 4–5: decide and document the asymmetry (§3.4). Default is no change.
4. Sites 6–7: `external_subject_families`, never an eleventh `subject_families` entry (§3.5).
5. Transcript surface (§4.1–4.3).
6. Coverage artifacts (§4.4–4.5) — Director-gated, not automatic.

## 6. What convergence must not infer

- That an accepted contract means a course exists. **No Japanese course exists.** This lane
  authored none, and the internal elementary plan is denied as evidence by rule R6.
- That adding the subject closes the gap. It does not; only awarded external credit does,
  and even then §4.4 applies.
- That the MMC binds this family. It does not (`decision-record.md` §2 Option 3). No
  integration step should be justified by state compliance.
