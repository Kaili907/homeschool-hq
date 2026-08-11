import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { AdminCapability } from '../contracts'
import {
  CurriculumActivationError,
  type CurriculumActivationCandidate,
  type CurriculumActivationSource,
  type CurriculumActivationStatus,
  type CurriculumPointerTransitionKind,
} from '../curriculum-activation'
import './curriculum-activation.css'

export interface CurriculumActivationAuthorization {
  readonly status: 'authorized' | 'denied'
  readonly capabilities?: readonly AdminCapability[]
}

type SurfaceError =
  | 'authorization'
  | 'pointer-conflict'
  | 'idempotency-conflict'
  | 'target-not-published'
  | 'artifacts-unavailable'
  | 'kind-conflict'
  | 'unavailable'

export function CurriculumActivationControl({
  authorization,
  source,
}: {
  readonly authorization: CurriculumActivationAuthorization
  readonly source: CurriculumActivationSource
}) {
  const canRead = authorization.status === 'authorized'
    && authorization.capabilities?.includes('curriculum:read') === true
  const canManage = authorization.status === 'authorized'
    && authorization.capabilities?.includes('releases:manage') === true
  const [status, setStatus] = useState<CurriculumActivationStatus | null>(null)
  const [confirmation, setConfirmation] = useState<CurriculumActivationCandidate | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<SurfaceError | null>(null)
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    if (!canRead) {
      setStatus(null)
      setError('authorization')
      return
    }
    let current = true
    setError(null)
    void source.read().then(
      (next) => {
        if (current) setStatus(next)
      },
      () => {
        if (current) setError('unavailable')
      },
    )
    return () => { current = false }
  }, [canRead, reload, source])

  function requestTransition(candidate: CurriculumActivationCandidate) {
    setConfirmation(candidate)
    setAcknowledged(false)
    setError(null)
    setResult(null)
  }

  async function confirmTransition() {
    if (!status || !confirmation || !canManage || !acknowledged || busy) return
    const transitionKind: CurriculumPointerTransitionKind = confirmation.previouslyActive
      ? 'rollback' : 'activation'
    setBusy(true)
    setError(null)
    try {
      const next = await source.transition({
        targetReleaseVersion: confirmation.releaseVersion,
        expectedPointerRevision: status.pointer.revision,
        transitionKind,
        reasonCode: transitionKind === 'activation'
          ? 'release.activated' : 'release.rolled_back',
        idempotencyKey: crypto.randomUUID(),
      })
      setStatus(next)
      setConfirmation(null)
      setAcknowledged(false)
      setResult(next.transition.state === 'no_op'
        ? `Release ${next.transition.newReleaseVersion} was already active. No pointer revision was added.`
        : `${transitionKind === 'activation' ? 'Activated' : 'Rolled back to'} release ${next.transition.newReleaseVersion} at pointer revision ${next.transition.pointerRevision}.`)
    } catch (reason) {
      if (reason instanceof CurriculumActivationError) {
        setError(reason.reason ?? (reason.code === 'forbidden' ? 'authorization' : 'unavailable'))
      } else {
        setError('unavailable')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <CurriculumActivationView
      status={status}
      canManage={canManage}
      busy={busy}
      error={error}
      result={result}
      confirmation={confirmation}
      acknowledged={acknowledged}
      onAcknowledge={setAcknowledged}
      onRequestTransition={requestTransition}
      onCancel={() => {
        setConfirmation(null)
        setAcknowledged(false)
      }}
      onConfirm={() => { void confirmTransition() }}
      onRefresh={() => setReload((value) => value + 1)}
    />
  )
}

export function CurriculumActivationView({
  status,
  canManage,
  busy,
  error,
  result,
  confirmation,
  acknowledged,
  onAcknowledge,
  onRequestTransition,
  onCancel,
  onConfirm,
  onRefresh,
}: {
  readonly status: CurriculumActivationStatus | null
  readonly canManage: boolean
  readonly busy: boolean
  readonly error: SurfaceError | null
  readonly result: string | null
  readonly confirmation: CurriculumActivationCandidate | null
  readonly acknowledged: boolean
  readonly onAcknowledge: (value: boolean) => void
  readonly onRequestTransition: (candidate: CurriculumActivationCandidate) => void
  readonly onCancel: () => void
  readonly onConfirm: () => void
  readonly onRefresh: () => void
}) {
  const candidates = status?.candidates ?? []
  const confirmationRef = useRef<HTMLElement>(null)
  const confirmationTriggerRef = useRef<HTMLButtonElement | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const activationHeadingRef = useRef<HTMLHeadingElement>(null)
  const confirmationWasOpenRef = useRef(false)

  useEffect(() => {
    if (confirmation) {
      confirmationWasOpenRef.current = true
      cancelButtonRef.current?.focus()
      return
    }
    if (!confirmationWasOpenRef.current) return
    confirmationWasOpenRef.current = false
    globalThis.setTimeout(() => {
      const trigger = confirmationTriggerRef.current
      if (trigger?.isConnected) trigger.focus()
      else activationHeadingRef.current?.focus()
    }, 0)
  }, [confirmation])

  function handleConfirmationKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(confirmationRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
    ) ?? [])
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <section className="curriculum-activation" aria-labelledby="curriculum-activation-title">
      <header className="curriculum-activation-header">
        <div>
          <p className="curriculum-studio-eyebrow">Default authority control plane</p>
          <h2 ref={activationHeadingRef} id="curriculum-activation-title" tabIndex={-1}>Activation &amp; Rollback</h2>
          <p>Only immutable, artifact-complete PUBLISHED releases are eligible.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={busy}>Refresh authority</button>
      </header>

      <div className="curriculum-activation-warning" role="note">
        <strong>Existing learner pins do not change.</strong>{' '}
        This changes the default/current curriculum authority but DOES NOT repin existing learners.
        A separate governed migration is required to change any Profile.academy.releaseVersion.
      </div>

      {error && <ActivationError error={error} onRefresh={onRefresh} />}
      {result && <p className="curriculum-activation-result" role="status">{result}</p>}

      {!status && !error && (
        <p className="curriculum-activation-state" role="status">Loading current pointer authority…</p>
      )}

      {status && (
        <>
          <dl className="curriculum-pointer-facts">
            <div><dt>Current active release</dt><dd>{status.pointer.releaseVersion}</dd></div>
            <div><dt>Pointer revision</dt><dd>{status.pointer.revision}</dd></div>
            <div><dt>Last transition</dt><dd>{labelKind(status.pointer.transitionKind)}</dd></div>
            <div><dt>Binding</dt><dd>{status.pointer.bindingMode === 'default_authority' ? 'Default authority' : 'Registry seed'}</dd></div>
          </dl>

          {!canManage && (
            <p className="curriculum-activation-permission" role="status">
              View only. The exact releases:manage capability is required for activation or rollback.
            </p>
          )}

          <section className="curriculum-candidates" aria-labelledby="curriculum-candidates-title">
            <div className="curriculum-activation-section-heading">
              <div>
                <p>Immutable registry</p>
                <h3 id="curriculum-candidates-title">Published candidate releases</h3>
              </div>
              <span>{candidates.length} published</span>
            </div>
            <ul>
              {candidates.map((candidate) => {
                const kind = candidate.previouslyActive ? 'rollback' : 'activation'
                const lifecycle = candidate.active
                  ? 'ACTIVE'
                  : candidate.previouslyActive
                    ? `PREVIOUSLY ACTIVE · ${candidate.eligible ? 'ROLLBACK ELIGIBLE' : 'ROLLBACK BLOCKED'}`
                    : `PUBLISHED, NOT ACTIVE · ${candidate.eligible ? 'ACTIVATION ELIGIBLE' : 'ACTIVATION BLOCKED'}`
                return (
                  <li key={candidate.releaseVersion}>
                    <div>
                      <strong>{candidate.releaseVersion}</strong>
                      <span>{lifecycle}</span>
                      <span>{candidate.status.toUpperCase()} · artifacts {candidate.artifactState}</span>
                    </div>
                    {candidate.active ? (
                      <span className="curriculum-candidate-active">ACTIVE</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canManage || busy || !candidate.eligible}
                        onClick={(event) => {
                          confirmationTriggerRef.current = event.currentTarget
                          onRequestTransition(candidate)
                        }}
                      >
                        {kind === 'rollback' ? 'Rollback to this release' : 'Activate this release'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="curriculum-activation-history" aria-labelledby="curriculum-history-title">
            <div className="curriculum-activation-section-heading">
              <div><p>Append-only history</p><h3 id="curriculum-history-title">Pointer revisions</h3></div>
              <span>{status.historyTruncated ? 'Latest 100' : `${status.history.length} total`}</span>
            </div>
            <ol>
              {status.history.map((entry) => (
                <li key={entry.pointerRevision}>
                  <strong>Revision {entry.pointerRevision}</strong>
                  <span>{labelKind(entry.transitionKind)}</span>
                  <span>{entry.previousReleaseVersion ?? 'No prior pointer'} → {entry.newReleaseVersion}</span>
                  <span>{entry.reasonCode ?? 'migration seed'}</span>
                  <time dateTime={entry.transitionedAt}>{new Date(entry.transitionedAt).toLocaleString()}</time>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {status && confirmation && (
        <section
          ref={confirmationRef}
          className="curriculum-activation-confirmation"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="curriculum-transition-confirm-title"
          aria-describedby="curriculum-transition-confirm-description curriculum-transition-confirm-reason"
          onKeyDown={handleConfirmationKeyDown}
        >
          <div className="curriculum-activation-confirmation__panel">
            <p className="curriculum-studio-eyebrow">Final confirmation</p>
            <h3 id="curriculum-transition-confirm-title">
              {confirmation.previouslyActive ? 'Confirm rollback' : 'Confirm activation'} to {confirmation.releaseVersion}
            </h3>
            <p id="curriculum-transition-confirm-description">
              This will compare-and-swap production pointer revision {status.pointer.revision} and create
              a new auditable revision. It will not delete or mutate release {status.pointer.releaseVersion}.
            </p>
            <p id="curriculum-transition-confirm-reason"><strong>Reason:</strong>{' '}
              {confirmation.previouslyActive ? 'release.rolled_back' : 'release.activated'}
            </p>
            <label>
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={busy}
                onChange={(event) => onAcknowledge(event.target.checked)}
              />
              I understand this changes the default authority and DOES NOT repin existing learners.
            </label>
            <div className="curriculum-activation-confirmation__actions">
              <button ref={cancelButtonRef} type="button" className="is-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
              <button type="button" onClick={onConfirm} disabled={!acknowledged || busy}>
                {busy ? 'Submitting governed transition…'
                  : confirmation.previouslyActive ? 'Confirm rollback' : 'Confirm activation'}
              </button>
            </div>
          </div>
        </section>
      )}
    </section>
  )
}

function ActivationError({ error, onRefresh }: { readonly error: SurfaceError; readonly onRefresh: () => void }) {
  const messages: Record<SurfaceError, string> = {
    authorization: 'Authorization unavailable. curriculum:read is required to inspect and releases:manage is required to transition.',
    'pointer-conflict': 'Stale pointer revision: another transition won the compare-and-swap. Refresh before retrying.',
    'idempotency-conflict': 'That request identity was already used with different transition inputs.',
    'target-not-published': 'The selected target is not an immutable PUBLISHED release.',
    'artifacts-unavailable': 'The published target is missing required immutable artifacts or validation evidence.',
    'kind-conflict': 'The requested activation/rollback kind does not match the target’s pointer history.',
    unavailable: 'The activation and rollback authority is unavailable. No pointer transition occurred.',
  }
  return (
    <div className="curriculum-activation-error" role="alert">
      <strong>Transition unavailable</strong>
      <p>{messages[error]}</p>
      <button type="button" onClick={onRefresh}>Refresh current pointer</button>
    </div>
  )
}

function labelKind(kind: 'migration_seed' | CurriculumPointerTransitionKind): string {
  if (kind === 'migration_seed') return 'Migration seed'
  return kind === 'activation' ? 'Activation' : 'Rollback'
}
