-- CURR-STANDARDS-01: evidence-gated human decisions for unresolved standards mappings.
-- Decisions are deliberately separate from immutable releases and mutable draft entities.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy curriculum standards review migration must run as postgres';
  end if;
end;
$$;

alter table academy_private.admin_audit_events
  drop constraint admin_audit_events_action_check,
  drop constraint admin_audit_events_resource_type_check;

alter table academy_private.admin_audit_events
  add constraint admin_audit_events_action_check check (action in (
    'admin_role.assign', 'admin_role.revoke', 'configuration.update',
    'engine.control', 'safety.triage', 'incident.acknowledge',
    'curriculum_draft.create', 'curriculum_draft.update',
    'curriculum_entity.create', 'curriculum_entity.update',
    'curriculum_entity.tombstone',
    'curriculum_draft.collaborator.add',
    'curriculum_draft.collaborator.revoke',
    'curriculum_standard_review.update',
    'curriculum.approve', 'curriculum.publish',
    'release.activate', 'release.rollback'
  )),
  add constraint admin_audit_events_resource_type_check check (resource_type in (
    'admin_role_assignment', 'configuration', 'engine', 'safety_case',
    'incident', 'curriculum_draft', 'curriculum_entity',
    'curriculum_standard_review', 'curriculum_release', 'application_release'
  ));

create or replace function academy_private.admin_audit_action_resource_is_allowed(
  candidate_action text,
  candidate_resource_type text
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select (candidate_action, candidate_resource_type) in (
    ('admin_role.assign', 'admin_role_assignment'),
    ('admin_role.revoke', 'admin_role_assignment'),
    ('configuration.update', 'configuration'),
    ('engine.control', 'engine'),
    ('safety.triage', 'safety_case'),
    ('incident.acknowledge', 'incident'),
    ('curriculum_draft.create', 'curriculum_draft'),
    ('curriculum_draft.update', 'curriculum_draft'),
    ('curriculum_entity.create', 'curriculum_entity'),
    ('curriculum_entity.update', 'curriculum_entity'),
    ('curriculum_entity.tombstone', 'curriculum_entity'),
    ('curriculum_draft.collaborator.add', 'curriculum_draft'),
    ('curriculum_draft.collaborator.revoke', 'curriculum_draft'),
    ('curriculum_standard_review.update', 'curriculum_standard_review'),
    ('curriculum.approve', 'curriculum_release'),
    ('curriculum.publish', 'curriculum_release'),
    ('release.activate', 'application_release'),
    ('release.rollback', 'application_release')
  );
$$;

create table public.academy_curriculum_standard_reviews (
  review_id uuid primary key default gen_random_uuid(),
  review_key text not null unique check (review_key ~ '^csr-[0-9a-f]{16}$'),
  context_kind text not null check (context_kind in ('published_release', 'draft')),
  context_ref text not null check (
    length(context_ref) between 1 and 128
    and context_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
  ),
  source_label text not null check (
    length(source_label) between 1 and 240 and source_label !~ '[[:cntrl:]]'
  ),
  grade smallint not null check (grade between 0 and 12),
  course_ref text not null check (
    length(course_ref) between 3 and 128 and course_ref ~ '^[a-z0-9][a-z0-9:-]*$'
  ),
  finding_rule text not null check (finding_rule = 'standards.human_review_required'),
  finding_ids text[] not null check (
    cardinality(finding_ids) between 1 and 1000 and array_position(finding_ids, null) is null
  ),
  affected_count integer not null check (affected_count between 1 and 1000),
  status text not null check (status in (
    'in_review', 'approved_mapping', 'rejected_mapping', 'needs_evidence'
  )),
  canonical_standard_id text,
  framework_version text,
  canonical_title text,
  evidence_source text,
  reviewer_note text,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid not null references auth.users (id) on delete restrict,
  constraint academy_curriculum_standard_reviews_count_check check (
    affected_count = cardinality(finding_ids)
  ),
  constraint academy_curriculum_standard_reviews_decision_check check (
    (
      status = 'approved_mapping'
      and canonical_standard_id is not null
      and length(canonical_standard_id) between 1 and 160
      and canonical_standard_id !~ '[[:cntrl:]]'
      and framework_version is not null
      and length(framework_version) between 1 and 160
      and framework_version !~ '[[:cntrl:]]'
      and canonical_title is not null
      and length(canonical_title) between 1 and 500
      and canonical_title !~ '[[:cntrl:]]'
      and evidence_source is not null
      and length(evidence_source) between 8 and 1000
      and evidence_source !~ '[[:cntrl:]]'
      and reviewer_note is not null
      and length(reviewer_note) between 8 and 500
      and reviewer_note !~ '[[:cntrl:]]'
    ) or (
      status <> 'approved_mapping'
      and canonical_standard_id is null
      and framework_version is null
      and canonical_title is null
      and evidence_source is null
      and (
        (status = 'in_review' and (reviewer_note is null or (
          length(reviewer_note) between 1 and 500 and reviewer_note !~ '[[:cntrl:]]'
        )))
        or (status in ('rejected_mapping', 'needs_evidence') and reviewer_note is not null
          and length(reviewer_note) between 8 and 500 and reviewer_note !~ '[[:cntrl:]]')
      )
    )
  ),
  constraint academy_curriculum_standard_reviews_time_check check (updated_at >= created_at)
);

create index academy_curriculum_standard_reviews_queue_idx
  on public.academy_curriculum_standard_reviews
  (context_kind, context_ref, status, grade, course_ref, source_label);

create table academy_private.curriculum_standard_review_request_receipts (
  actor_user_ref uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  response jsonb not null check (
    jsonb_typeof(response) = 'object' and pg_column_size(response) <= 131072
  ),
  created_at timestamptz not null default statement_timestamp(),
  primary key (actor_user_ref, request_id)
);

alter table public.academy_curriculum_standard_reviews owner to postgres;
alter table academy_private.curriculum_standard_review_request_receipts owner to postgres;
alter table public.academy_curriculum_standard_reviews enable row level security;
alter table public.academy_curriculum_standard_reviews force row level security;
alter table academy_private.curriculum_standard_review_request_receipts enable row level security;
alter table academy_private.curriculum_standard_review_request_receipts force row level security;

create function academy_private.curriculum_standard_review_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Curriculum standards review history cannot be deleted' using errcode = '55000';
  end if;
  if new.review_id is distinct from old.review_id
     or new.review_key is distinct from old.review_key
     or new.context_kind is distinct from old.context_kind
     or new.context_ref is distinct from old.context_ref
     or new.source_label is distinct from old.source_label
     or new.grade is distinct from old.grade
     or new.course_ref is distinct from old.course_ref
     or new.finding_rule is distinct from old.finding_rule
     or new.finding_ids is distinct from old.finding_ids
     or new.affected_count is distinct from old.affected_count
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by
     or new.revision <> old.revision + 1
     or new.updated_at < old.updated_at then
    raise exception 'Curriculum standards review transition is invalid' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger academy_curriculum_standard_reviews_guard
  before update or delete on public.academy_curriculum_standard_reviews
  for each row execute function academy_private.curriculum_standard_review_guard();

create function academy_private.curriculum_standard_review_require_actor(
  p_actor_user_ref uuid,
  p_required_capability text
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  actor_role text;
begin
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server()
     or p_actor_user_ref is null
     or p_required_capability not in (
       'curriculum:read', 'curriculum:drafts:write', 'curriculum:approve'
     ) then
    raise exception 'CURRICULUM_STANDARDS_REVIEW_REQUIRED' using errcode = '42501';
  end if;
  select assignment.role into actor_role
  from public.academy_admin_role_assignments as assignment
  where assignment.user_id = p_actor_user_ref
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id desc
  limit 1;
  if actor_role is null
     or (p_required_capability = 'curriculum:drafts:write' and actor_role not in ('admin', 'owner'))
     or (p_required_capability = 'curriculum:approve' and actor_role <> 'owner') then
    raise exception 'CURRICULUM_STANDARDS_REVIEW_REQUIRED' using errcode = '42501';
  end if;
  return actor_role;
end;
$$;

create function academy_private.curriculum_standard_review_finding_ids_valid(candidate text[])
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select candidate is not null
    and cardinality(candidate) between 1 and 1000
    and array_position(candidate, null) is null
    and not exists (
      select 1 from unnest(candidate) as finding_id
      where finding_id !~ '^cvf-[0-9a-f]{16}$'
    )
    and cardinality(candidate) = (select count(distinct finding_id) from unnest(candidate) as finding_id);
$$;

create function academy_private.curriculum_standard_review_projection(p_review_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'reviewKey', review.review_key,
    'contextKind', review.context_kind,
    'contextRef', review.context_ref,
    'sourceLabel', review.source_label,
    'grade', review.grade,
    'courseRef', review.course_ref,
    'findingRule', review.finding_rule,
    'affectedCount', review.affected_count,
    'findingIds', to_jsonb(review.finding_ids),
    'status', review.status,
    'canonicalStandardId', review.canonical_standard_id,
    'frameworkVersion', review.framework_version,
    'canonicalTitle', review.canonical_title,
    'evidenceSource', review.evidence_source,
    'reviewerNote', review.reviewer_note,
    'revision', review.revision,
    'updatedAt', review.updated_at
  )
  from public.academy_curriculum_standard_reviews as review
  where review.review_id = p_review_id;
$$;

create function academy_private.curriculum_standard_review_replay(
  p_actor_user_ref uuid,
  p_request_id uuid,
  p_request_digest text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  receipt academy_private.curriculum_standard_review_request_receipts%rowtype;
begin
  if p_request_id is null or p_request_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'CURRICULUM_STANDARDS_REVIEW_INPUT_INVALID' using errcode = '22023';
  end if;
  select * into receipt
  from academy_private.curriculum_standard_review_request_receipts
  where actor_user_ref = p_actor_user_ref and request_id = p_request_id;
  if receipt.request_id is null then return null; end if;
  if receipt.request_sha256 <> p_request_digest then
    raise exception 'CURRICULUM_STANDARDS_REVIEW_REPLAY_CONFLICT' using errcode = '23505';
  end if;
  return receipt.response || jsonb_build_object('replayed', true);
end;
$$;

create function academy_private.curriculum_standard_review_append_audit(
  p_actor_user_ref uuid,
  p_review_key text,
  p_context_ref text,
  p_previous_status text,
  p_previous_revision bigint,
  p_new_status text,
  p_new_revision bigint,
  p_correlation_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  old_sub text := current_setting('request.jwt.claim.sub', true);
  old_role text := current_setting('request.jwt.claim.role', true);
  old_claims text := current_setting('request.jwt.claims', true);
  event_id uuid;
begin
  perform set_config('request.jwt.claim.sub', p_actor_user_ref::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_actor_user_ref, 'role', 'authenticated',
    'academy_principal_kind', 'admin_curriculum_standards_review_server'
  )::text, true);
  begin
    event_id := academy_private.append_admin_audit_event_v1(
      'curriculum_standard_review.update', 'curriculum_standard_review',
      p_review_key, p_context_ref, p_new_revision::text,
      case when p_previous_status is null then null else jsonb_build_object(
        'status', p_previous_status, 'revision', p_previous_revision
      ) end,
      jsonb_build_object('status', p_new_status, 'revision', p_new_revision),
      case when p_new_status = 'approved_mapping'
        then 'curriculum.approved' else 'curriculum.authored' end,
      p_correlation_id
    );
  exception when others then
    perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
    perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
    perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
  perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
  return event_id;
end;
$$;

create function public.academy_admin_list_curriculum_standard_reviews_v1(
  p_actor_user_ref uuid,
  p_context_kind text,
  p_context_ref text,
  p_required_capability text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  projection jsonb;
begin
  perform academy_private.curriculum_standard_review_require_actor(
    p_actor_user_ref, p_required_capability
  );
  if p_required_capability <> 'curriculum:read'
     or p_context_kind not in ('published_release', 'draft')
     or p_context_ref is null or length(p_context_ref) not between 1 and 128
     or p_context_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'CURRICULUM_STANDARDS_REVIEW_INPUT_INVALID' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'schemaVersion', 1,
    'decisions', coalesce(jsonb_agg(
      academy_private.curriculum_standard_review_projection(review.review_id)
      order by review.source_label, review.grade, review.course_ref
    ), '[]'::jsonb)
  ) into projection
  from public.academy_curriculum_standard_reviews as review
  where review.context_kind = p_context_kind and review.context_ref = p_context_ref;
  return projection;
end;
$$;

create function public.academy_admin_update_curriculum_standard_review_v1(
  p_actor_user_ref uuid,
  p_review_key text,
  p_context_kind text,
  p_context_ref text,
  p_source_label text,
  p_grade smallint,
  p_course_ref text,
  p_finding_rule text,
  p_finding_ids text[],
  p_affected_count integer,
  p_status text,
  p_canonical_standard_id text,
  p_framework_version text,
  p_canonical_title text,
  p_evidence_source text,
  p_reviewer_note text,
  p_expected_revision bigint,
  p_request_id uuid,
  p_request_digest text,
  p_required_capability text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  existing public.academy_curriculum_standard_reviews%rowtype;
  resolved_review_id uuid;
  replay jsonb;
  response jsonb;
  new_revision bigint;
begin
  perform academy_private.curriculum_standard_review_require_actor(
    p_actor_user_ref, p_required_capability
  );
  if (p_status = 'approved_mapping' and p_required_capability <> 'curriculum:approve')
     or (p_status <> 'approved_mapping' and p_required_capability <> 'curriculum:drafts:write') then
    raise exception 'CURRICULUM_STANDARDS_REVIEW_REQUIRED' using errcode = '42501';
  end if;
  replay := academy_private.curriculum_standard_review_replay(
    p_actor_user_ref, p_request_id, p_request_digest
  );
  if replay is not null then return replay; end if;
  if p_review_key !~ '^csr-[0-9a-f]{16}$'
     or p_context_kind not in ('published_release', 'draft')
     or p_context_ref is null or length(p_context_ref) not between 1 and 128
     or p_context_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
     or (p_context_kind = 'published_release' and p_context_ref !~ '^[0-9]+\.[0-9]+\.[0-9]+$')
     or (p_context_kind = 'draft' and p_context_ref !~ '^[0-9a-f-]{36}$')
     or p_source_label is null or length(p_source_label) not between 1 and 240
     or p_source_label ~ '[[:cntrl:]]'
     or p_grade not between 0 and 12
     or p_course_ref !~ '^[a-z0-9][a-z0-9:-]{2,127}$'
     or p_finding_rule <> 'standards.human_review_required'
     or not academy_private.curriculum_standard_review_finding_ids_valid(p_finding_ids)
     or p_affected_count <> cardinality(p_finding_ids)
     or p_status not in ('in_review', 'approved_mapping', 'rejected_mapping', 'needs_evidence')
     or p_expected_revision < 0 then
    raise exception 'CURRICULUM_STANDARDS_REVIEW_INPUT_INVALID' using errcode = '22023';
  end if;
  if p_context_kind = 'draft' and not exists (
    select 1 from public.academy_curriculum_drafts
    where draft_id = p_context_ref::uuid and lifecycle_state = 'draft'
  ) then
    raise exception 'CURRICULUM_STANDARDS_REVIEW_INPUT_INVALID' using errcode = '22023';
  end if;
  if (
    p_status = 'approved_mapping' and (
      p_canonical_standard_id is null or length(p_canonical_standard_id) not between 1 and 160
      or p_canonical_standard_id ~ '[[:cntrl:]]'
      or p_framework_version is null or length(p_framework_version) not between 1 and 160
      or p_framework_version ~ '[[:cntrl:]]'
      or p_canonical_title is null or length(p_canonical_title) not between 1 and 500
      or p_canonical_title ~ '[[:cntrl:]]'
      or p_evidence_source is null or length(p_evidence_source) not between 8 and 1000
      or p_evidence_source ~ '[[:cntrl:]]'
      or p_reviewer_note is null or length(p_reviewer_note) not between 8 and 500
      or p_reviewer_note ~ '[[:cntrl:]]'
    )
  ) or (
    p_status <> 'approved_mapping' and (
      p_canonical_standard_id is not null or p_framework_version is not null
      or p_canonical_title is not null or p_evidence_source is not null
      or (p_status in ('rejected_mapping', 'needs_evidence') and (
        p_reviewer_note is null or length(p_reviewer_note) not between 8 and 500
        or p_reviewer_note ~ '[[:cntrl:]]'
      ))
      or (p_status = 'in_review' and p_reviewer_note is not null and (
        length(p_reviewer_note) not between 1 and 500 or p_reviewer_note ~ '[[:cntrl:]]'
      ))
    )
  ) then
    raise exception 'CURRICULUM_STANDARDS_REVIEW_EVIDENCE_REQUIRED' using errcode = '22023';
  end if;

  select * into existing
  from public.academy_curriculum_standard_reviews
  where review_key = p_review_key
  for update;
  if existing.review_id is null then
    if p_expected_revision <> 0 then
      raise exception 'CURRICULUM_STANDARDS_REVIEW_CAS_CONFLICT' using errcode = '40001';
    end if;
    insert into public.academy_curriculum_standard_reviews (
      review_key, context_kind, context_ref, source_label, grade, course_ref,
      finding_rule, finding_ids, affected_count, status, canonical_standard_id,
      framework_version, canonical_title, evidence_source, reviewer_note,
      created_by, updated_by
    ) values (
      p_review_key, p_context_kind, p_context_ref, p_source_label, p_grade,
      p_course_ref, p_finding_rule, p_finding_ids, p_affected_count, p_status,
      p_canonical_standard_id, p_framework_version, p_canonical_title,
      p_evidence_source, p_reviewer_note, p_actor_user_ref, p_actor_user_ref
    ) returning review_id, revision into resolved_review_id, new_revision;
  else
    if existing.context_kind <> p_context_kind
       or existing.context_ref <> p_context_ref
       or existing.source_label <> p_source_label
       or existing.grade <> p_grade
       or existing.course_ref <> p_course_ref
       or existing.finding_rule <> p_finding_rule
       or existing.finding_ids <> p_finding_ids
       or existing.affected_count <> p_affected_count then
      raise exception 'CURRICULUM_STANDARDS_REVIEW_IDENTITY_CONFLICT' using errcode = '23505';
    end if;
    update public.academy_curriculum_standard_reviews
    set status = p_status,
        canonical_standard_id = p_canonical_standard_id,
        framework_version = p_framework_version,
        canonical_title = p_canonical_title,
        evidence_source = p_evidence_source,
        reviewer_note = p_reviewer_note,
        revision = revision + 1,
        updated_at = statement_timestamp(),
        updated_by = p_actor_user_ref
    where review_id = existing.review_id and revision = p_expected_revision
    returning review_id, revision into resolved_review_id, new_revision;
    if resolved_review_id is null then
      raise exception 'CURRICULUM_STANDARDS_REVIEW_CAS_CONFLICT' using errcode = '40001';
    end if;
  end if;

  perform academy_private.curriculum_standard_review_append_audit(
    p_actor_user_ref, p_review_key, p_context_ref,
    existing.status, existing.revision, p_status, new_revision, p_request_id
  );
  response := jsonb_build_object(
    'schemaVersion', 1, 'replayed', false,
    'decision', academy_private.curriculum_standard_review_projection(resolved_review_id)
  );
  insert into academy_private.curriculum_standard_review_request_receipts (
    actor_user_ref, request_id, request_sha256, response
  ) values (p_actor_user_ref, p_request_id, p_request_digest, response);
  return response;
end;
$$;

alter function public.academy_admin_list_curriculum_standard_reviews_v1(uuid, text, text, text) owner to postgres;
alter function public.academy_admin_update_curriculum_standard_review_v1(
  uuid, text, text, text, text, smallint, text, text, text[], integer, text,
  text, text, text, text, text, bigint, uuid, text, text
) owner to postgres;

revoke all on table public.academy_curriculum_standard_reviews from public, anon, authenticated, service_role;
revoke all on table academy_private.curriculum_standard_review_request_receipts from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_standard_review_guard() from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_standard_review_require_actor(uuid, text) from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_standard_review_finding_ids_valid(text[]) from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_standard_review_projection(uuid) from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_standard_review_replay(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_standard_review_append_audit(uuid, text, text, text, bigint, text, bigint, uuid) from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_list_curriculum_standard_reviews_v1(uuid, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_update_curriculum_standard_review_v1(
  uuid, text, text, text, text, smallint, text, text, text[], integer, text,
  text, text, text, text, text, bigint, uuid, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.academy_admin_list_curriculum_standard_reviews_v1(uuid, text, text, text) to service_role;
grant execute on function public.academy_admin_update_curriculum_standard_review_v1(
  uuid, text, text, text, text, smallint, text, text, text[], integer, text,
  text, text, text, text, text, bigint, uuid, text, text
) to service_role;

comment on table public.academy_curriculum_standard_reviews is
  'Evidence-gated human standards mapping decisions; does not mutate release or draft curriculum content.';

commit;
