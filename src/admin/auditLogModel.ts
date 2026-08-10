import type {
  AdminAuditAction,
  AdminAuditResourceType,
  AdminAuditValue,
  AdminRole,
} from './contracts'

export interface AdminAuditLogEvent {
  readonly schemaVersion: 2
  readonly eventId: string
  readonly occurredAt: string
  readonly actorRole: AdminRole
  readonly action: AdminAuditAction
  readonly resourceType: AdminAuditResourceType
  readonly resourceRef: string
  readonly resourceVersion: string | null
  readonly resourceRevision: string | null
  readonly previousValue: AdminAuditValue | null
  readonly newValue: AdminAuditValue | null
  readonly reasonCode: string | null
  readonly correlationId: string
}

export interface AdminAuditFilters {
  readonly action?: AdminAuditAction
  readonly resourceType?: AdminAuditResourceType
  readonly resourceRef?: string
  readonly actorRole?: AdminRole
  readonly occurredFrom?: string
  readonly occurredTo?: string
  readonly correlationId?: string
  readonly reasonCode?: string
  readonly limit: number
}

export interface AdminAuditPage {
  readonly events: readonly AdminAuditLogEvent[]
  readonly nextCursor: string | null
}

export type AdminAuditReadState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'loading-page'
      readonly page: AdminAuditPage
      readonly direction: 'older' | 'newer'
    }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'empty' }
  | { readonly status: 'ready'; readonly page: AdminAuditPage }
  | {
      readonly status: 'error'
      readonly code: 'audit_unavailable' | 'audit_timeout' | 'audit_malformed'
    }
