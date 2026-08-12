import { useCallback, useEffect, useRef, useState } from 'react'
import { projectFamilyPilotDiagnostics, type FamilyPilotSnapshot } from '../core'

// FAMILY-PILOT-RECOVERY: a plain-language status/recovery screen over the
// snapshot Core already computes (see ../core/store.ts). This file owns no
// persistence of its own — it only explains `snapshot.status` /
// `snapshot.reasonCode` and forwards user choices to host-supplied callbacks.

/**
 * Host-supplied actions. Every field is optional: the screen renders a
 * control only for the actions the host actually wires up, and never invents
 * a fallback behaviour of its own.
 */
export interface FamilyPilotRecoveryActions {
  readonly retry?: () => void
  readonly resetLocalPilot?: () => void
  readonly exportBackup?: () => void
  readonly restoreBackup?: () => void
  readonly continueReadOnly?: () => void
  readonly returnHome?: () => void
}

export interface FamilyPilotRecoveryScreenProps {
  readonly snapshot: FamilyPilotSnapshot
  readonly actions?: FamilyPilotRecoveryActions
  /** Off by default: diagnostics are shown only when a host explicitly opts in. */
  readonly showDiagnostics?: boolean
}

interface RecoveryCopy {
  readonly heading: string
  readonly body: string
  /** Amber vs. calm styling. */
  readonly attention: boolean
  /** 'alert' interrupts (a real problem); 'status' is announced politely. */
  readonly role: 'alert' | 'status'
}

function recoveryCopy({ status, reasonCode }: FamilyPilotSnapshot): RecoveryCopy {
  if (status === 'ready') {
    return {
      heading: 'Everything is working normally',
      body: 'Family Pilot can read and save progress on this device.',
      attention: false,
      role: 'status',
    }
  }
  if (status === 'recovered') {
    return {
      heading: 'Saved data could not be read',
      body: "This device's saved pilot data could not be read, so a fresh, empty "
        + 'copy is in use. The unreadable copy has been kept on this device for '
        + 'troubleshooting — nothing has been erased and nothing was sent anywhere.',
      attention: true,
      role: 'alert',
    }
  }
  if (status === 'read-only') {
    // Nothing is broken here — this build is simply older than the saved data.
    // A calm status, not an interrupting alert, keeps that distinction honest.
    return {
      heading: 'Data from a newer app version',
      body: 'This device has pilot data saved by a newer version of the app. It has '
        + 'been left untouched and cannot be changed here. Update the app to use it, '
        + 'or continue without saving changes.',
      attention: true,
      role: 'status',
    }
  }
  if (reasonCode === 'storage-write-failed') {
    return {
      heading: "Your last change wasn't saved",
      body: 'The last save could not be completed. Your work on this page is still '
        + 'visible, but it has not been saved.',
      attention: true,
      role: 'alert',
    }
  }
  return {
    heading: 'Local storage is unavailable',
    body: 'This device is not allowing local saving, so pilot work will not be kept '
      + 'after you close this page.',
    attention: true,
    role: 'alert',
  }
}

/** Actions that overwrite or discard device-local data and so require confirmation. */
type DestructiveActionKey = 'resetLocalPilot' | 'restoreBackup'

const DESTRUCTIVE_COPY: Record<DestructiveActionKey, { readonly label: string; readonly warning: string; readonly confirmLabel: string }> = {
  resetLocalPilot: {
    label: 'Reset pilot data on this device',
    warning: 'This will permanently erase pilot data stored on this device. This cannot be undone.',
    confirmLabel: 'Yes, erase this device’s pilot data',
  },
  restoreBackup: {
    label: 'Restore from backup',
    warning: 'This will replace the pilot data currently on this device with the backup. This cannot be undone.',
    confirmLabel: 'Yes, restore and replace this device’s pilot data',
  },
}

export function FamilyPilotRecoveryScreen({
  snapshot,
  actions = {},
  showDiagnostics = false,
}: FamilyPilotRecoveryScreenProps) {
  const copy = recoveryCopy(snapshot)
  const [pendingConfirm, setPendingConfirm] = useState<DestructiveActionKey | null>(null)

  // A pending confirmation belongs to the state it was raised against. If the
  // underlying snapshot changes underneath it (a retry, another tab's write),
  // an already-armed dialog must not survive into a state the user never
  // clicked into.
  useEffect(() => {
    setPendingConfirm(null)
  }, [snapshot.status, snapshot.reasonCode])

  const cancelConfirm = useCallback(() => setPendingConfirm(null), [])
  const commitConfirm = useCallback(() => {
    if (pendingConfirm === 'resetLocalPilot') actions.resetLocalPilot?.()
    else if (pendingConfirm === 'restoreBackup') actions.restoreBackup?.()
    setPendingConfirm(null)
  }, [pendingConfirm, actions])

  // A build that cannot read a newer schema must never let this screen erase
  // or overwrite it — regardless of which callbacks a host happens to pass.
  const canOfferDestructive = snapshot.status !== 'read-only'

  const statusRef = useRef<HTMLDivElement>(null)
  const attention = copy.attention
  useEffect(() => {
    if (attention) statusRef.current?.focus()
  }, [snapshot.status, snapshot.reasonCode, attention])

  return (
    <main className="study-runtime-host min-h-screen bg-slate-50 p-6 text-slate-900">
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold" tabIndex={-1}>Family Pilot</h1>

        <div
          ref={statusRef}
          tabIndex={-1}
          className={`mt-4 rounded-lg border p-3 ${
            copy.attention ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'
          }`}
          role={copy.role}
        >
          <p className="font-extrabold">{copy.heading}</p>
          <p className="mt-1 font-semibold text-slate-700">{copy.body}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {actions.retry && (
            <button
              type="button"
              className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
              onClick={actions.retry}
            >
              Try again
            </button>
          )}
          {actions.continueReadOnly && (
            <button
              type="button"
              className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
              onClick={actions.continueReadOnly}
            >
              Continue without saving
            </button>
          )}
          {actions.exportBackup && (
            <button
              type="button"
              className="min-h-11 rounded-lg border border-cyan-800 bg-white px-4 py-2 font-bold text-cyan-900"
              onClick={actions.exportBackup}
            >
              Export a backup
            </button>
          )}
          {actions.returnHome && (
            <button
              type="button"
              className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
              onClick={actions.returnHome}
            >
              Return home
            </button>
          )}
        </div>

        {canOfferDestructive && actions.restoreBackup && (
          <DestructiveAction
            actionKey="restoreBackup"
            pending={pendingConfirm === 'restoreBackup'}
            onRequest={() => setPendingConfirm('restoreBackup')}
            onCancel={cancelConfirm}
            onConfirm={commitConfirm}
          />
        )}

        {canOfferDestructive && actions.resetLocalPilot && (
          <DestructiveAction
            actionKey="resetLocalPilot"
            pending={pendingConfirm === 'resetLocalPilot'}
            onRequest={() => setPendingConfirm('resetLocalPilot')}
            onCancel={cancelConfirm}
            onConfirm={commitConfirm}
          />
        )}

        {showDiagnostics && <FamilyPilotRecoveryDiagnostics snapshot={snapshot} />}
      </section>
    </main>
  )
}

function DestructiveAction({
  actionKey,
  pending,
  onRequest,
  onCancel,
  onConfirm,
}: {
  readonly actionKey: DestructiveActionKey
  readonly pending: boolean
  readonly onRequest: () => void
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  const copy = DESTRUCTIVE_COPY[actionKey]
  const triggerRef = useRef<HTMLButtonElement>(null)
  const warningRef = useRef<HTMLDivElement>(null)
  const wasPending = useRef(pending)
  useEffect(() => {
    if (pending && !wasPending.current) warningRef.current?.focus()
    if (!pending && wasPending.current) triggerRef.current?.focus()
    wasPending.current = pending
  }, [pending])

  if (!pending) {
    return (
      <div className="mt-3">
        <button
          ref={triggerRef}
          type="button"
          className="min-h-11 rounded-lg border border-rose-400 bg-white px-4 py-2 font-bold text-rose-800"
          data-recovery-action={actionKey}
          onClick={onRequest}
        >
          {copy.label}
        </button>
      </div>
    )
  }
  return (
    <div
      ref={warningRef}
      tabIndex={-1}
      className="mt-3 rounded-lg border border-rose-400 bg-rose-50 p-3"
      role="alert"
      data-recovery-confirm={actionKey}
    >
      <p className="font-semibold text-rose-900">{copy.warning}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-lg border border-rose-700 bg-rose-700 px-4 py-2 font-extrabold text-white"
          onClick={onConfirm}
        >
          {copy.confirmLabel}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * Explicit allow-list rather than a generic dump of the Core projection: a
 * diagnostics field added to Core later (e.g. a future free-text field) must
 * not appear here automatically just because it exists on the view.
 */
function FamilyPilotRecoveryDiagnostics({ snapshot }: { readonly snapshot: FamilyPilotSnapshot }) {
  const view = projectFamilyPilotDiagnostics(snapshot)
  const rows: readonly (readonly [string, string])[] = [
    ['Schema version', String(view.schemaVersion)],
    ['Storage status', view.storageStatus],
    ['Reason', view.reasonCode ?? '—'],
    ['Students on this device', String(view.studentCount)],
    ['Active student ref', view.activeStudentRef ?? '—'],
    ['Active assignment ref', view.activeAssignmentRef ?? '—'],
    ['Active session ref', view.activeSessionRef ?? '—'],
    ['Last updated', view.updatedAt],
  ]
  return (
    <section
      className="mt-6 rounded-lg border border-slate-300 bg-slate-50 p-3"
      aria-labelledby="family-pilot-recovery-diagnostics"
      data-testid="family-pilot-recovery-diagnostics"
    >
      <h2 id="family-pilot-recovery-diagnostics" className="font-extrabold">Diagnostics</h2>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-semibold text-slate-600">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
