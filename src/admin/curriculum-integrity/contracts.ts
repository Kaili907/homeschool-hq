import type { AdminCapability } from '../contracts'

export const CURRICULUM_INTEGRITY_STATUSES = [
  'VERIFIED', 'MISMATCH', 'INCOMPLETE', 'UNVERIFIED', 'UNAVAILABLE',
] as const

export type CurriculumIntegrityStatus = typeof CURRICULUM_INTEGRITY_STATUSES[number]

export interface CurriculumIntegrityFinding {
  readonly code: string
  readonly subject: string
  readonly message: string
}

export interface CurriculumIntegrityGap {
  readonly code: string
  readonly message: string
}

export interface CurriculumProvenanceLink {
  readonly kind: 'draft' | 'validation' | 'approval' | 'staging' | 'published'
  readonly label: string
  readonly status: CurriculumIntegrityStatus
  readonly identity: string | null
  readonly detail: string | null
}

export interface CurriculumIntegritySubject {
  readonly subjectId: string
  readonly kind: 'staged' | 'published'
  readonly version: string
  readonly state: 'STAGED' | 'PUBLISHED'
  readonly status: CurriculumIntegrityStatus
  readonly packageId: string | null
  readonly baseReleaseVersion: string | null
  readonly schemaSetVersion: string | null
  readonly manifestStatus: CurriculumIntegrityStatus
  readonly packageStatus: CurriculumIntegrityStatus
  readonly metadataStatus: CurriculumIntegrityStatus
  readonly artifacts: {
    readonly status: CurriculumIntegrityStatus
    readonly expectedCount: number | null
    readonly observedCount: number | null
    readonly verifiedCount: number
  }
  readonly provenance: {
    readonly status: CurriculumIntegrityStatus
    readonly links: readonly CurriculumProvenanceLink[]
  }
  readonly mismatches: readonly CurriculumIntegrityFinding[]
  readonly evidenceGaps: readonly CurriculumIntegrityGap[]
}

export interface CurriculumIntegrityReport {
  readonly schemaVersion: 1
  readonly status: CurriculumIntegrityStatus
  readonly subjects: readonly CurriculumIntegritySubject[]
  readonly evidenceGaps: readonly CurriculumIntegrityGap[]
  readonly readOnly: true
}

export interface CurriculumIntegritySource {
  readIntegrity(): Promise<CurriculumIntegrityReport>
}

export type CurriculumIntegrityAuthorization =
  | { readonly status: 'checking' }
  | { readonly status: 'denied' }
  | { readonly status: 'authorized'; readonly capabilities: readonly AdminCapability[] }

export class CurriculumIntegrityError extends Error {
  readonly code: 'unauthenticated' | 'forbidden' | 'unavailable'

  constructor(code: CurriculumIntegrityError['code']) {
    super(code)
    this.name = 'CurriculumIntegrityError'
    this.code = code
  }
}
