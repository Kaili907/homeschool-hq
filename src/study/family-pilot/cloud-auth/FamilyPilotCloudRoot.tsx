import { useEffect, useMemo, type ReactNode } from 'react'
import { getSupabaseClient } from '../../../auth/supabaseSession'
import { createFamilyCloudBrowserRuntimeR1 } from './browserRuntime'
import type { FamilyCloudAuthRuntime } from './types'

export function FamilyPilotCloudRoot({ children }: {
  readonly children: (auth: FamilyCloudAuthRuntime) => ReactNode
}) {
  const composition = useMemo(createFamilyCloudBrowserRuntimeR1, [])
  useEffect(() => {
    const client = getSupabaseClient(composition.configuration.url, composition.configuration.anonKey)
    if (!client) return
    const timers = new Set<number>()
    const refreshAfterProviderEvent = () => {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        void composition.auth.refreshProviderSession()
      }, 0)
      timers.add(timer)
    }
    const { data } = client.auth.onAuthStateChange((event) => {
      // Supabase emits SIGNED_IN when a hidden tab becomes visible and recovers
      // its still-valid localStorage session. Revalidate without replacing the
      // mounted household/learner/Study surface. Only a real provider
      // SIGNED_OUT event may collapse cloud authority.
      if (event === 'SIGNED_OUT') composition.auth.providerSignedOut()
      else if (
        (event === 'SIGNED_IN' && composition.auth.snapshot().status !== 'AUTHENTICATING') ||
        event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'
      ) refreshAfterProviderEvent()
    })
    return () => {
      data.subscription.unsubscribe()
      for (const timer of timers) window.clearTimeout(timer)
      timers.clear()
    }
  }, [composition])
  return <>{children(composition.auth)}</>
}
