import type { LearnerSessionCheck, LearnerSessionController } from './learnerSession'
import type { SecurityClock } from './runtime'

export const FOREGROUND_EXPIRATION_CHECK_INTERVAL_MS = 60_000
export const WHEEL_GESTURE_QUIET_PERIOD_MS = 2_000
/** @deprecated Scroll events no longer authorize learner activity. */
export const MEANINGFUL_SCROLL_THROTTLE_MS = 1_000
/** @deprecated Scroll events no longer authorize learner activity. */
export const TRUSTED_SCROLL_INTENT_WINDOW_MS = 1_000

export interface ActivityEventTarget {
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

export interface ActivityScheduler {
  setInterval(callback: () => void, intervalMs: number): unknown
  clearInterval(handle: unknown): void
}

export interface ActivityTimeoutScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(handle: unknown): void
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
  /** @deprecated Retained for source compatibility; scroll events use no clock authority. */
  readonly clock?: SecurityClock
  readonly scheduler?: ActivityScheduler
  readonly wheelGestureScheduler?: ActivityTimeoutScheduler
  /** Test seam; browser production uses Event.isTrusted. */
  readonly isTrustedActivity?: (event: Event) => boolean
  readonly supportsPointerEvents?: boolean
  /** @deprecated Scroll events no longer authorize learner activity. */
  readonly scrollPosition?: () => LearnerScrollPosition | null
  readonly foregroundCheckIntervalMs?: number
  /** @deprecated Scroll events no longer authorize learner activity. */
  readonly scrollThrottleMs?: number
  readonly wheelGestureQuietPeriodMs?: number
  readonly onSessionCheck?: (result: LearnerSessionCheck) => void
}

const browserScheduler: ActivityScheduler = {
  setInterval: (callback, intervalMs) => globalThis.setInterval(callback, intervalMs),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
}

const browserTimeoutScheduler: ActivityTimeoutScheduler = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/** Accounts only explicit, visible-document learner activity. */
export class LearnerActivityController {
  readonly #session: LearnerSessionController
  readonly #documentEvents: ActivityEventTarget
  readonly #pageEvents: ActivityEventTarget
  readonly #visibility: () => DocumentVisibilityState
  readonly #scheduler: ActivityScheduler
  readonly #wheelGestureScheduler: ActivityTimeoutScheduler
  readonly #isTrustedActivity: (event: Event) => boolean
  readonly #pointerActivityType: 'pointerdown' | 'touchstart'
  readonly #foregroundCheckIntervalMs: number
  readonly #wheelGestureQuietPeriodMs: number
  readonly #onSessionCheck?: (result: LearnerSessionCheck) => void
  #interval: unknown = null
  #wheelGestureTimeout: unknown = null
  #wheelGestureActive = false
  #started = false

  readonly #onDirectActivity: EventListener = (event) => {
    if (!this.#isTrustedActivity(event)) return
    this.#recordVisibleActivity()
  }
  readonly #onPointerActivity: EventListener = (event) => {
    if (!this.#isTrustedActivity(event)) return
    this.#recordVisibleActivity()
  }
  readonly #onWheelActivity: EventListener = (event) => {
    if (!this.#isTrustedActivity(event)) return
    if (this.#visibility() !== 'visible') return
    if (!this.#wheelGestureActive) {
      this.#wheelGestureActive = true
      this.#recordVisibleActivity()
    }
    this.#scheduleWheelGestureEnd()
  }
  readonly #onVisibilityChange: EventListener = () => {
    if (this.#visibility() === 'visible') {
      this.#report(this.#session.recheck())
    } else {
      this.#report(this.#session.flushActivity())
    }
  }
  readonly #onForegroundBoundary: EventListener = () => {
    if (this.#visibility() === 'visible') {
      this.#report(this.#session.recheck())
    }
  }

  constructor(options: LearnerActivityControllerOptions) {
    this.#session = options.session
    this.#documentEvents = options.documentEvents
    this.#pageEvents = options.pageEvents
    this.#visibility = options.visibility
    this.#scheduler = options.scheduler ?? browserScheduler
    this.#wheelGestureScheduler = options.wheelGestureScheduler ?? browserTimeoutScheduler
    this.#isTrustedActivity = options.isTrustedActivity ?? ((event) => event.isTrusted)
    this.#pointerActivityType = (options.supportsPointerEvents ?? typeof globalThis.PointerEvent !== 'undefined')
      ? 'pointerdown'
      : 'touchstart'
    this.#foregroundCheckIntervalMs = options.foregroundCheckIntervalMs ?? FOREGROUND_EXPIRATION_CHECK_INTERVAL_MS
    this.#wheelGestureQuietPeriodMs = options.wheelGestureQuietPeriodMs ?? WHEEL_GESTURE_QUIET_PERIOD_MS
    this.#onSessionCheck = options.onSessionCheck
    if (
      this.#foregroundCheckIntervalMs <= 0 ||
      this.#wheelGestureQuietPeriodMs <= 0 ||
      (options.scrollThrottleMs !== undefined && options.scrollThrottleMs < 0)
    ) {
      throw new Error('Learner activity timing configuration is invalid.')
    }
  }

  start(): void {
    if (this.#started) return
    this.#started = true
    for (const type of ['keydown', 'input']) {
      this.#documentEvents.addEventListener(type, this.#onDirectActivity)
    }
    this.#documentEvents.addEventListener(this.#pointerActivityType, this.#onPointerActivity)
    this.#documentEvents.addEventListener('wheel', this.#onWheelActivity)
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
    this.#documentEvents.removeEventListener(this.#pointerActivityType, this.#onPointerActivity)
    this.#documentEvents.removeEventListener('wheel', this.#onWheelActivity)
    this.#documentEvents.removeEventListener('visibilitychange', this.#onVisibilityChange)
    this.#pageEvents.removeEventListener('focus', this.#onForegroundBoundary)
    this.#pageEvents.removeEventListener('pageshow', this.#onForegroundBoundary)
    if (this.#interval !== null) this.#scheduler.clearInterval(this.#interval)
    this.#interval = null
    this.#clearWheelGesture()
    this.#session.flushActivity()
  }

  #recordVisibleActivity(): void {
    if (this.#visibility() !== 'visible') return
    this.#report(this.#session.noteMeaningfulActivity())
  }

  #scheduleWheelGestureEnd(): void {
    if (this.#wheelGestureTimeout !== null) {
      this.#wheelGestureScheduler.clearTimeout(this.#wheelGestureTimeout)
    }
    this.#wheelGestureTimeout = this.#wheelGestureScheduler.setTimeout(() => {
      this.#wheelGestureTimeout = null
      this.#wheelGestureActive = false
    }, this.#wheelGestureQuietPeriodMs)
  }

  #clearWheelGesture(): void {
    if (this.#wheelGestureTimeout !== null) {
      this.#wheelGestureScheduler.clearTimeout(this.#wheelGestureTimeout)
    }
    this.#wheelGestureTimeout = null
    this.#wheelGestureActive = false
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
    supportsPointerEvents: typeof window.PointerEvent !== 'undefined',
    onSessionCheck,
  })
}
