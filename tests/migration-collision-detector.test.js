import { describe, expect, it } from 'vitest'
import { analyzeMigrationCollisions } from '../scripts/migration-collision-detector.mjs'

const manifest = (...filenames) => ({
  migrations: filenames.map((filename, index) => ({
    version: filename.slice(0, 14),
    filename,
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
      migrations: [{ version: second.slice(0, 14), filename: second, dependency: first }],
    })
    expect(result.orderingHazards).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'dependency_not_earlier', filename: second }),
      expect.objectContaining({ code: 'migration_missing_from_manifest', filename: first }),
    ]))
  })
})
