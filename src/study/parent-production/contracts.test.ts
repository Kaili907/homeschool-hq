import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ADULT_PRODUCTION_FAILURE_CODES,
  type AdultPrivateCommitNoteResult,
  type AdultMutationFailureCode,
  type AdultReadFailureCode,
  type CalendarCreateContinuationResult,
  type CalendarListResult,
  type CalendarPauseResult,
  type NotificationsListResult,
  type NotificationsMarkReadResult,
  type ParentHubAdultPrivatePort,
  type ParentHubCalendarPort,
  type ParentHubNotificationsPort,
  type ParentHubReviewSummary,
  type ParentHubReviewsPort,
  type ParentHubSafetyDecision,
  type ParentHubSafetyDecisionReason,
  type ParentHubSafetyReviewPort,
  type ParentHubSettingsChanges,
  type ProductionStudyParentHubPorts,
  type ReviewsDecideResult,
  type ReviewsListResult,
  type SafetyReviewAndClearResult,
  type SafetyReviewListOpenResult,
  type SettingsApplyResult,
  type SettingsReadResult,
} from './contracts'
import {
  PARENT_HUB_PRODUCTION_CONTRACT_COMPLETE,
  PARENT_HUB_PRODUCTION_ROLE_KEYS,
  assertCompleteProductionStudyParentHubPorts,
  defineProductionStudyParentHubPorts,
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
const notificationDeliveryIsInAppOnly: Equal<ParentHubNotificationsPort['delivery'], 'in-app'> = true
const settingsChangesAreExact: Equal<keyof ParentHubSettingsChanges,
  | 'timerMode' | 'maximumWorkMinutes' | 'breakMinimumMinutes' | 'breakMaximumMinutes'
  | 'requiredBreaks' | 'reducedMotion' | 'noAudio' | 'largeText' | 'readAloud' | 'speechInputAllowed'> = true
const reviewProjectionIsExact: Equal<keyof ParentHubReviewSummary,
  'reviewRef' | 'studentRef' | 'kind' | 'dueAt' | 'priority' | 'state' | 'revision'> = true
const committedNoteProjectionIsExact: Equal<keyof Extract<AdultPrivateCommitNoteResult, { status: 'committed' }>,
  'status' | 'noteRef' | 'revision' | 'committedAt'> = true
const calendarPauseInputIsExact: Equal<keyof Parameters<ParentHubCalendarPort['pause']>[0],
  'studentRef' | 'expectedRevision' | 'mutationId' | 'blockRef' | 'reason'> = true
const safetyReviewInputIsExact: Equal<keyof Parameters<ParentHubSafetyReviewPort['reviewAndClear']>[0],
  | 'studentRef' | 'safetyReviewRef' | 'sessionRef' | 'blockRef' | 'decision' | 'reasonCode'
  | 'expectedSafetyRevision' | 'expectedSessionRevision' | 'expectedCalendarRevision' | 'mutationId'> = true
const safetyDecisionIsExact: Equal<ParentHubSafetyDecision, 'resume-approved' | 'end-session'> = true
const safetyReasonIsFixed: Equal<ParentHubSafetyDecisionReason, 'adult-safety-review-completed'> = true
const pauseSuccessIsServerTimestamped: Equal<keyof Extract<CalendarPauseResult, { status: 'paused' }>,
  'status' | 'revision' | 'pausedAt'> = true
const safetySuccessIsServerTimestamped: Equal<keyof Extract<SafetyReviewAndClearResult, { status: 'cleared' }>,
  | 'status' | 'decision' | 'safetyRevision' | 'sessionRevision' | 'calendarRevision'
  | 'reviewedAt' | 'clearedAt'> = true
type FailureCodeOf<Result> = Extract<Result, { status: 'failed' }> extends { code: infer Code } ? Code : never
const settingsReadFailuresAreExact: Equal<FailureCodeOf<SettingsReadResult>, AdultReadFailureCode> = true
const reviewsListFailuresAreExact: Equal<FailureCodeOf<ReviewsListResult>, AdultReadFailureCode> = true
const calendarListFailuresAreExact: Equal<FailureCodeOf<CalendarListResult>, AdultReadFailureCode> = true
const safetyListFailuresAreExact: Equal<FailureCodeOf<SafetyReviewListOpenResult>, AdultReadFailureCode> = true
const notificationsListFailuresAreExact: Equal<FailureCodeOf<NotificationsListResult>, AdultReadFailureCode> = true
const settingsApplyFailuresAreExact: Equal<FailureCodeOf<SettingsApplyResult>, AdultMutationFailureCode> = true
const reviewsDecideFailuresAreExact: Equal<FailureCodeOf<ReviewsDecideResult>, AdultMutationFailureCode> = true
const calendarPauseFailuresAreExact: Equal<FailureCodeOf<CalendarPauseResult>, AdultMutationFailureCode> = true
const continuationFailuresAreExact: Equal<FailureCodeOf<CalendarCreateContinuationResult>, AdultMutationFailureCode> = true
const safetyDecisionFailuresAreExact: Equal<FailureCodeOf<SafetyReviewAndClearResult>, AdultMutationFailureCode> = true
const commitNoteFailuresAreExact: Equal<FailureCodeOf<AdultPrivateCommitNoteResult>, AdultMutationFailureCode> = true
const markReadFailuresAreExact: Equal<FailureCodeOf<NotificationsMarkReadResult>, AdultMutationFailureCode> = true

const here = dirname(fileURLToPath(import.meta.url))
const productionSource = readdirSync(here)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .map((name) => readFileSync(join(here, name), 'utf8'))
  .join('\n')

function validParentHubPorts(): ProductionStudyParentHubPorts {
  return {
    settings: {
      read: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
      apply: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
    },
    reviews: {
      list: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
      decide: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
    },
    calendar: {
      list: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
      pause: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
      createContinuation: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
    },
    safetyReview: {
      listOpen: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
      reviewAndClear: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
    },
    adultPrivate: {
      commitNote: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
    },
    notifications: {
      delivery: 'in-app',
      list: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
      markRead: async () => ({ status: 'failed', code: 'adult-unauthorized' }),
    },
  }
}

describe('Parent Hub production contract boundary', () => {
  it('declares exactly the six complete adult roles', () => {
    expect(PARENT_HUB_PRODUCTION_ROLE_KEYS).toEqual([
      'settings', 'reviews', 'calendar', 'safetyReview', 'adultPrivate', 'notifications',
    ])
    expect(PARENT_HUB_PRODUCTION_CONTRACT_COMPLETE).toBe(true)
    expect([
      rootIsExact, reviewMethodsAreExact, safetyMethodsAreExact, adultPrivateMethodsAreExact,
      notificationSurfaceIsExact, notificationDeliveryIsInAppOnly, settingsChangesAreExact, reviewProjectionIsExact,
      committedNoteProjectionIsExact, calendarPauseInputIsExact, safetyReviewInputIsExact,
      safetyDecisionIsExact, safetyReasonIsFixed, pauseSuccessIsServerTimestamped,
      safetySuccessIsServerTimestamped, settingsReadFailuresAreExact, reviewsListFailuresAreExact,
      calendarListFailuresAreExact, safetyListFailuresAreExact, notificationsListFailuresAreExact,
      settingsApplyFailuresAreExact, reviewsDecideFailuresAreExact, calendarPauseFailuresAreExact,
      continuationFailuresAreExact, safetyDecisionFailuresAreExact, commitNoteFailuresAreExact,
      markReadFailuresAreExact,
    ]).not.toContain(false)
  })

  it('fails clearly when any adult role is missing', () => {
    expect(() => assertCompleteProductionStudyParentHubPorts({})).toThrow(
      'missing settings, reviews, calendar, safetyReview, adultPrivate, notifications port',
    )
  })

  it('defines a detached frozen snapshot of exactly six own data roles', () => {
    const ports = validParentHubPorts()
    const defined = defineProductionStudyParentHubPorts(ports)

    expect(defined).not.toBe(ports)
    expect(Object.isFrozen(defined)).toBe(true)
    expect(Reflect.ownKeys(defined)).toEqual(PARENT_HUB_PRODUCTION_ROLE_KEYS)
    for (const role of PARENT_HUB_PRODUCTION_ROLE_KEYS) expect(defined[role]).toBe(ports[role])
  })

  it('rejects symbol and hidden seventh capabilities', () => {
    const withSymbol = validParentHubPorts() as ProductionStudyParentHubPorts & Record<PropertyKey, unknown>
    withSymbol[Symbol('seventh')] = {}
    expect(() => defineProductionStudyParentHubPorts(withSymbol)).toThrow('exactly the six adult roles')

    const withHidden = validParentHubPorts()
    Object.defineProperty(withHidden, 'hiddenSeventh', { value: {}, enumerable: false })
    expect(() => defineProductionStudyParentHubPorts(withHidden)).toThrow('exactly the six adult roles')
  })

  it('rejects accessor roles without invoking them', () => {
    const withAccessor = validParentHubPorts()
    let reads = 0
    Object.defineProperty(withAccessor, 'settings', {
      get: () => { reads += 1; return validParentHubPorts().settings },
      enumerable: true,
    })

    expect(() => defineProductionStudyParentHubPorts(withAccessor)).toThrow('exactly the six adult roles')
    expect(reads).toBe(0)
  })

  it('rejects inherited, missing, and extra roles', () => {
    const inherited = Object.create({ settings: validParentHubPorts().settings }) as ProductionStudyParentHubPorts
    Object.assign(inherited, validParentHubPorts())
    delete (inherited as unknown as Record<string, unknown>).settings

    expect(() => defineProductionStudyParentHubPorts(inherited)).toThrow('exactly the six adult roles')
    expect(() => defineProductionStudyParentHubPorts({
      ...validParentHubPorts(), settings: undefined,
    } as unknown as ProductionStudyParentHubPorts)).toThrow('exactly the six adult roles')
    expect(() => defineProductionStudyParentHubPorts({
      ...validParentHubPorts(), seventh: {},
    } as unknown as ProductionStudyParentHubPorts)).toThrow('exactly the six adult roles')
  })

  it('reads each role descriptor exactly once and never reads the caller through getters', () => {
    const ports = validParentHubPorts()
    const descriptorReads = new Map<PropertyKey, number>()
    const guarded = new Proxy(ports, {
      get: () => { throw new Error('caller property read') },
      getOwnPropertyDescriptor: (target, key) => {
        descriptorReads.set(key, (descriptorReads.get(key) ?? 0) + 1)
        return Reflect.getOwnPropertyDescriptor(target, key)
      },
    })

    const defined = defineProductionStudyParentHubPorts(guarded)
    for (const role of PARENT_HUB_PRODUCTION_ROLE_KEYS) {
      expect(descriptorReads.get(role)).toBe(1)
      expect(defined[role]).toBe(ports[role])
    }
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

  it('keeps transition authority server-side and models adult safety clearance without learner resume', () => {
    expect(calendarPauseInputIsExact).toBe(true)
    expect(safetyReviewInputIsExact).toBe(true)
    expect(safetyDecisionIsExact).toBe(true)
    expect(safetyReasonIsFixed).toBe(true)
    expect(pauseSuccessIsServerTimestamped).toBe(true)
    expect(safetySuccessIsServerTimestamped).toBe(true)
  })

  it('narrows failures by operation', () => {
    expect([
      settingsReadFailuresAreExact, reviewsListFailuresAreExact, calendarListFailuresAreExact,
      safetyListFailuresAreExact, notificationsListFailuresAreExact, settingsApplyFailuresAreExact,
      reviewsDecideFailuresAreExact, calendarPauseFailuresAreExact, continuationFailuresAreExact,
      safetyDecisionFailuresAreExact, commitNoteFailuresAreExact, markReadFailuresAreExact,
    ]).not.toContain(false)
  })
})
