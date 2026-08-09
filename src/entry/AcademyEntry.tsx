import { useEffect, useState, type ReactNode } from 'react'

const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const ENTRY_POSTER = '/media/manuel-academy-entry-space-poster.webp'

export function canRenderEntryVideo(reducedMotion: boolean, saveData: boolean, loadFailed: boolean): boolean {
  return !reducedMotion && !saveData && !loadFailed
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? true
      : window.matchMedia(MOTION_QUERY).matches,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(MOTION_QUERY)
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  return reduced
}

type NavigatorWithConnection = Navigator & {
  connection?: EventTarget & { saveData?: boolean }
}

function getSaveDataPreference(): boolean {
  if (typeof navigator === 'undefined') return false
  return Boolean((navigator as NavigatorWithConnection).connection?.saveData)
}

function useSaveData(): boolean {
  const [saveData, setSaveData] = useState(getSaveDataPreference)

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const connection = (navigator as NavigatorWithConnection).connection
    if (!connection) return
    const update = () => setSaveData(Boolean(connection.saveData))
    update()
    connection.addEventListener?.('change', update)
    return () => connection.removeEventListener?.('change', update)
  }, [])

  return saveData
}

interface AcademyEntryBackgroundProps {
  motionPreference?: 'reduce' | 'no-preference'
  saveDataPreference?: boolean
}

interface AcademyEntryVideoProps {
  ready: boolean
  onReady: () => void
  onError: () => void
}

export function AcademyEntryVideo({ ready, onReady, onError }: AcademyEntryVideoProps) {
  return (
    <video
      className={`academy-entry-video${ready ? ' is-ready' : ''}`}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      poster={ENTRY_POSTER}
      tabIndex={-1}
      aria-hidden="true"
      onLoadedData={onReady}
      onPlaying={onReady}
      onError={onError}
    >
      <source
        src="/media/manuel-academy-entry-space-loop-720p.mp4"
        type="video/mp4"
        media="(max-width: 900px)"
      />
      <source src="/media/manuel-academy-entry-space-loop.mp4" type="video/mp4" />
    </video>
  )
}

export function AcademyEntryBackground({ motionPreference, saveDataPreference }: AcademyEntryBackgroundProps) {
  const prefersReducedMotion = useReducedMotion()
  const prefersSaveData = useSaveData()
  const reducedMotion = motionPreference ? motionPreference === 'reduce' : prefersReducedMotion
  const saveData = saveDataPreference ?? prefersSaveData
  const [loadFailed, setLoadFailed] = useState(false)
  const [videoRequested, setVideoRequested] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const videoAllowed = canRenderEntryVideo(reducedMotion, saveData, loadFailed)

  useEffect(() => {
    if (!videoAllowed) {
      setVideoRequested(false)
      setVideoReady(false)
      return
    }

    let cancelled = false
    let frame = 0
    const requestVideo = () => {
      if (!cancelled) setVideoRequested(true)
    }

    if (typeof window.requestAnimationFrame === 'function') {
      frame = window.requestAnimationFrame(requestVideo)
    } else {
      frame = window.setTimeout(requestVideo, 0)
    }

    return () => {
      cancelled = true
      if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame)
      else window.clearTimeout(frame)
    }
  }, [videoAllowed])

  return (
    <div className="academy-entry-media" aria-hidden="true">
      <div className="academy-entry-poster" />
      {videoAllowed && videoRequested && (
        <AcademyEntryVideo
          ready={videoReady}
          onReady={() => setVideoReady(true)}
          onError={() => setLoadFailed(true)}
        />
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
