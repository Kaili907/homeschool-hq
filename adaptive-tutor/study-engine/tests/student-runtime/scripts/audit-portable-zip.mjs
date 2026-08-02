#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const UTF8_FLAG = 0x0800;
const ENCRYPTED_FLAG = 0x0001;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;
const UNIX_FILE_TYPE_MASK = 0o170000;
const UNIX_SYMLINK_TYPE = 0o120000;
const MAX_EOCD_SEARCH = 22 + 0xffff;
const MAX_EXAMPLES_PER_CHECK = 12;

const PORTABILITY_CHECK_NAMES = [
  "forwardSlashOnly",
  "relativePathsOnly",
  "noTraversalPaths",
  "noDuplicatePaths",
  "noCaseCollidingPaths",
  "noSymlinks",
  "noPersonalHomeDirectoryPaths",
  "noEmbeddedZipFiles",
  "noNodeModules",
  "validPortableNames",
  "localAndCentralNameParity",
  "singleDiskNonZip64",
  "unencryptedEntries"
];

function requireBytes(buffer, offset, length, label) {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > buffer.length
  ) {
    throw new Error(`${label} is outside the archive bounds`);
  }
}

function findEndOfCentralDirectory(buffer) {
  if (buffer.length < 22) {
    throw new Error("Archive is too small to contain an end-of-central-directory record");
  }

  const firstCandidate = buffer.length - 22;
  const lastCandidate = Math.max(0, buffer.length - MAX_EOCD_SEARCH);

  for (let offset = firstCandidate; offset >= lastCandidate; offset -= 1) {
    if (buffer.readUInt32LE(offset) !== EOCD_SIGNATURE) {
      continue;
    }

    const commentLength = buffer.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === buffer.length) {
      return offset;
    }
  }

  throw new Error("No valid end-of-central-directory record was found");
}

function decodeEntryName(nameBytes, flags) {
  if ((flags & UTF8_FLAG) !== 0) {
    try {
      return {
        name: new TextDecoder("utf-8", { fatal: true }).decode(nameBytes),
        encodingIssue: undefined
      };
    } catch {
      return {
        name: nameBytes.toString("utf8"),
        encodingIssue: "UTF-8 flag is set but the entry name is not valid UTF-8"
      };
    }
  }

  if (nameBytes.some((value) => value > 0x7f)) {
    return {
      name: nameBytes.toString("latin1"),
      encodingIssue:
        "Non-ASCII entry name has no UTF-8 flag; its legacy code page is ambiguous across extractors"
    };
  }

  return {
    name: nameBytes.toString("ascii"),
    encodingIssue: undefined
  };
}

function inspectLocalHeader(buffer, entry, centralDirectoryOffset) {
  const offset = entry.localHeaderOffset;
  if (offset >= centralDirectoryOffset) {
    return "Local-header offset points into or beyond the central directory";
  }

  try {
    requireBytes(buffer, offset, 30, `Local header for ${JSON.stringify(entry.name)}`);
  } catch (error) {
    return error.message;
  }

  if (buffer.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
    return "Local-header signature is missing";
  }

  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const nameOffset = offset + 30;

  try {
    requireBytes(
      buffer,
      nameOffset,
      nameLength + extraLength,
      `Local name and extra data for ${JSON.stringify(entry.name)}`
    );
  } catch (error) {
    return error.message;
  }

  const localNameBytes = buffer.subarray(nameOffset, nameOffset + nameLength);
  if (!localNameBytes.equals(entry.nameBytes)) {
    return "Local-header name bytes differ from the raw central-directory name bytes";
  }

  return undefined;
}

function parseRawCentralDirectory(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  requireBytes(buffer, eocdOffset, 22, "End-of-central-directory record");

  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocdOffset + 8);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  const usesZip64Sentinel =
    entriesOnDisk === ZIP64_SENTINEL_16 ||
    totalEntries === ZIP64_SENTINEL_16 ||
    centralDirectorySize === ZIP64_SENTINEL_32 ||
    centralDirectoryOffset === ZIP64_SENTINEL_32;

  const singleDiskNonZip64 =
    !usesZip64Sentinel &&
    diskNumber === 0 &&
    centralDirectoryDisk === 0 &&
    entriesOnDisk === totalEntries;

  if (usesZip64Sentinel) {
    throw new Error(
      "ZIP64 sentinels were found; this deliberately strict Session 7 audit accepts only the small, single-disk release archive"
    );
  }

  requireBytes(
    buffer,
    centralDirectoryOffset,
    centralDirectorySize,
    "Central directory"
  );

  if (centralDirectoryOffset + centralDirectorySize > eocdOffset) {
    throw new Error("Central directory overlaps the end-of-central-directory record");
  }

  const entries = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    requireBytes(buffer, cursor, 46, `Central-directory record ${index}`);
    if (buffer.readUInt32LE(cursor) !== CENTRAL_FILE_SIGNATURE) {
      throw new Error(`Central-directory record ${index} has an invalid signature`);
    }

    const versionMadeBy = buffer.readUInt16LE(cursor + 4);
    const flags = buffer.readUInt16LE(cursor + 8);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const variableLength = nameLength + extraLength + commentLength;

    requireBytes(
      buffer,
      cursor + 46,
      variableLength,
      `Variable data for central-directory record ${index}`
    );

    const nameBytes = Buffer.from(buffer.subarray(cursor + 46, cursor + 46 + nameLength));
    const decoded = decodeEntryName(nameBytes, flags);
    const unixMode = externalAttributes >>> 16;

    entries.push({
      index,
      name: decoded.name,
      nameBytes,
      encodingIssue: decoded.encodingIssue,
      flags,
      creatorSystem: versionMadeBy >>> 8,
      externalAttributes,
      localHeaderOffset,
      isSymlink: (unixMode & UNIX_FILE_TYPE_MASK) === UNIX_SYMLINK_TYPE,
      isDirectory: /[\\/]$/.test(decoded.name)
    });

    cursor += 46 + variableLength;
  }

  if (cursor !== centralDirectoryOffset + centralDirectorySize) {
    throw new Error(
      "Parsed central-directory records do not consume the exact declared central-directory size"
    );
  }

  for (const entry of entries) {
    entry.localHeaderIssue = inspectLocalHeader(buffer, entry, centralDirectoryOffset);
  }

  return {
    entries,
    eocdOffset,
    centralDirectoryOffset,
    centralDirectorySize,
    diskNumber,
    centralDirectoryDisk,
    entriesOnDisk,
    totalEntries,
    singleDiskNonZip64
  };
}

function isAbsoluteOrRooted(name) {
  return (
    name.startsWith("/") ||
    name.startsWith("\\") ||
    /^[A-Za-z]:/.test(name) ||
    /^(?:\\\\|\/\/)/.test(name)
  );
}

function hasPersonalHomeDirectoryPath(name) {
  const slashName = name.replaceAll("\\", "/");
  return (
    /(?:^|\/)(?:Users|home)\/[^/]+(?:\/|$)/i.test(slashName) ||
    /(?:^|\/)Documents and Settings\/[^/]+(?:\/|$)/i.test(slashName)
  );
}

function makeViolationStore() {
  return Object.fromEntries(PORTABILITY_CHECK_NAMES.map((name) => [name, []]));
}

function addViolation(store, checkName, entryName, reason) {
  store[checkName].push({
    entry: entryName,
    reason
  });
}

function auditEntries(buffer, parsed) {
  const violations = makeViolationStore();
  const exactNames = new Map();
  const portableKeys = new Map();

  if (!parsed.singleDiskNonZip64) {
    addViolation(
      violations,
      "singleDiskNonZip64",
      "<archive>",
      "Archive is multi-disk or its entry counts disagree"
    );
  }

  for (const entry of parsed.entries) {
    const { name } = entry;
    const slashName = name.replaceAll("\\", "/");
    const segments = slashName.split("/");

    if (name.includes("\\")) {
      addViolation(
        violations,
        "forwardSlashOnly",
        name,
        "Raw central-directory name contains a Windows backslash"
      );
    }

    if (isAbsoluteOrRooted(name)) {
      addViolation(
        violations,
        "relativePathsOnly",
        name,
        "Entry name is absolute, rooted, UNC-like, or drive-prefixed"
      );
    }

    if (segments.includes("..")) {
      addViolation(
        violations,
        "noTraversalPaths",
        name,
        "Entry name contains a parent-directory traversal segment"
      );
    }

    if (
      name.length === 0 ||
      name.includes("\0") ||
      /[\u0001-\u001f\u007f]/u.test(name) ||
      segments.includes(".") ||
      segments.slice(0, -1).includes("")
    ) {
      addViolation(
        violations,
        "validPortableNames",
        name,
        "Entry name is empty or contains a control, dot, or empty interior segment"
      );
    }

    if (entry.encodingIssue) {
      addViolation(violations, "validPortableNames", name, entry.encodingIssue);
    }

    if (hasPersonalHomeDirectoryPath(name)) {
      addViolation(
        violations,
        "noPersonalHomeDirectoryPaths",
        name,
        "Entry name contains a recognizable personal home-directory prefix"
      );
    }

    if (!entry.isDirectory && slashName.toLowerCase().endsWith(".zip")) {
      addViolation(
        violations,
        "noEmbeddedZipFiles",
        name,
        "Entry embeds another ZIP archive"
      );
    }

    if (segments.some((segment) => segment.toLowerCase() === "node_modules")) {
      addViolation(
        violations,
        "noNodeModules",
        name,
        "Entry is inside a node_modules tree"
      );
    }

    if (entry.isSymlink) {
      addViolation(
        violations,
        "noSymlinks",
        name,
        `Unix file type in external attributes is a symbolic link (creator system ${entry.creatorSystem})`
      );
    }

    if (entry.localHeaderIssue) {
      addViolation(
        violations,
        "localAndCentralNameParity",
        name,
        entry.localHeaderIssue
      );
    }

    if ((entry.flags & ENCRYPTED_FLAG) !== 0) {
      addViolation(
        violations,
        "unencryptedEntries",
        name,
        "Entry is encrypted and is not independently portable"
      );
    }

    const priorExact = exactNames.get(name);
    if (priorExact !== undefined) {
      addViolation(
        violations,
        "noDuplicatePaths",
        name,
        `Raw entry name duplicates central-directory record ${priorExact}`
      );
    } else {
      exactNames.set(name, entry.index);
    }

    const portableKey = name.normalize("NFC").toLowerCase();
    const collisionGroup = portableKeys.get(portableKey) ?? [];
    collisionGroup.push(name);
    portableKeys.set(portableKey, collisionGroup);
  }

  for (const names of portableKeys.values()) {
    const distinctNames = [...new Set(names)];
    if (distinctNames.length < 2) {
      continue;
    }

    for (const name of distinctNames) {
      addViolation(
        violations,
        "noCaseCollidingPaths",
        name,
        `Case/Unicode-normalized collision group: ${distinctNames
          .map((value) => JSON.stringify(value))
          .join(", ")}`
      );
    }
  }

  return violations;
}

function summarizeChecks(violations) {
  return Object.fromEntries(
    PORTABILITY_CHECK_NAMES.map((name) => {
      const checkViolations = violations[name];
      return [
        name,
        {
          pass: checkViolations.length === 0,
          violationCount: checkViolations.length,
          examples: checkViolations.slice(0, MAX_EXAMPLES_PER_CHECK)
        }
      ];
    })
  );
}

export async function auditPortableZip(archivePath) {
  const archiveBytes = await readFile(archivePath);
  const parsed = parseRawCentralDirectory(archiveBytes);
  const violations = auditEntries(archiveBytes, parsed);
  const checks = summarizeChecks(violations);
  const pass = Object.values(checks).every((check) => check.pass);

  return {
    auditVersion: "manuel-academy.portable-zip-audit.v1",
    archiveName: path.basename(archivePath),
    sha256: createHash("sha256").update(archiveBytes).digest("hex").toUpperCase(),
    byteLength: archiveBytes.length,
    entryCount: parsed.entries.length,
    fileEntryCount: parsed.entries.filter((entry) => !entry.isDirectory).length,
    directoryEntryCount: parsed.entries.filter((entry) => entry.isDirectory).length,
    centralDirectory: {
      offset: parsed.centralDirectoryOffset,
      byteLength: parsed.centralDirectorySize,
      rawEntryCount: parsed.totalEntries
    },
    pass,
    checks
  };
}

function printHumanReport(result) {
  const status = result.pass ? "PASS" : "FAIL";
  process.stdout.write(
    `${status} ${result.auditVersion}\n` +
      `archive=${result.archiveName}\n` +
      `sha256=${result.sha256}\n` +
      `bytes=${result.byteLength}\n` +
      `entries=${result.entryCount} files=${result.fileEntryCount} directories=${result.directoryEntryCount}\n`
  );

  for (const [name, check] of Object.entries(result.checks)) {
    process.stdout.write(
      `${check.pass ? "PASS" : "FAIL"} ${name} violations=${check.violationCount}\n`
    );
    for (const example of check.examples) {
      process.stdout.write(`  ${JSON.stringify(example.entry)}: ${example.reason}\n`);
    }
    if (check.violationCount > check.examples.length) {
      process.stdout.write(
        `  ... ${check.violationCount - check.examples.length} additional violation(s)\n`
      );
    }
  }
}

async function runCli() {
  const argumentsWithoutFlags = process.argv.slice(2).filter((value) => value !== "--json");
  const archivePath = argumentsWithoutFlags[0];

  if (!archivePath || argumentsWithoutFlags.length !== 1) {
    process.stderr.write(
      "Usage: node audit-portable-zip.mjs <archive.zip> [--json]\n"
    );
    process.exitCode = 2;
    return;
  }

  try {
    const result = await auditPortableZip(archivePath);
    if (process.argv.includes("--json")) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      printHumanReport(result);
    }
    process.exitCode = result.pass ? 0 : 1;
  } catch (error) {
    process.stderr.write(
      `ZIP AUDIT ERROR: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 2;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  await runCli();
}
