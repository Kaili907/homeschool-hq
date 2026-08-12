import type { StudentReport } from './types'

/**
 * Plain-text and CSV rendering of an already-built report. Both walk only
 * the typed report fields, so there is no path for raw learner content to
 * reach either output.
 */

function periodLabel(report: StudentReport): string {
  return 'date' in report ? report.date : `${report.startDate} to ${report.endDate}`
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`
}

export function reportToPrintableText(report: StudentReport): string {
  const lines = [
    `${report.displayName} — ${periodLabel(report)}`,
    `Assignments started: ${report.assignmentsStarted}`,
    `Assignments completed: ${report.assignmentsCompleted}`,
    `Lessons completed: ${report.lessonsCompleted}`,
    `Currently working on: ${report.currentLesson ?? 'Nothing in progress'}${report.currentSegment ? ` (${report.currentSegment})` : ''}`,
    `Study time recorded: ${report.timeOnTaskSeconds !== null ? formatSeconds(report.timeOnTaskSeconds) : 'Not recorded'}`,
    `Open work: ${report.openWorkCount} (${report.pausedWorkCount} paused)`,
    `Completion: ${report.completionPercent !== null ? `${report.completionPercent}%` : 'No work scheduled'}`,
    `Needs attention: ${report.itemsNeedingParentAttention.length}`,
  ]
  for (const item of report.itemsNeedingParentAttention) {
    if (item.kind === 'paused-work') {
      lines.push(`  - Paused: ${item.title}`)
    } else {
      lines.push(`  - Review needed (due ${item.dueDate}): ${(item.reasonCodes ?? []).join(', ')}`)
    }
  }
  return lines.join('\n')
}

const CSV_COLUMNS = [
  'learnerRef',
  'displayName',
  'period',
  'assignmentsStarted',
  'assignmentsCompleted',
  'lessonsCompleted',
  'currentLesson',
  'currentSegment',
  'timeOnTaskSeconds',
  'openWorkCount',
  'pausedWorkCount',
  'completionPercent',
  'itemsNeedingParentAttentionCount',
] as const

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function csvRowFor(report: StudentReport): string {
  const values = [
    report.learnerRef,
    report.displayName,
    periodLabel(report),
    String(report.assignmentsStarted),
    String(report.assignmentsCompleted),
    String(report.lessonsCompleted),
    report.currentLesson ?? '',
    report.currentSegment ?? '',
    report.timeOnTaskSeconds !== null ? String(report.timeOnTaskSeconds) : '',
    String(report.openWorkCount),
    String(report.pausedWorkCount),
    report.completionPercent !== null ? String(report.completionPercent) : '',
    String(report.itemsNeedingParentAttention.length),
  ]
  return values.map(csvEscape).join(',')
}

export function reportToCsv(reports: StudentReport | readonly StudentReport[]): string {
  const list = Array.isArray(reports) ? reports : [reports]
  return [CSV_COLUMNS.join(','), ...list.map(csvRowFor)].join('\n')
}
