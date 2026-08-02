/**
 * Provider-neutral contracts for external-school assignment capture.
 *
 * These values deliberately contain no school credentials and make no
 * assumption that a provider connection exists. An integrating host supplies
 * opaque actor/learner references and persists only records that pass the
 * runtime validators.
 */

export const EXTERNAL_CAPTURE_SCHEMA_VERSION =
  "external-assignment-capture.v1" as const;

export const EXTERNAL_ASSIGNMENT_FIELDS = [
  "title",
  "course",
  "section",
  "originalAssignmentReference",
  "due",
  "instructions",
  "rubric",
  "estimatedDurationMinutes",
  "sourceUrl",
] as const;

export type ExternalAssignmentField =
  (typeof EXTERNAL_ASSIGNMENT_FIELDS)[number];

export type ExternalCaptureRole =
  | "parent"
  | "student"
  | "provider_adapter"
  | "system";

export interface ExternalCaptureActor {
  readonly actorRef: string;
  readonly role: ExternalCaptureRole;
  /**
   * Opaque learners this actor may act for. The host remains authoritative for
   * authorization; this local list is a defense-in-depth integration seam.
   */
  readonly learnerRefs: readonly string[];
  readonly canApproveEvidence?: boolean;
  readonly canConfigureProviders?: boolean;
}

export type ExternalCaptureAction =
  | "create_intake"
  | "confirm_extraction"
  | "schedule_assignment"
  | "submit_evidence"
  | "review_evidence"
  | "mark_complete"
  | "apply_provider_update"
  | "configure_provider";

export interface ExternalProviderDescriptor {
  readonly providerId: string;
  readonly displayName: string;
  readonly connectionMode: "manual_only" | "authorized_adapter";
  /**
   * A provider may be recognizable while still having no authorized
   * synchronization. This flag describes an actual configured capability, not
   * a future aspiration.
   */
  readonly synchronizationAvailable: boolean;
  readonly provisional: boolean;
  readonly privacyNotice: string;
}

export interface ExternalCourseIdentity {
  readonly displayName: string;
  readonly externalCourseRef?: string;
}

export interface ExternalSectionIdentity {
  readonly displayName: string;
  readonly externalSectionRef?: string;
}

export interface ManuelCourseTarget {
  readonly courseRef: string;
  readonly sectionRef?: string;
  readonly displayName: string;
}

export interface CourseSectionMapping {
  readonly schemaVersion: typeof EXTERNAL_CAPTURE_SCHEMA_VERSION;
  readonly mappingId: string;
  readonly learnerRef: string;
  readonly providerId: string;
  readonly externalCourse: ExternalCourseIdentity;
  readonly externalSection?: ExternalSectionIdentity;
  readonly target: ManuelCourseTarget;
  readonly status: "confirmed";
  readonly confirmedByParentRef: string;
  readonly confirmedAt: string;
  readonly revision: number;
}

export interface UnmappedCourseSection {
  readonly status: "unmapped";
  readonly providerId: string;
  readonly externalCourse: ExternalCourseIdentity;
  readonly externalSection?: ExternalSectionIdentity;
}

export type CourseMappingResolution =
  | {
      readonly status: "matched";
      readonly mapping: CourseSectionMapping;
      readonly matchBasis:
        | "stable_course_and_section_refs"
        | "stable_course_ref"
        | "confirmed_normalized_labels";
    }
  | {
      readonly status: "ambiguous";
      readonly candidates: readonly CourseSectionMapping[];
    }
  | UnmappedCourseSection;

/**
 * A date without a time is not silently converted to midnight. A local date
 * and time retains its IANA zone until the host resolves an instant.
 */
export type ExternalDue =
  | {
      readonly kind: "date";
      readonly localDate: string;
      readonly timeZone: string;
    }
  | {
      readonly kind: "local_date_time";
      readonly localDate: string;
      readonly localTime: string;
      readonly timeZone: string;
    }
  | {
      readonly kind: "instant";
      readonly dueAt: string;
      readonly timeZone: string;
    };

export interface RichTextCapture {
  readonly format: "plain_text" | "markdown";
  readonly text: string;
}

export interface RubricCriterion {
  readonly criterionId: string;
  readonly title: string;
  readonly description?: string;
  readonly pointsPossible?: number;
}

export interface RubricCapture {
  readonly title?: string;
  readonly rawText?: string;
  readonly criteria: readonly RubricCriterion[];
  readonly pointsPossible?: number;
}

export interface AssignmentFieldValueMap {
  readonly title: string;
  readonly course: ExternalCourseIdentity;
  readonly section: ExternalSectionIdentity | null;
  readonly originalAssignmentReference: string;
  readonly due: ExternalDue | null;
  readonly instructions: RichTextCapture | null;
  readonly rubric: RubricCapture | null;
  readonly estimatedDurationMinutes: number | null;
  readonly sourceUrl: string | null;
}

export interface EvidenceRegion {
  readonly page?: number;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
}

export interface ExtractionSourceEvidence {
  readonly attachmentId?: string;
  readonly method:
    | "manual_entry"
    | "ocr"
    | "embedded_document_text"
    | "authorized_provider_payload";
  readonly sourceLabel: string;
  /**
   * A short display excerpt. Hosts should not use this as a substitute for the
   * source file and should apply their child-data retention policy.
   */
  readonly excerpt?: string;
  readonly region?: EvidenceRegion;
}

export interface ProposedField<T> {
  readonly status: "proposed" | "missing" | "unreadable";
  readonly value?: T;
  readonly confidence: number;
  readonly evidence: readonly ExtractionSourceEvidence[];
  readonly warnings: readonly string[];
}

export type AssignmentFieldProposals = {
  readonly [Field in ExternalAssignmentField]: ProposedField<
    AssignmentFieldValueMap[Field]
  >;
};

export type AttachmentPurpose = "intake_source" | "completion_evidence";

export interface AttachmentMetadata {
  readonly attachmentId: string;
  readonly purpose: AttachmentPurpose;
  readonly fileName: string;
  readonly mediaType: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly uploadedAt: string;
  readonly uploadedBy: {
    readonly actorRef: string;
    readonly role: "parent" | "student";
  };
  readonly availability:
    | "available"
    | "missing"
    | "unreadable"
    | "unsupported"
    | "quarantined";
  readonly pageCount?: number;
}

export type DocumentContent =
  | {
      readonly state: "available";
      readonly text: string;
      readonly method: "ocr" | "embedded_document_text";
    }
  | {
      readonly state:
        | "missing"
        | "unreadable"
        | "unsupported"
        | "extractor_unavailable";
      readonly diagnostic?: string;
    };

export interface ManualAssignmentIntakeInput {
  readonly schemaVersion: typeof EXTERNAL_CAPTURE_SCHEMA_VERSION;
  readonly captureId: string;
  readonly learnerRef: string;
  readonly provider: ExternalProviderDescriptor;
  readonly submittedBy: ExternalCaptureActor;
  readonly submittedAt: string;
  readonly defaultTimeZone: string;
  readonly values: Partial<AssignmentFieldValueMap>;
  readonly attachments?: readonly AttachmentMetadata[];
}

export interface DocumentAssignmentIntakeInput {
  readonly schemaVersion: typeof EXTERNAL_CAPTURE_SCHEMA_VERSION;
  readonly captureId: string;
  readonly learnerRef: string;
  readonly provider: ExternalProviderDescriptor;
  readonly submittedBy: ExternalCaptureActor;
  readonly submittedAt: string;
  readonly defaultTimeZone: string;
  readonly attachment: AttachmentMetadata;
  readonly content: DocumentContent;
}

export type ExtractionFallbackReason =
  | "missing_file"
  | "unreadable_image"
  | "unsupported_media"
  | "extractor_unavailable"
  | "no_assignment_fields_found";

export interface ExtractionFallback {
  readonly required: boolean;
  readonly reason?: ExtractionFallbackReason;
  readonly message: string;
  readonly nextStep: "review_and_confirm" | "manual_entry";
}

export interface AssignmentExtractionResult {
  readonly schemaVersion: typeof EXTERNAL_CAPTURE_SCHEMA_VERSION;
  readonly extractionId: string;
  readonly captureId: string;
  readonly learnerRef: string;
  readonly provider: ExternalProviderDescriptor;
  readonly sourceKind: "manual" | "document" | "authorized_provider_payload";
  readonly status:
    | "proposal_ready"
    | "partial_proposal"
    | "manual_entry_required";
  readonly fields: AssignmentFieldProposals;
  readonly attachments: readonly AttachmentMetadata[];
  readonly overallConfidence: number;
  readonly warnings: readonly string[];
  readonly fallback: ExtractionFallback;
  readonly requiresFieldByFieldConfirmation: true;
  readonly extractedAt: string;
}

export type FieldConfirmationDecision<Field extends ExternalAssignmentField> =
  | {
      readonly decision: "accept";
      readonly field: Field;
    }
  | {
      readonly decision: "edit";
      readonly field: Field;
      readonly value: AssignmentFieldValueMap[Field];
    }
  | {
      readonly decision: "clear";
      readonly field: Field;
    };

export type FieldConfirmationDecisions = {
  readonly [Field in ExternalAssignmentField]: FieldConfirmationDecision<Field>;
};

export interface ConfirmedFieldAudit<Field extends ExternalAssignmentField> {
  readonly field: Field;
  readonly decision: "accept" | "edit" | "clear";
  readonly proposalConfidence: number;
  readonly proposalEvidence: readonly ExtractionSourceEvidence[];
  readonly reviewedBy: {
    readonly actorRef: string;
    readonly role: "parent" | "student";
  };
  readonly reviewedAt: string;
}

export type ConfirmationAudit = {
  readonly [Field in ExternalAssignmentField]: ConfirmedFieldAudit<Field>;
};

export interface ConfirmationInput {
  readonly assignmentId: string;
  readonly reviewedBy: ExternalCaptureActor;
  readonly reviewedAt: string;
  readonly decisions: FieldConfirmationDecisions;
  readonly evidenceRequirement: CompletionEvidenceRequirement;
}

export interface CompletionEvidenceRequirement {
  readonly required: boolean;
  readonly minimumAttachmentCount: number;
  readonly acceptedMediaTypes: readonly string[];
  readonly noteRequired: boolean;
  readonly parentApprovalRequired: boolean;
}

export interface ProviderSyncStatus {
  readonly mode:
    | "manual_only"
    | "not_configured"
    | "authorized"
    | "authorization_expired";
  readonly state:
    | "never"
    | "manual"
    | "pending"
    | "current"
    | "conflict"
    | "error";
  readonly lastAttemptedAt?: string;
  readonly lastSucceededAt?: string;
  readonly providerRevision?: string;
  readonly authorizationRef?: string;
  readonly errorCode?: string;
  readonly message: string;
}

export interface ExternalScheduleLink {
  readonly calendarEntryRef: string;
  readonly scheduledStart: string;
  readonly timeZone: string;
  readonly linkedAt: string;
  readonly linkedBy: {
    readonly actorRef: string;
    readonly role: "parent";
  };
}

export type ExternalAssignmentLifecycle =
  | "confirmed"
  | "scheduled"
  | "evidence_pending"
  | "evidence_returned"
  | "approved"
  | "completed";

export interface ExternalAssignmentRecord {
  readonly schemaVersion: typeof EXTERNAL_CAPTURE_SCHEMA_VERSION;
  readonly assignmentId: string;
  readonly captureId: string;
  readonly learnerRef: string;
  readonly provider: ExternalProviderDescriptor;
  readonly originalAssignmentReference: string;
  readonly title: string;
  readonly externalCourse: ExternalCourseIdentity;
  readonly externalSection?: ExternalSectionIdentity;
  readonly due?: ExternalDue;
  readonly instructions?: RichTextCapture;
  readonly rubric?: RubricCapture;
  readonly estimatedDurationMinutes?: number;
  readonly sourceUrl?: string;
  readonly intakeAttachments: readonly AttachmentMetadata[];
  readonly confirmation: {
    readonly allFieldsReviewed: true;
    readonly reviewedBy: {
      readonly actorRef: string;
      readonly role: "parent" | "student";
    };
    readonly reviewedAt: string;
    readonly fields: ConfirmationAudit;
  };
  readonly courseMapping?: CourseSectionMapping;
  readonly schedule?: ExternalScheduleLink;
  readonly evidenceRequirement: CompletionEvidenceRequirement;
  readonly evidence: readonly CompletionEvidenceSubmission[];
  readonly lifecycle: ExternalAssignmentLifecycle;
  readonly providerSync: ProviderSyncStatus;
  readonly revision: number;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface ExternalScheduleHandoff {
  readonly schemaVersion: typeof EXTERNAL_CAPTURE_SCHEMA_VERSION;
  /**
   * This is an integration request, not evidence that a calendar write
   * succeeded. Only a host acknowledgement with `calendarEntryRef` may move
   * the assignment to `scheduled`.
   */
  readonly status: "pending_host_calendar_write";
  readonly assignmentId: string;
  readonly learnerRef: string;
  readonly sourceProviderId: string;
  readonly sourceProviderDisplayName: string;
  readonly originalAssignmentReference: string;
  readonly dedupeKey: string;
  readonly title: string;
  readonly courseDisplayName: string;
  readonly manuelCourseRef?: string;
  readonly manuelSectionRef?: string;
  readonly due?: ExternalDue;
  readonly scheduledStart: string;
  readonly timeZone: string;
  readonly estimatedDurationMinutes?: number;
  readonly instructions?: RichTextCapture;
  readonly rubric?: RubricCapture;
  readonly attachmentIds: readonly string[];
  readonly evidenceRequired: boolean;
  readonly parentApprovalRequired: boolean;
}

export interface SchedulePlacementInput {
  readonly scheduledStart: string;
  readonly timeZone: string;
  readonly requestedBy: ExternalCaptureActor;
  readonly requestedAt: string;
}

export interface CompletionEvidenceSubmission {
  readonly schemaVersion: typeof EXTERNAL_CAPTURE_SCHEMA_VERSION;
  readonly evidenceId: string;
  readonly assignmentId: string;
  readonly revision: number;
  readonly submittedBy: {
    readonly actorRef: string;
    readonly role: "parent" | "student";
  };
  readonly submittedAt: string;
  readonly attachments: readonly AttachmentMetadata[];
  readonly note?: string;
  readonly status: "pending_parent_approval" | "approved" | "returned";
  readonly review?: ParentEvidenceReview;
}

export interface ParentEvidenceReview {
  readonly decision: "approve" | "return";
  readonly parentRef: string;
  readonly decidedAt: string;
  readonly reviewedEvidenceRevision: number;
  readonly note?: string;
}

export interface EvidenceSubmissionInput {
  readonly evidenceId: string;
  readonly submittedBy: ExternalCaptureActor;
  readonly submittedAt: string;
  readonly attachments: readonly AttachmentMetadata[];
  readonly note?: string;
}

export interface ParentEvidenceReviewInput {
  readonly reviewedBy: ExternalCaptureActor;
  readonly decidedAt: string;
  readonly decision: "approve" | "return";
  readonly note?: string;
}

export type DuplicateDetection =
  | {
      readonly kind: "exact";
      readonly existingAssignmentId: string;
      readonly dedupeKey: string;
    }
  | {
      readonly kind: "possible";
      readonly existingAssignmentIds: readonly string[];
      readonly reasons: readonly string[];
    }
  | { readonly kind: "none"; readonly dedupeKey: string };

export interface ProviderAssignmentUpdate {
  readonly providerId: string;
  readonly originalAssignmentReference: string;
  readonly observedAt: string;
  readonly providerRevision?: string;
  readonly proposedFields: Partial<AssignmentFieldValueMap>;
}

export interface AssignmentFieldConflict {
  readonly field: ExternalAssignmentField;
  readonly currentValue: AssignmentFieldValueMap[ExternalAssignmentField];
  readonly incomingValue: AssignmentFieldValueMap[ExternalAssignmentField];
  readonly status: "requires_confirmation";
  readonly reason: "confirmed_value_changed_by_provider";
}

export type ProviderUpdateReconciliation =
  | {
      readonly status: "no_change";
      readonly assignment: ExternalAssignmentRecord;
    }
  | {
      readonly status: "proposal_ready";
      readonly assignment: ExternalAssignmentRecord;
      readonly proposedUpdate: ProviderAssignmentUpdate;
    }
  | {
      readonly status: "conflict";
      readonly assignment: ExternalAssignmentRecord;
      readonly proposedUpdate: ProviderAssignmentUpdate;
      readonly conflicts: readonly AssignmentFieldConflict[];
    };

export interface AuthorizedProviderSyncContext {
  /**
   * Opaque host-managed authorization reference. It is not an access token and
   * adapters must not receive or return student credentials.
   */
  readonly authorizationRef: string;
  readonly requestedAt: string;
  readonly learnerRef: string;
}

export type ProviderSyncAttempt =
  | {
      readonly status: "not_supported";
      readonly message: string;
    }
  | {
      readonly status: "authorization_required";
      readonly message: string;
    }
  | {
      readonly status: "updates_available";
      readonly updates: readonly ProviderAssignmentUpdate[];
    }
  | {
      readonly status: "current";
      readonly checkedAt: string;
    };

export interface ExternalProviderAdapter<TAuthorizedPayload = unknown> {
  readonly descriptor: ExternalProviderDescriptor;
  proposeManual(
    input: ManualAssignmentIntakeInput,
  ): AssignmentExtractionResult;
  proposeDocument(
    input: DocumentAssignmentIntakeInput,
  ): AssignmentExtractionResult;
  /**
   * Optional only for an independently authorized provider implementation.
   * Its absence means synchronization must never be represented as available.
   */
  proposeAuthorizedPayload?(
    payload: TAuthorizedPayload,
    context: AuthorizedProviderSyncContext,
  ): AssignmentExtractionResult;
  synchronize?(
    context: AuthorizedProviderSyncContext,
  ): Promise<ProviderSyncAttempt>;
}

export class ExternalCaptureError extends Error {
  public readonly name = "ExternalCaptureError";

  public constructor(
    public readonly code:
      | "invalid_input"
      | "credential_material"
      | "permission_denied"
      | "confirmation_incomplete"
      | "required_field_missing"
      | "invalid_state"
      | "evidence_required"
      | "approval_required"
      | "identity_conflict"
      | "provider_mismatch",
    message: string,
    public readonly path?: string,
  ) {
    super(message);
  }
}
