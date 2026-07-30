# Privacy, Timezone, and Adversarial Validation Agent report

Date: 2026-07-29  
Status: adversarial suite passed; local lab only

## Owned changes

This agent changed only Card 8-owned files:

- `integration-labs/calendar-parent-runtime/privacy.ts`
- `tests/calendar-parent-runtime/adversarial-validation.test.ts`
- `docs/calendar-parent-runtime/privacy-report.md`
- `docs/calendar-parent-runtime/timezone-strategy.md`
- `docs/calendar-parent-runtime/agents/privacy-timezone-adversarial.md`

No Wave 1 contract, engine, Tutor Core, Study-UX, subject package, production
calendar, production parent dashboard, GitHub, Supabase, database,
authentication, identity, storage, deployment, package configuration, demo,
app, UI, or another agent's runtime source was edited.

## Audit targets

The read-only runtime targets were:

- `review-runtime.ts`
- `calendar-runtime.ts`
- `parent-runtime.ts`
- `privacy.ts`
- `romeo-runtime.ts`
- `card5-duration-policy.ts`
- `demo-scenarios.ts`
- `app.ts`
- the Card 8 package manifest, lockfile, TypeScript config, and existing tests

The canonical contracts and review engine were inspected read-only for version,
header, review, session, task-type, and private-record expectations.

## Findings resolved during audit

The read-only Romeo audit found credential aliases that were not yet rejected:
PIN, OTP/TOTP, MFA code/token, verification/recovery/auth/OAuth codes, CSRF
and session material, SAML responses, SSO tickets, and magic-link fields
and free-text assignments. The finding was routed to the Romeo Adapter Agent,
which hardened its owned module. This agent then added all corresponding
regression vectors; they pass alongside Basic/Bearer, password, nested
container, cyclic-object, URL, and update-smuggling cases.

After Card 5 arrived, this agent also reconciled `privacy.ts` to DEC-019:
parent-authored notes default to `parent-only`; teacher/tutor access never
widens that audience; adult operational events expose metadata only; and the
student projection is one frozen empty object with no note existence signal.

This pass also closed three audit-only gaps:

- sensitive source fields with underscore/hyphen aliases are classified as
  excluded rather than merely unknown, while their values remain absent;
- adult-private isolation traversal is cycle-safe and detects full bodies or
  direct excerpts of at least 24 characters without JSON-escaping blind spots;
- any non-empty or non-record student private-note projection now fails,
  including otherwise innocuous keys and cyclic shapes.

## Pass/fail matrix

| Requirement | Evidence | Result |
| --- | --- | --- |
| Canonical schema conformance | Current schema inspection, canonical review header/IDs, canonical study-task membership | Pass |
| PII/raw answer/transcript/diagnosis/hidden-score exclusion | Hostile recommendation projection, separator aliases, functional negative control, bypass audit | Pass |
| Adult-private authorization/isolation | Read/write denial vectors, learner/author mismatch, parent-only non-widening, frozen empty student projection, cycle/excerpt audit | Pass |
| Romeo credential smuggling | Nested object, `Map`, `Set`, cycle, PIN/OTP/TOTP/MFA/OAuth/CSRF/session/SAML/SSO/magic-link aliases, free text, Basic/Bearer, URL, update vectors | Pass |
| Duplicate review/calendar entries | Idempotent replay, changed-payload/reused-ID/semantic duplicate denial, repeated calendar collapse/conflict | Pass |
| IANA DST edge cases | Exact New York 2026 spring/fall boundaries, spring gap, both overlap instants | Pass |
| Host-timezone independence | UTC, Honolulu, and Tokyo host defaults | Pass |
| Deterministic traces | Scenario and recommendation traces compared byte-for-byte | Pass |
| Browser-safe public source boundary | Expanded static runtime scan plus production-mode Vite build and Node bundle audit | Pass |
| Mobile view-model invariants | One column, no tables, 10 controls, 44px targets, no private body | Pass |
| Explicit local toolchain | Manifest, lockfile, scripts/config imports, Node floor, and `tsconfig` for `@types/node`, TypeScript, Vite, Vitest, Playwright | Pass |

## Automated evidence

From `integration-labs/calendar-parent-runtime`:

```powershell
npm test
```

Result:

```text
6 test files passed
86 tests passed
16 adversarial-validation tests passed
strict TypeScript typecheck passed
Vite browser build passed
Node bundle audit passed
```

The suite includes the other Card 8 agent tests, so the adversarial checks ran
against the same assembled local runtime rather than an isolated mock.

## Determinism and timezone evidence

The audit changes the Node host `TZ` value inside a guarded test and restores
it in `finally`. Explicit household-zone results are identical under:

- `UTC`
- `Pacific/Honolulu`
- `Asia/Tokyo`

Expected New York resolutions are asserted exactly:

- `2026-03-08T01:59` -> `2026-03-08T06:59:00.000Z`
- spring gap `2026-03-08T02:30` -> rejected as
  `nonexistent_local_time`
- `2026-03-08T03:00` -> `2026-03-08T07:00:00.000Z`
- `2026-11-01T00:59` -> `2026-11-01T04:59:00.000Z`
- `2026-03-08T03:30` -> `2026-03-08T07:30:00.000Z`
- fall overlap `2026-11-01T01:30` earlier ->
  `2026-11-01T05:30:00.000Z`
- fall overlap `2026-11-01T01:30` later ->
  `2026-11-01T06:30:00.000Z`
- `2026-11-01T02:00` -> `2026-11-01T07:00:00.000Z`

## Privacy evidence

The malicious recommendation fixture includes source fields and text for:

- email/PII;
- raw answers and responses;
- verbatim transcript;
- diagnosis;
- hidden behavior score;
- credentials;
- unknown engine debug data.

The public projection contains none of their values. Sensitive paths are
reported without values, unknown paths are ignored, unsafe public text is
replaced with neutral language, and a second audit reports no issue on the
result. A deliberately tainted object that bypasses projection is detected.
Separator aliases such as `student_response`, `answer-text`,
`diagnostic_label`, and `private_engagement_index` are also excluded and
reported as sensitive paths. Functional text such as “Use a written response”
remains available.

Adult-private note bodies appear only in the audience-authorized private
projection. Unmatched learner, missing read permission, mismatched author
writes, teacher/tutor reads of parent-only notes, and teacher creation of a
parent-only note are rejected or filtered. Adult operational events include
only `noteRef`, category, author reference, and creation time for notes visible
to that adult. Full bodies and substantial direct excerpts are detected even
inside cyclic public structures. Empty and populated private repositories
return the same frozen student projection object, and the student boundary
rejects every non-empty shape, not only known metadata names.

## Residual risks and handoff

The detailed residual-risk list and production gates are in
`privacy-report.md`. The most important handoff points are:

1. Keep private notes on a distinct authorized storage/projection path.
2. Do not treat text regexes as a complete DLP system.
3. Never supply Romeo credentials; the adapter is a metadata boundary, not an
   authentication client.
4. Keep both household IANA zone and resolved instant; do not fall back to host
   local time.
5. Back in-memory idempotency with transactional uniqueness before any
   production integration.
6. Keep the passing strict typecheck in the release gate and also run the
   browser build/tests in the assembled package.
7. Keep the verified Card 5 DEC-012/014/017/018/019 parity fixtures in the
   release gate; Card 5 remains `PASS_WITH_BLOCKER` until Tutor Core is
   available.
