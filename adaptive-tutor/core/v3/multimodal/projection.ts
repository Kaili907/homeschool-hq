import { Value } from "../../schema/value.js";
import {
  DurableMultimodalEvidenceSchema,
  MULTIMODAL_CONTRACT_VERSION,
  MultimodalPresentationSchema,
  type DurableMultimodalEvidence,
  type MultimodalEvidenceProjectionSource,
  type ReviewedVisualReference,
} from "./contracts.js";

export type DurableEvidenceProjectionResult =
  | { readonly status: "accepted"; readonly evidence: DurableMultimodalEvidence }
  | {
      readonly status: "rejected";
      readonly code:
        | "INVALID_MULTIMODAL_EVIDENCE_SOURCE"
        | "INVALID_DURABLE_MULTIMODAL_EVIDENCE";
      readonly issues: readonly string[];
    };

function reviewedVisualFrom(
  source: MultimodalEvidenceProjectionSource,
): ReviewedVisualReference | undefined {
  const content = source.presentation.content;
  if (content.mode === "reviewed-image" || content.mode === "reviewed-diagram") {
    return content.visual;
  }
  return undefined;
}

/**
 * Whitelist projection. It never spreads source objects, so transient bytes,
 * transcript/caption text, and learner/tutor content have no path into the
 * durable result. Runtime validation closes the boundary to extra properties.
 */
export function projectDurableMultimodalEvidence(
  source: MultimodalEvidenceProjectionSource,
): DurableEvidenceProjectionResult {
  if (!Value.Check(MultimodalPresentationSchema, source.presentation)) {
    return {
      status: "rejected",
      code: "INVALID_MULTIMODAL_EVIDENCE_SOURCE",
      issues: [...Value.Errors(MultimodalPresentationSchema, source.presentation)].map(
        (error) => `${error.path.length > 0 ? error.path : "$"}: ${error.message}`,
      ),
    };
  }

  const reviewedVisual = reviewedVisualFrom(source);
  const candidate: DurableMultimodalEvidence = {
    contractVersion: MULTIMODAL_CONTRACT_VERSION,
    envelope: "durable-multimodal-evidence",
    evidenceRef: source.evidenceRef,
    sessionRef: source.sessionRef,
    interactionRef: source.presentation.interactionRef,
    turnRef: source.presentation.turnRef,
    mode: source.presentation.content.mode,
    outcome: source.outcome,
    assistanceLevel: source.assistanceLevel,
    observedAt: source.observedAt,
    captionRef: source.presentation.caption.captionRef,
    captionAvailability: "available",
    transcriptPersisted: false,
    rawMediaPersisted: false,
    ...(reviewedVisual === undefined
      ? {}
      : {
          reviewedVisual: {
            visualRef: reviewedVisual.visualRef,
            reviewRef: reviewedVisual.reviewRef,
            contentDigest: reviewedVisual.contentDigest,
            visualKind: reviewedVisual.visualKind,
            reviewStatus: "approved",
          },
        }),
    ...(source.presentation.visualStep === undefined
      ? {}
      : {
          visualStep: {
            visualStepRef: source.presentation.visualStep.visualStepRef,
            stepIndex: source.presentation.visualStep.stepIndex,
          },
        }),
  };

  if (!Value.Check(DurableMultimodalEvidenceSchema, candidate)) {
    return {
      status: "rejected",
      code: "INVALID_DURABLE_MULTIMODAL_EVIDENCE",
      issues: [...Value.Errors(DurableMultimodalEvidenceSchema, candidate)].map(
        (error) => `${error.path.length > 0 ? error.path : "$"}: ${error.message}`,
      ),
    };
  }

  return { status: "accepted", evidence: candidate };
}
