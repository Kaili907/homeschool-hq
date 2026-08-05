-- =====================================================================
-- A6-5 PREPARED HOSTED CHANGE — WRITTEN, NOT EXECUTED
-- =====================================================================
-- This file is NOT a migration and is deliberately not in supabase/migrations.
-- Nothing here has been run against any database, hosted or local.
--
-- The Director executes these by hand, as `postgres`, under a written
-- authorization block. Two independent statements, in this order:
--
--   PART A — a non-mutating guardian read path over captured safety events.
--            Safe to run on its own. Does NOT enable any delivery.
--   PART B — approval of in-app adult-notification delivery.
--            This is the child-safety decision. Run only when intended.
--
-- Part A alone closes the "the dispatcher is blind" gap: safety events that
-- were captured but never delivered become visible in the Parent Hub. It grants
-- no new write capability and cannot cause a notification to be sent.
-- =====================================================================


-- =====================================================================
-- PART A — guardian read path over captured adult-review proposals
-- =====================================================================
-- Why this is needed: academy_private.study_adult_review_proposals_v1 has
-- FORCE ROW LEVEL SECURITY with no policy and ALL privileges revoked from
-- public/anon/authenticated/service_role
-- (20260801012000_..._production_reconciliation.sql:2001-2002, :2030-2031).
-- The only existing reader, public.academy_study_claim_adult_review_proposals_v2,
-- is a worker claim that takes a lease and mutates rows
-- (20260801170000_..._adult_review_operations.sql:997-1056). There is no
-- non-mutating read path at all.
--
-- This function mirrors the authorization of the already-accepted
-- public.academy_study_list_parent_notifications_v1
-- (20260801190000_..._final_production_reconciliation.sql:141-203): the caller
-- must be an authenticated, active guardian with active access to that student.
-- It returns only opaque refs, classification metadata and timestamps — no
-- learner text, no tutor text, no reason codes, no recipient contact value.

begin;

create or replace function public.academy_study_list_adult_review_proposals_v1(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare result jsonb;
begin
  if auth.uid() is null or p_limit not between 1 and 100 then
    raise exception 'STUDY_GUARDIAN_REQUIRED' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'reviewId', review.proposal_id,
    'learnerRef', academy_private.study_learner_ref(review.student_id),
    'reasonCategory', case review.classification
      when 'urgent' then 'immediate-safety'
      when 'uncertain' then 'possible-safety'
      else 'review-required' end,
    'urgency', review.urgency,
    'occurredAt', review.occurred_at,
    'deliveryState', review.state
  ) order by review.occurred_at desc), '[]'::jsonb)
  into result
  from (
    select proposal.*
    from academy_private.study_adult_review_proposals_v1 as proposal
    join public.academy_household_memberships as membership
      on membership.household_id = proposal.household_id
    join public.academy_guardian_student_access as access
      on access.membership_id = membership.id
     and access.household_id = proposal.household_id
     and access.student_id = proposal.student_id
    where membership.user_id = auth.uid()
      and membership.member_role = 'guardian'
      and membership.status = 'active' and membership.revoked_at is null
      and access.status = 'active' and access.revoked_at is null
      and access.permission_level in ('learning_manager', 'identity_manager')
      and proposal.retain_until > clock_timestamp()
    order by proposal.occurred_at desc
    limit p_limit
  ) as review;
  return jsonb_build_object('pendingReviews', result);
end;
$$;

alter function public.academy_study_list_adult_review_proposals_v1(integer)
  owner to postgres;
revoke all on function public.academy_study_list_adult_review_proposals_v1(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_study_list_adult_review_proposals_v1(integer)
  to authenticated;

commit;

-- Verification after PART A (expected: one row, prosecdef = true, and EXECUTE
-- granted to authenticated only):
--   select proname, prosecdef, provolatile,
--          has_function_privilege('authenticated',
--            'public.academy_study_list_adult_review_proposals_v1(integer)', 'EXECUTE') as authenticated_execute,
--          has_function_privilege('anon',
--            'public.academy_study_list_adult_review_proposals_v1(integer)', 'EXECUTE') as anon_execute
--     from pg_proc
--    where proname = 'academy_study_list_adult_review_proposals_v1';


-- =====================================================================
-- PART B — approve in-app adult-notification delivery
-- =====================================================================
-- THIS IS THE CHILD-SAFETY DECISION. Do not run it to "make the tests pass".
--
-- Current refusal, verified in this tree:
--   academy_private.study_production_policy.adult_review_in_app_delivery_policy
--   defaults to 'not-approved'
--   (20260801190000_..._final_production_reconciliation.sql:35-53), and
--   public.academy_study_deliver_in_app_notification_v2 raises
--   'STUDY_ADULT_REVIEW_POLICY_NOT_APPROVED' unless it reads 'approved'
--   (same file, :456-460).
--
-- The table has FORCE RLS with all privileges revoked from every application
-- role including service_role (same file, :54-58), so this UPDATE must run as
-- `postgres` directly against the database. It cannot be performed by the app,
-- by a Netlify function, or through PostgREST.
--
-- The CHECK constraint study_production_policy_approval_check requires all
-- three approval columns when the policy is 'approved'. Substitute a real
-- auth.users id for the approving Director before running.

-- begin;
--
-- update academy_private.study_production_policy
--    set adult_review_in_app_delivery_policy = 'approved',
--        approval_reference = 'a6-5-director-approval-v1',
--        approved_by = '00000000-0000-0000-0000-000000000000'::uuid,  -- REPLACE
--        approved_at = clock_timestamp(),
--        revision = revision + 1,
--        updated_at = clock_timestamp()
--  where singleton;
--
-- commit;

-- PART B is necessary but NOT sufficient for notifications to actually send.
-- Readiness (public.academy_study_adult_review_readiness_v2, defined at
-- 20260801170000_..._adult_review_operations.sql:2601-2650) also requires:
--
--   1. academy_private.study_adult_review_route_capabilities where route='in-app'
--      to be readiness='ready' AND allows_production=true. It is seeded
--      'not-ready' / false with decision_code 'director-policy-approval-required'
--      (same file, :569-579).
--
--   2. at least one active, unexpired row in
--      academy_private.study_adult_review_worker_registry holding all seven
--      scopes: proposal-resolution, delivery-claim, delivery-attempt,
--      delivery-reconcile, monitoring, rate-limit, retention. That table is
--      empty; registering a worker means minting a credential and storing its
--      sha256 digest, which is a credential-issuance decision, not a schema one.
--
-- Both are deliberately left unwritten here: each is a separate authorization
-- with its own blast radius, and neither should be bundled into this card.
