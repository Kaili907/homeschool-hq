import { useMemo, type ReactNode } from 'react'
import { createFamilyCloudBrowserRuntimeR1 } from './browserRuntime'
import type { FamilyCloudAuthRuntime } from './types'

export function FamilyPilotCloudRoot({ children }: {
  readonly children: (auth: FamilyCloudAuthRuntime) => ReactNode
}) {
  const composition = useMemo(createFamilyCloudBrowserRuntimeR1, [])
  return <>{children(composition.auth)}</>
}
