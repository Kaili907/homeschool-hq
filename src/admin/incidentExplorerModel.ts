import type {
  AdminAuditAction,
  AdminAuditResourceType,
  AdminAuditValue,
  AdminEngineId,
  AdminOperationalResult,
  AdminRole,
  AdminTelemetryEventType,
} from './contracts'

export const ADMIN_INCIDENT_DOMAINS = [
  'all',
  'runtime',
  'admin-audit',
  'provider-accounting',
] as const

export type AdminIncidentDomain = (typeof ADMIN_INCIDENT_DOMAINS)[number]
export type AdminIncidentSource = Exclude<AdminIncidentDomain, 'all'>

export interface AdminIncidentFilters {
  readonly correlationId?: string
  readonly occurredFrom: string
  readonly occurredTo: string
  readonly domain: AdminIncidentDomain
  readonly engine?: AdminEngineId
  readonly result?: AdminOperationalResult
  readonly auditAction?: AdminAuditAction
  readonly auditResource?: AdminAuditResourceType
  readonly limit: number
}

interface AdminIncidentEventBase {
  readonly eventId: string
  readonly occurredAt: string
  readonly correlationId: string
  readonly source: AdminIncidentSource
}

export interface AdminRuntimeIncidentEvent extends AdminIncidentEventBase {
  readonly source: 'runtime'
  readonly facts: {
    readonly engine: AdminEngineId
    readonly eventType: AdminTelemetryEventType
    readonly result: AdminOperationalResult
    readonly durationMs: number | null
    readonly operation: string | null
    readonly reasonCode: string | null
    readonly provider: string | null
    readonly httpStatus: number | null
    readonly failureStage: string | null
    readonly retryable: boolean | null
  }
}

export interface AdminAuditIncidentEvent extends AdminIncidentEventBase {
  readonly source: 'admin-audit'
  readonly facts: {
    readonly actorRole: AdminRole
    readonly action: AdminAuditAction
    readonly resourceType: AdminAuditResourceType
    readonly resourceRef: string
    readonly resourceVersion: string | null
    readonly resourceRevision: string | null
    readonly previousValue: AdminAuditValue | null
    readonly newValue: AdminAuditValue | null
    readonly reasonCode: string | null
  }
}

export interface AdminProviderAccountingIncidentEvent extends AdminIncidentEventBase {
  readonly source: 'provider-accounting'
  readonly facts: {
    readonly engine: AdminEngineId
    readonly provider: string
    readonly providerProductId: string
    readonly logicalModelTier: string | null
    readonly result: AdminOperationalResult
    readonly resultReasonCode: string | null
    readonly billingDisposition: 'billable' | 'not_billable' | 'unknown'
    readonly costKind: 'calculated' | 'reconciled' | 'unavailable'
    readonly currency: 'USD'
  }
}

export type AdminIncidentEvent =
  | AdminRuntimeIncidentEvent
  | AdminAuditIncidentEvent
  | AdminProviderAccountingIncidentEvent

export type AdminIncidentSourceStatus =
  | 'available'
  | 'unauthorized'
  | 'unavailable'
  | 'timeout'
  | 'not-requested'

export type AdminIncidentCompletenessReason =
  | 'runtime_unauthorized'
  | 'runtime_unavailable'
  | 'runtime_timeout'
  | 'runtime_malformed_entries'
  | 'runtime_retention_limited'
  | 'admin_audit_unauthorized'
  | 'admin_audit_unavailable'
  | 'admin_audit_timeout'
  | 'admin_audit_malformed_entries'
  | 'provider_accounting_unauthorized'
  | 'provider_accounting_unavailable'
  | 'provider_accounting_timeout'
  | 'provider_accounting_malformed_entries'

export interface AdminIncidentPage {
  readonly schemaVersion: 2
  readonly generatedAt: string
  readonly sortOrder: 'chronological'
  readonly query: AdminIncidentFilters
  readonly events: readonly AdminIncidentEvent[]
  readonly sources: Readonly<Record<AdminIncidentSource, AdminIncidentSourceStatus>>
  readonly evidence: {
    readonly status: 'complete' | 'partial'
    readonly reasons: readonly AdminIncidentCompletenessReason[]
    readonly rejectedEntries: number
  }
  readonly nextCursor: string | null
}

export type AdminIncidentReadState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'loading-page'
      readonly page: AdminIncidentPage
      readonly direction: 'older' | 'newer'
    }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'empty'; readonly page: AdminIncidentPage }
  | { readonly status: 'ready'; readonly page: AdminIncidentPage }
  | {
      readonly status: 'error'
      readonly code: 'incident_unavailable' | 'incident_timeout' | 'incident_malformed' | 'invalid_query'
    }
