import { expect, test } from '@playwright/test'

const HARNESS = '/tests/browser/family-pilot-dashboard-harness.html'

test('route callback fixture and Jarvis activation boundary', async ({ page }) => {
  await page.goto(`${HARNESS}?state=lesson-ready`)
  await page.getByRole('button', { name: 'Start lesson' }).click()
  await page.getByRole('button', { name: 'Open Mathematics' }).click()
  await page.getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__familyDashboardEvents)).toEqual([
    'work:work:math-fractions',
    'course:course:math',
    'schedule',
  ])

  const jarvis = page.getByRole('button', { name: /Jarvis/ })
  await jarvis.click()
  await expect(page.getByRole('status')).toHaveText('Jarvis is visual only. Tutor is not connected in this release.')
  await expect.poll(() => page.evaluate(() => window.__familyDashboardEvents)).toHaveLength(3)

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
  await page.goto(`${HARNESS}?state=lesson-ready`)
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
})

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
    await expect(page).toHaveScreenshot(`family-dashboard-${viewport.name}.png`, { fullPage: true, animations: 'disabled' })
  })
}
