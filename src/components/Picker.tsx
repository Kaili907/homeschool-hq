import type { AppState } from '../types'
import { AcademyBrand, AcademyEntryShell } from '../entry/AcademyEntry'
import { LEARNER_PRESENTATIONS } from '../entry/learnerPresentation'

export interface PickerProps {
  state: AppState
  migrationBanner?: { onDownload: () => void; onDismiss: () => void }
  onStudentSelect: (profileId: string) => void
  onParentLogin: () => void
  /** Supplied only by the future admin-owned route composition or visual fixtures. */
  onAdminLogin?: () => void
}

export function Picker({
  state,
  migrationBanner,
  onStudentSelect,
  onParentLogin,
  onAdminLogin,
}: PickerProps) {
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
                onClick={() => onStudentSelect(learner.profileId)}
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

        <div
          className="academy-entry-actions"
          aria-label={onAdminLogin ? 'Parent and administrator entry' : 'Parent entry'}
        >
          <button type="button" onClick={onParentLogin} className="academy-parent-login">
            <span className="academy-parent-login-icon" aria-hidden="true">◇</span>
            <span>Parent Login</span>
            <span aria-hidden="true">→</span>
          </button>

          {onAdminLogin && (
            <div className="academy-admin-entry">
              <button type="button" className="academy-admin-login" onClick={onAdminLogin}>
                Admin Login
              </button>
            </div>
          )}
        </div>
      </main>
    </AcademyEntryShell>
  )
}
