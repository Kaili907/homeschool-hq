import type {
  ActivityCategory,
  IsoDate,
  RecoveryChoice,
  RecoveryChoiceMetadata,
  RecoveryTrigger,
  RiskLevel,
  SchedulePlacement,
  WorkloadDay,
} from './types'

export const RECOVERY_CHOICES: readonly RecoveryChoiceMetadata[] = [
  {
    id: 'move-to-tomorrow',
    label: 'Move to tomorrow',
    shortLabel: 'Tomorrow',
    description: 'Move the remaining work only when tomorrow stays within its workload limit.',
  },
  {
    id: 'shorten-today',
    label: "Shorten today's remaining work",
    shortLabel: 'Shorten today',
    description: 'Keep the essential part today and preserve the rest for a parent-approved plan.',
  },
  {
    id: 'split-sessions',
    label: 'Split into multiple sessions',
    shortLabel: 'Split sessions',
    description: 'Use smaller focus-sized blocks with recovery breaks between them.',
  },
  {
    id: 'move-to-catch-up-block',
    label: 'Move into a catch-up block',
    shortLabel: 'Catch-up block',
    description: 'Use protected catch-up capacity without displacing meals or locked events.',
  },
  {
    id: 'replace-lower-priority-review',
    label: 'Replace lower-priority review',
    shortLabel: 'Replace review',
    description: 'Swap a movable review block; required work is never removed automatically.',
  },
  {
    id: 'keep-due-date-rebalance-week',
    label: 'Keep the due date and rebalance the week',
    shortLabel: 'Rebalance week',
    description: 'Spread work across remaining days while honoring each daily limit.',
  },
  {
    id: 'parent-manual',
    label: 'Parent chooses manually',
    shortLabel: 'Choose manually',
    description: 'Set a date, start time, duration, and reason yourself.',
  },
  {
    id: 'leave-unchanged',
    label: 'Leave unchanged',
    shortLabel: 'No change',
    description: 'Keep the current calendar exactly as it is.',
  },
] as const

export const activityCategoryLabels: Record<ActivityCategory, string> = {
  'academic-assignment': 'Academic assignment',
  'romeo-virtual-academy': 'Romeo Virtual Academy',
  'manuel-academy-lesson': 'Manuel Academy lesson',
  'adaptive-tutor-intervention': 'Adaptive tutor support',
  'ready-for-life': 'Ready for Life',
  wrestling: 'Wrestling',
  'jiu-jitsu': 'Jiu-jitsu',
  'weight-training': 'Weight training',
  'pe-activity': 'PE activity',
  appointment: 'Appointment',
  meal: 'Meal',
  'movement-break': 'Movement break',
  'focus-recovery-break': 'Focus-recovery break',
  'parent-created-activity': 'Parent-created activity',
}

export const triggerLabels: Record<RecoveryTrigger, string> = {
  missed: 'Missed work',
  interrupted: 'Interrupted work',
  shortened: 'Shortened session',
  overdue: 'Overdue work',
  'focus-difficulty': 'Focus support requested',
}

export const riskLabels: Record<RiskLevel, string> = {
  low: 'Low',
  medium: 'Watch',
  high: 'High',
  critical: 'Urgent',
}

export function recoveryChoiceMetadata(
  choice: RecoveryChoice,
): RecoveryChoiceMetadata {
  const metadata = RECOVERY_CHOICES.find((item) => item.id === choice)
  if (!metadata) {
    return {
      id: choice,
      label: choice,
      shortLabel: choice,
      description: '',
    }
  }
  return metadata
}

export function formatDate(date: IsoDate, options?: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(new Date(year, month - 1, day, 12))
}

export function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2026, 0, 1, hours, minutes))
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`
}

export function formatPlacement(placement: SchedulePlacement): string {
  return `${formatDate(placement.date, { weekday: 'short' })}, ${formatTime(placement.startTime)} · ${formatMinutes(placement.durationMinutes)}`
}

export function workloadState(
  day: WorkloadDay,
): 'comfortable' | 'near-limit' | 'at-limit' | 'over-limit' {
  if (day.proposedMinutes > day.limitMinutes) return 'over-limit'
  if (day.proposedMinutes === day.limitMinutes) return 'at-limit'
  if (day.proposedMinutes / day.limitMinutes >= 0.85) return 'near-limit'
  return 'comfortable'
}

export function signedMinutes(value: number): string {
  if (value === 0) return 'no change'
  return `${value > 0 ? '+' : '−'}${Math.abs(value)} min`
}
