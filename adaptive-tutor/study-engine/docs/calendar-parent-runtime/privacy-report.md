# Card 8 privacy and adversarial validation report

Date: 2026-07-29  
Scope: local `calendar-parent-runtime` integration lab only  
Production approval: no

## Result

The Card 8 public projections passed focused adversarial checks for data
minimization, adult-private isolation, credential-free Romeo metadata,
duplicate prevention, IANA timezone handling, host-timezone independence,
deterministic traces, browser-safe source boundaries, mobile parent invariants,
and explicitly declared local Node types, TypeScript, Vite, Vitest, and
Playwright tooling.

The lab is memory-only. It does not connect to production calendar, parent
dashboard, identity, authentication, storage, database, Supabase, deployment,
or Student Study-UX.

## Projection boundaries

| Boundary | Permitted content | Excluded content | Enforcement |
| --- | --- | --- | --- |
| Engine recommendation to parent recommendation | Stable recommendation ID, offset-bearing creation time, direction, setting suggestions, safe summary, parent-visible evidence references | PII fields, raw answers/responses, transcripts, diagnosis text, hidden behavioral scores, credentials, unknown engine fields | Structural allow-list, unsafe-text neutralization, post-projection audit |
| Parent controls public state | Functional settings, recommendation decisions, accommodations, reschedules, interruption categories, review requests, safe audit messages, stable private record reference | Adult-private note bodies, raw responses, transcripts, diagnosis text, hidden scores | Private-note command is returned separately; public state cannot accept a private record |
| Adult-private projection | Audience-authorized note metadata and body | Mismatched learner/actor/permission; teacher/tutor access to `parent-only` notes | Explicit authorization on every read/write; filtered revisions prevent hidden-note existence inference; cycle-safe public audits detect full bodies and substantial excerpts |
| Adult operational note event | `noteRef`, category, author reference, creation instant for notes visible to that adult | Body, excerpt, and metadata for an audience the actor cannot access | Audience-filtered metadata allow-list |
| Student private-note projection | Nothing; deliberately empty | Any property or non-record shape, including body, excerpt, category, reference, count, audience, or existence flag | One frozen empty singleton plus an exact-empty-shape and recursive student-boundary audit |
| Romeo assignment | Adapter/adult record: versioned metadata, separate progress, tutoring link, resume note, HTTPS reference, last-checked instant, source mode | Passwords, passcodes, PIN/OTP/TOTP/MFA material, verification/recovery/OAuth/authorization codes, CSRF/session tokens, SAML responses, SSO tickets, magic links, usernames, login/auth fields, cookies, API keys, client secrets, Basic/Bearer values, URL user information, credential query/fragment parameters | Recursive credential inspection plus normalized adapter/public allow-lists; public/calendar use only opaque `hostLaunchRef` |
| Calendar/mobile view | Stable opaque references, functional schedule state, completion/resume data, effective settings, control labels | Romeo URL/resume body, credentials, private note bodies, student private-note existence, server state, browser storage | Pure browser-safe modules and minimized view models |

The recommendation privacy report contains paths only. It never copies a
rejected field's value.

## Adversarial evidence

`tests/calendar-parent-runtime/adversarial-validation.test.ts` includes 16
tests across these boundaries:

1. Canonical review version/header conformance and canonical task-type
   membership.
2. Recommendation projection with hostile PII, raw-answer, transcript,
   diagnosis, hidden-score, credential, and unknown fields.
3. Detection of prohibited text if a caller bypasses the recommendation
   projector.
4. Separator/casing variants for response fields, transcript excerpts,
   diagnosis aliases, and private behavior/engagement score aliases, with a
   functional-language negative control.
5. Adult-private read/write authorization, learner matching, author matching,
   parent-default audience, audience non-widening, and cycle-safe full-body or
   substantial-excerpt isolation auditing.
6. One frozen empty student projection for both empty and populated private
   repositories, plus rejection of every non-empty/cyclic existence signal.
7. Romeo credential-shaped fields at multiple nesting depths, including
   PIN/OTP/TOTP, MFA, verification/recovery/authorization/OAuth codes, CSRF
   and session material, SAML responses, SSO tickets, and magic-link aliases.
8. Romeo credential attempts in `Map`, `Set`, cyclic objects, Basic/Bearer
   values, free-text assignments, URL user information, and credential query
   or fragment parameters.
9. Credential smuggling through an assignment update and URL/resume-body
   exclusion from the DEC-018 public projection.
10. Idempotent review replay; changed-payload, reused-ID, and semantic queue
    duplicate rejection.
11. Repeat calendar-import collapse, repeated replay collapse, and internal-ID
    conflict rejection.
12. Exact New York spring-forward boundaries, the gap, both fall-back overlap
    instants, exact fall boundary, and learner-local date grouping.
13. Identical timezone results while the Node host timezone is changed among
    UTC, Honolulu, and Tokyo.
14. Deterministic scenario/recommendation traces and expanded browser-source
    scans for Node, network, credential, persistence, and nondeterministic APIs.
15. Mobile one-column/touch invariants and adult-private body exclusion.
16. Manifest, lockfile, config, script, Node-floor, and import verification for
    local `@types/node`, TypeScript, Vite, Vitest, and `playwright-core`.

### Current automated result

Command run from
`integration-labs/calendar-parent-runtime`:

```powershell
npm test
```

Result on 2026-07-29:

```text
Test Files  6 passed (6)
Tests       86 passed (86)
Adversarial validation  16 passed (16)
```

Strict compilation was also rerun:

```powershell
npm run typecheck
```

Result: pass, with `strict`, `noUncheckedIndexedAccess`, and
`exactOptionalPropertyTypes` enabled.

The public-source audit checks each top-level runtime `.ts` module, excluding
Vite/Vitest configuration, for Node/Deno/Bun-only imports or globals, direct
network/credential/persistent-storage APIs, and runtime-generated time or
random identities. The explicit toolchain check prevents accidental reliance
on globally installed TypeScript, Vite, Vitest, Playwright, or Node types. This
is a source-boundary check; the browser build remains the authoritative
transitive bundling check.

## Timezone conclusions

- Calendar placement requires an explicit household IANA timezone.
- A local wall minute is resolved with `Intl.DateTimeFormat` in that zone.
- The 2026 New York spring edge resolves `01:59` to `06:59Z`, rejects `02:30`,
  and resolves `03:00` to `07:00Z`.
- A fall-back overlap requires deterministic `earlier` or `later`
  disambiguation and retains the distinct `05:30Z` and `06:30Z` instants.
- Daily grouping derives the date in the supplied household zone, never the
  host's default zone.
- Review dates remain canonical civil dates. The adapter never derives a
  same-day time from a cooldown; `retryNotBefore` remains null until an
  authorized policy supplies an offset instant after completed preparation
  and a matching break/session boundary.

The adversarial host-timezone test produced byte-identical results under three
different host defaults.

## Romeo conclusions

`ROMEO_RUNTIME_BOUNDARY` declares and tests:

- credentials requested: false;
- credentials stored: false;
- automatic login: false;
- scraping: false;
- network requests: false;
- persistence: false;
- production sync: false.

Credential inspection traverses ordinary objects, arrays, `Map`, `Set`, URL
objects, and cycles. Assignment normalization then reconstructs a fresh
allow-listed object, so unknown source fields are not retained. Accepted
adapter-private external references must use HTTPS and contain no URL user
information or credential-like query/fragment keys. Public and calendar
projections omit that URL and the free-text resume body, exposing only an
opaque host launch reference. Regression vectors cover PIN, OTP/TOTP, MFA
code/token, verification/recovery/authorization/OAuth codes, CSRF/session
material, SAML responses, SSO tickets, magic links, and matching free-text
assignment forms in addition to passwords and Basic/Bearer values.

## Mobile conclusions

The mobile parent view model passed these invariants:

- one baseline column;
- no data tables;
- long-text wrapping enabled;
- ten unique parent controls;
- at least 44-pixel touch targets;
- full-width controls on narrow screens;
- only a private record reference and authorization label;
- no adult-private note body in either public parent state or mobile output.

## Residual risks

1. Authorization is a pure adapter input. This lab validates supplied adult
   role, actor, learner, and permission fields but does not authenticate the
   caller. Production identity and authorization remain out of scope.
2. Public-text screening uses a conservative pattern set. Structural
   allow-listing removes sensitive fields, but no regex can identify every
   unlabeled name, obfuscated secret, novel identifier, or paraphrased
   diagnosis. Production should combine provenance controls, reviewable
   templates, and a maintained DLP policy.
3. Private-note isolation auditing detects full bodies and direct excerpts of
   at least 24 characters, including multiline values and cyclic structures.
   It does not prove that a shorter fragment, translation, paraphrase, or other
   transformation did not leak. Future integration must preserve the separate
   data path rather than relying only on the audit helper.
4. Romeo secret screening covers ordinary credential channels and explicit
   assignment phrases, but deliberately disguised secrets may evade lexical
   detection. The normalized allow-list and credential-free operating model
   are the primary controls; no login material should be supplied to this
   adapter at all.
5. IANA behavior depends on the ICU/tzdb shipped by the executing browser or
   Node runtime. The tested 2026 New York transitions are deterministic in the
   current runtime, but production should pin supported runtimes and monitor
   timezone database updates.
6. The browser source audit is static and local. The successful Vite build and
   Node bundle audit provide transitive evidence for this package, but are not
   substitutes for production dependency review, Content Security Policy, or
   a browser test in the eventual host.
7. Duplicate prevention is deterministic within supplied in-memory
   collections. Cross-process concurrency and transactional uniqueness are
   intentionally not implemented.
8. Full canonical JSON-schema validation remains the integration assembler's
   responsibility. This audit proves current schema version/header output,
   canonical task vocabulary, and constructor/runtime invariants.
9. Card 5 is verified and its relevant local adapters pass parity checks, but
   Accepted R2 privacy parity passes for the Session 8 local runtime.
   This lab therefore cannot authorize production integration or final
   assembly.

## Release gate

This report supports a local demonstration package, not production release.
Before production use, require authenticated authorization, transactional
dedupe constraints, approved persistence projections, DLP/log review,
transitive browser build analysis, pinned runtime support, closure of the
overall final-assembly authorization, and canonical schema validation at every external
boundary.
