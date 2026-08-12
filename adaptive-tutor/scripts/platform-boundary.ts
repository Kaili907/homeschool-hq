// Matched against whole tokens, never against the raw path, so ordinary words
// that merely begin with "auth" stay allowed. Each stem is anchored at the
// start of a token: "authority", "authoring", "authorship" and "authentic"
// all diverge from these stems before they end. Deliberately excluded are the
// negated forms ("unauthorized", "reauthorization"): this package uses
// "unauthorized" for subject-package allowlisting, not authentication, so
// matching mid-token would fail the build on its own vocabulary.
const AUTHENTICATION_TOKEN_PATTERNS = [
  /^o?auth[nz]?\d*$/, // auth, authn, authz, oauth, auth2, oauth2 — anchored, so "author" and "oauthority" do not match
  /^authenticat/, // authenticate, authentication, authenticator — but not "authentic" or "authenticity"
  /^authori[sz]/, // authorise, authorization, authorized — but not "author", "authority" or "authoritative"
];

// A bare /auth/i substring match also fires on unrelated words ("authority",
// "authoritative"). A \b word-boundary regex overcorrects the other way: it
// misses real hits like "useAuth" or "AuthContext", where "Auth" is a
// distinct camelCase word with no non-alphanumeric boundary around it. So we
// tokenize on both delimiters and camelCase transitions and match whole
// tokens instead. The second transition splits a trailing word off a run of
// capitals, so "MFAAuthenticator" and "JWTAuthGuard" yield "authenticator"
// and "auth" rather than one welded token.
function tokenize(relativeFile: string): string[] {
  return relativeFile
    .split(/[^a-zA-Z0-9]+/)
    .flatMap((segment) => segment.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/))
    .map((token) => token.toLowerCase())
    .filter(Boolean);
}

export function isAuthenticationIntegrationPath(relativeFile: string): boolean {
  return tokenize(relativeFile).some((token) =>
    AUTHENTICATION_TOKEN_PATTERNS.some((pattern) => pattern.test(token)),
  );
}
