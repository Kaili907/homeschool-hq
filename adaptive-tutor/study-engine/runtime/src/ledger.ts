import type { PersistenceSidecarPort } from "../../bridges/tutor-core/src/index.ts";

export type LedgerAppendResult =
  | { readonly status: "appended" }
  | { readonly status: "duplicate-ignored" }
  | { readonly status: "idempotency-collision" };

/**
 * Deterministic in-memory release-candidate ledger.
 *
 * Production integration must replace this with an atomic durable uniqueness
 * constraint on (sessionId, eventId). The public health endpoint reports that
 * limitation and this class never claims production persistence.
 */
export class InMemoryAcceptedEventLedger {
  readonly #accepted = new Map<string, string>();

  async appendAcceptedEvent(
    sessionId: string,
    eventId: string,
    _eventVersion: number,
    idempotencyKey: string,
  ): Promise<LedgerAppendResult> {
    const key = `${sessionId}:${eventId}`;
    const previous = this.#accepted.get(key);
    if (previous === idempotencyKey) {
      return { status: "duplicate-ignored" };
    }
    if (previous !== undefined) {
      return { status: "idempotency-collision" };
    }
    this.#accepted.set(key, idempotencyKey);
    return { status: "appended" };
  }

  get size(): number {
    return this.#accepted.size;
  }
}

export type AcceptedEventLedgerPort = Pick<
  PersistenceSidecarPort,
  "appendAcceptedEvent"
>;
