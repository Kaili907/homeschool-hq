import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MasteryFeaturePrototype } from "../MasteryFeaturePrototype.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("The mastery prototype root element is missing.");
}

createRoot(container).render(
  <StrictMode>
    <MasteryFeaturePrototype />
  </StrictMode>,
);

