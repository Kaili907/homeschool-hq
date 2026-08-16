export type DynamicSocialSourceMetadata = Readonly<Record<string, unknown>>

const REQUIRED = Object.freeze([
  'attachmentId', 'lessonRef', 'unitRef', 'issueStatement', 'sourceIdentifier', 'sourceTitle',
  'responsibleParty', 'sourceDate', 'sourceVersionOrEdition', 'retrievalLocation', 'retrievedOn',
  'retrievedByRole', 'retrievalStatus', 'mediaType', 'language', 'sourceKind', 'authorityTier',
  'authorityVerified', 'primaryOrSecondary', 'primaryOrSecondaryReason', 'interestDisclosure',
  'relevanceToIssue', 'limitsNoted', 'rightsCategory', 'rightsStatement', 'publicAccess',
  'selectedByRole', 'selectedOn', 'readInFull', 'contentSafetyReviewedByRole',
  'readingLevelReviewedByRole', 'previewedForSafetyAndLevel', 'containsLearnerPersonalData',
  'containsOtherMinorPersonalData', 'quotedTextStored', 'contentDigestSha256',
] as const)

const OPTIONAL = new Set(['participantRole', 'consentRecorded'])
const ROLES = new Set(['PARENT', 'TUTOR', 'TEACHER'])
const SOURCE_KINDS = new Set(['OFFICIAL_RECORD', 'AGENCY_DATA_OR_REPORT', 'PARTY_STATEMENT', 'INDEPENDENT_REPORTING', 'LEARNER_COLLECTED'])
const AUTHORITY_TIERS = new Set(['TIER_1_OFFICIAL_RECORD', 'TIER_2_PARTY_STATEMENT', 'TIER_3_INDEPENDENT_REPORTING', 'TIER_4_LEARNER_COLLECTED'])
const PRIMARY_SECONDARY = new Set(['PRIMARY', 'SECONDARY'])
const RIGHTS = new Set(['PUBLIC_DOMAIN', 'GOVERNMENT_RECORD', 'CC0', 'CC_BY', 'CC_BY_SA', 'LICENSED_LINK_ONLY', 'FAIR_USE_MINIMAL_EXCERPT', 'LEARNER_COLLECTED_WITH_CONSENT'])
const EXPECTED_TIER: Readonly<Record<string, string>> = Object.freeze({
  OFFICIAL_RECORD: 'TIER_1_OFFICIAL_RECORD',
  AGENCY_DATA_OR_REPORT: 'TIER_1_OFFICIAL_RECORD',
  PARTY_STATEMENT: 'TIER_2_PARTY_STATEMENT',
  INDEPENDENT_REPORTING: 'TIER_3_INDEPENDENT_REPORTING',
  LEARNER_COLLECTED: 'TIER_4_LEARNER_COLLECTED',
})

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

function date(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
}

function validateOne(value: unknown, lessonRef: string): DynamicSocialSourceMetadata {
  if (!record(value)) throw new Error('Each dynamic source attachment must be a metadata object.')
  const allowed = new Set<string>([...REQUIRED, ...OPTIONAL])
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error('Dynamic source metadata contains an unapproved field or source body.')
  if (REQUIRED.some((key) => !(key in value))) throw new Error('Dynamic source metadata is incomplete; all 36 required fields must be present.')
  if (value.lessonRef !== lessonRef || value.unitRef !== 'ma-g3-social-studies-u09') throw new Error('Dynamic source metadata does not belong to this exact lesson and unit.')
  for (const [key, max] of Object.entries({
    attachmentId: 128, issueStatement: 500, sourceIdentifier: 300, sourceTitle: 500,
    responsibleParty: 300, sourceDate: 80, retrievalLocation: 2048, mediaType: 200,
    language: 100, primaryOrSecondaryReason: 500, interestDisclosure: 500,
    relevanceToIssue: 750, limitsNoted: 750, rightsStatement: 750,
  })) if (!text(value[key], max)) throw new Error(`Dynamic source metadata field ${key} is missing or invalid.`)
  if (!(value.sourceVersionOrEdition === null || (typeof value.sourceVersionOrEdition === 'string' && value.sourceVersionOrEdition.length <= 200))) {
    throw new Error('Dynamic source version or edition is invalid.')
  }
  if (!date(value.retrievedOn) || !date(value.selectedOn)) throw new Error('Dynamic source retrieval and selection dates must be valid dates.')
  if (!ROLES.has(String(value.retrievedByRole)) || !ROLES.has(String(value.selectedByRole)) ||
      !ROLES.has(String(value.contentSafetyReviewedByRole)) || !ROLES.has(String(value.readingLevelReviewedByRole))) {
    throw new Error('Dynamic source retrieval, selection, and review require an authorized adult role.')
  }
  if (value.retrievalStatus !== 'OPENED_AND_READABLE' || value.authorityVerified !== true || value.readInFull !== true ||
      value.previewedForSafetyAndLevel !== true || value.containsLearnerPersonalData !== false ||
      value.containsOtherMinorPersonalData !== false || value.quotedTextStored !== false) {
    throw new Error('Dynamic source metadata did not satisfy retrieval, authority, safety, privacy, and no-quotation requirements.')
  }
  if (typeof value.publicAccess !== 'boolean' || !SOURCE_KINDS.has(String(value.sourceKind)) ||
      !AUTHORITY_TIERS.has(String(value.authorityTier)) || !PRIMARY_SECONDARY.has(String(value.primaryOrSecondary)) ||
      !RIGHTS.has(String(value.rightsCategory))) throw new Error('Dynamic source classification or rights metadata is invalid.')
  if (EXPECTED_TIER[String(value.sourceKind)] !== value.authorityTier) throw new Error('Dynamic source authority tier does not match its source kind.')
  if (!(value.contentDigestSha256 === null || (typeof value.contentDigestSha256 === 'string' && /^[a-f0-9]{64}$/.test(value.contentDigestSha256)))) {
    throw new Error('Dynamic source content digest must be null or a SHA-256 digest.')
  }
  if (value.sourceKind === 'LEARNER_COLLECTED' &&
      (!text(value.participantRole, 200) || value.consentRecorded !== true || value.rightsCategory !== 'LEARNER_COLLECTED_WITH_CONSENT')) {
    throw new Error('Learner-collected sources require participant role, consent, and the matching rights category.')
  }
  return Object.freeze({ ...value })
}

export function validateDynamicSocialSourceBundle(input: {
  readonly lessonRef: string
  readonly adultAttested: boolean
  readonly sources: readonly unknown[]
}): readonly DynamicSocialSourceMetadata[] {
  if (!/^ma-g3-social-studies-u09-l(?:0[1-9]|1[0-2])$/.test(input.lessonRef)) throw new Error('This lesson does not accept a dynamic source attachment.')
  if (input.adultAttested !== true) throw new Error('An authorized adult must attest to the complete metadata review.')
  if (!Array.isArray(input.sources) || input.sources.length < 2) throw new Error('At least two qualifying source metadata records are required for unit sufficiency.')
  const sources = Object.freeze(input.sources.map((source) => validateOne(source, input.lessonRef)))
  const issues = new Set(sources.map((source) => source.issueStatement))
  if (issues.size !== 1) throw new Error('All dynamic sources must address the same learner-authored issue statement.')
  if (!sources.some((source) => ['TIER_1_OFFICIAL_RECORD', 'TIER_3_INDEPENDENT_REPORTING'].includes(String(source.authorityTier)))) {
    throw new Error('The source set requires at least one official-record or independent-reporting authority.')
  }
  if (new Set(sources.map((source) => source.responsibleParty)).size < 2) throw new Error('The source set must include different responsible parties.')
  return sources
}
