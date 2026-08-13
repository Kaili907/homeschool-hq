import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import type { FinalFamilyPilotHarnessInjection } from './contracts'
import {
  FINAL_E2E_FIXTURES,
  syntheticCurriculumProvider,
  syntheticProductionMaterialProvider,
} from './fixtures'
import {
  createMemoryFinalE2EPersistence,
  createReferenceSafetyPort,
  referenceBackupRecovery,
  referenceCompletionPolicy,
  referenceRuntimeFactory,
} from './referenceAdapters'
import {
  FINAL_FAMILY_PILOT_SCENARIO_IDS,
  FINAL_FAMILY_PILOT_SCENARIOS,
  runFinalFamilyPilotScenarioLibrary,
} from './scenarioLibrary'

const FIXED_NOW = new Date('2026-08-13T14:00:00.000Z')

function injection(): FinalFamilyPilotHarnessInjection {
  const now = () => new Date(FIXED_NOW)
  return {
    fixtures: FINAL_E2E_FIXTURES,
    curriculumProvider: syntheticCurriculumProvider,
    productionMaterialProvider: syntheticProductionMaterialProvider,
    createStudyPorts: () => createLocalDevelopmentStudyPorts({ now }).ports,
    completionPolicy: referenceCompletionPolicy,
    safetyPort: createReferenceSafetyPort(),
    backupRecovery: referenceBackupRecovery,
    createPersistence: createMemoryFinalE2EPersistence,
    runtimeFactory: referenceRuntimeFactory,
    now,
  }
}

describe('final Family Pilot reusable acceptance harness', () => {
  it('publishes the complete ordered 12-scenario library', () => {
    expect(FINAL_FAMILY_PILOT_SCENARIOS.map((scenario) => scenario.id))
      .toEqual(FINAL_FAMILY_PILOT_SCENARIO_IDS)
    expect(new Set(FINAL_FAMILY_PILOT_SCENARIO_IDS).size).toBe(12)
  })

  it('uses synthetic fixtures across every currently supported Academy grade', () => {
    expect(FINAL_E2E_FIXTURES.students.map((student) => student.grade).sort())
      .toEqual(['5', '7', '8'])
    expect(FINAL_E2E_FIXTURES.students.every((student) => student.studentRef.startsWith('synthetic:')))
      .toBe(true)
  })

  it('passes every required scenario against injected providers and fresh Study ports', async () => {
    const reports = await runFinalFamilyPilotScenarioLibrary(injection())
    expect(reports).toEqual(FINAL_FAMILY_PILOT_SCENARIO_IDS.map((id) => ({ id, status: 'passed' })))
  })

  it('is deterministic across independent runs', async () => {
    const first = await runFinalFamilyPilotScenarioLibrary(injection())
    const second = await runFinalFamilyPilotScenarioLibrary(injection())
    expect(second).toEqual(first)
  })
})
