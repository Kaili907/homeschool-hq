import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import { loadFamilyPilotState } from '../core'
import type { FamilyPilotShellContext } from '../FamilyPilotShell'
import { FamilyPilotController } from './controller'
import { hostLessonCurriculumPort } from './curriculum'
import { IntegratedFamilyPilot } from './IntegratedFamilyPilot'
import { IntegratedPilotSurface } from './IntegratedPilotSurface'
import { FamilyPilotParentHub } from '../parent'
import { FAMILY_PILOT_HOUSEHOLD_REF, learnerOptionFor } from './identity'

// FAMILY-PILOT-INTEGRATION: what the composed surface actually renders.
//
// Rendered with renderToStaticMarkup, matching the convention the pilot's own
// component tests use (see student/StudentExperience.test.tsx); the repository
// has no DOM environment installed. Behavioural coverage of the flow lives in
// familyPilotFlow.integration.test.ts, which drives the same controller these
// renders are given.

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => { map.clear() },
  } as Storage
}

function pilot() {
  const storage = memoryStorage()
  const now = () => new Date('2026-03-04T15:00:00.000Z')
  let counter = 0
  const controller = new FamilyPilotController({
    ports: createLocalDevelopmentStudyPorts({ now }).ports,
    curriculum: hostLessonCurriculumPort(2),
    store: { storage, now: () => now().toISOString() },
    now,
    householdTimeZone: 'UTC',
    defaultGrade: '5',
    newStudentRef: () => `student:fixed-${(counter += 1)}`,
  })
  return { controller, storage }
}

function context(storage: Storage): FamilyPilotShellContext {
  const snapshot = loadFamilyPilotState({ storage })
  return {
    snapshot,
    activeStudentRef: snapshot.state.activeStudentRef,
    reload: () => undefined,
  }
}

describe('IntegratedFamilyPilot rendering', () => {
  it('offers profile entry when no learner is active', () => {
    const { controller, storage } = pilot()
    controller.createStudent('Ada')
    // Core makes the first learner created active on its own, so returning to
    // the entry surface is an explicit deselection — the same one the
    // "Switch learner" control performs.
    controller.selectStudent(null)
    const markup = renderToStaticMarkup(
      <IntegratedFamilyPilot context={context(storage)} controller={controller} />,
    )
    expect(markup).toContain('family-pilot-entry')
    expect(markup).toContain('Ada')
    // No learner is signed in, so no student work surface exists at all.
    expect(markup).not.toContain('family-pilot-student-work')
  })

  it('renders the active learner’s own assignments', () => {
    const { controller, storage } = pilot()
    controller.createStudent('Ada')
    const ref = controller.snapshot().state.students[0].studentRef
    controller.selectStudent(ref)
    controller.ensureAssignments(ref)

    const markup = renderToStaticMarkup(
      <IntegratedFamilyPilot context={context(storage)} controller={controller} />,
    )
    expect(markup).toContain('family-pilot-student-work')
    expect(markup).toContain(ref)
    expect(markup).toContain('Grade 5 math · lesson 1')
    expect(markup).toContain('Grade 5 math · lesson 2')
    // Entry is behind the learner now, not alongside their work.
    expect(markup).not.toContain('family-pilot-entry')
  })

  it('renders one learner’s work without any trace of the other', () => {
    const { controller, storage } = pilot()
    controller.createStudent('Ada')
    controller.createStudent('Bo')
    const [adaRef, boRef] = controller.snapshot().state.students.map((s) => s.studentRef)
    controller.ensureAssignments(adaRef)
    controller.ensureAssignments(boRef)

    controller.selectStudent(boRef)
    const markup = renderToStaticMarkup(
      <IntegratedFamilyPilot context={context(storage)} controller={controller} />,
    )
    expect(markup).toContain(boRef)
    expect(markup).not.toContain(adaRef)
    expect(markup).toContain('Bo')
    expect(markup).not.toContain('Ada')
  })

  it('offers a way back to learner selection', () => {
    const { controller, storage } = pilot()
    controller.createStudent('Ada')
    const ref = controller.snapshot().state.students[0].studentRef
    controller.selectStudent(ref)
    controller.ensureAssignments(ref)
    const markup = renderToStaticMarkup(
      <IntegratedFamilyPilot context={context(storage)} controller={controller} />,
    )
    expect(markup).toContain('family-pilot-switch-student')
  })
})

describe('IntegratedPilotSurface composition', () => {
  it('mounts the composed pilot and the parent view for the active learner', () => {
    const { controller, storage } = pilot()
    controller.createStudent('Ada')
    const ref = controller.snapshot().state.students[0].studentRef
    controller.selectStudent(ref)
    controller.ensureAssignments(ref)

    const now = () => new Date('2026-03-04T15:00:00.000Z')
    const markup = renderToStaticMarkup(
      <IntegratedPilotSurface
        context={context(storage)}
        ports={createLocalDevelopmentStudyPorts({ now }).ports}
        curriculum={hostLessonCurriculumPort(2)}
        store={{ storage, now: () => now().toISOString() }}
        now={now}
        householdTimeZone="UTC"
      />,
    )
    expect(markup).toContain('family-pilot-student-work')
    // Requirement: a parent view is reachable for the current learner.
    expect(markup).toContain('family-pilot-parent-toggle')
    expect(markup).toContain('Parent view')
    expect(markup).toContain('Ada')
  })

  it('offers no parent view when no learner is active', () => {
    const { controller, storage } = pilot()
    controller.createStudent('Ada')
    controller.selectStudent(null)
    const now = () => new Date('2026-03-04T15:00:00.000Z')
    const markup = renderToStaticMarkup(
      <IntegratedPilotSurface
        context={context(storage)}
        ports={createLocalDevelopmentStudyPorts({ now }).ports}
        curriculum={hostLessonCurriculumPort(2)}
        store={{ storage, now: () => now().toISOString() }}
        now={now}
        householdTimeZone="UTC"
      />,
    )
    expect(markup).not.toContain('family-pilot-parent-toggle')
    expect(markup).toContain('family-pilot-entry')
  })
})

describe('parent view scoping', () => {
  // The hub is only reachable behind a toggle, so it is rendered directly here.
  // Without this, requirement 10's surface is never exercised at all — the
  // toggle button existing proves nothing about what it opens.
  it('renders only the learner it was handed', () => {
    const now = () => new Date('2026-03-04T15:00:00.000Z')
    const markup = renderToStaticMarkup(
      <FamilyPilotParentHub
        householdRef={FAMILY_PILOT_HOUSEHOLD_REF}
        learners={[learnerOptionFor('student:fixed-1', 'Ada')]}
        ports={createLocalDevelopmentStudyPorts({ now }).ports}
        authorization={{
          householdRef: FAMILY_PILOT_HOUSEHOLD_REF,
          actorRef: 'family-pilot-parent',
          role: 'parent',
          adultAuthorized: true,
        }}
        readSafetyLedger={() => ({ records: [], historyState: 'available' })}
      />,
    )
    expect(markup).toContain('Ada')
    // The sibling exists in the household but was not handed to this hub, so
    // there is no row, option, or ref for them to appear under.
    expect(markup).not.toContain('Bo')
    expect(markup).not.toContain('student:fixed-2')
  })
})
