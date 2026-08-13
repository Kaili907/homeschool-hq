import type { CorpusEntry, TaskSheetPackage, ScoringRecord, RubricLevel } from './types.ts'

export interface SchemaIssue {
  readonly path: string
  readonly detail: string
}

/**
 * Hand-rolled structural validator mirroring schema/task-sheet.schema.json
 * and schema/scoring-record.schema.json exactly (no ajv dependency is
 * installed in this repo). Checks required fields, additionalProperties:
 * false, enums, consts, and the allOf cross-field rules — the same
 * invariants the schema files declare, run as an explicit "schema tests"
 * step distinct from TypeScript's compile-time-only casts in loadCorpus.ts.
 */

const PACKAGE_KEYS = new Set([
  'schemaVersion', 'packageId', 'lessonRef', 'subjectFamily', 'standardsRefs', 'objective', 'scenario',
  'isFictionalSimulation', 'completionAuthority', 'realWorldAction', 'signOff', 'safetyNotes',
  'simulationAlternative', 'materials', 'tasks', 'remediation', 'extension', 'scoringRef', 'integrity',
])
const LESSON_REF_KEYS = new Set(['lessonId', 'courseId', 'grade', 'subject', 'unitNumber', 'unitTitle', 'dayInUnit', 'phase', 'title'])
const SIGN_OFF_KEYS = new Set([
  'requiresGuardianPermissionBeforeStart', 'requiresTrustedAdultSupervision', 'certifyingActor',
  'studentSelfReport', 'evidenceTypes', 'identifiablePhotoRequired',
])
const SIMULATION_ALT_KEYS = new Set(['present', 'description'])
const TASK_KEYS = new Set(['taskId', 'kind', 'directions', 'prompts'])
const PROMPT_KEYS = new Set(['ref', 'promptType', 'text', 'choices'])
const INTEGRITY_KEYS = new Set(['sourceStage', 'sourceCorpusRef', 'sourceLessonId', 'authoredBy'])

const TASK_KINDS = new Set(['warm-up', 'guided', 'independent', 'performance-task', 'reflection'])
const PROMPT_TYPES = new Set(['short-response', 'extended-response', 'checklist-item', 'fixed-choice'])

function extraKeys(obj: object, allowed: Set<string>): string[] {
  return Object.keys(obj).filter((k) => !allowed.has(k))
}

export function validatePackageSchema(pkg: TaskSheetPackage): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const push = (path: string, detail: string) => issues.push({ path, detail })

  for (const k of extraKeys(pkg, PACKAGE_KEYS)) push(k, `unexpected top-level property "${k}" (additionalProperties: false)`)
  if (pkg.schemaVersion !== '1.0') push('schemaVersion', `must be const "1.0"`)
  if (!/^swk-rfl-/.test(pkg.packageId)) push('packageId', `must match pattern ^swk-rfl-`)
  if (!pkg.objective || pkg.objective.length < 1) push('objective', 'minLength 1')
  if (!pkg.scenario || pkg.scenario.length < 1) push('scenario', 'minLength 1')
  if (typeof pkg.isFictionalSimulation !== 'boolean') push('isFictionalSimulation', 'must be boolean')
  if (!['learner', 'guardian'].includes(pkg.completionAuthority)) push('completionAuthority', 'must be learner|guardian')
  if (typeof pkg.realWorldAction !== 'boolean') push('realWorldAction', 'must be boolean')
  if (pkg.subjectFamily !== 'ARTS_RFL_PE_PROJECT') push('subjectFamily', 'must be const ARTS_RFL_PE_PROJECT')
  if (!pkg.remediation || pkg.remediation.length < 1) push('remediation', 'minLength 1')
  if (!pkg.extension || pkg.extension.length < 1) push('extension', 'minLength 1')
  if (!/^scoring\//.test(pkg.scoringRef)) push('scoringRef', 'must match pattern ^scoring/')
  if (pkg.standardsRefs !== undefined && pkg.standardsRefs.length < 1) push('standardsRefs', 'minItems 1 when present')

  const lr = pkg.lessonRef
  if (!lr) {
    push('lessonRef', 'required')
  } else {
    for (const k of extraKeys(lr, LESSON_REF_KEYS)) push(`lessonRef.${k}`, `unexpected property`)
    if (lr.grade !== 3) push('lessonRef.grade', 'this batch is grade-03 only, must be 3')
    if (lr.subject !== 'ready-for-life') push('lessonRef.subject', 'must be const ready-for-life')
    if (typeof lr.unitNumber !== 'number' || lr.unitNumber < 1) push('lessonRef.unitNumber', 'integer >= 1')
    if (typeof lr.dayInUnit !== 'number' || lr.dayInUnit < 1) push('lessonRef.dayInUnit', 'integer >= 1')
  }

  if (pkg.completionAuthority === 'guardian') {
    if (pkg.signOff === null || typeof pkg.signOff !== 'object') {
      push('signOff', 'required object when completionAuthority is guardian')
    } else {
      for (const k of extraKeys(pkg.signOff, SIGN_OFF_KEYS)) push(`signOff.${k}`, 'unexpected property')
      if (pkg.signOff.requiresGuardianPermissionBeforeStart !== true) push('signOff.requiresGuardianPermissionBeforeStart', 'must be const true')
      if (pkg.signOff.certifyingActor !== 'household-authorized guardian') push('signOff.certifyingActor', 'must be const "household-authorized guardian"')
      if (pkg.signOff.studentSelfReport !== 'recorded-but-not-certifying') push('signOff.studentSelfReport', 'must be const "recorded-but-not-certifying"')
      if (pkg.signOff.identifiablePhotoRequired !== false) push('signOff.identifiablePhotoRequired', 'must be const false')
      if (!pkg.signOff.evidenceTypes || pkg.signOff.evidenceTypes.length < 1) push('signOff.evidenceTypes', 'minItems 1')
    }
  } else if (pkg.completionAuthority === 'learner') {
    if (pkg.signOff !== null) push('signOff', 'must be null when completionAuthority is learner')
  }

  if (pkg.realWorldAction === true) {
    if (pkg.simulationAlternative === null || typeof pkg.simulationAlternative !== 'object') {
      push('simulationAlternative', 'required object when realWorldAction is true')
    } else {
      for (const k of extraKeys(pkg.simulationAlternative, SIMULATION_ALT_KEYS)) push(`simulationAlternative.${k}`, 'unexpected property')
      if (pkg.simulationAlternative.present !== true) push('simulationAlternative.present', 'must be const true')
      if (!pkg.simulationAlternative.description || pkg.simulationAlternative.description.length < 1) push('simulationAlternative.description', 'minLength 1')
    }
  }

  if (!Array.isArray(pkg.tasks) || pkg.tasks.length < 1) {
    push('tasks', 'minItems 1')
  } else {
    pkg.tasks.forEach((t, i) => {
      for (const k of extraKeys(t, TASK_KEYS)) push(`tasks[${i}].${k}`, 'unexpected property')
      if (!TASK_KINDS.has(t.kind)) push(`tasks[${i}].kind`, `must be one of ${[...TASK_KINDS].join('|')}`)
      if (!t.directions || t.directions.length < 1) push(`tasks[${i}].directions`, 'minLength 1')
      if (!Array.isArray(t.prompts) || t.prompts.length < 1) {
        push(`tasks[${i}].prompts`, 'minItems 1')
      } else {
        t.prompts.forEach((p: TaskSheetPackage['tasks'][number]['prompts'][number], j: number) => {
          for (const k of extraKeys(p, PROMPT_KEYS)) push(`tasks[${i}].prompts[${j}].${k}`, 'unexpected property')
          if (!PROMPT_TYPES.has(p.promptType)) push(`tasks[${i}].prompts[${j}].promptType`, `must be one of ${[...PROMPT_TYPES].join('|')}`)
          if (!p.text || p.text.length < 1) push(`tasks[${i}].prompts[${j}].text`, 'minLength 1')
          if (p.choices !== undefined) {
            if (p.choices.length < 2) push(`tasks[${i}].prompts[${j}].choices`, 'minItems 2')
            if (new Set(p.choices).size !== p.choices.length) push(`tasks[${i}].prompts[${j}].choices`, 'uniqueItems')
          }
        })
      }
    })
  }

  const integ = pkg.integrity
  if (!integ) {
    push('integrity', 'required')
  } else {
    for (const k of extraKeys(integ, INTEGRITY_KEYS)) push(`integrity.${k}`, 'unexpected property')
    if (!['released', 'authoring'].includes(integ.sourceStage)) push('integrity.sourceStage', 'must be released|authoring')
    if (!integ.sourceCorpusRef || integ.sourceCorpusRef.length < 1) push('integrity.sourceCorpusRef', 'minLength 1')
    if (integ.authoredBy !== 'manual') push('integrity.authoredBy', 'must be const manual')
  }

  return issues.map((i) => ({ ...i, path: `${pkg.packageId}: ${i.path}` }))
}

const SCORING_KEYS = new Set(['schemaVersion', 'packageId', 'lessonId', 'scoringAuthority', 'completionAuthority', 'nonDiagnosticGuard'])
const SCORING_AUTHORITY_KEYS = new Set(['kind', 'criteria', 'lookFors'])
const CRITERION_KEYS = new Set(['dimension', 'levels'])
const LEVEL_KEYS = new Set(['label', 'descriptor'])

export function validateScoringSchema(scoring: ScoringRecord): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const push = (path: string, detail: string) => issues.push({ path, detail })

  for (const k of extraKeys(scoring, SCORING_KEYS)) push(k, 'unexpected top-level property')
  if (scoring.schemaVersion !== '1.0') push('schemaVersion', 'must be const 1.0')
  if (!/^swk-rfl-/.test(scoring.packageId)) push('packageId', 'must match pattern ^swk-rfl-')
  if (scoring.nonDiagnosticGuard !== 'Do not infer effort, motivation, diagnosis, or character from an error.') {
    push('nonDiagnosticGuard', 'must be the exact const guard string')
  }
  if (!['learner', 'guardian'].includes(scoring.completionAuthority)) push('completionAuthority', 'must be learner|guardian')

  const sa = scoring.scoringAuthority
  if (!sa) {
    push('scoringAuthority', 'required')
  } else {
    for (const k of extraKeys(sa, SCORING_AUTHORITY_KEYS)) push(`scoringAuthority.${k}`, 'unexpected property')
    if (!['RUBRIC', 'SCORING_JUDGMENT'].includes(sa.kind)) push('scoringAuthority.kind', 'must be RUBRIC|SCORING_JUDGMENT')
    if (!Array.isArray(sa.criteria) || sa.criteria.length < 2) {
      push('scoringAuthority.criteria', 'minItems 2')
    } else {
      sa.criteria.forEach((c, i) => {
        for (const k of extraKeys(c, CRITERION_KEYS)) push(`scoringAuthority.criteria[${i}].${k}`, 'unexpected property')
        if (!c.dimension) push(`scoringAuthority.criteria[${i}].dimension`, 'required')
        if (!Array.isArray(c.levels) || c.levels.length < 2) {
          push(`scoringAuthority.criteria[${i}].levels`, 'minItems 2')
        } else {
          c.levels.forEach((l: RubricLevel, j: number) => {
            for (const k of extraKeys(l, LEVEL_KEYS)) push(`scoringAuthority.criteria[${i}].levels[${j}].${k}`, 'unexpected property')
            if (!l.label) push(`scoringAuthority.criteria[${i}].levels[${j}].label`, 'required')
            if (!l.descriptor || l.descriptor.length < 1) push(`scoringAuthority.criteria[${i}].levels[${j}].descriptor`, 'minLength 1')
          })
        }
      })
    }
  }

  return issues.map((i) => ({ ...i, path: `${scoring.packageId}: ${i.path}` }))
}

export function validateCorpusSchema(entries: readonly CorpusEntry[]): SchemaIssue[] {
  return entries.flatMap((e) => [...validatePackageSchema(e.pkg), ...validateScoringSchema(e.scoring)])
}
