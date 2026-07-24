import { useState } from 'react'
import type { SyncApi } from '../../sync/useSync'
import type { SyncSummary } from '../../sync/types'

// M6 Grown-Ups cloud-sync panel. Dad-facing only — slate/white palette, never a
// kid theme; kid screens never render this. Purely presentational: it reads
// `sync.status` and calls the injected async actions, keeping every confirm /
// preview / busy / error flag in local state. Nothing here touches AppState.

const card = 'rounded-xl border border-slate-200 bg-white p-4'
const btn =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryBtn =
  'rounded-lg border border-slate-800 bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
const input =
  'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none'

const fmt = (ms: number | null): string =>
  ms == null ? 'never' : new Date(ms).toLocaleString()

/** Shared confirm panel body for both migration directions. */
function MigrationPreview({ summary }: { summary: SyncSummary }) {
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-700">
        {summary.count} {summary.count === 1 ? 'profile' : 'profiles'}
      </p>
      <ul className="mt-1.5 space-y-1">
        {summary.perGirl.map((g) => (
          <li
            key={g.id}
            className="flex items-baseline justify-between gap-3 text-sm text-slate-600"
          >
            <span className="font-medium text-slate-700">{g.name}</span>
            <span className="text-xs text-slate-500">
              {g.updatedAt == null ? '—' : new Date(g.updatedAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type Pending = { dir: 'push' | 'pull'; summary: SyncSummary } | null

export function SyncControls({ sync }: { sync: SyncApi }) {
  const { status } = sync

  // ---- 1. Not configured -------------------------------------------------
  if (!status.configured) {
    return (
      <div className={card}>
        <p className="text-sm text-slate-700">
          Cloud sync isn&apos;t set up on this device.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Everything works fully on this device without it, and your JSON
          backup / export still works exactly the same.
        </p>
      </div>
    )
  }

  // ---- 2. Configured but signed out --------------------------------------
  if (!status.user) {
    return <SignedOut sync={sync} />
  }

  // ---- 3. Signed in ------------------------------------------------------
  return <SignedIn sync={sync} />
}

// ------------------------------------------------------------------------
// Signed-out: owner sign-in form
// ------------------------------------------------------------------------
function SignedOut({ sync }: { sync: SyncApi }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await sync.signIn(email, password)
      if (!res.ok) {
        setError(res.error ?? 'Sign in failed.')
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
        Sign in as the household owner to sync this device.
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
            onChange={(e) => setEmail(e.target.value)}
            className={input}
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
            onChange={(e) => setPassword(e.target.value)}
            className={input}
          />
        </div>
        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </p>
        )}
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

// ------------------------------------------------------------------------
// Signed-in: status, sync-now, and the two confirm-before-apply migrations
// ------------------------------------------------------------------------
function SignedIn({ sync }: { sync: SyncApi }) {
  const { status } = sync
  const user = status.user! // narrowed by the caller

  const [pending, setPending] = useState<Pending>(null)
  // busy is used for every awaited action so the triggering button re-enables.
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const openPush = () => {
    setError(null)
    // synchronous preview — no loading state needed.
    setPending({ dir: 'push', summary: sync.previewPushLocal() })
  }

  const openPull = () =>
    run(async () => {
      const summary = await sync.previewPullCloud()
      setPending({ dir: 'pull', summary })
    })

  const confirmMigration = () =>
    run(async () => {
      if (!pending) return
      if (pending.dir === 'push') await sync.pushAllLocal()
      else await sync.pullCloud()
      setPending(null)
    })

  return (
    <div className={`${card} space-y-4`}>
      {/* identity */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-700">
          Signed in as{' '}
          <span className="font-semibold text-slate-800">{user.email}</span>
        </p>
        <button
          className={btn}
          onClick={() => run(() => sync.signOut())}
          disabled={busy}
        >
          Sign out
        </button>
      </div>

      {/* status line */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span>Last sync: {fmt(status.lastSyncAt)}</span>
        {status.pendingCount > 0 && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {status.pendingCount} waiting to sync
          </span>
        )}
        {!status.online && (
          <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            working offline — changes will sync when you reconnect
          </span>
        )}
      </div>

      <div>
        <button
          className={primaryBtn}
          onClick={() => run(() => sync.syncNow())}
          disabled={status.busy || busy}
        >
          {status.busy ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      )}

      {/* migration */}
      <section className="border-t border-slate-200 pt-3">
        <h3 className="text-sm font-bold text-slate-700">Move data between devices</h3>

        {pending == null ? (
          <div className="mt-2 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button className={btn} onClick={openPush} disabled={busy}>
                Push this device&apos;s data to the cloud →
              </button>
              <button className={btn} onClick={openPull} disabled={busy}>
                {busy ? 'Loading…' : '← Pull cloud data to this device'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Pulling MERGES — it never erases anything already on this device.
            </p>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm font-semibold text-slate-700">
              {pending.dir === 'push'
                ? 'About to push these profiles from this device to the cloud:'
                : 'About to pull these profiles from the cloud into this device:'}
            </p>
            <MigrationPreview summary={pending.summary} />
            {pending.dir === 'pull' && (
              <p className="mt-2 text-xs text-slate-500">
                Pulling MERGES — it never erases anything already on this device.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={primaryBtn}
                onClick={confirmMigration}
                disabled={busy}
              >
                {busy
                  ? 'Applying…'
                  : pending.dir === 'push'
                    ? 'Confirm push'
                    : 'Confirm pull'}
              </button>
              <button
                className={btn}
                onClick={() => setPending(null)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
