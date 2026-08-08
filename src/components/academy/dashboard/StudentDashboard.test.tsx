import { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../../../migration'
import type { AcademyRoute } from '../../../academy/academyRoute'
import { enrollInCatalog, startLesson, submitLessonCheck } from '../../../academy/academyState'
import type { AcademyCatalog, AcademySchedule } from '../../../academy/contentTypes'
import type { Profile, SchoolYear } from '../../../types'
import { StudentDashboard } from './StudentDashboard'

const dashboardStyles = readFileSync(new URL('./studentDashboard.css', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('./StudentDashboard.tsx', import.meta.url), 'utf8')
const dashboardDataSource = readFileSync(new URL('./dashboardData.ts', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../../../App.tsx', import.meta.url), 'utf8')

const MATH = 'ma-g5-mathematics-u01-l01'
const ELA = 'ma-g7-english-language-arts-u01-l01'
const SCIENCE = 'ma-g8-science-u01-l01'
const NOW = '2026-08-03T09:00:00.000Z'
const CONFIGURED_YEAR: SchoolYear = {
  startDate: '2026-08-03', totalWeeks: 36, quarterBreaks: [9, 18, 27], offWeeks: [],
}
const OFF_WEEK_YEAR: SchoolYear = { ...CONFIGURED_YEAR, offWeeks: ['2026-08-10'] }
const AFTER_YEAR: SchoolYear = { ...CONFIGURED_YEAR, totalWeeks: 1, quarterBreaks: [] }

const catalog: AcademyCatalog = {
  releaseVersion: '1.0.0', grade: '5', courses: [
    { courseId: 'ma-g5-mathematics', subject: 'mathematics', lessonCount: 1, units: [{ unitId: 'ma-g5-mathematics-u01', unitNumber: 1, title: 'Fractions', days: 1, essentialQuestion: 'Why?', performanceTask: 'Work', lessonIds: [MATH], hasAssessment: false }] },
    { courseId: 'ma-g7-english-language-arts', subject: 'english-language-arts', lessonCount: 1, units: [{ unitId: 'ma-g7-english-language-arts-u01', unitNumber: 1, title: 'Reading', days: 1, essentialQuestion: 'Why?', performanceTask: 'Work', lessonIds: [ELA], hasAssessment: false }] },
    { courseId: 'ma-g8-science', subject: 'science', lessonCount: 1, units: [{ unitId: 'ma-g8-science-u01', unitNumber: 1, title: 'Physical Science', days: 1, essentialQuestion: 'Why?', performanceTask: 'Work', lessonIds: [SCIENCE], hasAssessment: false }] },
  ],
}
const schedule: AcademySchedule = { releaseVersion: '1.0.0', grade: '5', days: [{ week: 1, day: 1, lessons: [{ lessonId: MATH, title: 'Fractions in context' }, { lessonId: ELA, title: 'Evidence in a text' }, { lessonId: SCIENCE, title: 'Forces and motion' }] }] }

class FakeElement extends EventTarget {
  nodeType = 1
  nodeName: string
  tagName: string
  namespaceURI = 'http://www.w3.org/1999/xhtml'
  ownerDocument!: FakeDocument
  parentNode: FakeElement | null = null
  childNodes: FakeElement[] = []
  textContent = ''
  style = {}
  private attributes = new Map<string, string>()

  constructor(tag = 'div') {
    super()
    this.nodeName = tag.toUpperCase()
    this.tagName = tag.toUpperCase()
  }

  appendChild(child: FakeElement) { child.parentNode = this; this.childNodes.push(child); return child }
  insertBefore(child: FakeElement, before: FakeElement | null) {
    child.parentNode = this
    const index = before ? this.childNodes.indexOf(before) : -1
    if (index < 0) this.childNodes.push(child); else this.childNodes.splice(index, 0, child)
    return child
  }
  removeChild(child: FakeElement) {
    this.childNodes = this.childNodes.filter((item) => item !== child)
    child.parentNode = null
    return child
  }
  setAttribute(name: string, value: string) { this.attributes.set(name, String(value)) }
  removeAttribute(name: string) { this.attributes.delete(name) }
  focus() { this.ownerDocument.activeElement = this }
  get firstChild() { return this.childNodes[0] ?? null }
}

class FakeDocument extends EventTarget {
  nodeType = 9
  nodeName = '#document'
  documentElement: FakeElement
  body: FakeElement
  defaultView!: EventTarget & Record<string, unknown>
  activeElement: FakeElement

  constructor() {
    super()
    this.documentElement = new FakeElement('html')
    this.body = new FakeElement('body')
    this.documentElement.ownerDocument = this
    this.body.ownerDocument = this
    this.activeElement = this.body
  }

  createElement(tag: string) { const element = new FakeElement(tag); element.ownerDocument = this; return element }
  createElementNS(_namespace: string, tag: string) { return this.createElement(tag) }
  createTextNode(value: string) {
    const element = this.createElement('#text')
    element.nodeType = 3
    element.nodeName = '#text'
    element.textContent = value
    return element
  }
}

function elementText(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(elementText).join(' ')}`
}

function findButton(node: FakeElement, label: string): FakeElement | null {
  if (node.tagName === 'BUTTON' && elementText(node).includes(label)) return node
  for (const child of node.childNodes) {
    const found = findButton(child, label)
    if (found) return found
  }
  return null
}

function enrolledProfile() {
  return enrollInCatalog(emptyProfile('p1', 'Avery Student', '6'), catalog, NOW)
}

function activeProfile() {
  return startLesson(enrolledProfile(), ELA, NOW)
}

function staleAttempt(profile: Profile, lessonId: string) {
  const started = startLesson(profile, lessonId, NOW)
  const lesson = started.academy?.lessons[lessonId]
  if (!started.academy || !lesson) throw new Error('Expected an enrolled lesson attempt')
  return {
    ...started,
    academy: {
      ...started.academy,
      lessons: {
        ...started.academy.lessons,
        [lessonId]: { ...lesson, releaseVersion: '0.9.0' },
      },
    },
  }
}

function renderDashboard({
  profile = activeProfile(),
  dashboardCatalog = catalog,
  dashboardSchedule = schedule,
  dashboardToday = '2026-08-03',
  schoolYear,
}: {
  profile?: Profile
  dashboardCatalog?: AcademyCatalog
  dashboardSchedule?: AcademySchedule
  dashboardToday?: string
  schoolYear?: SchoolYear
} = {}) {
  return renderToStaticMarkup(
    <StudentDashboard
      profile={profile}
      catalog={dashboardCatalog}
      schedule={dashboardSchedule}
      levelOf={{ 'ma-g5-mathematics': '5', 'ma-g7-english-language-arts': '7', 'ma-g8-science': '8' }}
      schoolYear={schoolYear}
      today={dashboardToday}
      onNavigate={() => {}}
      onExit={() => {}}
    />,
  )
}

async function mountDashboard({
  profile = activeProfile(),
  dashboardSchedule = schedule,
  dashboardToday = '2026-08-03',
  schoolYear,
}: {
  profile?: Profile
  dashboardSchedule?: AcademySchedule
  dashboardToday?: string
  schoolYear?: SchoolYear
} = {}) {
  const documentTarget = new FakeDocument()
  const windowTarget = Object.assign(new EventTarget(), {
    document: documentTarget,
    setTimeout,
    clearTimeout,
    HTMLElement: FakeElement,
    HTMLIFrameElement: class {},
    getSelection: () => null,
  }) as unknown as EventTarget & Record<string, unknown>
  windowTarget.top = windowTarget
  windowTarget.self = windowTarget
  documentTarget.defaultView = windowTarget
  vi.stubGlobal('window', windowTarget)
  vi.stubGlobal('document', documentTarget)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)

  const container = documentTarget.createElement('div')
  const onNavigate = vi.fn<(route: AcademyRoute) => void>()
  const root = createRoot(container as unknown as Element)
  await act(async () => root.render(
    <StudentDashboard
      profile={profile}
      catalog={catalog}
      schedule={dashboardSchedule}
      levelOf={{ 'ma-g5-mathematics': '5', 'ma-g7-english-language-arts': '7', 'ma-g8-science': '8' }}
      schoolYear={schoolYear}
      today={dashboardToday}
      onNavigate={onNavigate}
      onExit={() => {}}
    />,
  ))
  return { container, fetch, onNavigate, profile, root }
}

afterEach(() => vi.unstubAllGlobals())

describe('StudentDashboard', () => {
  it('uses neutral Academy home-entry copy for reference schedules', () => {
    expect(appSource).toContain('Academy lessons, your courses, and the year schedule')
    expect(appSource).not.toContain('Today&apos;s lessons, your courses, and the year schedule')
    expect(appSource).toContain("Academy isn't set up for this learner. Ask a grown-up for help.")
    expect(appSource).toContain('title="Academy isn\'t set up"')
    expect(appSource).toContain('note={null}')
  })

  it('renders current learner context and text status labels', () => {
    const html = renderDashboard()
    expect(html).toContain('Hello, Avery')
    expect(html).toContain('Not started')
    expect(html).toContain('In progress')
  })

  it('renders the learner’s real Grade 5, Grade 7, and Grade 8 working levels', () => {
    expect(activeProfile().grade).toBe('6')
    const html = renderDashboard()
    expect(html).toContain('Mathematics · Grade 5')
    expect(html).toContain('English Language Arts · Grade 7')
    expect(html).toContain('Science · Grade 8')
  })

  it('keeps course and working-level context in timeline accessible names', () => {
    const html = renderDashboard()
    expect(html).toContain('aria-label="Fractions in context, Mathematics · Grade 5, Not started"')
    expect(html).toContain('aria-label="Evidence in a text, English Language Arts · Grade 7, In progress"')
    expect(html).toContain('aria-label="Forces and motion, Science · Grade 8, Not started"')
    expect(html).toContain('aria-label="Up next: Evidence in a text, English Language Arts · Grade 7, In progress"')
    expect(html).toContain('aria-label="Continue lesson: Evidence in a text, English Language Arts · Grade 7, In progress"')
  })

  it('retains a deliberately long canonical title in visible markup and its accessible name', () => {
    const longTitle = 'Launch and diagnostic: comparing proportional relationships across tables graphs equations and real-world situations'
    const dashboardSchedule: AcademySchedule = {
      ...schedule,
      days: [{ week: 1, day: 1, lessons: [{ lessonId: MATH, title: longTitle }] }],
    }
    const html = renderDashboard({ dashboardSchedule })
    expect(html).toContain(`<strong>${longTitle}</strong>`)
    expect(html).toContain(`aria-label="${longTitle}, Mathematics · Grade 5, Not started"`)
    expect(html).toContain('Mathematics · Grade 5')
    expect(html).toContain('Not started')
    expect(dashboardSource).toContain('<strong>{lesson.title}</strong>')
    const titleRule = dashboardStyles.match(/\.timeline-item__copy strong\s*\{([^}]*)\}/)?.[1]
    expect(titleRule).toContain('overflow-wrap: anywhere')
    expect(titleRule).not.toMatch(/text-overflow|-webkit-line-clamp|max-height|overflow:\s*hidden/)
    expect(dashboardStyles).not.toMatch(/\.timeline-item__copy strong\s*\{[^}]*(?:text-overflow|-webkit-line-clamp|max-height|overflow:\s*hidden)/)
  })

  it('uses neutral student-facing fallbacks instead of raw internal IDs or subject slugs', () => {
    const missingLessonId = 'ma-g5-mathematics-u99-l99'
    const missingHtml = renderDashboard({
      dashboardSchedule: {
        ...schedule,
        days: [{ week: 1, day: 1, lessons: [{ lessonId: missingLessonId, title: 'Missing lesson' }] }],
      },
    })
    expect(missingHtml).toContain('Academy course')
    expect(missingHtml).toContain("This lesson can&#x27;t be opened from the schedule. Ask a grown-up for help.")
    expect(missingHtml).not.toContain(missingLessonId)

    const internalSubject = 'internal-subject-slug'
    const fallbackCatalog: AcademyCatalog = {
      ...catalog,
      courses: [{ ...catalog.courses[0], subject: internalSubject }],
    }
    const fallbackHtml = renderDashboard({
      dashboardCatalog: fallbackCatalog,
      dashboardSchedule: {
        ...schedule,
        days: [{ week: 1, day: 1, lessons: [{ lessonId: MATH, title: 'Fractions in context' }] }],
      },
    })
    expect(fallbackHtml).toContain('Academy course · Grade 5')
    expect(fallbackHtml).not.toContain(internalSubject)
  })

  it('renders the unconfigured school-year fallback state', () => {
    const html = renderDashboard()
    expect(html).toContain('Week 1 preview')
    expect(html).toContain('A grown-up needs to set the school-year start date. Week 1 is shown for reference.')
  })

  it('renders an intentional no-work state on an empty weekday', () => {
    const html = renderDashboard({ dashboardToday: '2026-08-04', schoolYear: CONFIGURED_YEAR })
    expect(html).toContain('No lessons scheduled today')
    expect(html).toContain('nothing assigned in your Academy schedule for today.')
    expect(html).toContain('View year schedule')
    expect(html).not.toContain('Your learning plan')
  })

  it('renders truthful weekend, before-year, off-week, and after-year display copy', () => {
    const weekend = renderDashboard({ dashboardToday: '2026-08-09', schoolYear: CONFIGURED_YEAR })
    expect(weekend).toContain('No Academy lessons scheduled this weekend.')
    expect(weekend).toContain('Academy lessons are scheduled Monday through Friday.')
    expect(weekend).not.toContain("Today&#x27;s sequence")

    const before = renderDashboard({
      dashboardToday: '2026-08-03',
      schoolYear: { ...CONFIGURED_YEAR, startDate: '2026-08-10' },
    })
    expect(before).toContain('Before Week 1')
    expect(before).toContain('Your first Academy week hasn&#x27;t begun.')

    const offWeek = renderDashboard({
      dashboardToday: '2026-08-10',
      schoolYear: { ...CONFIGURED_YEAR, offWeeks: ['2026-08-10'] },
    })
    expect(offWeek).toContain('This week is marked off.')
    expect(offWeek).toContain('The Week 1 schedule remains available.')
    expect(offWeek).toContain('Current Academy schedule')

    const afterYear = renderDashboard({
      dashboardToday: '2026-08-10',
      schoolYear: { ...CONFIGURED_YEAR, totalWeeks: 1, quarterBreaks: [] },
    })
    expect(afterYear).toContain('The final Academy week has passed.')
    expect(afterYear).toContain('Week 1 remains available for reference.')
    expect(afterYear).toContain('Final Academy schedule')
  })

  it.each([
    ['off-week', OFF_WEEK_YEAR],
    ['after-year', AFTER_YEAR],
  ] as const)('presents the selected lesson honestly in the %s reference state', (_state, schoolYear) => {
    const html = renderDashboard({ dashboardToday: '2026-08-10', schoolYear })
    expect(html).toContain('>Reference lesson<')
    expect(html).toContain('class="up-next-card up-next-card--reference"')
    expect(html).toContain('aria-label="Reference lesson: Evidence in a text, English Language Arts · Grade 7, In progress"')
    expect(html).toContain('aria-label="Open lesson: Evidence in a text, English Language Arts · Grade 7, In progress"')
    expect(html).toContain('>Open lesson<span')
    expect(html).not.toContain('>Up next<')
    expect(html).not.toContain('aria-label="Up next:')
    expect(html).not.toContain('>Start lesson<')
  })

  it('limits completion copy to the displayed Academy schedule', () => {
    let profile = enrolledProfile()
    for (const lessonId of [MATH, ELA, SCIENCE]) {
      profile = submitLessonCheck(startLesson(profile, lessonId, NOW), lessonId, {
        date: '2026-08-03', mode: 'independent', met: true, now: NOW,
      })
    }
    const normalHtml = renderDashboard({ profile, schoolYear: CONFIGURED_YEAR })
    expect(normalHtml).toContain("Today&#x27;s scheduled Academy lessons are complete.")
    expect(normalHtml).not.toContain('done for today')

    const referenceHtml = renderDashboard({ profile })
    expect(referenceHtml).toContain('All lessons shown here are complete.')
    expect(referenceHtml).not.toContain('done for today')
  })

  it('renders no fill at zero and preserves a visible minimum for realistic small progress', () => {
    const zeroProgressHtml = renderDashboard()
    expect(zeroProgressHtml.match(/style="width:0%;min-width:0"/g)).toHaveLength(3)

    const remainingMathLessons = Array.from(
      { length: 179 },
      (_, index) => `ma-g5-mathematics-u01-l${String(index + 2).padStart(3, '0')}`,
    )
    const partialCatalog: AcademyCatalog = {
      ...catalog,
      courses: catalog.courses.map((course) => course.courseId === 'ma-g5-mathematics'
        ? {
            ...course,
            lessonCount: 180,
            units: [{ ...course.units[0], days: 180, lessonIds: [MATH, ...remainingMathLessons] }],
          }
        : course),
    }
    const partialProfile = enrollInCatalog(
      emptyProfile('p1', 'Avery Student', '6'),
      partialCatalog,
      NOW,
    )
    const oneOfOneHundredEighty = submitLessonCheck(startLesson(partialProfile, MATH, NOW), MATH, {
      date: '2026-08-03', mode: 'independent', met: true, now: NOW,
    })
    const smallProgressHtml = renderDashboard({
      profile: oneOfOneHundredEighty,
      dashboardCatalog: partialCatalog,
    })
    expect(smallProgressHtml).toContain('1% complete')
    expect(smallProgressHtml).toContain('style="width:1%"')
    expect(dashboardStyles).toMatch(/\.course-card__meter span\s*\{[^}]*min-width:\s*2px;/)
  })

  it('keeps Jarvis presentation-only and renders no functional assistant controls', () => {
    const html = renderDashboard()
    expect(html).toContain('Jarvis')
    expect(html).toContain('Academy display')
    expect(html).toContain('Visual only')
    expect(html).toContain('It does not listen or answer questions.')
    const jarvis = html.match(/<aside[^>]*aria-labelledby="jarvis-heading"[\s\S]*?<\/aside>/)?.[0]
    expect(jarvis).toBeTruthy()
    expect(jarvis).not.toMatch(/<(?:button|input|textarea|form)\b/i)
    expect(jarvis).not.toMatch(/\b(?:send|microphone|voice|prompt)\b/i)
  })

  it('renders every Jarvis visual tier inside one aria-hidden decorative object', () => {
    const html = renderDashboard()
    const jarvisCore = html.match(/<div class="student-dashboard__jarvis-core" aria-hidden="true">[\s\S]*?<\/div>/)?.[0]
    expect(jarvisCore).toBeTruthy()
    for (const layer of [
      'ambient-halo',
      'outer-detail',
      'secondary-orbit',
      'primary-ring',
      'nucleus',
      'monogram',
    ]) {
      expect(jarvisCore).toContain(`student-dashboard__jarvis-${layer}`)
    }
    expect(jarvisCore?.match(/aria-hidden="true"/g)).toHaveLength(1)
    expect(jarvisCore).not.toMatch(/\b(?:role|aria-label|tabindex)=/i)
  })

  it('isolates dashboard Jarvis and generic presentation selectors from other subsystems', () => {
    for (const className of [
      'student-dashboard__jarvis-core',
      'student-dashboard__jarvis-ambient-halo',
      'student-dashboard__jarvis-outer-detail',
      'student-dashboard__jarvis-secondary-orbit',
      'student-dashboard__jarvis-primary-ring',
      'student-dashboard__jarvis-nucleus',
      'student-dashboard__jarvis-monogram',
    ]) {
      expect(dashboardSource).toContain(`className="${className}"`)
      expect(dashboardStyles).toContain(`.${className}`)
    }
    expect(dashboardSource).not.toContain('className="jarvis-core"')
    expect(dashboardSource).not.toContain('className="jarvis-core__monogram"')
    expect(dashboardStyles).not.toMatch(/(?:^|[,{]\s*)\.jarvis-core(?:__[-a-z]+)?\b/m)
    for (const selector of ['eyebrow', 'panel-glass', 'button-primary', 'button-secondary', 'section-heading']) {
      expect(dashboardStyles).toContain(`.student-dashboard .${selector}`)
    }
    expect(dashboardStyles).not.toMatch(/(?:^|[,{]\s*)\.(?:eyebrow|panel-glass|button-primary|button-secondary|section-heading)\b/m)
  })

  it('animates only ambient/detail/orbit layers under no-preference and disables all tiers under reduced motion', () => {
    const noPreferenceStart = dashboardStyles.indexOf('@media (prefers-reduced-motion: no-preference)')
    const reducedStart = dashboardStyles.indexOf('@media (prefers-reduced-motion: reduce)')
    const forcedColorsStart = dashboardStyles.indexOf('@media (forced-colors: active)')
    const noPreference = dashboardStyles.slice(noPreferenceStart, reducedStart)
    const reduced = dashboardStyles.slice(reducedStart, forcedColorsStart)
    const animatedLayers = [...noPreference.matchAll(/\.student-dashboard__jarvis-([a-z-]+)\s*\{[^}]*\banimation:/g)]
      .map((match) => match[1])
      .sort()
    expect(animatedLayers).toEqual(['ambient-halo', 'outer-detail', 'secondary-orbit'])
    expect(noPreference).not.toMatch(/\.student-dashboard__jarvis-(?:primary-ring|nucleus|monogram)[^{]*\{[^}]*animation:/)
    for (const layer of ['ambient-halo', 'outer-detail', 'secondary-orbit', 'primary-ring', 'nucleus', 'monogram']) {
      expect(reduced).toContain(`.student-dashboard__jarvis-${layer}`)
    }
    expect(reduced).toContain('animation: none')
  })

  it('keeps real ring borders and a forced-colors fallback independent of masks', () => {
    for (const layer of ['outer-detail', 'secondary-orbit', 'primary-ring']) {
      expect(dashboardStyles).toMatch(new RegExp(`\\.student-dashboard__jarvis-${layer}\\s*\\{[^}]*border:`))
    }
    const forcedColors = dashboardStyles.slice(dashboardStyles.indexOf('@media (forced-colors: active)'))
    expect(forcedColors).toContain('.student-dashboard__jarvis-outer-detail, .student-dashboard__jarvis-secondary-orbit, .student-dashboard__jarvis-primary-ring')
    expect(forcedColors).toContain('-webkit-mask: none')
    expect(forcedColors).toContain('mask: none')
    expect(forcedColors).toContain('border: 1px solid CanvasText')
  })

  it('presents a stale attempt as requiring restart, never as resumable', () => {
    const dashboardSchedule: AcademySchedule = {
      ...schedule,
      days: [{ week: 1, day: 1, lessons: [{ lessonId: ELA, title: 'Evidence in a text' }] }],
    }
    const html = renderDashboard({ profile: staleAttempt(enrolledProfile(), ELA), dashboardSchedule })
    expect(html).toContain('Curriculum version changed — restart required')
    expect(html).toContain('This lesson was started with a different curriculum version.')
    expect(html).toContain('Open lesson')
    expect(html).toContain('aria-label="Open lesson: Evidence in a text, English Language Arts · Grade 7"')
    expect(html).not.toContain('Open lesson to restart')
    expect(html).not.toContain('No lessons scheduled today')
    expect(html).not.toContain('>Up next<')
    expect(html).not.toContain('Continue lesson')
    expect(html).not.toMatch(/\bresume\b|continue where you left off/i)
  })

  it('lets the full stale-version status wrap on narrow screens without fixed-height clipping', () => {
    const mobileRules = dashboardStyles.slice(dashboardStyles.indexOf('@media (max-width: 540px)'))
    const statusRule = mobileRules.match(/\.timeline-item__state\s*\{([^}]*)\}/)?.[1]
    expect(statusRule).toContain('white-space: normal')
    expect(statusRule).toContain('overflow-wrap: anywhere')
    expect(statusRule).toContain('min-width: 0')
    expect(statusRule).not.toMatch(/height|max-height|overflow:\s*hidden/)
  })

  it('uses calm retry language and keeps reteach work incomplete', () => {
    let profile = startLesson(enrolledProfile(), MATH, NOW)
    profile = submitLessonCheck(profile, MATH, {
      date: '2026-08-03', mode: 'guided', met: false, now: NOW,
    })
    const dashboardSchedule: AcademySchedule = {
      ...schedule,
      days: [{ week: 1, day: 1, lessons: [{ lessonId: MATH, title: 'Fractions in context' }] }],
    }
    const html = renderDashboard({ profile, dashboardSchedule })
    expect(html).toContain('Review needed')
    expect(html).toContain('Open lesson')
    expect(html).not.toContain('Ready to retry')
    expect(html).not.toContain('Retry lesson')
  })

  it('does not fabricate exact remaining-time language', () => {
    const html = renderDashboard()
    expect(html).not.toMatch(/\b(?:minutes?|mins?|hours?|hrs?)\s+(?:remaining|left)\b/i)
    expect(html).not.toMatch(/\b\d+\s*(?:minutes?|mins?|hours?|hrs?)\b/i)
  })

  it('keeps dashboard actions navigation-only and imports no Study or Tutor runtime', () => {
    const source = `${dashboardSource}\n${dashboardDataSource}`
    expect(source).not.toMatch(/(?:from\s+|import\s*\()['"][^'"]*(?:study|tutor)[^'"]*['"]/i)
    expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|getUserMedia|mediaDevices|localStorage|sessionStorage)\b/)
    expect(dashboardSource).not.toMatch(/\b(?:startLesson|completeSegment|submitLessonCheck|recordReassessment|reopenLesson)\b/)
    expect(source).not.toMatch(/\b(?:enrollInCatalog|setWorkingLevel|reconcileEnrollment)\b/)
    expect(dashboardSource).not.toContain('onPatch')
    expect(dashboardSource).toContain('onNavigate(route)')
  })

  it('mounts without network activity and a lesson action only emits its existing route', async () => {
    const profile = activeProfile()
    const profileBeforeClick = JSON.parse(JSON.stringify(profile)) as Profile
    const mounted = await mountDashboard({ profile })
    try {
      expect(mounted.fetch).not.toHaveBeenCalled()

      const button = findButton(mounted.container, 'Continue lesson')
      expect(button).not.toBeNull()
      const click = new Event('click', { bubbles: true, cancelable: true })
      Object.defineProperty(click, 'target', { configurable: true, value: button })
      await act(async () => { mounted.container.dispatchEvent(click) })

      expect(mounted.onNavigate).toHaveBeenCalledWith({
        kind: 'lesson', courseId: 'ma-g7-english-language-arts', unitNumber: 1, lessonId: ELA,
      })
      expect(profile).toEqual(profileBeforeClick)
    } finally {
      await act(async () => mounted.root.unmount())
    }
  })

  it.each([
    ['off-week', OFF_WEEK_YEAR],
    ['after-year', AFTER_YEAR],
  ] as const)('keeps the %s selected lesson navigation-only and side-effect free', async (_state, schoolYear) => {
    const profile = activeProfile()
    const profileBeforeClick = JSON.parse(JSON.stringify(profile)) as Profile
    const mounted = await mountDashboard({ profile, dashboardToday: '2026-08-10', schoolYear })
    try {
      expect(elementText(mounted.container)).toContain('Reference lesson')
      expect(elementText(mounted.container)).not.toContain('Up next')
      expect(elementText(mounted.container)).not.toContain('Start lesson')
      expect(mounted.fetch).not.toHaveBeenCalled()

      const button = findButton(mounted.container, 'Open lesson')
      expect(button).not.toBeNull()
      const click = new Event('click', { bubbles: true, cancelable: true })
      Object.defineProperty(click, 'target', { configurable: true, value: button })
      await act(async () => { mounted.container.dispatchEvent(click) })

      expect(mounted.onNavigate).toHaveBeenCalledTimes(1)
      expect(mounted.onNavigate).toHaveBeenCalledWith({
        kind: 'lesson', courseId: 'ma-g7-english-language-arts', unitNumber: 1, lessonId: ELA,
      })
      expect(mounted.fetch).not.toHaveBeenCalled()
      expect(profile).toEqual(profileBeforeClick)
    } finally {
      await act(async () => mounted.root.unmount())
    }
  })

  it('preserves ordinary Up Next and Start lesson behavior on a configured weekday', async () => {
    const profile = enrolledProfile()
    const profileBeforeClick = JSON.parse(JSON.stringify(profile)) as Profile
    const mounted = await mountDashboard({ profile, schoolYear: CONFIGURED_YEAR })
    try {
      expect(elementText(mounted.container)).toContain('Up next')
      expect(elementText(mounted.container)).toContain('Start lesson')
      expect(elementText(mounted.container)).not.toContain('Reference lesson')

      const button = findButton(mounted.container, 'Start lesson')
      expect(button).not.toBeNull()
      const click = new Event('click', { bubbles: true, cancelable: true })
      Object.defineProperty(click, 'target', { configurable: true, value: button })
      await act(async () => { mounted.container.dispatchEvent(click) })

      expect(mounted.onNavigate).toHaveBeenCalledTimes(1)
      expect(mounted.onNavigate).toHaveBeenCalledWith({
        kind: 'lesson', courseId: 'ma-g5-mathematics', unitNumber: 1, lessonId: MATH,
      })
      expect(mounted.fetch).not.toHaveBeenCalled()
      expect(profile).toEqual(profileBeforeClick)
    } finally {
      await act(async () => mounted.root.unmount())
    }
  })

  it('clicking a course card emits only its existing course route', async () => {
    const profile = activeProfile()
    const profileBeforeClick = JSON.parse(JSON.stringify(profile)) as Profile
    const mounted = await mountDashboard({ profile })
    try {
      const button = findButton(mounted.container, 'Course')
      expect(button).not.toBeNull()
      const click = new Event('click', { bubbles: true, cancelable: true })
      Object.defineProperty(click, 'target', { configurable: true, value: button })
      await act(async () => { mounted.container.dispatchEvent(click) })

      expect(mounted.onNavigate).toHaveBeenCalledTimes(1)
      expect(mounted.onNavigate).toHaveBeenCalledWith({
        kind: 'course', courseId: 'ma-g5-mathematics',
      })
      expect(mounted.fetch).not.toHaveBeenCalled()
      expect(profile).toEqual(profileBeforeClick)
    } finally {
      await act(async () => mounted.root.unmount())
    }
  })

  it('retains essential Jarvis and status content when motion is reduced', () => {
    expect(dashboardStyles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(dashboardStyles).toContain('animation: none')
    const html = renderDashboard()
    expect(html).toContain('Jarvis is a visual part of your Academy dashboard. It does not listen or answer questions.')
    expect(html).toContain('In progress')
  })
})
