(() => {
  "use strict";

  const data = window.ENGLISH_DEMO_DATA;
  const modeLabels = {
    "show-me": "Show Me",
    "talk-me-through-it": "Talk Me Through It",
    "lets-do-one-together": "Let’s Do One Together",
    "different-example": "Different Example",
  };
  let currentIntervention = "reading";
  let currentMode = "show-me";

  const byId = (id) => document.getElementById(id);
  const current = () => data[currentIntervention];

  function renderBoard(commands) {
    const board = byId("board-content");
    board.replaceChildren();
    for (const command of commands) {
      if (command.kind === "clear-board" || command.kind === "aria-announce") continue;
      if (command.kind === "set-title") {
        byId("board-title").textContent = command.text;
        continue;
      }
      const card = document.createElement("div");
      card.className = `board-card ${command.emphasis === "strong" ? "strong" : ""}`;
      if (command.kind === "add-text" || command.kind === "reveal-step") card.textContent = command.text;
      else if (command.kind === "show-sentence-parts") {
        card.textContent = `${command.sentence} — subject: ${command.subject}; predicate: ${command.predicate}`;
      } else if (command.kind === "compare") {
        card.textContent = `${command.leftLabel} ↔ ${command.rightLabel}`;
      } else if (command.kind === "highlight") {
        card.textContent = `Notice “${command.token}”: ${command.reason}`;
      } else {
        card.textContent = command.ariaLabel;
      }
      board.append(card);
    }
  }

  function renderMode() {
    const response = current().extension.modeResponses[currentMode];
    byId("tutor-message").textContent = response.learnerMessage;
    byId("uncertainty").textContent = response.uncertaintyStatement;
    byId("caption-text").textContent = response.spokenTurn.fallbackText;
    renderBoard(response.boardCommands);
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === currentMode);
    });
  }

  function renderItem() {
    const item = current().program.diagnosticItems[0];
    byId("item-prompt").textContent = item.prompt;
    const form = byId("item-options");
    form.replaceChildren();
    for (const option of item.options) {
      const label = document.createElement("label");
      label.className = "option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "assessment-option";
      input.value = option.id;
      label.append(input, document.createTextNode(option.text));
      form.append(label);
    }
    byId("answer-feedback").textContent = "";
  }

  function renderTranscript() {
    const list = byId("transcript");
    list.replaceChildren();
    for (const turn of current().extension.narration.transcript) {
      const item = document.createElement("li");
      item.textContent = turn.text;
      list.append(item);
    }
  }

  function renderIntervention() {
    const module = current();
    currentMode = "show-me";
    byId("lesson-kind").textContent = module.category.toUpperCase();
    byId("lesson-title").textContent = module.program.title;
    byId("contract-status").textContent = `${module.program.id} · TutorProgramSchema v${module.program.version} · validated`;
    byId("classification").textContent = module.classification;
    byId("board-fallback").textContent = module.program.mediaFallback.missingVisualText;
    byId("audio-fallback").textContent = module.program.mediaFallback.missingAudioText;
    byId("authorship-prompt").textContent = module.extension.learnerAuthorshipPrompt;
    byId("revision-panel").hidden = currentIntervention !== "writing";
    byId("revision-feedback").textContent = "";
    document.querySelectorAll("[data-intervention]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.intervention === currentIntervention));
    });
    renderMode();
    renderItem();
    renderTranscript();
  }

  function start() {
    if (!data || data.coreContractVersion !== "0.2.0") {
      byId("contract-status").textContent = "Contract data failed to load.";
      return;
    }
    const modeRow = byId("mode-row");
    for (const [mode, label] of Object.entries(modeLabels)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.mode = mode;
      button.addEventListener("click", () => {
        currentMode = mode;
        renderMode();
      });
      modeRow.append(button);
    }

    document.querySelectorAll("[data-intervention]").forEach((button) => {
      button.addEventListener("click", () => {
        currentIntervention = button.dataset.intervention;
        renderIntervention();
      });
    });

    byId("check-answer").addEventListener("click", () => {
      const selected = document.querySelector('input[name="assessment-option"]:checked');
      if (!selected) {
        byId("answer-feedback").textContent = "Choose one response when you’re ready.";
        return;
      }
      const item = current().program.diagnosticItems[0];
      const correct = item.correctOptionIds.includes(selected.value);
      const reasoning = current().extension.answerReasoning.find((entry) => entry.itemId === item.id);
      byId("answer-feedback").textContent = correct
        ? `That choice follows the strategy. ${reasoning.reasoning}`
        : `That response is useful evidence, not a label. Try another explanation, then choose again. ${reasoning.reasoning}`;
    });

    byId("speak-button").addEventListener("click", () => {
      const text = current().extension.modeResponses[currentMode].spokenTurn.text;
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      } else {
        byId("caption-text").textContent = `${text} ${current().program.mediaFallback.missingAudioText}`;
      }
    });

    byId("save-revision").addEventListener("click", () => {
      const text = byId("revision-text").value.trim();
      byId("revision-feedback").textContent = text
        ? "Your revision stays in this page only. It remains your wording and is not treated as proof of mastery."
        : "Write your own revision when you’re ready; the tutor will not complete it for you.";
    });

    renderIntervention();
  }

  start();
})();
