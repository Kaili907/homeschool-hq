import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Tutor premium voice UI privacy', () => {
  it('contains no arbitrary provider identifier entry control', async () => {
    const source = await readFile(new URL('../components/TutorPanel.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/ElevenLabs voice ID/i)
    expect(source).not.toContain('elId')
    expect(source).not.toContain('SUGGESTED_LABELS')
    expect(source).toContain('Academy premium catalog')
    expect(source).toContain('Legacy premium selection hidden')
  })

  it('does not rewrite profiles from an effect during normal panel load', async () => {
    const source = await readFile(new URL('../components/TutorPanel.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('migrateLegacyVoiceToDefault')
  })
})
