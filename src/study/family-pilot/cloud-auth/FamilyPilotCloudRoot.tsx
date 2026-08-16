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
    const bootstrapAfterProviderEvent = () => {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        void composition.auth.bootstrap()
      }, 0)
      timers.add(timer)
    }
    const { data } = client.auth.onAuthStateChange((event) => {
      // Password sign-in is established by the coordinator that initiated it.
      // Starting a second bootstrap from SIGNED_IN races that same operation.
      if (event === 'SIGNED_IN' && composition.auth.snapshot().status !== 'AUTHENTICATING') bootstrapAfterProviderEvent()
      else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') bootstrapAfterProviderEvent()
    })
    return () => {
      data.subscription.unsubscribe()
      for (const timer of timers) window.clearTimeout(timer)
      timers.clear()
    }
  }, [composition])
  return <>{children(composition.auth)}</>
}
