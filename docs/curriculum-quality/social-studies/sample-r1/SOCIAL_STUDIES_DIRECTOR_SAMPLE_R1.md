# Social Studies Director Sample R1

## Preview status

`SOCIAL_STUDIES_DIRECTOR_SAMPLE_R1_READY_FOR_REVIEW`

This is one development-only Director review candidate. It is not approval of the Social Studies standard, a corpus rewrite, a release activation, or a claim that other Social Studies lessons conform.

## Scope and authoritative inputs

| Input | Authority |
| --- | --- |
| Requested base | `a7c6edee867e0d3f546aaa6e0442fac434b75c84` |
| Social Studies standard branch | `origin/mac/social-studies-lesson-standard-r1` |
| Standard commit carried into this branch | `2765c49d` |
| Canonical lesson ref | `ma-g5-social-studies-u08-l03` |
| Canonical title | `Guided practice A: protest and loyalism` |
| Canonical phase | `Guided practice A` |
| Canonical standards labels | `Michigan Grade 5 U3.1`; `U3.2` |
| Canonical source-registry input SHA | `50359f17d16f39272daaf33899dd17fce63ccc7e` |

The sample modifies only the named production lesson, its R1 sample/preview artifacts, the development-only route, and the minimum schema compatibility line needed to preserve the canonical underscore-bearing source key `avalon-stamp_act`.

## Lesson design

Declared type:

- instructional purpose: `GUIDED_PRACTICE`
- disciplinary modes: `HISTORY_CHRONOLOGY`, `PRIMARY_SOURCE_ANALYSIS`, `COMPARE_PERSPECTIVE`, and `CLAIM_EVIDENCE_REASONING`

The learner path supplies:

1. topic-specific background and five in-context vocabulary definitions;
2. text spatial orientation plus an attributable 1765–1783 timeline;
3. a protected-distance model using the canonical Lee Resolution anchor;
4. full-support analysis of the Stamp Act's stated purpose;
5. faded analysis of Paul Revere's verified 1770 Library of Congress print;
6. a consistent source-comparison organizer that separates Parliament's institutional voice from a Loyalist colonist's missing voice;
7. an independent two-source claim with evidence, reasoning, and limitation;
8. two fresh mastery prompts: a new Stamp Act clause for cause/effect and a changed corroboration/source-design demand;
9. observable-error remediation using a different Treaty of Paris boundary model; and
10. a fresh Declaration of Independence retry before mastery is reconsidered.

The lesson never asks the learner to impersonate an identity, defend an injustice, or invent a viewpoint. It explicitly treats missing evidence as a valid historical limitation.

## Canonical source custody

| Source key | Canonical repository/title | Use |
| --- | --- | --- |
| `avalon-stamp_act` | Avalon Project — *Great Britain : Parliament - The Stamp Act, March 22, 1765* | background, guided analysis, independent evidence, fresh mastery |
| `loc-2008661777` | Library of Congress — *The bloody massacre perpetrated in King Street Boston on March 5th 1770 by a party of the 29th Regt.* | image/source analysis, comparison, independent evidence, corroboration mastery |
| `nara-lee-resolution` | National Archives — *Lee Resolution (1776)* | modeled evidence reasoning and chronology |
| `nara-treaty-of-paris` | National Archives — *Treaty of Paris (1783)* | alternate remediation model and chronology |
| `nara-declaration-of-independence` | National Archives — *Declaration of Independence (1776)* | fresh remediation retry |

Every key, title, repository URL, and source classification resolves to the canonical registry. The short source excerpts were retrieved from those canonical repository pages. The preview loads the Revere image from the Library of Congress service copy and supplies an evidence-preserving long description.

The sample makes one important limitation visible: the accepted anchors do not directly contain a Loyalist colonist explaining loyalty. The lesson does not fabricate that voice and does not mislabel Parliament's law as that voice.

## Package and answer separation

- Learner-facing production transcript: `curriculum-production/student-work/social-studies/grade-5/ma-g5-social-studies/ma-g5-social-studies-u08-l03.md`
- R1 structured package and protected adult authority: `docs/curriculum-quality/social-studies/sample-r1/ma-g5-social-studies-u08-l03.package.json`
- Development preview: `src/study/family-pilot/social-studies-director-preview/`

The browser preview contains no acceptable-evidence list, scoring guidance, correct answer, answer key, or correctness marker. A learner response is saved on the review device and remains unscored. The structured package contains one protected adult-authority record for every scored task and prohibits Tutor fabrication, graded writing, answer reveal, and runtime mastery control.

## Browser review evidence

- Desktop viewport: 1280px wide; document width 1280px.
- Mobile viewport: 390px wide; document and body width 390px.
- Mobile review controls: 48px high.
- Mobile canonical image width: 332px inside a 370px lesson card.
- Library of Congress image natural dimensions: 873 × 1024; rendered successfully from the canonical asset.
- Desktop rail collapses on mobile; a visible progress bar replaces it.
- Programmatic heading focus remains for screen-reader navigation without a decorative focus outline.
- Response text survives reload through review-only device storage.
- Treaty remediation and the fresh Declaration retry are both reachable.
- Browser console: zero warnings or errors during the review path.

## Verification

- `python3 scripts/validate-social-studies-director-sample-r1.py`: 18/18 validation groups passed.
- Focused Vitest: 1 file, 5 tests passed.
- TypeScript: passed.
- Production Vite build: passed.
- Family Pilot-enabled browser answer-authority audit: passed with zero findings.
- Production bundle scan: the development-only preview route, title, and content are absent.
- `git diff --check`: passed.

## How to open

From this branch/worktree:

```sh
cd /Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-social-studies-director-sample-r1
npm ci
./node_modules/.bin/vite --host 127.0.0.1
```

Then open:

`http://127.0.0.1:5173/__review/g5-social-studies-protest-loyalism`

The route is exact-path and development-only. It is removed from a production build; existing production routes and authentication are unchanged.

## Director review questions

1. Is explicitly naming the missing Loyalist-colonist voice the right evidence-integrity move for this accepted source set, or should a future approved source workflow add a direct Loyalist source before release?
2. Is the text spatial orientation sufficient because geography is contextual rather than measured, or should the approved version add an attributable locator map?
3. Is the transition from the highly supported Stamp Act prompt to the faded Revere prompt appropriate for Grade 5?
4. Do the two mastery forms provide enough variety: fresh cause/effect inference plus corroboration/source design?
5. Should the repair menu remain learner-selectable in the review experience, or should a future trusted adult/runtime policy select the route?

## Classification

`SOCIAL_STUDIES_DIRECTOR_SAMPLE_R1_READY_FOR_REVIEW`
