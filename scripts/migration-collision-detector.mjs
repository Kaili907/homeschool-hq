const MIGRATION_FILE = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/
const SHA256 = /^[0-9a-f]{64}$/

function canonicalFilename(value) {
  return typeof value === 'string' && MIGRATION_FILE.test(value)
}

function issue(code, filename = null, dependency = null) {
  return Object.freeze({ code, filename, dependency })
}

function hashFor(actualSha256, filename) {
  if (actualSha256 instanceof Map) return actualSha256.get(filename)
  if (actualSha256 && typeof actualSha256 === 'object') return actualSha256[filename]
  return undefined
}

function findDependencyCycles(dependencies) {
  const cycles = []
  const visited = new Set()
  const active = new Set()

  function visit(filename, trail) {
    if (active.has(filename)) {
      const cycleStart = trail.indexOf(filename)
      cycles.push([...trail.slice(cycleStart), filename])
      return
    }
    if (visited.has(filename)) return
    active.add(filename)
    const dependency = dependencies.get(filename)
    if (dependency && dependencies.has(dependency)) visit(dependency, [...trail, filename])
    active.delete(filename)
    visited.add(filename)
  }

  for (const filename of dependencies.keys()) visit(filename, [])
  return cycles
}

/**
 * Deterministic, read-only analysis of repository migration names and manifest
 * order. It reports hazards; it never renames files or rewrites history.
 */
export function analyzeMigrationCollisions(filenames, manifest = null, actualSha256 = null) {
  const names = Array.isArray(filenames)
    ? [...new Set(filenames.filter((value) => typeof value === 'string'))].sort()
    : []
  const invalidFilenames = names.filter((name) => !canonicalFilename(name))
  const byVersion = new Map()
  for (const name of names.filter(canonicalFilename)) {
    const version = MIGRATION_FILE.exec(name)[1]
    const matching = byVersion.get(version) ?? []
    matching.push(name)
    byVersion.set(version, matching)
  }
  const collisions = [...byVersion.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([version, files]) => Object.freeze({ version, files: Object.freeze([...files].sort()) }))

  const orderingHazards = invalidFilenames.map((name) => issue('invalid_filename', name))
  const integrityHazards = []
  const entries = Array.isArray(manifest?.migrations) ? manifest.migrations : null
  if (!entries) {
    orderingHazards.push(issue('manifest_unavailable'))
  } else {
    const manifestNames = []
    const seenNames = new Set()
    const seenVersions = new Set()
    const dependencies = new Map()
    let priorVersion = null
    for (const [index, entry] of entries.entries()) {
      const filename = entry && typeof entry === 'object' ? entry.filename : null
      const version = entry && typeof entry === 'object' ? entry.version : null
      const dependency = entry && typeof entry === 'object' ? entry.dependency : null
      const expectedSha256 = entry && typeof entry === 'object' ? entry.sha256 : null
      if (!canonicalFilename(filename) || typeof version !== 'string'
        || MIGRATION_FILE.exec(filename)?.[1] !== version) {
        orderingHazards.push(issue('invalid_manifest_entry', canonicalFilename(filename) ? filename : null))
        continue
      }
      if (seenNames.has(filename)) orderingHazards.push(issue('duplicate_manifest_filename', filename))
      if (seenVersions.has(version)) orderingHazards.push(issue('duplicate_manifest_version', filename))
      if (priorVersion !== null && version <= priorVersion) {
        orderingHazards.push(issue('non_increasing_manifest_version', filename))
      }
      if (index > 0 && dependency === null) orderingHazards.push(issue('missing_dependency', filename))
      if (dependency !== null) {
        if (!canonicalFilename(dependency)) orderingHazards.push(issue('invalid_dependency', filename))
        else {
          if (!seenNames.has(dependency)) orderingHazards.push(issue('dependency_not_earlier', filename, dependency))
          dependencies.set(filename, dependency)
        }
      } else {
        dependencies.set(filename, null)
      }
      if (!SHA256.test(expectedSha256 ?? '')) {
        integrityHazards.push(issue('invalid_manifest_sha256', filename))
      } else {
        const actual = hashFor(actualSha256, filename)
        if (actual !== undefined && actual !== expectedSha256) {
          integrityHazards.push(issue('manifest_sha256_mismatch', filename))
        }
      }
      seenNames.add(filename)
      seenVersions.add(version)
      manifestNames.push(filename)
      priorVersion = version
    }
    const repositoryNames = names.filter(canonicalFilename)
    for (const name of repositoryNames) {
      if (!seenNames.has(name)) orderingHazards.push(issue('migration_missing_from_manifest', name))
    }
    const repositorySet = new Set(repositoryNames)
    for (const name of manifestNames) {
      if (!repositorySet.has(name)) orderingHazards.push(issue('manifest_file_missing', name))
    }
    for (const [filename, dependency] of dependencies) {
      if (dependency && !seenNames.has(dependency)) {
        orderingHazards.push(issue('dependency_missing_from_manifest', filename, dependency))
      }
      if (dependency && !repositorySet.has(dependency)) {
        orderingHazards.push(issue('dependency_file_missing', filename, dependency))
      }
    }
    for (const cycle of findDependencyCycles(dependencies)) {
      orderingHazards.push(issue('dependency_cycle', cycle[0], cycle.slice(1).join(' -> ')))
    }
    const orderedRepositoryNames = repositoryNames.sort((left, right) => left.localeCompare(right))
    const presentManifestNames = manifestNames.filter((name) => repositorySet.has(name))
    if (orderedRepositoryNames.length === presentManifestNames.length
      && orderedRepositoryNames.some((name, index) => name !== presentManifestNames[index])) {
      orderingHazards.push(issue('manifest_repository_order_mismatch'))
    }

    if (actualSha256 !== null) {
      const namesByHash = new Map()
      for (const name of repositoryNames) {
        const actual = hashFor(actualSha256, name)
        if (!SHA256.test(actual ?? '')) {
          integrityHazards.push(issue('migration_sha256_unavailable', name))
          continue
        }
        const matching = namesByHash.get(actual) ?? []
        matching.push(name)
        namesByHash.set(actual, matching)
      }
      for (const matching of namesByHash.values()) {
        if (matching.length > 1) {
          integrityHazards.push(issue('duplicate_migration_content', matching.sort().join(', ')))
        }
      }
    }
  }

  return Object.freeze({
    migrationCount: names.filter(canonicalFilename).length,
    collisions: Object.freeze(collisions),
    orderingHazards: Object.freeze(orderingHazards),
    integrityHazards: Object.freeze(integrityHazards),
    ok: collisions.length === 0 && orderingHazards.length === 0
      && integrityHazards.length === 0,
  })
}

export function isCanonicalMigrationFilename(value) {
  return canonicalFilename(value)
}
