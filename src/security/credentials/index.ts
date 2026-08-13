export * from './importCompatibility'
export * from './migration'

// No pinVerifier primitive is application-facing. Internal vault and migration
// code import the low-level verifier seam directly.

// Only the safe, application-facing learner credential operations are
// re-exported here. Raw primitives that verify or overwrite credential
// material without proving current storage authority (parseLearnerCredentialRecord,
// createLearnerCredentialRecord, verifyLearnerCredentialRecord, the internal
// write primitive) stay off this barrel; callers that genuinely need them
// import the internal implementation seam at './vault' directly.
export {
  CredentialVaultError,
  deleteLearnerCredential,
  enrollLearnerPin,
  markLearnerCredentialResetRequired,
  readLearnerCredential,
  rotateLearnerPin,
  verifyLearnerPin,
  type CredentialOperationOptions,
  type CredentialStorage,
  type CredentialVaultErrorCode,
  type StoredLearnerCredentialRecord,
} from './vault'
