# Final Family Pilot Launch Audit R1

## Ruling

`READY_FOR_FAMILY_PILOT`

The local, feature-gated Family Pilot passed its required production-build, real-browser, real-IndexedDB, curriculum, privacy, recovery, and failure-path acceptance gates. This ruling covers the audited local Mac workflow only; no hosted service, deployment, migration, or server Tutor was activated.

## Exact audited inputs

| Item | Value |
| --- | --- |
| Input app branch | `mac/final-family-pilot-convergence-r1` |
| Required input app SHA | `265ee95d5c57181ccbb4dbf2ab158b8f7c111cd4` |
| Required input tree | `886fd11abff554d3b4fff9fa34ad7be3bd37c298` |
| Inspected E2E harness branch | `mac/final-e2e-harness-r1` |
| Inspected E2E harness SHA | `be717deeec302af595335eb9397ee6afd4988fca` |
| Audited implementation SHA | `5595335fc6bb5a21a7814f2e7688bbb3cca5f66b` |
| Audited implementation tree | `ddaf28c019c31adeae52d2fc5cfab17200544592` |
| Audit branch | `mac/final-family-pilot-launch-audit-r1` |

The harness commit was inspected as a seven-file, release-independent synthetic acceptance delta. It was not blindly merged from its older base. The valid harness files were imported, and one type-only helper parameter was widened from its three fixture grades to the repository's full `AcademyGrade` union so the imported harness typechecks without changing its synthetic scenarios.

## Environment

- macOS 15.6 (24G84), Apple Silicon `arm64`
- Node.js 22.23.2; npm 10.9.8
- Playwright 1.54.1
- Playwright Chromium 139.0.7258.5, headless for repeatable acceptance runs
- Built preview URL: `http://127.0.0.1:4181/family-pilot`
- Default-off proof URL: `http://127.0.0.1:4182/family-pilot`
- Real persistent Chromium user-data directories were created per test; the launch proof closed the Chromium context/process and reopened the same profile.

## Commands and production build proof

The accepted feature switch is the literal Vite environment value `VITE_FAMILY_PILOT_ENABLED=true`. Any missing value, or any value other than literal `true`, keeps the route disabled.

```sh
npm ci
npx playwright install chromium
VITE_FAMILY_PILOT_ENABLED=true npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm run test:family-pilot-browser
npm run test:family-pilot-flag-default
npm run audit:family-pilot-launch
npx vitest run src/study/family-pilot
npx vitest run src/curriculum/final-runtime src/curriculum/release-admission src/study/family-pilot/catalog-runtime
npm run test:root-app
npx tsc --noEmit --pretty false
```

The final explicit enabled build used the normal command `VITE_FAMILY_PILOT_ENABLED=true npm run build`. It generated curriculum normally, transformed 543 modules, emitted the final catalog as 90 lazy payloads, and completed successfully. Relevant final-build assets were:

- `FinalFamilyPilotApp-CWNnU0vz.js`: 252.08 kB, 66.18 kB gzip
- main `index-B6Ltjndj.js`: 1,012.01 kB, 304.56 kB gzip
- `index-BirfmEER.css`: 66.23 kB, 12.12 kB gzip
- `StudyProductionRoute-Bf2UNGlf.js`: 63.17 kB, 16.10 kB gzip
- `AcademyRouter-B7IzIum-.js`: 18.76 kB, 5.39 kB gzip

No deployment was performed.

## Synthetic household and browser proof

The production preview began with a fresh origin: no IndexedDB, localStorage, household, or backup. `/family-pilot` rendered its first-run family setup rather than developer UI. The browser created these wholly synthetic profiles through the user-facing setup screen:

- Avery Synthetic: nominal Grade 6; explicit working grades Math 5, Science 7, Social Studies 3, and Ready for Life 5; PIN enabled.
- Blake Synthetic: nominal/working Grade 8.
- Casey Synthetic: nominal/working Grade 12.

Avery resolved only the four explicitly overridden supported courses and no Grade 6 course. Blake resolved real Grade 8 Mathematics. Casey resolved real Grade 12 Science. Assignments were made through the Parent UI and appeared only on the intended student's Home and Schedule. The final state retained Casey's distinct planned Grade 12 assignment while Avery and Blake had independent Study outcomes.

The Student picker and keypad were used directly. `0000` was refused for Avery and `1357` succeeded. Only a one-way device-local digest was present in supporting state; the raw PIN was absent from localStorage, IndexedDB inspections, backup, and the final state scan. Switching students rebound Home, Schedule, assignment, runtime, and reports to the selected `studentRef`.

## Curriculum and subject proof

The machine auditor parsed the real admitted manifest and all 90 course payloads, not a hand-maintained fixture. Every course lazy-loaded, contained at least one resolvable lesson, and had complete binding/material coverage. Aggregate results:

| Invariant | Result |
| --- | ---: |
| Grades | 3, 4, 5, 7, 8, 9, 10, 11, 12 |
| Grade 6 curriculum | 0 |
| Courses | 90 |
| Units | 698 |
| Lessons | 8,292 |
| Assessments | 699 |
| Production bindings | 8,292 / 8,292 |
| Learner materials | 8,292 / 8,292 |
| Mathematics | 1,620 |
| English Language Arts | 1,620 |
| Science | 972 |
| Social Studies | 972 |
| Health + Physical Education | 1,296 |
| Ready for Life | 324 |
| Technology + Arts/Music | 984 |
| Financial Literacy | 504 |
| Guardian-authority bindings | 81 |
| Dynamic Social source bindings | 12 |

All ten subject families resolved real learner production material through their admitted course payloads. The four Mathematics `RESERVE_TUTOR` records were present in both reserve manifests with `countsAsActiveSchoolDay: false`, `separateFromActiveSchedule: true`, and no reference in the active 8,292-lesson registry.

## Lesson Player and Study proof

The ordinary learner-authority browser lesson was:

- course: `ma-g5-mathematics`
- lessonRef: `ma-g5-mathematics-u01-l01`
- title: `Launch and diagnostic: problem-solving routines`

The real Parent UI assigned it, the real Student Home opened it, admitted production material rendered, and the final composition created a three-segment Study session. Two segments completed, a checkpoint was saved, and exact durable state was captured. Learner material and the production bundle were scanned for answer/scoring keys and adult-only source references; the leak count was zero.

The browser then closed the persistent Chromium context/process and reopened the same profile. Avery authenticated again and resumed Step 3 of 3 with the same `studentRef`, assignment, lesson, session, completed segments, current segment, and durable Study document—no restart from Step 1. Completing Step 3 persisted the ordinary assignment as completed; reports and reload retained completion. Blake independently began at Step 1 and completed the Grade 8 lesson while Avery was held, proving sibling Study isolation.

Ordinary millisecond browser timing initially uncovered an accepted calendar-runtime refusal because active intervals must be whole seconds. The controller now normalizes its single shared clock to whole-second instants. A 137 ms-increment regression test and the real Chromium completion flow both pass.

## IndexedDB, privacy, and corruption proof

The real browser created and used IndexedDB database `manuel-academy.study.family-pilot-durable`, version 1, object store `records`. Canonical Study documents, checkpoints, session/calendar state, health, and quarantine evidence were read directly from that store during acceptance. Normal canonical Study state was absent from localStorage; localStorage held only the intended minimized Core/app projections and local preferences.

After deliberate corruption of the durable Study envelope, a cold process reopen failed closed with `Lesson not ready`, did not show Step 1 or restart the lesson, retained the one-segment Core projection without falsely advancing it, and wrote the original corrupt value to the learner's IndexedDB quarantine record.

No raw learner response, answer key, audio, Tutor transcript, full dynamic-source article, or raw PIN was persisted. The portable backup explicitly retained `learnerTextIncluded: false` and `tutorTranscriptIncluded: false`.

## Guardian attestation proof

The real guardian-authority browser lesson was:

- course: `ma-g5-ready-for-life`
- lessonRef: `ma-g5-ready-for-life-u01-l04`
- title: `Application or project: hazard recognition`

After the learner completed all three segments, the UI displayed `Work finished — parent sign-off pending`. Reload retained `PENDING_GUARDIAN_ATTESTATION`; learner action alone did not complete the assignment. The Parent UI performed `Attest: adult observed`, producing `CERTIFIED` and completed assignment state bound to the exact Avery student, assignment, lesson, and Study session. Blake had no matching attestation and could not satisfy Avery's item.

## Dynamic Social source proof

The real dynamic-source lesson was:

- course: `ma-g3-social-studies`
- lessonRef: `ma-g3-social-studies-u09-l01`
- title: `Launch and diagnostic: specialization and interdependence`

Before attachment, Student start failed at `PENDING_SOURCE_ATTACHMENT` without creating usable Study progress. The Parent UI attached only title `Local economics packet`, publisher `Manuel Academy family library`, and publication date `2026-08-13`; it fetched no website and stored no article body. `ATTACHED_SATISFIED` survived reload, after which the student started the production lesson and persisted an independent one-segment in-progress checkpoint.

## Safety proof

The supported student `I need an adult check-in` path placed a hold on Avery's exact Study session. Avery's resume and Tutor actions were disabled and there was no student clear control. Blake remained fully usable and completed his own lesson. Parent saw the held student/session and cleared it through the real Parent UI; Avery resumed the unchanged Step 3 checkpoint and completed.

This browser flow uncovered and fixed a production-identifier defect: embedding long student and session refs made a hold ID exceed the final runtime's 192-character ref contract. Hold IDs are now bounded opaque identifiers; student and session identity remain in their explicit validated fields. The long-identity regression and full browser flow pass. Corrupt Study/safety-dependent entry remains conservative.

## Tutor fallback proof

No hosted Tutor route was activated. The Lesson Player exposed the accepted static curriculum help path, labeled it as the static fallback, and Study continued after it was used. Network capture showed no server Tutor request. Final state and backup contained no raw Tutor conversation or transcript.

## Reports proof

Parent Reports were exercised after real transitions. Avery showed Mathematics at Working Grade 5 with 1/1 completed, the guardian item certified, dynamic Social work in progress, zero pending attestations after adult action, and zero open holds after parent clear. Blake independently showed Grade 8 Mathematics at 1/1 completed. Earlier Parent surfaces visibly represented the pending guardian item and open safety hold before their authorized transitions.

## Backup and restore proof

The real Download backup action exported three distinct students with completed ordinary work, Blake's independent completion, Avery's dynamic-source in-progress checkpoint, certified Ready-for-Life attestation, minimized source metadata, preferences/PIN digest, safety history, and two present Study documents (Casey's unstarted Study document remained null).

Avery's display name was then mutated through Preferences. The real file chooser restored the downloaded backup, returning the exact roster name and retained per-student assignment, Study, attestation, source, safety, and preference separation. A malformed JSON file and a schema version 999 file were each refused through the same Restore UI; alerts reported rejection and a byte-equivalent supporting-state snapshot proved that the valid household was not overwritten.

## Storage failure proof

A test-only browser injection made the real IndexedDB object store throw `QuotaExceededError` only for the next learner-document write. Continue visibly failed with `Nothing was recorded` and `Lesson not ready`; Step 2 never appeared. The durable Study document and Core projection remained byte-equivalent to their pre-attempt values, while the IndexedDB health record became `write-failed`. The app did not claim checkpoint or completion success.

## Bundle and network proof

The final enabled-build route closure contained exactly one `FinalFamilyPilotApp` JavaScript chunk. Static inspection found no `createLocalDevelopmentStudyPorts`, `fakeIndexedDb`, `node:fs`, test helper, hosted Study Supabase client, localhost-only provider, or server Tutor production route. A representative far-end lesson body was absent from the initial final-app chunk, while all 90 course JSON payloads were present under `dist/family-pilot-final/2.0.0/courses`; the 8,292 bodies remain lazy.

The complete browser workflow captured every request across both sides of the Chromium process reopen. Every request used the local preview origin (`127.0.0.1`/`localhost`) or a browser-local `data:`/`blob:` URL. No hosted Supabase, Study, Tutor, assignment, checkpoint, safety, attestation, source-readiness, report, or backup request occurred.

## Feature flag proof

- Default build: `VITE_FAMILY_PILOT_ENABLED=false npm run build` followed by production preview. `/family-pilot` contained no `[data-family-pilot-release]`; it rendered normal `Homeschool HQ`. PASS.
- Enabled build: `VITE_FAMILY_PILOT_ENABLED=true npm run build` followed by production preview. `/family-pilot` completed the full workflow above. PASS.

The flag was not removed, route guards were not bypassed, and no test-only route was used.

## Test ledger

| Gate | Result |
| --- | --- |
| Production Playwright launch tests | 3 passed |
| Default-off production Playwright test | 1 passed |
| Family Pilot suite, including imported final E2E harness and convergence | 68 files, 790 tests passed |
| Final curriculum/runtime/admission/catalog | 7 files, 89 tests passed |
| Root app | 356 files, 4,017 tests passed |
| Long production hold-ref regression | included; 13 safety hold tests passed |
| TypeScript | passed |
| Enabled normal production build | passed |
| Full release/bundle machine audit | passed |

The reusable harness ran 12 deterministic scenarios covering progress/checkpoint, sibling isolation, exact runtime destruction/reload, learner completion, guardian attestation, safety hold/clear, dynamic source gating, backup/reset/restore, completion reload, corrupt/future persistence refusal, and private-field exclusion.

## Negative controls

Automated controls detected or rejected every required regression:

- deleted production binding and material coverage;
- injected learner answer/scoring key or adult-only source reference;
- accidental Grade 6 admission;
- Student A state presented as Student B;
- learner-only certification of a guardian-authority lesson;
- dynamic Social start before source metadata;
- student resume/clear while an exact safety hold is open;
- refused IndexedDB write reported as advancement;
- malformed/future restore overwriting valid state;
- corrupt Study falling back to a fresh start;
- development/fake IndexedDB or Node-only dependency in the production chunk.

## Deferred hosted items

Explicitly outside this local ruling and not performed: master merge, PR, deployment, production hosting, hosted Supabase, hosted migrations, hosted Study state, server Tutor activation, and production network/service verification. They are not required for the audited device-local Family Pilot contract.

## Final ruling

`READY_FOR_FAMILY_PILOT`
