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

test("flags the authorization, oauth, and authenticator paths the token set missed", () => {
  for (const file of ["authorization/policy.ts", "OAuth/callback.ts", "authenticator.ts"]) {
    assert.equal(isAuthenticationIntegrationPath(file), true, file);
  }
});

test("flags oauth, auth2, authn, and authz integration paths", () => {
  for (const file of [
    "src/oauth.ts",
    "oauth2/token-exchange.ts",
    "src/OAuth2Client.ts",
    "src/oAuth2Client.ts",
    "auth2/client.ts",
    "hooks/useOAuth.ts",
    "src/authz.ts",
    "authn/verify.ts",
    "AUTHZ/rules.ts",
    "AuthzGuard.ts",
    "requireAuthn.ts",
  ]) {
    assert.equal(isAuthenticationIntegrationPath(file), true, file);
  }
});

test("flags authenticate and authorize word forms in both spellings", () => {
  for (const file of [
    "src/authenticate.ts",
    "src/useAuthenticator.tsx",
    "src/authorize.ts",
    "src/isAuthorized.ts",
    "src/authorisation/policy.ts",
    "authorised-routes.ts",
  ]) {
    assert.equal(isAuthenticationIntegrationPath(file), true, file);
  }
});

test("flags authentication words welded to a leading acronym", () => {
  for (const file of [
    "MFAAuthenticator.ts",
    "JWTAuthGuard.ts",
    "OIDCAuth.ts",
    "SSOAuthBridge.ts",
    "APIAuthMiddleware.ts",
    "IAuthProvider.ts",
    "OAuthentication.ts",
  ]) {
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

test("does not flag authorship, authoring, or authenticity words that share an auth prefix", () => {
  for (const file of [
    "authors.json",
    "authoring/index.ts",
    "authorship-notes.md",
    "authenticity-report.md",
    "oauthority.md",
    "authorial-voice.md",
  ]) {
    assert.equal(isAuthenticationIntegrationPath(file), false, file);
  }
});

test("does not flag the unauthorized subject-package vocabulary this package uses", () => {
  for (const file of [
    "docs/unauthorized-subject-packages.md",
    "unauthorized-subject-package-guard.ts",
    "actor-unauthorized-policy.ts",
    "unauthorized-private-read.ts",
    "reauthorization-model.md",
  ]) {
    assert.equal(isAuthenticationIntegrationPath(file), false, file);
  }
});

test("does not subsume the supabase, netlify, github, database, or progress-sync boundaries", () => {
  for (const file of [
    "supabase/client.ts",
    "netlify/functions/x.ts",
    ".github/workflows/ci.yml",
    "src/database.ts",
    "progress-sync/index.ts",
  ]) {
    assert.equal(isAuthenticationIntegrationPath(file), false, file);
  }
});
