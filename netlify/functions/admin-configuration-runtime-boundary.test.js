import { readFile, readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const CONFIG_CONSUMPTION = /academy_admin_(?:read|preview|commit)_configuration|admin-(?:runtime-)?configuration-source|admin-runtime-configuration|runtime\.(?:ai|tts)\.enabled|quota\.(?:ai|tts)\.requests_per_account_day/

async function filesBelow(url) {
  const entries = await readdir(url, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, url)
    if (entry.isDirectory()) files.push(...await filesBelow(child))
    else if (/\.(?:js|ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) files.push(child)
  }
  return files
}

describe('ADMIN-14B runtime integration boundary', () => {
  it('wires the trusted runtime resolver into Anthropic and TTS gateways', async () => {
    const gateways = [
      new URL('./anthropic.js', import.meta.url),
      new URL('./tts.js', import.meta.url),
    ]
    for (const gateway of gateways) {
      const source = await readFile(gateway, 'utf8')
      expect(source, gateway.pathname).toMatch(/admin-runtime-configuration/)
      expect(source, gateway.pathname).toMatch(/runtimeConfigurationResolver\.resolve/)
    }
  })

  it('continues to isolate guardian and fail-closed Study authority', async () => {
    const browserSources = await filesBelow(new URL('../../src/study/', import.meta.url))
    const functionSources = (await filesBelow(new URL('./', import.meta.url))).filter(
      (source) => /\/(?:_shared\/)?study[^/]*(?:\/|\.js$)/.test(source.pathname),
    )
    const sources = [...browserSources, ...functionSources]
    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) {
      expect(await readFile(source, 'utf8'), source.pathname).not.toMatch(CONFIG_CONSUMPTION)
    }
  })
})
