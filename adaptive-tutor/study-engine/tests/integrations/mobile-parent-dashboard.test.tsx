import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ParentDashboardDemoPage,
  ParentDashboardPrototype,
  PARENT_DASHBOARD_CSS,
  createParentDashboardDemoModel,
} from "../../parent/index.js";

describe("mobile parent dashboard", () => {
  it("ships a mobile viewport and card layout instead of a wide data table", () => {
    const markup = `<!doctype html>${renderToStaticMarkup(
      <ParentDashboardDemoPage />,
    )}`;

    expect(markup).toContain('name="viewport"');
    expect(markup).toContain(
      'content="width=device-width, initial-scale=1"',
    );
    expect(markup).not.toContain("<table");
    expect(markup).toContain('data-section="today"');
    expect(markup).toContain('data-section="learning"');
    expect(markup).toContain('data-section="study-habits"');
  });

  it("uses a one-column mobile baseline with progressive wider breakpoints", () => {
    expect(PARENT_DASHBOARD_CSS).toMatch(
      /\.ma-dashboard-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );
    expect(PARENT_DASHBOARD_CSS).toContain("@media (max-width: 25rem)");
    expect(PARENT_DASHBOARD_CSS).toContain("@media (min-width: 48rem)");
    expect(PARENT_DASHBOARD_CSS).toContain("@media (min-width: 70rem)");
    expect(PARENT_DASHBOARD_CSS).toContain("overflow-wrap: anywhere");
    expect(PARENT_DASHBOARD_CSS).toMatch(
      /\.ma-control input:not\(\[type="checkbox"\]\)[^{]*\{[^}]*width:\s*100%/s,
    );
  });

  it("keeps touch controls large and collapses action groups on narrow screens", () => {
    expect(PARENT_DASHBOARD_CSS).toMatch(
      /\.ma-parent-dashboard button,[^{]*\{[^}]*min-height:\s*44px/s,
    );
    expect(PARENT_DASHBOARD_CSS).toMatch(
      /@media \(max-width: 25rem\)[\s\S]*?\.ma-recommendation-actions > \*[\s\S]*?width:\s*100%/,
    );

    const markup = renderToStaticMarkup(<ParentDashboardPrototype />);
    expect(markup).toContain('inputMode="numeric"');
    expect(markup).toContain('aria-live="polite"');
  });

  it("honors the parent timer override in the responsive projection", () => {
    const model = createParentDashboardDemoModel();
    const hiddenModel = {
      ...model,
      controls: { ...model.controls, timersHidden: true },
    };
    const markup = renderToStaticMarkup(
      <ParentDashboardPrototype initialModel={hiddenModel} />,
    );

    expect(markup).toContain("Time hidden by parent");
    expect(markup).not.toContain("Estimated: 38 minutes");
    expect(markup).toContain(
      "Current effective math work-block range: 18–22 minutes",
    );
  });
});
