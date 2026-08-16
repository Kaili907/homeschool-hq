/**
 * CURRICULUM-RELEASE-ADMISSION — the public surface.
 *
 * Final convergence should depend on this module, not on the files behind it,
 * so the admission rules can change independently of whichever curriculum
 * packages are being admitted.
 *
 *   inspectCandidate            read-only census, no verdict
 *   validateCandidate           the rejection list, fail-closed
 *   admitCandidate              the only producer of an AdmittedRelease
 */
export {
  ADMISSION_REJECTION_CODES,
  ADMISSION_REPORT_VERSION,
  ADMISSION_SCHEMA_SET_VERSION,
  CANONICAL_GRADES,
  SUPPORTED_SUBJECTS,
} from './types.ts'
export type {
  AdmissionDecision,
  AdmissionRejection,
  AdmissionRejectionCode,
  AdmittedRelease,
  CandidateInspection,
  CandidateValidation,
  CanonicalGrade,
  GradeCoverage,
  ReleaseCandidate,
  SafetyPrivacyGateAttestation,
  StandardsCustodyRecord,
  SupportedSubject,
} from './types.ts'

export { admitCandidate, inspectCandidate, validateCandidate } from './admission.ts'

export { buildCandidateFixture, buildCanonicalCandidateFixture } from './fixtures.ts'
export type { CandidateFixtureOptions } from './fixtures.ts'
