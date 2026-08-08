# Integration guidance for later ADMIN sessions

ADMIN-0 owns the shared vocabulary in `src/admin/contracts.ts` and the boundaries
in this directory. Later sessions conform to these names or raise an explicit
contract-change issue; they do not fork local enums.

## ADMIN-1: identity and authorization

- Implement the server-controlled assignment source linked to Supabase Auth,
  capability checks, route/API guard, RLS, revocation, and threat-case tests.
- Keep operator roles separate from household guardian roles and learner session
  capabilities. Parent PIN and client role claims never authorize Admin access.
- Route `/academy/admin` before the existing Academy learner parser.
- Return a typed authorization state containing the server-resolved role and
  capabilities. Do not return assignment-management internals unnecessarily.
- Use exact grants, fixed-search-path security-definer functions, default deny,
  and append-only role-change audit patterns already present in migrations.
- Do not implement telemetry, cost, or shell-owned presentation.

## ADMIN-2: operational telemetry

- Implement `AdminOperationalEvent` as a durable, append-only, privacy-minimized
  ledger with trusted writes and authorized Admin reads.
- Enforce event-type and metadata key/value allowlists at both application and
  database boundaries. Reject nested/arbitrary JSON and prohibited content.
- Reuse server-derived Academy household/learner references. System-scoped events
  are the only events with null household and learner references.
- Make writes idempotent and best-effort relative to learning state. Do not widen
  Study evidence/safety payloads or copy raw source data.
- Map existing safe error/recovery codes to canonical engine/result states while
  retaining bounded reason codes.
- Define retention by event category and test unauthorized reads plus failure
  isolation.

## ADMIN-3: AI and TTS cost ledger

- Preserve `academy_gateway_usage` and existing quotas; add a distinct immutable
  usage/cost ledger and effective-dated pricing catalog.
- Capture the verified account reference on every record. Resolve a household
  only from trusted relationships; never substitute account/user ID when the
  household is absent or ambiguous.
- Capture provider product/model IDs inside the gateways after trusted
  authentication/provider responses. Require logical tier for tiered Anthropic
  requests and use null for current TTS rather than a fabricated tier.
- Store cache-read and cache-write token quantities/rates separately. Do not trust
  browser identity, token, or cost fields.
- Keep learner Anthropic/TTS response shapes unchanged.
- Use database integers/BigInt and decimal-string JSON. Implement the frozen
  half-up component rounding rule and checked sums; never use floating-point
  money.
- Bind calculations to one immutable USD catalog version. Reject overlapping
  catalog/rate intervals and snapshot each component's selected rate/effective
  period; do not collapse them into one effective timestamp.
- Keep canonical operational result, billing disposition, and cost kind separate.
  Store null/unavailable when usage or pricing is unknown, not zero, and label
  calculated estimates separately from future invoice reconciliation.
- Record required app version and nullable-by-applicability engine/curriculum
  versions from trusted execution context.
- Bind duplicate/retry handling to a stable trusted execution key. Replay only
  when immutable facts match; reject different facts as a reconciliation
  conflict. Exclude prompts, responses, and audio from the ledger.

## ADMIN-5: shell and overview

- Consume one typed Admin Overview adapter/view model; do not query unrelated
  tables from individual cards.
- Render canonical engine and health states, including explicit `unknown`,
  `disabled`, zero-data, loading, and error states. Do not calculate misleading
  health/cost facts in the browser or fabricate metrics.
- Wait for ADMIN-1 authorization resolution before rendering sensitive data.
  Client route hiding is presentation only.
- Recognize `/academy/admin` before `parseAcademyPath`; keep learner Academy
  routing behavior unchanged.
- Show calculated spend as calculated/estimated. Provider internals appear only
  if an authorized Admin view contract intentionally includes them.
- Curriculum is browse-only in the initial shell. Display immutable versions and
  lifecycle state without adding editing/publishing controls.

## Cross-session integration checks

Before integration, verify:

1. imported enums/constants match ADMIN-0 exactly;
2. role/capability tests cover unauthenticated, learner, ordinary guardian,
   viewer, admin, owner, forged claim, and revocation cases;
3. no normal learner response gained provider or Admin fields;
4. no arbitrary JSON/free text entered telemetry, cost, or audit metadata;
5. all monetary paths use integer arithmetic and effective-dated prices;
6. health unknown/incomplete states remain explicit;
7. published curriculum stayed byte-for-byte unchanged; and
8. administrative mutations are server-authorized and atomically audited.
