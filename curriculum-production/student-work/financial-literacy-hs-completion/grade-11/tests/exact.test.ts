import { describe, expect, it } from 'vitest'
import { add, div, fromNumber, mul, roundTo, sub, toFixed } from '../src/exact.ts'
import { format } from '../src/oracle.ts'

/**
 * The oracle is only worth as much as its arithmetic. These pin the two
 * behaviours the corpus depends on: exactness where binary floating point is
 * wrong, and half-away-from-zero rounding at the cent.
 */
describe('exact rational arithmetic', () => {
  it('adds tenths exactly, where floating point does not', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(toFixed(add(fromNumber(0.1), fromNumber(0.2)), 1)).toBe('0.3')
  })

  it('keeps a long chain of currency operations exact', () => {
    let acc = fromNumber(312.4)
    for (const [op, v] of [['+', 85], ['-', 42.75], ['+', 16.2], ['-', 9.99]] as const) {
      acc = op === '+' ? add(acc, fromNumber(v)) : sub(acc, fromNumber(v))
    }
    expect(toFixed(acc, 2)).toBe('360.86')
  })

  it('rounds half away from zero at the cent', () => {
    expect(toFixed(roundTo(fromNumber(2.005), 2), 2)).toBe('2.01')
    expect(toFixed(roundTo(fromNumber(-2.005), 2), 2)).toBe('-2.01')
    expect(toFixed(roundTo(fromNumber(2.004), 2), 2)).toBe('2.00')
  })

  it('divides without drift', () => {
    const third = div(fromNumber(1), fromNumber(3))
    expect(toFixed(roundTo(mul(third, fromNumber(3)), 2), 2)).toBe('1.00')
  })

  it('formats currency, percentages, and counts the way a task sheet prints them', () => {
    expect(format(fromNumber(1234.5), 'usd')).toBe('$1,234.50')
    expect(format(fromNumber(-40), 'usd')).toBe('-$40.00')
    expect(format(fromNumber(7.65), 'percent2')).toBe('7.65%')
    expect(format(fromNumber(42000), 'int')).toBe('42,000')
  })

  it('refuses a parameter it cannot represent exactly', () => {
    expect(() => fromNumber(1e-12)).toThrow()
  })
})
