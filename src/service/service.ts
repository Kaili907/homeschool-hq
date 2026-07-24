import type { ISODate, Profile, ServiceEntry } from '../types'

// ============================================================================
// SE-B service hours (SE card #12), teens only. The teen logs date / org /
// hours / note on her home; Dad's approval checkbox in the Grown-Ups panel LOCKS
// an entry (approved entries are read-only to her and count as "official"). YTD
// total + CSV export drop straight into college applications. Self-contained.
// ============================================================================

let seq = 0
function newId(): string {
  seq += 1
  return `sv-${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function getServiceLog(p: Profile): ServiceEntry[] {
  return p.serviceLog ?? []
}

export interface ServiceInput {
  date: ISODate
  org: string
  hours: number
  note: string
}

export interface ServiceResult {
  ok: boolean
  profile: Profile
  error?: string
}

/** Add a new (unapproved) entry after validating it. */
export function addServiceEntry(
  p: Profile,
  input: ServiceInput,
  now: string = new Date().toISOString(),
): ServiceResult {
  const org = input.org.trim()
  const note = input.note.trim()
  if (!input.date) return { ok: false, profile: p, error: 'Pick a date.' }
  if (!org) return { ok: false, profile: p, error: 'Enter the organization.' }
  if (!(input.hours > 0)) return { ok: false, profile: p, error: 'Hours must be greater than 0.' }
  const entry: ServiceEntry = {
    id: newId(),
    date: input.date,
    org,
    hours: input.hours,
    note,
    approved: false,
    createdAt: now,
  }
  return { ok: true, profile: { ...p, serviceLog: [...getServiceLog(p), entry] } }
}

/** Dad sets an entry's approval (true = locked/official, false = unlocked for edits). */
export function setServiceApproved(p: Profile, id: string, approved: boolean): Profile {
  const log = getServiceLog(p)
  if (!log.some((e) => e.id === id)) return p
  return {
    ...p,
    serviceLog: log.map((e) => (e.id === id ? { ...e, approved } : e)),
  }
}

/**
 * Remove an entry. Approved (locked) entries are protected — Dad must unapprove
 * first — so an official record can't be silently deleted from the teen's side.
 */
export function deleteServiceEntry(p: Profile, id: string): ServiceResult {
  const log = getServiceLog(p)
  const entry = log.find((e) => e.id === id)
  if (!entry) return { ok: true, profile: p }
  if (entry.approved) {
    return { ok: false, profile: p, error: 'That entry is approved and locked. Ask Dad to unlock it first.' }
  }
  return { ok: true, profile: { ...p, serviceLog: log.filter((e) => e.id !== id) } }
}

// ---------- totals ----------

export interface ServiceTotals {
  /** hours across every entry (logged, pending + approved). */
  total: number
  /** hours from approved (official) entries only — the college-application number. */
  approved: number
  count: number
  pending: number
}

function inSchoolYear(date: ISODate, asOf: ISODate): boolean {
  const [y, m] = asOf.split('-').map(Number)
  const startYear = m >= 8 ? y : y - 1
  return date >= `${startYear}-08-01` && date <= asOf
}

const round1 = (h: number) => Math.round(h * 10) / 10

/** Year-to-date totals (homeschool year rolls over Aug 1, like attendance). */
export function serviceYtd(entries: ServiceEntry[], asOf: ISODate): ServiceTotals {
  const ytd = entries.filter((e) => inSchoolYear(e.date, asOf))
  const approvedRows = ytd.filter((e) => e.approved)
  return {
    total: round1(ytd.reduce((n, e) => n + e.hours, 0)),
    approved: round1(approvedRows.reduce((n, e) => n + e.hours, 0)),
    count: ytd.length,
    pending: ytd.length - approvedRows.length,
  }
}

/** Entries sorted most-recent date first (display order). */
export function sortedService(entries: ServiceEntry[]): ServiceEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

// ---------- CSV export ----------

const csvField = (v: string | number | boolean): string => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Service CSV: date, org, hours, approved, note — sorted by date. */
export function serviceCsv(entries: ServiceEntry[]): string {
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const header = 'date,org,hours,approved,note'
  const lines = rows.map((e) =>
    [e.date, e.org, e.hours, e.approved ? 'yes' : 'no', e.note].map(csvField).join(','),
  )
  return [header, ...lines].join('\n')
}
