import { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../../../migration'
import { enrollInCatalog, startLesson, submitLessonCheck } from '../../../academy/academyState'
import type { AcademyCatalog, AcademySchedule } from '../../../academy/contentTypes'
import type { Profile } from '../../../types'
import { StudentDashboard } from './StudentDashboard'

const dashboardStyles = readFileSync(new URL('./studentDashboard.css', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('./StudentDashboard.tsx', import.meta.url), 'utf8')
const dashboardDataSource = readFileSync(new URL('./dashboardData.ts', import.meta.url), 'utf8')

const MATH = 'ma-g5-mathematics-u01-l01'
const ELA = 'ma-g7-english-language-arts-u01-l01'
const SCIENCE = 'ma-g8-science-u01-l01'
const NOW = '2026-08-03T09:00:00.000Z'

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
}: {
  profile?: Profile
  dashboardCatalog?: AcademyCatalog
  dashboardSchedule?: AcademySchedule
  dashboardToday?: string
} = {}) {
  return renderToStaticMarkup(
    <StudentDashboard
      profile={profile}
      catalog={dashboardCatalog}
      schedule={dashboardSchedule}
      levelOf={{ 'ma-g5-mathematics': '5', 'ma-g7-english-language-arts': '7', 'ma-g8-science': '8' }}
      schoolYear={undefined}
      today={dashboardToday}
      onNavigate={() => {}}
      onExit={() => {}}
    />,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('StudentDashboard', () => {
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
  })

  it('renders the unconfigured school-year fallback state', () => {
    expect(renderDashboard()).toContain('Starting with week 1')
  })

  it('renders an intentional no-work state on an empty weekday', () => {
    const html = renderDashboard({ dashboardToday: '2026-08-04' })
    expect(html).toContain('No lessons scheduled today')
    expect(html).toContain('nothing assigned in your Academy schedule for today.')
    expect(html).toContain('View year schedule')
    expect(html).not.toContain('Your learning plan')
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
    expect(html).toContain('Visual foundation')
    expect(html).toContain('not available for conversations')
    const jarvis = html.match(/<aside[^>]*aria-labelledby="jarvis-heading"[\s\S]*?<\/aside>/)?.[0]
    expect(jarvis).toBeTruthy()
    expect(jarvis).not.toMatch(/<(?:button|input|textarea|form)\b/i)
    expect(jarvis).not.toMatch(/\b(?:send|microphone|voice|prompt)\b/i)
  })

  it('presents a stale attempt as requiring restart, never as resumable', () => {
    const dashboardSchedule: AcademySchedule = {
      ...schedule,
      days: [{ week: 1, day: 1, lessons: [{ lessonId: ELA, title: 'Evidence in a text' }] }],
    }
    const html = renderDashboard({ profile: staleAttempt(enrolledProfile(), ELA), dashboardSchedule })
    expect(html).toContain('Restart required')
    expect(html).toContain('Open lesson to restart')
    expect(html).not.toContain('No lessons scheduled today')
    expect(html).not.toContain('>Up next<')
    expect(html).not.toContain('Continue lesson')
    expect(html).not.toMatch(/\bresume\b|continue where you left off/i)
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
    expect(html).toContain('Ready to retry')
    expect(html).toContain('Retry lesson')
    expect(html).toContain('0 of 1 complete today')
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
    const onNavigate = vi.fn()
    const profile = activeProfile()
    const profileBeforeClick = JSON.parse(JSON.stringify(profile)) as Profile
    const root = createRoot(container as unknown as Element)
    try {
      await act(async () => root.render(
        <StudentDashboard
          profile={profile}
          catalog={catalog}
          schedule={schedule}
          levelOf={{ 'ma-g5-mathematics': '5', 'ma-g7-english-language-arts': '7', 'ma-g8-science': '8' }}
          schoolYear={undefined}
          today="2026-08-03"
          onNavigate={onNavigate}
          onExit={() => {}}
        />,
      ))
      expect(fetch).not.toHaveBeenCalled()

      const button = findButton(container, 'Continue lesson')
      expect(button).not.toBeNull()
      const click = new Event('click', { bubbles: true, cancelable: true })
      Object.defineProperty(click, 'target', { configurable: true, value: button })
      await act(async () => { container.dispatchEvent(click) })

      expect(onNavigate).toHaveBeenCalledWith({
        kind: 'lesson', courseId: 'ma-g7-english-language-arts', unitNumber: 1, lessonId: ELA,
      })
      expect(profile).toEqual(profileBeforeClick)
    } finally {
      await act(async () => root.unmount())
    }
  })

  it('retains essential Jarvis and status content when motion is reduced', () => {
    expect(dashboardStyles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(dashboardStyles).toContain('animation: none')
    const html = renderDashboard()
    expect(html).toContain('Jarvis is not available for conversations on this dashboard yet.')
    expect(html).toContain('In progress')
  })
})
