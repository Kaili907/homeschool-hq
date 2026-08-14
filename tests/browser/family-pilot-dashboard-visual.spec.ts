import { expect, test, type Locator, type Page } from '@playwright/test'

const HARNESS = '/tests/browser/family-pilot-dashboard-harness.html'

async function centerOf(locator: Locator) {
  await expect(locator).toBeVisible()
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
}

async function mouseClickVisibleCenter(page: Page, locator: Locator) {
  const point = await centerOf(locator)
  await page.mouse.click(point.x, point.y)
  return point
}

test('route callback fixture and Jarvis activation boundary', async ({ page }) => {
  await page.goto(`${HARNESS}?state=lesson-ready`)
  const missionTitle = page.getByRole('heading', { name: 'Fractions in real-world situations' })
  const hitPoint = await centerOf(missionTitle)
  expect(await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y)
    return hit?.tagName === 'BUTTON' && hit.getAttribute('aria-label') === 'Start lesson'
  }, hitPoint)).toBe(true)
  await page.mouse.click(hitPoint.x, hitPoint.y)
  await page.getByRole('button', { name: 'Open Mathematics' }).click()
  await page.getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__familyDashboardEvents)).toEqual([
    'launch-attempt:work:math-fractions',
    'work:work:math-fractions',
    'course:course:math',
    'schedule',
  ])

  const jarvis = page.getByRole('button', { name: /Jarvis/ })
  await jarvis.click()
  await expect(page.getByRole('status')).toHaveText('Jarvis is visual only. Tutor is not connected in this release.')
  await expect.poll(() => page.evaluate(() => window.__familyDashboardEvents)).toHaveLength(4)

  await page.goto(`${HARNESS}?state=lesson-ready&jarvisCallback=true`)
  const requestsAfterLoad: string[] = []
  page.on('request', (request) => requestsAfterLoad.push(request.url()))
  await page.getByRole('button', { name: /Jarvis/ }).click()
  await expect.poll(() => page.evaluate(() => window.__familyDashboardEvents)).toEqual(['jarvis:activate'])
  expect(requestsAfterLoad).toEqual([])
})

test('all requested fixture states render supplied status copy', async ({ page }) => {
  const states = [
    ['no-work', 'Your schedule is clear'],
    ['lesson-ready', 'Ready to begin'],
    ['continue-lesson', 'In progress'],
    ['assessment-pending', 'Assessment pending'],
    ['guardian-pending', 'Guardian pending'],
    ['safety-blocked', 'Safety blocked'],
    ['social-source-blocked', 'Social source blocked'],
    ['storage-unavailable', 'Storage unavailable'],
  ] as const
  for (const [state, status] of states) {
    await page.goto(`${HARNESS}?state=${state}`)
    await expect(page.locator('main')).toHaveAttribute('data-mission-state', state)
    await expect(page.getByText(status, { exact: true })).toBeVisible()
  }
})

test('reduced motion stops Jarvis animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${HARNESS}?state=lesson-ready`)
  for (const selector of [
    '.family-dashboard__jarvis-halo',
    '.family-dashboard__jarvis-outer-detail',
    '.family-dashboard__jarvis-secondary-orbit',
  ]) {
    await expect(page.locator(selector)).toHaveCSS('animation-name', 'none')
  }
})

test('keyboard navigation exposes the skip link and visible focus', async ({ page }) => {
  await page.goto(`${HARNESS}?state=lesson-ready&launchFailure=true`)
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to today’s work' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('#family-dashboard-mission')).toBeInViewport()
  await page.keyboard.press('Tab')
  const missionAction = page.getByRole('button', { name: 'Start lesson' })
  await expect(missionAction).toBeFocused()
  await expect(missionAction).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Enter')
  await expect(page.locator('.family-dashboard__launch-notice[role="status"]')).toHaveText('Opening lesson…')
  await expect(page.getByRole('alert')).toContainText('We couldn’t open this lesson.')

  await page.reload()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const todayAction = page.getByRole('button', { name: 'Start Fractions in real-world situations' })
  await expect(todayAction).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.locator('.family-dashboard__launch-notice[role="status"]')).toHaveText('Opening lesson…')
  await expect(page.getByRole('alert')).toContainText('We couldn’t open this lesson.')
})

test('Today’s Work has an explicit action, immediate feedback, duplicate suppression, and safe failure copy', async ({ page }) => {
  await page.goto(`${HARNESS}?state=lesson-ready&launchFailure=true&launchDelay=150`)
  const rowTitle = page.getByText('Forces and motion', { exact: true })
  await mouseClickVisibleCenter(page, rowTitle)
  await expect(page.locator('.family-dashboard__launch-notice[role="status"]')).toHaveText('Opening lesson…')
  await expect(page.getByRole('button', { name: 'Start lesson' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Start Forces and motion' })).toBeDisabled()
  await mouseClickVisibleCenter(page, rowTitle)
  const failure = page.getByRole('alert')
  await expect(failure).toContainText('We couldn’t open this lesson. Please try again or ask a parent for help.')
  await expect(failure).toBeFocused()
  await expect(page.locator('body')).not.toContainText('TECHNICAL_LAUNCH_CODE_42')
  await expect.poll(() => page.evaluate(() => window.__familyDashboardEvents)).toEqual([
    'launch-attempt:work:science-motion',
  ])
})

test('actionable assessment uses the same feedback and launch callback', async ({ page }) => {
  await page.goto(`${HARNESS}?state=assessment-pending&launchDelay=150`)
  await mouseClickVisibleCenter(page, page.getByRole('heading', { name: 'Mathematics unit assessment' }))
  await expect(page.locator('.family-dashboard__launch-notice[role="status"]')).toHaveText('Opening assessment…')
  await expect.poll(() => page.evaluate(() => window.__familyDashboardEvents)).toEqual([
    'launch-attempt:assessment:math-1',
    'work:assessment:math-1',
  ])
})

for (const device of [
  { name: 'phone', width: 390, height: 844, target: 'mission' },
  { name: 'tablet', width: 768, height: 1024, target: 'today' },
] as const) {
  test(`${device.name} real touch activates a visible ${device.target} hit target`, async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, viewport: { width: device.width, height: device.height } })
    const page = await context.newPage()
    await page.goto(`${HARNESS}?state=lesson-ready`)
    const target = device.target === 'mission'
      ? page.getByRole('heading', { name: 'Fractions in real-world situations' })
      : page.getByText('Forces and motion', { exact: true })
    const point = await centerOf(target)
    await page.touchscreen.tap(point.x, point.y)
    const expectedRef = device.target === 'mission' ? 'work:math-fractions' : 'work:science-motion'
    await expect.poll(() => page.evaluate(() => window.__familyDashboardEvents)).toEqual([
      `launch-attempt:${expectedRef}`,
      `work:${expectedRef}`,
    ])
    await context.close()
  })
}

for (const viewport of [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const) {
  test(`${viewport.name} layout keeps the mission primary and Jarvis unclipped`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`${HARNESS}?state=lesson-ready`)
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(horizontalOverflow).toBeLessThanOrEqual(1)
    const core = await page.locator('.family-dashboard__jarvis-core').boundingBox()
    expect(core).not.toBeNull()
    expect(core!.x).toBeGreaterThanOrEqual(0)
    expect(core!.x + core!.width).toBeLessThanOrEqual(viewport.width)
    await expect(page.locator('#family-dashboard-mission')).toBeVisible()
    await expect(page).toHaveScreenshot(`family-dashboard-${viewport.name}.png`, {
      fullPage: true,
      animations: 'disabled',
      // Font antialiasing can vary by a handful of edge pixels across otherwise
      // identical Darwin Chromium captures; layout and clipping are asserted above.
      maxDiffPixels: 10,
    })
  })
}
