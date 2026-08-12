const AUTHENTICATION_TOKENS = new Set(["auth", "authentication", "authn", "oauth", "oauth2"]);

// A bare /auth/i substring match also fires on unrelated words ("authority",
// "authoritative"). A \b word-boundary regex overcorrects the other way: it
// misses real hits like "useAuth" or "AuthContext", where "Auth" is a
// distinct camelCase word with no non-alphanumeric boundary around it. So we
// tokenize on both delimiters and camelCase transitions and match whole
// tokens instead. Two camelCase transitions are split: lower/digit-to-upper
// ("useAuth" -> "use"/"Auth") and an ALLCAPS acronym run into a following
// capitalized word ("AUTHContext" -> "AUTH"/"Context"); without the second
// rule an acronym run stays fused to the word after it.
function tokenize(relativeFile: string): string[] {
  return relativeFile
    .split(/[^a-zA-Z0-9]+/)
    .flatMap((segment) =>
      segment.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/),
    )
    .map((token) => token.toLowerCase())
    .filter(Boolean);
}

export function isAuthenticationIntegrationPath(relativeFile: string): boolean {
  return tokenize(relativeFile).some((token) => AUTHENTICATION_TOKENS.has(token));
}
