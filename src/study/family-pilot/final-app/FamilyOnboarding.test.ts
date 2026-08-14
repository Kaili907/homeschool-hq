import { describe, expect, it } from 'vitest'
import { EMPTY_FAMILY_SETUP_STATE, completeSetup, type FamilySetupState } from '../setup'
import {
  emptyFinalFamilyPilotAppState,
  loadFinalFamilyPilotAppState,
  saveFinalFamilyPilotAppState,
} from './state'
import { applyFamilyLearnerDraft, type FamilyLearnerDraft } from './FamilyOnboarding'

const NOW = '2026-08-14T12:00:00.000Z'
const LATER = '2026-08-14T13:00:00.000Z'

function draft(overrides: Partial<FamilyLearnerDraft> = {}): FamilyLearnerDraft {
  return {
    studentRef: null,
    displayName: 'Learner',
    nominalGrade: '5',
    enabledSubjects: ['mathematics'],
    workingGradeBySubject: {},
    pinRequired: false,
    ...overrides,
  }
}

function apply(
  state: FamilySetupState,
  value: FamilyLearnerDraft,
  id: string,
): FamilySetupState {
  const result = applyFamilyLearnerDraft(state, value, NOW, () => id)
  if (result.status !== 'ok') throw new Error(`fixture blocked: ${result.reason}`)
  return result.state
}

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('full family onboarding model', () => {
  it('creates elementary, middle-school, and high-school learners with independent course levels', () => {
    let state = apply(EMPTY_FAMILY_SETUP_STATE, draft({
      displayName: 'Elementary',
      nominalGrade: '4',
      enabledSubjects: ['mathematics', 'english-language-arts'],
    }), 'elementary')
    state = apply(state, draft({
      displayName: 'Middle',
      nominalGrade: '8',
      enabledSubjects: ['mathematics', 'science'],
      workingGradeBySubject: { mathematics: '7' },
    }), 'middle')
    state = apply(state, draft({
      displayName: 'High',
      nominalGrade: '10',
      enabledSubjects: ['mathematics', 'science', 'financial-literacy'],
      workingGradeBySubject: { mathematics: '5' },
      pinRequired: true,
    }), 'high')

    expect(state.students.map((student) => student.nominalGrade)).toEqual(['4', '8', '10'])
    expect(state.students[0]?.workingGradeBySubject).toEqual({})
    expect(state.students[1]?.workingGradeBySubject).toEqual({ mathematics: '7' })
    expect(state.students[2]).toMatchObject({
      nominalGrade: '10',
      enabledSubjects: ['mathematics', 'science', 'financial-literacy'],
      workingGradeBySubject: { mathematics: '5' },
      pinRequired: true,
    })
  })

  it('edits one learner without changing either sibling', () => {
    let state = apply(EMPTY_FAMILY_SETUP_STATE, draft({ displayName: 'Ada' }), 'ada')
    state = apply(state, draft({ displayName: 'Bo', nominalGrade: '7', enabledSubjects: ['science'] }), 'bo')
    state = apply(state, draft({ displayName: 'Cy', nominalGrade: '12', enabledSubjects: ['technology'] }), 'cy')
    const [adaBefore, boBefore, cyBefore] = state.students

    const edited = applyFamilyLearnerDraft(state, draft({
      studentRef: boBefore!.studentRef,
      displayName: 'Bo Updated',
      nominalGrade: '8',
      enabledSubjects: ['science', 'social-studies'],
      workingGradeBySubject: { science: '5' },
    }), LATER)
    expect(edited.status).toBe('ok')
    if (edited.status !== 'ok') return

    expect(edited.state.students[0]).toBe(adaBefore)
    expect(edited.state.students[2]).toBe(cyBefore)
    expect(edited.state.students[1]).toMatchObject({
      studentRef: boBefore!.studentRef,
      displayName: 'Bo Updated',
      nominalGrade: '8',
      workingGradeBySubject: { science: '5' },
    })
  })

  it('blocks nominal Grade 6 until every selected subject has an explicit supported working grade', () => {
    const blocked = applyFamilyLearnerDraft(EMPTY_FAMILY_SETUP_STATE, draft({
      displayName: 'Sixth',
      nominalGrade: '6',
      enabledSubjects: ['mathematics', 'science'],
      workingGradeBySubject: { mathematics: '5' },
    }), NOW, () => 'sixth')
    expect(blocked).toEqual({ status: 'blocked', reason: 'invalid-working-grade' })

    const explicit = applyFamilyLearnerDraft(EMPTY_FAMILY_SETUP_STATE, draft({
      displayName: 'Sixth',
      nominalGrade: '6',
      enabledSubjects: ['mathematics', 'science'],
      workingGradeBySubject: { mathematics: '5', science: '7' },
    }), NOW, () => 'sixth')
    expect(explicit.status).toBe('ok')
    if (explicit.status === 'ok') {
      expect(explicit.state.students[0]).toMatchObject({
        nominalGrade: '6',
        workingGradeBySubject: { mathematics: '5', science: '7' },
      })
    }
  })

  it('cold-reloads a completed multi-learner setup from device storage', () => {
    let setup = apply(EMPTY_FAMILY_SETUP_STATE, draft({ displayName: 'Ada', nominalGrade: '3' }), 'ada')
    setup = apply(setup, draft({
      displayName: 'Grace',
      nominalGrade: '11',
      enabledSubjects: ['english-language-arts', 'technology'],
      workingGradeBySubject: { technology: '9' },
    }), 'grace')
    const completed = completeSetup(setup, LATER)
    if (completed.status !== 'ok') throw new Error('fixture setup did not complete')

    const storage = new MemoryStorage()
    const state = {
      ...emptyFinalFamilyPilotAppState(NOW, 'household:onboarding-test'),
      setup: completed.state,
      updatedAt: LATER,
    }
    expect(saveFinalFamilyPilotAppState(state, { storage })).toEqual({ status: 'saved' })

    const reloaded = loadFinalFamilyPilotAppState({ storage, householdRef: 'household:onboarding-test' })
    expect(reloaded.status).toBe('ready')
    expect(reloaded.state.setup.completedAt).toBe(LATER)
    expect(reloaded.state.setup.students.map((student) => student.displayName)).toEqual(['Ada', 'Grace'])
    expect(reloaded.state.setup.students[1]?.workingGradeBySubject).toEqual({ technology: '9' })
  })
})
