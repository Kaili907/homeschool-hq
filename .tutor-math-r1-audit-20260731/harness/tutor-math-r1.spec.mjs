import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { expect, test } from '../../adaptive-tutor/study-engine/integration-labs/student-runtime/node_modules/@playwright/test/index.mjs'

const evidenceRoot = path.resolve(process.env.MATH_R1_EVIDENCE ?? '../evidence/final/browser')

function projectEvidence(testInfo) {
  return path.join(evidenceRoot, testInfo.project.name)
}

async function assertUsableFocus(page, expectedId) {
  const focus = await page.evaluate(() => {
    const active = document.activeElement
    const rect = active?.getBoundingClientRect()
    const style = active ? getComputedStyle(active) : null
    return {
      tag: active?.tagName ?? null,
      id: active?.id || null,
      body: active === document.body,
      connected: Boolean(active?.isConnected),
      disabled: Boolean(active?.disabled),
      ariaHidden: Boolean(active?.closest('[aria-hidden="true"]')),
      inert: Boolean(active?.closest('[inert]')),
      visible:
        Boolean(rect && rect.width > 0 && rect.height > 0) &&
        style?.display !== 'none' &&
        style?.visibility !== 'hidden' &&
        style?.visibility !== 'collapse',
      focusIndicator:
        Boolean(style) &&
        ((style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2) || style.boxShadow !== 'none'),
    }
  })
  expect(focus.body).toBe(false)
  expect(focus.connected).toBe(true)
  expect(focus.disabled).toBe(false)
  expect(focus.ariaHidden).toBe(false)
  expect(focus.inert).toBe(false)
  expect(focus.visible).toBe(true)
  expect(focus.focusIndicator).toBe(true)
  if (expectedId) expect(focus.id).toBe(expectedId)
  return focus
}

function collectRuntimeFailures(page) {
  const failures = { console: [], pageErrors: [], requestFailures: [], badResponses: [], externalRequests: [] }
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      failures.console.push({ type: message.type(), text: message.text() })
    }
  })
  page.on('pageerror', (error) => failures.pageErrors.push(error.message))
  page.on('requestfailed', (request) => failures.requestFailures.push(request.url()))
  page.on('response', (response) => {
    if (response.status() >= 400) failures.badResponses.push({ url: response.url(), status: response.status() })
  })
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) failures.externalRequests.push(request.url())
  })
  return failures
}

async function screenshot(page, testInfo, filename) {
  const directory = projectEvidence(testInfo)
  await fs.mkdir(directory, { recursive: true })
  await page.screenshot({ path: path.join(directory, filename), fullPage: true })
}

async function tabToAnswer(page, tabs, activationKey) {
  for (let index = 0; index < tabs; index += 1) await page.keyboard.press('Tab')
  await page.keyboard.press(activationKey)
  await assertUsableFocus(page, 'reason')
}

async function submitReasoning(page, reasoning, activationKey = 'Enter') {
  await page.keyboard.type(reasoning)
  await page.keyboard.press('Tab')
  await page.keyboard.press(activationKey)
  await assertUsableFocus(page, 'prompt')
}

async function activateOnlyAction(page, activationKey = 'Enter') {
  await page.keyboard.press('Tab')
  await page.keyboard.press(activationKey)
  await assertUsableFocus(page, 'prompt')
}

test.beforeAll(async ({ browser }, testInfo) => {
  const directory = projectEvidence(testInfo)
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(
    path.join(directory, 'environment.json'),
    `${JSON.stringify(
      {
        startedAt: new Date().toISOString(),
        browserVersion: browser.version(),
        project: testInfo.project.name,
        automation: 'Playwright 1.62.0',
        headless: true,
        viewport: { width: 1280, height: 900 },
        baseURL: testInfo.project.use.baseURL,
        documentRoot: process.env.MATH_R1_DOCUMENT_ROOT ?? null,
      },
      null,
      2,
    )}\n`,
  )
})

test('keyboard-only supported flow reaches every adaptive stage', async ({ page }, testInfo) => {
  const failures = collectRuntimeFailures(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Adaptive Math: Regrouping Across Zeros' })).toBeVisible()
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'assessment')
  await assertUsableFocus(page, 'prompt')
  await screenshot(page, testInfo, '01-initial-assessment.png')

  await tabToAnswer(page, 4, 'Space')
  await screenshot(page, testInfo, '08-visible-keyboard-focus.png')
  await submitReasoning(page, 'I traced left through both zero columns.', 'Enter')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'reasoning-evidence')
  await expect(page.locator('#feedback')).not.toContainText('misconception')

  await activateOnlyAction(page, 'Space')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'teach-visually')
  await screenshot(page, testInfo, '02-visual-teaching-or-fallback.png')
  await activateOnlyAction(page, 'Enter')

  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'guided-practice')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-item-id', 'math-pv-g04')
  await screenshot(page, testInfo, '03-guided-practice.png')
  await tabToAnswer(page, 1, 'Enter')
  await submitReasoning(page, 'I regrouped across both zeros and subtracted by place.', 'Space')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'guided-evidence')
  await activateOnlyAction(page, 'Enter')

  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'independent-attempt')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-item-id', 'math-pv-m03')
  await screenshot(page, testInfo, '04-independent-attempt.png')
  await tabToAnswer(page, 1, 'Space')
  await submitReasoning(page, 'I kept every place aligned while making equal trades.', 'Enter')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'independent-evidence')
  await activateOnlyAction(page, 'Space')

  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'reassess')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-item-id', 'math-pv-m02')
  await screenshot(page, testInfo, '05-reassessment.png')
  await tabToAnswer(page, 2, 'Enter')
  await submitReasoning(page, 'I added by place and regrouped each total of ten or more.', 'Space')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'reassessment-evidence')
  await activateOnlyAction(page, 'Enter')

  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'advance')
  await expect(page.getByRole('heading', { name: 'Mastery checkpoint illustrated—demo complete' })).toBeVisible()
  await expect(page.locator('#feedback')).toContainText('does not establish cross-session mastery')
  await expect(page.locator('body')).not.toContainText('Different Example')
  await screenshot(page, testInfo, '06-mastery-or-continued-support.png')
  expect(failures).toEqual({ console: [], pageErrors: [], requestFailures: [], badResponses: [], externalRequests: [] })
})

test('difficulty route clears reasoning and cannot resubmit a stale value', async ({ page }) => {
  const sentinel = 'R1_STALE_REASONING_SENTINEL'
  await page.goto('/')
  await assertUsableFocus(page, 'prompt')
  await tabToAnswer(page, 1, 'Enter')
  await submitReasoning(page, sentinel, 'Space')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'identify-missing-concept')
  await expect(page.locator('#feedback')).toContainText('one response is not enough to diagnose')
  await activateOnlyAction(page, 'Enter')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'teach-visually')
  await activateOnlyAction(page, 'Space')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'guided-practice')
  await expect(page.locator('#reason')).toHaveValue('')
  await expect(page.locator('#feedback')).toHaveText('')

  await tabToAnswer(page, 1, 'Enter')
  await expect(page.locator('#reason')).toHaveValue('')
  await expect(page.locator('#feedback')).not.toContainText(sentinel)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'guided-practice')
  await expect(page.locator('#reason')).toHaveAttribute('aria-invalid', 'true')
  await assertUsableFocus(page, 'reason')
  await expect(page.locator('textarea')).not.toHaveValue(sentinel)

  await submitReasoning(page, 'Fresh guided reasoning for this item.', 'Space')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'guided-evidence')
  await expect(page.locator('#feedback')).not.toContainText('possible misconception')
})

test('correct-but-uncertain response preserves uncertainty and routes to clarification', async ({ page }, testInfo) => {
  await page.goto('/')
  await assertUsableFocus(page, 'prompt')
  await tabToAnswer(page, 4, 'Enter')
  await submitReasoning(page, 'I am not sure; I guessed.', 'Space')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'uncertainty-clarification')
  await expect(page.locator('#feedback')).toHaveAttribute('data-feedback-class', 'correct-uncertain')
  await expect(page.locator('#feedback')).toContainText('uncertainty or guessing')
  await expect(page.locator('#feedback')).toContainText('not confident positive evidence or mastery credit')
  await expect(page.locator('#feedback')).not.toContainText('Good evidence')
  await expect(page.locator('#evidenceCount')).toHaveText('Evidence: 1')
  await screenshot(page, testInfo, '07-correct-but-uncertain.png')
  await activateOnlyAction(page, 'Enter')
  await expect(page.locator('#demoCard')).toHaveAttribute('data-phase', 'teach-visually')
  await expect(page.getByRole('heading', { name: 'Clarify the trade with a visual model' })).toBeVisible()
})

test('fallbacks, reduced motion, resources, layout, and safety remain usable', async ({ page }) => {
  const failures = collectRuntimeFailures(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined })
    window.__r1UnhandledRejections = []
    window.__r1CameraRequests = 0
    window.addEventListener('unhandledrejection', (event) => {
      window.__r1UnhandledRejections.push(String(event.reason))
    })
  })
  await page.goto('/')

  await expect(page.locator('.fallback-note')).toContainText('No voice, image download, or other media is required')
  const state = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    nonzeroTransitions: Array.from(document.querySelectorAll('*')).filter(
      (element) => Number.parseFloat(getComputedStyle(element).transitionDuration) > 0,
    ).length,
    images: document.images.length,
    externalResources: Array.from(document.querySelectorAll('[src],link[href]'))
      .map((element) => element.src || element.href)
      .filter((url) => url && !url.startsWith('data:'))
      .filter((url) => !new URL(url).hostname.match(/^(127\.0\.0\.1|localhost)$/)),
    unhandledRejections: window.__r1UnhandledRejections,
    cameraRequests: window.__r1CameraRequests,
  }))
  expect(state.scrollWidth).toBeLessThanOrEqual(state.clientWidth)
  expect(state.reducedMotion).toBe(true)
  expect(state.nonzeroTransitions).toBe(0)
  expect(state.images).toBe(0)
  expect(state.externalResources).toEqual([])
  expect(state.unhandledRejections).toEqual([])
  expect(state.cameraRequests).toBe(0)

  await expect(page.locator('body')).toContainText('ungraded demo')
  await expect(page.locator('body')).toContainText('No diagnosis, placement decision, homework completion, camera')
  await tabToAnswer(page, 4, 'Space')
  await expect(page.locator('#feedback')).toContainText('before any feedback is revealed')
  expect(failures).toEqual({ console: [], pageErrors: [], requestFailures: [], badResponses: [], externalRequests: [] })
})
