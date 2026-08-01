import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import {
  basename,
  dirname,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import { spawnSync } from 'node:child_process'
import { inflateRawSync } from 'node:zlib'

const CORE_FILENAME = 'manuel-academy-adaptive-tutor-core-v0.2.zip'
const CORE_SHA256 = '38205667d56cb4fcc5a8360f1f94098b5fa1d35ae71d22334aa1bc8d43ecc276'
const CORE_ARCHIVE_ROOT = 'manuel-academy-adaptive-tutor-core-v0.2/adaptive-tutor'
const MATH_FILENAME = 'manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned-r1.zip'
const MATH_SHA256 = 'ee9d15cdf1184380add17ebdd8f93f01fde3f0915f491d0a4df96798b4f52351'
const MATH_ARCHIVE_ROOT =
  'manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned-r1/adaptive-tutor/subjects/math'

const MAX_ZIP_ENTRIES = 10_000
const MAX_ENTRY_BYTES = 100 * 1024 * 1024
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024

function fail(message) {
  throw new Error(message)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function parseArguments(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag !== '--core-zip' && flag !== '--math-zip') {
      fail(`Unsupported argument: ${String(flag)}`)
    }
    if (values.has(flag)) fail(`Duplicate argument: ${flag}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`Missing value for ${flag}`)
    values.set(flag, value)
    index += 1
  }
  if (!values.has('--core-zip') || !values.has('--math-zip')) {
    fail('Both --core-zip and --math-zip are required.')
  }
  return {
    coreZip: resolve(values.get('--core-zip')),
    mathZip: resolve(values.get('--math-zip')),
  }
}

async function readRequiredZip(path, requiredFilename, requiredHash) {
  if (basename(path) !== requiredFilename) {
    fail(`Artifact filename must be ${requiredFilename}.`)
  }
  let metadata
  let buffer
  try {
    metadata = await stat(path)
    buffer = await readFile(path)
  } catch {
    fail(`Required artifact is missing or unreadable: ${requiredFilename}`)
  }
  if (!metadata.isFile()) fail(`Required artifact is not a file: ${requiredFilename}`)
  const hash = sha256(buffer)
  if (hash !== requiredHash) fail(`SHA-256 mismatch for ${requiredFilename}.`)
  return { path, buffer, bytes: buffer.length, hash }
}

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 65_557)
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) !== 0x06054b50) continue
    const commentLength = buffer.readUInt16LE(offset + 20)
    if (offset + 22 + commentLength === buffer.length) return offset
  }
  fail('ZIP end-of-central-directory record is missing or malformed.')
}

function safeArchivePath(name) {
  if (
    name.length === 0 ||
    name.includes('\0') ||
    name.includes('\\') ||
    name.startsWith('/') ||
    /^[a-zA-Z]:/.test(name)
  ) fail('ZIP contains an unsafe entry path.')
  const directory = name.endsWith('/')
  const path = directory ? name.slice(0, -1) : name
  const segments = path.split('/')
  if (segments.length === 0 || segments.some((segment) =>
    segment.length === 0 || segment === '.' || segment === '..')) {
    fail('ZIP contains an unsafe entry path.')
  }
  return { directory, path }
}

function inspectZip(buffer) {
  const eocd = findEndOfCentralDirectory(buffer)
  const diskNumber = buffer.readUInt16LE(eocd + 4)
  const centralDisk = buffer.readUInt16LE(eocd + 6)
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8)
  const entryCount = buffer.readUInt16LE(eocd + 10)
  const centralSize = buffer.readUInt32LE(eocd + 12)
  const centralOffset = buffer.readUInt32LE(eocd + 16)
  if (
    diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount ||
    entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff
  ) fail('Multi-disk and ZIP64 archives are not supported.')
  if (entryCount < 1 || entryCount > MAX_ZIP_ENTRIES) fail('ZIP entry count is outside safety bounds.')
  if (centralOffset + centralSize !== eocd) fail('ZIP central directory bounds are inconsistent.')

  const decoder = new TextDecoder('utf-8', { fatal: true })
  const entries = []
  const names = new Set()
  const caseFoldedNames = new Set()
  let totalBytes = 0
  let offset = centralOffset
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocd || buffer.readUInt32LE(offset) !== 0x02014b50) {
      fail('ZIP central directory entry is malformed.')
    }
    const versionMadeBy = buffer.readUInt16LE(offset + 4)
    const flags = buffer.readUInt16LE(offset + 8)
    const method = buffer.readUInt16LE(offset + 10)
    const crc = buffer.readUInt32LE(offset + 16)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const diskStart = buffer.readUInt16LE(offset + 34)
    const externalAttributes = buffer.readUInt32LE(offset + 38)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength
    if (nextOffset > eocd || diskStart !== 0) fail('ZIP central directory bounds are malformed.')
    if ((flags & 0x0001) !== 0) fail('Encrypted ZIP entries are prohibited.')
    if (method !== 0 && method !== 8) fail('ZIP uses an unsupported compression method.')
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      fail('ZIP64 entries are not supported.')
    }
    if (uncompressedSize > MAX_ENTRY_BYTES) fail('ZIP entry exceeds the uncompressed-size limit.')
    totalBytes += uncompressedSize
    if (totalBytes > MAX_TOTAL_BYTES) fail('ZIP exceeds the total uncompressed-size limit.')
    if (compressedSize > 0 && uncompressedSize / compressedSize > 1_000) {
      fail('ZIP entry compression ratio exceeds the safety limit.')
    }

    let name
    try {
      name = decoder.decode(buffer.subarray(offset + 46, offset + 46 + nameLength))
    } catch {
      fail('ZIP entry name is not valid UTF-8.')
    }
    const safe = safeArchivePath(name)
    if (names.has(safe.path) || caseFoldedNames.has(safe.path.toLowerCase())) {
      fail('ZIP contains duplicate or case-colliding paths.')
    }
    names.add(safe.path)
    caseFoldedNames.add(safe.path.toLowerCase())
    const hostSystem = versionMadeBy >>> 8
    const unixFileType = (externalAttributes >>> 16) & 0o170000
    if (hostSystem === 3 && unixFileType === 0o120000) fail('ZIP symlink entries are prohibited.')
    entries.push({
      name,
      path: safe.path,
      directory: safe.directory,
      flags,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      localOffset,
    })
    offset = nextOffset
  }
  if (offset !== eocd) fail('ZIP central directory size does not match its entries.')
  return { entries, totalBytes }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let value = 0; value < 256; value += 1) {
    let crc = value
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    table[value] = crc >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

async function extractZip(buffer, inspection, extractionRoot) {
  const rootPrefix = `${resolve(extractionRoot)}${sep}`
  for (const entry of inspection.entries) {
    const target = resolve(extractionRoot, ...entry.path.split('/'))
    if (!target.startsWith(rootPrefix)) fail('ZIP extraction target escaped its temporary root.')
    if (entry.directory) {
      await mkdir(target, { recursive: true })
      continue
    }
    const localOffset = entry.localOffset
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      fail('ZIP local header is malformed.')
    }
    const localFlags = buffer.readUInt16LE(localOffset + 6)
    const localMethod = buffer.readUInt16LE(localOffset + 8)
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const localNameStart = localOffset + 30
    const localNameEnd = localNameStart + localNameLength
    if (localNameEnd > buffer.length) fail('ZIP local header name exceeds archive bounds.')
    const localName = buffer.subarray(localNameStart, localNameEnd).toString('utf8')
    if (
      localFlags !== entry.flags ||
      localMethod !== entry.method ||
      localName !== entry.name
    ) {
      fail('ZIP local and central headers disagree.')
    }
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataOffset + entry.compressedSize
    if (dataEnd > buffer.length) fail('ZIP compressed data exceeds archive bounds.')
    let output
    try {
      const compressed = buffer.subarray(dataOffset, dataEnd)
      output = entry.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed)
    } catch {
      fail('ZIP entry decompression failed.')
    }
    if (output.length !== entry.uncompressedSize || crc32(output) !== entry.crc) {
      fail('ZIP entry size or CRC does not match the central directory.')
    }
    await mkdir(dirname(target), { recursive: true })
    try {
      await writeFile(target, output, { flag: 'wx' })
    } catch {
      fail('ZIP extraction could not create a unique contained file.')
    }
  }
}

async function treeInventory(root) {
  const files = []
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = join(directory, entry.name)
      if (entry.isSymbolicLink()) fail('Extracted tree contains a symbolic link.')
      if (entry.isDirectory()) {
        await visit(absolute)
      } else if (entry.isFile()) {
        const buffer = await readFile(absolute)
        files.push({
          path: relative(root, absolute).split(sep).join('/'),
          bytes: buffer.length,
          sha256: sha256(buffer),
        })
      } else {
        fail('Extracted tree contains an unsupported filesystem entry.')
      }
    }
  }
  await visit(root)
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  const fingerprint = sha256(files.map((file) =>
    `${file.path}\0${file.bytes}\0${file.sha256}\n`).join(''))
  return { files, fingerprint }
}

function assertExactFileSet(actualFiles, expectedPaths, label) {
  const actual = actualFiles.map((file) => file.path)
  const expected = [...expectedPaths].sort()
  if (actual.length !== expected.length || actual.some((path, index) => path !== expected[index])) {
    fail(`${label} extracted file set does not match its internal inventory.`)
  }
}

async function verifyCoreManifest(root, tree) {
  const manifest = JSON.parse(await readFile(join(root, 'MANIFEST.json'), 'utf8'))
  if (
    manifest.package !== '@manuel-academy/adaptive-tutor-core' ||
    manifest.version !== '0.2.0' ||
    manifest.hash_algorithm !== 'sha256' ||
    manifest.file_count !== 248 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 248
  ) fail('Core MANIFEST.json metadata is invalid.')
  const byPath = new Map(tree.files.map((file) => [file.path, file]))
  const manifestPaths = new Set()
  let totalBytes = 0
  for (const file of manifest.files) {
    if (
      !file || typeof file.path !== 'string' || typeof file.bytes !== 'number' ||
      typeof file.sha256 !== 'string' || manifestPaths.has(file.path)
    ) fail('Core MANIFEST.json contains an invalid entry.')
    safeArchivePath(file.path)
    manifestPaths.add(file.path)
    totalBytes += file.bytes
    const actual = byPath.get(file.path)
    if (!actual || actual.bytes !== file.bytes || actual.sha256 !== file.sha256) {
      fail('Core extracted file does not match MANIFEST.json.')
    }
  }
  if (totalBytes !== 1_133_026 || manifest.total_bytes !== totalBytes) {
    fail('Core MANIFEST.json byte total is invalid.')
  }
  assertExactFileSet(
    tree.files,
    new Set([...manifestPaths, 'MANIFEST.json', 'docs/file-inventory.md']),
    'Core',
  )
  return { listedFiles: 248, listedBytes: totalBytes, extractedFiles: tree.files.length }
}

async function verifyMathChecksums(root, tree) {
  const checksumText = await readFile(join(root, 'SHA256SUMS.txt'), 'utf8')
  const lines = checksumText.split(/\r?\n/).filter((line) => line.length > 0)
  if (lines.length !== 91) fail('Math SHA256SUMS.txt must contain exactly 91 entries.')
  const byPath = new Map(tree.files.map((file) => [file.path, file]))
  const expectedPaths = new Set()
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  \.\/(.+)$/.exec(line)
    if (!match || expectedPaths.has(match[2])) fail('Math SHA256SUMS.txt is malformed.')
    safeArchivePath(match[2])
    expectedPaths.add(match[2])
    const actual = byPath.get(match[2])
    if (!actual || actual.sha256 !== match[1]) {
      fail('Math extracted file does not match SHA256SUMS.txt.')
    }
  }
  assertExactFileSet(tree.files, new Set([...expectedPaths, 'SHA256SUMS.txt']), 'Math')
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
  if (
    manifest.subjectId !== 'math' || manifest.version !== '1.0.0' ||
    manifest.gradeBand?.minimum !== 4 || manifest.gradeBand?.maximum !== 6 ||
    !Array.isArray(manifest.gradeBand?.primary) || !manifest.gradeBand.primary.includes(5) ||
    !Array.isArray(manifest.orderedLessons) || manifest.orderedLessons.length !== 4 ||
    manifest.coreModified !== false || manifest.externalSystemsModified !== false ||
    manifest.coreV02Alignment?.frozenCoreSha256 !== CORE_SHA256
  ) fail('Math manifest identity or Grade 4–6 evidence is invalid.')
  return { listedFiles: 91, extractedFiles: tree.files.length, lessons: 4 }
}

function runNode(args, options, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    const detail = `${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim().slice(-4_000)
    fail(`${label} failed${detail ? `: ${detail}` : '.'}`)
  }
  return result.stdout
}

function assertVerifierResult(result) {
  if (
    result.status !== 'PASS' || result.coreVersion !== '0.2.0' ||
    result.programsValidated !== 4 || result.sourceAssessmentItemsAdapted !== 72 ||
    result.emittedAssessmentContractsValidated !== 96 ||
    result.sourceVisualCommandsAdapted !== 20 || result.invalidFixturesRejected !== 5 ||
    result.grade5DirectlySupported !== true || result.subjectTraceScenarios !== 3 ||
    !Array.isArray(result.coreAdvancePhases) || result.coreAdvancePhases.at(-1) !== 'advance' ||
    !Array.isArray(result.corePersistentPhases) ||
    !result.corePersistentPhases.includes('reteach') ||
    result.corePersistentPhases.at(-1) !== 'escalated'
  ) fail('Frozen Math verifier did not produce the exact required compatibility evidence.')
}

function assertHostTestReport(report) {
  if (
    report.numFailedTests !== 0 || report.numFailedTestSuites !== 0 ||
    report.numPendingTests !== 0 || report.numPendingTestSuites !== 0 ||
    report.numTotalTests !== 1 || report.numPassedTests !== 1 ||
    report.success !== true
  ) fail('Host exact-artifact test did not run exactly one passing, non-skipped test.')
}

async function verifyArtifacts() {
  const inputs = parseArguments(process.argv.slice(2))
  const core = await readRequiredZip(inputs.coreZip, CORE_FILENAME, CORE_SHA256)
  const math = await readRequiredZip(inputs.mathZip, MATH_FILENAME, MATH_SHA256)
  const coreInspection = inspectZip(core.buffer)
  const mathInspection = inspectZip(math.buffer)

  let temporaryRoot
  try {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'adaptive-tutor-artifacts-'))
    const extractionRoot = join(temporaryRoot, 'extracted')
    await mkdir(extractionRoot, { recursive: true })
    await extractZip(core.buffer, coreInspection, extractionRoot)
    await extractZip(math.buffer, mathInspection, extractionRoot)
    const coreRoot = join(extractionRoot, ...CORE_ARCHIVE_ROOT.split('/'))
    const mathRoot = join(extractionRoot, ...MATH_ARCHIVE_ROOT.split('/'))

    const coreTreeBefore = await treeInventory(coreRoot)
    const mathTreeBefore = await treeInventory(mathRoot)
    const coreInventory = await verifyCoreManifest(coreRoot, coreTreeBefore)
    const mathInventory = await verifyMathChecksums(mathRoot, mathTreeBefore)

    const verifierOutput = runNode(
      [join(mathRoot, 'scripts', 'verify-core-v0.2.mjs'), '--core-root', coreRoot],
      { cwd: mathRoot },
      'Frozen Math Core v0.2 verifier',
    )
    let verifierResult
    try {
      verifierResult = JSON.parse(verifierOutput)
    } catch {
      fail('Frozen Math verifier output is not valid JSON.')
    }
    assertVerifierResult(verifierResult)
    const verifierResultPath = join(temporaryRoot, 'math-verifier-result.json')
    await writeFile(verifierResultPath, JSON.stringify(verifierResult), { flag: 'wx' })

    const hostReportPath = join(temporaryRoot, 'host-artifact-test.json')
    const vitestPath = resolve('node_modules', 'vitest', 'vitest.mjs')
    runNode(
      [
        vitestPath,
        'run',
        'src/adaptive-tutor/assembly/artifactCompatibility.test.ts',
        '--reporter=json',
        `--outputFile=${hostReportPath}`,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TUTOR_EXACT_ARTIFACT_CONTEXT: 'zip-derived-v1',
          TUTOR_CORE_V02_ZIP: core.path,
          TUTOR_MATH_R1_ZIP: math.path,
          TUTOR_CORE_V02_ROOT: coreRoot,
          TUTOR_MATH_R1_ROOT: mathRoot,
          TUTOR_CORE_TREE_FINGERPRINT: coreTreeBefore.fingerprint,
          TUTOR_MATH_TREE_FINGERPRINT: mathTreeBefore.fingerprint,
          TUTOR_MATH_VERIFIER_RESULT: verifierResultPath,
        },
      },
      'Host exact-artifact compatibility test',
    )
    const hostReport = JSON.parse(await readFile(hostReportPath, 'utf8'))
    assertHostTestReport(hostReport)

    const coreTreeAfter = await treeInventory(coreRoot)
    const mathTreeAfter = await treeInventory(mathRoot)
    if (
      coreTreeAfter.fingerprint !== coreTreeBefore.fingerprint ||
      mathTreeAfter.fingerprint !== mathTreeBefore.fingerprint
    ) fail('An executed extracted tree changed during verification.')
    if (
      sha256(await readFile(core.path)) !== core.hash ||
      sha256(await readFile(math.path)) !== math.hash
    ) fail('A source ZIP changed during verification.')

    return {
      status: 'PASS',
      node: process.version,
      artifacts: {
        core: { filename: CORE_FILENAME, bytes: core.bytes, entries: coreInspection.entries.length, sha256: core.hash },
        math: { filename: MATH_FILENAME, bytes: math.bytes, entries: mathInspection.entries.length, sha256: math.hash },
      },
      derivedExecution: {
        temporaryRoot,
        coreRoot,
        mathRoot,
        coreTreeFingerprint: coreTreeBefore.fingerprint,
        mathTreeFingerprint: mathTreeBefore.fingerprint,
        temporaryRootRetained: false,
      },
      inventories: { core: coreInventory, math: mathInventory },
      compatibility: {
        programsDiscovered: 4,
        programsValidated: verifierResult.programsValidated,
        independentEngines: 4,
        gradeBand: '4-6',
        grade5Remapped: false,
        sourceAssessmentItems: verifierResult.sourceAssessmentItemsAdapted,
        emittedAssessmentContracts: verifierResult.emittedAssessmentContractsValidated,
        visualCommandsHandled: verifierResult.sourceVisualCommandsAdapted,
        invalidFixturesRejected: verifierResult.invalidFixturesRejected,
        advanceFlow: verifierResult.coreAdvancePhases.at(-1),
        persistentFlow: ['reteach', verifierResult.corePersistentPhases.at(-1)],
      },
      hostExactTests: { passed: hostReport.numPassedTests, skipped: hostReport.numPendingTests },
      sourceZipsRehashedAfterExecution: true,
      executedTreesUnchangedAfterExecution: true,
    }
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
  }
}

verifyArtifacts()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown verification failure.'
    console.error(`ADAPTIVE_TUTOR_ARTIFACT_VERIFICATION_FAILED: ${message}`)
    process.exitCode = 1
  })
