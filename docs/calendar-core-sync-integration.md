# Calendar Core: Future Synchronization Boundary

Status: design boundary only. Session 1 adds no Supabase migration, table, RPC,
identity change, household-sync change, or RLS change.

## Ownership model

Planner data has two distinct ownership scopes:

- Family-owned schedule configuration: recurring `PlannerBlock` templates and
  `PlannerDateOverride` rows belong to one household. Parents create, edit,
  activate, deactivate, assign, move, excuse, or remove this configuration.
- Per-profile execution data: `PlannerProgress` belongs to one household, one
  profile, one local calendar date, and one deterministic block instance.

Mission completion is not planner-owned. `Profile.missions` is the only persisted
mission-completion authority. Planner mission progress may retain elapsed time,
pause state, safe resume metadata, and an immutable occurrence snapshot, but it
must not persist a second authoritative `completed` value. Eligible current-day
manual completion delegates to the same mission command that owns the mission
item, streak, reward, and attendance effects. Curriculum planner completion is
schedule completion only; it does not write mastery, assessment, grade, pacing,
or attendance data.

## Group-assigned activities

A group template stores both:

- `assignToAll`, which includes profiles added to the household later; and
- `assignedProfileIds`, an explicit assignment snapshot useful for display,
  audit, and offline reconciliation.

One group template derives a separate deterministic block instance and a separate
progress record for every assigned profile and date. Completing the activity for
one student must never complete it for a sibling. If the future product needs
shared-event attendance (for example, a family appointment), the event can remain
one family template while execution stays per profile.

## Household isolation and authorization

Every future planner table must carry an immutable `household_id` foreign key.
Every read and mutation must prove that the authenticated user is a current member
of that household. Profile IDs must also be validated as members of the same
household; accepting an arbitrary profile ID from the client would permit
cross-household writes.

RLS should deny by default and scope every operation through household membership.
Service-role access must remain server-side. Client-provided `household_id`,
`profile_id`, parent role, timestamps, or verification claims are not sufficient
authorization on their own.

## Fields and roles

Parent-only configuration and decisions:

- Template title, student instructions, category, recurrence, assignments, start
  time, expected duration, fixed/flexible behavior, location, parent notes, active
  state
- Date additions, removals, changes, moves, skips, and excuses
- Parent-help requirement
- Parent verification, verification identity, and completion-note moderation
- Removing or reactivating templates

Students may update only their own execution state:

- Start an eligible assigned block
- Pause it and accumulate active elapsed time
- Resume it
- Complete a manually eligible block
- Store adapter-approved, serialization-safe resume data
- Add a student completion note if the eventual parent policy permits it

Students may not change assignments, recurrence, fixed event times, expected
duration, parent notes, another profile's progress, parent verification, or an
auto-only mission's completion.

Student projections must remove parent notes structurally before data reaches a
student component or client response. Hiding an already-delivered parent field in
CSS or conditional markup is not an authorization boundary.

## Legal status transitions

The current projection must enforce a server-side-equivalent transition policy:

- `not-started` may start, complete when eligible, skip, excuse, or move.
- `in-progress` may pause, complete, skip, excuse, or move.
- `paused` may resume, complete, skip, excuse, or move.
- `skipped` remains incomplete and may start, complete, excuse, or move.
- `completed`, `excused`, and `moved` are terminal until an explicit authorized
  parent `reopen` operation.
- Repeating start/resume while active, pause while paused, or an already-applied
  terminal operation is idempotent and must preserve elapsed time and timestamps.

Every command reselects the current template/source/occurrence and validates the
profile, assignment, deterministic instance ID, source availability, date,
actor, and current status. Client-rendered block objects are untrusted snapshots.
Future cloud RPCs must apply those checks inside the same transaction that writes
the transition.

## Conflict and offline considerations

Templates and overrides should use stable client-generated IDs plus `created_at`,
`updated_at`, a server revision, and an idempotency key. A compare-and-swap RPC or
revision check should reject edits based on an obsolete revision instead of
silently overwriting a newer parent's change. The UI can then show both versions
for a parent decision.

Progress should be event-oriented. Start, pause, resume, complete, skip, excuse,
move, and verify operations should carry unique operation IDs. Replaying an
offline operation must be idempotent. Server time should arbitrate event ordering;
the client timestamp remains useful as observed time but should not be trusted as
the sole ordering authority.

Only one in-progress block is permitted per profile. A future
`planner_start_block` RPC should pause the currently active block and start the new
one in one transaction. A partial two-request sequence would allow two devices to
leave two rows active.

Date interpretation must use the household's configured time zone. Block
instances use the household calendar date, not a UTC date derived at sync time.

Preferred schedule time and effective occurrence placement are distinct. Fixed
events reserve their full intervals. Flexible work is placed into a complete
available interval without silently splitting or overlapping fixed work. A
paused, active, or historical occurrence retains its captured effective
placement. Work that cannot fit inside the local calendar day is represented as
ordered overflow; it is never clamped to a fabricated `23:59` start.

## Append-only history

The following history should never be overwritten in place:

- Start, pause, resume, and completion events
- Active elapsed-time segment boundaries
- Moves, skips, excuses, and their parent actor/reason
- Parent verifications and verification reversals
- Assignment changes that affect already-instantiated dates
- Template activation/deactivation and material schedule edits
- Conflict-resolution decisions
- Immutable occurrence snapshots needed to display the original title, student
  instructions, source, preferred/effective placement, and duration

A compact current-state projection may be rebuilt from those events for fast
reads. Deleting a recurring template must not delete historical block instances
or progress events. Deactivation affects future uninstantiated dates only.
Historical snapshots may retain parent notes for authenticated parent reads, but
student projections must omit them.

## Planner-version compatibility

Planner persistence has its own version inside schema-version-2 AppState. Missing
planner data creates the current defaults, and known planner-v1 data migrates to
the current planner version. Safe unknown JSON fields on a supported version
should round-trip without driving behavior.

An unsupported newer planner payload is opaque and read-only. The client keeps
that raw payload in AppState and backup exports, displays an update-required
message, and rejects planner commands. It must not normalize the payload into an
older version or allow the ordinary save effect to strip unknown data.

## Candidate future tables

Names are illustrative and are not implemented in Session 1:

- `planner_templates`: household-owned recurring blocks and linked-activity
  metadata
- `planner_template_assignments`: explicit profile assignments when
  `assign_to_all` is false
- `planner_date_overrides`: household/date/profile-scoped additions, removals,
  changes, and moves
- `planner_block_instances`: optional materialized profile/date/template identity
  when server-side derivation becomes necessary
- `planner_progress_events`: append-only execution and disposition events
- `planner_progress_current`: server-maintained current projection, or a view over
  the event stream

Mission and curriculum tables remain outside this boundary. Planner rows reference
their stable source identifiers; they do not copy source completion or mastery into
new authoritative columns.

## Candidate RPC boundaries

- `planner_upsert_template(expected_revision, payload, idempotency_key)`
- `planner_deactivate_template(expected_revision, template_id, idempotency_key)`
- `planner_apply_date_override(payload, idempotency_key)`
- `planner_start_block(profile_id, instance_id, observed_at, idempotency_key)`
  atomically pauses the prior active block
- `planner_pause_block(profile_id, instance_id, resume_pointer, observed_at,
  idempotency_key)`
- `planner_resume_block(profile_id, instance_id, observed_at, idempotency_key)`
- `planner_complete_block(profile_id, instance_id, note, observed_at,
  idempotency_key)`
- `planner_set_parent_disposition(instance_id, status, reason, idempotency_key)`
- `planner_verify_completion(instance_id, verification, idempotency_key)`

An eligible manual mission completion should continue through the mission system's
future RPC/reducer boundary in the same transaction or orchestrated server action.
It is current-household-date only until mission streaks support chronological
recomputation. Auto-only mission items and missing mission sources must reject
planner completion requests.

## Resume contract boundary

`ResumePointer` accepts an adapter, bound block/activity ID, optional route,
lesson/step/question/item identifiers, and adapter-owned JSON data. Route strings
and adapter data are untrusted serialized input. Resolution uses a closed
destination allowlist in this order:

1. A valid pointer bound to the current profile/block/source
2. Current linked-activity metadata
3. A dependable subject/course/activity or explicit curriculum-instructions entry
4. A typed unavailable result

Current legacy math, typing, reading, mindset, curriculum, and Romeo Online
surfaces do not all expose exact lesson-step restore contracts. The planner
preserves paused state and elapsed time, then opens the safest supported
activity-, subject-, course-, or instructions-level entry. It must not claim
exact deep resume. An unavailable result cannot look like an active Start control
and cannot transition progress.
