import type { AnglePos, GeoFigure } from '../hs/geoFigure'

// Clean-theme geometry diagrams. Neutral slate strokes with a rose accent for
// the value the student is solving for. Rendered inside HS practice/quiz cards.

const STROKE = '#334155' // slate-700
const FAINT = '#94a3b8' // slate-400
const ACCENT = '#e11d48' // rose-600
const FILL = '#eef2ff' // indigo-50

const label = (
  x: number,
  y: number,
  text: string,
  opts: { accent?: boolean; size?: number } = {},
) =>
  text === '' ? null : (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={opts.size ?? 14}
      fontWeight={700}
      fill={opts.accent || text === '?' ? ACCENT : STROKE}
    >
      {text}
    </text>
  )

// ---------- parallel lines cut by a transversal ----------

const U = { x: 92, y: 66 }
const L = { x: 150, y: 150 }
const posOffset: Record<AnglePos, [number, number]> = {
  1: [-26, -12],
  2: [22, -12],
  3: [-26, 20],
  4: [22, 20],
  5: [-26, -12],
  6: [22, -12],
  7: [-26, 20],
  8: [22, 20],
}
const posPoint = (pos: AnglePos): { x: number; y: number } => {
  const base = pos <= 4 ? U : L
  const [dx, dy] = posOffset[pos]
  return { x: base.x + dx, y: base.y + dy }
}

function ParallelLines({ givenPos, askPos, acute }: { givenPos: AnglePos; askPos: AnglePos; acute: number }) {
  const g = posPoint(givenPos)
  const a = posPoint(askPos)
  const given = [2, 3, 6, 7].includes(givenPos) ? acute : 180 - acute
  return (
    <svg viewBox="0 0 260 210" className="mx-auto h-52 w-auto max-w-full" role="img" aria-label="parallel lines cut by a transversal">
      {/* two parallel lines */}
      <line x1={20} y1={U.y} x2={240} y2={U.y} stroke={STROKE} strokeWidth={2.5} />
      <line x1={20} y1={L.y} x2={240} y2={L.y} stroke={STROKE} strokeWidth={2.5} />
      {/* parallel arrow marks */}
      <path d={`M 210 ${U.y - 5} l 8 5 l -8 5`} fill="none" stroke={FAINT} strokeWidth={2} />
      <path d={`M 210 ${L.y - 5} l 8 5 l -8 5`} fill="none" stroke={FAINT} strokeWidth={2} />
      {/* transversal */}
      <line x1={U.x - 55} y1={U.y - 78} x2={L.x + 40} y2={L.y + 56} stroke={STROKE} strokeWidth={2.5} />
      {/* line names */}
      {label(250, U.y, 'm', { size: 13 })}
      {label(250, L.y, 'n', { size: 13 })}
      {label(g.x, g.y, `${given}°`)}
      {label(a.x, a.y, '?')}
    </svg>
  )
}

// ---------- right triangle ----------

function RightTriangle({ a, b, c }: { a: string; b: string; c: string }) {
  // A = right angle (bottom-left), B top, C bottom-right
  const A = { x: 46, y: 158 }
  const B = { x: 46, y: 44 }
  const C = { x: 214, y: 158 }
  return (
    <svg viewBox="0 0 250 190" className="mx-auto h-44 w-auto max-w-full" role="img" aria-label="right triangle">
      <polygon points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`} fill={FILL} stroke={STROKE} strokeWidth={2.5} />
      {/* right-angle mark */}
      <path d={`M ${A.x + 16} ${A.y} L ${A.x + 16} ${A.y - 16} L ${A.x} ${A.y - 16}`} fill="none" stroke={STROKE} strokeWidth={1.5} />
      {label((A.x + B.x) / 2 - 16, (A.y + B.y) / 2, a)}
      {label((A.x + C.x) / 2, A.y + 18, b)}
      {label((B.x + C.x) / 2 + 8, (B.y + C.y) / 2 - 8, c)}
    </svg>
  )
}

// ---------- triangles (angles / sides) ----------

const T = { top: { x: 130, y: 34 }, bl: { x: 44, y: 168 }, br: { x: 216, y: 168 } }

function TriangleAngles({ angles }: { angles: [string, string, string] }) {
  return (
    <svg viewBox="0 0 260 190" className="mx-auto h-44 w-auto max-w-full" role="img" aria-label="triangle with angle labels">
      <polygon points={`${T.top.x},${T.top.y} ${T.bl.x},${T.bl.y} ${T.br.x},${T.br.y}`} fill={FILL} stroke={STROKE} strokeWidth={2.5} />
      {label(T.top.x, T.top.y + 24, angles[0])}
      {label(T.bl.x + 22, T.bl.y - 16, angles[1])}
      {label(T.br.x - 22, T.br.y - 16, angles[2])}
    </svg>
  )
}

function TriangleSides({ sides, ticks }: { sides: [string, string, string]; ticks?: [number, number, number] }) {
  const mid = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })
  const mAB = mid(T.top, T.bl)
  const mBC = mid(T.bl, T.br)
  const mCA = mid(T.br, T.top)
  const tick = (m: { x: number; y: number }, n: number | undefined) =>
    n && n > 0 ? (
      <g>
        {Array.from({ length: n }, (_, i) => (
          <circle key={i} cx={m.x - (n - 1) * 3 + i * 6} cy={m.y} r={1.6} fill={FAINT} />
        ))}
      </g>
    ) : null
  return (
    <svg viewBox="0 0 260 190" className="mx-auto h-44 w-auto max-w-full" role="img" aria-label="triangle with side labels">
      <polygon points={`${T.top.x},${T.top.y} ${T.bl.x},${T.bl.y} ${T.br.x},${T.br.y}`} fill={FILL} stroke={STROKE} strokeWidth={2.5} />
      {label(mAB.x - 16, mAB.y, sides[0])}
      {label(mBC.x, mBC.y + 18, sides[1])}
      {label(mCA.x + 16, mCA.y, sides[2])}
      {ticks && tick(mAB, ticks[0])}
      {ticks && tick(mBC, ticks[1])}
      {ticks && tick(mCA, ticks[2])}
    </svg>
  )
}

// ---------- circle ----------

function Circle({ label: lab, which }: { label: string; which: 'r' | 'd' }) {
  const c = { x: 110, y: 105 }
  const r = 78
  return (
    <svg viewBox="0 0 220 210" className="mx-auto h-48 w-auto max-w-full" role="img" aria-label="circle">
      <circle cx={c.x} cy={c.y} r={r} fill={FILL} stroke={STROKE} strokeWidth={2.5} />
      <circle cx={c.x} cy={c.y} r={2.5} fill={STROKE} />
      {which === 'r' ? (
        <>
          <line x1={c.x} y1={c.y} x2={c.x + r} y2={c.y} stroke={ACCENT} strokeWidth={2.5} />
          {label(c.x + r / 2, c.y - 12, lab, { accent: true })}
        </>
      ) : (
        <>
          <line x1={c.x - r} y1={c.y} x2={c.x + r} y2={c.y} stroke={ACCENT} strokeWidth={2.5} />
          {label(c.x, c.y - 12, lab, { accent: true })}
        </>
      )}
    </svg>
  )
}

// ---------- quadrilaterals ----------

function Quad({ shape, labels }: { shape: 'rectangle' | 'square' | 'parallelogram' | 'trapezoid'; labels: string[] }) {
  let pts: { x: number; y: number }[]
  if (shape === 'parallelogram') {
    pts = [{ x: 70, y: 40 }, { x: 220, y: 40 }, { x: 180, y: 150 }, { x: 30, y: 150 }]
  } else if (shape === 'trapezoid') {
    pts = [{ x: 80, y: 40 }, { x: 170, y: 40 }, { x: 220, y: 150 }, { x: 30, y: 150 }]
  } else if (shape === 'square') {
    pts = [{ x: 60, y: 40 }, { x: 190, y: 40 }, { x: 190, y: 150 }, { x: 60, y: 150 }]
  } else {
    pts = [{ x: 30, y: 45 }, { x: 220, y: 45 }, { x: 220, y: 150 }, { x: 30, y: 150 }]
  }
  const poly = pts.map((p) => `${p.x},${p.y}`).join(' ')
  // 4 labels → corner labels (angle problems); 2–3 labels → edge dimensions
  const corners =
    labels.length >= 4
      ? [
          { x: pts[0].x + 16, y: pts[0].y + 18 },
          { x: pts[1].x - 16, y: pts[1].y + 18 },
          { x: pts[2].x - 16, y: pts[2].y - 16 },
          { x: pts[3].x + 16, y: pts[3].y - 16 },
        ]
      : []
  const bottomMid = { x: (pts[2].x + pts[3].x) / 2, y: pts[3].y + 18 }
  const topMid = { x: (pts[0].x + pts[1].x) / 2, y: pts[0].y - 10 }
  const leftMid = { x: (pts[0].x + pts[3].x) / 2 - 16, y: (pts[0].y + pts[3].y) / 2 }
  return (
    <svg viewBox="0 0 250 190" className="mx-auto h-44 w-auto max-w-full" role="img" aria-label={`${shape}`}>
      <polygon points={poly} fill={FILL} stroke={STROKE} strokeWidth={2.5} />
      {labels.length >= 4
        ? labels.slice(0, 4).map((l, i) => <g key={i}>{label(corners[i].x, corners[i].y, l)}</g>)
        : shape === 'trapezoid'
          ? [label(bottomMid.x, bottomMid.y, labels[0] ?? ''), label(topMid.x, topMid.y, labels[1] ?? ''), label(leftMid.x + 2, leftMid.y, labels[2] ?? '')]
          : [label(bottomMid.x, bottomMid.y, labels[0] ?? ''), label(leftMid.x, leftMid.y, labels[1] ?? '')]}
    </svg>
  )
}

// ---------- coordinate pair ----------

function CoordPair({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const R = 8
  const S = 200
  const pad = 14
  const cell = (S - pad * 2) / (2 * R)
  const c = S / 2
  const px = (v: number) => c + v * cell
  const py = (v: number) => c - v * cell
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto h-52 w-52" role="img" aria-label="two points on a coordinate plane">
      {Array.from({ length: 2 * R + 1 }, (_, i) => {
        const v = i - R
        return (
          <g key={v}>
            <line x1={px(v)} y1={py(-R)} x2={px(v)} y2={py(R)} stroke={v === 0 ? STROKE : '#e2e8f0'} strokeWidth={v === 0 ? 1.5 : 0.75} />
            <line x1={px(-R)} y1={py(v)} x2={px(R)} y2={py(v)} stroke={v === 0 ? STROKE : '#e2e8f0'} strokeWidth={v === 0 ? 1.5 : 0.75} />
          </g>
        )
      })}
      <line x1={px(x1)} y1={py(y1)} x2={px(x2)} y2={py(y2)} stroke={FAINT} strokeWidth={1.75} strokeDasharray="3 3" />
      <circle cx={px(x1)} cy={py(y1)} r={4} fill={ACCENT} />
      <circle cx={px(x2)} cy={py(y2)} r={4} fill={ACCENT} />
      <text x={px(x1)} y={py(y1) - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={STROKE}>({x1}, {y1})</text>
      <text x={px(x2)} y={py(y2) - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={STROKE}>({x2}, {y2})</text>
    </svg>
  )
}

// ---------- 3-D box ----------

function Box({ l, w, h }: { l: string; w: string; h: string }) {
  // front face + offset back for a simple isometric box
  const o = 34 // depth offset
  const f = { x: 40, y: 70, w: 130, h: 95 }
  return (
    <svg viewBox="0 0 240 200" className="mx-auto h-44 w-auto max-w-full" role="img" aria-label="rectangular box">
      {/* back edges */}
      <path d={`M ${f.x + o} ${f.y - o} h ${f.w} v ${f.h}`} fill="none" stroke={FAINT} strokeWidth={1.5} strokeDasharray="3 3" />
      <path d={`M ${f.x} ${f.y} l ${o} ${-o}`} fill="none" stroke={FAINT} strokeWidth={1.5} strokeDasharray="3 3" />
      {/* top face */}
      <polygon points={`${f.x},${f.y} ${f.x + o},${f.y - o} ${f.x + f.w + o},${f.y - o} ${f.x + f.w},${f.y}`} fill={FILL} stroke={STROKE} strokeWidth={2} />
      {/* side face */}
      <polygon points={`${f.x + f.w},${f.y} ${f.x + f.w + o},${f.y - o} ${f.x + f.w + o},${f.y + f.h - o} ${f.x + f.w},${f.y + f.h}`} fill="#e0e7ff" stroke={STROKE} strokeWidth={2} />
      {/* front face */}
      <rect x={f.x} y={f.y} width={f.w} height={f.h} fill={FILL} stroke={STROKE} strokeWidth={2} />
      {label(f.x + f.w / 2, f.y + f.h + 16, l)}
      {label(f.x + f.w + o + 20, f.y + (f.h - o) / 2, w)}
      {label(f.x - 16, f.y + f.h / 2, h)}
    </svg>
  )
}

// ---------- dispatcher ----------

export function GeoFigureView({ figure }: { figure: GeoFigure }) {
  switch (figure.kind) {
    case 'parallelLines':
      return <ParallelLines givenPos={figure.givenPos} askPos={figure.askPos} acute={figure.acute} />
    case 'rightTriangle':
      return <RightTriangle a={figure.a} b={figure.b} c={figure.c} />
    case 'triangleAngles':
      return <TriangleAngles angles={figure.angles} />
    case 'triangleSides':
      return <TriangleSides sides={figure.sides} ticks={figure.ticks} />
    case 'circle':
      return <Circle label={figure.label} which={figure.which} />
    case 'quad':
      return <Quad shape={figure.shape} labels={figure.labels} />
    case 'coordPair':
      return <CoordPair x1={figure.x1} y1={figure.y1} x2={figure.x2} y2={figure.y2} />
    case 'box':
      return <Box l={figure.l} w={figure.w} h={figure.h} />
  }
}
