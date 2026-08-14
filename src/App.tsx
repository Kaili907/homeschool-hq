import { lazy, Suspense, useState } from 'react'
import { isFamilyPilotEnabledFromHost } from './study/familyPilotFlag'
import { isFamilyPilotPath, leaveFamilyPilotPath } from './study/family-pilot/core/route'
import { isG3RoundingDirectorPreviewPath } from './study/family-pilot/elementary-math-director-preview/route'

const LegacyApp = lazy(() => import('./LegacyApp'))

// Family Pilot is a separate root composition. Keeping both roots behind dynamic
// imports means selecting this route cannot evaluate legacy sync, scoring, Tutor
// transcript persistence, or profile-upload modules before route selection.
const FinalFamilyPilotApp = lazy(() =>
  import('./study/family-pilot/final-app/FinalFamilyPilotApp').then((module) => ({
    default: module.FinalFamilyPilotApp,
  })),
)

const G3RoundingDirectorPreview = import.meta.env.DEV
  ? lazy(() => import('./study/family-pilot/elementary-math-director-preview/G3RoundingDirectorPreview').then((module) => ({
      default: module.G3RoundingDirectorPreview,
    })))
  : null

function familyPilotSelectedAtBoot(): boolean {
  return isFamilyPilotEnabledFromHost() && isFamilyPilotPath(window.location.pathname)
}

export default function App() {
  const [familyPilotSelected, setFamilyPilotSelected] = useState(familyPilotSelectedAtBoot)
  const [returnToLegacyHome, setReturnToLegacyHome] = useState(false)

  if (G3RoundingDirectorPreview && isG3RoundingDirectorPreviewPath(window.location.pathname)) {
    return (
      <Suspense fallback={<main aria-busy="true">Loading the Director preview.</main>}>
        <G3RoundingDirectorPreview />
      </Suspense>
    )
  }

  if (familyPilotSelected) {
    return (
      <Suspense fallback={<main aria-busy="true">Loading the Family Pilot.</main>}>
        <FinalFamilyPilotApp
          onExit={() => {
            leaveFamilyPilotPath()
            setReturnToLegacyHome(true)
            setFamilyPilotSelected(false)
          }}
        />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<main aria-busy="true">Loading Manuel Academy.</main>}>
      <LegacyApp initialScreen={returnToLegacyHome ? 'home' : undefined} />
    </Suspense>
  )
}
