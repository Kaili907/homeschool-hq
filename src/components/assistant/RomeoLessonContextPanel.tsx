import { useEffect, useState } from 'react'
import {
  EXTERNAL_LESSON_TEXT_LIMIT,
  createExternalLessonContext,
  type ExternalLessonContext,
  type ExternalLessonPageKind,
} from '../../assistant/externalLessonContext'

interface Props {
  disabled?: boolean
  onContextChange: (context: ExternalLessonContext | undefined) => void
}

const PAGE_KINDS: { value: ExternalLessonPageKind; label: string }[] = [
  { value: 'unknown', label: 'Not sure — treat as graded' },
  { value: 'instruction', label: 'Lesson or instruction' },
  { value: 'practice', label: 'Practice' },
  { value: 'homework', label: 'Homework' },
  { value: 'quiz', label: 'Quiz or unit check' },
  { value: 'test', label: 'Test or exam' },
]

/**
 * Manual Phase-1 bridge for Romeo content. Values live only in this mounted Jarvis
 * panel; they are never written to Profile/localStorage or the assistant transcript.
 */
export function RomeoLessonContextPanel({ disabled = false, onContextChange }: Props) {
  const [open, setOpen] = useState(false)
  const [courseLabel, setCourseLabel] = useState('')
  const [assignmentLabel, setAssignmentLabel] = useState('')
  const [pageKind, setPageKind] = useState<ExternalLessonPageKind>('unknown')
  const [visibleText, setVisibleText] = useState('')

  const attached = Boolean(courseLabel.trim() || assignmentLabel.trim() || visibleText.trim())

  useEffect(() => {
    onContextChange(
      createExternalLessonContext({
        capturedAt: new Date().toISOString(),
        courseLabel,
        assignmentLabel,
        visibleText,
        pageKind,
      }),
    )
  }, [assignmentLabel, courseLabel, onContextChange, pageKind, visibleText])

  const clear = () => {
    setCourseLabel('')
    setAssignmentLabel('')
    setPageKind('unknown')
    setVisibleText('')
    onContextChange(undefined)
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span aria-hidden>🏫</span>
        <span className="text-sm font-bold text-slate-800">Romeo lesson context</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${
            attached ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {attached ? 'attached this session' : 'optional'}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-200 px-3 py-3">
          <p className="text-xs font-medium text-slate-600">
            Paste only the lesson title or directions Jarvis needs. This is session-only and is not saved to the
            student profile. Never paste passwords, recovery codes, student IDs, grades, or private messages.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">
              Course
              <input
                value={courseLabel}
                onChange={(event) => setCourseLabel(event.target.value)}
                placeholder="Example: Algebra II"
                disabled={disabled}
                maxLength={160}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-800"
              />
            </label>
            <label className="text-xs font-bold text-slate-600">
              Lesson or assignment
              <input
                value={assignmentLabel}
                onChange={(event) => setAssignmentLabel(event.target.value)}
                placeholder="Example: Solving systems"
                disabled={disabled}
                maxLength={160}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-800"
              />
            </label>
          </div>

          <label className="block text-xs font-bold text-slate-600">
            Page type
            <select
              value={pageKind}
              onChange={(event) => setPageKind(event.target.value as ExternalLessonPageKind)}
              disabled={disabled}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-800"
            >
              {PAGE_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-bold text-slate-600">
            Visible lesson text or directions
            <textarea
              value={visibleText}
              onChange={(event) => setVisibleText(event.target.value)}
              placeholder="Paste the relevant directions or lesson explanation — not login information."
              disabled={disabled}
              maxLength={EXTERNAL_LESSON_TEXT_LIMIT}
              rows={5}
              className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-800"
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500">
              Unknown, quiz, and test pages are handled as possible graded assessments.
            </span>
            <button
              type="button"
              onClick={clear}
              disabled={disabled || !attached}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
