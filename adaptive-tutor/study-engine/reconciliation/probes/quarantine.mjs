import { createHash } from "node:crypto";

export const CURRENT_SCHEMA_VERSION = 1;
export const STUDY_COMMAND_VERSION = "manuel-academy.study-command.v1";

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function canonicalBytes(value) {
  return JSON.stringify(canonicalize(value));
}

export function payloadSha256(value) {
  return createHash("sha256").update(canonicalBytes(value)).digest("hex").toUpperCase();
}

export function versionDisposition(value, knownKinds = new Set()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "invalid-current-payload";
  }
  if (!Object.hasOwn(value, "schemaVersion")) return "missing-version";
  if (!Number.isInteger(value.schemaVersion)) return "invalid-version";
  if (value.schemaVersion < CURRENT_SCHEMA_VERSION) return "unsupported-older-version";
  if (value.schemaVersion > CURRENT_SCHEMA_VERSION) return "unsupported-future-version";
  if (knownKinds.size > 0 && !knownKinds.has(value.kind)) return "unknown-kind";
  return "accepted-current-version";
}

export function makeQuarantineRecord(payload, disposition, receivedAt) {
  return {
    schemaVersion: 1,
    quarantineId: `quarantine:${payloadSha256(payload).slice(0, 24)}`,
    schemaIdOrKind:
      payload && typeof payload === "object" && typeof payload.kind === "string"
        ? payload.kind
        : "unknown",
    observedVersion:
      payload && typeof payload === "object" && Object.hasOwn(payload, "schemaVersion")
        ? payload.schemaVersion
        : null,
    disposition,
    receivedAt,
    payloadSha256: payloadSha256(payload)
  };
}

/**
 * Reconciliation-only append model. It proves replay/conflict/sequence behavior
 * without changing a Wave 1 package.
 */
export function appendCommand(state, command) {
  if (command.commandVersion !== STUDY_COMMAND_VERSION) {
    return {
      disposition: "quarantined",
      reasonCode: "command.unsupported-version",
      state
    };
  }
  if (state.appliedCommands[command.idempotencyKey]) {
    const prior = state.appliedCommands[command.idempotencyKey];
    if (prior.payloadHash === payloadSha256(command)) {
      return {
        disposition: "replayed-no-op",
        reasonCode: "command.replayed",
        state
      };
    }
    return {
      disposition: "quarantined",
      reasonCode: "idempotency-conflict",
      state
    };
  }
  if (command.expectedRevision !== state.revision) {
    return {
      disposition: "rejected",
      reasonCode: "aggregate.stale-revision",
      state
    };
  }

  const events = command.events ?? [];
  let expectedSequence = state.events.length + 1;
  const existingIds = new Set(state.events.map((event) => event.id));
  for (const event of events) {
    if (event.sessionId !== state.sessionId) {
      return {
        disposition: "quarantined",
        reasonCode: "event.wrong-session",
        state
      };
    }
    if (existingIds.has(event.id)) {
      return {
        disposition: "quarantined",
        reasonCode: "event.duplicate-id",
        state
      };
    }
    if (event.sequence !== expectedSequence) {
      return {
        disposition: "quarantined",
        reasonCode: "event.noncontiguous-sequence",
        state
      };
    }
    existingIds.add(event.id);
    expectedSequence += 1;
  }

  const next = {
    ...state,
    revision: state.revision + 1,
    events: [...state.events, ...events],
    appliedCommands: {
      ...state.appliedCommands,
      [command.idempotencyKey]: {
        payloadHash: payloadSha256(command),
        resultingRevision: state.revision + 1
      }
    }
  };
  return {
    disposition: "appended",
    reasonCode: "command.applied",
    state: next
  };
}
