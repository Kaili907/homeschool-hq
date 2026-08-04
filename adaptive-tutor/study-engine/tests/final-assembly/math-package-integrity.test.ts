import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageRoot = new URL("../../../subjects/math/", import.meta.url);

async function fileSha256(relativePath: string): Promise<string> {
  const bytes = await readFile(
    fileURLToPath(new URL(relativePath, packageRoot)),
  );
  return createHash("sha256").update(bytes).digest("hex");
}

describe("frozen Math R1 package integrity", () => {
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
    for (const entry of entries) {
      expect(`${entry.path}: ${await fileSha256(entry.path)}`).toBe(
        `${entry.path}: ${entry.hash}`,
      );
    }
  });
});
