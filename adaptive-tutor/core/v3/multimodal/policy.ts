import {
  MultimodalPresentationSchema,
  TrustedMultimodalPolicyContextSchema,
  type MultimodalPresentation,
  type MultimodalScopeLineage,
  type ReviewedVisualReference,
  type TrustedMultimodalPolicyContext,
} from "./contracts.js";
import { validateExactSnapshot } from "./runtime-snapshot.js";

export type MultimodalPolicyResult =
  | { readonly status: "accepted"; readonly presentation: MultimodalPresentation }
  | {
      readonly status: "rejected";
      readonly code:
        | "INVALID_MULTIMODAL_PRESENTATION"
        | "TRUSTED_MULTIMODAL_CONTEXT_REQUIRED"
        | "PRESENTATION_SCOPE_MISMATCH"
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
    && left.learnerScopeRef === right.learnerScopeRef
    && left.sessionRef === right.sessionRef
    && left.interactionRef === right.interactionRef
    && left.opportunityRef === right.opportunityRef;
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
