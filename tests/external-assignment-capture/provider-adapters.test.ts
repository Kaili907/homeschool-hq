import { describe, expect, it } from "vitest";
import {
  GENERIC_MANUAL_PROVIDER,
  ROMEO_VIRTUAL_ACADEMY_PROVIDER,
  createManualProviderAdapter,
  genericManualProviderAdapter,
  providerSyncStatusForAdapter,
  romeoVirtualAcademyProvisionalAdapter,
} from "../../external-learning/capture/adapters.js";
import {
  type ExternalProviderAdapter,
  type ExternalProviderDescriptor,
} from "../../external-learning/capture/types.js";
import {
  createManualExtractionProposal,
  extractDocumentAssignmentProposal,
} from "../../external-learning/capture/extraction.js";
import { makeDocumentIntake, makeManualIntake } from "./fixtures.js";

describe("provider-neutral adapter contracts", () => {
  it("represents Romeo as provisional manual capture, not direct synchronization", () => {
    expect(ROMEO_VIRTUAL_ACADEMY_PROVIDER).toMatchObject({
      providerId: "romeo_virtual_academy",
      displayName: "Romeo Virtual Academy",
      connectionMode: "manual_only",
      synchronizationAvailable: false,
      provisional: true,
    });
    expect(ROMEO_VIRTUAL_ACADEMY_PROVIDER.privacyNotice).toMatch(
      /manual capture only/i,
    );
    expect(ROMEO_VIRTUAL_ACADEMY_PROVIDER.privacyNotice).toMatch(
      /does not request Romeo credentials/i,
    );
    expect(ROMEO_VIRTUAL_ACADEMY_PROVIDER.privacyNotice).toMatch(
      /does not.+claim a direct synchronization/i,
    );
  });

  it("does not expose sync or authorized-payload methods on the Romeo adapter", () => {
    expect(romeoVirtualAcademyProvisionalAdapter.synchronize).toBeUndefined();
    expect(
      romeoVirtualAcademyProvisionalAdapter.proposeAuthorizedPayload,
    ).toBeUndefined();
    expect(Object.keys(romeoVirtualAcademyProvisionalAdapter).sort()).toEqual([
      "descriptor",
      "proposeDocument",
      "proposeManual",
    ]);
    expect(
      providerSyncStatusForAdapter(
        romeoVirtualAcademyProvisionalAdapter,
      ),
    ).toMatchObject({
      mode: "manual_only",
      state: "manual",
      message: expect.stringContaining("no direct provider synchronization"),
    });
  });

  it("keeps the generic manual provider distinct from Romeo", () => {
    expect(GENERIC_MANUAL_PROVIDER.providerId).not.toBe(
      ROMEO_VIRTUAL_ACADEMY_PROVIDER.providerId,
    );
    expect(genericManualProviderAdapter.descriptor).toBe(
      GENERIC_MANUAL_PROVIDER,
    );
  });

  it("can create a manual adapter for any valid external school descriptor", () => {
    const provider: ExternalProviderDescriptor = {
      providerId: "district_learning_portal",
      displayName: "District Learning Portal",
      connectionMode: "manual_only",
      synchronizationAvailable: false,
      provisional: false,
      privacyNotice:
        "Family-provided assignment data only; no login or direct synchronization.",
    };
    const adapter = createManualProviderAdapter(provider);
    const proposal = adapter.proposeManual(
      makeManualIntake({
        provider,
        captureId: "capture-district-001",
      }),
    );

    expect(proposal.provider).toBe(provider);
    expect(proposal.sourceKind).toBe("manual");
    expect(proposal.requiresFieldByFieldConfirmation).toBe(true);
  });

  it("rejects payloads for a different provider", () => {
    expect(() =>
      romeoVirtualAcademyProvisionalAdapter.proposeManual(
        makeManualIntake({
          provider: GENERIC_MANUAL_PROVIDER,
        }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "provider_mismatch",
        path: "provider.providerId",
      }),
    );
  });

  it("rejects contradictory manual-only synchronization claims", () => {
    expect(() =>
      createManualProviderAdapter({
        ...GENERIC_MANUAL_PROVIDER,
        synchronizationAvailable: true,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        path: "provider.synchronizationAvailable",
      }),
    );
  });

  it("rejects an authorized descriptor passed to the manual adapter factory", () => {
    expect(() =>
      createManualProviderAdapter({
        ...GENERIC_MANUAL_PROVIDER,
        connectionMode: "authorized_adapter",
        synchronizationAvailable: true,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        path: "provider.connectionMode",
      }),
    );
  });

  it("advertises future authorized synchronization only when capability and method both exist", async () => {
    const descriptor: ExternalProviderDescriptor = {
      providerId: "authorized_future_provider",
      displayName: "Authorized Future Provider",
      connectionMode: "authorized_adapter",
      synchronizationAvailable: true,
      provisional: false,
      privacyNotice:
        "Uses a separately authorized host integration and never student passwords.",
    };
    const adapter: ExternalProviderAdapter = {
      descriptor,
      proposeManual: (input) => createManualExtractionProposal(input),
      proposeDocument: (input) => extractDocumentAssignmentProposal(input),
      synchronize: async (context) => ({
        status: "current",
        checkedAt: context.requestedAt,
      }),
    };

    expect(providerSyncStatusForAdapter(adapter)).toMatchObject({
      mode: "not_configured",
      state: "never",
      message: expect.stringContaining("host-managed authorization"),
    });
    await expect(
      adapter.synchronize?.({
        authorizationRef: "host-authorization-001",
        requestedAt: "2026-07-29T09:00:00-04:00",
        learnerRef: "learner-romeo-001",
      }),
    ).resolves.toEqual({
      status: "current",
      checkedAt: "2026-07-29T09:00:00-04:00",
    });
  });

  it("does not trust a synchronization descriptor without an actual method", () => {
    const adapter: ExternalProviderAdapter = {
      descriptor: {
        providerId: "misconfigured_provider",
        displayName: "Misconfigured Provider",
        connectionMode: "authorized_adapter",
        synchronizationAvailable: true,
        provisional: true,
        privacyNotice: "No active connection is configured.",
      },
      proposeManual: (input) => createManualExtractionProposal(input),
      proposeDocument: (input) => extractDocumentAssignmentProposal(input),
    };

    expect(providerSyncStatusForAdapter(adapter)).toMatchObject({
      mode: "manual_only",
      state: "manual",
    });
  });

  it("supports document extraction through both provisional manual adapters", () => {
    const romeo = romeoVirtualAcademyProvisionalAdapter.proposeDocument(
      makeDocumentIntake(),
    );
    const generic = genericManualProviderAdapter.proposeDocument(
      makeDocumentIntake({
        captureId: "capture-generic-document",
        provider: GENERIC_MANUAL_PROVIDER,
      }),
    );

    expect(romeo.provider.providerId).toBe("romeo_virtual_academy");
    expect(generic.provider.providerId).toBe("manual_external_school");
  });
});
