const SCHEMA_VERSION = 2;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_BATCH_SIZE = 50;
const DEFAULT_LEASE_SECONDS = 60;

export class AdultReviewWorkerConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdultReviewWorkerConfigurationError";
  }
}

export class AdultReviewWorkerAuthorizationError extends Error {
  constructor(message = "Adult-review worker authorization failed") {
    super(message);
    this.name = "AdultReviewWorkerAuthorizationError";
    this.statusCode = 401;
  }
}

function requireValue(value, label) {
  if (value === undefined || value === null || value === "") {
    throw new AdultReviewWorkerConfigurationError(`Missing adult-review worker ${label}`);
  }
  return value;
}

function requireMethod(port, method, label = method) {
  if (typeof port?.[method] !== "function") {
    throw new AdultReviewWorkerConfigurationError(`Missing adult-review worker ${label} port`);
  }
  return port[method].bind(port);
}

function assertDurable(port, label) {
  requireValue(port, label);
  if (port.durable !== true) {
    throw new AdultReviewWorkerConfigurationError(`${label} port is not durable`);
  }
}

function integer(value, fallback, maximum) {
  const parsed = Number(value);
  return Math.min(Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback, maximum);
}

function providerEntries(providers) {
  if (providers instanceof Map) return [...providers.entries()];
  if (typeof providers?.entries === "function") return [...providers.entries()];
  if (providers && typeof providers === "object" && typeof providers.get !== "function") {
    return Object.entries(providers);
  }
  return [];
}

function getProvider(providers, route) {
  return typeof providers?.get === "function" ? providers.get(route) : providers?.[route];
}

function isTestProvider(provider) {
  const kind = String(provider?.kind ?? provider?.name ?? "").toLowerCase();
  return provider?.testOnly === true || provider?.isTestProvider === true ||
    ["test", "fake", "mock"].includes(kind) || kind.includes("test-provider");
}

function jobId(job) {
  return job.jobId ?? job.deliveryJobId ?? job.id;
}

function attemptId(value) {
  return value?.attemptId ?? value?.id;
}

function submitted(value) {
  return Boolean(value?.submitted === true || ["submitted", "accepted"].includes(value?.status) ||
    value?.providerAttemptId);
}

function indeterminate(value) {
  return Boolean(value?.indeterminate === true || value?.status === "indeterminate" ||
    value?.outcome === "indeterminate" || value?.code === "DELIVERY_INDETERMINATE");
}

function authorized(result) {
  return result === true || result?.authorized === true || result?.authenticated === true ||
    result?.allowed === true || result?.ok === true;
}

/**
 * Executes only through explicitly injected durable ports. A provider response
 * is not considered delivered until receipts.commitVerified() succeeds.
 */
export function createAdultReviewWorker(options = {}) {
  const readiness = requireValue(options.readiness, "readiness");
  const workerAuthorization = requireValue(options.workerAuthorization, "authorization");
  const persistence = requireValue(options.persistence, "persistence");
  const resolver = requireValue(options.resolver, "resolver");
  const providers = requireValue(options.providers, "providers");
  const attempts = requireValue(options.attempts, "attempt ledger");
  const receipts = requireValue(options.receipts, "receipts");
  const monitoring = requireValue(options.monitoring, "monitoring");
  const workerId = requireValue(options.workerId ?? options.workerIdentity, "identity");
  if (Number(options.schemaVersion) !== SCHEMA_VERSION) {
    throw new AdultReviewWorkerConfigurationError(`Adult-review worker requires schema version ${SCHEMA_VERSION}`);
  }

  for (const [label, port] of [
    ["readiness", readiness], ["authorization", workerAuthorization], ["persistence", persistence],
    ["resolver", resolver], ["attempt ledger", attempts], ["receipts", receipts],
    ["monitoring", monitoring],
  ]) assertDurable(port, label);

  const entries = providerEntries(providers);
  if (entries.length === 0 && typeof providers?.get !== "function") {
    throw new AdultReviewWorkerConfigurationError("No adult-review delivery providers configured");
  }
  for (const [route, provider] of entries) {
    assertDurable(provider, `provider:${route}`);
    if (String(options.environment ?? process.env.NODE_ENV).toLowerCase() === "production" &&
        isTestProvider(provider)) {
      throw new AdultReviewWorkerConfigurationError(`Test provider for route ${route} is forbidden in production`);
    }
  }

  const evaluateReadiness = requireMethod(readiness, "evaluate", "readiness.evaluate()");
  const authorizeWorker = requireMethod(workerAuthorization, "authorize", "workerAuthorization.authorize()");
  const cancelInvalid = requireMethod(persistence, "cancelInvalid", "persistence.cancelInvalid()");
  const claim = requireMethod(persistence, "claim", "persistence.claim()");
  const renew = requireMethod(persistence, "renew", "persistence.renew()");
  const release = requireMethod(persistence, "release", "persistence.release()");
  const recordCrash = requireMethod(persistence, "recordCrash", "persistence.recordCrash()");
  const reauthorize = requireMethod(resolver, "reauthorize", "resolver.reauthorize()");
  const createAttempt = requireMethod(attempts, "create", "attempts.create()");
  const recordAttemptState = requireMethod(attempts, "recordState", "attempts.recordState()");
  const commitVerified = requireMethod(receipts, "commitVerified", "receipts.commitVerified()");
  const reconcileReceipts = requireMethod(receipts, "reconcile", "receipts.reconcile()");
  const recordMonitor = requireMethod(monitoring, "record", "monitoring.record()");
  const maxBatchSize = integer(options.maxBatchSize, DEFAULT_MAX_BATCH_SIZE, Number.MAX_SAFE_INTEGER);
  const defaultBatchSize = integer(options.batchSize, DEFAULT_BATCH_SIZE, maxBatchSize);
  const leaseSeconds = integer(options.leaseSeconds, DEFAULT_LEASE_SECONDS, Number.MAX_SAFE_INTEGER);
  const clock = options.clock ?? (() => new Date());
  const production = String(options.environment ?? process.env.NODE_ENV).toLowerCase() === "production";

  async function monitor(name, fields = {}) {
    await recordMonitor({ name, workerId, occurredAt: clock().toISOString(), ...fields });
  }

  async function ready(context = {}) {
    const result = await evaluateReadiness({
      schemaVersion: SCHEMA_VERSION,
      workerId,
      providers: entries.map(([route]) => route),
      context,
    });
    if (result === false || result?.ready === false || result?.ok === false ||
        result?.status === "not-ready" || result?.status === "blocked") {
      throw new AdultReviewWorkerConfigurationError("Adult-review operations are not ready");
    }
    return result ?? { ready: true };
  }

  async function authorize(context) {
    if (!context || !["scheduled", "manual"].includes(context.trigger)) {
      throw new AdultReviewWorkerAuthorizationError("Only scheduled or manual worker contexts are supported");
    }
    const result = await authorizeWorker({ ...context, workerId });
    if (!authorized(result)) throw new AdultReviewWorkerAuthorizationError();
    return result;
  }

  async function processJob(job, context) {
    const id = requireValue(jobId(job), "job id");
    const leaseToken = requireValue(job.leaseToken ?? job.lease?.token, "lease token");
    let finalState = "processing_incomplete";
    let attempt;
    let attemptWasSubmitted = false;
    try {
      const resolution = await reauthorize({ job, workerId, context });
      if (!authorized(resolution)) {
        await cancelInvalid({ workerId, batchSize: 1, jobId: id,
          reason: resolution?.reason ?? "recipient_not_authorized" });
        finalState = "cancelled_invalid";
        await monitor("adult_review_delivery_cancelled", { jobId: id, reason: "recipient_not_authorized" });
        return { jobId: id, status: "cancelled" };
      }

      const renewed = await renew({ workerId, jobId: id, leaseToken, leaseSeconds });
      if (renewed === false || renewed?.renewed === false || renewed?.ok === false) {
        finalState = "lease_lost";
        await monitor("adult_review_delivery_lease_lost", { jobId: id });
        return { jobId: id, status: "lease_lost" };
      }

      const route = job.route ?? job.deliveryRoute;
      const provider = getProvider(providers, route);
      if (!provider) {
        await cancelInvalid({ workerId, batchSize: 1, jobId: id, reason: "unsupported_route" });
        finalState = "cancelled_invalid";
        await monitor("adult_review_delivery_cancelled", { jobId: id, reason: "unsupported_route" });
        return { jobId: id, status: "cancelled" };
      }
      assertDurable(provider, `provider:${route}`);
      if (production && isTestProvider(provider)) {
        throw new AdultReviewWorkerConfigurationError(`Test provider for route ${route} is forbidden in production`);
      }
      const send = typeof provider.deliver === "function" ? provider.deliver.bind(provider) :
        typeof provider.send === "function" ? provider.send.bind(provider) : undefined;
      if (!send) throw new AdultReviewWorkerConfigurationError(`Provider ${route} has no deliver() method`);

      attempt = await createAttempt({ workerId, jobId: id, route, leaseToken });
      const idOfAttempt = requireValue(attemptId(attempt), "attempt id");
      const noteSubmitted = async (providerEvidence = {}) => {
        if (attemptWasSubmitted) return;
        await recordAttemptState({ attemptId: idOfAttempt, workerId, state: "submitted",
          providerEvidence, occurredAt: clock() });
        attemptWasSubmitted = true;
      };

      let result;
      try {
        result = await send({ job, recipient: resolution.recipient ?? resolution, attempt,
          workerId, context, onSubmitted: noteSubmitted, onAttemptSubmitted: noteSubmitted });
        if (submitted(result)) await noteSubmitted(result);
      } catch (error) {
        if (attemptWasSubmitted || indeterminate(error)) {
          await recordAttemptState({ attemptId: idOfAttempt, workerId, state: "indeterminate",
            reason: error instanceof Error ? error.message : String(error), occurredAt: clock() });
          await reconcileReceipts({ workerId, batchSize: 1, attemptId: idOfAttempt });
          finalState = "indeterminate";
          await monitor("adult_review_delivery_indeterminate", { jobId: id, attemptId: idOfAttempt });
          return { jobId: id, attemptId: idOfAttempt, status: "indeterminate" };
        }
        throw error;
      }

      if (indeterminate(result)) {
        await recordAttemptState({ attemptId: idOfAttempt, workerId, state: "indeterminate",
          providerEvidence: result, occurredAt: clock() });
        await reconcileReceipts({ workerId, batchSize: 1, attemptId: idOfAttempt });
        finalState = "indeterminate";
        await monitor("adult_review_delivery_indeterminate", { jobId: id, attemptId: idOfAttempt });
        return { jobId: id, attemptId: idOfAttempt, status: "indeterminate" };
      }
      if (!attemptWasSubmitted) throw new Error("Provider returned without a submitted attempt state");

      await commitVerified({ workerId, job, attempt, providerResult: result,
        receipt: result?.receipt ?? result, leaseToken });
      await recordAttemptState({ attemptId: idOfAttempt, workerId, state: "receipt_committed",
        occurredAt: clock() });
      finalState = "receipt_committed";
      await monitor("adult_review_delivery_receipt_committed", { jobId: id, attemptId: idOfAttempt });
      return { jobId: id, attemptId: idOfAttempt, status: "delivered" };
    } catch (error) {
      await recordCrash({ workerId, jobId: id, leaseToken, attemptId: attemptId(attempt),
        submitted: attemptWasSubmitted, error: error instanceof Error ? error.message : String(error) });
      await monitor("adult_review_delivery_crashed", { jobId: id, submitted: attemptWasSubmitted,
        error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      await release({ workerId, jobId: id, leaseToken, outcome: finalState });
    }
  }

  async function run(context, runOptions = {}) {
    await authorize(context);
    await ready(context);
    const batchSize = integer(runOptions.batchSize ?? context.batchSize, defaultBatchSize, maxBatchSize);
    await monitor("adult_review_worker_started", { trigger: context.trigger, batchSize });

    const reconciliation = await reconcileReceipts({ workerId, batchSize });
    const cancelled = await cancelInvalid({ workerId, batchSize });
    const jobs = (await claim({ workerId, batchSize, leaseSeconds })) ?? [];
    const boundedJobs = jobs.slice(0, batchSize);
    const results = [];
    for (const job of boundedJobs) {
      try {
        results.push(await processJob(job, context));
      } catch (error) {
        results.push({ jobId: jobId(job), status: "failed",
          error: error instanceof Error ? error.message : String(error) });
      }
    }
    const summary = {
      workerId,
      claimed: boundedJobs.length,
      cancelledInvalid: cancelled?.count ?? cancelled ?? 0,
      reconciled: reconciliation?.count ?? reconciliation ?? 0,
      delivered: results.filter((item) => item.status === "delivered").length,
      indeterminate: results.filter((item) => item.status === "indeterminate").length,
      failed: results.filter((item) => item.status === "failed").length,
      results,
    };
    await monitor("adult_review_worker_completed", summary);
    return summary;
  }

  return { ready, run, processJob };
}

export const createWorker = createAdultReviewWorker;
