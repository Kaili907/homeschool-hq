import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../../../migration'
import { enrollInCatalog, startLesson } from '../../../academy/academyState'
import type { AcademyCatalog, AcademySchedule } from '../../../academy/contentTypes'
import { StudentDashboard } from './StudentDashboard'

const dashboardStyles = readFileSync(new URL('./studentDashboard.css', import.meta.url), 'utf8')

const MATH = 'ma-g5-mathematics-u01-l01'
const ELA = 'ma-g7-english-language-arts-u01-l01'
const NOW = '2026-08-03T09:00:00.000Z'

const catalog: AcademyCatalog = {
  releaseVersion: '1.0.0', grade: '5', courses: [
    { courseId: 'ma-g5-mathematics', subject: 'mathematics', lessonCount: 1, units: [{ unitId: 'ma-g5-mathematics-u01', unitNumber: 1, title: 'Fractions', days: 1, essentialQuestion: 'Why?', performanceTask: 'Work', lessonIds: [MATH], hasAssessment: false }] },
    { courseId: 'ma-g7-english-language-arts', subject: 'english-language-arts', lessonCount: 1, units: [{ unitId: 'ma-g7-english-language-arts-u01', unitNumber: 1, title: 'Reading', days: 1, essentialQuestion: 'Why?', performanceTask: 'Work', lessonIds: [ELA], hasAssessment: false }] },
  ],
}
const schedule: AcademySchedule = { releaseVersion: '1.0.0', grade: '5', days: [{ week: 1, day: 1, lessons: [{ lessonId: MATH, title: 'Fractions in context' }, { lessonId: ELA, title: 'Evidence in a text' }] }] }

function renderDashboard() {
  let profile = enrollInCatalog(emptyProfile('p1', 'Avery Student', '6'), catalog, NOW)
  profile = startLesson(profile, ELA, NOW)
  return renderToStaticMarkup(
    <StudentDashboard
      profile={profile}
      catalog={catalog}
      schedule={schedule}
      levelOf={{ 'ma-g5-mathematics': '5', 'ma-g7-english-language-arts': '7' }}
      schoolYear={undefined}
      today="2026-08-03"
      onNavigate={() => {}}
      onExit={() => {}}
    />,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('StudentDashboard', () => {
  it('renders current learner context, mixed course levels, and text status labels', () => {
    const html = renderDashboard()
    expect(html).toContain('Hello, Avery')
    expect(html).toContain('Mathematics · Grade 5')
    expect(html).toContain('English Language Arts · Grade 7')
    expect(html).toContain('Not started')
    expect(html).toContain('In progress')
    expect(html).toContain('aria-label="Fractions in context, Not started"')
    expect(html).toContain('aria-label="Evidence in a text, In progress"')
  })

  it('keeps Jarvis static and does not initiate network behavior', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const html = renderDashboard()
    expect(fetch).not.toHaveBeenCalled()
    expect(html).toContain('Jarvis')
    expect(html).toContain('Visual foundation')
    expect(html).toContain('not available for conversations')
  })

  it('retains essential Jarvis and status content when motion is reduced', () => {
    expect(dashboardStyles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(dashboardStyles).toContain('animation: none')
    const html = renderDashboard()
    expect(html).toContain('Jarvis is not available for conversations on this dashboard yet.')
    expect(html).toContain('In progress')
  })
})
