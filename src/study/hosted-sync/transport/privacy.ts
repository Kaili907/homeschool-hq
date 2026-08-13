import {
  parseDurableStudyDocument,
  type DurableStudyDocumentV1,
} from '../../family-pilot/durable-ports/schema'
import type { StudySyncIdentity } from './types'

export const STUDY_SYNC_MAX_BODY_BYTES = 5 * 1024 * 1024

const FORBIDDEN_CONTENT_KEY = /^(?:rawanswer|rawanswerincluded|rawresponse|privateanswer|answertext|responsetext|transientlearnertext|adultprivatenote|adultprivatenotebody|transcript|transcriptincluded|transcripttext|rawtranscript|rawtutortranscript|tutortranscript|tutorchat|tutormessage|audio|audioblob|audiodata|audiourl|audiobytes|audiobase64|recording|emotion|emotionallabel|emotionallabels|emotionalstate|personality|personalityinference|personalityprofile|diagnosis|diagnosticlabel|diagnosticinference|credential|credentials|password|pin|pincode|pinhash|pinsalt|providerapikey|apikey|accesstoken|refreshtoken|bearertoken|servicerole|servicerolekey|sessiongrant|launchgrant|studysessiongrant|browsercredential|cookie)$/i

const CREDENTIAL_TEXT = /(?:\bbearer\s+[A-Za-z0-9._~-]+|aca_stu_v1_[A-Za-z0-9_-]+|\b(?:access|refresh|service[-_ ]?role|api)[-_ ]?token\b)/i

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function walk(value: unknown, path: string, seen: Set<object>): void {
  if (typeof value === 'string') {
    if (CREDENTIAL_TEXT.test(value)) throw new Error(`Study sync privacy refusal at ${path}.`)
    return
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return
  if (typeof value !== 'object') throw new Error(`Study sync payload is not JSON-safe at ${path}.`)
  if (seen.has(value)) throw new Error(`Study sync payload is cyclic at ${path}.`)
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${path}[${index}]`, seen))
  } else {
    for (const [key, entry] of Object.entries(value)) {
      const normalized = normalizedKey(key)
      const allowedMarker =
        (normalized === 'rawanswerincluded' || normalized === 'transcriptincluded') && entry === false
      const allowedPreference =
        (normalized === 'transienttranscript' || normalized === 'noaudio') && typeof entry === 'boolean'
      if (FORBIDDEN_CONTENT_KEY.test(normalized) && !allowedMarker && !allowedPreference && entry !== null && entry !== false) {
        throw new Error(`Study sync privacy refusal at ${path}.${key}.`)
      }
      walk(entry, `${path}.${key}`, seen)
    }
  }
  seen.delete(value)
}

/** Refuses sensitive or non-JSON data instead of silently stripping it. */
export function assertStudySyncPayloadPrivate(value: unknown): void {
  walk(value, 'payload', new Set())
  let encoded: string
  try {
    encoded = JSON.stringify(value)
  } catch {
    throw new Error('Study sync payload could not be serialized safely.')
  }
  if (encoded === undefined || new TextEncoder().encode(encoded).byteLength > STUDY_SYNC_MAX_BODY_BYTES) {
    throw new Error('Study sync payload exceeds the bounded transport size.')
  }
}

/**
 * Applies the final local persistence parser and exact identity binding before
 * a document can cross the network boundary in either direction.
 */
export function parseMinimizedStudySyncDocument(
  value: unknown,
  identity: StudySyncIdentity,
): DurableStudyDocumentV1 | null {
  try {
    assertStudySyncPayloadPrivate(value)
  } catch {
    return null
  }
  const parsed = parseDurableStudyDocument(value, {
    householdRef: identity.householdRef,
    learnerRef: identity.studentRef,
  })
  return parsed.status === 'current' ? parsed.document : null
}
