import type { TrustedProviderProfile } from "./contracts.js";

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
  }

  static fromTrustedProfiles(
    profiles: readonly TrustedProviderProfile[],
  ): TrustedProviderProfileRegistry {
    const byProviderRef = new Map<string, TrustedProviderProfile>();
    for (const profile of profiles) {
      if (profile.providerRef.trim().length === 0) {
        throw new Error("Trusted provider profiles require a non-empty providerRef.");
      }
      if (byProviderRef.has(profile.providerRef)) {
        throw new Error(`Duplicate trusted provider profile: ${profile.providerRef}`);
      }
      byProviderRef.set(profile.providerRef, freezeProfile(profile));
    }
    return new TrustedProviderProfileRegistry(byProviderRef);
  }

  lookup(providerRef: string): TrustedProviderProfile | undefined {
    return this.#profiles.get(providerRef);
  }
}

export function createTrustedProviderProfileRegistry(
  profiles: readonly TrustedProviderProfile[],
): TrustedProviderProfileRegistry {
  return TrustedProviderProfileRegistry.fromTrustedProfiles(profiles);
}
