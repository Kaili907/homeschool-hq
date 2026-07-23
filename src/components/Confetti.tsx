import { useMemo } from 'react'

const COLORS = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

/** Full-screen confetti burst. Re-renders (and replays) whenever `burst` changes. */
export function Confetti({ burst }: { burst: number }) {
  const pieces = useMemo(() => {
    if (!burst) return []
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.4 + Math.random() * 1.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 8 + Math.random() * 8,
      round: Math.random() < 0.4,
    }))
  }, [burst])

  if (!burst) return null
  return (
    <div key={burst} className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 0.6),
            backgroundColor: p.color,
            borderRadius: p.round ? '50%' : '2px',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
