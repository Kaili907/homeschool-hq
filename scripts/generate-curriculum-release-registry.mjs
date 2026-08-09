import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_ROOT = resolve(REPOSITORY_ROOT, 'curriculum-content/manuel-academy/1.0.0')
const MIGRATION_PATH = resolve(
  REPOSITORY_ROOT,
  'supabase/migrations/20260809160000_academy_curriculum_release_registry.sql',
)
const SOURCE_COMMIT = '4056e31d8beb36622be5ac27ea7f20145266343b'
const RELEASE_ID = '16000000-0000-4000-8000-000000000001'
const START_MARKER = '-- BEGIN GENERATED 1.0.0 RELEASE FILE ROWS'
const END_MARKER = '-- END GENERATED 1.0.0 RELEASE FILE ROWS'

async function walk(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

function contentType(path) {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.jsonl')) return 'application/x-ndjson'
  if (path.endsWith('.csv')) return 'text/csv;charset=utf-8'
  if (path.endsWith('.md')) return 'text/markdown;charset=utf-8'
  if (path.endsWith('.txt')) return 'text/plain;charset=utf-8'
  throw new Error(`Unsupported curriculum registry content type: ${path}`)
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`
}

export async function renderReleaseFileRows() {
  const files = (await walk(SOURCE_ROOT)).sort((left, right) => left.localeCompare(right))
  const rows = []
  for (const file of files) {
    const path = relative(SOURCE_ROOT, file).split(sep).join('/')
    const bytes = await readFile(file)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const locator = `git_commit_path:${SOURCE_COMMIT}:curriculum-content/manuel-academy/1.0.0/${path}`
    rows.push(
      `  (${sqlLiteral(RELEASE_ID)}, ${sqlLiteral(path)}, ${bytes.length}, ${sqlLiteral(sha256)}, `
      + `${sqlLiteral(contentType(path))}, 'metadata_only_internal_source', ${sqlLiteral(locator)})`,
    )
  }
  if (rows.length !== 182) throw new Error(`Expected 182 source files, found ${rows.length}`)
  return [
    START_MARKER,
    'insert into public.academy_curriculum_release_files (',
    '  release_id, relative_path, byte_count, sha256, content_type, safe_classification, immutable_locator',
    ') values',
    `${rows.join(',\n')};`,
    END_MARKER,
  ].join('\n')
}

export async function synchronizeMigration({ write = false } = {}) {
  const migration = await readFile(MIGRATION_PATH, 'utf8')
  const start = migration.indexOf(START_MARKER)
  const end = migration.indexOf(END_MARKER)
  if (start < 0 || end < start) throw new Error('Curriculum release row markers are missing')
  const expected = await renderReleaseFileRows()
  const actual = migration.slice(start, end + END_MARKER.length)
  if (actual === expected) return true
  if (!write) return false
  const next = `${migration.slice(0, start)}${expected}${migration.slice(end + END_MARKER.length)}`
  await writeFile(MIGRATION_PATH, next, 'utf8')
  return true
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes('--write')
  const valid = await synchronizeMigration({ write })
  if (!valid) {
    console.error('Curriculum release registry rows do not match the immutable 1.0.0 source package.')
    process.exitCode = 1
  }
}
