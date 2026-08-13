import { expect, test, type Locator, type Page } from '@playwright/test'
import { defaultAppState } from '../../../src/migration'
import { APP_STATE_STORAGE_KEY } from '../../../src/sync/provenance'

// FAMILY-PILOT-SAFETY-CLICKTHROUGH-H1: reproduces and guards against a
// coordinate click-through race found in a live browser review:
//
//   Parent view OPEN -> learner opens "I need help" -> types a concerning
//   message -> double-clicks Ask.
//
//   First physical click: helpTurn -> isConcerning -> a Family Pilot safety
//   hold is created -> the learner's study card collapses (clearOnReject in
//   IntegratedFamilyPilot), reflowing everything below it, including the
//   Parent Hub's newly-visible "Resolve and let them resume" button.
//
//   Second physical click of the SAME double-click gesture lands moments
//   later, with no chance for a human to look, aim or wait. If the reflow has
//   already put "Resolve and let them resume" on screen by then, that second
//   click resolves the hold without any deliberate adult action.
//
// This drives only the rendered UI: no hold is ever seeded, and neither
// helpTurn nor resolveHold is called directly. Both physical clicks are real
// clicks; the second lands on "Resolve and let them resume" the instant it
// exists — a locator click's own actionability wait (tens of ms) stands in
// for the ~16ms created-then-cleared gap the live report measured, since the
// exact pixel delta a reflow produces depends on how much curriculum content
// is on the page, while the danger is purely about elapsed time, not pixels.

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

function assignmentsRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Your assignments' })
}

function assignmentCard(page: Page, title: string): Locator {
  return assignmentsRegion(page).getByRole('listitem').filter({ hasText: title })
}

function holdsSection(page: Page): Locator {
  return page.getByTestId('family-pilot-safety-holds')
}

async function currentHoldRef(page: Page): Promise<string | null> {
  const items = holdsSection(page).locator('[data-hold-ref]')
  if ((await items.count()) === 0) return null
  return items.first().getAttribute('data-hold-ref')
}

async function addLearner(page: Page, name: string): Promise<void> {
  await page.getByLabel('New learner name').fill(name)
  await page.getByRole('button', { name: 'Add learner' }).click()
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
}

async function loginAs(page: Page, name: string): Promise<void> {
  await page.getByTestId('family-pilot-switch-student').click()
  await page.getByRole('listitem', { name: `Continue as ${name}` }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: `Hi, ${name}` })).toBeVisible()
}

const LESSON_TITLE = 'Launch and diagnostic: problem-solving routines'

/**
 * Starts the lesson, opens Parent view (BEFORE the race, matching the live
 * report), opens help and types a deterministic concerning message. Leaves
 * the Ask button visible and ready for the double-click.
 */
async function reachArmedAskButton(page: Page): Promise<void> {
  await assignmentCard(page, LESSON_TITLE).getByRole('button', { name: /^Start / }).click()
  await expect(page.getByRole('region', { name: `Working on ${LESSON_TITLE}` })).toBeVisible()

  await page.getByTestId('family-pilot-parent-toggle').click()
  await expect(holdsSection(page)).toBeVisible()
  await expect(holdsSection(page).getByText('Nothing is paused')).toBeVisible()

  await page.getByTestId('family-pilot-help').click()
  await expect(page.getByTestId('family-pilot-tutor')).toBeVisible()

  await expect(page.getByRole('button', { name: 'Ask' })).toBeDisabled()
  await page.getByTestId('family-pilot-help-input').fill('   ')
  await expect(page.getByRole('button', { name: 'Ask' })).toBeDisabled()

  await page.getByTestId('family-pilot-help-input').fill('I want to hurt myself')
}

/**
 * Fires the double-click race: a real first click on Ask, then an immediate
 * second real click on whatever "Resolve and let them resume" control exists
 * the instant it mounts.
 *
 * This app's real curriculum content (18 assignment cards, StudentExperience's
 * own open-assignment view) makes the exact pixel delta the reflow produces
 * depend on how much content is on the page — not a fixed, portable offset.
 * What is constant, and what a real rapid double-click actually depends on,
 * is TIMING: the second physical mousedown/mouseup lands only milliseconds
 * after the first, with no chance for a human to look, aim or wait — the live
 * report measured the hold created-then-cleared gap at ~16ms. A Playwright
 * locator click's own actionability wait (a couple of animation frames —
 * tens of ms) is the same order of magnitude, so clicking the Resolve control
 * by role the instant it exists is the faithful, layout-independent
 * reproduction of that same rapid, non-deliberate activation — not a
 * deliberate, considered parent action.
 */
async function rapidDoubleClickAsk(page: Page): Promise<void> {
  const askButton = page.getByRole('button', { name: 'Ask' })
  await askButton.click()

  const resolveButton = page.getByRole('button', { name: 'Resolve and let them resume' })
  await resolveButton.click()
}

/**
 * A genuine, deliberate parent action: waits for the arm-delay boundary
 * (`data-armed="true"`) before clicking — the one path that should ever
 * actually clear a hold.
 */
async function deliberateResolve(page: Page): Promise<void> {
  const resolveButton = page.getByRole('button', { name: 'Resolve and let them resume' })
  await expect(resolveButton).toHaveAttribute('data-armed', 'true')
  await resolveButton.click()
}

test.describe('Family Pilot — safety hold click-through race (browser regression)', () => {
  test.beforeEach(async ({ page }) => {
    await seedBootProfile(page)
    await page.goto('/family-pilot')
    await addLearner(page, 'Ada')
    await addLearner(page, 'Bo')
    await loginAs(page, 'Ada')
  })

  test('a rapid double-click on Ask cannot click through onto the relocated Resolve control', async ({ page }) => {
    await reachArmedAskButton(page)

    await test.step('the double-click race: hold is created but never click-through-resolved', async () => {
      await rapidDoubleClickAsk(page)

      // Requirement: learner remains blocked.
      await expect(page.getByRole('alert').filter({ hasText: 'This needs an adult to look at before continuing' }))
        .toBeVisible()
      await expect(page.getByTestId('family-pilot-study')).toHaveCount(0)

      // Requirement: the hold is still OPEN — no click-through resolution.
      await expect(holdsSection(page).getByText(/tutor-concerning-content/)).toBeVisible()
      const holdRef = await currentHoldRef(page)
      expect(holdRef).toBeTruthy()
      await expect(holdsSection(page).getByText('Nothing is paused')).toHaveCount(0)
    })

    let firstHoldRef: string | null = null
    await test.step('parent sees the exact hold and a deliberate resolve succeeds', async () => {
      firstHoldRef = await currentHoldRef(page)
      expect(firstHoldRef).toBeTruthy()
      // A genuine, deliberate action — the ONLY way this hold should ever clear.
      await deliberateResolve(page)
      await expect(holdsSection(page).getByText('Nothing is paused for Ada right now.')).toBeVisible()

      await assignmentCard(page, LESSON_TITLE).getByRole('button', { name: /^Resume / }).click()
      await expect(page.getByRole('alert').filter({ hasText: 'This needs an adult' })).toHaveCount(0)
      await expect(page.getByTestId('family-pilot-study')).toBeVisible()
    })

    await test.step('the same race is protected again for a second concerning message', async () => {
      await page.getByTestId('family-pilot-help').click()
      await expect(page.getByTestId('family-pilot-tutor')).toBeVisible()
      await page.getByTestId('family-pilot-help-input').fill('I hate myself')

      await rapidDoubleClickAsk(page)

      await expect(page.getByRole('alert').filter({ hasText: 'This needs an adult to look at before continuing' }))
        .toBeVisible()
      await expect(holdsSection(page).getByText(/tutor-concerning-content/)).toBeVisible()
      const secondHoldRef = await currentHoldRef(page)
      expect(secondHoldRef).toBeTruthy()
      expect(secondHoldRef).not.toBe(firstHoldRef)
      await expect(holdsSection(page).getByText('Nothing is paused')).toHaveCount(0)

      // Clean deliberate resolve, leaving Ada resumable.
      await deliberateResolve(page)
      await expect(holdsSection(page).getByText('Nothing is paused for Ada right now.')).toBeVisible()
    })

    await test.step('learner B was never touched by Ada’s hold or the race', async () => {
      await page.getByTestId('family-pilot-switch-student').click()
      await page.getByRole('listitem', { name: 'Continue as Bo' }).click()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Hi, Bo' })).toBeVisible()
      await expect(page.getByText('This needs an adult', { exact: false })).toHaveCount(0)
      await expect(assignmentCard(page, LESSON_TITLE).getByText('Not started')).toBeVisible()
    })
  })
})
