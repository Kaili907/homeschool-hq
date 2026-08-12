import { SCHEMA_VERSION } from '../migration'
import { ACADEMY_GRADES as ACADEMY_GRADE_VALUES, type AppState, type Profile } from '../types'
import { ACADEMY_COURSE_ID_PATTERN } from '../curriculum/grade-authority'
import type { HouseholdSyncMeta, RemoteProfileRow } from './types'

export const APP_STATE_STORAGE_KEY = 'homeschool-hq:app:v2'
export const DATASET_WRITE_LOCK_NAME = 'academy-sync-persisted-dataset'
export const DATASET_FINGERPRINT_VERSION = 'sha256-v2'
export const DATASET_PROVENANCE_STORAGE_KEY =
  'homeschool-hq:sync:dataset-provenance:v1'

const MAX_CANONICAL_DEPTH = 128
const MAX_CANONICAL_NODES = 500_000
/** Exported so the schedule Add gate (src/schedule/coreDay.ts) mirrors the real cap. */
export const MAX_SYNC_ARRAY_ITEMS = 50_000
const MAX_SYNC_RECORD_ENTRIES = 50_000
const MAX_SYNC_STRING_LENGTH = 1_000_000
const MAX_SYNC_KEY_LENGTH = 256
const MAX_SYNC_PAYLOAD_BYTES = 10_000_000
const MAX_SYNC_PROFILES = 5
const PROFILE_ID = /^p[1-5]$/
const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
// NOMINAL grades a profile may carry — deliberately a different vocabulary from
// ACADEMY_GRADES below: grade 6 is a perfectly valid nominal grade with no
// curriculum authored for it.
const GRADES = new Set<string>(['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
// CURRICULUM-SUPPORTED grades, from the canonical authority rather than a
// second hand-maintained copy of the same list.
const ACADEMY_GRADES = new Set<string>(ACADEMY_GRADE_VALUES)
// mirrors ACADEMY_SUBJECTS (src/types.ts), the working-level record's key domain
const ACADEMY_SUBJECTS = new Set([
  'mathematics',
  'english-language-arts',
  'science',
  'social-studies',
  'health',
  'physical-education',
  'ready-for-life',
  'technology',
  'arts-and-music',
  'financial-literacy',
])
const ACADEMY_LESSON_STATUSES = new Set(['in-progress', 'complete', 'reteach'])
const ACADEMY_OCCASION_MODES = new Set(['guided', 'independent'])
const ACADEMY_OCCASION_KINDS = new Set(['lesson-check', 'reassessment'])
const ACADEMY_ASSESSMENT_OUTCOMES = new Set(['secure', 'developing', 'not-yet'])
const THEMES = new Set(['playful', 'cool', 'clean'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SCHEDULE_DAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
const CORE_DAY_WRITING = new Set(['writing-mw', 'writing-tth'])
const TIME_HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/
// mirrors MAX_EXTENSION_LABEL (src/schedule/coreDay.ts), the Add-form label cap
const MAX_SCHEDULE_EXTENSION_LABEL = 120
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

export type DatasetPersistenceResult =
  | { ok: true; state: AppState; fingerprint: string }
  | { ok: false; error: string; wrote: boolean }

export type AppStateValidation =
  | { ok: true; state: AppState }
  | { ok: false; error: string }

function plainRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function nonNegativeInteger(value: unknown): value is number {
  return finiteNumber(value) && Number.isInteger(value) && value >= 0
}

function percentage(value: unknown): value is number {
  return finiteNumber(value) && value >= 0 && value <= 100
}

function text(value: unknown, max = MAX_SYNC_STRING_LENGTH): value is string {
  return typeof value === 'string' && value.length <= max
}

function identifier(value: unknown): value is string {
  return text(value, 512) && value.length > 0
}

/**
 * Membership test that refuses non-strings. `SET.has(String(value))` coerces
 * first, so a numeric 5 satisfies a set holding '5' — malformed data for a
 * string-union field, and not something that should cross the sync boundary.
 * Check the type, then membership.
 */
function memberOf(set: Set<string>, value: unknown): value is string {
  return typeof value === 'string' && set.has(value)
}

function isoDate(value: unknown, allowEmpty = false): value is string {
  if (!text(value, 32)) return false
  if (allowEmpty && value === '') return true
  if (!ISO_DATE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

function timestamp(value: unknown): value is string {
  if (
    !text(value, 64) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    return false
  }
  return !Number.isNaN(Date.parse(value))
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
    Object.keys(value).length === value.length &&
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
    entries.every(
      ([key, candidate]) =>
        key.length <= MAX_SYNC_KEY_LENGTH &&
        !RESERVED_KEYS.has(key) &&
        validate(candidate, key),
    )
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

const LOGICAL_VOICE_REF = /^academy\.tts\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/
const LOGICAL_VOICE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

function exactRecordKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function validateVoiceSelection(value: unknown): boolean {
  if (!plainRecord(value)) return false
  if (value.kind === 'catalog') {
    return (
      exactRecordKeys(value, ['kind', 'voiceRef', 'voiceVersion', 'displayLabel']) &&
      text(value.voiceRef, 128) &&
      LOGICAL_VOICE_REF.test(value.voiceRef) &&
      text(value.voiceVersion, 64) &&
      LOGICAL_VOICE_VERSION.test(value.voiceVersion) &&
      text(value.displayLabel, 120)
    )
  }
  return (
    value.kind === 'browser' &&
    exactRecordKeys(value, ['kind', 'voiceURI', 'displayLabel']) &&
    text(value.voiceURI) && value.voiceURI.length > 0 &&
    text(value.displayLabel, 120) && value.displayLabel.length > 0
  )
}

function validateTutorPrefs(value: unknown): boolean {
  return (
    plainRecord(value) &&
    optional(value.voiceURI, text) &&
    optional(value.rate, finiteNumber) &&
    optional(value.voiceOptIn, (candidate) => typeof candidate === 'boolean') &&
    optional(value.voiceSelections, (candidate) => boundedRecord(candidate, validateVoiceSelection)) &&
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

function timeOfDay(value: unknown): value is string {
  return text(value, 5) && TIME_HHMM.test(value)
}

/**
 * Exact parity with the Add-form gate (canAddExtension, src/schedule/coreDay.ts):
 * label 1–120 after trim, at least one valid school day, strict HH:MM on both
 * ends, start < end. Anything the gate rejects must be rejected here too —
 * looser acceptance stores state that silently halts household persistence.
 */
function validateScheduleExtensions(value: unknown): boolean {
  return boundedArray(value, (block) => {
    if (!plainRecord(block)) return false
    const { label, days, start, end } = block
    return (
      identifier(block.id) &&
      text(label, MAX_SCHEDULE_EXTENSION_LABEL) &&
      label.trim().length > 0 &&
      Array.isArray(days) &&
      days.length > 0 &&
      boundedArray(days, (day) => typeof day === 'string' && SCHEDULE_DAYS.has(day)) &&
      timeOfDay(start) &&
      timeOfDay(end) &&
      start < end
    )
  })
}

function validateCoreDay(value: unknown): boolean {
  return (
    plainRecord(value) &&
    typeof value.writingDays === 'string' &&
    CORE_DAY_WRITING.has(value.writingDays)
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

/**
 * ACADEMY-LEVEL-DECOUPLE — the authorization a profile actually carries:
 * subject → the academy level that subject is assigned. A subject with no
 * explicit working level rides the nominal grade, exactly as the runtime
 * resolver does (academy/workingLevel.workingLevelFor); a subject that lands on
 * a non-academy grade authorizes nothing.
 *
 * This replaces the old `academy.grade === profile.grade` rule, which made a
 * decoupled enrollment (grade-6 girl doing Grade 5 mathematics) unrepresentable.
 * It is deliberately SUBJECT-scoped rather than level-scoped: assigning
 * mathematics to Grade 5 must not also admit Grade 5 science, which a bare set
 * of allowed levels would have done.
 */
function academyAuthorization(
  profileGrade: unknown,
  workingLevels: unknown,
): Map<string, string> {
  const nominal = memberOf(ACADEMY_GRADES, profileGrade) ? profileGrade : null
  const explicit = plainRecord(workingLevels) ? workingLevels : {}
  const authorized = new Map<string, string>()
  for (const subject of ACADEMY_SUBJECTS) {
    const assigned = explicit[subject]
    const level = assigned === undefined ? nominal : assigned
    if (memberOf(ACADEMY_GRADES, level)) authorized.set(subject, level)
  }
  return authorized
}

/**
 * ACADEMY-LEVEL-DECOUPLE: subject → academy level. Levels are restricted to the
 * grades curriculum is authored for — the same set the parent UI offers. A
 * nominal-only grade such as '6' is rejected rather than stored as an inert
 * value nothing can serve.
 */
function validateWorkingLevels(value: unknown): boolean {
  return boundedRecord(
    value,
    (level, subject) => ACADEMY_SUBJECTS.has(subject) && memberOf(ACADEMY_GRADES, level),
  )
}

/** Course ids encode their level and subject (`ma-g5-mathematics`). Shares one
 * definition with academy/academyRoute.ts and academy/workingLevel.ts via the
 * grade authority. Every id in the shipped release parses. */
const ACADEMY_COURSE_ID = ACADEMY_COURSE_ID_PATTERN

/**
 * A course record is admissible only if the profile is authorized for that
 * course's SUBJECT at that course's LEVEL. An id whose level/subject cannot be
 * read cannot be shown to be authorized, so it is refused.
 *
 * Scope note: this checks the authorization the course claims, not whether the
 * course, its lessons, or its assessments exist in the release, nor that a
 * lesson belongs to an enrolled course. Those gaps predate this branch (the old
 * grade-equality rule validated no membership either) and are carded separately.
 */
function validateAcademyCourseIds(value: unknown, authorized: Map<string, string>): boolean {
  return boundedArray(value, (candidate) => {
    if (!identifier(candidate)) return false
    const parsed = ACADEMY_COURSE_ID.exec(candidate)
    return parsed !== null && authorized.get(parsed[2]) === parsed[1]
  })
}

/**
 * CURR-1: Manuel Academy enrollment + progress (see types.AcademyState).
 *
 * ACADEMY-LEVEL-DECOUPLE-C: the capability check lives on `courseIds`, which is
 * subject-precise. `grade` is the label the enrollment was opened under; nothing
 * reads it to SELECT content, so it is checked for shape but not for current
 * authorization. Gating on it as well would make the field a denormalized
 * capability that a parent clearing her last working level could leave
 * permanently invalid, blocking every later save for the whole household.
 * (It is not inert: AcademyRouter compares it to the composed program's primary
 * level to decide when to re-sync enrollment — see AcademyRouter.tsx `inSync`.)
 *
 * ACADEMY-LEVEL-DECOUPLE-C2: every enumerated field is matched with `memberOf`,
 * which refuses non-strings. `SET.has(String(x))` accepted numeric 5 for a
 * string-union field.
 */
function validateAcademy(value: unknown, authorized: Map<string, string>): boolean {
  return (
    plainRecord(value) &&
    text(value.releaseVersion, 64) &&
    memberOf(ACADEMY_GRADES, value.grade) &&
    timestamp(value.enrolledAt) &&
    validateAcademyCourseIds(value.courseIds, authorized) &&
    boundedRecord(
      value.lessons,
      (lesson) =>
        plainRecord(lesson) &&
        memberOf(ACADEMY_LESSON_STATUSES, lesson.status) &&
        nonNegativeInteger(lesson.segmentIndex) &&
        text(lesson.releaseVersion, 64) &&
        timestamp(lesson.startedAt) &&
        optional(lesson.completedAt, timestamp) &&
        optional(lesson.revisits, nonNegativeInteger) &&
        boundedArray(
          lesson.occasions,
          (occasion) =>
            plainRecord(occasion) &&
            isoDate(occasion.date) &&
            memberOf(ACADEMY_OCCASION_MODES, occasion.mode) &&
            typeof occasion.met === 'boolean' &&
            memberOf(ACADEMY_OCCASION_KINDS, occasion.kind),
        ),
    ) &&
    boundedRecord(value.assessments, (attempts) =>
      boundedArray(
        attempts,
        (attempt) =>
          plainRecord(attempt) &&
          isoDate(attempt.date) &&
          percentage(attempt.percent) &&
          memberOf(ACADEMY_ASSESSMENT_OUTCOMES, attempt.outcome),
      ),
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
    ) &&
    optional(value.scheduleExtensions, validateScheduleExtensions) &&
    optional(value.workingLevels, validateWorkingLevels) &&
    optional(value.academy, (candidate) =>
      validateAcademy(candidate, academyAuthorization(value.grade, value.workingLevels)),
    )
  )
}

export function validateProfileForSync(
  key: string,
  value: unknown,
): value is Profile {
  if (!plainRecord(value)) return false
  return (
    PROFILE_ID.test(key) &&
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
  try {
    if (!plainRecord(value)) {
      return { ok: false, error: 'Stored Academy data is not an object.' }
    }
    const canonical = canonicalSerialize(value)
    if (new TextEncoder().encode(canonical).byteLength > MAX_SYNC_PAYLOAD_BYTES) {
      return {
        ok: false,
        error: 'Stored Academy data exceeds the safe payload-size limit.',
      }
    }
    if (value.schemaVersion !== SCHEMA_VERSION) {
      return {
        ok: false,
        error: 'Stored Academy data uses an unsupported schema version.',
      }
    }
    const profiles = value.profiles
    if (
      !plainRecord(profiles) ||
      !boundedRecord(profiles, (profile, key) =>
        validateProfileForSync(key, profile),
      ) ||
      Object.keys(profiles).length > MAX_SYNC_PROFILES ||
      !text(value.parentPin, 64) ||
      !optional(
        value.tutorMuted,
        (candidate) => typeof candidate === 'boolean',
      ) ||
      !optional(value.stars, validateGlobalStars) ||
      !optional(value.mindsetStartDate, isoDate) ||
      !optional(value.schoolYear, validateSchoolYear) ||
      !optional(value.coreDay, validateCoreDay) ||
      !(
        value.activeProfileId === null ||
        (typeof value.activeProfileId === 'string' &&
          Object.hasOwn(profiles, value.activeProfileId))
      )
    ) {
      return {
        ok: false,
        error: 'Stored Academy profile data is malformed.',
      }
    }
    return { ok: true, state: value as unknown as AppState }
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error
          ? `Stored Academy data is not safe to synchronize: ${cause.message}`
          : 'Stored Academy data is not safe to synchronize.',
    }
  }
}

export type RemoteRowsValidation =
  | { ok: true; rows: RemoteProfileRow[] }
  | { ok: false; error: string }

/** Validate and bound every cloud row before hashing or reconciliation. */
export function validateRemoteProfileRows(value: unknown): RemoteRowsValidation {
  try {
    const canonical = canonicalSerialize(value)
    if (new TextEncoder().encode(canonical).byteLength > MAX_SYNC_PAYLOAD_BYTES) {
      return { ok: false, error: 'The cloud profile payload is too large.' }
    }
    if (
      !Array.isArray(value) ||
      value.length > MAX_SYNC_PROFILES ||
      Object.keys(value).length !== value.length
    ) {
      return { ok: false, error: 'The cloud returned an invalid profile list.' }
    }
    const ids = new Set<string>()
    for (const candidate of value) {
      if (!plainRecord(candidate)) {
        return { ok: false, error: 'The cloud returned an invalid profile row.' }
      }
      const id = candidate.profile_id
      if (
        typeof id !== 'string' ||
        !PROFILE_ID.test(id) ||
        ids.has(id) ||
        !validateProfileForSync(id, candidate.data) ||
        typeof candidate.updated_at !== 'string' ||
        candidate.updated_at.length > 64 ||
        Number.isNaN(Date.parse(candidate.updated_at))
      ) {
        return { ok: false, error: 'The cloud returned an invalid profile row.' }
      }
      ids.add(id)
    }
    return { ok: true, rows: value as RemoteProfileRow[] }
  } catch {
    return {
      ok: false,
      error: 'The cloud returned malformed or unsafe profile data.',
    }
  }
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
    if (typeof child === 'string') {
      if (child.length > MAX_SYNC_STRING_LENGTH) {
        throw new Error('Academy data contains an oversized string.')
      }
      return JSON.stringify(child)
    }
    if (typeof child === 'boolean') {
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
        if (
          child.length > MAX_SYNC_ARRAY_ITEMS ||
          Object.keys(child).length !== child.length
        ) {
          throw new Error('Academy data contains an oversized or sparse array.')
        }
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
      if (keys.length > MAX_SYNC_RECORD_ENTRIES) {
        throw new Error('Academy data contains an oversized record.')
      }
      const entries: string[] = []
      for (const key of keys) {
        if (key.length > MAX_SYNC_KEY_LENGTH || RESERVED_KEYS.has(key)) {
          throw new Error('Academy data contains an unsafe object key.')
        }
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

/** Synchronous canonical snapshot used only by the no-await dispatch guard. */
export function canonicalDatasetSnapshot(state: AppState): string {
  const validation = validateAppStateForSync(state)
  if (!validation.ok) throw new Error(validation.error)
  return canonicalSerialize(durableDataset(validation.state))
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
  const canonical = canonicalDatasetSnapshot(validation.state)
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
): Promise<DatasetPersistenceResult> {
  if (!storage) {
    return {
      ok: false,
      error: 'Local Academy storage is unavailable.',
      wrote: false,
    }
  }
  const validation = validateAppStateForSync(state)
  if (!validation.ok) return { ...validation, wrote: false }
  try {
    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    return {
      ok: false,
      error: 'Local Academy data could not be saved.',
      wrote: false,
    }
  }
  const persisted = await readPersistedDataset(storage)
  if (!persisted.ok) return { ...persisted, wrote: true }
  const expected = await datasetFingerprint(state)
  return persisted.fingerprint === expected
    ? persisted
    : {
        ok: false,
        error: 'Saved Academy data did not pass provenance verification.',
        wrote: true,
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
