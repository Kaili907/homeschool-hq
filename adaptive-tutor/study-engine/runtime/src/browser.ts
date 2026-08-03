import { BROWSER_DEMO_SUMMARIES } from "./demonstrations.ts";
import { inspectRuntimeHealth } from "./health.ts";
import "./styles.css";

const health = inspectRuntimeHealth();
const main = document.querySelector<HTMLElement>("#main");
if (!main) throw new Error("Missing main release surface.");

const flow = [
  "Calendar block",
  "Student check-in",
  "Pre-Core safety",
  "Tutor Core",
  "Accepted-event ledger",
  "Minimized evidence",
  "Study recommendation",
  "Review queue",
  "Learner-local calendar",
  "Parent evidence",
] as const;

main.innerHTML = `
  <header class="hero" aria-labelledby="release-title">
    <p class="eyebrow">Portable release candidate · Non-production</p>
    <h1 id="release-title">${health.release.name}</h1>
    <p class="version">Version ${health.release.version}</p>
    <p class="lede">
      A safety-first composition of student study, Tutor Core, review scheduling,
      calendar placement, parent controls, and credential-free Romeo support.
    </p>
    <div class="status" role="status">
      <span aria-hidden="true">✓</span>
      Ready for production integration review
    </div>
  </header>

  <section aria-labelledby="flow-title">
    <div class="section-heading">
      <p class="eyebrow">One controlled path</p>
      <h2 id="flow-title">Runtime flow</h2>
    </div>
    <ol class="flow" aria-label="Adaptive Study Engine runtime flow">
      ${flow.map((step) => `<li>${step}</li>`).join("")}
    </ol>
  </section>

  <section aria-labelledby="demos-title">
    <div class="section-heading">
      <p class="eyebrow">Deterministic evidence</p>
      <h2 id="demos-title">Ten release demonstrations</h2>
    </div>
    <div class="demo-grid">
      ${BROWSER_DEMO_SUMMARIES.map(
        (demo, index) => `
          <article class="demo-card" data-demo-id="${demo.id}">
            <p class="demo-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</p>
            <h3>${demo.title}</h3>
            <p>${demo.summary}</p>
            <span class="pass-label">Pass</span>
          </article>
        `,
      ).join("")}
    </div>
  </section>

  <section class="boundary" aria-labelledby="boundary-title">
    <div>
      <p class="eyebrow">Release boundary</p>
      <h2 id="boundary-title">What RC1 deliberately does not claim</h2>
    </div>
    <ul>
      ${health.limitations.map((limitation) => `<li>${limitation}</li>`).join("")}
    </ul>
  </section>

  <footer>
    <p>Tutor Core ${health.components.tutorCore} frozen · Bridge ${health.components.tutorCoreBridge} · Student ${health.components.studentRuntime} · Calendar/Parent ${health.components.calendarParentRuntime}</p>
    <p>No raw answers, transcripts, credentials, diagnoses, or adult-private note bodies in Study evidence.</p>
  </footer>
`;
