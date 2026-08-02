import {
  masteryDemoFixture,
} from "../../../adaptive-learning/mastery/index.js";
import { buildMasteryDashboardModel } from "./projection.js";

/**
 * The browser preview consumes the same validated math/English graphs, engine
 * evaluations, explanations, and stable IDs used by the mastery-domain seed
 * fixture. No state is invented in the interface layer.
 */
export const SAMPLE_MASTERY_DASHBOARD = buildMasteryDashboardModel({
  learner: {
    studentId: masteryDemoFixture.studentId,
    displayName: "Alex",
    gradeBand: "Cross-grade diagnostic path",
  },
  generatedAt: masteryDemoFixture.now,
  graphs: masteryDemoFixture.graphs,
  masteryRecords: masteryDemoFixture.records,
  explanations: masteryDemoFixture.explanations,
  subjectLabels: {
    [masteryDemoFixture.graphs[0].subjectId]: "Math",
    [masteryDemoFixture.graphs[1].subjectId]: "English",
  },
});

