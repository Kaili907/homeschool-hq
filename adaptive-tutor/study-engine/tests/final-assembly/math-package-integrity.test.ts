import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageRoot = new URL("../../../subjects/math/", import.meta.url);

/**
 * SHA-256 of the frozen package's own SHA256SUMS.txt, recorded outside the
 * protected tree so an in-place edit plus manifest regeneration cannot pass.
 * Interior custody chain: canonical archive ee9d15cdf1184380add17ebdd8f93f01
 * fde3f0915f491d0a4df96798b4f52351 -> its SHA256SUMS.txt -> this constant.
 */
const EXPECTED_SUMS_FILE_SHA256 =
  "a9c44585d36e120dfac6b95aade0cf77763cabeff1026490672244dbc87f27ee";

async function fileSha256(relativePath: string): Promise<string> {
  const bytes = await readFile(
    fileURLToPath(new URL(relativePath, packageRoot)),
  );
  return createHash("sha256").update(bytes).digest("hex");
}

describe("frozen Math R1 package integrity", () => {
  it("anchors the manifest itself to the frozen custody hash", async () => {
    const bytes = await readFile(
      fileURLToPath(new URL("SHA256SUMS.txt", packageRoot)),
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      EXPECTED_SUMS_FILE_SHA256,
    );
  });

  it("matches every interior file to the package's SHA256SUMS.txt", async () => {
    const manifest = await readFile(
      fileURLToPath(new URL("SHA256SUMS.txt", packageRoot)),
      "utf8",
    );
    const entries = manifest
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const match = /^([0-9a-f]{64})\s+(.+)$/.exec(line);
        const hash = match?.[1];
        const path = match?.[2];
        if (!hash || !path) {
          throw new Error(`Unparseable SHA256SUMS.txt line: ${line}`);
        }
        return { hash, path: path.replace(/^\.\//, "") };
      });
    expect(entries).toHaveLength(91);
    expect(new Set(entries.map((entry) => entry.path)).size).toBe(
      entries.length,
    );
    for (const entry of entries) {
      expect(`${entry.path}: ${await fileSha256(entry.path)}`).toBe(
        `${entry.path}: ${entry.hash}`,
      );
    }
  });

  it("contains no files beyond the frozen manifest", async () => {
    const manifest = await readFile(
      fileURLToPath(new URL("SHA256SUMS.txt", packageRoot)),
      "utf8",
    );
    const listed = new Set(
      manifest
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.replace(/^[0-9a-f]{64}\s+\.\//, "")),
    );
    listed.add("SHA256SUMS.txt");
    const rootPath = fileURLToPath(packageRoot)
      .replaceAll("\\", "/")
      .replace(/\/$/, "");
    const onDisk = (
      await readdir(rootPath, { recursive: true, withFileTypes: true })
    )
      .filter((entry) => entry.isFile())
      .map((entry) =>
        `${entry.parentPath}/${entry.name}`
          .replaceAll("\\", "/")
          .slice(rootPath.length + 1),
      );
    expect(onDisk.filter((file) => !listed.has(file))).toEqual([]);
    expect(onDisk).toHaveLength(listed.size);
  });
});
