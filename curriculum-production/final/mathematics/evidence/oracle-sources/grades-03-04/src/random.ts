let rng: () => number = Math.random

/** Shared injectable RNG for deterministic corpus generation. */
export function setRng(next: (() => number) | null): void {
  rng = next ?? Math.random
}

export const ri = (min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min

export const pick = <T,>(values: readonly T[]): T =>
  values[Math.floor(rng() * values.length)]

export function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}
