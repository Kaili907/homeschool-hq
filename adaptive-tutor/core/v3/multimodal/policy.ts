import {
  MultimodalPresentationSchema,
  TrustedMultimodalPolicyContextSchema,
  type MultimodalPresentation,
  type MultimodalScopeLineage,
  type ReviewedVisualReference,
  type TrustedMultimodalPolicyContext,
} from "./contracts.js";
import type { CommercialExecutionScope } from "../commercial-operation/contracts.js";
import type { StudyCommercialTutorAdvisory } from "../contracts/commercial.js";
import { validateExactSnapshot } from "./runtime-snapshot.js";

export type MultimodalPolicyResult =
  | { readonly status: "accepted"; readonly presentation: MultimodalPresentation }
  | {
      readonly status: "rejected";
      readonly code:
        | "INVALID_MULTIMODAL_PRESENTATION"
        | "TRUSTED_MULTIMODAL_CONTEXT_REQUIRED"
        | "PRESENTATION_SCOPE_MISMATCH"
        | "PRESENTATION_COMMERCIAL_SCOPE_MISMATCH"
        | "STUDY_ADVISORY_SCOPE_MISMATCH"
        | "STUDY_ADVISORY_PRESENTATION_MISMATCH"
        | "UNTRUSTED_CAPTION_METADATA"
        | "ACTIVE_ASSESSMENT_ANSWER_BLOCKED"
        | "UNTRUSTED_REVIEWED_MEDIA"
        | "LEARNER_AUDIO_INPUT_NOT_AUTHORIZED";
      readonly issues: readonly string[];
    };

function sameScope(
  left: MultimodalScopeLineage,
  right: MultimodalScopeLineage,
): boolean {
  return left.householdScopeRef === right.householdScopeRef
    && left.commercialExecutionScopeRef === right.commercialExecutionScopeRef
    && left.learnerScopeRef === right.learnerScopeRef
    && left.sessionRef === right.sessionRef
    && left.interactionRef === right.interactionRef
    && left.logicalOperationRef === right.logicalOperationRef
    && left.conceptRef === right.conceptRef
    && left.opportunityRef === right.opportunityRef
    && left.presentationRef === right.presentationRef;
}

function scopeMatchesCommercialExecution(
  scope: MultimodalScopeLineage,
  commercialScope: CommercialExecutionScope,
): boolean {
  return scope.commercialExecutionScopeRef === commercialScope.scopeRef
    && scope.householdScopeRef === commercialScope.householdScopeRef
    && scope.learnerScopeRef === commercialScope.learnerScopeRef
    && scope.sessionRef === commercialScope.sessionRef
    && scope.interactionRef === commercialScope.interactionRef
    && scope.logicalOperationRef === commercialScope.logicalOperationRef
    && scope.conceptRef === commercialScope.conceptRef
    && scope.opportunityRef === commercialScope.opportunityRef
    && scope.presentationRef === commercialScope.presentationRef;
}

function advisoryMatchesCommercialExecution(
  advisory: StudyCommercialTutorAdvisory,
  commercialScope: CommercialExecutionScope,
): boolean {
  return advisory.status === "proposed"
    && advisory.presentationIntent !== null
    && advisory.commercialScopeRef === commercialScope.scopeRef
    && advisory.invocationRef === commercialScope.interactionRef
    && advisory.householdScopeRef === commercialScope.householdScopeRef
    && advisory.learnerScopeRef === commercialScope.learnerScopeRef
    && advisory.sessionRef === commercialScope.sessionRef
    && advisory.interactionRef === commercialScope.interactionRef
    && advisory.logicalOperationRef === commercialScope.logicalOperationRef
    && advisory.conceptRef === commercialScope.conceptRef
    && advisory.opportunityRef === commercialScope.opportunityRef
    && advisory.learnerStageRef === commercialScope.learnerStageRef;
}

function advisoryMatchesPresentation(
  presentation: MultimodalPresentation,
  advisory: StudyCommercialTutorAdvisory,
  commercialScope: CommercialExecutionScope,
): boolean {
  const intent = advisory.presentationIntent;
  if (
    intent === null
    || intent.fallbackPresentation?.presentationRef !== commercialScope.presentationRef
    || intent.accessibilityCaptionRef !== presentation.caption.captionRef
  ) {
    return false;
  }
  const content = presentation.content;
  if (content.mode !== "reviewed-image" && content.mode !== "reviewed-diagram") {
    return true;
  }
  const visual = intent.reviewedVisual;
  return visual !== undefined
    && visual.kind === content.visual.visualKind
    && visual.contentRef === content.visual.visualRef
    && visual.contentDigest === content.visual.contentDigest
    && visual.provenanceRef === content.visual.provenanceRef
    && advisory.reviewedContentRefs.includes(content.visual.visualRef);
}

function sameVisual(
  left: ReviewedVisualReference,
  right: ReviewedVisualReference,
): boolean {
  return left.visualRef === right.visualRef
    && left.visualKind === right.visualKind
    && left.contentDigest === right.contentDigest
    && left.mimeType === right.mimeType
    && left.reviewStatus === right.reviewStatus
    && left.reviewRef === right.reviewRef
    && left.provenanceRef === right.provenanceRef
    && left.reviewedAt === right.reviewedAt
    && left.learnerSafe === right.learnerSafe;
}

function trustedVisualMatches(
  visual: ReviewedVisualReference,
  context: TrustedMultimodalPolicyContext,
): boolean {
  return context.reviewedVisualBindings.some(
    (binding) => sameScope(binding.scope, context.scope)
      && binding.provenanceStatus === "approved-content"
      && sameVisual(binding.visual, visual),
  );
}

/**
 * Applies semantic policy only to immutable snapshots. The separately supplied
 * trusted context binds every presentation to its exact learner/session scope,
 * approved caption, reviewed-media provenance, and explicit input capability.
 */
export function enforceMultimodalPresentationPolicy(
  candidate: unknown,
  trustedContextCandidate?: unknown,
): MultimodalPolicyResult {
  const presentationValidation = validateExactSnapshot(
    MultimodalPresentationSchema,
    candidate,
  );
  if (presentationValidation.status === "rejected") {
    return {
      status: "rejected",
      code: "INVALID_MULTIMODAL_PRESENTATION",
      issues: presentationValidation.issues.map(
        (issue) => `${issue.path.length > 0 ? issue.path : "$"}: ${issue.message}`,
      ),
    };
  }

  const contextValidation = validateExactSnapshot(
    TrustedMultimodalPolicyContextSchema,
    trustedContextCandidate,
  );
  if (contextValidation.status === "rejected") {
    return {
      status: "rejected",
      code: "TRUSTED_MULTIMODAL_CONTEXT_REQUIRED",
      issues: ["A valid trusted Study multimodal policy context is required."],
    };
  }

  const presentation = presentationValidation.value;
  const context = contextValidation.value;
  if (
    !sameScope(presentation.scope, context.scope)
    || presentation.interactionRef !== context.scope.interactionRef
    || !sameScope(context.captionBinding.scope, context.scope)
  ) {
    return {
      status: "rejected",
      code: "PRESENTATION_SCOPE_MISMATCH",
      issues: ["Presentation lineage does not match the trusted Study scope."],
    };
  }
  if (!scopeMatchesCommercialExecution(context.scope, context.commercialExecutionScope)) {
    return {
      status: "rejected",
      code: "PRESENTATION_COMMERCIAL_SCOPE_MISMATCH",
      issues: ["Presentation lineage does not match the canonical commercial execution scope."],
    };
  }
  if (!advisoryMatchesCommercialExecution(context.studyAdvisory, context.commercialExecutionScope)) {
    return {
      status: "rejected",
      code: "STUDY_ADVISORY_SCOPE_MISMATCH",
      issues: ["Study advisory lineage does not match the canonical commercial execution scope."],
    };
  }
  const caption = presentation.caption;
  const captionBinding = context.captionBinding;
  if (
    caption.captionRef !== captionBinding.captionRef
    || caption.text !== captionBinding.text
    || caption.locale !== captionBinding.locale
    || (
      presentation.content.mode === "caption"
      && presentation.content.captionRef !== caption.captionRef
    )
  ) {
    return {
      status: "rejected",
      code: presentation.assessmentDisclosure.phase === "active-assessment"
        ? "ACTIVE_ASSESSMENT_ANSWER_BLOCKED"
        : "UNTRUSTED_CAPTION_METADATA",
      issues: [
        "Caption metadata does not exactly match the trusted neutral accessibility binding.",
      ],
    };
  }

  const content = presentation.content;
  if (
    (content.mode === "reviewed-image" || content.mode === "reviewed-diagram")
    && !trustedVisualMatches(content.visual, context)
  ) {
    return {
      status: "rejected",
      code: "UNTRUSTED_REVIEWED_MEDIA",
      issues: [
        "Reviewed media does not match the exact trusted scope, digest, kind, and provenance.",
      ],
    };
  }

  if (!advisoryMatchesPresentation(
    presentation,
    context.studyAdvisory,
    context.commercialExecutionScope,
  )) {
    return {
      status: "rejected",
      code: presentation.assessmentDisclosure.phase === "active-assessment"
        ? "ACTIVE_ASSESSMENT_ANSWER_BLOCKED"
        : "STUDY_ADVISORY_PRESENTATION_MISMATCH",
      issues: ["Presentation content or caption metadata is not authorized by the Study advisory."],
    };
  }

  if (presentation.speaker === "learner" && content.mode === "speech") {
    const capability = context.learnerAudioInputCapability;
    if (
      capability === undefined
      || !sameScope(capability.scope, context.scope)
      || capability.mediaRef !== content.audio.mediaRef
    ) {
      return {
        status: "rejected",
        code: "LEARNER_AUDIO_INPUT_NOT_AUTHORIZED",
        issues: [
          "Learner raw audio input requires a trusted capability for this exact scope and media reference.",
        ],
      };
    }
  }

  return { status: "accepted", presentation };
}
