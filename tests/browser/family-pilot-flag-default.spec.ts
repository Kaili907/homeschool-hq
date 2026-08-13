import { expect, test } from '@playwright/test'

test('the Family Pilot route stays off in a normal production build', async ({ page }) => {
  await page.goto('/family-pilot')
  await expect(page.locator('[data-family-pilot-release]')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Homeschool HQ' })).toBeVisible()
  await expect(page.getByText("Who's learning today?")).toBeVisible()
})
