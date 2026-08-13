/**
 * The independent oracle.
 *
 * The authored `answer` string on a fixed item is treated as a claim, never as
 * authority. The oracle re-derives the value from the scenario parameters the
 * learner is shown, in exact rational arithmetic, formats it by the item's
 * declared format, and compares. Any mismatch is a hard failure: the corpus
 * fails closed rather than shipping a key a parent would be told to trust.
 *
 * What this does and does not establish is stated in the lane README. It
 * catches arithmetic error, transcription error, and drift between a scenario
 * figure and the key derived from it. It cannot, on its own, establish that
 * the chosen formula is the right model for the scenario — that is what the
 * per-item `reasoning`, the parameter-visibility check, and human review are
 * for.
 */
import {
  abs, add, cmp, div, fromDecimalString, fromNumber, mul, neg, pow, roundTo, sub, toFixed, withThousands,
  type Rat,
} from './exact.ts'
import type { ChoiceItem, Item, LessonSpec, NumericFormat, NumericItem } from './types.ts'

/* ------------------------------------------------------------------ lexer */

type Tok =
  | { t: 'num'; v: string }
  | { t: 'id'; v: string }
  | { t: 'ref'; v: string }
  | { t: 'op'; v: string }

function lex(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) { i += 1; continue }
    if (/[0-9]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1
      toks.push({ t: 'num', v: src.slice(i, j) })
      i = j
      continue
    }
    if (c === '#') {
      let j = i + 1
      while (j < src.length && /[A-Za-z0-9_-]/.test(src[j])) j += 1
      toks.push({ t: 'ref', v: src.slice(i + 1, j) })
      i = j
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j += 1
      toks.push({ t: 'id', v: src.slice(i, j) })
      i = j
      continue
    }
    if ('+-*/(),'.includes(c)) { toks.push({ t: 'op', v: c }); i += 1; continue }
    throw new Error(`unexpected character ${JSON.stringify(c)} in expression`)
  }
  return toks
}

/* ----------------------------------------------------------------- parser */

export interface EvalScope {
  readonly params: Readonly<Record<string, number>>
  readonly refs: Readonly<Record<string, Rat>>
}

const FUNCS = new Set(['round', 'min', 'max', 'abs', 'pow'])

function evaluate(src: string, scope: EvalScope): Rat {
  const toks = lex(src)
  let p = 0
  const peek = (): Tok | undefined => toks[p]
  const eat = (v: string): void => {
    const t = toks[p]
    if (!t || t.t !== 'op' || t.v !== v) throw new Error(`expected ${v} in expression "${src}"`)
    p += 1
  }

  function primary(): Rat {
    const t = toks[p]
    if (!t) throw new Error(`unexpected end of expression "${src}"`)
    if (t.t === 'op' && t.v === '(') { p += 1; const v = expr(); eat(')'); return v }
    if (t.t === 'op' && t.v === '-') { p += 1; return neg(primary()) }
    if (t.t === 'num') { p += 1; return fromDecimalString(t.v) }
    if (t.t === 'ref') {
      p += 1
      const v = scope.refs[t.v]
      if (v === undefined) throw new Error(`expression "${src}" references #${t.v}, which is not an earlier fixed item in this lesson`)
      return v
    }
    if (t.t === 'id') {
      p += 1
      if (FUNCS.has(t.v)) {
        eat('(')
        const args: Rat[] = [expr()]
        while (peek() && peek()!.t === 'op' && peek()!.v === ',') { p += 1; args.push(expr()) }
        eat(')')
        return applyFunc(t.v, args, src)
      }
      const raw = scope.params[t.v]
      if (raw === undefined) throw new Error(`expression "${src}" uses parameter "${t.v}", which the item does not declare in \`given\``)
      return fromNumber(raw)
    }
    throw new Error(`unexpected token in expression "${src}"`)
  }

  function applyFunc(name: string, args: Rat[], where: string): Rat {
    if (name === 'abs') { if (args.length !== 1) throw new Error(`abs takes 1 argument in "${where}"`); return abs(args[0]) }
    if (name === 'min') { if (args.length < 2) throw new Error(`min takes 2+ arguments in "${where}"`); return args.reduce((a, b) => (cmp(a, b) <= 0 ? a : b)) }
    if (name === 'max') { if (args.length < 2) throw new Error(`max takes 2+ arguments in "${where}"`); return args.reduce((a, b) => (cmp(a, b) >= 0 ? a : b)) }
    if (name === 'round') {
      if (args.length !== 2) throw new Error(`round takes 2 arguments in "${where}"`)
      const dp = Number(toFixed(args[1], 0))
      return roundTo(args[0], dp)
    }
    if (name === 'pow') {
      if (args.length !== 2) throw new Error(`pow takes 2 arguments in "${where}"`)
      return pow(args[0], Number(toFixed(args[1], 0)))
    }
    throw new Error(`unknown function ${name}`)
  }

  function term(): Rat {
    let v = primary()
    for (;;) {
      const t = peek()
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) {
        p += 1
        const r = primary()
        v = t.v === '*' ? mul(v, r) : div(v, r)
      } else return v
    }
  }

  function expr(): Rat {
    let v = term()
    for (;;) {
      const t = peek()
      if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) {
        p += 1
        const r = term()
        v = t.v === '+' ? add(v, r) : sub(v, r)
      } else return v
    }
  }

  const out = expr()
  if (p !== toks.length) throw new Error(`trailing tokens in expression "${src}"`)
  return out
}

/* -------------------------------------------------------------- formatting */

const DP: Record<NumericFormat, number> = {
  usd: 2, usd0: 0, percent1: 1, percent2: 2, int: 0, dec1: 1, dec2: 2, years1: 1, months0: 0,
}

export function format(value: Rat, fmt: NumericFormat): string {
  const dp = DP[fmt]
  const rounded = roundTo(value, dp)
  const plain = toFixed(rounded, dp)
  const [ip, fp] = plain.split('.')
  const grouped = withThousands(ip)
  const body = fp === undefined ? grouped : `${grouped}.${fp}`
  switch (fmt) {
    case 'usd':
    case 'usd0':
      return body.startsWith('-') ? `-$${body.slice(1)}` : `$${body}`
    case 'percent1':
    case 'percent2':
      return `${body}%`
    default:
      return body
  }
}

/* ------------------------------------------------------------ verification */

export interface OracleFinding {
  readonly lessonId: string
  readonly ref: string
  readonly message: string
}

export interface LessonOracleResult {
  readonly lessonId: string
  readonly checkedFixedItems: number
  readonly recomputedNumeric: number
  readonly derivedChoices: number
  readonly assertedChoices: number
  readonly findings: readonly OracleFinding[]
  readonly values: Readonly<Record<string, Rat>>
}

function isFixed(item: Item): item is NumericItem | ChoiceItem {
  return item.kind === 'numeric' || item.kind === 'choice'
}

/**
 * Recomputes every fixed answer in one lesson. Returns findings rather than
 * throwing so a test run reports every bad item at once instead of the first.
 */
export function verifyLesson(spec: LessonSpec): LessonOracleResult {
  const findings: OracleFinding[] = []
  const values: Record<string, Rat> = {}
  let checked = 0
  let recomputed = 0
  let derived = 0
  let asserted = 0

  for (const task of spec.tasks) {
    for (const item of task.items) {
      if (!isFixed(item)) continue
      checked += 1
      const scope: EvalScope = { params: item.given ?? {}, refs: values }
      if (item.kind === 'numeric') {
        try {
          const v = evaluate(item.expr, scope)
          values[item.ref] = v
          const expected = format(v, item.format)
          if (expected !== item.answer) {
            findings.push({
              lessonId: spec.lessonId,
              ref: item.ref,
              message: `authored answer ${JSON.stringify(item.answer)} does not match the value recomputed from the item's own parameters, ${JSON.stringify(expected)} (expression: ${item.expr})`,
            })
          } else {
            recomputed += 1
          }
        } catch (err) {
          findings.push({ lessonId: spec.lessonId, ref: item.ref, message: (err as Error).message })
        }
        continue
      }
      // choice
      if (!item.choices.includes(item.answer)) {
        findings.push({ lessonId: spec.lessonId, ref: item.ref, message: `authored answer ${JSON.stringify(item.answer)} is not one of the offered choices` })
        continue
      }
      if (!item.decision) {
        asserted += 1
        continue
      }
      try {
        const l = evaluate(item.decision.left, scope)
        const r = evaluate(item.decision.right, scope)
        const c = cmp(l, r)
        const holds =
          item.decision.cmp === '>' ? c > 0
            : item.decision.cmp === '<' ? c < 0
              : item.decision.cmp === '>=' ? c >= 0
                : item.decision.cmp === '<=' ? c <= 0
                  : c === 0
        const chosen = holds ? item.decision.ifTrue : item.decision.ifFalse
        if (!item.choices.includes(chosen)) {
          findings.push({ lessonId: spec.lessonId, ref: item.ref, message: `decision resolves to ${JSON.stringify(chosen)}, which is not one of the offered choices` })
        } else if (chosen !== item.answer) {
          findings.push({
            lessonId: spec.lessonId,
            ref: item.ref,
            message: `authored answer ${JSON.stringify(item.answer)} disagrees with the choice the parameters decide, ${JSON.stringify(chosen)} (${item.decision.left} ${item.decision.cmp} ${item.decision.right})`,
          })
        } else {
          derived += 1
        }
      } catch (err) {
        findings.push({ lessonId: spec.lessonId, ref: item.ref, message: (err as Error).message })
      }
    }
  }

  return {
    lessonId: spec.lessonId,
    checkedFixedItems: checked,
    recomputedNumeric: recomputed,
    derivedChoices: derived,
    assertedChoices: asserted,
    findings,
    values,
  }
}

/** Every numeric literal an expression consumes, for the visibility check. */
export function literalsIn(src: string): string[] {
  return lex(src).filter((t): t is { t: 'num'; v: string } => t.t === 'num').map((t) => t.v)
}
