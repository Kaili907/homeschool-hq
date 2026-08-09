import { useEffect, useRef } from 'react'
import type { AppState } from '../types'
import { AcademyBrand } from '../entry/AcademyEntry'
import { restoreChooserFocus } from '../entry/focus'
import { LEARNER_PROFILE_ORDER, learnerPresentationForProfile } from '../entry/learnerPresentation'

export type PickerFocusTarget =
  | { kind: 'learner'; profileId: string }
  | { kind: 'parent' }
  | { kind: 'heading' }

export interface PickerProps {
  state: AppState
  migrationBanner?: { onDownload: () => void; onDismiss: () => void }
  onStudentSelect: (profileId: string) => void
  onParentLogin: () => void
  restoreFocusTo?: PickerFocusTarget
  /** Supplied only by the future admin-owned route composition or visual fixtures. */
  onAdminLogin?: () => void
}

export function Picker({
  state,
  migrationBanner,
  onStudentSelect,
  onParentLogin,
  restoreFocusTo,
  onAdminLogin,
}: PickerProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const learnerRefs = useRef(new Map<string, HTMLButtonElement>())
  const desktopParentRef = useRef<HTMLButtonElement>(null)
  const compactParentRef = useRef<HTMLButtonElement>(null)
  const learners = LEARNER_PROFILE_ORDER.flatMap((profileId) => {
    const profile = state.profiles[profileId]
    return profile ? [learnerPresentationForProfile(profile)] : []
  })

  useEffect(() => {
    const target = restoreFocusTo ?? { kind: 'heading' as const }
    const element = target.kind === 'learner'
      ? learnerRefs.current.get(target.profileId)
      : target.kind === 'parent'
        ? (window.matchMedia?.('(max-width: 1179px)').matches
            ? compactParentRef.current
            : desktopParentRef.current)
        : headingRef.current
    restoreChooserFocus(element, headingRef.current)
  }, [restoreFocusTo])

  return (
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
          <h2 id="learner-heading" ref={headingRef} tabIndex={-1}>Who&rsquo;s learning today?</h2>
          <div className="academy-heading-rule" aria-hidden="true" />

          <button
            type="button"
            ref={compactParentRef}
            onClick={onParentLogin}
            className="academy-parent-login academy-parent-login--compact"
          >
            <span className="academy-parent-login-icon" aria-hidden="true">◇</span>
            <span>Parent Login</span>
            <span aria-hidden="true">→</span>
          </button>

          <div className="academy-learner-grid">
            {learners.map((learner) => (
              <button
                type="button"
                key={learner.profileId}
                ref={(element) => {
                  if (element) learnerRefs.current.set(learner.profileId, element)
                  else learnerRefs.current.delete(learner.profileId)
                }}
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
          <button
            type="button"
            ref={desktopParentRef}
            onClick={onParentLogin}
            className="academy-parent-login academy-parent-login--desktop"
          >
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
  )
}
