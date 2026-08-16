import type { FamilyPilotStudentProfile, FamilyPilotStudentRef } from './types'

/** studentRef is the only identity signal this module trusts — display labels are cosmetic only. */
export function studentRefsEqual(
  a: FamilyPilotStudentRef | null | undefined,
  b: FamilyPilotStudentRef | null | undefined,
): boolean {
  if (!a || !b) return false
  return a.kind === b.kind && a.value === b.value
}

export function studentRefKey(ref: FamilyPilotStudentRef): string {
  return `${ref.kind}:${ref.value}`
}

export function findStudentByRef(
  students: readonly FamilyPilotStudentProfile[],
  ref: FamilyPilotStudentRef | null,
): FamilyPilotStudentProfile | null {
  if (!ref) return null
  return students.find((student) => studentRefsEqual(student.studentRef, ref)) ?? null
}

/** Notifies the host of the pick and reports which studentRef was picked. */
export function pickStudent(
  onSelectStudent: (studentRef: FamilyPilotStudentRef) => void,
  student: FamilyPilotStudentProfile,
): FamilyPilotStudentRef {
  onSelectStudent(student.studentRef)
  return student.studentRef
}

export function studentRequiresPin(
  student: FamilyPilotStudentProfile,
  onVerifyPin: ((studentRef: FamilyPilotStudentRef, pin: string) => Promise<boolean>) | undefined,
): boolean {
  return Boolean(student.pinRequired && onVerifyPin)
}

export type PinCheckResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly message: string }

/** Wrong PIN never destroys the pending selection — the caller just re-prompts. */
export async function checkPin(
  onVerifyPin: (studentRef: FamilyPilotStudentRef, pin: string) => Promise<boolean>,
  studentRef: FamilyPilotStudentRef,
  pin: string,
): Promise<PinCheckResult> {
  return await onVerifyPin(studentRef, pin)
    ? { accepted: true }
    : { accepted: false, message: 'That PIN is not right. Try again.' }
}
