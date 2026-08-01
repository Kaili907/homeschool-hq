import type {
  AdultNoteWrite,
  ProtectedWorkWrite,
  StoredResult,
  StudyAdultPrivatePort,
} from '../contracts/persistence'
import { authenticatedRpc, record, records, type StudySupabaseClient } from './supabaseShared'

export class SupabaseStudyAdultPrivateAdapter implements StudyAdultPrivatePort {
  constructor(private readonly client: StudySupabaseClient) {}

  async storeProtectedWork(work: ProtectedWorkWrite) {
    return record(await authenticatedRpc(
      this.client,
      'academy_study_store_protected_work',
      { p_work: envelopeWork(work) },
    ))
  }

  async readProtectedWork(studentId: string, id: string, revision: number) {
    return record(await authenticatedRpc(
      this.client,
      'academy_study_read_protected_work',
      { p_student_id: studentId, p_work_id: id, p_revision: revision },
    ))
  }

  async appendAdultNote(note: AdultNoteWrite): Promise<StoredResult> {
    return record(await authenticatedRpc(
      this.client,
      'academy_study_append_adult_note',
      { p_note: envelopeNote(note) },
    )) as StoredResult
  }

  async listAdultNoteMetadata(studentId: string) {
    return records(await authenticatedRpc(
      this.client,
      'academy_study_list_adult_note_metadata',
      { p_student_id: studentId },
    ))
  }

  async readAdultNote(input: {
    studentId: string
    noteId: string
    revision: number
    correlationId: string
  }) {
    return record(await authenticatedRpc(
      this.client,
      'academy_study_read_adult_note',
      {
        p_student_id: input.studentId,
        p_note_id: input.noteId,
        p_revision: input.revision,
        p_correlation_id: input.correlationId,
      },
    ))
  }
}

function envelopeWork(work: ProtectedWorkWrite) {
  return {
    id: work.id,
    revision: work.revision,
    session_id: work.sessionId,
    checkpoint_id: work.checkpointId,
    kms_key_reference: work.kmsKeyReference,
    wrapped_data_key_base64: work.wrappedDataKeyBase64,
    nonce_base64: work.nonceBase64,
    authentication_tag_base64: work.authenticationTagBase64,
    encrypted_payload_base64: work.encryptedPayloadBase64,
    keyed_integrity_tag_base64: work.keyedIntegrityTagBase64,
    expires_at: work.expiresAt,
  }
}

function envelopeNote(note: AdultNoteWrite) {
  return {
    note_id: note.noteId,
    student_id: note.studentId,
    expected_revision: note.expectedRevision,
    category: note.category,
    encrypted_body_base64: note.encryptedBodyBase64,
    kms_key_reference: note.kmsKeyReference,
    wrapped_data_key_base64: note.wrappedDataKeyBase64,
    nonce_base64: note.nonceBase64,
    authentication_tag_base64: note.authenticationTagBase64,
    keyed_integrity_tag_base64: note.keyedIntegrityTagBase64,
    expires_at: note.expiresAt,
  }
}
