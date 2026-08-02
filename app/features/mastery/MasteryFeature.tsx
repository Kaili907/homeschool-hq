import { useMemo, useState } from "react";
import type { SkillId } from "../../../adaptive-learning/mastery/index.js";
import type {
  MasteryDashboardModel,
  MasteryOverrideRequest,
} from "./model.js";
import { StudentMasteryMap } from "./StudentMasteryMap.js";
import { ParentSkillDetail } from "./ParentSkillDetail.js";
import { MasteryStatusBadge } from "./MasteryStatusBadge.js";
import { formatMasteryTimestamp } from "./formatting.js";
import "./mastery.css";

export type MasteryAudience = "student" | "parent";

export interface MasteryFeatureProps {
  readonly model: MasteryDashboardModel;
  readonly initialAudience?: MasteryAudience;
  readonly initialSelectedSkillId?: SkillId;
  readonly onRequestOverride?: (
    request: MasteryOverrideRequest,
  ) => void | Promise<void>;
  readonly now?: () => string;
  readonly className?: string;
}

function firstUsefulSkill(model: MasteryDashboardModel): SkillId | undefined {
  return (
    model.skills.find((skill) => skill.state === "currently_learning")
      ?.skillId ?? model.skills[0]?.skillId
  );
}

export function MasteryFeature({
  model,
  initialAudience = "student",
  initialSelectedSkillId,
  onRequestOverride,
  now,
  className,
}: MasteryFeatureProps) {
  const [audience, setAudience] = useState<MasteryAudience>(initialAudience);
  const [selectedSkillId, setSelectedSkillId] = useState<SkillId | undefined>(
    initialSelectedSkillId ?? firstUsefulSkill(model),
  );
  const selectedSkill = useMemo(
    () => model.skills.find((skill) => skill.skillId === selectedSkillId),
    [model.skills, selectedSkillId],
  );
  const rootClassName = ["ma-mastery", className].filter(Boolean).join(" ");

  return (
    <main className={rootClassName} id="mastery-main" tabIndex={-1}>
      <a className="ma-mastery__skip-link" href="#mastery-content">
        Skip to mastery content
      </a>
      <div className="ma-mastery__shell">
        <header className="ma-mastery__command-bar">
          <div className="ma-mastery__identity">
            <div className="ma-mastery__core" aria-hidden="true">
              <span />
              <strong>M</strong>
            </div>
            <div>
              <p className="ma-mastery-eyebrow">Manuel Academy · Mastery intelligence</p>
              <h1>Learning signal map</h1>
              <p>
                Evidence-led guidance for {model.learner.displayName} ·{" "}
                {model.learner.gradeBand}
              </p>
            </div>
          </div>

          <div className="ma-mastery__updated">
            <span className="ma-mastery__online">
              <span aria-hidden="true" />
              Analysis ready
            </span>
            <span>
              Updated{" "}
              <time dateTime={model.learner.generatedAt}>
                {formatMasteryTimestamp(model.learner.generatedAt)}
              </time>
            </span>
          </div>
        </header>

        <div className="ma-mastery__principle" role="note">
          <strong>Mastery requires independent performance.</strong>
          <span>
            Finishing an activity can add context, but completion alone never
            produces a mastered state.
          </span>
        </div>

        <nav className="ma-mastery__audience" aria-label="Mastery audience view">
          <button
            type="button"
            aria-current={audience === "student" ? "page" : undefined}
            onClick={() => setAudience("student")}
          >
            Student mastery map
          </button>
          <button
            type="button"
            aria-current={audience === "parent" ? "page" : undefined}
            onClick={() => setAudience("parent")}
          >
            Parent skill detail
          </button>
        </nav>

        {audience === "student" ? (
          <div
            className="ma-mastery__student-layout"
            id="mastery-content"
            tabIndex={-1}
          >
            <StudentMasteryMap
              model={model}
              selectedSkillId={selectedSkillId}
              onSelectSkill={setSelectedSkillId}
            />

            <aside
              className="ma-student-insight"
              aria-labelledby="student-insight-heading"
              aria-live="polite"
            >
              <p className="ma-mastery-eyebrow">Selected skill signal</p>
              {selectedSkill ? (
                <>
                  <div className="ma-student-insight__topline">
                    <h2 id="student-insight-heading">
                      {selectedSkill.title}
                    </h2>
                    <MasteryStatusBadge state={selectedSkill.state} />
                  </div>
                  <p>{selectedSkill.description}</p>
                  <section>
                    <h3>Why this state</h3>
                    <ul>
                      {selectedSkill.explanation.map((reason, index) => (
                        <li key={`${index}:${reason}`}>{reason}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3>Your next move</h3>
                    <p>{selectedSkill.nextStep}</p>
                  </section>
                  <button
                    className="ma-mastery-button ma-mastery-button--secondary"
                    type="button"
                    onClick={() => setAudience("parent")}
                  >
                    Open full evidence detail
                  </button>
                </>
              ) : (
                <>
                  <h2 id="student-insight-heading">Choose a skill</h2>
                  <p>
                    Select any skill in the path or text list to see its
                    evidence-based explanation.
                  </p>
                </>
              )}
            </aside>
          </div>
        ) : (
          <div
            className="ma-mastery__parent-layout"
            id="mastery-content"
            tabIndex={-1}
          >
            <aside className="ma-parent-skill-index">
              <p className="ma-mastery-eyebrow">Skills</p>
              <h2>Choose a detailed view</h2>
              <ul>
                {model.skills.map((skill) => (
                  <li key={skill.skillId}>
                    <button
                      type="button"
                      aria-current={
                        skill.skillId === selectedSkillId ? "true" : undefined
                      }
                      onClick={() => setSelectedSkillId(skill.skillId)}
                    >
                      <span>
                        <strong>{skill.title}</strong>
                        <small>
                          {skill.subject} · {skill.gradeBand}
                        </small>
                      </span>
                      <MasteryStatusBadge state={skill.state} compact />
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <ParentSkillDetail
              learnerName={model.learner.displayName}
              studentId={model.learner.studentId}
              skill={selectedSkill}
              onSelectSkill={setSelectedSkillId}
              onRequestOverride={onRequestOverride}
              now={now}
            />
          </div>
        )}
      </div>
    </main>
  );
}
