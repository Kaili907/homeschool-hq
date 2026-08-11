import { describe, expect, it } from 'vitest'
import {
  PARENT_HUB_MAX_CURSOR_LENGTH,
  PARENT_HUB_MAX_MUTATION_ID_LENGTH,
  PARENT_HUB_MAX_NOTE_BODY_LENGTH,
  PARENT_HUB_MAX_REFERENCE_LENGTH,
  parseAdultPrivateCommitNoteInput,
  parseCalendarCreateContinuationInput,
  parseCalendarListInput,
  parseCalendarPauseInput,
  parseNotificationsListInput,
  parseNotificationsMarkReadInput,
  parseReviewsDecideInput,
  parseReviewsListInput,
  parseSafetyReviewAndClearInput,
  parseSafetyReviewListOpenInput,
  parseSettingsApplyInput,
  parseSettingsReadInput,
} from './requestParsers'

const at = '2026-08-12T14:30:00.000Z'
const mutation = { studentRef: 'student.1', expectedRevision: 0, mutationId: 'mutation.1' } as const
const validRequests = [
  [parseSettingsReadInput, { studentRef: 'student.1' }],
  [parseSettingsApplyInput, { ...mutation, changes: { maximumWorkMinutes: 45, readAloud: true } }],
  [parseReviewsListInput, { studentRef: 'student.1', cursor: 'cursor.1' }],
  [parseReviewsDecideInput, { ...mutation, reviewRef: 'review.1', decision: 'accepted' }],
  [parseCalendarListInput, { studentRef: 'student.1' }],
  [parseCalendarPauseInput, { ...mutation, blockRef: 'block.1', reason: 'requested-break' }],
  [parseCalendarCreateContinuationInput, {
    ...mutation, sourceBlockRef: 'block.1', scheduledAt: at, durationMinutes: 30,
  }],
  [parseSafetyReviewListOpenInput, { studentRef: 'student.1' }],
  [parseSafetyReviewAndClearInput, {
    studentRef: 'student.1',
    safetyReviewRef: 'safety.1',
    proposalRevision: 3,
    sessionRevision: 5,
    calendarRevision: 8,
    mutationId: 'mutation.1',
    decision: 'resume-approved',
    reasonCode: 'adult-reviewed-resume-approved',
  }],
  [parseAdultPrivateCommitNoteInput, {
    ...mutation, noteRef: 'note.1', category: 'instructional', body: 'Use the visual fraction model next time.',
  }],
  [parseNotificationsListInput, { studentRef: 'student.1', cursor: 'cursor.1' }],
  [parseNotificationsMarkReadInput, { ...mutation, notificationId: 'notification.1' }],
] as const

describe('Parent Hub production request parsers', () => {
  it('accepts every bounded network request shape and rejects unknown keys for each operation', () => {
    for (const [parse, request] of validRequests) {
      expect(parse(request), JSON.stringify(request)).toEqual(request)
      expect(parse({ ...request, unknown: true }), JSON.stringify(request)).toBeNull()
    }
  })

  it('keeps each new ingress bound named, reviewable, inclusive, and reject-not-truncate', () => {
    expect({
      reference: PARENT_HUB_MAX_REFERENCE_LENGTH,
      mutation: PARENT_HUB_MAX_MUTATION_ID_LENGTH,
      cursor: PARENT_HUB_MAX_CURSOR_LENGTH,
      privateNote: PARENT_HUB_MAX_NOTE_BODY_LENGTH,
    }).toEqual({ reference: 128, mutation: 128, cursor: 256, privateNote: 4_000 })

    const maximumRef = `r${'x'.repeat(PARENT_HUB_MAX_REFERENCE_LENGTH - 1)}`
    const maximumMutationId = `m${'x'.repeat(PARENT_HUB_MAX_MUTATION_ID_LENGTH - 1)}`
    const maximumCursor = `c${'x'.repeat(PARENT_HUB_MAX_CURSOR_LENGTH - 1)}`
    const maximumBody = 'n'.repeat(PARENT_HUB_MAX_NOTE_BODY_LENGTH)
    expect(parseSettingsReadInput({ studentRef: maximumRef })).not.toBeNull()
    expect(parseSettingsReadInput({ studentRef: `${maximumRef}x` })).toBeNull()
    expect(parseNotificationsListInput({ studentRef: 'student.1', cursor: maximumCursor })).not.toBeNull()
    expect(parseNotificationsListInput({ studentRef: 'student.1', cursor: `${maximumCursor}x` })).toBeNull()
    expect(parseNotificationsMarkReadInput({
      ...mutation, mutationId: maximumMutationId, notificationId: 'notification.1',
    })).not.toBeNull()
    expect(parseNotificationsMarkReadInput({
      ...mutation, mutationId: `${maximumMutationId}x`, notificationId: 'notification.1',
    })).toBeNull()
    const parsedNote = parseAdultPrivateCommitNoteInput({
      ...mutation, noteRef: 'note.1', category: 'follow-up', body: maximumBody,
    })
    expect(parsedNote?.body).toBe(maximumBody)
    expect(parseAdultPrivateCommitNoteInput({
      ...mutation, noteRef: 'note.1', category: 'follow-up', body: `${maximumBody}x`,
    })).toBeNull()
  })

  it('bounds every request reference and rejects malformed cursors', () => {
    const overlong = `r${'x'.repeat(PARENT_HUB_MAX_REFERENCE_LENGTH)}`
    expect(parseReviewsDecideInput({ ...mutation, reviewRef: overlong, decision: 'accepted' })).toBeNull()
    expect(parseCalendarPauseInput({ ...mutation, blockRef: overlong, reason: 'planned-break' })).toBeNull()
    expect(parseSafetyReviewAndClearInput({
      studentRef: 'student.1', safetyReviewRef: overlong, proposalRevision: 1, sessionRevision: 1,
      calendarRevision: 1, mutationId: 'mutation.1', decision: 'end-session',
      reasonCode: 'adult-reviewed-end-session',
    })).toBeNull()
    expect(parseAdultPrivateCommitNoteInput({
      ...mutation, noteRef: overlong, category: 'administrative', body: 'Bounded note.',
    })).toBeNull()
    expect(parseNotificationsMarkReadInput({ ...mutation, notificationId: overlong })).toBeNull()
    for (const cursor of ['', 'contains spaces', 'line\nbreak', `c${'x'.repeat(PARENT_HUB_MAX_CURSOR_LENGTH)}`]) {
      expect(parseReviewsListInput({ studentRef: 'student.1', cursor })).toBeNull()
    }
  })

  it('requires finite non-negative safe integer revisions, including all three safety bindings', () => {
    for (const revision of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseSettingsApplyInput({
        ...mutation, expectedRevision: revision, changes: { reducedMotion: true },
      })).toBeNull()
    }
    const safety = {
      studentRef: 'student.1', safetyReviewRef: 'safety.1', proposalRevision: 1, sessionRevision: 2,
      calendarRevision: 3, mutationId: 'mutation.1', decision: 'end-session',
      reasonCode: 'adult-reviewed-end-session',
    } as const
    for (const revisionKey of ['proposalRevision', 'sessionRevision', 'calendarRevision'] as const) {
      expect(parseSafetyReviewAndClearInput({ ...safety, [revisionKey]: -1 })).toBeNull()
      const { [revisionKey]: _missing, ...missingRevision } = safety
      expect(parseSafetyReviewAndClearInput(missingRevision)).toBeNull()
    }
  })

  it('accepts only real requested schedule timestamps and bounded duration', () => {
    const request = { ...mutation, sourceBlockRef: 'block.1', scheduledAt: at, durationMinutes: 30 }
    expect(parseCalendarCreateContinuationInput(request)).toEqual(request)
    for (const scheduledAt of ['tomorrow', '2026-02-30T14:30:00.000Z', '2026-08-12T14:30:00+01:00']) {
      expect(parseCalendarCreateContinuationInput({ ...request, scheduledAt })).toBeNull()
    }
    expect(parseCalendarCreateContinuationInput({ ...request, durationMinutes: 0 })).toBeNull()
    expect(parseCalendarCreateContinuationInput({ ...request, durationMinutes: 481 })).toBeNull()
  })

  it('rejects empty, unknown, placement, and out-of-domain settings changes', () => {
    expect(parseSettingsApplyInput({ ...mutation, changes: {} })).toBeNull()
    expect(parseSettingsApplyInput({ ...mutation, changes: { workingLevel: 7 } })).toBeNull()
    expect(parseSettingsApplyInput({ ...mutation, changes: { grade: 6 } })).toBeNull()
    expect(parseSettingsApplyInput({ ...mutation, changes: { maximumWorkMinutes: 0 } })).toBeNull()
    expect(parseSettingsApplyInput({ ...mutation, changes: { breakMinimumMinutes: 20, breakMaximumMinutes: 10 } })).toBeNull()
    expect(parseSettingsApplyInput({ ...mutation, changes: { requiredBreaks: 21 } })).toBeNull()
    expect(parseSettingsApplyInput({ ...mutation, changes: { noAudio: 'yes' } })).toBeNull()
    expect(parseSettingsApplyInput({ ...mutation, changes: { noAudio: undefined } })).toBeNull()
  })

  it('allows only fixed safety decisions and paired reason codes without raw learner explanation', () => {
    const request = {
      studentRef: 'student.1', safetyReviewRef: 'safety.1', proposalRevision: 1, sessionRevision: 2,
      calendarRevision: 3, mutationId: 'mutation.1', decision: 'resume-approved',
      reasonCode: 'adult-reviewed-resume-approved',
    } as const
    expect(parseSafetyReviewAndClearInput(request)).toEqual(request)
    expect(parseSafetyReviewAndClearInput({ ...request, decision: 'resume' })).toBeNull()
    expect(parseSafetyReviewAndClearInput({ ...request, reasonCode: 'adult-reviewed-end-session' })).toBeNull()
    expect(parseSafetyReviewAndClearInput({ ...request, explanation: 'learner said something' })).toBeNull()
  })

  it('validates adult-private note category and body without exposing another note operation', () => {
    expect(parseAdultPrivateCommitNoteInput({
      ...mutation, noteRef: 'note.1', category: 'unknown', body: 'Valid body.',
    })).toBeNull()
    expect(parseAdultPrivateCommitNoteInput({
      ...mutation, noteRef: 'note.1', category: 'instructional', body: '   ',
    })).toBeNull()
  })

  it('rejects browser authority and server event-time injection', () => {
    expect(parseCalendarPauseInput({
      ...mutation, blockRef: 'block.1', reason: 'requested-break', pausedAt: at,
    })).toBeNull()
    expect(parseSafetyReviewAndClearInput({
      studentRef: 'student.1', safetyReviewRef: 'safety.1', proposalRevision: 1, sessionRevision: 2,
      calendarRevision: 3, mutationId: 'mutation.1', decision: 'end-session',
      reasonCode: 'adult-reviewed-end-session', reviewedAt: at,
    })).toBeNull()
    expect(parseSettingsReadInput({ studentRef: 'student.1', adultAuthorized: true })).toBeNull()
    expect(parseNotificationsMarkReadInput({ ...mutation, notificationId: 'notification.1', readAt: at })).toBeNull()
    expect(parseAdultPrivateCommitNoteInput({
      ...mutation, noteRef: 'note.1', category: 'instructional', body: 'Private note.', committedAt: at,
    })).toBeNull()
  })
})
