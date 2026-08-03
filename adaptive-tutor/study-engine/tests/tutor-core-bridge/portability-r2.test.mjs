import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../../..");
const ownedRoots = Object.freeze([
  "adaptive-tutor/study-engine/bridges/tutor-core",
  "adaptive-tutor/study-engine/tests/tutor-core-bridge",
  "adaptive-tutor/study-engine/docs/tutor-core-bridge",
]);
const bridgeRelative = ownedRoots[0];
const packageZip = process.env.SESSION6_R2_PACKAGE_ZIP;
const node22 = process.env.SESSION6_NODE22 || process.execPath;
const externalTsc = process.env.SESSION6_TSC;

function validateArchiveName(name) {
  assert.equal(name.includes("\\"), false, `backslash path: ${name}`);
  assert.equal(name.startsWith("/"), false, `absolute POSIX path: ${name}`);
  assert.equal(
    /^[A-Za-z]:/.test(name),
    false,
    `drive-qualified path: ${name}`,
  );
  const segments = name.split("/");
  assert.equal(
    segments.some((segment) => segment === "" || segment === ".."),
    false,
    `empty or traversal segment: ${name}`,
  );
  assert.equal(
    ownedRoots.some(
      (root) => name === root || name.startsWith(`${root}/`),
    ),
    true,
    `out-of-ownership path: ${name}`,
  );
  return segments;
}

function destinationForPlatform(root, archiveName, platform) {
  const segments = validateArchiveName(archiveName);
  const implementation = platform === "win32" ? path.win32 : path.posix;
  return implementation.join(root, ...segments);
}

function extractOwnedZip(bytes, destination) {
  const endSignature = 0x06054b50;
  let endOffset = -1;
  for (
    let cursor = bytes.length - 22;
    cursor >= Math.max(0, bytes.length - 65_557);
    cursor -= 1
  ) {
    if (bytes.readUInt32LE(cursor) === endSignature) {
      endOffset = cursor;
      break;
    }
  }
  assert.notEqual(endOffset, -1, "ZIP end record is missing");
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  let cursor = bytes.readUInt32LE(endOffset + 16);
  const entries = [];
  const exactNames = new Set();
  const foldedNames = new Set();

  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const externalAttributes = bytes.readUInt32LE(cursor + 38);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString("utf8");
    validateArchiveName(name);
    assert.equal(flags & 1, 0, `encrypted ZIP entry: ${name}`);
    assert.equal(
      ((externalAttributes >>> 16) & 0xf000) === 0xa000,
      false,
      `symlink ZIP entry: ${name}`,
    );
    assert.equal(exactNames.has(name), false, `duplicate ZIP entry: ${name}`);
    assert.equal(
      foldedNames.has(name.toLocaleLowerCase("en-US")),
      false,
      `case-colliding ZIP entry: ${name}`,
    );
    exactNames.add(name);
    foldedNames.add(name.toLocaleLowerCase("en-US"));
    entries.push({
      compressedSize,
      localOffset,
      method,
      name,
      uncompressedSize,
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return Promise.all(
    entries.map(async (entry) => {
      assert.equal(bytes.readUInt32LE(entry.localOffset), 0x04034b50);
      const localNameLength = bytes.readUInt16LE(entry.localOffset + 26);
      const localExtraLength = bytes.readUInt16LE(entry.localOffset + 28);
      const dataStart =
        entry.localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.subarray(
        dataStart,
        dataStart + entry.compressedSize,
      );
      const content =
        entry.method === 0
          ? compressed
          : entry.method === 8
            ? inflateRawSync(compressed)
            : assert.fail(
                `unsupported ZIP compression ${entry.method}: ${entry.name}`,
              );
      assert.equal(content.length, entry.uncompressedSize, entry.name);
      const output = path.join(destination, ...entry.name.split("/"));
      return mkdir(path.dirname(output), { recursive: true }).then(() =>
        writeFile(output, content),
      );
    }),
  );
}

async function populateCleanTree(destination) {
  if (packageZip) {
    await extractOwnedZip(await readFile(packageZip), destination);
    return "zip";
  }
  for (const root of ownedRoots) {
    const source = path.join(repositoryRoot, ...root.split("/"));
    const target = path.join(destination, ...root.split("/"));
    await cp(source, target, {
      recursive: true,
      filter(candidate) {
        const base = path.basename(candidate);
        return base !== "node_modules" && !base.endsWith(".zip");
      },
    });
  }
  return "copy";
}

function runNode(args, cwd) {
  const result = spawnSync(node22, args, {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      SYSTEMROOT: process.env.SYSTEMROOT ?? "",
      SystemRoot: process.env.SystemRoot ?? "",
      TEMP: process.env.TEMP ?? tmpdir(),
      TMP: process.env.TMP ?? tmpdir(),
    },
  });
  assert.equal(
    result.status,
    0,
    `command failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

test("bridge-local metadata is a private ESM boundary at package version 1.0.1", async () => {
  const packageDocument = JSON.parse(
    await readFile(
      path.join(repositoryRoot, ...bridgeRelative.split("/"), "package.json"),
      "utf8",
    ),
  );
  assert.equal(packageDocument.name, "@manuel-academy/study-core-bridge");
  assert.equal(packageDocument.version, "1.0.1");
  assert.equal(packageDocument.bridgeContractVersion, 1);
  assert.equal(packageDocument.private, true);
  assert.equal(packageDocument.type, "module");
  assert.equal(Object.hasOwn(packageDocument, "packageManager"), false);
  assert.equal(Object.hasOwn(packageDocument, "dependencies"), false);
  assert.equal(Object.hasOwn(packageDocument, "devDependencies"), false);
});

test("portable archive rules are consistent for Windows, Linux, and macOS", () => {
  const archiveName =
    "adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts";
  assert.equal(
    destinationForPlatform("X:\\clean", archiveName, "win32"),
    "X:\\clean\\adaptive-tutor\\study-engine\\bridges\\tutor-core\\src\\index.ts",
  );
  for (const platform of ["linux", "darwin"]) {
    assert.equal(
      destinationForPlatform("/clean", archiveName, platform),
      "/clean/adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts",
    );
  }
  for (const unsafe of [
    "../outside.txt",
    "/absolute.txt",
    "D:/profile/private.txt",
    "adaptive-tutor\\study-engine\\bridges\\tutor-core\\src\\index.ts",
    "adaptive-tutor/study-engine/bridges/tutor-core/../../outside.txt",
  ]) {
    assert.throws(() => validateArchiveName(unsafe));
  }
});

test("clean extracted or copied package typechecks and imports under Node 22", async (t) => {
  assert.ok(
    externalTsc,
    "SESSION6_TSC must point to an externally supplied TypeScript compiler CLI",
  );
  const cleanRoot = await mkdtemp(path.join(tmpdir(), "study-core-bridge-r2-"));
  t.after(() => rm(cleanRoot, { recursive: true, force: true }));
  const mode = await populateCleanTree(cleanRoot);
  assert.equal(
    await stat(path.join(cleanRoot, "package.json")).catch(() => null),
    null,
    "clean package must not depend on a repository-root package.json",
  );
  assert.equal(
    await stat(
      path.join(
        cleanRoot,
        ...bridgeRelative.split("/"),
        "node_modules",
      ),
    ).catch(() => null),
    null,
    "node_modules must not be packaged",
  );
  runNode(
    [
      externalTsc,
      "-p",
      `${bridgeRelative}/tsconfig.json`,
      "--noEmit",
    ],
    cleanRoot,
  );
  runNode(
    [
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      `const bridge = await import("./${bridgeRelative}/src/index.ts"); if (Object.keys(bridge).length === 0) throw new Error("empty source barrel");`,
    ],
    cleanRoot,
  );
  t.diagnostic(`clean-tree source: ${mode}`);
});
