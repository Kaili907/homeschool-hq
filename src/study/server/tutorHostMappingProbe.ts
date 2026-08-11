/** Executable, server-only probe over the real frozen adapter and Core engine. */
import type {
  AssessmentItem,
  LearnerInput,
  TutorProgram,
  TutorResponse,
} from '../../../adaptive-tutor/core/contracts/index.ts'
import { AdaptiveTutorEngine } from '../../../adaptive-tutor/core/engine/adaptive-tutor-engine.ts'
import { adaptSequenceToTutorProgramV02 } from '../../../adaptive-tutor/subjects/math/core-v0.2-adapter.ts'
import { sequence } from '../../../adaptive-tutor/subjects/math/lessons/03-equivalent-fractions-and-common-denominators/sequence.ts'

type ItemPhase = 'assessment' | 'guided-practice' | 'independent-attempt' | 'reassess'

export interface FrozenTutorRoutingProbe {
  readonly declaredSkillGraphIds: readonly string[]
  readonly programTargetSkillId: string
  readonly adaptedRuntimeItemSkillIds: readonly string[]
  readonly selectableItemsByPhase: Readonly<Record<ItemPhase, readonly string[]>>
  readonly engineSelectedItemsByPhase: Readonly<Record<ItemPhase, readonly string[]>>
  readonly selectableTeachingTurnIds: readonly string[]
  readonly engineSelectedTeachingTurnId: string
  readonly terminalPhase: string
}

function correctAnswerFor(item: AssessmentItem): LearnerInput {
  if (item.kind === 'multiple-choice') {
    return { raw: '', selectedOptionIds: [...item.correctOptionIds] }
  }
  if (item.kind === 'short-answer') {
    return { raw: item.acceptedAnswers[0] ?? '__missing-reviewed-answer__' }
  }
  return { raw: '', orderedOptionIds: [...item.correctOrder] }
}

function itemIds(items: readonly AssessmentItem[]): string[] {
  return items.map((item) => item.id)
}

/**
 * Runs the actual adapted program to `advance` and records every engine-selected
 * assessment item. A source-only inventory cannot make this probe pass.
 */
export function probeFrozenTutorRouting(): FrozenTutorRoutingProbe {
  const adapted = adaptSequenceToTutorProgramV02(sequence)
  // The adapter's public compatibility type mirrors Core. The engine's schema
  // validates the value at construction, so the assertion carries no runtime
  // authority and cannot hide an incompatible adapted program.
  const program = adapted as unknown as TutorProgram
  const engine = new AdaptiveTutorEngine(program)
  const selected: Record<ItemPhase, string[]> = {
    assessment: [],
    'guided-practice': [],
    'independent-attempt': [],
    reassess: [],
  }

  const record = (response: TutorResponse): TutorResponse => {
    if (response.assessmentItem !== null && response.phase in selected) {
      selected[response.phase as ItemPhase].push(response.assessmentItem.id)
    }
    return response
  }

  record(engine.start())
  for (const item of program.diagnosticItems) record(engine.submit(correctAnswerFor(item)))

  const teaching = engine.continue()
  record(engine.continue())
  for (const item of program.guidedPractice.items) record(engine.submit(correctAnswerFor(item)))
  for (const item of program.independentMastery.items) record(engine.submit(correctAnswerFor(item)))
  let terminal: TutorResponse | undefined
  for (const item of program.reassessmentItems) {
    terminal = record(engine.submit(correctAnswerFor(item)))
  }

  const runtimeItems = [
    ...program.diagnosticItems,
    ...program.guidedPractice.items,
    ...program.independentMastery.items,
    ...program.reassessmentItems,
  ]

  return Object.freeze({
    declaredSkillGraphIds: Object.freeze(program.skillGraph.nodes.map((node) => node.id)),
    programTargetSkillId: program.targetSkillId,
    adaptedRuntimeItemSkillIds: Object.freeze(
      [...new Set(runtimeItems.map((item) => item.skillId))].sort(),
    ),
    selectableItemsByPhase: Object.freeze({
      assessment: Object.freeze(itemIds(program.diagnosticItems)),
      'guided-practice': Object.freeze(itemIds(program.guidedPractice.items)),
      'independent-attempt': Object.freeze(itemIds(program.independentMastery.items)),
      reassess: Object.freeze(itemIds(program.reassessmentItems)),
    }),
    engineSelectedItemsByPhase: Object.freeze({
      assessment: Object.freeze(selected.assessment),
      'guided-practice': Object.freeze(selected['guided-practice']),
      'independent-attempt': Object.freeze(selected['independent-attempt']),
      reassess: Object.freeze(selected.reassess),
    }),
    selectableTeachingTurnIds: Object.freeze(
      program.teachingSequences.flatMap((entry) => entry.turns.map((turn) => turn.id)),
    ),
    engineSelectedTeachingTurnId: teaching.id,
    terminalPhase: terminal?.phase ?? engine.getSnapshot().phase,
  })
}
