import { expect, test, type Page } from '@playwright/test'

const REVIEW_HOME = '/__review/lesson-samples'

const SAMPLES = [
  { subject: 'Arts/Music', route: '/__review/g9-visual-hierarchy' },
  { subject: 'Technology', route: '/__review/technology-algorithms' },
  { subject: 'Ready for Life', route: '/__review/ready-for-life' },
  { subject: 'Financial Literacy', route: '/__review/financial-literacy' },
  { subject: 'Health', route: '/__review/health' },
  { subject: 'Physical Education', route: '/__review/physical-education' },
] as const

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0)
      - document.documentElement.clientWidth
  ))
  expect(overflow).toBeLessThanOrEqual(1)
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.name}: every completed lesson sample opens cleanly from the Director hub`, async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const failedRequests: string[] = []
    const badResponses: string[] = []

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`))
    page.on('response', (response) => {
      if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`)
    })

    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto(REVIEW_HOME)
    await expect(page.getByRole('heading', { level: 1, name: 'Director lesson samples' })).toBeVisible()
    await expect(page.locator('.director-review-card')).toHaveCount(SAMPLES.length)
    await expect(page.getByLabel(`${SAMPLES.length} samples available`)).toBeVisible()
    await expectNoDocumentOverflow(page)

    await page.keyboard.press('Tab')
    await expect(page.locator('.director-review-open').first()).toBeFocused()

    for (const sample of SAMPLES) {
      await page.goto(REVIEW_HOME)
      const openSample = page.getByRole('link', { name: new RegExp(`^Open ${sample.subject.replace('/', '\\/')} sample:`) })
      await expect(openSample).toHaveAttribute('href', sample.route)
      await openSample.click()
      await expect.poll(() => new URL(page.url()).pathname).toBe(sample.route)
      await expect(page.locator('main')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await expect(page.getByRole('heading', { level: 1, name: 'Review route not found' })).toHaveCount(0)
      await expectNoDocumentOverflow(page)
    }

    expect(consoleErrors, 'console errors').toEqual([])
    expect(pageErrors, 'uncaught page errors').toEqual([])
    expect(failedRequests, 'failed network requests').toEqual([])
    expect(badResponses, 'HTTP error responses').toEqual([])
  })
}
