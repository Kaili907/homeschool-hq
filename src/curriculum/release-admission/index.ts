/**
 * CURRICULUM-RELEASE-ADMISSION — the public surface.
 *
 * Final convergence should depend on this module, not on the files behind it,
 * so the admission rules and the projection shape can change independently of
 * whichever curriculum packages are being admitted.
 *
 *   inspectCandidate            read-only census, no verdict
 *   validateCandidate           the rejection list, fail-closed
 *   admitCandidate              the only producer of an AdmittedRelease
 *   buildBrowserCatalogProjection   the lazy catalog runtime's data half
 *   buildReleaseRegistryEntry       the registry row
 *   buildReadinessEvidence          the operator-facing evidence
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

export {
  buildBrowserCatalogProjection,
  buildReadinessEvidence,
  buildReleaseRegistryEntry,
} from './projections.ts'
export type {
  BrowserCatalogProjection,
  ProjectedCatalogCourse,
  ProjectedCatalogUnit,
  ProjectedLessonRow,
  ReadinessCheck,
  ReadinessEvidence,
  ReadinessEvidenceOptions,
  ReleaseRegistryEntry,
  ReleaseRegistryGradeEntry,
} from './projections.ts'

export { buildCandidateFixture, buildCanonicalCandidateFixture } from './fixtures.ts'
export type { CandidateFixtureOptions } from './fixtures.ts'
