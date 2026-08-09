import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AcademyEntryBackground, canRenderEntryVideo } from './AcademyEntry'

describe('Academy entry background media', () => {
  it('uses the approved decorative native video behavior', () => {
    const html = renderToStaticMarkup(<AcademyEntryBackground motionPreference="no-preference" />)

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('<video')
    expect(html).toContain('autoPlay=""')
    expect(html).toContain('muted=""')
    expect(html).toContain('loop=""')
    expect(html).toContain('playsInline=""')
    expect(html).not.toContain('controls=')
    expect(html).toContain('/media/manuel-academy-entry-space-loop.mp4')
    expect(html).toContain('/media/manuel-academy-entry-space-poster.webp')
  })

  it('omits looping media under reduced motion while retaining the static fallback', () => {
    const html = renderToStaticMarkup(<AcademyEntryBackground motionPreference="reduce" />)

    expect(html).not.toContain('<video')
    expect(html).toContain('academy-entry-poster')
    expect(canRenderEntryVideo(true, false)).toBe(false)
  })

  it('falls back without blocking the branded surface after a load failure', () => {
    expect(canRenderEntryVideo(false, true)).toBe(false)
    expect(canRenderEntryVideo(false, false)).toBe(true)
  })
})
