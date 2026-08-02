# Session 3 adversarial, privacy, and accessibility review

Date: 2026-07-28  
Reviewer role: independent Session 3 adversarial reviewer  
Owned scope reviewed:

- `ai-safety/**`
- `app/features/ai-safety-center/**`
- `tests/ai-safety/**`

No shared tutor, identity, profile, parent hub, `src/**`, Supabase, or other
session-owned implementation was modified by this review.

## Review outcome

The safety core and browser prototype pass the independent adversarial and
static accessibility test files. Review findings affecting student isolation,
retention/deletion, export privacy, runtime validation, false-positive state,
region naming, contrast, and focus visibility were reported to the authoring
agents and corrected inside the Session 3 owned paths.

The implementation remains integration-ready rather than production-bound
because the shared host does not provide the household/identity and Tutor Core
contracts documented in `ai-safety/core-change-requests.md`.

## Final review gates

```text
npx tsc --noEmit -p ai-safety/tsconfig.json
PASS

npx tsc --noEmit -p tests/ai-safety/tsconfig.json
PASS

npx tsc --noEmit -p app/features/ai-safety-center/tsconfig.json
PASS

npx vitest run tests/ai-safety
Test Files  7 passed (7)
Tests       99 passed (99)

npx vitest run app/features/ai-safety-center/model.test.tsx
Test Files  1 passed (1)
Tests       5 passed (5)

npm run build  (from app/features/ai-safety-center)
PASS — 38 modules transformed
```

## Independent tests added

### `tests/ai-safety/adversarial-privacy.test.ts`

Coverage:

- forged authentication, role, relation, permission, and request actor fields;
- student attempts to use a forged authorized-student list;
- cross-student transcript search and event filtering;
- non-enumerating authorization failures;
- same event/review/deletion-request IDs across students;
- instructional versus safety query/export separation;
- student export redaction of parent/reviewer actor IDs;
- clear self-harm, immediate-danger, and unsafe-situation escalation;
- benign homophone behavior;
- conservative schoolwork-quotation match through false-positive acceptance
  and reopening;
- all withheld-reason refusal templates across all age bands;
- no input-text duplication in materialized emergency events;
- numeric retention literal enforcement;
- retention/deletion collision and hold behavior;
- instructional-only deletion with unrelated open review;
- unavailable versus confirmed-empty history;
- raw-audio flags/retention; and
- invented hotline/service-contact claim detection.

Targeted result:

```text
Test Files  1 passed (1)
Tests       24 passed (24)
```

### `tests/ai-safety/ui-accessibility.test.tsx`

Coverage:

- all five parent and four student sections rendered to static HTML;
- unique IDs and resolved ARIA/label/fragment references;
- named form controls and explicit button types;
- skip link, named nav, current section, and main landmark;
- role-specific control exclusion;
- non-color severity/status communication;
- optional student report narrative and pause control;
- parent-review/tutor-message safety-exception copy;
- fixed summary-only parent notification copy;
- unavailable-history fallback;
- trusted-adult copy with no invented number or audio player;
- text fallback when playback is unavailable;
- focus, target-size, contrast, reduced-motion, forced-color, and responsive
  CSS safeguards.

Targeted result:

```text
Test Files  1 passed (1)
Tests       21 passed (21)
```

## Findings and disposition

| Severity | Finding | Disposition |
| --- | --- | --- |
| High | Review and deletion-request upserts keyed only by opaque ID could replace a sibling's colliding record | Fixed with composite student-plus-ID replacement and regression |
| High | Global kept-event ID sets could retain a target notification/review because a sibling had the same event ID | Fixed with target-student kept-event sets and regression |
| Moderate | Student all-data export exposed audit actor IDs and non-student block-lift actor IDs | Fixed: student audit export omitted and lift metadata removed; regression added |
| Moderate | Authorized parents/reviewers could lift a student tutor block without a management/review capability | Fixed with role-specific permission checks and negative regressions |
| Moderate | Eligible closed review items survived safety deletion | Fixed while preserving queued/in-review holds |
| Moderate | Instructional-only deletion could be marked partial because of an unrelated open safety review | Fixed by applying holds only to requested safety deletion |
| Moderate | Retention validator coerced strings into accepted duration values | Fixed with numeric integer literal checks |
| Moderate | Reopening a resolved false-positive review left an own `resolvedAt: undefined` value | Fixed by reconstructing without the field; JSON-safety regression added |
| Moderate | Multiple UI regions had unresolved `aria-labelledby` targets | Fixed by requiring/passing heading IDs |
| Moderate | Muted small text missed 4.5:1 on tinted surfaces | Fixed by darkening the token; contrast regression added |
| Moderate | Programmatically focused main content suppressed its visible outline | Fixed with a visible main-focus treatment |

## Explicit tenant/household assessment

`SafetyPrincipal` and safety records contain no `householdId`. All isolation in
this package is based on a host-supplied authorized-student projection and
student IDs. That is acceptable only as the documented temporary prototype
boundary. It cannot distinguish two households with the same student ID and
must not be treated as a standalone production tenant boundary.

Production remains blocked on `S3-CCR-01`: authenticated household principal,
household-plus-student resource binding, relationship verification, storage/RLS
enforcement, and cross-household query/command tests.

## Emergency and false-positive assessment

Clear first-person/unsafe-language fixtures pause tutoring and produce
`critical` / `human-safety-review` events with:

- no diagnosis;
- no hotline information;
- no emergency-service contact claim;
- no input text copied into the event;
- a trusted-adult instruction; and
- a stopped learning session.

The local matcher intentionally favors sensitivity. A literature quotation can
match. The false-positive workflow permits a student or parent to submit a
structured reason such as `schoolwork-quotation`, records the authentic actor,
allows a scoped reviewer decision, and can reopen a resolved item without
creating invalid JSON state.

The regex layer is not complete for obfuscation, multilingual text, or nuanced
context. It must be combined with the future verified Tutor Core/model-output
bridge and operational human review.

## Data-separation assessment

- Transcript text exists in instructional history only.
- Safety events store safe summary, classification, escalation, withheld
  reason, and evidence references.
- Audit records store structured actions/reasons, not transcript bodies.
- Search and UI filters for instructional history and safety events are
  separate.
- Export scopes do not silently combine instructional and safety records.
- Human-review assignments/history are excluded from exports.
- Student exports exclude parent/reviewer actor identifiers.
- Raw microphone recordings and audio URLs are absent.

## Privacy findings

See `ai-safety/privacy-notes.md` for the full inventory and role matrix.
Important remaining integration decisions:

1. Add household/tenant binding before production.
2. Keep notification transcript excerpts fixed off.
3. Do not generalize tutor-message safety-exception copy to the separate
   mindset journal; this center does not collect journal text and no bridge is
   implemented.
4. Decide whether a parent export needs opaque audit actor IDs or can expose
   role-only/pseudonymous data.
5. Resolve notification recipients from an authorized host-side family
   relationship and reauthorize at delivery; never trust a client-supplied ID.
6. Define host retention for completed request/audit records and document the
   operational review hold.

## Accessibility findings

See `ai-safety/accessibility-review.md`. Static WCAG 2.2 AA-oriented review is
complete. Browser keyboard, screen-reader, zoom/reflow, Windows high-contrast,
and device speech-synthesis checks must be repeated after integration into the
host shell.

## Residual integration needs

- Authenticated actor/household/student contract and server-side authorization
- Verified Tutor Core turn/transcript/safety directive bridge
- Stable subject mapping across tutor surfaces
- Persisted store validation and tenant-aware keys
- Parent notification delivery adapter
- Human-review operational ownership and monitoring
- Export/download transport and deletion worker
- Mindset-journal boundary clarification (no text is currently collected here)
- Production browser accessibility and end-to-end authorization tests
