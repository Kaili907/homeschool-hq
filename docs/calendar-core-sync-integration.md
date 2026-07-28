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

Mission completion is not planner-owned. The mission adapter reads the existing
mission record as its completion authority and delegates eligible manual mission
completion to the established mission reducer. Curriculum planner completion is
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

- Template title, instructions, category, recurrence, assignments, start time,
  expected duration, fixed/flexible behavior, location, parent notes, active state
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

## Append-only history

The following history should never be overwritten in place:

- Start, pause, resume, and completion events
- Active elapsed-time segment boundaries
- Moves, skips, excuses, and their parent actor/reason
- Parent verifications and verification reversals
- Assignment changes that affect already-instantiated dates
- Template activation/deactivation and material schedule edits
- Conflict-resolution decisions

A compact current-state projection may be rebuilt from those events for fast
reads. Deleting a recurring template must not delete historical block instances
or progress events.

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
Auto-only mission items must reject planner completion requests.

## Resume contract boundary

`ResumePointer` accepts a route or activity ID, lesson ID, step ID, question/item
ID, and adapter-owned JSON data. An adapter may populate only locations the linked
module can reliably restore. Current legacy math, typing, reading, mindset,
curriculum, and Romeo Online surfaces do not all expose exact lesson-step restore
contracts. Until each module implements one, the planner preserves paused status
and elapsed time, then reopens the safest available activity entry point. It must
not claim exact deep resume.
