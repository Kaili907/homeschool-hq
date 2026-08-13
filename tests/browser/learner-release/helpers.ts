import { expect, type Page } from '@playwright/test'

export const APP_PATH = '/family-pilot'

export interface LessonTarget {
  readonly courseRef: string
  readonly lessonRef: string
  readonly title: string
}

export const LESSONS = Object.freeze({
  mathChoice: {
    courseRef: 'ma-g3-mathematics',
    lessonRef: 'ma-g3-mathematics-u01-l01',
    title: 'Launch and diagnostic: making sense of unfamiliar problems',
  },
  mathConstructed: {
    courseRef: 'ma-g3-mathematics',
    lessonRef: 'ma-g3-mathematics-u01-l11',
    title: 'Concept extension: subtraction with regrouping across zeros',
  },
  guardian: {
    courseRef: 'ma-g3-ready-for-life',
    lessonRef: 'ma-g3-ready-for-life-u01-l04',
    title: 'Application or project: spotting unsafe items',
  },
  dynamicSocial: {
    courseRef: 'ma-g3-social-studies',
    lessonRef: 'ma-g3-social-studies-u09-l01',
    title: 'Launch and diagnostic: specialization and interdependence',
  },
}) satisfies Readonly<Record<string, LessonTarget>>

export async function setupGrade3(page: Page, name = 'Avery Browser') {
  await page.goto(APP_PATH)
  await expect(page.getByRole('heading', { name: 'Set up your learners' })).toBeVisible()
  await page.getByLabel('Student display name').fill(name)
  await page.getByLabel('Nominal grade').selectOption('3')
  await page.getByRole('button', { name: 'Add student' }).click()
  await page.getByRole('button', { name: 'Finish family setup' }).click()
  await expect(page.getByRole('heading', { name: 'Household learning' })).toBeVisible()
}

export async function parentStudent(page: Page, name = 'Avery Browser') {
  await page.getByRole('button', { name: 'Parent', exact: true }).click()
  await page.getByLabel('Parent student').selectOption({ label: name })
}

export async function assign(page: Page, lesson: LessonTarget, name = 'Avery Browser') {
  await parentStudent(page, name)
  await page.getByRole('button', { name: 'Assignments & readiness' }).click()
  await page.getByLabel('Admitted course').selectOption(lesson.courseRef)
  const row = page.getByRole('listitem').filter({ hasText: lesson.title }).last()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: `Assign to ${name}` }).click()
  await expect(page.getByRole('heading', { name: 'Current work' }).locator('..').getByText(lesson.title)).toBeVisible()
}

export async function openStudent(page: Page, name = 'Avery Browser') {
  await page.getByRole('button', { name: 'Student', exact: true }).click()
  await page.getByRole('listitem', { name: `Continue as ${name}` }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: `Hi, ${name}` })).toBeVisible()
}

export async function start(page: Page, lesson: LessonTarget) {
  await page.getByRole('button', { name: `Start ${lesson.title}` }).click()
  await expect(page.locator('[data-material-ref]')).toBeVisible()
}

export async function resume(page: Page, lesson: LessonTarget) {
  await page.getByRole('button', { name: `Resume ${lesson.title}` }).click()
  await expect(page.locator('[data-material-ref]')).toBeVisible()
}

export async function submitEveryVisibleResponse(page: Page): Promise<'advanced' | 'blocked'> {
  for (let retry = 0; retry < 20; retry += 1) {
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true })
    if (await continueButton.count() && await continueButton.isVisible() && await continueButton.isEnabled()) {
      await continueButton.click()
      return 'advanced'
    }
    const choice = page.getByRole('radio').first()
    if (await choice.count() && await choice.isVisible() && await choice.isEnabled()) {
      await choice.check()
      await page.getByRole('button', { name: 'Submit answer' }).click()
      return 'advanced'
    }
    const response = page.getByLabel('Your response').first()
    if (await response.count() && await response.isVisible() && await response.isEnabled()) {
      await response.fill('Browser acceptance response with reasoning shown.')
      await page.getByRole('button', { name: 'Submit', exact: true }).click()
      return 'advanced'
    }
    const activity = page.getByLabel('Describe what you completed or where your evidence is saved')
    if (await activity.count() && await activity.isVisible() && await activity.isEnabled()) {
      await activity.fill('Completed with learner evidence saved on this device.')
      await page.getByLabel('I completed the action described above.').check()
      await page.getByRole('button', { name: 'Submit', exact: true }).click()
      return 'advanced'
    }
    const legacyCompletion = page.getByRole('button', { name: 'Mark step complete' })
    if (await legacyCompletion.count() && await legacyCompletion.isVisible() && await legacyCompletion.isEnabled()) return 'blocked'
    await page.waitForTimeout(100)
  }
  return 'blocked'
}
