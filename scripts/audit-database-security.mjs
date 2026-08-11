#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(
  resolve(root, 'docs/study-engine-final-production/migration-manifest.json'),
  'utf8',
))

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create table auth.users (id uuid primary key, email text);
  create or replace function auth.uid()
  returns uuid language sql stable set search_path = pg_catalog as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  revoke all on schema auth from public;
  grant usage on schema auth to anon, authenticated, service_role;
  revoke all on function auth.uid() from public;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  revoke all on schema public from public, anon, authenticated, service_role;
  grant usage on schema public to public, anon, authenticated, service_role;
`

async function query(database, sql) {
  return (await database.query(sql)).rows
}

async function main() {
  const database = await PGlite.create()
  try {
    await database.exec(bootstrap)
    for (const migration of manifest.migrations) {
      await database.exec(readFileSync(
        resolve(root, 'supabase/migrations', migration.filename),
        'utf8',
      ))
    }

    const schemas = await query(database, `
      select namespace.nspname as schema_name,
        pg_catalog.pg_get_userbyid(namespace.nspowner) as owner_name,
        coalesce(pg_catalog.array_to_string(namespace.nspacl, ','), '') as acl
      from pg_catalog.pg_namespace as namespace
      where namespace.nspname in ('auth', 'public', 'academy_private')
      order by namespace.nspname
    `)
    const relations = await query(database, `
      select namespace.nspname as schema_name, relation.relname as relation_name,
        case relation.relkind
          when 'r' then 'table' when 'p' then 'partitioned_table'
          when 'v' then 'view' when 'm' then 'materialized_view'
          when 'S' then 'sequence' else relation.relkind::text
        end as relation_kind,
        pg_catalog.pg_get_userbyid(relation.relowner) as owner_name,
        relation.relrowsecurity as rls_enabled,
        relation.relforcerowsecurity as rls_forced,
        coalesce(pg_catalog.array_to_string(relation.relacl, ','), '') as acl
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname in ('public', 'academy_private')
        and relation.relkind in ('r', 'p', 'v', 'm', 'S')
      order by namespace.nspname, relation.relkind, relation.relname
    `)
    const relationGrants = await query(database, `
      select namespace.nspname as schema_name, relation.relname as relation_name,
        case when acl.grantee = 0 then 'PUBLIC'
          else pg_catalog.pg_get_userbyid(acl.grantee) end as grantee,
        acl.privilege_type, acl.is_grantable
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
      where namespace.nspname in ('public', 'academy_private')
      order by namespace.nspname, relation.relname, grantee, acl.privilege_type
    `)
    const policies = await query(database, `
      select schemaname as schema_name, tablename as table_name, policyname as policy_name,
        permissive, roles, cmd, qual, with_check
      from pg_catalog.pg_policies
      where schemaname in ('public', 'academy_private')
      order by schemaname, tablename, policyname
    `)
    const routines = await query(database, `
      select namespace.nspname as schema_name, routine.proname as routine_name,
        pg_catalog.pg_get_function_identity_arguments(routine.oid) as identity_arguments,
        pg_catalog.pg_get_userbyid(routine.proowner) as owner_name,
        language.lanname as language_name,
        routine.prosecdef as security_definer,
        routine.provolatile as volatility,
        coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '') as configuration,
        routine.prosrc as source,
        routine.proacl is null
          or exists (
            select 1 from pg_catalog.aclexplode(routine.proacl) as acl
            where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
          ) as public_execute,
        pg_catalog.has_function_privilege(
          'anon', routine.oid, 'EXECUTE'
        ) as anon_execute,
        pg_catalog.has_function_privilege(
          'authenticated', routine.oid, 'EXECUTE'
        ) as authenticated_execute,
        pg_catalog.has_function_privilege(
          'service_role', routine.oid, 'EXECUTE'
        ) as service_execute
      from pg_catalog.pg_proc as routine
      join pg_catalog.pg_namespace as namespace on namespace.oid = routine.pronamespace
      join pg_catalog.pg_language as language on language.oid = routine.prolang
      where namespace.nspname in ('public', 'academy_private')
      order by namespace.nspname, routine.proname,
        pg_catalog.pg_get_function_identity_arguments(routine.oid)
    `)
    const routineGrants = await query(database, `
      select namespace.nspname as schema_name, routine.proname as routine_name,
        pg_catalog.pg_get_function_identity_arguments(routine.oid) as identity_arguments,
        case when acl.grantee = 0 then 'PUBLIC'
          else pg_catalog.pg_get_userbyid(acl.grantee) end as grantee,
        acl.privilege_type, acl.is_grantable
      from pg_catalog.pg_proc as routine
      join pg_catalog.pg_namespace as namespace on namespace.oid = routine.pronamespace
      cross join lateral pg_catalog.aclexplode(routine.proacl) as acl
      where namespace.nspname in ('public', 'academy_private')
      order by namespace.nspname, routine.proname, identity_arguments, grantee
    `)
    const triggers = await query(database, `
      select namespace.nspname as schema_name, relation.relname as relation_name,
        trigger.tgname as trigger_name,
        function_namespace.nspname as function_schema,
        routine.proname as function_name,
        pg_catalog.pg_get_triggerdef(trigger.oid, true) as definition
      from pg_catalog.pg_trigger as trigger
      join pg_catalog.pg_class as relation on relation.oid = trigger.tgrelid
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      join pg_catalog.pg_proc as routine on routine.oid = trigger.tgfoid
      join pg_catalog.pg_namespace as function_namespace
        on function_namespace.oid = routine.pronamespace
      where not trigger.tgisinternal
        and namespace.nspname in ('public', 'academy_private')
      order by namespace.nspname, relation.relname, trigger.tgname
    `)

    const baseTables = relations.filter(({ relation_kind: kind }) => (
      kind === 'table' || kind === 'partitioned_table'
    ))
    const securityDefiners = routines.filter(({ security_definer: value }) => value)
    const overloads = Object.entries(Object.groupBy(
      routines,
      ({ schema_name: schemaName, routine_name: routineName }) => `${schemaName}.${routineName}`,
    )).filter(([, entries]) => entries.length > 1).map(([name, entries]) => ({
      name,
      signatures: entries.map(({ identity_arguments: arguments_ }) => arguments_),
    }))
    const findings = {
      baseTablesWithoutRls: baseTables.filter(({ rls_enabled: enabled }) => !enabled)
        .map(({ schema_name: schemaName, relation_name: relationName }) => `${schemaName}.${relationName}`),
      rlsEnabledButUnforced: baseTables.filter(({ rls_enabled: enabled, rls_forced: forced }) => (
        enabled && !forced
      )).map(({ schema_name: schemaName, relation_name: relationName }) => `${schemaName}.${relationName}`),
      nonPostgresOwners: [
        ...relations.filter(({ owner_name: owner }) => owner !== 'postgres')
          .map(({ schema_name: schemaName, relation_name: relationName }) => `${schemaName}.${relationName}`),
        ...routines.filter(({ owner_name: owner }) => owner !== 'postgres')
          .map(({ schema_name: schemaName, routine_name: routineName }) => `${schemaName}.${routineName}`),
      ],
      unsafeSecurityDefinerSearchPaths: securityDefiners.filter(({ configuration }) => (
        !['search_path=pg_catalog', 'search_path=pg_catalog, pg_temp'].includes(configuration)
      )).map(({ schema_name: schemaName, routine_name: routineName, identity_arguments: arguments_ }) => (
        `${schemaName}.${routineName}(${arguments_})`
      )),
      publicSecurityDefiners: securityDefiners.filter(({ public_execute: executable }) => executable)
        .map(({ schema_name: schemaName, routine_name: routineName, identity_arguments: arguments_ }) => (
          `${schemaName}.${routineName}(${arguments_})`
        )),
      anonSecurityDefiners: securityDefiners.filter(({ anon_execute: executable }) => executable)
        .map(({ schema_name: schemaName, routine_name: routineName, identity_arguments: arguments_ }) => (
          `${schemaName}.${routineName}(${arguments_})`
        )),
      dynamicSqlSecurityDefiners: securityDefiners.filter(({ source }) => (
        /(?:^|[;\n])\s*execute\s+(?:format\s*\(|[^'])/im.test(source)
      )).map(({ schema_name: schemaName, routine_name: routineName, identity_arguments: arguments_ }) => (
        `${schemaName}.${routineName}(${arguments_})`
      )),
      overloads,
    }
    const inventory = {
      replayedMigrations: manifest.migrations.length,
      schemas,
      relations,
      relationGrants,
      policies,
      routines: routines.map(({ source: _source, ...routine }) => routine),
      routineGrants,
      triggers,
      findings,
    }
    process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`)
  } finally {
    await database.close()
  }
}

await main()
