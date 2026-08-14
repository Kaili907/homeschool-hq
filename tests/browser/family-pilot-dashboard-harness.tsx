import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  StudentDashboard,
  studentDashboardFixture,
  type StudentDashboardMissionState,
} from '../../src/study/family-pilot/student-dashboard'

declare global {
  interface Window {
    __familyDashboardEvents: string[]
  }
}

const params = new URLSearchParams(window.location.search)
const state = (params.get('state') || 'lesson-ready') as StudentDashboardMissionState
const withJarvisCallback = params.get('jarvisCallback') === 'true'
const launchFailure = params.get('launchFailure') === 'true'
const launchDelay = Number(params.get('launchDelay') ?? 0)
window.__familyDashboardEvents = []
const record = (event: string) => window.__familyDashboardEvents.push(event)

const openWork = async (workRef: string) => {
  record(`launch-attempt:${workRef}`)
  if (launchDelay > 0) await new Promise((resolve) => window.setTimeout(resolve, launchDelay))
  if (launchFailure) throw new Error('TECHNICAL_LAUNCH_CODE_42')
  record(`work:${workRef}`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudentDashboard
      model={studentDashboardFixture(state)}
      jarvis={{
        mode: 'visual-only',
        status: 'Jarvis is visual only. Tutor is not connected in this release.',
        onActivate: withJarvisCallback ? () => record('jarvis:activate') : undefined,
      }}
      onOpenWork={openWork}
      onOpenCourse={(courseRef) => record(`course:${courseRef}`)}
      onOpenSchedule={() => record('schedule')}
      onOpenTool={(toolRef) => record(`tool:${toolRef}`)}
      onSignOut={() => record('sign-out')}
    />
  </StrictMode>,
)
