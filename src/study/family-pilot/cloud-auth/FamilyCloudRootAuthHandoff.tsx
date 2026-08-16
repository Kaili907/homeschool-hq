import { useEffect, useState, type ReactNode } from 'react'
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient, getVerifiedAuthContext, supabaseSessionRecordIsPresent } from '../../../auth/supabaseSession'
import { FAMILY_CLOUD_PASSWORD_RECOVERY_PATH, FAMILY_CLOUD_PATH } from './supabase'

function returnParameters(): URLSearchParams {
  const parameters = new URLSearchParams(window.location.search)
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  for (const [key, value] of new URLSearchParams(hash)) if (!parameters.has(key)) parameters.set(key, value)
  return parameters
}

export function hasFamilyCloudAuthReturn(): boolean {
  const parameters = returnParameters()
  return ['code', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_code', 'type']
    .some((key) => parameters.has(key))
}

export function familyCloudAuthReturnIsRecovery(): boolean {
  return returnParameters().get('type') === 'recovery'
}

export function familyCloudAuthEventTarget(event: AuthChangeEvent, session: Session | null): string | null {
  if (event === 'PASSWORD_RECOVERY') return FAMILY_CLOUD_PASSWORD_RECOVERY_PATH
  if (event === 'SIGNED_IN' && session) return FAMILY_CLOUD_PATH
  return null
}

export function FamilyCloudRootAuthHandoff({ client, children, onNavigate }: {
  readonly client?: SupabaseClient | null
  readonly children: ReactNode
  readonly onNavigate: (path: string) => void
}) {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Subscribe in the same turn that creates the singleton so the provider's
    // one-time PASSWORD_RECOVERY initialization event cannot race the root UI.
    const authClient = client ?? getSupabaseClient()
    if (!authClient) {
      setChecking(false)
      return
    }
    let active = true
    let moved = false
    let recoveryEventSeen = false
    let completionPending = false
    const move = (path: string) => {
      if (!active || moved) return
      moved = true
      window.history.replaceState(null, '', path)
      onNavigate(path)
    }
    const complete = () => {
      if (!active || moved || completionPending) return
      completionPending = true
      queueMicrotask(() => {
        void getVerifiedAuthContext(authClient).then((context) => {
          completionPending = false
          if (!active || moved) return
          if (!context || !supabaseSessionRecordIsPresent()) {
            setChecking(false)
            return
          }
          move(recoveryEventSeen || familyCloudAuthReturnIsRecovery()
            ? FAMILY_CLOUD_PASSWORD_RECOVERY_PATH
            : FAMILY_CLOUD_PATH)
        }, () => {
          completionPending = false
          if (active && !moved) setChecking(false)
        })
      })
    }
    const { data } = authClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') recoveryEventSeen = true
      const target = familyCloudAuthEventTarget(event, session)
      if (!target) return
      complete()
    })
    void authClient.auth.getSession().then(({ data: sessionData, error }) => {
      if (!active || moved) return
      queueMicrotask(() => {
        if (!active || moved) return
        if (!error && sessionData.session) complete()
        else setChecking(false)
      })
    }, () => { if (active) setChecking(false) })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client, onNavigate])

  if (checking) {
    return <main className="mx-auto max-w-xl p-8 text-slate-900"><p role="status" className="rounded-lg border bg-white p-4 font-semibold">Completing your secure Family Cloud sign-in…</p></main>
  }
  return <>{children}</>
}
