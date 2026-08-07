import type { Attempt, FixedTest, ResponseDisposition } from '../../assessment/types'
import { gradeAttempt } from '../../assessment/attempts'
import { buildReport } from '../../assessment/report'

interface AssessmentResultsProps {
  test: FixedTest
  attempt: Attempt
  studentName: string
}

const DISPOSITION_UI: Record<ResponseDisposition, { label: string; cls: string }> = {
  correct: { label: 'auto ✓', cls: 'bg-emerald-100 text-emerald-700' },
  incorrect: { label: 'auto ✗', cls: 'bg-rose-100 text-rose-700' },
  unmatched: { label: 'grade', cls: 'bg-amber-100 text-amber-800' },
  ungraded: { label: 'grade', cls: 'bg-amber-100 text-amber-800' },
  'deliberate-skip': { label: 'skipped', cls: 'bg-slate-200 text-slate-500' },
  'no-response': { label: 'no response', cls: 'bg-slate-100 text-slate-500' },
  'not-reached': { label: 'not reached', cls: 'bg-slate-100 text-slate-400' },
}

/** What to print where the answer goes. Only a real response prints as one. */
function AnswerText({ disposition, value }: { disposition: ResponseDisposition; value: string }) {
  if (disposition === 'deliberate-skip') return <span className="italic text-amber-600">SKIPPED</span>
  if (disposition === 'no-response') return <span className="italic text-slate-400">no response</span>
  if (disposition === 'not-reached') return <span className="italic text-slate-400">not reached</span>
  if (value === '') return <span className="italic text-slate-400">[blank]</span>
  return <>{value}</>
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function outlierFlag(ms: number, skipped: boolean): string {
  if (ms > 4 * 60 * 1000) return '⚠ >4 min'
  if (!skipped && ms > 0 && ms < 5000) return '⚠ <5 s'
  return ''
}

export function AssessmentResults({ test, attempt, studentName }: AssessmentResultsProps) {
  const grades = gradeAttempt(test, attempt)
  const score = attempt.autoScore

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold text-slate-700">
          Results · {test.title}
          {test.ungraded && <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">ungraded by design</span>}
        </div>
        <button
          onClick={() =>
            downloadText(
              `${test.id}-${studentName}-report.md`.replace(/\s+/g, '-'),
              buildReport(test, attempt, studentName),
            )
          }
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          ⬇️ Export report (.md)
        </button>
      </div>

      {score && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
          {Object.entries(score.bySection).map(([name, t]) => (
            <span key={name} className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-600">
              {name.replace(/^Section \d+ — /, '')}: {t.correct}/{t.of}
            </span>
          ))}
          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
            {score.gradedItems} to grade
          </span>
          <span className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-500">
            {score.skips} skipped
          </span>
          <span className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-500">
            {/* absent means this attempt predates the tally — unknown, not zero */}
            {score.noResponse === undefined ? 'no response: not recorded' : `${score.noResponse} no response`}
          </span>
        </div>
      )}

      {score && score.noResponse === undefined && (
        <div className="mb-3 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500">
          Scored before seen-but-blank items were counted separately, so the skip count above may
          include items she saw and left blank. The per-item list below is the reliable record.
        </div>
      )}

      <div className="space-y-1.5">
        {grades.map((g) => {
          const ui = DISPOSITION_UI[g.disposition]
          const flag = outlierFlag(g.msOnItem, g.skipped)
          return (
            <div key={g.item.id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm">
              <div className="flex items-start gap-2">
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${ui.cls}`}>{ui.label}</span>
                <span className="font-mono text-xs text-slate-400">{g.item.id}</span>
                <span className="flex-1 text-slate-700">{g.item.prompt}</span>
                {flag && <span className="shrink-0 text-xs font-bold text-orange-500">{flag}</span>}
              </div>
              <div className="mt-1 pl-1 text-slate-600">
                <span className="font-semibold">Answer:</span>{' '}
                <AnswerText disposition={g.disposition} value={g.value} />
              </div>
              {(g.item.key !== undefined || g.item.keyNote) && (
                <div className="mt-0.5 pl-1 text-xs text-slate-400">
                  {g.item.key !== undefined && <>Key: {Array.isArray(g.item.key) ? g.item.key.join(', ') : g.item.key}. </>}
                  {g.item.keyNote}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
