import {
  IndexedDbRecordError,
  openIndexedDbRecordStore,
  type IndexedDbRecordStore,
  type IndexedDbRecordStoreOptions,
} from '../durable-indexeddb'
import { ACADEMY_GRADES, ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject } from '../../../types'
import { isIsoDate } from './clock'
import { emptyFamilyAutoPlannerDocument, validateFamilyAutoPlannerSchoolPlan } from './plan'
import {
  FAMILY_AUTO_PLANNER_SCHEMA_VERSION,
  type FamilyAutoPlannerDocumentV1,
  type FamilyAutoPlannerMaterializationKind,
  type FamilyAutoPlannerMaterializationV1,
  type FamilyAutoPlannerSchoolPlanV1,
  type FamilyAutoPlannerScope,
  type FamilyAutoPlannerStoreLoad,
  type FamilyAutoPlannerStorePort,
  type FamilyAutoPlannerStoreSave,
} from './types'

export const FAMILY_AUTO_PLANNER_RECORD_PREFIX = 'manuel-academy.study.family-auto-planner.v1' as const
const ENVELOPE_VERSION = 1 as const
const MAX_MATERIALIZATIONS = 10_000
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/

export interface FamilyAutoPlannerRecordV1 {
  readonly envelopeVersion: typeof ENVELOPE_VERSION
  readonly key: string
  readonly document: FamilyAutoPlannerDocumentV1
}

export interface FamilyAutoPlannerIndexedDbStoreOptions extends IndexedDbRecordStoreOptions {
  readonly now?: () => Date
}

export interface FamilyAutoPlannerIndexedDbStore extends FamilyAutoPlannerStorePort {
  close(): void
}

function recordKey(scope: FamilyAutoPlannerScope): string {
  return `${FAMILY_AUTO_PLANNER_RECORD_PREFIX}|${encodeURIComponent(scope.householdRef)}|${encodeURIComponent(scope.learnerRef)}`
}

export function familyAutoPlannerRecordKey(scope: FamilyAutoPlannerScope): string {
  return recordKey(scope)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isRef(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value)
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function parseMaterialization(value: unknown): FamilyAutoPlannerMaterializationV1 | null {
  if (!isRecord(value)) return null
  if (
    !isRef(value.materializationRef) ||
    !['LESSON', 'ASSESSMENT'].includes(value.kind as FamilyAutoPlannerMaterializationKind) ||
    !isIsoDate(String(value.localDate)) || !ACADEMY_SUBJECTS.includes(value.subject as AcademySubject) ||
    !ACADEMY_GRADES.includes(value.workingGrade as AcademyGrade) ||
    !isRef(value.courseRef) || !isRef(value.unitRef) || !isRef(value.itemRef) ||
    !isRef(value.assignmentRef) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 200 ||
    !isInstant(value.createdAt) ||
    !(value.provenance === undefined || ['AUTO_PLANNER', 'LEARNER_WORK_AHEAD'].includes(value.provenance as string))
  ) return null
  return Object.freeze(value as unknown as FamilyAutoPlannerMaterializationV1)
}

export function parseFamilyAutoPlannerDocument(value: unknown, scope: FamilyAutoPlannerScope): FamilyAutoPlannerDocumentV1 | null {
  if (!isRecord(value) || value.schemaVersion !== FAMILY_AUTO_PLANNER_SCHEMA_VERSION || !isRecord(value.scope)) return null
  if (value.scope.householdRef !== scope.householdRef || value.scope.learnerRef !== scope.learnerRef) return null
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !isInstant(value.updatedAt)) return null
  if (!(value.schoolPlan === null || (isRecord(value.schoolPlan) && validateFamilyAutoPlannerSchoolPlan(value.schoolPlan as unknown as FamilyAutoPlannerSchoolPlanV1)))) return null
  if (!Array.isArray(value.materializations) || value.materializations.length > MAX_MATERIALIZATIONS) return null
  const materializations = value.materializations.map(parseMaterialization)
  if (materializations.some((entry) => entry === null)) return null
  const held = materializations as FamilyAutoPlannerMaterializationV1[]
  if (new Set(held.map((entry) => entry.materializationRef)).size !== held.length) return null
  return Object.freeze({
    schemaVersion: FAMILY_AUTO_PLANNER_SCHEMA_VERSION,
    scope: Object.freeze({ ...scope }),
    revision: Number(value.revision),
    updatedAt: value.updatedAt,
    schoolPlan: value.schoolPlan as FamilyAutoPlannerDocumentV1['schoolPlan'],
    materializations: Object.freeze(held),
  })
}

export function parseFamilyAutoPlannerRecord(raw: unknown, scope: FamilyAutoPlannerScope): FamilyAutoPlannerRecordV1 | null {
  const key = recordKey(scope)
  if (!isRecord(raw) || raw.envelopeVersion !== ENVELOPE_VERSION || raw.key !== key) return null
  const document = parseFamilyAutoPlannerDocument(raw.document, scope)
  return document ? Object.freeze({ envelopeVersion: ENVELOPE_VERSION, key, document }) : null
}

function parseEnvelope(raw: unknown, key: string, scope: FamilyAutoPlannerScope): FamilyAutoPlannerStoreLoad | null {
  if (!isRecord(raw)) return null
  if (typeof raw.envelopeVersion === 'number' && raw.envelopeVersion > ENVELOPE_VERSION) {
    return { status: 'read-only', reason: 'schema-version-ahead' }
  }
  if (raw.envelopeVersion !== ENVELOPE_VERSION || raw.key !== key) return { status: 'read-only', reason: 'record-unreadable' }
  if (isRecord(raw.document) && typeof raw.document.schemaVersion === 'number' && raw.document.schemaVersion > FAMILY_AUTO_PLANNER_SCHEMA_VERSION) {
    return { status: 'read-only', reason: 'schema-version-ahead' }
  }
  const document = parseFamilyAutoPlannerDocument(raw.document, scope)
  return document ? { status: 'ready', document } : { status: 'read-only', reason: 'record-unreadable' }
}

function unavailable(error: unknown): { readonly status: 'unavailable'; readonly reason: string } {
  return { status: 'unavailable', reason: error instanceof Error ? error.message : 'IndexedDB operation failed.' }
}

export async function openFamilyAutoPlannerIndexedDbStore(
  options: FamilyAutoPlannerIndexedDbStoreOptions = {},
): Promise<FamilyAutoPlannerIndexedDbStore> {
  const records: IndexedDbRecordStore = await openIndexedDbRecordStore(options)
  const now = options.now ?? (() => new Date())
  return Object.freeze({
    async load(scope: FamilyAutoPlannerScope): Promise<FamilyAutoPlannerStoreLoad> {
      const key = recordKey(scope)
      try {
        const raw = (await records.read([key])).get(key)
        if (raw === undefined) return { status: 'ready', document: emptyFamilyAutoPlannerDocument(scope, now().toISOString()) }
        return parseEnvelope(raw, key, scope) ?? { status: 'read-only', reason: 'record-unreadable' }
      } catch (error) {
        return unavailable(error)
      }
    },

    async save(
      scope: FamilyAutoPlannerScope,
      document: FamilyAutoPlannerDocumentV1,
      expectedRevision: number,
    ): Promise<FamilyAutoPlannerStoreSave> {
      const key = recordKey(scope)
      const parsed = parseFamilyAutoPlannerDocument(document, scope)
      if (!parsed || parsed.revision !== expectedRevision + 1) {
        return { status: 'read-only', reason: 'Candidate planner document is invalid.' }
      }
      const envelope: FamilyAutoPlannerRecordV1 = Object.freeze({ envelopeVersion: ENVELOPE_VERSION, key, document: parsed })
      try {
        await records.write(key, envelope, (current) => {
          if (current === undefined) return expectedRevision === 0
          const held = parseEnvelope(current, key, scope)
          return held?.status === 'ready' && held.document.revision === expectedRevision
        })
        return { status: 'saved', document: parsed }
      } catch (error) {
        if (error instanceof IndexedDbRecordError && error.kind === 'conflict') return { status: 'conflict' }
        return unavailable(error)
      }
    },

    close() { records.close() },
  })
}
