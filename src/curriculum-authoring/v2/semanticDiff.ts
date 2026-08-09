export type ElevatedChangeCategory =
  | 'MASTERY'
  | 'ASSESSMENT_INTERPRETATION'
  | 'TUTOR_PROTECTED_STRATEGY'
  | 'STUDENT_PROTECTED_CLASSIFICATION'
  | 'SAFETY_PRIVACY'
  | 'GUARDIAN_VISIBILITY'
  | 'ACCESSIBILITY_FALLBACK_REMOVAL'
  | 'STANDARDS_CREDIT'
  | 'GLOBAL_POLICY_REFERENCE'

export interface SemanticChange {
  readonly path: string
  readonly kind: 'added' | 'removed' | 'changed'
  readonly elevated: boolean
  readonly category?: ElevatedChangeCategory
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function collectChanges(before: unknown, after: unknown, path: string, changes: SemanticChange[]): void {
  if (Object.is(before, after)) return
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length)
    for (let index = 0; index < length; index += 1) {
      collectChanges(before[index], after[index], `${path}[${index}]`, changes)
    }
    return
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    keys.forEach((key) => collectChanges(before[key], after[key], path ? `${path}.${key}` : key, changes))
    return
  }
  const kind = before === undefined ? 'added' : after === undefined ? 'removed' : 'changed'
  changes.push({ path, kind, ...classifyPath(path, kind) })
}

function classifyPath(
  path: string,
  kind: SemanticChange['kind'],
): Pick<SemanticChange, 'elevated' | 'category'> {
  const normalized = path.toLowerCase()
  if (normalized.includes('mastery')) return { elevated: true, category: 'MASTERY' }
  if (normalized.includes('assessment_interpretation') || normalized.includes('protected_interpretation')) {
    return { elevated: true, category: 'ASSESSMENT_INTERPRETATION' }
  }
  if (normalized.includes('tutor_routes') || normalized.includes('tutor_strategy')) {
    return { elevated: true, category: 'TUTOR_PROTECTED_STRATEGY' }
  }
  if (normalized.includes('projection') || normalized.includes('extensions') && normalized.includes('classification')) {
    return { elevated: true, category: 'STUDENT_PROTECTED_CLASSIFICATION' }
  }
  if (normalized.includes('safety_privacy') || normalized.includes('privacy_declarations')) {
    return { elevated: true, category: 'SAFETY_PRIVACY' }
  }
  if (normalized.includes('guardian_visibility')) {
    return { elevated: true, category: 'GUARDIAN_VISIBILITY' }
  }
  if (
    kind === 'removed' &&
    (normalized.includes('accessibility') ||
      normalized.includes('fallback') ||
      normalized.includes('caption') ||
      normalized.includes('transcript') ||
      normalized.includes('alt_text') ||
      normalized.includes('long_description'))
  ) {
    return { elevated: true, category: 'ACCESSIBILITY_FALLBACK_REMOVAL' }
  }
  if (normalized.includes('standards') || normalized.includes('credit')) {
    return { elevated: true, category: 'STANDARDS_CREDIT' }
  }
  if (normalized.includes('policy_ref') || normalized.includes('policy_set_ref')) {
    return { elevated: true, category: 'GLOBAL_POLICY_REFERENCE' }
  }
  return { elevated: false }
}

export function classifySemanticDiff(before: unknown, after: unknown): readonly SemanticChange[] {
  const changes: SemanticChange[] = []
  collectChanges(before, after, '', changes)
  return changes
}
