import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReadyForLifeDirectorPreview } from './ReadyForLifeDirectorPreview'
import { isReadyForLifeDirectorPreviewPath } from './route'
import { countCompleteReadyForLifeSceneEvidence, READY_FOR_LIFE_SAMPLE, READY_FOR_LIFE_SAMPLE_STAGES } from './sample'

describe('Ready for Life Director sample R1', () => {
  it('records the audit-selected lesson as Manuel Academy local composition', () => {
    expect(READY_FOR_LIFE_SAMPLE.identity).toMatchObject({
      lessonId: 'ma-g3-ready-for-life-u01-l04',
      grade: 3,
      course: 'ready-for-life',
      phase: 'Application or project',
      version: 'director-sample-r1',
      authorityBasis: 'MANUEL_ACADEMY_LOCAL_COMPOSITION',
    })
    expect(READY_FOR_LIFE_SAMPLE.purpose).toEqual({
      primary: 'SAFETY',
      secondary: ['PRACTICAL_TASK', 'PERSONAL_RESPONSIBILITY'],
    })
    expect(JSON.stringify(READY_FOR_LIFE_SAMPLE.identity)).not.toMatch(/Michigan|state standard|state code/i)
  })

  it('delivers every learner resource used by the model, simulation, and retry', () => {
    const embeddedIds = READY_FOR_LIFE_SAMPLE.materials
      .filter((material) => material.delivery === 'embedded')
      .map((material) => `embedded:${material.id}`)
    expect(embeddedIds).toEqual(['embedded:risk-strip-r1', 'embedded:scene-set-r1', 'embedded:retry-pair-r1'])
    expect(READY_FOR_LIFE_SAMPLE.tutor.resourceRefs).toEqual(embeddedIds)
    expect(READY_FOR_LIFE_SAMPLE.riskWords).toHaveLength(6)
    expect(READY_FOR_LIFE_SAMPLE.independentTask.simulationPath.scenes).toHaveLength(6)
    expect(READY_FOR_LIFE_SAMPLE.independentTask.simulationPath.equalCredit).toBe(true)
    expect(READY_FOR_LIFE_SAMPLE.tutor.missingResourceAction).toMatch(/Do not invent/i)
  })

  it('contains a real model, guided correction, independent transfer, and closed retry loop', () => {
    expect(READY_FOR_LIFE_SAMPLE.model.actions.map((action) => action.label)).toEqual([
      '1. Spot', '2. Stop', '3. Name', '4. Ask and check',
    ])
    expect(READY_FOR_LIFE_SAMPLE.model.criteriaCheck).toMatch(/specific condition.*harm.*no-touch.*guardian/i)
    expect(READY_FOR_LIFE_SAMPLE.guidedAttempt.choices.some((choice) => choice.releasesLearner)).toBe(true)
    expect(READY_FOR_LIFE_SAMPLE.guidedAttempt.correctionTurn).toMatch(/Fresh coached card/i)
    expect(READY_FOR_LIFE_SAMPLE.guidedAttempt.releaseCondition).toMatch(/Move to independent work/i)
    expect(READY_FOR_LIFE_SAMPLE.independentTask.realPath.steps).toHaveLength(5)
    expect(READY_FOR_LIFE_SAMPLE.independentTask.realPath.completionCondition).toMatch(/Finding no hazard is a valid result/i)
    expect(Object.values(READY_FOR_LIFE_SAMPLE.retry).every((value) => value.trim().length > 20)).toBe(true)
    expect(READY_FOR_LIFE_SAMPLE.retry.parallelReattempt).toMatch(/Fresh card/i)
    expect(READY_FOR_LIFE_SAMPLE.retry.returnPath).toMatch(/Resume|resumes/i)
  })

  it('does not count an independent scene until risk, reason, and safe-next-move evidence are present', () => {
    const sceneIds = ['scene-1', 'scene-2']
    expect(countCompleteReadyForLifeSceneEvidence(sceneIds, { 'scene-1': 'trip' }, {})).toBe(0)
    expect(countCompleteReadyForLifeSceneEvidence(
      sceneIds,
      { 'scene-1': 'trip', 'scene-2': 'safe-or-unsure' },
      { 'scene-1': 'It can cause a fall; I would point and ask.', 'scene-2': 'Clear path; I would leave it alone.' },
    )).toBe(2)
  })

  it('separates learner evidence, guardian physical certification, and Tutor coaching', () => {
    expect(READY_FOR_LIFE_SAMPLE.completion).toMatchObject({
      realPathAuthority: 'guardian',
      simulationPathAuthority: 'learner',
      certifyingActor: 'household-authorized guardian',
      learnerSelfReport: 'recorded-but-not-certifying',
    })
    expect(READY_FOR_LIFE_SAMPLE.completion.minimumGuardianEvidence).toHaveLength(4)
    expect(READY_FOR_LIFE_SAMPLE.tutor.completionAuthority).toMatch(/cannot.*certify a physical walkthrough/i)
    expect(READY_FOR_LIFE_SAMPLE.evidence.reflectionPrompt).toMatch(/Do not describe a private household item or room/i)
    expect(READY_FOR_LIFE_SAMPLE.evidence.doNotCollect).toContain('photos, audio, or video')
    expect(READY_FOR_LIFE_SAMPLE.safety.unavailablePath).toMatch(/never lowers credit/i)
  })

  it('uses realistic active, elapsed, adult, and simulation duration semantics', () => {
    expect(READY_FOR_LIFE_SAMPLE.duration).toEqual({
      activeLearnerTime: '30–40 minutes',
      elapsedWindow: 'One session; no waiting or overnight observation',
      sessionPattern: '8–10 minutes learn/model, 5–7 minutes guided attempt, 12–18 minutes independent task, 5 minutes evidence/reflection',
      checkInPlan: 'Guardian signs immediately after the Home Check; no later check-in for Scene Check',
      adultTime: '12–18 minutes for Home Check permission, supervision, handling, and signoff',
      simulationDuration: '30–35 active minutes in one session; no adult required for the independent simulation',
    })
  })

  it('renders the initial Director and learner-safe contract together', () => {
    const html = renderToStaticMarkup(<ReadyForLifeDirectorPreview />)
    expect(html).toContain('Ready for Life · Director sample R1')
    expect(html).toContain('No state authority claimed')
    expect(html).toContain('Spot, stop, and ask')
    expect(html).toContain('Your risk-word guide')
    expect(html).toContain('Physical completion needs a guardian')
    expect(html).toContain('certify that the Home Check happened')
    expect(READY_FOR_LIFE_SAMPLE_STAGES).toHaveLength(7)
  })

  it('keeps the Director shortcut exact-path and development-only', () => {
    expect(isReadyForLifeDirectorPreviewPath('/__review/ready-for-life', true)).toBe(true)
    expect(isReadyForLifeDirectorPreviewPath('/__review/ready-for-life/', true)).toBe(true)
    expect(isReadyForLifeDirectorPreviewPath('/__review/ready-for-life', false)).toBe(false)
    expect(isReadyForLifeDirectorPreviewPath('/__review/ready-for-life/extra', true)).toBe(false)
    expect(isReadyForLifeDirectorPreviewPath('/family-pilot', true)).toBe(false)
  })
})
