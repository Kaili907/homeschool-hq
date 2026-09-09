export type Wave2ReplayClaim = "claimed" | "duplicate" | "collision";

export interface Wave2ReplayLedgerPort {
  /** Receives an opaque event identity and a SHA-256 digest; never request JSON. */
  claim(eventRef: string, requestDigest: string): Wave2ReplayClaim | Promise<Wave2ReplayClaim>;
}

/** In-memory reference implementation. Production persistence remains disabled. */
export class InMemoryWave2ReplayLedger implements Wave2ReplayLedgerPort {
  readonly #claims = new Map<string, string>();

  claim(eventRef: string, requestDigest: string): Wave2ReplayClaim {
    if (!/^sha256:[a-f0-9]{64}$/.test(requestDigest)) {
      throw new TypeError("Wave 2 replay ledger requires a SHA-256 request digest.");
    }
    const prior = this.#claims.get(eventRef);
    if (prior === undefined) {
      this.#claims.set(eventRef, requestDigest);
      return "claimed";
    }
    return prior === requestDigest ? "duplicate" : "collision";
  }

  get size(): number {
    return this.#claims.size;
  }
}
