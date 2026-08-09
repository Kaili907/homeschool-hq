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
-- admission gate actually consults. Four rounds of review established what does
-- NOT establish it, and every one of the failures was the same failure: a probe
-- that hand-parses PL/pgSQL is only as good as its lexer, and each round found one
-- more construct the lexer did not model. Requiring the helper's NAME somewhere is
-- satisfied by a dead branch or a discarded call. Requiring the whole gate
-- expression ANYWHERE is satisfied by a verbatim copy inside a nested block, since
-- PL/pgSQL blocks nest and a `begin` can be interposed. Requiring it to START at
-- the body's first `begin` moves the sensitive region into the declaration
-- section, where a whole-gate decoy survives inside a dollar-quoted default or a
-- double-quoted identifier -- neither of which the comment-and-literal stripping
-- removes. That last one was measured here at twelve of twelve before it was
-- closed: real narrowing at the mutation, `ready` at readiness.
--
-- So the authority is no longer a lexer. The mutation's body is pinned WHOLE, by
-- a SHA-256 fingerprint of its exact stored source, against a constant reviewed
-- and written out in this migration. There is nothing left to parse and therefore
-- nothing left to hide a decoy from: any byte of that body that differs from the
-- reviewed one closes the dependency, whether the difference is a smuggled gate,
-- a downstream restriction, or a harmless reindentation. Closing on harmless drift
-- is the accepted cost, and it is the right direction -- readiness may false-close,
-- and may never false-open.
--
-- That is only deterministic because this migration RECONSTRUCTS the body rather
-- than finding it: it reads the definition back, strips carriage returns, swaps
-- exactly one expression and re-executes. The strip is what makes the result
-- independent of how the frozen predecessor happened to be checked out -- measured
-- on a CRLF checkout, the body carries 351 carriage returns before the rewrite and
-- none after it. Normalisation therefore happens ONCE, here, at apply time; the
-- runtime probe normalises nothing at all, so it creates no equivalence class for
-- anything to hide in.
--
-- The digest primitive is the built-in sha256(bytea), which is core pg_catalog
-- from PostgreSQL 11 onwards. That was verified rather than assumed: pgcrypto is
-- NOT installed on this lineage -- pg_extension lists plpgsql alone and there is
-- no digest() in pg_proc -- so a pgcrypto-based gate would have failed closed
-- forever. No extension is added, no dependency is introduced, and convert_to and
-- encode are core as well, so the already-pinned search_path = pg_catalog reaches
-- all three.
--
-- What the fingerprint does NOT establish is stated on
-- academy_private.study_academic_record_kind_ready below, and it is narrower than
-- what it replaces: it pins the mutation's OWN body, not the bodies of the
-- functions that body calls, and not triggers on the tables it writes.
--
-- It also does not reach outside prosrc at all, which is not the same limit and is
-- easy to read past. prolang is metadata beside the body, so the exact reviewed
-- bytes can be re-declared as LANGUAGE sql: the digest agrees, the gate text agrees,
-- readiness reports ready, and every call to the mutation fails to parse. Measured
-- before it was closed. The language is therefore pinned by its own probe,
-- academy_private.study_adult_managed_language_ok, resolved through pg_language by
-- name rather than against a numeric OID that is an artefact of installation order.
-- The full list of non-body metadata and which check covers each is on
-- academy_private.study_academic_record_kind_ready below.
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
     ) is not null
     or to_regprocedure(
       'academy_private.study_adult_managed_body_fingerprint_ok()') is not null
     or to_regprocedure(
       'academy_private.study_adult_managed_language_ok()') is not null
     or to_regprocedure(
       'academy_private.study_adult_managed_gate_text_ok()') is not null then
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
-- ADMISSION GATE actually consults, and it does so by pinning the mutation's whole
-- body rather than by reading it.
--
-- INTEGRITY AUTHORITY. The exact stored source of the adult-managed mutation is
-- hashed and compared against the fingerprint of the body this migration installs,
-- written out below as a reviewed constant. Nothing is normalised at read time --
-- not comments, not literals, not whitespace, not line endings. Every equivalence
-- class a probe defines is somewhere a decoy can live, so this one defines none:
-- the comparison is over the bytes.
--
-- That is well defined only because this migration RECONSTRUCTS the body. It reads
-- the frozen definition back, strips carriage returns, substitutes one expression
-- and re-executes, so the installed source is a function of the predecessor's bytes
-- and one reviewed edit -- not of how the predecessor was checked out. Measured on
-- a CRLF checkout: 351 carriage returns in the body before the rewrite, none after.
--
-- WHY THE FINGERPRINT AND NOT MORE LEXING. Every previous version of this check
-- was a hand-written parser for a language that does not want to be hand-parsed,
-- and each review round found one more construct it did not model: nested blocks
-- carrying a verbatim copy of the prologue, then -- once the gate was anchored at
-- the outer entry -- whole-gate decoys planted AHEAD of that entry, in the
-- declaration section, inside a dollar-quoted default or a double-quoted
-- identifier. Neither is a comment and neither is a single-quoted literal, so the
-- stripping walked straight past them; twelve of twelve reported ready while the
-- mutation refused a supported kind. The defect was never the particular missing
-- rule. It was that the probe's authority rested on enumerating carriers.
--
-- A digest enumerates nothing. Any byte of the body that differs from the reviewed
-- one closes the dependency, so a decoy cannot be added, a restriction cannot be
-- inserted, and an expression cannot be swapped, whatever lexical costume it wears.
--
-- THE GATE-TEXT PROBE IS RETAINED, AS A SECONDARY AND. It is no longer the
-- authority and cannot make anything ready on its own: readiness requires the
-- fingerprint AND the gate text, so the fingerprint always dominates to not-ready
-- and the text probe can only ever close something the fingerprint left open. It
-- earns its keep in exactly one scenario -- a reviewed fingerprint constant
-- re-pinned to a body whose gate is gone -- where the digest agrees with itself and
-- only the text probe still objects.
--
-- WHAT THIS DOES NOT ESTABLISH, restated because H5 made the old statement wrong.
-- The previous version could not see a restriction inserted downstream of an intact
-- gate, and documented that as inherent to read-only structural readiness. It is
-- not inherent, and it is no longer true: a downstream restriction changes the
-- body, the body's fingerprint changes with it, and the dependency closes. What
-- remains is narrower and is a genuine boundary. The pin covers the mutation's OWN
-- source and nothing further: a restriction moved into a function this body CALLS,
-- or into a trigger on a table it writes, leaves these bytes untouched. And the
-- claim rests on SHA-256 collision resistance -- a semantically different body with
-- an identical digest would defeat it, which is a cryptographic assumption rather
-- than a proof.
--
-- IT ALSO DOES NOT COVER ANY NON-BODY METADATA, and that is worth spelling out
-- because "the body is pinned WHOLE" reads like it covers the function. It covers
-- prosrc. Everything else about the function is metadata beside prosrc and is
-- unchanged by any edit to it, so each piece that matters is checked separately and
-- named here rather than assumed to come along with the digest:
--
--   prolang       -- academy_private.study_adult_managed_language_ok, below.
--                    The one that was missing until H6, and the one that can make
--                    identical bytes mean something else entirely.
--   prosecdef     -- study_academic_function_ready: security definer required.
--   proowner      -- study_academic_function_ready: postgres required.
--   proconfig     -- study_academic_function_ready: search_path=pg_catalog required.
--   ACL           -- study_academic_function_ready: authenticated may execute and
--                    anon may not, which is also what catches a PUBLIC grant.
--   caller identity -- the trusted-server guard on the readiness RPC itself, which
--                    is upstream of every probe here.
--
-- provolatile is deliberately NOT in that list, and this is the statement of a gap
-- rather than of a defence: nothing in this contract pins the mutation's volatility.
-- It is left as it is because narrowing it is a change to what readiness requires of
-- the estate, not a closure of the body-versus-metadata asymmetry H6 exists to fix.
create function academy_private.study_adult_managed_body_fingerprint_ok()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  target oid;
  body text;
  -- The fingerprint of the body this migration installs. Reviewed and pinned here,
  -- never derived at run time: a probe that hashed the current body and compared it
  -- to itself would agree with every body there is. The DO block below closes the
  -- loop by requiring the reconstructed definition to match this constant, so the
  -- value cannot drift from what is actually installed without failing the apply.
  reviewed constant text :=
    '8e1cf860b98f31e626ae288d6b6cbdc59ad263b3c30118dd600b409a17940989';
begin
  target := to_regprocedure(
    'public.academy_study_upsert_adult_managed_record(text,jsonb,bigint,text)'
  );
  if target is null then
    return false;
  end if;
  select routine.prosrc into body
  from pg_proc as routine where routine.oid = target;
  -- A missing definition is not a passing one. An absent function, a null prosrc
  -- and an empty prosrc all reach a digest that cannot equal the reviewed constant.
  if body is null then
    return false;
  end if;
  -- sha256 is core pg_catalog from PostgreSQL 11; pgcrypto is NOT installed on this
  -- lineage and is deliberately not depended on. convert_to fixes the encoding so
  -- the digest is over bytes rather than over a server-encoding-dependent rendering.
  return encode(sha256(convert_to(body, 'UTF8')), 'hex') = reviewed;
end;
$$;

-- WHAT THE DIGEST CANNOT REACH: the language the body is written in.
--
-- prosrc is the body. prolang is not in it, and prolang is what decides how those
-- bytes are executed -- so the two are separable, and separating them is a real
-- asymmetry rather than a theoretical one. It was reproduced before being closed:
-- the exact reviewed prosrc, byte for byte, re-declared as LANGUAGE sql. The digest
-- agreed, the gate text agreed, readiness reported all seven dependencies ready and
-- the top-level status ready, and every call to the mutation failed with a syntax
-- error, because a PL/pgSQL body is not a SQL one. The estate was down and the
-- contract said it was up, which is the one direction this contract may not fail in.
--
-- Reaching that state needs check_function_bodies = off and ownership of the
-- function, so it is not a low-privilege attack. It is pinned anyway: the whole
-- point of a byte-exact body pin is that it does not get to decide which drift was
-- harmless, and a body that cannot execute is not harmless drift.
--
-- The check resolves the language by NAME through pg_language rather than by
-- comparing prolang against a numeric OID constant. plpgsql's OID is assigned when
-- the extension is created and is not a fixed catalog constant, so a constant would
-- be pinning an accident of installation order.
--
-- exists() rather than an equality that could be NULL: an absent function, and a
-- prolang naming no language, both produce no row and so produce false. There is no
-- separate early return for the absent case because there is no path where one
-- would answer differently, and a branch that cannot be forced is not a defence.
create function academy_private.study_adult_managed_language_ok()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  return exists (
    select 1
    from pg_proc as routine
    join pg_language as language on language.oid = routine.prolang
    where routine.oid = to_regprocedure(
        'public.academy_study_upsert_adult_managed_record(text,jsonb,bigint,text)')
      and language.lanname = 'plpgsql'
  );
end;
$$;

-- The secondary text probe. Same requirement as before H5 -- the whole expected
-- admission gate, normalised, must START at the body's first `begin`, which is the
-- function's outer entry -- and the same normalisation: comment removal, then
-- single-quoted literal removal, then whitespace collapse.
--
-- It is kept in its own function so that it can be forced directly. As an ANDed
-- term behind a byte-exact fingerprint it is otherwise untestable in isolation:
-- every input that would distinguish its branches has already been refused by the
-- digest, which is precisely how a weakened branch survived the previous suite.
create function academy_private.study_adult_managed_gate_text_ok()
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
  if target is null then
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
  -- No recognised gate is NOT READY, and says so here rather than falling through.
  -- A body in another language carries no `begin` at all, so `left(body, -1)` would
  -- have nothing to catch: without this the absent case would read as ready.
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

-- Which kinds exist is the authority's answer; whether the mutation that consults
-- it is still the reviewed one is the fingerprint's, together with the language
-- probe that says those reviewed bytes are still executed as PL/pgSQL. All three
-- are required, and the fingerprint is listed first because it is the dominating
-- term over body content: no arrangement of definition text can make this true
-- while the installed body differs from the reviewed one.
--
-- The three terms are separable on purpose, and each closes something the other two
-- do not: the fingerprint answers for the bytes, the language probe for the one
-- piece of non-body metadata that changes what those bytes mean, and the gate text
-- for a fingerprint constant re-pinned to a body whose gate is gone.
create function academy_private.study_academic_record_kind_ready(p_kind text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if p_kind is null
     or to_regprocedure(
       'public.academy_study_upsert_adult_managed_record(text,jsonb,bigint,text)'
     ) is null then
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
  return academy_private.study_adult_managed_body_fingerprint_ok()
    and academy_private.study_adult_managed_language_ok()
    and academy_private.study_adult_managed_gate_text_ok();
end;
$$;

-- The closed loop. Both expectations above -- the reviewed fingerprint and the
-- expected gate text -- are written out by hand, which is the obvious way for them
-- to rot. Nothing but this assertion stops them from drifting from the definition
-- the migration actually installs. Run after both probes exist, it fails the whole
-- migration rather than shipping a readiness answer nobody has checked.
--
-- Two conditions, and they are NOT two independent lines of defence -- stated
-- plainly because it would be easy to read them as such. The second is the AND of
-- the kind authority, the fingerprint and the gate text, so it already aborts on
-- everything the first catches. The first earns its place by naming the common
-- case precisely: "the body I just installed is not the body that was reviewed" is
-- what an operator needs to read, and the end-to-end failure alone does not say it.
-- The second has reach the first does not, which is why the order is not reversed:
-- a kind withdrawn from the authority fails only there.
--
-- A third, gate-text-only assertion sat between them and was removed rather than
-- kept. It could not fire on any input the second does not already reject, and a
-- mutation confirmed it by deleting the assertion and surviving the entire suite.
-- An assertion that cannot fail is not defence in depth, it is furniture.
--
-- The language probe gets no assertion of its own here for the same reason, and the
-- reason is stronger: the second assertion already ANDs it, and the language cannot
-- change during an apply that reaches this point at all. The rewrite re-executes
-- pg_get_functiondef, which renders the predecessor's own LANGUAGE clause, and a
-- predecessor that was not PL/pgSQL would not carry the PL/pgSQL gate the
-- substitution above requires -- so it would already have aborted on
-- 'admission gate not found'. There is no input on which a language assertion here
-- could be the thing that fires.
do $$
begin
  if not academy_private.study_adult_managed_body_fingerprint_ok() then
    raise exception
      'STUDY_ACADEMIC_READINESS installed body is not the reviewed body';
  end if;
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
alter function academy_private.study_adult_managed_body_fingerprint_ok()
  owner to postgres;
alter function academy_private.study_adult_managed_language_ok()
  owner to postgres;
alter function academy_private.study_adult_managed_gate_text_ok()
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
-- The body probes read a security-definer function's source. Nothing client-facing
-- needs them, and the definition text they inspect is estate shape. The language
-- probe reads catalog metadata about the same function and carries the same posture.
revoke all on function academy_private.study_adult_managed_body_fingerprint_ok()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_adult_managed_language_ok()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_adult_managed_gate_text_ok()
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
      -- from the authority. That the authority is what the admission gate consults
      -- is established by pinning the mutation's whole body to a reviewed SHA-256
      -- fingerprint of its exact stored source, with no normalisation at read time.
      'academic_readiness_kind_probe_reads_definition_text', true,
      'academic_readiness_kind_probe_verifies_admission_gate', true,
      'academic_readiness_body_fingerprint_algorithm', 'sha256',
      'academic_readiness_body_fingerprint_normalises_at_read', false,
      -- The digest is over prosrc, and prolang is not in prosrc. Identical reviewed
      -- bytes re-declared as LANGUAGE sql passed the digest and the gate text while
      -- every call failed to parse, so the language is pinned separately, by name.
      'academic_readiness_body_fingerprint_covers_language', false,
      'academic_readiness_function_language_pinned', true,
      'academic_readiness_function_language', 'plpgsql',
      -- Carriage returns are stripped ONCE, by the rewrite, so the installed body
      -- does not depend on how the frozen predecessor was checked out.
      'academic_readiness_body_normalised_at_apply', 'strip-cr',
      -- The gate text probe is retained but demoted: it is ANDed behind the
      -- fingerprint and can only close a dependency, never open one.
      'academic_readiness_kind_probe_anchors_outer_entry', true,
      'academic_readiness_gate_text_probe_is_secondary', true,
      'academic_readiness_kind_probe_executes_plpgsql', false,
      -- TRUE as of H5, and it was false before. A restriction inserted downstream
      -- of an intact gate changes the body, which changes the fingerprint, which
      -- closes the dependency. What the pin does NOT reach is the bodies of the
      -- functions this one calls and the triggers on the tables it writes.
      'academic_readiness_kind_probe_proves_no_downstream_restriction', true,
      'academic_readiness_body_pin_covers_transitive_callees', false
    ),
    updated_at = clock_timestamp()
where singleton;

comment on function public.academy_study_academic_readiness_v1() is
  'Read-only consolidated Study academic readiness. Reports a closed per-dependency status for all seven academic dependencies from catalog metadata, contract metadata and the shared adult-managed record-kind authority: no academic RPC is executed, no row is read, written or counted, and no learner, settings or adult-private content is exposed. Ready means the required server-side contract exists in the expected shape, not that a table name exists. Which record kinds exist is answered by the same function the mutation gate consults, never by a list of readiness'' own. That the gate consults it is established by pinning the mutation''s WHOLE body: the exact stored source is hashed with the built-in sha256 and compared against a fingerprint reviewed and written into the migration, with no normalisation at read time, so any byte that differs from the reviewed body closes the dependency. Carriage returns are stripped once, by the migration''s own reconstruction of the body, which is what makes the pin independent of how the frozen predecessor was checked out. The digest covers prosrc and nothing beside it, so the function''s LANGUAGE is pinned separately and by name: the same reviewed bytes re-declared as LANGUAGE sql satisfy the digest and the gate text while every call fails to parse. The older structural gate-text check is retained only as an ANDed secondary term, so it can close a dependency but never open one. This executes no PL/pgSQL and evaluates no branch; it does not need to, because a downstream restriction changes the body and so changes the fingerprint. What the pin does not reach is the bodies of the functions this one calls and the triggers on the tables it writes, and it rests on SHA-256 collision resistance. Executable by service_role only. Authorizes nothing.';

commit;
