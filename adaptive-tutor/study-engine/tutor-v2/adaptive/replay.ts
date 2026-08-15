export type Wave2ReplayClaim = "claimed" | "duplicate" | "collision";

export interface Wave2ReplayLedgerPort {
  claim(eventRef: string, requestFingerprint: string): Wave2ReplayClaim | Promise<Wave2ReplayClaim>;
}

/** In-memory reference implementation. Production persistence remains disabled. */
export class InMemoryWave2ReplayLedger implements Wave2ReplayLedgerPort {
  readonly #claims = new Map<string, string>();

  claim(eventRef: string, requestFingerprint: string): Wave2ReplayClaim {
    const prior = this.#claims.get(eventRef);
    if (prior === undefined) {
      this.#claims.set(eventRef, requestFingerprint);
      return "claimed";
    }
    return prior === requestFingerprint ? "duplicate" : "collision";
  }

  get size(): number {
    return this.#claims.size;
  }
}
