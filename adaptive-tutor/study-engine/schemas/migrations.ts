import { inspectContractVersion } from '../contracts/index.ts'
import { getStudyEngineSchemaForValue } from './registry.ts'
import type { ValidationIssue } from './validation.ts'

export type CurrentContractResult =
  | { readonly ok: true; readonly value: unknown; readonly migrated: false }
  | {
      readonly ok: false
      readonly disposition:
        | 'missing-version'
        | 'invalid-version'
        | 'unsupported-older-version'
        | 'unsupported-future-version'
        | 'unknown-kind'
        | 'invalid-current-payload'
      readonly issues: readonly ValidationIssue[]
    }

/**
 * Initial-version migration gate. Version 1 payloads are validated and returned
 * without cloning or normalization; unknown predecessor/future versions are
 * quarantined for an explicit, lossless migration supplied by a later release.
 */
export function migrateStudyEngineContractToCurrent(value: unknown): CurrentContractResult {
  const version = inspectContractVersion(value)
  if (version.status !== 'current') {
    return {
      ok: false,
      disposition: version.status,
      issues: [
        {
          code: version.status === 'invalid-version' ? 'type' : 'literal',
          path: '$.schemaVersion',
          message: `Cannot migrate contract: ${version.status}.`,
        },
      ],
    }
  }

  const schema = getStudyEngineSchemaForValue(value)
  if (!schema) {
    return {
      ok: false,
      disposition: 'unknown-kind',
      issues: [{ code: 'literal', path: '$.kind', message: 'Unknown study-engine contract kind.' }],
    }
  }
  const result = schema.validate(value)
  if (!result.ok) {
    return {
      ok: false,
      disposition: 'invalid-current-payload',
      issues: result.issues,
    }
  }
  return { ok: true, value: result.value, migrated: false }
}

