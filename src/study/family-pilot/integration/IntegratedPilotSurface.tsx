import { useMemo, useState } from 'react'
import { loadFamilyPilotCatalog } from '../../../curriculum/family-pilot/source.browser'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import type { StudyPortBundle } from '../../ports'
import { FamilyPilotParentHub } from '../parent'
import type { FamilyPilotStoreOptions } from '../core'
import type { FamilyPilotShellContext } from '../FamilyPilotShell'
import { FamilyPilotController } from './controller'
import { catalogCurriculumPort, type FamilyPilotCurriculumPort } from './curriculum'
import { FAMILY_PILOT_HOUSEHOLD_REF, learnerOptionFor } from './identity'
import { IntegratedFamilyPilot } from './IntegratedFamilyPilot'
import type { FamilyPilotSafetyPort } from './safety'
import { FamilyPilotSafetyHoldBridge } from './safetyHolds'

// FAMILY-PILOT-INTEGRATION: everything the pilot's Study path needs.
//
// This module is deliberately separate from FamilyPilotHost, and is only ever
// reached through a development-gated dynamic import. It pulls the Study
// runtime facade and the local Study ports, both of which carry markers that
// src/study/production/providerBundleSecurity.test.ts forbids in a production
// client bundle. Importing this file statically from a routed component puts
// those markers back in the bundle and fails that test — which is the point of
// the test, since the local ports' safety classifier returns a forced 'clear'
// outcome and must never ship.
//
// Family Pilot Core, and therefore every learner record, stays outside this
// boundary and works in any build.

export interface IntegratedPilotSurfaceProps {
  readonly context: FamilyPilotShellContext
  readonly ports?: StudyPortBundle
  readonly curriculum?: FamilyPilotCurriculumPort
  readonly store?: FamilyPilotStoreOptions
  readonly safety?: FamilyPilotSafetyPort
  readonly now?: () => Date
  readonly householdTimeZone?: string
}

export function IntegratedPilotSurface({
  context,
  ports,
  curriculum,
  store,
  safety,
  now,
  householdTimeZone,
}: IntegratedPilotSurfaceProps) {
  // Ports are created once. Re-creating them on a later render would discard
  // the live Study calendar mid-lesson.
  //
  // They are given the SAME clock as the controller: the calendar runtime
  // refuses events that predate a block's own creation stamp, so two clocks
  // here means a start that lands before its own block exists.
  const [resolvedPorts] = useState<StudyPortBundle>(
    () => ports ?? createLocalDevelopmentStudyPorts(now ? { now } : {}).ports,
  )
  // The Family Pilot safety-hold bridge (mac/family-pilot-safety-r1, wired
  // here). It is a SEPARATE, additive layer from the Study Engine's own
  // permanent local-stop ledger: it never reads or writes that ledger, and a
  // caller-supplied `safety` prop still overrides it entirely, exactly as C1
  // already allowed before this branch merged in the hold store.
  const [safetyHoldBridge] = useState(
    () => new FamilyPilotSafetyHoldBridge({ coreStore: store, now: now ? () => now().toISOString() : undefined }),
  )
  const effectiveSafety = safety ?? safetyHoldBridge.port
  const controller = useMemo(
    () => new FamilyPilotController({
      ports: resolvedPorts,
      curriculum: curriculum ?? catalogCurriculumPort(loadFamilyPilotCatalog()),
      store,
      safety: effectiveSafety,
      safetySignals: safetyHoldBridge,
      now,
      householdTimeZone,
    }),
    [resolvedPorts, curriculum, store, effectiveSafety, safetyHoldBridge, now, householdTimeZone],
  )
  const activeStudentRef = context.activeStudentRef
  const [showParent, setShowParent] = useState(false)
  const [parentFor, setParentFor] = useState(activeStudentRef)

  // Derive-during-render rather than clear-in-effect. An effect would leave the
  // previous learner's parent view mounted for one committed frame under the
  // next learner's name; this closes it in the same render as the switch.
  if (parentFor !== activeStudentRef) {
    setParentFor(activeStudentRef)
    setShowParent(false)
  }

  return (
    <>
      {/*
        The key is load-bearing, not cosmetic. Remounting on a learner change
        discards every piece of student-scoped React state synchronously — this
        component's Study snapshot, open assignment and help session, and
        StudentExperience's own internal open-assignment state. Clearing them in
        an effect instead would render one frame of learner A's Study position
        and Tutor text underneath learner B's name, because assignment refs are
        lesson-derived and therefore resolve against B's list too.
      */}
      <IntegratedFamilyPilot
        key={activeStudentRef ?? 'no-learner'}
        context={context}
        controller={controller}
      />

      {activeStudentRef && (
        <section className="mt-6" aria-labelledby="family-pilot-parent">
          <h2 id="family-pilot-parent" className="font-extrabold">Parent view</h2>
          <button
            type="button"
            data-testid="family-pilot-parent-toggle"
            className="mt-2 min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
            onClick={() => setShowParent((shown) => !shown)}
          >
            {showParent ? 'Hide parent view' : 'Show parent view'}
          </button>
          {showParent && (
            // Scoped to the active learner only: the Parent Hub filters by
            // learnerRef internally, and handing it a single-learner list means
            // there is no other student's row for it to render.
            <FamilyPilotParentHub
              householdRef={FAMILY_PILOT_HOUSEHOLD_REF}
              learners={[learnerOptionFor(
                activeStudentRef,
                context.snapshot.state.students.find(
                  (student) => student.studentRef === activeStudentRef,
                )?.displayName ?? 'Learner',
              )]}
              ports={resolvedPorts}
              authorization={{
                householdRef: FAMILY_PILOT_HOUSEHOLD_REF,
                actorRef: 'family-pilot-parent',
                role: 'parent',
                adultAuthorized: true,
              }}
              safetyHolds={{
                openHoldsFor: (studentRef) => safetyHoldBridge.openHoldsFor(studentRef),
                resolveHold: (holdRef, clearedBy) => safetyHoldBridge.resolveHold(holdRef, clearedBy),
              }}
            />
          )}
        </section>
      )}
    </>
  )
}
