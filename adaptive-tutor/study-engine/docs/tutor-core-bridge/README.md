# Study Core Bridge v1.0.1

This bridge connects the canonical Study Engine v1 contracts to frozen
Adaptive Tutor Core v0.2.0 without changing either authority.

## Integration setup

1. Verify all four external ZIPs and the Tutor Core manifest with
   `bridges/tutor-core/scripts/verify-sources.mjs`.
2. Load Session 1's `inspectContractVersion` and
   `learningEvidenceSchema` through `createStudySchemaRegistryPort`.
3. Register explicit Study ID to Tutor stable-ID mappings. Never normalize a
   canonical Study ID.
4. Configure `UrgentSafetyClassifierPort`. Production must use
   `{ mode: "production", classifier }`; the deterministic classifier is an
   explicit local/demo fallback only.
5. Provide an atomic accepted-event ledger implementation. It must distinguish
   an identical idempotency-key replay from an event-ID collision.
6. Call only `orchestrateStudyCoreBridge` for an end-to-end learner event.
   Low-level validators, adapters, projectors, and hook builders remain
   integration primitives and must not be composed into an alternate
   production path.
7. Persist exact recovery state only through the declared sidecar ports.
8. Treat every unsupported version, event, unknown field, collision, or
   invalid safety result as a stop or quarantine. Do not coerce or guess.

The bridge source barrel is:

```text
adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts
```

## Non-negotiable call order

```text
transient learner text
  -> Unicode/whitespace normalization
  -> reviewed deterministic safety rules
  -> mandatory production safety classifier
  -> urgent/uncertain/invalid stop OR one-time clear permit
  -> Tutor Core callback exactly once
  -> frozen Core authority validation and permit consumption
  -> atomic accepted-event ledger
  -> minimized Study evidence
  -> canonical Session 1 schema validation
  -> Study-owned recommendation
  -> durable outbox proposal
  -> review/calendar/parent hook proposals
```

No Study projection or outbox proposal may be created before the ledger
accepts a new event. Identical replay returns `duplicate-ignored`; conflicting
content under the same event ID is quarantined. Both return zero outbox
proposals.

Urgent, uncertain, and invalid results never call Tutor Core and never receive
a permit. A proposed adult hook is not proof that an adult was contacted; its
delivery status is always `proposed-not-delivered`.

Validated Core spoken turns and visual commands are exposed only as a
sanitized transient `learnerMedia` projection on the verified wrapper. They
are not copied into persistence-bound Study evidence.

## Validation commands

Use Node 22 and the repository package manager:

```powershell
node --experimental-strip-types --test adaptive-tutor/study-engine/tests/tutor-core-bridge
tsc -p adaptive-tutor/study-engine/bridges/tutor-core/tsconfig.json --noEmit
```

The compatibility suite accepts `SESSION6_SOURCE_ROOT` to locate verified,
external extracted fixtures. Source ZIPs remain external and are never placed
in the bridge package.

The bridge-local `package.json` is the ESM boundary. The delivery does not
depend on a repository-root package file and contains no `node_modules`.

## Storage boundary

This package defines ports only. It does not implement a database, durable
queue, calendar, parent dashboard, authentication, authorization, messaging,
or production persistence.
