# Admin authorization security red-team — MAC-ADMIN-W7-3

Date: 2026-08-10

Base: `cf9d2bb9d8ca1a0a4a4c64cb245df6fe5d4afd64`

Branch: `mac/admin-security-redteam`

Hosted changes: none

## Classification

`ADMIN_SECURITY_SAFE_WITH_FIXES`

This classification applies to the reviewed repository state only. The
corrective migration remains `not-applied-hosted` and this review authorizes no
deployment, hosted migration, push, or merge.

## Confirmed findings and fixes

### ASR-01 — stale Owner authorization during configuration commit

- Severity: High.
- Surface: `academy_admin_commit_configuration_change_v1`.
- Root cause: the RPC resolved and cached the actor's Owner assignment before
  locking configuration heads, but did not lock or reauthorize that assignment
  at the durable write point. A concurrent Owner-authorized demotion could win
  after the initial check. The commit could then retain the stale Owner
  snapshot while the audit helper independently observed the actor's new Admin
  assignment, allowing an Owner-only configuration write with inconsistent
  audit authority.
- Fix: migration
  `20260810153000_academy_admin_configuration_reauthorization.sql` adds a
  fixed-search-path, ungranted write-point trigger. It locks the current
  assignment, requires a current Owner, and requires the new revision's actor
  user, assignment, and role snapshot to match. Losing the race now raises
  `ADMIN_CONFIGURATION_MANAGE_REQUIRED` and rolls back every mutation and audit
  side effect.
- Regression: `supabase/admin-config.db.test.ts` adversarially changes the
  assignment after the RPC's initial authorization and proves the revision,
  head, receipt, assignment change, and audit append all roll back.

### ASR-02 — ambiguous Safety Operations query state accepted

- Severity: Low.
- Surface: `GET /api/admin/v1/safety-operations`.
- Root cause: non-object query representations were converted to empty objects,
  and conflicts between raw, single-value, and multi-value representations were
  not reconciled. Malformed or duplicated scope/filter state could therefore
  be accepted as a different default query rather than rejected.
- Fix: all supported query representations are now type-checked, limited to
  one value per allowlisted key, reconciled byte-for-byte, and rejected on
  duplicates or disagreement.
- Regression: endpoint tests cover malformed containers, duplicate values,
  conflicting scope values, raw-query disagreement, and the consistent case.

## Attack matrix

| Attack | Result after fixes | Evidence |
| --- | --- | --- |
| Forged browser role/capability | Denied; database role is authoritative | Dedicated endpoint matrix; authorization unit and DB suites |
| Forged household/principal identifier | Rejected where unsupported; accepted safety filters remain UUID-bounded Admin-wide filters | Learner and Safety endpoint/reader suites |
| Viewer calling management endpoint | Denied before source access | Dedicated red-team endpoint test |
| Admin calling Owner-only configuration mutation | Denied at server boundary and DB RPC | Dedicated endpoint test; configuration DB suite |
| Admin attempting Owner access mutation | Denied at server boundary and DB RPC | Dedicated endpoint test; access DB suite |
| Revoked/expired Admin session | No current assignment; denied | Authorization, endpoint, audit, and DB suites |
| Stale assignment / role changed during request | Configuration commit now linearizes on locked current Owner assignment; access already reauthorized after locks | ASR-01 regression; access DB suite |
| Direct RPC invocation | Authenticated mutation RPCs rederive `auth.uid()` and role; service-only RPCs reject authenticated callers | Authorization/access/config/audit DB suites |
| Direct table access | No application-role grants; forced default-deny RLS on sensitive tables | Authorization/access/config/audit DB suites |
| Prohibited application/service RPC invocation | Exact grants and internal role/trusted-server predicates deny misuse | DB grant probes |
| CAS/replay privilege confusion | Revision, actor-bound request receipt, immutable digest, and confirmation binding reject conflict/reuse | Access/config DB suites |
| Cross-account access | Learner reads remain pinned to the verified Admin bearer and profile RLS; Admin-wide operational filters are bounded canonical DTOs | Learner reader and Safety suites |
| Path/parameter injection | Exact server paths and bounded filters; ambiguous Safety query state now rejected | Route/endpoint suites; ASR-02 regressions |
| Unexpected DTO keys | Exact-object request parsing rejects client authority fields | Dedicated red-team endpoint test |
| Malformed bearer/session state | Duplicate, conflicting, whitespace-bearing, and oversized bearer forms fail before Auth access | Dedicated red-team endpoint test |
| Sole Owner removal/demotion | Refused transactionally when no other valid Owner remains | Access DB suite |
| Viewer/Admin self-elevation | No capability assignment input exists; only current Owner can mutate canonical roles | Access endpoint/DB suites |
| Browser capability grant | Capabilities are exact server-derived role projections and are never persisted from a DTO | Authorization/access model suites |
| Audit failure | Protected mutation and audit append share one transaction; forced audit failure rolls everything back | Configuration and audit DB suites |

## Residual scope notes

- Browser authorization and route visibility remain presentation-only; every
  data or mutation endpoint independently reauthorizes.
- Service-role reads remain behind server endpoint authorization and exact
  service RPC grants. Service credentials are not present in browser modules.
- No Owner onboarding/add-principal flow was introduced or reviewed because
  the frozen Access contract intentionally exposes only change and revoke.
- No hosted state was inspected or changed. Hosted drift/application status is
  outside this repository-only review and remains HOLD.

## Verification

- Admin-focused UI, endpoint, shared-source, and database run: 66 files and
  718 tests passed.
- Post-fix configuration database run: 15 tests passed, including the
  write-point security metadata probe and mid-request demotion regression.
- Repository-wide Node 22 serialized run: 275 files and 3,132 tests passed.
- TypeScript typecheck: passed.
- Production build: passed.
- Strict migration manifest/collision check: READY with 21 migrations.
- `git diff --check`: passed.
