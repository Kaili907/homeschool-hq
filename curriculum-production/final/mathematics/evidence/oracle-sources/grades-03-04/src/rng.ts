/**
 * Deterministic RNG for corpus generation.
 *
 * The existing curriculum generators draw from the shared module RNG in
 * src/genUtils, which already supports injection via setRng. Seeding it per
 * lesson makes the whole corpus reproducible: regenerating from the same
 * lesson index and corpus version yields byte-identical output, which is what
 * lets the answer key be treated as authoritative rather than incidental.
 */

/** FNV-1a over the seed string, so seeds are stable across runs and platforms. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** mulberry32: small, fast, and adequate for item-parameter selection. */
export function createRng(seed: string): () => number {
  let state = hashSeed(seed)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randomInt = (rng: () => number, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min

export const choose = <T,>(rng: () => number, values: readonly T[]): T =>
  values[Math.floor(rng() * values.length)]

export function shuffleWith<T>(rng: () => number, values: readonly T[]): T[] {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}
