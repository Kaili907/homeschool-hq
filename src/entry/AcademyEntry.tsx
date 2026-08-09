import { useEffect, useState, type ReactNode } from 'react'

const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function canRenderEntryVideo(reducedMotion: boolean, loadFailed: boolean): boolean {
  return !reducedMotion && !loadFailed
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia(MOTION_QUERY).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(MOTION_QUERY)
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reduced
}

interface AcademyEntryBackgroundProps {
  motionPreference?: 'reduce' | 'no-preference'
}

export function AcademyEntryBackground({ motionPreference }: AcademyEntryBackgroundProps) {
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = motionPreference ? motionPreference === 'reduce' : prefersReducedMotion
  const [loadFailed, setLoadFailed] = useState(false)

  return (
    <div className="academy-entry-media" aria-hidden="true">
      <div className="academy-entry-poster" />
      {canRenderEntryVideo(reducedMotion, loadFailed) && (
        <video
          className="academy-entry-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/media/manuel-academy-entry-space-poster.webp"
          tabIndex={-1}
          onError={() => setLoadFailed(true)}
        >
          <source src="/media/manuel-academy-entry-space-loop.mp4" type="video/mp4" />
        </video>
      )}
      <div className="academy-entry-scrim" />
      <div className="academy-entry-vignette" />
    </div>
  )
}

export function AcademyMonogram({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`academy-monogram${compact ? ' academy-monogram--compact' : ''}`} aria-hidden="true">
      <span>M</span>
    </div>
  )
}

export function AcademyBrand({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`academy-brand${compact ? ' academy-brand--compact' : ''}`}>
      <AcademyMonogram compact={compact} />
      <h1>Manuel Academy</h1>
      {!compact && <p>Private Education. Purpose Driven.</p>}
      <div className="academy-brand-rule" aria-hidden="true"><span /></div>
    </header>
  )
}

export function AcademyEntryShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`academy-entry-root ${className}`}>
      <AcademyEntryBackground />
      <div className="academy-entry-foreground">{children}</div>
    </div>
  )
}
