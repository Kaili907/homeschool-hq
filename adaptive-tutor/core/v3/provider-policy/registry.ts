import {
  MAXIMUM_APPROVED_PROVIDER_REGIONS,
  MAXIMUM_TRUSTED_PROVIDER_PROFILES,
  type TrustedProviderProfile,
} from "./contracts.js";

const TRUSTED_REGISTRIES = new WeakSet<TrustedProviderProfileRegistry>();

function freezeProfile(profile: TrustedProviderProfile): TrustedProviderProfile {
  return Object.freeze({
    ...profile,
    retention: Object.freeze({ ...profile.retention }),
    dataResidency: Object.freeze({
      approvedRegions: profile.dataResidency.approvedRegions === null
        ? null
        : Object.freeze([...profile.dataResidency.approvedRegions]),
    }),
  });
}

/**
 * Immutable host-owned policy registry. The constructor is intentionally
 * private so runtime evaluation cannot substitute a provider response for a
 * trusted profile lookup.
 */
export class TrustedProviderProfileRegistry {
  readonly #profiles: ReadonlyMap<string, TrustedProviderProfile>;

  private constructor(profiles: ReadonlyMap<string, TrustedProviderProfile>) {
    this.#profiles = profiles;
    TRUSTED_REGISTRIES.add(this);
  }

  static fromTrustedProfiles(
    profiles: readonly TrustedProviderProfile[],
  ): TrustedProviderProfileRegistry {
    if (
      !Array.isArray(profiles) ||
      profiles.length > MAXIMUM_TRUSTED_PROVIDER_PROFILES
    ) {
      throw new RangeError(
        `Trusted provider profiles allow at most ${MAXIMUM_TRUSTED_PROVIDER_PROFILES} entries.`,
      );
    }
    const byProviderRef = new Map<string, TrustedProviderProfile>();
    for (const profile of profiles) {
      if (profile.providerRef.trim().length === 0) {
        throw new Error("Trusted provider profiles require a non-empty providerRef.");
      }
      if (byProviderRef.has(profile.providerRef)) {
        throw new Error(`Duplicate trusted provider profile: ${profile.providerRef}`);
      }
      const regions = profile.dataResidency.approvedRegions;
      if (
        regions !== null &&
        (regions.length > MAXIMUM_APPROVED_PROVIDER_REGIONS ||
          new Set(regions).size !== regions.length)
      ) {
        throw new RangeError(`Trusted provider profile regions are invalid: ${profile.providerRef}`);
      }
      byProviderRef.set(profile.providerRef, freezeProfile(profile));
    }
    return new TrustedProviderProfileRegistry(byProviderRef);
  }

  lookup(providerRef: string): TrustedProviderProfile | undefined {
    return this.#profiles.get(providerRef);
  }
}

export function isTrustedProviderProfileRegistry(
  value: unknown,
): value is TrustedProviderProfileRegistry {
  return typeof value === "object" && value !== null && TRUSTED_REGISTRIES.has(
    value as TrustedProviderProfileRegistry,
  );
}

export function createTrustedProviderProfileRegistry(
  profiles: readonly TrustedProviderProfile[],
): TrustedProviderProfileRegistry {
  return TrustedProviderProfileRegistry.fromTrustedProfiles(profiles);
}
