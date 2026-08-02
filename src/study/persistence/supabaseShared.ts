import { StudyPersistenceError } from '../contracts/persistence'

interface DatabaseErrorLike {
  code?: string
}

export interface StudySupabaseClient {
  auth: {
    getSession(): Promise<{
      data: { session: { access_token?: string } | null }
      error: DatabaseErrorLike | null
    }>
  }
  rpc(
    name: string,
    parameters?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: DatabaseErrorLike | null }>
}

function mappedError(error: DatabaseErrorLike): StudyPersistenceError {
  switch (error.code) {
    case '28000':
      return new StudyPersistenceError('unauthenticated', false)
    case '42501':
      return new StudyPersistenceError('forbidden', false)
    case '22023':
    case '22P02':
    case '23514':
      return new StudyPersistenceError('invalid-input', false)
    case '40001':
    case '40P01':
    case '55P03':
      return new StudyPersistenceError('temporarily-unavailable', true)
    case '57014':
      return new StudyPersistenceError('cancelled', true)
    default:
      return new StudyPersistenceError('database-contract', false)
  }
}

async function requireSession(client: StudySupabaseClient): Promise<void> {
  const { data, error } = await client.auth.getSession()
  if (error || !data.session?.access_token) {
    throw new StudyPersistenceError('unauthenticated', false)
  }
}

export async function authenticatedRpc(
  client: StudySupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
): Promise<unknown> {
  await requireSession(client)
  return rpc(client, name, parameters)
}

/** Server-only: caller supplies an already isolated service-role client. */
export async function trustedServerRpc(
  client: StudySupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
): Promise<unknown> {
  return rpc(client, name, parameters)
}

async function rpc(
  client: StudySupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, parameters)
  if (error) throw mappedError(error)
  return data
}

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StudyPersistenceError('database-contract', false)
  }
  return value as Record<string, unknown>
}

export function records(value: unknown): ReadonlyArray<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new StudyPersistenceError('database-contract', false)
  }
  return value.map(record)
}

export function stringValue(value: unknown): string {
  if (typeof value !== 'string') {
    throw new StudyPersistenceError('database-contract', false)
  }
  return value
}

export function safeInteger(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed)) {
    throw new StudyPersistenceError('database-contract', false)
  }
  return parsed
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonical(nested)]),
  )
}

export async function mutationId(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
