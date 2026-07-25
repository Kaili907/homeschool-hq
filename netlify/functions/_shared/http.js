const JSON_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
})

export class GatewayError extends Error {
  constructor(statusCode, code) {
    super(code)
    this.name = 'GatewayError'
    this.statusCode = statusCode
    this.code = code
  }
}

export function reject(statusCode, code) {
  throw new GatewayError(statusCode, code)
}

export function jsonResponse(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...headers },
    body: JSON.stringify(payload),
  }
}

export function errorResponse(statusCode, code, headers = {}) {
  return jsonResponse(statusCode, { error: { code } }, headers)
}

export function responseForError(error) {
  if (error instanceof GatewayError) {
    return errorResponse(error.statusCode, error.code)
  }
  return errorResponse(500, 'internal_error')
}

export function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return ''
  const wanted = name.toLowerCase()
  let found = ''
  let matched = false
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted || typeof value !== 'string') continue
    if (matched) return ''
    matched = true
    found = value
  }
  return found
}

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function assertExactObject(value, requiredKeys, optionalKeys = []) {
  if (!isRecord(value)) reject(400, 'invalid_request')
  const allowed = new Set([...requiredKeys, ...optionalKeys])
  const keys = Object.keys(value)
  if (requiredKeys.some((key) => !Object.hasOwn(value, key))) reject(400, 'invalid_request')
  if (keys.some((key) => !allowed.has(key))) reject(400, 'invalid_request')
  return value
}

export function boundedString(value, { min = 1, max, singleLine = false } = {}) {
  if (typeof value !== 'string') reject(400, 'invalid_request')
  const normalized = value.trim()
  if (normalized.length < min || normalized.length > max) reject(400, 'invalid_request')
  if (normalized.includes('\u0000')) reject(400, 'invalid_request')
  if (singleLine && /[\u0000-\u001f\u007f]/u.test(normalized)) reject(400, 'invalid_request')
  return normalized
}

export function boundedInteger(value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) reject(400, 'invalid_request')
  return value
}

function decodeBody(event) {
  if (typeof event?.body !== 'string') reject(400, 'malformed_json')
  if (!event.isBase64Encoded) return Buffer.from(event.body, 'utf8')
  if (
    event.body.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(event.body)
  ) {
    reject(400, 'malformed_json')
  }
  return Buffer.from(event.body, 'base64')
}

export function readJsonBody(event, maxBytes) {
  const contentType = getHeader(event?.headers, 'content-type').toLowerCase()
  if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
    reject(415, 'unsupported_content_type')
  }
  const contentEncoding = getHeader(event?.headers, 'content-encoding').trim().toLowerCase()
  if (contentEncoding && contentEncoding !== 'identity') {
    reject(415, 'unsupported_content_type')
  }

  const bytes = decodeBody(event)
  if (bytes.byteLength > maxBytes) reject(413, 'request_too_large')

  let parsed
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch {
    reject(400, 'malformed_json')
  }
  if (!isRecord(parsed)) reject(400, 'invalid_request')
  return parsed
}

export function hasQuery(event) {
  if (typeof event?.rawQuery === 'string' && event.rawQuery !== '') return true
  if (typeof event?.rawQueryString === 'string' && event.rawQueryString !== '') return true
  if (isRecord(event?.queryStringParameters) && Object.keys(event.queryStringParameters).length > 0) return true
  if (
    isRecord(event?.multiValueQueryStringParameters) &&
    Object.keys(event.multiValueQueryStringParameters).length > 0
  ) {
    return true
  }
  return false
}

export function envFlagEnabled(env, name) {
  const value = env?.[name]
  if (typeof value !== 'string') return true
  return !['0', 'false', 'off', 'disabled'].includes(value.trim().toLowerCase())
}
