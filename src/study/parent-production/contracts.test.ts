import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ADULT_MUTATION_FAILURE_CODES,
  ADULT_PRODUCTION_FAILURE_CODES,
  ADULT_READ_FAILURE_CODES,
  PARENT_HUB_REQUEST_LIMITS,
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
  PARENT_HUB_CONTRACT_REFUSAL_CODES,
  PARENT_HUB_PRODUCTION_CONTRACT_COMPLETE,
  PARENT_HUB_PRODUCTION_MEMBERS_CHECKED,
  PARENT_HUB_PRODUCTION_ROLE_KEYS,
  ParentHubContractRefusal,
  defineProductionStudyParentHubPorts,
  parseCompleteProductionStudyParentHubPorts,
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

const exactRoleError = 'exactly the six adult roles'

/** Both exported paths refuse the same inputs; only the way each reports refusal differs. */
type RoleValidatorCase = Readonly<{
  name: string
  refuses: (ports: unknown) => boolean
  accept: (ports: unknown) => Readonly<ProductionStudyParentHubPorts>
}>

const roleValidatorCases: readonly RoleValidatorCase[] = [
  {
    name: 'six-role constructor',
    refuses: (ports) => {
      try {
        defineProductionStudyParentHubPorts(ports as ProductionStudyParentHubPorts)
        return false
      } catch (refusal) {
        return refusal instanceof ParentHubContractRefusal
      }
    },
    accept: (ports) => defineProductionStudyParentHubPorts(ports as ProductionStudyParentHubPorts),
  },
  {
    name: 'fail-closed reader',
    refuses: (ports) => parseCompleteProductionStudyParentHubPorts(ports) === null,
    accept: (ports) => {
      const parsed = parseCompleteProductionStudyParentHubPorts(ports)
      if (!parsed) throw new Error('expected the fail-closed reader to accept these roles')
      return parsed
    },
  },
]

/** Refuses and reports the discriminating code; only the throwing path carries one. */
function refusalOf(ports: unknown): ParentHubContractRefusal {
  try {
    defineProductionStudyParentHubPorts(ports as ProductionStudyParentHubPorts)
  } catch (refusal) {
    if (refusal instanceof ParentHubContractRefusal) return refusal
    throw refusal
  }
  throw new Error('expected the six-role constructor to refuse these roles')
}

/** Own enumerable data properties that are present, so exactness admits them, yet are never roles. */
const presentButFalsyRoles: readonly Readonly<{ name: string; value: unknown }>[] = [
  { name: 'undefined', value: undefined },
  { name: 'null', value: null },
  { name: 'false', value: false },
  { name: 'zero', value: 0 },
  { name: 'an empty string', value: '' },
  { name: 'NaN', value: Number.NaN },
]

const truthyButInvalidRoles: readonly Readonly<{ name: string; value: unknown }>[] = [
  { name: 'a number', value: 1 },
  { name: 'a string', value: 'pwned' },
  { name: 'true', value: true },
  { name: 'an array', value: [] },
  { name: 'an empty object', value: {} },
  { name: 'a function', value: () => undefined },
  { name: 'a symbol', value: Symbol('role') },
  { name: 'a port missing one method', value: { read: async () => undefined } },
]

describe.each(roleValidatorCases)('$name exact-role boundary', ({ refuses, accept }) => {
  it('rejects a hidden required role', () => {
    const ports = validParentHubPorts()
    Object.defineProperty(ports, 'settings', {
      value: ports.settings,
      enumerable: false,
      configurable: true,
    })
    expect(refuses(ports)).toBe(true)
  })

  it('rejects a hidden extra role', () => {
    const ports = validParentHubPorts()
    Object.defineProperty(ports, 'hiddenSeventh', { value: {}, enumerable: false })
    expect(refuses(ports)).toBe(true)
  })

  it('rejects a symbol extra role', () => {
    const ports = validParentHubPorts() as ProductionStudyParentHubPorts & Record<PropertyKey, unknown>
    ports[Symbol('seventh')] = {}
    expect(refuses(ports)).toBe(true)
  })

  it('rejects an accessor role without invoking it', () => {
    const ports = validParentHubPorts()
    let reads = 0
    Object.defineProperty(ports, 'settings', {
      get: () => { reads += 1; return validParentHubPorts().settings },
      enumerable: true,
    })
    expect(refuses(ports)).toBe(true)
    expect(reads).toBe(0)
  })

  it('rejects an inherited role', () => {
    const valid = validParentHubPorts()
    const ports = Object.assign(
      Object.create({ settings: valid.settings }) as Record<PropertyKey, unknown>,
      valid,
    )
    delete (ports as unknown as Record<PropertyKey, unknown>).settings
    expect(refuses(ports)).toBe(true)
  })

  it('rejects a missing role', () => {
    const ports = validParentHubPorts() as unknown as Record<PropertyKey, unknown>
    delete ports.settings
    expect(refuses(ports)).toBe(true)
  })

  it('rejects an extra seventh role', () => {
    const ports = validParentHubPorts() as ProductionStudyParentHubPorts & Record<PropertyKey, unknown>
    ports.seventh = {}
    expect(refuses(ports)).toBe(true)
  })

  it('converts property-inspection failures into controlled refusal', () => {
    const ownKeysFailure = new Proxy(validParentHubPorts(), {
      ownKeys: () => { throw new Error('hostile ownKeys') },
    })
    expect(refuses(ownKeysFailure)).toBe(true)

    const descriptorFailure = new Proxy(validParentHubPorts(), {
      getOwnPropertyDescriptor: () => { throw new Error('hostile descriptor') },
    })
    expect(refuses(descriptorFailure)).toBe(true)
  })

  it.each(presentButFalsyRoles)('rejects a role present but set to $name', ({ value }) => {
    for (const role of PARENT_HUB_PRODUCTION_ROLE_KEYS) {
      const ports = { ...validParentHubPorts(), [role]: value }
      expect(Object.hasOwn(ports, role)).toBe(true)
      expect(refuses(ports)).toBe(true)
    }
  })

  it.each(truthyButInvalidRoles)('rejects a role that is $name', ({ value }) => {
    for (const role of PARENT_HUB_PRODUCTION_ROLE_KEYS) {
      expect(refuses({ ...validParentHubPorts(), [role]: value })).toBe(true)
    }
  })

  it('rejects a role whose method is an accessor, without invoking it', () => {
    let reads = 0
    const settings = { apply: async () => undefined }
    Object.defineProperty(settings, 'read', {
      get: () => { reads += 1; return async () => undefined },
      enumerable: true,
    })
    expect(refuses({ ...validParentHubPorts(), settings })).toBe(true)
    expect(reads).toBe(0)
  })

  it('rejects notification delivery that is absent, widened, or an accessor', () => {
    const base = validParentHubPorts()
    for (const delivery of ['post', 'in-app ', 1, null, true]) {
      expect(refuses({ ...base, notifications: { ...base.notifications, delivery } })).toBe(true)
    }
    const { delivery: _pinned, ...withoutDelivery } = base.notifications
    expect(refuses({ ...base, notifications: withoutDelivery })).toBe(true)

    let reads = 0
    const notifications = { ...withoutDelivery }
    Object.defineProperty(notifications, 'delivery', {
      get: () => { reads += 1; return 'in-app' },
      enumerable: true,
    })
    expect(refuses({ ...base, notifications })).toBe(true)
    expect(reads).toBe(0)
  })

  it('refuses a role borrowing its members from the shared intrinsics', () => {
    // Asserted only after cleanup: a polluted Object.prototype also breaks the assertion library.
    const polluted = Object.prototype as unknown as Record<string, unknown>
    const bare = { ...validParentHubPorts(), settings: {} }
    let refusedPollutedRole: boolean
    polluted.read = async () => undefined
    polluted.apply = async () => undefined
    try {
      refusedPollutedRole = refuses(bare)
    } finally {
      delete polluted.read
      delete polluted.apply
    }
    expect(refusedPollutedRole).toBe(true)

    const borrowed = { read: async () => undefined }
    Object.setPrototypeOf(borrowed, Function.prototype)
    expect(refuses({ ...validParentHubPorts(), settings: borrowed })).toBe(true)
  })

  it('refuses a bare container borrowing a member from any polluted built-in prototype', () => {
    const containers: readonly Readonly<{ prototype: object; make: () => object }>[] = [
      { prototype: Array.prototype, make: () => [] },
      { prototype: Map.prototype, make: () => new Map() },
      { prototype: Set.prototype, make: () => new Set() },
      { prototype: Date.prototype, make: () => new Date() },
      { prototype: RegExp.prototype, make: () => /role/ },
      { prototype: Error.prototype, make: () => new Error('role') },
      { prototype: TypeError.prototype, make: () => new TypeError('role') },
    ]
    for (const { prototype, make } of containers) {
      const polluted = prototype as unknown as Record<string, unknown>
      polluted.commitNote = async () => undefined
      let refusedBorrowedRole: boolean
      try {
        refusedBorrowedRole = refuses({ ...validParentHubPorts(), adultPrivate: make() })
      } finally {
        delete polluted.commitNote
      }
      expect(refusedBorrowedRole).toBe(true)
    }
  })

  it('accepts roles implemented as class instances with members on the prototype chain', () => {
    class SettingsBase { async read() { return undefined as never } }
    class SettingsRole extends SettingsBase { async apply() { return undefined as never } }
    const settings = new SettingsRole()
    const accepted = accept({ ...validParentHubPorts(), settings })
    expect(accepted.settings).toBe(settings)
  })

  it('refuses a role whose prototype chain never terminates', () => {
    const unbounded = (): object => new Proxy({}, {
      getOwnPropertyDescriptor: () => undefined,
      getPrototypeOf: () => unbounded(),
    })
    expect(refuses({ ...validParentHubPorts(), settings: unbounded() })).toBe(true)
  })

  it('hands back a detached record that a later swap of the live root cannot reach', () => {
    const ports = validParentHubPorts()
    const accepted = accept(ports)
    const original = ports.settings

    let reads = 0
    Object.defineProperty(ports, 'settings', {
      get: () => { reads += 1; return { read: async () => 'stolen' } },
      configurable: true,
    })

    expect(accepted.settings).toBe(original)
    expect(reads).toBe(0)
    expect(Object.isFrozen(accepted)).toBe(true)
  })

  it('never lets a hostile role leak caller data into the refusal', () => {
    const hostile = new Proxy({}, {
      getOwnPropertyDescriptor: () => { throw new Error('SECRETVALUE') },
      getPrototypeOf: () => { throw new Error('SECRETVALUE') },
    })
    for (const candidate of [
      { ...validParentHubPorts(), settings: hostile },
      { ...validParentHubPorts(), adultPrivate: 'SECRETVALUE' },
    ]) {
      expect(refuses(candidate)).toBe(true)
    }
  })
})

describe('Parent Hub production contract boundary', () => {
  it('declares exactly the six complete adult roles', () => {
    expect(PARENT_HUB_PRODUCTION_ROLE_KEYS).toEqual([
      'settings', 'reviews', 'calendar', 'safetyReview', 'adultPrivate', 'notifications',
    ])
    expect(PARENT_HUB_PRODUCTION_CONTRACT_COMPLETE).toBe(true)
    expect(PARENT_HUB_PRODUCTION_MEMBERS_CHECKED).toBe(true)
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

  it('freezes every exported vocabulary so the allow-lists cannot be widened in place', () => {
    for (const vocabulary of [
      PARENT_HUB_PRODUCTION_ROLE_KEYS,
      PARENT_HUB_CONTRACT_REFUSAL_CODES,
      ADULT_PRODUCTION_FAILURE_CODES,
      ADULT_READ_FAILURE_CODES,
      ADULT_MUTATION_FAILURE_CODES,
      PARENT_HUB_REQUEST_LIMITS,
    ] as readonly object[]) {
      expect(Object.isFrozen(vocabulary)).toBe(true)
    }

    const roles = PARENT_HUB_PRODUCTION_ROLE_KEYS as unknown as string[]
    expect(() => roles.push('seventh')).toThrow(TypeError)
    expect(roles).toHaveLength(6)

    const readCodes = ADULT_READ_FAILURE_CODES as unknown as string[]
    expect(() => readCodes.push('attacker-defined-code')).toThrow(TypeError)
    expect(readCodes).toHaveLength(5)
  })

  it('fails clearly when any adult role is missing', () => {
    expect(() => defineProductionStudyParentHubPorts({} as ProductionStudyParentHubPorts))
      .toThrow(exactRoleError)
    expect(parseCompleteProductionStudyParentHubPorts({})).toBeNull()
  })

  it('reports a stable refusal code that carries no caller-supplied value', () => {
    expect(PARENT_HUB_CONTRACT_REFUSAL_CODES).toEqual([
      'parent-hub-contract-not-exact-record',
      'parent-hub-contract-role-not-a-port',
    ])

    const shapeRefusal = refusalOf({ SECRETVALUE: 'SECRETVALUE' })
    expect(shapeRefusal.code).toBe('parent-hub-contract-not-exact-record')
    expect(shapeRefusal.role).toBeNull()

    const roleRefusal = refusalOf({ ...validParentHubPorts(), adultPrivate: 'SECRETVALUE' })
    expect(roleRefusal.code).toBe('parent-hub-contract-role-not-a-port')
    expect(roleRefusal.role).toBe('adultPrivate')

    for (const refusal of [shapeRefusal, roleRefusal]) {
      expect(refusal).toBeInstanceOf(Error)
      expect(refusal.name).toBe('ParentHubContractRefusal')
      expect(refusal.message).toContain(exactRoleError)
      const exposed = `${refusal.message}${refusal.stack ?? ''}${JSON.stringify({
        code: refusal.code, role: refusal.role,
      })}`
      expect(exposed).not.toContain('SECRETVALUE')
    }
  })

  it('routes a present-but-falsy role to the role check rather than the exactness check', () => {
    const refusal = refusalOf({ ...validParentHubPorts(), settings: undefined })
    expect(refusal.code).toBe('parent-hub-contract-role-not-a-port')
    expect(refusal.role).toBe('settings')
  })

  it('accepts ordinary and null-prototype exact-role records and defines a detached frozen snapshot', () => {
    const ports = validParentHubPorts()
    const defined = defineProductionStudyParentHubPorts(ports)

    expect(defined).not.toBe(ports)
    expect(Object.isFrozen(defined)).toBe(true)
    expect(Reflect.ownKeys(defined)).toEqual(PARENT_HUB_PRODUCTION_ROLE_KEYS)
    for (const role of PARENT_HUB_PRODUCTION_ROLE_KEYS) expect(defined[role]).toBe(ports[role])

    const nullPrototype = Object.assign(
      Object.create(null) as ProductionStudyParentHubPorts,
      ports,
    )
    expect(defineProductionStudyParentHubPorts(nullPrototype)).toEqual(defined)
    expect(parseCompleteProductionStudyParentHubPorts(nullPrototype)).toEqual(defined)
  })

  it('returns the six roles in declared order however the caller ordered them', () => {
    const ports = validParentHubPorts()
    const shuffled = Object.fromEntries(
      [...PARENT_HUB_PRODUCTION_ROLE_KEYS].reverse().map((role) => [role, ports[role]]),
    )
    expect(Reflect.ownKeys(defineProductionStudyParentHubPorts(
      shuffled as unknown as ProductionStudyParentHubPorts,
    ))).toEqual(PARENT_HUB_PRODUCTION_ROLE_KEYS)
  })

  it('makes one descriptor read per accepted role and never reads caller properties', () => {
    for (const { accept } of roleValidatorCases) {
      const ports = validParentHubPorts()
      const descriptorReads = new Map<PropertyKey, number>()
      const guarded = new Proxy(ports, {
        get: () => { throw new Error('caller property read') },
        getOwnPropertyDescriptor: (target, key) => {
          descriptorReads.set(key, (descriptorReads.get(key) ?? 0) + 1)
          return Reflect.getOwnPropertyDescriptor(target, key)
        },
      })

      expect(() => accept(guarded)).not.toThrow()
      for (const role of PARENT_HUB_PRODUCTION_ROLE_KEYS) {
        expect(descriptorReads.get(role)).toBe(1)
      }
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

/** Exhaustive, deterministic sweep of the descriptor and proxy surfaces the roots are read through. */
describe('Parent Hub production contract adversarial surface', () => {
  type RoleSlotVariant = Readonly<{
    name: string
    admissible: boolean
    place: (root: Record<PropertyKey, unknown>, role: string, port: unknown) => void
  }>

  const roleSlotVariants: readonly RoleSlotVariant[] = [
    {
      name: 'enumerable data property',
      admissible: true,
      place: (root, role, port) => {
        Object.defineProperty(root, role, { value: port, enumerable: true, writable: true, configurable: true })
      },
    },
    {
      name: 'frozen enumerable data property',
      admissible: true,
      place: (root, role, port) => {
        Object.defineProperty(root, role, { value: port, enumerable: true, writable: false, configurable: false })
      },
    },
    {
      name: 'non-enumerable data property',
      admissible: false,
      place: (root, role, port) => {
        Object.defineProperty(root, role, { value: port, enumerable: false, configurable: true })
      },
    },
    {
      name: 'enumerable accessor',
      admissible: false,
      place: (root, role, port) => {
        Object.defineProperty(root, role, { get: () => port, enumerable: true, configurable: true })
      },
    },
    {
      name: 'absent',
      admissible: false,
      place: () => undefined,
    },
  ]

  type ExtraKeyVariant = Readonly<{ name: string; admissible: boolean; add: (root: Record<PropertyKey, unknown>) => void }>

  const extraKeyVariants: readonly ExtraKeyVariant[] = [
    { name: 'no extra key', admissible: true, add: () => undefined },
    { name: 'an enumerable extra key', admissible: false, add: (root) => { root.seventh = {} } },
    { name: 'a symbol extra key', admissible: false, add: (root) => { root[Symbol('seventh')] = {} } },
    {
      name: 'a hidden extra key',
      admissible: false,
      add: (root) => { Object.defineProperty(root, 'hiddenSeventh', { value: {}, enumerable: false }) },
    },
  ]

  it('admits a role slot only when every descriptor and key-set condition holds', () => {
    let combinations = 0
    for (const role of PARENT_HUB_PRODUCTION_ROLE_KEYS) {
      for (const slot of roleSlotVariants) {
        for (const extra of extraKeyVariants) {
          const root = validParentHubPorts() as unknown as Record<PropertyKey, unknown>
          const port = root[role]
          delete root[role]
          slot.place(root, role, port)
          extra.add(root)

          const shouldAdmit = slot.admissible && extra.admissible
          expect(parseCompleteProductionStudyParentHubPorts(root) !== null).toBe(shouldAdmit)

          let thrown: unknown = null
          try {
            defineProductionStudyParentHubPorts(root as unknown as ProductionStudyParentHubPorts)
          } catch (refusal) {
            thrown = refusal
          }
          expect(thrown === null).toBe(shouldAdmit)
          if (thrown !== null) expect(thrown).toBeInstanceOf(ParentHubContractRefusal)
          combinations += 1
        }
      }
    }
    expect(combinations).toBe(
      PARENT_HUB_PRODUCTION_ROLE_KEYS.length * roleSlotVariants.length * extraKeyVariants.length,
    )
  })

  it('refuses every hostile trap on the root without letting the trap error escape', () => {
    const traps: readonly (keyof ProxyHandler<object>)[] = [
      'ownKeys', 'getOwnPropertyDescriptor', 'getPrototypeOf', 'get', 'has', 'defineProperty', 'isExtensible',
    ]
    const behaviours: readonly Readonly<{ name: string; make: () => unknown }>[] = [
      { name: 'throws', make: () => { throw new Error('SECRETVALUE') } },
      { name: 'returns undefined', make: () => undefined },
      { name: 'returns a hostile record', make: () => ({ SECRETVALUE: 'SECRETVALUE' }) },
    ]

    for (const trap of traps) {
      for (const behaviour of behaviours) {
        const guarded = new Proxy(validParentHubPorts(), { [trap]: () => behaviour.make() })

        let outcome: unknown
        try {
          outcome = defineProductionStudyParentHubPorts(guarded)
        } catch (refusal) {
          expect(refusal).toBeInstanceOf(ParentHubContractRefusal)
          expect((refusal as Error).message).not.toContain('SECRETVALUE')
          outcome = null
        }
        // A trap may legitimately be transparent; whatever survives must still be a detached record.
        if (outcome) {
          expect(Object.isFrozen(outcome)).toBe(true)
          expect(Reflect.ownKeys(outcome)).toEqual(PARENT_HUB_PRODUCTION_ROLE_KEYS)
        }
        expect(() => parseCompleteProductionStudyParentHubPorts(guarded)).not.toThrow()
      }
    }
  })
})
