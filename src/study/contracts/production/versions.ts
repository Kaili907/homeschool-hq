/** Canonical, independently deployable Study production contract versions. */
export const STUDY_PRODUCTION_CONTRACT_VERSION = 'study-production.v1' as const
export const STUDY_IDENTITY_SCHEMA_VERSION = 1 as const
export const STUDY_AUTHORIZATION_SCHEMA_VERSION = 1 as const
export const STUDY_READINESS_SCHEMA_VERSION = 1 as const
export const STUDY_PORT_REGISTRY_SCHEMA_VERSION = 1 as const
export const STUDY_PRODUCTION_ERROR_SCHEMA_VERSION = 1 as const

export type StudyProductionContractVersion = typeof STUDY_PRODUCTION_CONTRACT_VERSION
