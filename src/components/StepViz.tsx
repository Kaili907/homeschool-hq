import type { CellAnnotation, VizStep } from '../explain/types'
import { VisualView } from './Viz'

/**
 * MT-1V per-step visual renderer. The `column` case is the flagship: it draws the
 * vertical sum and places the borrow/carry marks on the exact digits the helpers
 * computed. Everything is theme-neutral (readable on the walkthrough's tinted
 * problem card) and reuses the existing Visual components for `reuse`.
 */

const OP_SIGN: Record<string, string> = { '+': '+', '−': '−', '×': '×', '÷': '÷' }

function ColumnViz({
  op,
  rows,
  result,
  annotations = [],
  highlights = [],
}: Extract<VizStep, { kind: 'column' }>) {
  const width = Math.max(...rows.map((r) => r.length), result ? result.length : 0)
  const annAt = (row: number, col: number): CellAnnotation | undefined =>
    annotations.find((a) => a.cell.row === row && a.cell.col === col)
  const isHi = (row: number, col: number) => highlights.some((h) => h.row === row && h.col === col)

  // right-align a digit string into `width` cells (leading nulls are blanks)
  const cells = (s: string): (string | null)[] => {
    const pad = width - s.length
    return Array.from({ length: width }, (_, c) => (c < pad ? null : s[c - pad]))
  }

  const colClass = 'flex h-9 w-8 items-center justify-center text-2xl font-extrabold tabular-nums'

  return (
    <div className="mx-auto inline-block font-mono text-slate-800" role="img" aria-label="vertical arithmetic">
      {/* carry / borrow marks, sitting above the top operand */}
      <div className="flex justify-end pl-8">
        {Array.from({ length: width }, (_, c) => {
          const a = annAt(0, c)
          return (
            <div key={c} className="flex h-5 w-8 items-start justify-center text-xs font-bold leading-none">
              {a && a.kind === 'carry' && <span className="text-emerald-600">{a.text}</span>}
              {a && a.kind === 'borrow' && <span className="text-rose-600">{a.text}</span>}
            </div>
          )
        })}
      </div>
      {/* operand rows */}
      {rows.map((r, ri) => {
        const isLast = ri === rows.length - 1
        return (
          <div key={ri} className="flex items-center justify-end">
            <div className="flex h-9 w-8 items-center justify-center text-2xl font-extrabold text-slate-500">
              {isLast ? OP_SIGN[op] : ''}
            </div>
            {cells(r).map((ch, c) => {
              const struck = ri === 0 && !!annAt(0, c) && annAt(0, c)!.kind === 'borrow'
              return (
                <div key={c} className={`${colClass} ${isHi(ri, c) ? 'rounded bg-amber-200' : ''}`}>
                  <span className={struck ? 'text-slate-400 line-through decoration-rose-500 decoration-2' : ''}>
                    {ch ?? ''}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}
      {/* rule + result */}
      {result && (
        <>
          <div className="ml-8 border-t-4 border-slate-700" />
          <div className="flex items-center justify-end">
            <div className="h-9 w-8" />
            {cells(result).map((ch, c) => (
              <div key={c} className={`${colClass} text-violet-700`}>
                {ch ?? ''}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function NumberLineStep({ min, max, marks, point, jumps }: Extract<VizStep, { kind: 'numberLine' }>) {
  const W = 360
  const pad = 24
  const span = max - min || 1
  const x = (v: number) => pad + ((v - min) * (W - pad * 2)) / span
  const ticks = marks && marks.length ? marks : Array.from({ length: span + 1 }, (_, i) => min + i)
  const labelEvery = span > 12 ? Math.ceil(span / 12) : 1
  return (
    <svg viewBox={`0 0 ${W} 78`} className="mx-auto w-full max-w-md" role="img" aria-label="number line">
      <line x1={pad - 10} y1={40} x2={W - pad + 10} y2={40} stroke="#475569" strokeWidth={2} />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={v === 0 ? 32 : 35} x2={x(v)} y2={v === 0 ? 48 : 45} stroke="#475569" strokeWidth={v === 0 ? 2.5 : 1.5} />
          {(v - min) % labelEvery === 0 && (
            <text x={x(v)} y={62} textAnchor="middle" fontSize={11} fill="#64748b" fontWeight={v === 0 ? 'bold' : 'normal'}>
              {v}
            </text>
          )}
        </g>
      ))}
      {(jumps ?? []).map((j, i) => {
        const midX = (x(j.from) + x(j.to)) / 2
        return (
          <g key={i}>
            <path
              d={`M ${x(j.from)} 34 Q ${midX} 8 ${x(j.to)} 34`}
              fill="none"
              stroke="#7c3aed"
              strokeWidth={2.5}
              markerEnd="url(#arrow)"
            />
            {j.label && (
              <text x={midX} y={14} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#6d28d9">
                {j.label}
              </text>
            )}
          </g>
        )
      })}
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#7c3aed" />
        </marker>
      </defs>
      {point !== undefined && <circle cx={x(point)} cy={40} r={6} fill="#f43f5e" stroke="#fff" strokeWidth={2} />}
    </svg>
  )
}

function FractionBarStep({ parts, shaded, compare }: Extract<VizStep, { kind: 'fractionBar' }>) {
  const Bar = ({ n, d }: { n: number; d: number }) => (
    <div className="flex h-12 w-full overflow-hidden rounded-xl border-4 border-violet-500 bg-white">
      {Array.from({ length: d }, (_, i) => (
        <div key={i} className={`flex-1 ${i < n ? 'bg-amber-400' : 'bg-white'} ${i > 0 ? 'border-l-2 border-violet-400' : ''}`} />
      ))}
    </div>
  )
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
      <Bar n={shaded} d={parts} />
      {compare && <Bar n={compare.shaded} d={compare.parts} />}
    </div>
  )
}

function ArrayStep({ rows, cols, highlightRows }: Extract<VizStep, { kind: 'array' }>) {
  return (
    <div className="mx-auto inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="img" aria-label={`${rows} by ${cols} array`}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols)
        const lit = highlightRows === undefined || r < highlightRows
        return <div key={i} className={`h-4 w-4 rounded-full ${lit ? 'bg-violet-500' : 'bg-violet-200'}`} />
      })}
    </div>
  )
}

function EquationLedgerStep({ lines, activeLine }: Extract<VizStep, { kind: 'equationLedger' }>) {
  return (
    <div className="mx-auto inline-block font-mono text-lg">
      {lines.map((ln, i) => (
        <div
          key={i}
          className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg px-3 py-1 ${
            i === activeLine ? 'bg-amber-100 font-extrabold text-slate-900' : 'text-slate-500'
          }`}
        >
          <span className="text-right">{ln.left}</span>
          <span className="text-slate-400">=</span>
          <span className="text-left">{ln.right}</span>
          {ln.op && <span className="col-span-3 text-center text-xs font-semibold text-violet-600">{ln.op}</span>}
        </div>
      ))}
    </div>
  )
}

export function StepViz({ viz }: { viz: VizStep }) {
  switch (viz.kind) {
    case 'column':
      return <ColumnViz {...viz} />
    case 'numberLine':
      return <NumberLineStep {...viz} />
    case 'fractionBar':
      return <FractionBarStep {...viz} />
    case 'array':
      return <ArrayStep {...viz} />
    case 'equationLedger':
      return <EquationLedgerStep {...viz} />
    case 'reuse':
      return <VisualView visual={viz.visual} />
  }
}
