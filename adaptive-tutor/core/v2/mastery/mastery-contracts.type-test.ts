import type {
  StudyMasteryEvidenceInput,
  StudyMasteryEvidenceItem,
} from "./contracts.js";

type RequiredKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? never : K;
}[keyof T];

type AssertRequired<T, K extends keyof T> = Exclude<
  K,
  RequiredKeys<T>
> extends never
  ? true
  : false;

type Assert<T extends true> = T;

export type EvidenceItemProvenanceFieldsAreRequired = Assert<
  AssertRequired<
    StudyMasteryEvidenceItem,
    "sessionRef" | "instructionalContextRef" | "opportunityRef"
  >
>;

export type EvidenceInputBindingFieldsAreRequired = Assert<
  AssertRequired<
    StudyMasteryEvidenceInput,
    | "currentSessionRef"
    | "currentInstructionalContextRef"
    | "currentOpportunityRef"
    | "currentOpportunityAssistanceLevel"
  >
>;

const completeItem: StudyMasteryEvidenceItem = {
  evidenceRef: "evidence:type-parity",
  issuer: "study",
  learnerScopeRef: "learner:type-parity",
  conceptRef: "concept:type-parity",
  sessionRef: "session:type-parity",
  instructionalContextRef: "context:type-parity",
  opportunityRef: "opportunity:type-parity",
  outcome: "demonstrated",
  assistanceLevel: "independent",
  recency: "current",
  spacing: "same-session",
  observedAt: "2026-08-15T12:00:00.000Z",
};

const {
  sessionRef: omittedSessionRef,
  instructionalContextRef: omittedInstructionalContextRef,
  opportunityRef: omittedOpportunityRef,
  ...itemWithoutProvenance
} = completeItem;
void [
  omittedSessionRef,
  omittedInstructionalContextRef,
  omittedOpportunityRef,
];
// @ts-expect-error Runtime-required item provenance is also statically required.
const rejectedItemConstruction: StudyMasteryEvidenceItem = itemWithoutProvenance;
void rejectedItemConstruction;

const completeInput: StudyMasteryEvidenceInput = {
  envelope: "study-issued-mastery-evidence",
  learnerScopeRef: "learner:type-parity",
  conceptRef: "concept:type-parity",
  currentSessionRef: "session:type-parity",
  currentInstructionalContextRef: "context:type-parity",
  currentOpportunityRef: "opportunity:type-parity",
  currentOpportunityAssistanceLevel: "independent",
  evaluatedAt: "2026-08-15T12:00:00.000Z",
  evidence: [completeItem],
};

const {
  currentSessionRef: omittedCurrentSessionRef,
  currentInstructionalContextRef: omittedCurrentInstructionalContextRef,
  currentOpportunityRef: omittedCurrentOpportunityRef,
  currentOpportunityAssistanceLevel: omittedCurrentOpportunityAssistanceLevel,
  ...inputWithoutCurrentBinding
} = completeInput;
void [
  omittedCurrentSessionRef,
  omittedCurrentInstructionalContextRef,
  omittedCurrentOpportunityRef,
  omittedCurrentOpportunityAssistanceLevel,
];
// @ts-expect-error Runtime-required current binding is also statically required.
const rejectedInputConstruction: StudyMasteryEvidenceInput = inputWithoutCurrentBinding;
void rejectedInputConstruction;
