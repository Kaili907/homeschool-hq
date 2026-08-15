import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { TSchema } from "../../core/schema/typebox.js";
import { Value } from "../../core/schema/value.js";
import { validateExact } from "../../core/v2/contracts/index.js";
import {
  InMemoryWave2ReplayLedger,
  Wave2AdaptiveCompositionRequestSchema,
  Wave2StudyDecisionPacketSchema,
  composeWave2AdaptiveIntelligence,
} from "../../study-engine/tutor-v2/adaptive/index.js";
import { wave2Fixture } from "./wave2-fixtures.js";

function generated(file: string): TSchema {
  return JSON.parse(readFileSync(`json-schema/v2/wave2/${file}`, "utf8")) as TSchema;
}

test("Wave 2 serialized request has runtime/generated schema parity", () => {
  const request = wave2Fixture();
  const schema = generated("wave2-adaptive-composition-request.schema.json");
  assert.equal(validateExact(Wave2AdaptiveCompositionRequestSchema, request).status, "accepted");
  assert.equal(Value.Check(schema, request), true);

  const contaminated = { ...request, rawLearnerTranscript: "private" };
  assert.equal(validateExact(Wave2AdaptiveCompositionRequestSchema, contaminated).status, "rejected");
  assert.equal(Value.Check(schema, contaminated), false);
});

test("Wave 2 serialized decision has runtime/generated schema parity", async () => {
  const result = await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: new InMemoryWave2ReplayLedger(),
  });
  const schema = generated("wave2-study-decision-packet.schema.json");
  assert.equal(validateExact(Wave2StudyDecisionPacketSchema, result).status, "accepted");
  assert.equal(Value.Check(schema, result), true);

  const contaminated = { ...result, officialMastery: true };
  assert.equal(validateExact(Wave2StudyDecisionPacketSchema, contaminated).status, "rejected");
  assert.equal(Value.Check(schema, contaminated), false);
});
