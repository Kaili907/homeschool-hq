import {
  ExternalCaptureError,
  type AssignmentExtractionResult,
  type DocumentAssignmentIntakeInput,
  type ExternalProviderAdapter,
  type ExternalProviderDescriptor,
  type ManualAssignmentIntakeInput,
  type ProviderSyncStatus,
} from "./types.js";
import {
  createManualExtractionProposal,
  extractDocumentAssignmentProposal,
} from "./extraction.js";
import {
  assertOpaqueReference,
  normalizeVisibleText,
} from "./validation.js";

export const ROMEO_VIRTUAL_ACADEMY_PROVIDER: ExternalProviderDescriptor = {
  providerId: "romeo_virtual_academy",
  displayName: "Romeo Virtual Academy",
  connectionMode: "manual_only",
  synchronizationAvailable: false,
  provisional: true,
  privacyNotice:
    "Manual capture only. Manuel Academy does not request Romeo credentials, bypass Romeo access controls, or claim a direct synchronization connection.",
};

export const GENERIC_MANUAL_PROVIDER: ExternalProviderDescriptor = {
  providerId: "manual_external_school",
  displayName: "External school (manual)",
  connectionMode: "manual_only",
  synchronizationAvailable: false,
  provisional: false,
  privacyNotice:
    "Assignment details are entered or uploaded by the family. No provider login or direct synchronization is used.",
};

function assertDescriptor(descriptor: ExternalProviderDescriptor): void {
  assertOpaqueReference(descriptor.providerId, "provider.providerId");
  normalizeVisibleText(descriptor.displayName, "provider.displayName", 160);
  normalizeVisibleText(
    descriptor.privacyNotice,
    "provider.privacyNotice",
    1_000,
  );
  if (
    descriptor.connectionMode === "manual_only" &&
    descriptor.synchronizationAvailable
  ) {
    throw new ExternalCaptureError(
      "invalid_input",
      "A manual-only adapter cannot advertise synchronization.",
      "provider.synchronizationAvailable",
    );
  }
}

function assertProviderMatch(
  expected: ExternalProviderDescriptor,
  actual: ExternalProviderDescriptor,
): void {
  if (actual.providerId !== expected.providerId) {
    throw new ExternalCaptureError(
      "provider_mismatch",
      `Adapter ${expected.providerId} cannot process provider ${actual.providerId}.`,
      "provider.providerId",
    );
  }
}

/**
 * Factory for any manual external school. Provider identity remains explicit,
 * so assignments are never collapsed into a Romeo-specific architecture.
 */
export function createManualProviderAdapter(
  descriptor: ExternalProviderDescriptor,
): ExternalProviderAdapter {
  assertDescriptor(descriptor);
  if (
    descriptor.connectionMode !== "manual_only" ||
    descriptor.synchronizationAvailable
  ) {
    throw new ExternalCaptureError(
      "invalid_input",
      "The manual adapter factory accepts only manual-only provider descriptors.",
      "provider.connectionMode",
    );
  }
  return {
    descriptor,
    proposeManual(
      input: ManualAssignmentIntakeInput,
    ): AssignmentExtractionResult {
      assertProviderMatch(descriptor, input.provider);
      return createManualExtractionProposal(input);
    },
    proposeDocument(
      input: DocumentAssignmentIntakeInput,
    ): AssignmentExtractionResult {
      assertProviderMatch(descriptor, input.provider);
      return extractDocumentAssignmentProposal(input);
    },
  };
}

export const genericManualProviderAdapter =
  createManualProviderAdapter(GENERIC_MANUAL_PROVIDER);

/**
 * Provisional Romeo adapter: manual/upload proposal support only. It
 * intentionally has no `synchronize` or `proposeAuthorizedPayload` method.
 */
export const romeoVirtualAcademyProvisionalAdapter =
  createManualProviderAdapter(ROMEO_VIRTUAL_ACADEMY_PROVIDER);

export function providerSyncStatusForAdapter(
  adapter: ExternalProviderAdapter,
): ProviderSyncStatus {
  const actuallySupportsSync =
    adapter.descriptor.connectionMode === "authorized_adapter" &&
    adapter.descriptor.synchronizationAvailable &&
    typeof adapter.synchronize === "function";
  return actuallySupportsSync
    ? {
        mode: "not_configured",
        state: "never",
        message:
          "An authorized adapter exists, but no host-managed authorization is configured.",
      }
    : {
        mode: "manual_only",
        state: "manual",
        message:
          "Manual capture only; no direct provider synchronization is configured.",
      };
}
