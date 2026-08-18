import { lazy, Suspense, useState } from 'react'
import { isFamilyPilotEnabledFromHost } from './study/familyPilotFlag'
import { isFamilyPilotPath, leaveFamilyPilotPath } from './study/family-pilot/core/route'
import { isFamilyCloudBrowserEnabledFromHost } from './study/family-pilot/cloud-auth/browserConfiguration'
import { isMathR3PreviewPath } from './study/math-r3-preview/route'

const LegacyApp = lazy(() => import('./LegacyApp'))

const DirectorReviewGallery = lazy(() => import('./study/director-review/DirectorReviewGallery'))

const MathR3PreviewRoute = lazy(() => import('./study/math-r3-preview/MathR3PreviewRoute'))

// Family Pilot is a separate root composition. Keeping both roots behind dynamic
// imports means selecting this route cannot evaluate legacy sync, scoring, Tutor
// transcript persistence, or profile-upload modules before route selection.
const FinalFamilyPilotApp = lazy(() =>
  import('./study/family-pilot/final-app/FinalFamilyPilotApp').then((module) => ({
    default: module.FinalFamilyPilotApp,
  })),
)

const FamilyPilotCloudRoot = lazy(() =>
  import('./study/family-pilot/cloud-auth/FamilyPilotCloudRoot').then((module) => ({
    default: module.FamilyPilotCloudRoot,
  })),
)

function familyPilotSelectedAtBoot(): boolean {
  return isFamilyPilotEnabledFromHost() && isFamilyPilotPath(window.location.pathname)
}

export default function App() {
  if (window.location.pathname === '/director-review/curriculum-r2') {
    return (
      <Suspense fallback={<main aria-busy="true">Loading the Director Review Gallery.</main>}>
        <DirectorReviewGallery />
      </Suspense>
    )
  }
  if (isMathR3PreviewPath(window.location.pathname)) {
    return (
      <Suspense fallback={<main aria-busy="true">Loading the Mathematics R3 preview.</main>}>
        <MathR3PreviewRoute />
      </Suspense>
    )
  }
  return <AcademyApp />
}

function AcademyApp() {
  const [familyPilotSelected, setFamilyPilotSelected] = useState(familyPilotSelectedAtBoot)
  const [returnToLegacyHome, setReturnToLegacyHome] = useState(false)

  if (familyPilotSelected) {
    const onExit = () => {
      leaveFamilyPilotPath()
      setReturnToLegacyHome(true)
      setFamilyPilotSelected(false)
    }
    return (
      <Suspense fallback={<main aria-busy="true">Loading the Family Pilot.</main>}>
        {isFamilyCloudBrowserEnabledFromHost()
          ? <FamilyPilotCloudRoot>{(auth) => <FinalFamilyPilotApp onExit={onExit} familyCloudAuth={auth} />}</FamilyPilotCloudRoot>
          : <FinalFamilyPilotApp onExit={onExit} />}
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<main aria-busy="true">Loading Manuel Academy.</main>}>
      <LegacyApp initialScreen={returnToLegacyHome ? 'home' : undefined} />
    </Suspense>
  )
}
