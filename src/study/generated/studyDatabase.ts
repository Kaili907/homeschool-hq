/** Generated from the Session 13 migration contract; no service credentials. */
export const STUDY_PUBLIC_TABLES = [
  'academy_study_household_settings',
  'academy_study_sessions',
  'academy_study_event_ledger',
  'academy_study_checkpoints',
  'academy_study_reviews',
  'academy_study_calendar_blocks',
  'academy_study_parent_settings',
  'academy_study_accommodations',
  'academy_study_audit_events',
] as const

export const STUDY_PRIVATE_TABLES = [
  'study_protected_learner_work',
  'study_adult_notes',
  'study_accommodation_revisions',
  'study_adult_review_proposals',
  'study_outbox',
  'study_mutation_receipts',
  'study_persistence_metadata',
  'study_effective_settings_admin_defaults',
  'study_effective_settings_safety_policy',
  'study_curriculum_release_approvals',
] as const

export const STUDY_RPC = {
  resolveCurriculumBinding: 'academy_study_resolve_curriculum_binding_v1',
  createSession: 'academy_study_create_session',
  transitionSession: 'academy_study_transition_session',
  appendEvent: 'academy_study_append_event',
  compareAndSwapCheckpoint: 'academy_study_compare_and_swap_checkpoint',
  readCheckpoint: 'academy_study_read_checkpoint',
  upsertAdultManagedRecord: 'academy_study_upsert_adult_managed_record',
  effectiveSettings: 'academy_study_effective_settings',
  effectiveSettingsV2: 'academy_study_effective_settings_v2',
  curriculumBindingReadiness: 'academy_study_curriculum_binding_readiness_v1',
  appendAdultNote: 'academy_study_append_adult_note',
  listAdultNoteMetadata: 'academy_study_list_adult_note_metadata',
  readAdultNote: 'academy_study_read_adult_note',
  storeProtectedWork: 'academy_study_store_protected_work',
  readProtectedWork: 'academy_study_read_protected_work',
  createAdultReviewProposal: 'academy_study_create_adult_review_proposal',
  enqueueOutbox: 'academy_study_enqueue_outbox',
  transitionOutbox: 'academy_study_transition_outbox',
  outboxStatus: 'academy_study_outbox_status',
} as const

export const SESSION_EVENT_DATABASE_KIND = {
  'session-started': 'session_started',
  'pause-started': 'session_paused',
  'session-resumed': 'session_resumed',
  'segment-completed': 'segment_completed',
  'technical-interruption-started': 'technical_interruption',
  'session-completed': 'session_completed',
  'session-abandoned': 'session_abandoned',
} as const
