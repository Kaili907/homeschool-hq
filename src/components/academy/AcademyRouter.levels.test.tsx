import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../../migration'
import type { AcademyGrade, Profile } from '../../types'
import type { AcademyCatalog, AcademySchedule } from '../../academy/contentTypes'
import { resetAcademyContentCache } from '../../academy/contentClient'
import type { AcademyProgramEntry } from '../../academy/workingLevel'
import type { AcademyRoute } from '../../academy/academyRoute'
import { AcademyRouter } from './AcademyRouter'

const routerSource = readFileSync(new URL('./AcademyRouter.tsx', import.meta.url), 'utf8')

/**
 * ACADEMY-LEVEL-DECOUPLE — the headline claim, on the surface the girl actually
 * opens: a sixth grader placed into Grade 5 mathematics and Grade 7 ELA sees
 * both, at once, each labelled with the level it is served at.
 */

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
  constructor(tag = 'div') { super(); this.nodeName = tag.toUpperCase(); this.tagName = tag.toUpperCase() }
  appendChild(child: FakeElement) { child.parentNode = this; this.childNodes.push(child); return child }
  insertBefore(child: FakeElement, before: FakeElement | null) {
    child.parentNode = this
    const index = before ? this.childNodes.indexOf(before) : -1
    if (index < 0) this.childNodes.push(child); else this.childNodes.splice(index, 0, child)
    return child
  }
  removeChild(child: FakeElement) { this.childNodes = this.childNodes.filter((i) => i !== child); child.parentNode = null; return child }
  setAttribute(name: string, value: string) { this.attributes.set(name, String(value)) }
  removeAttribute(name: string) { this.attributes.delete(name) }
  getAttribute(name: string) { return this.attributes.get(name) ?? null }
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
    this.documentElement = new FakeElement('html'); this.body = new FakeElement('body')
    this.documentElement.ownerDocument = this; this.body.ownerDocument = this; this.activeElement = this.body
  }
  createElement(tag: string) { const e = new FakeElement(tag); e.ownerDocument = this; return e }
  createElementNS(_ns: string, tag: string) { return this.createElement(tag) }
  createTextNode(value: string) { const e = this.createElement('#text'); e.nodeType = 3; e.nodeName = '#text'; e.textContent = value; return e }
}

function text(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(text).join(' ')}`
}

// ---- fixture content, one course per level ----

function catalogFor(grade: AcademyGrade, subject: string): AcademyCatalog {
  const courseId = `ma-g${grade}-${subject}`
  return {
    releaseVersion: '1.0.0',
    grade,
    courses: [
      {
        courseId,
        subject,
        lessonCount: 1,
        units: [
          {
            unitId: `${courseId}-u01`,
            unitNumber: 1,
            title: 'Unit 1',
            days: 1,
            essentialQuestion: 'Why?',
            performanceTask: 'Task',
            lessonIds: [`${courseId}-u01-l01`],
            hasAssessment: false,
          },
        ],
      },
    ],
  }
}

function scheduleFor(grade: AcademyGrade, subject: string): AcademySchedule {
  return {
    releaseVersion: '1.0.0',
    grade,
    days: [
      {
        week: 1,
        day: 1,
        lessons: [{ lessonId: `ma-g${grade}-${subject}-u01-l01`, title: `${subject} day 1` }],
      },
    ],
  }
}

const BODIES: Record<string, unknown> = {
  '/curriculum/1.0.0/grade-5/catalog.json': catalogFor('5', 'mathematics'),
  '/curriculum/1.0.0/grade-5/schedule.json': scheduleFor('5', 'mathematics'),
  '/curriculum/1.0.0/grade-7/catalog.json': catalogFor('7', 'english-language-arts'),
  '/curriculum/1.0.0/grade-7/schedule.json': scheduleFor('7', 'english-language-arts'),
}

const MIXED: AcademyProgramEntry[] = [
  { subject: 'mathematics', level: '5' },
  { subject: 'english-language-arts', level: '7' },
]

describe('the student academy surface serves a decoupled program', () => {
  let root: Root | null = null
  let documentTarget: FakeDocument
  let container: FakeElement
  let latest: Profile

  beforeEach(() => {
    resetAcademyContentCache()
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget, setTimeout, clearTimeout, HTMLElement: FakeElement,
      HTMLIFrameElement: class {}, getSelection: () => null,
    }) as unknown as EventTarget & Record<string, unknown>
    windowTarget.top = windowTarget
    windowTarget.self = windowTarget
    documentTarget.defaultView = windowTarget
    vi.stubGlobal('window', windowTarget)
    vi.stubGlobal('document', documentTarget)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('fetch', (path: string) => {
      const body = BODIES[path]
      return Promise.resolve({
        ok: body !== undefined,
        status: body === undefined ? 404 : 200,
        json: async () => body,
      })
    })
    container = documentTarget.createElement('div')
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    root = null
    resetAcademyContentCache()
    vi.unstubAllGlobals()
  })

  async function mount(
    entries: AcademyProgramEntry[],
    profile: Profile,
    route: AcademyRoute = { kind: 'home' },
  ) {
    latest = profile
    function Harness() {
      const [p, setP] = useState(profile)
      latest = p
      return (
        <AcademyRouter
          profile={p}
          entries={entries}
          schoolYear={undefined}
          route={route}
          onNavigate={() => {}}
          onPatch={(update) => setP(update)}
          onExit={() => {}}
        />
      )
    }
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(<Harness />))
    // one turn for the content fetch, one for the enrollment patch it triggers
    await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)) })
    await act(async () => { await Promise.resolve() })
  }

  it('shows Grade 5 mathematics and Grade 7 ELA at the same time', async () => {
    await mount(MIXED, emptyProfile('p3', 'Sixth Grader', '6'))
    const rendered = text(container)
    expect(rendered).toContain('Mathematics · Grade 5')
    expect(rendered).toContain('English Language Arts · Grade 7')
  })

  it('enrolls her in both levels’ courses without claiming a single grade', async () => {
    await mount(MIXED, emptyProfile('p3', 'Sixth Grader', '6'))
    expect(latest.academy?.courseIds).toEqual([
      'ma-g5-mathematics',
      'ma-g7-english-language-arts',
    ])
    expect(latest.grade).toBe('6') // her grade is untouched by enrollment
  })

  it('serves only the assigned subject when just one level is set', async () => {
    await mount([{ subject: 'mathematics', level: '5' }], emptyProfile('p3', 'Sixth Grader', '6'))
    const rendered = text(container)
    expect(rendered).toContain('Mathematics · Grade 5')
    expect(rendered).not.toContain('English Language Arts')
    expect(latest.academy?.courseIds).toEqual(['ma-g5-mathematics'])
  })

  it('gives actionable copy when Academy content cannot load', async () => {
    await mount([{ subject: 'science', level: '8' }], emptyProfile('p3', 'Sixth Grader', '6'))
    expect(text(container)).toContain(
      "Academy couldn't load right now. Go back home and ask a grown-up for help.",
    )
    expect(text(container)).not.toMatch(/try again|retry/i)
  })

  it('explains when working levels produce no configured courses', async () => {
    await mount([{ subject: 'science', level: '5' }], emptyProfile('p3', 'Sixth Grader', '6'))
    expect(text(container)).toContain(
      "Your Academy courses aren't set up yet. Ask a grown-up to check your working levels in the Parent Hub.",
    )
  })

  it('uses neutral missing-course copy without exposing the route ID', async () => {
    const rawCourseId = 'internal-course-id-93a'
    await mount(
      MIXED,
      emptyProfile('p3', 'Sixth Grader', '6'),
      { kind: 'course', courseId: rawCourseId },
    )
    const rendered = text(container)
    expect(rendered).toContain(
      "This course isn't available. Go back to Academy and ask a grown-up for help if it keeps happening.",
    )
    expect(rendered).not.toContain(rawCourseId)
  })

  it('keeps the complete missing-content copy matrix truthful and actionable', () => {
    for (const copy of [
      "This course isn't available. Go back to Academy and ask a grown-up for help if it keeps happening.",
      "This unit isn't available. Go back to Academy and ask a grown-up for help if it keeps happening.",
      "This lesson isn't available. Go back to the unit and ask a grown-up for help if it keeps happening.",
      "This assessment isn't available. Go back to the unit and ask a grown-up for help if it keeps happening.",
    ]) {
      expect(routerSource).toContain(copy)
    }
    expect(routerSource).not.toContain("That {label} isn't in this curriculum release")
  })
})
