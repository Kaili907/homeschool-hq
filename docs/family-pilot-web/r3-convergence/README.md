# Family Pilot Web Release R3 Convergence

Date: 2026-08-13

Branch: `mac/web-release-r3-convergence-r1`

Authoritative base: `7baf8dfbc27168708ed4cf504285a1838d7345f6`

Classification: `WEB_RELEASE_R3_READY`

Deployment decision: `BRANCH_DEPLOY_READY`. No deployment, production-branch
change, DNS change, hosted Supabase contact, or URL prediction occurred.

## Release result

| Gate | Result |
|---|---|
| Corpus | 90 courses; 8,292 lessons; 699 assessments |
| Lesson quality | 8,292 ready; 0 blocked |
| Assessment quality | 699 ready; 0 blocked |
| Final acceptance fixes | Preserved, including structured rendering, complete Social source validation, parent authorization, Arts projection, and expanded Chromium acceptance |
| Enabled route graph | Dedicated browser root selected before legacy initialization; `LegacyApp` absent from the enabled build; 0 forbidden Family Pilot modules |
| Default behavior | Family Pilot OFF unless the value is exactly `true`; enabled only in the exact named Netlify branch context |
| Learner responses | Study documents, lesson-item response bodies, and assessment-attempt bodies are authoritative in IndexedDB |
| Legacy response migration | Whole-array, multi-student, multi-assignment, multi-attempt migration; conflict-safe, idempotent, verified before source removal, fail-closed on corruption |
| Browser answer authority | 0 admitted authority and 0 occurrences of all nine denied executable authority names |
| PIN security | No plaintext PIN persisted or exported; only one-way local access verifiers remain |
| Tutor privacy | Production static help has no conversation-bearing field; no raw Tutor conversation persists or exports |
| Backup privacy | No plaintext PIN, raw learner response body, raw Tutor conversation, bearer, adult answer authority, or service-role credential |
| Trusted scorer | `production-item-assessment` remains the sole callable production-item scorer; the resolver is internal only |
| Netlify callable surface | Exactly 31 reviewed functions; 0 test, fixture, helper, debug, or resolver endpoints |
| Browser output | 338 files; 4 JavaScript files; 322 course payloads; 0 source maps; 0 workers; 0 web-security findings |
| Web release security gate | PASS / exit 0 |
| Enabled Chromium | PASS, 11/11 |
| Default-off Chromium | PASS, 1/1 |
| Netlify branch build | PASS, offline exact branch context; 31 ZIPs and 31 manifest entries |
| Production dependency audit | 0 production vulnerabilities |

## Architectural convergence

`src/main.tsx` selects the enabled Family Pilot browser root before importing
the normal application. The enabled artifact therefore excludes legacy Profile
sync, legacy answer evaluators and generators, legacy Tutor persistence, and
legacy Practice scoring. The default build loads the normal application, whose
legacy behavior is retained behind the lazy `LegacyApp` boundary.

Learner-safe generated course data remains browser-readable, but all admitted
production correctness authority is absent. The Netlify scorer derives its
authority from the admitted manifest, bindings, production packages, and
scoring files bundled only into `production-item-assessment.zip`. Incorrect or
offline browser work never fabricates correctness or discloses an answer.

Final Family Pilot response bodies use verified IndexedDB writes and readback.
Approved minimized localStorage state remains limited to roster, assignment and
progress metadata, session references, safety/attestation metadata,
preferences, and one-way local access verifiers. Portable backup excludes raw
learner responses and Tutor conversation data.

Exact input handling is recorded in `INPUT_LEDGER.md`. Exact final bundle and
function artifact hashes are recorded in `BUNDLE_FUNCTION_AUDIT.json`. Commands
and acceptance counts are recorded in `TEST_EVIDENCE.md`.
