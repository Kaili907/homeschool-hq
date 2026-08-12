import test from "node:test";
import assert from "node:assert/strict";
import { isAuthenticationIntegrationPath } from "../scripts/platform-boundary.js";

test("flags real authentication integration paths", () => {
  for (const file of [
    "auth/session.ts",
    "src/auth.ts",
    "src/auth-client.ts",
    "authentication/session.ts",
    "src/authentication.ts",
  ]) {
    assert.equal(isAuthenticationIntegrationPath(file), true, file);
  }
});

test("flags camelCase and case-varied authentication filenames", () => {
  for (const file of ["useAuth.ts", "AuthContext.tsx", "withAuth.ts", "AUTH/Session.TS"]) {
    assert.equal(isAuthenticationIntegrationPath(file), true, file);
  }
});

test("does not flag words that merely contain the substring auth", () => {
  for (const file of [
    "authority-matrix.md",
    "authority-boundary-matrix.md",
    "authoritative-contract.md",
    "author.ts",
    "authors.md",
    "docs/coauthoring-guide.md",
    "src/authoring/lesson-authoring.ts",
    "data/authentic-samples.json",
  ]) {
    assert.equal(isAuthenticationIntegrationPath(file), false, file);
  }
});
