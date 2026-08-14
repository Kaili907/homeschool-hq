# Web R3 Final Exact-Artifact Acceptance R1

Date: 2026-08-13 (America/Detroit)

Audit worktree: `mac/web-r3-final-acceptance-r1`

Audited commit: `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

Audited tree: `4479e7eef885253dd140bee138f0d8a73048bca9`

Final classification: `READY_FOR_NETLIFY_BRANCH_DEPLOY`

This was a single-agent, non-production, exact-artifact acceptance. The
worktree was clean before testing. No source or candidate fix was made. No
deployment, merge, production change, DNS change, or hosted service contact
occurred.

## Custody and population

| Gate | Result |
|---|---|
| HEAD | exact audited commit |
| Git tree | exact audited tree |
| Courses | 90 |
| Lessons | 8,292 ready; 0 blocked |
| Assessments | 699 ready; 0 blocked; 0 structural-only |
| Grades | 3, 4, 5, 7, 8, 9, 10, 11, 12 |
| Grade 6 | absent; negative control rejected admission |

The learner release and launch audits resolved every one of the 8,292
production bindings and learner materials. They also reported 699 runnable
assessment workflows, 0 adult-only browser leaks, and all quality negative
controls passing.

## Security and authority

`npm run audit:web-release` exited 0 with
`WEB_RELEASE_SECURITY_GATE PASS`. It scanned 338 browser files and reported
zero findings. The enabled artifact contained 4 JavaScript files, 322 JSON
payloads under course paths (90 final Family Pilot course payloads plus 232
legacy/default-app curriculum unit payloads), 0 source maps, and 0 workers.

All semantic finding counts were zero:

- browser correctness authority: 0
- learner PIN material: 0
- raw Tutor transcript material: 0
- service-role/private credential material: 0
- operational localhost endpoint dependency: 0
- unreviewed Netlify function surface: 0

The denied executable/data authority names `answerIndex`, `correctAnswer`,
`expectedAnswer`, `acceptedAnswers`, `solutionKey`, `answerKey`,
`answerKeyMap`, `correctChoice`, and `correctOption` each occurred zero times
in the production browser artifact. Instructional worked examples were
preserved and were not admitted scoring authority.

Real Chromium inspected the durable `manuel-academy.study.family-pilot-durable`
IndexedDB database and its `records` object store. Plaintext learner and parent
PIN values were absent from durable records, supporting local/session storage,
the portable backup, and network requests. Only one-way local verifiers remain.
No response body was written into the PIN/supporting-state store.

Static Tutor interaction remained transient. Raw Tutor conversation was absent
from the durable learner profile, IndexedDB records, supporting storage,
portable backup, network upload, and production bundle data.

## Storage, migration, and backup

Study durable documents, lesson-item response bodies, and assessment-attempt
response bodies were read back from IndexedDB `records`. Lesson and assessment
response stores survived runtime reconstruction and browser-process reopen
without localStorage authority.

The migration suite covered the whole legacy response array, multiple learners,
assignments, attempts, and conflicts. It verified durable readback, idempotency,
interrupted migration retry, duplicate prevention, and source removal only
after a verified migration marker. Real Chromium repeated the migration with
real IndexedDB, verified the response, removed the legacy source, reloaded, and
proved the result remained idempotent. Corrupt input stayed untouched and
failed closed. Raw learner-response duplicates left in localStorage after a
successful migration: 0.

The real Download Backup action produced a three-student backup. Inspection
proved no plaintext PIN, learner response body, Tutor transcript, bearer,
adult answer authority, service credential, or provider secret. Restore
succeeded in the original and a fresh persistent Chromium profile. Malformed
and future-version backups were rejected without mutating valid state.

## Route, feature flag, and browser acceptance

The enabled route graph was selected before normal-app initialization:

- Family Pilot static modules: 105
- forbidden legacy modules: 0
- accepted legacy adapters: 0
- legacy application entry in enabled build: absent

This excludes enabled-route initialization/import of Profile sync, browser
answer scoring and quiz generators, Tutor transcript persistence, and the Grade
5 legacy Practice scorer. The normal application remains unchanged when the
flag is off.

The flag is exact-literal and default-off. The normal production build passed
Chromium with Family Pilot OFF. The single controlled context
`mac/web-release-r3-convergence-r1` built with Family Pilot ON; production,
deploy previews, and unrelated branches remain off.

Persistent Chromium passed 11/11 tests with one worker. It covered setup,
learner selection, wrong/correct PIN authorization, assignments, schedule,
lesson response and completion, assessment submission, pending assessment,
reload, browser-process close/reopen, real IndexedDB refusal/readback,
backup/restore, and corrupt-state failure paths.

The matrix proof loaded all 9 grades x 10 subjects = 90 cells with complete
learner-safe structured material. It exercised `CHOICE`, `TEXT`, `NUMERIC`,
`CONSTRUCTED_RESPONSE`, `ACTIVITY_EVIDENCE`, `RUBRIC_REVIEW_PENDING`, and
`GUARDIAN_ATTESTATION`. It launched a representative lesson and assessment UI
for all ten subjects and audited all 699 assessment bindings/workflows. An
incorrect auto-scoreable response remained `PENDING_ASSESSMENT` with no answer
disclosure or fabricated correctness. Rubric and guardian authority remained
parent-only.

The complete browser workflow observed no external request. Every request was
to the local preview origin or a browser-local `data:`/`blob:` URL. This proves
there is no operational production dependency on localhost for app boot,
Tutor, scoring, sync, API, or storage; localhost was used only as the test
origin.

## Netlify package and trusted scorer

Netlify CLI 27.1.1 / `@netlify/build` 36.3.4 completed an offline build using
the exact controlled branch context. The package contains 31 function ZIPs and
one version-1 manifest with 31 entries. Forbidden callable test, fixture,
helper, debug, and resolver names: 0. `production-item-resolver` is not
callable; `production-item-assessment` is callable.

The packaged scorer ZIP contains 15,918 entries, including all 8,292 admitted
production bindings and server-only package/scoring authorities. The extracted
packaged entrypoint loaded successfully, returned 405 plus `Allow: POST` for a
non-POST method, returned 404 for the resolver path, and returned 503 when
trusted authority was unavailable. The focused scorer/function suite passed
17/17 and proved strict input, trusted session/assignment/lesson/item binding,
wrong-binding failure, caller-supplied answer-authority rejection, incorrect
non-disclosure, offline pending behavior, and rubric/guardian boundaries.

Browser artifact SHA-256 tree:
`98adc32bab354576717ed1666bfc6b3c33d9aa77fbb73edaad727c6efdfb6485`

Packaged function artifact SHA-256 tree:
`02a0f06dfb20651e94eed0d3b186a8ffd39403524c49edf7524052d0292a8417`

`production-item-assessment.zip` SHA-256:
`92f3c7774d3dd66b66a648b5883bf3c383233742cdda4483dacfd51f69761ad9`

## Independent command evidence

| Command/proof | Result |
|---|---|
| `npm run audit:web-release` | PASS / exit 0 |
| `npm run test:web-release-gate` | PASS, 11/11 |
| `npm run test:learner-release-gate` | PASS, 22/22 |
| `npm run audit:family-pilot-runtime-isolation` | PASS |
| `npm run typecheck` | PASS |
| focused R3 convergence suite | PASS, 14 files / 79 tests |
| complete Family Pilot + assessment suite | PASS, 84 files / 899 tests |
| complete Netlify suite | PASS, 95 files / 1,845 tests |
| focused scorer/function-surface suite | PASS, 2 files / 17 tests |
| enabled persistent Chromium | PASS, 11/11 |
| default-off Chromium | PASS, 1/1 |
| exact Netlify branch-context package | PASS, 31 ZIPs / 31 manifest entries |
| packaged scorer direct invocation | PASS |
| `npm audit --omit=dev --json` | PASS, 0 production vulnerabilities |

Before the valid run, the web gate failed closed because this fresh worktree
had no installed local dependencies. `npm ci` installed the lockfile-pinned
toolchain, after which the gate passed. A first concurrent execution of two
curriculum-generating test commands caused a transient generated-file race;
the affected gates were regenerated and rerun sequentially, passing 22/22 and
899/899. Neither event changed the candidate and neither result is counted as
acceptance evidence.

## Decision

Exact SHA `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9` is safe and
operationally ready for a non-production Netlify branch deploy as the Manuel
Academy Family Pilot branch.
