import { lazy, Suspense, useCallback, useState } from 'react'
import {
  FAMILY_PILOT_PATH,
  isFamilyPilotPath,
  isFamilyPilotResetPasswordPath,
  leaveFamilyPilotPath,
} from '../core/route'
import { isFamilyCloudBrowserEnabledFromHost } from '../cloud-auth/browserConfiguration'

const FinalFamilyPilotApp = lazy(() =>
  import('../final-app/FinalFamilyPilotApp').then((module) => ({
    default: module.FinalFamilyPilotApp,
  })),
)

const FamilyPilotCloudRoot = lazy(() =>
  import('../cloud-auth/FamilyPilotCloudRoot').then((module) => ({ default: module.FamilyPilotCloudRoot })),
)

const FamilyCloudPasswordReset = lazy(() =>
  import('../cloud-auth/FamilyCloudPasswordReset').then((module) => ({ default: module.FamilyCloudPasswordReset })),
)

const FamilyCloudRootAuthHandoff = lazy(() =>
  import('../cloud-auth/FamilyCloudRootAuthHandoff').then((module) => ({ default: module.FamilyCloudRootAuthHandoff })),
)

/**
 * Dedicated entry for the enabled web pilot. The legacy Homeschool HQ trainer
 * remains the default-off application, but none of its local answer evaluators
 * are dependencies of this production graph.
 */
export default function FamilyPilotWebApp() {
  const [path, setPath] = useState(() => window.location.pathname)
  const cloudEnabled = isFamilyCloudBrowserEnabledFromHost()
  const onNavigate = useCallback((nextPath: string) => setPath(nextPath), [])

  if (isFamilyPilotResetPasswordPath(path)) {
    return (
      <Suspense fallback={<main aria-busy="true">Loading password recovery.</main>}>
        {cloudEnabled
          ? <FamilyCloudPasswordReset />
          : <main className="mx-auto max-w-md p-8"><h1 className="text-2xl font-extrabold">Password recovery unavailable</h1><p className="mt-3 font-semibold">Family Cloud is not enabled in this build.</p><a href={FAMILY_PILOT_PATH}>Return to Family Pilot</a></main>}
      </Suspense>
    )
  }

  const onPilotRoute = isFamilyPilotPath(path)

  if (!onPilotRoute) {
    const stub = (
      <main className="mx-auto max-w-xl p-8 text-slate-900">
        <h1 className="text-3xl font-extrabold">Family Pilot</h1>
        <p className="mt-3">This release serves the admitted Family Pilot at its dedicated route.</p>
        <a className="mt-5 inline-flex rounded-lg bg-cyan-700 px-4 py-3 font-bold text-white" href="/family-pilot">
          Open Family Pilot
        </a>
      </main>
    )
    return cloudEnabled ? (
      <Suspense fallback={<main aria-busy="true">Checking Family Cloud sign-in.</main>}>
        <FamilyCloudRootAuthHandoff onNavigate={onNavigate}>{stub}</FamilyCloudRootAuthHandoff>
      </Suspense>
    ) : stub
  }

  const onExit = () => {
    leaveFamilyPilotPath()
    setPath('/')
  }
  return (
    <Suspense fallback={<main aria-busy="true">Loading the Family Pilot.</main>}>
      {cloudEnabled
        ? <FamilyPilotCloudRoot>{(auth) => <FinalFamilyPilotApp onExit={onExit} familyCloudAuth={auth} />}</FamilyPilotCloudRoot>
        : <FinalFamilyPilotApp onExit={onExit} />}
    </Suspense>
  )
}
