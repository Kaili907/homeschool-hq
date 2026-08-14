import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { emitLesson } from '../src/emit.ts'
import { readAllLessons, readLessons } from '../src/lessonSources.ts'
import type { MaterialItem, StudentWorkPackage } from '../src/types.ts'
import { validateLesson } from '../src/validate.ts'

const LESSON_ID = 'ma-g3-mathematics-u01-l02'
const repoRoot = process.cwd()
const mathRoot = join(repoRoot, 'curriculum-production', 'final', 'mathematics')
const sourceRoot = join(mathRoot, 'evidence', 'oracle-sources', 'grades-03-04')
const evidencePath = join(
  repoRoot,
  'docs',
  'curriculum-quality',
  'elementary-math',
  'sample-r1',
  'G3_ROUNDING_SAMPLE_R1.md',
)

function transcriptFor(materialPackage: StudentWorkPackage): string {
  const lines: string[] = []
  for (const section of materialPackage.sections) {
    lines.push(`## ${section.title}`, '', section.directions, '')
    section.items.forEach((item: MaterialItem, index: number) => {
      if (item.kind === 'worked-example') {
        lines.push(`### ${item.prompt}`, '')
        for (const step of item.workedSolution.steps) lines.push(`- ${step}`, '')
        lines.push(`Final answer: **${item.workedSolution.answer}**`, '')
        return
      }
      lines.push(`### ${index + 1}. ${item.prompt}`, '')
      if (item.kind === 'multiple-choice') {
        item.choices.forEach((choice, choiceIndex) => {
          lines.push(`${String.fromCharCode(65 + choiceIndex)}. ${choice}`, '')
        })
      } else {
        lines.push(`What to do: ${item.responseExpectation}`, '')
      }
    })
  }
  return lines.join('\n')
}

const lesson = readLessons(3).find((entry) => entry.ref.lessonId === LESSON_ID)
if (!lesson) throw new Error(`Canonical lesson not found: ${LESSON_ID}`)

const emitted = emitLesson(lesson)
const issues = validateLesson(emitted.package, emitted.answerKey, lesson)
if (issues.length > 0) throw new Error(`Sample validation failed: ${JSON.stringify(issues)}`)

const packagePath = join(mathRoot, 'active', 'packages', 'grade-03', `${LESSON_ID}.package.json`)
const keyPath = join(mathRoot, 'active', 'answer-keys', 'grade-03', `${LESSON_ID}.key.json`)
writeFileSync(packagePath, `${JSON.stringify(emitted.package, null, 2)}\n`)
writeFileSync(keyPath, `${JSON.stringify(emitted.answerKey, null, 2)}\n`)

const allLessons = readAllLessons()
const summaries = [3, 4].map((grade) => {
  const gradeLessons = allLessons.filter((entry) => entry.ref.grade === grade)
  const itemTypes = new Set<string>()
  let items = 0
  let gradedItems = 0
  let workedExamples = 0
  let keyedAnswers = 0
  for (const entry of gradeLessons) {
    const generated = emitLesson(entry)
    const generatedIssues = validateLesson(generated.package, generated.answerKey, entry)
    if (generatedIssues.length > 0) {
      throw new Error(`${entry.ref.lessonId} failed: ${JSON.stringify(generatedIssues)}`)
    }
    for (const section of generated.package.sections) {
      for (const item of section.items) {
        items += 1
        itemTypes.add(item.itemType)
        if (item.kind === 'worked-example') workedExamples += 1
        else gradedItems += 1
      }
    }
    keyedAnswers += generated.answerKey.answers.length
  }
  return {
    grade,
    courseId: `ma-g${grade}-mathematics`,
    lessons: gradeLessons.length,
    items,
    gradedItems,
    workedExamples,
    keyedAnswers,
    itemTypes: itemTypes.size,
  }
})

const sourceManifest = {
  corpusVersion: '1.0.0',
  subject: 'mathematics',
  generatedFrom: {
    lessonSource: 'curriculum-production/final/mathematics/active canonical lesson metadata with Content Repair R2 Day-1 diagnostic standards',
    itemGenerators: 'curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/g34 (grades 3-4), including isolated Grade 3 Rounding Sample R1',
  },
  totals: {
    lessons: summaries.reduce((sum, entry) => sum + entry.lessons, 0),
    items: summaries.reduce((sum, entry) => sum + entry.items, 0),
    gradedItems: summaries.reduce((sum, entry) => sum + entry.gradedItems, 0),
    workedExamples: summaries.reduce((sum, entry) => sum + entry.workedExamples, 0),
    keyedAnswers: summaries.reduce((sum, entry) => sum + entry.keyedAnswers, 0),
  },
  answerAuthority: {
    oracleRecomputed: summaries.reduce((sum, entry) => sum + entry.keyedAnswers, 0),
    generatorAuthority: 0,
  },
  byGrade: summaries,
  paths: {
    studentPackages: 'packages/grade-XX/<lessonId>.package.json',
    answerKeys: 'answer-keys/grade-XX/<lessonId>.key.json',
  },
}
writeFileSync(
  join(sourceRoot, 'upstream-corpus-manifest.json'),
  `${JSON.stringify(sourceManifest, null, 2)}\n`,
)

const counts = Object.fromEntries(
  emitted.package.sections.map((section) => [section.sectionId, section.items.length]),
)
const evidence = `# Grade 3 Rounding Sample R1

## Review identity

- Lesson ref: \`${LESSON_ID}\`
- Canonical catalog title: \`${lesson.ref.title}\`
- Grade / subject / course day: Grade 3 / Mathematics / Day 2
- Approved standard refs: ${lesson.standards.map((standard) => `\`${standard}\``).join(', ')}
- Child-facing learning goal: Today you will learn how to round a number to the nearest hundred.

The requested lesson identity is exact. The active Day 2 package at this ref already taught rounding under the approved 3.NBT.1 intent even though its preserved catalog title names the broader place-value concept. This sample deepens that same active package; it does not substitute Lesson 5 or alter catalog scheduling.

## Composition

| Part | Count |
| --- | ---: |
| Teaching blocks | 3 |
| Worked examples | ${counts.ex} |
| Guided items | ${counts.gp} |
| Independent items | ${counts.ip} |
| Mastery items | ${counts.mc} |
| Remediation items | ${counts.rm} |
| Optional challenge items | ${counts.xt} |

## Canonical authorship and provenance

- Authoritative base: \`56dd8a45fee1ca03dd5f83e1466c9f081824d6b9\`
- Authored sample source and independent oracle: \`curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/g34/grade3RoundingSampleR1.ts\`
- Canonical dispatcher: \`curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/emit.ts\`
- Isolated deterministic emitter: \`curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/tooling/generateGrade3RoundingSampleR1.ts\`
- Final learner package: \`curriculum-production/final/mathematics/active/packages/grade-03/${LESSON_ID}.package.json\`
- Separate adult answer authority: \`curriculum-production/final/mathematics/active/answer-keys/grade-03/${LESSON_ID}.key.json\`
- Binding: package \`answerKeyRef\` resolves to the separate adult key; both retain the exact lesson, course, grade, unit, and phase identity.
- Corpus binding/checksum evidence: \`curriculum-production/final/mathematics/manifest.json\` and \`curriculum-production/final/mathematics/SHA256SUMS.txt\`.
- Regenerate from the repository root with \`node --disable-warning=ExperimentalWarning --experimental-strip-types curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/tooling/generateGrade3RoundingSampleR1.ts\`, then \`python3 curriculum-production/final/mathematics/build.py\`.
- Admission/browser payloads were not hand-edited. Shared Tutor V2 and release-admission contracts were not changed for this sample.

## Proposed Tutor-readiness metadata (sample evidence only)

No accepted curriculum field currently exists for this metadata, so this proposal is evidence only and does not define Tutor V2 runtime behavior.

\`\`\`json
{
  "concept": "round whole numbers to the nearest hundred",
  "prerequisites": [
    "read and name three-digit numbers",
    "identify hundreds and tens digits",
    "compare positions on a number line"
  ],
  "possibleMisconceptionIds": [
    "rounding-uses-ones-digit",
    "rounding-always-goes-down",
    "rounding-halfway-does-not-go-up",
    "rounding-changes-to-nearest-ten"
  ],
  "phaseHelpPolicyReferences": {
    "guided": "adult may prompt for bounding hundreds, then tens digit",
    "independent": "no answer reveal; ask learner to name the two neighboring hundreds",
    "mastery": "no help during first attempt",
    "remediation": "use Need Help? items in order",
    "challenge": "optional; ask for justification, not a new rule"
  }
}
\`\`\`

## Child-facing lesson transcript

${transcriptFor(emitted.package)}
`

mkdirSync(join(evidencePath, '..'), { recursive: true })
writeFileSync(evidencePath, evidence)

console.log(`generated ${LESSON_ID}`)
console.log(`package ${packagePath}`)
console.log(`key ${keyPath}`)
console.log(`evidence ${evidencePath}`)
