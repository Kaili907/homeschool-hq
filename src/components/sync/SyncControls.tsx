import { useEffect, useState } from 'react'
import type { SyncApi } from '../../sync/useSync'
import type {
  ConflictChoice,
  ReconciliationCategory,
  ReconciliationPreview,
  SyncDecision,
} from '../../sync/types'

const card = 'rounded-xl border border-slate-200 bg-white p-4'
const btn =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryBtn =
  'rounded-lg border border-slate-800 bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
const input =
  'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none'

const fmt = (ms: number | null): string =>
  ms == null ? 'never' : new Date(ms).toLocaleString()

const categoryLabel: Record<ReconciliationCategory, string> = {
  'local-only': 'Only on this device',
  'cloud-only': 'Only in this household cloud',
  'local-changed': 'Changed on this device',
  'cloud-changed': 'Changed in the cloud',
  'both-changed': 'Changed in both places — choose a copy',
  unchanged: 'Same in both places',
}

function Preview({
  preview,
  choices,
  onChoice,
}: {
  preview: ReconciliationPreview
  choices: Record<string, ConflictChoice>
  onChoice: (id: string, choice: ConflictChoice) => void
}) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <ul className="space-y-2">
        {preview.profiles.map((profile) => (
          <li key={profile.id} className="rounded-lg bg-white px-3 py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">
                {profile.name}
              </span>
              <span
                className={`text-xs font-semibold ${
                  profile.category === 'both-changed'
                    ? 'text-rose-700'
                    : profile.category === 'unchanged'
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                }`}
              >
                {categoryLabel[profile.category]}
              </span>
            </div>
            {profile.category === 'both-changed' && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={choices[profile.id] === 'local' ? primaryBtn : btn}
                  onClick={() => onChoice(profile.id, 'local')}
                >
                  Keep device copy
                </button>
                <button
                  type="button"
                  className={choices[profile.id] === 'cloud' ? primaryBtn : btn}
                  onClick={() => onChoice(profile.id, 'cloud')}
                >
                  Use cloud copy
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {preview.potentiallyDestructive.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <p className="text-xs font-bold text-amber-800">
            Review before applying
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-800">
            {preview.potentiallyDestructive.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function SyncControls({ sync }: { sync: SyncApi }) {
  const { status } = sync
  if (!status.configured) {
    return (
      <div className={card}>
        <p className="text-sm text-slate-700">
          Cloud sync isn&apos;t set up on this device.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Everything remains available locally, including JSON backup and
          restore.
        </p>
      </div>
    )
  }
  return status.user ? <SignedIn sync={sync} /> : <SignedOut sync={sync} />
}

function SignedOut({ sync }: { sync: SyncApi }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await sync.signIn(email, password)
      if (!result.ok) {
        setError(result.error ?? 'Sign in failed.')
        return
      }
      setEmail('')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={card}>
      <h3 className="text-base font-bold text-slate-800">Cloud sync</h3>
      <p className="mt-1 text-sm text-slate-500">
        Sign in as the household owner. Signing in never uploads or replaces
        Academy data.
      </p>
      <form className="mt-3 space-y-3" onSubmit={onSubmit}>
        <div>
          <label
            htmlFor="sync-email"
            className="mb-1 block text-xs font-semibold text-slate-600"
          >
            Email
          </label>
          <input
            id="sync-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={input}
            required
          />
        </div>
        <div>
          <label
            htmlFor="sync-password"
            className="mb-1 block text-xs font-semibold text-slate-600"
          >
            Password
          </label>
          <input
            id="sync-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={input}
            required
          />
        </div>
        {error && <ErrorBox message={error} />}
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function SignedIn({ sync }: { sync: SyncApi }) {
  const { status } = sync
  const user = status.user!
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const run = async (action: () => Promise<void>) => {
    setActionBusy(true)
    setActionError(null)
    try {
      await action()
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'The action could not be completed.',
      )
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-700">
          Household:{' '}
          <span className="font-semibold text-slate-900">{user.email}</span>
        </p>
        <button
          className={btn}
          onClick={() => run(() => sync.signOut())}
          disabled={actionBusy || status.busy}
        >
          Sign out
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span>
          Device binding:{' '}
          <strong
            className={
              status.binding === 'bound' ? 'text-emerald-700' : 'text-amber-700'
            }
          >
            {status.binding === 'bound'
              ? 'verified for this household'
              : 'not yet bound'}
          </strong>
        </span>
        <span>Last successful sync: {fmt(status.lastSyncAt)}</span>
        {status.pendingCount > 0 && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {status.pendingCount} waiting for this household
          </span>
        )}
        {!status.online && (
          <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            Offline — local Academy use remains available
          </span>
        )}
      </div>

      {(status.error || actionError) && (
        <div>
          <ErrorBox message={actionError ?? status.error!} />
          <button
            className={`${btn} mt-2`}
            onClick={() => run(() => sync.syncNow())}
            disabled={actionBusy || status.busy || !status.online}
          >
            Retry cloud check
          </button>
        </div>
      )}

      {status.decision ? (
        <DecisionPanel
          decision={status.decision}
          sync={sync}
          disabled={actionBusy || status.busy}
          run={run}
        />
      ) : (
        <div className="space-y-2">
          {status.binding === 'unbound' && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Cloud sync is paused. Local Academy data remains on this device
              and has not been assigned to this household.
            </p>
          )}
          <button
            className={status.binding === 'bound' ? primaryBtn : btn}
            onClick={() => run(() => sync.syncNow())}
            disabled={actionBusy || status.busy || !status.online}
          >
            {status.busy
              ? 'Checking cloud…'
              : status.binding === 'bound'
                ? 'Sync now'
                : 'Check household cloud data'}
          </button>
        </div>
      )}
    </div>
  )
}

function DecisionPanel({
  decision,
  sync,
  disabled,
  run,
}: {
  decision: SyncDecision
  sync: SyncApi
  disabled: boolean
  run: (action: () => Promise<void>) => Promise<void>
}) {
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({})
  useEffect(() => setChoices({}), [decision])

  const conflicts = decision.preview.profiles.filter(
    (profile) => profile.category === 'both-changed',
  )
  const unresolved = conflicts.some((profile) => !choices[profile.id])

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-3">
      {decision.reason === 'account-switch' ? (
        <>
          <h3 className="text-sm font-bold text-rose-800">
            Different household detected
          </h3>
          <p className="mt-1 text-sm text-rose-800">
            This device&apos;s local Academy data was last verified for{' '}
            <strong>
              {decision.previousHousehold?.email ?? 'another household'}
            </strong>
            . It will not be uploaded to the current household unless you
            explicitly review and assign it.
          </p>
        </>
      ) : decision.reason === 'conflict' ? (
        <>
          <h3 className="text-sm font-bold text-rose-800">
            Sync needs parent review
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Academy data changed on this device and in the cloud. Automatic sync
            is paused.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-sm font-bold text-slate-800">
            Choose how to bind this device
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            The cloud check succeeded. Nothing has been uploaded or replaced.
          </p>
        </>
      )}

      <Preview
        preview={decision.preview}
        choices={choices}
        onChoice={(id, choice) =>
          setChoices((current) => ({ ...current, [id]: choice }))
        }
      />

      {decision.cloud === 'empty' ? (
        <div className="mt-3">
          <p className="text-sm text-slate-700">
            This household cloud is successfully empty. Upload only if these
            local profiles belong to <strong>this</strong> household.
          </p>
          <button
            className={`${primaryBtn} mt-2`}
            onClick={() => run(() => sync.uploadLocal())}
            disabled={disabled}
          >
            Upload this device&apos;s Academy data
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-sm text-slate-700">
              Use the household cloud copy on this device. A local safety backup
              is created first.
            </p>
            <button
              className={`${btn} mt-2`}
              onClick={() => run(() => sync.useCloud())}
              disabled={disabled}
            >
              Use cloud data on this device
            </button>
          </div>
          <div className="border-t border-amber-200 pt-3">
            <p className="text-sm font-semibold text-slate-800">
              Review and merge differences
            </p>
            <p className="mt-1 text-xs text-slate-600">
              One-sided profiles use the only available copy. Every two-sided
              conflict requires you to choose one whole profile; the app does
              not claim a shallow merge is safe.
            </p>
            <button
              className={`${primaryBtn} mt-2`}
              onClick={() => run(() => sync.applyReviewedMerge(choices))}
              disabled={disabled || unresolved}
            >
              Apply reviewed merge
            </button>
          </div>
        </div>
      )}

      <button
        className={`${btn} mt-3`}
        onClick={() => sync.cancelDecision()}
        disabled={disabled}
      >
        Cancel and continue without syncing
      </button>
    </section>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {message}
    </p>
  )
}
