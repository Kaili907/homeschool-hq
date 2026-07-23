import { useState } from 'react'
import { useTheme } from '../theme'

interface PinPadProps {
  title: string
  subtitle?: string
  /** Return an error message to reject (pad shakes + clears), or null to accept. */
  onComplete: (pin: string) => string | null
  onCancel: () => void
}

export function PinPad({ title, subtitle, onComplete, onCancel }: PinPadProps) {
  const t = useTheme()
  const [digits, setDigits] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)

  function press(d: string) {
    if (digits.length >= 4) return
    const next = digits + d
    setDigits(next)
    setError('')
    if (next.length === 4) {
      const err = onComplete(next)
      if (err) {
        setError(err)
        setShake((s) => s + 1)
        setDigits('')
      } else {
        setDigits('')
      }
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center px-4 py-8">
      <div className={`${t.card} w-full p-6 text-center`}>
        <h1 className={`text-2xl font-extrabold ${t.heading}`}>{title}</h1>
        {subtitle && <p className={`mt-1 text-sm font-semibold ${t.sub}`}>{subtitle}</p>}

        <div key={shake} className={`mt-5 flex justify-center gap-3 ${shake ? 'animate-wiggle' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-5 w-5 rounded-full border-2 ${
                i < digits.length
                  ? 'border-transparent bg-current text-slate-700'
                  : 'border-slate-300 bg-transparent'
              }`}
            />
          ))}
        </div>
        <div className="mt-2 min-h-6 text-sm font-bold text-rose-500">{error}</div>

        <div className="mx-auto mt-2 grid w-56 grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => press(d)}
              className={`${t.choiceIdle} py-4 text-2xl font-extrabold`}
            >
              {d}
            </button>
          ))}
          <button
            onClick={onCancel}
            className={`${t.secondaryBtn} py-4 text-sm`}
          >
            Back
          </button>
          <button onClick={() => press('0')} className={`${t.choiceIdle} py-4 text-2xl font-extrabold`}>
            0
          </button>
          <button
            onClick={() => setDigits(digits.slice(0, -1))}
            className={`${t.secondaryBtn} py-4 text-xl`}
            aria-label="delete digit"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  )
}
