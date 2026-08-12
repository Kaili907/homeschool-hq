import { describe, expect, it, vi } from 'vitest'
import {
  checkPin,
  findStudentByRef,
  pickStudent,
  studentRefKey,
  studentRefsEqual,
  studentRequiresPin,
} from './loginFlow'
import type { FamilyPilotStudentProfile, FamilyPilotStudentRef } from './types'

function ref(value: string, kind: FamilyPilotStudentRef['kind'] = 'academy-student-id'): FamilyPilotStudentRef {
  return { kind, value }
}

function student(overrides: Partial<FamilyPilotStudentProfile> = {}): FamilyPilotStudentProfile {
  return {
    studentRef: ref('student-a'),
    displayName: 'Ava',
    ...overrides,
  }
}

describe('studentRefsEqual', () => {
  it('is true for two refs with the same kind and value', () => {
    expect(studentRefsEqual(ref('a'), ref('a'))).toBe(true)
  })

  it('is false for refs with different values', () => {
    expect(studentRefsEqual(ref('a'), ref('b'))).toBe(false)
  })

  it('is false for refs with the same value but a different kind', () => {
    expect(studentRefsEqual(ref('a', 'academy-student-id'), ref('a', 'legacy-profile-id'))).toBe(false)
  })

  it('is false when either side is null or undefined', () => {
    expect(studentRefsEqual(null, ref('a'))).toBe(false)
    expect(studentRefsEqual(ref('a'), undefined)).toBe(false)
    expect(studentRefsEqual(null, null)).toBe(false)
  })
})

describe('studentRefKey', () => {
  it('combines kind and value into a stable key', () => {
    expect(studentRefKey(ref('a'))).toBe('academy-student-id:a')
  })

  it('produces different keys for the same value under different kinds', () => {
    expect(studentRefKey(ref('a', 'academy-student-id'))).not.toBe(studentRefKey(ref('a', 'legacy-profile-id')))
  })
})

describe('findStudentByRef — identity is studentRef, never display label', () => {
  // Both students share the exact same displayName on purpose, to prove lookup
  // is keyed on studentRef and not on the (intentionally colliding) label text.
  const studentA = student({ studentRef: ref('student-a'), displayName: 'Sam' })
  const studentB = student({ studentRef: ref('student-b'), displayName: 'Sam' })
  const roster = [studentA, studentB]

  it('returns the distinct student matching each distinct ref, despite identical display names', () => {
    expect(findStudentByRef(roster, ref('student-a'))).toBe(studentA)
    expect(findStudentByRef(roster, ref('student-b'))).toBe(studentB)
  })

  it('returns null when the ref is null', () => {
    expect(findStudentByRef(roster, null)).toBeNull()
  })

  it('returns null when no student in the roster matches the ref', () => {
    expect(findStudentByRef(roster, ref('student-c'))).toBeNull()
  })
})

describe('pickStudent', () => {
  it('selecting student A reports exactly A’s studentRef to the callback and returns it', () => {
    const studentA = student({ studentRef: ref('student-a'), displayName: 'Ava' })
    const onSelectStudent = vi.fn()

    const result = pickStudent(onSelectStudent, studentA)

    expect(onSelectStudent).toHaveBeenCalledTimes(1)
    expect(onSelectStudent).toHaveBeenCalledWith(studentA.studentRef)
    expect(result).toBe(studentA.studentRef)
  })

  it('selecting student B reports exactly B’s studentRef, distinct from A’s', () => {
    const studentA = student({ studentRef: ref('student-a'), displayName: 'Ava' })
    const studentB = student({ studentRef: ref('student-b'), displayName: 'Bea' })
    const onSelectStudent = vi.fn()

    const resultA = pickStudent(onSelectStudent, studentA)
    const resultB = pickStudent(onSelectStudent, studentB)

    expect(onSelectStudent).toHaveBeenNthCalledWith(1, studentA.studentRef)
    expect(onSelectStudent).toHaveBeenNthCalledWith(2, studentB.studentRef)
    expect(resultA).toBe(studentA.studentRef)
    expect(resultB).toBe(studentB.studentRef)
    expect(studentRefsEqual(resultA, resultB)).toBe(false)
  })
})

describe('studentRequiresPin', () => {
  it('is true when the student requires a PIN and a verifier is available', () => {
    expect(studentRequiresPin(student({ pinRequired: true }), () => true)).toBe(true)
  })

  it('is false when the student does not require a PIN', () => {
    expect(studentRequiresPin(student({ pinRequired: false }), () => true)).toBe(false)
  })

  it('is false when pinRequired is true but no verifier was supplied (recovery cannot be reached)', () => {
    expect(studentRequiresPin(student({ pinRequired: true }), undefined)).toBe(false)
  })
})

describe('checkPin', () => {
  const studentRef = ref('student-a')

  it('a valid PIN permits entry', () => {
    const onVerifyPin = (_ref: FamilyPilotStudentRef, pin: string) => pin === '1234'
    expect(checkPin(onVerifyPin, studentRef, '1234')).toEqual({ accepted: true })
  })

  it('an invalid PIN refuses entry with a message', () => {
    const onVerifyPin = (_ref: FamilyPilotStudentRef, pin: string) => pin === '1234'
    const result = checkPin(onVerifyPin, studentRef, '0000')
    expect(result.accepted).toBe(false)
    expect(result.accepted === false && result.message.length > 0).toBe(true)
  })

  // checkPin's rejection branch only ever returns a message — it has no way to
  // reach into or clear any caller-held selection state. In the component
  // (FamilyPilotStudentLogin.tsx PinEntry.press), the rejection branch resets
  // only the local PIN digits (setDigits('')); the selected student
  // (selectedRef, held by the parent StudentPicker) is never touched, so a
  // wrong PIN never destroys the pending selection and the same student stays
  // selected for a retry.
  it('rejection carries a message but has no mechanism to mutate any external state', () => {
    const onVerifyPin = () => false
    const result = checkPin(onVerifyPin, studentRef, '0000')
    expect(result).toEqual({ accepted: false, message: 'That PIN is not right. Try again.' })
  })

  it('passes the exact studentRef and pin through to the verifier', () => {
    const onVerifyPin = vi.fn().mockReturnValue(true)
    checkPin(onVerifyPin, studentRef, '5678')
    expect(onVerifyPin).toHaveBeenCalledWith(studentRef, '5678')
  })
})
