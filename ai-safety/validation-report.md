# Session 3 validation report

Date: 2026-07-28  
Workspace: `C:\Users\Empower Gaming\homeschool-hq`

## Completion gates

| Gate | Command/evidence | Result |
| --- | --- | --- |
| Root typecheck | `npm run typecheck` | PASS |
| Safety core/test typecheck | `npx tsc -p ai-safety/tsconfig.json` | PASS |
| Independent test typecheck | `npx tsc -p tests/ai-safety/tsconfig.json` | PASS |
| UI typecheck | `npx tsc --noEmit -p app/features/ai-safety-center/tsconfig.json` | PASS |
| Runtime/schema validation | `npx vitest run tests/ai-safety` plus JSON parse check | PASS |
| Parent/student authorization | Safety suite | PASS |
| Cross-student isolation | Safety suite, including same-ID collision probes | PASS |
| Safety escalation | Safety suite emergency/refusal matrices | PASS |
| Retention and deletion | Safety suite retention/deletion probes | PASS |
| Accessibility review | 21 static/semantic tests plus live browser review | PASS |
| UI model tests | `npx vitest run app/features/ai-safety-center/model.test.tsx` | 5/5 PASS |
| Full safety tests | `npx vitest run tests/ai-safety` | 99/99 PASS, 7 files |
| Existing canonical tests | `npm test -- src --exclude ".worktrees/**" --reporter=dot` | 506/506 PASS, 33 files |
| Standalone UI build | `npx vite build app/features/ai-safety-center` | PASS, 38 modules |
| ZIP verification | archive listing, path allowlist, entry-count and SHA-256 checks | PASS; see handoff |

No test in the reported suites was skipped.

## Schema evidence

Strict runtime validators cover conversation sessions, safety events, parent
notifications, tutor permissions, retention policies, and export/deletion
requests. Valid fixtures and adversarial mutations run through those
validators.

Five checked-in JSON documents parsed successfully and identified Draft
2020-12:

- `conversation-session.v1.schema.json`
- `data-request.v1.schema.json`
- `parent-notification.v1.schema.json`
- `safety-event.v1.schema.json`
- `tutor-permissions.v1.schema.json`

The tests also verify registry IDs, required fixed privacy fields, closed enum
vocabularies, unknown-key rejection, chronology, numeric limits, JSON safety,
and emergency-event invariants.

## Authorization/isolation evidence

Negative tests cover unauthenticated actors, unsupported roles, missing
capabilities, unauthorized students, forged student authorization lists,
forged request actors, sibling keyword searches, mixed stores, and colliding
event/review/request IDs. Student exports exclude reviewer/parent actor
identifiers. Parent and reviewer block-lift operations require their specific
management/review capability.

The package still relies on the host for household binding; that production
blocker is documented in `core-change-requests.md` and `threat-model.md`.

## Safety/privacy evidence

The policy matrices cover:

- direct-answer and detected answer-leak withholding;
- subject, time, session, capability, and student-block denials;
- harmful, age-inappropriate, privacy, prompt-injection, medical-boundary, and
  legal-boundary requests;
- first-person potential self-harm, immediate danger, and unsafe-situation
  language;
- trusted-adult copy across all age bands;
- no diagnosis, hotline number, external-service contact claim, or raw input
  duplication in emergency events; and
- student/parent false-positive request and scoped reviewer resolution.

Retention/deletion probes verify sibling preservation, active-review and
student-block holds, correct partial receipts, eligible closed-review removal,
and separate instructional/safety/audit periods.

## Accessibility and browser review

The static suite renders all five parent sections and four student sections. It
checks semantic references, labels, button types, landmarks, role-specific
control exclusion, text severity, optional report narrative, missing-history
copy, playback text fallback, 44px common targets, focus, contrast, reduced
motion, forced colors, and responsive safeguards.

The standalone prototype was then exercised in the in-app browser:

- parent overview, searchable history, transcript/tutor-help timeline, safety
  events, permissions, retention/export/deletion, review queue, and audit;
- student overview, own history/notices, report-without-narrative, and pause;
- explicit unavailable-history state, not a false empty result;
- 390px-wide responsive view with no horizontal overflow;
- visible focus treatment on programmatically focused main content; and
- no browser console warnings or errors.

Production screen-reader, 200%/400% zoom, Windows high-contrast, and on-device
speech-synthesis checks remain host-integration gates.

## Existing-suite runner note

The unqualified root `npm test` discovers tests inside ten unrelated
`.worktrees/**` directories because the shared root Vite configuration has no
test exclusion. The initial unqualified run exceeded two minutes in one of
those external worktrees. No shared configuration was changed because it is
outside Session 3 ownership.

The canonical existing application suite was therefore run explicitly through
the existing npm script with `src` scope and `.worktrees/**` excluded; all 506
tests passed. The new owned suites were run independently and all passed.
