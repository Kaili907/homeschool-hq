-- Read-only consolidated academic readiness contract.
--
-- Study production readiness names seven academic dependencies. Two of them —
-- study-session-adapter and checkpoint-adapter — are provable from the Netlify
-- operation surface, because academy_study_execute_verified_runtime_v1 exposes
-- session:begin/session:transition and checkpoint:read/checkpoint:compare-and-swap.
-- The remaining five have no operation on that surface at all. Calendar's single
-- operation, calendar:read, carries the student:assignments:read capability and
-- never touches the mutation contract the calendar adapter actually requires, so
-- treating it as evidence of calendar readiness would be a category error.
--
-- This migration adds one function that reads catalog and contract metadata for
-- all seven and reports a closed per-dependency status. The readiness RPC is
-- READ ONLY: it executes no academic RPC, inserts no review, writes no calendar
-- block, appends no event, and reads no learner row, no settings value and no
-- adult-private content. Privacy-sensitive subsystems are established from schema
-- and function metadata alone.
--
-- It also repairs one thing rather than only observing it. Review, calendar and
-- parent settings are three record kinds of ONE adult-managed mutation, and the
-- set of kinds that mutation accepts used to be a bare literal list inside its
-- own body. Readiness could only guess at it by searching the function's source
-- text, and source text is not the gate: every kind appears twice in the body for
-- unrelated reasons, while the list that actually admits a kind spells none of
-- them in that form. Removing a kind from it therefore made every call for that
-- kind raise STUDY_RECORD_INVALID while readiness still reported the dependency
-- ready, and three strings left in comments were enough to report all three ready
-- with a body that did nothing but raise.
--
-- So the kind set moves into one trusted helper,
-- academy_private.study_adult_managed_record_kind_supported, and both sides call
-- it: the mutation function as its admission gate, and readiness as its per-kind
-- probe. There is no second list. A kind withdrawn from the helper is refused by
-- the mutation path and reported not-ready by readiness in the same change,
-- because both are reading the same function.
--
-- Readiness additionally establishes that the helper is what the mutation's
-- admission gate actually consults, by requiring the whole expected gate
-- expression to open the function -- to start at the body's first `begin`, which
-- is the outer entry. Weaker forms of that requirement do not hold. Requiring only
-- the helper's NAME to appear somewhere is satisfied by a call parked in a dead
-- branch or a live call whose result is discarded. Requiring the whole gate
-- expression to appear ANYWHERE is satisfied by a copy of it inside a nested block
-- that never runs, because PL/pgSQL blocks nest and a `begin` can therefore be
-- interposed. Each of those sits beside a real admission gate that is an
-- independent narrower list refusing the kind at runtime.
--
-- What that structural check cannot do is bounded and stated where it lives, on
-- academy_private.study_academic_record_kind_ready below: it cannot prove that no
-- later, independent restriction was inserted downstream of the gate it verifies.
-- Nothing a read-only catalog probe can do would prove that, and this RPC executes
-- no academic operation by contract, so the limit is documented rather than
-- narrowed by fragile scanning for every statement a body might contain.
--
-- The mutation function itself lives in 20260801011000, which is in hosted
-- history and frozen. Its definition is therefore repaired additively from here,
-- as repository policy requires for a frozen migration: the stored definition is
-- read back, the admission gate alone is rewritten to call the helper, and the
-- migration aborts if that gate is not found exactly as expected. Nothing else in
-- the body changes, no signature changes, and no privilege is widened.
--
-- Additive and forward-only otherwise. Nothing here authorizes Study. The seven
-- DB facts this function returns are one half of a defence-in-depth pair; the
-- Netlify operation surface remains an independent prerequisite, and neither side
-- alone may report a dependency fully ready.
--
-- No hosted execution is implied by checking this in.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study Engine migrations must run as postgres';
  end if;

  -- Predecessor state is asserted by containment and by explicit marker
  -- properties, never by exact equality of migration_names. Exact equality pins
  -- a migration to one chain snapshot and breaks as soon as a legitimately
  -- earlier-versioned sibling lands ahead of it.
  select * into marker
  from academy_private.study_persistence_metadata where singleton;
  -- Without this, an absent singleton leaves every comparison below NULL, no
  -- branch is taken, and an unknown state applies fail-open.
  if not found then
    raise exception 'STUDY_ACADEMIC_READINESS predecessor marker mismatch';
  end if;

  -- The academic contract this function describes is defined by the storage and
  -- authorization migrations; the actor-binding predecessor is the immediate
  -- lineage requirement.
  if marker.storage_version is distinct from 1
     or marker.authorization_version is distinct from 1
     or marker.verified_identity_version is distinct from 1
     or marker.final_production_version is distinct from 1
     or marker.actor_binding_version is distinct from 1
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260801010000_academy_study_engine_storage',
       '20260801011000_academy_study_engine_authorization',
       '20260801190000_academy_study_final_production_reconciliation',
       '20260808120000_academy_study_actor_bound_session_verification'
     ]::text[]) then
    raise exception 'STUDY_ACADEMIC_READINESS predecessor marker mismatch';
  end if;

  -- The actor binding must be present as a PROPERTY, not merely as a name in the
  -- list. A name can be appended by a migration that failed partway; the manifest
  -- fact is written in the same statement as the version bump.
  if coalesce(marker.security_manifest, '{}'::jsonb)
       @> jsonb_build_object('actor_binding_version', 1)
     is not true then
    raise exception 'STUDY_ACADEMIC_READINESS predecessor marker mismatch';
  end if;

  if marker.migration_names @> array[
       '20260808150000_academy_study_academic_readiness_contract'
     ]::text[] then
    raise exception 'STUDY_ACADEMIC_READINESS already applied';
  end if;

  -- Creation, never replacement. If any of these signatures already exists this
  -- migration must refuse rather than redefine a function it did not write.
  if to_regprocedure('public.academy_study_academic_readiness_v1()') is not null
     or to_regprocedure(
       'academy_private.study_academic_function_ready(text)') is not null
     or to_regprocedure(
       'academy_private.study_academic_table_ready(text,text[])') is not null
     or to_regprocedure(
       'academy_private.study_academic_record_kind_ready(text)') is not null
     or to_regprocedure(
       'academy_private.study_adult_managed_record_kind_supported(text)'
     ) is not null then
    raise exception 'STUDY_ACADEMIC_READINESS object collision';
  end if;

  -- The gate this migration rewrites must be present to be rewritten. Asserting
  -- it here means a lineage whose adult-managed mutation is missing or already
  -- reshaped fails before anything is created, rather than leaving the helper in
  -- place with nothing routed through it.
  if to_regprocedure(
       'public.academy_study_upsert_adult_managed_record(text,jsonb,bigint,text)'
     ) is null then
    raise exception 'STUDY_ACADEMIC_READINESS adult-managed mutation missing';
  end if;
end;
$$;

-- The single authority for which adult-managed record kinds exist. The mutation
-- function's admission gate and the readiness probe both call this and nothing
-- else, so the two cannot drift: withdrawing a kind here refuses it at the
-- mutation path and closes it at readiness in the same edit.
--
-- 'accommodation' is a supported kind of the shared mutation but is not one of the
-- seven academic dependencies; it belongs in the authority because the gate needs
-- it, and readiness simply never asks about it.
create function academy_private.study_adult_managed_record_kind_supported(
  p_kind text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_kind in ('review', 'calendar', 'parent_settings', 'accommodation');
$$;

-- Route the frozen mutation function's admission gate through that authority.
--
-- The definition is read back from the catalog and re-executed with exactly one
-- expression replaced, so every other line of a 350-line security-definer body is
-- carried over verbatim instead of being retyped here. CREATE OR REPLACE keeps the
-- owner, the ACL, the signature and the search_path as they already are.
--
-- Before:  if p_record_kind not in (
--            'review', 'calendar', 'parent_settings', 'accommodation'
--          ) or p_expected_revision is null ...
-- After:   if not academy_private.study_adult_managed_record_kind_supported(
--            p_record_kind
--          ) or p_expected_revision is null ...
--
-- A substitution that matches nothing must abort. Silently leaving the literal
-- list in place would reintroduce exactly the drift this migration exists to
-- remove, and it would do so while every test that only checks the helper passes.
do $$
declare
  target oid;
  original text;
  rewritten text;
  gate constant text :=
    E'  if p_record_kind not in (\n'
    '    ''review'', ''calendar'', ''parent_settings'', ''accommodation''\n'
    '  ) or p_expected_revision is null';
  replacement constant text :=
    E'  if not academy_private.study_adult_managed_record_kind_supported(\n'
    '       p_record_kind\n'
    '     ) or p_expected_revision is null';
begin
  target := to_regprocedure(
    'public.academy_study_upsert_adult_managed_record(text,jsonb,bigint,text)'
  );
  -- Carriage returns are stripped first so the match cannot depend on how the
  -- predecessor migration happened to be checked out.
  original := replace(pg_get_functiondef(target), chr(13), '');
  rewritten := replace(original, gate, replacement);
  if rewritten = original then
    raise exception
      'STUDY_ACADEMIC_READINESS adult-managed admission gate not found';
  end if;
  execute rewritten;
end;
$$;

-- A required academic function is ready only when the whole contract holds: the
-- exact signature exists, it is owned by postgres, it is security definer with a
-- pinned search_path, the learner-facing role the adapters authenticate as can
-- execute it, and no unauthenticated role can. Anything less is a name.
--
-- The anon test is what catches a PUBLIC grant: anon inherits PUBLIC, so a
-- privilege widened to PUBLIC shows up here without a separate probe.
create function academy_private.study_academic_function_ready(p_signature text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  target oid;
  ready boolean;
begin
  target := to_regprocedure(p_signature);
  if target is null then
    return false;
  end if;
  select routine.prosecdef
    and pg_get_userbyid(routine.proowner) = 'postgres'
    and coalesce(routine.proconfig, array[]::text[])
      @> array['search_path=pg_catalog']
    and has_function_privilege('authenticated', target, 'EXECUTE')
    and not has_function_privilege('anon', target, 'EXECUTE')
  into ready
  from pg_proc as routine
  where routine.oid = target;
  return coalesce(ready, false);
end;
$$;

-- A required academic table is ready only when the relation exists, still
-- enforces row level security, and still carries every column the adapter
-- writes. Existence alone would be satisfied by an empty relation wearing the
-- right name, which is exactly the confusion this contract has to remove.
create function academy_private.study_academic_table_ready(
  p_table text,
  p_required_columns text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  target oid;
  present text[];
  protected boolean;
begin
  target := to_regclass(p_table);
  if target is null or p_required_columns is null then
    return false;
  end if;
  select relation.relrowsecurity into protected
  from pg_class as relation where relation.oid = target;
  if coalesce(protected, false) is not true then
    return false;
  end if;
  select coalesce(array_agg(attribute.attname::text), array[]::text[])
  into present
  from pg_attribute as attribute
  where attribute.attrelid = target
    and attribute.attnum > 0
    and not attribute.attisdropped;
  return present @> p_required_columns;
end;
$$;

-- Review, calendar and parent settings are three record kinds of ONE adult-managed
-- mutation, so their required signature is identical and signature checks alone
-- cannot tell them apart. A function that kept its name, signature, owner,
-- privileges and search_path but quietly stopped accepting a kind would otherwise
-- read as ready for a subsystem it can no longer serve.
--
-- Which kinds exist is answered by the shared authority, not by the mutation's
-- source text. This asks academy_private.study_adult_managed_record_kind_supported
-- the same question the mutation function's gate asks it, so the two agree by
-- construction, and withdrawing a kind closes exactly its dependency. Losing the
-- shared mutation entirely is an honest three-way outage and closes all three.
--
-- The second condition establishes that the authority is what the mutation's
-- ADMISSION GATE actually consults. Requiring only that the authority's name
-- appear somewhere in the body -- which is what this used to do -- is satisfied by
-- a call that decides nothing, and two arrangements defeat it outright: a call
-- parked in a dead branch, and a live call whose result is discarded. Either one
-- leaves the readiness answer 'ready' beside a real admission gate that is an
-- independent, narrower list refusing the kind at runtime.
--
-- So the whole gate expression is required: the opening `begin`, the
-- authentication guard, then the admission statement whose condition routes
-- through the authority and whose body raises. A discarded call is not that
-- statement. An occurrence in a comment, in a string literal, or split across
-- concatenated literals is not that statement either, because comments and
-- literals are removed before the search.
--
-- Requiring that expression to be PRESENT is still not enough, and the `begin` it
-- opens with does not by itself make the match structural. PL/pgSQL nests blocks,
-- so a `begin` can be interposed: a block that never runs -- a dead branch, an
-- unreached exception handler, a block appended after the live logic -- can carry
-- a verbatim copy of this entire prologue while the live path admits kinds from an
-- independent narrower list beside it. That was measured here against all three
-- kinds in all three placements and reported ready every time. Nor is it answered
-- by extending the expected text leftwards into the declaration section: a nested
-- block may open its own DECLARE and reproduce the declaration tail verbatim,
-- which was measured too.
--
-- What separates the real entry from every nested copy is POSITION, not more text.
-- A PL/pgSQL body's first `begin` token is the function's own entry: everything
-- ahead of it is the declaration section, and every nested block's `begin`
-- necessarily comes after it. So the gate is required to START at that first
-- `begin`. This costs no additional expected text: the declaration list is
-- deliberately NOT spelled out, so adding or removing a declared variable cannot
-- rot the probe.
--
-- The check reads prosrc rather than a rendered CREATE statement so that the
-- position it tests means what it says: prosrc IS the body, so its first
-- character is the function's entry. Reading pg_get_functiondef instead answers
-- identically on this lineage -- the rendered header carries no `begin` token, so
-- the prefix test is unaffected, and that was measured across every decoy shape
-- the suite exercises rather than assumed. The choice is about what the check can
-- be read to CLAIM, not about a behaviour difference it currently has.
--
-- Position moves the sensitive region rather than removing it. Everything AHEAD of
-- the first `begin` -- the declaration section -- passes the position test by
-- definition, so a whole-gate decoy planted there would satisfy both halves. What
-- refuses it is the normalisation: comments and string literals are removed before
-- the search, so a gate commented or quoted into the declarations is gone before
-- the position is ever computed. That is why comment stripping is load-bearing
-- here and not merely tidy, and it has its own forcing case in the suite.
--
-- The expected text IS written out by hand here, which is the obvious way for a
-- probe like this to rot. It is not left on trust: the DO block below asserts that
-- this probe answers true for 'review' immediately after the rewrite installs the
-- gate, so a probe and a gate that disagree abort the migration rather than ship.
--
-- WHAT THIS DOES NOT ESTABLISH. It is a read-only structural check over definition
-- text, not an interpreter: it executes no PL/pgSQL and evaluates no branch. It
-- proves the expected admission gate is present at the function's entry and that
-- admission there routes through the shared authority. It cannot prove that no
-- LATER, independent restriction has been inserted downstream of that gate: a
-- body that keeps this prologue intact and
-- then raises for one kind further down still reads structurally ready here, and
-- would be refused at runtime. Proving otherwise would require semantically
-- executing arbitrary PL/pgSQL, which no catalog read can do, and executing the
-- real mutation from inside a readiness probe -- which is forbidden, because this
-- RPC is read-only by contract. That limit is inherent to read-only structural
-- readiness and is stated here rather than papered over.
--
-- Normalisation is comment removal, string-literal removal, then collapsing every
-- whitespace run to a single space, so reindentation and line rewrapping are
-- tolerated and content is not. Normalisation cannot produce a false ready:
-- anything it removes by mistake can only make the search fail, which closes the
-- dependency.
create function academy_private.study_academic_record_kind_ready(p_kind text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  target oid;
  body text;
  gate_at integer;
  -- The prologue this migration leaves behind, in the normalised form produced
  -- below. Adjacent literals concatenate; the whole is one line of normalised SQL.
  gate constant text :=
    'begin if auth.uid() is null then raise exception using errcode = ; end if;'
    ' if not academy_private.study_adult_managed_record_kind_supported('
    ' p_record_kind ) or p_expected_revision is null or p_expected_revision < 0'
    ' or not public.academy_study_payload_is_minimized(p_record, 16384)'
    ' or not public.academy_study_identifier_is_valid(p_idempotency_key) then'
    ' raise exception using errcode = ; end if;';
begin
  target := to_regprocedure(
    'public.academy_study_upsert_adult_managed_record(text,jsonb,bigint,text)'
  );
  if target is null or p_kind is null then
    return false;
  end if;
  if to_regprocedure(
       'academy_private.study_adult_managed_record_kind_supported(text)'
     ) is null then
    return false;
  end if;
  if not academy_private.study_adult_managed_record_kind_supported(p_kind) then
    return false;
  end if;
  -- prosrc, not pg_get_functiondef: the body on its own, so that its first
  -- character is the function's entry and the position tested below is a fact
  -- about the body rather than about how a CREATE statement happens to render.
  select replace(routine.prosrc, chr(13), '') into body
  from pg_proc as routine where routine.oid = target;
  if body is null then
    return false;
  end if;
  body := regexp_replace(body, '--[^\n]*', '', 'g');
  body := regexp_replace(body, '/\*.*?\*/', '', 'gs');
  -- Single-quoted literals, doubled-quote escapes included. Removing them is what
  -- defeats both the literal decoy and the split-literal decoy: neither survives.
  body := regexp_replace(body, $q$'(''|[^'])*'$q$, '', 'g');
  body := btrim(regexp_replace(body, '\s+', ' ', 'g'));

  gate_at := strpos(body, gate);
  if gate_at = 0 then
    return false;
  end if;
  -- ...and it must open the function, not merely occur in it. The body's first
  -- `begin` token is the outer entry -- only declarations may precede it, and any
  -- nested block's `begin` comes later -- so a gate that starts anywhere else is a
  -- copy sitting in a block, reachable or not, beside whatever the live path
  -- actually does. Nothing here evaluates that block; position is the whole claim.
  return left(body, gate_at - 1) !~ '\mbegin\M';
end;
$$;

-- The closed loop. The gate above is rewritten by this migration and the expected
-- text is written out separately in the probe; nothing but this assertion stops
-- the two from drifting. Run after both exist, it fails the whole migration if the
-- definition actually installed is not the one the probe recognises -- which is the
-- only way to keep a hand-written expectation honest.
do $$
begin
  if not academy_private.study_academic_record_kind_ready('review') then
    raise exception
      'STUDY_ACADEMIC_READINESS admission gate not recognised by readiness';
  end if;
end;
$$;

-- The consolidated contract. One closed record, seven closed dependency states,
-- no rows, no learner data, no free-text database error body.
create function public.academy_study_academic_readiness_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  contract_current boolean;
  session_ready boolean;
  checkpoint_ready boolean;
  adult_managed_ready boolean;
  adult_managed_scope_ready boolean;
  review_ready boolean;
  calendar_ready boolean;
  parent_settings_ready boolean;
  adult_private_ready boolean;
  event_ledger_ready boolean;
begin
  -- Unchanged trusted-server boundary, copied from the sibling readiness RPCs.
  -- A learner-facing caller must never reach a catalog probe.
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;

  -- The academic contract version. An absent singleton leaves this NULL, which
  -- coalesces to false and fails every dependency closed rather than leaving an
  -- unknown estate looking ready.
  --
  -- authorization_version is the marker checked here because it is the one that
  -- can actually be wrong: it admits 0 or 1. storage_version is deliberately not
  -- checked — its column constraint is `check (storage_version = 1)`, so while
  -- the singleton exists it cannot hold any other value, and a predicate that
  -- can never be false is not a gate. The objects the storage migration creates
  -- are proven directly by the table checks below instead.
  select metadata.authorization_version = 1
  into contract_current
  from academy_private.study_persistence_metadata as metadata
  where metadata.singleton;
  contract_current := coalesce(contract_current, false);

  adult_managed_ready := academy_private.study_academic_function_ready(
    'public.academy_study_upsert_adult_managed_record(text,jsonb,bigint,text)'
  );

  -- Every column below was derived by dropping it and running the dependency's
  -- real production operation. A column is listed only where its loss actually
  -- breaks that operation, and every column whose loss breaks it is listed --
  -- including the ones a reading of the INSERT lists alone would miss, such as the
  -- timezone snapshot pair the storage triggers maintain and the checkpoint
  -- columns that only the recovery read returns.
  session_ready := contract_current
    and academy_private.study_academic_function_ready(
      'public.academy_study_create_session(jsonb,text)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_transition_session(text,bigint,text,timestamptz,text)')
    and academy_private.study_academic_table_ready(
      'public.academy_study_sessions',
      array[
        'id', 'schema_version', 'household_id', 'student_id', 'lesson_id',
        'subject_id', 'study_plan_id', 'state', 'started_at', 'completed_at',
        'intended_local_date', 'household_timezone', 'created_by', 'revision',
        'timezone_snapshot_revision', 'timezone_snapshot_provenance'
      ]::text[]);

  -- The checkpoint compare-and-swap pivots on revision, rewrites the integrity
  -- digest through a trigger over 22 columns, and the recovery read returns
  -- created_at/updated_at by name. expires_at is written only on first insert.
  -- The session identity columns are required because the swap reads the session
  -- row before it touches the checkpoint.
  checkpoint_ready := contract_current
    and academy_private.study_academic_function_ready(
      'public.academy_study_read_checkpoint(text)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_compare_and_swap_checkpoint(text,bigint,text,jsonb)')
    and academy_private.study_academic_table_ready(
      'public.academy_study_checkpoints',
      array[
        'id', 'household_id', 'student_id', 'session_id', 'lesson_id',
        'segment_id', 'canonical_task_id', 'safe_instructional_cursor',
        'completed_segment_ids', 'per_segment_active_time', 'paused_time',
        'break_time', 'protected_draft_reference', 'draft_revision',
        'last_accepted_event_id', 'event_version',
        'opaque_tutor_state_reference', 'tutor_interaction_reference',
        'technical_interruption_state', 'household_timezone', 'integrity_digest',
        'revision', 'expires_at', 'created_at', 'updated_at',
        'timezone_snapshot_revision', 'timezone_snapshot_provenance'
      ]::text[])
    and academy_private.study_academic_table_ready(
      'public.academy_study_sessions',
      array['id', 'household_id', 'student_id', 'lesson_id']::text[]);

  -- The shared mutation's ownership guard queries reviews, calendar blocks AND
  -- accommodations on every call regardless of kind, so all three adult-managed
  -- dependencies require the identity columns of all three tables. Dropping
  -- reviews.id really does break a calendar upsert.
  adult_managed_scope_ready :=
    academy_private.study_academic_table_ready(
      'public.academy_study_reviews',
      array['id', 'household_id', 'student_id']::text[])
    and academy_private.study_academic_table_ready(
      'public.academy_study_calendar_blocks',
      array['id', 'household_id', 'student_id']::text[])
    and academy_private.study_academic_table_ready(
      'public.academy_study_accommodations',
      array['id', 'household_id', 'student_id']::text[]);

  review_ready := contract_current
    and adult_managed_ready
    and adult_managed_scope_ready
    and academy_private.study_academic_record_kind_ready('review')
    and academy_private.study_academic_table_ready(
      'public.academy_study_reviews',
      array[
        'id', 'household_id', 'student_id', 'skill_id', 'source_session_id',
        'review_kind', 'due_at', 'intended_local_date', 'household_timezone',
        'priority', 'state', 'attempt_count', 'interval_days',
        'reteaching_required', 'prerequisite_remediation_required',
        'idempotency_key', 'revision', 'timezone_snapshot_revision',
        'timezone_snapshot_provenance'
      ]::text[]);

  calendar_ready := contract_current
    and adult_managed_ready
    and adult_managed_scope_ready
    and academy_private.study_academic_record_kind_ready('calendar')
    and academy_private.study_academic_table_ready(
      'public.academy_study_calendar_blocks',
      array[
        'id', 'household_id', 'student_id', 'block_type', 'source_reference',
        'scheduled_start', 'intended_local_date', 'household_timezone',
        'explicit_offset', 'duration_minutes', 'completion_units',
        'required_units', 'resume_session_id', 'resume_segment_id', 'state',
        'idempotency_key', 'revision', 'timezone_snapshot_revision',
        'timezone_snapshot_provenance', 'intended_local_time', 'dst_resolution'
      ]::text[]);

  -- academy_study_effective_settings is part of this dependency's contract and
  -- reads accommodations to compose the effective answer, so those columns are
  -- required here too: without effective_from the parent-settings adapter raises
  -- at runtime while its own table is intact.
  parent_settings_ready := contract_current
    and adult_managed_ready
    and adult_managed_scope_ready
    and academy_private.study_academic_record_kind_ready('parent_settings')
    and academy_private.study_academic_function_ready(
      'public.academy_study_effective_settings(uuid,date)')
    and academy_private.study_academic_table_ready(
      'public.academy_study_parent_settings',
      array[
        'household_id', 'student_id', 'timer_mode', 'maximum_work_minutes',
        'break_minimum_minutes', 'break_maximum_minutes', 'required_breaks',
        'reduced_motion', 'no_audio', 'large_text', 'read_aloud',
        'speech_input_allowed', 'parent_override', 'revision', 'updated_by'
      ]::text[])
    and academy_private.study_academic_table_ready(
      'public.academy_study_accommodations',
      array[
        'id', 'household_id', 'student_id', 'maximum_duration_minutes',
        'required_break_interval_minutes', 'required_break_duration_minutes',
        'timer_visibility', 'presentation_accommodations', 'effective_from',
        'effective_until', 'state', 'revision'
      ]::text[]);

  -- Privacy-sensitive. Schema and function metadata only: no note body, no
  -- protected work payload, no author, no count of either.
  adult_private_ready := contract_current
    and academy_private.study_academic_function_ready(
      'public.academy_study_store_protected_work(jsonb)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_read_protected_work(uuid,text,bigint)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_append_adult_note(jsonb)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_list_adult_note_metadata(uuid)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_read_adult_note(uuid,text,bigint,uuid)')
    and academy_private.study_academic_table_ready(
      'academy_private.study_protected_learner_work',
      array[
        'id', 'revision', 'household_id', 'student_id', 'session_id',
        'checkpoint_id', 'encryption_scheme', 'kms_key_reference',
        'wrapped_data_key', 'nonce', 'authentication_tag', 'encrypted_payload',
        'keyed_integrity_tag', 'retention_state', 'expires_at'
      ]::text[])
    and academy_private.study_academic_table_ready(
      'academy_private.study_adult_notes',
      array[
        'note_id', 'revision', 'household_id', 'student_id', 'category',
        'encrypted_body', 'encryption_scheme', 'kms_key_reference',
        'wrapped_data_key', 'nonce', 'authentication_tag', 'keyed_integrity_tag',
        'author_user_id', 'retention_state', 'expires_at', 'created_at'
      ]::text[])
    -- Protected work is stored against a session, so the session identity columns
    -- are part of this dependency's contract as well.
    and academy_private.study_academic_table_ready(
      'public.academy_study_sessions',
      array['id', 'household_id', 'student_id']::text[]);

  event_ledger_ready := contract_current
    and academy_private.study_academic_function_ready(
      'public.academy_study_append_event(text,text,integer,text)')
    and academy_private.study_academic_table_ready(
      'public.academy_study_event_ledger',
      array[
        'session_id', 'event_id', 'household_id', 'student_id', 'event_version',
        'event_kind', 'sequence_number', 'accepted_at', 'minimized_payload',
        'payload_digest', 'idempotency_key'
      ]::text[])
    and academy_private.study_academic_table_ready(
      'public.academy_study_sessions',
      array['id', 'household_id', 'student_id']::text[]);

  return jsonb_build_object(
    'schemaVersion', 1,
    'contractVersion', 1,
    'status', case when session_ready and checkpoint_ready and review_ready
        and calendar_ready and parent_settings_ready and adult_private_ready
        and event_ledger_ready
      then 'ready' else 'not-ready' end,
    'dependencies', jsonb_build_object(
      'study-session-adapter',
        case when session_ready then 'ready' else 'not-ready' end,
      'checkpoint-adapter',
        case when checkpoint_ready then 'ready' else 'not-ready' end,
      'review-queue',
        case when review_ready then 'ready' else 'not-ready' end,
      'calendar-adapter',
        case when calendar_ready then 'ready' else 'not-ready' end,
      'parent-settings-adapter',
        case when parent_settings_ready then 'ready' else 'not-ready' end,
      'adult-private-adapter',
        case when adult_private_ready then 'ready' else 'not-ready' end,
      'event-ledger',
        case when event_ledger_ready then 'ready' else 'not-ready' end
    )
  );
end;
$$;

alter function academy_private.study_academic_function_ready(text)
  owner to postgres;
alter function academy_private.study_academic_table_ready(text, text[])
  owner to postgres;
alter function academy_private.study_academic_record_kind_ready(text)
  owner to postgres;
alter function academy_private.study_adult_managed_record_kind_supported(text)
  owner to postgres;
alter function public.academy_study_academic_readiness_v1() owner to postgres;

-- The helpers are implementation detail of the readiness function, which runs as
-- postgres; no role needs them directly.
revoke all on function academy_private.study_academic_function_ready(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_academic_table_ready(text, text[])
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_academic_record_kind_ready(text)
  from public, anon, authenticated, service_role;
-- The kind authority is reached only from inside security-definer functions that
-- already run as postgres, so no client role needs it either. A learner-facing
-- grant here would expose the shape of the adult-managed estate.
revoke all on function
  academy_private.study_adult_managed_record_kind_supported(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_academic_readiness_v1()
  from public, anon, authenticated, service_role;

-- Server/trusted service only, matching every other Study readiness RPC. A
-- learner-facing role gaining this would learn the shape of the estate.
grant execute on function public.academy_study_academic_readiness_v1()
  to service_role;

alter table academy_private.study_persistence_metadata
  add column academic_readiness_version smallint not null default 0
    check (academic_readiness_version in (0, 1));

update academy_private.study_persistence_metadata
set academic_readiness_version = 1,
    migration_names = array_append(
      migration_names,
      '20260808150000_academy_study_academic_readiness_contract'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'academic_readiness_version', 1,
      'academic_readiness_read_only', true,
      'academic_readiness_execute_role', 'service_role',
      'academic_readiness_dependency_count', 7,
      'academic_readiness_authorizes_study', false,
      -- The record-kind authority is now one shared function rather than a literal
      -- list inside the mutation plus a source-text search inside readiness.
      'adult_managed_kind_authority_version', 1,
      'adult_managed_kind_authority',
        'academy_private.study_adult_managed_record_kind_supported',
      'adult_managed_gate_rewritten_from', '20260808150000',
      -- Stated as it is, not as it would be convenient. The per-kind ANSWER comes
      -- from the authority; establishing that the authority is what the admission
      -- gate consults is a structural read of the mutation's definition text, and
      -- that read cannot prove the absence of a later independent restriction
      -- downstream of the gate. It reads text and position -- it evaluates no
      -- PL/pgSQL and decides no branch.
      'academic_readiness_kind_probe_reads_definition_text', true,
      'academic_readiness_kind_probe_verifies_admission_gate', true,
      -- The gate is required at the function's OUTER ENTRY: the body's first
      -- `begin`. Presence anywhere is not the claim -- a nested block that never
      -- runs can hold a verbatim copy of the whole gate.
      'academic_readiness_kind_probe_anchors_outer_entry', true,
      'academic_readiness_kind_probe_executes_plpgsql', false,
      'academic_readiness_kind_probe_proves_no_downstream_restriction', false
    ),
    updated_at = clock_timestamp()
where singleton;

comment on function public.academy_study_academic_readiness_v1() is
  'Read-only consolidated Study academic readiness. Reports a closed per-dependency status for all seven academic dependencies from catalog metadata, contract metadata and the shared adult-managed record-kind authority: no academic RPC is executed, no row is read, written or counted, and no learner, settings or adult-private content is exposed. Ready means the required server-side contract exists in the expected shape, not that a table name exists. Which record kinds exist is answered by the same function the mutation gate consults, never by a list of readiness'' own; that the gate consults it is established structurally, by requiring the expected admission-gate expression to OPEN the mutation -- to start at the body''s first `begin`, which is the function''s own entry. Presence anywhere in the definition is deliberately not the test, because a nested block that never runs can carry a verbatim copy of the whole gate. This reads definition text and position only; it executes no PL/pgSQL and evaluates no branch, so it cannot prove that no later independent restriction was inserted downstream of that gate -- proving that would need semantic execution of arbitrary PL/pgSQL, which this contract does not and must not perform. Executable by service_role only. Authorizes nothing.';

commit;
