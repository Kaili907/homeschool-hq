import { envFlagEnabled, reject } from './http.js'

export const TTS_VOICE_STATUSES = Object.freeze(['active', 'disabled', 'legacy', 'revoked'])
export const TTS_CACHED_PLAYBACK_POLICIES = Object.freeze(['allow', 'deny'])

const STATUS_SET = new Set(TTS_VOICE_STATUSES)
const CACHED_PLAYBACK_SET = new Set(TTS_CACHED_PLAYBACK_POLICIES)
const VOICE_REF_PATTERN = /^academy\.tts\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/
const VOICE_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const PROVIDER_VOICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function exactKeys(value, required) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === required.length && required.every((key) => Object.hasOwn(value, key))
}

function boundedText(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
}

function freezeEntry(entry) {
  const required = [
    'voiceRef',
    'displayLabel',
    'providerClass',
    'provider',
    'providerVoiceId',
    'voiceVersion',
    'status',
    'cachedPlayback',
    'adminApproved',
  ]
  if (!exactKeys(entry, required)) throw new TypeError('invalid TTS catalog entry shape')
  if (!boundedText(entry.voiceRef, 128) || !VOICE_REF_PATTERN.test(entry.voiceRef)) {
    throw new TypeError('invalid TTS catalog voiceRef')
  }
  if (!boundedText(entry.displayLabel, 120)) throw new TypeError('invalid TTS catalog displayLabel')
  if (entry.providerClass !== 'premium') throw new TypeError('invalid TTS provider class')
  if (entry.provider !== 'elevenlabs') throw new TypeError('unsupported TTS catalog provider')
  if (!PROVIDER_VOICE_ID_PATTERN.test(entry.providerVoiceId)) {
    throw new TypeError('invalid TTS provider voice identifier')
  }
  if (!VOICE_VERSION_PATTERN.test(entry.voiceVersion)) throw new TypeError('invalid TTS voice version')
  if (!STATUS_SET.has(entry.status)) throw new TypeError('invalid TTS catalog status')
  if (!CACHED_PLAYBACK_SET.has(entry.cachedPlayback)) {
    throw new TypeError('invalid TTS cached playback policy')
  }
  if (typeof entry.adminApproved !== 'boolean') throw new TypeError('invalid TTS approval state')
  return Object.freeze({ ...entry })
}

/** Build-time/server-test constructor. The returned catalog and every entry are immutable. */
export function createTtsVoiceCatalog(value) {
  if (!exactKeys(value, ['catalogVersion', 'defaultVoiceRef', 'voices'])) {
    throw new TypeError('invalid TTS catalog shape')
  }
  if (!VOICE_VERSION_PATTERN.test(value.catalogVersion)) throw new TypeError('invalid TTS catalog version')
  if (value.defaultVoiceRef !== null && !VOICE_REF_PATTERN.test(value.defaultVoiceRef)) {
    throw new TypeError('invalid default TTS voice ref')
  }
  if (!Array.isArray(value.voices) || value.voices.length > 64) {
    throw new TypeError('invalid TTS catalog voices')
  }
  const voices = value.voices.map(freezeEntry)
  const refs = new Set()
  for (const voice of voices) {
    if (refs.has(voice.voiceRef)) throw new TypeError('duplicate TTS catalog voiceRef')
    refs.add(voice.voiceRef)
  }
  if (value.defaultVoiceRef !== null) {
    const defaultEntry = voices.find((voice) => voice.voiceRef === value.defaultVoiceRef)
    if (!defaultEntry || defaultEntry.status !== 'active' || !defaultEntry.adminApproved) {
      throw new TypeError('default TTS voice must be active and approved')
    }
  }
  return Object.freeze({
    catalogVersion: value.catalogVersion,
    defaultVoiceRef: value.defaultVoiceRef,
    voices: Object.freeze(voices),
  })
}

/**
 * No verified production provider identifiers are available. Production remains
 * safely browser-speech-only until an audited catalog entry is supplied.
 */
export const TTS_VOICE_CATALOG = createTtsVoiceCatalog({
  catalogVersion: '2026.08.09-1',
  defaultVoiceRef: null,
  voices: [],
})

function allowedProviderVoiceIds(env) {
  const configured = env?.ELEVENLABS_ALLOWED_VOICE_IDS
  if (typeof configured !== 'string') return new Set()
  return new Set(configured.split(',').map((item) => item.trim()).filter(Boolean))
}

function providerConfigured(entry, env) {
  if (entry.provider !== 'elevenlabs') return false
  const apiKey = typeof env?.ELEVENLABS_API_KEY === 'string' ? env.ELEVENLABS_API_KEY.trim() : ''
  return apiKey.length > 0 && allowedProviderVoiceIds(env).has(entry.providerVoiceId)
}

function deploymentAvailable(entry, env) {
  return entry.status === 'active' && entry.adminApproved && providerConfigured(entry, env)
}

export function projectPublicTtsCatalog(catalog, env, synthesisPermitted = false) {
  const voices = catalog.voices.map((entry) => Object.freeze({
    voiceRef: entry.voiceRef,
    voiceVersion: entry.voiceVersion,
    displayLabel: entry.displayLabel,
    providerClass: entry.providerClass,
    status: entry.status,
    deploymentAvailable: deploymentAvailable(entry, env),
    cachedPlaybackAllowed: entry.status !== 'revoked' && entry.cachedPlayback === 'allow',
  }))
  return Object.freeze({
    catalogVersion: catalog.catalogVersion,
    synthesisEnabled: synthesisPermitted
      && envFlagEnabled(env, 'ACADEMY_TTS_ENABLED')
      && voices.some((voice) => voice.status === 'active' && voice.deploymentAvailable),
    defaultVoiceRef: catalog.defaultVoiceRef,
    voices: Object.freeze(voices),
  })
}

/** Resolve logical authority to the private provider mapping, failing before quota use. */
export function resolveTtsCatalogVoice(catalog, voiceRef, voiceVersion, env) {
  const entry = catalog.voices.find((candidate) => candidate.voiceRef === voiceRef)
  if (!entry) reject(400, 'unknown_voice_ref')
  if (entry.status === 'legacy') reject(400, 'legacy_voice_ref')
  if (entry.voiceVersion !== voiceVersion) reject(409, 'stale_voice_ref')
  if (entry.status === 'disabled' || entry.status === 'revoked') {
    reject(409, 'voice_ref_disabled')
  }
  if (!entry.adminApproved) reject(403, 'voice_ref_not_approved')
  if (!allowedProviderVoiceIds(env).has(entry.providerVoiceId)) {
    reject(503, 'voice_deployment_mismatch')
  }
  const apiKey = typeof env?.ELEVENLABS_API_KEY === 'string' ? env.ELEVENLABS_API_KEY.trim() : ''
  if (!apiKey || entry.provider !== 'elevenlabs') reject(503, 'provider_unavailable')
  return entry
}
