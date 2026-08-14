import { lazy, Suspense, useState } from 'react'
import { isFamilyPilotPath, leaveFamilyPilotPath } from '../core/route'

const FinalFamilyPilotApp = lazy(() =>
  import('../final-app/FinalFamilyPilotApp').then((module) => ({
    default: module.FinalFamilyPilotApp,
  })),
)

/**
 * Dedicated entry for the enabled web pilot. The legacy Homeschool HQ trainer
 * remains the default-off application, but none of its local answer evaluators
 * are dependencies of this production graph.
 */
export default function FamilyPilotWebApp() {
  const [onPilotRoute, setOnPilotRoute] = useState(() => isFamilyPilotPath(window.location.pathname))

  if (!onPilotRoute) {
    return (
      <main className="mx-auto max-w-xl p-8 text-slate-900">
        <h1 className="text-3xl font-extrabold">Family Pilot</h1>
        <p className="mt-3">This release serves the admitted Family Pilot at its dedicated route.</p>
        <a className="mt-5 inline-flex rounded-lg bg-cyan-700 px-4 py-3 font-bold text-white" href="/family-pilot">
          Open Family Pilot
        </a>
      </main>
    )
  }

  return (
    <Suspense fallback={<main aria-busy="true">Loading the Family Pilot.</main>}>
      <FinalFamilyPilotApp
        onExit={() => {
          leaveFamilyPilotPath()
          setOnPilotRoute(false)
        }}
      />
    </Suspense>
  )
}
