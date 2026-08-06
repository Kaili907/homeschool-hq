import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppState, emptyProfile } from '../../migration'
import type { Profile } from '../../types'
import { workingLevelFor } from '../../academy/workingLevel'
import { AcademyLevelsPanel } from './AcademyLevelsPanel'
import { ParentHub } from './ParentHub'

/**
 * ACADEMY-LEVEL-DECOUPLE — the parent's per-subject level selector: it must
 * write the working level, must never write the grade, and must exist nowhere a
 * girl can reach it.
 */

// ---- minimal DOM (this project's test env is node; see App.*RouteLifecycle) ----

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
  // <select>/<option> bits React's select handling reads back off the node
  selected = false
  defaultSelected = false
  disabled = false
  private ownValue: string | null = null
  private attributes = new Map<string, string>()
  get value(): string { return this.ownValue ?? this.getAttribute('value') ?? '' }
  set value(next: string) { this.ownValue = String(next) }
  get options(): FakeElement[] { return this.childNodes.filter((c) => c.tagName === 'OPTION') }
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

function reactProps(el: FakeElement): Record<string, unknown> {
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'))
  if (!key) throw new Error(`No React props on <${el.tagName}>`)
  return (el as unknown as Record<string, Record<string, unknown>>)[key]
}

function findAll(node: FakeElement, tag: string, out: FakeElement[] = []): FakeElement[] {
  if (node.tagName === tag) out.push(node)
  for (const child of node.childNodes) findAll(child, tag, out)
  return out
}

// ---- the panel ----

describe('AcademyLevelsPanel — a parent sets the working level', () => {
  let root: Root | null = null
  let documentTarget: FakeDocument
  let container: FakeElement

  beforeEach(() => {
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
    container = documentTarget.createElement('div')
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    root = null
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  async function renderPanel(profile: Profile, onPatch: (id: string, u: (p: Profile) => Profile) => void) {
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(<AcademyLevelsPanel profiles={[profile]} onPatchProfile={onPatch} />))
  }

  /** The <select> for one subject, identified by the id the panel assigns. */
  function selectFor(subject: string): FakeElement {
    const found = findAll(container, 'SELECT').find(
      (el) => (reactProps(el).id as string)?.endsWith(`-${subject}`),
    )
    if (!found) throw new Error(`no selector for ${subject}`)
    return found
  }

  it('sets mathematics to Grade 5 for a sixth grader without touching her grade', async () => {
    let profile = emptyProfile('p3', 'Sixth Grader', '6')
    await renderPanel(profile, (_id, update) => { profile = update(profile) })

    const onChange = reactProps(selectFor('mathematics')).onChange as (e: unknown) => void
    await act(async () => onChange({ target: { value: '5' } }))

    expect(profile.grade).toBe('6')
    expect(profile.workingLevels).toEqual({ mathematics: '5' })
    expect(workingLevelFor(profile, 'mathematics')).toBe('5')
    expect(workingLevelFor(profile, 'science')).toBe('6')
  })

  it('holds mathematics 5 and ELA 7 on the same profile', async () => {
    let profile = emptyProfile('p3', 'Sixth Grader', '6')
    const patch = (_id: string, update: (p: Profile) => Profile) => { profile = update(profile) }
    await renderPanel(profile, patch)
    await act(async () =>
      (reactProps(selectFor('mathematics')).onChange as (e: unknown) => void)({ target: { value: '5' } }),
    )
    await act(async () =>
      (reactProps(selectFor('english-language-arts')).onChange as (e: unknown) => void)({ target: { value: '7' } }),
    )
    expect(profile.workingLevels).toEqual({ mathematics: '5', 'english-language-arts': '7' })
    expect(profile.grade).toBe('6')
  })

  it('choosing Default clears the override and restores the pristine profile', async () => {
    const pristine = emptyProfile('p3', 'Sixth Grader', '6')
    let profile: Profile = { ...pristine, workingLevels: { mathematics: '5' } }
    await renderPanel(profile, (_id, update) => { profile = update(profile) })
    await act(async () =>
      (reactProps(selectFor('mathematics')).onChange as (e: unknown) => void)({ target: { value: '' } }),
    )
    expect(profile.workingLevels).toBeUndefined()
    expect(profile).toEqual(pristine)
  })
})

// ---- reachability: parent-only, behind the existing PIN boundary ----

describe('the working-level control is reachable only from the Parent Hub', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('renders inside the PIN-gated Parent Hub Academy tab', () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', 'true')
    const html = renderToStaticMarkup(
      <ParentHub state={defaultAppState()} onStateChange={() => {}} onClose={() => {}} onOpenClassic={() => {}} />,
    )
    // The Academy tab is offered even though no profile reaches a level yet —
    // otherwise the setting that grants access could never be assigned.
    expect(html).toContain('>Academy</button>')
  })

  it('the tab disappears entirely when no academy level is enabled on the host', () => {
    const html = renderToStaticMarkup(
      <ParentHub state={defaultAppState()} onStateChange={() => {}} onClose={() => {}} onOpenClassic={() => {}} />,
    )
    expect(html).not.toContain('>Academy</button>')
  })

  it('no module outside the parent hub can write a working level', () => {
    const src = join(process.cwd(), 'src')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) { walk(full); continue }
        if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue
        const text = readFileSync(full, 'utf8')
        if (!/\bsetWorkingLevel\b/.test(text)) continue
        const rel = relative(src, full).replaceAll('\\', '/')
        // the definition itself, and the one parent-side control that calls it
        if (rel === 'academy/workingLevel.ts' || rel === 'components/hub/AcademyLevelsPanel.tsx') continue
        offenders.push(rel)
      }
    }
    walk(src)
    expect(offenders).toEqual([])
  })

  it('the student academy surface ships no level control', () => {
    const router = readFileSync(
      join(process.cwd(), 'src/components/academy/AcademyRouter.tsx'),
      'utf8',
    )
    expect(router).not.toMatch(/setWorkingLevel|workingLevels/)
  })
})
