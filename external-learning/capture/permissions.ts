import {
  ExternalCaptureError,
  type ExternalCaptureAction,
  type ExternalCaptureActor,
} from "./types.js";
import { assertOpaqueReference } from "./validation.js";

export interface PermissionDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export function externalCapturePermission(
  actor: ExternalCaptureActor,
  action: ExternalCaptureAction,
  learnerRef: string,
): PermissionDecision {
  assertOpaqueReference(actor.actorRef, "actor.actorRef");
  assertOpaqueReference(learnerRef, "learnerRef");

  const learnerAllowed =
    actor.role === "system" || actor.learnerRefs.includes(learnerRef);
  if (!learnerAllowed) {
    return {
      allowed: false,
      reason: "The actor is not authorized for this learner reference.",
    };
  }

  switch (action) {
    case "create_intake":
    case "confirm_extraction":
      return actor.role === "parent" || actor.role === "student"
        ? { allowed: true, reason: "Parent/student capture is allowed." }
        : {
            allowed: false,
            reason: "Provider/system actors cannot confirm user-entered fields.",
          };
    case "schedule_assignment":
      return actor.role === "parent"
        ? { allowed: true, reason: "A parent may schedule confirmed work." }
        : {
            allowed: false,
            reason: "Only a parent may place confirmed external work on the schedule.",
          };
    case "submit_evidence":
      return actor.role === "parent" || actor.role === "student"
        ? { allowed: true, reason: "A parent or student may submit evidence." }
        : {
            allowed: false,
            reason: "Only a parent or student may submit completion evidence.",
          };
    case "review_evidence":
      return actor.role === "parent" && actor.canApproveEvidence === true
        ? { allowed: true, reason: "A parent may review evidence." }
        : {
            allowed: false,
            reason: "Parent evidence-review permission is required.",
          };
    case "mark_complete":
      return actor.role === "parent" || actor.role === "system"
        ? {
            allowed: true,
            reason: "A parent or authorized host transition may mark completion.",
          }
        : {
            allowed: false,
            reason: "Students and provider adapters cannot mark external work complete.",
          };
    case "apply_provider_update":
      return actor.role === "provider_adapter" || actor.role === "system"
        ? {
            allowed: true,
            reason: "An adapter/system may propose, but not confirm, provider updates.",
          }
        : {
            allowed: false,
            reason: "Provider updates must arrive through an authorized adapter boundary.",
          };
    case "configure_provider":
      return actor.role === "parent" && actor.canConfigureProviders === true
        ? {
            allowed: true,
            reason: "Provider configuration permission is present.",
          }
        : {
            allowed: false,
            reason: "Explicit parent provider-configuration permission is required.",
          };
  }
}

export function assertExternalCapturePermission(
  actor: ExternalCaptureActor,
  action: ExternalCaptureAction,
  learnerRef: string,
): void {
  const decision = externalCapturePermission(actor, action, learnerRef);
  if (!decision.allowed) {
    throw new ExternalCaptureError(
      "permission_denied",
      decision.reason,
      `permission.${action}`,
    );
  }
}
