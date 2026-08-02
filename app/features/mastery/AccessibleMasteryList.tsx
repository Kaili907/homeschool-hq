import type { SkillId } from "../../../adaptive-learning/mastery/index.js";
import type { MasterySkillView } from "./model.js";
import { MasteryStatusBadge } from "./MasteryStatusBadge.js";
import {
  formatConfidencePercent,
  formatMasteryTimestamp,
} from "./formatting.js";

export interface AccessibleMasteryListProps {
  readonly skills: readonly MasterySkillView[];
  readonly selectedSkillId?: SkillId;
  readonly onSelectSkill?: (skillId: SkillId) => void;
}

function prerequisiteSummary(skill: MasterySkillView): string {
  if (skill.prerequisites.length === 0) return "No prerequisite";

  const blockers = skill.prerequisites.filter(
    (prerequisite) => prerequisite.isBlocking,
  );
  if (blockers.length > 0) {
    return `Blocked by ${blockers.map((item) => item.title).join(", ")}`;
  }

  return skill.prerequisites.map((item) => item.title).join(", ");
}

export function AccessibleMasteryList({
  skills,
  selectedSkillId,
  onSelectSkill,
}: AccessibleMasteryListProps) {
  if (skills.length === 0) {
    return (
      <div className="ma-mastery-empty" role="status">
        <strong>No skills match these filters.</strong>
        <span>Clear a filter to see more of the learning path.</span>
      </div>
    );
  }

  return (
    <ol className="ma-mastery-list" aria-label="Mastery skills in text format">
      {skills.map((skill) => {
        const titleId = `mastery-list-${String(skill.skillId)}-title`;
        const isSelected = skill.skillId === selectedSkillId;

        return (
          <li key={skill.skillId}>
            <article
              className="ma-mastery-list__item"
              data-state={skill.state}
              data-selected={isSelected || undefined}
              aria-labelledby={titleId}
            >
              <div className="ma-mastery-list__topline">
                <div>
                  <p className="ma-mastery-eyebrow">
                    {skill.subject} · {skill.gradeBand}
                  </p>
                  <h4 id={titleId}>{skill.title}</h4>
                </div>
                <MasteryStatusBadge state={skill.state} />
              </div>

              <p>{skill.description}</p>

              <dl className="ma-mastery-list__facts">
                <div>
                  <dt>Prerequisite path</dt>
                  <dd>{prerequisiteSummary(skill)}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>
                    {formatConfidencePercent(skill.confidence.score)} ·{" "}
                    {skill.confidence.level}
                  </dd>
                </div>
                <div>
                  <dt>Last independent demonstration</dt>
                  <dd>
                    {formatMasteryTimestamp(
                      skill.lastIndependentDemonstrationAt,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Next step</dt>
                  <dd>{skill.nextStep}</dd>
                </div>
              </dl>

              <div className="ma-mastery-list__reason">
                <strong>Why this state</strong>
                <ul>
                  {skill.explanation.map((reason, index) => (
                    <li key={`${index}:${reason}`}>{reason}</li>
                  ))}
                </ul>
              </div>

              {onSelectSkill ? (
                <button
                  className="ma-mastery-button ma-mastery-button--secondary"
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectSkill(skill.skillId)}
                >
                  {isSelected ? "Skill selected" : "Open skill details"}
                </button>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
