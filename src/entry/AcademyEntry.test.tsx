import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AcademyEntryBackground, AcademyEntryVideo, canRenderEntryVideo } from './AcademyEntry'

describe('Academy entry background media', () => {
  it('uses the approved decorative native video behavior and responsive source order', () => {
    const html = renderToStaticMarkup(<AcademyEntryVideo ready={false} onReady={() => {}} onError={() => {}} />)

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('<video')
    expect(html).toContain('autoPlay=""')
    expect(html).toContain('muted=""')
    expect(html).toContain('loop=""')
    expect(html).toContain('playsInline=""')
    expect(html).toContain('preload="none"')
    expect(html).not.toContain('controls=')
    expect(html).toContain('/media/manuel-academy-entry-space-loop-720p.mp4')
    expect(html).toContain('media="(max-width: 900px)"')
    expect(html).toContain('/media/manuel-academy-entry-space-loop.mp4')
    expect(html).toContain('/media/manuel-academy-entry-space-poster.webp')
    expect(html.indexOf('space-loop-720p.mp4')).toBeLessThan(html.indexOf('space-loop.mp4'))
  })

  it('starts poster-first without mounting a video source during initial rendering', () => {
    const html = renderToStaticMarkup(
      <AcademyEntryBackground motionPreference="no-preference" saveDataPreference={false} />,
    )

    expect(html).not.toContain('<video')
    expect(html).toContain('academy-entry-poster')
  })

  it('omits looping media under reduced motion while retaining the static fallback', () => {
    const html = renderToStaticMarkup(<AcademyEntryBackground motionPreference="reduce" />)

    expect(html).not.toContain('<video')
    expect(html).toContain('academy-entry-poster')
    expect(canRenderEntryVideo(true, false, false)).toBe(false)
  })

  it('honors Save-Data and falls back without blocking the branded surface after failure', () => {
    expect(canRenderEntryVideo(false, true, false)).toBe(false)
    expect(canRenderEntryVideo(false, false, true)).toBe(false)
    expect(canRenderEntryVideo(false, false, false)).toBe(true)
  })
})
