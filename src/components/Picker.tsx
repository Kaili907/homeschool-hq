import type { AppState } from '../types'
import { AcademyBrand, AcademyEntryShell } from '../entry/AcademyEntry'
import { LEARNER_PRESENTATIONS } from '../entry/learnerPresentation'

interface PickerProps {
  state: AppState
  migrationBanner?: { onDownload: () => void; onDismiss: () => void }
  onPick: (profileId: string) => void
  onGrownUps: () => void
}

export function Picker({ state, migrationBanner, onPick, onGrownUps }: PickerProps) {
  const learners = LEARNER_PRESENTATIONS.filter((learner) => state.profiles[learner.profileId])

  return (
    <AcademyEntryShell className="academy-picker-shell">
      <main className="academy-picker">
        {migrationBanner && (
          <aside className="academy-migration" aria-label="Progress migration complete">
            <p>Your old progress was moved over safely. A backup was saved.</p>
            <div>
              <button type="button" onClick={migrationBanner.onDownload}>Download backup</button>
              <button type="button" onClick={migrationBanner.onDismiss}>Dismiss</button>
            </div>
          </aside>
        )}

        <AcademyBrand />
        <section className="academy-learner-section" aria-labelledby="learner-heading">
          <h2 id="learner-heading">Who&rsquo;s learning today?</h2>
          <div className="academy-heading-rule" aria-hidden="true" />

          <div className="academy-learner-grid">
            {learners.map((learner) => (
              <button
                type="button"
                key={learner.profileId}
                onClick={() => onPick(learner.profileId)}
                className="academy-learner-card"
                aria-label={`Continue as ${learner.fullName}, ${learner.gradeLabel}`}
              >
                <span className="academy-portrait" aria-hidden="true">
                  {learner.portraitSrc ? <img src={learner.portraitSrc} alt="" /> : <span>{learner.initials}</span>}
                </span>
                <span className="academy-learner-copy">
                  <strong>{learner.fullName}</strong>
                  <span className="academy-grade">{learner.gradeLabel}</span>
                  <span className="academy-card-brand">Manuel Academy</span>
                </span>
                <span className="academy-card-action" aria-hidden="true">Continue <span>→</span></span>
              </button>
            ))}
          </div>
        </section>

        <button type="button" onClick={onGrownUps} className="academy-grownups">
          <span className="academy-grownups-icon" aria-hidden="true">◇</span>
          <span>Grown-Ups access</span>
          <span aria-hidden="true">→</span>
        </button>
      </main>
    </AcademyEntryShell>
  )
}
