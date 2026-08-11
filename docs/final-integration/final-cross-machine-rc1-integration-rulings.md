# Final Cross-Machine RC1 Integration Rulings

This record captures semantic decisions made while composing Mac Final RC4,
Windows Final Admin Delta RC1, and Windows Final Study RC1. Source custody and
the approved filename allocation remain recorded in the source manifest and
migration proposal beside this file. Hosted migration status remains
unverified; none of these changes authorizes hosted application.

## Product and runtime authority

- The Mac Admin Console, navigation, Curriculum Studio, access/learner/safety
  operations, correlation tooling, and hardened server contracts remain the UI
  and authorization foundation.
- Windows Admin runtime enforcement, bounded aggregate reads, exact
  IntegerMicros cost handling, Provider Pricing, scalable System Health, and
  Study Operations are composed onto that foundation. Provider coverage,
  calculated cost, and invoice truth remain distinct states.
- Windows Study remains authoritative for the production Study mount,
  Effective Settings V2, immutable release/session binding, Session Semantics
  V2, adult-review worker composition, worker evidence, and telemetry outbox.
- Production provider use and TTS synthesis fail closed when effective
  configuration is missing or malformed. Public logical-voice catalog reads
  remain safe, while catalog availability does not imply synthesis readiness.
- Curriculum registry reads accept both the original Study
  `study_new_sessions` projection and the final governed
  `default_authority` projection. Study never falls back to preview content.
- The canonical incomplete group reason is `source_group_incomplete`.

## Migration identity

- The canonical union contains 50 migrations with one globally unique version
  and one manifest entry per SQL file.
- The integration selects the Admin-adjusted
  `20260810120200_academy_study_effective_settings_v2.sql` and removes the
  superseded `20260810120000` duplicate.
- Five collision members move without content changes to `20260810140100`,
  `20260810150100`, `20260810151100`, `20260810153100`, and
  `20260810155100`. All live references use the canonical identities.
- Three migrations then receive explicit post-allocation semantic composition;
  their final normalized checksums are authoritative in the final manifest:
  `20260810151100` (`b0033d7337770abb5c68fc1330d3a0fc73ee733538115899461ce0020f0a998f`),
  `20260810153000` (`19723ade505bb820df3940cd796ade5ee532a2e93b4f03d6266b936fd2e89409`),
  and `20260810170000` (`52fcfa64a45fe139bf2a57b9f40aa96c3f26e8a07f75d6466e9aa4f6e3a00bd8`).

## Provider accounting composition

The Study safety migration originally replaced the public V1 provider-usage
function after the Admin delta had installed exact effective-dated pricing.
That replacement would have discarded Provider Pricing authority. The final
composition moves the established V1 function to a non-browser private path,
keeps the public V1 RPC stable, routes Study safety to the exact-pricing V2
seam, delegates Tutor/Jarvis/TTS to the preserved legacy implementation, and
retains service-role-only execution. No provider price is invented.

## Curriculum pointer composition

The Study bridge represented curriculum authority as two append-only pointer
rows. The later Admin activation contract requires one governed current row
and a separate immutable transition journal. The final activation migration
copies both Study rows into the immutable journal, retains the bridge
transition explicitly, converges the current pointer to `default_authority`,
and preserves its revision. Subsequent activation/rollback updates remain
CAS-governed and append immutable transition evidence. The Study resolver and
readiness probe accept the governed trigger and default authority, so new Study
sessions continue to bind to the current published release while existing
session pins remain unchanged.

## Final local-gate reconciliation

- Authenticated Anthropic gateway requests initialize bounded operational
  telemetry before request/configuration validation, using system-scoped
  authority until entitlement resolves. Malformed authenticated requests are
  therefore observable without fabricating household attribution; successful
  entitlement upgrades later telemetry and provider-attempt evidence to the
  trusted household authority.
- The Admin browser harness accepts an isolated port and validates static-file
  containment with `node:path` relative-path semantics. This preserves the
  traversal boundary on both Windows and POSIX instead of returning the SPA
  shell for every Windows asset path.
- The Admin R3 local evidence ledger now reflects the composed aggregate
  reader, Provider Attempt Journal, four instrumented provider paths, bounded
  reconciliation projection, Study safety accounting, and curriculum registry.
  It deliberately retains three activation blockers: verified account pricing,
  hosted ledger operation, and approval of the Study telemetry delivery
  cadence. Missing production environment values remain a separate unified
  preflight blocker.

## Safety hold

No Admin step-up implementation is invented or imported. Critical Admin writes
remain blocked by production preflight until reviewed step-up/MFA assurance is
integrated. The unsafe shared bearer helper and pending Session Runtime
candidate are excluded.
