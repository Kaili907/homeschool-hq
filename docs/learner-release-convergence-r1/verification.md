# Verification evidence

## Admission, projection, response, and assessment workflow

- Admission rebuild: PASS; 8,292/8,292 production lesson bindings and 699/699 assessment bindings, with 0 blocking bindings.
- Assessment materialization: 699/699 learner packages, 0 structural-only, 0 answer leaks.
- Assessment authorities: 90 `AUTO_SCOREABLE`, 555 `RUBRIC_REQUIRED`, 25 `GUARDIAN_REQUIRED`, 29 `COMPLETION_ONLY`.
- Structured browser projection: 8,292 lessons; 36,328 actionable/read items; 13,516 choice items; 53,606 choices; 5,412 source metadata records; 12 dynamic-source contracts; 3,023 task groups; 8,100 task steps.
- Projection removed 25,848 adult-only fields and 7,320 adult resource locators.
- Learner responses preserve stable lesson/section/item identity and map to the accepted response-kind vocabulary. Required responses are stored before Study can advance.
- Assessment responses are stored and read-verified in IndexedDB before workflow status advances. Offline auto-scoreable submission remains `PENDING_ASSESSMENT`; no correctness is fabricated.
- Browser assessment workflow is integrated into assignment, schedule, launch, response, scoring/review status, guardian certification, and reports.
- The one source-dependent Social assessment fails closed until its exact assessment lesson has `ATTACHED_SATISFIED` source metadata.

## Quality gate

`LEARNER_RELEASE_READY`: lessons 8,292 ready / 0 blocked; assessments 699 ready / 0 blocked. All 23 blocking-code counts are zero. The gate suite includes negative controls for every blocking class and positive controls for the repaired Science, Technology, PE, ELA, and both accepted fail-closed Social launch tokens.

## Subject validator results

- Math: 24/24 checks; 1,620 packages/keys; 0 empty mastery; 0 empty independent practice; substantive G3/G4 Day 1 diagnostics; no answer leakage.
- ELA: 19/19 tests; 1,620 actionable lessons; 0 missing reading/source, placeholders, or false source claims.
- Science: 972 ready, 0 review/not-ready; 0 placeholder/data/material/alternative blockers; 37/37 safety checks; 1,981 checksum files.
- Social: 972/972; 960 static verified and 12 dynamic pending; 432/432 high-school assertions resolved; 0 unresolved or authorship leaks.
- Health: 324/324 meaningful/actionable; 0 placeholders, privacy, or safety failures.
- PE: 972/972 executable; 0 cue, equipment, safety/stop, adaptation, or home-use blockers.
- Ready for Life: 324 accepted lessons, Gate H3 test PASS; learner and guardian completion authorities preserved.
- Financial Literacy: 504/504; direct answer matches 369 to 0; scoring locator leaks 504 to 0; privacy violations 0.
- Technology: 336/336 actionable; 87/87 code/debug contracts; 0 missing inputs or unrunnable tasks.
- Arts / Music: 648/648 with learner resources; 108 models, 108 scaffolds, 54 reference works; 0 external-dependency blockers.

## Browser production-preview matrix

The in-app production preview loaded and inspected these exact browser payloads. Every row preserved stable section/item IDs and an actionable response kind:

| Proof | Lesson | Browser-visible contract |
| --- | --- | --- |
| Math G3 repaired Day 1 | `ma-g3-mathematics-u01-l01` | READ + CHOICE; 24 choices |
| Math G4 repaired Day 1 | `ma-g4-mathematics-u01-l01` | READ + CHOICE; 24 choices |
| Math G5 | `ma-g5-mathematics-u01-l01` | READ + CHOICE; 28 choices |
| Math G8 | `ma-g8-mathematics-u01-l01` | READ + CHOICE; 28 choices |
| Math G12 | `ma-g12-mathematics-u01-l01` | READ + CHOICE; 28 choices |
| ELA elementary | `ma-g3-english-language-arts-u01-l01` | learner reading/source + constructed response + alternative |
| ELA high school | `ma-g12-english-language-arts-u01-l01` | learner reading/source + constructed response + alternative |
| Science | `ma-hs12-earth-space-environmental-u01-l01` | constructed response + executable alternative |
| Social static | `ma-g7-social-studies-u02-l01` | READY verified source metadata + constructed response |
| Social dynamic | `ma-g3-social-studies-u09-l01` | PENDING_SOURCE_ATTACHMENT + blocked/unlocked UI control |
| Health | `ma-g3-health-u01-l01` | constructed response |
| PE | `ma-g3-physical-education-u01-l01` | activity evidence + constructed response + alternative |
| RFL learner authority | `ma-g3-ready-for-life-u01-l01` | learner authority + text/constructed response |
| RFL guardian authority | `ma-g3-ready-for-life-u01-l04` | guardian attestation + equal-credit alternative |
| FinLit fixed/mixed | `ma-g9-financial-literacy-u01-l01` | numeric + constructed response; MIXED |
| FinLit judgment | `ma-g3-financial-literacy-u01-l05` | text + constructed response; JUDGMENT_APPLICATION |
| Technology coding | `ma-g9-technology-u01-l01` | activity evidence + complete activity setup + alternative |
| Arts project | `ma-g9-arts-and-music-u01-l02` | activity evidence + learner model/scaffold resource |

A live representative Math assessment was assigned, launched, rendered with seven task controls, saved seven responses to IndexedDB, and submitted. The visible result was `PENDING_ASSESSMENT` with an explicit statement that no correctness was fabricated offline.

The four-test persistent-browser suite passed PIN isolation, multi-student isolation, response-before-advance, durable process reopen, safety hold/clear, RFL guardian attestation, Social dynamic blocked/unlocked, reports, backup/restore, refused IndexedDB write, and corrupt-document quarantine. The default-off production flag browser test also passed.

## Test and build summary

- Structured projection: 5/5.
- Learner quality gate: 22/22, including full population.
- Family Pilot unit/integration suite: 75 files, 821 tests.
- Assessment/learner-response convergence subset: 8 files, 38 tests.
- Trusted production scoring: 19 tests (5 client/contracts/offline + 14 Netlify resolver/function).
- Browser: 4/4 enabled-release scenarios + 1/1 default-off flag scenario.
- TypeScript: PASS.
- Final launch audit: PASS; exact 90/8,292/699, zero adult leaks, all negative controls.
- Production build: PASS in both enabled-preview and default-off configurations.
