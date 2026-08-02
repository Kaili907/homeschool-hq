import { useMemo, useState } from "react";
import type {
  SafetyCenterAction,
  SafetyCenterActionResult,
} from "./contracts";
import { AiSafetyCenter } from "./AiSafetyCenter";
import {
  demoMissingHistoryData,
  demoParentViewer,
  demoSafetyCenterData,
  demoStudent,
  demoStudentViewer,
} from "./fixtures";
import "./prototype.css";

function actionLabel(action: SafetyCenterAction): string {
  return action.type.replaceAll("_", " ");
}

export function AiSafetyCenterPrototype() {
  const [view, setView] = useState<"parent" | "student">("parent");
  const [historyAvailable, setHistoryAvailable] = useState(true);
  const [lastAction, setLastAction] = useState<string>(
    "No prototype action submitted yet.",
  );

  const viewer = view === "parent" ? demoParentViewer : demoStudentViewer;
  const data = useMemo(
    () => (historyAvailable ? demoSafetyCenterData : demoMissingHistoryData),
    [historyAvailable],
  );

  async function onAction(
    action: SafetyCenterAction,
  ): Promise<SafetyCenterActionResult> {
    setLastAction(`Received: ${actionLabel(action)}`);
    return {
      status: "pending",
      message:
        "Prototype request recorded. A host integration would now persist and audit it.",
      requestRef: `prototype:${action.type}`,
    };
  }

  return (
    <div className="masc-prototype">
      <aside className="masc-prototype-bar" aria-label="Prototype controls">
        <div>
          <strong>Prototype controls</strong>
          <span>
            Switch roles and test the explicit missing-history fallback.
          </span>
        </div>
        <div className="masc-prototype-options">
          <fieldset>
            <legend>Viewer</legend>
            <label>
              <input
                type="radio"
                name="prototype-viewer"
                value="parent"
                checked={view === "parent"}
                onChange={() => setView("parent")}
              />
              Parent
            </label>
            <label>
              <input
                type="radio"
                name="prototype-viewer"
                value="student"
                checked={view === "student"}
                onChange={() => setView("student")}
              />
              Student
            </label>
          </fieldset>
          <label className="masc-prototype-check">
            <input
              type="checkbox"
              checked={!historyAvailable}
              onChange={(event) => setHistoryAvailable(!event.target.checked)}
            />
            Simulate missing history
          </label>
        </div>
        <p role="status" aria-live="polite">
          {lastAction}
        </p>
      </aside>
      <AiSafetyCenter
        key={`${view}:${historyAvailable ? "ready" : "missing"}`}
        viewer={viewer}
        student={demoStudent}
        data={data}
        onAction={onAction}
      />
    </div>
  );
}
