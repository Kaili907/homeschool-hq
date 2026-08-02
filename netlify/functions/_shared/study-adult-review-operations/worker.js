const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_BATCH_SIZE = 50;
const DEFAULT_LEASE_MS = 60_000;

export class AdultReviewWorkerConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdultReviewWorkerConfigurationError";
  }
}

export class AdultReviewWorkerAuthorizationError extends Error {
  constructor(message = "An authenticated adult-review worker context is required") {
    super(message);
    this.name = "AdultReviewWorkerAuthorizationError";
    this.statusCode = 401;
  }
}

function required(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new AdultReviewWorkerConfigurationError(`Missing adult-review worker ${name}`);
  }
  return value;
}

function method(port, name, aliases = []) {
  required(port, `${name} port`);
  for (const candidate of [name, ...aliases]) {
    if (typeof port[candidate] === "function") return port[candidate].bind(port);
  }
  throw new AdultReviewWorkerConfigurationError(
    `Adult-review worker port is missing ${name}()`,
  );
}

function optionalMethod(port, names) {
  for (const name of names) {
    if (typeof port?.[name] === "function") return port[name].bind(port);
  }
  return undefined;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function safeReference(value, fallback) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(value)
    ? value
    : fallback;
}

function minimizedAttempt(value) {
  return Object.freeze({
    attemptId: safeReference(value?.attemptId ?? value?.providerAttemptId, "attempt:unavailable"),
  });
}

function minimizedVerifiedReceipt(value) {
  if (value?.verified !== true) {
    throw new Error("verified_receipt_required");
  }
  const deliveredAt = typeof value.deliveredAt === "string" && Number.isFinite(Date.parse(value.deliveredAt))
    ? value.deliveredAt
    : null;
  return Object.freeze({
    verified: true,
    attemptId: safeReference(value.attemptId, "attempt:unavailable"),
    providerReceiptRef: safeReference(value.providerReceiptRef, "receipt:unavailable"),
    evidenceRef: safeReference(value.evidenceRef, "evidence:unavailable"),
    deliveredAt,
  });
}

function isProduction(environment) {
  return String(environment || "").toLowerCase() === "production";
}

function isTestProvider(provider) {
  const kind = String(provider.kind || provider.name || "").toLowerCase();
  return (
    provider.testOnly === true ||
    provider.isTestProvider === true ||
    kind === "test" ||
    kind === "fake" ||
    kind === "mock" ||
    kind.includes("test-provider")
  );
}

function assertAuthenticatedContext(context, workerIdentity) {
  if (!context || context.authenticated !== true) {
    throw new AdultReviewWorkerAuthorizationError();
  }
  if (context.trigger !== "scheduled" && context.trigger !== "manual") {
    throw new AdultReviewWorkerAuthorizationError(
      "Adult-review workers may only run in authenticated scheduled or manual contexts",
    );
  }
  if (context.workerIdentity && context.workerIdentity !== workerIdentity) {
    throw new AdultReviewWorkerAuthorizationError("Worker identity does not match the authenticated context");
  }
}

function claimIdOf(claim) {
  return claim.claimId ?? claim.id ?? claim.deliveryId;
}

function deliveryIdOf(claim) {
  return claim.deliveryId ?? claim.id ?? claim.claimId;
}

function validationResult(schema, claim) {
  const parse = optionalMethod(schema, ["safeParse", "validate"]);
  if (parse) {
    const result = parse(claim);
    if (result?.success === false || result?.valid === false) {
      return { valid: false, reason: result.error ?? result.errors ?? "schema_validation_failed" };
    }
    if (result?.success === true) return { valid: true, value: result.data };
    if (result?.valid === true) return { valid: true, value: result.value ?? claim };
    if (result === false) return { valid: false, reason: "schema_validation_failed" };
    if (result === true) return { valid: true, value: claim };
  }

  const parseOrThrow = optionalMethod(schema, ["parse"]);
  if (!parseOrThrow) {
    throw new AdultReviewWorkerConfigurationError("Adult-review worker schema is missing parse()/safeParse()");
  }
  try {
    return { valid: true, value: parseOrThrow(claim) };
  } catch (error) {
    return { valid: false, reason: error };
  }
}

function resolvedRecipient(result) {
  if (!result || result.valid === false || result.status === "invalid" || result.status === "not_found") {
    return undefined;
  }
  return result.recipient ?? result.value ?? result;
}

function indeterminate(errorOrResult) {
  return Boolean(
    errorOrResult?.indeterminate === true ||
      errorOrResult?.status === "indeterminate" ||
      errorOrResult?.outcome === "indeterminate" ||
      errorOrResult?.code === "DELIVERY_INDETERMINATE",
  );
}

function submitted(result) {
  return Boolean(
    result?.submitted === true ||
      result?.status === "submitted" ||
      result?.status === "accepted" ||
      result?.attemptId ||
      result?.providerAttemptId,
  );
}

/**
 * Creates a fail-closed worker. All state transitions are delegated to injected
 * durable ports; the worker never treats an in-memory provider response as a
 * committed delivery.
 */
export function createAdultReviewWorker(options = {}) {
  const persistence = required(options.persistence, "persistence");
  const resolver = required(options.resolver, "resolver");
  const provider = required(options.provider, "provider");
  const monitor = required(options.monitor, "monitor");
  const schema = required(options.schema, "schema");
  const workerIdentity = required(options.workerIdentity, "identity");
  const environment = options.environment ?? process.env.NODE_ENV;

  if (isProduction(environment) && isTestProvider(provider)) {
    throw new AdultReviewWorkerConfigurationError("Test delivery providers are forbidden in production");
  }

  const readinessPorts = [
    ["persistence", persistence],
    ["resolver", resolver],
    ["provider", provider],
    ["monitor", monitor],
    ["schema", schema],
  ];
  const claim = method(persistence, "claim", ["claimDue", "claimDeliveries"]);
  const cancel = method(persistence, "cancel", ["cancelClaim", "cancelDelivery"]);
  const renewLease = method(persistence, "renewLease", ["renew"]);
  const releaseLease = method(persistence, "releaseLease", ["release"]);
  const recordAttemptSubmitted = method(persistence, "recordAttemptSubmitted", ["markAttemptSubmitted"]);
  const commitReceipt = method(persistence, "commitReceipt", ["recordReceipt"]);
  const markIndeterminate = method(persistence, "markIndeterminate", ["recordIndeterminate"]);
  const resolve = method(resolver, "resolve", ["resolveRecipient"]);
  const deliver = method(provider, "deliver", ["send"]);
  const recordMonitor = method(monitor, "record", ["emit", "capture"]);
  const claimIndeterminate = optionalMethod(persistence, ["claimIndeterminate", "claimForReconciliation"]);
  const reconcileProvider = optionalMethod(provider, ["reconcile", "lookupAttempt"]);
  const resolveIndeterminate = optionalMethod(persistence, ["resolveIndeterminate", "commitReconciliation"]);
  const now = options.now ?? (() => new Date());
  const maxBatchSize = positiveInteger(options.maxBatchSize, DEFAULT_MAX_BATCH_SIZE);
  const defaultBatchSize = Math.min(
    positiveInteger(options.batchSize, DEFAULT_BATCH_SIZE),
    maxBatchSize,
  );
  const leaseMs = positiveInteger(options.leaseMs, DEFAULT_LEASE_MS);

  async function monitorEvent(name) {
    await recordMonitor(name, {
      occurredAt: now().toISOString(),
      occurrences: 1,
      value: 1,
    });
  }

  async function ready() {
    for (const [name, port] of readinessPorts) {
      const check = optionalMethod(port, ["ready", "readiness", "isReady"]);
      if (!check) {
        throw new AdultReviewWorkerConfigurationError(`${name} port is missing readiness()`);
      }
      const result = await check({ workerIdentity });
      if (result === false || result?.ready === false || result?.ok === false) {
        throw new AdultReviewWorkerConfigurationError(`${name} port is not ready`);
      }
    }
    return { ready: true, workerIdentity };
  }

  async function reconcile(context, limit) {
    if (!claimIndeterminate && !reconcileProvider && !resolveIndeterminate) return 0;
    if (!claimIndeterminate || !reconcileProvider || !resolveIndeterminate) {
      throw new AdultReviewWorkerConfigurationError(
        "Indeterminate reconciliation requires persistence claim/resolve and provider reconcile ports",
      );
    }

    const records = (await claimIndeterminate({
      workerIdentity,
      limit,
      leaseMs,
      now: now(),
      context,
    })) ?? [];
    let completed = 0;
    for (const record of records.slice(0, limit)) {
      const claimId = claimIdOf(record);
      try {
        const result = await reconcileProvider({ record, workerIdentity, context });
        await resolveIndeterminate({ claimId, record, result, workerIdentity, now: now() });
        completed += 1;
      } catch {
        await releaseLease({ claimId, workerIdentity, reason: "reconciliation_failed", now: now() });
        await monitorEvent("study.adult_review.indeterminate_job");
      }
    }
    return completed;
  }

  async function processClaim(rawClaim, context) {
    const claimId = required(claimIdOf(rawClaim), "claim id");
    const deliveryId = deliveryIdOf(rawClaim);
    let terminal = false;
    let wasSubmitted = false;

    try {
      const validation = validationResult(schema, rawClaim);
      if (!validation.valid) {
        await cancel({
          claimId,
          workerIdentity,
          reason: "invalid_delivery",
          now: now(),
        });
        terminal = true;
        await monitorEvent("study.adult_review.delivery_permanent_failure");
        return { deliveryId, status: "cancelled", reason: "invalid_delivery" };
      }

      const delivery = validation.value;
      const resolution = await resolve({ delivery, workerIdentity, context });
      const recipient = resolvedRecipient(resolution);
      if (!recipient) {
        await cancel({
          claimId,
          workerIdentity,
          reason: "invalid_recipient",
          now: now(),
        });
        terminal = true;
        await monitorEvent("study.adult_review.recipient_resolution_failure");
        return { deliveryId, status: "cancelled", reason: "invalid_recipient" };
      }

      const renewed = await renewLease({ claimId, workerIdentity, leaseMs, now: now() });
      if (renewed === false || renewed?.renewed === false || renewed?.ok === false) {
        await monitorEvent("study.adult_review.lease_expiration");
        return { deliveryId, status: "lease_lost" };
      }

      const noteSubmitted = async (attempt = {}) => {
        if (wasSubmitted) return;
        await recordAttemptSubmitted({
          claimId,
          deliveryId,
          attempt: minimizedAttempt(attempt),
          workerIdentity,
          submittedAt: now(),
        });
        wasSubmitted = true;
      };

      let result;
      try {
        result = await deliver({
          delivery,
          recipient,
          workerIdentity,
          context,
          onAttemptSubmitted: noteSubmitted,
        });
        if (submitted(result)) await noteSubmitted(result);
      } catch (error) {
        if (indeterminate(error) || wasSubmitted) {
          await markIndeterminate({
            claimId,
            deliveryId,
            workerIdentity,
            attempt: minimizedAttempt(error?.attempt),
            reason: "provider-outcome-indeterminate",
            now: now(),
          });
          terminal = true;
          await monitorEvent("study.adult_review.indeterminate_job");
          return { deliveryId, status: "indeterminate" };
        }
        throw error;
      }

      if (indeterminate(result)) {
        await markIndeterminate({
          claimId,
          deliveryId,
          workerIdentity,
          attempt: minimizedAttempt(result),
          reason: "provider-outcome-indeterminate",
          now: now(),
        });
        terminal = true;
        await monitorEvent("study.adult_review.indeterminate_job");
        return { deliveryId, status: "indeterminate" };
      }

      if (!wasSubmitted) {
        throw new Error("Delivery provider returned without confirming attempt submission");
      }

      await commitReceipt({
        claimId,
        deliveryId,
        workerIdentity,
        receipt: minimizedVerifiedReceipt(result.receipt ?? result),
        committedAt: now(),
      });
      terminal = true;
      return { deliveryId, status: "delivered" };
    } catch (error) {
      await monitorEvent("study.adult_review.delivery_permanent_failure");
      throw error;
    } finally {
      if (!terminal) {
        await releaseLease({
          claimId,
          workerIdentity,
          reason: wasSubmitted ? "submitted_without_receipt" : "processing_incomplete",
          now: now(),
        });
      }
    }
  }

  async function run(context, runOptions = {}) {
    assertAuthenticatedContext(context, workerIdentity);
    await ready();
    const limit = Math.min(
      positiveInteger(runOptions.limit ?? context.limit, defaultBatchSize),
      maxBatchSize,
    );
    const reconciled = await reconcile(context, limit);
    const claims = (await claim({
      workerIdentity,
      limit,
      leaseMs,
      now: now(),
      context,
    })) ?? [];
    const boundedClaims = claims.slice(0, limit);
    const results = [];
    for (const claimed of boundedClaims) {
      try {
        results.push(await processClaim(claimed, context));
      } catch {
        results.push({
          deliveryId: deliveryIdOf(claimed),
          status: "failed",
        });
      }
    }

    const summary = {
      workerIdentity,
      claimed: boundedClaims.length,
      reconciled,
      delivered: results.filter((result) => result.status === "delivered").length,
      cancelled: results.filter((result) => result.status === "cancelled").length,
      indeterminate: results.filter((result) => result.status === "indeterminate").length,
      failed: results.filter((result) => result.status === "failed").length,
      results,
    };
    return summary;
  }

  return { ready, run, processClaim };
}

export const createWorker = createAdultReviewWorker;
