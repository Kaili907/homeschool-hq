# Family Cloud Sync R1 convergence

## Candidate ruling

This tree is `CLOUD_CAPABLE_HOSTED_DISABLED`. It contains the converged Auth,
local-authority, checkpoint, RPC, CAS, UI-status, and local multi-device proof,
but deliberately contains no active external cloud composition. There is no
configured non-production Supabase project.

During convergence and verification:

- `HOSTED_CONTACT = NONE`
- `PRODUCTION_CONTACT = NONE`
- `MIGRATIONS_APPLIED = NO`
- `CLOUD_ACTIVATED = NO`
- `NON_PROD_TARGET_STATUS = NON_PROD_PROJECT_REQUIRED`

The known production project ref `ymtvzmqhfvwjtxjdmybs` remains prohibited by
the staging preflight. This work did not link a project, run hosted SQL, deploy,
or activate the transport.

## Exact inputs and integration

All inputs were fetched and verified on 2026-08-15 as the exact current tip of
their named remote branch before integration.

| Lane | Exact remote tip | Branch |
|---|---|---|
| Product | `3b89a20234d2e8a2ddfa11f9de27bd8d10a82fa4` | `origin/mac/full-family-pilot-r2-six-subject-curriculum` |
| Family Cloud Auth | `21ec7312b7430715fe5a16a1ce8e24ce64faa43e` | `origin/mac/family-cloud-auth-r1` |
| Cross-device data | `e69b2190682925c3c6012a0e8120b02a67c58e2a` | `origin/mac/family-cross-device-data-r1` |
| DB/RLS readiness | `068f5e9f0e35fc6441a5088e927b6a8ab13e2c13` | `origin/mac/family-cloud-db-readiness-r1` |
| Two-device E2E | `a77dbf87a268495d9a9d79197bf5c712938fd801` | `origin/mac/family-two-device-e2e-r1` |

The complete Auth, data, DB-readiness lineage, and E2E commits were
cherry-picked onto the product base. Convergence then joined their interfaces
instead of retaining lane-specific sidecars. The two original
`20260814120000` migration names collided; the data-classification migration
was safely assigned the earlier unused forward timestamp
`20260814110000`, leaving the required response and plan migrations at their
exact requested names. No historical migration was edited.

## One architecture

```text
Supabase provider session (future non-production composition only)
  -> existing VerifiedAuthContext
  -> RLS-derived active household membership
  -> FamilyCloudAuthCoordinator
  -> HostedFamilyCloudLocalDataPortR1
       -> one FamilyCloudRemoteDirectoryPortR1
       -> one canonical FamilyCloudCheckpointRepositoryR1
       -> one HostedSyncRpcAdapter / four-RPC surface
  -> verified atomic publish into existing Family Pilot stores
  -> existing Family Pilot controller
  -> existing Study Engine + LearnerResponseRuntime
```

`FamilyCloudAuthRuntime` is now the only Family Cloud composition. The older
Family Services configuration is scorer-only and cannot inject a second Hosted
Sync client or manufacture a `Sync ready` badge. The cloud data port is an
adapter over the existing stores; it is not another browser database, Study
Engine, or LearnerResponseRuntime.

The injected checkpoint repository must read, stage, byte-verify, and
atomically publish through the canonical Core, final-app, planner,
LearnerResponse, and durable IndexedDB authorities. A failed hydrate, first
link, conflict, or offline attempt leaves the prior local authority usable.

## Auth and new-computer flow

The Parent cloud email/password stays provider-managed. The application reuses
the existing verified Supabase access-token contract; it does not decode or
verify a second bearer. Household selection is derived from the current
token's one active membership under RLS, never accepted as a caller selector.

```text
unlinked computer
  -> Parent Family Cloud sign-in
  -> verified provider context
  -> one RLS-authorized household
  -> resolve ephemeral learner grants/mappings
  -> hydrate every authorized learner
  -> stage and verify complete household state
  -> atomic local publish
  -> mount Family Pilot controller
  -> select learner
  -> device-local learner PIN (if configured)
  -> Dashboard / Today / exact Study continuation
```

The controller is not mounted against an incomplete household. Parent PIN and
learner PIN remain local application/selection authorities; neither is a cloud
credential. A freshly hydrated computer receives `pinRequired=false`, an empty
learner-verifier map, and a null Parent verifier, so the household can establish
new device-local PIN policy without cloud disclosure.

Only the account ref, household ref, schema version, and link time are stored
as device-link metadata. Provider password, access/refresh token, service role,
raw PIN, PIN verifier, and ephemeral Study grant digest are not stored there.

## Cloud/offline state machine

| State | Cloud authority | Local behavior | Parent language |
|---|---|---|---|
| Hosted not composed | none | canonical local stores | `Local only` |
| `AUTHENTICATING` | checking | controller withheld | checking family account |
| `READY` | authenticated Parent household | hydrate/reconcile enabled | `Up to date` / `Syncing` |
| `OFFLINE_LOCAL` | none | existing linked household remains usable | offline / saved on this device |
| `NEEDS_ATTENTION` | none | local recovery copy retained | `Needs attention` |
| `EXPIRED` | none | sign-in required online | secure session expired |
| `SIGNED_OUT` | none | academic data retained, link authority cleared | sign in |

Normal accepted local mutations update the UI immediately and then ask the
coordinator to reconcile only while `READY`. One reconciliation runs at a time.
An online/offline browser event reboots Auth/hydration. Offline never creates
new cloud authority. Explicit sign-out disables authenticated offline fallback.

- **Lock:** clears the active learner and Parent unlock while retaining the
  household provider session.
- **Switch:** clears the active learner and requires the next learner's local
  authentication.
- **Sign out:** clears active learner, nonsecret link authority, in-memory Auth
  context, and provider session; it does not delete academic data or backup.

## Synchronized data allowlist

The canonical learner authority is `hosted-study-sync-state.r2.v1`. It carries
only the approved minimum required to reconstruct the selected learner:

- profile, nominal grade, subject working levels, and enabled subjects;
- typed course-enrollment projection returned by hydrate;
- exact Core manual/automatic assignments and completion facts;
- exact School Plan and deterministic Auto Planner materialization provenance;
- durable Study calendar, session, checkpoint, segment/page cursor, lineage,
  active-time facts, interruption/reschedule state, and minimized events;
- bounded instructional inputs for other continuable attempts;
- assessment lifecycle and minimized trusted receipt;
- guardian/RFL attestations, approved social-source metadata, and Safety holds;
- explicit operation, idempotency, device, base/server, and domain revisions.

Derived UI state, catalog prompt/choice text, completion percentages, rendered
reports, temporary route/dialog state, device repair evidence, and downloaded
backup files remain local or are re-derived. Cloud sync does not replace Parent
Download Backup.

## Learner response checkpoint

`family-pilot.learner-response-checkpoint.r1` is an exact-key, 1 MiB maximum
checkpoint for the linked Study assignment/session and attempt. It contains at
most 256 items with item/section/segment refs, response/evidence kind, bounded
choice ref or learner text, saved status/time, and optional minimized trusted
receipt. Real curriculum refs use `#`; the converged TypeScript and forward SQL
validators accept that fragment delimiter while continuing to reject query
strings and unknown characters.

The dedicated response CAS stays anchored to the Study session established at
first link. Bounded inputs for other currently continuable sessions are carried
by the canonical authority checkpoint and reconstructed through the existing
LearnerResponse store; this does not create a second response RPC.

The checkpoint can never contain prompts, answer keys, correct/expected
answers, worked solutions, adult scoring guides/rubrics, Tutor conversation,
raw audio, behavioral inference, PIN material, provider tokens, service
credentials, or unknown fields.

## Family Plan checkpoint and deterministic planning

`family-pilot.family-plan-checkpoint.r1` is an exact-key, 8 MiB maximum
checkpoint containing the accepted `FamilyAutoPlannerDocumentV1`: household
timezone, school-year bounds, weekdays, exceptions, ordered subject plans,
pause state, course choice, lessons/day, local start time, and deterministic
materializations. It contains no generated presentation cache.

Planner materialization and assignment refs remain deterministic. CAS and
append-preserving materialization validation prevent two computers opening the
same day from silently producing duplicate ordinary assignments. The planner
domain is Parent-write-only and independently revised.

## First link, hydrate, write, and CAS

First link is lossless and ordered:

1. retain the complete local household;
2. resolve the authenticated household and ephemeral authorized learner map;
3. export and validate exact authority, response, and plan checkpoints;
4. call `academy_study_sync_first_link_v2`;
5. hydrate through `academy_study_sync_hydrate_v2`;
6. verify identities, mappings, revision zero, course enrollment, and exact
   allowed checkpoint bytes;
7. atomically publish/record the linked metadata only after read-back succeeds.

Fresh devices hydrate all authorized learners before committing any of them.
Existing devices compare local and last-hydrated remote content, write only
changed domains, then hydrate and atomically publish verified read-back.

There are three independent CAS domains:

| Domain | Write operation |
|---|---|
| learner authority | `authority-checkpoint:compare-and-swap` |
| learner response | `learner-response-checkpoint:compare-and-swap` |
| Family Plan | `family-plan-checkpoint:compare-and-swap` |

Every candidate has an expected/base revision, exactly next revision, and
stable operation UUID. An exact duplicate is idempotent. A reused UUID with
different bytes is a collision. A stale base is an explicit conflict; no
timestamp winner exists. The repository retains the local recovery candidate,
keeps the independently hydrated remote candidate, and surfaces `Needs
attention` without exposing CAS/RPC terminology to learners.

## Database, RLS, and RPC boundary

The final manifest has 57 unique migration timestamps/names and no collision.
The forward Family Cloud sequence is:

1. `20260814110000_academy_family_cross_device_data_r1.sql`
2. `20260814120000_academy_family_response_checkpoint_r1.sql`
3. `20260815120000_academy_family_plan_checkpoint_r1.sql`

The response header/items and Family Plan tables force RLS. Anonymous and
service-role browser access is denied; authenticated users have no direct
INSERT/UPDATE/DELETE. Guardian membership, exact household/student access,
current grant identity, expiry/revocation/version, mapping, assignment/session,
and learner scope are validated at the RPC boundary. Learner response access
is exact-student scoped; Family Plan mutation is Parent-only; sibling and
cross-household access are denied.

The browser allowlist remains four RPCs:

1. `academy_study_sync_first_link_v2`
2. `academy_study_sync_resolve_mapping_v2`
3. `academy_study_sync_hydrate_v2`
4. `academy_study_sync_write_v2`

The two additive CAS operations are strict `write_v2` operation kinds, not new
general JSON endpoints. Existing operations delegate to their prior typed
implementation. Unknown fields, over-limit documents, dangerous authority,
scope mismatch, revision removal/regression, and malformed identity fail
closed.

## Local three-device proof

The Playwright proof uses three isolated browser contexts with separate
cookies, localStorage, IndexedDB, and device refs. It exercises the real Family
Pilot UI and exact converged checkpoint/RPC contracts through the local
four-RPC emulator. Browser request audit rejects every non-loopback request.

- Device A configures two learners and both School Plans, advances a real rich
  lesson, saves responses, authenticates, first-links, hydrates, and verifies
  exact read-back.
- Fresh Device B receives the roster, Today, School Plan, planner provenance,
  Study cursor, and saved response; it continues the exact next part and Device
  A later hydrates the progress.
- The sibling follows the same path without either learner payload containing
  the other sibling ref.
- A and B edit the same authority revision; A stores and B receives an explicit
  conflict with both local and remote bundles retained.
- A saves locally while offline, B advances unrelated sibling work online, and
  reconnect reconciliation preserves both permitted changes without regression.
- Fresh Device C hydrates both learners but receives no Parent/learner verifier,
  token, answer authority, Tutor transcript, or sibling-private payload.

## Privacy and answer authority

All high-level emulator payloads, underlying four-RPC arguments, and browser
requests are audited. Cloud payloads deny:

`answerKey`, correct/expected answer, worked solution, adult scoring/rubric
authority, Parent or learner PIN/verifier, provider bearer/refresh token,
service-role credential, Tutor prompt/conversation/transcript, raw audio,
emotional/personality/diagnostic inference, unknown response fields, and
unrelated sibling-private state.

Trusted scorer remains off unless separately configured in a reviewed
non-production composition. Only an already-accepted minimized receipt may be
synchronized; the scorer reference/decision/time is evidence, never answer or
completion authority.

## Staging activation requirements

The next step requires a separately provisioned non-production Supabase project
and explicit authorization. Before any connection:

1. two operators verify project ref, organization, environment label, API and
   database hosts, and confirm the ref is not `ymtvzmqhfvwjtxjdmybs`;
2. set the explicit staging ref and a database URL containing that same ref;
3. run the checked-in hosted-sync preflight, which mechanically refuses the
   known production ref or mismatched URL/ref;
4. obtain a provider-supported staging backup and restore owner/window;
5. inventory the staging ledger read-only and compare exact manifest hashes;
6. apply only absent executable migrations through a separately authorized
   staging procedure—never replay or edit historical SQL;
7. configure only synthetic Parent/learner identities and reviewed Auth claims;
8. inject the one `FamilyCloudAuthRuntime` composition and keep service-role
   material server-only;
9. run the same two-device/fresh-device/privacy proof against staging;
10. retain transport disabled on any preflight, migration, Auth, RLS, read-back,
    or privacy failure.

No item in this list was performed by this convergence.
