/**
 * Exact rational arithmetic over BigInt.
 *
 * Money answers are checked to the cent. Binary floating point cannot hold
 * 0.1, and a corpus of several thousand currency answers verified in `number`
 * would eventually disagree with a correctly authored key for reasons that
 * have nothing to do with the finance. Every oracle computation runs here.
 */
export interface Rat {
  readonly n: bigint
  readonly d: bigint
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

export function rat(n: bigint, d: bigint): Rat {
  if (d === 0n) throw new Error('division by zero')
  let nn = n
  let dd = d
  if (dd < 0n) {
    nn = -nn
    dd = -dd
  }
  const g = gcd(nn, dd) || 1n
  return { n: nn / g, d: dd / g }
}

/** Parses a decimal literal exactly (no float round-trip). */
export function fromDecimalString(s: string): Rat {
  const m = /^-?\d+(\.\d+)?$/.exec(s)
  if (!m) throw new Error(`not a decimal literal: ${s}`)
  const neg = s.startsWith('-')
  const body = neg ? s.slice(1) : s
  const [ip, fp = ''] = body.split('.')
  const scaled = BigInt(ip + fp)
  const den = 10n ** BigInt(fp.length)
  return rat(neg ? -scaled : scaled, den)
}

/**
 * Parameter values are authored as JS numbers for readability. They are
 * converted through their shortest exact decimal representation, and any
 * value that cannot be written exactly in 10 decimal places is rejected
 * rather than silently approximated.
 */
export function fromNumber(x: number): Rat {
  if (!Number.isFinite(x)) throw new Error(`non-finite parameter: ${x}`)
  const s = String(x)
  if (/e/i.test(s)) throw new Error(`parameter must be written in plain decimal, got ${s}`)
  const dp = s.includes('.') ? s.split('.')[1].length : 0
  if (dp > 10) throw new Error(`parameter ${s} exceeds 10 decimal places`)
  return fromDecimalString(s)
}

export const add = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d)
export const sub = (a: Rat, b: Rat): Rat => rat(a.n * b.d - b.n * a.d, a.d * b.d)
export const mul = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d)
export const div = (a: Rat, b: Rat): Rat => {
  if (b.n === 0n) throw new Error('division by zero')
  return rat(a.n * b.d, a.d * b.n)
}
export const neg = (a: Rat): Rat => rat(-a.n, a.d)
export const abs = (a: Rat): Rat => rat(a.n < 0n ? -a.n : a.n, a.d)
export const cmp = (a: Rat, b: Rat): number => {
  const l = a.n * b.d
  const r = b.n * a.d
  return l < r ? -1 : l > r ? 1 : 0
}

export function pow(a: Rat, k: number): Rat {
  if (!Number.isInteger(k) || k < 0) throw new Error(`pow exponent must be a non-negative integer, got ${k}`)
  let acc = rat(1n, 1n)
  for (let i = 0; i < k; i += 1) acc = mul(acc, a)
  return acc
}

/** Half away from zero, the convention used for currency on a statement. */
export function roundTo(a: Rat, dp: number): Rat {
  const scale = 10n ** BigInt(dp)
  const num = a.n * scale
  const den = a.d
  const q = num / den
  const r = num % den
  const twice = (r < 0n ? -r : r) * 2n
  let out = q
  if (twice >= den) out = q + (a.n < 0n ? -1n : 1n)
  return rat(out, scale)
}

/** Exact fixed-point rendering. Throws if the value is not exact at `dp`. */
export function toFixed(a: Rat, dp: number): string {
  const r = roundTo(a, dp)
  if (cmp(r, a) !== 0) throw new Error('toFixed called on a value that is not exact at that precision')
  const scale = 10n ** BigInt(dp)
  const scaled = (r.n * scale) / r.d
  const negSign = scaled < 0n
  const mag = negSign ? -scaled : scaled
  const s = mag.toString().padStart(dp + 1, '0')
  const ip = s.slice(0, s.length - dp) || '0'
  const fp = dp > 0 ? `.${s.slice(s.length - dp)}` : ''
  return `${negSign ? '-' : ''}${ip}${fp}`
}

export function withThousands(intPart: string): string {
  const negSign = intPart.startsWith('-')
  const body = negSign ? intPart.slice(1) : intPart
  const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negSign ? '-' : ''}${grouped}`
}
