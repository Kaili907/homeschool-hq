// Answer normalizer + scorer for the math diagnostic and objective grammar items.
//
// Design rule from the addendum: "Anything it can't confidently match is queued
// for human grading, NOT marked wrong." So the scorer returns 'unmatched' (→ human
// queue) whenever it cannot be sure — it only returns 'incorrect' for a clean,
// confidently-different objective answer (a parsed number that differs, or a wrong
// multiple-choice option).

import type { Item, ScoreVerdict } from './types'

export interface Rational {
  num: number
  den: number
  pi: boolean
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

function makeRational(num: number, den: number, pi: boolean): Rational {
  if (den === 0) return { num: NaN, den: 1, pi }
  if (den < 0) {
    num = -num
    den = -den
  }
  const g = gcd(num, den) || 1
  return { num: num / g, den: den / g, pi }
}

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4',
  '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
}

/** Normalize a raw answer to a comparable lowercase string (symbols unified, spaces removed). */
export function normalizeText(raw: string): string {
  let s = raw.toLowerCase()
  for (const [sup, rep] of Object.entries(SUPERSCRIPTS)) s = s.split(sup).join(rep)
  return s
    .replace(/[−–—]/g, '-') // unicode minus / en / em dash → hyphen
    .replace(/[×]/g, '*') // ×
    .replace(/[÷]/g, '/') // ÷
    .replace(/≤/g, '<=') // ≤
    .replace(/≥/g, '>=') // ≥
    .replace(/π/g, 'pi') // π
    .replace(/\bdegrees?\b/g, '')
    .replace(/°/g, '') // degree sign
    .replace(/\^\{(\d+)\}/g, '^$1') // x^{2} → x^2
    .replace(/\s+/g, '')
}

/**
 * Parse a raw answer as a rational number, possibly a multiple of π.
 * Handles: integers, negatives, decimals, improper fractions "a/b",
 * mixed numbers "a b/c", percents "75%", money "$20", angles "56°",
 * and pi forms "10π" / "10pi" / "π".
 * Returns null when the value is not a confident single number.
 */
export function parseRational(raw: string): Rational | null {
  let s = raw
    .toLowerCase()
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/×/g, '*')
    .replace(/[$,]/g, '')
    .replace(/°/g, '')
    .replace(/\bdegrees?\b/g, '')
    .replace(/\bdeg\b/g, '')
    .replace(/%/g, '')
    .replace(/\bpercent\b/g, '')
    .replace(/\b(units?|cubic|square)\b/g, '')
    .trim()

  if (s === '') return null

  // pi detection
  let pi = false
  if (/π|pi/.test(s)) {
    pi = true
    s = s.replace(/π/g, '').replace(/pi/g, '').trim()
    s = s.replace(/\*$/, '').trim() // trailing "10*" from "10*pi"
    if (s === '' || s === '+') s = '1'
    if (s === '-') s = '-1'
  }

  s = s.replace(/\s+/g, ' ').trim()

  // mixed number: "a b/c"
  const mixed = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) {
    const whole = parseInt(mixed[1], 10)
    const n = parseInt(mixed[2], 10)
    const d = parseInt(mixed[3], 10)
    const sign = whole < 0 ? -1 : 1
    return makeRational(sign * (Math.abs(whole) * d + n), d, pi)
  }

  // improper fraction "a/b"
  const frac = s.match(/^(-?\d+)\/(-?\d+)$/)
  if (frac) return makeRational(parseInt(frac[1], 10), parseInt(frac[2], 10), pi)

  // decimal or integer
  const dec = s.match(/^-?\d*\.?\d+$/)
  if (dec) {
    const f = parseFloat(s)
    if (Number.isNaN(f)) return null
    if (Number.isInteger(f)) return makeRational(f, 1, pi)
    const places = (s.split('.')[1] || '').length
    const denom = 10 ** places
    return makeRational(Math.round(f * denom), denom, pi)
  }

  // bare pi (coefficient 1) already handled by s==='1'
  if (pi && /^-?\d+$/.test(s)) return makeRational(parseInt(s, 10), 1, pi)

  return null
}

export function rationalsEqual(a: Rational, b: Rational): boolean {
  if (Number.isNaN(a.num) || Number.isNaN(b.num)) return false
  return a.pi === b.pi && a.num === b.num && a.den === b.den
}

/** Tokenize a student answer for array-key comparison (split on comma / "or" / whitespace). */
function tokenize(raw: string): string[] {
  return raw
    .replace(/[−–—]/g, '-')
    .split(/\s*,\s*|\s+or\s+|\s+and\s+|;/i)
    .map((t) => t.trim())
    .filter((t) => t !== '')
}

function matchOne(studentToken: string, keyToken: string): boolean {
  const sr = parseRational(studentToken)
  const kr = parseRational(keyToken)
  if (sr && kr) return rationalsEqual(sr, kr)
  if (!sr && !kr) return normalizeText(studentToken) === normalizeText(keyToken)
  return false
}

/**
 * Score one item's answer. Returns a verdict; only returns 'incorrect' when the
 * scorer is confident (clean numeric mismatch or wrong choice). Ambiguous cases
 * (unparseable answers to keyed numeric items, non-exact equations) → 'unmatched'.
 */
export function scoreItem(item: Item, value: string, skipped: boolean): ScoreVerdict {
  if (skipped) return 'skip'
  if (item.key === undefined) return 'ungraded'

  const answer = value.trim()
  if (answer === '') return 'unmatched'

  // multiple choice: exact option match, confident either way
  if (item.kind === 'choice') {
    const key = item.key as string
    return normalizeText(answer) === normalizeText(key) ? 'correct' : 'incorrect'
  }

  // array key: every listed value must be present among the student's tokens
  if (Array.isArray(item.key)) {
    const tokens = tokenize(answer)
    const allFound = item.key.every((k) => tokens.some((t) => matchOne(t, k)))
    return allFound ? 'correct' : 'unmatched'
  }

  const key = item.key
  const kr = parseRational(key)
  const sr = parseRational(answer)

  // numeric key: compare as rationals
  if (kr) {
    if (sr) return rationalsEqual(sr, kr) ? 'correct' : 'incorrect'
    return 'unmatched' // student wrote something non-numeric → let a human read it
  }

  // text key (equations / inequalities): confident only on an exact normalized match
  return normalizeText(answer) === normalizeText(key) ? 'correct' : 'unmatched'
}
