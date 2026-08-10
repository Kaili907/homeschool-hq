import { assertExactObject, boundedString, reject } from './http.js'

export const TTS_REQUEST_LIMIT_BYTES = 8 * 1024
export const TTS_TEXT_LIMIT = 1000
export const ELEVENLABS_MODEL_ID = 'eleven_turbo_v2_5'
export const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128'

export function validateTtsRequest(value) {
  const request = assertExactObject(value, ['text', 'voiceRef', 'voiceVersion'])
  const text = boundedString(request.text, { max: TTS_TEXT_LIMIT })
  const voiceRef = boundedString(request.voiceRef, { max: 128, singleLine: true })
  const voiceVersion = boundedString(request.voiceVersion, { max: 64, singleLine: true })
  if (!/^academy\.tts\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(voiceRef)) reject(400, 'invalid_request')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(voiceVersion)) reject(400, 'invalid_request')
  return { text, voiceRef, voiceVersion }
}

export function elevenLabsUrl(voiceId) {
  return `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
    voiceId,
  )}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`
}
