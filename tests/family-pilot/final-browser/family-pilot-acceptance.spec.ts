import { expect, test, type Locator, type Page } from '@playwright/test'
import { defaultAppState } from '../../../src/migration'
import { APP_STATE_STORAGE_KEY } from '../../../src/sync/provenance'

// FAMILY-PILOT-FINAL-BROWSER-ACCEPTANCE-R2: the real first pilot flow, driven
// through the actual rendered app (no component mocking), against the Vite
// dev server with VITE_FAMILY_PILOT_ENABLED=true — see playwright.family-pilot.config.ts
// for why this must be dev, not a production build.
//
// One storage key is seeded directly rather than clicked through:
//
//   homeschool-hq:app:v2 — the outer app's persisted profile. App.tsx only
//   honours the /family-pilot deep link when a profile already exists
//   (src/App.tsx: `familyPilotEnabled && bootProfile && isFamilyPilotPath(...)`).
//   This is outer-app infrastructure, not a Family Pilot feature; every
//   existing route-lifecycle test (src/App.familyPilotRouteLifecycle.test.tsx)
//   seeds it the same way, via the same exported `defaultAppState`.
//
// Everything else — learner creation, student login, the real Grade 5 Unit 1
// catalog, opening a lesson, finishing a step, checkpoint/resume, the Tutor
// static fallback, the AUTOMATIC safety hold raised by typing a concerning
// message through the real "I need help" textarea and clicking Ask, the
// parent hold/resolve cycle, and second-learner isolation — is driven purely
// through accessible roles/names on the live UI. No hold is ever seeded into
// storage, and "Finish this step" is exercised for real: App.tsx wires
// <FamilyPilotHost> with no `curriculum` prop, so IntegratedPilotSurface's
// default (catalogCurriculumPort(loadFamilyPilotCatalog())) is what's live in
// the browser, and FamilyPilotStudyRuntime now hands the calendar port a
// whole-second-rounded clock, so completeSegment no longer throws
// CalendarRuntimeError: invalid_timestamp.

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

function diagnostic(page: Page, key: string): Locator {
  return page.locator(`[data-diagnostic="${key}"]`)
}

function studyField(page: Page, key: string): Locator {
  return page.locator(`[data-study="${key}"]`)
}

function assignmentsRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Your assignments' })
}

function assignmentCard(page: Page, title: string): Locator {
  return assignmentsRegion(page).getByRole('listitem').filter({ hasText: title })
}

function holdsSection(page: Page): Locator {
  return page.getByTestId('family-pilot-safety-holds')
}

/**
 * Asserts the lesson's Study position is exactly "1 step finished, now on
 * segment 2 (the 'teach' segment)" via the authoritative live Study fields
 * (family-pilot-study's dl, driven straight off the Study runtime's own
 * snapshot) plus the progress fraction StudentExperience derives from the
 * same completedSegmentRefs set.
 *
 * Deliberately NOT asserted: ActiveAssignmentView's "Current step" title.
 * KNOWN FINDING (not fixed here — out of scope for this test-harness card):
 * toStudentAssignment (src/study/family-pilot/integration/assignments.ts)
 * derives currentSegmentRef from record.progress.lastSegmentRef when not
 * paused, but recordFamilyPilotProgress (core/operations.ts) sets
 * lastSegmentRef to the segment that was just COMPLETED, not the next one —
 * so after a real "Finish this step" click (no pause involved) the "Current
 * step" label keeps showing the just-finished segment instead of advancing.
 * The Study session's actual position is correct throughout, as proven below.
 */
async function expectOnSegmentTwo(page: Page, lessonTitle: string): Promise<void> {
  await expect(studyField(page, 'segmentRef')).toHaveText('ma-g5-mathematics-u01-l01:segment:teach')
  await expect(studyField(page, 'segmentOrdinal')).toHaveText('2')
  await expect(studyField(page, 'completedSegments')).toHaveText('1')
  const working = page.getByRole('region', { name: `Working on ${lessonTitle}` })
  await expect(working.getByText('1 of 5 steps complete')).toBeVisible()
}

async function currentHoldRef(page: Page): Promise<string | null> {
  const items = holdsSection(page).locator('[data-hold-ref]')
  if ((await items.count()) === 0) return null
  return items.first().getAttribute('data-hold-ref')
}

async function sendHelpMessage(page: Page, message: string): Promise<void> {
  await page.getByTestId('family-pilot-help-input').fill(message)
  await page.getByTestId('family-pilot-help-send').click()
}

test.describe('Family Pilot — real first pilot flow (browser acceptance)', () => {
  test.beforeEach(async ({ page }) => {
    await seedBootProfile(page)
  })

  test('login, real curriculum, lesson step, checkpoint/resume, learner safety trigger, parent resolve, learner isolation', async ({ page }) => {
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

    const LESSON_TITLE = 'Launch and diagnostic: problem-solving routines'
    await test.step('The real Grade 5 Unit 1 catalog is visible — not the synthetic placeholder', async () => {
      const cards = assignmentsRegion(page).getByRole('listitem')
      await expect(cards).toHaveCount(18)
      const titles = await cards.locator('p').first().allInnerTexts()
      expect(titles[0].trim()).toBe(LESSON_TITLE)
      expect(titles.some((title) => /^Grade 5 math/.test(title.trim()))).toBe(false)
      await expect(assignmentCard(page, LESSON_TITLE).getByRole('button', { name: /^Start / })).toBeVisible()
    })

    await test.step('Start real lesson 1 and Study starts against the real catalog', async () => {
      await assignmentCard(page, LESSON_TITLE).getByRole('button', { name: /^Start / }).click()
      const working = page.getByRole('region', { name: `Working on ${LESSON_TITLE}` })
      await expect(working).toBeVisible()
      await expect(working.getByText('Warm-up recall')).toBeVisible()
      // ma-g5-mathematics-u01 is the pilot's one supervised unit — this is the
      // catalog lesson ref, not the host-lesson placeholder's `grade-5:math:day-1`.
      await expect(studyField(page, 'lessonRef')).toHaveText('ma-g5-mathematics-u01-l01')
      await expect(page.getByRole('button', { name: 'Save my place' })).toBeVisible()
    })

    await test.step('Finish this step: the segment actually advances', async () => {
      await expect(studyField(page, 'completedSegments')).toHaveText('0')
      await page.getByRole('button', { name: 'Finish this step' }).click()
      // Proves completeSegment no longer throws CalendarRuntimeError:
      // invalid_timestamp — a thrown rejection would render a role="alert".
      await expect(page.getByRole('alert')).toHaveCount(0)
      await expectOnSegmentTwo(page, LESSON_TITLE)
    })

    let studentRefBeforeReload = ''
    let blockRefBeforeReload = ''
    await test.step('Checkpoint / save place', async () => {
      studentRefBeforeReload = (await diagnostic(page, 'activeStudentRef').innerText()).trim()
      blockRefBeforeReload = (await diagnostic(page, 'activeSessionRef').innerText()).trim()
      await page.getByRole('button', { name: 'Save my place' }).click()
      await expect(page.getByRole('alert')).toHaveCount(0)
    })

    await test.step('Reload — resume the same learner/session, checkpoint and completed step retained', async () => {
      await page.reload()
      await expect(assignmentCard(page, LESSON_TITLE).getByText('In progress')).toBeVisible()
      await assignmentCard(page, LESSON_TITLE).getByRole('button', { name: /^Resume / }).click()
      // Resume rebuilds the Study session from Core's persisted record rather
      // than the in-memory ports (which do not survive a real reload) — the
      // SAME student/block identity below proves this is a genuine resume,
      // not a silent fresh start that happens to look the same.
      expect((await diagnostic(page, 'activeStudentRef').innerText()).trim()).toBe(studentRefBeforeReload)
      expect((await diagnostic(page, 'activeSessionRef').innerText()).trim()).toBe(blockRefBeforeReload)
      await expectOnSegmentTwo(page, LESSON_TITLE)
    })

    await test.step('Open "I need help": the static Tutor fallback is live (provider offline is fine for this pilot)', async () => {
      // FamilyPilotController never receives a tutorDeps/live-provider option
      // from FamilyPilotHost, so startHelp() always degrades to the static
      // fallback — there is no live Tutor Core path to go offline FROM in this
      // build. That is exactly the "static Family Pilot Tutor" state the pilot
      // targets for its first supervised run.
      await page.getByTestId('family-pilot-help').click()
      const tutor = page.getByTestId('family-pilot-tutor')
      await expect(tutor).toBeVisible()
      await expect(tutor.locator('[data-tutor="path"]')).toHaveText('static-fallback')
      await expect(tutor.locator('[data-tutor="text"]')).not.toBeEmpty()
      await expect(page.getByTestId('family-pilot-help-input')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Ask' })).toBeVisible()
    })

    await test.step('A deterministic concerning message, sent through the real textarea, automatically raises a safety hold', async () => {
      // No localStorage seeding anywhere in this step: the hold is produced by
      // the real Tutor bridge's isConcerning() check via controller.helpTurn,
      // reached only by typing into family-pilot-help-input and clicking Ask.
      await sendHelpMessage(page, 'I want to hurt myself')
      // The flagged turn re-runs the same entry gate resume() uses, which is
      // what surfaces the block below — no separate reload/seed step needed.
      await expect(page.getByRole('alert').filter({ hasText: 'This needs an adult to look at before continuing' }))
        .toBeVisible()
      // The learner is blocked, not left looking at a stale, still-usable lesson.
      await expect(page.getByTestId('family-pilot-study')).toHaveCount(0)
    })

    await test.step('The learner cannot silently continue: retrying is refused again', async () => {
      await assignmentCard(page, LESSON_TITLE).getByRole('button', { name: /^Resume / }).click()
      await expect(page.getByTestId('family-pilot-study')).toHaveCount(0)
      await expect(page.getByRole('alert').filter({ hasText: 'This needs an adult' })).toBeVisible()
    })

    let firstHoldRef: string | null = null
    await test.step('Parent view shows the exact hold', async () => {
      await page.getByTestId('family-pilot-parent-toggle').click()
      await expect(holdsSection(page)).toBeVisible()
      await expect(holdsSection(page).getByText(/tutor-concerning-content/)).toBeVisible()
      firstHoldRef = await currentHoldRef(page)
      expect(firstHoldRef).toBeTruthy()
    })

    await test.step('Parent chooses "Resolve and let them resume" and the learner resumes with progress intact', async () => {
      await page.getByRole('button', { name: 'Resolve and let them resume' }).click()
      await expect(holdsSection(page).getByText('Nothing is paused for Ada right now.')).toBeVisible()

      await assignmentCard(page, LESSON_TITLE).getByRole('button', { name: /^Resume / }).click()
      await expect(page.getByRole('alert').filter({ hasText: 'This needs an adult' })).toHaveCount(0)
      await expectOnSegmentTwo(page, LESSON_TITLE)
    })

    await test.step('A later concerning message opens a NEW hold and blocks again', async () => {
      await page.getByTestId('family-pilot-help').click()
      await sendHelpMessage(page, 'I hate myself')
      await expect(page.getByRole('alert').filter({ hasText: 'This needs an adult to look at before continuing' }))
        .toBeVisible()
      await expect(holdsSection(page).getByText(/tutor-concerning-content/)).toBeVisible()
      const secondHoldRef = await currentHoldRef(page)
      expect(secondHoldRef).toBeTruthy()
      expect(secondHoldRef).not.toBe(firstHoldRef)

      // Leave Ada in a clean, resumable state before switching learners below.
      await page.getByRole('button', { name: 'Resolve and let them resume' }).click()
      await expect(holdsSection(page).getByText('Nothing is paused for Ada right now.')).toBeVisible()
    })

    await test.step('A second learner is created and fully isolated from the first', async () => {
      await page.getByTestId('family-pilot-switch-student').click()
      await page.getByRole('listitem', { name: 'Continue as Bo' }).click()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Hi, Bo' })).toBeVisible()

      // Bo's own copy of the same real catalog, but untouched: no adult text,
      // no hold, no in-progress state leaked from Ada.
      await expect(page.getByText('This needs an adult', { exact: false })).toHaveCount(0)
      await expect(assignmentCard(page, LESSON_TITLE).getByText('Not started')).toBeVisible()
      await expect(assignmentCard(page, LESSON_TITLE).getByRole('button', { name: /^Start / })).toBeVisible()
    })

    await test.step('Switching back to the first learner: her progress remains intact', async () => {
      await page.getByTestId('family-pilot-switch-student').click()
      await page.getByRole('listitem', { name: 'Continue as Ada' }).click()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(assignmentCard(page, LESSON_TITLE).getByText('In progress')).toBeVisible()

      await assignmentCard(page, LESSON_TITLE).getByRole('button', { name: /^Resume / }).click()
      await expect(page.getByRole('alert').filter({ hasText: 'This needs an adult' })).toHaveCount(0)
      await expectOnSegmentTwo(page, LESSON_TITLE)
    })
  })
})
