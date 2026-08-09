export interface EntryFocusElement {
  focus(options?: FocusOptions): void
  scrollIntoView?(options?: ScrollIntoViewOptions): void
}

/** Forward entry navigation starts at the new meaningful heading, never retained deep scroll. */
export function focusPinHeading(
  heading: EntryFocusElement | null,
  resetScroll: () => void = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }),
): void {
  resetScroll()
  heading?.focus({ preventScroll: true })
}

/** Back navigation restores its initiating control, with the chooser heading as a safe fallback. */
export function restoreChooserFocus(
  requested: EntryFocusElement | null | undefined,
  fallback: EntryFocusElement | null,
): void {
  const target = requested ?? fallback
  target?.focus({ preventScroll: true })
  target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
}
