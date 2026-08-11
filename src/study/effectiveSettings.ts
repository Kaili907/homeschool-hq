export const STUDY_EFFECTIVE_SETTINGS_SCHEMA_VERSION = 2 as const

export const STUDY_EFFECTIVE_SETTINGS_SOURCE_CATEGORIES = [
  'admin_default',
  'guardian',
  'accommodation',
  'safety',
] as const

export type StudyEffectiveSettingsSourceCategory =
  (typeof STUDY_EFFECTIVE_SETTINGS_SOURCE_CATEGORIES)[number]

export type StudyEffectiveTimerMode =
  | 'visible'
  | 'hidden'
  | 'count_up'
  | 'count_down'

export interface StudyEffectivePresentationSettings {
  readonly reducedMotion: boolean
  readonly noAudio: boolean
  readonly largeText: boolean
  readonly readAloud: boolean
  readonly speechInputAllowed: boolean
}

export interface StudyEffectiveAdminDefaultsV2 extends Partial<StudyEffectivePresentationSettings> {
  readonly timerMode?: StudyEffectiveTimerMode
  readonly maximumWorkMinutes?: number
  readonly breakMinimumMinutes?: number
  readonly breakMaximumMinutes?: number
  readonly requiredBreakIntervalMinutes?: number
}

export interface StudyEffectiveGuardianSettingsV2 extends Partial<StudyEffectivePresentationSettings> {
  readonly timerMode?: StudyEffectiveTimerMode
  readonly maximumWorkMinutes?: number
  readonly breakMinimumMinutes?: number
  readonly breakMaximumMinutes?: number
  /** Existing guardian required-break semantics; this is not an Admin default. */
  readonly minimumBreakCount?: number
}

export interface StudyEffectiveAccommodationV2 {
  readonly maximumWorkMinutes?: number
  readonly requiredBreakIntervalMinutes?: number
  readonly requiredBreakDurationMinutes?: number
  readonly timerVisibility?: 'follow_guardian' | 'visible' | 'hidden'
  readonly presentation?: Partial<StudyEffectivePresentationSettings>
}

export interface StudyEffectiveSafetyConstraintsV2 extends Partial<StudyEffectivePresentationSettings> {
  readonly minimumWorkMinutes?: number
  readonly maximumWorkMinutes?: number
  readonly breakMinimumMinutes?: number
  readonly breakMaximumMinutes?: number
  readonly requiredBreakIntervalMinutes?: number
  readonly timerVisibility?: 'follow_lower_authority' | 'visible' | 'hidden'
}

export interface StudyEffectiveSettingsV2 {
  readonly timerMode: StudyEffectiveTimerMode
  readonly maximumWorkMinutes: number
  readonly breakMinimumMinutes: number
  readonly breakMaximumMinutes: number
  readonly minimumBreakCount: number
  readonly requiredBreakIntervalMinutes: number
  readonly reducedMotion: boolean
  readonly noAudio: boolean
  readonly largeText: boolean
  readonly readAloud: boolean
  readonly speechInputAllowed: boolean
}

export type StudyEffectiveSettingsField = keyof StudyEffectiveSettingsV2

export type StudyEffectiveSettingsProvenance = Readonly<Record<
  StudyEffectiveSettingsField,
  readonly StudyEffectiveSettingsSourceCategory[]
>>

export type StudyEffectiveSettingsManualReviewReason =
  | 'malformed_admin_default'
  | 'malformed_guardian_setting'
  | 'malformed_accommodation'
  | 'malformed_safety_constraint'
  | 'work_duration_conflict'
  | 'break_duration_conflict'

export type StudyEffectiveSettingsUnavailableReason =
  | 'admin_defaults_unavailable'
  | 'safety_constraints_unavailable'
  | 'required_settings_unavailable'
  | 'authoritative_source_unavailable'

interface StudyEffectiveSettingsResultBase {
  readonly schemaVersion: typeof STUDY_EFFECTIVE_SETTINGS_SCHEMA_VERSION
  readonly studentId: string
  readonly effectiveDate: string
}

export interface StudyEffectiveSettingsReadyResult extends StudyEffectiveSettingsResultBase {
  readonly status: 'ready'
  readonly settings: StudyEffectiveSettingsV2
  readonly provenance: StudyEffectiveSettingsProvenance
}

export interface StudyEffectiveSettingsManualReviewResult extends StudyEffectiveSettingsResultBase {
  readonly status: 'manual_review'
  readonly reasonCodes: readonly StudyEffectiveSettingsManualReviewReason[]
  readonly sourceCategories: readonly StudyEffectiveSettingsSourceCategory[]
}

export interface StudyEffectiveSettingsUnavailableResult extends StudyEffectiveSettingsResultBase {
  readonly status: 'unavailable'
  readonly reasonCode: StudyEffectiveSettingsUnavailableReason
}

export type StudyEffectiveSettingsResult =
  | StudyEffectiveSettingsReadyResult
  | StudyEffectiveSettingsManualReviewResult
  | StudyEffectiveSettingsUnavailableResult

export interface ResolveStudyEffectiveSettingsV2Input {
  readonly studentId: string
  readonly effectiveDate: string
  readonly adminDefaults: StudyEffectiveAdminDefaultsV2 | null
  readonly guardianSettings?: StudyEffectiveGuardianSettingsV2 | null
  readonly accommodations: readonly StudyEffectiveAccommodationV2[]
  readonly safetyConstraints: StudyEffectiveSafetyConstraintsV2 | null
}

const TIMER_MODES = new Set<StudyEffectiveTimerMode>([
  'visible', 'hidden', 'count_up', 'count_down',
])
const ACCOMMODATION_TIMER_VISIBILITY = new Set<string>([
  'follow_guardian', 'visible', 'hidden',
])
const SAFETY_TIMER_VISIBILITY = new Set<string>([
  'follow_lower_authority', 'visible', 'hidden',
])
const SOURCE_INDEX = new Map(
  STUDY_EFFECTIVE_SETTINGS_SOURCE_CATEGORIES.map((source, index) => [source, index]),
)
const PRESENTATION_FIELDS = [
  'reducedMotion', 'noAudio', 'largeText', 'readAloud', 'speechInputAllowed',
] as const
const RESULT_FIELDS = [
  'timerMode', 'maximumWorkMinutes', 'breakMinimumMinutes', 'breakMaximumMinutes',
  'minimumBreakCount', 'requiredBreakIntervalMinutes', ...PRESENTATION_FIELDS,
] as const satisfies readonly StudyEffectiveSettingsField[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function isInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && (value as number) >= minimum && (value as number) <= maximum
}

function isOptionalInteger(value: unknown, minimum: number, maximum: number): boolean {
  return value === undefined || isInteger(value, minimum, maximum)
}

function optionalBooleansAreValid(
  value: Record<string, unknown>,
  fields: readonly (keyof StudyEffectivePresentationSettings)[] = PRESENTATION_FIELDS,
): boolean {
  return fields.every((field) => value[field] === undefined || typeof value[field] === 'boolean')
}

function adminDefaultsAreValid(value: StudyEffectiveAdminDefaultsV2): boolean {
  const record = value as Record<string, unknown>
  return (value.timerMode === undefined || TIMER_MODES.has(value.timerMode))
    && isOptionalInteger(value.maximumWorkMinutes, 1, 240)
    && isOptionalInteger(value.breakMinimumMinutes, 1, 120)
    && isOptionalInteger(value.breakMaximumMinutes, 1, 180)
    && isOptionalInteger(value.requiredBreakIntervalMinutes, 1, 240)
    && optionalBooleansAreValid(record)
}

function guardianSettingsAreValid(value: StudyEffectiveGuardianSettingsV2): boolean {
  const record = value as Record<string, unknown>
  return (value.timerMode === undefined || TIMER_MODES.has(value.timerMode))
    && isOptionalInteger(value.maximumWorkMinutes, 1, 240)
    && isOptionalInteger(value.breakMinimumMinutes, 1, 120)
    && isOptionalInteger(value.breakMaximumMinutes, 1, 180)
    && isOptionalInteger(value.minimumBreakCount, 0, 12)
    && optionalBooleansAreValid(record)
}

function accommodationIsValid(value: StudyEffectiveAccommodationV2): boolean {
  if (!isRecord(value)) return false
  const timerVisibility = value.timerVisibility
  if (!isOptionalInteger(value.maximumWorkMinutes, 1, 480)
    || !isOptionalInteger(value.requiredBreakIntervalMinutes, 1, 240)
    || !isOptionalInteger(value.requiredBreakDurationMinutes, 1, 120)
    || (timerVisibility !== undefined
      && (typeof timerVisibility !== 'string'
        || !ACCOMMODATION_TIMER_VISIBILITY.has(timerVisibility)))) return false
  return value.presentation === undefined
    || (isRecord(value.presentation) && optionalBooleansAreValid(value.presentation))
}

function safetyConstraintsAreValid(value: StudyEffectiveSafetyConstraintsV2): boolean {
  const record = value as Record<string, unknown>
  return isOptionalInteger(value.minimumWorkMinutes, 1, 480)
    && isOptionalInteger(value.maximumWorkMinutes, 1, 480)
    && isOptionalInteger(value.breakMinimumMinutes, 1, 120)
    && isOptionalInteger(value.breakMaximumMinutes, 1, 180)
    && isOptionalInteger(value.requiredBreakIntervalMinutes, 1, 240)
    && (value.timerVisibility === undefined
      || SAFETY_TIMER_VISIBILITY.has(value.timerVisibility))
    && optionalBooleansAreValid(record)
}

function orderedSources(
  sources: Iterable<StudyEffectiveSettingsSourceCategory>,
): readonly StudyEffectiveSettingsSourceCategory[] {
  return Object.freeze([...new Set(sources)].sort(
    (left, right) => (SOURCE_INDEX.get(left) ?? 0) - (SOURCE_INDEX.get(right) ?? 0),
  ))
}

function unavailable(
  input: Pick<ResolveStudyEffectiveSettingsV2Input, 'studentId' | 'effectiveDate'>,
  reasonCode: StudyEffectiveSettingsUnavailableReason,
): StudyEffectiveSettingsUnavailableResult {
  return Object.freeze({
    schemaVersion: STUDY_EFFECTIVE_SETTINGS_SCHEMA_VERSION,
    status: 'unavailable',
    studentId: input.studentId,
    effectiveDate: input.effectiveDate,
    reasonCode,
  })
}

function manualReview(
  input: Pick<ResolveStudyEffectiveSettingsV2Input, 'studentId' | 'effectiveDate'>,
  reasonCodes: readonly StudyEffectiveSettingsManualReviewReason[],
  sourceCategories: Iterable<StudyEffectiveSettingsSourceCategory>,
): StudyEffectiveSettingsManualReviewResult {
  return Object.freeze({
    schemaVersion: STUDY_EFFECTIVE_SETTINGS_SCHEMA_VERSION,
    status: 'manual_review',
    studentId: input.studentId,
    effectiveDate: input.effectiveDate,
    reasonCodes: Object.freeze([...new Set(reasonCodes)]),
    sourceCategories: orderedSources(sourceCategories),
  })
}

function lowerConstraint(
  current: number,
  provenance: readonly StudyEffectiveSettingsSourceCategory[],
  candidate: number | undefined,
  source: StudyEffectiveSettingsSourceCategory,
): readonly [number, readonly StudyEffectiveSettingsSourceCategory[]] {
  if (candidate === undefined || candidate > current) return [current, provenance]
  if (candidate < current) return [candidate, Object.freeze([source])]
  return [current, orderedSources([...provenance, source])]
}

function higherConstraint(
  current: number,
  provenance: readonly StudyEffectiveSettingsSourceCategory[],
  candidate: number | undefined,
  source: StudyEffectiveSettingsSourceCategory,
): readonly [number, readonly StudyEffectiveSettingsSourceCategory[]] {
  if (candidate === undefined || candidate < current) return [current, provenance]
  if (candidate > current) return [candidate, Object.freeze([source])]
  return [current, orderedSources([...provenance, source])]
}

function selectedBase<T>(
  guardianValue: T | undefined,
  adminValue: T | undefined,
): readonly [T | undefined, readonly StudyEffectiveSettingsSourceCategory[]] {
  if (guardianValue !== undefined) return [guardianValue, Object.freeze(['guardian'])]
  if (adminValue !== undefined) return [adminValue, Object.freeze(['admin_default'])]
  return [undefined, Object.freeze([])]
}

function resolvePresentationField(
  field: keyof StudyEffectivePresentationSettings,
  base: boolean,
  baseProvenance: readonly StudyEffectiveSettingsSourceCategory[],
  accommodations: readonly StudyEffectiveAccommodationV2[],
  safety: StudyEffectiveSafetyConstraintsV2,
): readonly [boolean, readonly StudyEffectiveSettingsSourceCategory[]] {
  const accommodationValues = accommodations.flatMap(({ presentation }) =>
    presentation?.[field] === undefined ? [] : [presentation[field]],
  ) as boolean[]
  let value = base
  let provenance = baseProvenance
  if (accommodationValues.length > 0) {
    value = field === 'speechInputAllowed'
      ? accommodationValues.every(Boolean)
      : accommodationValues.some(Boolean)
    provenance = Object.freeze(['accommodation'])
  }
  if (safety[field] !== undefined) {
    value = safety[field]
    provenance = Object.freeze(['safety'])
  }
  return [value, provenance]
}

/**
 * Deterministic low-to-high authority reduction:
 * Admin defaults < guardian settings < accommodations < safety constraints.
 * Admin values only fill missing guardian values. Numeric constraints retain
 * the most protective legal value; an empty legal range never invents one.
 */
export function resolveStudyEffectiveSettingsV2(
  input: ResolveStudyEffectiveSettingsV2Input,
): StudyEffectiveSettingsResult {
  if (input.adminDefaults === null) return unavailable(input, 'admin_defaults_unavailable')
  if (input.safetyConstraints === null) return unavailable(input, 'safety_constraints_unavailable')
  if (!adminDefaultsAreValid(input.adminDefaults)) {
    return manualReview(input, ['malformed_admin_default'], ['admin_default'])
  }
  if (input.guardianSettings !== null && input.guardianSettings !== undefined
    && !guardianSettingsAreValid(input.guardianSettings)) {
    return manualReview(input, ['malformed_guardian_setting'], ['guardian'])
  }
  if (!Array.isArray(input.accommodations)
    || !input.accommodations.every(accommodationIsValid)) {
    return manualReview(input, ['malformed_accommodation'], ['accommodation'])
  }
  if (!safetyConstraintsAreValid(input.safetyConstraints)) {
    return manualReview(input, ['malformed_safety_constraint'], ['safety'])
  }

  const admin = input.adminDefaults
  const guardian = input.guardianSettings ?? undefined
  const safety = input.safetyConstraints

  const [baseTimerMode, baseTimerProvenance] = selectedBase(
    guardian?.timerMode, admin.timerMode,
  )
  const [baseMaximumWorkMinutes, baseMaximumWorkProvenance] = selectedBase(
    guardian?.maximumWorkMinutes, admin.maximumWorkMinutes,
  )
  const [baseBreakMinimumMinutes, baseBreakMinimumProvenance] = selectedBase(
    guardian?.breakMinimumMinutes, admin.breakMinimumMinutes,
  )
  const [baseBreakMaximumMinutes, baseBreakMaximumProvenance] = selectedBase(
    guardian?.breakMaximumMinutes, admin.breakMaximumMinutes,
  )
  const [baseRequiredBreakIntervalMinutes, baseBreakIntervalProvenance] = selectedBase(
    undefined, admin.requiredBreakIntervalMinutes,
  )
  const presentationBases = Object.fromEntries(PRESENTATION_FIELDS.map((field) => [
    field,
    selectedBase(guardian?.[field], admin[field]),
  ])) as Record<
    keyof StudyEffectivePresentationSettings,
    readonly [boolean | undefined, readonly StudyEffectiveSettingsSourceCategory[]]
  >

  if (baseTimerMode === undefined
    || baseMaximumWorkMinutes === undefined
    || baseBreakMinimumMinutes === undefined
    || baseBreakMaximumMinutes === undefined
    || baseRequiredBreakIntervalMinutes === undefined
    || PRESENTATION_FIELDS.some((field) => presentationBases[field][0] === undefined)) {
    return unavailable(input, 'required_settings_unavailable')
  }

  const accommodationMaximum = input.accommodations.reduce<number | undefined>(
    (current, item) => item.maximumWorkMinutes === undefined
      ? current
      : current === undefined ? item.maximumWorkMinutes : Math.min(current, item.maximumWorkMinutes),
    undefined,
  )
  let [maximumWorkMinutes, maximumWorkProvenance] = lowerConstraint(
    baseMaximumWorkMinutes,
    baseMaximumWorkProvenance,
    accommodationMaximum,
    'accommodation',
  )
  ;[maximumWorkMinutes, maximumWorkProvenance] = lowerConstraint(
    maximumWorkMinutes,
    maximumWorkProvenance,
    safety.maximumWorkMinutes,
    'safety',
  )
  if (safety.minimumWorkMinutes !== undefined
    && safety.minimumWorkMinutes > maximumWorkMinutes) {
    return manualReview(
      input,
      ['work_duration_conflict'],
      [...maximumWorkProvenance, 'safety'],
    )
  }

  const accommodationBreakMinimum = input.accommodations.reduce<number | undefined>(
    (current, item) => item.requiredBreakDurationMinutes === undefined
      ? current
      : current === undefined
        ? item.requiredBreakDurationMinutes
        : Math.max(current, item.requiredBreakDurationMinutes),
    undefined,
  )
  let [breakMinimumMinutes, breakMinimumProvenance] = higherConstraint(
    baseBreakMinimumMinutes,
    baseBreakMinimumProvenance,
    accommodationBreakMinimum,
    'accommodation',
  )
  ;[breakMinimumMinutes, breakMinimumProvenance] = higherConstraint(
    breakMinimumMinutes,
    breakMinimumProvenance,
    safety.breakMinimumMinutes,
    'safety',
  )
  const [breakMaximumMinutes, breakMaximumProvenance] = lowerConstraint(
    baseBreakMaximumMinutes,
    baseBreakMaximumProvenance,
    safety.breakMaximumMinutes,
    'safety',
  )
  if (breakMinimumMinutes > breakMaximumMinutes) {
    return manualReview(
      input,
      ['break_duration_conflict'],
      [...breakMinimumProvenance, ...breakMaximumProvenance],
    )
  }

  const accommodationInterval = input.accommodations.reduce<number | undefined>(
    (current, item) => item.requiredBreakIntervalMinutes === undefined
      ? current
      : current === undefined
        ? item.requiredBreakIntervalMinutes
        : Math.min(current, item.requiredBreakIntervalMinutes),
    undefined,
  )
  let [requiredBreakIntervalMinutes, breakIntervalProvenance] = lowerConstraint(
    baseRequiredBreakIntervalMinutes,
    baseBreakIntervalProvenance,
    accommodationInterval,
    'accommodation',
  )
  ;[requiredBreakIntervalMinutes, breakIntervalProvenance] = lowerConstraint(
    requiredBreakIntervalMinutes,
    breakIntervalProvenance,
    safety.requiredBreakIntervalMinutes,
    'safety',
  )

  let timerMode = baseTimerMode
  let timerModeProvenance = baseTimerProvenance
  const accommodationTimerValues = input.accommodations
    .map(({ timerVisibility }) => timerVisibility)
    .filter((value): value is 'visible' | 'hidden' => value === 'visible' || value === 'hidden')
  if (accommodationTimerValues.length > 0) {
    timerMode = accommodationTimerValues.includes('hidden') ? 'hidden' : 'visible'
    timerModeProvenance = Object.freeze(['accommodation'])
  }
  if (safety.timerVisibility === 'visible' || safety.timerVisibility === 'hidden') {
    timerMode = safety.timerVisibility
    timerModeProvenance = Object.freeze(['safety'])
  }

  const presentation = {} as Record<
    keyof StudyEffectivePresentationSettings,
    readonly [boolean, readonly StudyEffectiveSettingsSourceCategory[]]
  >
  for (const field of PRESENTATION_FIELDS) {
    const [baseValue, provenance] = presentationBases[field]
    presentation[field] = resolvePresentationField(
      field,
      baseValue as boolean,
      provenance,
      input.accommodations,
      safety,
    )
  }

  const minimumBreakCount = guardian?.minimumBreakCount ?? 0
  const settings: StudyEffectiveSettingsV2 = Object.freeze({
    timerMode,
    maximumWorkMinutes,
    breakMinimumMinutes,
    breakMaximumMinutes,
    minimumBreakCount,
    requiredBreakIntervalMinutes,
    reducedMotion: presentation.reducedMotion[0],
    noAudio: presentation.noAudio[0],
    largeText: presentation.largeText[0],
    readAloud: presentation.readAloud[0],
    speechInputAllowed: presentation.speechInputAllowed[0],
  })
  const provenance: StudyEffectiveSettingsProvenance = Object.freeze({
    timerMode: timerModeProvenance,
    maximumWorkMinutes: maximumWorkProvenance,
    breakMinimumMinutes: breakMinimumProvenance,
    breakMaximumMinutes: breakMaximumProvenance,
    minimumBreakCount: guardian?.minimumBreakCount === undefined
      ? Object.freeze([] as StudyEffectiveSettingsSourceCategory[])
      : Object.freeze(['guardian'] as const),
    requiredBreakIntervalMinutes: breakIntervalProvenance,
    reducedMotion: presentation.reducedMotion[1],
    noAudio: presentation.noAudio[1],
    largeText: presentation.largeText[1],
    readAloud: presentation.readAloud[1],
    speechInputAllowed: presentation.speechInputAllowed[1],
  })

  return Object.freeze({
    schemaVersion: STUDY_EFFECTIVE_SETTINGS_SCHEMA_VERSION,
    status: 'ready',
    studentId: input.studentId,
    effectiveDate: input.effectiveDate,
    settings,
    provenance,
  })
}

function validSourceList(value: unknown): value is readonly StudyEffectiveSettingsSourceCategory[] {
  if (!Array.isArray(value) || value.some((source) =>
    typeof source !== 'string'
      || !STUDY_EFFECTIVE_SETTINGS_SOURCE_CATEGORIES.includes(
        source as StudyEffectiveSettingsSourceCategory,
      ))) return false
  return JSON.stringify(value) === JSON.stringify(orderedSources(
    value as StudyEffectiveSettingsSourceCategory[],
  ))
}

function validSettings(value: unknown): value is StudyEffectiveSettingsV2 {
  if (!isRecord(value) || !hasExactKeys(value, RESULT_FIELDS)) return false
  return TIMER_MODES.has(value.timerMode as StudyEffectiveTimerMode)
    && isInteger(value.maximumWorkMinutes, 1, 240)
    && isInteger(value.breakMinimumMinutes, 1, 120)
    && isInteger(value.breakMaximumMinutes, 1, 180)
    && value.breakMinimumMinutes <= value.breakMaximumMinutes
    && isInteger(value.minimumBreakCount, 0, 12)
    && isInteger(value.requiredBreakIntervalMinutes, 1, 240)
    && PRESENTATION_FIELDS.every((field) => typeof value[field] === 'boolean')
}

function validProvenance(value: unknown): value is StudyEffectiveSettingsProvenance {
  return isRecord(value)
    && hasExactKeys(value, RESULT_FIELDS)
    && RESULT_FIELDS.every((field) => validSourceList(value[field]))
}

const MANUAL_REVIEW_REASONS = new Set<StudyEffectiveSettingsManualReviewReason>([
  'malformed_admin_default',
  'malformed_guardian_setting',
  'malformed_accommodation',
  'malformed_safety_constraint',
  'work_duration_conflict',
  'break_duration_conflict',
])
const UNAVAILABLE_REASONS = new Set<StudyEffectiveSettingsUnavailableReason>([
  'admin_defaults_unavailable',
  'safety_constraints_unavailable',
  'required_settings_unavailable',
  'authoritative_source_unavailable',
])

/** Strictly validates the minimized authoritative RPC projection. */
export function sanitizeStudyEffectiveSettingsResult(
  value: unknown,
): StudyEffectiveSettingsResult | null {
  if (!isRecord(value)
    || value.schemaVersion !== STUDY_EFFECTIVE_SETTINGS_SCHEMA_VERSION
    || typeof value.studentId !== 'string'
    || typeof value.effectiveDate !== 'string') return null
  if (value.status === 'ready') {
    const settings = value.settings
    const provenance = value.provenance
    if (!hasExactKeys(value, [
      'schemaVersion', 'status', 'studentId', 'effectiveDate', 'settings', 'provenance',
    ]) || !validSettings(settings) || !validProvenance(provenance)) return null
    return Object.freeze({
      schemaVersion: STUDY_EFFECTIVE_SETTINGS_SCHEMA_VERSION,
      status: 'ready',
      studentId: value.studentId,
      effectiveDate: value.effectiveDate,
      settings: Object.freeze({ ...settings }),
      provenance: Object.freeze(Object.fromEntries(RESULT_FIELDS.map((field) => [
        field, Object.freeze([...provenance[field]]),
      ])) as StudyEffectiveSettingsProvenance),
    })
  }
  if (value.status === 'manual_review') {
    if (!hasExactKeys(value, [
      'schemaVersion', 'status', 'studentId', 'effectiveDate', 'reasonCodes', 'sourceCategories',
    ]) || !Array.isArray(value.reasonCodes)
      || value.reasonCodes.length === 0
      || value.reasonCodes.some((reason) =>
        typeof reason !== 'string'
          || !MANUAL_REVIEW_REASONS.has(reason as StudyEffectiveSettingsManualReviewReason))
      || new Set(value.reasonCodes).size !== value.reasonCodes.length
      || !validSourceList(value.sourceCategories)) return null
    return Object.freeze({
      schemaVersion: STUDY_EFFECTIVE_SETTINGS_SCHEMA_VERSION,
      status: 'manual_review',
      studentId: value.studentId,
      effectiveDate: value.effectiveDate,
      reasonCodes: Object.freeze([...value.reasonCodes]) as readonly StudyEffectiveSettingsManualReviewReason[],
      sourceCategories: Object.freeze([...value.sourceCategories]),
    })
  }
  if (value.status === 'unavailable') {
    if (!hasExactKeys(value, [
      'schemaVersion', 'status', 'studentId', 'effectiveDate', 'reasonCode',
    ]) || typeof value.reasonCode !== 'string'
      || !UNAVAILABLE_REASONS.has(value.reasonCode as StudyEffectiveSettingsUnavailableReason)) return null
    return Object.freeze({
      schemaVersion: STUDY_EFFECTIVE_SETTINGS_SCHEMA_VERSION,
      status: 'unavailable',
      studentId: value.studentId,
      effectiveDate: value.effectiveDate,
      reasonCode: value.reasonCode as StudyEffectiveSettingsUnavailableReason,
    })
  }
  return null
}

export function unavailableStudyEffectiveSettingsResult(
  studentId: string,
  effectiveDate: string,
): StudyEffectiveSettingsUnavailableResult {
  return unavailable({ studentId, effectiveDate }, 'authoritative_source_unavailable')
}
