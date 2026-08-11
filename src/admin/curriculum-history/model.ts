import type {
  CurriculumActivationCandidate,
  CurriculumActivationStatus,
} from '../curriculum-activation'
import type {
  CurriculumReleaseGovernanceEntry,
  CurriculumReleaseHistoryModel,
  CurriculumReleaseIntegrityState,
  CurriculumReleaseRegistrySummary,
  CurriculumRollbackEligibility,
} from './contracts'

function rollbackEligibility(
  candidate: CurriculumActivationCandidate | undefined,
): CurriculumRollbackEligibility {
  if (!candidate) return Object.freeze({
    state: 'unverified',
    blockingReason: 'pointer_evidence_unavailable',
    explanation: 'The current pointer projection did not provide rollback evidence for this published release.',
  })
  if (candidate.active) return Object.freeze({
    state: 'ineligible',
    blockingReason: 'current_release',
    explanation: 'This release is already current and cannot be selected as a rollback target.',
  })
  if (!candidate.previouslyActive) return Object.freeze({
    state: 'ineligible',
    blockingReason: 'not_previously_active',
    explanation: 'No pointer revision identifies this release as previously active.',
  })
  if (!candidate.eligible) return Object.freeze({
    state: 'ineligible',
    blockingReason: 'integrity_evidence_unavailable',
    explanation: 'Required immutable release artifacts or integrity evidence are unavailable.',
  })
  return Object.freeze({
    state: 'eligible',
    blockingReason: null,
    explanation: 'Previously active, published, and backed by the required immutable artifact evidence.',
  })
}

function integrityState(
  candidate: CurriculumActivationCandidate | undefined,
): CurriculumReleaseIntegrityState {
  if (!candidate) return 'unverified'
  return candidate.artifactState === 'available'
    ? 'verified_evidence_available'
    : 'evidence_unavailable'
}

function assertDeterministicHistory(
  releases: readonly CurriculumReleaseRegistrySummary[],
  activation: CurriculumActivationStatus,
): void {
  const releaseByVersion = new Map(releases.map((release) => [release.version, release]))
  const releaseVersions = new Set(releaseByVersion.keys())
  if (releaseVersions.size !== releases.length
    || !releaseVersions.has(activation.pointer.releaseVersion)
    || activation.candidates.some((candidate) => !releaseVersions.has(candidate.releaseVersion))
    || activation.history.some((entry) => !releaseVersions.has(entry.newReleaseVersion)
      || (entry.previousReleaseVersion !== null && !releaseVersions.has(entry.previousReleaseVersion)))) {
    throw new Error('curriculum_release_history_inconsistent')
  }

  const candidateVersions = new Set<string>()
  for (const candidate of activation.candidates) {
    if (candidateVersions.has(candidate.releaseVersion)) {
      throw new Error('curriculum_release_history_inconsistent')
    }
    candidateVersions.add(candidate.releaseVersion)
    const release = releaseByVersion.get(candidate.releaseVersion)
    if (!release || release.registeredAt !== candidate.registeredAt) {
      throw new Error('curriculum_release_history_inconsistent')
    }
  }

  for (let index = 0; index < activation.history.length - 1; index += 1) {
    const current = activation.history[index]
    const previous = activation.history[index + 1]
    if (current.pointerRevision !== previous.pointerRevision + 1
      || current.previousReleaseVersion !== previous.newReleaseVersion) {
      throw new Error('curriculum_release_history_inconsistent')
    }
  }
  const oldest = activation.history.at(-1)
  if (!activation.historyTruncated && (
    oldest?.pointerRevision !== 1
    || oldest.transitionKind !== 'migration_seed'
  )) throw new Error('curriculum_release_history_inconsistent')

  const activatedVersions = new Set(activation.history.map((entry) => entry.newReleaseVersion))
  for (const candidate of activation.candidates) {
    if (activatedVersions.has(candidate.releaseVersion)
      && !candidate.previouslyActive) {
      throw new Error('curriculum_release_history_inconsistent')
    }
  }
}

export function buildCurriculumReleaseHistoryModel(
  releases: readonly CurriculumReleaseRegistrySummary[],
  activation: CurriculumActivationStatus,
): CurriculumReleaseHistoryModel {
  assertDeterministicHistory(releases, activation)
  const candidates = new Map(
    activation.candidates.map((candidate) => [candidate.releaseVersion, candidate]),
  )
  const pointerRevisionsByVersion = new Map<string, number[]>()
  for (const transition of activation.history) {
    const revisions = pointerRevisionsByVersion.get(transition.newReleaseVersion) ?? []
    revisions.push(transition.pointerRevision)
    pointerRevisionsByVersion.set(transition.newReleaseVersion, revisions)
  }
  const entries: CurriculumReleaseGovernanceEntry[] = releases.map((release) => {
    const candidate = candidates.get(release.version)
    const pointerRevisions = pointerRevisionsByVersion.get(release.version) ?? []
    const lifecycle = candidate?.active
      ? 'active'
      : candidate?.previouslyActive ? 'previously_active' : 'published'
    const provenance = release.provenanceClass === 'legacy_import'
      ? {
        provenanceKind: 'legacy' as const,
        provenanceCompleteness: 'incomplete' as const,
        sourceCommit: release.sourceCommit,
        sourceRoot: release.sourceRoot,
        stagingId: null,
      }
      : {
        provenanceKind: 'staged_publish' as const,
        provenanceCompleteness: 'complete' as const,
        sourceCommit: null,
        sourceRoot: null,
        stagingId: release.stagingId,
      }
    return Object.freeze({
      packageId: release.packageId,
      version: release.version,
      publishedAt: release.registeredAt,
      authoredOn: release.authoredOn,
      publishedStatus: release.status,
      lifecycle,
      active: candidate?.active ?? false,
      previouslyActive: candidate?.previouslyActive ?? false,
      pointerRevisions: Object.freeze(pointerRevisions),
      integrityState: integrityState(candidate),
      provenanceEvidenceAvailable: true,
      ...provenance,
      baseReleaseVersion: null,
      rollbackEligibility: rollbackEligibility(candidate),
      counts: release.counts,
    })
  })
  entries.sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1
    return right.publishedAt.localeCompare(left.publishedAt) || right.version.localeCompare(left.version)
  })

  return Object.freeze({
    schemaVersion: 1,
    environment: 'production',
    authority: 'default_current_curriculum',
    activeReleaseVersion: activation.pointer.releaseVersion,
    pointerRevision: activation.pointer.revision,
    pointerTransitionKind: activation.pointer.transitionKind,
    pointerTransitionedAt: activation.pointer.transitionedAt,
    releases: Object.freeze(entries),
    transitions: Object.freeze(activation.history.map((entry) => Object.freeze({
      pointerRevision: entry.pointerRevision,
      previousReleaseVersion: entry.previousReleaseVersion,
      newReleaseVersion: entry.newReleaseVersion,
      transitionKind: entry.transitionKind,
      reasonCode: entry.reasonCode,
      transitionedAt: entry.transitionedAt,
    }))),
    historyTruncated: activation.historyTruncated,
  })
}
