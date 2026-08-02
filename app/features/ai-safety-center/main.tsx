import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AiSafetyCenterPrototype } from "./prototype";

const container = document.getElementById("root");

if (!container) {
  throw new Error("AI Safety Center prototype root was not found.");
}

createRoot(container).render(
  <StrictMode>
    <AiSafetyCenterPrototype />
  </StrictMode>,
);
