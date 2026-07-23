import type { Attempt, FixedTest } from './types'
import { gradeAttempt, computeAutoScore } from './attempts'

const VERDICT_LABEL: Record<string, string> = {
  correct: 'AUTO ✓ correct',
  incorrect: 'AUTO ✗ incorrect',
  unmatched: 'NEEDS GRADING (not auto-matched)',
  ungraded: 'NEEDS GRADING',
  skip: 'SKIPPED',
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

/**
 * Plain-text / markdown report of an entire attempt — every item id, the student's
 * verbatim answer, skip flags, auto-scores, and time-on-item. This is what Dad
 * uploads to Claude for grading and curriculum-building.
 */
export function buildReport(test: FixedTest, attempt: Attempt, studentName: string): string {
  const grades = gradeAttempt(test, attempt)
  const score = attempt.autoScore ?? computeAutoScore(test, attempt)
  const lines: string[] = []

  lines.push(`# ${test.title} — attempt report`)
  lines.push('')
  lines.push(`- Student: ${studentName}`)
  lines.push(`- Test id: ${test.id}`)
  lines.push(`- Started: ${attempt.startedAt}`)
  lines.push(`- Finished: ${attempt.finishedAt ?? '(in progress)'}`)
  if (test.ungraded) lines.push(`- NOTE: this test is ungraded by design.`)
  lines.push('')

  lines.push('## Auto-score summary')
  for (const [section, tally] of Object.entries(score.bySection)) {
    lines.push(`- ${section}: ${tally.correct}/${tally.of} auto-scored correct`)
  }
  lines.push(`- Items needing human grading: ${score.gradedItems}`)
  lines.push(`- Skips: ${score.skips}`)
  lines.push('')

  for (const section of test.sections) {
    lines.push(`## ${section.name}`)
    if (section.passage) {
      lines.push('')
      lines.push('> (passage shown to student on screen)')
    }
    lines.push('')
    for (const g of grades.filter((x) => x.sectionName === section.name)) {
      const timeFlag =
        g.msOnItem > 4 * 60 * 1000
          ? ' ⚠ >4 min'
          : g.msOnItem > 0 && g.msOnItem < 5 * 1000 && !g.skipped
            ? ' ⚠ <5 s'
            : ''
      lines.push(`### ${g.item.id} — ${VERDICT_LABEL[g.verdict]}${timeFlag}`)
      lines.push(`Q: ${g.item.prompt}`)
      if (g.skipped) {
        lines.push(`A: [SKIPPED]`)
      } else {
        lines.push(`A: ${g.value === '' ? '[blank]' : g.value}`)
      }
      if (g.item.key !== undefined) {
        const keyStr = Array.isArray(g.item.key) ? g.item.key.join(', ') : g.item.key
        lines.push(`Key: ${keyStr}`)
      }
      if (g.item.keyNote) lines.push(`Key note: ${g.item.keyNote}`)
      lines.push(`Time on item: ${fmtDuration(g.msOnItem)}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}
