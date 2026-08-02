import {
  GRADE_BANDS,
  MASTERY_SCHEMA_VERSION,
  type PrerequisiteEdge,
  type SkillDefinition,
  type SkillGraph,
} from './contracts.ts'
import { isStableId, type SkillId } from './ids.ts'
import {
  MasteryValidationError,
  isNonEmptyString,
  isPositiveInteger,
  isRecord,
  validationFailure,
  validationSuccess,
  type ValidationIssue,
  type ValidationResult,
} from './validation-types.ts'

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push({
        path: `${path}.${key}`,
        code: 'unknown_property',
        message: `Property "${key}" is not allowed in the mastery graph contract.`,
      })
    }
  }
}

function validateSkill(
  value: unknown,
  path: string,
  graphSubjectId: string | undefined,
  issues: ValidationIssue[],
): value is SkillDefinition {
  if (!isRecord(value)) {
    issues.push({
      path,
      code: 'invalid_type',
      message: 'Skill must be an object.',
    })
    return false
  }
  rejectUnknownKeys(
    value,
    new Set([
      'id',
      'subjectId',
      'title',
      'learningObjective',
      'description',
      'gradeBand',
      'domain',
      'tags',
    ]),
    path,
    issues,
  )

  if (!isStableId(value.id)) {
    issues.push({
      path: `${path}.id`,
      code: 'invalid_stable_id',
      message: 'Skill ID must be a stable opaque identifier.',
    })
  }
  if (!isStableId(value.subjectId)) {
    issues.push({
      path: `${path}.subjectId`,
      code: 'invalid_stable_id',
      message: 'Subject ID must be a stable opaque identifier.',
    })
  } else if (graphSubjectId !== undefined && value.subjectId !== graphSubjectId) {
    issues.push({
      path: `${path}.subjectId`,
      code: 'subject_mismatch',
      message: 'Every skill must use the graph subjectId.',
    })
  }
  if (!isNonEmptyString(value.title, 120)) {
    issues.push({
      path: `${path}.title`,
      code: 'invalid_text',
      message: 'Skill title must contain 1-120 characters.',
    })
  }
  if (!isNonEmptyString(value.learningObjective, 500)) {
    issues.push({
      path: `${path}.learningObjective`,
      code: 'invalid_text',
      message: 'Learning objective must contain 1-500 characters.',
    })
  }
  if (!isNonEmptyString(value.description, 1_000)) {
    issues.push({
      path: `${path}.description`,
      code: 'invalid_text',
      message: 'Description must contain 1-1000 characters.',
    })
  }
  if (
    typeof value.gradeBand !== 'string' ||
    !GRADE_BANDS.includes(value.gradeBand as (typeof GRADE_BANDS)[number])
  ) {
    issues.push({
      path: `${path}.gradeBand`,
      code: 'invalid_enum',
      message: `Grade band must be one of: ${GRADE_BANDS.join(', ')}.`,
    })
  }
  if (!isNonEmptyString(value.domain, 120)) {
    issues.push({
      path: `${path}.domain`,
      code: 'invalid_text',
      message: 'Domain must contain 1-120 characters.',
    })
  }
  if (
    value.tags !== undefined &&
    (!Array.isArray(value.tags) ||
      value.tags.some((tag) => !isNonEmptyString(tag, 80)))
  ) {
    issues.push({
      path: `${path}.tags`,
      code: 'invalid_tags',
      message: 'Tags must be an array of non-empty strings up to 80 characters.',
    })
  }

  return true
}

function validateEdge(
  value: unknown,
  path: string,
  skillIds: ReadonlySet<string>,
  issues: ValidationIssue[],
): value is PrerequisiteEdge {
  if (!isRecord(value)) {
    issues.push({
      path,
      code: 'invalid_type',
      message: 'Prerequisite edge must be an object.',
    })
    return false
  }
  rejectUnknownKeys(
    value,
    new Set([
      'prerequisiteSkillId',
      'dependentSkillId',
      'relation',
      'rationale',
    ]),
    path,
    issues,
  )

  const prerequisiteSkillId = value.prerequisiteSkillId
  const dependentSkillId = value.dependentSkillId

  if (!isStableId(prerequisiteSkillId)) {
    issues.push({
      path: `${path}.prerequisiteSkillId`,
      code: 'invalid_stable_id',
      message: 'Prerequisite skill ID must be a stable opaque identifier.',
    })
  } else if (!skillIds.has(prerequisiteSkillId)) {
    issues.push({
      path: `${path}.prerequisiteSkillId`,
      code: 'dangling_prerequisite',
      message: `Prerequisite skill "${prerequisiteSkillId}" is not in this graph.`,
    })
  }

  if (!isStableId(dependentSkillId)) {
    issues.push({
      path: `${path}.dependentSkillId`,
      code: 'invalid_stable_id',
      message: 'Dependent skill ID must be a stable opaque identifier.',
    })
  } else if (!skillIds.has(dependentSkillId)) {
    issues.push({
      path: `${path}.dependentSkillId`,
      code: 'dangling_dependent',
      message: `Dependent skill "${dependentSkillId}" is not in this graph.`,
    })
  }

  if (
    typeof prerequisiteSkillId === 'string' &&
    prerequisiteSkillId === dependentSkillId
  ) {
    issues.push({
      path,
      code: 'self_dependency',
      message: 'A skill cannot be its own prerequisite.',
    })
  }

  if (value.relation !== 'required') {
    issues.push({
      path: `${path}.relation`,
      code: 'invalid_enum',
      message: 'The only supported prerequisite relation is "required".',
    })
  }
  if (!isNonEmptyString(value.rationale, 500)) {
    issues.push({
      path: `${path}.rationale`,
      code: 'invalid_text',
      message: 'Prerequisite rationale must contain 1-500 characters.',
    })
  }

  return true
}

/**
 * Returns closed cycle paths such as [A, B, C, A]. The function is deterministic
 * with respect to skill and edge order, which makes diagnostics stable.
 */
export function findPrerequisiteCycles(graph: SkillGraph): readonly SkillId[][] {
  const adjacency = new Map<SkillId, SkillId[]>()
  for (const skill of graph.skills) adjacency.set(skill.id, [])
  for (const edge of graph.prerequisites) {
    const dependents = adjacency.get(edge.prerequisiteSkillId)
    if (dependents && adjacency.has(edge.dependentSkillId)) {
      dependents.push(edge.dependentSkillId)
    }
  }

  const visited = new Set<SkillId>()
  const active = new Set<SkillId>()
  const stack: SkillId[] = []
  const cycles: SkillId[][] = []
  const seenCycles = new Set<string>()

  const visit = (skillId: SkillId): void => {
    if (active.has(skillId)) {
      const cycleStart = stack.indexOf(skillId)
      const cycle = [...stack.slice(cycleStart), skillId]
      const key = cycle.join('>')
      if (!seenCycles.has(key)) {
        seenCycles.add(key)
        cycles.push(cycle)
      }
      return
    }
    if (visited.has(skillId)) return

    active.add(skillId)
    stack.push(skillId)
    for (const dependentId of adjacency.get(skillId) ?? []) {
      visit(dependentId)
    }
    stack.pop()
    active.delete(skillId)
    visited.add(skillId)
  }

  for (const skill of graph.skills) visit(skill.id)
  return cycles
}

export function validateSkillGraph(
  value: unknown,
): ValidationResult<SkillGraph> {
  const issues: ValidationIssue[] = []
  if (!isRecord(value)) {
    return validationFailure([
      {
        path: '$',
        code: 'invalid_type',
        message: 'Skill graph must be an object.',
      },
    ])
  }

  rejectUnknownKeys(
    value,
    new Set([
      'kind',
      'schemaVersion',
      'id',
      'revision',
      'subjectId',
      'title',
      'skills',
      'prerequisites',
    ]),
    '$',
    issues,
  )

  if (value.kind !== 'mastery-skill-graph') {
    issues.push({
      path: '$.kind',
      code: 'invalid_discriminant',
      message: 'Skill graph kind must be "mastery-skill-graph".',
    })
  }
  if (value.schemaVersion !== MASTERY_SCHEMA_VERSION) {
    issues.push({
      path: '$.schemaVersion',
      code: 'unsupported_schema_version',
      message: `Only mastery schema version ${MASTERY_SCHEMA_VERSION} is supported.`,
    })
  }
  if (!isStableId(value.id)) {
    issues.push({
      path: '$.id',
      code: 'invalid_stable_id',
      message: 'Graph ID must be a stable opaque identifier.',
    })
  }
  if (!isPositiveInteger(value.revision)) {
    issues.push({
      path: '$.revision',
      code: 'invalid_revision',
      message: 'Graph revision must be a positive integer.',
    })
  }
  if (!isStableId(value.subjectId)) {
    issues.push({
      path: '$.subjectId',
      code: 'invalid_stable_id',
      message: 'Subject ID must be a stable opaque identifier.',
    })
  }
  if (!isNonEmptyString(value.title, 160)) {
    issues.push({
      path: '$.title',
      code: 'invalid_text',
      message: 'Graph title must contain 1-160 characters.',
    })
  }

  if (!Array.isArray(value.skills) || value.skills.length === 0) {
    issues.push({
      path: '$.skills',
      code: 'missing_skills',
      message: 'A skill graph must contain at least one skill.',
    })
  }

  const graphSubjectId =
    typeof value.subjectId === 'string' ? value.subjectId : undefined
  const skills = Array.isArray(value.skills) ? value.skills : []
  skills.forEach((skill, index) =>
    validateSkill(skill, `$.skills[${index}]`, graphSubjectId, issues),
  )

  const skillIds = new Set<string>()
  skills.forEach((skill, index) => {
    if (!isRecord(skill) || typeof skill.id !== 'string') return
    if (skillIds.has(skill.id)) {
      issues.push({
        path: `$.skills[${index}].id`,
        code: 'duplicate_skill_id',
        message: `Skill ID "${skill.id}" occurs more than once.`,
      })
    }
    skillIds.add(skill.id)
  })

  if (!Array.isArray(value.prerequisites)) {
    issues.push({
      path: '$.prerequisites',
      code: 'invalid_type',
      message: 'Prerequisites must be an array.',
    })
  }
  const prerequisites = Array.isArray(value.prerequisites)
    ? value.prerequisites
    : []
  const edgeKeys = new Set<string>()
  prerequisites.forEach((edge, index) => {
    validateEdge(edge, `$.prerequisites[${index}]`, skillIds, issues)
    if (!isRecord(edge)) return
    const key = `${String(edge.prerequisiteSkillId)}>${String(
      edge.dependentSkillId,
    )}`
    if (edgeKeys.has(key)) {
      issues.push({
        path: `$.prerequisites[${index}]`,
        code: 'duplicate_edge',
        message: 'Duplicate prerequisite edges are not allowed.',
      })
    }
    edgeKeys.add(key)
  })

  if (issues.length > 0) return validationFailure(issues)

  const graph = value as unknown as SkillGraph
  for (const cycle of findPrerequisiteCycles(graph)) {
    issues.push({
      path: '$.prerequisites',
      code: 'circular_dependency',
      message: `Circular prerequisite path rejected: ${cycle.join(' -> ')}.`,
    })
  }

  return issues.length > 0
    ? validationFailure(issues)
    : validationSuccess(graph)
}

export function createSkillGraph(value: SkillGraph): SkillGraph {
  const result = validateSkillGraph(value)
  if (!result.ok) {
    throw new MasteryValidationError('Invalid mastery skill graph.', result.issues)
  }
  return result.value
}

export function getSkill(
  graph: SkillGraph,
  skillId: SkillId,
): SkillDefinition | undefined {
  return graph.skills.find((skill) => skill.id === skillId)
}

export function getPrerequisiteEdges(
  graph: SkillGraph,
  skillId: SkillId,
): readonly PrerequisiteEdge[] {
  return graph.prerequisites.filter(
    (edge) => edge.dependentSkillId === skillId,
  )
}

export function getPrerequisiteSkills(
  graph: SkillGraph,
  skillId: SkillId,
): readonly SkillDefinition[] {
  const prerequisiteIds = new Set(
    getPrerequisiteEdges(graph, skillId).map(
      (edge) => edge.prerequisiteSkillId,
    ),
  )
  return graph.skills.filter((skill) => prerequisiteIds.has(skill.id))
}

export function getDependentSkills(
  graph: SkillGraph,
  skillId: SkillId,
): readonly SkillDefinition[] {
  const dependentIds = new Set(
    graph.prerequisites
      .filter((edge) => edge.prerequisiteSkillId === skillId)
      .map((edge) => edge.dependentSkillId),
  )
  return graph.skills.filter((skill) => dependentIds.has(skill.id))
}

export function topologicallySortSkills(
  graph: SkillGraph,
): readonly SkillDefinition[] {
  const valid = validateSkillGraph(graph)
  if (!valid.ok) {
    throw new MasteryValidationError(
      'Cannot sort an invalid mastery skill graph.',
      valid.issues,
    )
  }

  const byId = new Map(graph.skills.map((skill) => [skill.id, skill]))
  const order = new Map(graph.skills.map((skill, index) => [skill.id, index]))
  const incoming = new Map(graph.skills.map((skill) => [skill.id, 0]))
  const outgoing = new Map(
    graph.skills.map((skill) => [skill.id, [] as SkillId[]]),
  )

  for (const edge of graph.prerequisites) {
    incoming.set(
      edge.dependentSkillId,
      (incoming.get(edge.dependentSkillId) ?? 0) + 1,
    )
    outgoing.get(edge.prerequisiteSkillId)?.push(edge.dependentSkillId)
  }

  const ready = graph.skills
    .filter((skill) => incoming.get(skill.id) === 0)
    .map((skill) => skill.id)
  const sorted: SkillDefinition[] = []

  while (ready.length > 0) {
    ready.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0))
    const skillId = ready.shift()
    if (skillId === undefined) break
    const skill = byId.get(skillId)
    if (skill) sorted.push(skill)
    for (const dependentId of outgoing.get(skillId) ?? []) {
      const nextIncoming = (incoming.get(dependentId) ?? 0) - 1
      incoming.set(dependentId, nextIncoming)
      if (nextIncoming === 0) ready.push(dependentId)
    }
  }

  return sorted
}
