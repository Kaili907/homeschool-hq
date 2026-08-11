# Manuel Academy Admin Console architecture

Status: controlling ADMIN-0 contract, version 2. Version 2 refines only the
provider usage/cost shape; the authorization, telemetry, health, routing, audit,
and curriculum decisions remain unchanged.

The Admin Console is an authenticated operator surface at `/academy/admin`. It
will aggregate operational views and narrowly approved controls without becoming
a second identity system, a raw learner-data warehouse, or a curriculum editor
that can mutate a published release.

This area freezes shared vocabulary and boundaries. It does not create an admin
route, role assignment table, telemetry ledger, cost ledger, or dashboard UI.
Those implementations belong to later ADMIN sessions.

## Existing primitives to reuse

- Supabase Auth remains the adult/operator identity root. The gateway already
  derives its account identity from a verified bearer token in
  `netlify/functions/_shared/supabase-auth.js`.
- `academy_households`, `academy_household_memberships`, `academy_students`, and
  `academy_guardian_student_access` remain the Academy household and learner
  model. A guardian membership or Parent Hub PIN is not an admin assignment.
- Existing migrations demonstrate the required database posture: explicit
  grants, enabled and forced RLS where appropriate, fixed `search_path` on
  security-definer functions, RPC-only mutation, append-only audit history, and
  revocation checks on every authorization decision.
- `academy_gateway_usage` remains the request-quota counter. It is not a cost
  ledger and must not be stretched into one.
- The Anthropic and TTS gateways keep provider credentials, provider model IDs,
  and billing details server-side. Their learner responses must remain unchanged.
- Study event, safety, monitoring, persistence, and audit contracts provide
  useful minimized-event and fail-closed patterns. Admin operational telemetry is
  a separate cross-engine projection and must not replace Study's learning
  evidence or safety records.
- Curriculum source releases under `curriculum-content/manuel-academy/<version>`
  are immutable inputs. `scripts/build-curriculum.mjs` validates them and emits a
  student-safe projection with protected instructional fields removed.
- Existing feature flags are exact-string, default-off gates. They are deployment
  controls, not authorization.
- Sync and Study persistence already surface conflicts, pause on uncertain
  ownership, use revisions/idempotency, and fail closed for protected state. Admin
  health views should report those outcomes; they must not bypass recovery flows.

## Logical boundaries

1. The browser requests an Admin API using its authenticated Supabase session.
2. The server verifies the token and loads the current active admin assignment
   from server-controlled storage. Client role claims are ignored.
3. The server checks one canonical capability for the requested resource and
   action, then reads a purpose-built aggregate or executes a narrow control.
4. Operational telemetry and usage records contain references and bounded
   measures, never learner content.
5. Every administrative mutation appends an audit event in the same transaction
   or fails.

Admin APIs should own query composition. UI components consume typed view models;
they must not scatter direct queries across unrelated Academy tables.

## Route ownership

`/academy/admin` is a sibling operator surface, not a learner Academy subroute.
The current `parseAcademyPath` intentionally sends unknown `/academy/*` paths to
the Academy home screen, so ADMIN-1/ADMIN-5 must recognize the exact admin prefix
before invoking the existing learner route parser. The UI may hide navigation,
but only the server/API and database policies authorize data or actions.

## Contract index

- [Production release and rollback runbook](production-release-runbook.md)
- [Local production release rehearsal](production-release-rehearsal.md)
- [Authorization](authorization.md)
- [Telemetry and privacy](telemetry-privacy.md)
- [AI and TTS cost accounting](cost-accounting.md)
- [Engines and health](health-engines.md)
- [Administrative audit](audit.md)
- [Curriculum and versioning](curriculum-versioning.md)
- [Curriculum standards human review](curriculum-standards-review.md)
- [Curriculum draft collaborators](curriculum-draft-collaborators.md)
- [Curriculum human approval](curriculum-human-approval.md)
- [Curriculum release staging](curriculum-release-staging.md)
- [Integration guidance](integration-guidance.md)
- Shared TypeScript vocabulary: `src/admin/contracts.ts`

## Non-goals for ADMIN-0

No production schema, hosted configuration, route, UI, authorization helper,
telemetry writer, pricing catalog, gateway mutation, curriculum draft store, or
published curriculum change is part of this contract freeze.
