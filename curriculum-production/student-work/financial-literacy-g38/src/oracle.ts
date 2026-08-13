import type { ComputeSpec, ComputedValue, OracleResult } from './types.ts'

export const ORACLE_ID = 'finlit-g38-oracle@1'

export class OracleError extends Error {}

function money(cents: number): ComputedValue {
  if (!Number.isInteger(cents)) throw new OracleError(`money value ${cents} is not whole cents`)
  return { kind: 'money', cents }
}

function asMoney(v: ComputedValue, op: string): number {
  if (v.kind !== 'money') throw new OracleError(`${op} requires a money operand, got ${v.kind}`)
  return v.cents
}

function asNumeric(v: ComputedValue, op: string): number {
  if (v.kind === 'money') return v.cents
  if (v.kind === 'count') return v.n
  throw new OracleError(`${op} requires a numeric operand, got a label`)
}

/** Half-up on the magnitude, so -0.005 rounds to -0.01 the same way +0.005 rounds to +0.01. */
function roundHalfUp(numerator: number, denominator: number): number {
  const sign = Math.sign(numerator) * Math.sign(denominator) || 1
  const q = Math.abs(numerator) / Math.abs(denominator)
  return sign * Math.floor(q + 0.5)
}

function divideBy(numerator: number, denominator: number, round: 'exact' | 'half-up', label: string): number {
  if (denominator === 0) throw new OracleError(`${label}: division by zero`)
  if (round === 'exact') {
    if (numerator % denominator !== 0) {
      throw new OracleError(`${label}: ${numerator} / ${denominator} is not exact but rounding is declared 'exact'`)
    }
    return numerator / denominator
  }
  return roundHalfUp(numerator, denominator)
}

/** Evaluates a spec to a value. Throws (never guesses) on any ill-formed input. */
export function evaluate(spec: ComputeSpec): ComputedValue {
  switch (spec.op) {
    case 'money':
      return money(spec.cents)
    case 'count':
      if (!Number.isInteger(spec.n)) throw new OracleError(`count ${spec.n} is not a whole number`)
      return { kind: 'count', n: spec.n }
    case 'sum': {
      if (spec.of.length < 2) throw new OracleError('sum needs at least two operands')
      const parts = spec.of.map(evaluate)
      if (parts.every((p) => p.kind === 'money')) return money(parts.reduce((a, p) => a + asMoney(p, 'sum'), 0))
      if (parts.every((p) => p.kind === 'count')) return { kind: 'count', n: parts.reduce((a, p) => a + asNumeric(p, 'sum'), 0) }
      throw new OracleError('sum operands must all be money or all be counts')
    }
    case 'diff': {
      const from = evaluate(spec.from)
      const less = evaluate(spec.less)
      if (from.kind !== less.kind) throw new OracleError('diff operands must have the same kind')
      const d = asNumeric(from, 'diff') - asNumeric(less, 'diff')
      return from.kind === 'money' ? money(d) : { kind: 'count', n: d }
    }
    case 'scale': {
      if (!Number.isInteger(spec.times)) throw new OracleError(`scale times ${spec.times} is not a whole number`)
      const of = evaluate(spec.of)
      const p = asNumeric(of, 'scale') * spec.times
      return of.kind === 'money' ? money(p) : { kind: 'count', n: p }
    }
    case 'percent': {
      const base = asMoney(evaluate(spec.of), 'percent')
      if (!Number.isInteger(spec.bps)) throw new OracleError(`percent bps ${spec.bps} is not a whole number`)
      return money(divideBy(base * spec.bps, 10000, spec.round, 'percent'))
    }
    case 'divide': {
      const of = evaluate(spec.of)
      if (!Number.isInteger(spec.by)) throw new OracleError(`divide by ${spec.by} is not a whole number`)
      const q = divideBy(asNumeric(of, 'divide'), spec.by, spec.round, 'divide')
      return of.kind === 'money' ? money(q) : { kind: 'count', n: q }
    }
    case 'compound': {
      if (!Number.isInteger(spec.periods) || spec.periods < 1) throw new OracleError('compound periods must be a positive whole number')
      let cents = asMoney(evaluate(spec.principal), 'compound')
      for (let i = 0; i < spec.periods; i += 1) {
        cents += roundHalfUp(cents * spec.bps, 10000)
      }
      return money(cents)
    }
    case 'min':
    case 'max': {
      if (spec.of.length < 2) throw new OracleError(`${spec.op} needs at least two operands`)
      const parts = spec.of.map(evaluate)
      const kind = parts[0].kind
      if (parts.some((p) => p.kind !== kind)) throw new OracleError(`${spec.op} operands must have the same kind`)
      const nums = parts.map((p) => asNumeric(p, spec.op))
      const picked = spec.op === 'min' ? Math.min(...nums) : Math.max(...nums)
      return kind === 'money' ? money(picked) : { kind: 'count', n: picked }
    }
    case 'periodsToReach': {
      const target = asMoney(evaluate(spec.target), 'periodsToReach')
      const per = asMoney(evaluate(spec.perPeriod), 'periodsToReach')
      if (per <= 0) throw new OracleError('periodsToReach needs a positive per-period amount')
      return { kind: 'count', n: Math.ceil(target / per) }
    }
    case 'select': {
      const left = asNumeric(evaluate(spec.left), 'select')
      const right = asNumeric(evaluate(spec.right), 'select')
      if (left < right) return { kind: 'label', label: spec.whenLess }
      if (left > right) return { kind: 'label', label: spec.whenGreater }
      return { kind: 'label', label: spec.whenEqual }
    }
    default: {
      const exhaustive: never = spec
      throw new OracleError(`unknown op: ${JSON.stringify(exhaustive)}`)
    }
  }
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}$${grouped}.${rest}`
}

export function format(value: ComputedValue): string {
  switch (value.kind) {
    case 'money':
      return formatMoney(value.cents)
    case 'count':
      return String(value.n)
    case 'label':
      return value.label
  }
}

/** Bare decimal form used inside traces, e.g. "4.50" — no currency symbol. */
function plain(value: ComputedValue): string {
  return value.kind === 'money' ? formatMoney(value.cents).replace('$', '') : format(value)
}

/** Renders the arithmetic itself, so an adult can check the step by hand. */
function expr(spec: ComputeSpec): string {
  switch (spec.op) {
    case 'money':
      return plain(evaluate(spec))
    case 'count':
      return String(spec.n)
    case 'sum':
      return `(${spec.of.map(expr).join(' + ')})`
    case 'diff':
      return `(${expr(spec.from)} - ${expr(spec.less)})`
    case 'scale':
      return `(${expr(spec.of)} x ${spec.times})`
    case 'percent':
      return `(${spec.bps / 100}% of ${expr(spec.of)})`
    case 'divide':
      return `(${expr(spec.of)} / ${spec.by})`
    case 'compound':
      return `(${expr(spec.principal)} grown at ${spec.bps / 100}% per period for ${spec.periods} period${spec.periods === 1 ? '' : 's'}, rounded to the cent each period)`
    case 'min':
      return `smaller of (${spec.of.map(expr).join(', ')})`
    case 'max':
      return `larger of (${spec.of.map(expr).join(', ')})`
    case 'periodsToReach':
      return `whole periods to reach ${expr(spec.target)} at ${expr(spec.perPeriod)} per period`
    case 'select':
      return `compare ${expr(spec.left)} with ${expr(spec.right)}`
  }
}

export function run(spec: ComputeSpec): OracleResult {
  const value = evaluate(spec)
  return { value, formatted: format(value), trace: `${expr(spec)} = ${plain(value)}` }
}

/**
 * The fail-closed check. `expected` is the hand-authored answer literal;
 * `spec` is evaluated independently of it. Any disagreement throws, and the
 * build refuses to emit the lesson.
 */
export function verify(expected: string, spec: ComputeSpec, where: string): OracleResult {
  let result: OracleResult
  try {
    result = run(spec)
  } catch (err) {
    throw new OracleError(`${where}: oracle could not evaluate the computation: ${(err as Error).message}`)
  }
  if (result.formatted !== expected) {
    throw new OracleError(
      `${where}: ORACLE DISAGREEMENT — authored answer "${expected}" but independent recomputation gives "${result.formatted}" (${result.trace})`,
    )
  }
  return result
}
