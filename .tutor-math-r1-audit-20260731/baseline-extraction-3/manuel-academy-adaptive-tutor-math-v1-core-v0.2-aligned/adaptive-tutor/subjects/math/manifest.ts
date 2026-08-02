import { sequence as sequence01 } from './lessons/01-place-value-and-regrouping/sequence'
import { sequence as sequence02 } from './lessons/02-multiplication-and-division-relationships/sequence'
import { sequence as sequence03 } from './lessons/03-equivalent-fractions-and-common-denominators/sequence'
import { sequence as sequence04 } from './lessons/04-multistep-word-problem-reasoning/sequence'
import type { MathSubjectManifest } from './types'

export const mathSubjectManifest = {
  subjectId: 'math',
  version: '1.0.0',
  title: 'Adaptive Math Intervention Content',
  gradeBand: { minimum: 4, maximum: 6, primary: [4, 5, 6], extension: [6], prerequisiteSupport: [3] },
  sequenceIds: [sequence01.sequenceId, sequence02.sequenceId, sequence03.sequenceId, sequence04.sequenceId],
  lessons: [sequence01, sequence02, sequence03, sequence04]
} as const satisfies MathSubjectManifest
