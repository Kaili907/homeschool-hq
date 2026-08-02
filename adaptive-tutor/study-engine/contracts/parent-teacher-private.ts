import type {
  ActorReference,
  ContractHeader,
  ISODateTime,
  PrivateNoteId,
  PrivateRecordId,
  StudentId,
} from './common.ts'

export interface ParentTeacherPrivateNote {
  readonly id: PrivateNoteId
  readonly author: ActorReference & { readonly role: 'parent' | 'teacher' }
  readonly createdAt: ISODateTime
  readonly updatedAt: ISODateTime
  readonly visibility: 'authorized-adults-only'
  readonly category: 'instructional' | 'accommodation' | 'schedule' | 'review' | 'other'
  readonly body: string
}

/**
 * Must use an adult-authorized storage/projection boundary. It is never embedded
 * in student-safe controls, sessions, learning evidence, or review payloads.
 */
export interface ParentTeacherPrivateRecord
  extends ContractHeader<'parent-teacher-private', PrivateRecordId> {
  readonly studentId: StudentId
  readonly notes: readonly ParentTeacherPrivateNote[]
}

