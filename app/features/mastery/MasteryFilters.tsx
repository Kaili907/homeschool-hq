import { useId } from "react";
import {
  DEFAULT_MASTERY_FILTERS,
  EMPTY_MASTERY_FILTER_VALUE,
  type MasteryFiltersValue,
} from "./model.js";
import type { MasteryFilterOptions } from "./filtering.js";
import {
  countActiveMasteryFilters,
} from "./filtering.js";
import { getMasteryStatePresentation } from "./statusPresentation.js";

export interface MasteryFiltersProps {
  readonly value: MasteryFiltersValue;
  readonly options: MasteryFilterOptions;
  readonly resultCount: number;
  readonly onChange: (value: MasteryFiltersValue) => void;
}

export function MasteryFilters({
  value,
  options,
  resultCount,
  onChange,
}: MasteryFiltersProps) {
  const instanceId = useId();
  const subjectId = `${instanceId}-subject`;
  const stateId = `${instanceId}-state`;
  const gradeBandId = `${instanceId}-grade-band`;
  const activeCount = countActiveMasteryFilters(value);

  return (
    <section className="ma-mastery-filters" aria-labelledby={`${instanceId}-heading`}>
      <div className="ma-mastery-filters__heading">
        <div>
          <p className="ma-mastery-eyebrow">Focus controls</p>
          <h3 id={`${instanceId}-heading`}>Filter the mastery map</h3>
        </div>
        {activeCount > 0 ? (
          <button
            className="ma-mastery-button ma-mastery-button--quiet"
            type="button"
            onClick={() => onChange(DEFAULT_MASTERY_FILTERS)}
          >
            Clear {activeCount} {activeCount === 1 ? "filter" : "filters"}
          </button>
        ) : null}
      </div>

      <div className="ma-mastery-filters__grid">
        <label htmlFor={subjectId}>
          <span>Subject</span>
          <select
            id={subjectId}
            value={value.subject}
            onChange={(event) =>
              onChange({ ...value, subject: event.currentTarget.value })
            }
          >
            <option value={EMPTY_MASTERY_FILTER_VALUE}>All subjects</option>
            {options.subjects.map((subject) => (
              <option value={subject} key={subject}>
                {subject}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor={stateId}>
          <span>Mastery state</span>
          <select
            id={stateId}
            value={value.state}
            onChange={(event) =>
              onChange({
                ...value,
                state: event.currentTarget.value as MasteryFiltersValue["state"],
              })
            }
          >
            <option value={EMPTY_MASTERY_FILTER_VALUE}>All states</option>
            {options.states.map((state) => (
              <option value={state} key={state}>
                {getMasteryStatePresentation(state).label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor={gradeBandId}>
          <span>Grade band</span>
          <select
            id={gradeBandId}
            value={value.gradeBand}
            onChange={(event) =>
              onChange({ ...value, gradeBand: event.currentTarget.value })
            }
          >
            <option value={EMPTY_MASTERY_FILTER_VALUE}>All grade bands</option>
            {options.gradeBands.map((gradeBand) => (
              <option value={gradeBand} key={gradeBand}>
                {gradeBand}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="ma-mastery-filters__result" role="status" aria-live="polite">
        {resultCount} {resultCount === 1 ? "skill matches" : "skills match"} the
        current filters.
      </p>
    </section>
  );
}

