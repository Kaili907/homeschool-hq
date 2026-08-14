export const HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF = 'ma-g3-social-studies-u09-l01' as const

function source(suffix: string, sourceKind: string, authorityTier: string, responsibleParty: string) {
  return Object.freeze({
    attachmentId: `attachment-${suffix}`,
    lessonRef: HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF,
    unitRef: 'ma-g3-social-studies-u09',
    issueStatement: 'How does a local budget choice affect families?',
    sourceIdentifier: `record-${suffix}`,
    sourceTitle: `Local budget source ${suffix}`,
    responsibleParty,
    sourceDate: '2026-08-12',
    sourceVersionOrEdition: null,
    retrievalLocation: `local-library:${suffix}`,
    retrievedOn: '2026-08-13',
    retrievedByRole: 'PARENT',
    retrievalStatus: 'OPENED_AND_READABLE',
    mediaType: 'text/html',
    language: 'English',
    sourceKind,
    authorityTier,
    authorityVerified: true,
    primaryOrSecondary: suffix === 'official' ? 'PRIMARY' : 'SECONDARY',
    primaryOrSecondaryReason: 'The source is classified from its relationship to the event.',
    interestDisclosure: 'The responsible party and potential interests are identified.',
    relevanceToIssue: 'The source directly addresses the learner-selected local budget issue.',
    limitsNoted: 'The source covers one jurisdiction and one reporting period.',
    rightsCategory: 'GOVERNMENT_RECORD',
    rightsStatement: 'Publicly accessible record or linked analysis used as metadata only.',
    publicAccess: true,
    selectedByRole: 'PARENT',
    selectedOn: '2026-08-13',
    readInFull: true,
    contentSafetyReviewedByRole: 'PARENT',
    readingLevelReviewedByRole: 'PARENT',
    previewedForSafetyAndLevel: true,
    containsLearnerPersonalData: false,
    containsOtherMinorPersonalData: false,
    quotedTextStored: false,
    contentDigestSha256: null,
  })
}

export function hostedSyncDynamicSourceMetadataFixture() {
  return Object.freeze([
    source('official', 'OFFICIAL_RECORD', 'TIER_1_OFFICIAL_RECORD', 'County office'),
    source('independent', 'INDEPENDENT_REPORTING', 'TIER_3_INDEPENDENT_REPORTING', 'Local newsroom'),
  ])
}
