# Version-aware curriculum cache architecture

The production app still uses curriculum release `1.0.0`. Release selection and
learner pinning are outside this foundation change.

## Namespaces and isolation

- The current app shell uses `homeschool-hq-app-shell-<build-id>`.
- Each immutable curriculum release uses
  `homeschool-hq-curriculum-release-<release-version>`.
- Curriculum lookup opens only the cache derived from the version segment in the
  requested `/curriculum/<version>/...` URL. It never uses a global cache match,
  so an asset cached for one release cannot satisfy another release's request.
- Mutable or unversioned release pointers (`active`, `latest`, and `current`) are
  network-only and are not retained as curriculum authority.

## Retention and updates

Service-worker activation removes superseded app-shell and other legacy runtime
caches, but preserves every versioned curriculum-release cache. This conservative
retention is intentional: there is not yet an authoritative server-side view of
which releases remain pinned by learners or in-progress sessions.

Future garbage collection must be pin-aware, or use an explicitly approved
age/retention policy that cannot delete content required by a valid pin. App-shell
deployment alone must never decide that a curriculum release is unused.

## Offline and privacy behavior

Cached content for a pinned release remains available offline after an app-shell
update. When a requested pinned asset is absent and the network is unavailable,
the service worker returns a clear `504` offline miss and does not try another
release.

API, auth, sync, Netlify function, admin, private, and protected paths are
network-only. Responses marked `private` or `no-store` are not written to public
caches. The caches therefore contain only the public app shell, public runtime
assets, and the already student-safe curriculum projection; existing sign-out
handling remains responsible for session and household-private stores.
