import type { AdaptiveMathSequence, GradeLevel, VisualBoardCommand } from './types'

/**
 * Provisional subject-owned adapter for the read-only Academy core inspected at
 * master baseline 15644974628ead6704c1e97e959cdbd801fdd1b3.
 *
 * It deliberately does not import or edit `adaptive-tutor/core/**`.
 */
export type LegacyGrade = '3' | '4' | '6' | '10' | '12'
export type LegacySkillId =
  | 'mult' | 'div' | 'place' | 'addsub' | 'fracUnit' | 'fracComp' | 'word2'
  | 'mult4' | 'div4' | 'factors4' | 'place4' | 'fracEquiv4' | 'fracAddSub4' | 'word4'

export type LegacyVizStep =
  | { kind: 'column'; op: '+' | '−' | '×' | '÷'; rows: string[]; result?: string }
  | { kind: 'numberLine'; min: number; max: number; marks?: number[]; point?: number }
  | { kind: 'fractionBar'; parts: number; shaded: number; compare?: { parts: number; shaded: number } }
  | { kind: 'array'; rows: number; cols: number; highlightRows?: number }
  | { kind: 'equationLedger'; lines: { left: string; right: string; op?: string }[]; activeLine: number }

export interface GradeAdapterResult {
  requestedGrade: GradeLevel
  coreGrade: LegacyGrade
  provisional: boolean
  warning?: string
}

export function adaptGradeForLegacyCore(grade: GradeLevel): GradeAdapterResult {
  if (grade === 3 || grade === 4 || grade === 6) {
    return { requestedGrade: grade, coreGrade: String(grade) as LegacyGrade, provisional: false }
  }
  return {
    requestedGrade: grade,
    coreGrade: '4',
    provisional: true,
    warning: 'The current core Grade union has no Grade 5. Keep instructional level 5 in subject metadata; do not persist the learner as Grade 4 solely because of this adapter.',
  }
}

const skillMap: Record<string, LegacySkillId[]> = {
  'math-skill-pv-value-v1': ['place4'],
  'math-skill-pv-compose-v1': ['place4'],
  'math-skill-regroup-add-v1': ['addsub'],
  'math-skill-regroup-sub-v1': ['addsub'],
  'math-skill-md-equal-groups-v1': ['mult', 'div'],
  'math-skill-md-inverse-v1': ['mult4', 'div4'],
  'math-skill-md-area-model-v1': ['mult4'],
  'math-skill-md-remainders-v1': ['div4'],
  'math-skill-fr-equivalence-v1': ['fracEquiv4'],
  'math-skill-fr-common-denominator-v1': ['fracAddSub4'],
  'math-skill-fr-add-sub-v1': ['fracAddSub4'],
  'math-skill-fr-compare-v1': ['fracComp', 'fracEquiv4'],
  'math-skill-wp-represent-v1': ['word2', 'word4'],
  'math-skill-wp-plan-v1': ['word4'],
  'math-skill-wp-units-v1': ['word4'],
  'math-skill-wp-check-v1': ['word4'],
}

export function legacySkillsFor(sequence: AdaptiveMathSequence): LegacySkillId[] {
  return [...new Set(sequence.skillIds.flatMap((id) => skillMap[id] ?? []))]
}

export interface VisualAdapterResult {
  visual: LegacyVizStep
  provisional: boolean
  sourceKind: string
  altText: string
}

export function adaptVisual(command: VisualBoardCommand): VisualAdapterResult {
  const p = command.payload as Record<string, any>
  switch (command.kind) {
    case 'number-line':
      return { visual: { kind: 'numberLine', min: Number(p.min ?? p.start ?? 0), max: Number(p.max ?? p.end ?? 100), marks: [] }, provisional: false, sourceKind: command.kind, altText: command.altText }
    case 'fraction-bar': {
      const first = p.first ?? { numerator: 0, denominator: 1 }
      const second = p.second
      return { visual: { kind: 'fractionBar', parts: Number(first.denominator), shaded: Number(first.numerator), compare: second ? { parts: Number(second.denominator), shaded: Number(second.numerator) } : undefined }, provisional: false, sourceKind: command.kind, altText: command.altText }
    }
    case 'array':
      return { visual: { kind: 'array', rows: Number(p.rows ?? 1), cols: Number(p.columns ?? p.cols ?? 1) }, provisional: false, sourceKind: command.kind, altText: command.altText }
    case 'column-arithmetic': {
      const problem = String(p.problem ?? '')
      const op = problem.includes('−') || problem.includes('-') ? '−' : problem.includes('×') ? '×' : problem.includes('÷') ? '÷' : '+'
      return { visual: { kind: 'column', op, rows: problem.split(/[+−×÷-]/).map((s: string) => s.trim()).filter(Boolean) }, provisional: false, sourceKind: command.kind, altText: command.altText }
    }
    default:
      return {
        visual: { kind: 'equationLedger', lines: [{ left: command.kind, right: command.altText }], activeLine: 0 },
        provisional: true,
        sourceKind: command.kind,
        altText: command.altText,
      }
  }
}

export const LEGACY_TUTOR_LIMITS = {
  maxLearnerExchangesPerQuestion: 6,
  maxSentencesPerTutorReply: 3,
  oneHintOrQuestionAtATime: true,
  finalAnswerRevealBeforeAttempt: false,
} as const
