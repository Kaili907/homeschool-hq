import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { assembleAdaptiveTutorRuntime } from './engineRuntime'
import { buildHostVisualPresentation } from './hostRenderer'
import { createSubjectRegistry } from './subjectRegistry'
import type {
  AdaptiveTutorEnginePort,
  CoreProgramValidationResult,
  CoreV02RuntimeAdapter,
  SubjectRegistrationInput,
} from './types'
import {
  loadValidatedProgram,
  type ValidatedProgramHandle,
} from './validatedProgramLoader'

const EXPECTED_CORE_SHA = '38205667d56cb4fcc5a8360f1f94098b5fa1d35ae71d22334aa1bc8d43ecc276'
const EXPECTED_MATH_SHA = 'ee9d15cdf1184380add17ebdd8f93f01fde3f0915f491d0a4df96798b4f52351'
const exactContext = process.env.TUTOR_EXACT_ARTIFACT_CONTEXT === 'zip-derived-v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`The exact-artifact harness did not supply ${name}.`)
  return value
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

function validationIssues(value: unknown): CoreProgramValidationResult {
  if (!isRecord(value) || !Array.isArray(value.issues)) {
    return { ok: false, issues: [{ path: '/', message: 'Frozen Core rejected the value.' }] }
  }
  return {
    ok: false,
    issues: value.issues.slice(0, 20).map((issue) => ({
      path: isRecord(issue) && typeof issue.path === 'string' ? issue.path : '/',
      message: isRecord(issue) && typeof issue.message === 'string'
        ? issue.message
        : 'Frozen Core rejected the value.',
    })),
  }
}

function runtimeAdapterFrom(moduleValue: unknown): CoreV02RuntimeAdapter {
  if (!isRecord(moduleValue)) throw new Error('Frozen Core public barrel is invalid.')
  const validateWithSchema = moduleValue.validateWithSchema
  const validateSkillGraph = moduleValue.validateSkillGraph
  const Engine = moduleValue.AdaptiveTutorEngine
  if (
    typeof validateWithSchema !== 'function' ||
    typeof validateSkillGraph !== 'function' ||
    typeof Engine !== 'function'
  ) throw new Error('Frozen Core runtime exports are unavailable.')

  const validateSchema = (schema: unknown, candidate: unknown): CoreProgramValidationResult => {
    const result: unknown = Reflect.apply(validateWithSchema, undefined, [schema, candidate])
    if (!isRecord(result) || result.ok !== true) return validationIssues(result)
    return { ok: true, value: candidate }
  }
  const createEngine = (program: unknown): AdaptiveTutorEnginePort => {
    const engine: unknown = Reflect.construct(Engine, [program])
    if (!isRecord(engine)) throw new Error('Frozen Core engine is invalid.')
    const invoke = (method: string, args: readonly unknown[] = []): unknown => {
      const operation = engine[method]
      if (typeof operation !== 'function') throw new Error('Frozen Core engine method is unavailable.')
      return Reflect.apply(operation, engine, args)
    }
    return {
      start: () => invoke('start'),
      submit: (input) => invoke('submit', [input]),
      continue: () => invoke('continue'),
      requestAlternateExplanation: () => invoke('requestAlternateExplanation'),
      getSnapshot: () => invoke('getSnapshot'),
      getReview: () => invoke('getReview'),
    }
  }

  return {
    contractVersion: '0.2.0',
    validateProgram: (candidate) => {
      const schemaResult = validateSchema(moduleValue.TutorProgramSchema, candidate)
      if (!schemaResult.ok || !isRecord(candidate)) return schemaResult
      const graph: unknown = Reflect.apply(validateSkillGraph, undefined, [candidate.skillGraph])
      if (!isRecord(graph) || graph.valid !== true) {
        return { ok: false, issues: [{ path: '/skillGraph', message: 'The graph is invalid.' }] }
      }
      return schemaResult
    },
    validateLearnerInput: (candidate) =>
      validateSchema(moduleValue.LearnerInputSchema, candidate),
    validateTutorResponse: (candidate) =>
      validateSchema(moduleValue.TutorResponseSchema, candidate),
    validateAdultReview: (candidate) =>
      validateSchema(moduleValue.ParentTeacherReviewSchema, candidate),
    createEngine,
  }
}

function arrayAt(record: Record<string, unknown>, key: string): readonly unknown[] {
  return Array.isArray(record[key]) ? record[key] : []
}

function nestedArrayLength(record: Record<string, unknown>, parent: string, child: string): number {
  const value = record[parent]
  return isRecord(value) ? arrayAt(value, child).length : 0
}

function sourceAssessmentCount(sequence: unknown): number {
  if (!isRecord(sequence)) return 0
  return nestedArrayLength(sequence, 'diagnostic', 'items') +
    nestedArrayLength(sequence, 'guidedPractice', 'items') +
    nestedArrayLength(sequence, 'independentMasteryCheck', 'items')
}

function emittedAssessmentCount(program: unknown): number {
  if (!isRecord(program)) return 0
  return arrayAt(program, 'diagnosticItems').length +
    nestedArrayLength(program, 'guidedPractice', 'items') +
    nestedArrayLength(program, 'independentMastery', 'items') +
    arrayAt(program, 'reassessmentItems').length
}

describe.skipIf(!exactContext)('exact frozen artifact compatibility probe', () => {
  it('derives and verifies all Core/Math evidence from the two exact ZIPs', async () => {
    const coreZip = requiredEnvironment('TUTOR_CORE_V02_ZIP')
    const mathZip = requiredEnvironment('TUTOR_MATH_R1_ZIP')
    const coreRoot = requiredEnvironment('TUTOR_CORE_V02_ROOT')
    const mathRoot = requiredEnvironment('TUTOR_MATH_R1_ROOT')
    const coreFingerprint = requiredEnvironment('TUTOR_CORE_TREE_FINGERPRINT')
    const mathFingerprint = requiredEnvironment('TUTOR_MATH_TREE_FINGERPRINT')
    const verifierResultPath = requiredEnvironment('TUTOR_MATH_VERIFIER_RESULT')
    expect(coreFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(mathFingerprint).toMatch(/^[a-f0-9]{64}$/)

    const beforeCoreHash = await sha256(coreZip)
    const beforeMathHash = await sha256(mathZip)
    expect(beforeCoreHash).toBe(EXPECTED_CORE_SHA)
    expect(beforeMathHash).toBe(EXPECTED_MATH_SHA)

    const verifierResult: unknown = JSON.parse(await readFile(verifierResultPath, 'utf8'))
    expect(verifierResult).toMatchObject({
      status: 'PASS',
      coreVersion: '0.2.0',
      programsValidated: 4,
      sourceAssessmentItemsAdapted: 72,
      emittedAssessmentContractsValidated: 96,
      sourceVisualCommandsAdapted: 20,
      invalidFixturesRejected: 5,
      grade5DirectlySupported: true,
      subjectTraceScenarios: 3,
    })
    if (!isRecord(verifierResult)) throw new Error('Frozen verifier result is invalid.')
    expect(verifierResult.coreAdvancePhases).toSatisfy(
      (phases: unknown) => Array.isArray(phases) && phases.at(-1) === 'advance',
    )
    expect(verifierResult.corePersistentPhases).toSatisfy(
      (phases: unknown) => Array.isArray(phases) &&
        phases.includes('reteach') && phases.at(-1) === 'escalated',
    )

    const coreModule: unknown = await import(
      /* @vite-ignore */ pathToFileURL(join(coreRoot, 'dist/core/index.js')).href
    )
    const mathModule: unknown = await import(
      /* @vite-ignore */ pathToFileURL(join(mathRoot, 'index.ts')).href
    )
    if (!isRecord(mathModule) || !isRecord(mathModule.mathSubjectManifest)) {
      throw new Error('Frozen Math public entry point is invalid.')
    }
    const adaptProgram = mathModule.adaptSequenceToTutorProgramV02
    const visualInventory = mathModule.visualInventoryV02
    const manifest = mathModule.mathSubjectManifest
    if (
      typeof adaptProgram !== 'function' ||
      typeof visualInventory !== 'function' ||
      !Array.isArray(manifest.lessons)
    ) throw new Error('Frozen Math loader exports are unavailable.')

    const lessons = manifest.lessons
    expect(lessons).toHaveLength(4)
    expect(lessons.reduce((sum, lesson) => sum + sourceAssessmentCount(lesson), 0)).toBe(72)
    const programs = lessons.map((lesson) => {
      if (!isRecord(lesson) || typeof lesson.sequenceId !== 'string' || typeof lesson.title !== 'string') {
        throw new Error('Frozen Math program descriptor is invalid.')
      }
      return {
        programId: lesson.sequenceId,
        displayName: lesson.title,
        programVersion: '1.0.0',
        coreSubject: 'math' as const,
        gradeBand: { min: 4, max: 6, label: 'Grades 4–6' },
      }
    })
    const loader = vi.fn((request: { readonly programId: string }) => {
      const sequence = lessons.find((lesson) =>
        isRecord(lesson) && lesson.sequenceId === request.programId)
      if (!sequence) throw new Error('Unknown test-only Math program.')
      return Reflect.apply(adaptProgram, undefined, [sequence])
    })
    const descriptor: SubjectRegistrationInput = {
      subjectId: 'math-r1-probe',
      displayName: 'Frozen Math R1 compatibility probe',
      packageVersion: '1.0.2',
      compatibleCoreContractVersion: '0.2.0',
      provenance: {
        kind: 'frozen-artifact',
        artifactName: 'manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned-r1.zip',
        sha256: EXPECTED_MATH_SHA,
      },
      programs,
      requiredCapabilities: [
        'core-runtime-validation',
        'keyboard-input',
        'displayed-text',
        'adult-review',
      ],
      optionalMediaCapabilities: ['audio', 'image'],
      loaderEntryPoint: 'math-r1-public-entry',
      loader,
      availability: { status: 'available' },
    }
    const registry = createSubjectRegistry([descriptor])
    expect(registry.ok).toBe(true)
    if (!registry.ok) throw new Error('Exact Math registry probe failed.')

    const core = runtimeAdapterFrom(coreModule)
    const validatedIds = new Set<string>()
    const enginePrograms: unknown[] = []
    let constructionBeforeAllProgramsValidated = false
    const probedCore: CoreV02RuntimeAdapter = {
      ...core,
      validateProgram: (candidate) => {
        const result = core.validateProgram(candidate)
        if (result.ok && isRecord(candidate) && typeof candidate.id === 'string') {
          validatedIds.add(candidate.id)
        }
        return result
      },
      createEngine: (program) => {
        if (validatedIds.size !== 4) constructionBeforeAllProgramsValidated = true
        enginePrograms.push(program)
        return core.createEngine(program)
      },
    }

    const loadedPrograms: ValidatedProgramHandle[] = []
    for (const program of programs) {
      const loaded = await loadValidatedProgram(registry.value, probedCore, {
        subjectId: descriptor.subjectId,
        programId: program.programId,
      })
      expect(loaded.ok).toBe(true)
      if (!loaded.ok) throw new Error('Exact Math program did not validate.')
      expect(loaded.value.gradeBand).toEqual({ min: 4, max: 6, label: 'Grades 4–6' })
      expect(Object.hasOwn(loaded.value.gradeBand, 'coreGrade')).toBe(false)
      loadedPrograms.push(loaded.value)
    }
    expect(validatedIds.size).toBe(4)
    expect(loader).toHaveBeenCalledTimes(4)
    expect(loadedPrograms.reduce(
      (sum, handle) => sum + emittedAssessmentCount(handle.program),
      0,
    )).toBe(96)

    for (const loaded of loadedPrograms) {
      const runtime = assembleAdaptiveTutorRuntime(probedCore, loaded)
      expect(runtime.ok).toBe(true)
      if (!runtime.ok) throw new Error('Exact Math engine construction failed.')
      expect(runtime.value.start()).toMatchObject({ ok: true })
      runtime.value.dispose()
    }
    expect(constructionBeforeAllProgramsValidated).toBe(false)
    expect(enginePrograms).toHaveLength(4)
    expect(new Set(enginePrograms).size).toBe(4)

    const visualItems = lessons.flatMap((lesson) => {
      const result: unknown = Reflect.apply(visualInventory, undefined, [lesson])
      if (!Array.isArray(result)) throw new Error('Frozen Math visual inventory is invalid.')
      return result
    })
    expect(visualItems).toHaveLength(20)
    let accessiblyHandled = 0
    for (const visual of visualItems) {
      if (!isRecord(visual) || !Array.isArray(visual.commands) || visual.commands.length === 0) {
        throw new Error('Frozen Math visual item is invalid.')
      }
      const projection = buildHostVisualPresentation(
        visual.commands,
        { visualsAvailable: true, voiceAvailable: false },
        {
          missingVisualText: 'Use the displayed Math explanation.',
          missingAudioText: 'Read the displayed Math words.',
          lessonMayContinueWithoutMedia: true,
        },
      )
      expect(projection.steps.length).toBeGreaterThan(0)
      expect(projection.steps.every((step) => step.label.length > 0 && step.label.length <= 500)).toBe(true)
      accessiblyHandled += 1
    }
    expect(accessiblyHandled).toBe(20)

    expect(await sha256(coreZip)).toBe(beforeCoreHash)
    expect(await sha256(mathZip)).toBe(beforeMathHash)
  }, 30_000)
})
