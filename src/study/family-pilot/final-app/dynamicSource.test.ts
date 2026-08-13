import { describe, expect, it } from 'vitest'
import { validateDynamicSocialSourceBundle } from './dynamicSource'

const lessonRef = 'ma-g3-social-studies-u09-l01'

function source(suffix: string, sourceKind: string, authorityTier: string, responsibleParty: string) {
  return {
    attachmentId: `attachment-${suffix}`, lessonRef, unitRef: 'ma-g3-social-studies-u09',
    issueStatement: 'How does a local budget choice affect families?', sourceIdentifier: `record-${suffix}`,
    sourceTitle: `Local budget source ${suffix}`, responsibleParty, sourceDate: '2026-08-12',
    sourceVersionOrEdition: null, retrievalLocation: `local-library:${suffix}`, retrievedOn: '2026-08-13',
    retrievedByRole: 'PARENT', retrievalStatus: 'OPENED_AND_READABLE', mediaType: 'text/html', language: 'English',
    sourceKind, authorityTier, authorityVerified: true, primaryOrSecondary: suffix === 'official' ? 'PRIMARY' : 'SECONDARY',
    primaryOrSecondaryReason: 'The learner classified the source from its relationship to the event.',
    interestDisclosure: 'The responsible party and potential interests are identified.',
    relevanceToIssue: 'The source directly addresses the learner-selected local budget issue.',
    limitsNoted: 'The source covers one jurisdiction and one reporting period.', rightsCategory: 'GOVERNMENT_RECORD',
    rightsStatement: 'Publicly accessible record or linked analysis used as metadata only.', publicAccess: true,
    selectedByRole: 'PARENT', selectedOn: '2026-08-13', readInFull: true,
    contentSafetyReviewedByRole: 'PARENT', readingLevelReviewedByRole: 'PARENT', previewedForSafetyAndLevel: true,
    containsLearnerPersonalData: false, containsOtherMinorPersonalData: false, quotedTextStored: false,
    contentDigestSha256: null,
  }
}

function valid() {
  return [
    source('official', 'OFFICIAL_RECORD', 'TIER_1_OFFICIAL_RECORD', 'County office'),
    source('independent', 'INDEPENDENT_REPORTING', 'TIER_3_INDEPENDENT_REPORTING', 'Local newsroom'),
  ]
}

describe('dynamic Social source acceptance contract', () => {
  it('accepts only a complete, adult-attested, unit-sufficient metadata-only bundle', () => {
    expect(validateDynamicSocialSourceBundle({ lessonRef, adultAttested: true, sources: valid() })).toHaveLength(2)
  })

  it('rejects trivial metadata, missing adult authority, and source-body fields', () => {
    expect(() => validateDynamicSocialSourceBundle({ lessonRef, adultAttested: true, sources: [{ sourceTitle: 'trivial' }] })).toThrow()
    expect(() => validateDynamicSocialSourceBundle({ lessonRef, adultAttested: false, sources: valid() })).toThrow(/adult/i)
    const leaked = valid()
    ;(leaked[0] as Record<string, unknown>).sourceBody = 'Forbidden source text'
    expect(() => validateDynamicSocialSourceBundle({ lessonRef, adultAttested: true, sources: leaked })).toThrow(/unapproved field|source body/i)
  })

  it('rejects cross-lesson, mismatched authority, and insufficient authority bundles', () => {
    const crossLesson = valid()
    crossLesson[0].lessonRef = 'ma-g3-social-studies-u09-l02'
    expect(() => validateDynamicSocialSourceBundle({ lessonRef, adultAttested: true, sources: crossLesson })).toThrow(/exact lesson/i)
    const mismatch = valid()
    mismatch[0].authorityTier = 'TIER_2_PARTY_STATEMENT'
    expect(() => validateDynamicSocialSourceBundle({ lessonRef, adultAttested: true, sources: mismatch })).toThrow(/does not match/i)
    const weak = [
      source('party-a', 'PARTY_STATEMENT', 'TIER_2_PARTY_STATEMENT', 'Party A'),
      source('party-b', 'PARTY_STATEMENT', 'TIER_2_PARTY_STATEMENT', 'Party B'),
    ]
    expect(() => validateDynamicSocialSourceBundle({ lessonRef, adultAttested: true, sources: weak })).toThrow(/official-record|independent-reporting/i)
  })
})
