import {
  FAMILY_CLOUD_AUTH_SCHEMA_VERSION,
  type LinkedFamilyDevice,
  type LinkedFamilyDeviceStore,
} from './types'

export const LINKED_FAMILY_DEVICE_KEY = 'manuel-academy.family-cloud-auth.link.v1' as const

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/

function browserStorage(): StorageLike | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

function parse(value: unknown): LinkedFamilyDevice | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const link = value as Record<string, unknown>
  if (
    Object.keys(link).length !== 4 ||
    link.schemaVersion !== FAMILY_CLOUD_AUTH_SCHEMA_VERSION ||
    typeof link.accountRef !== 'string' || !REF.test(link.accountRef) ||
    typeof link.householdRef !== 'string' || !REF.test(link.householdRef) ||
    typeof link.linkedAt !== 'string' || !Number.isFinite(Date.parse(link.linkedAt))
  ) return null
  return Object.freeze({
    schemaVersion: FAMILY_CLOUD_AUTH_SCHEMA_VERSION,
    accountRef: link.accountRef,
    householdRef: link.householdRef,
    linkedAt: link.linkedAt,
  })
}

export function createLinkedFamilyDeviceStore(
  storage: StorageLike | null = browserStorage(),
): LinkedFamilyDeviceStore {
  return Object.freeze({
    load(): LinkedFamilyDevice | null {
      if (!storage) return null
      try {
        const raw = storage.getItem(LINKED_FAMILY_DEVICE_KEY)
        return raw === null ? null : parse(JSON.parse(raw))
      } catch { return null }
    },
    save(link: LinkedFamilyDevice): boolean {
      if (!storage) return false
      const safe = parse(link)
      if (!safe) return false
      const serialized = JSON.stringify(safe)
      try {
        storage.setItem(LINKED_FAMILY_DEVICE_KEY, serialized)
        return storage.getItem(LINKED_FAMILY_DEVICE_KEY) === serialized
      } catch { return false }
    },
    clear(): void {
      try { storage?.removeItem(LINKED_FAMILY_DEVICE_KEY) } catch { /* signed out in memory regardless */ }
    },
  })
}
