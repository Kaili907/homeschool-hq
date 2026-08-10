# Study Production Security / Adversarial Gate R4

## Scope and ruling

This gate reviews only production Study authority: readiness, verified session
begin/resume/transitions/checkpoints, Effective Settings V2, Curriculum Release
Registry resolution, immutable session binding, enrollment eligibility, service
RPCs, RLS/grants, DTO validation, idempotency, and compare-and-swap behavior.
Preview, demo, and synthetic runtime behavior is not treated as authority.

Final classification: `SAFE_WITH_CORRECTIONS`.

The trusted database boundary already rejected forged mutation authority and
constructed minimized projections. The review proved a defense-in-depth defect
in the Netlify response/request DTO boundary: calendar/dashboard response keys,
nested checkpoint content, settings bounds, release UUIDs, and timestamps were
not all validated strictly enough before serialization. The correction makes
the server fail closed on those values and adds permanent regression coverage.

## Proven exploit and correction

Before correction, mocked trusted-RPC responses containing unknown dashboard or
calendar fields, a non-UUID release identifier, a zero-minute settings snapshot,
or a malformed accepted timestamp crossed the Netlify gateway. Privacy field
names including `learnerAnswers`, `tutorConversations`, `assessmentResponses`,
`rawDatabaseError`, `sql`, and `rawProviderObject` were also absent from the
generic response denylist. Malformed but date-shaped intended dates reached the
database rather than being rejected at the HTTP server boundary.

After correction:

- every RPC envelope and every production operation body has an exact wire shape;
- dates and instants are calendar-valid, not regex-only;
- release IDs are canonical UUIDs and manifest digests are lowercase SHA-256;
- Effective Settings values and relationships use the database contract bounds;
- checkpoints validate every nested object, enum, identifier, timestamp, array,
  revision, privacy sentinel, and technical-interruption state;
- Study identifiers use the database maximum of 160 characters;
- the privacy key denylist covers every category required by this gate; and
- malformed or unexpected authority becomes a bounded denial/contract failure.

No request header, body value, preview sentinel, default settings, latest
curriculum fallback, or browser state is used as production authority.

## Attack matrix

The permanent suites are:

- `netlify/functions/_shared/study-runtime/verified-academic-runtime.adversarial.test.js`
- `supabase/study-production-security-adversarial.db.test.ts`

| # | Attack | Permanent proof |
|---:|---|---|
| 1 | Forged learner identity | Exact request DTO rejection; verified grant supplies the learner in the database. |
| 2 | Forged household identity | Exact request DTO rejection; cross-household grant cannot resolve the session. |
| 3 | Forged role/capability | Caller fields are rejected; capability mismatch returns an exact denial; an authenticated role cannot invoke the service RPC even with forged claims. |
| 4 | Cross-household access | Household B receives only `study-session-unavailable`; RLS shows Household A only its own legacy row. |
| 5 | Forged release UUID | Browser release fields are rejected; response release IDs must be UUIDs. |
| 6 | Forged package/version | Package authority is not requestable; semver and exact registry results are enforced. |
| 7 | Forged manifest digest | Browser digest fields are rejected; response digest must be lowercase SHA-256 and stored digest is registry-derived. |
| 8 | Forged active/published state | Pointer/status request fields and direct registry mutation are denied. |
| 9 | Forged settings snapshot | Request additions are rejected; stored settings are server-derived and immutable; response bounds are exact. |
| 10 | Forged accepted timestamp | Request field is rejected; stored `accepted_at` equals server `started_at` and is trigger-immutable. |
| 11 | Forged revision | Request field is rejected and direct table mutation lacks privilege. |
| 12 | Stale revision | Transition and checkpoint stale revisions return bounded conflicts. |
| 13 | Revision skipping | Transition/checkpoint skipped revisions return bounded conflicts. |
| 14 | Duplicate begin | Identical replay returns the original session and revision. |
| 15 | Changed duplicate-begin payload | Same key with a changed fingerprint returns `idempotency-collision`; only one session exists. |
| 16 | Duplicate transition | Identical replay returns the original stored projection. |
| 17 | Changed transition replay | Same key with a changed transition returns `idempotency-collision`. |
| 18 | Transition after terminal completion | Returns `invalid-transition` with state `completed`. |
| 19 | Transition after abandonment | Returns `invalid-transition` with state `abandoned`. |
| 20 | Unknown request keys | HTTP envelope, operation request, curriculum context, transition, and checkpoint shapes reject additions. |
| 21 | Unknown response keys | RPC envelope, dashboard, calendar, lifecycle, binding, settings, and checkpoint shapes reject additions. |
| 22 | Malformed nested DTO | Full nested curriculum, transition, and checkpoint validators fail closed. |
| 23 | Oversized/boundary payloads | HTTP body, tree counts/depth, 160-character IDs, 64 skill refs, and database byte caps are exercised. |
| 24 | Invalid UUIDs | Invalid release UUID responses and invalid token identity inputs are rejected. |
| 25 | Malformed date/time | Impossible dates and malformed accepted instants are rejected; database date validation remains authoritative. |
| 26 | Invalid curriculum refs | Mismatched lesson/version and caller-authored release/package/digest/pointer fields are rejected. |
| 27 | Legacy ambiguous session | Resume returns `legacy-curriculum-binding-ambiguous`, never a default/latest binding. |
| 28 | Enrollment changed after session binding | Existing session remains pinned; a new session is unavailable while enrollment is withdrawn. |
| 29 | Release activation changed after session binding | Existing release-1 session remains pinned after release-2 activation. |
| 30 | Release rollback after session binding | Existing release-2 session remains pinned after rollback to release 1. |

## Authorization, RLS, and grants

- `academy_study_execute_session_lifecycle_v2` is executable only by
  `service_role`; `anon` and `authenticated` have no execute grant.
- Private lifecycle helpers have no browser execute grant.
- Browser and service roles have no direct insert/update/delete authority over
  Study session tables. Browser roles also cannot mutate release registry or
  active-pointer history.
- Forced RLS is present on sessions, checkpoints, mutation receipts, Effective
  Settings authority tables, releases, and active pointers. Browser reads remain
  household-filtered.
- The trusted RPC revalidates the current grant, learner, household, credential,
  session version, issuing membership/access, capability, expiry, and revocation
  within one database boundary before setting the student principal.

## Idempotency and CAS

Mutation receipts bind actor scope, operation, idempotency identity, canonical
fingerprint, and SHA-256 digest. Same identity plus the same digest/fingerprint
returns the original result. The same identity plus any changed payload returns
an explicit collision. Session and checkpoint rows are locked before mutation,
and exact revision equality is required, so network uncertainty cannot create a
second session or consume a transition/checkpoint revision twice.

## Release and settings authority

New sessions resolve an active, published registry release that matches current
enrollment and capture its UUID, package, version, and curriculum manifest digest.
The resulting curriculum binding is trigger-immutable. Existing sessions do not
re-resolve after enrollment changes, activation, or rollback.

Effective Settings V2 resolves inside the trusted database, stores the exact
ready snapshot at begin, and makes that snapshot trigger-immutable. Missing,
malformed, conflicting, or incomplete authority returns `unavailable` or
`manual_review`; there is no default-settings fallback.

## Privacy and logging

Production wire projections are allowlisted and cannot contain private notes,
raw safety text, learner answers, Tutor conversations, assessment responses,
emotional/personality labels, diagnostic inference, secrets, credentials, raw
database errors, SQL, or raw provider objects. Checkpoint projections explicitly
require `rawAnswerIncluded: false` and `transcriptIncluded: false`.

The reviewed HTTP boundary emits only bounded error codes and does not log raw
requests or caught database errors. Database security audit metadata contains
bounded identifiers, revision values, and result/reason codes; adversarial tests
reject learner/private content in that metadata.

## Migration ruling

No migration is required. The proven defect was in the existing Netlify DTO
validation layer; database ACL, RLS, immutable binding, settings authority,
idempotency, and CAS contracts remained closed under the adversarial probes.
No hosted database action was performed.
