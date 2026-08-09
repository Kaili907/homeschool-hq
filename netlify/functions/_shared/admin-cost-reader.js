import { reject } from './http.js'

/**
 * ADMIN-1 supplies the verified assignment/capability check at integration.
 * This seam never accepts a browser role claim and never grants table access.
 */
export function createAdminCostReader({ requireCapability, gatewayAccess }) {
  if (typeof requireCapability !== 'function' || !gatewayAccess) {
    throw new TypeError('admin cost reader requires authorization and service access')
  }

  return {
    async list({ limit = 100, before = new Date().toISOString() } = {}) {
      const authorized = await requireCapability('costs:read')
      if (authorized !== true) reject(403, 'admin_forbidden')
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
        reject(400, 'invalid_request')
      }
      if (
        typeof before !== 'string' ||
        before.length > 40 ||
        Number.isNaN(Date.parse(before))
      ) {
        reject(400, 'invalid_request')
      }
      return gatewayAccess.readProviderUsageCosts({ limit, before })
    },
  }
}
