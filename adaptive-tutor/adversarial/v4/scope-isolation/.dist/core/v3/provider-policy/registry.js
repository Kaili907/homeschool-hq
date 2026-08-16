const TRUSTED_REGISTRIES = new WeakSet();
function freezeProfile(profile) {
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
    #profiles;
    constructor(profiles) {
        this.#profiles = profiles;
        TRUSTED_REGISTRIES.add(this);
    }
    static fromTrustedProfiles(profiles) {
        const byProviderRef = new Map();
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
    lookup(providerRef) {
        return this.#profiles.get(providerRef);
    }
}
export function isTrustedProviderProfileRegistry(value) {
    return typeof value === "object" && value !== null && TRUSTED_REGISTRIES.has(value);
}
export function createTrustedProviderProfileRegistry(profiles) {
    return TrustedProviderProfileRegistry.fromTrustedProfiles(profiles);
}
