import type { CoreDayConfig, Profile, ScheduleDay, ScheduleExtension } from '../types'

/**
 * SCHED-1 — the "Core Day v1" template. PURE: no React, no storage.
 *
 * The template CONTENT is canonical here and identical for all five girls; the
 * only editable knob is which day-pair Writing takes (Spelling takes the other),
 * stored as AppState.coreDay. Per-girl additions live in Profile.scheduleExtensions.
 * Parent Hub only — nothing here feeds a student-facing surface.
 */

export const SCHEDULE_DAYS: readonly ScheduleDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

/** Default alternation: Writing Mon/Wed, Spelling Tue/Thu. */
export const DEFAULT_CORE_DAY: CoreDayConfig = { writingDays: 'writing-mw' }

/** Friday's flex block rotates through these, one per calendar week. */
export const FLEX_ROTATION = [
  'Library',
  'Art',
  'Nature walk',
  'Field trip',
  'Catch-up',
] as const

export interface CoreDayBlock {
  /** 24h 'HH:MM' */
  start: string
  /** 24h 'HH:MM' */
  end: string
  label: string
  kind: 'core' | 'break' | 'flex' | 'extension'
  note?: string
}

/** The 10:15 slot's subject for a day, or null on Friday (flex takes the slot). */
export function writingOrSpelling(
  day: ScheduleDay,
  config: CoreDayConfig,
): 'Writing' | 'Spelling' | null {
  if (day === 'Fri') return null
  const writingPair = config.writingDays === 'writing-mw' ? ['Mon', 'Wed'] : ['Tue', 'Thu']
  return writingPair.includes(day) ? 'Writing' : 'Spelling'
}

// Monday 2026-01-05 anchors the flex rotation so every device agrees on the week.
const FLEX_EPOCH_MONDAY = Date.UTC(2026, 0, 5)

/** 0-based week index of the week containing `iso` (local-date safe: whole days). */
export function flexWeekIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const dayUTC = Date.UTC(y, m - 1, d)
  const dow = new Date(dayUTC).getUTCDay() // Sun=0 … Sat=6
  const mondayUTC = dayUTC - ((dow + 6) % 7) * 86_400_000
  return Math.round((mondayUTC - FLEX_EPOCH_MONDAY) / (7 * 86_400_000))
}

export function flexActivityForWeek(weekIndex: number): string {
  const n = FLEX_ROTATION.length
  return FLEX_ROTATION[((weekIndex % n) + n) % n]
}

/**
 * The shared Core Day blocks for one day. Mon–Thu: Writing/Spelling alternate in
 * the 10:15 slot and Science (Mon/Wed) / Social Studies (Tue/Thu) follow; Friday
 * replaces both subject slots with the rotating flex block. Math, Reading, Break,
 * and the shared read-aloud run all five days.
 */
export function coreDayBlocks(
  day: ScheduleDay,
  config: CoreDayConfig,
  flexActivity: string,
): CoreDayBlock[] {
  const blocks: CoreDayBlock[] = [
    { start: '09:00', end: '09:30', label: 'Math', kind: 'core', note: 'daily, non-negotiable' },
    { start: '09:30', end: '10:00', label: 'Reading', kind: 'core', note: 'read-aloud + independent' },
    { start: '10:00', end: '10:15', label: 'Break / movement', kind: 'break' },
  ]
  if (day === 'Fri') {
    blocks.push({
      start: '10:15',
      end: '11:15',
      label: `Flex: ${flexActivity}`,
      kind: 'flex',
      note: 'rotates weekly',
    })
  } else {
    blocks.push({
      start: '10:15',
      end: '10:45',
      label: writingOrSpelling(day, config) as string,
      kind: 'core',
      note: 'alternating days',
    })
    blocks.push({
      start: '10:45',
      end: '11:15',
      label: day === 'Mon' || day === 'Wed' ? 'Science' : 'Social Studies',
      kind: 'core',
    })
  }
  blocks.push({ start: '11:15', end: '11:30', label: 'Shared read-aloud', kind: 'core' })
  return blocks
}

/** One girl's full day: the shared Core Day plus her extension blocks, by start time. */
export function blocksForProfileDay(
  profile: Profile,
  day: ScheduleDay,
  config: CoreDayConfig,
  flexActivity: string,
): CoreDayBlock[] {
  const extensions = (profile.scheduleExtensions ?? [])
    .filter((ext) => ext.days.includes(day))
    .map(
      (ext): CoreDayBlock => ({
        start: ext.start,
        end: ext.end,
        label: ext.label,
        kind: 'extension',
      }),
    )
  return [...coreDayBlocks(day, config, flexActivity), ...extensions].sort((a, b) =>
    a.start.localeCompare(b.start),
  )
}

// mirrors the sync validator's TIME_HHMM (src/sync/provenance.ts)
const TIME_HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/
export const MAX_EXTENSION_LABEL = 120

/**
 * The Add-block form gate. Everything the sync validator would reject must be
 * rejected HERE: a stored invalid extension fails validateAppStateForSync, which
 * silently halts ALL household persistence (saveAppState swallows the failure).
 */
export function canAddExtension(
  label: string,
  days: readonly ScheduleDay[],
  start: string,
  end: string,
): boolean {
  return (
    label.trim().length > 0 &&
    label.length <= MAX_EXTENSION_LABEL &&
    days.length > 0 &&
    TIME_HHMM.test(start) &&
    TIME_HHMM.test(end) &&
    start < end
  )
}

const newExtensionId = () =>
  `sx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/** Add one extension block to a girl. Returns a new profile object. */
export function addExtension(
  p: Profile,
  ext: Omit<ScheduleExtension, 'id'>,
): Profile {
  const entry: ScheduleExtension = { id: newExtensionId(), ...ext }
  return { ...p, scheduleExtensions: [...(p.scheduleExtensions ?? []), entry] }
}

/** Remove an extension block by id. Unknown ids are a no-op. */
export function removeExtension(p: Profile, id: string): Profile {
  const kept = (p.scheduleExtensions ?? []).filter((ext) => ext.id !== id)
  return { ...p, scheduleExtensions: kept }
}
