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

function eventHeader(event, name) {
  const wanted = name.toLowerCase()
  const headers = event?.headers
  if (headers !== undefined && headers !== null && !isRecord(headers)) return null
  const singleEntries = headers
    ? Object.entries(event.headers).filter(([key]) => key.toLowerCase() === wanted)
    : []
  if (
    singleEntries.length > 1
    || (singleEntries.length === 1 && typeof singleEntries[0][1] !== 'string')
  ) return null

  let value = singleEntries.length === 1 ? singleEntries[0][1] : ''
  const multiValueHeaders = event?.multiValueHeaders
  if (multiValueHeaders !== undefined && multiValueHeaders !== null && !isRecord(multiValueHeaders)) return null
  const multiEntries = multiValueHeaders
    ? Object.entries(multiValueHeaders).filter(([key]) => key.toLowerCase() === wanted)
    : []
  if (multiEntries.length > 1) return null
  if (multiEntries.length === 1) {
    const values = multiEntries[0][1]
    if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== 'string') return null
    if (value && value.trim().toLowerCase() !== values[0].trim().toLowerCase()) return null
    value = values[0]
  }
  return value
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

function hasWellFormedUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false
    }
  }
  return true
}

function validateJsonTree(root, maxDepth = 64) {
  const pending = [{ value: root, depth: 1 }]
  while (pending.length > 0) {
    const { value, depth } = pending.pop()
    if (depth > maxDepth) reject(400, 'invalid_request')
    if (typeof value === 'string') {
      if (!hasWellFormedUnicode(value)) reject(400, 'invalid_request')
      continue
    }
    if (value === null || typeof value !== 'object') continue
    if (Array.isArray(value)) {
      for (const child of value) pending.push({ value: child, depth: depth + 1 })
    } else {
      for (const [key, child] of Object.entries(value)) {
        if (!hasWellFormedUnicode(key)) reject(400, 'invalid_request')
        pending.push({ value: child, depth: depth + 1 })
      }
    }
  }
}

export function readJsonBody(event, maxBytes) {
  const contentTypeValue = eventHeader(event, 'content-type')
  if (contentTypeValue === null) reject(415, 'unsupported_content_type')
  const contentType = contentTypeValue.toLowerCase()
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/.test(contentType)) {
    reject(415, 'unsupported_content_type')
  }
  const contentEncodingValue = eventHeader(event, 'content-encoding')
  if (contentEncodingValue === null) reject(415, 'unsupported_content_type')
  const contentEncoding = contentEncodingValue.trim().toLowerCase()
  if (contentEncoding && contentEncoding !== 'identity') {
    reject(415, 'unsupported_content_type')
  }

  const bytes = decodeBody(event)
  if (bytes.byteLength > maxBytes) reject(413, 'request_too_large')

  let parsed
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    reject(400, 'malformed_json')
  }
  if (!isRecord(parsed)) reject(400, 'invalid_request')
  validateJsonTree(parsed)
  return parsed
}

export function hasBody(event) {
  return event?.body !== undefined && event.body !== null && event.body !== ''
}

function sortedEntries(entries) {
  return [...entries].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1
    if (leftValue === rightValue) return 0
    return leftValue < rightValue ? -1 : 1
  })
}

function sameEntries(left, right) {
  if (left.length !== right.length) return false
  const sortedLeft = sortedEntries(left)
  const sortedRight = sortedEntries(right)
  return sortedLeft.every(([key, value], index) =>
    key === sortedRight[index][0] && value === sortedRight[index][1])
}

/**
 * Returns one canonical decoded query representation. Netlify supplies raw,
 * single-value, and multi-value views depending on its runtime version. When
 * more than one is present they must describe the same request exactly.
 */
export function readQueryEntries(event, code = 'invalid_request') {
  const fail = () => reject(400, code)
  const rawValues = []
  for (const key of ['rawQueryString', 'rawQuery']) {
    const value = event?.[key]
    if (value === undefined || value === null) continue
    if (typeof value !== 'string') fail()
    rawValues.push(value)
  }
  if (rawValues.length === 2 && rawValues[0] !== rawValues[1]) fail()

  let rawEntries = null
  if (rawValues.length > 0) {
    const raw = rawValues[0]
    if (/%(?![0-9A-Fa-f]{2})/.test(raw)) fail()
    rawEntries = [...new URLSearchParams(raw).entries()]
  }

  const queryValue = event?.queryStringParameters
  let queryEntries = null
  if (queryValue !== undefined && queryValue !== null) {
    if (!isRecord(queryValue)) fail()
    queryEntries = Object.entries(queryValue)
    if (queryEntries.some(([, value]) => typeof value !== 'string')) fail()
    if (queryEntries.length === 0) queryEntries = null
  }

  const multiValue = event?.multiValueQueryStringParameters
  let multiEntries = null
  if (multiValue !== undefined && multiValue !== null) {
    if (!isRecord(multiValue)) fail()
    multiEntries = []
    for (const [key, values] of Object.entries(multiValue)) {
      if (!Array.isArray(values) || values.length === 0 || values.some((value) => typeof value !== 'string')) fail()
      for (const value of values) multiEntries.push([key, value])
    }
    if (multiEntries.length === 0) multiEntries = null
  }

  const representations = [rawEntries, queryEntries, multiEntries].filter((value) => value !== null)
  const first = representations[0] ?? []
  if (representations.some((entries) => !sameEntries(first, entries))) fail()
  return first
}

export function hasQuery(event) {
  for (const key of ['rawQuery', 'rawQueryString']) {
    const value = event?.[key]
    if (value !== undefined && value !== null && (typeof value !== 'string' || value !== '')) return true
  }
  for (const key of ['queryStringParameters', 'multiValueQueryStringParameters']) {
    const value = event?.[key]
    if (value === undefined || value === null) continue
    if (!isRecord(value) || Object.keys(value).length > 0) return true
  }
  return false
}

export function envFlagEnabled(env, name) {
  const value = env?.[name]
  if (typeof value !== 'string') return false
  return ['1', 'true', 'on', 'enabled'].includes(value.toLowerCase())
}

export function isTimeoutError(error, signal) {
  return signal?.aborted === true || error?.name === 'TimeoutError'
}

/**
 * Read an upstream response without ever buffering more than `maxBytes`.
 * Content-Length is rejected before the body is touched when the provider sends it;
 * chunked responses are capped while streaming.
 */
export async function readBoundedResponseBytes(response, maxBytes) {
  const rawLength = response?.headers?.get?.('content-length')
  if (typeof rawLength === 'string' && rawLength.trim() !== '') {
    const normalized = rawLength.trim()
    if (!/^\d+$/.test(normalized)) reject(502, 'provider_failure')
    const declaredLength = BigInt(normalized)
    if (declaredLength > BigInt(maxBytes)) reject(502, 'upstream_too_large')
  }

  const reader = response?.body?.getReader?.()
  if (!reader) reject(502, 'provider_failure')

  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) reject(502, 'provider_failure')
      total += value.byteLength
      if (total > maxBytes) {
        try {
          await reader.cancel()
        } catch {
          // The size decision is already final; cancellation is best-effort.
        }
        reject(502, 'upstream_too_large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock?.()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
