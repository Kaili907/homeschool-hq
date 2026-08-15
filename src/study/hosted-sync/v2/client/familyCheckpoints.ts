import { parseFamilyAutoPlannerDocument, type FamilyAutoPlannerDocumentV1 } from '../../../family-pilot/auto-planner'

export const FAMILY_RESPONSE_CHECKPOINT_CONTRACT_R1 = 'family-pilot.learner-response-checkpoint.r1' as const
export const FAMILY_PLAN_CHECKPOINT_CONTRACT_R1 = 'family-pilot.family-plan-checkpoint.r1' as const
export const FAMILY_RESPONSE_CHECKPOINT_MAX_BYTES_R1 = 1024 * 1024
export const FAMILY_PLAN_CHECKPOINT_MAX_BYTES_R1 = 8 * 1024 * 1024

export type FamilyResponseCheckpointValueR1 =
  | Readonly<{ kind: 'CHOICE'; choiceRef: string }>
  | Readonly<{ kind: 'TEXT' | 'NUMERIC' | 'CONSTRUCTED_RESPONSE' | 'ACTIVITY_EVIDENCE'; text: string }>

export interface FamilyResponseCheckpointItemR1 {
  readonly itemRef: string
  readonly sectionRef: string
  readonly segmentRef: string
  readonly responseType: FamilyResponseCheckpointValueR1['kind']
  readonly evidenceMode: 'SUPPORTED' | 'INDEPENDENT' | 'MASTERY' | 'COMPLETION' | null
  readonly response: FamilyResponseCheckpointValueR1
  readonly status: 'PENDING_ASSESSMENT' | 'ASSESSED'
  readonly savedAt: string
  readonly assessment: null | Readonly<{
    assessmentRef: string
    assessorRef: string
    assessedAt: string
    decision: 'CORRECT' | 'INCORRECT' | 'PARTIAL' | 'REVIEW_REQUIRED'
  }>
}

export interface FamilyResponseCheckpointR1 {
  readonly contract: typeof FAMILY_RESPONSE_CHECKPOINT_CONTRACT_R1
  readonly contractVersion: 1
  readonly identity: Readonly<{
    householdRef: string
    studentRef: string
    learnerRef: string
    assignmentRef: string
    sessionRef: string
  }>
  readonly attempt: Readonly<{ attemptRef: string; lessonRef: string }>
  readonly sync: FamilyCheckpointSyncR1
  readonly responses: readonly FamilyResponseCheckpointItemR1[]
}

export interface FamilyPlanCheckpointR1 {
  readonly contract: typeof FAMILY_PLAN_CHECKPOINT_CONTRACT_R1
  readonly contractVersion: 1
  readonly identity: Readonly<{ householdRef: string; studentRef: string; learnerRef: string }>
  readonly sync: FamilyCheckpointSyncR1
  readonly planner: FamilyAutoPlannerDocumentV1
}

export interface FamilyCheckpointSyncR1 {
  readonly baseRevision: number
  readonly revision: number
  readonly operationId: string
  readonly savedAt: string
}

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,191}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RESPONSE_TYPES = Object.freeze(['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'] as const)
const EVIDENCE = Object.freeze(['SUPPORTED', 'INDEPENDENT', 'MASTERY', 'COMPLETION'] as const)
const DECISIONS = Object.freeze(['CORRECT', 'INCORRECT', 'PARTIAL', 'REVIEW_REQUIRED'] as const)

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))
}

function ref(value: unknown): value is string { return typeof value === 'string' && REF.test(value) }
function instant(value: unknown): value is string { return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) }
function revision(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0 }
function bytes(value: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength } catch { return Number.POSITIVE_INFINITY }
}

function parseSync(value: unknown): FamilyCheckpointSyncR1 | null {
  if (!exact(value, ['baseRevision', 'revision', 'operationId', 'savedAt']) ||
      !revision(value.baseRevision) || !revision(value.revision) || Number(value.revision) < Number(value.baseRevision) ||
      typeof value.operationId !== 'string' || !UUID.test(value.operationId) || !instant(value.savedAt)) return null
  return Object.freeze(value) as unknown as FamilyCheckpointSyncR1
}

function parseResponseItem(value: unknown): FamilyResponseCheckpointItemR1 | null {
  if (!exact(value, ['itemRef', 'sectionRef', 'segmentRef', 'responseType', 'evidenceMode', 'response', 'status', 'savedAt', 'assessment']) ||
      bytes(value) > 32 * 1024 || !ref(value.itemRef) || !ref(value.sectionRef) || !ref(value.segmentRef) ||
      !RESPONSE_TYPES.includes(value.responseType as typeof RESPONSE_TYPES[number]) ||
      !(value.evidenceMode === null || EVIDENCE.includes(value.evidenceMode as typeof EVIDENCE[number])) ||
      !['PENDING_ASSESSMENT', 'ASSESSED'].includes(String(value.status)) || !instant(value.savedAt)) return null
  if (value.responseType === 'CHOICE') {
    if (!exact(value.response, ['kind', 'choiceRef']) || value.response.kind !== 'CHOICE' || !ref(value.response.choiceRef)) return null
  } else if (!exact(value.response, ['kind', 'text']) || value.response.kind !== value.responseType ||
      typeof value.response.text !== 'string' || value.response.text.length === 0 || bytes(value.response.text) > 16 * 1024) return null
  if (value.status === 'PENDING_ASSESSMENT') {
    if (value.assessment !== null) return null
  } else if (!exact(value.assessment, ['assessmentRef', 'assessorRef', 'assessedAt', 'decision']) ||
      !ref(value.assessment.assessmentRef) || !ref(value.assessment.assessorRef) || !instant(value.assessment.assessedAt) ||
      !DECISIONS.includes(value.assessment.decision as typeof DECISIONS[number])) return null
  return Object.freeze(value) as unknown as FamilyResponseCheckpointItemR1
}

export function parseFamilyResponseCheckpointR1(value: unknown): FamilyResponseCheckpointR1 | null {
  if (!exact(value, ['contract', 'contractVersion', 'identity', 'attempt', 'sync', 'responses']) ||
      value.contract !== FAMILY_RESPONSE_CHECKPOINT_CONTRACT_R1 || value.contractVersion !== 1 ||
      bytes(value) > FAMILY_RESPONSE_CHECKPOINT_MAX_BYTES_R1 ||
      !exact(value.identity, ['householdRef', 'studentRef', 'learnerRef', 'assignmentRef', 'sessionRef']) ||
      !Object.values(value.identity).every(ref) || !exact(value.attempt, ['attemptRef', 'lessonRef']) ||
      !ref(value.attempt.attemptRef) || !ref(value.attempt.lessonRef) || !Array.isArray(value.responses) || value.responses.length > 256) return null
  const sync = parseSync(value.sync)
  const responses = value.responses.map(parseResponseItem)
  if (!sync || responses.some((item) => item === null) || new Set(responses.map((item) => item!.itemRef)).size !== responses.length) return null
  return Object.freeze({ ...value, identity: Object.freeze(value.identity), attempt: Object.freeze(value.attempt), sync, responses: Object.freeze(responses) }) as unknown as FamilyResponseCheckpointR1
}

export function parseFamilyPlanCheckpointR1(value: unknown): FamilyPlanCheckpointR1 | null {
  if (!exact(value, ['contract', 'contractVersion', 'identity', 'sync', 'planner']) ||
      value.contract !== FAMILY_PLAN_CHECKPOINT_CONTRACT_R1 || value.contractVersion !== 1 ||
      bytes(value) > FAMILY_PLAN_CHECKPOINT_MAX_BYTES_R1 ||
      !exact(value.identity, ['householdRef', 'studentRef', 'learnerRef']) || !Object.values(value.identity).every(ref)) return null
  const sync = parseSync(value.sync)
  const planner = parseFamilyAutoPlannerDocument(value.planner, {
    householdRef: String(value.identity.householdRef), learnerRef: String(value.identity.learnerRef),
  })
  if (!sync || !planner) return null
  return Object.freeze({ ...value, identity: Object.freeze(value.identity), sync, planner }) as unknown as FamilyPlanCheckpointR1
}

export function restampFamilyResponseCheckpointR1(
  checkpoint: FamilyResponseCheckpointR1,
  expectedRevision: number,
  operationId: string,
  savedAt: string,
): FamilyResponseCheckpointR1 {
  const parsed = parseFamilyResponseCheckpointR1({ ...checkpoint, sync: { baseRevision: expectedRevision, revision: expectedRevision + 1, operationId, savedAt } })
  if (!parsed) throw new Error('Invalid learner-response checkpoint CAS candidate.')
  return parsed
}

export function restampFamilyPlanCheckpointR1(
  checkpoint: FamilyPlanCheckpointR1,
  expectedRevision: number,
  operationId: string,
  savedAt: string,
): FamilyPlanCheckpointR1 {
  const parsed = parseFamilyPlanCheckpointR1({ ...checkpoint, sync: { baseRevision: expectedRevision, revision: expectedRevision + 1, operationId, savedAt } })
  if (!parsed) throw new Error('Invalid Family Plan checkpoint CAS candidate.')
  return parsed
}
