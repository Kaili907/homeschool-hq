import "./styles.css";
import {
  RUNTIME_SCENARIOS,
  type RuntimeScenario,
  type RuntimeScenarioId,
} from "./demo-scenarios.js";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (rootElement === null) {
  throw new Error("Calendar/parent runtime root was not found.");
}
const root: HTMLDivElement = rootElement;

const defaultScenario: RuntimeScenario = (() => {
  const scenario = RUNTIME_SCENARIOS[0];
  if (scenario === undefined) {
    throw new Error("At least one runtime scenario is required.");
  }
  return scenario;
})();

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function percentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scenarioFromLocation(): RuntimeScenarioId {
  const requested = new URLSearchParams(window.location.search).get(
    "scenario",
  );
  return (
    RUNTIME_SCENARIOS.find(({ id }) => id === requested)?.id ??
    defaultScenario.id
  );
}

let activeScenarioId = scenarioFromLocation();

function metricMarkup(scenario: RuntimeScenario): string {
  return scenario.metrics
    .map(
      ({ label, value, detail }) => `
        <article class="metric">
          <span class="metric-label">${escapeHtml(label)}</span>
          <strong class="metric-value">${escapeHtml(value)}</strong>
          <span class="metric-detail">${escapeHtml(detail)}</span>
        </article>
      `,
    )
    .join("");
}

function calendarMarkup(scenario: RuntimeScenario): string {
  return scenario.calendar
    .map(
      (item) => `
        <div class="calendar-row" data-calendar-id="${escapeHtml(item.id)}">
          <time class="calendar-time">${escapeHtml(item.localTime)}</time>
          <div class="calendar-track">
            <article class="calendar-card ${escapeHtml(item.tone)}">
              <div>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.detail)}</p>
                <div
                  class="progress-track"
                  role="progressbar"
                  aria-label="${escapeHtml(item.title)} required work completion"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow="${percentage(item.requiredWorkPercent)}"
                >
                  <span
                    class="progress-fill"
                    style="width: ${percentage(item.requiredWorkPercent)}%"
                  ></span>
                </div>
              </div>
              <div class="calendar-meta">
                <strong>${escapeHtml(item.duration)}</strong>
                <span>${escapeHtml(item.state)}</span>
              </div>
            </article>
          </div>
        </div>
      `,
    )
    .join("");
}

function evidenceMarkup(scenario: RuntimeScenario): string {
  return scenario.evidence
    .map(
      ({ marker, title, detail }) => `
        <article class="evidence-card">
          <span class="evidence-icon" aria-hidden="true">${escapeHtml(marker)}</span>
          <div>
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(detail)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function controlsMarkup(scenario: RuntimeScenario): string {
  return scenario.controls
    .map(
      ({ label, detail, status }) => `
        <article class="control-card">
          <div>
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(detail)}</span>
          </div>
          <span class="tag ${status === "history" ? "history" : ""}">
            ${status === "history" ? "history kept" : "effective"}
          </span>
        </article>
      `,
    )
    .join("");
}

function traceMarkup(scenario: RuntimeScenario): string {
  return scenario.traces
    .map(
      ({ label, title, id }) => `
        <article class="trace-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(title)}</strong>
          <code title="${escapeHtml(id)}">${escapeHtml(id)}</code>
        </article>
      `,
    )
    .join("");
}

function render(): void {
  const scenario =
    RUNTIME_SCENARIOS.find(({ id }) => id === activeScenarioId) ??
    defaultScenario;
  document.title = `${scenario.shortLabel} · Calendar + Parent Runtime Lab`;

  root.innerHTML = `
    <main class="shell" data-active-scenario="${escapeHtml(scenario.id)}">
      <header class="masthead">
        <div>
          <p class="eyebrow">Manuel Academy · Wave 2 Integration Lab</p>
          <h1>Calendar + Parent Runtime</h1>
          <p class="lede">
            Canonical review recommendations move through a bounded learner-local
            calendar, return aggregate results to the engine, and produce
            minimized parent-visible evidence.
          </p>
        </div>
        <div class="status-stack" aria-label="Lab status">
          <span class="status-pill">Canonical package hashes verified</span>
          <span class="status-pill">Card 5 decisions · reconciled</span>
        </div>
      </header>

      <section class="toolbar" aria-label="Runtime demonstrations">
        <div class="scenario-tabs" role="tablist" aria-label="Scenarios">
          ${RUNTIME_SCENARIOS.map(
            ({ id, shortLabel }) => `
              <button
                class="scenario-tab"
                type="button"
                role="tab"
                data-scenario="${escapeHtml(id)}"
                aria-selected="${id === scenario.id ? "true" : "false"}"
              >
                ${escapeHtml(shortLabel)}
              </button>
            `,
          ).join("")}
        </div>
        <div class="zone">
          Household zone <strong>${escapeHtml(scenario.timeZone)}</strong>
        </div>
      </section>

      <section class="metric-grid" aria-label="Scenario summary">
        ${metricMarkup(scenario)}
      </section>

      <section class="workspace">
        <article class="panel">
          <div class="panel-heading">
            <div>
              <h2>${escapeHtml(scenario.title)}</h2>
              <p>${escapeHtml(scenario.summary)}</p>
            </div>
            <span class="chip">${escapeHtml(scenario.dateLabel)}</span>
          </div>
          <div class="flow" aria-label="Canonical runtime flow">
            ${scenario.flow
              .map(
                ({ label, value }) => `
                  <div class="flow-step">
                    <span>${escapeHtml(label)}</span>
                    <strong>${escapeHtml(value)}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
          <div class="calendar" aria-label="Learner-local calendar">
            ${calendarMarkup(scenario)}
          </div>
        </article>

        <aside class="panel">
          <div class="panel-heading">
            <div>
              <h2>Parent evidence</h2>
              <p>Minimized, explainable, and free of raw learner content.</p>
            </div>
            <span class="chip">${scenario.evidence.length} records</span>
          </div>
          <div class="evidence-list">${evidenceMarkup(scenario)}</div>
          <div class="panel-heading">
            <div>
              <h2>Effective controls</h2>
              <p>Every decision has an explicit winner and reason.</p>
            </div>
          </div>
          <div class="control-list">${controlsMarkup(scenario)}</div>
        </aside>

        <article class="panel trace-panel">
          <div class="panel-heading">
            <div>
              <h2>Deterministic trace</h2>
              <p>Stable internal and external identities remain separate.</p>
            </div>
            <span class="chip">No credentials · no persistence</span>
          </div>
          <div class="trace-list">${traceMarkup(scenario)}</div>
        </article>
      </section>
    </main>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-scenario]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        const next = button.dataset.scenario as RuntimeScenarioId | undefined;
        if (
          next === undefined ||
          !RUNTIME_SCENARIOS.some(({ id }) => id === next)
        ) {
          return;
        }
        activeScenarioId = next;
        const url = new URL(window.location.href);
        url.searchParams.set("scenario", next);
        window.history.replaceState({}, "", url);
        render();
      });
    },
  );
}

render();
