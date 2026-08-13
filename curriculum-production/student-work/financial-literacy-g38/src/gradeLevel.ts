import type { ComputeSpec, Grade } from './types.ts'
import { evaluate } from './oracle.ts'

export type Op = ComputeSpec['op']

export interface GradeArithmeticProfile {
  readonly maxAbsCents: number
  readonly allowedOps: readonly Op[]
  readonly maxScaleTimes: number
  readonly maxDivideBy: number
  /** Percent rates must be whole multiples of this many basis points. */
  readonly percentBpsGranularity: number
  readonly maxPercentBps: number
  readonly maxCompoundPeriods: number
  readonly allowNegativeMoney: boolean
}

const BASE_OPS: readonly Op[] = ['money', 'count', 'sum', 'diff', 'scale', 'min', 'max', 'select']

/**
 * Developmental ceilings on the arithmetic each grade's tasks may demand.
 * These are asserted against every committed computation, so a grade-3 sheet
 * cannot silently acquire compound interest or four-figure amounts.
 */
export const GRADE_PROFILES: Readonly<Record<Grade, GradeArithmeticProfile>> = {
  3: {
    // Whole-dollar and simple-cent addition/subtraction within $20.
    maxAbsCents: 2000,
    allowedOps: BASE_OPS,
    maxScaleTimes: 5,
    maxDivideBy: 0,
    percentBpsGranularity: 0,
    maxPercentBps: 0,
    maxCompoundPeriods: 0,
    allowNegativeMoney: false,
  },
  4: {
    // Adds exact division (unit price, equal shares) and whole-percent tax.
    maxAbsCents: 10000,
    allowedOps: [...BASE_OPS, 'divide', 'percent', 'periodsToReach'],
    maxScaleTimes: 12,
    maxDivideBy: 12,
    percentBpsGranularity: 100,
    maxPercentBps: 1000,
    maxCompoundPeriods: 0,
    allowNegativeMoney: false,
  },
  5: {
    maxAbsCents: 50000,
    allowedOps: [...BASE_OPS, 'divide', 'percent', 'periodsToReach'],
    maxScaleTimes: 24,
    maxDivideBy: 24,
    percentBpsGranularity: 50,
    maxPercentBps: 2500,
    maxCompoundPeriods: 0,
    allowNegativeMoney: false,
  },
  7: {
    // Multi-step percent work plus a short compound-growth horizon.
    maxAbsCents: 1000000,
    allowedOps: [...BASE_OPS, 'divide', 'percent', 'periodsToReach', 'compound'],
    maxScaleTimes: 60,
    maxDivideBy: 60,
    percentBpsGranularity: 25,
    maxPercentBps: 5000,
    maxCompoundPeriods: 5,
    allowNegativeMoney: true,
  },
  8: {
    maxAbsCents: 50000000,
    allowedOps: [...BASE_OPS, 'divide', 'percent', 'periodsToReach', 'compound'],
    maxScaleTimes: 480,
    maxDivideBy: 480,
    percentBpsGranularity: 1,
    maxPercentBps: 40000,
    maxCompoundPeriods: 45,
    allowNegativeMoney: true,
  },
}

function walk(spec: ComputeSpec, visit: (node: ComputeSpec) => void): void {
  visit(spec)
  switch (spec.op) {
    case 'sum':
    case 'min':
    case 'max':
      spec.of.forEach((child) => walk(child, visit))
      break
    case 'diff':
      walk(spec.from, visit)
      walk(spec.less, visit)
      break
    case 'scale':
    case 'percent':
    case 'divide':
      walk(spec.of, visit)
      break
    case 'compound':
      walk(spec.principal, visit)
      break
    case 'periodsToReach':
      walk(spec.target, visit)
      walk(spec.perPeriod, visit)
      break
    case 'select':
      walk(spec.left, visit)
      walk(spec.right, visit)
      break
    default:
      break
  }
}

/** Returns one message per grade-level violation found in a committed spec. */
export function checkGradeArithmetic(grade: Grade, spec: ComputeSpec, where: string): string[] {
  const profile = GRADE_PROFILES[grade]
  const issues: string[] = []
  walk(spec, (node) => {
    if (!profile.allowedOps.includes(node.op)) {
      issues.push(`${where}: op "${node.op}" is above grade ${grade}`)
      return
    }
    if (node.op === 'scale' && Math.abs(node.times) > profile.maxScaleTimes) {
      issues.push(`${where}: multiplier ${node.times} exceeds the grade-${grade} ceiling of ${profile.maxScaleTimes}`)
    }
    if (node.op === 'divide' && Math.abs(node.by) > profile.maxDivideBy) {
      issues.push(`${where}: divisor ${node.by} exceeds the grade-${grade} ceiling of ${profile.maxDivideBy}`)
    }
    if (node.op === 'percent') {
      if (profile.percentBpsGranularity === 0 || node.bps % profile.percentBpsGranularity !== 0) {
        issues.push(`${where}: rate ${node.bps / 100}% is finer than grade ${grade} works in`)
      }
      if (node.bps > profile.maxPercentBps) {
        issues.push(`${where}: rate ${node.bps / 100}% exceeds the grade-${grade} ceiling of ${profile.maxPercentBps / 100}%`)
      }
    }
    if (node.op === 'compound' && node.periods > profile.maxCompoundPeriods) {
      issues.push(`${where}: ${node.periods} compounding periods exceeds the grade-${grade} ceiling of ${profile.maxCompoundPeriods}`)
    }
    // Every intermediate value, not only the final answer, must stay in range.
    let value
    try {
      value = evaluate(node)
    } catch {
      return
    }
    if (value.kind === 'money') {
      if (Math.abs(value.cents) > profile.maxAbsCents) {
        issues.push(`${where}: amount ${(value.cents / 100).toFixed(2)} exceeds the grade-${grade} ceiling of ${(profile.maxAbsCents / 100).toFixed(2)}`)
      }
      if (value.cents < 0 && !profile.allowNegativeMoney) {
        issues.push(`${where}: negative amount ${(value.cents / 100).toFixed(2)} is not used at grade ${grade}`)
      }
    }
  })
  return issues
}
