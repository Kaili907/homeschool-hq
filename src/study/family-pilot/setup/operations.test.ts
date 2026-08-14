import { describe, expect, it } from 'vitest'
import { generateStudentRef, isValidStudentRef } from './identifiers'
import {
  MAX_STUDENTS,
  completeSetup,
  createStudent,
  removeStudent,
  setPinRequirement,
  setWorkingGrade,
  updateStudent,
  validateFamilySetup,
} from './operations'
import { EMPTY_FAMILY_SETUP_STATE, type FamilySetupMutationResult, type FamilySetupState } from './types'

const NOW = '2026-08-12T00:00:00.000Z'
const LATER = '2026-08-13T00:00:00.000Z'

function expectOk(result: FamilySetupMutationResult): FamilySetupState {
  if (result.status !== 'ok') {
    throw new Error(`expected ok, got blocked: ${result.reason}`)
  }
  return result.state
}

function addStudent(
  state: FamilySetupState,
  overrides: Partial<{ displayName: string; nominalGrade: '3' | '4' | '5' | '6' | '7' | '8' | '10' | '12' }> = {},
) {
  return expectOk(
    createStudent(
      state,
      {
        displayName: overrides.displayName ?? 'Student',
        nominalGrade: overrides.nominalGrade ?? '5',
        enabledSubjects: ['mathematics', 'science'],
      },
      NOW,
    ),
  )
}

describe('createStudent', () => {
  it('adds multiple students, each with a distinct generated studentRef', () => {
    let state = EMPTY_FAMILY_SETUP_STATE
    state = addStudent(state, { displayName: 'Ada' })
    state = addStudent(state, { displayName: 'Grace' })
    state = addStudent(state, { displayName: 'Hedy' })

    expect(state.students).toHaveLength(3)
    const refs = state.students.map((student) => student.studentRef)
    expect(new Set(refs).size).toBe(3)
    expect(refs.every(isValidStudentRef)).toBe(true)
  })

  it('allows two students to share a display name, distinguished only by studentRef', () => {
    let state = EMPTY_FAMILY_SETUP_STATE
    state = addStudent(state, { displayName: 'Sam' })
    state = addStudent(state, { displayName: 'Sam' })

    expect(state.students).toHaveLength(2)
    expect(state.students[0].displayName).toBe('Sam')
    expect(state.students[1].displayName).toBe('Sam')
    expect(state.students[0].studentRef).not.toBe(state.students[1].studentRef)
  })

  it('rejects a blank display name', () => {
    const result = createStudent(
      EMPTY_FAMILY_SETUP_STATE,
      { displayName: '   ', nominalGrade: '5', enabledSubjects: ['mathematics'] },
      NOW,
    )
    expect(result).toEqual({ status: 'blocked', reason: 'invalid-display-name' })
  })

  it('rejects an invalid nominal grade', () => {
    const result = createStudent(
      EMPTY_FAMILY_SETUP_STATE,
      { displayName: 'Kid', nominalGrade: '99' as never, enabledSubjects: ['mathematics'] },
      NOW,
    )
    expect(result).toEqual({ status: 'blocked', reason: 'invalid-nominal-grade' })
  })

  it('rejects zero enabled subjects', () => {
    const result = createStudent(EMPTY_FAMILY_SETUP_STATE, { displayName: 'Kid', nominalGrade: '5', enabledSubjects: [] }, NOW)
    expect(result).toEqual({ status: 'blocked', reason: 'no-enabled-subjects' })
  })

  it('rejects an unknown subject', () => {
    const result = createStudent(
      EMPTY_FAMILY_SETUP_STATE,
      { displayName: 'Kid', nominalGrade: '5', enabledSubjects: ['underwater-basket-weaving' as never] },
      NOW,
    )
    expect(result).toEqual({ status: 'blocked', reason: 'invalid-subject' })
  })

  it('rejects a duplicate caller-supplied studentRef', () => {
    const first = expectOk(
      createStudent(
        EMPTY_FAMILY_SETUP_STATE,
        { displayName: 'A', nominalGrade: '5', enabledSubjects: ['mathematics'], studentRef: 'family-setup-student:fixed' },
        NOW,
      ),
    )
    const second = createStudent(
      first,
      { displayName: 'B', nominalGrade: '5', enabledSubjects: ['mathematics'], studentRef: 'family-setup-student:fixed' },
      NOW,
    )
    expect(second).toEqual({ status: 'blocked', reason: 'duplicate-ref', studentRef: 'family-setup-student:fixed' })
  })

  it('rejects a malformed caller-supplied studentRef', () => {
    const result = createStudent(
      EMPTY_FAMILY_SETUP_STATE,
      { displayName: 'A', nominalGrade: '5', enabledSubjects: ['mathematics'], studentRef: 'not valid / ref' },
      NOW,
    )
    expect(result).toEqual({ status: 'blocked', reason: 'invalid-student-ref' })
  })

  it('refuses to grow the roster past MAX_STUDENTS', () => {
    let state = EMPTY_FAMILY_SETUP_STATE
    for (let i = 0; i < MAX_STUDENTS; i++) {
      state = addStudent(state, { displayName: `Student ${i}` })
    }
    const result = createStudent(state, { displayName: 'One Too Many', nominalGrade: '5', enabledSubjects: ['mathematics'] }, NOW)
    expect(result).toEqual({ status: 'blocked', reason: 'max-students-reached' })
  })
})

describe('updateStudent', () => {
  it('changes grade and display name without changing the stable studentRef', () => {
    const created = addStudent(EMPTY_FAMILY_SETUP_STATE, { displayName: 'Ada', nominalGrade: '5' })
    const originalRef = created.students[0].studentRef

    const updated = expectOk(
      updateStudent(created, originalRef, { displayName: 'Ada L.', nominalGrade: '7' }, LATER),
    )

    expect(updated.students).toHaveLength(1)
    expect(updated.students[0].studentRef).toBe(originalRef)
    expect(updated.students[0].displayName).toBe('Ada L.')
    expect(updated.students[0].nominalGrade).toBe('7')
    expect(updated.students[0].updatedAt).toBe(LATER)
    expect(updated.students[0].createdAt).toBe(NOW)
  })

  it('leaves pinRequired and workingGradeBySubject untouched when only editing metadata', () => {
    const created = addStudent(EMPTY_FAMILY_SETUP_STATE)
    const ref = created.students[0].studentRef
    const withPin = expectOk(setPinRequirement(created, ref, true, NOW))
    const withGrade = expectOk(setWorkingGrade(withPin, ref, 'mathematics', '7', NOW))

    const updated = expectOk(updateStudent(withGrade, ref, { displayName: 'Renamed' }, LATER))

    expect(updated.students[0].pinRequired).toBe(true)
    expect(updated.students[0].workingGradeBySubject).toEqual({ mathematics: '7' })
  })

  it('reports student-not-found for an unknown ref', () => {
    const result = updateStudent(EMPTY_FAMILY_SETUP_STATE, 'family-setup-student:ghost', { displayName: 'X' }, NOW)
    expect(result).toEqual({ status: 'blocked', reason: 'student-not-found', studentRef: 'family-setup-student:ghost' })
  })

  it('rejects clearing enabledSubjects down to zero', () => {
    const created = addStudent(EMPTY_FAMILY_SETUP_STATE)
    const ref = created.students[0].studentRef
    const result = updateStudent(created, ref, { enabledSubjects: [] }, LATER)
    expect(result).toEqual({ status: 'blocked', reason: 'no-enabled-subjects', studentRef: ref })
  })

  it('rejects an unknown subject in an enabledSubjects patch', () => {
    const created = addStudent(EMPTY_FAMILY_SETUP_STATE)
    const ref = created.students[0].studentRef
    const result = updateStudent(created, ref, { enabledSubjects: ['underwater-basket-weaving' as never] }, LATER)
    expect(result).toEqual({ status: 'blocked', reason: 'invalid-subject', studentRef: ref })
  })
})

describe('setWorkingGrade', () => {
  it('overrides a subject working grade independently of the nominal grade', () => {
    const created = addStudent(EMPTY_FAMILY_SETUP_STATE, { nominalGrade: '5' })
    const ref = created.students[0].studentRef

    const updated = expectOk(setWorkingGrade(created, ref, 'mathematics', '7', NOW))

    expect(updated.students[0].nominalGrade).toBe('5')
    expect(updated.students[0].workingGradeBySubject).toEqual({ mathematics: '7' })
  })

  it('clears an override by passing null, falling back to nominal grade', () => {
    const created = addStudent(EMPTY_FAMILY_SETUP_STATE, { nominalGrade: '5' })
    const ref = created.students[0].studentRef
    const withOverride = expectOk(setWorkingGrade(created, ref, 'mathematics', '7', NOW))

    const cleared = expectOk(setWorkingGrade(withOverride, ref, 'mathematics', null, LATER))

    expect(cleared.students[0].workingGradeBySubject).toEqual({})
  })

  it('does not clear a Grade 6 subject to an unsupported implicit level', () => {
    const created = expectOk(
      createStudent(
        EMPTY_FAMILY_SETUP_STATE,
        { displayName: 'Sixth', nominalGrade: '6', enabledSubjects: ['mathematics'] },
        NOW,
      ),
    )
    const ref = created.students[0].studentRef
    const explicit = expectOk(setWorkingGrade(created, ref, 'mathematics', '5', NOW))

    expect(setWorkingGrade(explicit, ref, 'mathematics', null, LATER)).toEqual({
      status: 'blocked',
      reason: 'invalid-working-grade',
      studentRef: ref,
    })
  })

  it('refuses an override for a subject the student is not enrolled in', () => {
    const created = addStudent(EMPTY_FAMILY_SETUP_STATE)
    const ref = created.students[0].studentRef

    const result = setWorkingGrade(created, ref, 'financial-literacy', '7', NOW)

    expect(result).toEqual({ status: 'blocked', reason: 'subject-not-enabled', studentRef: ref })
  })

  it('refuses a working grade with no published academy content', () => {
    const created = addStudent(EMPTY_FAMILY_SETUP_STATE)
    const ref = created.students[0].studentRef

    const result = setWorkingGrade(created, ref, 'mathematics', '6' as never, NOW)

    expect(result).toEqual({ status: 'blocked', reason: 'invalid-working-grade', studentRef: ref })
  })

  it('reports student-not-found for an unknown ref', () => {
    const result = setWorkingGrade(EMPTY_FAMILY_SETUP_STATE, 'family-setup-student:ghost', 'mathematics', '7', NOW)
    expect(result).toEqual({ status: 'blocked', reason: 'student-not-found', studentRef: 'family-setup-student:ghost' })
  })
})

describe('setPinRequirement', () => {
  it('flips the PIN requirement flag for one student without affecting others', () => {
    let state = EMPTY_FAMILY_SETUP_STATE
    state = addStudent(state, { displayName: 'Ada' })
    state = addStudent(state, { displayName: 'Grace' })
    const [adaRef, graceRef] = state.students.map((student) => student.studentRef)

    const updated = expectOk(setPinRequirement(state, adaRef, true, NOW))

    expect(updated.students.find((student) => student.studentRef === adaRef)?.pinRequired).toBe(true)
    expect(updated.students.find((student) => student.studentRef === graceRef)?.pinRequired).toBe(false)
  })

  it('reports student-not-found for an unknown ref', () => {
    const result = setPinRequirement(EMPTY_FAMILY_SETUP_STATE, 'family-setup-student:ghost', true, NOW)
    expect(result).toEqual({ status: 'blocked', reason: 'student-not-found', studentRef: 'family-setup-student:ghost' })
  })
})

describe('validateFamilySetup', () => {
  it('flags an empty roster as invalid', () => {
    const result = validateFamilySetup(EMPTY_FAMILY_SETUP_STATE)
    expect(result.valid).toBe(false)
    expect(result.issues).toEqual([{ reason: 'empty-roster' }])
  })

  it('does not flag duplicate display names as invalid, since display name is not identity', () => {
    let state = EMPTY_FAMILY_SETUP_STATE
    state = addStudent(state, { displayName: 'Sam' })
    state = addStudent(state, { displayName: 'Sam' })

    expect(validateFamilySetup(state)).toEqual({ valid: true, issues: [] })
  })

  it('flags a student left with no enabled subjects', () => {
    const created = expectOk(
      createStudent(EMPTY_FAMILY_SETUP_STATE, { displayName: 'Kid', nominalGrade: '5', enabledSubjects: ['mathematics'] }, NOW),
    )
    const ref = created.students[0].studentRef
    const stripped = expectOk(updateStudent(created, ref, { enabledSubjects: ['science'] }, LATER))
    // sanity: enabledSubjects always non-empty via updateStudent, so force an invalid state directly to exercise the validator
    const invalid: FamilySetupState = {
      ...stripped,
      students: [{ ...stripped.students[0], enabledSubjects: [] }],
    }

    expect(validateFamilySetup(invalid).valid).toBe(false)
    expect(validateFamilySetup(invalid).issues).toContainEqual({ studentRef: ref, reason: 'no-enabled-subjects' })
  })

  it('flags every Grade 6 subject that lacks an explicit published working grade', () => {
    const created = expectOk(
      createStudent(
        EMPTY_FAMILY_SETUP_STATE,
        { displayName: 'Sixth', nominalGrade: '6', enabledSubjects: ['mathematics', 'science'] },
        NOW,
      ),
    )
    const ref = created.students[0].studentRef
    const partial = expectOk(setWorkingGrade(created, ref, 'mathematics', '5', NOW))

    expect(validateFamilySetup(partial).issues).toContainEqual({
      studentRef: ref,
      reason: 'invalid-working-grade',
    })
    expect(completeSetup(partial, LATER).status).toBe('blocked')
  })
})

describe('completeSetup', () => {
  it('blocks completion when the configuration is invalid', () => {
    const result = completeSetup(EMPTY_FAMILY_SETUP_STATE, NOW)
    expect(result.status).toBe('blocked')
    if (result.status === 'blocked') {
      expect(result.reason).toBe('invalid-configuration')
      expect(result.issues).toEqual([{ reason: 'empty-roster' }])
    }
  })

  it('completes and stamps completedAt once the roster is valid', () => {
    const state = addStudent(EMPTY_FAMILY_SETUP_STATE)
    const result = expectOk(completeSetup(state, NOW))
    expect(result.completedAt).toBe(NOW)
  })
})

describe('removeStudent', () => {
  it('removes a student with no recorded progress outright', () => {
    const created = addStudent(EMPTY_FAMILY_SETUP_STATE)
    const ref = created.students[0].studentRef

    const result = expectOk(removeStudent(created, ref, { hasProgress: false }))

    expect(result.students).toHaveLength(0)
  })

  it('blocks removal of a student with existing progress until the host confirms', () => {
    const created = addStudent(EMPTY_FAMILY_SETUP_STATE)
    const ref = created.students[0].studentRef

    const blocked = removeStudent(created, ref, { hasProgress: true })
    expect(blocked).toEqual({ status: 'blocked', reason: 'progress-confirmation-required', studentRef: ref })
    expect(created.students).toHaveLength(1)

    const confirmed = expectOk(removeStudent(created, ref, { hasProgress: true, confirmed: true }))
    expect(confirmed.students).toHaveLength(0)
  })

  it('reports student-not-found for an unknown ref', () => {
    const result = removeStudent(EMPTY_FAMILY_SETUP_STATE, 'family-setup-student:ghost', { hasProgress: false })
    expect(result).toEqual({ status: 'blocked', reason: 'student-not-found', studentRef: 'family-setup-student:ghost' })
  })
})

describe('generateStudentRef', () => {
  it('produces distinct, format-valid refs across calls', () => {
    const refs = Array.from({ length: 20 }, () => generateStudentRef())
    expect(new Set(refs).size).toBe(20)
    expect(refs.every(isValidStudentRef)).toBe(true)
  })

  it('accepts an injected id source for deterministic testing', () => {
    let counter = 0
    const ref = generateStudentRef(() => `fixed-${counter++}`)
    expect(ref).toBe('family-setup-student:fixed-0')
  })
})
