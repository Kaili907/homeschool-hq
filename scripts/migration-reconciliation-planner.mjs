import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const MIGRATION_RECONCILIATION_SCHEMA_VERSION = 1
export const MIGRATION_RECONCILIATION_PLANNER_COMMAND =
  'npm.cmd run plan:migration-reconciliation -- --proposal <path>'

const MIGRATION_FILENAME = /^(\d{14})_(.+)\.sql$/
const VERSION = /^\d{14}$/
const APPROVAL_REFERENCE = /^[A-Z0-9][A-Z0-9._/-]{2,80}$/
const REFERENCE_EXTENSIONS = new Set([
  '.cjs', '.js', '.json', '.md', '.mjs', '.ps1', '.sh', '.sql', '.toml',
  '.ts', '.tsx', '.txt', '.yaml', '.yml',
])
const IGNORED_REFERENCE_DIRECTORIES = new Set([
  '.git', '.turbo', 'build', 'coverage', 'dist', 'node_modules',
])

function checksum(source) {
  return createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex')
}

function migrationVersion(filename) {
  return typeof filename === 'string' ? MIGRATION_FILENAME.exec(filename)?.[1] ?? null : null
}

function dependencyFilenames(entry) {
  if (Array.isArray(entry?.dependencies)) return entry.dependencies
  if (entry?.dependency === null || entry?.dependency === undefined) return []
  return [entry.dependency]
}

function normalizedPath(path) {
  return path.split(sep).join('/')
}

function error(code, details = {}) {
  return { code, ...details }
}

function uniqueSorted(values) {
  return [...new Set(values)].sort()
}

function safetySource(safety) {
  return safety?.migrationIdentity && typeof safety.migrationIdentity === 'object'
    ? safety.migrationIdentity
    : safety ?? {}
}

function safetyFilenames(values) {
  if (!Array.isArray(values)) return []
  return values
    .map((value) => typeof value === 'string' ? value : value?.filename)
    .filter((value) => typeof value === 'string')
}

function validateSafety(safety) {
  const source = safetySource(safety)
  const errors = []
  for (const field of ['frozenHistoricalMigrations', 'appliedMigrations', 'appliedRenumberingPolicies']) {
    if (source[field] !== undefined && !Array.isArray(source[field])) {
      errors.push(error('SAFETY_CONTRACT_INVALID', { field }))
    }
  }
  for (const field of ['frozenThroughVersion', 'appliedThroughVersion']) {
    if (source[field] !== undefined && !VERSION.test(source[field])) {
      errors.push(error('SAFETY_CONTRACT_INVALID', { field }))
    }
  }
  for (const field of ['frozenHistoricalMigrations', 'appliedMigrations']) {
    if (Array.isArray(source[field]) && source[field].some((value) =>
      typeof value !== 'string' && typeof value?.filename !== 'string',
    )) {
      errors.push(error('SAFETY_CONTRACT_INVALID', { field }))
    }
  }
  return errors
}

function hasAppliedRenumberingPolicy(safety, filename, fromVersion, toVersion) {
  const source = safetySource(safety)
  return Array.isArray(source.appliedRenumberingPolicies) &&
    source.appliedRenumberingPolicies.some((policy) =>
      policy?.approved === true &&
      policy?.filename === filename &&
      policy?.fromVersion === fromVersion &&
      policy?.toVersion === toVersion &&
      APPROVAL_REFERENCE.test(policy?.approvalReference ?? ''),
    )
}

function isExplicitlyApplied(entry) {
  return ['applied', 'applied-hosted', 'hosted-applied'].includes(entry?.applicationStatus)
}

function protectedState(manifestEntry, safety, filename, version) {
  const source = safetySource(safety)
  const frozenFiles = new Set(safetyFilenames(source.frozenHistoricalMigrations))
  const appliedFiles = new Set(safetyFilenames(source.appliedMigrations))
  const frozenThroughVersion = VERSION.test(source.frozenThroughVersion ?? '')
    ? source.frozenThroughVersion
    : null
  const appliedThroughVersion = VERSION.test(source.appliedThroughVersion ?? '')
    ? source.appliedThroughVersion
    : null
  const frozen = manifestEntry?.classification === 'historical-baseline' ||
    frozenFiles.has(filename) ||
    (frozenThroughVersion !== null && version <= frozenThroughVersion)
  const applied = isExplicitlyApplied(manifestEntry) ||
    appliedFiles.has(filename) ||
    (appliedThroughVersion !== null && version <= appliedThroughVersion)
  return { frozen, applied, frozenThroughVersion, appliedThroughVersion }
}

export async function inventoryMigrationFiles(migrationDirectory) {
  const entries = await readdir(migrationDirectory, { withFileTypes: true })
  const sqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort()
  return Promise.all(sqlFiles.map(async (filename) => {
    const source = await readFile(resolve(migrationDirectory, filename), 'utf8')
    return {
      filename,
      version: migrationVersion(filename),
      sha256: checksum(source),
      sizeBytes: Buffer.byteLength(source),
      source,
    }
  }))
}

function validateManifest(manifest, inventory) {
  const errors = []
  const entries = Array.isArray(manifest?.migrations) ? manifest.migrations : []
  if (manifest?.schemaVersion !== MIGRATION_RECONCILIATION_SCHEMA_VERSION || entries.length === 0) {
    errors.push(error('MANIFEST_INVALID_OR_EMPTY'))
  }
  const byFilename = new Map()
  for (const entry of entries) {
    if (typeof entry?.filename !== 'string' || byFilename.has(entry.filename)) {
      errors.push(error('MANIFEST_FILENAME_INVALID_OR_REUSED', { filename: entry?.filename ?? null }))
      continue
    }
    byFilename.set(entry.filename, entry)
    const filenameVersion = migrationVersion(entry.filename)
    if (!VERSION.test(entry.version ?? '') || filenameVersion !== entry.version) {
      errors.push(error('MANIFEST_VERSION_FILENAME_MISMATCH', {
        filename: entry.filename,
        manifestVersion: entry.version ?? null,
        filenameVersion,
      }))
    }
    const dependencies = dependencyFilenames(entry)
    if (dependencies.some((dependency) => typeof dependency !== 'string') ||
        (Array.isArray(entry.dependencies) && entry.dependency !== undefined)) {
      errors.push(error('MANIFEST_DEPENDENCY_CONTRACT_INVALID', { filename: entry.filename }))
    }
  }
  const inventoryByFilename = new Map(inventory.map((entry) => [entry.filename, entry]))
  for (const item of inventory) {
    if (item.version === null) {
      errors.push(error('MIGRATION_FILENAME_INVALID', { filename: item.filename }))
      continue
    }
    const entry = byFilename.get(item.filename)
    if (!entry) {
      errors.push(error('MISSING_MANIFEST_ENTRY', { filename: item.filename }))
      continue
    }
    if (entry.version !== item.version) {
      errors.push(error('MANIFEST_VERSION_MISMATCH', {
        filename: item.filename,
        actualVersion: item.version,
        manifestVersion: entry.version ?? null,
      }))
    }
    if (typeof entry.sha256 !== 'string' || entry.sha256.toLowerCase() !== item.sha256) {
      errors.push(error('CHECKSUM_MISMATCH', {
        filename: item.filename,
        actualSha256: item.sha256,
        manifestSha256: typeof entry.sha256 === 'string' ? entry.sha256.toLowerCase() : null,
      }))
    }
  }
  for (const entry of entries) {
    if (!inventoryByFilename.has(entry.filename)) {
      errors.push(error('ORPHAN_MANIFEST_ENTRY', { filename: entry.filename }))
    }
    for (const dependency of dependencyFilenames(entry)) {
      if (!byFilename.has(dependency)) {
        errors.push(error('DEPENDENCY_MANIFEST_ENTRY_MISSING', {
          filename: entry.filename,
          dependency,
        }))
      }
    }
  }
  return { entries, byFilename, errors }
}

function buildDependencyGraph(entries, finalVersions) {
  const errors = []
  const filenames = entries.map((entry) => entry.filename).filter((filename) => typeof filename === 'string')
  const known = new Set(filenames)
  const outgoing = new Map(filenames.map((filename) => [filename, []]))
  const indegree = new Map(filenames.map((filename) => [filename, 0]))
  const edges = []
  for (const entry of entries) {
    if (!known.has(entry.filename)) continue
    for (const dependency of dependencyFilenames(entry)) {
      if (!known.has(dependency)) continue
      edges.push({ dependency, dependent: entry.filename })
      outgoing.get(dependency).push(entry.filename)
      indegree.set(entry.filename, indegree.get(entry.filename) + 1)
      const dependencyVersion = finalVersions.get(dependency)
      const dependentVersion = finalVersions.get(entry.filename)
      if (dependencyVersion && dependentVersion && dependencyVersion >= dependentVersion) {
        errors.push(error('DEPENDENCY_INVERSION', {
          dependency,
          dependencyVersion,
          dependent: entry.filename,
          dependentVersion,
        }))
      }
    }
  }
  edges.sort((left, right) =>
    left.dependency.localeCompare(right.dependency) || left.dependent.localeCompare(right.dependent),
  )
  const ready = filenames.filter((filename) => indegree.get(filename) === 0)
  const sortReady = () => ready.sort((left, right) =>
    (finalVersions.get(left) ?? '').localeCompare(finalVersions.get(right) ?? '') || left.localeCompare(right),
  )
  sortReady()
  const topologicalOrder = []
  while (ready.length > 0) {
    const filename = ready.shift()
    topologicalOrder.push(filename)
    for (const dependent of outgoing.get(filename).sort()) {
      indegree.set(dependent, indegree.get(dependent) - 1)
      if (indegree.get(dependent) === 0) {
        ready.push(dependent)
        sortReady()
      }
    }
  }
  const cycleMembers = filenames.filter((filename) => !topologicalOrder.includes(filename)).sort()
  if (cycleMembers.length > 0) errors.push(error('DEPENDENCY_CYCLE', { filenames: cycleMembers }))
  return { edges, topologicalOrder, cycleMembers, errors }
}

function validateProposal(proposal, inventory, manifestByFilename, safety) {
  const errors = []
  const warnings = []
  const mappings = new Map()
  const reconciliations = proposal === null || proposal === undefined
    ? []
    : Array.isArray(proposal?.reconciliations) ? proposal.reconciliations : null
  if (proposal !== null && proposal !== undefined &&
      (proposal.schemaVersion !== MIGRATION_RECONCILIATION_SCHEMA_VERSION || reconciliations === null)) {
    errors.push(error('PROPOSAL_CONTRACT_INVALID'))
  }
  const inventoryByFilename = new Map(inventory.map((entry) => [entry.filename, entry]))
  for (const reconciliation of reconciliations ?? []) {
    const filename = reconciliation?.filename
    const replacementVersion = reconciliation?.replacementVersion
    if (typeof filename !== 'string' || !VERSION.test(replacementVersion ?? '')) {
      errors.push(error('PROPOSAL_ENTRY_INVALID', {
        filename: typeof filename === 'string' ? filename : null,
        replacementVersion: typeof replacementVersion === 'string' ? replacementVersion : null,
      }))
      continue
    }
    if (mappings.has(filename)) {
      errors.push(error('PROPOSAL_FILENAME_REUSED', { filename }))
      continue
    }
    if (!inventoryByFilename.has(filename)) {
      errors.push(error('PROPOSAL_MIGRATION_UNKNOWN', { filename }))
      continue
    }
    mappings.set(filename, replacementVersion)
  }
  const sourceVersionCounts = new Map()
  for (const item of inventory) {
    sourceVersionCounts.set(item.version, (sourceVersionCounts.get(item.version) ?? 0) + 1)
  }
  for (const [filename, replacementVersion] of mappings) {
    const item = inventoryByFilename.get(filename)
    if (replacementVersion !== item.version && sourceVersionCounts.get(item.version) === 1) {
      warnings.push(error('NON_COLLIDING_MIGRATION_RENUMBERED', { filename }))
    }
    const state = protectedState(manifestByFilename.get(filename), safety, filename, item.version)
    if (replacementVersion !== item.version && state.frozen) {
      errors.push(error('FROZEN_HISTORICAL_RENUMBER_FORBIDDEN', { filename }))
    } else if (replacementVersion !== item.version && state.applied &&
        !hasAppliedRenumberingPolicy(safety, filename, item.version, replacementVersion)) {
      errors.push(error('APPLIED_MIGRATION_RENUMBER_POLICY_REQUIRED', {
        filename,
        currentVersion: item.version,
        replacementVersion,
      }))
    }
  }
  return { errors, warnings, mappings }
}

function plannedFilename(filename, replacementVersion) {
  return `${replacementVersion}_${filename.slice(15)}`
}

async function referenceFiles(root) {
  const files = []
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isDirectory()) {
        if (!IGNORED_REFERENCE_DIRECTORIES.has(entry.name)) await visit(resolve(directory, entry.name))
      } else if (entry.isFile() && REFERENCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        files.push(resolve(directory, entry.name))
      }
    }
  }
  await visit(root)
  return files
}

async function scanReferences(referenceRoots, changedMappings, exclusions) {
  if (changedMappings.length === 0) return []
  const excluded = exclusions.map((path) => resolve(path).toLowerCase())
  const byToken = new Map()
  for (const mapping of changedMappings) {
    const tokens = mapping.changed
      ? [mapping.filename, mapping.currentVersion]
      : [mapping.currentVersion]
    for (const token of tokens) {
      const values = byToken.get(token) ?? []
      values.push(mapping)
      byToken.set(token, values)
    }
  }
  const results = []
  for (const rootValue of referenceRoots) {
    const root = resolve(rootValue)
    for (const path of await referenceFiles(root)) {
      const lowerPath = path.toLowerCase()
      if (excluded.some((excludedPath) =>
        lowerPath === excludedPath || lowerPath.startsWith(`${excludedPath}${sep}`),
      )) continue
      let source
      try {
        source = await readFile(path, 'utf8')
      } catch {
        continue
      }
      const matches = []
      for (const [token, mappings] of [...byToken.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        if (!source.includes(token)) continue
        matches.push({
          token,
          kind: token.endsWith('.sql') ? 'filename' : 'version',
          migrations: uniqueSorted(mappings.map((mapping) => mapping.filename)),
          replacements: uniqueSorted(mappings.map((mapping) =>
            token.endsWith('.sql') ? mapping.replacementFilename : mapping.replacementVersion,
          )),
          ambiguous: mappings.length > 1,
        })
      }
      if (matches.length > 0) {
        results.push({
          root: normalizedPath(root),
          path: normalizedPath(relative(root, path)),
          matches,
        })
      }
    }
  }
  return results.sort((left, right) =>
    left.root.localeCompare(right.root) || left.path.localeCompare(right.path),
  )
}

function migrationContentReferences(inventory, changedMappings) {
  const references = []
  for (const item of inventory) {
    const matches = []
    for (const mapping of changedMappings) {
      const tokens = mapping.changed
        ? [mapping.filename, mapping.currentVersion]
        : [mapping.currentVersion]
      for (const token of tokens) {
        if (item.source.includes(token)) matches.push(token)
      }
    }
    if (matches.length > 0) references.push({ filename: item.filename, tokens: uniqueSorted(matches) })
  }
  return references
}

export async function createMigrationReconciliationPlan({
  migrationDirectory,
  manifest,
  manifestPath = 'migration-manifest.json',
  proposal = null,
  proposalPath = null,
  safety = {},
  safetyPath = null,
  referenceRoots = [],
}) {
  const inventoryWithSource = await inventoryMigrationFiles(migrationDirectory)
  const { entries, byFilename: manifestByFilename, errors: manifestErrors } =
    validateManifest(manifest, inventoryWithSource)
  const safetyErrors = validateSafety(safety)
  const proposalValidation = validateProposal(proposal, inventoryWithSource, manifestByFilename, safety)
  const finalVersions = new Map(inventoryWithSource.map((item) => [
    item.filename,
    proposalValidation.mappings.get(item.filename) ?? item.version,
  ]))
  const destinationGroups = new Map()
  for (const [filename, version] of finalVersions) {
    if (!version) continue
    const filenames = destinationGroups.get(version) ?? []
    filenames.push(filename)
    destinationGroups.set(version, filenames)
  }
  const destinationErrors = [...destinationGroups.entries()]
    .filter(([, filenames]) => filenames.length > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([version, filenames]) => error('DESTINATION_VERSION_REUSED', {
      version,
      filenames: filenames.sort(),
    }))
  const collisions = [...new Set(inventoryWithSource.map((item) => item.version))]
    .filter((version) => version !== null)
    .map((version) => ({
      version,
      migrations: inventoryWithSource
        .filter((item) => item.version === version)
        .map((item) => item.filename)
        .sort(),
    }))
    .filter((group) => group.migrations.length > 1)
    .sort((left, right) => left.version.localeCompare(right.version))
  const dependencyGraph = buildDependencyGraph(entries, finalVersions)
  const proposedVersionMap = inventoryWithSource.map((item) => {
    const replacementVersion = finalVersions.get(item.filename)
    const replacementFilename = replacementVersion
      ? plannedFilename(item.filename, replacementVersion)
      : item.filename
    const manifestEntry = manifestByFilename.get(item.filename)
    const state = protectedState(manifestEntry, safety, item.filename, item.version)
    return {
      filename: item.filename,
      currentVersion: item.version,
      replacementVersion,
      replacementFilename,
      changed: replacementVersion !== item.version,
      currentChecksum: item.sha256,
      postRenameContentUnchangedChecksum: item.sha256,
      classification: manifestEntry?.classification ?? null,
      applicationStatus: manifestEntry?.applicationStatus ?? null,
      frozenHistorical: state.frozen,
      knownApplied: state.applied,
    }
  })
  const changedMappings = proposedVersionMap.filter((mapping) => mapping.changed)
  const changedVersions = new Set(changedMappings.map((mapping) => mapping.currentVersion))
  const identityReferenceMappings = proposedVersionMap.filter((mapping) =>
    changedVersions.has(mapping.currentVersion),
  )
  const contentReferences = migrationContentReferences(inventoryWithSource, identityReferenceMappings)
    .map((reference) => {
      const item = inventoryWithSource.find((candidate) => candidate.filename === reference.filename)
      const manifestEntry = manifestByFilename.get(reference.filename)
      return {
        ...reference,
        currentChecksum: item?.sha256 ?? null,
        manifestDeclaredChecksum: typeof manifestEntry?.sha256 === 'string'
          ? manifestEntry.sha256.toLowerCase()
          : null,
        afterContentEditChecksum: null,
        checksumAction: 'RECOMPUTE_AFTER_CONTENT_EDIT_IF_CHANGED',
      }
    })
  const contentReferenceFiles = new Set(contentReferences.map((entry) => entry.filename))
  const manifestChanges = changedMappings.map((mapping) => ({
    manifestPath: normalizedPath(manifestPath),
    currentFilename: mapping.filename,
    replacementFilename: mapping.replacementFilename,
    fields: {
      version: { from: mapping.currentVersion, to: mapping.replacementVersion },
      filename: { from: mapping.filename, to: mapping.replacementFilename },
      sha256: {
        current: mapping.currentChecksum,
        postRenameContentUnchanged: mapping.postRenameContentUnchangedChecksum,
        afterContentEdit: null,
        action: contentReferenceFiles.has(mapping.filename)
          ? 'RECOMPUTE_AFTER_CONTENT_REVIEW'
          : 'PRESERVE_IF_RENAME_ONLY',
      },
    },
  }))
  const dependencyReferenceChanges = []
  const changedByFilename = new Map(changedMappings.map((mapping) => [mapping.filename, mapping]))
  for (const entry of entries) {
    for (const dependency of dependencyFilenames(entry)) {
      const replacement = changedByFilename.get(dependency)
      if (replacement) {
        dependencyReferenceChanges.push({
          manifestPath: normalizedPath(manifestPath),
          dependent: entry.filename,
          from: dependency,
          to: replacement.replacementFilename,
        })
      }
    }
  }
  const exclusions = [migrationDirectory, manifestPath]
  if (proposalPath) exclusions.push(proposalPath)
  if (safetyPath) exclusions.push(safetyPath)
  const affectedReferences = await scanReferences(referenceRoots, identityReferenceMappings, exclusions)
  const unsafeOperations = [
    ...proposalValidation.errors
      .filter((item) => item.code.includes('FROZEN') || item.code.includes('APPLIED')),
  ]
  const allErrors = [
    ...manifestErrors,
    ...safetyErrors,
    ...proposalValidation.errors,
    ...destinationErrors,
    ...dependencyGraph.errors,
  ]
  const source = safetySource(safety)
  const plan = {
    schemaVersion: MIGRATION_RECONCILIATION_SCHEMA_VERSION,
    tool: 'migration-reconciliation-planner',
    mode: 'READ_ONLY',
    mutationPerformed: false,
    inputs: {
      migrationDirectory: normalizedPath(migrationDirectory),
      manifestPath: normalizedPath(manifestPath),
      proposalPath: proposalPath ? normalizedPath(proposalPath) : null,
      safetyPath: safetyPath ? normalizedPath(safetyPath) : null,
      referenceRoots: referenceRoots.map((path) => normalizedPath(resolve(path))),
    },
    inventory: inventoryWithSource.map(({ source: _source, ...item }) => ({
      ...item,
      manifestEntryPresent: manifestByFilename.has(item.filename),
    })),
    collisions,
    dependencyGraph: {
      edges: dependencyGraph.edges,
      topologicalOrder: dependencyGraph.topologicalOrder,
      cycleMembers: dependencyGraph.cycleMembers,
    },
    immutableBoundaries: {
      frozenThroughVersion: VERSION.test(source.frozenThroughVersion ?? '')
        ? source.frozenThroughVersion
        : null,
      appliedThroughVersion: VERSION.test(source.appliedThroughVersion ?? '')
        ? source.appliedThroughVersion
        : null,
      frozenHistoricalMigrations: proposedVersionMap
        .filter((mapping) => mapping.frozenHistorical)
        .map((mapping) => mapping.filename),
      knownAppliedMigrations: proposedVersionMap
        .filter((mapping) => mapping.knownApplied)
        .map((mapping) => mapping.filename),
    },
    proposedVersionMap,
    affectedManifestEntries: manifestChanges,
    affectedDependencyReferences: dependencyReferenceChanges,
    affectedMigrationContents: contentReferences,
    affectedTestsAndDocs: affectedReferences,
    unsafeOperations,
    warnings: proposalValidation.warnings,
    errors: allErrors,
    validation: {
      valid: allErrors.length === 0,
      result: allErrors.length === 0 ? 'VALID_CANDIDATE_PLAN' : 'BLOCKED',
      errorCodes: allErrors.map((item) => item.code),
    },
  }
  return plan
}

export function formatMigrationReconciliationOperatorPlan(plan) {
  const lines = [
    'Migration reconciliation planner',
    'Mode: READ ONLY (no files renamed or modified)',
    `Final validation: ${plan.validation.result}`,
    `Inventory: ${plan.inventory.length} migration(s)`,
    `Collision groups: ${plan.collisions.length}`,
  ]
  for (const collision of plan.collisions) {
    lines.push(`- ${collision.version}: ${collision.migrations.join(', ')}`)
  }
  lines.push(`Dependency edges: ${plan.dependencyGraph.edges.length}`)
  if (plan.dependencyGraph.topologicalOrder.length > 0) {
    lines.push('Dependency order:')
    for (const filename of plan.dependencyGraph.topologicalOrder) lines.push(`- ${filename}`)
  }
  lines.push(
    `Frozen historical migrations: ${plan.immutableBoundaries.frozenHistoricalMigrations.length}`,
    `Known hosted/applied migrations: ${plan.immutableBoundaries.knownAppliedMigrations.length}`,
    'Proposed version map:',
  )
  for (const mapping of plan.proposedVersionMap) {
    const marker = mapping.changed ? 'RENUMBER' : 'KEEP'
    lines.push(`- [${marker}] ${mapping.filename} -> ${mapping.replacementFilename}`)
  }
  lines.push(`Affected manifest entries: ${plan.affectedManifestEntries.length}`)
  for (const change of plan.affectedManifestEntries) {
    lines.push(`- ${change.currentFilename} -> ${change.replacementFilename}`)
    lines.push(`  checksum: ${change.fields.sha256.action}; current=${change.fields.sha256.current}; post-rename-content-unchanged=${change.fields.sha256.postRenameContentUnchanged}; after-content-edit=UNKNOWN`)
  }
  lines.push(`Affected dependency references: ${plan.affectedDependencyReferences.length}`)
  for (const change of plan.affectedDependencyReferences) {
    lines.push(`- ${change.dependent}: ${change.from} -> ${change.to}`)
  }
  lines.push(`Affected migration contents: ${plan.affectedMigrationContents.length}`)
  lines.push(`Affected tests/docs: ${plan.affectedTestsAndDocs.length}`)
  for (const reference of plan.affectedTestsAndDocs) {
    lines.push(`- ${reference.path}${reference.matches.some((match) => match.ambiguous) ? ' [AMBIGUOUS VERSION REFERENCE]' : ''}`)
  }
  if (plan.warnings.length > 0) {
    lines.push('Warnings:')
    for (const item of plan.warnings) lines.push(`- ${item.code}`)
  }
  if (plan.unsafeOperations.length > 0) {
    lines.push('Unsafe operations:')
    for (const item of plan.unsafeOperations) lines.push(`- ${item.code}: ${item.filename}`)
  }
  if (plan.errors.length > 0) {
    lines.push('Validation errors:')
    for (const item of plan.errors) {
      const identity = item.filename ?? item.version ?? item.dependent ?? ''
      lines.push(`- ${item.code}${identity ? `: ${identity}` : ''}`)
    }
  }
  lines.push(`Result: ${plan.validation.result}`, 'Mutations performed: NO')
  return `${lines.join('\n')}\n`
}

function valueAfter(args, flag, fallback) {
  const index = args.indexOf(flag)
  return index < 0 ? fallback : args[index + 1]
}

function valuesAfter(args, flag) {
  const values = []
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) values.push(args[index + 1])
  }
  return values
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function main() {
  const args = process.argv.slice(2)
  const migrationDirectory = resolve(valueAfter(args, '--migrations', 'supabase/migrations'))
  const manifestPath = resolve(valueAfter(
    args,
    '--manifest',
    'docs/study-engine-final-production/migration-manifest.json',
  ))
  const proposalValue = valueAfter(args, '--proposal', null)
  const safetyValue = valueAfter(
    args,
    '--safety',
    'docs/admin-production-preflight/deployment-contract.json',
  )
  const format = valueAfter(args, '--format', 'operator')
  const referenceValues = valuesAfter(args, '--references')
  const referenceRoots = args.includes('--no-reference-scan')
    ? []
    : referenceValues.length > 0 ? referenceValues.map((value) => resolve(value)) : [process.cwd()]
  if (!['operator', 'json'].includes(format) ||
      args.includes('--apply') ||
      [migrationDirectory, manifestPath].some((value) => !value)) {
    throw new Error('Usage: migration-reconciliation-planner [--migrations path] [--manifest path] [--proposal path] [--safety path] [--references path] [--no-reference-scan] [--format operator|json] (apply mode is not supported)')
  }
  const proposalPath = proposalValue ? resolve(proposalValue) : null
  const safetyPath = safetyValue ? resolve(safetyValue) : null
  const [manifest, proposal, safety] = await Promise.all([
    loadJson(manifestPath),
    proposalPath ? loadJson(proposalPath) : null,
    safetyPath ? loadJson(safetyPath) : {},
  ])
  const plan = await createMigrationReconciliationPlan({
    migrationDirectory,
    manifest,
    manifestPath,
    proposal,
    proposalPath,
    safety,
    safetyPath,
    referenceRoots,
  })
  process.stdout.write(format === 'json'
    ? `${JSON.stringify(plan)}\n`
    : formatMigrationReconciliationOperatorPlan(plan))
  if (!plan.validation.valid) process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((caught) => {
    process.stderr.write(`${caught instanceof Error ? caught.message : 'migration_reconciliation_planner_failed'}\n`)
    process.exitCode = 1
  })
}
