import { setRng } from '../../../../src/genUtils.ts'
import { blueprintFor, type SectionPlan } from './blueprint.ts'
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
 * Grades 5-8 draw on canonical generators whose arithmetic is verified by the
 * oracle suites that already ship beside them; grades 9-12 use generators
 * authored here, which recompute their own answers from parameters.
 */
const oracleMethodFor = (grade: number): 'recomputed' | 'generator-authority' =>
  grade <= 8 ? 'generator-authority' : 'recomputed'

const oracleFor = (grade: number, unit: number, itemType: string): string =>
  grade <= 8
    ? `src/curriculum/grade${grade}MathUnit${unit}Generator.test.ts#${itemType}`
    : `curriculum-production/student-work/mathematics/src/hs#${itemType}`

/**
 * Some canonical generators record very large values as BigInt (grade 8's
 * scientific-notation unit, for example). BigInt has no JSON representation, so
 * convert it to its decimal string while leaving every other value untouched.
 */
function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(toJsonSafe)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, toJsonSafe(inner)]),
    )
  }
  return value
}

const safeParameters = (parameters: Record<string, unknown>): Record<string, unknown> =>
  toJsonSafe(parameters) as Record<string, unknown>

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
      // Distinct prompts inside one package. Some item types have a small
      // parameter space, so reseeding alone cannot always produce a fresh
      // question; after exhausting the salts, rotate to the next item type in
      // the lesson's pool rather than printing the same question twice.
      const candidateTypes = [
        itemType,
        ...ordered.filter((candidate) => candidate !== itemType),
      ]
      // The prompt a learner actually reads: a worked example shows the item
      // type's teaching example, every other kind shows the generated question.
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
          // A few canonical generators fail closed on unlucky parameter draws
          // (their own distractor pool collapses). Those live outside this
          // branch's ownership, so skip the seed and keep searching rather than
          // changing shared curriculum code.
          let candidate: BankItem
          try {
            candidate = bank.generate(candidateType, difficulty)
          } catch {
            continue
          }
          // Reject draws whose distractor pool contains the answer written a
          // different way (24 beside sqrt(576)); a learner picking that option
          // would be right but scored wrong.
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
        // Some canonical units share a single authored teaching example across
        // every item type, so a second distinct instructional example does not
        // exist to be shown. Emit the one the unit has rather than printing the
        // same example twice on one worksheet.
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
        given: safeParameters(item.parameters),
        solutionReasoning: solutionReasoningFor(item, correct),
        referenceExample: {
          prompt: item.workedExample.prompt,
          steps: item.workedExample.steps,
          answer: item.workedExample.answer,
        },
        verification: {
          method: item.verification?.method ?? oracleMethodFor(lesson.ref.grade),
          oracle: item.verification?.oracle ?? oracleFor(lesson.ref.grade, lesson.ref.unitNumber, item.itemType),
          parameters: safeParameters(item.parameters),
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
