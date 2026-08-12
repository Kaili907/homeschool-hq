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

const H3_REGRESSION_TABLE = [
  // oauth/oauth2 are authentication integration surfaces, not a distinct concept.
  ["src/oauth-client.ts", true],
  ["src/OAuthProvider.tsx", true],
  ["src/oauth2-callback.ts", true],
  // authn is the standard abbreviation for authentication.
  ["src/authn.ts", true],
  ["src/authn-guard.ts", true],
  // an ALLCAPS acronym run directly followed by a capitalized word is still
  // its own camelCase word ("AUTH" + "Context" / "Client"), not one token.
  ["src/AUTHContext.tsx", true],
  ["src/AUTHClient.ts", true],
  // authorization/authority must remain allowed: not authentication.
  ["authority-matrix.md", false],
  ["authority-boundary-matrix.md", false],
  ["authoritative-source.md", false],
  ["authorization-design.md", false],
  ["src/useAuthority.ts", false],
] as const;

test("H3: flags oauth/authn/ALLCAPS authentication forms, keeps authorization allowed", () => {
  for (const [file, expected] of H3_REGRESSION_TABLE) {
    assert.equal(isAuthenticationIntegrationPath(file), expected, file);
  }
});

test("H3: preserves prior true positives", () => {
  for (const file of [
    "auth/session.ts",
    "authentication/session.ts",
    "src/auth-client.ts",
    "src/useAuth.ts",
    "src/AuthContext.tsx",
    "src/withAuth.ts",
  ]) {
    assert.equal(isAuthenticationIntegrationPath(file), true, file);
  }
});

test("H3: does not classify authorization as authentication", () => {
  for (const file of ["src/authz.ts", "src/authorization.ts", "src/AuthzGuard.ts"]) {
    assert.equal(isAuthenticationIntegrationPath(file), false, file);
  }
});
