import { describe, expect, it, vi } from 'vitest'
import { focusPinHeading, restoreChooserFocus, type EntryFocusElement } from './focus'

function element() {
  const focus = vi.fn<(options?: FocusOptions) => void>()
  const scrollIntoView = vi.fn<(options?: ScrollIntoViewOptions) => void>()
  return { focus, scrollIntoView } satisfies EntryFocusElement
}

describe('entry focus and scroll policy', () => {
  it('resets retained scroll before focusing a learner or parent PIN heading', () => {
    const heading = element()
    const resetScroll = vi.fn()

    focusPinHeading(heading, resetScroll)

    expect(resetScroll).toHaveBeenCalledOnce()
    expect(heading.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('restores the initiating learner card or Parent Login and keeps it visible', () => {
    const requested = element()
    const fallback = element()

    restoreChooserFocus(requested, fallback)

    expect(requested.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(requested.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    expect(fallback.focus).not.toHaveBeenCalled()
  })

  it('uses the chooser heading when an exact initiating control is unavailable', () => {
    const fallback = element()
    restoreChooserFocus(null, fallback)
    expect(fallback.focus).toHaveBeenCalledOnce()
  })
})
