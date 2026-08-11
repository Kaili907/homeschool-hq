export type ExactRecordShape = Readonly<{
  required: readonly string[]
  optional?: readonly string[]
}>

export type ExactRecordSnapshot = Readonly<Record<string, unknown>>

/**
 * Copies one admitted plain record without invoking caller-controlled property access.
 * Every caller property is discovered and read exactly once through its descriptor.
 */
export function snapshotExactRecord(
  value: unknown,
  shapes: readonly ExactRecordShape[],
): ExactRecordSnapshot | null {
  if (value === null || typeof value !== 'object') return null

  try {
    const keys = Reflect.ownKeys(value)
    const prototype = Reflect.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return null
    if (keys.some((key) => typeof key !== 'string')) return null

    const stringKeys = keys as string[]
    const admitted = shapes.some(({ required, optional = [] }) =>
      required.every((key) => stringKeys.includes(key)) &&
      stringKeys.every((key) => required.includes(key) || optional.includes(key)))
    if (!admitted) return null

    const snapshot = Object.create(null) as Record<string, unknown>
    for (const key of stringKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return null
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        writable: false,
        configurable: false,
      })
    }
    return Object.freeze(snapshot)
  } catch {
    return null
  }
}
