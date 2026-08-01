-- Manuel Academy Study Engine durable storage foundation.
-- Additive only. Depends on 20260724230000_academy_student_identity_foundation.sql.
-- This migration intentionally creates no browser write grants. Authorization
-- policies and narrowly-scoped mutation functions are installed by the next
-- timestamped migration.

begin;

do $$
declare
  identity_marker academy_private.identity_foundation_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study Engine migrations must run as postgres';
  end if;
  if to_regclass('public.academy_households') is null
     or to_regclass('public.academy_students') is null
     or to_regclass('academy_private.student_session_grants') is null
     or to_regprocedure(
       'public.academy_has_student_permission(uuid,text)'
     ) is null then
    raise exception
      'Study Engine storage requires the Academy identity foundation';
  end if;

  select * into identity_marker
  from academy_private.identity_foundation_metadata
  where singleton;
  if identity_marker.foundation_version <> 2
     or identity_marker.migration_name <>
       '20260724230000_academy_student_identity_foundation'
     or identity_marker.expected_owner <> 'postgres'
     or identity_marker.security_manifest <>
       academy_private.identity_foundation_manifest() then
    raise exception 'Academy identity foundation marker or manifest mismatch';
  end if;

  if pg_catalog.pg_get_userbyid(
       (select nspowner from pg_catalog.pg_namespace
        where nspname = 'academy_private')
     ) <> 'postgres'
     or has_schema_privilege('anon', 'academy_private', 'usage')
     or has_schema_privilege('authenticated', 'academy_private', 'usage') then
    raise exception 'academy_private owner or browser ACL mismatch';
  end if;

  if to_regprocedure('pg_catalog.gen_random_uuid()') is null then
    raise exception 'gen_random_uuid() is required';
  end if;

  if exists (
    select 1
    from unnest(array[
      'public.academy_study_household_settings',
      'public.academy_study_sessions',
      'public.academy_study_event_ledger',
      'public.academy_study_checkpoints',
      'public.academy_study_reviews',
      'public.academy_study_calendar_blocks',
      'public.academy_study_parent_settings',
      'public.academy_study_accommodations',
      'public.academy_study_audit_events',
      'academy_private.study_protected_learner_work',
      'academy_private.study_adult_notes',
      'academy_private.study_accommodation_revisions',
      'academy_private.study_adult_review_proposals',
      'academy_private.study_outbox',
      'academy_private.study_mutation_receipts',
      'academy_private.study_persistence_metadata'
    ]) as candidate(name)
    where to_regclass(candidate.name) is not null
  ) then
    raise exception 'Unmarked Study Engine object collision';
  end if;

  if exists (
    select 1
    from unnest(array[
      'public.academy_study_identifier_is_valid(text)',
      'public.academy_study_timezone_is_valid(text)',
      'public.academy_study_payload_is_minimized(jsonb,integer)',
      'public.academy_study_json_has_exact_keys(jsonb,text[])',
      'public.academy_study_presentation_is_valid(jsonb)',
      'public.academy_study_cursor_is_valid(jsonb)',
      'public.academy_study_segment_times_are_valid(jsonb)',
      'public.academy_study_technical_state_is_valid(jsonb)',
      'public.academy_study_identifiers_are_unique(text[])',
      'public.academy_study_event_payload_is_valid(text,jsonb)',
      'public.academy_study_audit_metadata_is_valid(jsonb)',
      'academy_private.study_prepare_revision()',
      'academy_private.study_prevent_mutation()',
      'academy_private.study_apply_timezone_snapshot()',
      'academy_private.study_capture_accommodation_revision()'
    ]) as candidate(signature)
    where to_regprocedure(candidate.signature) is not null
  ) then
    raise exception 'Unmarked Study Engine function collision';
  end if;
end;
$$;

create or replace function public.academy_study_identifier_is_valid(
  candidate text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and octet_length(candidate) between 1 and 160
    and candidate ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$';
$$;

create or replace function public.academy_study_timezone_is_valid(
  candidate text
)
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select candidate is not null
    and candidate <> 'Factory'
    and exists (
      select 1
      from pg_catalog.pg_timezone_names as zone
      where zone.name = candidate
    );
$$;

create or replace function public.academy_study_payload_is_minimized(
  candidate jsonb,
  maximum_bytes integer default 4096
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and jsonb_typeof(candidate) = 'object'
    and octet_length(candidate::text) <= maximum_bytes
    and candidate::text !~* '"(raw_?answer|answer_?text|transcript|diagnosis|disclosure|secret|password|credential|token|recipient|note_?body|learner_?work)"[[:space:]]*:'
    and candidate::text !~* 'aca[[:space:]_-]*stu[[:space:]_-]*v1[[:space:]_-]*[A-Za-z0-9_-]{20,}'
    and candidate::text !~* '\$(argon2id|scrypt)\$';
$$;

create or replace function public.academy_study_json_has_exact_keys(
  candidate jsonb,
  allowed_keys text[]
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and jsonb_typeof(candidate) = 'object'
    and cardinality(allowed_keys) = (
      select count(*) from jsonb_object_keys(candidate)
    )
    and not exists (
      select 1
      from jsonb_object_keys(candidate) as item(key)
      where not item.key = any(allowed_keys)
    );
$$;

create or replace function public.academy_study_presentation_is_valid(
  candidate jsonb
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select public.academy_study_payload_is_minimized(candidate, 1024)
    and not exists (
      select 1
      from jsonb_each(candidate) as item(key, value)
      where item.key not in (
        'reduced_motion', 'no_audio', 'large_text',
        'read_aloud', 'speech_input_allowed'
      ) or jsonb_typeof(item.value) <> 'boolean'
    );
$$;

create or replace function public.academy_study_cursor_is_valid(
  candidate jsonb
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select public.academy_study_json_has_exact_keys(
      candidate,
      array[
        'tutorPhase', 'cycleNumber', 'currentItemId',
        'currentItemIndex', 'teachingTurnIndex'
      ]::text[]
    )
    and candidate ->> 'tutorPhase' in (
      'assessment', 'identify-missing-concept', 'teach-visually',
      'guided-practice', 'independent-attempt', 'reassess',
      'advance', 'reteach', 'escalated'
    )
    and jsonb_typeof(candidate -> 'cycleNumber') = 'number'
    and (candidate ->> 'cycleNumber')::numeric between 0 and 9007199254740991
    and trunc((candidate ->> 'cycleNumber')::numeric) =
      (candidate ->> 'cycleNumber')::numeric
    and (
      jsonb_typeof(candidate -> 'currentItemId') = 'null'
      or (
        jsonb_typeof(candidate -> 'currentItemId') = 'string'
        and public.academy_study_identifier_is_valid(
          candidate ->> 'currentItemId'
        )
      )
    )
    and jsonb_typeof(candidate -> 'currentItemIndex') = 'number'
    and (candidate ->> 'currentItemIndex')::numeric between 0 and 9007199254740991
    and trunc((candidate ->> 'currentItemIndex')::numeric) =
      (candidate ->> 'currentItemIndex')::numeric
    and jsonb_typeof(candidate -> 'teachingTurnIndex') = 'number'
    and (candidate ->> 'teachingTurnIndex')::numeric between 0 and 9007199254740991
    and trunc((candidate ->> 'teachingTurnIndex')::numeric) =
      (candidate ->> 'teachingTurnIndex')::numeric;
$$;

create or replace function public.academy_study_segment_times_are_valid(
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  entry jsonb;
  seen text[] := '{}'::text[];
  segment_id text;
  seconds numeric;
begin
  if candidate is null
     or jsonb_typeof(candidate) <> 'array'
     or jsonb_array_length(candidate) > 512 then
    return false;
  end if;
  for entry in select value from jsonb_array_elements(candidate)
  loop
    if not public.academy_study_json_has_exact_keys(
      entry,
      array['segmentId', 'activeSeconds']::text[]
    ) or jsonb_typeof(entry -> 'segmentId') <> 'string'
      or not public.academy_study_identifier_is_valid(entry ->> 'segmentId')
      or jsonb_typeof(entry -> 'activeSeconds') <> 'number' then
      return false;
    end if;
    segment_id := entry ->> 'segmentId';
    seconds := (entry ->> 'activeSeconds')::numeric;
    if seconds < 0 or seconds > 9007199254740991 or trunc(seconds) <> seconds
       or segment_id = any(seen) then
      return false;
    end if;
    seen := array_append(seen, segment_id);
  end loop;
  return true;
end;
$$;

create or replace function public.academy_study_technical_state_is_valid(
  candidate jsonb
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select public.academy_study_json_has_exact_keys(
      candidate,
      array['status', 'interruptionId', 'category', 'startedAt']::text[]
    )
    and candidate ->> 'status' in ('none', 'active', 'recovering')
    and candidate ->> 'category' in (
      'none', 'network-unavailable', 'device-power', 'application-restart',
      'audio-unavailable', 'input-unavailable', 'unknown-technical'
    )
    and (
      (candidate ->> 'status' = 'none'
       and candidate ->> 'category' = 'none'
       and jsonb_typeof(candidate -> 'interruptionId') = 'null'
       and jsonb_typeof(candidate -> 'startedAt') = 'null')
      or
      (candidate ->> 'status' in ('active', 'recovering')
       and candidate ->> 'category' <> 'none'
       and jsonb_typeof(candidate -> 'interruptionId') = 'string'
       and public.academy_study_identifier_is_valid(
         candidate ->> 'interruptionId'
       )
       and jsonb_typeof(candidate -> 'startedAt') = 'string'
       and (candidate ->> 'startedAt') ~
         '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')
    );
$$;

create or replace function public.academy_study_identifiers_are_unique(
  candidate text[]
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and array_position(candidate, null) is null
    and cardinality(candidate) = (
      select count(distinct value) from unnest(candidate) as value
    )
    and not exists (
      select 1 from unnest(candidate) as value
      where not public.academy_study_identifier_is_valid(value)
    );
$$;

create or replace function public.academy_study_event_payload_is_valid(
  event_name text,
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if event_name not in (
    'tutor_event_accepted', 'session_started', 'session_paused',
    'session_resumed', 'session_completed', 'session_abandoned',
    'segment_completed', 'technical_interruption'
  ) or not public.academy_study_payload_is_minimized(candidate, 4096) then
    return false;
  end if;
  if jsonb_typeof(candidate -> 'schema_version') <> 'number'
     or candidate ->> 'schema_version' <> '1' then
    return false;
  end if;
  if event_name = 'tutor_event_accepted' then
    return public.academy_study_json_has_exact_keys(
      candidate, array['schema_version']::text[]
    );
  elsif event_name = 'session_started' then
    return public.academy_study_json_has_exact_keys(
      candidate, array['schema_version', 'state_to']::text[]
    ) and candidate ->> 'state_to' = 'active';
  elsif event_name in ('session_paused', 'session_resumed') then
    return public.academy_study_json_has_exact_keys(
      candidate,
      array['schema_version', 'segment_id', 'state_from', 'state_to']::text[]
    ) and public.academy_study_identifier_is_valid(candidate ->> 'segment_id')
      and candidate ->> 'state_from' in (
        'active', 'paused', 'approved_break', 'student_requested_break',
        'technical_interruption'
      ) and candidate ->> 'state_to' in ('active', 'paused');
  elsif event_name = 'segment_completed' then
    return public.academy_study_json_has_exact_keys(
      candidate,
      array['schema_version', 'segment_id', 'outcome_code']::text[]
    ) and public.academy_study_identifier_is_valid(candidate ->> 'segment_id')
      and candidate ->> 'outcome_code' in ('completed', 'partial');
  elsif event_name = 'technical_interruption' then
    return public.academy_study_json_has_exact_keys(
      candidate,
      array['schema_version', 'segment_id', 'reason_code', 'state_to']::text[]
    ) and public.academy_study_identifier_is_valid(candidate ->> 'segment_id')
      and candidate ->> 'reason_code' in (
        'network-unavailable', 'device-power', 'application-restart',
        'audio-unavailable', 'input-unavailable', 'unknown-technical'
      ) and candidate ->> 'state_to' in ('technical_interruption', 'active');
  else
    return public.academy_study_json_has_exact_keys(
      candidate,
      array[
        'schema_version', 'state_from', 'state_to', 'outcome_code',
        'active_seconds', 'paused_seconds', 'break_seconds'
      ]::text[]
    ) and candidate ->> 'state_to' in ('completed', 'abandoned')
      and candidate ->> 'outcome_code' in (
        'completed', 'partially_completed', 'abandoned'
      ) and jsonb_typeof(candidate -> 'active_seconds') = 'number'
      and jsonb_typeof(candidate -> 'paused_seconds') = 'number'
      and jsonb_typeof(candidate -> 'break_seconds') = 'number'
      and (candidate ->> 'active_seconds')::numeric >= 0
      and (candidate ->> 'paused_seconds')::numeric >= 0
      and (candidate ->> 'break_seconds')::numeric >= 0;
  end if;
end;
$$;

create or replace function public.academy_study_audit_metadata_is_valid(
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  allowed_keys text[] := array[
    'revision', 'expected_revision', 'event_id', 'event_version',
    'event_kind', 'result_code', 'reason_code', 'state_from', 'state_to',
    'proposal_id', 'outbox_id', 'retention_state', 'access_kind',
    'idempotency_key_hash_prefix'
  ];
  item_key text;
  item_value jsonb;
begin
  if not public.academy_study_payload_is_minimized(candidate, 2048) then
    return false;
  end if;
  for item_key, item_value in select key, value from jsonb_each(candidate)
  loop
    if not item_key = any(allowed_keys) then
      return false;
    elsif item_key in ('revision', 'expected_revision', 'event_version')
      and jsonb_typeof(item_value) <> 'number' then
      return false;
    elsif item_key not in ('revision', 'expected_revision', 'event_version')
      and (
        jsonb_typeof(item_value) <> 'string'
        or not public.academy_study_identifier_is_valid(item_value #>> '{}')
      ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create table public.academy_study_household_settings (
  household_id uuid primary key
    references public.academy_households (id) on delete restrict,
  household_timezone text not null default 'UTC'
    check (public.academy_study_timezone_is_valid(household_timezone)),
  revision bigint not null default 1 check (revision > 0),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.academy_study_sessions (
  id text primary key check (public.academy_study_identifier_is_valid(id)),
  schema_version smallint not null default 1 check (schema_version = 1),
  household_id uuid not null,
  student_id uuid not null,
  lesson_id text not null
    check (public.academy_study_identifier_is_valid(lesson_id)),
  subject_id text not null
    check (public.academy_study_identifier_is_valid(subject_id)),
  study_plan_id text
    check (
      study_plan_id is null
      or public.academy_study_identifier_is_valid(study_plan_id)
    ),
  state text not null default 'planned'
    check (state in (
      'planned', 'active', 'paused', 'approved_break',
      'student_requested_break', 'technical_interruption',
      'completed', 'abandoned'
    )),
  started_at timestamptz,
  completed_at timestamptz,
  intended_local_date date not null,
  household_timezone text not null
    check (public.academy_study_timezone_is_valid(household_timezone)),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  constraint academy_study_sessions_student_household_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_study_sessions_identity_key
    unique (id, household_id, student_id),
  constraint academy_study_sessions_completion_check check (
    (state = 'planned' and started_at is null and completed_at is null)
    or (
      state = 'completed'
      and started_at is not null
      and completed_at is not null
      and completed_at >= started_at
    )
    or (
      state not in ('planned', 'completed')
      and started_at is not null
      and completed_at is null
    )
  )
);

create table public.academy_study_event_ledger (
  session_id text not null,
  event_id text not null
    check (public.academy_study_identifier_is_valid(event_id)),
  household_id uuid not null,
  student_id uuid not null,
  event_version smallint not null default 1 check (event_version = 1),
  event_kind text not null,
  sequence_number bigint not null check (sequence_number > 0),
  accepted_at timestamptz not null default now(),
  minimized_payload jsonb not null,
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null
    check (public.academy_study_identifier_is_valid(idempotency_key)),
  primary key (session_id, event_id),
  constraint academy_study_event_session_fk
    foreign key (session_id, household_id, student_id)
    references public.academy_study_sessions (id, household_id, student_id)
    on delete restrict,
  constraint academy_study_event_sequence_key
    unique (session_id, sequence_number),
  constraint academy_study_event_idempotency_key
    unique (session_id, idempotency_key),
  constraint academy_study_event_identity_key
    unique (session_id, event_id, household_id, student_id),
  constraint academy_study_event_payload_check check (
    public.academy_study_event_payload_is_valid(event_kind, minimized_payload)
  )
);

create table public.academy_study_checkpoints (
  id text primary key check (public.academy_study_identifier_is_valid(id)),
  household_id uuid not null,
  student_id uuid not null,
  session_id text not null,
  lesson_id text not null
    check (public.academy_study_identifier_is_valid(lesson_id)),
  segment_id text not null
    check (public.academy_study_identifier_is_valid(segment_id)),
  canonical_task_id text
    check (
      canonical_task_id is null
      or public.academy_study_identifier_is_valid(canonical_task_id)
    ),
  safe_instructional_cursor jsonb not null
    check (public.academy_study_cursor_is_valid(safe_instructional_cursor)),
  completed_segment_ids text[] not null default '{}'::text[]
    check (
      cardinality(completed_segment_ids) <= 512
      and public.academy_study_identifiers_are_unique(completed_segment_ids)
    ),
  per_segment_active_time jsonb not null default '[]'::jsonb
    check (public.academy_study_segment_times_are_valid(per_segment_active_time)),
  paused_time bigint not null default 0 check (paused_time >= 0),
  break_time bigint not null default 0 check (break_time >= 0),
  protected_draft_reference text
    check (
      protected_draft_reference is null
      or public.academy_study_identifier_is_valid(protected_draft_reference)
    ),
  draft_revision bigint not null default 0 check (draft_revision >= 0),
  last_accepted_event_id text,
  event_version smallint not null default 1 check (event_version = 1),
  opaque_tutor_state_reference text not null
    check (
      opaque_tutor_state_reference ~
        '^tutor-state:[A-Za-z0-9][A-Za-z0-9._:/-]{0,113}$'
    ),
  tutor_interaction_reference text not null
    check (public.academy_study_identifier_is_valid(tutor_interaction_reference)),
  technical_interruption_state jsonb not null
    check (
      public.academy_study_technical_state_is_valid(
        technical_interruption_state
      )
    ),
  household_timezone text not null
    check (public.academy_study_timezone_is_valid(household_timezone)),
  integrity_digest text not null check (integrity_digest ~ '^[0-9a-f]{64}$'),
  revision bigint not null default 1 check (revision > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_study_checkpoints_session_fk
    foreign key (session_id, household_id, student_id)
    references public.academy_study_sessions (id, household_id, student_id)
    on delete restrict,
  constraint academy_study_checkpoints_last_event_fk
    foreign key (
      session_id,
      last_accepted_event_id,
      household_id,
      student_id
    ) references public.academy_study_event_ledger (
      session_id,
      event_id,
      household_id,
      student_id
    ) on delete restrict,
  constraint academy_study_checkpoints_one_current_key unique (session_id),
  constraint academy_study_checkpoints_scope_key
    unique (id, household_id, student_id, session_id),
  constraint academy_study_checkpoints_draft_pair_check check (
    (protected_draft_reference is null and draft_revision = 0)
    or (protected_draft_reference is not null and draft_revision > 0)
  ),
  constraint academy_study_checkpoints_expiry_check
    check (expires_at > created_at)
);

create table public.academy_study_reviews (
  id text primary key check (public.academy_study_identifier_is_valid(id)),
  household_id uuid not null,
  student_id uuid not null,
  skill_id text not null
    check (public.academy_study_identifier_is_valid(skill_id)),
  source_session_id text,
  review_kind text not null
    check (review_kind in ('spaced', 'reteach', 'prerequisite', 'manual')),
  due_at timestamptz not null,
  intended_local_date date not null,
  household_timezone text not null
    check (public.academy_study_timezone_is_valid(household_timezone)),
  priority smallint not null default 50 check (priority between 0 and 100),
  state text not null default 'scheduled'
    check (state in ('scheduled', 'available', 'in_progress', 'completed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  interval_days integer not null default 0 check (interval_days >= 0),
  reteaching_required boolean not null default false,
  prerequisite_remediation_required boolean not null default false,
  idempotency_key text not null
    check (public.academy_study_identifier_is_valid(idempotency_key)),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_study_reviews_student_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_study_reviews_source_session_fk
    foreign key (source_session_id, household_id, student_id)
    references public.academy_study_sessions (id, household_id, student_id)
    on delete restrict,
  constraint academy_study_reviews_idempotency_key
    unique (household_id, student_id, idempotency_key)
);

create table public.academy_study_calendar_blocks (
  id text primary key check (public.academy_study_identifier_is_valid(id)),
  household_id uuid not null,
  student_id uuid not null,
  block_type text not null
    check (block_type in ('lesson', 'review', 'resume', 'break', 'assessment')),
  source_reference text not null
    check (public.academy_study_identifier_is_valid(source_reference)),
  scheduled_start timestamptz not null,
  intended_local_date date not null,
  household_timezone text not null
    check (public.academy_study_timezone_is_valid(household_timezone)),
  explicit_offset smallint not null check (explicit_offset between -840 and 840),
  duration_minutes integer not null check (duration_minutes between 1 and 480),
  completion_units integer not null default 0 check (completion_units >= 0),
  required_units integer not null default 1 check (required_units > 0),
  resume_session_id text,
  resume_segment_id text,
  state text not null default 'scheduled'
    check (state in ('scheduled', 'available', 'in_progress', 'completed', 'cancelled')),
  idempotency_key text not null
    check (public.academy_study_identifier_is_valid(idempotency_key)),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_study_calendar_student_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_study_calendar_resume_session_fk
    foreign key (resume_session_id, household_id, student_id)
    references public.academy_study_sessions (id, household_id, student_id)
    on delete restrict,
  constraint academy_study_calendar_units_check
    check (completion_units <= required_units),
  constraint academy_study_calendar_resume_check check (
    (resume_session_id is null and resume_segment_id is null)
    or (
      resume_session_id is not null
      and resume_segment_id is not null
      and public.academy_study_identifier_is_valid(resume_segment_id)
    )
  ),
  constraint academy_study_calendar_idempotency_key
    unique (household_id, student_id, idempotency_key)
);

create table public.academy_study_parent_settings (
  household_id uuid not null,
  student_id uuid not null,
  timer_mode text not null default 'visible'
    check (timer_mode in ('visible', 'hidden', 'count_up', 'count_down')),
  maximum_work_minutes integer not null default 30
    check (maximum_work_minutes between 1 and 240),
  break_minimum_minutes integer not null default 5
    check (break_minimum_minutes between 1 and 120),
  break_maximum_minutes integer not null default 15
    check (break_maximum_minutes between 1 and 180),
  required_breaks integer not null default 1 check (required_breaks between 0 and 12),
  reduced_motion boolean not null default false,
  no_audio boolean not null default false,
  large_text boolean not null default false,
  read_aloud boolean not null default false,
  speech_input_allowed boolean not null default false,
  parent_override boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (household_id, student_id),
  constraint academy_study_parent_settings_student_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_study_parent_settings_break_range_check
    check (break_minimum_minutes <= break_maximum_minutes)
);

create table public.academy_study_accommodations (
  id text primary key check (public.academy_study_identifier_is_valid(id)),
  household_id uuid not null,
  student_id uuid not null,
  maximum_duration_minutes integer check (maximum_duration_minutes between 1 and 480),
  required_break_interval_minutes integer
    check (required_break_interval_minutes between 1 and 240),
  required_break_duration_minutes integer
    check (required_break_duration_minutes between 1 and 120),
  timer_visibility text not null default 'follow_parent'
    check (timer_visibility in ('follow_parent', 'visible', 'hidden')),
  presentation_accommodations jsonb not null default '{}'::jsonb
    check (
      public.academy_study_presentation_is_valid(presentation_accommodations)
    ),
  source_kind text not null
    check (source_kind in ('guardian', 'educator_plan', 'learner_preference', 'administrative')),
  provenance_reference text not null
    check (public.academy_study_identifier_is_valid(provenance_reference)),
  authorized_by uuid references auth.users (id) on delete set null,
  effective_from date not null,
  effective_until date,
  state text not null default 'active'
    check (state in ('draft', 'active', 'superseded', 'expired', 'revoked')),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_study_accommodations_student_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_study_accommodations_dates_check
    check (effective_until is null or effective_until >= effective_from)
);

create unique index academy_student_session_grants_study_scope_idx
  on academy_private.student_session_grants (id, household_id, student_id);

create table public.academy_study_audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  student_id uuid,
  actor_kind text not null
    check (actor_kind in ('guardian', 'student', 'trusted_server', 'system')),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_student_grant_id uuid,
  event_type text not null check (event_type in (
    'session.start', 'session.finish', 'checkpoint.save', 'checkpoint.reject',
    'event.accept', 'event.replay', 'event.collision', 'parent.override',
    'accommodation.change', 'adult_note.access', 'adult_note.change',
    'review.schedule', 'calendar.schedule', 'safety.proposal',
    'delivery.transition', 'retention.delete', 'administrative.operation'
  )),
  target_kind text not null check (target_kind in (
    'household_settings', 'session', 'checkpoint', 'event', 'review', 'calendar',
    'parent_settings', 'accommodation', 'adult_note', 'protected_work',
    'proposal', 'outbox', 'retention'
  )),
  target_id text not null
    check (public.academy_study_identifier_is_valid(target_id)),
  reason_code text
    check (
      reason_code is null
      or public.academy_study_identifier_is_valid(reason_code)
    ),
  correlation_id uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (public.academy_study_audit_metadata_is_valid(metadata)),
  constraint academy_study_audit_student_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_study_audit_identity_key
    unique (id, household_id, student_id),
  constraint academy_study_audit_student_grant_fk
    foreign key (actor_student_grant_id, household_id, student_id)
    references academy_private.student_session_grants
      (id, household_id, student_id)
    on delete restrict,
  constraint academy_study_audit_actor_check check (
    (actor_kind = 'guardian' and actor_user_id is not null and actor_student_grant_id is null)
    or (actor_kind = 'student' and actor_user_id is null and actor_student_grant_id is not null)
    or (actor_kind in ('trusted_server', 'system') and actor_student_grant_id is null)
  )
);

create table academy_private.study_protected_learner_work (
  id text not null check (public.academy_study_identifier_is_valid(id)),
  revision bigint not null check (revision > 0),
  household_id uuid not null,
  student_id uuid not null,
  session_id text not null,
  checkpoint_id text,
  encryption_scheme text not null default 'aes-256-gcm-envelope-v1'
    check (encryption_scheme = 'aes-256-gcm-envelope-v1'),
  kms_key_reference text not null
    check (public.academy_study_identifier_is_valid(kms_key_reference)),
  wrapped_data_key bytea not null check (octet_length(wrapped_data_key) between 16 and 8192),
  nonce bytea not null check (octet_length(nonce) = 12),
  authentication_tag bytea not null check (octet_length(authentication_tag) = 16),
  encrypted_payload bytea not null
    check (octet_length(encrypted_payload) between 1 and 1048576),
  keyed_integrity_tag bytea not null check (octet_length(keyed_integrity_tag) = 32),
  retention_state text not null default 'active'
    check (retention_state in ('active', 'crypto_erased', 'deleted_tombstone')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (household_id, student_id, id, revision),
  constraint study_protected_work_identity_key
    unique (id, revision, household_id, student_id, session_id),
  constraint study_protected_work_session_fk
    foreign key (session_id, household_id, student_id)
    references public.academy_study_sessions (id, household_id, student_id)
    on delete restrict,
  constraint study_protected_work_checkpoint_fk
    foreign key (checkpoint_id, household_id, student_id, session_id)
    references public.academy_study_checkpoints
      (id, household_id, student_id, session_id)
    on delete restrict,
  constraint study_protected_work_expiry_check check (expires_at > created_at)
);

alter table public.academy_study_checkpoints
  add constraint academy_study_checkpoints_protected_work_fk
  foreign key (
    protected_draft_reference,
    draft_revision,
    household_id,
    student_id,
    session_id
  ) references academy_private.study_protected_learner_work (
    id,
    revision,
    household_id,
    student_id,
    session_id
  ) on delete restrict;

create table academy_private.study_adult_notes (
  note_id text not null check (public.academy_study_identifier_is_valid(note_id)),
  revision bigint not null check (revision > 0),
  household_id uuid not null,
  student_id uuid not null,
  category text not null
    check (category in ('instructional', 'accommodation', 'follow_up', 'administrative')),
  encrypted_body bytea not null
    check (octet_length(encrypted_body) between 1 and 262144),
  encryption_scheme text not null default 'aes-256-gcm-envelope-v1'
    check (encryption_scheme = 'aes-256-gcm-envelope-v1'),
  kms_key_reference text not null
    check (public.academy_study_identifier_is_valid(kms_key_reference)),
  wrapped_data_key bytea not null check (octet_length(wrapped_data_key) between 1 and 8192),
  nonce bytea not null check (octet_length(nonce) = 12),
  authentication_tag bytea not null check (octet_length(authentication_tag) = 16),
  keyed_integrity_tag bytea not null check (octet_length(keyed_integrity_tag) = 32),
  author_user_id uuid not null references auth.users (id) on delete restrict,
  retention_state text not null default 'active'
    check (retention_state in ('active', 'expired', 'crypto_erased', 'deleted')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (household_id, student_id, note_id, revision),
  constraint study_adult_notes_student_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint study_adult_notes_expiry_check
    check (expires_at > created_at)
);

create table academy_private.study_accommodation_revisions (
  accommodation_id text not null,
  revision bigint not null,
  household_id uuid not null,
  student_id uuid not null,
  snapshot jsonb not null
    check (public.academy_study_payload_is_minimized(snapshot, 8192)),
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  primary key (accommodation_id, revision),
  constraint study_accommodation_revisions_student_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict
);

create table academy_private.study_adult_review_proposals (
  id text primary key check (public.academy_study_identifier_is_valid(id)),
  household_id uuid not null,
  student_id uuid not null,
  source_session_id text not null,
  source_event_id text not null,
  safety_category text not null
    check (safety_category in ('wellbeing', 'threat', 'abuse', 'self_harm', 'other')),
  structured_reason_code text not null
    check (public.academy_study_identifier_is_valid(structured_reason_code)),
  urgency text not null check (urgency in ('routine', 'prompt', 'urgent', 'emergency')),
  state text not null default 'proposed_not_delivered'
    check (state in ('proposed_not_delivered', 'approved', 'rejected', 'cancelled')),
  recipient_resolution_state text not null default 'unresolved'
    check (recipient_resolution_state in ('unresolved', 'resolved', 'unavailable')),
  recipient_access_id uuid,
  recipient_membership_id uuid,
  audit_event_id uuid not null
    ,
  idempotency_key text not null
    check (public.academy_study_identifier_is_valid(idempotency_key)),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_adult_review_proposals_student_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint study_adult_review_proposals_event_fk
    foreign key (
      source_session_id,
      source_event_id,
      household_id,
      student_id
    ) references public.academy_study_event_ledger (
      session_id,
      event_id,
      household_id,
      student_id
    ) on delete restrict,
  constraint study_adult_review_proposals_audit_fk
    foreign key (audit_event_id, household_id, student_id)
    references public.academy_study_audit_events
      (id, household_id, student_id)
    on delete restrict,
  constraint study_adult_review_proposals_recipient_fk
    foreign key (
      recipient_access_id,
      household_id,
      student_id,
      recipient_membership_id
    ) references public.academy_guardian_student_access (
      id,
      household_id,
      student_id,
      membership_id
    ) on delete restrict,
  constraint study_adult_review_proposals_recipient_state_check check (
    (recipient_resolution_state = 'resolved'
      and recipient_access_id is not null
      and recipient_membership_id is not null)
    or (recipient_resolution_state <> 'resolved'
      and recipient_access_id is null
      and recipient_membership_id is null)
  ),
  constraint study_adult_review_proposals_identity_key
    unique (id, household_id, student_id),
  constraint study_adult_review_proposals_idempotency_key
    unique (household_id, student_id, idempotency_key)
);

create table academy_private.study_outbox (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  student_id uuid not null,
  proposal_id text not null,
  source_session_id text not null,
  source_event_id text not null,
  proposal_kind text not null
    check (proposal_kind in ('adult_review_notification')),
  recipient_access_id uuid not null,
  recipient_membership_id uuid not null,
  delivery_state text not null default 'pending'
    check (delivery_state in ('pending', 'leased', 'delivered', 'retry', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  retry_at timestamptz,
  last_error_code text
    check (
      last_error_code is null
      or public.academy_study_identifier_is_valid(last_error_code)
    ),
  delivered_at timestamptz,
  receipt_reference text
    check (
      receipt_reference is null
      or public.academy_study_identifier_is_valid(receipt_reference)
    ),
  idempotency_key text not null
    check (public.academy_study_identifier_is_valid(idempotency_key)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_outbox_proposal_fk
    foreign key (proposal_id, household_id, student_id)
    references academy_private.study_adult_review_proposals
      (id, household_id, student_id)
    on delete restrict,
  constraint study_outbox_event_fk
    foreign key (
      source_session_id,
      source_event_id,
      household_id,
      student_id
    ) references public.academy_study_event_ledger (
      session_id,
      event_id,
      household_id,
      student_id
    ) on delete restrict,
  constraint study_outbox_recipient_fk
    foreign key (
      recipient_access_id,
      household_id,
      student_id,
      recipient_membership_id
    ) references public.academy_guardian_student_access (
      id,
      household_id,
      student_id,
      membership_id
    ) on delete restrict,
  constraint study_outbox_idempotency_key
    unique (household_id, student_id, idempotency_key),
  constraint study_outbox_delivery_check check (
    (delivery_state = 'delivered' and delivered_at is not null and receipt_reference is not null)
    or (delivery_state <> 'delivered' and delivered_at is null)
  )
);

create table academy_private.study_mutation_receipts (
  actor_scope text not null,
  operation_kind text not null,
  idempotency_key text not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  request_fingerprint jsonb not null
    check (public.academy_study_payload_is_minimized(request_fingerprint, 16384)),
  result jsonb not null
    check (public.academy_study_payload_is_minimized(result, 4096)),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (actor_scope, operation_kind, idempotency_key),
  constraint study_mutation_receipts_expiry_check check (expires_at > created_at)
);

create table academy_private.study_persistence_metadata (
  singleton boolean primary key default true check (singleton),
  storage_version integer not null check (storage_version = 1),
  authorization_version integer not null check (authorization_version in (0, 1)),
  migration_names text[] not null,
  security_manifest jsonb not null,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into academy_private.study_persistence_metadata (
  singleton,
  storage_version,
  authorization_version,
  migration_names,
  security_manifest
) values (
  true,
  1,
  0,
  array['20260801010000_academy_study_engine_storage']::text[],
  jsonb_build_object(
    'storage_version', 1,
    'public_tables', 9,
    'private_tables', 7,
    'default_deny', true,
    'forced_rls', true,
    'checkpoint_contract', 'study-core-bridge.recovery-checkpoint.v1',
    'encryption_boundary', 'aes-256-gcm-envelope-v1'
  )
);

create index academy_study_sessions_student_state_idx
  on public.academy_study_sessions
  (student_id, state, intended_local_date, updated_at desc);
create index academy_study_event_student_time_idx
  on public.academy_study_event_ledger (student_id, accepted_at desc);
create index academy_study_checkpoints_student_time_idx
  on public.academy_study_checkpoints (student_id, updated_at desc);
create index academy_study_checkpoints_expiry_idx
  on public.academy_study_checkpoints (expires_at);
create index academy_study_reviews_due_idx
  on public.academy_study_reviews (student_id, state, due_at, priority desc);
create index academy_study_reviews_source_idx
  on public.academy_study_reviews (source_session_id);
create index academy_study_calendar_day_idx
  on public.academy_study_calendar_blocks
  (student_id, intended_local_date, scheduled_start);
create index academy_study_calendar_resume_idx
  on public.academy_study_calendar_blocks (resume_session_id);
create index academy_study_accommodations_current_idx
  on public.academy_study_accommodations
  (student_id, effective_from, effective_until)
  where state = 'active';
create index academy_study_audit_student_time_idx
  on public.academy_study_audit_events (student_id, occurred_at desc);
create index study_protected_work_expiry_idx
  on academy_private.study_protected_learner_work (expires_at)
  where retention_state = 'active';
create index study_adult_notes_student_idx
  on academy_private.study_adult_notes (student_id, note_id, revision desc);
create index study_adult_notes_expiry_idx
  on academy_private.study_adult_notes (expires_at)
  where retention_state = 'active' and expires_at is not null;
create index study_proposals_student_state_idx
  on academy_private.study_adult_review_proposals
  (student_id, state, urgency, created_at desc);
create index study_outbox_delivery_idx
  on academy_private.study_outbox (delivery_state, retry_at)
  where delivery_state in ('pending', 'retry');
create index study_mutation_receipts_expiry_idx
  on academy_private.study_mutation_receipts (expires_at);

create or replace function academy_private.study_prepare_revision()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.revision <> old.revision then
    raise exception 'STUDY_REVISION_IS_SERVER_MANAGED' using errcode = '40001';
  end if;
  new.revision := old.revision + 1;
  if to_jsonb(new) ? 'updated_at' then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

create or replace function academy_private.study_prevent_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE'
     and current_setting('academy.study_retention_authorized', true) = 'on'
     and tg_table_schema = 'academy_private'
     and tg_table_name in (
       'study_protected_learner_work',
       'study_adult_notes',
       'study_mutation_receipts'
     ) then
    return old;
  end if;
  raise exception 'STUDY_APPEND_ONLY' using errcode = '55000';
end;
$$;

create or replace function academy_private.study_apply_timezone_snapshot()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  canonical_timezone text;
  actual_offset integer;
begin
  select settings.household_timezone
    into canonical_timezone
  from public.academy_study_household_settings as settings
  where settings.household_id = new.household_id;

  if canonical_timezone is null then
    raise exception 'STUDY_HOUSEHOLD_TIMEZONE_REQUIRED' using errcode = '23514';
  end if;
  new.household_timezone := canonical_timezone;

  if tg_table_name = 'academy_study_sessions' then
    if (new.started_at at time zone canonical_timezone)::date
       <> new.intended_local_date then
      raise exception 'STUDY_LOCAL_DATE_MISMATCH' using errcode = '23514';
    end if;
  elsif tg_table_name = 'academy_study_reviews' then
    if (new.due_at at time zone canonical_timezone)::date
       <> new.intended_local_date then
      raise exception 'STUDY_LOCAL_DATE_MISMATCH' using errcode = '23514';
    end if;
  elsif tg_table_name = 'academy_study_calendar_blocks' then
    if (new.scheduled_start at time zone canonical_timezone)::date
       <> new.intended_local_date then
      raise exception 'STUDY_LOCAL_DATE_MISMATCH' using errcode = '23514';
    end if;
    actual_offset := extract(epoch from (
      (new.scheduled_start at time zone canonical_timezone)
      - (new.scheduled_start at time zone 'UTC')
    ))::integer / 60;
    if actual_offset <> new.explicit_offset then
      raise exception 'STUDY_EXPLICIT_OFFSET_MISMATCH' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function academy_private.study_capture_accommodation_revision()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  insert into academy_private.study_accommodation_revisions (
    accommodation_id,
    revision,
    household_id,
    student_id,
    snapshot,
    changed_by
  ) values (
    new.id,
    new.revision,
    new.household_id,
    new.student_id,
    jsonb_build_object(
      'maximum_duration_minutes', new.maximum_duration_minutes,
      'required_break_interval_minutes', new.required_break_interval_minutes,
      'required_break_duration_minutes', new.required_break_duration_minutes,
      'timer_visibility', new.timer_visibility,
      'presentation_accommodations', new.presentation_accommodations,
      'source_kind', new.source_kind,
      'provenance_reference', new.provenance_reference,
      'effective_from', new.effective_from,
      'effective_until', new.effective_until,
      'state', new.state
    ),
    auth.uid()
  );
  return new;
end;
$$;

create trigger academy_study_household_settings_revision
  before update on public.academy_study_household_settings
  for each row execute function academy_private.study_prepare_revision();
create trigger academy_study_sessions_revision
  before update on public.academy_study_sessions
  for each row execute function academy_private.study_prepare_revision();
create trigger academy_study_checkpoints_revision
  before update on public.academy_study_checkpoints
  for each row execute function academy_private.study_prepare_revision();
create trigger academy_study_reviews_revision
  before update on public.academy_study_reviews
  for each row execute function academy_private.study_prepare_revision();
create trigger academy_study_calendar_revision
  before update on public.academy_study_calendar_blocks
  for each row execute function academy_private.study_prepare_revision();
create trigger academy_study_parent_settings_revision
  before update on public.academy_study_parent_settings
  for each row execute function academy_private.study_prepare_revision();
create trigger academy_study_accommodations_revision
  before update on public.academy_study_accommodations
  for each row execute function academy_private.study_prepare_revision();
create trigger study_proposals_revision
  before update on academy_private.study_adult_review_proposals
  for each row execute function academy_private.study_prepare_revision();

create trigger academy_study_sessions_timezone
  before insert or update on public.academy_study_sessions
  for each row execute function academy_private.study_apply_timezone_snapshot();
create trigger academy_study_checkpoints_timezone
  before insert or update on public.academy_study_checkpoints
  for each row execute function academy_private.study_apply_timezone_snapshot();
create trigger academy_study_reviews_timezone
  before insert or update on public.academy_study_reviews
  for each row execute function academy_private.study_apply_timezone_snapshot();
create trigger academy_study_calendar_timezone
  before insert or update on public.academy_study_calendar_blocks
  for each row execute function academy_private.study_apply_timezone_snapshot();

create trigger academy_study_event_immutable
  before update or delete on public.academy_study_event_ledger
  for each row execute function academy_private.study_prevent_mutation();
create trigger academy_study_audit_immutable
  before update or delete on public.academy_study_audit_events
  for each row execute function academy_private.study_prevent_mutation();
create trigger study_adult_notes_immutable
  before update or delete on academy_private.study_adult_notes
  for each row execute function academy_private.study_prevent_mutation();
create trigger study_protected_work_immutable
  before update or delete on academy_private.study_protected_learner_work
  for each row execute function academy_private.study_prevent_mutation();
create trigger study_accommodation_revisions_immutable
  before update or delete on academy_private.study_accommodation_revisions
  for each row execute function academy_private.study_prevent_mutation();
create trigger study_mutation_receipts_immutable
  before update or delete on academy_private.study_mutation_receipts
  for each row execute function academy_private.study_prevent_mutation();

create trigger academy_study_accommodations_capture_insert
  after insert on public.academy_study_accommodations
  for each row execute function academy_private.study_capture_accommodation_revision();
create trigger academy_study_accommodations_capture_update
  after update on public.academy_study_accommodations
  for each row execute function academy_private.study_capture_accommodation_revision();

alter table public.academy_study_household_settings enable row level security;
alter table public.academy_study_household_settings force row level security;
alter table public.academy_study_sessions enable row level security;
alter table public.academy_study_sessions force row level security;
alter table public.academy_study_event_ledger enable row level security;
alter table public.academy_study_event_ledger force row level security;
alter table public.academy_study_checkpoints enable row level security;
alter table public.academy_study_checkpoints force row level security;
alter table public.academy_study_reviews enable row level security;
alter table public.academy_study_reviews force row level security;
alter table public.academy_study_calendar_blocks enable row level security;
alter table public.academy_study_calendar_blocks force row level security;
alter table public.academy_study_parent_settings enable row level security;
alter table public.academy_study_parent_settings force row level security;
alter table public.academy_study_accommodations enable row level security;
alter table public.academy_study_accommodations force row level security;
alter table public.academy_study_audit_events enable row level security;
alter table public.academy_study_audit_events force row level security;
alter table academy_private.study_protected_learner_work enable row level security;
alter table academy_private.study_protected_learner_work force row level security;
alter table academy_private.study_adult_notes enable row level security;
alter table academy_private.study_adult_notes force row level security;
alter table academy_private.study_accommodation_revisions enable row level security;
alter table academy_private.study_accommodation_revisions force row level security;
alter table academy_private.study_adult_review_proposals enable row level security;
alter table academy_private.study_adult_review_proposals force row level security;
alter table academy_private.study_outbox enable row level security;
alter table academy_private.study_outbox force row level security;
alter table academy_private.study_mutation_receipts enable row level security;
alter table academy_private.study_mutation_receipts force row level security;
alter table academy_private.study_persistence_metadata enable row level security;
alter table academy_private.study_persistence_metadata force row level security;

alter table public.academy_study_household_settings owner to postgres;
alter table public.academy_study_sessions owner to postgres;
alter table public.academy_study_event_ledger owner to postgres;
alter table public.academy_study_checkpoints owner to postgres;
alter table public.academy_study_reviews owner to postgres;
alter table public.academy_study_calendar_blocks owner to postgres;
alter table public.academy_study_parent_settings owner to postgres;
alter table public.academy_study_accommodations owner to postgres;
alter table public.academy_study_audit_events owner to postgres;
alter table academy_private.study_protected_learner_work owner to postgres;
alter table academy_private.study_adult_notes owner to postgres;
alter table academy_private.study_accommodation_revisions owner to postgres;
alter table academy_private.study_adult_review_proposals owner to postgres;
alter table academy_private.study_outbox owner to postgres;
alter table academy_private.study_mutation_receipts owner to postgres;
alter table academy_private.study_persistence_metadata owner to postgres;

revoke all on table public.academy_study_household_settings from public, anon, authenticated, service_role;
revoke all on table public.academy_study_sessions from public, anon, authenticated, service_role;
revoke all on table public.academy_study_event_ledger from public, anon, authenticated, service_role;
revoke all on table public.academy_study_checkpoints from public, anon, authenticated, service_role;
revoke all on table public.academy_study_reviews from public, anon, authenticated, service_role;
revoke all on table public.academy_study_calendar_blocks from public, anon, authenticated, service_role;
revoke all on table public.academy_study_parent_settings from public, anon, authenticated, service_role;
revoke all on table public.academy_study_accommodations from public, anon, authenticated, service_role;
revoke all on table public.academy_study_audit_events from public, anon, authenticated, service_role;
revoke all on table academy_private.study_protected_learner_work from public, anon, authenticated, service_role;
revoke all on table academy_private.study_adult_notes from public, anon, authenticated, service_role;
revoke all on table academy_private.study_accommodation_revisions from public, anon, authenticated, service_role;
revoke all on table academy_private.study_adult_review_proposals from public, anon, authenticated, service_role;
revoke all on table academy_private.study_outbox from public, anon, authenticated, service_role;
revoke all on table academy_private.study_mutation_receipts from public, anon, authenticated, service_role;
revoke all on table academy_private.study_persistence_metadata from public, anon, authenticated, service_role;

revoke all on function academy_private.study_capture_accommodation_revision()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_prepare_revision()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_prevent_mutation()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_apply_timezone_snapshot()
  from public, anon, authenticated, service_role;

revoke all on function public.academy_study_identifier_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_timezone_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_payload_is_minimized(jsonb, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_json_has_exact_keys(jsonb, text[])
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_presentation_is_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_cursor_is_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_segment_times_are_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_technical_state_is_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_identifiers_are_unique(text[])
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_event_payload_is_valid(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_audit_metadata_is_valid(jsonb)
  from public, anon, authenticated, service_role;

comment on table academy_private.study_protected_learner_work is
  'Envelope-encrypted learner work. Default retention is enforced by expires_at; purge is trusted-server only. Never project into parent Study summaries.';
comment on table academy_private.study_adult_notes is
  'Append-only encrypted adult-private note revisions. Browser roles have no table access; body access is audited through a narrow RPC.';
comment on table academy_private.study_outbox is
  'Server-only delivery intents. Contains references and delivery state, never raw disclosure text or credentials.';

commit;
