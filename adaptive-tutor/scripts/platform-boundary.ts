const AUTHENTICATION_TOKENS = new Set(["auth", "authentication"]);

// A bare /auth/i substring match also fires on unrelated words ("authority",
// "authoritative"). A \b word-boundary regex overcorrects the other way: it
// misses real hits like "useAuth" or "AuthContext", where "Auth" is a
// distinct camelCase word with no non-alphanumeric boundary around it. So we
// tokenize on both delimiters and camelCase transitions and match whole
// tokens instead.
function tokenize(relativeFile: string): string[] {
  return relativeFile
    .split(/[^a-zA-Z0-9]+/)
    .flatMap((segment) => segment.split(/(?<=[a-z0-9])(?=[A-Z])/))
    .map((token) => token.toLowerCase())
    .filter(Boolean);
}

export function isAuthenticationIntegrationPath(relativeFile: string): boolean {
  return tokenize(relativeFile).some((token) => AUTHENTICATION_TOKENS.has(token));
}
