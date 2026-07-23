import type { Visual } from '../types'

export function ClockViz({ h, m }: { h: number; m: number }) {
  const cx = 100
  const cy = 100
  const hourAngle = ((h % 12) + m / 60) * 30
  const minAngle = m * 6
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180
  const point = (deg: number, r: number) => ({
    x: cx + r * Math.cos(rad(deg)),
    y: cy + r * Math.sin(rad(deg)),
  })
  const hourEnd = point(hourAngle, 45)
  const minEnd = point(minAngle, 68)
  return (
    <svg viewBox="0 0 200 200" className="mx-auto h-44 w-44" role="img" aria-label="analog clock">
      <circle cx={cx} cy={cy} r={92} fill="#fff" stroke="#7c3aed" strokeWidth={8} />
      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0
        const p1 = point(i * 6, major ? 76 : 80)
        const p2 = point(i * 6, 84)
        return (
          <line
            key={i}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={major ? '#7c3aed' : '#c4b5fd'}
            strokeWidth={major ? 3 : 1.5}
            strokeLinecap="round"
          />
        )
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1
        const p = point(n * 30, 63)
        return (
          <text
            key={n}
            x={p.x}
            y={p.y + 5}
            textAnchor="middle"
            fontSize={15}
            fontWeight="bold"
            fill="#4c1d95"
          >
            {n}
          </text>
        )
      })}
      <line x1={cx} y1={cy} x2={hourEnd.x} y2={hourEnd.y} stroke="#1e293b" strokeWidth={7} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={minEnd.x} y2={minEnd.y} stroke="#f43f5e" strokeWidth={4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="#1e293b" />
    </svg>
  )
}

export function FractionBar({
  num,
  den,
  label,
}: {
  num: number
  den: number
  label?: string
}) {
  return (
    <div className="mx-auto w-full max-w-xs">
      {label && <div className="mb-1 text-center text-lg font-bold text-violet-800">{label}</div>}
      <div className="flex h-14 overflow-hidden rounded-2xl border-4 border-violet-500 bg-white">
        {Array.from({ length: den }, (_, i) => (
          <div
            key={i}
            className={`flex-1 ${i < num ? 'bg-amber-400' : 'bg-white'} ${i > 0 ? 'border-l-2 border-violet-400' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}

export function RectViz({ w, h, labels }: { w: number; h: number; labels: boolean }) {
  const cell = 28
  const pad = labels ? 30 : 6
  const width = w * cell + pad * 2
  const height = h * cell + pad * 2
  const showGrid = w <= 8 && h <= 8
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mx-auto max-h-48 w-auto max-w-full"
      role="img"
      aria-label={`rectangle ${w} by ${h}`}
    >
      <rect
        x={pad}
        y={pad}
        width={w * cell}
        height={h * cell}
        fill="#ddd6fe"
        stroke="#7c3aed"
        strokeWidth={4}
      />
      {showGrid &&
        Array.from({ length: w - 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={pad + (i + 1) * cell}
            y1={pad}
            x2={pad + (i + 1) * cell}
            y2={pad + h * cell}
            stroke="#a78bfa"
            strokeWidth={2}
          />
        ))}
      {showGrid &&
        Array.from({ length: h - 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={pad}
            y1={pad + (i + 1) * cell}
            x2={pad + w * cell}
            y2={pad + (i + 1) * cell}
            stroke="#a78bfa"
            strokeWidth={2}
          />
        ))}
      {labels && (
        <>
          <text
            x={pad + (w * cell) / 2}
            y={pad - 10}
            textAnchor="middle"
            fontSize={16}
            fontWeight="bold"
            fill="#4c1d95"
          >
            {w} units
          </text>
          <text
            x={pad - 10}
            y={pad + (h * cell) / 2}
            textAnchor="middle"
            fontSize={16}
            fontWeight="bold"
            fill="#4c1d95"
            transform={`rotate(-90 ${pad - 10} ${pad + (h * cell) / 2})`}
          >
            {h} units
          </text>
        </>
      )}
    </svg>
  )
}

export function VisualView({ visual }: { visual: Visual }) {
  switch (visual.kind) {
    case 'clock':
      return <ClockViz h={visual.h} m={visual.m} />
    case 'fraction':
      return <FractionBar num={visual.num} den={visual.den} />
    case 'fractionPair':
      return (
        <div className="flex flex-col gap-3">
          <FractionBar num={visual.a[0]} den={visual.a[1]} label={`${visual.a[0]}/${visual.a[1]}`} />
          <FractionBar num={visual.b[0]} den={visual.b[1]} label={`${visual.b[0]}/${visual.b[1]}`} />
        </div>
      )
    case 'rect':
      return <RectViz w={visual.w} h={visual.h} labels={visual.labels} />
  }
}
