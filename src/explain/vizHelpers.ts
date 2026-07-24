import type { Visual } from '../types'
import type { CellAnnotation, VizStep } from './types'

/**
 * MT-1V viz builders. Every builder derives its numbers from the arguments the
 * explainer already parsed out of the live question, so a viz can never show a
 * number the question doesn't. The two column builders are the flagship: they
 * compute the borrow/carry marks and place them on the correct digits.
 */

const digitAtPosFromRight = (s: string, p: number): number => {
  const i = s.length - 1 - p
  return i >= 0 ? Number(s[i]) : 0
}

/** Grid column index (0 = leftmost) for a right-aligned digit `p` places from the ones. */
const colOf = (width: number, posFromRight: number) => width - 1 - posFromRight

/**
 * Vertical addition with carries. Each column that overflows drops a carried 1
 * above the next column to the left (kind 'carry').
 */
export function columnAdd(a: number, b: number): VizStep {
  const A = String(Math.abs(a))
  const B = String(Math.abs(b))
  const R = String(Math.abs(a) + Math.abs(b))
  const width = R.length
  const annotations: CellAnnotation[] = []
  let carry = 0
  const cols = Math.max(A.length, B.length)
  for (let p = 0; p < cols; p++) {
    const sum = digitAtPosFromRight(A, p) + digitAtPosFromRight(B, p) + carry
    carry = sum >= 10 ? 1 : 0
    if (carry) {
      annotations.push({ cell: { row: 0, col: colOf(width, p + 1) }, text: '1', kind: 'carry' })
    }
  }
  return { kind: 'column', op: '+', rows: [A, B], result: R, annotations }
}

/**
 * Vertical subtraction with borrows (a ≥ b), correct across zeros. Any column
 * whose top digit changes (lent to the right and/or borrowed from the left) is
 * annotated with its new effective value (kind 'borrow') — the renderer strikes
 * the original and writes the new number above it.
 */
export function columnSub(a: number, b: number): VizStep {
  const top = Math.max(Math.abs(a), Math.abs(b))
  const bot = Math.min(Math.abs(a), Math.abs(b))
  const A = String(top)
  const B = String(bot)
  const R = String(top - bot)
  const width = A.length
  const annotations: CellAnnotation[] = []
  let borrow = 0
  for (let p = 0; p < A.length; p++) {
    const reduced = digitAtPosFromRight(A, p) - borrow // this column lent `borrow` to the right
    borrow = 0
    let eff = reduced
    if (eff < digitAtPosFromRight(B, p)) {
      eff += 10 // borrowed from the left
      borrow = 1
    }
    if (eff !== digitAtPosFromRight(A, p)) {
      annotations.push({ cell: { row: 0, col: colOf(width, p) }, text: String(eff), kind: 'borrow' })
    }
  }
  return { kind: 'column', op: '−', rows: [A, B], result: R, annotations }
}

/**
 * Vertical multiplication. For a single-digit multiplier the per-column carries
 * are marked; for a multi-digit multiplier we render operands + product aligned
 * (partial products are taught in text). Numbers all come from a, b.
 */
export function columnMul(a: number, b: number): VizStep {
  const A = String(Math.abs(a))
  const B = String(Math.abs(b))
  const product = Math.abs(a) * Math.abs(b)
  const R = String(product)
  const annotations: CellAnnotation[] = []
  if (B.length === 1) {
    const m = Number(B)
    let carry = 0
    const width = R.length
    for (let p = 0; p < A.length; p++) {
      const prod = digitAtPosFromRight(A, p) * m + carry
      carry = Math.floor(prod / 10)
      if (carry > 0 && p + 1 <= width - 1) {
        annotations.push({ cell: { row: 0, col: colOf(width, p + 1) }, text: String(carry), kind: 'carry' })
      }
    }
  }
  return { kind: 'column', op: '×', rows: [A, B], result: R, annotations }
}

/** Number line with an optional plotted point and skip-count jumps. */
export function numberLine(
  min: number,
  max: number,
  opts: { point?: number; marks?: number[]; jumps?: { from: number; to: number; label?: string }[] } = {},
): VizStep {
  return { kind: 'numberLine', min, max, point: opts.point, marks: opts.marks, jumps: opts.jumps }
}

/** A fraction bar; pass `compare` to show a second bar beneath it. */
export function fractionBar(
  shaded: number,
  parts: number,
  compare?: { shaded: number; parts: number },
): VizStep {
  return {
    kind: 'fractionBar',
    parts,
    shaded,
    compare: compare ? { parts: compare.parts, shaded: compare.shaded } : undefined,
  }
}

/** A rows×cols dot array (grouping / multiplication / division). */
export function array(rows: number, cols: number, highlightRows?: number): VizStep {
  return { kind: 'array', rows, cols, highlightRows }
}

/** The do-to-both-sides algebra ledger; `activeLine` highlights the current row. */
export function equationLedger(
  lines: { left: string; right: string; op?: string }[],
  activeLine: number,
): VizStep {
  return { kind: 'equationLedger', lines, activeLine }
}

/** Reuse an existing question Visual (clock / rect / ratioTable / coordGrid / …). */
export function reuse(visual: Visual): VizStep {
  return { kind: 'reuse', visual }
}
