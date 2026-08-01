import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

test("standalone demo contains a reading and writing intervention from Core v0.2 data", async () => {
  const generated = await readFile(resolve("demo/programs.generated.js"), "utf8");
  const sandbox: { window: { ENGLISH_DEMO_DATA?: unknown } } = { window: {} };
  vm.runInNewContext(generated, sandbox);
  const data = sandbox.window.ENGLISH_DEMO_DATA as {
    coreContractVersion: string;
    reading: { program: { version: string; diagnosticItems: unknown[] }; extension: { modeResponses: object } };
    writing: { program: { version: string; diagnosticItems: unknown[] }; extension: { modeResponses: object; learnerAuthorshipPrompt: string } };
  };
  assert.equal(data.coreContractVersion, "0.2.0");
  assert.equal(data.reading.program.version, "0.2.0");
  assert.equal(data.writing.program.version, "0.2.0");
  assert.ok(data.reading.program.diagnosticItems.length >= 1);
  assert.ok(data.writing.program.diagnosticItems.length >= 1);
  assert.equal(Object.keys(data.reading.extension.modeResponses).length, 4);
  assert.equal(Object.keys(data.writing.extension.modeResponses).length, 4);
  assert.match(data.writing.extension.learnerAuthorshipPrompt, /final revision|final/i);
});

test("demo exposes captions, transcript, fallback, and learner revision without camera APIs", async () => {
  const [html, app] = await Promise.all([
    readFile(resolve("demo/index.html"), "utf8"),
    readFile(resolve("demo/app.js"), "utf8"),
  ]);
  assert.match(html, /CAPTIONS/);
  assert.match(html, /Visible transcript and no-audio fallback/);
  assert.match(html, /textarea/);
  assert.doesNotMatch(`${html}\n${app}`, /getUserMedia|mediaDevices|webcam/i);
});
