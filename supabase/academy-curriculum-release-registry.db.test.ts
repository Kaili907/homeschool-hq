import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACADEMY_RELEASE_VERSION } from '../src/academy/contentTypes'
import { synchronizeMigration } from '../scripts/generate-curriculum-release-registry.mjs'

const SOURCE_COMMIT = '4056e31d8beb36622be5ac27ea7f20145266343b'
const GIT = process.platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : 'git'
const SOURCE_ROOT = resolve(__dirname, '../curriculum-content/manuel-academy/1.0.0')
const MIGRATION_URL = new URL('./migrations/20260809160000_academy_curriculum_release_registry.sql', import.meta.url)
const CUSTODY_URL = new URL('../docs/admin-console/curriculum-release-registry-migration.json', import.meta.url)
const databases: PGlite[] = []

const migrationSql = readFile(MIGRATION_URL, 'utf8')

const bootstrapSql = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create table public.profiles (id text primary key, payload jsonb not null);
  create table public.academy_subject_enrollments (id text primary key, payload jsonb not null);
  create table public.academy_attempts (id text primary key, payload jsonb not null);
  create table public.academy_study_sessions (id text primary key, payload jsonb not null);
  create table public.academy_tutor_evidence (id text primary key, payload jsonb not null);
  create table public.academy_mastery (id text primary key, payload jsonb not null);

  insert into public.profiles values ('sentinel', '{"state":"profile"}');
  insert into public.academy_subject_enrollments values ('sentinel', '{"state":"enrollment"}');
  insert into public.academy_attempts values ('sentinel', '{"state":"attempt"}');
  insert into public.academy_study_sessions values ('sentinel', '{"state":"study-session"}');
  insert into public.academy_tutor_evidence values ('sentinel', '{"state":"tutor-evidence"}');
  insert into public.academy_mastery values ('sentinel', '{"state":"mastery"}');
`

type Role = 'anon' | 'authenticated' | 'service_role'

type SourceFile = {
  path: string
  byteCount: number
  sha256: string
  contentType: string
}

function sha256(bytes: Uint8Array | string) {
  return createHash('sha256').update(bytes).digest('hex')
}

function contentType(path: string) {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.jsonl')) return 'application/x-ndjson'
  if (path.endsWith('.csv')) return 'text/csv;charset=utf-8'
  if (path.endsWith('.md')) return 'text/markdown;charset=utf-8'
  if (path.endsWith('.txt')) return 'text/plain;charset=utf-8'
  throw new Error(`Unsupported source extension: ${path}`)
}

async function walk(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

async function sourceFiles(): Promise<SourceFile[]> {
  const files = await walk(SOURCE_ROOT)
  const rows = await Promise.all(files.map(async (file) => {
    const bytes = await readFile(file)
    const path = relative(SOURCE_ROOT, file).split(sep).join('/')
    return { path, byteCount: bytes.length, sha256: sha256(bytes), contentType: contentType(path) }
  }))
  return rows.sort((left, right) => left.path.localeCompare(right.path))
}

async function gradeCounts(grade: '5' | '7' | '8') {
  const coursesRoot = resolve(SOURCE_ROOT, `grades/grade-${grade}/courses`)
  const courses = (await readdir(coursesRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory())
  let units = 0
  let lessons = 0
  let assessments = 0
  for (const course of courses) {
    const root = resolve(coursesRoot, course.name)
    const unitData = JSON.parse(await readFile(resolve(root, 'units.json'), 'utf8'))
    const assessmentData = JSON.parse(await readFile(resolve(root, 'assessments.json'), 'utf8'))
    units += Array.isArray(unitData) ? unitData.length : unitData.units.length
    assessments += Array.isArray(assessmentData) ? assessmentData.length : assessmentData.assessments.length
    const lines = (await readFile(resolve(root, 'lessons.jsonl'), 'utf8')).split(/\r?\n/).filter(Boolean)
    lines.forEach((line) => JSON.parse(line))
    lessons += lines.length
  }
  const textData = JSON.parse(await readFile(resolve(SOURCE_ROOT, `grades/grade-${grade}/original-text-bank.json`), 'utf8'))
  const texts = Array.isArray(textData) ? textData.length : (textData.texts ?? textData.original_texts).length
  return { courses: courses.length, units, lessons, assessments, texts, schedules: 1 }
}

async function asRole<T>(database: PGlite, role: Role, operation: () => Promise<T>): Promise<T> {
  await database.exec(`set role ${role}`)
  try {
    return await operation()
  } finally {
    await database.exec('reset role')
  }
}

async function rpc(database: PGlite, sql: string, values: unknown[] = []) {
  return asRole(database, 'service_role', () => database.query<{ projection: any }>(sql, values))
}

beforeEach(async () => {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(bootstrapSql)
  await database.exec(await migrationSql)
})

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('ADMIN-16A immutable curriculum release registry', () => {
  it('registers the independently recomputed release identity, counts, bytes, and digests', async () => {
    const files = await sourceFiles()
    const grades = { '5': await gradeCounts('5'), '7': await gradeCounts('7'), '8': await gradeCounts('8') }
    const totals = Object.values(grades).reduce((sum, grade) => ({
      courses: sum.courses + grade.courses,
      units: sum.units + grade.units,
      lessons: sum.lessons + grade.lessons,
      assessments: sum.assessments + grade.assessments,
      texts: sum.texts + grade.texts,
      schedules: sum.schedules + grade.schedules,
    }), { courses: 0, units: 0, lessons: 0, assessments: 0, texts: 0, schedules: 0 })
    const release = (await databases[0].query<any>('select * from public.academy_curriculum_releases')).rows[0]
    expect(release).toMatchObject({
      package_id: 'manuel-academy-grades-5-7-8-curriculum-v1',
      version: '1.0.0', status: 'published', authored_on: new Date('2026-08-03T00:00:00.000Z'),
      provenance_class: 'legacy_import', source_commit: SOURCE_COMMIT,
      source_root: 'curriculum-content/manuel-academy/1.0.0',
      file_count: 182, byte_count: 23196845,
      course_count: totals.courses, unit_count: totals.units, lesson_count: totals.lessons,
      assessment_count: totals.assessments, text_count: totals.texts, schedule_count: totals.schedules,
    })
    expect(files).toHaveLength(release.file_count)
    expect(files.reduce((sum, file) => sum + file.byteCount, 0)).toBe(Number(release.byte_count))
    expect(grades).toEqual({
      '5': { courses: 10, units: 77, lessons: 900, assessments: 77, texts: 6, schedules: 1 },
      '7': { courses: 10, units: 77, lessons: 900, assessments: 77, texts: 6, schedules: 1 },
      '8': { courses: 10, units: 78, lessons: 936, assessments: 78, texts: 6, schedules: 1 },
    })
    expect(release.package_manifest_sha256).toBe(sha256(await readFile(resolve(SOURCE_ROOT, 'MANIFEST.json'))))
    expect(release.checksum_manifest_sha256).toBe(sha256(await readFile(resolve(SOURCE_ROOT, 'SHA256SUMS.txt'))))
    expect(release.curriculum_manifest_sha256).toBe(sha256(await readFile(resolve(SOURCE_ROOT, 'curriculum-manifest.json'))))
    const inventory = files.map((file) => `${file.path}\0${file.byteCount}\0${file.sha256}\n`).join('')
    expect(release.file_inventory_sha256).toBe(sha256(inventory))
  })

  it('registers every source path with exact byte custody and an immutable locator', async () => {
    const expected = await sourceFiles()
    const actual = (await databases[0].query<any>(`
      select relative_path, byte_count, sha256, content_type, safe_classification, immutable_locator
      from public.academy_curriculum_release_files order by relative_path
    `)).rows.map((row) => ({
      path: row.relative_path,
      byteCount: Number(row.byte_count),
      sha256: row.sha256,
      contentType: row.content_type,
      safeClassification: row.safe_classification,
      immutableLocator: row.immutable_locator,
    })).sort((left, right) => left.path.localeCompare(right.path))
    expect(actual.map(({ path, byteCount, sha256: digest, contentType: type }) => ({ path, byteCount, sha256: digest, contentType: type })))
      .toEqual(expected)
    expect(actual).toHaveLength(182)
    for (const file of actual) {
      expect(file.safeClassification).toBe('metadata_only_internal_source')
      expect(file.immutableLocator).toBe(
        `git_commit_path:${SOURCE_COMMIT}:curriculum-content/manuel-academy/1.0.0/${file.path}`,
      )
      expect(file.immutableLocator).not.toMatch(/\\|https?:|(?:^|[:/])master(?:[:/]|$)/)
    }
  })

  it('validates the package manifests and their deliberately different self-coverage', async () => {
    const files = await sourceFiles()
    const byPath = new Map(files.map((file) => [file.path, file]))
    const manifest = JSON.parse(await readFile(resolve(SOURCE_ROOT, 'MANIFEST.json'), 'utf8'))
    expect(manifest.files).toHaveLength(180)
    for (const entry of manifest.files) {
      expect(byPath.get(entry.path)).toMatchObject({ byteCount: entry.bytes, sha256: entry.sha256 })
    }
    expect(files.filter((file) => !manifest.files.some((entry: any) => entry.path === file.path)).map((file) => file.path))
      .toEqual(['MANIFEST.json', 'SHA256SUMS.txt'])

    const sums = (await readFile(resolve(SOURCE_ROOT, 'SHA256SUMS.txt'), 'utf8')).trim().split(/\r?\n/)
    expect(sums).toHaveLength(181)
    for (const line of sums) {
      const match = /^([0-9a-f]{64})  (.+)$/.exec(line)
      expect(match).not.toBeNull()
      expect(byPath.get(match![2])?.sha256).toBe(match![1])
    }
    expect(files.filter((file) => !sums.some((line) => line.endsWith(`  ${file.path}`))).map((file) => file.path))
      .toEqual(['SHA256SUMS.txt'])
    await expect(synchronizeMigration()).resolves.toBe(true)
  })

  it('round-trips the registry inventory through temporary materialization without byte drift', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'academy-registry-'))
    try {
      const rows = (await databases[0].query<any>(`
        select relative_path, byte_count, sha256 from public.academy_curriculum_release_files order by relative_path
      `)).rows
      for (const row of rows) {
        const source = resolve(SOURCE_ROOT, row.relative_path)
        const target = resolve(temporaryRoot, row.relative_path)
        expect(source.startsWith(`${SOURCE_ROOT}${sep}`)).toBe(true)
        expect(target.startsWith(`${temporaryRoot}${sep}`)).toBe(true)
        await mkdir(dirname(target), { recursive: true })
        await copyFile(source, target)
        const bytes = await readFile(target)
        expect(bytes.length, row.relative_path).toBe(Number(row.byte_count))
        expect(sha256(bytes), row.relative_path).toBe(row.sha256)
      }
      expect((await walk(temporaryRoot)).length).toBe(182)
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })

  it('makes release, file, and registry-only pointer rows immutable even to their owner', async () => {
    const database = databases[0]
    await expect(database.exec("update public.academy_curriculum_releases set status = 'published' where version = '1.0.0'"))
      .rejects.toThrow('immutable')
    await expect(database.exec("delete from public.academy_curriculum_release_files where relative_path = 'README.md'"))
      .rejects.toThrow('immutable')
    await expect(database.exec("update public.academy_curriculum_active_pointers set revision = 2 where environment = 'production'"))
      .rejects.toThrow('immutable')
    expect((await database.query('select count(*)::integer as count from public.academy_curriculum_release_files')).rows[0])
      .toEqual({ count: 182 })
  })

  it('denies every application role direct table reads and writes', async () => {
    const database = databases[0]
    for (const role of ['anon', 'authenticated', 'service_role'] as const) {
      for (const table of [
        'academy_curriculum_releases', 'academy_curriculum_release_files', 'academy_curriculum_active_pointers',
      ]) {
        await expect(asRole(database, role, () => database.query(`select * from public.${table}`))).rejects.toThrow()
        await expect(asRole(database, role, () => database.exec(`delete from public.${table}`))).rejects.toThrow()
        const privileges = await database.query<{ allowed: boolean }>(
          `select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as allowed`,
          [role, `public.${table}`],
        )
        expect(privileges.rows[0].allowed, `${role} ${table}`).toBe(false)
      }
    }
  })

  it('grants only service-role read RPCs and requires the exact curriculum:read marker', async () => {
    const database = databases[0]
    const functions = [
      'public.academy_admin_list_curriculum_releases_v1(text)',
      'public.academy_admin_read_curriculum_release_v1(text,text)',
      'public.academy_admin_read_curriculum_production_pointer_v1(text)',
    ]
    for (const signature of functions) {
      for (const role of ['anon', 'authenticated']) {
        const allowed = await database.query<{ allowed: boolean }>(
          `select has_function_privilege($1, $2, 'EXECUTE') as allowed`, [role, signature],
        )
        expect(allowed.rows[0].allowed, `${role} ${signature}`).toBe(false)
      }
      const service = await database.query<{ allowed: boolean }>(
        `select has_function_privilege('service_role', $1, 'EXECUTE') as allowed`, [signature],
      )
      expect(service.rows[0].allowed, signature).toBe(true)
    }
    await expect(asRole(database, 'anon', () => database.query(
      "select public.academy_admin_list_curriculum_releases_v1('curriculum:read')",
    ))).rejects.toThrow()
    await expect(asRole(database, 'authenticated', () => database.query(
      "select public.academy_admin_read_curriculum_production_pointer_v1('curriculum:read')",
    ))).rejects.toThrow()
    await expect(rpc(database, 'select public.academy_admin_list_curriculum_releases_v1($1) as projection', ['overview:read']))
      .rejects.toThrow('curriculum:read')
    const list = (await rpc(database, 'select public.academy_admin_list_curriculum_releases_v1($1) as projection', ['curriculum:read'])).rows[0].projection
    expect(list.releases).toHaveLength(1)
    const details = (await rpc(database, 'select public.academy_admin_read_curriculum_release_v1($1,$2) as projection', ['1.0.0', 'curriculum:read'])).rows[0].projection
    expect(details.files).toHaveLength(182)
  })

  it('keeps the production pointer registry-only while the learner runtime stays hard-coded to 1.0.0', async () => {
    const database = databases[0]
    const pointer = (await rpc(
      database,
      'select public.academy_admin_read_curriculum_production_pointer_v1($1) as projection',
      ['curriculum:read'],
    )).rows[0].projection
    expect(pointer).toMatchObject({
      environment: 'production', releaseVersion: '1.0.0', revision: 1,
      changeKind: 'migration_seed', bindingMode: 'registry_only', registryOnly: true,
      runtimeBinding: 'hard-coded',
    })
    expect(ACADEMY_RELEASE_VERSION).toBe('1.0.0')
    expect(pointer.releaseVersion).toBe(ACADEMY_RELEASE_VERSION)
    const runtimeFiles = [
      resolve(__dirname, '../src/academy'),
      resolve(__dirname, '../src/components/academy'),
    ]
    const runtimeText = (await Promise.all((await Promise.all(runtimeFiles.map(walk))).flat().map((file) => readFile(file, 'utf8')))).join('\n')
    expect(runtimeText).not.toMatch(/academy_curriculum_active_pointers|academy_admin_read_curriculum_production_pointer/i)
    expect(await readFile(resolve(__dirname, '../scripts/build-curriculum.mjs'), 'utf8'))
      .not.toMatch(/academy_curriculum_active_pointers|academy_admin_read_curriculum_production_pointer/i)
  })

  it('exposes no activate, rollback, or pointer mutation database surface', async () => {
    const functions = await databases[0].query<{ proname: string }>(`
      select procedure.proname
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname ~ 'academy.*curriculum.*(activate|rollback|pointer.*(set|update|mutate))'
    `)
    expect(functions.rows).toEqual([])
  })

  it('preserves learner enrollment, attempt, Study, Tutor, mastery, and profile sentinels', async () => {
    for (const table of [
      'profiles', 'academy_subject_enrollments', 'academy_attempts',
      'academy_study_sessions', 'academy_tutor_evidence', 'academy_mastery',
    ]) {
      const rows = await databases[0].query(`select * from public.${table}`)
      expect(rows.rows, table).toHaveLength(1)
      expect(rows.rows[0]).toMatchObject({ id: 'sentinel' })
    }
  })

  it('owns, forces RLS on, and guards exactly the three registry tables', async () => {
    const tables = await databases[0].query<any>(`
      select relation.relname, pg_catalog.pg_get_userbyid(relation.relowner) as owner,
        relation.relrowsecurity, relation.relforcerowsecurity
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public' and relation.relname like 'academy_curriculum_%'
        and relation.relkind = 'r'
      order by relation.relname
    `)
    expect(tables.rows).toEqual([
      { relname: 'academy_curriculum_active_pointers', owner: 'postgres', relrowsecurity: true, relforcerowsecurity: true },
      { relname: 'academy_curriculum_release_files', owner: 'postgres', relrowsecurity: true, relforcerowsecurity: true },
      { relname: 'academy_curriculum_releases', owner: 'postgres', relrowsecurity: true, relforcerowsecurity: true },
    ])
    const triggers = await databases[0].query<{ tgname: string }>(`
      select trigger.tgname from pg_catalog.pg_trigger as trigger
      where not trigger.tgisinternal and trigger.tgname like 'academy_curriculum_%_immutable'
      order by trigger.tgname
    `)
    expect(triggers.rows.map((row) => row.tgname)).toEqual([
      'academy_curriculum_active_pointers_immutable',
      'academy_curriculum_release_files_immutable',
      'academy_curriculum_releases_immutable',
    ])
  })

  it('pins migration and source custody manifests to their exact SHA-256 values', async () => {
    const custody = JSON.parse(await readFile(CUSTODY_URL, 'utf8'))
    const migration = await readFile(MIGRATION_URL)
    expect(custody).toMatchObject({
      schemaVersion: 1,
      migration: {
        filename: '20260809160000_academy_curriculum_release_registry.sql',
        version: '20260809160000',
        sourceCommit: SOURCE_COMMIT,
        sourceRoot: 'curriculum-content/manuel-academy/1.0.0',
        hostedApplied: false,
      },
    })
    expect(custody.migration.sha256).toBe(sha256(migration))
    expect(custody.migration.sourceInventorySha256).toBe('346ffa3886764314f1371fe68236741523bad8b638bdf2300e6b6c2eab93ba35')
    expect(() => execFileSync(GIT, ['diff', '--quiet', SOURCE_COMMIT, '--', 'curriculum-content/manuel-academy/1.0.0'], {
      cwd: resolve(__dirname, '..'), stdio: 'pipe',
    })).not.toThrow()
  })
})
