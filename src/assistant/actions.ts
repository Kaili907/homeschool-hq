import type { ISODate, Profile } from '../types'
import { GEOMETRY_UNITS, ALGEBRA_TOPICS } from '../hs/hsCatalog'
import { sortedCollegeTasks } from '../hs/hsState'

/**
 * MJ HS-assistant — the confirmable action layer.
 *
 * The assistant may PROPOSE exactly the actions in the catalog below; each requires
 * an explicit Confirm tap before it executes (the executor lives in the UI and is
 * gated on that tap — nothing here mutates state). Every catalog entry is derived
 * from HER OWN data, so the model can only ever propose acting on her real items.
 *
 * Protocol: the model may append at most one line `ACTION: <key>` using a key from
 * the catalog. `parseAction` strips that line from the spoken/shown text and returns
 * the matched action (if any) for the UI to render as a confirm chip.
 */

export type AssistantActionKind = 'check_mission' | 'mark_college_task' | 'start_session'

export interface AssistantAction {
  /** catalog key the model references, e.g. 'mission:read-self', 'unit:angles', 'timed:mixed'. */
  key: string
  kind: AssistantActionKind
  /** confirm-chip + transcript label, e.g. 'Check off "Read 20 minutes"'. */
  label: string
  /** target for the executor: mission itemId / college taskId / session descriptor. */
  target: string
}

/** Session descriptors the start_session executor understands. */
export type SessionTarget =
  | { kind: 'unit'; unitId: string }
  | { kind: 'algebra' }
  | { kind: 'timed'; source: 'geometry' | 'algebra' | 'mixed' }

/** Parse a start_session target string ('unit:angles' | 'algebra' | 'timed:mixed'). */
export function parseSessionTarget(target: string): SessionTarget | null {
  if (target === 'algebra') return { kind: 'algebra' }
  if (target.startsWith('unit:')) return { kind: 'unit', unitId: target.slice(5) }
  if (target.startsWith('timed:')) {
    const source = target.slice(6)
    if (source === 'geometry' || source === 'algebra' || source === 'mixed') return { kind: 'timed', source }
  }
  return null
}

/**
 * Build the action catalog from HER profile. Only incomplete mission items and
 * incomplete college tasks are offered (checking off a done item is a no-op), plus
 * the startable teen sessions (geometry units, algebra warm-up, timed quizzes).
 */
export function buildActionCatalog(profile: Profile, today: ISODate): AssistantAction[] {
  const out: AssistantAction[] = []

  for (const item of profile.missions[today]?.items ?? []) {
    if (item.done) continue
    out.push({
      key: `mission:${item.id}`,
      kind: 'check_mission',
      label: `Check off "${item.label}"`,
      target: item.id,
    })
  }

  if (profile.grade === '12') {
    for (const { task } of sortedCollegeTasks(profile.collegeTasks ?? [], today)) {
      if (task.done) continue
      out.push({
        key: `college:${task.id}`,
        kind: 'mark_college_task',
        label: `Mark done: ${task.label}`,
        target: task.id,
      })
    }
  }

  for (const u of GEOMETRY_UNITS) {
    out.push({
      key: `unit:${u.id}`,
      kind: 'start_session',
      label: `Start practice: ${u.name}`,
      target: `unit:${u.id}`,
    })
  }
  out.push({ key: 'algebra', kind: 'start_session', label: 'Start Algebra I warm-up', target: 'algebra' })
  for (const source of ['geometry', 'algebra', 'mixed'] as const) {
    out.push({
      key: `timed:${source}`,
      kind: 'start_session',
      label: `Start timed quiz (${source})`,
      target: `timed:${source}`,
    })
  }

  return out
}

/** A compact catalog listing for the system prompt (key → what it does). */
export function renderActionCatalog(catalog: AssistantAction[]): string {
  if (catalog.length === 0) return '(no actions available right now)'
  return catalog.map((a) => `- ${a.key} → ${a.label}`).join('\n')
}

const ACTION_LINE = /^\s*ACTION:?\s+(\S+)\s*$/im

/**
 * Split a model reply into the displayed/spoken text and an optional proposed
 * action. Only a key present in `catalog` matches; anything else is ignored and the
 * line stripped, so a hallucinated action can never reach the executor. The action
 * still requires a Confirm tap in the UI — parsing never executes anything.
 */
export function parseAction(
  reply: string,
  catalog: AssistantAction[],
): { text: string; action?: AssistantAction } {
  const m = ACTION_LINE.exec(reply)
  // Always strip any ACTION line from what she sees/hears, matched or not.
  const text = reply.replace(ACTION_LINE, '').replace(/\n{3,}/g, '\n\n').trim()
  if (!m) return { text }
  const key = m[1].replace(/[.,;]+$/, '')
  const action = catalog.find((a) => a.key === key)
  return action ? { text, action } : { text }
}

// ---------- executor descriptor (UI performs the actual mutation on confirm) ----------

/** The transcript-facing record fields for a confirmed action (executor fills ts). */
export function actionLogLabel(action: AssistantAction): string {
  switch (action.kind) {
    case 'check_mission':
      return `✓ ${action.label}`
    case 'mark_college_task':
      return `✓ ${action.label}`
    case 'start_session':
      return `▶ ${action.label}`
  }
}
