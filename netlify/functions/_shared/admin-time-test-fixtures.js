function instantMillis(instant) {
  const value = instant instanceof Date ? instant.valueOf() : Date.parse(instant)
  if (!Number.isFinite(value)) throw new TypeError('invalid fixed clock instant')
  return value
}

/** Returns a fresh Date on every read so a test cannot mutate the shared clock. */
export function fixedDateClock(instant) {
  const value = instantMillis(instant)
  return () => new Date(value)
}

/** ISO clock for handlers whose production clock seam is serialized. */
export function fixedIsoClock(instant) {
  const value = instantMillis(instant)
  return () => new Date(value).toISOString()
}
