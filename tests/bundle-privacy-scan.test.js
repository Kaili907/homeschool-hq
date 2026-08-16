import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanProductionBundle } from '../scripts/scan-production-bundle.mjs'

const temporaryRoots = []

async function fixture(source) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sec-8-bundle-'))
  temporaryRoots.push(root)
  await mkdir(path.join(root, 'nested'))
  await writeFile(path.join(root, 'index.html'), '<script src="/nested/app.js"></script>')
  await writeFile(path.join(root, 'nested', 'app.js'), source)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('SEC-8 recursive production bundle privacy scanner', () => {
  it('requires a production output tree', async () => {
    await expect(scanProductionBundle(path.join(os.tmpdir(), 'sec-8-does-not-exist'))).rejects.toThrow('Production bundle is missing')
  })

  it('scans nested JSON and rejects source-authority material', async () => {
    const root = await fixture('{"productionPackageRef":"git+823e3ea:curriculum-production/final/package.json"}')
    await expect(scanProductionBundle(root)).rejects.toThrow(/repository package locator|server curriculum path|server binding locator field/)
  })

  it('rejects credential, token, raw PIN, answer, path, and dev endpoint values', async () => {
    const samples = [
      'SUPABASE_SERVICE_ROLE_KEY="abcdefghijklmnopqrstuvwxyz"',
      'Bearer abcdefghijklmnopqrstuvwxyz1234',
      '{"parentPin":"1234"}',
      '{"correctAnswer":"choice-2"}',
      'C:\\ma-sec\\s8\\server-only.json',
      'http://localhost:5173/api',
    ]
    for (const sample of samples) {
      const root = await fixture(sample)
      await expect(scanProductionBundle(root), sample).rejects.toThrow('SEC-8 production bundle privacy scan failed')
    }
  })

  it('accepts learner-safe output and the audited supabase-js fallback literal', async () => {
    const root = await fixture('const endpoint="http://localhost:9999"; const status="PENDING_SOURCE_ATTACHMENT"')
    await expect(scanProductionBundle(root)).resolves.toMatchObject({ files: 2 })
  })
})
