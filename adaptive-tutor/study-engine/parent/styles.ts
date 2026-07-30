/**
 * Mobile-first styles for the standalone parent dashboard demonstration.
 * Integrators may extract this string into their own asset pipeline.
 */
export const PARENT_DASHBOARD_CSS = String.raw`
.ma-parent-dashboard,
.ma-parent-dashboard * {
  box-sizing: border-box;
}

.ma-parent-dashboard {
  --ink: #172033;
  --muted: #5d687d;
  --line: #dbe2ec;
  --surface: #ffffff;
  --canvas: #f4f7fb;
  --accent: #3257a8;
  --accent-soft: #e9effc;
  --positive: #19724c;
  --positive-soft: #e4f5ed;
  --caution: #8a5a00;
  --caution-soft: #fff4d5;
  min-width: 0;
  min-height: 100vh;
  padding: 1rem;
  color: var(--ink);
  background: var(--canvas);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  line-height: 1.5;
}

.ma-parent-dashboard button,
.ma-parent-dashboard input,
.ma-parent-dashboard select,
.ma-parent-dashboard textarea {
  font: inherit;
}

.ma-parent-dashboard button,
.ma-parent-dashboard input[type="checkbox"] {
  min-height: 44px;
}

.ma-parent-dashboard button {
  border: 1px solid var(--accent);
  border-radius: 0.65rem;
  padding: 0.65rem 0.9rem;
  color: #ffffff;
  background: var(--accent);
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
}

.ma-parent-dashboard button[data-tone="secondary"] {
  color: var(--accent);
  background: var(--surface);
}

.ma-parent-dashboard button:focus-visible,
.ma-parent-dashboard input:focus-visible,
.ma-parent-dashboard select:focus-visible,
.ma-parent-dashboard textarea:focus-visible {
  outline: 3px solid #f0b429;
  outline-offset: 2px;
}

.ma-dashboard-shell {
  width: 100%;
  max-width: 76rem;
  min-width: 0;
  margin: 0 auto;
}

.ma-dashboard-header,
.ma-dashboard-card,
.ma-control-panel {
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: var(--surface);
  box-shadow: 0 0.25rem 1rem rgba(23, 32, 51, 0.05);
}

.ma-dashboard-header {
  padding: 1rem;
}

.ma-dashboard-header h1,
.ma-dashboard-card h2,
.ma-dashboard-card h3,
.ma-control-panel h2,
.ma-control-panel h3 {
  margin-top: 0;
}

.ma-dashboard-header p {
  margin-bottom: 0;
  color: var(--muted);
}

.ma-dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.ma-dashboard-card,
.ma-control-panel {
  min-width: 0;
  padding: 1rem;
  overflow-wrap: anywhere;
}

.ma-section-kicker {
  margin: 0 0 0.25rem;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.ma-metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  margin: 1rem 0;
}

.ma-metric {
  min-width: 0;
  border-radius: 0.75rem;
  padding: 0.75rem;
  background: var(--accent-soft);
}

.ma-metric strong,
.ma-metric span {
  display: block;
}

.ma-metric strong {
  font-size: 1.35rem;
}

.ma-metric span {
  color: var(--muted);
  font-size: 0.82rem;
}

.ma-insight-group + .ma-insight-group {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
}

.ma-insight-list,
.ma-evidence-list {
  margin: 0;
  padding-left: 1.2rem;
}

.ma-insight-list > li + li,
.ma-evidence-list > li + li {
  margin-top: 0.65rem;
}

.ma-subtle {
  color: var(--muted);
  font-size: 0.88rem;
}

.ma-progress-note {
  border-left: 4px solid var(--positive);
  border-radius: 0.5rem;
  padding: 0.8rem;
  background: var(--positive-soft);
}

.ma-progress-note p {
  margin: 0.2rem 0;
}

.ma-habit-range {
  border-radius: 0.75rem;
  padding: 0.9rem;
  color: #123f2c;
  background: var(--positive-soft);
  font-weight: 800;
}

.ma-recommendation {
  border: 1px solid #f1d18a;
  border-radius: 0.75rem;
  padding: 0.9rem;
  background: var(--caution-soft);
}

.ma-recommendation-actions,
.ma-interruption-actions,
.ma-review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.8rem;
}

.ma-control-panel {
  margin-top: 1rem;
}

.ma-control-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.ma-control {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 0.8rem;
  padding: 0.85rem;
}

.ma-control label,
.ma-control legend {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 750;
}

.ma-control fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.ma-control input:not([type="checkbox"]),
.ma-control select,
.ma-control textarea {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  border: 1px solid #aeb8c8;
  border-radius: 0.55rem;
  padding: 0.6rem;
  color: var(--ink);
  background: #ffffff;
}

.ma-control textarea {
  min-height: 5.5rem;
  resize: vertical;
}

.ma-inline-control {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.ma-inline-control input[type="checkbox"] {
  width: 1.35rem;
  flex: 0 0 1.35rem;
}

.ma-control button {
  width: 100%;
  margin-top: 0.65rem;
}

.ma-control-summary {
  margin-top: 1rem;
  border-radius: 0.75rem;
  padding: 0.8rem;
  background: var(--accent-soft);
}

.ma-status {
  min-height: 1.5rem;
  margin-top: 0.8rem;
  color: var(--positive);
  font-weight: 700;
}

@media (max-width: 25rem) {
  .ma-parent-dashboard {
    padding: 0.65rem;
  }

  .ma-metric-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .ma-recommendation-actions > *,
  .ma-interruption-actions > *,
  .ma-review-actions > * {
    width: 100%;
  }
}

@media (min-width: 48rem) {
  .ma-parent-dashboard {
    padding: 1.5rem;
  }

  .ma-dashboard-header,
  .ma-dashboard-card,
  .ma-control-panel {
    padding: 1.25rem;
  }

  .ma-dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ma-dashboard-card[data-section="today"] {
    grid-column: 1 / -1;
  }

  .ma-metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ma-control-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ma-control button {
    width: auto;
  }
}

@media (min-width: 70rem) {
  .ma-dashboard-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ma-dashboard-card[data-section="today"] {
    grid-column: auto;
  }

  .ma-control-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .ma-parent-dashboard *,
  .ma-parent-dashboard *::before,
  .ma-parent-dashboard *::after {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
`;
