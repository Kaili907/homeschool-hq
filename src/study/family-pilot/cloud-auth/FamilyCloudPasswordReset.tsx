import { useEffect, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient, supabaseSessionRecordIsPresent } from '../../../auth/supabaseSession'
import { FAMILY_CLOUD_PATH } from './supabase'

export type PasswordValidationResult = 'VALID' | 'TOO_SHORT' | 'MISMATCH'

export function validateFamilyCloudPassword(password: string, confirmation: string): PasswordValidationResult {
  if (password.length < 8) return 'TOO_SHORT'
  return password === confirmation ? 'VALID' : 'MISMATCH'
}

async function providerSessionIsValid(client: SupabaseClient, session: Session | null): Promise<boolean> {
  if (!session?.access_token) return false
  const { data, error } = await client.auth.getUser(session.access_token)
  return !error && Boolean(data.user?.id) && data.user?.id === session.user.id
}

export function observeFamilyCloudRecoverySession(
  client: SupabaseClient,
  update: (status: 'READY' | 'INVALID') => void,
): () => void {
  let active = true
  let recoveryEventSeen = false
  const verify = (session: Session | null) => {
    void providerSessionIsValid(client, session).then((valid) => {
      if (active) update(valid ? 'READY' : 'INVALID')
    })
  }
  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryEventSeen = true
      queueMicrotask(() => verify(session))
    } else if (event === 'SIGNED_OUT') update('INVALID')
  })
  void client.auth.getSession().then(({ data: sessionData, error }) => {
    if (!active) return
    if (error || !sessionData.session) {
      update('INVALID')
      return
    }
    // PASSWORD_RECOVERY is the canonical event. A verified session also keeps
    // a refreshed recovery page usable after the one-time URL code is consumed.
    if (!recoveryEventSeen) verify(sessionData.session)
  }, () => { if (active) update('INVALID') })
  return () => {
    active = false
    data.subscription.unsubscribe()
  }
}

export async function updateFamilyCloudPassword(client: SupabaseClient, password: string): Promise<boolean> {
  const before = await client.auth.getSession()
  const expectedUserId = before.data.session?.user.id
  if (before.error || !expectedUserId) return false
  const { error } = await client.auth.updateUser({ password })
  if (error) return false
  const after = await client.auth.getSession()
  if (after.error || after.data.session?.user.id !== expectedUserId) return false
  return supabaseSessionRecordIsPresent() && providerSessionIsValid(client, after.data.session)
}

export function FamilyCloudPasswordReset({ client = getSupabaseClient() }: { readonly client?: SupabaseClient | null }) {
  const [status, setStatus] = useState<'CHECKING' | 'READY' | 'INVALID' | 'SAVING' | 'SUCCESS'>(() => client ? 'CHECKING' : 'INVALID')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => client ? observeFamilyCloudRecoverySession(client, (next) => {
    setStatus((current) => current === 'SUCCESS' || current === 'SAVING' ? current : next)
  }) : undefined, [client])

  useEffect(() => {
    if (status !== 'SUCCESS') return
    const timer = window.setTimeout(() => {
      window.history.replaceState(null, '', FAMILY_CLOUD_PATH)
      window.location.reload()
    }, 1_500)
    return () => window.clearTimeout(timer)
  }, [status])

  const submit = async () => {
    if (!client || status !== 'READY') return
    const validation = validateFamilyCloudPassword(password, confirmation)
    if (validation !== 'VALID') {
      setMessage(validation === 'MISMATCH'
        ? 'The passwords do not match.'
        : 'Use at least 8 characters for the new password.')
      return
    }
    const heldPassword = password
    setPassword('')
    setConfirmation('')
    setMessage(null)
    setStatus('SAVING')
    const updated = await updateFamilyCloudPassword(client, heldPassword)
    setStatus(updated ? 'SUCCESS' : 'READY')
    if (!updated) setMessage('The password could not be updated. Request a new reset link and try again.')
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12 text-slate-900" aria-labelledby="family-cloud-reset-title">
      <p className="font-bold text-cyan-700">Family account</p>
      <h1 id="family-cloud-reset-title" className="mt-1 text-3xl font-extrabold">Set a new password</h1>
      {status === 'CHECKING' ? <p role="status" className="mt-5 rounded-lg border bg-white p-4 font-semibold">Checking your secure reset link…</p> : null}
      {status === 'INVALID' ? (
        <section className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4" role="alert">
          <h2 className="font-extrabold">This reset link is invalid or has expired</h2>
          <p className="mt-1 font-semibold text-slate-700">Return to Family Cloud sign in and request another password reset email.</p>
          <a className="mt-4 inline-flex rounded-lg bg-cyan-700 px-4 py-3 font-bold text-white" href={FAMILY_CLOUD_PATH}>Request another reset</a>
        </section>
      ) : null}
      {status === 'SUCCESS' ? (
        <section className="mt-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4" role="status">
          <h2 className="font-extrabold">Password updated</h2>
          <p className="mt-1 font-semibold text-slate-700">Opening your Family Cloud account…</p>
          <a className="mt-4 inline-flex font-bold text-cyan-800 underline" href={FAMILY_CLOUD_PATH}>Continue to Family Pilot</a>
        </section>
      ) : null}
      {status === 'READY' || status === 'SAVING' ? (
        <form className="mt-6" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <label className="block font-bold">New password
            <input aria-label="New password" autoComplete="new-password" minLength={8} type="password" className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="mt-4 block font-bold">Confirm new password
            <input aria-label="Confirm new password" autoComplete="new-password" minLength={8} type="password" className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          {message ? <p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold">{message}</p> : null}
          <button type="submit" className="mt-5 min-h-11 rounded-lg bg-cyan-700 px-5 py-3 font-extrabold text-white disabled:opacity-60" disabled={status === 'SAVING'}>
            {status === 'SAVING' ? 'Setting password…' : 'Set password'}
          </button>
        </form>
      ) : null}
    </main>
  )
}
