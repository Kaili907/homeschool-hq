# Learner Release Security + Privacy Acceptance R1

Status: **BLOCKED**

This was a read-only production audit. No production file was repaired. The only committed additions are the audit controls under `scripts/audit-learner-security/` and this evidence under `docs/learner-security/`.

## Assembly identity

- Base: `c81ddb6e04bc1c3629212327d47817c1b5677477`
- Synthetic assembly tree: `5fb7524024db1a5d7d348449c9b75ab08c77bf4a`
- Temporary assembly head: `fd3c2db8a8c80264953ba7ce0d628f4be16fdb2f`
- Supporting prerequisite used before the Arts repair: `796b4f1e1a7789f26ce85bcd0478e1e1651f113d`

The exact repair SHAs were applied in a detached temporary worktree:

1. `4350673d80284066918120157c994672f92c1c53` — FinLit
2. `c8f5a6b6b9b18317f96b5e2f92d453bde0f0b2b9` — Mathematics
3. `2d43cd014046ad6190d3bb0f672e3313897d63fd` — Technology
4. `d78c4f39b6ff97eba830135068c01d21f0893f46` — Arts and Music
5. `d161efc876ad7563505897323f80fdb2cb11d5a4` — ELA
6. `858fed9c55e49d03e6457cdf8bf3426dadbd1cd3` — Health
7. `dc2cee7fa16ea059218862d0dc42a2bee504269d` — Science
8. `9ab9860741566c2d02421fb36dc6c1eb0ddc9223` — Social Studies
9. `1651f72f222c002a857506ac8537951a9a77e698` — Physical Education
10. `520ce571e7a3e9dc8c60699cfae5f22ee10d56e2` — Assessments
11. `51792ba67bcc3ec79d35fd55063870b21da82d82` — Learner projection
12. `1d594411fc969f523b76f340fa388a4c24a0b5a2` — Scoring endpoint
13. `f8406fca39c33ba08616ff8ff41a6a0452de47e4` — Learner response runtime
14. `c759e23263078567ee47a9ac7bd1d34c1e98e119` — Learner release gate

Shared generated metadata conflicts were reconciled only in the temporary assembly so the exact repairs could be built and audited together.

## Acceptance results

| Surface | Result | Evidence |
| --- | --- | --- |
| Learner corpus | PASS | 8,292/8,292 lessons scanned; 0 direct answer fields; 0 lesson scoring locators |
| Assessments | BLOCKED | 699/699 scanned; 0 direct answers, but every package exposes `adultScoringAuthorityRef` and its restricted repository path |
| FinLit | PASS | 504 lessons; 0 direct pre-task answer disclosures; 0 scoring locators |
| Secrets | PASS | 0 service-role, Supabase secret, JWT-like service credential, or private-key literals in learner payloads/bundle |
| Scoring endpoint | PASS | Strict request shape and assignment/release/lesson/item binding; trusted contained paths; no caller answer; no answer returned; guardian remains pending |
| Production bundle | BLOCKED | 3 chunks contain answer-authority material; `index-DvIPLJfo.js` contains `http://localhost:9999` |
| Node/browser boundary | PASS | 0 Node `fs`/`process` browser leaks and 0 fake IndexedDB implementation in the built assets |
| Study bearer | PASS | 0 persistence findings; reference remains closure-only and is cleared on revoke/error |
| PIN handling | BLOCKED | 4 findings: plaintext AppState, learner profile sync upload, plaintext sync backup, portable backup PIN digest |
| Tutor privacy | BLOCKED | Raw messages plus `correctAnswer` persist in Profile, then the entire profile is uploaded by sync |
| Private learner notes | PASS | Mindset journal text remains in its separate learner-only local store and is not in AppState/profile sync |
| Backup | BLOCKED | Sync backup contains plaintext PINs, Tutor transcript, and adult answer authority; portable backup contains PIN digests; no bearer found |

### Endpoint evidence

The endpoint accepts only exact identifiers and a bounded response. Production package and scoring paths come exclusively from the trusted binding, must parse as Git-bound `curriculum-production/` paths, and are contained below that root. Both loaded documents must name the requested lesson; section/item resolution must match. Authorization binds the verified student session to the exact assignment, release, lesson, release version, and content hash. Learner projection recursively rejects answer/path authority keys. Results expose only assessment state/evidence kind and a receipt; guardian work remains `pending-guardian-attestation`.

The focused endpoint suite passed 14/14 adversarial tests, including wrong lesson/item/section, caller-supplied expected answer/index/path, exact assignment/release mismatch, answer omission, and adult/guardian authority behavior.

### Blocking evidence

- `curriculum-production/final/assessments/packages/**/*.json`: all 699 canonical learner packages include `adultScoringAuthorityRef` with the adult-authority repository locator.
- `dist/assets/Grade5MathPractice-DY2IJK7b.js`: browser practice generator contains `correctAnswer` and `answerIndex` authority.
- `dist/assets/index-DvIPLJfo.js`: main browser chunk contains `correctAnswer`/`answerIndex` authority and `http://localhost:9999`.
- `dist/assets/FinalFamilyPilotApp-Ck2Sup9e.js`: learner-facing Study logic contains `correctAnswer`/`expectedAnswer` authority.
- `src/types.ts`, `src/App.tsx`, `src/sync/engine.ts`: plaintext learner/parent PIN state is accepted; dirty learner profiles are uploaded whole.
- `src/tutor/tutorChat.ts`, `src/types.ts`, `src/sync/engine.ts`: raw Tutor messages, original problem/answer, and `correctAnswer` persist for 60 days and are uploaded with the profile.
- `src/sync/config.ts`: the safety backup serializes the complete AppState, including PIN and Tutor answer/transcript data.
- `src/study/family-pilot/final-app/backup.ts`, `state.ts`: the portable backup includes full app state and therefore `pinDigests`.

## Mutation controls

The audit suite passed 35/35 tests and killed 30/30 deliberate security mutants. Mutations cover all requested answer keys and locators; Supabase/service/private-key secrets; every endpoint binding and output guarantee; browser adult material, Node runtime, fake IndexedDB, local ports, and credentials; Study bearer persistence; and private-journal upload.

Run:

```sh
node --test scripts/audit-learner-security/audit.test.mjs
node scripts/audit-learner-security/audit.mjs --root /path/to/assembled/tree
```

The population audit intentionally exits nonzero while acceptance is blocked.

## Verification ledger

- `npm run build`: PASS; 549 modules transformed; 90 courses and 8,292 lessons projected.
- Assessment materialization validator: PASS; 699/699 materialized; reported answer leaks 0.
- Learner release audit: PASS, 19/19.
- Scoring endpoint Vitest: PASS, 14/14.
- Bundle/backup/final convergence focused Vitest: PASS, 40/40.
- Health/PE combined validator: PASS; 1,296 lessons and 135 assessments.
- PE execution tests: PASS, 3/3.
- Health learner-content audit: PASS, 324 lessons, 0 privacy/safety findings.
- Audit mutation suite: PASS, 35/35 tests and 30/30 mutants killed.
- Structured projection regression: FAIL, 4/5; its hard-coded projection totals are pre-repair values. The production build succeeds with the repaired totals, but the stale regression expectation is an additional acceptance blocker.

## Classification

`BLOCKED`
