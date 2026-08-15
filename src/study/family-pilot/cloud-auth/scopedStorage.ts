type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const HOUSEHOLD_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/

/**
 * Presents an isolated Storage view to the existing Family Pilot stores.
 * Household refs are encoded, not used as raw key text, and no enumeration is exposed.
 */
export function createHouseholdScopedStorage(
  storage: StorageLike,
  householdRef: string,
): StorageLike {
  if (!HOUSEHOLD_REF.test(householdRef)) throw new Error('Invalid household storage scope.')
  const scope = encodeURIComponent(householdRef)
  const key = (applicationKey: string) => `manuel-academy.household.${scope}:${applicationKey}`
  return Object.freeze({
    getItem: (applicationKey: string) => storage.getItem(key(applicationKey)),
    setItem: (applicationKey: string, value: string) => storage.setItem(key(applicationKey), value),
    removeItem: (applicationKey: string) => storage.removeItem(key(applicationKey)),
  })
}

/** Fails closed when browser storage is unavailable; it never falls back to an unscoped key. */
export function createBrowserHouseholdScopedStorage(householdRef: string): StorageLike {
  let storage: StorageLike
  try {
    if (typeof window === 'undefined') throw new Error('Browser storage unavailable.')
    storage = window.localStorage
  } catch {
    return Object.freeze({
      getItem: () => { throw new Error('Browser storage unavailable.') },
      setItem: () => { throw new Error('Browser storage unavailable.') },
      removeItem: () => { throw new Error('Browser storage unavailable.') },
    })
  }
  return createHouseholdScopedStorage(storage, householdRef)
}

