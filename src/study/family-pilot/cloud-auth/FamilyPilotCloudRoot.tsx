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
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        queueMicrotask(() => { void composition.auth.bootstrap() })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [composition])
  return <>{children(composition.auth)}</>
}
