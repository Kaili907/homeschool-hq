const MIGRATION_FILE = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/

function canonicalFilename(value) {
  return typeof value === 'string' && MIGRATION_FILE.test(value)
}

function issue(code, filename = null, dependency = null) {
  return Object.freeze({ code, filename, dependency })
}

/**
 * Deterministic, read-only analysis of repository migration names and manifest
 * order. It reports hazards; it never renames files or rewrites history.
 */
export function analyzeMigrationCollisions(filenames, manifest = null) {
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
  const entries = Array.isArray(manifest?.migrations) ? manifest.migrations : null
  if (!entries) {
    orderingHazards.push(issue('manifest_unavailable'))
  } else {
    const manifestNames = []
    const seenNames = new Set()
    let priorVersion = null
    for (const entry of entries) {
      const filename = entry && typeof entry === 'object' ? entry.filename : null
      const version = entry && typeof entry === 'object' ? entry.version : null
      const dependency = entry && typeof entry === 'object' ? entry.dependency : null
      if (!canonicalFilename(filename) || typeof version !== 'string'
        || MIGRATION_FILE.exec(filename)?.[1] !== version) {
        orderingHazards.push(issue('invalid_manifest_entry', canonicalFilename(filename) ? filename : null))
        continue
      }
      if (seenNames.has(filename)) orderingHazards.push(issue('duplicate_manifest_filename', filename))
      if (priorVersion !== null && version <= priorVersion) {
        orderingHazards.push(issue('non_increasing_manifest_version', filename))
      }
      if (dependency !== null) {
        if (!canonicalFilename(dependency)) orderingHazards.push(issue('invalid_dependency', filename))
        else if (!seenNames.has(dependency)) orderingHazards.push(issue('dependency_not_earlier', filename, dependency))
      }
      seenNames.add(filename)
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
    const orderedRepositoryNames = repositoryNames.sort((left, right) => left.localeCompare(right))
    const presentManifestNames = manifestNames.filter((name) => repositorySet.has(name))
    if (orderedRepositoryNames.length === presentManifestNames.length
      && orderedRepositoryNames.some((name, index) => name !== presentManifestNames[index])) {
      orderingHazards.push(issue('manifest_repository_order_mismatch'))
    }
  }

  return Object.freeze({
    migrationCount: names.filter(canonicalFilename).length,
    collisions: Object.freeze(collisions),
    orderingHazards: Object.freeze(orderingHazards),
    ok: collisions.length === 0 && orderingHazards.length === 0,
  })
}

export function isCanonicalMigrationFilename(value) {
  return canonicalFilename(value)
}
