# Final Family Pilot convergence evidence

Recorded 2026-08-13 for `mac/final-family-pilot-convergence-r1`.

## Classification

`FINAL_FAMILY_PILOT_APP_READY`

The feature-flagged `/family-pilot` route now boots the real local-first family app on a fresh browser profile. No hosted service was contacted or enabled while producing this evidence.

## Authoritative final input ledger

| Input | Accepted SHA |
| --- | --- |
| Final curriculum admission | `c321174f785ea9b358b7701bc100b7f67fc3a92b` |
| Final curriculum runtime | `fe3d9f2fbf29714c49fe95fd9396bb95a614810a` |
| Final Study composition | `00597916840d7b7c906008718c58f035bd2d7426` |
| Final readiness | `c6a21b0055963bbf0d4dbab96841df9ef819b0b1` |
| Final Math | `7eeb4b7bf258800c9ecfa8eb4873544d604f4d63` |
| Final Science | `a03811a6647409bff068c034b67a0140720a77fc` |
| Final Social Studies | `b8e9611ec37c5e66820f0efd2461d7cd2daa6807` |
| Final Health + PE | `c523a0c9748b340a871493afbf51276759d406ce` |
| Final Ready for Life | `8a6fd925e71f8f83035229df5fbcd099e9e24856` |
| Final Financial Literacy | `9f00acefc4d73b7efa29be7e4e49a3a8c3b0a9fa` |
| ELA production | `00374a8dc26eddfac2cf52aec5661deff760ddbb` |
| Technology/CS + Arts/Music production | `12d78e0f2d683b6a87321d096ec7cee627119622` |
| Canonical grade migration | `e647590b73fba920ce21e43eb0e12e99a7ec121c` |

The admitted Social ledger references 972 packages from `e6e7c34ee6045f50ef895f96d7e0044764582900`; that ledgered source commit is also preserved as an ancestor so every admitted package resolves.

## Accepted feature-delta ledger

| Feature | Source tip | Integrated commit |
| --- | --- | --- |
| Setup | `9e087b767322d950d235e7bf1383c33fc8db3102` | `109999fb` |
| Assignments | `33ee5d14c8bb87cd249cd72dffca300399365f4b` | `ddb033e3` |
| Schedule | `b6d273cf265c0d834590acf4015f9d0ef85be72c` | `56f54b41` |
| Home | `c6f1160bb72a68234518e765616823a654bdc56c` | `270d306a` |
| Lesson Player | `ab69fb02761668140728d60c529c2ef8ddbaa49a` | `a7486f0d` |
| Content bridge | `8b6cb7e7c9ec904fce06812b8d85f8271384741b` | `39bd0697` |
| Practice | `ef39fefbefc10e5916696a01aea83605c37e9b48` | `a9b49d67` |
| Parent assignment controls | `54ba93071550f8fba0d143b4f404b8f405127dd0` | `9f30078f` |
| Preferences | `1fcffde7bab72d08d69c83dd22f38994402d0f16` | `c7429ac7` |
| Focus guidance | `446f91928725e6199ce2b292cac73ab29bd50396` | `ae203aa7` |
| Reports | `b7893a09f03d85b3ebf3b6d7a46b64e5595a84ac` | `42920dbb` |
| Backup | `de9365910589613baa72f6f22b6932bb9b52e4a3` | `4b4210b6` |
| Recovery UI | `0d0ea1c02b887afd70784fbc84ead67e87233c2f` | `5d08a22d` |
| Safety | `d831479a29291472ed6f3d9fc1eb2038d54b2888` | `dfcce876` |

Legacy feature tips were inspected and imported as their missing feature deltas; final curriculum/runtime/readiness artifacts and the ledgered Social source were merged with their exact commits preserved.

## Admitted release and production bindings

- Release: `curriculum-release-admitted/family-pilot-r1`, release id `family-pilot-r1`.
- Admission: `ADMITTED`; classification `ADMITTED_PRODUCTION_BOUND_FAMILY_PILOT_R1`.
- Counts: 9 grades, 90 courses, 698 units, 8,292 lessons, 699 assessments.
- Supported grades: 3, 4, 5, 7, 8, 9, 10, 11, 12; Grade 6 returns no curriculum unless a supported per-subject working grade is selected.
- Exactly 10 production subjects and 10 courses per supported grade.
- Production bindings: 8,292 checked; missing packages: 0.
- Special authorities: 81 guardian-attested bindings and 12 dynamic-source Social bindings.
- Browser delivery: one eager release manifest and 90 lazy per-course payloads. Production material resolves per lesson; adult/scoring references and fields are rejected during generation.

## Runtime, storage, and state

- Study composition: `createFinalFamilyPilotStudyRuntime`, accepted at `00597916840d7b7c906008718c58f035bd2d7426` and wired through the existing Family Pilot Study transition engine.
- Storage: IndexedDB database `manuel-academy.study.family-pilot-durable`, version 1, object store `records`; validated household/student Study documents, student/assignment/attempt lesson-response documents, and student/assignment assessment-attempt documents. The legacy localStorage lesson-response array is migration input only.
- Device companion state is versioned and minimized. Corrupt state is quarantined; future state is read-only; safety-state damage recovers conservatively.
- Checkpoint, pause/resume, exact cold reopen, ordinary completion, RFL pending/attestation, Social source attachment, safety hold/clear, and sibling isolation use the same controller and student identity.
- Tutor help uses the existing Tutor gateway bridge when eligible and the accepted static curriculum fallback otherwise. Raw conversations are never included in durable state or backup. Server Tutor production routing remains disabled.
- Portable backup includes validated Core state, minimized companion state, and each student's exact IndexedDB Study document. Restore validates before writing and rolls back cross-store failures.

## Bundle proof

- `npm run build`: pass; 543 transformed modules.
- Generated browser data: 8,292 lessons in 90 lazy course JSON payloads (61 MiB generated, not embedded in JavaScript).
- Emitted final route chunk: `FinalFamilyPilotApp-B_m-uZMr.js`, 252,081 bytes minified / 66,201 bytes gzip.
- Final-route Rollup closure test proves the feature-flagged facade is emitted and excludes `localDevelopmentPorts`, fake/test IndexedDB, synthetic Study fixtures, Node curriculum loaders, and a Supabase Study provider.
- Emitted final route chunk contains none of: `node:fs`, localhost endpoints, `production-material:` lesson payloads, RC1 local learner identity, DEV-only runtime labels, or frozen demonstration Math identifiers.

## Test evidence

| Command/scope | Result |
| --- | --- |
| Focused final convergence integration | 9 passed |
| Full `src/study/family-pilot` project | 67 files, 784 tests passed |
| Full `npm run test:root-app` | 355 files, 4,011 tests passed |
| `npm run typecheck` | passed |
| `npm run build` | passed |

The convergence integration covers all 8,292 binding/material resolutions, supported/unsupported grade behavior, two-student isolation, assignment start and visibility, exact IndexedDB checkpoint reload, ordinary completion, RFL attestation, dynamic Social source readiness, scoped safety, Tutor static fallback, backup/restore, and corrupt/future fail-closed behavior. Route lifecycle and production bundle closure checks are included in the full root-app result.

## Deferred hosted-production items

- Hosted Study backend/Supabase Study storage is not configured or claimed ready.
- Server Tutor production routing is not enabled.
- No hosted migration, deployment, production hosting activation, or external service contact was performed.

There are no local Family Pilot app blockers within the requested family-pilot scope.
