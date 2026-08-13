import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('final Lesson Player learner-response integration guards', () => {
  it('does not restore the generic NONE/no-op submission regression', async () => {
    const source = await readFile(new URL('../FinalFamilyPilotApp.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/responseKind:\s*['"]none['"]/)
    expect(source).not.toMatch(/onSubmitAction=\{\(\)\s*=>\s*undefined\}/)
    expect(source).toContain('new LearnerResponseRuntime')
    expect(source).toContain('PENDING_ASSESSMENT')
  })
})
