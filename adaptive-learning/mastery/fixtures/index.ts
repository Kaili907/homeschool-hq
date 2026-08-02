import {
  MASTERY_SCHEMA_VERSION,
  type AssessmentAttemptEvidence,
  type EvidenceQuality,
  type IndependentDemonstrationEvidence,
  type MasteryEvidence,
  type SkillGraph,
  type StudentSkillMastery,
  type SupportLevel,
  type TutorInterventionEvidence,
} from '../contracts.ts'
import { evaluateMastery } from '../engine.ts'
import { explainMastery } from '../explanation.ts'
import { createSkillGraph } from '../graph.ts'
import {
  asAssessmentAttemptId,
  asEvidenceId,
  asIndependentDemonstrationId,
  asMasteryRecordId,
  asSkillGraphId,
  asSkillId,
  asStudentId,
  asSubjectId,
  asTutorInterventionId,
  type SkillId,
} from '../ids.ts'

export const FIXTURE_NOW = '2026-07-28T14:00:00.000Z' as const
export const seedStudentId = asStudentId('p1')

export const MATH_SKILL_IDS = {
  placeValue: asSkillId('math.number.place-value'),
  multiplication: asSkillId('math.operations.multiplication'),
  unitFractions: asSkillId('math.fractions.unit'),
  equivalentFractions: asSkillId('math.fractions.equivalence'),
  compareFractions: asSkillId('math.fractions.compare'),
  addLikeFractions: asSkillId('math.fractions.add-like'),
  shapeAttributes: asSkillId('math.geometry.shape-attributes'),
} as const

export const ENGLISH_SKILL_IDS = {
  centralIdea: asSkillId('english.reading.central-idea'),
  textEvidence: asSkillId('english.reading.text-evidence'),
  inference: asSkillId('english.reading.inference'),
  argumentClaim: asSkillId('english.writing.argument-claim'),
  evidenceSelection: asSkillId('english.writing.evidence-selection'),
  reasoning: asSkillId('english.writing.reasoning'),
} as const

const mathSubjectId = asSubjectId('math')
const englishSubjectId = asSubjectId('english')

export const sampleMathGraph: SkillGraph = createSkillGraph({
  kind: 'mastery-skill-graph',
  schemaVersion: MASTERY_SCHEMA_VERSION,
  id: asSkillGraphId('graph:math-foundations'),
  revision: 1,
  subjectId: mathSubjectId,
  title: 'Math foundations mastery map',
  skills: [
    {
      id: MATH_SKILL_IDS.placeValue,
      subjectId: mathSubjectId,
      title: 'Place value',
      learningObjective:
        'Read, compose, decompose, and compare whole numbers by place value.',
      description:
        'The student connects each digit to its value and uses that structure to reason about whole numbers.',
      gradeBand: 'elementary-3-5',
      domain: 'Number and operations',
      tags: ['whole-numbers', 'base-ten'],
    },
    {
      id: MATH_SKILL_IDS.multiplication,
      subjectId: mathSubjectId,
      title: 'Multiplication strategies',
      learningObjective:
        'Use place-value and grouping strategies to solve multiplication problems.',
      description:
        'The student explains and applies multiplication as equal groups, arrays, and decomposed products.',
      gradeBand: 'elementary-3-5',
      domain: 'Operations',
      tags: ['multiplication', 'strategy'],
    },
    {
      id: MATH_SKILL_IDS.unitFractions,
      subjectId: mathSubjectId,
      title: 'Unit fractions',
      learningObjective:
        'Explain a unit fraction as one equal part of a whole.',
      description:
        'The student identifies equal partitions and connects the denominator to the number of equal parts.',
      gradeBand: 'elementary-3-5',
      domain: 'Fractions',
      tags: ['fractions', 'models'],
    },
    {
      id: MATH_SKILL_IDS.equivalentFractions,
      subjectId: mathSubjectId,
      title: 'Equivalent fractions',
      learningObjective:
        'Recognize and generate fractions that name the same quantity.',
      description:
        'The student uses visual models and number reasoning to justify fraction equivalence.',
      gradeBand: 'elementary-3-5',
      domain: 'Fractions',
      tags: ['fractions', 'equivalence'],
    },
    {
      id: MATH_SKILL_IDS.compareFractions,
      subjectId: mathSubjectId,
      title: 'Compare fractions',
      learningObjective:
        'Compare fractions using common benchmarks, numerators, or denominators.',
      description:
        'The student chooses a valid comparison strategy and explains why one fraction is greater, less, or equal.',
      gradeBand: 'elementary-3-5',
      domain: 'Fractions',
      tags: ['fractions', 'comparison'],
    },
    {
      id: MATH_SKILL_IDS.addLikeFractions,
      subjectId: mathSubjectId,
      title: 'Add fractions with like denominators',
      learningObjective:
        'Add fractions with the same denominator and explain why the unit size stays constant.',
      description:
        'The student combines like fractional units and represents the sum with equations and models.',
      gradeBand: 'elementary-3-5',
      domain: 'Fractions',
      tags: ['fractions', 'addition'],
    },
    {
      id: MATH_SKILL_IDS.shapeAttributes,
      subjectId: mathSubjectId,
      title: 'Classify shapes by attributes',
      learningObjective:
        'Classify two-dimensional shapes using sides, angles, and parallel or perpendicular lines.',
      description:
        'The student uses defining attributes rather than appearance to place shapes in categories.',
      gradeBand: 'elementary-3-5',
      domain: 'Geometry',
      tags: ['geometry', 'classification'],
    },
  ],
  prerequisites: [
    {
      prerequisiteSkillId: MATH_SKILL_IDS.placeValue,
      dependentSkillId: MATH_SKILL_IDS.multiplication,
      relation: 'required',
      rationale:
        'Place-value decomposition supports efficient multi-digit multiplication strategies.',
    },
    {
      prerequisiteSkillId: MATH_SKILL_IDS.equivalentFractions,
      dependentSkillId: MATH_SKILL_IDS.compareFractions,
      relation: 'required',
      rationale:
        'Equivalence provides a common representation for comparing fractions.',
    },
    {
      prerequisiteSkillId: MATH_SKILL_IDS.compareFractions,
      dependentSkillId: MATH_SKILL_IDS.addLikeFractions,
      relation: 'required',
      rationale:
        'Comparing fractional units supports reasoning about sums with a shared unit.',
    },
  ],
})

export const sampleEnglishGraph: SkillGraph = createSkillGraph({
  kind: 'mastery-skill-graph',
  schemaVersion: MASTERY_SCHEMA_VERSION,
  id: asSkillGraphId('graph:english-evidence-and-argument'),
  revision: 1,
  subjectId: englishSubjectId,
  title: 'English evidence and argument mastery map',
  skills: [
    {
      id: ENGLISH_SKILL_IDS.centralIdea,
      subjectId: englishSubjectId,
      title: 'Determine central idea',
      learningObjective:
        'Determine a text’s central idea and distinguish it from supporting details.',
      description:
        'The student states the central idea precisely and identifies details that develop it.',
      gradeBand: 'middle-6-8',
      domain: 'Reading informational text',
      tags: ['reading', 'central-idea'],
    },
    {
      id: ENGLISH_SKILL_IDS.textEvidence,
      subjectId: englishSubjectId,
      title: 'Select relevant text evidence',
      learningObjective:
        'Select and cite evidence that directly supports an interpretation of a text.',
      description:
        'The student distinguishes relevant textual support from interesting but unrelated details.',
      gradeBand: 'middle-6-8',
      domain: 'Reading evidence',
      tags: ['reading', 'evidence'],
    },
    {
      id: ENGLISH_SKILL_IDS.inference,
      subjectId: englishSubjectId,
      title: 'Make evidence-based inferences',
      learningObjective:
        'Make a reasonable inference and connect it explicitly to evidence from the text.',
      description:
        'The student combines text evidence with reasoning without overstating what the passage proves.',
      gradeBand: 'middle-6-8',
      domain: 'Reading analysis',
      tags: ['reading', 'inference'],
    },
    {
      id: ENGLISH_SKILL_IDS.argumentClaim,
      subjectId: englishSubjectId,
      title: 'Write a focused argument claim',
      learningObjective:
        'Write a clear, debatable claim that responds directly to a prompt.',
      description:
        'The student states a defensible position with an appropriate scope.',
      gradeBand: 'high-9-12',
      domain: 'Argument writing',
      tags: ['writing', 'claim'],
    },
    {
      id: ENGLISH_SKILL_IDS.evidenceSelection,
      subjectId: englishSubjectId,
      title: 'Choose evidence for an argument',
      learningObjective:
        'Choose credible, relevant evidence that supports an argument claim.',
      description:
        'The student evaluates evidence for relevance and sufficiency before including it.',
      gradeBand: 'high-9-12',
      domain: 'Argument writing',
      tags: ['writing', 'evidence'],
    },
    {
      id: ENGLISH_SKILL_IDS.reasoning,
      subjectId: englishSubjectId,
      title: 'Explain argument reasoning',
      learningObjective:
        'Explain how selected evidence supports a claim and address reasonable limitations.',
      description:
        'The student connects evidence to the claim through explicit logical reasoning.',
      gradeBand: 'high-9-12',
      domain: 'Argument writing',
      tags: ['writing', 'reasoning'],
    },
  ],
  prerequisites: [
    {
      prerequisiteSkillId: ENGLISH_SKILL_IDS.centralIdea,
      dependentSkillId: ENGLISH_SKILL_IDS.textEvidence,
      relation: 'required',
      rationale:
        'Identifying the central idea helps distinguish relevant support from secondary detail.',
    },
    {
      prerequisiteSkillId: ENGLISH_SKILL_IDS.textEvidence,
      dependentSkillId: ENGLISH_SKILL_IDS.inference,
      relation: 'required',
      rationale:
        'Evidence-based inference requires selecting text details that actually support the conclusion.',
    },
    {
      prerequisiteSkillId: ENGLISH_SKILL_IDS.argumentClaim,
      dependentSkillId: ENGLISH_SKILL_IDS.evidenceSelection,
      relation: 'required',
      rationale:
        'Evidence can be judged relevant only against a clear argument claim.',
    },
    {
      prerequisiteSkillId: ENGLISH_SKILL_IDS.evidenceSelection,
      dependentSkillId: ENGLISH_SKILL_IDS.reasoning,
      relation: 'required',
      rationale:
        'Reasoning explains the relationship between a claim and its selected evidence.',
    },
  ],
})

function assessment(
  token: string,
  skillId: SkillId,
  capturedAt: string,
  correctItemCount: number,
  attemptedItemCount: number,
  supportLevel: SupportLevel = 'independent',
  quality: EvidenceQuality = 'reliable',
): AssessmentAttemptEvidence {
  return {
    kind: 'assessment_attempt',
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: asEvidenceId(`evidence:${token}:assessment`),
    attemptId: asAssessmentAttemptId(`attempt:${token}`),
    studentId: seedStudentId,
    skillId,
    capturedAt,
    sourceRef: `session:${token}`,
    quality,
    assessmentType: 'retrieval',
    scoringStatus: 'scored',
    attemptedItemCount,
    correctItemCount,
    supportLevel,
  }
}

function demonstration(
  token: string,
  skillId: SkillId,
  capturedAt: string,
  correctItemCount: number,
  attemptedItemCount: number,
  assessmentEvidenceId: AssessmentAttemptEvidence['id'],
  options: {
    readonly quality?: EvidenceQuality
    readonly taskNovelty?: IndependentDemonstrationEvidence['taskNovelty']
    readonly outcome?: IndependentDemonstrationEvidence['outcome']
  } = {},
): IndependentDemonstrationEvidence {
  return {
    kind: 'independent_demonstration',
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: asEvidenceId(`evidence:${token}:independent`),
    demonstrationId: asIndependentDemonstrationId(`demonstration:${token}`),
    studentId: seedStudentId,
    skillId,
    capturedAt,
    sourceRef: `session:${token}`,
    quality: options.quality ?? 'reliable',
    context: 'retrieval',
    supportLevel: 'independent',
    attemptedItemCount,
    correctItemCount,
    criterion: {
      criterionId: 'criterion:independent-80',
      minimumAccuracy: 0.8,
      minimumItemCount: 4,
    },
    outcome: options.outcome ?? 'successful',
    taskNovelty: options.taskNovelty ?? 'new_items',
    sourceEvidenceIds: [assessmentEvidenceId],
  }
}

function tutorIntervention(
  token: string,
  skillId: SkillId,
  capturedAt: string,
): TutorInterventionEvidence {
  return {
    kind: 'tutor_intervention',
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: asEvidenceId(`evidence:${token}:tutor`),
    interventionId: asTutorInterventionId(`intervention:${token}`),
    studentId: seedStudentId,
    skillId,
    capturedAt,
    sourceRef: `session:${token}`,
    quality: 'reliable',
    interventionType: 'prompt',
    supportLevel: 'guided',
    outcome: 'resolved_with_support',
  }
}

function twoSuccessfulDemonstrations(
  token: string,
  skillId: SkillId,
  firstAt: string,
  secondAt: string,
): readonly MasteryEvidence[] {
  const firstAssessment = assessment(
    `${token}-1`,
    skillId,
    firstAt,
    4,
    5,
  )
  const secondAssessment = assessment(
    `${token}-2`,
    skillId,
    secondAt,
    5,
    5,
  )
  return [
    firstAssessment,
    demonstration(
      `${token}-1`,
      skillId,
      firstAt,
      4,
      5,
      firstAssessment.id,
      { taskNovelty: 'new_items' },
    ),
    secondAssessment,
    demonstration(
      `${token}-2`,
      skillId,
      secondAt,
      5,
      5,
      secondAssessment.id,
      { taskNovelty: 'transfer' },
    ),
  ]
}

const placeValueEvidence = twoSuccessfulDemonstrations(
  'math-place',
  MATH_SKILL_IDS.placeValue,
  '2026-07-12T14:00:00.000Z',
  '2026-07-22T14:00:00.000Z',
)

const multiplicationEvidence = twoSuccessfulDemonstrations(
  'math-multiplication',
  MATH_SKILL_IDS.multiplication,
  '2026-04-20T14:00:00.000Z',
  '2026-05-10T14:00:00.000Z',
)

const unitFractionAssessment = assessment(
  'math-unit-fractions',
  MATH_SKILL_IDS.unitFractions,
  '2026-07-25T14:00:00.000Z',
  4,
  5,
  'guided',
)
const unitFractionEvidence: readonly MasteryEvidence[] = [
  unitFractionAssessment,
  tutorIntervention(
    'math-unit-fractions',
    MATH_SKILL_IDS.unitFractions,
    '2026-07-25T14:05:00.000Z',
  ),
]

const equivalentAssessment = assessment(
  'math-equivalence',
  MATH_SKILL_IDS.equivalentFractions,
  '2026-07-24T14:00:00.000Z',
  4,
  5,
)
const equivalentEvidence: readonly MasteryEvidence[] = [
  equivalentAssessment,
  demonstration(
    'math-equivalence',
    MATH_SKILL_IDS.equivalentFractions,
    '2026-07-24T14:00:00.000Z',
    4,
    5,
    equivalentAssessment.id,
    { quality: 'conflicting', taskNovelty: 'familiar_items' },
  ),
]

const centralIdeaEvidence = twoSuccessfulDemonstrations(
  'english-central-idea',
  ENGLISH_SKILL_IDS.centralIdea,
  '2026-07-08T15:00:00.000Z',
  '2026-07-21T15:00:00.000Z',
)
const textEvidenceAssessment = assessment(
  'english-text-evidence',
  ENGLISH_SKILL_IDS.textEvidence,
  '2026-07-26T15:00:00.000Z',
  3,
  5,
  'minimal_support',
)
const textEvidence: readonly MasteryEvidence[] = [
  textEvidenceAssessment,
  tutorIntervention(
    'english-text-evidence',
    ENGLISH_SKILL_IDS.textEvidence,
    '2026-07-26T15:06:00.000Z',
  ),
]

export const seedMasteryEvidence: readonly MasteryEvidence[] = [
  ...placeValueEvidence,
  ...multiplicationEvidence,
  ...unitFractionEvidence,
  ...equivalentEvidence,
  ...centralIdeaEvidence,
  ...textEvidence,
]

const placeValueRecord = evaluateMastery({
  recordId: asMasteryRecordId('record:p1:math-place-value'),
  studentId: seedStudentId,
  skillId: MATH_SKILL_IDS.placeValue,
  graph: sampleMathGraph,
  evidence: placeValueEvidence,
  evaluatedAt: FIXTURE_NOW,
})

const multiplicationRecord = evaluateMastery({
  recordId: asMasteryRecordId('record:p1:math-multiplication'),
  studentId: seedStudentId,
  skillId: MATH_SKILL_IDS.multiplication,
  graph: sampleMathGraph,
  evidence: multiplicationEvidence,
  prerequisiteRecords: [placeValueRecord],
  evaluatedAt: FIXTURE_NOW,
})

const unitFractionRecord = evaluateMastery({
  recordId: asMasteryRecordId('record:p1:math-unit-fractions'),
  studentId: seedStudentId,
  skillId: MATH_SKILL_IDS.unitFractions,
  graph: sampleMathGraph,
  evidence: unitFractionEvidence,
  evaluatedAt: FIXTURE_NOW,
})

const equivalentRecord = evaluateMastery({
  recordId: asMasteryRecordId('record:p1:math-equivalence'),
  studentId: seedStudentId,
  skillId: MATH_SKILL_IDS.equivalentFractions,
  graph: sampleMathGraph,
  evidence: equivalentEvidence,
  evaluatedAt: FIXTURE_NOW,
})

const compareRecord = evaluateMastery({
  recordId: asMasteryRecordId('record:p1:math-compare-fractions'),
  studentId: seedStudentId,
  skillId: MATH_SKILL_IDS.compareFractions,
  graph: sampleMathGraph,
  evidence: [],
  prerequisiteRecords: [equivalentRecord],
  evaluatedAt: FIXTURE_NOW,
})

const shapeRecord = evaluateMastery({
  recordId: asMasteryRecordId('record:p1:math-shape-attributes'),
  studentId: seedStudentId,
  skillId: MATH_SKILL_IDS.shapeAttributes,
  graph: sampleMathGraph,
  evidence: [],
  evaluatedAt: FIXTURE_NOW,
})

const centralIdeaRecord = evaluateMastery({
  recordId: asMasteryRecordId('record:p1:english-central-idea'),
  studentId: seedStudentId,
  skillId: ENGLISH_SKILL_IDS.centralIdea,
  graph: sampleEnglishGraph,
  evidence: centralIdeaEvidence,
  evaluatedAt: FIXTURE_NOW,
})

const textEvidenceRecord = evaluateMastery({
  recordId: asMasteryRecordId('record:p1:english-text-evidence'),
  studentId: seedStudentId,
  skillId: ENGLISH_SKILL_IDS.textEvidence,
  graph: sampleEnglishGraph,
  evidence: textEvidence,
  prerequisiteRecords: [centralIdeaRecord],
  evaluatedAt: FIXTURE_NOW,
})

const inferenceRecord = evaluateMastery({
  recordId: asMasteryRecordId('record:p1:english-inference'),
  studentId: seedStudentId,
  skillId: ENGLISH_SKILL_IDS.inference,
  graph: sampleEnglishGraph,
  evidence: [],
  prerequisiteRecords: [textEvidenceRecord],
  evaluatedAt: FIXTURE_NOW,
})

export const seedStudentMasteryRecords: readonly StudentSkillMastery[] = [
  placeValueRecord,
  multiplicationRecord,
  unitFractionRecord,
  equivalentRecord,
  compareRecord,
  shapeRecord,
  centralIdeaRecord,
  textEvidenceRecord,
  inferenceRecord,
]

export const seedMasteryExplanations = seedStudentMasteryRecords.map((record) =>
  explainMastery(
    record,
    sampleMathGraph.skills.some(({ id }) => id === record.skillId)
      ? sampleMathGraph
      : sampleEnglishGraph,
  ),
)

export const masteryDemoFixture = {
  now: FIXTURE_NOW,
  studentId: seedStudentId,
  graphs: [sampleMathGraph, sampleEnglishGraph] as const,
  records: seedStudentMasteryRecords,
  explanations: seedMasteryExplanations,
} as const

