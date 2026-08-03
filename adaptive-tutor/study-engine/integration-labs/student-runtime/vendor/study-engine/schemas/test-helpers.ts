import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface ValidFixtureEntry {
  readonly schemaId: string
  readonly file: string
}

export interface MutationOperation {
  readonly op: 'add' | 'replace' | 'remove'
  readonly path: string
  readonly value?: unknown
}

export interface InvalidFixtureEntry {
  readonly id: string
  readonly schemaId: string
  readonly baseFile: string
  readonly operations: readonly MutationOperation[]
  readonly expectedCode: string
  readonly expectedPath: string
}

const schemasDirectory = dirname(fileURLToPath(import.meta.url))
export const studyEngineDirectory = resolve(schemasDirectory, '..')
export const validFixtureDirectory = resolve(studyEngineDirectory, 'fixtures', 'valid')
export const invalidFixtureDirectory = resolve(studyEngineDirectory, 'fixtures', 'invalid')
export const generatedSchemaDirectory = resolve(schemasDirectory, 'generated')

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

export function loadValidManifest(): readonly ValidFixtureEntry[] {
  return readJson(resolve(validFixtureDirectory, 'manifest.json')) as ValidFixtureEntry[]
}

export function loadInvalidManifest(): readonly InvalidFixtureEntry[] {
  return readJson(resolve(invalidFixtureDirectory, 'mutations.json')) as InvalidFixtureEntry[]
}

export function loadValidFixture(filename: string): unknown {
  return readJson(resolve(validFixtureDirectory, filename))
}

export function applyMutations(
  baseline: unknown,
  operations: readonly MutationOperation[],
): unknown {
  const output = structuredClone(baseline)
  for (const operation of operations) {
    const segments = operation.path
      .split('/')
      .slice(1)
      .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    if (segments.length === 0) throw new Error('Fixture mutation cannot replace the root.')
    let parent: unknown = output
    for (const segment of segments.slice(0, -1)) {
      if (Array.isArray(parent)) {
        parent = parent[Number(segment)]
      } else if (typeof parent === 'object' && parent !== null) {
        parent = (parent as Record<string, unknown>)[segment]
      } else {
        throw new Error(`Cannot traverse fixture mutation ${operation.path}.`)
      }
    }
    const key = segments.at(-1)
    if (key === undefined) throw new Error(`Invalid fixture mutation ${operation.path}.`)
    if (Array.isArray(parent)) {
      const index = Number(key)
      if (operation.op === 'remove') parent.splice(index, 1)
      else parent[index] = structuredClone(operation.value)
    } else if (typeof parent === 'object' && parent !== null) {
      if (operation.op === 'remove') delete (parent as Record<string, unknown>)[key]
      else (parent as Record<string, unknown>)[key] = structuredClone(operation.value)
    } else {
      throw new Error(`Cannot apply fixture mutation ${operation.path}.`)
    }
  }
  return output
}

export function cloneFixture(filename: string): Record<string, unknown> {
  return structuredClone(loadValidFixture(filename)) as Record<string, unknown>
}

