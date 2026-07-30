import {
  AdaptiveTutorEngine,
  type AssessmentItem,
  type ParentTeacherReview,
  type TutorResponse,
  type VisualBoardCommand,
} from "../core/index.js";
import {
  englishRuntimeHooks,
  englishTutorProgram,
  mathRuntimeHooks,
  mathTutorProgram,
} from "../examples/index.js";

const appQuery = document.querySelector<HTMLDivElement>("#app");
if (!appQuery) throw new Error("Application root not found.");
const app: HTMLDivElement = appQuery;

const programs = {
  math: { program: mathTutorProgram, hooks: mathRuntimeHooks },
  english: { program: englishTutorProgram, hooks: englishRuntimeHooks },
};

type ProgramKey = keyof typeof programs;
let selectedProgram: ProgramKey = "math";
let engine = new AdaptiveTutorEngine(programs[selectedProgram].program, programs[selectedProgram].hooks);
let currentResponse: TutorResponse | null = null;
let boardCommands: VisualBoardCommand[] = [];
let voiceEnabled = true;
let lastCaption = "Choose a demonstration and begin.";
let review: ParentTeacherReview | null = null;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function phaseLabel(phase: string): string {
  return phase
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function commandMarkup(command: VisualBoardCommand): string {
  if (command.kind === "set-title") {
    return `<h2 class="board-title">${escapeHtml(command.text)}</h2>`;
  }
  if (command.kind === "add-text") {
    return `<p class="board-text board-${command.emphasis}">${escapeHtml(command.text)}</p>`;
  }
  if (command.kind === "draw-fraction") {
    const cells = Array.from({ length: command.denominator }, (_, index) =>
      `<span class="fraction-cell ${index < command.numerator ? "fraction-shaded" : ""}"></span>`,
    ).join("");
    return `<div class="fraction-model" aria-label="${escapeHtml(command.ariaLabel)}"><strong>${escapeHtml(command.label)}</strong><div class="fraction-bar">${cells}</div></div>`;
  }
  if (command.kind === "draw-number-line") {
    const range = command.max - command.min;
    const points = command.highlightedValues
      .map((value) => {
        const left = range === 0 ? 0 : ((value - command.min) / range) * 100;
        return `<span class="number-point" style="left:${left}%" title="${value}"></span><span class="number-label" style="left:${left}%">${value}</span>`;
      })
      .join("");
    return `<div class="number-line" aria-label="${escapeHtml(command.ariaLabel)}"><span class="line-min">${command.min}</span><span class="line-max">${command.max}</span>${points}</div>`;
  }
  if (command.kind === "show-sentence-parts") {
    return `<div class="sentence-model"><p>${escapeHtml(command.sentence)}</p><div class="sentence-parts"><span><small>Subject</small>${escapeHtml(command.subject)}</span><span><small>Predicate</small>${escapeHtml(command.predicate)}</span>${command.dependentMarker ? `<span class="dependent"><small>Dependent marker</small>${escapeHtml(command.dependentMarker)}</span>` : ""}</div></div>`;
  }
  if (command.kind === "reveal-step") {
    return `<div class="reveal-step"><span>${command.stepNumber}</span><p>${escapeHtml(command.text)}</p></div>`;
  }
  if (command.kind === "compare") {
    const symbol = command.relationship === "equal" ? "=" : command.relationship === "not-equal" ? "≠" : "↔";
    return `<div class="comparison"><span>${escapeHtml(command.leftLabel)}</span><strong>${symbol}</strong><span>${escapeHtml(command.rightLabel)}</span></div>`;
  }
  if (command.kind === "highlight") {
    return `<p class="board-highlight">Notice: ${escapeHtml(command.token)} — ${escapeHtml(command.reason)}</p>`;
  }
  if (command.kind === "aria-announce") {
    return `<p class="sr-only" aria-live="${command.priority}">${escapeHtml(command.text)}</p>`;
  }
  return "";
}

function applyBoardCommands(commands: VisualBoardCommand[]): void {
  if (commands.some((command) => command.kind === "clear-board")) boardCommands = [];
  boardCommands.push(...commands.filter((command) => command.kind !== "clear-board"));
}

function renderAssessment(item: AssessmentItem | null): string {
  if (!item) return "";
  if (item.kind === "multiple-choice") {
    return `<div class="answer-grid">${item.options
      .map(
        (option) =>
          `<button class="answer-button" data-option-id="${escapeHtml(option.id)}" data-option-text="${escapeHtml(option.text)}">${escapeHtml(option.text)}</button>`,
      )
      .join("")}</div>`;
  }
  if (item.kind === "short-answer") {
    return `<form id="short-answer-form" class="short-answer"><label for="short-answer">Your answer</label><textarea id="short-answer" maxlength="2000" required></textarea><button type="submit" class="primary-button">Submit answer</button></form>`;
  }
  return `<p>This sequencing item is supported by the contract but not used in the two demo fixtures.</p>`;
}

function reviewMarkup(value: ParentTeacherReview): string {
  const percent = Math.round(value.confidence.value * 100);
  return `<section class="review-card" aria-labelledby="review-title">
    <h2 id="review-title">Parent / Teacher Review</h2>
    <p><strong>Evidence confidence:</strong> ${percent}% (${escapeHtml(value.confidence.band)})</p>
    <p>${escapeHtml(value.uncertaintyStatement)}</p>
    <h3>Strengths</h3><ul>${value.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <h3>Needs support</h3><ul>${value.needsSupport.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>None flagged by this local demonstration.</li>"}</ul>
    <h3>Suggested next steps</h3><ul>${value.suggestedNextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <p class="review-boundary">No diagnosis or high-stakes placement decision was made.</p>
  </section>`;
}

function render(): void {
  const snapshot = engine.getSnapshot();
  const response = currentResponse;
  const phases = [
    "assessment",
    "identify-missing-concept",
    "teach-visually",
    "guided-practice",
    "independent-attempt",
    "reassess",
    "advance-or-reteach",
  ];
  const phaseIndex = response
    ? Math.max(
        0,
        ["assessment", "identify-missing-concept", "teach-visually", "guided-practice", "independent-attempt", "reassess", "advance", "reteach", "escalated"].indexOf(response.phase),
      )
    : 0;

  app.innerHTML = `<main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Manuel Academy</p>
        <h1>Adaptive Visual Tutor Core</h1>
        <p class="boundary">Jarvis is an AI tutoring interface, not a human. This prototype stores no learner identity and uses no camera.</p>
      </div>
      <div class="toolbar">
        <label>Demonstration
          <select id="program-select">
            <option value="math" ${selectedProgram === "math" ? "selected" : ""}>Math: equivalent fractions</option>
            <option value="english" ${selectedProgram === "english" ? "selected" : ""}>English: complete sentences</option>
          </select>
        </label>
        <button id="restart-button" class="secondary-button">Restart cycle</button>
        <button id="voice-button" class="secondary-button" aria-pressed="${voiceEnabled}">${voiceEnabled ? "Voice on" : "Voice off"}</button>
      </div>
    </header>

    <nav class="cycle-track" aria-label="Learning cycle">
      ${phases.map((phase, index) => `<span class="cycle-step ${index <= phaseIndex ? "cycle-active" : ""}">${escapeHtml(phaseLabel(phase))}</span>`).join("")}
    </nav>

    <section class="learning-grid">
      <aside class="jarvis-panel">
        <div class="orb-wrap">
          <div id="jarvis-orb" class="jarvis-orb" data-speaking="false" role="img" aria-label="Animated Jarvis AI tutor core with orange rings. Jarvis is not a human.">
            <span class="ring ring-one"></span>
            <span class="ring ring-two"></span>
            <span class="ring ring-three"></span>
            <span class="core-light"></span>
          </div>
        </div>
        <p class="jarvis-label">JARVIS <span>AI tutor</span></p>
        <div class="caption-box" aria-live="polite">
          <small>Visible caption</small>
          <p>${escapeHtml(lastCaption)}</p>
        </div>
        <div class="audio-status" id="audio-status">${voiceEnabled ? "Voice uses the browser’s local speech capability when available." : "Voice disabled. Captions and transcript remain available."}</div>
      </aside>

      <section class="teaching-board" aria-label="Separate visual teaching board">
        <div class="board-grid"></div>
        <div id="board-content" class="board-content">
          ${boardCommands.length > 0 ? boardCommands.map(commandMarkup).join("") : `<div class="board-placeholder"><span>Visual board</span><p>Begin the demonstration to see text, shapes, fraction models, and sentence structures.</p></div>`}
        </div>
      </section>
    </section>

    <section class="interaction-panel">
      <div class="phase-chip">${response ? escapeHtml(phaseLabel(response.phase)) : "Ready"}</div>
      <p class="tutor-message">${response ? escapeHtml(response.learnerMessage) : "Choose a demonstration, then start the learning cycle."}</p>
      <p class="uncertainty">${response ? escapeHtml(response.uncertaintyStatement) : "No evidence has been collected."}</p>
      <div class="response-controls">
        ${response?.expectedInput === "answer" ? renderAssessment(response.assessmentItem) : ""}
        ${response?.expectedInput === "continue" ? `<button id="continue-button" class="primary-button">Continue one step</button>` : ""}
        ${response?.expectedInput === "adult-review" ? `<button id="review-button" class="primary-button">Open adult review</button>` : ""}
        ${response?.alternateExplanationAvailable ? `<button id="alternate-button" class="secondary-button">Show a different explanation</button>` : ""}
        ${!response ? `<button id="start-button" class="primary-button">Begin assessment</button>` : ""}
      </div>
    </section>

    ${review ? reviewMarkup(review) : ""}

    <details class="transcript-panel">
      <summary>Session transcript (${snapshot.transcript.length} turns)</summary>
      <ol>${snapshot.transcript.map((turn) => `<li><strong>${escapeHtml(turn.speaker)}:</strong> ${escapeHtml(turn.text)}</li>`).join("") || "<li>No turns yet.</li>"}</ol>
    </details>

    <footer>
      <span>Local browser prototype</span>
      <span>No GitHub, database, authentication, storage, or progress-sync integration</span>
    </footer>
  </main>`;

  bindEvents();
}

function setResponse(response: TutorResponse): void {
  currentResponse = response;
  review = null;
  lastCaption = response.spokenTurn.text;
  applyBoardCommands(response.boardCommands);
  render();
  speak(response.spokenTurn.text, response.spokenTurn.pace);
}

function speak(text: string, pace: "slow" | "normal" | "brisk"): void {
  const orb = document.querySelector<HTMLElement>("#jarvis-orb");
  const status = document.querySelector<HTMLElement>("#audio-status");
  if (!voiceEnabled) {
    if (status) status.textContent = "Voice disabled. Read the visible caption or transcript.";
    return;
  }
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    if (status) status.textContent = "Browser voice unavailable. The visible caption and transcript are the full fallback.";
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = pace === "slow" ? 0.85 : pace === "brisk" ? 1.12 : 0.98;
    utterance.pitch = 0.92;
    utterance.onstart = () => {
      orb?.setAttribute("data-speaking", "true");
      if (status) status.textContent = "Jarvis is speaking. The same words remain visible as captions.";
    };
    utterance.onend = () => {
      orb?.setAttribute("data-speaking", "false");
      if (status) status.textContent = "Voice complete. Captions and transcript remain available.";
    };
    utterance.onerror = () => {
      orb?.setAttribute("data-speaking", "false");
      if (status) status.textContent = "Voice failed. The visible caption and transcript are the full fallback.";
    };
    window.speechSynthesis.speak(utterance);
  } catch {
    orb?.setAttribute("data-speaking", "false");
    if (status) status.textContent = "Voice failed. The visible caption and transcript are the full fallback.";
  }
}

function resetEngine(programKey: ProgramKey): void {
  selectedProgram = programKey;
  const selection = programs[selectedProgram];
  engine = new AdaptiveTutorEngine(selection.program, selection.hooks);
  currentResponse = null;
  boardCommands = [];
  review = null;
  lastCaption = "Choose a demonstration and begin.";
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  render();
}

function bindEvents(): void {
  document.querySelector<HTMLSelectElement>("#program-select")?.addEventListener("change", (event) => {
    const value = (event.target as HTMLSelectElement).value as ProgramKey;
    resetEngine(value);
  });
  document.querySelector<HTMLButtonElement>("#restart-button")?.addEventListener("click", () => resetEngine(selectedProgram));
  document.querySelector<HTMLButtonElement>("#start-button")?.addEventListener("click", () => setResponse(engine.start()));
  document.querySelector<HTMLButtonElement>("#continue-button")?.addEventListener("click", () => setResponse(engine.continue()));
  document.querySelector<HTMLButtonElement>("#alternate-button")?.addEventListener("click", () => setResponse(engine.requestAlternateExplanation()));
  document.querySelector<HTMLButtonElement>("#review-button")?.addEventListener("click", () => {
    review = engine.getReview();
    render();
  });
  document.querySelector<HTMLButtonElement>("#voice-button")?.addEventListener("click", () => {
    voiceEnabled = !voiceEnabled;
    if (!voiceEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
    render();
  });
  document.querySelectorAll<HTMLButtonElement>(".answer-button").forEach((button) => {
    button.addEventListener("click", () => {
      const optionId = button.dataset.optionId;
      const optionText = button.dataset.optionText;
      if (!optionId || !optionText) return;
      setResponse(engine.submit({ raw: optionText, selectedOptionIds: [optionId] }));
    });
  });
  document.querySelector<HTMLFormElement>("#short-answer-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector<HTMLTextAreaElement>("#short-answer");
    if (!input) return;
    setResponse(engine.submit({ raw: input.value }));
  });
}

render();
