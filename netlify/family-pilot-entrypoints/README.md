# Controlled Family Pilot function entrypoints

This branch-only allowlist mirrors the reviewed Netlify function surface except
for `production-item-assessment`. That scorer is explicitly disabled for the
Family Pilot branch and its full authority corpus exceeds Netlify's per-function
package limit. Tutor, voice, safety, identity, cloud, and adult-review functions
remain server-side and callable through the existing redirects.
