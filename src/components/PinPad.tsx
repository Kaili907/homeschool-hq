import { useEffect, useRef, useState } from 'react'
import { AcademyBrand } from '../entry/AcademyEntry'
import { focusPinHeading } from '../entry/focus'
import type { LearnerPresentation } from '../entry/learnerPresentation'

interface PinPadProps {
  title: string
  subtitle?: string
  learner?: LearnerPresentation
  backLabel?: string
  /** Return an error message to reject (pad shakes + clears), or null to accept. */
  onComplete: (pin: string) => string | null
  onCancel: () => void
}

export function PinPad({ title, subtitle, learner, backLabel, onComplete, onCancel }: PinPadProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [digits, setDigits] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)

  useEffect(() => {
    focusPinHeading(headingRef.current)
  }, [title])

  function press(digit: string) {
    if (digits.length >= 4) return
    const next = digits + digit
    setDigits(next)
    setError('')
    if (next.length === 4) {
      const completionError = onComplete(next)
      if (completionError) {
        setError(completionError)
        setShake((value) => value + 1)
        setDigits('')
      } else {
        setDigits('')
      }
    }
  }

  function deleteDigit() {
    setDigits((value) => value.slice(0, -1))
    setError('')
  }

  return (
    <main className="academy-pin-page">
      <AcademyBrand compact />
      <section className="academy-pin-panel" aria-labelledby="pin-title">
        {learner && (
          <div className="academy-pin-identity">
            <span className="academy-portrait academy-portrait--pin" aria-hidden="true">
              {learner.portraitSrc ? <img src={learner.portraitSrc} alt="" /> : <span>{learner.initials}</span>}
            </span>
          </div>
        )}
        <h2 id="pin-title" ref={headingRef} tabIndex={-1}>{title}</h2>
        {learner && <p className="academy-pin-grade">{learner.gradeLabel}</p>}
        {subtitle && <p className="academy-pin-instruction">{subtitle}</p>}

        <div
          key={shake}
          className={`academy-pin-dots${shake ? ' academy-pin-dots--error' : ''}`}
          role="status"
          aria-live="polite"
          aria-label={`${digits.length} of 4 PIN digits entered`}
        >
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className={index < digits.length ? 'is-filled' : ''} aria-hidden="true" />
          ))}
        </div>
        <p className="academy-pin-error" role="alert">{error}</p>

        <div className="academy-keypad" aria-label="PIN keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button type="button" key={digit} onClick={() => press(digit)} aria-label={`Digit ${digit}`}>
              {digit}
            </button>
          ))}
          <button type="button" onClick={deleteDigit} className="academy-keypad-secondary" aria-label="Delete last digit">
            <svg className="academy-backspace-icon" viewBox="0 0 28 20" aria-hidden="true" focusable="false">
              <path d="M10 2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H10L2 10 10 2Z" />
              <path d="m14 7 6 6m0-6-6 6" />
            </svg>
          </button>
          <button type="button" onClick={() => press('0')} aria-label="Digit 0">0</button>
          <button type="button" onClick={() => setDigits('')} className="academy-keypad-secondary" aria-label="Clear PIN">
            <span aria-hidden="true">Clear</span>
          </button>
        </div>

        <button type="button" onClick={onCancel} className="academy-pin-back">
          <span aria-hidden="true">←</span>
          {backLabel ?? (learner ? 'Back to learners' : 'Back')}
        </button>
      </section>
    </main>
  )
}
