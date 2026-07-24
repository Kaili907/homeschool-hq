import type { Profile } from '../types'
import { MINDSET_WEEKS } from './content'
import { mindsetBand } from './mindset'

/**
 * MM — the girl's PRIVATE journal/reflection text (journal entries AND the littles'
 * emoji/one-word answers). Kept in its OWN localStorage slot, OUTSIDE AppState, on
 * the pattern the voice key already uses ("NEVER in AppState → never exported").
 *
 * This is a STRUCTURAL privacy guarantee, not a procedural one: because the text is
 * never part of AppState, it cannot reach the Grown-Ups panel, the standard export,
 * or the Supabase sync payload by ANY code path — those all serialize AppState.
 * Only completion signals (viewed / reflected / completedAt) live in Profile.mindset
 * and sync normally, so Dad's panel and the parent hub still work across devices.
 *
 * Tradeoff (accepted): a lost or wiped device loses any entries she never exported.
 */

const JOURNAL_LS = 'homeschool-hq:mindset-journal:v1'

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** profileId → week → reflection text. */
type JournalMap = Record<string, Record<string, string>>

function readAll(): JournalMap {
  const s = ls()
  if (!s) return {}
  try {
    const raw = s.getItem(JOURNAL_LS)
    const parsed = raw ? (JSON.parse(raw) as unknown) : {}
    return parsed && typeof parsed === 'object' ? (parsed as JournalMap) : {}
  } catch {
    return {}
  }
}

function writeAll(m: JournalMap): void {
  const s = ls()
  if (!s) return
  try {
    s.setItem(JOURNAL_LS, JSON.stringify(m))
  } catch {
    /* best-effort — a full/again-unavailable store just means no persistence */
  }
}

/** Her saved reflection for one week ('' when none). */
export function getJournalText(profileId: string, week: number): string {
  return readAll()[profileId]?.[String(week)] ?? ''
}

/** Save (or clear, when text is empty) one week's reflection. Autosave calls this. */
export function setJournalText(profileId: string, week: number, text: string): void {
  const m = readAll()
  const forProfile = { ...(m[profileId] ?? {}) }
  if (text) forProfile[String(week)] = text
  else delete forProfile[String(week)]
  if (Object.keys(forProfile).length) m[profileId] = forProfile
  else delete m[profileId]
  writeAll(m)
}

/** Wipe one girl's journal entirely (used by "Reset progress"). */
export function clearJournal(profileId: string): void {
  const m = readAll()
  if (!(profileId in m)) return
  delete m[profileId]
  writeAll(m)
}

/**
 * Serialize THIS girl's journal, text included — reading the LOCAL store. Called only
 * from inside her own signed-in mindset view. This is the one place her text appears.
 */
export function serializeMyJournal(profile: Profile): string {
  const band = mindsetBand(profile)
  const entries = MINDSET_WEEKS.map((w) => {
    const reflection = getJournalText(profile.id, w.week)
    const prompt = band === 'littles' ? w.reflectLittles.prompt : w.reflect[0]
    return { week: w.week, title: w.title, prompt, reflection }
  }).filter((e) => e.reflection.trim() !== '')
  return JSON.stringify({ profile: profile.name, kind: 'mindset-journal', entries }, null, 2)
}
