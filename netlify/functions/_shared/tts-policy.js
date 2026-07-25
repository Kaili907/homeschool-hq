import { assertExactObject, boundedString, reject } from './http.js'

export const TTS_REQUEST_LIMIT_BYTES = 8 * 1024
export const TTS_TEXT_LIMIT = 1000
export const ELEVENLABS_MODEL_ID = 'eleven_turbo_v2_5'
export const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128'

function allowedVoiceIds(env) {
  const configured = env?.ELEVENLABS_ALLOWED_VOICE_IDS
  if (typeof configured !== 'string') return []
  return [
    ...new Set(
      configured
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]
}

export function validateTtsRequest(value, env) {
  const request = assertExactObject(value, ['text', 'voiceId'])
  const text = boundedString(request.text, { max: TTS_TEXT_LIMIT })
  const voiceId = boundedString(request.voiceId, { max: 64, singleLine: true })
  if (!/^[A-Za-z0-9_-]+$/.test(voiceId)) reject(400, 'invalid_request')

  const allowlist = allowedVoiceIds(env)
  if (allowlist.length === 0) reject(503, 'service_unavailable')
  if (!allowlist.includes(voiceId)) reject(400, 'unsupported_voice')

  return { text, voiceId }
}

export function elevenLabsUrl(voiceId) {
  return `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
    voiceId,
  )}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`
}
