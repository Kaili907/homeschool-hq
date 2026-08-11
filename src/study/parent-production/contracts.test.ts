import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ADULT_PRODUCTION_FAILURE_CODES,
  type AdultPrivateCommitNoteResult,
  type CalendarListResult,
  type CalendarPauseInput,
  type NotificationsListResult,
  type ParentHubAdultPrivatePort,
  type ParentHubMutationFailureCode,
  type ParentHubNotificationsPort,
  type ParentHubReadFailureCode,
  type ParentHubReviewSummary,
  type ParentHubReviewsPort,
  type ParentHubSafetyReviewPort,
  type ParentHubSettingsChanges,
  type ProductionStudyParentHubPorts,
  type ReviewsListResult,
  type SafetyReviewAndClearInput,
  type SafetyReviewAndClearResult,
  type SafetyReviewListOpenResult,
  type SettingsApplyResult,
  type SettingsReadResult,
} from './contracts'
import {
  PARENT_HUB_PRODUCTION_CONTRACT_COMPLETE,
  PARENT_HUB_PRODUCTION_ROLE_KEYS,
  assertCompleteProductionStudyParentHubPorts,
} from './wire'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false

const rootIsExact: Equal<keyof ProductionStudyParentHubPorts,
  'settings' | 'reviews' | 'calendar' | 'safetyReview' | 'adultPrivate' | 'notifications'> = true
const reviewMethodsAreExact: Equal<keyof ParentHubReviewsPort, 'list' | 'decide'> = true
const safetyMethodsAreExact: Equal<keyof ParentHubSafetyReviewPort, 'listOpen' | 'reviewAndClear'> = true
const adultPrivateMethodsAreExact: Equal<keyof ParentHubAdultPrivatePort, 'commitNote'> = true
const notificationSurfaceIsExact: Equal<keyof ParentHubNotificationsPort, 'delivery' | 'list' | 'markRead'> = true
const settingsChangesAreExact: Equal<keyof ParentHubSettingsChanges,
  | 'timerMode' | 'maximumWorkMinutes' | 'breakMinimumMinutes' | 'breakMaximumMinutes'
  | 'requiredBreaks' | 'reducedMotion' | 'noAudio' | 'largeText' | 'readAloud' | 'speechInputAllowed'> = true
const reviewProjectionIsExact: Equal<keyof ParentHubReviewSummary,
  'reviewRef' | 'studentRef' | 'kind' | 'dueAt' | 'priority' | 'state' | 'revision'> = true
const committedNoteProjectionIsExact: Equal<keyof Extract<AdultPrivateCommitNoteResult, { status: 'committed' }>,
  'status' | 'noteRef' | 'revision' | 'committedAt'> = true
const calendarPauseInputIsExact: Equal<keyof CalendarPauseInput,
  'studentRef' | 'expectedRevision' | 'mutationId' | 'blockRef' | 'reason'> = true
const safetyClearanceInputIsExact: Equal<keyof SafetyReviewAndClearInput,
  | 'studentRef' | 'safetyReviewRef' | 'proposalRevision' | 'sessionRevision' | 'calendarRevision'
  | 'mutationId' | 'decision' | 'reasonCode'> = true
const safetyDecisionsAreExact: Equal<SafetyReviewAndClearInput['decision'], 'resume-approved' | 'end-session'> = true
const safetySuccessIsBoundToAllStates: Equal<keyof Extract<SafetyReviewAndClearResult, { status: 'cleared' }>,
  'status' | 'decision' | 'proposalRevision' | 'sessionRevision' | 'calendarRevision' | 'clearedAt'> = true
type FailureCode<Result> = Extract<Result, { status: 'failed' }> extends { code: infer Code } ? Code : never
const settingsReadFailuresAreReadOnly: Equal<FailureCode<SettingsReadResult>, ParentHubReadFailureCode> = true
const reviewsListFailuresAreReadOnly: Equal<FailureCode<ReviewsListResult>, ParentHubReadFailureCode> = true
const calendarListFailuresAreReadOnly: Equal<FailureCode<CalendarListResult>, ParentHubReadFailureCode> = true
const safetyListFailuresAreReadOnly: Equal<FailureCode<SafetyReviewListOpenResult>, ParentHubReadFailureCode> = true
const notificationListFailuresAreReadOnly: Equal<FailureCode<NotificationsListResult>, ParentHubReadFailureCode> = true
const settingsApplyFailuresAreMutationOnly: Equal<FailureCode<SettingsApplyResult>, ParentHubMutationFailureCode> = true

const here = dirname(fileURLToPath(import.meta.url))
const productionSource = readdirSync(here)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .map((name) => readFileSync(join(here, name), 'utf8'))
  .join('\n')

describe('Parent Hub production contract boundary', () => {
  it('declares exactly the six complete adult roles', () => {
    expect(PARENT_HUB_PRODUCTION_ROLE_KEYS).toEqual([
      'settings', 'reviews', 'calendar', 'safetyReview', 'adultPrivate', 'notifications',
    ])
    expect(PARENT_HUB_PRODUCTION_CONTRACT_COMPLETE).toBe(true)
    expect([
      rootIsExact, reviewMethodsAreExact, safetyMethodsAreExact, adultPrivateMethodsAreExact,
      notificationSurfaceIsExact, settingsChangesAreExact, reviewProjectionIsExact,
      committedNoteProjectionIsExact, calendarPauseInputIsExact, safetyClearanceInputIsExact,
      safetyDecisionsAreExact, safetySuccessIsBoundToAllStates, settingsReadFailuresAreReadOnly,
      reviewsListFailuresAreReadOnly, calendarListFailuresAreReadOnly, safetyListFailuresAreReadOnly,
      notificationListFailuresAreReadOnly, settingsApplyFailuresAreMutationOnly,
    ]).not.toContain(false)
  })

  it('fails clearly when any adult role is missing', () => {
    expect(() => assertCompleteProductionStudyParentHubPorts({})).toThrow(
      'missing settings, reviews, calendar, safetyReview, adultPrivate, notifications port',
    )
  })

  it('keeps learner, Tutor, persistence, outbox, and wider delivery capabilities out', () => {
    const importStatements = [...productionSource.matchAll(/(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g)]
      .map((match) => match[1])
      .join('\n')
    expect(importStatements).not.toMatch(/ports|production|persistence|supabase|outbox|runtime|container/i)
    expect(productionSource).not.toMatch(/StudyPortBundle|ProductionStudySessionPorts|Tutor|checkpoint|eventLedger|learnerPersistence|Supabase|outbox|service-role/i)
    expect(productionSource).not.toMatch(/email|sms|enqueue|whole-row|upsert/i)
  })

  it('accepts selectors but no client-supplied authority truth', () => {
    expect(productionSource).not.toMatch(/adultAuthorized|isAdult|actorRole|permissionGranted|householdId|studentId|serviceRole|accessToken/i)
  })

  it('forbids academic placement settings and minimizes adult projections', () => {
    expect(productionSource).not.toMatch(/workingLevel|working_level|mastery|coursePlacement|course_placement|\bgrade\b|\bpermissions?\b/i)
    expect(productionSource).not.toMatch(/rawAnswer|rawLearner|transcript|protectedWork|noteMetadata|fullNote/i)
    expect(reviewMethodsAreExact).toBe(true)
    expect(adultPrivateMethodsAreExact).toBe(true)
    expect(notificationSurfaceIsExact).toBe(true)
  })

  it('uses the closed adult result vocabulary', () => {
    expect(ADULT_PRODUCTION_FAILURE_CODES).toEqual([
      'adult-unauthorized',
      'student-out-of-guardian-scope',
      'stale-revision',
      'idempotency-collision',
      'authorization-infrastructure-unavailable',
      'rate-limited',
      'not-found',
      'already-decided',
      'safety-state-changed',
    ])
  })
})
