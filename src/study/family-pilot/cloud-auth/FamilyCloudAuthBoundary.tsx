import { useEffect, useState, type ReactNode } from 'react'
import type { FamilyCloudAuthRuntime, FamilyCloudSessionState } from './types'

export function FamilyCloudAuthBoundary({ runtime, children }: {
  readonly runtime: FamilyCloudAuthRuntime
  readonly children: (state: Extract<FamilyCloudSessionState, { status: 'READY' | 'OFFLINE_LOCAL' }>) => ReactNode
}) {
  const [state, setState] = useState<FamilyCloudSessionState>(() => runtime.snapshot())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formMode, setFormMode] = useState<'SIGN_IN' | 'CREATE' | 'RECOVER'>('SIGN_IN')
  const [accountNotice, setAccountNotice] = useState<string | null>(null)
  const [requestPending, setRequestPending] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const unsubscribe = runtime.subscribe(setState)
    void runtime.bootstrap(controller.signal)
    return () => { controller.abort(); unsubscribe() }
  }, [runtime])

  useEffect(() => {
    const refresh = () => { void runtime.refreshProviderSession() }
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
    }
  }, [runtime])

  useEffect(() => {
    if (state.status !== 'READY') return
    const remaining = Date.parse(state.expiresAt) - Date.now()
    const timer = window.setTimeout(() => { void runtime.refreshProviderSession() }, Math.max(0, remaining) + 50)
    return () => window.clearTimeout(timer)
  }, [runtime, state])

  if (state.status === 'READY' || state.status === 'OFFLINE_LOCAL') return <>{children(state)}</>
  if (state.status === 'AUTHENTICATING') {
    return <main className="mx-auto max-w-md px-4 py-12"><p role="status" className="rounded-xl border bg-white p-5 font-semibold">Checking this computer’s family account…</p></main>
  }

  const expired = state.status === 'EXPIRED'
  const attention = state.status === 'NEEDS_ATTENTION'
  const message = expired
    ? 'Your secure family session has expired. Sign in again; saved work on this device was not removed.'
    : attention && state.reason === 'NO_ACTIVE_HOUSEHOLD'
      ? 'This account does not have an active Manuel Academy household.'
      : attention && state.reason === 'AMBIGUOUS_HOUSEHOLD'
        ? 'This account belongs to more than one active household. Family access must be resolved before continuing.'
        : attention ? 'Family sign-in could not be completed. Check the account details and connection, then try again.'
          : 'A Parent signs in once to authorize this family computer. Learners then use their own profiles and PINs.'

  const submit = async () => {
    if (!email.trim() || password.length === 0) return
    const heldPassword = password
    setPassword('')
    setAccountNotice(null)
    if (formMode === 'CREATE') {
      const result = await runtime.createAccount(email.trim(), heldPassword)
      if (result.status === 'CONFIRM_EMAIL') {
        setFormMode('SIGN_IN')
        setAccountNotice('Check your email to confirm the family account, then return here and sign in.')
      }
      return
    }
    await runtime.signIn(email, heldPassword)
  }

  const sendRecovery = async () => {
    if (!email.trim() || requestPending) return
    setRequestPending(true)
    setAccountNotice(null)
    const result = await runtime.requestPasswordRecovery(email.trim())
    setRequestPending(false)
    setAccountNotice(result === 'SENT'
      ? 'Check your email for a secure password reset link.'
      : 'The reset email could not be sent. Check the address and connection, then try again.')
  }

  const sendMagicLink = async () => {
    if (!email.trim() || requestPending) return
    setRequestPending(true)
    setAccountNotice(null)
    const result = await runtime.requestMagicLink(email.trim())
    setRequestPending(false)
    setAccountNotice(result === 'SENT'
      ? 'Check your email for a secure sign-in link.'
      : 'The sign-in email could not be sent. Check the address and connection, then try again.')
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10" aria-labelledby="family-cloud-login-title">
      <p className="font-bold text-cyan-700">Family account</p>
      <h2 id="family-cloud-login-title" className="mt-1 text-3xl font-extrabold">
        {formMode === 'CREATE' ? 'Set up Family Cloud'
          : formMode === 'RECOVER' ? 'Reset your password'
            : 'Sign in to Manuel Academy'}
      </h2>
      <p className="mt-3 font-semibold text-slate-600">{message}</p>
      {accountNotice ? <p role="status" className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3 font-semibold text-slate-700">{accountNotice}</p> : null}
      <label className="mt-6 block font-bold">Parent email
        <input aria-label="Parent email" autoComplete="username" inputMode="email" type="email" className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      {formMode === 'RECOVER' ? (
        <>
          <button type="button" className="mt-5 min-h-11 rounded-lg bg-cyan-700 px-5 py-3 font-extrabold text-white disabled:opacity-60" disabled={!email.trim() || requestPending} onClick={() => { void sendRecovery() }}>
            {requestPending ? 'Sending…' : 'Send password reset link'}
          </button>
          <button type="button" className="ml-2 mt-5 min-h-11 rounded-lg border border-cyan-700 px-4 py-3 font-bold text-cyan-800" onClick={() => { setAccountNotice(null); setFormMode('SIGN_IN') }}>
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <label className="mt-4 block font-bold">Password
            <input aria-label="Family account password" autoComplete={formMode === 'CREATE' ? 'new-password' : 'current-password'} type="password" className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="button" className="mt-5 min-h-11 rounded-lg bg-cyan-700 px-5 py-3 font-extrabold text-white disabled:opacity-60" disabled={!email.trim() || !password} onClick={() => { void submit() }}>
            {formMode === 'CREATE' ? 'Create family account' : 'Sign in'}
          </button>
          <button type="button" className="ml-2 mt-5 min-h-11 rounded-lg border border-cyan-700 px-4 py-3 font-bold text-cyan-800" onClick={() => {
            setPassword('')
            setAccountNotice(null)
            setFormMode((value) => value === 'SIGN_IN' ? 'CREATE' : 'SIGN_IN')
          }}>
            {formMode === 'CREATE' ? 'Use an existing account' : 'Set up Family Cloud'}
          </button>
          {formMode === 'SIGN_IN' ? (
            <div className="mt-3 flex flex-wrap gap-4">
              <button type="button" className="font-bold text-cyan-800 underline" onClick={() => { setPassword(''); setAccountNotice(null); setFormMode('RECOVER') }}>Forgot password?</button>
              <button type="button" className="font-bold text-cyan-800 underline disabled:opacity-60" disabled={!email.trim() || requestPending} onClick={() => { setPassword(''); void sendMagicLink() }}>Email me a sign-in link</button>
            </div>
          ) : null}
        </>
      )}
      <p className="mt-4 text-sm text-slate-500">The account provider manages this password and secure session. Manuel Academy does not store it in family records.</p>
    </main>
  )
}
