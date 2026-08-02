export const DELIVERY_ROUTES = ['in-app', 'email', 'sms'] as const
export type DeliveryRoute = (typeof DELIVERY_ROUTES)[number]

export interface StableRecipientReferenceV2 {
  readonly schemaVersion: 2
  readonly recipientRef: string
  readonly permissionRef: string
  readonly permissionRevision: number
  readonly recipientVersion: 2
  readonly effectiveAt: string
  readonly route: DeliveryRoute
  readonly routeRef: string
  readonly routeRevision: number
}

const identifier = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const opaqueRecipient = /^recipient:[0-9a-f]{64}$/

export function isStableRecipientReferenceV2(value: unknown): value is StableRecipientReferenceV2 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const expected = [
    'effectiveAt', 'permissionRef', 'permissionRevision', 'recipientRef',
    'recipientVersion', 'route', 'routeRef', 'routeRevision', 'schemaVersion',
  ].sort()
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return false
  return record.schemaVersion === 2
    && record.recipientVersion === 2
    && typeof record.recipientRef === 'string' && opaqueRecipient.test(record.recipientRef)
    && typeof record.permissionRef === 'string' && /^permission:[0-9a-f]{64}$/.test(record.permissionRef)
    && Number.isSafeInteger(record.permissionRevision) && Number(record.permissionRevision) > 0
    && typeof record.effectiveAt === 'string' && Number.isFinite(Date.parse(record.effectiveAt))
    && DELIVERY_ROUTES.includes(record.route as DeliveryRoute)
    && typeof record.routeRef === 'string' && identifier.test(record.routeRef)
    && Number.isSafeInteger(record.routeRevision) && Number(record.routeRevision) > 0
}
