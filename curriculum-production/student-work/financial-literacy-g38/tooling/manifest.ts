/** Regenerates corpus-manifest.json from the corpus itself. Deterministic: no timestamps. */
import { writeFileSync } from 'node:fs'
import { buildCorpus, CORPUS_ROOT } from '../src/build.ts'
import { ORACLE_ID } from '../src/oracle.ts'
import { REQUESTED_GRADES, SOURCE_CORPUS_VERSION, sourcePath, sourceRef } from '../src/inventory.ts'

const entries = buildCorpus()
const itemsOf = (grade: number) =>
  entries
    .filter((e) => e.source.grade === grade)
    .reduce((n, e) => n + (e.scoring.scoringAuthority.kind === 'ANSWER_KEY' ? e.scoring.scoringAuthority.items.length : 0), 0)

const manifest = {
  schemaVersion: '1.0',
  status: 'AUTHORED',
  subject: 'financial-literacy',
  purpose:
    'Student work and adult-only scoring authority for every Financial Literacy lesson in grades 3, 4, 5, 7, and 8. Fixed answers are recomputed independently of the authored literal and of the source corpus guidance; judgment work carries a rubric and acceptable-answer criteria instead of a fabricated exact answer.',
  totals: {
    lessons: entries.length,
    packages: entries.length,
    scoringRecords: entries.length,
    fixedAnswerLessons: entries.filter((e) => e.scoring.scoringAuthority.kind === 'ANSWER_KEY').length,
    rubricJudgmentLessons: entries.filter((e) => e.scoring.scoringAuthority.kind === 'RUBRIC').length,
    independentlyRecomputedItems: entries.reduce(
      (n, e) => n + (e.scoring.scoringAuthority.kind === 'ANSWER_KEY' ? e.scoring.scoringAuthority.items.length : 0),
      0,
    ),
  },
  verification: {
    oracleId: ORACLE_ID,
    method: 'authored answer literal, TypeScript integer-cent oracle, and an independent Python decimal cross-check must all agree',
    failClosed: 'src/build.ts refuses to emit any lesson whose authored answer and recomputation disagree',
    crossCheck: 'tooling/crosscheck.py',
    answerDerivedFromSourceGuidance: false,
  },
  generatedFrom: Object.fromEntries(
    REQUESTED_GRADES.map((grade) => [
      `grade-0${grade}`,
      {
        lessons: entries.filter((e) => e.source.grade === grade).length,
        fixedAnswerLessons: entries.filter((e) => e.source.grade === grade && e.scoring.scoringAuthority.kind === 'ANSWER_KEY').length,
        rubricJudgmentLessons: entries.filter((e) => e.source.grade === grade && e.scoring.scoringAuthority.kind === 'RUBRIC').length,
        recomputedItems: itemsOf(grade),
        sourceCorpusVersion: SOURCE_CORPUS_VERSION,
        sourceRef: sourceRef(grade),
        sourcePath: sourcePath(grade),
      },
    ]),
  ),
  safety: {
    everyScenarioFictional: true,
    neverRequestsRealCredentials: true,
    noIndividualizedAdvice: true,
    completionAuthority: 'learner',
    scoringRecordsAdultOnly: true,
  },
}

writeFileSync(new URL('corpus-manifest.json', `file://${CORPUS_ROOT}`), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify(manifest.totals, null, 2))
