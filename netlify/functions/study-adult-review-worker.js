import {
  AdultReviewWorkerAuthorizationError,
  AdultReviewWorkerConfigurationError,
  createAdultReviewWorker,
} from "./_shared/study-adult-review-operations/worker.js";

const response = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

function isScheduled(event) {
  const headers = event?.headers ?? {};
  const marker = headers["x-nf-event"] ?? headers["X-Nf-Event"];
  return event?.trigger === "scheduled" || event?.scheduled === true || marker === "schedule";
}

export function createAdultReviewWorkerHandler(options = {}) {
  if (typeof options.authenticate !== "function") {
    throw new AdultReviewWorkerConfigurationError("Missing adult-review worker authenticator");
  }
  const worker = options.worker ?? createAdultReviewWorker(options);

  return async (event = {}, netlifyContext = {}) => {
    if ((event.httpMethod ?? "POST").toUpperCase() !== "POST") {
      return response(405, { error: "method_not_allowed" });
    }
    try {
      const trigger = isScheduled(event) ? "scheduled" : "manual";
      const principal = await options.authenticate({ event, netlifyContext, trigger });
      if (principal?.authenticated !== true) throw new AdultReviewWorkerAuthorizationError();
      const result = await worker.run({
        authenticated: true,
        trigger,
        principal,
        workerIdentity: principal.workerIdentity ?? options.workerIdentity,
        requestId: netlifyContext.requestId,
      });
      return response(200, { ok: true, ...result });
    } catch (error) {
      if (error instanceof AdultReviewWorkerAuthorizationError) {
        return response(401, { error: "unauthorized" });
      }
      if (error instanceof AdultReviewWorkerConfigurationError) {
        return response(503, { error: "worker_not_ready" });
      }
      options.onError?.(error);
      return response(500, { error: "worker_failed" });
    }
  };
}

let installedHandler;

export function installStudyAdultReviewWorker(options) {
  installedHandler = createAdultReviewWorkerHandler(options);
  return installedHandler;
}

export async function handler(event, context) {
  return installedHandler
    ? installedHandler(event, context)
    : response(503, { error: "worker_not_configured" });
}

export const createStudyAdultReviewWorkerHandler = createAdultReviewWorkerHandler;
