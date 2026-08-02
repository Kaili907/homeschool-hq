-- LOCAL/EPHEMERAL DATABASE ONLY. Session 17 structural and authorization probes.
do $$
declare
  private_table text;
  trusted_function text;
begin
  foreach private_table in array array[
    'study_adult_review_attempt_events',
    'study_adult_review_receipt_events',
    'study_parent_notifications',
    'study_adult_review_worker_registry',
    'study_safety_rate_limit_scopes',
    'study_adult_review_route_capabilities',
    'study_adult_review_audit_events'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'academy_private'
        and relation.relname = private_table
        and relation.relrowsecurity
        and relation.relforcerowsecurity
    ) then
      raise exception 'Session 17 forced-RLS probe failed: %', private_table;
    end if;
    if has_table_privilege('anon', 'academy_private.' || private_table, 'select')
       or has_table_privilege('authenticated', 'academy_private.' || private_table, 'select')
       or has_table_privilege('service_role', 'academy_private.' || private_table, 'select') then
      raise exception 'Session 17 private-table ACL probe failed: %', private_table;
    end if;
  end loop;

  foreach trusted_function in array array[
    'academy_study_claim_adult_review_proposals_v2',
    'academy_study_resolve_adult_recipients_v2',
    'academy_study_record_recipient_resolution_v2',
    'academy_study_claim_delivery_jobs_v2',
    'academy_study_create_delivery_attempt_v2',
    'academy_study_record_attempt_event_v2',
    'academy_study_deliver_in_app_notification_v2',
    'academy_study_verify_in_app_notification_v2',
    'academy_study_reserve_rate_limit_v2',
    'academy_study_record_adult_review_monitoring_v2',
    'academy_study_purge_adult_review_retention_v2',
    'academy_study_adult_review_readiness_v2'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = trusted_function
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=pg_catalog']
    ) then
      raise exception 'Session 17 pinned search_path probe failed: %', trusted_function;
    end if;
  end loop;

  if has_function_privilege(
       'anon', 'public.academy_study_list_parent_notifications_v1(integer)', 'execute'
     ) or not has_function_privilege(
       'authenticated',
       'public.academy_study_list_parent_notifications_v1(integer)',
       'execute'
     ) then
    raise exception 'Session 17 guardian projection ACL probe failed';
  end if;

  if exists (
    select 1
    from unnest(array[
      'public.academy_study_claim_adult_review_proposals_v1(timestamptz, integer, integer)',
      'public.academy_study_resolve_adult_recipients_v1(text)',
      'public.academy_study_reauthorize_adult_route_v1(jsonb)',
      'public.academy_study_record_recipient_resolution_v1(jsonb)',
      'public.academy_study_claim_delivery_jobs_v1(timestamptz, integer, integer)',
      'public.academy_study_record_delivery_attempt_v1(jsonb)',
      'public.academy_study_record_delivery_receipt_v1(jsonb)',
      'public.academy_study_record_delivery_outcome_v1(jsonb)'
    ]) as rpc(signature)
    where has_function_privilege('service_role', rpc.signature, 'execute')
  ) then
    raise exception 'Session 17 superseded v1 writable RPC remains executable';
  end if;

  if (
    select count(*)
    from academy_private.study_safety_rate_limit_scopes
    where enabled and scope in (
      'study-safety-classify', 'study-safety-classify-subject-route',
      'classification', 'proposal-creation', 'recipient-resolution',
      'worker-claim', 'delivery-attempt', 'parent-notification-read'
    )
  ) <> 8 then
    raise exception 'Session 17 canonical rate-limit scope registry incomplete';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'academy_private')
      and procedure.prokind = 'f'
      and pg_catalog.pg_get_functiondef(procedure.oid) ~
        '(clock_timestamp\\(\\)|transaction_timestamp\\(\\)|now\\(\\))'
      and procedure.provolatile = 'i'
  ) then
    raise exception 'Session 17 time-dependent function declared immutable';
  end if;
end;
$$;
