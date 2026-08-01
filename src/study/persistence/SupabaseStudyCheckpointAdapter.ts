import type {
  StudyCheckpointPort,
  StudyCheckpointRecord,
} from '../contracts/persistence'
import { StudyPersistenceError } from '../contracts/persistence'
import {
  authenticatedRpc,
  mutationId,
  record,
  type StudySupabaseClient,
} from './supabaseShared'

export class SupabaseStudyCheckpointAdapter implements StudyCheckpointPort {
  constructor(private readonly client: StudySupabaseClient) {}

  async readCheckpoint(sessionId: string): Promise<StudyCheckpointRecord | null> {
    const result = await authenticatedRpc(
      this.client,
      'academy_study_read_checkpoint',
      { p_session_id: sessionId },
    )
    if (result === null) return null
    const value = record(result)
    if (value.status === 'integrity-failed') {
      throw new StudyPersistenceError('integrity-failed', false)
    }
    return value as unknown as StudyCheckpointRecord
  }

  async compareAndSwapCheckpoint(
    checkpoint: StudyCheckpointRecord,
    expectedRevision: number | null,
  ) {
    const stableMutationId = await mutationId({ checkpoint, expectedRevision })
    return record(await authenticatedRpc(
      this.client,
      'academy_study_compare_and_swap_checkpoint',
      {
        p_session_id: checkpoint.sessionId,
        p_expected_revision: expectedRevision,
        p_mutation_id: stableMutationId,
        p_checkpoint: checkpoint,
      },
    )) as Awaited<ReturnType<StudyCheckpointPort['compareAndSwapCheckpoint']>>
  }
}
