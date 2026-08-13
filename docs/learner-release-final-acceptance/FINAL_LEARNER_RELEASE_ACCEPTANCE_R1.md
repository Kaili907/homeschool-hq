# Final Learner Release Acceptance R1

## Classification

**NOT_READY_FOR_WEB_FAMILY_PILOT**

The exact convergence candidate was independently inspected and tested. Four post-convergence defects were narrow enough to repair and their affected matrices now pass, but the enabled production build still emits answer-bearing browser JavaScript outside the learner-safe Family Pilot payload closure. The release requirement is zero answer-bearing browser chunks, so this is a release blocker even though the lazy Family Pilot course and assessment payloads themselves are clean.

## Custody

- Audited SHA: `7baf8dfbc27168708ed4cf504285a1838d7345f6`
- Audited tree: `71dc2a773d5ec5c272ef8fd6f54781513ecaf9a6`
- Branch: `mac/learner-release-final-acceptance-r1`
- Initial worktree: clean
- Initial `HEAD` and tree matched the authoritative values before any test or repair.
- This acceptance used one agent only.

The candidate was tested first at the exact SHA. Narrow repairs were then made on the acceptance branch and the complete affected acceptance matrix was rerun. The audited base remains the custody identity above; the final branch tip contains the repairs and this evidence record.

## Population and quality gate

| Proof | Result |
| --- | --- |
| Courses | 90 |
| Lessons | 8,292 |
| Assessments | 699 |
| Grades | 3, 4, 5, 7, 8, 9, 10, 11, 12 |
| Grade 6 | absent; negative admission control passed |
| Lesson quality gate | 8,292 ready / 0 blocked |
| Assessment quality gate | 699 ready / 0 blocked |
| Production bindings | exact for all 8,292 lessons |

Subject lesson counts rederived from the admitted browser release:

| Subject | Lessons |
| --- | ---: |
| Mathematics | 1,620 |
| English Language Arts | 1,620 |
| Science | 972 |
| Social Studies | 972 |
| Health | 324 |
| Physical Education | 972 |
| Ready for Life | 324 |
| Financial Literacy | 504 |
| Technology | 336 |
| Arts / Music | 648 |

The unchanged integrated gate passed 22/22 tests, including its full-population proof and all blocking-class negative controls. The final launch audit independently returned `LEARNER_RELEASE_READY` for the content/runtime admission layer with exact counts and zero adult-only projection leaks.

## Prior-blocker dispositions

### Response taxonomy — PASS

All 90 course payloads and all 36,328 lesson-player items were machine scanned. Canonical runtime counts were:

- `READ`: 1,574
- `CHOICE`: 13,516
- `TEXT`: 935
- `NUMERIC`: 2,729
- `CONSTRUCTED_RESPONSE`: 15,618
- `ACTIVITY_EVIDENCE`: 1,956

No unsupported runtime response kind or generic unknown-response fallback was found. Rubric review and guardian attestation are authority/workflow states rather than ordinary content-item controls; their real workflows were exercised separately. Projection tests prove the raw labels `extended-response`, `short-response`, `checklist-item`, `FIXED`, `OPEN`, and `constructed-response` normalize before Lesson Player admission.

### Math scoring identity — PASS

Trusted-scoring suites accept stable `sectionRef` and `choiceRef`, reject learner-supplied answer indices and scoring locators, preserve constructed responses as responses rather than `READ`, and keep offline auto-scoreable submissions pending until trusted scoring. The actual Family Pilot UI was exercised for repaired G3 U1L1 and representative G5, G8, and G12 paths.

### ELA rendering — PASS after narrow repair

Actual Chromium lesson screens rendered learner reading/source, task and writing work, success criteria, and response controls for G3, G7, and G12. The shared material renderer now also renders accepted top-level structured fields instead of limiting output to the generic section array.

### Science rendering — PASS after narrow repair

The 972-lesson validator, safety suite, mutation controls, and checksums passed. A high-school physical investigation path rendered required materials/data/analysis work plus the equal-credit simulation/model-data alternative and constructed-response/review path in Chromium.

### Social source contract — PASS after narrow repair

The source validator reports 960 static source lessons and 12 dynamic lessons. Static metadata/context reaches learner materials. The production dynamic attachment path now requires all 36 accepted metadata fields, an authorized-adult attestation, exact lesson/unit identity, privacy and rights controls, at least two sources, authority sufficiency, and distinct responsible parties. Title/publisher/date-only metadata, malformed metadata, cross-lesson metadata, source-body fields, and incomplete authority all fail closed. A valid minimized bundle unlocks only the exact lesson and remains valid after reload.

### Health rendering — PASS after narrow repair

All 324 packages passed subject validation. Essential question, key points, task, success criteria, and rubric-facing work render in the learner UI; rubric authority remains pending review rather than becoming locally scored.

### PE rendering — PASS after narrow repair

All 972 packages passed executable-lesson validation. Movement cues, technique, space setup, equipment, no-equipment alternative, safety/stopping rules, activity steps, adaptation, and completion criteria now reach the shared learner renderer.

### Ready for Life authority — PASS after narrow repair

All 324 lessons reconcile, including 81 guardian-authority lessons and 243 learner-authority lessons. In real Chromium, learner work advances to `PENDING_GUARDIAN_ATTESTATION`, remains pending across reload, rejects an incorrect parent PIN, is absent when a sibling is selected, and certifies only after the authorized adult attests for the exact learner/session.

### Financial Literacy scoring — PASS

All 504 lessons passed verification: 468 mixed and 36 judgment-only. Fixed/open source vocabularies normalize into usable controls, all trusted fixed items resolve, direct answer matches are zero, and scoring-locator leaks are zero. Elementary fixed, mixed, high-school, and judgment-only paths are represented in the validator/runtime evidence.

### Technology rendering — PASS after narrow repair

All 336 lessons are actionable and all 87 coding/debug contracts are executable. Starter code, input, specification, execution method, tests, debug target, and manual alternative reach the actual learner UI through the structured `activity_setup` renderer.

### Arts / Music resources — PASS after narrow repair

The production population is 648/648 with attached Academy-original content: 108 models, 108 scaffolds, and 54 references. The audit was repaired to inspect the actual structured projection rather than a removed legacy builder shape. Model/reference/scaffold content reaches the browser material, and rights labels alone do not satisfy the resource contract.

### Assessment workflow — PASS

All 699 assessment packages materialize with learner tasks and no answer material: 90 `AUTO_SCOREABLE`, 555 `RUBRIC_REQUIRED`, 25 `GUARDIAN_REQUIRED`, and 29 `COMPLETION_ONLY`. Real production-preview UI assigned and launched an assessment for every subject, saved responses to IndexedDB before advancing, and routed offline auto-scoreable work to `PENDING_ASSESSMENT`. Rubric-required work cannot become scored merely because an injected assessor says `SCORED`.

## Security and persistence

### PIN security — PASS after narrow repair

The original candidate exposed parent authority through an unprotected mode toggle. The repaired UI requires a local four-digit parent PIN for the Parent Hub and defaults to student mode after restore/reload. Only a one-way verifier is stored. Real browser checks found neither the student PIN nor parent PIN in localStorage, IndexedDB, portable backup, or downloaded backup.

### Tutor privacy — PASS

The Family Pilot runtime exposes static help when Tutor is unavailable. Real IndexedDB and backup scans found no raw Tutor conversation or transcript. Backups explicitly declare `tutorTranscriptIncluded: false`, and learner text is excluded.

### Answer security — PASS for Family Pilot data and runtime behavior

All 90 lazy course payloads plus the manifest contain zero `answerIndex`, `correctAnswer`, `expectedAnswer`, answer-key locator, `/scoring/`, scoring-guide, teacher-guide, service-role, localhost, or Tutor-transcript markers. An intentionally incorrect Math assessment response remained pending, disclosed no correct answer, answer index, locator, or solution reasoning, and made no scoring request.

### Bundle security — **FAIL / RELEASE BLOCKER**

The existing provider-boundary suite passes 23/23 and proves the Final Family Pilot module closure has no local/test/Node/Supabase Study provider. The emitted Family Pilot course/assessment JSON is clean. However, inspection of every emitted production JavaScript chunk found answer-bearing legacy client code:

- the shared `index-*.js` entry contains `answerIndex`-based problem generators and `correctAnswer` values used by legacy learner practice/Tutor code;
- `Grade5MathPractice-*.js` contains client-side `correctAnswer` construction and `answerIndex` scoring logic;
- the Final Family Pilot facade contains shared Tutor/offline contract identifiers named `correctAnswer` and `expectedAnswer` (without Family Pilot curriculum answer values).

The first two findings are executable answer-bearing browser code, not harmless type names. Separate feature flags and lazy loading reduce accidental exposure but do not meet the explicit zero-answer-bearing-browser-chunks requirement: emitted public chunks remain fetchable and inspectable. Closing this safely requires a server-trusted scoring migration or a genuinely isolated Family Pilot browser entry/build that does not emit or depend on those legacy answer-bearing modules. That is broader than an acceptance-session repair and remains unresolved.

The Supabase SDK contributes literal localhost fallback strings to the shared entry. These are not active Family Pilot network destinations, and the persistent-browser workflow observed no external/development request, but the emitted strings reinforce the need for a genuinely isolated Family Pilot release bundle if the acceptance rule is literal across all emitted chunks.

### Backup security — PASS

Portable/downloaded backups exclude learner response text and Tutor transcripts, contain no raw PINs or raw answers, and restore only validated minimized state. Dynamic-source backups retain metadata-only records and revalidate them on load.

### IndexedDB, reload, and storage failure — PASS

The browser suite used real Chromium persistent profiles and real IndexedDB. Setup, assignments, lesson responses, checkpoints, pending assessment status, completion, reload, and hard browser-process/profile reopen all restored correctly. Normal storage did not produce a false unsaved warning. A refused real IndexedDB write failed closed without visible/supporting-state advancement, and corrupt durable state was quarantined with evidence preserved.

### Browser matrix — PASS

The enabled production Vite preview loaded every one of the 90 grade-by-subject cells and rederived 90 courses, 8,292 lessons, and 699 assessments from browser payloads. The UI launched a lesson and an assessment for every subject, covered all 90 payload cells, and exercised targeted G3 Math, G3/G7/G12 ELA, G10 physical Science plus alternative, G5/G8 Math workflow, and G12 Math. The normal build with the Family Pilot flag off remained off.

## Narrow repairs made

1. Reconnected the Arts audit to the actual structured projection and preserved learning objectives, task accessibility provisions, safety/privacy, and copyright/authorship sections.
2. Added semantic rendering for accepted subject-specific top-level material fields used by ELA, Science, Health, PE, Technology, Arts, and source metadata.
3. Replaced trivial Social dynamic-source acceptance with the complete 36-field, adult-attested, exact-lesson, unit-sufficient metadata contract and load-time revalidation.
4. Added parent PIN authorization for guardian/source/review/preferences/backup controls; student mode is the reload default.
5. Expanded the persistent Chromium suite to cover all 90 payload cells, every subject UI and assessment, targeted repaired paths, wrong-answer non-disclosure, raw-PIN/Tutor-data absence, and parent/sibling authority negatives.

No broad curriculum content was rebuilt or redesigned.

## Final test record

| Gate | Final result |
| --- | --- |
| Learner release audit | PASS; 90 / 8,292 / 699; 0 blocked |
| Learner quality gate tests | 22/22 PASS |
| Structured projection and Arts audit tests | 10/10 PASS |
| Family Pilot unit/integration | 76 files, 824 tests PASS |
| Assessment/response/security subset | 14 files, 102 tests PASS |
| Provider bundle boundary | 23/23 PASS |
| Database security audit | PASS; no base table without RLS, no unsafe security-definer path |
| TypeScript | PASS |
| Final launch audit | PASS |
| Enabled production build | PASS |
| Enabled persistent Chromium | 7/7 PASS |
| Default-off Chromium | 1/1 PASS |
| Production dependency audit | 0 vulnerabilities |
| Full emitted-JavaScript answer scan | **FAIL**; answer-bearing legacy browser chunks remain |

## Final decision

The content, learner UI, authority, persistence, privacy, and Family Pilot payload-specific gates pass after the recorded narrow repairs. The all-emitted-chunk answer-security requirement does not. Therefore the only valid binary classification is:

**NOT_READY_FOR_WEB_FAMILY_PILOT**
