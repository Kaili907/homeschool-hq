import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const runtimeRoot = path.resolve(
  process.cwd(),
);
const tracesRoot = path.resolve(
  runtimeRoot,
  "../../docs/student-runtime/sample-traces",
);
const traceNames = [
  "math-water-break.trace.json",
  "reading-save-resume.trace.json",
] as const;

async function trace(name: (typeof traceNames)[number]) {
  const text = await readFile(path.join(tracesRoot, name), "utf8");
  return { text, value: JSON.parse(text) };
}

describe("Session 7-R2 release trace consistency", () => {
  it.each(traceNames)("%s uses only accepted bridge identity", async (name) => {
    const { text, value } = await trace(name);
    expect(text).not.toContain("student-runtime.session6-bridge.v2");
    expect(value.versions.tutorBoundary).toBe("1.0.1");
    expect(value.versions.bridgeContractVersion).toBe(1);
    expect(value.tutorBoundaryReceipts.length).toBeGreaterThan(0);
    for (const receipt of value.tutorBoundaryReceipts) {
      expect(receipt.bridgeVersion).toBe("1.0.1");
      expect(receipt.bridgeContractVersion).toBe(1);
    }
  });

  it.each(traceNames)(
    "%s records ledger acceptance before minimized projection",
    async (name) => {
      const { value } = await trace(name);
      for (const receipt of value.tutorBoundaryReceipts) {
        expect(receipt.ledgerAccepted).toBe(true);
        expect(receipt.processingOrder).toEqual([
          "event-ledger-accepted",
          "minimized-study-projection",
        ]);
      }
    },
  );

  it("trace files are canonical-byte deterministic", async () => {
    const before = await Promise.all(
      traceNames.map(async (name) => {
        const text = await readFile(path.join(tracesRoot, name), "utf8");
        return createHash("sha256").update(text).digest("hex");
      }),
    );
    const after = await Promise.all(
      traceNames.map(async (name) => {
        const text = await readFile(path.join(tracesRoot, name), "utf8");
        const canonical = `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
        return createHash("sha256").update(canonical).digest("hex");
      }),
    );
    expect(after).toEqual(before);
  });
});
