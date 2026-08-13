import { expect, test } from '@playwright/test'
import { APP_PATH, LESSONS, assign, openStudent, parentStudent, resume, setupGrade3, start, submitEveryVisibleResponse } from './helpers'

const RESPONSE_KEY = 'manuel-academy:family-pilot:learner-responses:v1'

test('Grade 3 repaired Math renders a real choice, submits it, and preserves pending work across reload', async ({ page }) => {
  const networkUrls = new Set<string>()
  page.on('request', (request) => networkUrls.add(request.url()))
  await setupGrade3(page)
  await assign(page, LESSONS.mathChoice)
  await openStudent(page)
  await start(page, LESSONS.mathChoice)

  await expect(page.getByText('Round 647 to the nearest 100.').first()).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('radio').first()).toBeVisible()
  await page.getByRole('radio').first().check()
  await page.getByRole('button', { name: 'Submit answer' }).click()
  await expect(page.getByText('Response saved on this device. Assessment is pending.')).toBeVisible()

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), RESPONSE_KEY)
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({ responseType: 'CHOICE', status: 'PENDING_ASSESSMENT', assessment: null })
  expect(JSON.stringify(saved)).not.toMatch(/correct|incorrect|answer.?key|score/i)

  await page.reload()
  await expect(page).toHaveURL(new RegExp(`${APP_PATH.replace('/', '\\/')}$`))
  await openStudent(page)
  await resume(page, LESSONS.mathChoice)
  await expect(page.getByText('1 saved response pending assessment.')).toBeVisible()
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), RESPONSE_KEY)).toEqual(saved)
  await expect(page.getByText('A farm had 225 apples. 42 apples were given away. How many apples are left?').last()).toBeVisible()

  expect([...networkUrls].some((url) => /answer|scoring|teacher-guide/i.test(url))).toBe(false)
  await expect(page.locator('body')).not.toContainText(/answer key|correct answer|teacher guide|scoring guide/i)
})

test('actual Grade 3 constructed-response work renders a submittable response control', async ({ page }) => {
  await setupGrade3(page)
  await assign(page, LESSONS.mathConstructed)
  await openStudent(page)
  await start(page, LESSONS.mathConstructed)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // Finish the choice-bearing Practice segment so the real extension questions
  // are reached through production Study progression.
  for (let guard = 0; guard < 12; guard += 1) {
    if (await page.getByText('Step 3 of 3', { exact: true }).isVisible().catch(() => false)) break
    expect(await submitEveryVisibleResponse(page), `progression blocked on loop ${guard}`).toBe('advanced')
  }
  await expect(page.getByText('Step 3 of 3', { exact: true })).toBeVisible()
  await expect(page.getByText('A farm had 219 apples. They received 308 more apples. How many apples are there now?')).toBeVisible()
  await expect(page.getByLabel('Your response')).toBeVisible()
  await page.getByLabel('Your response').fill('527, because 219 + 308 = 527.')
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.getByText('Response saved on this device. Assessment is pending.')).toBeVisible()
})

test('dynamic Social Studies blocks, then unlocks only after adult source metadata', async ({ page }) => {
  await setupGrade3(page)
  await assign(page, LESSONS.dynamicSocial)
  await openStudent(page)
  await page.getByRole('button', { name: `Start ${LESSONS.dynamicSocial.title}` }).click()
  await expect(page.getByRole('heading', { name: 'Lesson not ready' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('source')
  await page.getByRole('button', { name: 'Back to Home' }).click()

  await parentStudent(page)
  await page.getByLabel('Source title').fill('Michigan public issue packet')
  await page.getByLabel('Publisher').fill('Manuel Academy family library')
  await page.getByLabel('Publication date').fill('2026-08-13')
  await page.getByRole('button', { name: 'Attach qualifying metadata' }).click()
  await expect(page.getByText(/ATTACHED_SATISFIED/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/ATTACHED_SATISFIED/)).toBeVisible()

  await openStudent(page)
  await start(page, LESSONS.dynamicSocial)
  await expect(page.getByRole('heading', { name: 'Lesson not ready' })).toHaveCount(0)
  await expect(page.locator('[data-material-ref]')).toContainText(LESSONS.dynamicSocial.title)
})

test('Ready for Life learner work reaches guardian-pending without a learner self-certification control', async ({ page }) => {
  await setupGrade3(page)
  await assign(page, LESSONS.guardian)
  await openStudent(page)
  await start(page, LESSONS.guardian)

  for (let guard = 0; guard < 40; guard += 1) {
    if (await page.getByRole('heading', { name: 'Work finished — parent sign-off pending' }).isVisible().catch(() => false)) break
    expect(await submitEveryVisibleResponse(page), `RFL progression blocked on loop ${guard}`).toBe('advanced')
  }
  await expect(page.getByRole('heading', { name: 'Work finished — parent sign-off pending' })).toBeVisible()
  await expect(page.getByRole('button', { name: /attest/i })).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Parent', exact: true }).click()
  await parentStudent(page)
  await expect(page.getByRole('heading', { name: 'Guardian attestation pending' })).toBeVisible()
})
