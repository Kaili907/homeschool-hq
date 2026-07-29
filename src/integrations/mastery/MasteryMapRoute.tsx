import { StudentMasteryMap } from '../../../app/features/mastery/StudentMasteryMap.tsx'
import '../../../app/features/mastery/mastery.css'
import {
  authorizeLearnerMasteryRoute,
  type MasteryHostPrincipal,
} from './access'
import {
  buildLearnerMasteryDashboard,
  emptyMasterySnapshot,
  type MasteryLearnerIdentity,
} from './model'
import './masteryHost.css'

interface MasteryMapRouteProps {
  readonly learner: MasteryLearnerIdentity
  readonly activeProfileId: string | null
  readonly principal: MasteryHostPrincipal
  readonly onBackHome: () => void
  readonly onFailClosed: () => void
  readonly nowISO?: () => string
}

const currentISO = () => new Date().toISOString()

export function MasteryMapRoute({
  learner,
  activeProfileId,
  principal,
  onBackHome,
  onFailClosed,
  nowISO = currentISO,
}: MasteryMapRouteProps) {
  const access = authorizeLearnerMasteryRoute(
    principal,
    activeProfileId,
    learner.id,
  )

  if (!access.allowed) {
    return (
      <main className="mastery-host-denied">
        <section aria-labelledby="mastery-access-heading">
          <p>Manuel Academy · Mastery intelligence</p>
          <h1 id="mastery-access-heading">Mastery map access denied</h1>
          <p>
            Re-enter through the learner profile and complete its PIN check.
            Persisted profile state is never treated as a fresh login.
          </p>
          <button type="button" onClick={onFailClosed}>
            Return to profile picker
          </button>
        </section>
      </main>
    )
  }

  const model = buildLearnerMasteryDashboard(
    learner,
    emptyMasterySnapshot(nowISO()),
  )

  return (
    <main className="ma-mastery" id="mastery-main" tabIndex={-1}>
      <a className="ma-mastery__skip-link" href="#mastery-content">
        Skip to mastery content
      </a>
      <div className="ma-mastery__shell">
        <header className="ma-mastery__command-bar">
          <div className="ma-mastery__identity">
            <div className="ma-mastery__core" aria-hidden="true">
              <span />
              <strong>M</strong>
            </div>
            <div>
              <p className="ma-mastery-eyebrow">
                Manuel Academy · Mastery intelligence
              </p>
              <h1>Learning signal map</h1>
              <p>
                Learner-scoped view for {model.learner.displayName} ·{' '}
                {model.learner.gradeBand}
              </p>
            </div>
          </div>
          <button
            className="mastery-host__back"
            type="button"
            onClick={onBackHome}
          >
            Back home
          </button>
        </header>

        <div className="ma-mastery__principle" role="note">
          <strong>Foundation connected; production data is not configured.</strong>
          <span>
            No host progress, completion, attendance, schedule, assessment,
            tutor, or adult-approval value is converted into mastery evidence.
            A validated catalog and sidecar persistence must be approved before
            learner records appear here.
          </span>
        </div>

        <div id="mastery-content" tabIndex={-1}>
          <StudentMasteryMap model={model} />
        </div>
      </div>
    </main>
  )
}
