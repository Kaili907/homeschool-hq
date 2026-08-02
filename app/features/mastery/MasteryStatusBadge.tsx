import type { MasteryState } from "../../../adaptive-learning/mastery/index.js";
import { getMasteryStatePresentation } from "./statusPresentation.js";

export interface MasteryStatusBadgeProps {
  readonly state: MasteryState;
  readonly compact?: boolean;
  readonly className?: string;
}

export function MasteryStatusBadge({
  state,
  compact = false,
  className,
}: MasteryStatusBadgeProps) {
  const presentation = getMasteryStatePresentation(state);
  const classes = [
    "ma-mastery-status",
    compact ? "ma-mastery-status--compact" : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} data-state={state}>
      <span className="ma-mastery-status__signal" aria-hidden="true">
        {presentation.symbol}
      </span>
      <span>
        {compact ? presentation.shortLabel : presentation.label}
      </span>
    </span>
  );
}

