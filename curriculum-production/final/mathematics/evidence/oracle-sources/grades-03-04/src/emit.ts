import { setRng } from './random.ts'
import { blueprintFor } from './blueprint.ts'
import { commonErrorsFor, remediationGuidanceFor } from './commonErrors.ts'
import { itemSourceFor, unitBankFor, type BankItem } from './itemBank.ts'
import { orderedItemTypes, planItemTypes, probeItemStandards } from './itemPlan.ts'
import type { SourceLesson } from './lessonSources.ts'
import { hasEquivalentDistractor } from './numericForm.ts'
import { createRng } from './rng.ts'
import { solutionReasoningFor } from './solutionReasoning.ts'
import {
  emitGrade3RoundingSampleR1,
  GRADE3_ROUNDING_SAMPLE_R1_LESSON_ID,
} from './g34/grade3RoundingSampleR1.ts'
import type {
  AnswerKey,
  AnswerKeyEntry,
  MaterialItem,
  MaterialSection,
  StudentWorkPackage,
} from './types.ts'

export const CORPUS_VERSION = '1.0.0'

export const CONTENT_REPAIR_LESSON_IDS = new Set([
  'ma-g3-mathematics-u01-l01',
  'ma-g3-mathematics-u09-l01',
  'ma-g3-mathematics-u09-l02',
  'ma-g3-mathematics-u10-l06',
  'ma-g3-mathematics-u10-l07',
  'ma-g3-mathematics-u10-l08',
  'ma-g4-mathematics-u01-l01',
  'ma-g4-mathematics-u10-l02',
  'ma-g4-mathematics-u10-l03',
])

const SECTION_SLUG: Record<string, string> = {
  'instructional-example': 'ex',
  'guided-practice': 'gp',
  'independent-practice': 'ip',
  'mastery-check': 'mc',
  extension: 'xt',
}

/**
 * Every Grade 3/4 item type is authored in src/g34, with an oracle that
 * recomputes the answer from the item's own parameters on a code path
 * independent of the one that produced it (see src/g34/core.ts). There is no
 * canonical-generator-authority path for these grades — no pre-existing
 * generators existed for Grade 3/4 to inherit — so this is fixed rather than
 * a grade-keyed branch.
 */
const oracleMethodFor = (_grade: number): 'recomputed' | 'generator-authority' => 'recomputed'

const oracleFor = (grade: number, unit: number, itemType: string): string =>
  `curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/g34/grade${grade}Unit${unit}.ts#${itemType}.oracle`

export const gradeFolder = (grade: number): string => `grade-${String(grade).padStart(2, '0')}`

export const answerKeyRefFor = (lesson: SourceLesson): string =>
  `answer-keys/${gradeFolder(lesson.ref.grade)}/${lesson.ref.lessonId}.key.json`

export const packagePathFor = (lesson: SourceLesson): string =>
  `packages/${gradeFolder(lesson.ref.grade)}/${lesson.ref.lessonId}.package.json`

const itemSeed = (
  lessonId: string,
  sectionId: string,
  index: number,
  itemType: string,
  difficulty: number,
  salt: number,
): string =>
  `${CORPUS_VERSION}|${lessonId}|${sectionId}|${index}|${itemType}|${difficulty}|${salt}`

/**
 * Constructed-response prompts reuse the generated item but ask for reasoning
 * instead of a selection, so extension work is not just a harder multiple
 * choice. The choices are dropped from the student projection entirely.
 */
const RESPONSE_EXPECTATION =
  'Give the result and the reasoning that produced it. Show enough work that someone else could check each step.'

export interface EmittedLesson {
  package: StudentWorkPackage
  answerKey: AnswerKey
}

export function emitLesson(lesson: SourceLesson): EmittedLesson {
  if (lesson.ref.lessonId === GRADE3_ROUNDING_SAMPLE_R1_LESSON_ID) {
    return emitGrade3RoundingSampleR1(lesson)
  }
  const blueprint = blueprintFor(lesson.ref.phase)
  const bank = unitBankFor(lesson.ref.grade, lesson.ref.unitNumber)

  setRng(createRng(`${CORPUS_VERSION}|probe|${lesson.ref.courseId}|${lesson.ref.unitNumber}`))
  const probes = probeItemStandards(bank)
  const ordered = orderedItemTypes(probes, lesson)

  const sections: MaterialSection[] = []
  const answers: AnswerKeyEntry[] = []
  const generated: BankItem[] = []
  const usedPrompts = new Set<string>()
  let poolOffset = Math.max(0, lesson.ref.dayInUnit - 1)

  for (const plan of blueprint.sections) {
    const sectionId = `${SECTION_SLUG[plan.kind]}`
    const slots = Array.from(
      { length: plan.count },
      (_, index) => plan.difficulties[index % plan.difficulties.length],
    )
    const itemTypes = planItemTypes(ordered, slots, poolOffset)
    poolOffset += plan.count

    const items: MaterialItem[] = []
    slots.forEach((difficulty, index) => {
      const itemType = itemTypes[index]
      const ref = `${lesson.ref.lessonId}#${sectionId}-${String(index + 1).padStart(2, '0')}`
      let item: BankItem | null = null
      const candidateTypes = [
        itemType,
        ...ordered.filter((candidate) => candidate !== itemType),
      ]
      const renderedPrompt = (candidate: BankItem): string =>
        plan.kind === 'instructional-example' ? candidate.workedExample.prompt : candidate.prompt

      let foundDistinct = false
      outer: for (const candidateType of candidateTypes) {
        for (let salt = 0; salt < 48; salt += 1) {
          setRng(
            createRng(
              itemSeed(lesson.ref.lessonId, sectionId, index, candidateType, difficulty, salt),
            ),
          )
          let candidate: BankItem
          try {
            candidate = bank.generate(candidateType, difficulty)
          } catch {
            continue
          }
          if (hasEquivalentDistractor(candidate.choices, candidate.choices[candidate.answerIndex])) {
            continue
          }
          item = candidate
          if (!usedPrompts.has(renderedPrompt(candidate))) {
            foundDistinct = true
            break outer
          }
        }
      }
      // Some conceptual generators intentionally have a small base prompt
      // pool. Preserve their original deterministic draws, then ask the bank
      // for explicitly authored expansions only when all base draws collide.
      expansion: if (!foundDistinct && CONTENT_REPAIR_LESSON_IDS.has(lesson.ref.lessonId)) {
        for (const candidateType of candidateTypes) {
          for (let variant = 1; variant <= 16; variant += 1) {
            for (let salt = 0; salt < 48; salt += 1) {
              setRng(
                createRng(
                  itemSeed(
                    lesson.ref.lessonId,
                    sectionId,
                    index,
                    candidateType,
                    difficulty,
                    48 + variant * 48 + salt,
                  ),
                ),
              )
              let candidate: BankItem
              try {
                candidate = bank.generate(candidateType, difficulty, variant)
              } catch {
                continue
              }
              if (hasEquivalentDistractor(candidate.choices, candidate.choices[candidate.answerIndex])) {
                continue
              }
              item = candidate
              if (!usedPrompts.has(renderedPrompt(candidate))) {
                foundDistinct = true
                break expansion
              }
            }
          }
        }
      }
      if (!item) throw new Error(`Failed to generate ${itemType} for ${ref}`)
      if (!foundDistinct) {
        // A bank carries one authored reference example per item type. A phase
        // may request a second example, but repeating the same worked solution
        // adds no evidence and the established corpus intentionally keeps one.
        if (plan.kind === 'instructional-example') return
        // Content Repair R2 is deliberately limited to the nine lessons whose
        // practice/mastery sections were independently audited as blocked.
        // Preserve every other active package byte-for-byte for convergence.
        if (!CONTENT_REPAIR_LESSON_IDS.has(lesson.ref.lessonId)) return
        throw new Error(`Failed to generate a distinct ${itemType} prompt for ${ref}`)
      }
      usedPrompts.add(renderedPrompt(item))
      generated.push(item)

      if (plan.kind === 'instructional-example') {
        items.push({
          ref,
          kind: 'worked-example',
          itemType: item.itemType,
          standard: item.standard,
          difficulty,
          prompt: item.workedExample.prompt,
          workedSolution: {
            steps: item.workedExample.steps,
            answer: item.workedExample.answer,
          },
        })
        return
      }

      const correct = item.choices[item.answerIndex]
      if (plan.constructedResponse) {
        items.push({
          ref,
          kind: 'constructed-response',
          itemType: item.itemType,
          standard: item.standard,
          difficulty,
          prompt: item.prompt,
          responseExpectation: RESPONSE_EXPECTATION,
        })
      } else {
        items.push({
          ref,
          kind: 'multiple-choice',
          itemType: item.itemType,
          standard: item.standard,
          difficulty,
          prompt: item.prompt,
          choices: item.choices,
        })
      }

      answers.push({
        ref,
        itemType: item.itemType,
        standard: item.standard,
        difficulty,
        answerType: 'fixed',
        answer: correct,
        ...(plan.constructedResponse ? {} : { answerIndex: item.answerIndex }),
        given: item.parameters,
        solutionReasoning: solutionReasoningFor(item, correct),
        referenceExample: {
          prompt: item.workedExample.prompt,
          steps: item.workedExample.steps,
          answer: item.workedExample.answer,
        },
        verification: {
          method: item.verification?.method ?? oracleMethodFor(lesson.ref.grade),
          oracle: item.verification?.oracle ?? oracleFor(lesson.ref.grade, lesson.ref.unitNumber, item.itemType),
          parameters: item.parameters,
        },
        commonErrors: commonErrorsFor(item),
      })
    })

    sections.push({
      sectionId,
      kind: plan.kind,
      title: plan.title,
      directions: plan.directions,
      items,
    })
  }
  setRng(null)

  const seed = `${CORPUS_VERSION}|${lesson.ref.lessonId}`
  const materialPackage: StudentWorkPackage = {
    schemaVersion: '1.0',
    packageId: `swk-${lesson.ref.lessonId}`,
    lessonRef: lesson.ref,
    standards: lesson.standards,
    blueprint: {
      phase: lesson.ref.phase,
      profile: blueprint.profile,
      sectionKinds: blueprint.sections.map((section) => section.kind),
    },
    sections,
    answerKeyRef: answerKeyRefFor(lesson),
    integrity: {
      corpusVersion: CORPUS_VERSION,
      itemSource: itemSourceFor(lesson.ref.grade),
      seed,
    },
  }

  const answerKey: AnswerKey = {
    schemaVersion: '1.0',
    packageId: materialPackage.packageId,
    lessonRef: {
      lessonId: lesson.ref.lessonId,
      courseId: lesson.ref.courseId,
      grade: lesson.ref.grade,
      unitNumber: lesson.ref.unitNumber,
      phase: lesson.ref.phase,
    },
    answers,
    scoringGuidance: lesson.scoringGuidance || blueprint.emphasis,
    masteryRule: lesson.masteryRule,
    remediationGuidance: remediationGuidanceFor(generated),
    extensionGuidance: [lesson.extension, blueprint.emphasis].filter((text) => text !== ''),
    integrity: { corpusVersion: CORPUS_VERSION, seed },
  }

  return { package: materialPackage, answerKey }
}
