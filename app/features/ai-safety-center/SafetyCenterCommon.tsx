import type { ReactNode } from "react";
import type {
  CollectionState,
  SafetyCenterAction,
  SafetyCenterActionResult,
  SafetyEvent,
} from "./contracts";
import { SEVERITY_LABEL } from "./format";

export type DispatchSafetyCenterAction = (
  action: SafetyCenterAction,
) => Promise<SafetyCenterActionResult>;

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  actions,
}: {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="masc-section-heading">
      <div>
        <p className="masc-eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>
      {actions ? <div className="masc-heading-actions">{actions}</div> : null}
    </header>
  );
}

export function SeverityBadge({
  severity,
}: {
  readonly severity: SafetyEvent["severity"];
}) {
  return (
    <span className="masc-badge" data-severity={severity}>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  readonly children: ReactNode;
  readonly tone?: "neutral" | "positive" | "warning" | "critical" | "accent";
}) {
  return (
    <span className="masc-badge" data-tone={tone}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  readonly title: string;
  readonly detail: string;
}) {
  return (
    <div className="masc-empty">
      <span className="masc-empty-mark" aria-hidden="true">
        ✓
      </span>
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export function CollectionNotice<T>({
  state,
  title,
  onRetry,
  retryDisabled = false,
}: {
  readonly state: Exclude<CollectionState<T>, { readonly status: "ready" }>;
  readonly title: string;
  readonly onRetry?: () => void;
  readonly retryDisabled?: boolean;
}) {
  if (state.status === "loading") {
    return (
      <div className="masc-collection-notice" role="status">
        <span className="masc-loader" aria-hidden="true" />
        <div>
          <h3>Loading {title.toLocaleLowerCase()}</h3>
          <p>Student information stays hidden until loading is complete.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="masc-collection-notice" role="status">
      <span className="masc-empty-mark" aria-hidden="true">
        !
      </span>
      <div>
        <h3>{title} is not available</h3>
        <p>
          We cannot confirm whether records exist right now, so this is not
          shown as an empty history. Safety controls remain available.
        </p>
        {state.code === "retention_expired" ? (
          <p>Older records may have reached the configured retention limit.</p>
        ) : null}
        {state.retryable && onRetry ? (
          <button
            className="masc-button masc-button-secondary"
            type="button"
            onClick={onRetry}
            disabled={retryDisabled}
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function InlineNotice({
  title,
  children,
  tone = "info",
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly tone?: "info" | "warning" | "critical" | "privacy";
}) {
  return (
    <aside className="masc-inline-notice" data-tone={tone}>
      <span className="masc-notice-icon" aria-hidden="true">
        {tone === "critical"
          ? "!"
          : tone === "warning"
            ? "△"
            : tone === "privacy"
              ? "●"
              : "i"}
      </span>
      <div>
        <h3>{title}</h3>
        <div className="masc-notice-copy">{children}</div>
      </div>
    </aside>
  );
}
