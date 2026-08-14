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
window.__familyDashboardEvents = []
const record = (event: string) => window.__familyDashboardEvents.push(event)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudentDashboard
      model={studentDashboardFixture(state)}
      jarvis={{
        mode: 'visual-only',
        status: 'Jarvis is visual only. Tutor is not connected in this release.',
        onActivate: withJarvisCallback ? () => record('jarvis:activate') : undefined,
      }}
      onOpenWork={(workRef) => record(`work:${workRef}`)}
      onOpenCourse={(courseRef) => record(`course:${courseRef}`)}
      onOpenSchedule={() => record('schedule')}
      onOpenTool={(toolRef) => record(`tool:${toolRef}`)}
      onSignOut={() => record('sign-out')}
    />
  </StrictMode>,
)
