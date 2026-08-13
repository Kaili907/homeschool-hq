import type { ComputeSpec, RubricCriterion } from '../types.ts'

/** Dollars in, whole cents out. Throws rather than silently absorbing a float. */
export function m(dollars: number): ComputeSpec {
  const cents = Math.round(dollars * 100)
  if (Math.abs(dollars * 100 - cents) > 1e-6) throw new Error(`amount ${dollars} is not a whole number of cents`)
  return { op: 'money', cents }
}
export const cnt = (n: number): ComputeSpec => ({ op: 'count', n })
export const sum = (...of: ComputeSpec[]): ComputeSpec => ({ op: 'sum', of })
export const diff = (from: ComputeSpec, less: ComputeSpec): ComputeSpec => ({ op: 'diff', from, less })
export const scale = (of: ComputeSpec, times: number): ComputeSpec => ({ op: 'scale', of, times })
export const pct = (of: ComputeSpec, bps: number, round: 'exact' | 'half-up' = 'exact'): ComputeSpec => ({ op: 'percent', of, bps, round })
export const div = (of: ComputeSpec, by: number, round: 'exact' | 'half-up' = 'exact'): ComputeSpec => ({ op: 'divide', of, by, round })
export const grow = (principal: ComputeSpec, bps: number, periods: number): ComputeSpec => ({ op: 'compound', principal, bps, periods })
export const least = (...of: ComputeSpec[]): ComputeSpec => ({ op: 'min', of })
export const most = (...of: ComputeSpec[]): ComputeSpec => ({ op: 'max', of })
export const reach = (target: ComputeSpec, perPeriod: ComputeSpec): ComputeSpec => ({ op: 'periodsToReach', target, perPeriod })
export const sel = (
  left: ComputeSpec,
  right: ComputeSpec,
  whenLess: string,
  whenEqual: string,
  whenGreater: string,
): ComputeSpec => ({ op: 'select', left, right, whenLess, whenEqual, whenGreater })

/** Builds one rubric dimension from three authored, lesson-specific descriptors. */
export function crit(dimension: string, notYet: string, approaching: string, meets: string): RubricCriterion {
  return {
    dimension,
    levels: [
      { label: 'Not yet', descriptor: notYet },
      { label: 'Approaching', descriptor: approaching },
      { label: 'Meets', descriptor: meets },
    ],
  }
}
