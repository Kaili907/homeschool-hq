#!/usr/bin/env node
// From-zero replay of the reconciled migration chain against an ephemeral
// PGlite database. Read-only with respect to the repository and to any hosted
// database: it never connects to a remote and never rewrites a migration.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const root = resolve(process.cwd())
const migrationsRoot = resolve(root, 'supabase/migrations')
const manifestPath = resolve(
  root,
  'docs/study-engine-final-production/migration-manifest.json',
)

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create table auth.users (id uuid primary key);
  create or replace function auth.uid()
  returns uuid language sql stable set search_path = pg_catalog as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub', '')::uuid
    )
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

export async function replayChain() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const entries = manifest.migrations
  const sources = new Map()
  const integrity = []
  for (const entry of entries) {
    const text = (await readFile(resolve(migrationsRoot, entry.filename), 'utf8'))
      .replaceAll('\r\n', '\n')
    const sha256 = createHash('sha256').update(text).digest('hex')
    if (sha256 !== entry.sha256) integrity.push(entry.filename)
    sources.set(entry.filename, text)
  }

  const database = await PGlite.create()
  try {
    await database.exec(bootstrap)
    const applied = []
    for (const entry of entries) {
      try {
        await database.exec(sources.get(entry.filename))
      } catch (error) {
        return {
          ok: false,
          phase: 'apply',
          applied,
          failed: entry.filename,
          reason: String(error?.message ?? error),
          integrity,
        }
      }
      applied.push(entry.filename)
    }

    // Idempotence protection: replaying the chain over an already-migrated
    // database must be refused, not silently applied a second time.
    const replay = []
    for (const entry of entries) {
      try {
        await database.exec(sources.get(entry.filename))
        replay.push({ filename: entry.filename, refused: false })
      } catch (error) {
        replay.push({
          filename: entry.filename,
          refused: true,
          reason: String(error?.message ?? error).split('\n')[0],
        })
        break
      }
    }

    const objects = await database.query(`
      select
        (select count(*)::integer from pg_catalog.pg_tables
          where schemaname in ('public', 'academy_private')) as tables,
        (select count(*)::integer from pg_catalog.pg_proc as p
          join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
          where n.nspname in ('public', 'academy_private')) as routines,
        (select count(*)::integer from pg_catalog.pg_policies
          where schemaname in ('public', 'academy_private')) as policies
    `)

    return {
      ok: integrity.length === 0,
      phase: 'complete',
      applied,
      integrity,
      replay,
      objects: objects.rows[0],
    }
  } finally {
    await database.close()
  }
}


// The three migrations the dispatcher applied to hosted Supabase by hand.
// Reconciliation is only safe if the remaining chain still applies on top of
// exactly this prefix, and if replaying the prefix itself is refused.
export const HOSTED_APPLIED_PREFIX = Object.freeze([
  '20260724074106_academy_profiles_base.sql',
  '20260724230000_academy_student_identity_foundation.sql',
  '20260726120000_academy_household_revision_cas.sql',
])

async function loadChain() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const entries = manifest.migrations
  const sources = new Map()
  const integrity = []
  for (const entry of entries) {
    const text = (await readFile(resolve(migrationsRoot, entry.filename), 'utf8'))
      .replaceAll('\r\n', '\n')
    if (createHash('sha256').update(text).digest('hex') !== entry.sha256) {
      integrity.push(entry.filename)
    }
    sources.set(entry.filename, text)
  }
  return { entries, sources, integrity }
}

/**
 * Proves the reconciled chain is safe for the already-migrated hosted database:
 * apply only the hand-applied prefix, then continue with the remainder.
 */
export async function replayFromHostedBaseline() {
  const { entries, sources, integrity } = await loadChain()
  const prefix = entries.slice(0, HOSTED_APPLIED_PREFIX.length)
  const prefixMatches = prefix.every(
    (entry, index) => entry.filename === HOSTED_APPLIED_PREFIX[index],
  )
  const database = await PGlite.create()
  try {
    await database.exec(bootstrap)
    for (const entry of prefix) await database.exec(sources.get(entry.filename))

    let prefixReplayRefused = false
    try {
      await database.exec(sources.get(prefix[0].filename))
    } catch {
      prefixReplayRefused = true
    }

    const resumed = []
    for (const entry of entries.slice(HOSTED_APPLIED_PREFIX.length)) {
      try {
        await database.exec(sources.get(entry.filename))
      } catch (error) {
        return {
          ok: false,
          prefixMatches,
          prefixReplayRefused,
          resumed,
          failed: entry.filename,
          reason: String(error?.message ?? error).split('\n')[0],
          integrity,
        }
      }
      resumed.push(entry.filename)
    }
    return {
      ok: prefixMatches && prefixReplayRefused && integrity.length === 0,
      prefixMatches,
      prefixReplayRefused,
      resumed,
      integrity,
    }
  } finally {
    await database.close()
  }
}

const invokedDirectly = process.argv[1]
  && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href
if (invokedDirectly) {
  const result = await replayChain()
  const hosted = await replayFromHostedBaseline()
  if (process.argv.includes('--format=json')) {
    process.stdout.write(`${JSON.stringify({ result, hosted }, null, 2)}\n`)
  } else if (result.phase !== 'complete') {
    process.stdout.write(`migration-replay: FAILED applying ${result.failed}\n`)
    process.stdout.write(`  after ${result.applied.length} migrations\n`)
    process.stdout.write(`  ${result.reason}\n`)
  } else {
    const refused = result.replay.find((entry) => entry.refused)
    process.stdout.write(`migration-replay: APPLIED ${result.applied.length} migrations from zero\n`)
    process.stdout.write(`  manifest sha256 mismatches: ${result.integrity.length}\n`)
    process.stdout.write(`  objects: ${JSON.stringify(result.objects)}\n`)
    process.stdout.write(refused
      ? `  idempotence: REFUSED at ${refused.filename}\n    ${refused.reason}\n`
      : '  idempotence: NOT PROTECTED — full chain re-applied silently\n')
    process.stdout.write(hosted.ok
      ? `  hosted-baseline resume: OK (prefix replay refused, ${hosted.resumed.length} remaining applied)\n`
      : `  hosted-baseline resume: FAILED at ${hosted.failed ?? 'prefix check'}\n    ${hosted.reason ?? ''}\n`)
  }
  process.exitCode = result.phase === 'complete'
    && result.integrity.length === 0 && hosted.ok ? 0 : 1
}
