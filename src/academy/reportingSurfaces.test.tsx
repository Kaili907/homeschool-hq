import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultAppState, emptyProfile } from '../migration'
import type { AppState, Profile } from '../types'
import { defaultSchoolYear } from '../curriculum/pacing'
import { loadPlans } from '../curriculum/loader'
import { expectedSubjects, subjectPlansFor } from '../curriculum/hubModel'
import { skillsForGrade } from '../skills'
import { placementOrder } from '../engine'
import { defaultTemplateFor } from '../missions'
import { isHighSchool } from '../hs/hsState'
import { Picker } from '../components/Picker'
import { StatusView } from '../components/hub/StatusView'
import { TodayView } from '../components/hub/TodayView'
import { AcademyParentPanel } from '../components/hub/AcademyParentPanel'
import { setWorkingLevel } from './workingLevel'

/**
 * ACADEMY-LEVEL-DECOUPLE — the other half of the contract. Working level decides
 * CONTENT and nothing else: every surface that reports or gates on "what grade
 * is she in" must keep reading Profile.grade. A regression here would quietly
 * mis-state a girl's grade on the record, which is worse than showing her the
 * wrong lesson.
 */

/** The card's worked example: a sixth grader placed into Grade 5 mathematics
 * and Grade 7 reading. Every assertion below is against THIS profile. */
function decoupledSixthGrader(id = 'p3'): Profile {
  return setWorkingLevel(
    setWorkingLevel(emptyProfile(id, 'Sixth Grader', '6'), 'mathematics', '5'),
    'english-language-arts',
    '7',
  )
}

function stateWith(profile: Profile): AppState {
  const state = defaultAppState()
  state.profiles[profile.id] = profile
  return state
}

const today = '2026-08-05'
const sy = defaultSchoolYear('2026-08-03')

describe('reporting surfaces keep reading NOMINAL grade', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('the Parent Hub receives the same five canonical names and nominal grades', () => {
    const state = defaultAppState()
    const html = renderToStaticMarkup(
      <TodayView
        profiles={Object.values(state.profiles)}
        docs={loadPlans()}
        sy={sy}
        today={today}
        state={state}
      />,
    )
    for (const [name, grade] of [
      ['Kaili Manuel', '12'],
      ['Arianna Manuel', '10'],
      ['Stephanie Manuel', '7'],
      ['Lucia Manuel', '4'],
      ['Aly Manuel', '3'],
    ]) {
      expect(html).toContain(name)
      expect(html).toContain(`Gr ${grade}`)
    }
  })

  it('the Parent Hub Status view reports her grade, not her working level', () => {
    const html = renderToStaticMarkup(
      <StatusView profiles={[decoupledSixthGrader()]} today={today} onPatchProfile={() => {}} />,
    )
    expect(html).toContain('Grade 6')
    expect(html).not.toContain('Grade 5')
    expect(html).not.toContain('Grade 7')
  })

  it('the Parent Hub Today view reports her grade', () => {
    const state = stateWith(decoupledSixthGrader())
    const html = renderToStaticMarkup(
      <TodayView
        profiles={[state.profiles.p3]}
        docs={loadPlans()}
        sy={sy}
        today={today}
        state={state}
      />,
    )
    expect(html).toContain('Gr 6')
    expect(html).not.toContain('Gr 5')
  })

  it('the sign-in picker renders the profile nominal grade without a decorative override', () => {
    const state = stateWith(decoupledSixthGrader())
    const html = renderToStaticMarkup(
      <Picker state={state} onStudentSelect={() => {}} onParentLogin={() => {}} />,
    )
    expect(html).toContain('Sixth Grader')
    expect(html).toContain('6th Grade')
    expect(html).not.toContain('7th Grade')
    expect(state.profiles.p3.grade).toBe('6')
  })

  it('the Academy parent panel labels the learner by grade while serving her levels', () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', 'true')
    vi.stubEnv('VITE_ACADEMY_GRADE_7_ENABLED', 'true')
    const html = renderToStaticMarkup(
      <AcademyParentPanel profiles={[decoupledSixthGrader()]} sy={sy} onPatchProfile={() => {}} />,
    )
    expect(html).toContain('grade 6')
    expect(html).not.toContain('grade 5')
  })
})

describe('content and gating helpers outside the Academy are untouched', () => {
  it('plan subjects, skill tree, placement order and mission template ride her grade', () => {
    const girl = decoupledSixthGrader()
    const plain = emptyProfile('p3', 'Sixth Grader', '6')

    expect(expectedSubjects(girl.grade)).toEqual(expectedSubjects('6'))
    expect(subjectPlansFor(girl, loadPlans(), sy, today)).toEqual(
      subjectPlansFor(plain, loadPlans(), sy, today),
    )
    expect(skillsForGrade(girl.grade)).toEqual(skillsForGrade('6'))
    // placementOrder shuffles and truncates, so assert the pool it draws from
    const grade6Ids = new Set(skillsForGrade('6').map((s) => s.id))
    expect(placementOrder(girl.grade).every((id) => grade6Ids.has(id))).toBe(true)
    expect(defaultTemplateFor(girl.grade)).toEqual(defaultTemplateFor('6'))
    expect(isHighSchool(girl)).toBe(false)
  })

  it('a working level never promotes a girl into high-school mode', () => {
    const senior = emptyProfile('p5', 'Senior', '12')
    const held = setWorkingLevel(senior, 'mathematics', '8')
    expect(held.grade).toBe('12')
    expect(isHighSchool(held)).toBe(true)
    expect(skillsForGrade(held.grade)).toEqual(skillsForGrade('12'))
  })

  it('the shipped household seeds carry no working levels at all', () => {
    for (const p of Object.values(defaultAppState().profiles)) {
      expect(p.workingLevels).toBeUndefined()
    }
  })
})
