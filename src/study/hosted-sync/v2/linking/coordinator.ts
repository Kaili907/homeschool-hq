import { buildFirstLinkManifest, digestFirstLinkPlan, requiredOperationIds } from './manifest'
import { buildFirstLinkPlan } from './plan'
import type {
  ExplicitStudentMappingChoice,
  FirstLinkApi,
  FirstLinkExecutionResult,
  FirstLinkInspection,
  FirstLinkManifest,
  FirstLinkPlan,
  FirstLinkProgressPort,
  FirstLinkReadback,
  LinkedHouseholdReceipt,
  LocalHouseholdForLink,
  LocalLinkCommitPort,
} from './types'

export interface PreparedFirstLinkReview {
  readonly local: LocalHouseholdForLink
  readonly inspection: FirstLinkInspection
  readonly choices: readonly ExplicitStudentMappingChoice[]
  readonly plan: FirstLinkPlan
  readonly planDigest: string
}

export interface FirstLinkCoordinatorOptions {
  readonly api: FirstLinkApi
  readonly readLocal: () => Promise<LocalHouseholdForLink>
  readonly progress: FirstLinkProgressPort
  readonly localCommit: LocalLinkCommitPort
  readonly now?: () => string
  readonly newAttemptId?: () => string
}

function defaultAttemptId(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error('Secure random identifiers are required for first-link import.')
  return globalThis.crypto.randomUUID()
}

function validInspection(inspection: FirstLinkInspection, now: string): boolean {
  if (
    inspection.authority.status !== 'authenticated-parent-household-authority' ||
    !inspection.authority.authorityRef || !inspection.authority.remoteHouseholdRef ||
    !Number.isFinite(Date.parse(inspection.authority.expiresAt)) ||
    Date.parse(inspection.authority.expiresAt) <= Date.parse(now) ||
    !Number.isSafeInteger(inspection.serverBaseRevision) || inspection.serverBaseRevision < 0
  ) return false
  const refs = inspection.remoteStudents.map((item) => item.remoteStudentRef)
  return refs.every(Boolean) && new Set(refs).size === refs.length
}

function failure(
  code: Extract<FirstLinkExecutionResult, { status: 'failed' }>['code'],
  message: string,
  resumable: boolean,
): FirstLinkExecutionResult {
  return Object.freeze({ status: 'failed', code, message, resumable })
}

export function verifyFirstLinkReadback(
  manifest: FirstLinkManifest,
  readback: FirstLinkReadback,
): boolean {
  if (
    readback.status !== 'complete' ||
    readback.attemptId !== manifest.attemptId ||
    readback.manifestDigest !== manifest.manifestDigest ||
    readback.remoteHouseholdRef !== manifest.household.remoteHouseholdRef ||
    !Number.isSafeInteger(readback.serverRevision) ||
    readback.serverRevision < manifest.serverBaseRevisionSeed
  ) return false

  const expectedOperations = requiredOperationIds(manifest)
  const actualOperations = [...readback.appliedOperationIds].sort()
  if (
    new Set(actualOperations).size !== actualOperations.length ||
    expectedOperations.length !== actualOperations.length ||
    expectedOperations.some((item, index) => item !== actualOperations[index])
  ) return false
  if (manifest.students.length !== readback.students.length) return false

  const remoteStudentRefs = new Set<string>()
  const remoteAssignmentRefs = new Set<string>()
  const remoteSessionRefs = new Set<string>()
  for (const expected of manifest.students) {
    const matches = readback.students.filter((item) => item.localStudentRef === expected.localStudentRef)
    if (matches.length !== 1) return false
    const actual = matches[0]!
    if (!actual.remoteStudentRef || remoteStudentRefs.has(actual.remoteStudentRef)) return false
    remoteStudentRefs.add(actual.remoteStudentRef)
    if (expected.remoteStudentRef !== null && actual.remoteStudentRef !== expected.remoteStudentRef) return false
    if (expected.assignments.length !== actual.assignments.length) return false
    for (const assignment of expected.assignments) {
      const mapped = actual.assignments.filter(
        (item) => item.localAssignmentRef === assignment.localAssignmentRef,
      )
      if (mapped.length !== 1 || !mapped[0]!.remoteAssignmentRef) return false
      if (assignment.remoteAssignmentRef !== null && mapped[0]!.remoteAssignmentRef !== assignment.remoteAssignmentRef) {
        return false
      }
      if (remoteAssignmentRefs.has(mapped[0]!.remoteAssignmentRef)) return false
      remoteAssignmentRefs.add(mapped[0]!.remoteAssignmentRef)
    }
    const sessions = expected.studyDocument.sessions
    if (sessions.length !== actual.sessions.length) return false
    for (const session of sessions) {
      const mapped = actual.sessions.filter((item) => item.localSessionRef === session.localSessionRef)
      if (mapped.length !== 1 || !mapped[0]!.remoteSessionRef) return false
      if (session.remoteSessionRef !== null && mapped[0]!.remoteSessionRef !== session.remoteSessionRef) return false
      if (remoteSessionRefs.has(mapped[0]!.remoteSessionRef)) return false
      remoteSessionRefs.add(mapped[0]!.remoteSessionRef)
    }
  }
  return true
}

export class FirstLinkCoordinator {
  readonly #options: FirstLinkCoordinatorOptions
  readonly #now: () => string
  readonly #newAttemptId: () => string

  constructor(options: FirstLinkCoordinatorOptions) {
    this.#options = options
    this.#now = options.now ?? (() => new Date().toISOString())
    this.#newAttemptId = options.newAttemptId ?? defaultAttemptId
  }

  async prepare(
    choices: readonly ExplicitStudentMappingChoice[] = [],
  ): Promise<PreparedFirstLinkReview> {
    const [local, inspection] = await Promise.all([
      this.#options.readLocal(),
      this.#options.api.inspect(),
    ])
    if (!validInspection(inspection, this.#now())) {
      throw new Error('Explicit authenticated Parent household authority is required.')
    }
    const plan = buildFirstLinkPlan(local, inspection, choices)
    return Object.freeze({
      local,
      inspection,
      choices: Object.freeze([...choices]),
      plan,
      planDigest: await digestFirstLinkPlan(plan, local),
    })
  }

  async execute(
    prepared: PreparedFirstLinkReview,
    approved: boolean,
  ): Promise<FirstLinkExecutionResult> {
    if (!prepared.plan.readyForParentConfirmation) {
      return failure('PLAN_NOT_READY', 'Resolve every student and conflict before linking.', false)
    }
    if (!approved) {
      return failure('PARENT_CONFIRMATION_REQUIRED', 'The Parent must explicitly approve the displayed link plan.', false)
    }
    if (!validInspection(prepared.inspection, this.#now())) {
      return failure('AUTHORITY_REQUIRED', 'Authenticated Parent household authority expired.', false)
    }

    const fresh = await this.#options.readLocal()
    const freshPlan = buildFirstLinkPlan(fresh, prepared.inspection, prepared.choices)
    const freshDigest = await digestFirstLinkPlan(freshPlan, fresh)
    if (freshDigest !== prepared.planDigest) {
      return failure('LOCAL_STATE_CHANGED', 'Local Family Pilot state changed after review. Review a new plan.', false)
    }

    const held = await this.#options.progress.load(fresh.localHouseholdRef)
    let manifest: FirstLinkManifest
    if (held) {
      if (held.manifest.confirmation.planDigest !== prepared.planDigest) {
        return failure('LOCAL_STATE_CHANGED', 'A different confirmed import is already pending.', true)
      }
      manifest = held.manifest
    } else {
      const confirmation = Object.freeze({
        confirmationVersion: 1 as const,
        approved: true as const,
        confirmedAt: this.#now(),
        planDigest: prepared.planDigest,
      })
      manifest = await buildFirstLinkManifest({
        attemptId: this.#newAttemptId(),
        plan: freshPlan,
        local: fresh,
        confirmation,
      })
      try {
        await this.#options.progress.savePending(Object.freeze({ status: 'pending', manifest }))
      } catch {
        return failure('LOCAL_COMMIT_FAILED', 'The resumable link record could not be saved; nothing was uploaded.', false)
      }
    }
    return this.#applyAndVerify(manifest)
  }

  async resume(localHouseholdRef: string): Promise<FirstLinkExecutionResult> {
    const pending = await this.#options.progress.load(localHouseholdRef)
    if (!pending) return failure('PLAN_NOT_READY', 'There is no pending first-link import to resume.', false)
    let authority: FirstLinkInspection
    try {
      authority = await this.#options.api.inspect()
    } catch {
      return failure('NETWORK_FAILURE', 'Parent authority could not be verified. The pending import is unchanged.', true)
    }
    if (
      !validInspection(authority, this.#now()) ||
      authority.authority.remoteHouseholdRef !== pending.manifest.household.remoteHouseholdRef
    ) return failure('AUTHORITY_REQUIRED', 'Authenticated authority for the exact pending household is required.', true)
    const local = await this.#options.readLocal()
    if (local.localHouseholdRef !== localHouseholdRef) {
      return failure('LOCAL_STATE_CHANGED', 'The pending import belongs to a different local household.', true)
    }
    return this.#applyAndVerify(pending.manifest)
  }

  async #applyAndVerify(manifest: FirstLinkManifest): Promise<FirstLinkExecutionResult> {
    let readback: FirstLinkReadback
    try {
      const applied = await this.#options.api.apply(manifest)
      if (applied.status === 'conflict') {
        try {
          await this.#options.progress.clearPending(manifest.household.localHouseholdRef, manifest.attemptId)
        } catch {
          return failure('LOCAL_COMMIT_FAILED', 'Hosted state changed and the stale pending plan could not be cleared.', true)
        }
        return failure('REMOTE_STATE_CHANGED', 'Hosted state changed after review. Nothing was overwritten; review a new plan.', false)
      }
      readback = await this.#options.api.readback(manifest.attemptId)
    } catch {
      return failure('NETWORK_FAILURE', 'The hosted import could not be confirmed. Local Family Pilot state is unchanged.', true)
    }
    if (readback.status !== 'complete') {
      return failure('REMOTE_IMPORT_INCOMPLETE', 'The hosted import is partial and can be resumed safely.', true)
    }
    if (!verifyFirstLinkReadback(manifest, readback)) {
      return failure('READBACK_MISMATCH', 'Hosted readback did not confirm the exact required mapping.', true)
    }
    const receipt: LinkedHouseholdReceipt = Object.freeze({
      localHouseholdRef: manifest.household.localHouseholdRef,
      remoteHouseholdRef: manifest.household.remoteHouseholdRef,
      attemptId: manifest.attemptId,
      manifestDigest: manifest.manifestDigest,
      serverRevision: readback.serverRevision,
      students: Object.freeze([...readback.students]),
      confirmedAt: manifest.confirmation.confirmedAt,
    })
    try {
      await this.#options.localCommit.commitVerifiedLink(receipt)
    } catch {
      return failure('LOCAL_COMMIT_FAILED', 'Hosted import is verified, but the local link receipt was not saved. Retry is safe.', true)
    }
    try {
      await this.#options.progress.clearPending(manifest.household.localHouseholdRef, manifest.attemptId)
    } catch {
      // The verified immutable receipt is authoritative. A leftover pending
      // sidecar can only replay the same idempotent operations and receipt.
    }
    return Object.freeze({ status: 'linked', receipt })
  }
}
