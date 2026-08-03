import {
  LEARNER_ACTIONS as WAVE_1_LEARNER_ACTIONS,
  type LearnerAction as Wave1LearnerAction,
} from "@study-ui/LearnerActions";
import {
  LEARNER_ACTIONS,
  LEARNER_ACTION_VOCABULARY_VERSION,
  type LearnerAction,
} from "@runtime/adapters/uiActionVocabulary.v2";
import { UI_ADAPTER_VERSION } from "@runtime/runtimeTypes";

describe("versioned Study-UX learner-action adapter", () => {
  it("matches the verified Wave 1 vocabulary without loading TSX in the state machine", () => {
    expect(LEARNER_ACTIONS).toEqual(WAVE_1_LEARNER_ACTIONS);
    expect(LEARNER_ACTION_VOCABULARY_VERSION).toBe(
      `${UI_ADAPTER_VERSION}.learner-actions`,
    );
  });

  it("preserves the Wave 1 action union at compile time", () => {
    const runtimeAction: LearnerAction = "I need help";
    const wave1Action: Wave1LearnerAction = runtimeAction;
    expect(wave1Action).toBe("I need help");
  });
});
