import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '../../adaptive-tutor/study-engine/integration-labs/student-runtime/node_modules/playwright/index.mjs'

const baseURL = process.env.MATH_R1_BASE_URL ?? 'http://127.0.0.1:4173/'
const evidenceDir = process.env.MATH_R1_EVIDENCE ?? path.resolve('../evidence/pre-correction/edge')
const edgePath = process.env.MATH_R1_EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
await fs.mkdir(evidenceDir, { recursive: true })

const startedAt = new Date().toISOString()
const consoleEntries = []
const pageErrors = []
const browser = await chromium.launch({ executablePath: edgePath, headless: true })
const browserVersion = browser.version()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
page.on('console', (message) => consoleEntries.push({ type: message.type(), text: message.text() }))
page.on('pageerror', (error) => pageErrors.push(error.message))

const activeState = () =>
  page.evaluate(() => {
    const active = document.activeElement
    const reason = document.querySelector('#reason')
    return {
      active: {
        tag: active?.tagName ?? null,
        id: active?.id || null,
        connected: Boolean(active?.isConnected),
        visible: Boolean(active?.getClientRects().length),
      },
      phase: document.querySelector('#phase')?.textContent ?? null,
      prompt: document.querySelector('#prompt')?.textContent ?? null,
      feedback: document.querySelector('#feedback')?.textContent ?? null,
      reasoningValue: reason?.value ?? null,
    }
  })

async function activateByKeyboard(locator, key = 'Enter') {
  await locator.focus()
  await page.keyboard.press(key)
}

await page.goto(baseURL, { waitUntil: 'load' })
await page.screenshot({ path: path.join(evidenceDir, '01-initial-assessment-edge.png'), fullPage: true })

await activateByKeyboard(page.getByRole('button', { name: 'Ones place', exact: true }))
const afterKeyboardAnswer = await activeState()
await page.getByLabel('Explain your reasoning', { exact: true }).fill('I started at the ones place.')
await activateByKeyboard(page.getByRole('button', { name: 'Continue one step', exact: true }))
const afterContinue = await activeState()

await activateByKeyboard(page.getByRole('button', { name: 'Thousands', exact: true }), 'Space')
const reasoningLeak = await activeState()
await page.getByLabel('Explain your reasoning', { exact: true }).fill('The first nonzero place is thousands.')
await activateByKeyboard(page.getByRole('button', { name: 'Continue one step', exact: true }))
const firstDifferentExample = await activeState()

await activateByKeyboard(page.getByRole('button', { name: '1 thousand becomes 10 hundreds', exact: true }))
const secondReasoningLeak = await activeState()
await page.getByLabel('Explain your reasoning', { exact: true }).fill('One thousand is ten hundreds.')
await activateByKeyboard(page.getByRole('button', { name: 'Continue one step', exact: true }))
const repeatedDifferentExample = await activeState()
await page.screenshot({ path: path.join(evidenceDir, '02-different-example-loop-edge.png'), fullPage: true })

await page.reload({ waitUntil: 'load' })
await activateByKeyboard(page.getByRole('button', { name: 'Thousands place', exact: true }))
await page.getByLabel('Explain your reasoning', { exact: true }).fill('I am not sure; I guessed.')
await activateByKeyboard(page.getByRole('button', { name: 'Continue one step', exact: true }))
const uncertaintyConverted = await activeState()
await page.screenshot({ path: path.join(evidenceDir, '03-correct-uncertainty-converted-edge.png'), fullPage: true })

const report = {
  startedAt,
  completedAt: new Date().toISOString(),
  browser: 'Microsoft Edge',
  browserVersion,
  automation: 'Playwright 1.62.0',
  headless: true,
  viewport: { width: 1280, height: 900 },
  baseURL,
  states: {
    afterKeyboardAnswer,
    afterContinue,
    reasoningLeak,
    firstDifferentExample,
    secondReasoningLeak,
    repeatedDifferentExample,
    uncertaintyConverted,
  },
  assertions: {
    keyboardAnswerLostFocus: afterKeyboardAnswer.active.tag === 'BODY',
    continueLostFocus: afterContinue.active.tag === 'BODY' || !afterContinue.active.visible,
    reasoningLeaked: reasoningLeak.reasoningValue === 'I started at the ones place.',
    repeatedState:
      firstDifferentExample.prompt === repeatedDifferentExample.prompt &&
      firstDifferentExample.phase === repeatedDifferentExample.phase,
    uncertaintyBecamePositiveEvidence: /good evidence/i.test(uncertaintyConverted.feedback ?? ''),
  },
  consoleEntries,
  pageErrors,
}

await fs.writeFile(path.join(evidenceDir, 'baseline-reproduction.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
await browser.close()

if (Object.values(report.assertions).some((value) => value !== true)) process.exitCode = 1
