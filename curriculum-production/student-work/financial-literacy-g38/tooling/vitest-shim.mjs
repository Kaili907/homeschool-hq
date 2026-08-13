/**
 * A minimal describe/it/expect implementation covering only the matchers this
 * corpus's tests use. It exists so the committed vitest suite can also be run
 * with nothing but node, in a checkout where dependencies are not installed.
 * Under CI the same test files run under real vitest; this shim is never
 * imported when vitest resolves.
 */
const state = { suite: [], passed: 0, failed: [], tests: 0 }

function label(name) {
  return [...state.suite, name].join(' > ')
}

export function describe(name, body) {
  state.suite.push(name)
  try {
    body()
  } finally {
    state.suite.pop()
  }
}

export function it(name, body) {
  state.tests += 1
  try {
    body()
    state.passed += 1
    console.log(`  ok  ${label(name)}`)
  } catch (err) {
    state.failed.push({ name: label(name), err })
    console.log(`  FAIL ${label(name)}\n       ${err && err.message}`)
  }
}

function equal(a, b) {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((key) => equal(a[key], b[key]))
}

const show = (value) => (typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value, null, 0))

function build(actual, negated) {
  const check = (condition, message) => {
    if (negated ? condition : !condition) throw new Error(negated ? `unexpectedly ${message}` : message)
  }
  return {
    get not() {
      return build(actual, !negated)
    },
    toBe: (expected) => check(Object.is(actual, expected), `expected ${show(expected)} but received ${show(actual)}`),
    toEqual: (expected) => check(equal(actual, expected), `expected ${show(expected)} but received ${show(actual)}`),
    toHaveLength: (expected) => check(actual?.length === expected, `expected length ${expected} but received ${actual?.length}`),
    toBeGreaterThan: (expected) => check(actual > expected, `expected ${show(actual)} to be greater than ${expected}`),
    toBeNull: () => check(actual === null, `expected null but received ${show(actual)}`),
    toContain: (expected) => check(actual?.includes(expected), `expected ${show(actual)?.slice(0, 120)} to contain ${show(expected)}`),
    toMatch: (pattern) => check(pattern.test(actual), `expected ${show(actual)?.slice(0, 120)} to match ${pattern}`),
    toThrow: (pattern) => {
      let threw = null
      try {
        actual()
      } catch (err) {
        threw = err
      }
      const matches =
        !pattern ||
        (pattern instanceof RegExp
          ? pattern.test(threw?.message ?? '')
          : typeof pattern === 'function'
            ? threw instanceof pattern
            : String(threw?.message ?? '').includes(pattern))
      check(threw !== null && matches, 'expected the call to throw')
    },
  }
}

export function expect(actual) {
  return build(actual, false)
}

export function summary() {
  return state
}
