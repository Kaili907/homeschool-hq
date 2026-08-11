import { describe, expect, it } from 'vitest'
import {
  parseAdultPrivateCommitNoteResult,
  parseCalendarCreateContinuationResult,
  parseCalendarListResult,
  parseCalendarPauseResult,
  parseNotificationsListResult,
  parseNotificationsMarkReadResult,
  parseReviewsDecideResult,
  parseReviewsListResult,
  parseSafetyReviewAndClearResult,
  parseSafetyReviewListOpenResult,
  parseSettingsApplyResult,
  parseSettingsReadResult,
} from './parsers'

const at = '2026-08-10T14:30:00.000Z'
const settings = {
  timerMode: 'visible',
  maximumWorkMinutes: 45,
  breakMinimumMinutes: 5,
  breakMaximumMinutes: 15,
  requiredBreaks: 1,
  reducedMotion: false,
  noAudio: false,
  largeText: false,
  readAloud: true,
  speechInputAllowed: true,
} as const
const notification = {
  notificationId: 'notification.1',
  studentRef: 'student.1',
  title: 'Safety review required',
  category: 'safety',
  urgency: 'urgent',
  createdAt: at,
  readAt: null,
  safeActionRef: 'safety-review.1',
} as const

describe('Parent Hub production response parsers', () => {
  it('accepts bounded settings results and rejects unknown placement keys', () => {
    const valid = { status: 'settings', settings, revision: 4, updatedAt: at }
    expect(parseSettingsReadResult(valid)).toEqual(valid)
    expect(parseSettingsReadResult({ ...valid, settings: { ...settings, workingLevel: 7 } })).toBeNull()
    expect(parseSettingsReadResult({ ...valid, revision: 1.5 })).toBeNull()
    expect(parseSettingsReadResult({ ...valid, updatedAt: 'tomorrow' })).toBeNull()
    expect(parseSettingsApplyResult({ status: 'applied', revision: 5, appliedAt: at })).not.toBeNull()
    expect(parseSettingsApplyResult({ status: 'stale-revision', currentRevision: -1 })).toBeNull()
  })

  it('accepts minimized review/calendar/safety projections and their fixed conflict branches', () => {
    expect(parseReviewsListResult({
      status: 'listed',
      reviews: [{ reviewRef: 'review.1', studentRef: 'student.1', kind: 'reteach', dueAt: at, priority: 2, state: 'pending', revision: 1 }],
    })).not.toBeNull()
    expect(parseReviewsDecideResult({ status: 'already-decided', decision: 'accepted', revision: 2 })).not.toBeNull()
    expect(parseCalendarListResult({
      status: 'listed',
      blocks: [{ blockRef: 'block.1', studentRef: 'student.1', category: 'lesson', scheduledAt: at, durationMinutes: 30, state: 'scheduled', revision: 1 }],
    })).not.toBeNull()
    expect(parseCalendarPauseResult({ status: 'calendar-state-changed', currentState: 'completed', revision: 2 })).not.toBeNull()
    expect(parseCalendarPauseResult({ status: 'continuation-created', blockRef: 'block.2', revision: 2, createdAt: at })).toBeNull()
    expect(parseCalendarCreateContinuationResult({ status: 'continuation-created', blockRef: 'block.2', revision: 2, createdAt: at })).not.toBeNull()
    expect(parseCalendarCreateContinuationResult({ status: 'paused', revision: 2, pausedAt: at })).toBeNull()
    expect(parseSafetyReviewListOpenResult({
      status: 'listed',
      reviews: [{ safetyReviewRef: 'safety.1', studentRef: 'student.1', category: 'urgent-safety', urgency: 'urgent', heldAt: at, revision: 3 }],
    })).not.toBeNull()
    expect(parseSafetyReviewAndClearResult({
      status: 'cleared',
      decision: 'resume-approved',
      proposalRevision: 4,
      sessionRevision: 7,
      calendarRevision: 9,
      clearedAt: at,
    })).not.toBeNull()
    expect(parseSafetyReviewAndClearResult({
      status: 'safety-state-changed', proposalRevision: 4, sessionRevision: 7, calendarRevision: 9,
    })).not.toBeNull()
    expect(parseSafetyReviewAndClearResult({ status: 'stale-revision', currentRevision: 4 })).toBeNull()
    expect(parseSafetyReviewAndClearResult({ status: 'failed', code: 'safety-state-changed' })).toBeNull()
  })

  it('never accepts a note body in a successful commit response', () => {
    const committed = { status: 'committed', noteRef: 'note.1', revision: 2, committedAt: at }
    expect(parseAdultPrivateCommitNoteResult(committed)).toEqual(committed)
    expect(parseAdultPrivateCommitNoteResult({ ...committed, body: 'private text' })).toBeNull()
  })

  it('keeps notifications in-app metadata-only and rejects raw content', () => {
    const valid = { status: 'listed', notifications: [notification] }
    expect(parseNotificationsListResult(valid)).toEqual(valid)
    expect(parseNotificationsListResult({
      status: 'listed', notifications: [{ ...notification, transcript: 'learner text' }],
    })).toBeNull()
    expect(parseNotificationsMarkReadResult({ status: 'marked-read', revision: 2, readAt: at })).not.toBeNull()
  })

  it('rejects unknown keys, overlong refs, malformed timestamps, oversized lists, and invalid failures', () => {
    expect(parseNotificationsListResult({ status: 'listed', notifications: [notification], extra: true })).toBeNull()
    expect(parseNotificationsListResult({
      status: 'listed', notifications: [{ ...notification, notificationId: `n${'x'.repeat(128)}` }],
    })).toBeNull()
    expect(parseNotificationsListResult({
      status: 'listed', notifications: [{ ...notification, createdAt: '2026-99-99T14:30:00Z' }],
    })).toBeNull()
    expect(parseNotificationsListResult({ status: 'listed', notifications: Array(101).fill(notification) })).toBeNull()
    expect(parseNotificationsListResult({ status: 'failed', code: 'authorization-infrastructure-unavailable' })).not.toBeNull()
    for (const parseListResult of [
      parseSettingsReadResult, parseReviewsListResult, parseCalendarListResult,
      parseSafetyReviewListOpenResult, parseNotificationsListResult,
    ]) {
      expect(parseListResult({ status: 'failed', code: 'idempotency-collision' })).toBeNull()
      expect(parseListResult({ status: 'failed', code: 'stale-revision' })).toBeNull()
      expect(parseListResult({ status: 'failed', code: 'already-decided' })).toBeNull()
      expect(parseListResult({ status: 'failed', code: 'safety-state-changed' })).toBeNull()
    }
    expect(parseNotificationsListResult({ status: 'failed', code: 'unknown' })).toBeNull()
    expect(parseNotificationsListResult({ status: 'failed', code: 'rate-limited', retryAfterSeconds: 0 })).toBeNull()
    expect(parseNotificationsListResult({ status: 'failed', code: 'adult-unauthorized', detail: 'secret' })).toBeNull()
    expect(parseSettingsApplyResult({ status: 'failed', code: 'idempotency-collision' })).not.toBeNull()
    expect(parseSettingsApplyResult({ status: 'failed', code: 'already-decided' })).toBeNull()
  })
})
