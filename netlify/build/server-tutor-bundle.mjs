/**
 * Deterministic server-only Tutor prebundle for the Node 22 Netlify runtime.
 *
 * This module produces build artifacts only. Its output stays under
 * netlify/build/generated/, outside the published netlify/functions/ tree,
 * until a separately reviewed handler copies or imports it deliberately.
 */
import { createHash } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import {
  FROZEN_PACKAGE_ALIAS_SOURCES,
  FROZEN_TUTOR_PACKAGE,
  frozenPackageAliases,
} from '../../scripts/frozen-package-aliases.mjs'

const repoRoot = new URL('../../', import.meta.url)
const repoRootPath = fileURLToPath(repoRoot)

export const SERVER_TUTOR_ARTIFACT_SCHEMA_VERSION = 'study-server-tutor-prebundle.v1'
export const SERVER_TUTOR_BUNDLE_FILE = 'server-tutor.mjs'
export const SERVER_TUTOR_MANIFEST_FILE = 'server-tutor.manifest.json'
export const SERVER_TUTOR_ENTRY_POINT = 'netlify/build/server-tutor-entry.ts'
export const DEFAULT_SERVER_TUTOR_OUTPUT_DIRECTORY = 'netlify/build/generated'

/** The complete production Tutor surface retained for the feasibility gate. */
export const PRODUCTION_TUTOR_ENTRY_POINTS = Object.freeze([
  'src/study/production/tutorAdapter.ts',
  'src/study/production/tutorRuntime.ts',
  'src/study/production/tutorPseudonym.ts',
  'src/study/production/tutorPresentation.ts',
  'src/study/production/tutorLaunchOrdering.ts',
])

export const TUTOR_ADAPTER_ENTRY_POINT = 'src/study/production/tutorAdapter.ts'

export const NETLIFY_FUNCTION_BUILD = Object.freeze({
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
})

export async function bundleProductionTutor({ entryPoints, alias }) {
  return build({
    ...NETLIFY_FUNCTION_BUILD,
    absWorkingDir: repoRootPath,
    entryPoints,
    outdir: fileURLToPath(new URL('.netlify-build-probe/', repoRoot)),
    alias,
    write: false,
    logLevel: 'silent',
  })
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    throw new Error(`${label} is not valid JSON.`, { cause: error })
  }
}

async function requiredFile(path, label) {
  try {
    return await readFile(path)
  } catch (error) {
    throw new Error(`${label} is missing: ${path}`, { cause: error })
  }
}

async function recursiveFiles(root) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort()
}

/**
 * Verifies the external custody pin, package metadata and every frozen file
 * before esbuild sees the package. The optional root exists only for hostile
 * build tests; all expected values remain the reviewed canonical pins.
 */
export async function verifyFrozenTutorCustody({ packageRoot } = {}) {
  const frozenRoot = packageRoot ?? fileURLToPath(new URL(FROZEN_TUTOR_PACKAGE.packageRoot, repoRoot))
  try {
    await access(frozenRoot)
  } catch (error) {
    throw new Error(`Frozen Tutor package is missing: ${frozenRoot}`, { cause: error })
  }

  const packageJsonBytes = await requiredFile(join(frozenRoot, 'package.json'), 'Frozen Tutor package.json')
  const manifestBytes = await requiredFile(join(frozenRoot, 'manifest.json'), 'Frozen Tutor manifest')
  const sumsBytes = await requiredFile(
    join(frozenRoot, FROZEN_TUTOR_PACKAGE.checksumManifest),
    'Frozen Tutor checksum manifest',
  )
  const packageJson = parseJson(packageJsonBytes, 'Frozen Tutor package.json')
  const manifest = parseJson(manifestBytes, 'Frozen Tutor manifest')

  if (packageJson.name !== FROZEN_TUTOR_PACKAGE.packageName) {
    throw new Error(`Frozen Tutor package name mismatch: ${String(packageJson.name)}`)
  }
  if (packageJson.version !== FROZEN_TUTOR_PACKAGE.packageVersion) {
    throw new Error(`Frozen Tutor package version mismatch: ${String(packageJson.version)}`)
  }
  if (manifest.version !== FROZEN_TUTOR_PACKAGE.manifestVersion) {
    throw new Error(`Frozen Tutor manifest version mismatch: ${String(manifest.version)}`)
  }

  const sumsDigest = sha256(sumsBytes)
  if (sumsDigest !== FROZEN_TUTOR_PACKAGE.checksumManifestSha256) {
    throw new Error(`Frozen Tutor checksum manifest mismatch: ${sumsDigest}`)
  }

  const entries = sumsBytes
    .toString('utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^([0-9a-f]{64})\s+\.\/(.+)$/.exec(line)
      if (!match || match[2].includes('..') || isAbsolute(match[2])) {
        throw new Error(`Frozen Tutor checksum entry is invalid: ${line}`)
      }
      return { digest: match[1], path: match[2].split('/').join(sep) }
    })

  if (new Set(entries.map((entry) => entry.path)).size !== entries.length) {
    throw new Error('Frozen Tutor checksum manifest contains duplicate paths.')
  }
  for (const entry of entries) {
    const actual = sha256(await requiredFile(join(frozenRoot, entry.path), `Frozen Tutor file ${entry.path}`))
    if (actual !== entry.digest) throw new Error(`Frozen Tutor file checksum mismatch: ${entry.path}`)
  }

  const expectedFiles = new Set([
    ...entries.map((entry) => entry.path.split(sep).join('/')),
    FROZEN_TUTOR_PACKAGE.checksumManifest,
  ])
  const actualFiles = await recursiveFiles(frozenRoot)
  const unexpected = actualFiles.filter((path) => !expectedFiles.has(path))
  const missing = [...expectedFiles].filter((path) => !actualFiles.includes(path))
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `Frozen Tutor file set mismatch: unexpected=[${unexpected.join(',')}], missing=[${missing.join(',')}]`,
    )
  }

  return Object.freeze({
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    manifestVersion: manifest.version,
    checksumManifestSha256: sumsDigest,
    checksumEntryCount: entries.length,
  })
}

function repoRelativePath(path) {
  const normalized = relative(repoRootPath, path).split(sep).join('/')
  if (normalized === '' || normalized === '..' || normalized.startsWith('../')) {
    throw new Error('Host-content mapping artifacts must live inside the repository.')
  }
  return normalized
}

function resolveRepoArtifact(path, label) {
  if (typeof path !== 'string' || isAbsolute(path)) {
    throw new Error(`${label} path must be repository-relative.`)
  }
  const resolved = resolve(repoRootPath, path)
  repoRelativePath(resolved)
  return resolved
}

function validSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

async function resolveHostContentMapping(mapping) {
  if (mapping?.mode === 'test') {
    if (!mapping.fixturePath) throw new Error('Test mode requires a dedicated mapping fixture.')
    if (mapping.artifactPath || mapping.expectedSha256) {
      throw new Error('Production mapping arguments are not accepted in test mode.')
    }
    const fixturePath = resolveRepoArtifact(mapping.fixturePath, 'Test host-content mapping fixture')
    const bytes = await requiredFile(fixturePath, 'Test host-content mapping fixture')
    return Object.freeze({
      status: 'test-fixture',
      artifactPath: repoRelativePath(fixturePath),
      sha256: sha256(bytes),
    })
  }

  if (mapping?.mode !== 'production') {
    throw new Error('A host-content mapping mode is required.')
  }
  if (!mapping.artifactPath || !mapping.expectedSha256) {
    throw new Error('Production mode requires a reviewed mapping artifact and SHA-256 digest.')
  }
  if (/\.test\.[^/\\]+$/i.test(mapping.artifactPath)) {
    throw new Error('A test mapping fixture cannot be used in production mode.')
  }
  if (!validSha256(mapping.expectedSha256)) {
    throw new Error('Production mapping digest must be a lower-case SHA-256 value.')
  }
  const artifactPath = resolveRepoArtifact(mapping.artifactPath, 'Production host-content mapping artifact')
  const bytes = await requiredFile(artifactPath, 'Production host-content mapping artifact')
  const actual = sha256(bytes)
  if (actual !== mapping.expectedSha256) {
    throw new Error(`Production host-content mapping digest mismatch: ${actual}`)
  }
  return Object.freeze({
    status: 'production-reviewed',
    artifactPath: repoRelativePath(artifactPath),
    sha256: actual,
  })
}

async function readTutorContractVersion() {
  const source = await readFile(
    fileURLToPath(new URL('src/study/contracts/tutor/runtime.ts', repoRoot)),
    'utf8',
  )
  const match = /STUDY_TUTOR_CONTRACT_VERSION\s*=\s*'([^']+)'/.exec(source)
  if (!match) throw new Error('The canonical Tutor adapter contract version could not be read.')
  return match[1]
}

function availableBuildSourceSha() {
  const revision = process.env.COMMIT_REF ?? process.env.GITHUB_SHA
  return typeof revision === 'string' && /^[0-9a-f]{40}$/.test(revision) ? revision : null
}

function safeOutputDirectory(outputDirectory, testMode) {
  const resolved = resolve(repoRootPath, outputDirectory ?? DEFAULT_SERVER_TUTOR_OUTPUT_DIRECTORY)
  if (resolved === repoRootPath || dirname(resolved) === resolved) {
    throw new Error('Refusing an unsafe server Tutor output directory.')
  }
  const repoPath = relative(repoRootPath, resolved)
  const outsideRepo = repoPath === '..' || repoPath.startsWith(`..${sep}`)
  if (!outsideRepo && !repoPath.split(sep).join('/').startsWith('netlify/build/')) {
    throw new Error('Server Tutor output must remain under netlify/build/.')
  }
  if (outsideRepo) {
    const temporaryPath = relative(tmpdir(), resolved)
    const nestedTemporaryPath = temporaryPath.includes(sep)
    if (!testMode || temporaryPath === '..' || temporaryPath.startsWith(`..${sep}`) || !nestedTemporaryPath) {
      throw new Error('External server Tutor output is allowed only in a nested test temporary directory.')
    }
  }
  return resolved
}

function assertServerOnlyModuleGraph(metafile) {
  const inputPaths = Object.keys(metafile.inputs).map((path) => path.replaceAll('\\', '/'))
  const forbidden = inputPaths.filter((path) =>
    path === 'src/App.tsx' ||
    path.startsWith('src/components/') ||
    /\.(?:css|scss|sass|less)$/.test(path),
  )
  if (forbidden.length > 0) throw new Error(`Browser module entered server Tutor bundle: ${forbidden.join(', ')}`)

  const unresolved = Object.values(metafile.outputs).flatMap((output) => output.imports)
  if (unresolved.length > 0) {
    throw new Error(`Server Tutor bundle retained unresolved imports: ${unresolved.map((entry) => entry.path).join(', ')}`)
  }
}

/** Builds and atomically publishes the server-only bundle and manifest. */
export async function buildServerTutorPrebundle({ mapping, outputDirectory, buildSourceSha } = {}) {
  const [frozen, hostContentMapping, adapterContractVersion] = await Promise.all([
    verifyFrozenTutorCustody(),
    resolveHostContentMapping(mapping),
    readTutorContractVersion(),
  ])
  const outputRoot = safeOutputDirectory(outputDirectory, mapping?.mode === 'test')
  const result = await build({
    ...NETLIFY_FUNCTION_BUILD,
    absWorkingDir: repoRootPath,
    entryPoints: [SERVER_TUTOR_ENTRY_POINT],
    outfile: join(outputRoot, SERVER_TUTOR_BUNDLE_FILE),
    alias: frozenPackageAliases,
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'silent',
    metafile: true,
    minify: false,
    sourcemap: false,
    splitting: false,
    treeShaking: true,
    write: false,
  })
  if (result.outputFiles.length !== 1) throw new Error('Server Tutor build must emit exactly one module.')
  assertServerOnlyModuleGraph(result.metafile)

  const bundleBytes = result.outputFiles[0].contents
  const bundleText = result.outputFiles[0].text
  if (bundleText.includes(FROZEN_TUTOR_PACKAGE.specifier) || /\bimport\s*\(/.test(bundleText)) {
    throw new Error('Server Tutor bundle retained a frozen alias or dynamic import.')
  }

  const sourceSha = buildSourceSha === undefined ? availableBuildSourceSha() : buildSourceSha
  if (sourceSha !== null && !/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error('Build source SHA must be a Git commit SHA or null.')
  }
  const manifest = Object.freeze({
    schemaVersion: SERVER_TUTOR_ARTIFACT_SCHEMA_VERSION,
    runtime: Object.freeze({ platform: 'node', nodeTarget: 'node22', moduleFormat: 'esm' }),
    frozenPackage: Object.freeze({
      specifier: FROZEN_TUTOR_PACKAGE.specifier,
      name: frozen.packageName,
      packageVersion: frozen.packageVersion,
      manifestVersion: frozen.manifestVersion,
      checksumManifestSha256: frozen.checksumManifestSha256,
      checksumEntryCount: frozen.checksumEntryCount,
    }),
    adapterContractVersion,
    bundle: Object.freeze({ file: SERVER_TUTOR_BUNDLE_FILE, sha256: sha256(bundleBytes) }),
    hostContentMapping,
    buildSourceSha: sourceSha,
  })
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`

  await mkdir(dirname(outputRoot), { recursive: true })
  const staging = await mkdtemp(join(dirname(outputRoot), '.server-tutor-stage-'))
  try {
    await Promise.all([
      writeFile(join(staging, SERVER_TUTOR_BUNDLE_FILE), bundleBytes),
      writeFile(join(staging, SERVER_TUTOR_MANIFEST_FILE), manifestText, 'utf8'),
    ])
    await rm(outputRoot, { recursive: true, force: true })
    await rename(staging, outputRoot)
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }

  return Object.freeze({ outputDirectory: outputRoot, manifest, metafile: result.metafile })
}

function parseCommandLine(args) {
  const options = { mode: 'production' }
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    const value = args[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
    if (flag === '--mode') options.mode = value
    else if (flag === '--mapping-artifact') options.artifactPath = value
    else if (flag === '--mapping-digest') options.expectedSha256 = value
    else if (flag === '--test-fixture-mapping') options.fixturePath = value
    else if (flag === '--output-dir') options.outputDirectory = value
    else throw new Error(`Unknown server Tutor build option: ${flag}`)
    index += 1
  }
  if (options.mode !== 'production' && options.mode !== 'test') {
    throw new Error('Server Tutor build mode must be production or test.')
  }
  return options
}

async function main() {
  const options = parseCommandLine(process.argv.slice(2))
  const result = await buildServerTutorPrebundle({
    mapping: {
      mode: options.mode,
      artifactPath: options.artifactPath,
      expectedSha256: options.expectedSha256,
      fixturePath: options.fixturePath,
    },
    outputDirectory: options.outputDirectory,
  })
  process.stdout.write(`${JSON.stringify({
    outputDirectory: result.outputDirectory,
    bundleSha256: result.manifest.bundle.sha256,
    mappingSha256: result.manifest.hostContentMapping.sha256,
  })}\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`server-tutor:bundle failed: ${error.message}\n`)
    process.exitCode = 1
  })
}

export { FROZEN_PACKAGE_ALIAS_SOURCES, frozenPackageAliases }
