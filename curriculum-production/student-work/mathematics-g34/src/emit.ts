import { setRng } from '../../../../src/genUtils.ts'
import { blueprintFor } from './blueprint.ts'
import { commonErrorsFor, remediationGuidanceFor } from './commonErrors.ts'
import { itemSourceFor, unitBankFor, type BankItem } from './itemBank.ts'
import { orderedItemTypes, planItemTypes, probeItemStandards } from './itemPlan.ts'
import type { SourceLesson } from './lessonSources.ts'
import { hasEquivalentDistractor } from './numericForm.ts'
import { createRng } from './rng.ts'
import { solutionReasoningFor } from './solutionReasoning.ts'
import type {
  AnswerKey,
  AnswerKeyEntry,
  MaterialItem,
  MaterialSection,
  StudentWorkPackage,
} from './types.ts'

export const CORPUS_VERSION = '1.0.0'

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
  `curriculum-production/student-work/mathematics-g34/src/g34/grade${grade}Unit${unit}.ts#${itemType}.oracle`

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
      if (!item) throw new Error(`Failed to generate ${itemType} for ${ref}`)
      if (!foundDistinct) {
        return
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
