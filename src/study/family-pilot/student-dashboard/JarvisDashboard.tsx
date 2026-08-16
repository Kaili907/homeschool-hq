import { useState } from 'react'
import type { JarvisDashboardProps } from './types'

export function JarvisDashboard({ mode, status, onActivate }: JarvisDashboardProps) {
  const [activationNotice, setActivationNotice] = useState<string | null>(null)

  const activate = () => {
    if (onActivate) {
      onActivate()
      return
    }
    setActivationNotice(status)
  }

  return (
    <aside className="family-dashboard__jarvis family-dashboard__panel" aria-labelledby="family-dashboard-jarvis-heading">
      <div className="family-dashboard__jarvis-heading">
        <div>
          <p className="family-dashboard__eyebrow">Academy display</p>
          <h2 id="family-dashboard-jarvis-heading">Jarvis</h2>
        </div>
        <span className="family-dashboard__jarvis-state">{mode === 'visual-only' ? 'Visual only' : 'Tutor V2'}</span>
      </div>
      <button
        type="button"
        className="family-dashboard__jarvis-control"
        aria-label={`Jarvis. ${status}`}
        aria-describedby="family-dashboard-jarvis-status"
        data-jarvis-mode={mode}
        onClick={activate}
      >
        <span className="family-dashboard__jarvis-core" aria-hidden="true">
          <span className="family-dashboard__jarvis-halo" />
          <span className="family-dashboard__jarvis-outer-detail" />
          <span className="family-dashboard__jarvis-secondary-orbit" />
          <span className="family-dashboard__jarvis-primary-ring" />
          <span className="family-dashboard__jarvis-nucleus">
            <span className="family-dashboard__jarvis-monogram">M</span>
          </span>
        </span>
      </button>
      <p id="family-dashboard-jarvis-status" className="family-dashboard__jarvis-copy">{status}</p>
      <span className="family-dashboard__sr-only" role="status" aria-live="polite">
        {activationNotice}
      </span>
    </aside>
  )
}
