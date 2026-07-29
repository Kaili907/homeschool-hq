import { useId, useMemo, useState } from "react";
import type {
  MasteryState,
  SkillId,
} from "../../../adaptive-learning/mastery/index.js";
import {
  DEFAULT_MASTERY_FILTERS,
  type MasteryDashboardModel,
  type MasteryFiltersValue,
  type MasterySkillView,
} from "./model.js";
import {
  filterMasterySkills,
  getMasteryFilterOptions,
  groupSkillsBySubject,
} from "./filtering.js";
import { MasteryFilters } from "./MasteryFilters.js";
import { MasteryStatusBadge } from "./MasteryStatusBadge.js";
import { AccessibleMasteryList } from "./AccessibleMasteryList.js";
import {
  MASTERY_STATE_ORDER,
  getMasteryStatePresentation,
} from "./statusPresentation.js";
import { formatConfidencePercent } from "./formatting.js";

export type MasteryMapView = "path" | "list";

export interface StudentMasteryMapProps {
  readonly model: MasteryDashboardModel;
  readonly selectedSkillId?: SkillId;
  readonly onSelectSkill?: (skillId: SkillId) => void;
  readonly initialView?: MasteryMapView;
  readonly initialFilters?: MasteryFiltersValue;
}

function stateCount(
  skills: readonly MasterySkillView[],
  state: MasteryState,
): number {
  return skills.filter((skill) => skill.state === state).length;
}

function graphLevels(
  skills: readonly MasterySkillView[],
): ReadonlyMap<number, readonly MasterySkillView[]> {
  const levels = new Map<number, MasterySkillView[]>();

  for (const skill of skills) {
    const level = levels.get(skill.graphLevel) ?? [];
    level.push(skill);
    levels.set(skill.graphLevel, level);
  }

  return new Map([...levels.entries()].sort(([left], [right]) => left - right));
}

function PrerequisitePath({
  skill,
}: {
  readonly skill: MasterySkillView;
}) {
  if (skill.prerequisites.length === 0) {
    return <span className="ma-mastery-node__foundation">Foundation skill</span>;
  }

  return (
    <span className="ma-mastery-node__prerequisites">
      <span className="ma-mastery-sr-only">Prerequisites: </span>
      {skill.prerequisites.map((prerequisite, index) => (
        <span
          className="ma-mastery-node__prerequisite"
          data-blocking={prerequisite.isBlocking || undefined}
          key={prerequisite.skillId}
        >
          {index > 0 ? <span aria-hidden="true"> + </span> : null}
          {prerequisite.title}
          {prerequisite.isBlocking ? " (blocking)" : ""}
        </span>
      ))}
      <span className="ma-mastery-node__arrow" aria-hidden="true">
        {" "}
        → this skill
      </span>
    </span>
  );
}

function SkillNode({
  skill,
  selected,
  onSelectSkill,
}: {
  readonly skill: MasterySkillView;
  readonly selected: boolean;
  readonly onSelectSkill?: (skillId: SkillId) => void;
}) {
  const explanationId = `mastery-node-${String(skill.skillId)}-reason`;
  const blockers = skill.prerequisites.filter(
    (prerequisite) => prerequisite.isBlocking,
  );

  return (
    <article
      className="ma-mastery-node"
      data-state={skill.state}
      data-selected={selected || undefined}
    >
      <PrerequisitePath skill={skill} />
      <button
        className="ma-mastery-node__button"
        type="button"
        aria-pressed={selected}
        aria-describedby={explanationId}
        onClick={() => onSelectSkill?.(skill.skillId)}
      >
        <span className="ma-mastery-node__topline">
          <MasteryStatusBadge state={skill.state} compact />
          <span className="ma-mastery-node__confidence">
            {skill.gradeBand} ·{" "}
            {formatConfidencePercent(skill.confidence.score)} confidence
          </span>
        </span>
        <strong>{skill.title}</strong>
        <span className="ma-mastery-node__description">{skill.description}</span>
        {blockers.length > 0 ? (
          <span className="ma-mastery-node__blocker">
            Blocked by: {blockers.map((blocker) => blocker.title).join(", ")}
          </span>
        ) : skill.unlocks.length > 0 ? (
          <span className="ma-mastery-node__unlocks">
            Unlocks {skill.unlocks.length} next{" "}
            {skill.unlocks.length === 1 ? "skill" : "skills"}
          </span>
        ) : null}
      </button>
      <span className="ma-mastery-sr-only" id={explanationId}>
        {skill.explanation.join(" ")}
      </span>
    </article>
  );
}

function SubjectPath({
  subject,
  skills,
  selectedSkillId,
  onSelectSkill,
}: {
  readonly subject: string;
  readonly skills: readonly MasterySkillView[];
  readonly selectedSkillId?: SkillId;
  readonly onSelectSkill?: (skillId: SkillId) => void;
}) {
  const levels = graphLevels(skills);
  const headingId = `${useId()}-subject`;

  return (
    <section className="ma-mastery-subject" aria-labelledby={headingId}>
      <header className="ma-mastery-subject__header">
        <div>
          <p className="ma-mastery-eyebrow">Directed prerequisite path</p>
          <h3 id={headingId}>{subject}</h3>
        </div>
        <span>{skills.length} visible skills</span>
      </header>

      <ol className="ma-mastery-path" aria-label={`${subject} prerequisite levels`}>
        {[...levels.entries()].map(([level, levelSkills], index) => (
          <li className="ma-mastery-path__level" key={level}>
            <div className="ma-mastery-path__level-heading">
              <span>Step {level + 1}</span>
              {index < levels.size - 1 ? (
                <span aria-hidden="true">progresses to →</span>
              ) : (
                <span>Current path end</span>
              )}
            </div>
            <div className="ma-mastery-path__nodes">
              {levelSkills.map((skill) => (
                <SkillNode
                  key={skill.skillId}
                  skill={skill}
                  selected={skill.skillId === selectedSkillId}
                  onSelectSkill={onSelectSkill}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function StudentMasteryMap({
  model,
  selectedSkillId,
  onSelectSkill,
  initialView = "path",
  initialFilters = DEFAULT_MASTERY_FILTERS,
}: StudentMasteryMapProps) {
  const [view, setView] = useState<MasteryMapView>(initialView);
  const [filters, setFilters] = useState<MasteryFiltersValue>(initialFilters);
  const options = useMemo(() => getMasteryFilterOptions(model), [model]);
  const filteredSkills = useMemo(
    () => filterMasterySkills(model.skills, filters),
    [filters, model.skills],
  );
  const subjects = useMemo(
    () => groupSkillsBySubject(filteredSkills),
    [filteredSkills],
  );

  return (
    <section className="ma-student-mastery" aria-labelledby="student-mastery-heading">
      <header className="ma-student-mastery__header">
        <div>
          <p className="ma-mastery-eyebrow">Learning path intelligence</p>
          <h2 id="student-mastery-heading">
            {model.learner.displayName}&apos;s mastery map
          </h2>
          <p>
            Follow each prerequisite path and choose a skill to see why it has
            its current state.
          </p>
        </div>
        <div
          className="ma-student-mastery__summary"
          role="group"
          aria-label="Mastery map summary"
        >
          <strong>{model.skills.length}</strong>
          <span>mapped skills</span>
        </div>
      </header>

      <div className="ma-mastery-metrics">
        {MASTERY_STATE_ORDER.map((state) => (
          <div className="ma-mastery-metric" data-state={state} key={state}>
            <span
              className="ma-mastery-metric__signal"
              aria-hidden="true"
            />
            <strong>{stateCount(model.skills, state)}</strong>
            <span>{getMasteryStatePresentation(state).label}</span>
          </div>
        ))}
      </div>

      <details className="ma-mastery-legend">
        <summary>What each mastery state means</summary>
        <ul>
          {MASTERY_STATE_ORDER.map((state) => {
            const presentation = getMasteryStatePresentation(state);
            return (
              <li key={state}>
                <MasteryStatusBadge state={state} />
                <span>{presentation.description}</span>
              </li>
            );
          })}
        </ul>
      </details>

      <MasteryFilters
        value={filters}
        options={options}
        resultCount={filteredSkills.length}
        onChange={setFilters}
      />

      <div
        className="ma-mastery-view-switch"
        role="group"
        aria-label="Mastery map view"
      >
        <span>View</span>
        <button
          type="button"
          aria-pressed={view === "path"}
          onClick={() => setView("path")}
        >
          Prerequisite paths
        </button>
        <button
          type="button"
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
        >
          Accessible list
        </button>
      </div>

      {view === "list" ? (
        <AccessibleMasteryList
          skills={filteredSkills}
          selectedSkillId={selectedSkillId}
          onSelectSkill={onSelectSkill}
        />
      ) : filteredSkills.length === 0 ? (
        <div className="ma-mastery-empty" role="status">
          <strong>No skills match these filters.</strong>
          <span>Clear a filter to see more of the learning path.</span>
        </div>
      ) : (
        <div className="ma-mastery-subjects">
          {[...subjects.entries()].map(([subject, skills]) => (
            <SubjectPath
              key={subject}
              subject={subject}
              skills={skills}
              selectedSkillId={selectedSkillId}
              onSelectSkill={onSelectSkill}
            />
          ))}
        </div>
      )}
    </section>
  );
}
