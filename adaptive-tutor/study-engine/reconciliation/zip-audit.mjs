import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

function decodeName(bytes, flags) {
  // All supplied artifacts and the corrected output use UTF-8-compatible names.
  return bytes.toString((flags & 0x800) !== 0 ? "utf8" : "utf8");
}

export async function readZip(filePath) {
  const bytes = await readFile(filePath);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === EOCD) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error(`EOCD not found: ${filePath}`);
  const entryCount = bytes.readUInt16LE(eocd + 10);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (bytes.readUInt32LE(cursor) !== CENTRAL) throw new Error(`Invalid central record ${index}`);
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const crc32 = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const externalAttributes = bytes.readUInt32LE(cursor + 38);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = decodeName(bytes.subarray(cursor + 46, cursor + 46 + nameLength), flags);
    entries.push({
      name,
      flags,
      method,
      crc32,
      compressedSize,
      uncompressedSize,
      externalAttributes,
      localOffset,
      directory: name.endsWith("/") || name.endsWith("\\")
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return { filePath, bytes, entries };
}

export function extractEntry(zip, entry) {
  const offset = entry.localOffset;
  if (zip.bytes.readUInt32LE(offset) !== LOCAL) throw new Error(`Invalid local header: ${entry.name}`);
  const nameLength = zip.bytes.readUInt16LE(offset + 26);
  const extraLength = zip.bytes.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = zip.bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(compressed);
  if (entry.method === 8) return inflateRawSync(compressed);
  throw new Error(`Unsupported compression method ${entry.method}: ${entry.name}`);
}

export function findEntry(zip, name) {
  const normalizedName = name.replaceAll("\\", "/");
  const entry = zip.entries.find((candidate) =>
    candidate.name.replaceAll("\\", "/") === normalizedName);
  if (!entry) throw new Error(`ZIP entry not found: ${name}`);
  return entry;
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

export function auditRawEntries(zip) {
  const names = zip.entries.map((entry) => entry.name);
  const files = zip.entries.filter((entry) => !entry.directory);
  const duplicatePaths = names.filter((name, index) => names.indexOf(name) !== index);
  const folded = new Map();
  const caseCollisions = [];
  for (const name of names) {
    const key = name.toLocaleLowerCase("en-US");
    const previous = folded.get(key);
    if (previous && previous !== name) caseCollisions.push([previous, name]);
    else folded.set(key, name);
  }
  const traversalPaths = names.filter((name) =>
    name.split(/[\\/]/u).some((part) => part === ".."));
  const absolutePaths = names.filter((name) =>
    /^[\\/]/u.test(name) || /^[A-Za-z]:[\\/]/u.test(name));
  const backslashPaths = names.filter((name) => name.includes("\\"));
  const nulPaths = names.filter((name) => name.includes("\0"));
  const symlinks = zip.entries.filter((entry) => ((entry.externalAttributes >>> 16) & 0xf000) === 0xa000);
  return {
    entries: zip.entries.length,
    files: files.length,
    directories: zip.entries.length - files.length,
    duplicatePaths,
    caseCollisions,
    traversalPaths,
    absolutePaths,
    backslashPaths,
    nulPaths,
    symlinks: symlinks.map((entry) => entry.name)
  };
}

export function normalizedAssemblyPath(artifactId, rawName) {
  const portableName = rawName.replaceAll("\\", "/");
  if (artifactId === "tutor-core-v0.2") {
    return portableName.replace(/^manuel-academy-adaptive-tutor-core-v0\.2\//u, "");
  }
  return portableName;
}

export function crossPackageFileCollisions(zips) {
  const owners = new Map();
  for (const { id, zip } of zips) {
    for (const entry of zip.entries.filter((candidate) => !candidate.directory)) {
      const path = normalizedAssemblyPath(id, entry.name);
      const list = owners.get(path) ?? [];
      list.push(id);
      owners.set(path, list);
    }
  }
  return [...owners.entries()]
    .filter(([, artifactIds]) => artifactIds.length > 1)
    .map(([path, artifactIds]) => ({ path, artifactIds }));
}
