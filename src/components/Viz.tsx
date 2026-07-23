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

export function NumberLineViz({ min, max, value }: { min: number; max: number; value: number }) {
  const W = 340
  const pad = 20
  const x = (v: number) => pad + ((v - min) * (W - pad * 2)) / (max - min)
  const labelStep = max - min > 12 ? 2 : 1
  return (
    <svg viewBox={`0 0 ${W} 60`} className="mx-auto w-full max-w-sm" role="img" aria-label="number line">
      <line x1={pad - 8} y1={28} x2={W - pad + 8} y2={28} stroke="#475569" strokeWidth={2} />
      {Array.from({ length: max - min + 1 }, (_, i) => {
        const v = min + i
        return (
          <g key={v}>
            <line x1={x(v)} y1={v === 0 ? 20 : 23} x2={x(v)} y2={v === 0 ? 36 : 33} stroke="#475569" strokeWidth={v === 0 ? 2.5 : 1.5} />
            {(v % labelStep === 0 || v === 0) && (
              <text x={x(v)} y={50} textAnchor="middle" fontSize={10} fill="#64748b" fontWeight={v === 0 ? 'bold' : 'normal'}>
                {v}
              </text>
            )}
          </g>
        )
      })}
      <circle cx={x(value)} cy={28} r={6} fill="#f43f5e" stroke="#fff" strokeWidth={2} />
    </svg>
  )
}

export function CoordGridViz({ x, y }: { x: number; y: number }) {
  const R = 6 // grid range -6..6
  const cell = 18
  const S = R * 2 * cell + 40
  const c = S / 2
  const px = (v: number) => c + v * cell
  const py = (v: number) => c - v * cell
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto h-56 w-56" role="img" aria-label="coordinate grid">
      {Array.from({ length: R * 2 + 1 }, (_, i) => {
        const v = i - R
        return (
          <g key={v}>
            <line x1={px(v)} y1={py(-R)} x2={px(v)} y2={py(R)} stroke={v === 0 ? '#475569' : '#e2e8f0'} strokeWidth={v === 0 ? 2 : 1} />
            <line x1={px(-R)} y1={py(v)} x2={px(R)} y2={py(v)} stroke={v === 0 ? '#475569' : '#e2e8f0'} strokeWidth={v === 0 ? 2 : 1} />
          </g>
        )
      })}
      {[-5, 5].map((v) => (
        <g key={v} fontSize={10} fill="#64748b">
          <text x={px(v)} y={c + 12} textAnchor="middle">{v}</text>
          <text x={c - 8} y={py(v) + 3} textAnchor="end">{v}</text>
        </g>
      ))}
      <circle cx={px(x)} cy={py(y)} r={6} fill="#f43f5e" stroke="#fff" strokeWidth={2} />
    </svg>
  )
}

export function RatioTableViz({ headers, rows }: { headers: [string, string]; rows: [string, string][] }) {
  return (
    <table className="mx-auto border-collapse text-center">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} className="border-2 border-violet-400 bg-violet-100 px-6 py-2 font-extrabold text-violet-900">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className={`border-2 border-violet-400 px-6 py-2 text-lg font-bold ${cell === '?' ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-700'}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AngleViz({ degrees }: { degrees: number }) {
  const cx = 40
  const cy = 110
  const len = 120
  const rad = (-degrees * Math.PI) / 180
  const x2 = cx + len * Math.cos(rad)
  const y2 = cy + len * Math.sin(rad)
  const arcR = 28
  const ax = cx + arcR * Math.cos(rad)
  const ay = cy + arcR * Math.sin(rad)
  const largeArc = degrees > 180 ? 1 : 0
  return (
    <svg viewBox="0 0 200 140" className="mx-auto h-40 w-56" role="img" aria-label="angle">
      <line x1={cx} y1={cy} x2={cx + len} y2={cy} stroke="#475569" strokeWidth={4} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#475569" strokeWidth={4} strokeLinecap="round" />
      <path
        d={`M ${cx + arcR} ${cy} A ${arcR} ${arcR} 0 ${largeArc} 0 ${ax} ${ay}`}
        fill="none"
        stroke="#f43f5e"
        strokeWidth={3}
      />
      <circle cx={cx} cy={cy} r={4} fill="#475569" />
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
    case 'numberLine':
      return <NumberLineViz min={visual.min} max={visual.max} value={visual.value} />
    case 'coordGrid':
      return <CoordGridViz x={visual.x} y={visual.y} />
    case 'ratioTable':
      return <RatioTableViz headers={visual.headers} rows={visual.rows} />
    case 'angle':
      return <AngleViz degrees={visual.degrees} />
  }
}
