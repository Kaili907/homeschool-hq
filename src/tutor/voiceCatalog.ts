import { getGatewayAccessToken } from './gatewayAuth'

export type PublicVoiceStatus = 'active' | 'disabled' | 'legacy' | 'revoked'

export interface PublicVoiceCatalogEntry {
  voiceRef: string
  voiceVersion: string
  displayLabel: string
  providerClass: 'premium'
  status: PublicVoiceStatus
  deploymentAvailable: boolean
  cachedPlaybackAllowed: boolean
}

export interface PublicVoiceCatalog {
  catalogVersion: string
  synthesisEnabled: boolean
  defaultVoiceRef: string | null
  voices: readonly PublicVoiceCatalogEntry[]
}

export interface VoiceCatalogResolution extends PublicVoiceCatalogEntry {
  synthesisEnabled: boolean
}

export interface VoiceCatalogAccess {
  load(): Promise<PublicVoiceCatalog>
  resolve(voiceRef: string, voiceVersion: string): Promise<VoiceCatalogResolution | null>
}

interface CatalogFetchResponse {
  ok: boolean
  status: number
  json?: () => Promise<unknown>
}

export type CatalogFetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<CatalogFetchResponse>

const EMPTY_CATALOG: PublicVoiceCatalog = Object.freeze({
  catalogVersion: 'unavailable',
  synthesisEnabled: false,
  defaultVoiceRef: null,
  voices: Object.freeze([]),
})
const VOICE_REF = /^academy\.tts\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/
const VOICE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const STATUSES = new Set<PublicVoiceStatus>(['active', 'disabled', 'legacy', 'revoked'])

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === allowed.length && allowed.every((key) => Object.hasOwn(value, key))
}

function parseEntry(value: unknown): PublicVoiceCatalogEntry | null {
  if (!record(value) || !exactKeys(value, [
    'voiceRef', 'voiceVersion', 'displayLabel', 'providerClass', 'status',
    'deploymentAvailable', 'cachedPlaybackAllowed',
  ])) return null
  if (
    typeof value.voiceRef !== 'string' || !VOICE_REF.test(value.voiceRef)
    || typeof value.voiceVersion !== 'string' || !VOICE_VERSION.test(value.voiceVersion)
    || typeof value.displayLabel !== 'string' || value.displayLabel.length === 0 || value.displayLabel.length > 120
    || value.providerClass !== 'premium'
    || typeof value.status !== 'string' || !STATUSES.has(value.status as PublicVoiceStatus)
    || typeof value.deploymentAvailable !== 'boolean'
    || typeof value.cachedPlaybackAllowed !== 'boolean'
  ) return null
  return Object.freeze({
    voiceRef: value.voiceRef,
    voiceVersion: value.voiceVersion,
    displayLabel: value.displayLabel,
    providerClass: value.providerClass,
    status: value.status as PublicVoiceStatus,
    deploymentAvailable: value.deploymentAvailable,
    cachedPlaybackAllowed: value.cachedPlaybackAllowed,
  })
}

function parseCatalog(value: unknown): PublicVoiceCatalog | null {
  if (!record(value) || !exactKeys(value, [
    'catalogVersion', 'synthesisEnabled', 'defaultVoiceRef', 'voices',
  ])) return null
  if (
    typeof value.catalogVersion !== 'string'
    || typeof value.synthesisEnabled !== 'boolean'
    || (value.defaultVoiceRef !== null && (typeof value.defaultVoiceRef !== 'string' || !VOICE_REF.test(value.defaultVoiceRef)))
    || !Array.isArray(value.voices)
    || value.voices.length > 64
  ) return null
  const voices = value.voices.map(parseEntry)
  if (voices.some((entry) => entry === null)) return null
  const resolved = voices as PublicVoiceCatalogEntry[]
  if (new Set(resolved.map((entry) => entry.voiceRef)).size !== resolved.length) return null
  return Object.freeze({
    catalogVersion: value.catalogVersion,
    synthesisEnabled: value.synthesisEnabled,
    defaultVoiceRef: value.defaultVoiceRef,
    voices: Object.freeze(resolved),
  })
}

export function createVoiceCatalogAccess(deps: {
  getAccessToken?: () => Promise<string | null>
  fetchImpl: CatalogFetchLike
  endpoint?: string
}): VoiceCatalogAccess {
  let lastGood: PublicVoiceCatalog | null = null
  let pending: Promise<PublicVoiceCatalog> | null = null
  const load = async (): Promise<PublicVoiceCatalog> => {
    if (lastGood) return lastGood
    if (pending) return pending
    pending = (async () => {
      const token = await (deps.getAccessToken ?? getGatewayAccessToken)()
      if (!token) return EMPTY_CATALOG
      try {
        const response = await deps.fetchImpl(deps.endpoint ?? '/api/tts/catalog', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return EMPTY_CATALOG
        const parsed = parseCatalog(await response.json?.())
        if (!parsed) return EMPTY_CATALOG
        lastGood = parsed
        return parsed
      } catch {
        return lastGood ?? EMPTY_CATALOG
      } finally {
        pending = null
      }
    })()
    return pending
  }
  return {
    load,
    async resolve(voiceRef, voiceVersion) {
      const catalog = await load()
      const entry = catalog.voices.find(
        (candidate) => candidate.voiceRef === voiceRef && candidate.voiceVersion === voiceVersion,
      )
      return entry ? { ...entry, synthesisEnabled: catalog.synthesisEnabled } : null
    },
  }
}

let defaultAccess: VoiceCatalogAccess | null = null

export function getVoiceCatalogAccess(): VoiceCatalogAccess {
  if (!defaultAccess) {
    defaultAccess = createVoiceCatalogAccess({
      fetchImpl: (url, init) => fetch(url, init as RequestInit),
    })
  }
  return defaultAccess
}

export function resetVoiceCatalogAccess(): void {
  defaultAccess = null
}
