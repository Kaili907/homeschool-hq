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
import { loadValidatedProgram } from './validatedProgramLoader'

const EXPECTED_CORE_SHA = '38205667d56cb4fcc5a8360f1f94098b5fa1d35ae71d22334aa1bc8d43ecc276'
const EXPECTED_MATH_SHA = 'ee9d15cdf1184380add17ebdd8f93f01fde3f0915f491d0a4df96798b4f52351'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

function collectBoardCommands(program: unknown): unknown[] {
  if (!isRecord(program) || !Array.isArray(program.teachingSequences)) return []
  const commands: unknown[] = []
  for (const sequence of program.teachingSequences) {
    if (!isRecord(sequence) || !Array.isArray(sequence.turns)) continue
    for (const turn of sequence.turns) {
      if (isRecord(turn) && Array.isArray(turn.boardCommands)) {
        commands.push(...turn.boardCommands)
      }
    }
  }
  return commands
}

describe('exact frozen artifact compatibility probe', () => {
  it('loads all four Math R1 programs through the host seam without installation', async () => {
    const coreZip = process.env.TUTOR_CORE_V02_ZIP
    const mathZip = process.env.TUTOR_MATH_R1_ZIP
    const coreRoot = process.env.TUTOR_CORE_V02_ROOT
    const mathRoot = process.env.TUTOR_MATH_R1_ROOT
    if (!coreZip || !mathZip || !coreRoot || !mathRoot) {
      // The full session gate always supplies these. Ordinary repository runs
      // remain hermetic and do not search a developer machine for artifacts.
      expect([coreZip, mathZip, coreRoot, mathRoot].every((value) => value === undefined)).toBe(true)
      return
    }

    const beforeCoreHash = await sha256(coreZip)
    const beforeMathHash = await sha256(mathZip)
    expect(beforeCoreHash).toBe(EXPECTED_CORE_SHA)
    expect(beforeMathHash).toBe(EXPECTED_MATH_SHA)

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
    const manifest = mathModule.mathSubjectManifest
    if (typeof adaptProgram !== 'function' || !Array.isArray(manifest.lessons)) {
      throw new Error('Frozen Math loader exports are unavailable.')
    }

    const lessons = manifest.lessons
    expect(lessons).toHaveLength(4)
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
    if (!registry.ok) return
    const core = runtimeAdapterFrom(coreModule)
    const enginePrograms: unknown[] = []
    const probedCore: CoreV02RuntimeAdapter = {
      ...core,
      createEngine: (program) => {
        enginePrograms.push(program)
        return core.createEngine(program)
      },
    }

    for (const program of programs) {
      const loaded = await loadValidatedProgram(registry.value, probedCore, {
        subjectId: descriptor.subjectId,
        programId: program.programId,
      })
      expect(loaded.ok).toBe(true)
      if (!loaded.ok) continue
      expect(loaded.value.gradeBand).toEqual({ min: 4, max: 6, label: 'Grades 4–6' })
      expect(loaded.value.gradeBand.min).toBeLessThanOrEqual(5)
      expect(loaded.value.gradeBand.max).toBeGreaterThanOrEqual(5)
      const commands = collectBoardCommands(loaded.value.program)
      expect(commands.length).toBeGreaterThan(0)
      const projection = buildHostVisualPresentation(
        commands,
        { visualsAvailable: true, voiceAvailable: false },
        {
          missingVisualText: 'Use the displayed Math explanation.',
          missingAudioText: 'Read the displayed Math words.',
          lessonMayContinueWithoutMedia: true,
        },
      )
      expect(projection.steps.length).toBeGreaterThan(0)
      const runtime = assembleAdaptiveTutorRuntime(probedCore, loaded.value)
      expect(runtime.ok).toBe(true)
      if (runtime.ok) {
        expect(runtime.value.start()).toMatchObject({ ok: true })
        runtime.value.dispose()
      }
    }

    expect(loader).toHaveBeenCalledTimes(4)
    expect(enginePrograms).toHaveLength(4)
    expect(new Set(enginePrograms).size).toBe(4)
    expect(await sha256(coreZip)).toBe(beforeCoreHash)
    expect(await sha256(mathZip)).toBe(beforeMathHash)
  }, 30_000)
})
