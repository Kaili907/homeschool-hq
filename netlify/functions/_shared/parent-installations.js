const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const TOKEN_DIGEST = /^[0-9a-f]{64}$/

function config(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const anonKey = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !anonKey
    ) return null
    return { url: url.toString().replace(/\/+$/, ''), anonKey }
  } catch {
    return null
  }
}

function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('parent_installation_port_contract')
  }
  const actual = Object.keys(value)
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error('parent_installation_port_contract')
  }
  return value
}

function uuidV4(value) {
  return typeof value === 'string' && UUID_V4.test(value)
}

function timestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function positiveRevision(value) {
  return typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
}

function validateStatus(value) {
  if (value?.status === 'unclaimed') {
    const result = exactObject(value, ['schemaVersion', 'status', 'installationId'])
    if (result.schemaVersion !== 1 || !uuidV4(result.installationId)) {
      throw new Error('parent_installation_port_contract')
    }
    return result
  }
  const required = [
    'schemaVersion', 'status', 'bindingId', 'installationId', 'householdId',
    'datasetEpoch', 'bindingRevision', 'sessionGeneration', 'boundAt',
  ]
  const optional = ['lastRecoveredAt', 'revokedAt']
  const result = exactObject(value, [
    ...required,
    ...optional.filter((key) => Object.hasOwn(value ?? {}, key)),
  ])
  if (
    result.schemaVersion !== 1 ||
    !['active', 'revoked'].includes(result.status) ||
    !uuidV4(result.bindingId) ||
    !uuidV4(result.installationId) ||
    !uuidV4(result.householdId) ||
    !uuidV4(result.datasetEpoch) ||
    !positiveRevision(result.bindingRevision) ||
    !positiveRevision(result.sessionGeneration) ||
    !timestamp(result.boundAt) ||
    (Object.hasOwn(result, 'lastRecoveredAt') && !timestamp(result.lastRecoveredAt)) ||
    (Object.hasOwn(result, 'revokedAt') && !timestamp(result.revokedAt))
  ) throw new Error('parent_installation_port_contract')
  return result
}

function validateIssuedGrant(value) {
  const result = exactObject(value, [
    'schemaVersion', 'status', 'grantId', 'installationId', 'datasetEpoch',
    'purpose', 'capability', 'issuedAt', 'expiresAt', 'correlationId',
  ])
  const expectedCapability = result.purpose === 'recovery'
    ? 'parent_installation:recover'
    : 'parent_installation:claim'
  if (
    result.schemaVersion !== 1 ||
    result.status !== 'issued' ||
    !uuidV4(result.grantId) ||
    !uuidV4(result.installationId) ||
    !uuidV4(result.datasetEpoch) ||
    !['first_claim', 'legacy_upgrade', 'recovery'].includes(result.purpose) ||
    result.capability !== expectedCapability ||
    !timestamp(result.issuedAt) ||
    !timestamp(result.expiresAt) ||
    Date.parse(result.expiresAt) <= Date.parse(result.issuedAt) ||
    Date.parse(result.expiresAt) - Date.parse(result.issuedAt) > 10 * 60 * 1_000 ||
    !uuidV4(result.correlationId)
  ) throw new Error('parent_installation_port_contract')
  return result
}

function validateBinding(value, operation) {
  const timeKey = operation === 'claim' ? 'boundAt' : 'recoveredAt'
  const result = exactObject(value, [
    'schemaVersion', 'status', 'bindingId', 'installationId', 'householdId',
    'datasetEpoch', 'bindingRevision', 'sessionGeneration', timeKey,
    'correlationId',
  ])
  if (
    result.schemaVersion !== 1 ||
    result.status !== 'active' ||
    !uuidV4(result.bindingId) ||
    !uuidV4(result.installationId) ||
    !uuidV4(result.householdId) ||
    !uuidV4(result.datasetEpoch) ||
    !positiveRevision(result.bindingRevision) ||
    !positiveRevision(result.sessionGeneration) ||
    !timestamp(result[timeKey]) ||
    !uuidV4(result.correlationId)
  ) throw new Error('parent_installation_port_contract')
  return result
}

function validateRevocation(value) {
  const result = exactObject(value, [
    'schemaVersion', 'status', 'bindingId', 'installationId', 'householdId',
    'datasetEpoch', 'bindingRevision', 'sessionGeneration', 'revokedAt',
    'correlationId',
  ])
  if (
    result.schemaVersion !== 1 ||
    result.status !== 'revoked' ||
    !uuidV4(result.bindingId) ||
    !uuidV4(result.installationId) ||
    !uuidV4(result.householdId) ||
    !uuidV4(result.datasetEpoch) ||
    !positiveRevision(result.bindingRevision) ||
    !positiveRevision(result.sessionGeneration) ||
    !timestamp(result.revokedAt) ||
    !uuidV4(result.correlationId)
  ) throw new Error('parent_installation_port_contract')
  return result
}

export function createParentInstallationPort(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 3_000
  const configured = config(env)

  async function call(name, parameters, accessToken) {
    if (
      !configured ||
      typeof fetchImpl !== 'function' ||
      typeof accessToken !== 'string' ||
      accessToken.length < 1
    ) throw new Error('parent_installation_port_not_ready')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(
        `${configured.url}/rest/v1/rpc/${name}`,
        {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            apikey: configured.anonKey,
            Authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(parameters),
        },
      )
      if ([400, 401, 403, 404, 409].includes(response.status)) {
        throw new Error('parent_installation_denied')
      }
      if (!response.ok) throw new Error('parent_installation_unavailable')
      return await response.json()
    } catch (error) {
      if (
        error instanceof Error &&
        ['parent_installation_denied', 'parent_installation_unavailable'].includes(
          error.message,
        )
      ) throw error
      throw new Error('parent_installation_unavailable')
    } finally {
      clearTimeout(timer)
    }
  }

  return Object.freeze({
    isDurable: true,
    isReady: () => configured !== null && typeof fetchImpl === 'function',
    async status({ accessToken, householdId, installationId }) {
      return validateStatus(await call(
        'academy_parent_installation_status_v1',
        {
          p_household_id: householdId,
          p_installation_id: installationId,
        },
        accessToken,
      ))
    },
    async issue({
      accessToken,
      householdId,
      installationId,
      datasetEpoch,
      purpose,
      tokenDigest,
      correlationId,
    }) {
      if (!TOKEN_DIGEST.test(tokenDigest)) {
        throw new TypeError('invalid_parent_installation_token_digest')
      }
      return validateIssuedGrant(await call(
        'academy_parent_issue_installation_grant_v1',
        {
          p_household_id: householdId,
          p_installation_id: installationId,
          p_dataset_epoch: datasetEpoch,
          p_purpose: purpose,
          p_token_digest: tokenDigest,
          p_correlation_id: correlationId,
        },
        accessToken,
      ))
    },
    async claim({
      accessToken,
      installationId,
      datasetEpoch,
      purpose,
      tokenDigest,
      correlationId,
    }) {
      if (!TOKEN_DIGEST.test(tokenDigest)) {
        throw new TypeError('invalid_parent_installation_token_digest')
      }
      return validateBinding(await call(
        'academy_parent_claim_installation_v1',
        {
          p_installation_id: installationId,
          p_dataset_epoch: datasetEpoch,
          p_purpose: purpose,
          p_token_digest: tokenDigest,
          p_correlation_id: correlationId,
        },
        accessToken,
      ), 'claim')
    },
    async recover({
      accessToken,
      installationId,
      datasetEpoch,
      tokenDigest,
      localCredentialEnrollmentId,
      correlationId,
    }) {
      if (!TOKEN_DIGEST.test(tokenDigest)) {
        throw new TypeError('invalid_parent_installation_token_digest')
      }
      return validateBinding(await call(
        'academy_parent_recover_installation_v1',
        {
          p_installation_id: installationId,
          p_dataset_epoch: datasetEpoch,
          p_token_digest: tokenDigest,
          p_local_credential_enrollment_id: localCredentialEnrollmentId,
          p_correlation_id: correlationId,
        },
        accessToken,
      ), 'recover')
    },
    async revoke({
      accessToken,
      householdId,
      installationId,
      datasetEpoch,
      correlationId,
    }) {
      return validateRevocation(await call(
        'academy_parent_revoke_installation_v1',
        {
          p_household_id: householdId,
          p_installation_id: installationId,
          p_dataset_epoch: datasetEpoch,
          p_correlation_id: correlationId,
        },
        accessToken,
      ))
    },
  })
}
