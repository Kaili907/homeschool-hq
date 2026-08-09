import type { LearnerSessionCheck, LearnerSessionController } from './learnerSession'
import { type SecurityClock, systemSecurityClock } from './runtime'

export const FOREGROUND_EXPIRATION_CHECK_INTERVAL_MS = 60_000
export const MEANINGFUL_SCROLL_THROTTLE_MS = 1_000
export const TRUSTED_SCROLL_INTENT_WINDOW_MS = 1_000

export interface ActivityEventTarget {
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

export interface ActivityScheduler {
  setInterval(callback: () => void, intervalMs: number): unknown
  clearInterval(handle: unknown): void
}

export interface LearnerScrollPosition {
  readonly x: number
  readonly y: number
}

export interface LearnerActivityControllerOptions {
  readonly session: LearnerSessionController
  readonly documentEvents: ActivityEventTarget
  readonly pageEvents: ActivityEventTarget
  readonly visibility: () => DocumentVisibilityState
  readonly clock?: SecurityClock
  readonly scheduler?: ActivityScheduler
  /** Test seam; browser production uses Event.isTrusted. */
  readonly isTrustedActivity?: (event: Event) => boolean
  readonly scrollPosition?: () => LearnerScrollPosition | null
  readonly foregroundCheckIntervalMs?: number
  readonly scrollThrottleMs?: number
  readonly onSessionCheck?: (result: LearnerSessionCheck) => void
}

const browserScheduler: ActivityScheduler = {
  setInterval: (callback, intervalMs) => globalThis.setInterval(callback, intervalMs),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
}

/** Accounts only explicit, visible-document learner activity. */
export class LearnerActivityController {
  readonly #session: LearnerSessionController
  readonly #documentEvents: ActivityEventTarget
  readonly #pageEvents: ActivityEventTarget
  readonly #visibility: () => DocumentVisibilityState
  readonly #clock: SecurityClock
  readonly #scheduler: ActivityScheduler
  readonly #isTrustedActivity: (event: Event) => boolean
  readonly #scrollPosition: () => LearnerScrollPosition | null
  readonly #foregroundCheckIntervalMs: number
  readonly #scrollThrottleMs: number
  readonly #onSessionCheck?: (result: LearnerSessionCheck) => void
  #interval: unknown = null
  #started = false
  #lastScrollAt: number | null = null
  #lastScrollPosition: LearnerScrollPosition | null = null
  #scrollIntentExpiresAt: number | null = null

  readonly #onDirectActivity: EventListener = (event) => {
    if (!this.#isTrustedActivity(event)) return
    this.#recordVisibleActivity()
  }
  readonly #onPointerScrollIntent: EventListener = (event) => {
    if (!this.#isTrustedActivity(event)) return
    this.#armScrollIntent()
    this.#recordVisibleActivity()
  }
  readonly #onWheelScrollIntent: EventListener = (event) => {
    if (!this.#isTrustedActivity(event)) return
    this.#armScrollIntent()
  }
  readonly #onScroll: EventListener = (event) => {
    if (this.#visibility() !== 'visible') return
    const position = this.#readScrollPosition()
    if (!position || !this.#scrollDisplaced(position)) return
    this.#lastScrollPosition = position
    const now = this.#clock()
    if (!Number.isFinite(now)) {
      this.#scrollIntentExpiresAt = null
      this.#report(this.#session.recheck())
      return
    }
    const intentExpiresAt = this.#scrollIntentExpiresAt
    this.#scrollIntentExpiresAt = null
    // Browser-generated scroll events can be trusted even when script initiated
    // the displacement. Only a separate, recent trusted input intent authorizes
    // one displaced scroll; the scroll event's own isTrusted value is irrelevant.
    if (intentExpiresAt === null || now > intentExpiresAt) return
    const checked = this.#session.recheck()
    this.#report(checked)
    if (checked.status !== 'active') return
    if (this.#lastScrollAt !== null && now - this.#lastScrollAt < this.#scrollThrottleMs) return
    this.#lastScrollAt = now
    this.#report(this.#session.noteMeaningfulActivity())
  }
  readonly #onVisibilityChange: EventListener = () => {
    if (this.#visibility() === 'visible') {
      this.#lastScrollPosition = this.#readScrollPosition()
      this.#report(this.#session.recheck())
    } else {
      this.#scrollIntentExpiresAt = null
      this.#report(this.#session.flushActivity())
    }
  }
  readonly #onForegroundBoundary: EventListener = () => {
    if (this.#visibility() === 'visible') {
      this.#lastScrollPosition = this.#readScrollPosition()
      this.#report(this.#session.recheck())
    }
  }

  constructor(options: LearnerActivityControllerOptions) {
    this.#session = options.session
    this.#documentEvents = options.documentEvents
    this.#pageEvents = options.pageEvents
    this.#visibility = options.visibility
    this.#clock = options.clock ?? systemSecurityClock
    this.#scheduler = options.scheduler ?? browserScheduler
    this.#isTrustedActivity = options.isTrustedActivity ?? ((event) => event.isTrusted)
    this.#scrollPosition = options.scrollPosition ?? (() => null)
    this.#foregroundCheckIntervalMs = options.foregroundCheckIntervalMs ?? FOREGROUND_EXPIRATION_CHECK_INTERVAL_MS
    this.#scrollThrottleMs = options.scrollThrottleMs ?? MEANINGFUL_SCROLL_THROTTLE_MS
    this.#onSessionCheck = options.onSessionCheck
    if (
      this.#foregroundCheckIntervalMs <= 0 ||
      this.#scrollThrottleMs < 0
    ) {
      throw new Error('Learner activity timing configuration is invalid.')
    }
  }

  start(): void {
    if (this.#started) return
    this.#started = true
    this.#lastScrollPosition = this.#readScrollPosition()
    for (const type of ['keydown', 'input']) {
      this.#documentEvents.addEventListener(type, this.#onDirectActivity)
    }
    for (const type of ['pointerdown', 'touchstart']) {
      this.#documentEvents.addEventListener(type, this.#onPointerScrollIntent)
    }
    this.#documentEvents.addEventListener('wheel', this.#onWheelScrollIntent)
    this.#documentEvents.addEventListener('scroll', this.#onScroll)
    this.#documentEvents.addEventListener('visibilitychange', this.#onVisibilityChange)
    this.#pageEvents.addEventListener('focus', this.#onForegroundBoundary)
    this.#pageEvents.addEventListener('pageshow', this.#onForegroundBoundary)
    this.#interval = this.#scheduler.setInterval(() => {
      if (this.#visibility() === 'visible') this.#report(this.#session.recheck())
    }, this.#foregroundCheckIntervalMs)
  }

  approvedLearnerInteraction(): LearnerSessionCheck {
    if (this.#visibility() !== 'visible') {
      const result = this.#session.recheck()
      this.#report(result)
      return result
    }
    const result = this.#session.noteMeaningfulActivity()
    this.#report(result)
    return result
  }

  stop(): void {
    if (!this.#started) return
    this.#started = false
    for (const type of ['keydown', 'input']) {
      this.#documentEvents.removeEventListener(type, this.#onDirectActivity)
    }
    for (const type of ['pointerdown', 'touchstart']) {
      this.#documentEvents.removeEventListener(type, this.#onPointerScrollIntent)
    }
    this.#documentEvents.removeEventListener('wheel', this.#onWheelScrollIntent)
    this.#documentEvents.removeEventListener('scroll', this.#onScroll)
    this.#documentEvents.removeEventListener('visibilitychange', this.#onVisibilityChange)
    this.#pageEvents.removeEventListener('focus', this.#onForegroundBoundary)
    this.#pageEvents.removeEventListener('pageshow', this.#onForegroundBoundary)
    if (this.#interval !== null) this.#scheduler.clearInterval(this.#interval)
    this.#interval = null
    this.#scrollIntentExpiresAt = null
    this.#session.flushActivity()
  }

  #recordVisibleActivity(): void {
    if (this.#visibility() !== 'visible') return
    this.#report(this.#session.noteMeaningfulActivity())
  }

  #armScrollIntent(): void {
    if (this.#visibility() !== 'visible') return
    const now = this.#clock()
    if (!Number.isFinite(now)) {
      this.#scrollIntentExpiresAt = null
      this.#report(this.#session.recheck())
      return
    }
    this.#scrollIntentExpiresAt = now + TRUSTED_SCROLL_INTENT_WINDOW_MS
  }

  #readScrollPosition(): LearnerScrollPosition | null {
    const position = this.#scrollPosition()
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null
    return position
  }

  #scrollDisplaced(position: LearnerScrollPosition): boolean {
    return this.#lastScrollPosition !== null && (
      position.x !== this.#lastScrollPosition.x || position.y !== this.#lastScrollPosition.y
    )
  }

  #report(result: LearnerSessionCheck): void {
    this.#onSessionCheck?.(result)
  }
}

export function createBrowserLearnerActivityController(
  session: LearnerSessionController,
  onSessionCheck?: (result: LearnerSessionCheck) => void,
): LearnerActivityController {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Browser activity events are unavailable.')
  }
  return new LearnerActivityController({
    session,
    documentEvents: document,
    pageEvents: window,
    visibility: () => document.visibilityState,
    scrollPosition: () => ({ x: window.scrollX, y: window.scrollY }),
    onSessionCheck,
  })
}
