import { describe, expect, it } from 'vitest'
import { analyzeMigrationCollisions } from '../scripts/migration-collision-detector.mjs'

const FIRST_HASH = '1'.repeat(64)
const SECOND_HASH = '2'.repeat(64)

const manifest = (...filenames) => ({
  migrations: filenames.map((filename, index) => ({
    version: filename.slice(0, 14),
    filename,
    sha256: index === 0 ? FIRST_HASH : SECOND_HASH,
    dependency: index === 0 ? null : filenames[index - 1],
  })),
})

describe('repository migration collision detector', () => {
  it('accepts unique, increasing, dependency-ordered versions', () => {
    const files = [
      '20260810120000_first.sql',
      '20260810130000_second.sql',
    ]
    expect(analyzeMigrationCollisions(files, manifest(...files))).toEqual({
      migrationCount: 2,
      collisions: [],
      orderingHazards: [],
      integrityHazards: [],
      ok: true,
    })
  })

  it('reports duplicate prefixes without renaming either migration', () => {
    const files = [
      '20260810120000_first.sql',
      '20260810120000_parallel.sql',
    ]
    const result = analyzeMigrationCollisions(files, manifest(...files))
    expect(result.ok).toBe(false)
    expect(result.collisions).toEqual([{
      version: '20260810120000',
      files,
    }])
    expect(files).toEqual([
      '20260810120000_first.sql',
      '20260810120000_parallel.sql',
    ])
  })

  it('reports missing manifest coverage and dependency ordering hazards', () => {
    const first = '20260810120000_first.sql'
    const second = '20260810130000_second.sql'
    const result = analyzeMigrationCollisions([first, second], {
      migrations: [{
        version: second.slice(0, 14), filename: second, dependency: first, sha256: SECOND_HASH,
      }],
    })
    expect(result.orderingHazards).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'dependency_not_earlier', filename: second }),
      expect.objectContaining({ code: 'migration_missing_from_manifest', filename: first }),
      expect.objectContaining({ code: 'dependency_missing_from_manifest', filename: second }),
    ]))
  })

  it('reports missing dependencies and dependency cycles', () => {
    const first = '20260810120000_first.sql'
    const second = '20260810130000_second.sql'
    const result = analyzeMigrationCollisions([first, second], {
      migrations: [
        { version: first.slice(0, 14), filename: first, dependency: second, sha256: FIRST_HASH },
        { version: second.slice(0, 14), filename: second, dependency: first, sha256: SECOND_HASH },
      ],
    })
    expect(result.orderingHazards).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'dependency_not_earlier', filename: first, dependency: second }),
      expect.objectContaining({ code: 'dependency_cycle' }),
    ]))

    const missing = analyzeMigrationCollisions([first, second], {
      migrations: [
        { version: first.slice(0, 14), filename: first, dependency: null, sha256: FIRST_HASH },
        { version: second.slice(0, 14), filename: second, dependency: null, sha256: SECOND_HASH },
      ],
    })
    expect(missing.orderingHazards).toContainEqual(
      expect.objectContaining({ code: 'missing_dependency', filename: second }),
    )
  })

  it('reports manifest hash mismatches and exact duplicate migration content', () => {
    const first = '20260810120000_first.sql'
    const second = '20260810130000_second.sql'
    const result = analyzeMigrationCollisions(
      [first, second],
      manifest(first, second),
      new Map([[first, 'f'.repeat(64)], [second, 'f'.repeat(64)]]),
    )
    expect(result.integrityHazards).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'manifest_sha256_mismatch', filename: first }),
      expect.objectContaining({ code: 'manifest_sha256_mismatch', filename: second }),
      expect.objectContaining({ code: 'duplicate_migration_content' }),
    ]))
  })

  it('reports manifest-only files and repository migrations omitted from the manifest', () => {
    const repository = '20260810120000_repository.sql'
    const missing = '20260810130000_missing.sql'
    const result = analyzeMigrationCollisions([repository], manifest(missing))
    expect(result.orderingHazards).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'migration_missing_from_manifest', filename: repository }),
      expect.objectContaining({ code: 'manifest_file_missing', filename: missing }),
    ]))
  })
})
