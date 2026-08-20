import type { TrustedProductionItemEvidence } from './contracts'

/** Existing Study owns persistence, completion, review, and mastery semantics. */
export interface StudyProductionItemEvidencePort {
  appendProductionItemEvidence(evidence: TrustedProductionItemEvidence): Promise<
    | { readonly status: 'accepted' | 'duplicate' }
    | { readonly status: 'rejected'; readonly reasonCode: string }
  >
}

/** Thin bridge only: it deliberately makes no mastery or completion decision. */
export async function appendToStudyRuntime(
  port: StudyProductionItemEvidencePort,
  evidence: TrustedProductionItemEvidence,
) {
  return port.appendProductionItemEvidence(evidence)
}
