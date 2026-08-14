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

  it('keeps final lesson-response authority out of localStorage', async () => {
    const app = await readFile(new URL('../FinalFamilyPilotApp.tsx', import.meta.url), 'utf8')
    const store = await readFile(new URL('./store.ts', import.meta.url), 'utf8')
    expect(app).toContain('new BrowserLearnerResponseStore()')
    expect(app).not.toContain('new BrowserLearnerResponseStore(window.localStorage)')
    expect(store).toContain('openIndexedDbRecordStore')
    expect(store).not.toMatch(/legacyStorage\.setItem|localStorage\.setItem/)
  })

  it('uses the rich projection without a parallel Study engine or legacy Tutor API', async () => {
    const app = await readFile(new URL('../FinalFamilyPilotApp.tsx', import.meta.url), 'utf8')
    expect(app).toContain('createRichLessonRenderModel(result.material)')
    expect(app).not.toContain('<MaterialView material={result.material}')
    expect(app).not.toMatch(/controller\.tutor\(/)
    expect(app).toContain('Tutor help is reserved for a future trusted callback')
  })
})
