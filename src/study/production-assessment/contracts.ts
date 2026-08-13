export const PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION = 1 as const

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,199}$/
const MAX_RESPONSE_TEXT = 20_000

export type ProductionItemScoringMode =
  | 'fixed-multiple-choice'
  | 'fixed-short-response'
  | 'deterministic-computational'
  | 'constructed-rubric-review'
  | 'guardian-attestation'
  | 'completion-only'
  | 'unsupported'

export interface ProductionItemChoice {
  readonly choiceRef: string
  readonly label: string
}

/** Learner-safe projection. No expected answer, answer index, or authority locator exists. */
export interface ProductionLearnerItem {
  readonly schemaVersion: typeof PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION
  readonly releaseId: string
  readonly lessonRef: string
  readonly sectionRef: string
  readonly itemRef: string
  readonly prompt: string
  readonly responseKind: 'choice' | 'text' | 'completion' | 'unsupported'
  readonly disposition:
    | 'trusted-auto-score'
    | 'adult-review'
    | 'guardian-attestation'
    | 'completion-only'
    | 'unsupported'
  readonly choices?: readonly ProductionItemChoice[]
}

export type ProductionLearnerResponse =
  | { readonly kind: 'choice'; readonly choiceRef: string }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'completion'; readonly completed: true }

export interface ProductionItemAssessmentRequest {
  readonly schemaVersion: typeof PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION
  readonly releaseId: string
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly sectionRef: string
  readonly itemRef: string
  readonly attemptRef: string
  readonly response: ProductionLearnerResponse
}

export type ProductionItemResultKind =
  | 'correct'
  | 'incorrect'
  | 'review-required'
  | 'guardian-attestation-required'
  | 'completion-recorded'
  | 'unsupported'

export type ProductionItemEvidenceKind =
  | 'auto-score'
  | 'adult-review-request'
  | 'guardian-attestation-request'
  | 'completion'
  | 'unsupported'

export interface ProductionItemResult {
  readonly schemaVersion: typeof PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION
  readonly status:
    | 'assessed'
    | 'pending-review'
    | 'pending-guardian-attestation'
    | 'recorded-completion'
    | 'unsupported'
  readonly receiptRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly sectionRef: string
  readonly itemRef: string
  readonly attemptRef: string
  readonly resultKind: ProductionItemResultKind
  readonly evidenceKind: ProductionItemEvidenceKind
  readonly rawResponseIncluded: false
}

/** Trusted-only record offered to the existing Study evidence/runtime port. */
export interface TrustedProductionItemEvidence extends ProductionItemResult {
  readonly releaseId: string
  readonly studentRef: string
}

export interface PendingProductionItemAssessment {
  readonly schemaVersion: typeof PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION
  readonly state: 'PENDING_ASSESSMENT'
  readonly queuedAt: string
  readonly request: ProductionItemAssessmentRequest
}

export interface PendingAssessmentResult {
  readonly schemaVersion: typeof PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION
  readonly status: 'pending-assessment'
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly sectionRef: string
  readonly itemRef: string
  readonly attemptRef: string
  readonly resultKind: null
  readonly evidenceKind: null
  readonly rawResponseIncluded: false
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
}

function ref(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value)
}

export function parseProductionLearnerResponse(value: unknown): ProductionLearnerResponse | null {
  if (!record(value) || typeof value.kind !== 'string') return null
  if (value.kind === 'choice' && exact(value, ['kind', 'choiceRef']) && ref(value.choiceRef)) {
    return Object.freeze({ kind: 'choice', choiceRef: value.choiceRef })
  }
  if (value.kind === 'text' && exact(value, ['kind', 'text']) &&
      typeof value.text === 'string' && value.text.trim().length > 0 &&
      value.text.length <= MAX_RESPONSE_TEXT && !value.text.includes('\u0000')) {
    return Object.freeze({ kind: 'text', text: value.text })
  }
  if (value.kind === 'completion' && exact(value, ['kind', 'completed']) && value.completed === true) {
    return Object.freeze({ kind: 'completion', completed: true })
  }
  return null
}

export function parseProductionItemAssessmentRequest(
  value: unknown,
): ProductionItemAssessmentRequest | null {
  if (!exact(value, [
    'schemaVersion', 'releaseId', 'assignmentRef', 'lessonRef', 'sectionRef',
    'itemRef', 'attemptRef', 'response',
  ]) || value.schemaVersion !== PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION) return null
  const refs = [value.releaseId, value.assignmentRef, value.lessonRef, value.sectionRef,
    value.itemRef, value.attemptRef]
  const response = parseProductionLearnerResponse(value.response)
  if (refs.some((item) => !ref(item)) || !response) return null
  return Object.freeze({
    schemaVersion: PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION,
    releaseId: value.releaseId as string,
    assignmentRef: value.assignmentRef as string,
    lessonRef: value.lessonRef as string,
    sectionRef: value.sectionRef as string,
    itemRef: value.itemRef as string,
    attemptRef: value.attemptRef as string,
    response,
  })
}

const RESULT_STATUSES = new Set<ProductionItemResult['status']>([
  'assessed', 'pending-review', 'pending-guardian-attestation',
  'recorded-completion', 'unsupported',
])
const RESULT_KINDS = new Set<ProductionItemResultKind>([
  'correct', 'incorrect', 'review-required', 'guardian-attestation-required',
  'completion-recorded', 'unsupported',
])
const EVIDENCE_KINDS = new Set<ProductionItemEvidenceKind>([
  'auto-score', 'adult-review-request', 'guardian-attestation-request',
  'completion', 'unsupported',
])
const RESULT_TRIPLES = new Set([
  'assessed|correct|auto-score',
  'assessed|incorrect|auto-score',
  'pending-review|review-required|adult-review-request',
  'pending-guardian-attestation|guardian-attestation-required|guardian-attestation-request',
  'recorded-completion|completion-recorded|completion',
  'unsupported|unsupported|unsupported',
])

export function parseProductionItemResult(value: unknown): ProductionItemResult | null {
  if (!exact(value, [
    'schemaVersion', 'status', 'receiptRef', 'assignmentRef', 'lessonRef',
    'sectionRef', 'itemRef', 'attemptRef', 'resultKind', 'evidenceKind',
    'rawResponseIncluded',
  ]) || value.schemaVersion !== PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION ||
      !RESULT_STATUSES.has(value.status as ProductionItemResult['status']) ||
      !RESULT_KINDS.has(value.resultKind as ProductionItemResultKind) ||
      !EVIDENCE_KINDS.has(value.evidenceKind as ProductionItemEvidenceKind) ||
      !RESULT_TRIPLES.has(`${value.status}|${value.resultKind}|${value.evidenceKind}`) ||
      value.rawResponseIncluded !== false ||
      [value.receiptRef, value.assignmentRef, value.lessonRef, value.sectionRef,
        value.itemRef, value.attemptRef].some((item) => !ref(item))) return null
  return Object.freeze({ ...(value as unknown as ProductionItemResult) })
}
