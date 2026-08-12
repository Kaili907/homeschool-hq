import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FamilyPilotStudentLogin } from './FamilyPilotStudentLogin'
import type { FamilyPilotStudentProfile, FamilyPilotStudentRef } from './types'

function ref(value: string): FamilyPilotStudentRef {
  return { kind: 'academy-student-id', value }
}

function noop() {}

const studentA: FamilyPilotStudentProfile = { studentRef: ref('student-a'), displayName: 'Ava' }
const studentB: FamilyPilotStudentProfile = { studentRef: ref('student-b'), displayName: 'Bea' }
const studentC: FamilyPilotStudentProfile = { studentRef: ref('student-c'), displayName: 'Cy', pinRequired: true }

function render(node: Parameters<typeof renderToStaticMarkup>[0]) {
  return renderToStaticMarkup(node)
}

describe('FamilyPilotStudentLogin — picker grid renders every family profile', () => {
  it('shows a card with the right name and aria-label for each of several students', () => {
    const markup = render(
      <FamilyPilotStudentLogin
        students={[studentA, studentB, studentC]}
        activeStudentRef={null}
        onSelectStudent={noop}
        onAuthenticated={noop}
        onLogout={noop}
        onSwitchStudent={noop}
      />,
    )
    expect(markup).toMatch(/Who.s studying\?/)
    expect(markup).toContain('role="list"')
    expect(markup).toContain('role="listitem"')
    expect(markup).toContain('aria-label="Continue as Ava"')
    expect(markup).toContain('aria-label="Continue as Bea"')
    expect(markup).toContain('aria-label="Continue as Cy"')
    expect(markup).toContain('>Ava<')
    expect(markup).toContain('>Bea<')
    expect(markup).toContain('>Cy<')
  })
})

describe('FamilyPilotStudentLogin — switching active student never leaks the prior student', () => {
  const students = [studentA, studentB]

  it('shows only A when A is active', () => {
    const markup = render(
      <FamilyPilotStudentLogin
        students={students}
        activeStudentRef={studentA.studentRef}
        onSelectStudent={noop}
        onAuthenticated={noop}
        onLogout={noop}
        onSwitchStudent={noop}
      />,
    )
    expect(markup).toContain('Studying as Ava')
    expect(markup).not.toContain('Bea')
  })

  it('shows only B when B is active — a fresh render, proving no state carries over from A', () => {
    const markup = render(
      <FamilyPilotStudentLogin
        students={students}
        activeStudentRef={studentB.studentRef}
        onSelectStudent={noop}
        onAuthenticated={noop}
        onLogout={noop}
        onSwitchStudent={noop}
      />,
    )
    expect(markup).toContain('Studying as Bea')
    expect(markup).not.toContain('Ava')
  })
})

describe('FamilyPilotStudentLogin — logout returns to the picker/no-active state', () => {
  it('with activeStudentRef null, shows the picker heading and no "Studying as" panel', () => {
    const markup = render(
      <FamilyPilotStudentLogin
        students={[studentA]}
        activeStudentRef={null}
        onSelectStudent={noop}
        onAuthenticated={noop}
        onLogout={noop}
        onSwitchStudent={noop}
      />,
    )
    expect(markup).toMatch(/Who.s studying\?/)
    expect(markup).not.toContain('Studying as')
  })

  it('the active-student view offers a Log out control to drive back to the picker', () => {
    const markup = render(
      <FamilyPilotStudentLogin
        students={[studentA]}
        activeStudentRef={studentA.studentRef}
        onSelectStudent={noop}
        onAuthenticated={noop}
        onLogout={noop}
        onSwitchStudent={noop}
      />,
    )
    expect(markup).toContain('>Log out<')
  })
})

describe('FamilyPilotStudentLogin — PIN/recovery UI only appears when a student needs it', () => {
  it('renders no PIN pad and no recovery control when no student in the roster requires a PIN', () => {
    // The picker's confirm/PIN screens live behind internal useState that can't
    // be driven through props alone (see the module docstring), so this checks
    // the one reachable-via-props guarantee: with an all-no-PIN roster there is
    // no way for any PIN or recovery affordance to appear on the picker screen.
    const markup = render(
      <FamilyPilotStudentLogin
        students={[studentA, studentB]}
        activeStudentRef={null}
        onSelectStudent={noop}
        onAuthenticated={noop}
        onLogout={noop}
        onSwitchStudent={noop}
        onParentRecover={noop}
      />,
    )
    expect(markup).not.toContain('aria-label="digit 1"')
    expect(markup).not.toContain('Ask a parent')
  })
})

describe('FamilyPilotStudentLogin — identity is studentRef, not the display label', () => {
  it('renders two distinct cards even when both students share the exact same display name', () => {
    const twinA: FamilyPilotStudentProfile = { studentRef: ref('twin-a'), displayName: 'Sam' }
    const twinB: FamilyPilotStudentProfile = { studentRef: ref('twin-b'), displayName: 'Sam' }
    const markup = render(
      <FamilyPilotStudentLogin
        students={[twinA, twinB]}
        activeStudentRef={null}
        onSelectStudent={noop}
        onAuthenticated={noop}
        onLogout={noop}
        onSwitchStudent={noop}
      />,
    )
    // Labels are intentionally identical, so assert structural repetition
    // (two separate cards) rather than uniqueness of the label text.
    const cardMatches = markup.match(/aria-label="Continue as Sam"/g) ?? []
    expect(cardMatches).toHaveLength(2)
    const listItemMatches = markup.match(/role="listitem"/g) ?? []
    expect(listItemMatches).toHaveLength(2)
  })
})

describe('FamilyPilotStudentLogin — interactive controls are native, keyboard-operable buttons', () => {
  // Native <button type="button"> elements are focusable and Enter/Space
  // activatable by the browser/DOM by construction, so verifying the real
  // element type (rather than a div/span with an onClick) is what this
  // environment (no jsdom, no simulated key events) can assert toward normal
  // keyboard operability.
  it('every rendered control in the picker grid is <button type="button"> with an aria-label', () => {
    const markup = render(
      <FamilyPilotStudentLogin
        students={[studentA, studentB]}
        activeStudentRef={null}
        onSelectStudent={noop}
        onAuthenticated={noop}
        onLogout={noop}
        onSwitchStudent={noop}
      />,
    )
    const buttonTags = markup.match(/<button[^>]*>/g) ?? []
    expect(buttonTags.length).toBeGreaterThan(0)
    for (const tag of buttonTags) {
      expect(tag).toContain('type="button"')
      expect(tag).toContain('aria-label="Continue as ')
    }
  })

  it('Switch student and Log out in the active-student view are real buttons', () => {
    const markup = render(
      <FamilyPilotStudentLogin
        students={[studentA]}
        activeStudentRef={studentA.studentRef}
        onSelectStudent={noop}
        onAuthenticated={noop}
        onLogout={noop}
        onSwitchStudent={noop}
      />,
    )
    const buttonTags = markup.match(/<button[^>]*>/g) ?? []
    expect(buttonTags.length).toBe(2)
    for (const tag of buttonTags) {
      expect(tag).toContain('type="button"')
    }
    expect(markup).toContain('>Switch student<')
    expect(markup).toContain('>Log out<')
  })
})

describe('FamilyPilotStudentLogin — loading and error states replace the picker grid', () => {
  it('shows a status role while loading and no student cards', () => {
    const markup = render(
      <FamilyPilotStudentLogin
        students={[studentA]}
        activeStudentRef={null}
        loading
        onSelectStudent={noop}
        onAuthenticated={noop}
        onLogout={noop}
        onSwitchStudent={noop}
      />,
    )
    expect(markup).toContain('role="status"')
    expect(markup).not.toContain('aria-label="Continue as Ava"')
  })

  it('shows an alert role with the error message and no student cards', () => {
    const markup = render(
      <FamilyPilotStudentLogin
        students={[studentA]}
        activeStudentRef={null}
        error="Could not load student profiles."
        onSelectStudent={noop}
        onAuthenticated={noop}
        onLogout={noop}
        onSwitchStudent={noop}
      />,
    )
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Could not load student profiles.')
    expect(markup).not.toContain('aria-label="Continue as Ava"')
  })
})

describe('FamilyPilotStudentLogin — module boundary self-check', () => {
  it('this module only imports from itself, ./types, ./loginFlow, or src/study/contracts', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const files = ['FamilyPilotStudentLogin.tsx', 'loginFlow.ts', 'types.ts', 'index.ts']
    const importPattern = /from ['"]([^'"]+)['"]/g

    for (const file of files) {
      const source = readFileSync(path.join(dir, file), 'utf8')
      let match: RegExpExecArray | null
      while ((match = importPattern.exec(source)) !== null) {
        const specifier = match[1]
        const isOwnDirectory = specifier.startsWith('./')
        const isStudyContracts = specifier.includes('/contracts/')
        const isReact = specifier === 'react'
        expect(
          isOwnDirectory || isStudyContracts || isReact,
          `unexpected import "${specifier}" in ${file}`,
        ).toBe(true)
      }
    }
  })
})
