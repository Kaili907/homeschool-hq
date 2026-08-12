import { expect, test, type Locator, type Page } from '@playwright/test'
import { defaultAppState } from '../../../src/migration'
import { APP_STATE_STORAGE_KEY } from '../../../src/sync/provenance'
import {
  createInitialSafetyState,
  createSafetyHold,
  serializeSafetyState,
} from '../../../src/study/family-pilot/safety'

// FAMILY-PILOT-FINAL-BROWSER-ACCEPTANCE-R1: the real first pilot flow, driven
// through the actual rendered app (no component mocking), against the Vite
// dev server with VITE_FAMILY_PILOT_ENABLED=true — see playwright.family-pilot.config.ts
// for why this must be dev, not a production build.
//
// Two storage keys are seeded directly rather than clicked through:
//
//   1. homeschool-hq:app:v2 — the outer app's persisted profile. App.tsx only
//      honours the /family-pilot deep link when a profile already exists
//      (src/App.tsx: `familyPilotEnabled && bootProfile && isFamilyPilotPath(...)`).
//      This is infrastructure, not a Family Pilot feature; every existing
//      route-lifecycle test (src/App.familyPilotRouteLifecycle.test.tsx) seeds
//      it the same way, via the same exported `defaultAppState`.
//
//   2. manuel-academy.study.family-pilot-safety-holds.v1 — the Family Pilot
//      safety-hold store (src/study/family-pilot/integration/safetyHolds.ts).
//      There is no live Study-safety classifier wired into this local pilot
//      build to organically produce an 'urgent' classification from student
//      input, so the supported way to place a hold in a test is the one the
//      bridge itself is built on: construct it with the real, exported
//      createSafetyHold/serializeSafetyState functions
//      (src/study/family-pilot/safety/holdStore.ts + persistence.ts) and write
//      the result under the bridge's own storage key. This is the same
//      construction integration/safetyHolds.test.ts uses.
//
// Every other step — learner creation, student login, opening a lesson,
// checkpoint/resume, the Tutor static fallback, and the parent hold/resolve
// cycle — is driven purely through accessible roles/names on the live UI.

const SAFETY_HOLDS_STORAGE_KEY = 'manuel-academy.study.family-pilot-safety-holds.v1'

function seededBootState() {
  const state = defaultAppState()
  state.profiles.p1 = { ...state.profiles.p1, name: 'Family Pilot Household' }
  state.activeProfileId = 'p1'
  return state
}

async function seedBootProfile(page: Page) {
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: APP_STATE_STORAGE_KEY, value: JSON.stringify(seededBootState()) },
  )
}

/** Mirrors familyPilotSessionRef() in src/study/family-pilot/study/FamilyPilotStudyRuntime.ts. */
function sessionRefForBlock(blockRef: string): string {
  return `${blockRef}:session`
}

/** Builds a real, schema-valid urgent hold via the bridge's own exported constructors. */
function serializedUrgentHold(input: { readonly studentRef: string; readonly blockRef: string }): string {
  const { state } = createSafetyHold(createInitialSafetyState(), {
    studentRef: input.studentRef,
    sessionRef: sessionRefForBlock(input.blockRef),
    createdAt: new Date().toISOString(),
    reasonCode: 'study-safety-urgent',
    source: 'study-safety',
  })
  return serializeSafetyState(state)
}

async function seedUrgentSafetyHold(page: Page, input: { readonly studentRef: string; readonly blockRef: string }) {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: SAFETY_HOLDS_STORAGE_KEY, value: serializedUrgentHold(input) },
  )
}

function diagnostic(page: Page, key: string): Locator {
  return page.locator(`[data-diagnostic="${key}"]`)
}

function assignmentsRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Your assignments' })
}

async function firstAssignmentTitle(page: Page): Promise<string> {
  const title = await assignmentsRegion(page).getByRole('listitem').first().locator('p').first().innerText()
  return title.trim()
}

function assignmentCard(page: Page, title: string): Locator {
  return assignmentsRegion(page).getByRole('listitem').filter({ hasText: title })
}

test.describe('Family Pilot — real first pilot flow (browser acceptance)', () => {
  test.beforeEach(async ({ page }) => {
    await seedBootProfile(page)
  })

  test('login, lesson, checkpoint/resume, tutor fallback, safety hold, parent resolve, learner isolation', async ({ page }) => {
    await test.step('Family Pilot is enabled locally and the deep link reaches the pilot shell', async () => {
      await page.goto('/family-pilot')
      await expect(page.getByRole('heading', { name: 'Family Pilot', exact: true })).toBeVisible()
      await expect(page.getByText('No learners yet.')).toBeVisible()
    })

    await test.step('A parent adds two learners on this device', async () => {
      // createFamilyPilotStudent only auto-activates a NEW student when no one
      // is currently active (`activeStudentRef: state.activeStudentRef ?? ref`
      // — src/study/family-pilot/core/operations.ts), so adding Ada first
      // activates her, and adding Bo right after leaves Ada active and Bo an
      // untouched sibling profile — both land on the roster together, ready
      // for an explicit login choice below.
      await page.getByLabel('New learner name').fill('Ada')
      await page.getByRole('button', { name: 'Add learner' }).click()
      await expect(page.getByRole('button', { name: 'Ada', exact: true })).toBeVisible()

      await page.getByLabel('New learner name').fill('Bo')
      await page.getByRole('button', { name: 'Add learner' }).click()
      await expect(page.getByRole('button', { name: 'Bo', exact: true })).toBeVisible()
    })

    await test.step('Student login: choose the intended learner (Ada)', async () => {
      // Ada auto-activated when created; go to the picker so the login choice
      // below is a real, explicit selection between both learners, not a
      // no-op against whoever happened to be active already.
      await page.getByTestId('family-pilot-switch-student').click()
      await page.getByRole('listitem', { name: 'Continue as Ada' }).click()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Hi, Ada' })).toBeVisible()
    })

    let lessonTitle = ''
    await test.step('Grade 5 math work is visible for the newly signed-in learner', async () => {
      // KNOWN APP-WIRING GAP (not fixed here — out of scope for a test-harness
      // card, would require editing src/App.tsx):
      //
      // src/App.tsx renders <FamilyPilotHost onExit={...} /> with no `curriculum`
      // prop, so src/study/family-pilot/integration/IntegratedPilotSurface.tsx
      // falls back to hostLessonCurriculumPort() — a synthetic "Grade N math ·
      // lesson N" stand-in (src/study/family-pilot/integration/curriculum.ts) —
      // instead of catalogCurriculumPort(loadFamilyPilotCatalog()), which would
      // serve the real, frozen FAMILY_PILOT_STATIC_CONFIG catalog: grade 5,
      // mathematics, Unit 1 "Mathematical Habits and Whole-Number Reasoning"
      // (src/curriculum/family-pilot/pilot-config.ts), now browser-loadable via
      // source.browser.ts (merged into this branch from 2730770 specifically so
      // this catalog COULD be reached from a browser test). Nothing in
      // App.tsx/FamilyPilotHost/IntegratedPilotSurface ever calls
      // catalogCurriculumPort, so the real Unit 1 lessons are unreachable from
      // the routed app today — this is the harness's
      // FINAL_BROWSER_ACCEPTANCE_APP_BLOCKER finding for this one sub-step.
      //
      // Everything below this step exercises real product behaviour end to
      // end; only the specific curriculum CONTENT is the placeholder.
      lessonTitle = await firstAssignmentTitle(page)
      expect(lessonTitle).toMatch(/^Grade 5 math/)
      await expect(assignmentCard(page, lessonTitle).getByRole('button', { name: /^Start / })).toBeVisible()
    })

    await test.step('Open the lesson and Study starts', async () => {
      await assignmentCard(page, lessonTitle).getByRole('button', { name: /^Start / }).click()
      const working = page.getByRole('region', { name: `Working on ${lessonTitle}` })
      await expect(working).toBeVisible()
      await expect(working.getByText('Warm-up recall')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Save my place' })).toBeVisible()
    })

    let studentRefBeforeCheckpoint = ''
    let blockRefBeforeCheckpoint = ''
    await test.step('Checkpoint / save place', async () => {
      // NOTE: this deliberately does not exercise "Finish this step"
      // (completeSegment). That path is currently broken independent of this
      // harness: the calendar runtime's completeCurrentSegment requires the
      // active-work interval between the block's launch and the completion
      // instant to resolve to an exact whole number of seconds
      // (adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime/
      // calendar-runtime.ts assertChronological/addActiveTime — see the
      // `study-calendar-whole-second-timestamps` project note), but
      // FamilyPilotController/FamilyPilotStudyRuntime feed it a raw
      // `new Date()` (src/study/family-pilot/integration/controller.ts /
      // FamilyPilotStudyRuntime.ts's `#now`/`#at`), never the rounded
      // `studyInstant()` clock src/components/study/StudySessionContainer.tsx
      // already uses for the same calendar calls. Confirmed live: clicking
      // "Finish this step" reliably throws
      // `CalendarRuntimeError: invalid_timestamp` and surfaces as "Study could
      // not complete that step safely." This is a real, tiny, out-of-scope
      // production defect (fixing it means editing FamilyPilotController, not
      // this test harness) — flagged separately, not fixed or routed around
      // here. "checkpoint/save place" itself (controller.checkpoint(), used
      // below) does not call completeCurrentSegment and is unaffected.
      studentRefBeforeCheckpoint = (await diagnostic(page, 'activeStudentRef').innerText()).trim()
      blockRefBeforeCheckpoint = (await diagnostic(page, 'activeSessionRef').innerText()).trim()
      await page.getByRole('button', { name: 'Save my place' }).click()
      await expect(page.getByRole('alert')).toHaveCount(0)
    })

    await test.step('Reload — the checkpoint is retained, not lost or reset', async () => {
      await page.reload()
      await expect(assignmentCard(page, lessonTitle).getByText('In progress')).toBeVisible()
      await assignmentCard(page, lessonTitle).getByRole('button', { name: /^Resume / }).click()
      const working = page.getByRole('region', { name: `Working on ${lessonTitle}` })
      await expect(working.getByText('Warm-up recall')).toBeVisible()
      // Resume rebuilds the Study session from Core's persisted record rather
      // than the in-memory ports (which do not survive a real reload) — the
      // SAME blockRef/session identity below proves this is a genuine resume,
      // not a silent fresh start that happens to look the same.
      expect((await diagnostic(page, 'activeStudentRef').innerText()).trim()).toBe(studentRefBeforeCheckpoint)
      expect((await diagnostic(page, 'activeSessionRef').innerText()).trim()).toBe(blockRefBeforeCheckpoint)
    })

    await test.step('Request Tutor help with the provider offline: static fallback is visible', async () => {
      // FamilyPilotController never receives a tutorDeps/live-provider option
      // from FamilyPilotHost (src/study/family-pilot/integration/FamilyPilotHost.tsx
      // has no such prop), so startHelp() always degrades to the static
      // fallback — there is no live Tutor Core path to go offline FROM in this
      // build. That is exactly the "provider offline" state the target flow
      // asks for, so no network interception is needed to reach it.
      await page.getByTestId('family-pilot-help').click()
      const tutor = page.getByTestId('family-pilot-tutor')
      await expect(tutor).toBeVisible()
      await expect(tutor.locator('[data-tutor="path"]')).toHaveText('static-fallback')
      await expect(tutor.locator('[data-tutor="text"]')).not.toBeEmpty()
      await page.getByRole('button', { name: 'Back to my lesson' }).click()
    })

    let studentRef = ''
    let blockRef = ''
    await test.step('Seed an urgent Family Pilot safety hold through the supported test seam', async () => {
      studentRef = (await diagnostic(page, 'activeStudentRef').innerText()).trim()
      blockRef = (await diagnostic(page, 'activeSessionRef').innerText()).trim()
      expect(studentRef).not.toBe('—')
      expect(blockRef).not.toBe('—')
      await seedUrgentSafetyHold(page, { studentRef, blockRef })
      // The gate is only checked on entry (start/resume/help), so a reload +
      // resume is what actually surfaces the hold to the learner.
      await page.reload()
      await assignmentCard(page, lessonTitle).getByRole('button', { name: /^Resume / }).click()
    })

    await test.step('The learner is visibly blocked', async () => {
      await expect(page.getByRole('alert').filter({ hasText: 'This needs an adult to look at before continuing' }))
        .toBeVisible()
    })

    await test.step('Parent view shows the exact hold', async () => {
      await page.getByTestId('family-pilot-parent-toggle').click()
      const holds = page.getByTestId('family-pilot-safety-holds')
      await expect(holds).toBeVisible()
      await expect(holds.getByText(/study-safety-urgent/)).toBeVisible()
    })

    await test.step('Parent chooses "Resolve and let them resume"', async () => {
      await page.getByRole('button', { name: 'Resolve and let them resume' }).click()
      await expect(page.getByTestId('family-pilot-safety-holds').getByText('Nothing is paused for Ada right now.'))
        .toBeVisible()
    })

    await test.step('The learner resumes, checkpoint still intact', async () => {
      await page.getByRole('button', { name: '← Return to assignments' }).click()
      await assignmentCard(page, lessonTitle).getByRole('button', { name: /^Resume / }).click()
      const working = page.getByRole('region', { name: `Working on ${lessonTitle}` })
      await expect(working.getByText('Warm-up recall')).toBeVisible()
      await expect(page.getByRole('alert').filter({ hasText: 'This needs an adult' })).toHaveCount(0)
    })

    await test.step('A second learner/session remains isolated', async () => {
      await page.getByTestId('family-pilot-switch-student').click()
      await page.getByRole('listitem', { name: 'Continue as Bo' }).click()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Hi, Bo' })).toBeVisible()

      // Bo's own copy of the same placeholder lesson list, but every card is
      // untouched — none of Ada's progress, checkpoint or hold history leaked.
      await expect(assignmentCard(page, lessonTitle).getByText('Not started')).toBeVisible()
      await expect(assignmentCard(page, lessonTitle).getByRole('button', { name: /^Start / })).toBeVisible()

      // Switching back proves the isolation runs both directions: Bo's fresh
      // session did not reset or bleed into Ada's retained checkpoint either.
      await page.getByTestId('family-pilot-switch-student').click()
      await page.getByRole('listitem', { name: 'Continue as Ada' }).click()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await assignmentCard(page, lessonTitle).getByText('In progress').waitFor()
      await assignmentCard(page, lessonTitle).getByRole('button', { name: /^Resume / }).click()
      const working = page.getByRole('region', { name: `Working on ${lessonTitle}` })
      await expect(working.getByText('Warm-up recall')).toBeVisible()
    })
  })
})
