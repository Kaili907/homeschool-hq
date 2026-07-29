import { useState } from "react";
import { asOverrideId } from "../../../adaptive-learning/mastery/index.js";
import { MasteryFeature } from "./MasteryFeature.js";
import type {
  MasteryDashboardModel,
  MasteryOverrideRequest,
} from "./model.js";
import { SAMPLE_MASTERY_DASHBOARD } from "./sampleModel.js";

export interface MasteryFeaturePrototypeProps {
  readonly initialModel?: MasteryDashboardModel;
}

/**
 * Browser-only demonstration shell. Production callers should pass override
 * requests to the mastery engine and render the returned projection.
 */
export function MasteryFeaturePrototype({
  initialModel = SAMPLE_MASTERY_DASHBOARD,
}: MasteryFeaturePrototypeProps) {
  const [model, setModel] = useState(initialModel);

  const requestPrototypeOverride = (
    request: MasteryOverrideRequest,
  ): void => {
    setModel((previous) => ({
      ...previous,
      learner: {
        ...previous.learner,
        generatedAt: request.requestedAt,
      },
      skills: previous.skills.map((skill) => {
        if (skill.skillId !== request.skillId) return skill;

        const overrideId = asOverrideId(
          `override:preview:${request.requestedAt.replace(/[^0-9]/g, "")}:${skill.overrideAudit.length + 1}`,
        );

        return {
          ...skill,
          state: request.overrideState,
          explanation: [
            `A documented ${request.actorRole} override is active: ${request.reason}`,
            ...skill.explanation,
          ],
          overrideAudit: [
            {
              overrideId,
              changedAt: request.requestedAt,
              actorLabel: request.actorLabel,
              actorRole: request.actorRole,
              previousState: skill.state,
              overrideState: request.overrideState,
              reason: request.reason,
              status: "active" as const,
            },
            ...skill.overrideAudit.map((entry) =>
              entry.status === "active"
                ? { ...entry, status: "superseded" as const }
                : entry,
            ),
          ],
        };
      }),
    }));
  };

  return (
    <MasteryFeature
      model={model}
      onRequestOverride={requestPrototypeOverride}
    />
  );
}
