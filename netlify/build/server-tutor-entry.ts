/**
 * Server-only Tutor execution surface.
 *
 * This is content/runtime composition, not transport. It reads no request,
 * mounts no handler, owns no credential, contacts no provider and persists
 * nothing by itself. A future reviewed Netlify handler may supply host-owned
 * ports to this factory after its authorization and content-mapping gates.
 */
import {
  STUDY_TUTOR_CONTRACT_VERSION,
  STUDY_TUTOR_INELIGIBLE_REASONS,
  parseStudyTutorRef,
  type StudyTutorEligibility,
  type StudyTutorRuntime,
} from '../../src/study/contracts/tutor'
import {
  mapStudyTaskToTutorPhase,
  type StudyTaskType,
} from '../../adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts'
import {
  ProductionStudyTutorRuntime,
  type ProductionStudyTutorRuntimeDependencies,
} from '../../src/study/production/tutorRuntime'
import { evaluateReviewedTutorContent } from '../../src/study/production/tutorContentEligibility'
import { studyTutorLearnerPseudonym } from '../../src/study/production/tutorPseudonym'

export const SERVER_TUTOR_ADAPTER_CONTRACT_VERSION = STUDY_TUTOR_CONTRACT_VERSION
const SERVER_TUTOR_STATIC_CAPABILITY_SCHEMA_VERSION =
  'study-server-tutor-static-capability.v1' as const

const INVALID_SNAPSHOT = Symbol('invalid-server-tutor-static-snapshot')
const MISSING_PROPERTY = Symbol('missing-server-tutor-static-property')

type InvalidSnapshot = typeof INVALID_SNAPSHOT
type MissingProperty = typeof MISSING_PROPERTY

interface CapturedApprovedMapping {
  readonly hostLessonRef: string
  readonly hostSegmentRef: string
  readonly taskType: string
  readonly tutorPhase: string
  readonly programRef: string
  readonly reviewedRuntimeItemRefs: readonly string[]
}

interface StaticMappingLookup {
  readonly hostLessonRef: string
  readonly hostSegmentRef: string
  readonly taskType: string
}

interface StaticEligibilityInput {
  readonly subject: string
  readonly lessonRef: string
  readonly taskType: string
}

interface FrozenMappingAuthority {
  readonly programRef: string
  readonly runtimeItemRefsByPhase: Readonly<Record<string, readonly string[]>>
}

const APPROVED_MAPPING_KEYS = Object.freeze([
  'hostLessonRef',
  'hostSegmentRef',
  'programRef',
  'reviewedRuntimeItemRefs',
  'taskType',
  'tutorPhase',
] as const)
const STATIC_LOOKUP_KEYS = Object.freeze(['hostLessonRef', 'hostSegmentRef', 'taskType'] as const)
const STATIC_ELIGIBILITY_KEYS = Object.freeze(['lessonRef', 'subject', 'taskType'] as const)
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function ownDataProperty(
  value: unknown,
  key: string,
): unknown | MissingProperty | InvalidSnapshot {
  if (!isPlainRecord(value)) return INVALID_SNAPSHOT
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined) return MISSING_PROPERTY
    if (!('value' in descriptor) || descriptor.enumerable !== true) return INVALID_SNAPSHOT
    return descriptor.value
  } catch {
    return INVALID_SNAPSHOT
  }
}

/**
 * Copies only plain JSON-style data from descriptors. Accessors, symbols,
 * hidden keys, sparse arrays, cycles and exotic prototypes are rejected before
 * any value is retained. Object keys are sorted so equality is insertion-order
 * independent without coercing or normalising a value.
 */
function snapshotPlainData(
  value: unknown,
  active: WeakSet<object> = new WeakSet<object>(),
): unknown | InvalidSnapshot {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : INVALID_SNAPSHOT
  if (typeof value !== 'object') return INVALID_SNAPSHOT

  try {
    if (active.has(value)) return INVALID_SNAPSHOT
    active.add(value)

    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return INVALID_SNAPSHOT
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length')
      if (
        lengthDescriptor === undefined ||
        !('value' in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0 ||
        lengthDescriptor.value > 4096
      ) return INVALID_SNAPSHOT
      const length = lengthDescriptor.value
      const keys = Reflect.ownKeys(value)
      const expectedKeys = Array.from({ length }, (_, index) => String(index))
      if (
        keys.length !== expectedKeys.length + 1 ||
        !keys.every((key) => key === 'length' || (
          typeof key === 'string' && expectedKeys.includes(key)
        ))
      ) return INVALID_SNAPSHOT

      const kept: unknown[] = []
      for (const key of expectedKeys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)
        if (
          descriptor === undefined ||
          !('value' in descriptor) ||
          descriptor.enumerable !== true
        ) return INVALID_SNAPSHOT
        const child = snapshotPlainData(descriptor.value, active)
        if (child === INVALID_SNAPSHOT) return INVALID_SNAPSHOT
        kept.push(child)
      }
      active.delete(value)
      return Object.freeze(kept)
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return INVALID_SNAPSHOT
    const keys = Reflect.ownKeys(value)
    if (!keys.every((key): key is string => typeof key === 'string')) return INVALID_SNAPSHOT
    const kept: Record<string, unknown> = {}
    for (const key of [...keys].sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        descriptor === undefined ||
        !('value' in descriptor) ||
        descriptor.enumerable !== true
      ) return INVALID_SNAPSHOT
      const child = snapshotPlainData(descriptor.value, active)
      if (child === INVALID_SNAPSHOT) return INVALID_SNAPSHOT
      kept[key] = child
    }
    active.delete(value)
    return Object.freeze(kept)
  } catch {
    return INVALID_SNAPSHOT
  }
}

function exactSnapshotRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  const snapshot = snapshotPlainData(value)
  if (!isPlainRecord(snapshot)) return null
  const keys = Object.keys(snapshot)
  const expected = [...expectedKeys].sort()
  if (keys.length !== expected.length || !keys.every((key, index) => key === expected[index])) {
    return null
  }
  return snapshot
}

function frozenMappingAuthority(custody: unknown): FrozenMappingAuthority | null {
  const frozenPins = ownDataProperty(custody, 'frozenTutorPins')
  if (frozenPins === MISSING_PROPERTY || frozenPins === INVALID_SNAPSHOT) return null
  const pins = snapshotPlainData(frozenPins)
  if (!isPlainRecord(pins)) return null

  const declaredMetadata = ownDataProperty(pins, 'declaredMetadata')
  const executableAuthority = ownDataProperty(pins, 'effectiveExecutableRoutingAuthority')
  if (
    declaredMetadata === MISSING_PROPERTY || declaredMetadata === INVALID_SNAPSHOT ||
    executableAuthority === MISSING_PROPERTY || executableAuthority === INVALID_SNAPSHOT
  ) return null

  const programRef = ownDataProperty(declaredMetadata, 'sequenceRoutingId')
  const teachingRefs = ownDataProperty(executableAuthority, 'selectableTeachingTurnRefs')
  const phaseItemRefs = ownDataProperty(executableAuthority, 'phaseItemRefs')
  if (
    typeof programRef !== 'string' || !SAFE_REF.test(programRef) ||
    teachingRefs === MISSING_PROPERTY || teachingRefs === INVALID_SNAPSHOT ||
    phaseItemRefs === MISSING_PROPERTY || phaseItemRefs === INVALID_SNAPSHOT
  ) return null

  const guidedPractice = ownDataProperty(phaseItemRefs, 'guidedPractice')
  const independentAttempt = ownDataProperty(phaseItemRefs, 'independentAttempt')
  const reassess = ownDataProperty(phaseItemRefs, 'reassess')
  const scopes = {
    'teach-visually': teachingRefs,
    'guided-practice': guidedPractice,
    'independent-attempt': independentAttempt,
    reassess,
  }
  for (const value of Object.values(scopes)) {
    if (
      value === MISSING_PROPERTY ||
      value === INVALID_SNAPSHOT ||
      !Array.isArray(value) ||
      !value.every((entry) => typeof entry === 'string' && SAFE_REF.test(entry))
    ) return null
  }

  return Object.freeze({
    programRef,
    runtimeItemRefsByPhase: Object.freeze(Object.fromEntries(
      Object.entries(scopes).map(([phase, refs]) => [phase, Object.freeze([...(refs as readonly string[])])]),
    )),
  })
}

function capturedMappings(
  mapping: unknown,
  authority: FrozenMappingAuthority | null,
): readonly CapturedApprovedMapping[] {
  const rowsValue = ownDataProperty(mapping, 'approvedMappings')
  // The legacy prebundle test fixture predates Mapping H2. It deliberately has
  // no production approval field, so its static capability is empty.
  if (rowsValue === MISSING_PROPERTY) return Object.freeze([])
  if (rowsValue === INVALID_SNAPSHOT) {
    throw new TypeError('Server Tutor embedded approved mappings are invalid.')
  }
  const rowsSnapshot = snapshotPlainData(rowsValue)
  if (rowsSnapshot === INVALID_SNAPSHOT || !Array.isArray(rowsSnapshot)) {
    throw new TypeError('Server Tutor embedded approved mappings are invalid.')
  }

  const rows: CapturedApprovedMapping[] = []
  const tupleKeys = new Set<string>()
  for (const rawRow of rowsSnapshot) {
    const row = exactSnapshotRecord(rawRow, APPROVED_MAPPING_KEYS)
    if (row === null) throw new TypeError('Server Tutor embedded approved mapping is malformed.')
    const {
      hostLessonRef,
      hostSegmentRef,
      taskType,
      tutorPhase,
      programRef,
      reviewedRuntimeItemRefs,
    } = row
    if (
      typeof hostLessonRef !== 'string' || !SAFE_REF.test(hostLessonRef) ||
      typeof hostSegmentRef !== 'string' || !SAFE_REF.test(hostSegmentRef) ||
      typeof taskType !== 'string' || taskType.length === 0 ||
      typeof tutorPhase !== 'string' || tutorPhase.length === 0 ||
      typeof programRef !== 'string' || !SAFE_REF.test(programRef) ||
      !Array.isArray(reviewedRuntimeItemRefs) ||
      !reviewedRuntimeItemRefs.every((entry) => typeof entry === 'string' && SAFE_REF.test(entry))
    ) throw new TypeError('Server Tutor embedded approved mapping contains invalid values.')

    const taskPhase = mapStudyTaskToTutorPhase(taskType as StudyTaskType)
    const expectedRuntimeItemRefs = authority?.runtimeItemRefsByPhase[tutorPhase]
    if (
      authority === null ||
      programRef !== authority.programRef ||
      taskPhase.status !== 'mapped' ||
      taskPhase.value.requestedPhase !== tutorPhase ||
      expectedRuntimeItemRefs === undefined ||
      JSON.stringify(reviewedRuntimeItemRefs) !== JSON.stringify(expectedRuntimeItemRefs)
    ) {
      throw new TypeError('Server Tutor embedded approved mapping exceeds frozen runtime authority.')
    }

    const tupleKey = `${hostLessonRef}\u0000${hostSegmentRef}`
    if (tupleKeys.has(tupleKey)) {
      throw new TypeError('Server Tutor embedded approved mapping contains a duplicate tuple.')
    }
    tupleKeys.add(tupleKey)
    rows.push(Object.freeze({
      hostLessonRef,
      hostSegmentRef,
      taskType,
      tutorPhase,
      programRef,
      reviewedRuntimeItemRefs: Object.freeze([...reviewedRuntimeItemRefs]),
    }))
  }
  return Object.freeze(rows)
}

function expectedPinSnapshot(custody: unknown, key: string): string | null {
  const pins = ownDataProperty(custody, key)
  if (pins === MISSING_PROPERTY || pins === INVALID_SNAPSHOT) return null
  const snapshot = snapshotPlainData(pins)
  return snapshot === INVALID_SNAPSHOT ? null : JSON.stringify(snapshot)
}

function pinsMatch(candidate: unknown, expected: string | null): boolean {
  if (expected === null) return false
  const snapshot = snapshotPlainData(candidate)
  return snapshot !== INVALID_SNAPSHOT && JSON.stringify(snapshot) === expected
}

function narrowRuntime(runtime: ProductionStudyTutorRuntime): StudyTutorRuntime {
  return Object.freeze({
    contractVersion: runtime.contractVersion,
    launch: (launch) => runtime.launch(launch),
    submit: (turn) => runtime.submit(turn),
  })
}

const UNVOUCHED_ELIGIBILITY: StudyTutorEligibility = Object.freeze({
  eligible: false,
  reason: STUDY_TUTOR_INELIGIBLE_REASONS.unvouchedDecision,
})

export function createProductionServerTutorRuntime(
  dependencies: ProductionStudyTutorRuntimeDependencies,
): ProductionStudyTutorRuntime {
  return new ProductionStudyTutorRuntime(dependencies)
}

/**
 * Constructs the only static surface artifact custody may retain from the
 * verified generated module. The reviewed mapping and its custody descriptor
 * remain closure state; an approved row crosses the lookup/evaluation boundary
 * only as a frozen empty object registered in a private WeakMap.
 */
export function createServerTutorStaticCapability(mapping: unknown, custody: unknown) {
  const authority = frozenMappingAuthority(custody)
  const approvedMappings = capturedMappings(mapping, authority)
  const academyPins = expectedPinSnapshot(custody, 'academySourcePins')
  const frozenTutorPins = expectedPinSnapshot(custody, 'frozenTutorPins')
  const selections = new WeakMap<object, CapturedApprovedMapping>()

  const capability = {
    schemaVersion: SERVER_TUTOR_STATIC_CAPABILITY_SCHEMA_VERSION,

    verifyAcademySourcePins(candidate: unknown): boolean {
      return pinsMatch(candidate, academyPins)
    },

    verifyFrozenTutorPins(candidate: unknown): boolean {
      return pinsMatch(candidate, frozenTutorPins)
    },

    resolveApprovedMapping(input: unknown): object | null {
      const lookup = exactSnapshotRecord(input, STATIC_LOOKUP_KEYS) as unknown as StaticMappingLookup | null
      if (lookup === null) return null
      if (
        typeof lookup.hostLessonRef !== 'string' ||
        typeof lookup.hostSegmentRef !== 'string' ||
        typeof lookup.taskType !== 'string'
      ) return null

      const matched = approvedMappings.find((row) =>
        row.hostLessonRef === lookup.hostLessonRef &&
        row.hostSegmentRef === lookup.hostSegmentRef &&
        row.taskType === lookup.taskType,
      )
      if (matched === undefined) return null
      const selection = Object.freeze(Object.create(null)) as object
      selections.set(selection, matched)
      return selection
    },

    evaluateApprovedMapping(selection: unknown, input: unknown): StudyTutorEligibility {
      const selected = typeof selection === 'object' && selection !== null
        ? selections.get(selection)
        : undefined
      if (selected === undefined) return UNVOUCHED_ELIGIBILITY

      const evaluationInput = exactSnapshotRecord(
        input,
        STATIC_ELIGIBILITY_KEYS,
      ) as unknown as StaticEligibilityInput | null
      if (
        evaluationInput === null ||
        evaluationInput.subject !== 'math' ||
        evaluationInput.lessonRef !== selected.hostLessonRef ||
        evaluationInput.taskType !== selected.taskType
      ) return UNVOUCHED_ELIGIBILITY

      // The program reference came from the exact approved row. The production
      // evaluator still resolves it against the bundled frozen registry and uses
      // selectEligibleTutorProgram's `?? null` behavior; no subject default can
      // enter this decision.
      const evaluated = evaluateReviewedTutorContent('math', [selected.programRef])
      if (evaluated.eligible === false) {
        return Object.freeze({ eligible: false, reason: evaluated.reason })
      }
      if (evaluated.programRef !== selected.programRef) return UNVOUCHED_ELIGIBILITY
      return Object.freeze({
        eligible: true,
        programRef: evaluated.programRef,
        gradeBand: evaluated.gradeBand,
      })
    },

    async deriveLearnerPseudonym(sessionRef: unknown): Promise<string | null> {
      const parsed = parseStudyTutorRef(sessionRef)
      return parsed === null ? null : studyTutorLearnerPseudonym(parsed)
    },

    createRuntime(dependencies: ProductionStudyTutorRuntimeDependencies): StudyTutorRuntime {
      return narrowRuntime(createProductionServerTutorRuntime(dependencies))
    },
  }

  return Object.freeze(capability)
}
