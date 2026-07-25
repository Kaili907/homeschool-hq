import { SCHEMA_VERSION } from '../migration'
import type { AppState, Profile } from '../types'
import type { HouseholdSyncMeta } from './types'

export const APP_STATE_STORAGE_KEY = 'homeschool-hq:app:v2'
export const DATASET_WRITE_LOCK_NAME = 'academy-sync-persisted-dataset'
export const DATASET_FINGERPRINT_VERSION = 'sha256-v2'
export const DATASET_PROVENANCE_STORAGE_KEY =
  'homeschool-hq:sync:dataset-provenance:v1'

const MAX_CANONICAL_DEPTH = 128
const MAX_CANONICAL_NODES = 500_000
const MAX_SYNC_ARRAY_ITEMS = 50_000
const MAX_SYNC_RECORD_ENTRIES = 50_000
const MAX_SYNC_STRING_LENGTH = 1_000_000
const GRADES = new Set(['3', '4', '6', '10', '12'])
const THEMES = new Set(['playful', 'cool', 'clean'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const STAR_SOURCES = new Set([
  'practice-session',
  'accuracy-bonus',
  'tutor-retry',
  'mission-complete',
  'weekly-streak',
  'manual-grant',
  'redeem',
])

export interface ImportTransitionRecord {
  operationId: string
  previousFingerprint: string | null
  phase: 'invalidated' | 'state-written' | 'review'
  reason: string
  startedAt: number
}

export interface DatasetProvenanceRecord {
  version: 1
  importEpoch: string
  fingerprint: string | null
  importTransition: ImportTransitionRecord | null
  updatedAt: number
}

export type PersistedDataset =
  | { ok: true; state: AppState; fingerprint: string }
  | { ok: false; error: string }

export type AppStateValidation =
  | { ok: true; state: AppState }
  | { ok: false; error: string }

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function text(value: unknown, max = MAX_SYNC_STRING_LENGTH): value is string {
  return typeof value === 'string' && value.length <= max
}

function identifier(value: unknown): value is string {
  return text(value, 512) && value.length > 0
}

function isoDate(value: unknown, allowEmpty = false): value is string {
  return (
    text(value, 32) &&
    ((allowEmpty && value === '') ||
      (ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))))
  )
}

function timestamp(value: unknown): value is string {
  return (
    text(value, 64) &&
    value.length > 0 &&
    !Number.isNaN(Date.parse(value))
  )
}

function optional(
  value: unknown,
  validate: (candidate: unknown) => boolean,
): boolean {
  return value === undefined || validate(value)
}

function boundedArray(
  value: unknown,
  validate: (candidate: unknown) => boolean,
  max = MAX_SYNC_ARRAY_ITEMS,
): boolean {
  return (
    Array.isArray(value) &&
    value.length <= max &&
    value.every((candidate) => validate(candidate))
  )
}

function boundedRecord(
  value: unknown,
  validate: (candidate: unknown, key: string) => boolean,
): boolean {
  if (!plainRecord(value)) return false
  const entries = Object.entries(value)
  return (
    entries.length <= MAX_SYNC_RECORD_ENTRIES &&
    entries.every(([key, candidate]) => validate(candidate, key))
  )
}

function validateSkillRecord(value: unknown): boolean {
  return boundedRecord(
    value,
    (skill) =>
      plainRecord(skill) &&
      finiteNumber(skill.attempts) &&
      finiteNumber(skill.correct) &&
      finiteNumber(skill.mastery) &&
      optional(skill.lastSeen, isoDate),
  )
}

function validateMissionRecord(value: unknown): boolean {
  return boundedRecord(
    value,
    (day, date) =>
      isoDate(date) &&
      plainRecord(day) &&
      boundedArray(
        day.items,
        (item) =>
          plainRecord(item) &&
          identifier(item.id) &&
          text(item.label) &&
          typeof item.done === 'boolean' &&
          optional(item.auto, (candidate) => typeof candidate === 'boolean') &&
          optional(
            item.autoKind,
            (candidate) =>
              candidate === 'math' ||
              candidate === 'typing' ||
              candidate === 'reading' ||
              candidate === 'mindset',
          ),
      ),
  )
}

function validateMissionTemplateItem(value: unknown): boolean {
  return (
    plainRecord(value) &&
    identifier(value.id) &&
    text(value.label) &&
    optional(value.auto, (candidate) => typeof candidate === 'boolean') &&
    optional(
      value.autoKind,
      (candidate) =>
        candidate === 'math' ||
        candidate === 'typing' ||
        candidate === 'reading' ||
        candidate === 'mindset',
    ) &&
    optional(value.days, (candidate) =>
      boundedArray(
        candidate,
        (day) =>
          finiteNumber(day) &&
          Number.isInteger(day) &&
          day >= 1 &&
          day <= 5,
        5,
      ),
    ) &&
    optional(value.weeklyOnce, (candidate) => typeof candidate === 'boolean') &&
    optional(value.season, (candidate) => candidate === 'fall')
  )
}

function validateMissionTemplate(value: unknown): boolean {
  return (
    plainRecord(value) &&
    boundedArray(value.weekday, validateMissionTemplateItem) &&
    boundedArray(value.friday, validateMissionTemplateItem)
  )
}

function validateAssessments(value: unknown): boolean {
  if (!plainRecord(value)) return false
  const assigned = boundedArray(
    value.assigned,
    (assignment) =>
      plainRecord(assignment) &&
      identifier(assignment.testId) &&
      text(assignment.startCode, 512) &&
      timestamp(assignment.assignedAt),
  )
  const attempts = boundedArray(
    value.attempts,
    (attempt) =>
      plainRecord(attempt) &&
      identifier(attempt.testId) &&
      identifier(attempt.profileId) &&
      timestamp(attempt.startedAt) &&
      optional(attempt.finishedAt, timestamp) &&
      boundedRecord(
        attempt.answers,
        (answer) =>
          plainRecord(answer) &&
          text(answer.value) &&
          typeof answer.skipped === 'boolean' &&
          finiteNumber(answer.msOnItem),
      ) &&
      optional(
        attempt.autoScore,
        (score) =>
          plainRecord(score) &&
          boundedRecord(
            score.bySection,
            (section) =>
              plainRecord(section) &&
              finiteNumber(section.correct) &&
              finiteNumber(section.of),
          ) &&
          finiteNumber(score.gradedItems) &&
          finiteNumber(score.skips),
      ),
  )
  return (
    assigned &&
    attempts &&
    optional(value.retakeUnlocked, (candidate) =>
      boundedArray(candidate, identifier),
    )
  )
}

function validateCourses(value: unknown): boolean {
  return boundedArray(
    value,
    (course) =>
      plainRecord(course) &&
      identifier(course.id) &&
      text(course.name) &&
      boundedArray(
        course.units,
        (unit) =>
          plainRecord(unit) &&
          identifier(unit.id) &&
          text(unit.label) &&
          typeof unit.done === 'boolean',
      ),
  )
}

function validateStars(value: unknown): boolean {
  return (
    plainRecord(value) &&
    finiteNumber(value.balance) &&
    finiteNumber(value.lifetimeEarned) &&
    boundedArray(
      value.ledger,
      (entry) =>
        plainRecord(entry) &&
        identifier(entry.id) &&
        timestamp(entry.at) &&
        isoDate(entry.day) &&
        finiteNumber(entry.amount) &&
        text(entry.reason) &&
        typeof entry.source === 'string' &&
        STAR_SOURCES.has(entry.source),
    ) &&
    boundedArray(
      value.pendingRedemptions,
      (entry) =>
        plainRecord(entry) &&
        identifier(entry.id) &&
        identifier(entry.prizeId) &&
        text(entry.name) &&
        text(entry.emoji, 64) &&
        finiteNumber(entry.cost) &&
        timestamp(entry.requestedAt),
    )
  )
}

function validateTutorPrefs(value: unknown): boolean {
  return (
    plainRecord(value) &&
    optional(value.voiceURI, text) &&
    optional(value.rate, finiteNumber) &&
    optional(value.voiceOptIn, (candidate) => typeof candidate === 'boolean') &&
    optional(value.voiceMap, (candidate) =>
      boundedRecord(
        candidate,
        (voice) =>
          plainRecord(voice) &&
          (voice.provider === 'elevenlabs' || voice.provider === 'browser') &&
          text(voice.ref) &&
          text(voice.label),
      ),
    )
  )
}

function validateTyping(value: unknown): boolean {
  return (
    plainRecord(value) &&
    finiteNumber(value.unlockedIndex) &&
    finiteNumber(value.drillsCompleted) &&
    optional(value.lastPracticedDate, isoDate) &&
    boundedRecord(
      value.lessons,
      (lesson) =>
        plainRecord(lesson) &&
        finiteNumber(lesson.bestAccuracy) &&
        finiteNumber(lesson.bestWpm) &&
        typeof lesson.passed === 'boolean' &&
        optional(lesson.lastSeen, isoDate),
    )
  )
}

function validateReading(value: unknown): boolean {
  return (
    plainRecord(value) &&
    boundedArray(
      value.sessions,
      (session) =>
        plainRecord(session) &&
        isoDate(session.date) &&
        identifier(session.passageId) &&
        (session.mode === 'estimated' ||
          session.mode === 'assessed' ||
          session.mode === 'manual') &&
        finiteNumber(session.wcpm) &&
        boundedArray(session.wordsPracticed, text) &&
        finiteNumber(session.durationSec),
    ) &&
    boundedArray(value.seenPassageIds, identifier) &&
    boundedArray(
      value.calibrations,
      (calibration) =>
        plainRecord(calibration) &&
        isoDate(calibration.date) &&
        optional(calibration.passageId, identifier) &&
        finiteNumber(calibration.wcpm),
    ) &&
    optional(value.lastReadDate, isoDate)
  )
}

function validateAttendance(value: unknown): boolean {
  return (
    plainRecord(value) &&
    optional(value.hoursPerDay, finiteNumber) &&
    boundedArray(
      value.log,
      (day) =>
        plainRecord(day) &&
        isoDate(day.date) &&
        finiteNumber(day.hours),
    )
  )
}

function validateTutorChats(value: unknown): boolean {
  return boundedArray(
    value,
    (chat) =>
      plainRecord(chat) &&
      identifier(chat.id) &&
      identifier(chat.skillId) &&
      GRADES.has(String(chat.grade)) &&
      isoDate(chat.day) &&
      finiteNumber(chat.startedTs) &&
      text(chat.problem) &&
      text(chat.correctAnswer) &&
      text(chat.herAnswer) &&
      boundedArray(
        chat.messages,
        (message) =>
          plainRecord(message) &&
          (message.role === 'kid' || message.role === 'tutor') &&
          text(message.text) &&
          finiteNumber(message.ts) &&
          optional(
            message.source,
            (source) => source === 'api' || source === 'scripted',
          ),
      ) &&
      optional(
        chat.outcome,
        (outcome) => outcome === 'flagged' || outcome === 'closed',
      ),
  )
}

function validateMindset(value: unknown): boolean {
  return (
    plainRecord(value) &&
    boundedRecord(
      value.weeks,
      (week, key) =>
        /^\d+$/.test(key) &&
        Number(key) >= 1 &&
        plainRecord(week) &&
        optional(week.viewed, (candidate) => typeof candidate === 'boolean') &&
        optional(
          week.reflected,
          (candidate) => typeof candidate === 'boolean',
        ) &&
        optional(week.completedAt, isoDate),
    )
  )
}

function validateAssistant(value: unknown): boolean {
  return (
    plainRecord(value) &&
    boundedArray(value.calls, finiteNumber) &&
    boundedArray(
      value.sessions,
      (session) =>
        plainRecord(session) &&
        identifier(session.id) &&
        isoDate(session.day) &&
        finiteNumber(session.startedTs) &&
        boundedArray(
          session.messages,
          (message) =>
            plainRecord(message) &&
            (message.role === 'girl' || message.role === 'assistant') &&
            text(message.text) &&
            finiteNumber(message.ts) &&
            optional(
              message.source,
              (source) => source === 'api' || source === 'scripted',
            ) &&
            optional(
              message.flagged,
              (candidate) => typeof candidate === 'boolean',
            ) &&
            optional(
              message.action,
              (action) =>
                plainRecord(action) &&
                (action.kind === 'check_mission' ||
                  action.kind === 'mark_college_task' ||
                  action.kind === 'start_session') &&
                text(action.label) &&
                identifier(action.targetKey) &&
                finiteNumber(action.ts),
            ),
        ),
    ) &&
    optional(value.dailyCap, finiteNumber) &&
    optional(value.name, text) &&
    optional(value.persona, text)
  )
}

function validatePacing(value: unknown): boolean {
  return (
    plainRecord(value) &&
    boundedRecord(value.pointers, finiteNumber) &&
    boundedArray(
      value.nudges,
      (nudge) =>
        plainRecord(nudge) &&
        timestamp(nudge.at) &&
        identifier(nudge.subjectId) &&
        finiteNumber(nudge.from) &&
        finiteNumber(nudge.to) &&
        text(nudge.reason),
    )
  )
}

function validateProfileOptionals(value: Record<string, unknown>): boolean {
  return (
    optional(value.template, validateMissionTemplate) &&
    optional(value.lastPracticeDate, isoDate) &&
    optional(value.assessments, validateAssessments) &&
    optional(value.hsStats, (candidate) =>
      boundedRecord(
        candidate,
        (stat) =>
          plainRecord(stat) &&
          finiteNumber(stat.attempts) &&
          finiteNumber(stat.correct) &&
          optional(stat.lastSeen, isoDate),
      ),
    ) &&
    optional(value.courses, validateCourses) &&
    optional(value.collegeTasks, (candidate) =>
      boundedArray(
        candidate,
        (task) =>
          plainRecord(task) &&
          identifier(task.id) &&
          text(task.label) &&
          isoDate(task.due, true) &&
          typeof task.done === 'boolean',
      ),
    ) &&
    optional(value.tutor, validateTutorPrefs) &&
    optional(value.tutorFlags, (candidate) =>
      boundedRecord(
        candidate,
        (flag) =>
          plainRecord(flag) &&
          isoDate(flag.since) &&
          text(flag.reason) &&
          finiteNumber(flag.sessionCount) &&
          finiteNumber(flag.weekCount),
      ),
    ) &&
    optional(value.walkthroughLog, (candidate) =>
      boundedArray(
        candidate,
        (event) =>
          plainRecord(event) &&
          identifier(event.skillId) &&
          finiteNumber(event.ts) &&
          isoDate(event.day),
      ),
    ) &&
    optional(value.stars, validateStars) &&
    optional(value.coolStars, (candidate) => typeof candidate === 'boolean') &&
    optional(value.typing, validateTyping) &&
    optional(value.reading, validateReading) &&
    optional(value.attendance, validateAttendance) &&
    optional(value.serviceLog, (candidate) =>
      boundedArray(
        candidate,
        (entry) =>
          plainRecord(entry) &&
          identifier(entry.id) &&
          isoDate(entry.date) &&
          text(entry.org) &&
          finiteNumber(entry.hours) &&
          text(entry.note) &&
          typeof entry.approved === 'boolean' &&
          timestamp(entry.createdAt),
      ),
    ) &&
    optional(value.tutorChats, validateTutorChats) &&
    optional(value.tutorCalls, (candidate) =>
      boundedArray(candidate, finiteNumber),
    ) &&
    optional(value.tutorDailyCap, finiteNumber) &&
    optional(value.mindset, validateMindset) &&
    optional(value.assistant, validateAssistant) &&
    optional(value.pacing, validatePacing) &&
    optional(value.masterySnapshots, (candidate) =>
      boundedArray(
        candidate,
        (snapshot) =>
          plainRecord(snapshot) &&
          timestamp(snapshot.at) &&
          text(snapshot.subject) &&
          finiteNumber(snapshot.level) &&
          optional(snapshot.note, text),
      ),
    )
  )
}

function validateProfile(key: string, value: unknown): value is Profile {
  if (!plainRecord(value)) return false
  return (
    value.id === key &&
    key.length > 0 &&
    text(value.name) &&
    GRADES.has(String(value.grade)) &&
    text(value.pin, 64) &&
    THEMES.has(String(value.theme)) &&
    validateSkillRecord(value.skills) &&
    validateMissionRecord(value.missions) &&
    plainRecord(value.streaks) &&
    finiteNumber(value.streaks.current) &&
    finiteNumber(value.streaks.best) &&
    isoDate(value.streaks.lastActiveDate, true) &&
    timestamp(value.createdAt) &&
    typeof value.placementDone === 'boolean' &&
    plainRecord(value.totals) &&
    finiteNumber(value.totals.questionsAnswered) &&
    finiteNumber(value.totals.correct) &&
    finiteNumber(value.totals.bestStreak) &&
    finiteNumber(value.totals.sessions) &&
    validateProfileOptionals(value)
  )
}

function validateGlobalStars(value: unknown): boolean {
  if (!plainRecord(value) || !plainRecord(value.rates)) return false
  const rates = value.rates
  return (
    boundedArray(
      value.prizes,
      (prize) =>
        plainRecord(prize) &&
        identifier(prize.id) &&
        text(prize.name) &&
        text(prize.emoji, 64) &&
        finiteNumber(prize.cost) &&
        typeof prize.active === 'boolean',
    ) &&
    [
      'practiceSession',
      'accuracyBonus',
      'tutorRetry',
      'tutorRetryDailyMax',
      'missionComplete',
      'weeklyStreak',
      'weeklyStreakThreshold',
      'dailyCap',
    ].every((key) => finiteNumber(rates[key]))
  )
}

function validateSchoolYear(value: unknown): boolean {
  return (
    plainRecord(value) &&
    isoDate(value.startDate) &&
    finiteNumber(value.totalWeeks) &&
    boundedArray(value.quarterBreaks, finiteNumber) &&
    boundedArray(value.offWeeks, isoDate)
  )
}

/**
 * Bounded validation for the synchronization provenance boundary. Optional
 * additive fields are accepted only if the complete value is JSON-compatible;
 * the required profile containers used by sync receive explicit validation.
 */
export function validateAppStateForSync(value: unknown): AppStateValidation {
  if (!plainRecord(value)) {
    return { ok: false, error: 'Stored Academy data is not an object.' }
  }
  if (value.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'Stored Academy data uses an unsupported schema version.',
    }
  }
  if (
    !plainRecord(value.profiles) ||
    !Object.entries(value.profiles).every(([key, profile]) =>
      validateProfile(key, profile),
    ) ||
    !text(value.parentPin, 64) ||
    !optional(value.tutorMuted, (candidate) => typeof candidate === 'boolean') ||
    !optional(value.stars, validateGlobalStars) ||
    !optional(value.mindsetStartDate, isoDate) ||
    !optional(value.schoolYear, validateSchoolYear) ||
    !(
      value.activeProfileId === null ||
      (typeof value.activeProfileId === 'string' &&
        Object.hasOwn(value.profiles, value.activeProfileId))
    )
  ) {
    return {
      ok: false,
      error: 'Stored Academy profile data is malformed.',
    }
  }
  try {
    canonicalSerialize(value)
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error
          ? `Stored Academy data is not safe to synchronize: ${cause.message}`
          : 'Stored Academy data is not safe to synchronize.',
    }
  }
  return { ok: true, state: value as unknown as AppState }
}

/**
 * Canonical JSON used only for provenance. Object keys use deterministic
 * UTF-16 code-unit ordering (`Array#sort` with no locale comparator); arrays
 * retain order. Undefined object properties are deliberately omitted to match
 * persisted JSON. Undefined array elements and every other non-JSON value are
 * rejected instead of silently collapsing to null.
 */
export function canonicalSerialize(value: unknown): string {
  const active = new Set<object>()
  let nodes = 0

  const visit = (child: unknown, depth: number, inArray: boolean): string => {
    nodes += 1
    if (nodes > MAX_CANONICAL_NODES || depth > MAX_CANONICAL_DEPTH) {
      throw new Error('Academy data exceeds safe validation limits.')
    }
    if (child === null) return 'null'
    if (typeof child === 'string' || typeof child === 'boolean') {
      return JSON.stringify(child)
    }
    if (typeof child === 'number') {
      if (!Number.isFinite(child)) {
        throw new Error('Academy data contains a non-finite number.')
      }
      return JSON.stringify(child)
    }
    if (child === undefined) {
      if (!inArray) return ''
      throw new Error('Academy data contains an undefined array element.')
    }
    if (
      typeof child === 'function' ||
      typeof child === 'symbol' ||
      typeof child === 'bigint'
    ) {
      throw new Error('Academy data contains an unsupported value.')
    }
    if (!child || typeof child !== 'object') {
      throw new Error('Academy data contains an unsupported value.')
    }
    if (active.has(child)) {
      throw new Error('Academy data contains a cyclic structure.')
    }
    active.add(child)
    try {
      if (Array.isArray(child)) {
        return `[${child.map((item) => visit(item, depth + 1, true)).join(',')}]`
      }
      if (!plainRecord(child)) {
        throw new Error('Academy data contains a non-plain object.')
      }
      if (Object.getOwnPropertySymbols(child).length > 0) {
        throw new Error('Academy data contains a symbol property.')
      }
      const descriptors = Object.getOwnPropertyDescriptors(child)
      const keys = Object.keys(descriptors).sort()
      const entries: string[] = []
      for (const key of keys) {
        const descriptor = descriptors[key]
        if (!descriptor.enumerable) continue
        if (!('value' in descriptor)) {
          throw new Error('Academy data contains an accessor property.')
        }
        if (descriptor.value === undefined) continue
        entries.push(
          `${JSON.stringify(key)}:${visit(descriptor.value, depth + 1, false)}`,
        )
      }
      return `{${entries.join(',')}}`
    } finally {
      active.delete(child)
    }
  }

  return visit(value, 0, false)
}

/** `activeProfileId` is transient UI selection, not Academy learning data. */
function durableDataset(state: AppState): unknown {
  const { activeProfileId: _activeProfileId, ...durable } = state
  return durable
}

/** Platform Web Crypto SHA-256 over UTF-8, returned as lowercase hexadecimal. */
export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('Web Crypto SHA-256 is unavailable.')
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function datasetFingerprint(state: AppState): Promise<string> {
  const validation = validateAppStateForSync(state)
  if (!validation.ok) throw new Error(validation.error)
  const canonical = canonicalSerialize(durableDataset(validation.state))
  return `${DATASET_FINGERPRINT_VERSION}:${await sha256Hex(canonical)}`
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export async function readPersistedDataset(
  storage: Storage | null = browserStorage(),
): Promise<PersistedDataset> {
  if (!storage) {
    return { ok: false, error: 'Local Academy storage is unavailable.' }
  }
  try {
    const raw = storage.getItem(APP_STATE_STORAGE_KEY)
    if (!raw) return { ok: false, error: 'Stored Academy data is missing.' }
    const validation = validateAppStateForSync(JSON.parse(raw) as unknown)
    if (!validation.ok) return validation
    return {
      ok: true,
      state: validation.state,
      fingerprint: await datasetFingerprint(validation.state),
    }
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error && cause.message.includes('Web Crypto')
          ? cause.message
          : 'Stored Academy data is unreadable or malformed.',
    }
  }
}

export async function persistDatasetVerified(
  state: AppState,
  storage: Storage | null = browserStorage(),
): Promise<PersistedDataset> {
  if (!storage) {
    return { ok: false, error: 'Local Academy storage is unavailable.' }
  }
  const validation = validateAppStateForSync(state)
  if (!validation.ok) return validation
  try {
    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    return { ok: false, error: 'Local Academy data could not be saved.' }
  }
  const persisted = await readPersistedDataset(storage)
  if (!persisted.ok) return persisted
  const expected = await datasetFingerprint(state)
  return persisted.fingerprint === expected
    ? persisted
    : {
        ok: false,
        error: 'Saved Academy data did not pass provenance verification.',
      }
}

export async function datasetsEquivalent(
  left: AppState,
  right: AppState,
): Promise<boolean> {
  return (await datasetFingerprint(left)) === (await datasetFingerprint(right))
}

function validProvenanceRecord(
  value: unknown,
): value is DatasetProvenanceRecord {
  if (!plainRecord(value)) return false
  const transition = value.importTransition
  return (
    value.version === 1 &&
    typeof value.importEpoch === 'string' &&
    value.importEpoch.length > 0 &&
    (value.fingerprint === null || typeof value.fingerprint === 'string') &&
    finiteNumber(value.updatedAt) &&
    (transition === null ||
      (plainRecord(transition) &&
        typeof transition.operationId === 'string' &&
        (transition.previousFingerprint === null ||
          typeof transition.previousFingerprint === 'string') &&
        (transition.phase === 'invalidated' ||
          transition.phase === 'state-written' ||
          transition.phase === 'review') &&
        typeof transition.reason === 'string' &&
        finiteNumber(transition.startedAt)))
  )
}

export function readDatasetProvenance(
  storage: Storage | null = browserStorage(),
): DatasetProvenanceRecord | null {
  if (!storage) return null
  try {
    const parsed = JSON.parse(
      storage.getItem(DATASET_PROVENANCE_STORAGE_KEY) ?? 'null',
    ) as unknown
    return validProvenanceRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeDatasetProvenance(
  record: DatasetProvenanceRecord,
  storage: Storage | null = browserStorage(),
): boolean {
  if (!storage) return false
  try {
    storage.setItem(DATASET_PROVENANCE_STORAGE_KEY, JSON.stringify(record))
    const verified = readDatasetProvenance(storage)
    return (
      verified?.importEpoch === record.importEpoch &&
      verified.importTransition?.operationId ===
        record.importTransition?.operationId &&
      verified.fingerprint === record.fingerprint
    )
  } catch {
    return false
  }
}

function uniqueId(prefix: string): string {
  const value =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${value}`
}

export async function ensureDatasetProvenance(
  storage: Storage | null = browserStorage(),
): Promise<DatasetProvenanceRecord> {
  const current = readDatasetProvenance(storage)
  if (current) return current
  const persisted = await readPersistedDataset(storage)
  if (!persisted.ok) throw new Error(persisted.error)
  const created: DatasetProvenanceRecord = {
    version: 1,
    importEpoch: uniqueId('dataset'),
    fingerprint: persisted.fingerprint,
    importTransition: null,
    updatedAt: Date.now(),
  }
  if (!writeDatasetProvenance(created, storage)) {
    throw new Error('Academy dataset provenance could not be initialized.')
  }
  return created
}

/**
 * Synchronous import fence. It is persisted before React receives an imported
 * value, so every tab fails closed even when the imported fingerprint is equal.
 */
export function beginDurableImportTransition(
  reason: string,
  storage: Storage | null = browserStorage(),
): DatasetProvenanceRecord {
  if (!storage) throw new Error('Local Academy storage is unavailable.')
  const current = readDatasetProvenance(storage)
  const operationId = uniqueId('import')
  const next: DatasetProvenanceRecord = {
    version: 1,
    importEpoch: uniqueId('epoch'),
    fingerprint: current?.fingerprint ?? null,
    importTransition: {
      operationId,
      previousFingerprint: current?.fingerprint ?? null,
      phase: 'invalidated',
      reason,
      startedAt: Date.now(),
    },
    updatedAt: Date.now(),
  }
  if (!writeDatasetProvenance(next, storage)) {
    throw new Error('Imported-data ownership could not be invalidated safely.')
  }
  return next
}

export function markImportDatasetWritten(
  operationId: string,
  fingerprint: string,
  storage: Storage | null = browserStorage(),
): DatasetProvenanceRecord {
  const current = readDatasetProvenance(storage)
  if (current?.importTransition?.operationId !== operationId) {
    throw new Error('The Academy import transition is no longer current.')
  }
  const next: DatasetProvenanceRecord = {
    ...current,
    fingerprint,
    importTransition: { ...current.importTransition, phase: 'state-written' },
    updatedAt: Date.now(),
  }
  if (!writeDatasetProvenance(next, storage)) {
    throw new Error('Imported Academy data could not be verified safely.')
  }
  return next
}

export function finishDurableImportTransition(
  operationId: string,
  fingerprint: string,
  storage: Storage | null = browserStorage(),
): DatasetProvenanceRecord {
  const current = readDatasetProvenance(storage)
  if (
    current?.importTransition?.operationId !== operationId ||
    current.fingerprint !== fingerprint ||
    current.importTransition.phase !== 'state-written'
  ) {
    throw new Error('The Academy import transition cannot be finalized safely.')
  }
  const finished: DatasetProvenanceRecord = {
    ...current,
    fingerprint,
    importTransition: null,
    updatedAt: Date.now(),
  }
  if (!writeDatasetProvenance(finished, storage)) {
    throw new Error('Imported Academy provenance could not be finalized.')
  }
  return finished
}

export function recordPersistedDatasetFingerprint(
  fingerprint: string,
  storage: Storage | null = browserStorage(),
): DatasetProvenanceRecord {
  const current = readDatasetProvenance(storage)
  if (!current) {
    throw new Error('Academy dataset provenance is not initialized.')
  }
  if (current.importTransition) {
    throw new Error('An Academy import transition is still in progress.')
  }
  const next = { ...current, fingerprint, updatedAt: Date.now() }
  if (!writeDatasetProvenance(next, storage)) {
    throw new Error('Academy dataset provenance could not be updated.')
  }
  return next
}

export type OwnershipProvenanceCheck =
  | { ok: true; fingerprint: string; importEpoch: string }
  | { ok: false; error: string }

export async function verifyOwnedDatasetProvenance(
  meta: HouseholdSyncMeta,
  inMemoryState: AppState,
  storage?: Storage | null,
): Promise<OwnershipProvenanceCheck> {
  if (
    meta.binding !== 'bound' ||
    !meta.ownsLocalData ||
    !meta.datasetFingerprint ||
    !meta.importEpoch
  ) {
    return {
      ok: false,
      error: 'The household does not own this local dataset.',
    }
  }
  const datasetProvenance = readDatasetProvenance(storage)
  if (
    !datasetProvenance ||
    datasetProvenance.importTransition ||
    datasetProvenance.importEpoch !== meta.importEpoch
  ) {
    return {
      ok: false,
      error: 'The local dataset import generation is unbound or changing.',
    }
  }
  const persisted = await readPersistedDataset(storage)
  if (!persisted.ok) return persisted
  let memoryFingerprint: string
  try {
    memoryFingerprint = await datasetFingerprint(inMemoryState)
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error
          ? cause.message
          : 'In-memory Academy data is invalid.',
    }
  }
  if (memoryFingerprint !== persisted.fingerprint) {
    return {
      ok: false,
      error: 'In-memory Academy data differs from persisted Academy data.',
    }
  }
  if (
    meta.datasetFingerprint !== persisted.fingerprint ||
    datasetProvenance.fingerprint !== persisted.fingerprint
  ) {
    return {
      ok: false,
      error: 'Persisted Academy data differs from household ownership.',
    }
  }
  return {
    ok: true,
    fingerprint: persisted.fingerprint,
    importEpoch: datasetProvenance.importEpoch,
  }
}
