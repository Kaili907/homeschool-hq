import { expect, test } from '@playwright/test'

// The full pilot success path (student login -> dashboard -> assigned
// Grade 5 Math work -> lesson -> progress -> resume) can't be exercised yet:
// the student-login and student-dashboard surfaces aren't on this branch's
// base (see WAITING_ON_MAC_STUDENT_OUTPUT.md). This smoke test only proves
// the reusable harness itself — server, build, app shell — works, so the
// pilot flow spec can be filled in without also debugging the harness.
test('pilot browser harness serves the built app shell', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.ok()).toBe(true)
  await expect(page).toHaveTitle(/Homeschool HQ/)
  await expect(page.locator('#root')).toBeAttached()
})

test('pilot browser harness health check responds', async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}/__pilot_test__/health`)
  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual({ ok: true })
})
