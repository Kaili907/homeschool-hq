/**
 * STUDY-A1-PROD-PORT-CONTRACT-SPLIT — the production learner-session subset,
 * pinned.
 *
 * Two kinds of proof live here and the difference matters when reading a
 * mutation report.
 *
 * The COMPILE-TIME pins are killed by `tsc --noEmit`, not by vitest. A union
 * arm, a parameter and an interface member are all erased before a test runs,
 * so "remove `revision-conflict` from the outcome" cannot be caught by an
 * assertion — it is caught by the exhaustive switch below failing to compile
 * and by the directives that go unused. Those mutants are reported as killed by
 * the typecheck, and saying so is the point: a campaign that claimed vitest
 * killed them would be describing something that did not happen.
 *
 * The RUNTIME pins are the completeness assert and a production-shaped adapter
 * that really answers in the widened vocabulary and is really read back. That
 * adapter is the one thing here that would be worth faking badly: a stub that
 * returned `'saved'` and was never asked anything else would prove the type
 * compiles, which nobody doubted, rather than that a revision conflict reaches
 * a caller intact.
 */
import { describe, expect, it } from 'vitest'
import { StudyLifecycleBoundary } from './lifecycle'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import {
  assertCompleteProductionStudySessionPorts,
  type ProductionStudyCalendarPort,
  type ProductionStudyCheckpointPort,
  type ProductionStudyPersistencePort,
  type ProductionStudySessionPorts,
  type StudyDurableWriteIntent,
  type StudyDurableWriteOutcome,
  type StudyPortBundle,
} from './ports'
import { prepareDurableStudySession, settleStudyTutorLaunch } from './production/tutorLaunchOrdering'
import { createSyntheticMathBlock } from './testing/syntheticStudyFixtures'
import type { StudyCheckpoint, StudySafeEvent, StudyScope, StudySessionSnapshot } from './types'

const BINDING = {
  authenticatedSessionRef: 'auth:contract-split',
  householdRef: 'household:contract-split',
  learnerRef: 'learner:contract-split',
  launchGrantRef: 'grant:contract-split',
  featureEnabled: true,
  authorizationRevision: 1,
} as const

/**
 * Named separately from the assert's own list so the two can disagree. Reading
 * the required list out of the function under test and comparing it to itself
 * would pass however the function was mutated.
 */
const PRODUCTION_SESSION_ROLES = ['calendar', 'checkpoint', 'persistence', 'eventLedger', 'safety'] as const

/**
 * The learner session's whole calendar vocabulary. `create` and
 * `createContinuation` are absent, and their absence is the split.
 */
const PRODUCTION_CALENDAR_METHODS = ['list', 'start', 'pause', 'resume', 'completeCurrentSegment'] as const

/** The shipping preview bundle, with no adaptation of any kind. */
function localBundle(): StudyPortBundle {
  return createLocalDevelopmentStudyPorts().ports
}

function completeSessionPorts(): ProductionStudySessionPorts {
  const bundle = localBundle()
  return {
    calendar: bundle.calendar,
    checkpoint: bundle.checkpoint,
    persistence: bundle.persistence,
    eventLedger: bundle.eventLedger,
    safety: bundle.safety,
  }
}

describe('the production session subset is five roles, and every existing adapter already satisfies it', () => {
  it('accepts the local development bundle unchanged', () => {
    // The load-bearing claim of the whole card: this split narrows what is
    // asked for and changes nothing about what is supplied. A bundle built by
    // the shipping factory, with no adaptation, is a complete session surface.
    const bundle: StudyPortBundle = localBundle()
    const asSessionPorts: ProductionStudySessionPorts = bundle
    expect(() => assertCompleteProductionStudySessionPorts(asSessionPorts)).not.toThrow()
  })

  it('is satisfied by exactly the five roles and needs none of the other four', () => {
    // Built from the five names and nothing else, so a sixth required role
    // would make this throw rather than quietly pass on a bundle that happens
    // to carry all nine.
    const ports = completeSessionPorts()
    expect(Object.keys(ports).sort()).toEqual([...PRODUCTION_SESSION_ROLES].sort())
    expect(() => assertCompleteProductionStudySessionPorts(ports)).not.toThrow()
  })

  it('exposes only the calendar methods a learner session calls', () => {
    // A type-level subset is invisible at runtime, so this pins the intent
    // through a value whose type is the narrow port: the five names resolve,
    // and the two excluded ones are pinned by the directives below.
    const calendar: ProductionStudyCalendarPort = localBundle().calendar
    for (const method of PRODUCTION_CALENDAR_METHODS) {
      expect(typeof calendar[method]).toBe('function')
    }
    // @ts-expect-error `create` is StudyDashboard's day seeding, not a session's
    expect(typeof calendar.create).toBe('function')
    // @ts-expect-error `createContinuation` has no caller in the app at all
    expect(typeof calendar.createContinuation).toBe('function')
  })
})

describe('a missing role fails loudly and names itself', () => {
  it.each(PRODUCTION_SESSION_ROLES)('names %s when it is the one missing', (role) => {
    const partial: Partial<ProductionStudySessionPorts> = completeSessionPorts()
    delete partial[role]
    // Both halves matter. Throwing proves it is not silently defaulted to a
    // stub; naming the role proves the deployment error is readable rather
    // than a bisect. A mutant that drops one role from the required list
    // survives the first half and dies on this case.
    expect(() => assertCompleteProductionStudySessionPorts(partial))
      .toThrow(`Study session unavailable: missing ${role} port.`)
  })

  it('names every missing role when a bundle is empty', () => {
    // Also pins membership AND order of the required list, which the
    // single-role cases above cannot: they pass for any list containing the
    // role, including one that has grown a sixth.
    expect(() => assertCompleteProductionStudySessionPorts({}))
      .toThrow('Study session unavailable: missing calendar, checkpoint, persistence, eventLedger, safety port.')
  })

  it('rejects a role that is present but empty rather than reading it as supplied', () => {
    // `undefined` is the shape a partially-wired composition actually produces
    // — the key exists because the object literal names it, and the value is
    // whatever a lookup returned.
    const partial = { ...completeSessionPorts(), safety: undefined }
    expect(() => assertCompleteProductionStudySessionPorts(partial))
      .toThrow('Study session unavailable: missing safety port.')
  })
})

/**
 * A production-shaped adapter: it demands the write intent, it enforces the
 * revision it was given, and it answers in the widened vocabulary. This is the
 * adapter the split exists for — under the old `'saved' | 'duplicate-ignored'`
 * contract, four of the five answers below had no way to be spoken.
 */
class RevisionedCheckpointAdapter implements ProductionStudyCheckpointPort {
  #stored: StudyCheckpoint | null = null
  #revision = 0
  readonly #seenMutations = new Set<string>()
  readonly #quarantined = new Set<string>()

  constructor(quarantined: readonly string[] = []) {
    for (const mutationRef of quarantined) this.#quarantined.add(mutationRef)
  }

  async loadLatest(): Promise<StudyCheckpoint | null> {
    return this.#stored
  }

  async save(
    checkpoint: StudyCheckpoint,
    _operation?: unknown,
    write?: StudyDurableWriteIntent,
  ): Promise<StudyDurableWriteOutcome> {
    if (!write) return { status: 'quarantined' }
    if (this.#quarantined.has(write.mutationRef)) return { status: 'quarantined' }
    if (this.#seenMutations.has(write.mutationRef)) {
      return this.#stored?.checkpointRef === checkpoint.checkpointRef
        ? { status: 'duplicate-ignored' }
        : { status: 'idempotency-collision' }
    }
    const expected = this.#stored ? this.#revision : null
    if (write.expectedRevision !== expected) {
      return { status: 'revision-conflict', currentRevision: this.#revision }
    }
    this.#seenMutations.add(write.mutationRef)
    this.#stored = checkpoint
    this.#revision += 1
    return { status: 'saved', revision: this.#revision }
  }
}

function checkpoint(ref: string): StudyCheckpoint {
  return {
    checkpointRef: ref,
    householdRef: BINDING.householdRef,
    learnerRef: BINDING.learnerRef,
    sessionRef: 'session:contract-split',
    lessonRef: 'lesson:contract-split',
    segmentRef: 'segment:1',
    revision: 1,
    capturedAt: '2026-08-01T13:00:00.000Z',
    completedSegmentRefs: [],
    elapsedActiveSecondsInSegment: 0,
    responseDraftRef: null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

/**
 * Exhaustive by construction. This is the compile-time pin for the outcome
 * union: delete an arm from `StudyDurableWriteOutcome` and its `case` here has
 * no matching type, add one and the `never` assignment in `default` fails.
 * Neither failure is something vitest could report.
 */
function describeOutcome(outcome: StudyDurableWriteOutcome): string {
  switch (outcome.status) {
    case 'saved': return `saved@${outcome.revision}`
    case 'duplicate-ignored': return 'duplicate-ignored'
    case 'revision-conflict': return `revision-conflict@${outcome.currentRevision}`
    case 'idempotency-collision': return 'idempotency-collision'
    case 'quarantined': return 'quarantined'
    default: {
      const unreachable: never = outcome
      return unreachable
    }
  }
}

describe('the widened write contract lets a production adapter answer honestly', () => {
  it('reports the stored revision, and a conflict with the revision to retry from', async () => {
    const adapter = new RevisionedCheckpointAdapter()
    const first = await adapter.save(checkpoint('checkpoint:1'), undefined, {
      expectedRevision: null,
      mutationRef: 'mutation:1',
    })
    expect(describeOutcome(first)).toBe('saved@1')

    // The answer the old vocabulary could not give. Under `'saved'` this caller
    // would believe its write landed; under `'duplicate-ignored'` it would
    // believe it had already written this and stop retrying. It gets neither,
    // and it gets the revision it needs to re-aim at.
    const stale = await adapter.save(checkpoint('checkpoint:2'), undefined, {
      expectedRevision: null,
      mutationRef: 'mutation:2',
    })
    expect(describeOutcome(stale)).toBe('revision-conflict@1')

    const retried = await adapter.save(checkpoint('checkpoint:2'), undefined, {
      expectedRevision: 1,
      mutationRef: 'mutation:2',
    })
    expect(describeOutcome(retried)).toBe('saved@2')
  })

  it('separates a replay of the same write from a reused id carrying a different one', async () => {
    const adapter = new RevisionedCheckpointAdapter()
    await adapter.save(checkpoint('checkpoint:1'), undefined, { expectedRevision: null, mutationRef: 'mutation:1' })

    const replay = await adapter.save(checkpoint('checkpoint:1'), undefined, {
      expectedRevision: null,
      mutationRef: 'mutation:1',
    })
    expect(describeOutcome(replay)).toBe('duplicate-ignored')

    // Distinct from a replay and dangerous to conflate: the same mutation id
    // presented for different content is a caller generating ids wrongly, and
    // answering `'duplicate-ignored'` would tell it the write it never made
    // was already safely stored.
    const collision = await adapter.save(checkpoint('checkpoint:9'), undefined, {
      expectedRevision: 1,
      mutationRef: 'mutation:1',
    })
    expect(describeOutcome(collision)).toBe('idempotency-collision')
  })

  it('can say quarantined, which had no nearest neighbour at all', async () => {
    const adapter = new RevisionedCheckpointAdapter(['mutation:poisoned'])
    const outcome = await adapter.save(checkpoint('checkpoint:1'), undefined, {
      expectedRevision: null,
      mutationRef: 'mutation:poisoned',
    })
    expect(describeOutcome(outcome)).toBe('quarantined')
    expect(await adapter.loadLatest()).toBeNull()
  })

  it('accepts a production adapter and a preview adapter through the same role', () => {
    // Neither has to lie. The preview adapter keeps resolving `'saved'`; the
    // production one resolves an outcome object; both are the same port type.
    const production: ProductionStudyCheckpointPort = new RevisionedCheckpointAdapter()
    const preview: ProductionStudyCheckpointPort = localBundle().checkpoint
    expect(typeof production.save).toBe('function')
    expect(typeof preview.save).toBe('function')
  })

  it('lets a session-row adapter report its write while the preview one still resolves nothing', async () => {
    const rows: StudySessionSnapshot[] = []
    const production: ProductionStudyPersistencePort = {
      async saveSession(snapshot, _operation, write) {
        if (!write) return { status: 'quarantined' }
        rows.push(snapshot)
        return { status: 'saved', revision: rows.length }
      },
    }
    const preview: ProductionStudyPersistencePort = localBundle().persistence
    const reported = await production.saveSession(
      snapshot(),
      undefined,
      { expectedRevision: null, mutationRef: 'mutation:session' },
    )
    expect(reported && describeOutcome(reported)).toBe('saved@1')
    // `void` stays in the union precisely so this one needs no adaptation.
    expect(await preview.saveSession(snapshot())).toBeUndefined()
  })
})

function snapshot(): StudySessionSnapshot {
  return {
    scope: { householdRef: BINDING.householdRef, learnerRef: BINDING.learnerRef, sessionRef: 'session:contract-split' },
    lessonRef: 'lesson:contract-split',
    segmentRef: 'segment:1',
    status: 'active',
    updatedAt: '2026-08-01T13:00:00.000Z',
    lastAcceptedEventRef: null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

describe('prepareDurableStudySession asks for the three roles it consumes', () => {
  it('runs against an object that has no checkpoint, safety, or other four roles', async () => {
    const bundle = localBundle()
    const { entry, scope: learnerScope } = await createSyntheticMathBlock(bundle)
    const boundary = new StudyLifecycleBoundary(BINDING)
    const token = boundary.token()
    const appended: StudySafeEvent[] = []
    const saved: StudySessionSnapshot[] = []

    // Exactly three roles. Under the previous `StudyPortBundle` field this
    // object does not compile, which is what kills the widen-it-back mutant —
    // and it is a real preparation, not a stub: the calendar transition is the
    // shipping local adapter and the block really moves to `active`.
    const ports = {
      calendar: bundle.calendar,
      eventLedger: {
        async append(_scope: StudyScope, event: StudySafeEvent) {
          appended.push(event)
          return 'appended' as const
        },
      },
      persistence: {
        async saveSession(next: StudySessionSnapshot) {
          saved.push(next)
        },
      },
    }

    const sessionRef = `${entry.blockRef}:session`
    const settled = await settleStudyTutorLaunch(token, () => 'launched')
    const prepared = await prepareDurableStudySession(settled, {
      token,
      ports,
      scope: { ...learnerScope, sessionRef },
      learnerScope,
      entry,
      sessionRef,
      // The local calendar rejects events out of chronological order against
      // the block's own last event, which the synthetic fixture stamps with the
      // real clock. A frozen instant here would be a past one.
      now: new Date().toISOString(),
    })

    expect(prepared.state).toBe('active')
    expect(appended.map((event) => event.type)).toEqual(['session-launched'])
    expect(saved.map((row) => row.status)).toEqual(['active'])
  })

  it('still accepts the nine-role bundle the mounted host hands it', () => {
    // The host is owned by another session and was not touched. Its call site
    // passes a whole `StudyPortBundle`, so this assignment is the compile-time
    // statement that narrowing the parameter did not break it.
    const bundle: StudyPortBundle = localBundle()
    const asPreparationPorts: Parameters<typeof prepareDurableStudySession>[1]['ports'] = bundle
    expect(typeof asPreparationPorts.calendar.start).toBe('function')
  })
})

describe('the narrowed contracts cannot be widened back by accident (compile-time)', () => {
  it('refuses a partial bundle where a complete one is required', () => {
    const attempt = (partial: Partial<ProductionStudySessionPorts>) => {
      // @ts-expect-error a partial bundle is only a session surface after the assert
      const ports: ProductionStudySessionPorts = partial
      return ports
    }
    expect(typeof attempt).toBe('function')
  })

  it('refuses a write intent that has dropped either half', () => {
    const attempt = () => {
      // @ts-expect-error optimistic concurrency needs the revision the caller expects
      const withoutRevision: StudyDurableWriteIntent = { mutationRef: 'mutation:1' }
      // @ts-expect-error idempotency needs the mutation id, and a write cannot invent one
      const withoutMutation: StudyDurableWriteIntent = { expectedRevision: null }
      return [withoutRevision, withoutMutation]
    }
    expect(typeof attempt).toBe('function')
  })

  it('refuses an outcome that claims a conflict without the revision to retry from', () => {
    const attempt = () => {
      // @ts-expect-error a revision conflict without `currentRevision` cannot be acted on
      const outcome: StudyDurableWriteOutcome = { status: 'revision-conflict' }
      return outcome
    }
    expect(typeof attempt).toBe('function')
  })

  it('refuses a status the vocabulary does not contain', () => {
    const attempt = () => {
      // @ts-expect-error the outcome vocabulary is closed, so an adapter cannot invent a status
      const outcome: StudyDurableWriteOutcome = { status: 'stored' }
      return outcome
    }
    expect(typeof attempt).toBe('function')
  })

  it('refuses a session-ports object carrying a role the session does not use', () => {
    const attempt = () => {
      const bundle = localBundle()
      const ports: ProductionStudySessionPorts = {
        calendar: bundle.calendar,
        checkpoint: bundle.checkpoint,
        persistence: bundle.persistence,
        eventLedger: bundle.eventLedger,
        safety: bundle.safety,
        // @ts-expect-error reviewQueue is StudyDashboard's role, not a session's
        reviewQueue: bundle.reviewQueue,
      }
      return ports
    }
    expect(typeof attempt).toBe('function')
  })
})
