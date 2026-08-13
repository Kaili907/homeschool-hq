begin isolation level serializable read only deferrable;

select
  current_database() as database_name,
  current_user as connected_role,
  inet_server_addr()::text as server_address,
  current_setting('transaction_read_only') as transaction_read_only,
  current_setting('server_version') as server_version;

select version, name
from supabase_migrations.schema_migrations
order by version;

select
  namespace.nspname as schema_name,
  relation.relname as object_name,
  relation.relkind as object_kind,
  pg_catalog.pg_get_userbyid(relation.relowner) as owner_name,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced,
  relation.relacl::text as acl
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
where namespace.nspname in ('public', 'academy_private')
order by namespace.nspname, relation.relkind, relation.relname;

select
  columns.table_schema,
  columns.table_name,
  columns.ordinal_position,
  columns.column_name,
  columns.data_type,
  columns.udt_name,
  columns.is_nullable,
  columns.column_default
from information_schema.columns
where columns.table_schema in ('public', 'academy_private')
order by columns.table_schema, columns.table_name, columns.ordinal_position;

select
  namespace.nspname as schema_name,
  relation.relname as table_name,
  constraint_record.conname as constraint_name,
  constraint_record.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(constraint_record.oid, true) as definition
from pg_catalog.pg_constraint as constraint_record
join pg_catalog.pg_class as relation on relation.oid = constraint_record.conrelid
join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
where namespace.nspname in ('public', 'academy_private')
order by namespace.nspname, relation.relname, constraint_record.conname;

select
  namespace.nspname as schema_name,
  relation.relname as table_name,
  index_record.relname as index_name,
  pg_catalog.pg_get_indexdef(index_record.oid) as definition
from pg_catalog.pg_index as index_catalog
join pg_catalog.pg_class as relation on relation.oid = index_catalog.indrelid
join pg_catalog.pg_class as index_record on index_record.oid = index_catalog.indexrelid
join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
where namespace.nspname in ('public', 'academy_private')
order by namespace.nspname, relation.relname, index_record.relname;

select
  schemaname as schema_name,
  tablename as table_name,
  policyname as policy_name,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname in ('public', 'academy_private')
order by schemaname, tablename, policyname;

select
  namespace.nspname as schema_name,
  routine.proname as routine_name,
  pg_catalog.pg_get_function_identity_arguments(routine.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(routine.proowner) as owner_name,
  routine.prosecdef as security_definer,
  routine.provolatile as volatility,
  routine.proconfig,
  routine.proacl::text as acl,
  pg_catalog.pg_get_functiondef(routine.oid) as definition
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as namespace on namespace.oid = routine.pronamespace
where namespace.nspname in ('public', 'academy_private')
order by namespace.nspname, routine.proname, identity_arguments;

select
  namespace.nspname as schema_name,
  relation.relname as table_name,
  trigger_record.tgname as trigger_name,
  pg_catalog.pg_get_triggerdef(trigger_record.oid, true) as definition
from pg_catalog.pg_trigger as trigger_record
join pg_catalog.pg_class as relation on relation.oid = trigger_record.tgrelid
join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
where namespace.nspname in ('public', 'academy_private')
  and not trigger_record.tgisinternal
order by namespace.nspname, relation.relname, trigger_record.tgname;

select
  schema_record.nspname as schema_name,
  pg_catalog.pg_get_userbyid(schema_record.nspowner) as owner_name,
  schema_record.nspacl::text as acl
from pg_catalog.pg_namespace as schema_record
where schema_record.nspname in ('public', 'academy_private')
order by schema_record.nspname;

rollback;
