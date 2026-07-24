/**
 * SE-A typing trainer "MK" — calm, presentational QWERTY guide.
 *
 * Not interactive: this is purely a visual aid so a kid can see which
 * finger to use for the keys a lesson is focused on, and which key comes
 * next. Keys are tinted by "finger zone" (which finger reaches for them
 * on a standard touch-typing layout) so the color itself teaches the
 * habit, independent of any single lesson's focusKeys.
 */

type Zone =
  | 'left-pinky'
  | 'left-ring'
  | 'left-middle'
  | 'left-index'
  | 'right-index'
  | 'right-middle'
  | 'right-ring'
  | 'right-pinky'

const ZONE_MAP: Record<string, Zone> = {
  q: 'left-pinky',
  a: 'left-pinky',
  z: 'left-pinky',
  w: 'left-ring',
  s: 'left-ring',
  x: 'left-ring',
  e: 'left-middle',
  d: 'left-middle',
  c: 'left-middle',
  r: 'left-index',
  f: 'left-index',
  v: 'left-index',
  t: 'left-index',
  g: 'left-index',
  b: 'left-index',
  y: 'right-index',
  h: 'right-index',
  n: 'right-index',
  u: 'right-index',
  j: 'right-index',
  m: 'right-index',
  i: 'right-middle',
  k: 'right-middle',
  ',': 'right-middle',
  o: 'right-ring',
  l: 'right-ring',
  '.': 'right-ring',
  p: 'right-pinky',
  ';': 'right-pinky',
  '/': 'right-pinky',
}

const ZONE_TINT: Record<Zone, string> = {
  'left-pinky': 'bg-rose-100 border-rose-300 text-rose-900',
  'left-ring': 'bg-orange-100 border-orange-300 text-orange-900',
  'left-middle': 'bg-amber-100 border-amber-300 text-amber-900',
  'left-index': 'bg-lime-100 border-lime-300 text-lime-900',
  'right-index': 'bg-teal-100 border-teal-300 text-teal-900',
  'right-middle': 'bg-sky-100 border-sky-300 text-sky-900',
  'right-ring': 'bg-indigo-100 border-indigo-300 text-indigo-900',
  'right-pinky': 'bg-purple-100 border-purple-300 text-purple-900',
}

const ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
]

const LEGEND: { zone: Zone; label: string }[] = [
  { zone: 'left-pinky', label: 'pinky' },
  { zone: 'left-ring', label: 'ring' },
  { zone: 'left-middle', label: 'middle' },
  { zone: 'left-index', label: 'index' },
  { zone: 'right-index', label: 'index' },
  { zone: 'right-middle', label: 'middle' },
  { zone: 'right-ring', label: 'ring' },
  { zone: 'right-pinky', label: 'pinky' },
]

export interface KeyboardProps {
  /** lowercase keys the current lesson is teaching; get a highlight ring. */
  focusKeys: string[]
  /** the very next character the kid needs to press; gets a stronger pulse. */
  nextChar?: string
}

function keyMatchesNext(key: string, nextChar?: string): boolean {
  if (!nextChar) return false
  if (nextChar === ' ') return false // handled by the space bar itself
  return key === nextChar.toLowerCase()
}

export default function Keyboard({ focusKeys, nextChar }: KeyboardProps) {
  const focusSet = new Set(focusKeys.map((k) => k.toLowerCase()))
  const spaceIsNext = nextChar === ' '

  return (
    <div className="w-full select-none">
      <div className="mx-auto flex max-w-md flex-col items-center gap-1.5">
        {ROWS.map((row, i) => (
          <div key={i} className="flex w-full justify-center gap-1.5">
            {row.map((key) => {
              const zone = ZONE_MAP[key]
              const isFocus = focusSet.has(key)
              const isNext = keyMatchesNext(key, nextChar)
              return (
                <div
                  key={key}
                  className={[
                    'flex aspect-square w-8 flex-1 max-w-10 items-center justify-center rounded-lg border text-sm font-semibold shadow-sm transition-transform sm:text-base',
                    ZONE_TINT[zone],
                    isFocus ? 'ring-2 ring-offset-1 ring-slate-500' : '',
                    isNext ? 'scale-110 animate-pulse ring-2 ring-offset-1 ring-emerald-500' : '',
                  ].join(' ')}
                >
                  {key}
                </div>
              )
            })}
          </div>
        ))}
        <div
          className={[
            'mt-0.5 h-8 w-2/3 rounded-lg border border-slate-300 bg-slate-100 shadow-sm transition-transform',
            spaceIsNext ? 'scale-105 animate-pulse ring-2 ring-offset-1 ring-emerald-500' : '',
          ].join(' ')}
          aria-label="space bar"
        />
      </div>

      <div className="mx-auto mt-3 flex max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {LEGEND.map(({ zone, label }, i) => (
          <span key={`${zone}-${i}`} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-sm border ${ZONE_TINT[zone]}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
