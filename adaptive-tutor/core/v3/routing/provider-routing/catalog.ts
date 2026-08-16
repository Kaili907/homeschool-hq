import { validateExact } from "../../../v2/contracts/validation.js";
import {
  evaluateProviderEligibility,
  isTrustedProviderProfileRegistry,
  type ProviderEligibilityDecision,
  type ProviderEligibilityRequirements,
  type TrustedProviderProfileRegistry,
} from "../../provider-policy/index.js";
import {
  MODEL_CAPABILITY_PROFILE_VERSION,
  ModelCapabilityProfileSchema,
  PROVIDER_CAPABILITY_PROFILE_VERSION,
  ProviderCapabilityProfileSchema,
  type ModelCapabilityProfile,
  type ProviderCapabilityProfile,
} from "./contracts.js";

export const ELIGIBLE_ROUTE_CATALOG_VERSION =
  "study-tutor-v3.eligible-route-catalog.v1" as const;

export interface EligibleRouteCatalog {
  readonly catalogVersion: typeof ELIGIBLE_ROUTE_CATALOG_VERSION;
  readonly eligibleProviderCount: number;
  readonly eligibleRouteCount: number;
}

export interface EligibleRouteCatalogInput {
  readonly providerProfiles: unknown;
  readonly modelProfiles: unknown;
  readonly providerPolicyRegistry: TrustedProviderProfileRegistry;
  readonly providerPolicyRequirements: readonly ProviderEligibilityRequirements[];
}

export interface EligibleRouteCatalogEntry {
  readonly provider: ProviderCapabilityProfile;
  readonly model: ModelCapabilityProfile;
  readonly providerPolicyDecision: ProviderEligibilityDecision & {
    readonly decision: "eligible";
    readonly providerPolicyRevisionRef: string;
    readonly providerPolicyEvidenceRef: string;
  };
}

const TRUSTED_CATALOGS = new WeakMap<EligibleRouteCatalog, readonly EligibleRouteCatalogEntry[]>();

function cloneProvider(profile: ProviderCapabilityProfile): ProviderCapabilityProfile {
  return Object.freeze({ ...profile, modelRefs: Object.freeze([...profile.modelRefs]) });
}

function cloneModel(profile: ModelCapabilityProfile): ModelCapabilityProfile {
  return Object.freeze({
    ...profile,
    actionFamilies: Object.freeze([...profile.actionFamilies]),
    subjectCapabilities: Object.freeze([...profile.subjectCapabilities]),
    learnerStages: Object.freeze([...profile.learnerStages]),
    safetyCapabilities: Object.freeze([...profile.safetyCapabilities]),
    multimodalCapabilities: Object.freeze([...profile.multimodalCapabilities]),
  });
}

function validatedProfiles<T>(
  input: unknown,
  schema: typeof ProviderCapabilityProfileSchema | typeof ModelCapabilityProfileSchema,
  expectedVersion:
    | typeof PROVIDER_CAPABILITY_PROFILE_VERSION
    | typeof MODEL_CAPABILITY_PROFILE_VERSION,
): readonly T[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 64) return null;
  const profiles: T[] = [];
  for (const candidate of input) {
    const validation = validateExact(schema, candidate);
    if (validation.status === "rejected" || validation.value.profileVersion !== expectedVersion) {
      return null;
    }
    profiles.push(validation.value as T);
  }
  return profiles;
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Evaluates W3-08 once per provider and snapshots only trusted eligible routes.
 * Plain caller-declared eligibility values never enter this boundary.
 */
export function createEligibleRouteCatalog(
  input: EligibleRouteCatalogInput,
): EligibleRouteCatalog | null {
  if (!isTrustedProviderProfileRegistry(input.providerPolicyRegistry)) return null;
  const providers = validatedProfiles<ProviderCapabilityProfile>(
    input.providerProfiles,
    ProviderCapabilityProfileSchema,
    PROVIDER_CAPABILITY_PROFILE_VERSION,
  );
  const models = validatedProfiles<ModelCapabilityProfile>(
    input.modelProfiles,
    ModelCapabilityProfileSchema,
    MODEL_CAPABILITY_PROFILE_VERSION,
  );
  if (!providers || !models) return null;
  if (
    !unique(providers.map((profile) => profile.providerRef)) ||
    !unique(models.map((profile) => profile.modelRef)) ||
    !unique(models.map((profile) => profile.routeRef)) ||
    !unique(input.providerPolicyRequirements.map((requirements) => requirements.providerRef))
  ) {
    return null;
  }

  const requirementsByProvider = new Map(
    input.providerPolicyRequirements.map((requirements) => [requirements.providerRef, requirements]),
  );
  const entries: EligibleRouteCatalogEntry[] = [];
  for (const providerInput of providers) {
    const requirements = requirementsByProvider.get(providerInput.providerRef);
    if (!requirements) continue;
    const decision = evaluateProviderEligibility(input.providerPolicyRegistry, requirements);
    if (
      decision.decision !== "eligible" ||
      decision.providerRef !== providerInput.providerRef ||
      decision.providerPolicyRevisionRef === null ||
      decision.providerPolicyEvidenceRef === null
    ) {
      continue;
    }
    const provider = cloneProvider(providerInput);
    for (const modelInput of models) {
      if (modelInput.providerRef !== provider.providerRef) continue;
      entries.push(Object.freeze({
        provider,
        model: cloneModel(modelInput),
        providerPolicyDecision: decision as EligibleRouteCatalogEntry["providerPolicyDecision"],
      }));
    }
  }

  const catalog = Object.freeze({
    catalogVersion: ELIGIBLE_ROUTE_CATALOG_VERSION,
    eligibleProviderCount: new Set(entries.map((entry) => entry.provider.providerRef)).size,
    eligibleRouteCount: entries.length,
  });
  TRUSTED_CATALOGS.set(catalog, Object.freeze(entries));
  return catalog;
}

export function readEligibleRouteCatalog(
  catalog: unknown,
): readonly EligibleRouteCatalogEntry[] | null {
  if (typeof catalog !== "object" || catalog === null) return null;
  return TRUSTED_CATALOGS.get(catalog as EligibleRouteCatalog) ?? null;
}
