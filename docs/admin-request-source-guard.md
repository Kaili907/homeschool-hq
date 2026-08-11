# Admin request-source guard contract

`netlify/functions/_shared/admin-request-source.js` is a defense-in-depth browser provenance check for future sensitive Admin mutation routes. It is not wired into a product route by this card.

## Configuration

- `ACADEMY_TRUSTED_ORIGIN` is required. It must be one canonical absolute HTTPS non-loopback origin such as `https://academy.example`: no wildcard, credentials, path, trailing slash, query, fragment, or default-port spelling that the URL parser would normalize. The value is explicit because this repository has no existing canonical Academy-origin configuration.
- `ACADEMY_DEV_TRUSTED_ORIGINS`, when present, is a JSON array of at most 16 exact canonical loopback origins. Only `localhost`, `127.0.0.1`, and `[::1]` are eligible; HTTP is permitted for these development entries. The list is validated in all contexts and used only when Netlify `CONTEXT` is exactly `dev`. It is never inherited by `production`, `deploy-preview`, `branch-deploy`, or an absent/unknown context.
- Netlify `URL`, `DEPLOY_URL`, and `DEPLOY_PRIME_URL` identify deploys but are not fallbacks for the trusted Academy origin. Request `Host`, `X-Forwarded-Host`, `Referer`, and reconstructed request URLs are never authority.

## Browser policy

The caller invokes `guardAdminRequestSource` only on state-changing Admin routes such as `POST`, `PUT`, `PATCH`, and `DELETE`. The helper deliberately contains no method policy, so it has no effect on `GET` dashboards unless a caller chooses to invoke it.

A pass requires exactly one logical `Origin` whose value is already a canonical absolute HTTP(S) origin and exactly matches the configured allowlist, plus exactly one logical `Sec-Fetch-Site` whose value is `same-origin`. Header names are case-insensitive. Missing, empty, `null`, comma-joined, duplicate, malformed, or non-canonical values fail closed. An identical one-value mirror between Netlify `headers` and `multiValueHeaders` is one logical value; multiple keys, multiple array values, invalid shapes, or disagreement between the two representations are ambiguous and rejected.

There is no relaxed non-browser mode. A future trusted internal caller must receive a separate explicit contract instead of weakening browser mode.

## Result and composition

The only results are frozen `{ ok: true }` and `{ ok: false, code: 'invalid_request_source' }` objects. They contain no origin, host, header, bearer, secret, or detailed rejection reason, and the helper performs no logging.

A pass grants no bearer authentication, Admin role/capability, session, AAL/MFA status, step-up grant, or database authorization. Every such layer remains mandatory in final Admin composition.

This helper does not emit CORS headers and does not implement preflight handling. Any later preflight contract must use exact origins and must not introduce wildcard CORS.
