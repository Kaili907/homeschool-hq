# Hosted Study Sync Security and Privacy Boundary R2

> Historical audit against the learner-release base. Web R3 route isolation,
> IndexedDB response authority, and the canonical R2 pre-network serializer
> close this report's blockers; see `../r2-final-convergence/`.

## Decision

Classification: `BLOCKED`.

The proposed Family Pilot cloud DTO is now explicit, versioned, minimal, and deny-by-default in the offline audit harness. It is not yet a production pre-network serializer. More importantly, the existing generic `Profile` cloud-sync path accepts and transmits plaintext learner PINs, Tutor transcripts, correct answers, learner answers, assistant transcripts, and assistant persona text. The exact learner-ready app invokes that legacy sync hook before returning the Family Pilot route. The legacy path therefore cannot be reused or left able to run alongside a future Family Pilot hosted-sync release.

No hosted service was contacted. This report and its tests are based on base `7baf8dfbc27168708ed4cf504285a1838d7345f6`.

## Three different persistence boundaries

| Boundary | Purpose | May contain | Must not be treated as |
| --- | --- | --- | --- |
| Local durable Study state | Resume exact work on the same browser/device and preserve safety/authority continuity | Full minimized Study document, local settings, label-bearing local safety holds, local PIN digest, and separately stored raw learner responses | A network DTO |
| Portable Parent Download Backup | Parent-controlled offline transfer/recovery | Core state, companion app state, local PIN digest, safety state, exact IndexedDB Study documents | Cloud sync state |
| Cloud sync state v1 | Authenticated cross-device convergence | Only fields in `HOSTED_STUDY_SYNC_FIELD_ALLOWLIST_V1` | A dump of AppState, Profile, localStorage, IndexedDB, or the portable backup |

The portable backup does not include `FAMILY_PILOT_LEARNER_RESPONSES_KEY`, so locally durable learner response bodies do not travel in the current backup. It does include `appState`, and therefore the local `pinDigests` map. That digest is an offline local access verifier, not cloud state. Backups must be treated as sensitive household files even though they contain neither a raw PIN nor PIN plaintext.

## Versioned cloud allowlist

Contract id: `hosted-study-sync.v1`

Schema version: `1`

Release binding: `family-pilot-r1`

The executable allowlist lives in `scripts/audit-hosted-sync-r2/hosted-sync-boundary.mjs`. Exact keys are enforced at every object level. Unknown keys, accessors, symbol keys, named array properties, cycles, out-of-bound arrays, invalid references, and credential-shaped strings are rejected. Serialization throws; it never strips an unknown field and reports success.

The only cloud categories are:

- release and update versioning;
- opaque learner identity plus the display name and grade/subject roster needed to reproduce the household’s learner picker;
- assignment identity, learner-visible title/subject, state, and minimum segment progress needed to resume;
- assessment assignment status and its coarse authority class, but no assessment response, score oracle, answer authority reference, or scoring locator;
- dynamic-source readiness using opaque references and `ATTACHED_SATISFIED`, but no source body or private note;
- minimized guardian completion attestation state;
- label-free entry-block enforcement state so another device cannot bypass an open block. Reason, source, dedupe, emotional, diagnostic, and transcript fields remain local.

The authenticated household is not a browser-authored DTO field. The server must derive household scope from the verified session/resource path and reject learner references not already bound to that household. Study bearer/session grants are transport credentials held in memory, never cloud data.

## Forbidden fields and content

The cloud boundary rejects every non-allowlisted field, including these explicit families:

- raw PIN, PIN plaintext, local PIN digest/hash/verifier, and parent PIN;
- Study bearer, Authorization header, access/refresh token, session grant, launch grant, or Study session grant;
- raw learner answer/response, response draft, transient learner text, Tutor/assistant transcript, messages, prompts, provider output, or raw Tutor problem context;
- audio, recordings, voice blobs, or media capture;
- `answerIndex`, `correctAnswer`, `expectedAnswer`, answer keys/references, adult/restricted answer authority, scoring guides, scoring references, or scoring locators;
- adult/private notes or note bodies;
- emotional/sentiment labels, personality/trait inference, diagnostic labels/inference, or Tutor persona;
- service-role credential/key or provider API key;
- local safety reason/source labels. Only label-free block enforcement state may sync.

`authorityClass` in the assessment assignment is a coarse workflow status (`AUTO_SCOREABLE`, `RUBRIC_REQUIRED`, `GUARDIAN_REQUIRED`, or `COMPLETION_ONLY`). It is not answer authority and carries no key, rubric, scoring guide, correct answer, or authority locator. `GUARDIAN_ATTESTATION_REQUIRED` is completion authority, not answer authority.

## Static audit of the exact learner-ready release

### Local Family Pilot state

- Core localStorage persists roster, assignment identity, subject/title, segment progress, pause/resume metadata, timestamps, and literal minimization markers.
- Final companion localStorage persists setup, saved local session references, source-attachment metadata, assessment assignment status, guardian attestations, safety holds, and local PIN digests.
- IndexedDB persists the accepted minimized Study document: scope, learner preferences, parent settings, calendar/plan, sessions, checkpoints, review recommendations, safe events, and local outbox proposals.
- `FAMILY_PILOT_LEARNER_RESPONSES_KEY` separately persists raw choice/text/numeric/constructed/activity responses and assessment receipts in localStorage. This is permitted only as local durable learner work. It is excluded from portable backup and cloud sync v1.
- The mounted UI says response work is saved in IndexedDB, while `FinalFamilyPilotApp` constructs `BrowserLearnerResponseStore(window.localStorage)`. That disclosure/implementation mismatch must be corrected (or the store moved) before hosted sync is enabled. Backup transfer currently omits these responses.
- Raw PINs, raw Tutor transcripts, and audio are absent from Family Pilot persistence. A one-way 32-bit local PIN digest is present and remains local/portable-backup only.

### Existing generic cloud sync

The unrelated legacy sync contract is not safe for Family Pilot reuse:

- `RemoteProfileRow.data` is the whole `Profile`.
- `pendingRows()` assigns `data: local[id]` with no safe projection.
- `validateProfileForSync()` explicitly accepts `value.pin`.
- it accepts `tutorChats`, whose model includes the exact problem, `correctAnswer`, learner answer, and raw messages;
- it accepts assistant sessions/messages and persona text;
- top-level `AppState.parentPin` is locally persisted; the current row model syncs profiles rather than that top-level field, but any future whole-AppState reuse would expose it too.

This audit does not claim that a hosted write occurred. It proves the static serializer contract permits these fields if legacy sync is configured and bound.

## Required mutants

All required mutations are inserted into an otherwise valid v1 DTO and rejected before serialization:

| Mutant | Result |
| --- | --- |
| `rawPin` | rejected: forbidden field |
| `studyBearer` | rejected: forbidden field |
| `tutorTranscript` | rejected: forbidden field |
| `answerIndex` | rejected: forbidden field |
| `correctAnswer` | rejected: forbidden field |
| `answerKeyRef` | rejected: forbidden field |
| `scoringLocator` | rejected: forbidden field |
| `privateNotes` | rejected: forbidden field |

Additional negative controls reject audio, emotional labels, personality inference, diagnostic inference, service-role credentials, raw response text, safety reason labels, arbitrary unknown fields, and bearer-shaped text hidden inside an allowlisted string.

## Production unblock conditions

1. Put the v1 serializer (or an exactly equivalent shared production contract) at the final pre-network boundary. A TypeScript DTO alone is insufficient because runtime objects can carry extra keys.
2. Ensure the Family Pilot route cannot invoke legacy whole-Profile sync. Disable/isolate that path for the route or migrate legacy sync to a separate safe projection that also removes plaintext PINs, transcript/answer material, and persona/private fields.
3. Bind household scope server-side from verified authentication; do not accept browser-authored household/adult authority.
4. Run these mutation tests against the actual production transport payload immediately before dispatch, and equivalent server-side rejection tests immediately after receipt.
5. Define conflict/CAS, deletion/tombstone, retention, account deletion/export, encryption, access logging, and cross-household RLS rules before hosted activation.
6. Keep service-role credentials server-only and prove no credential name/value enters the browser bundle or DTO.
7. Reconcile the learner-response storage notice with the actual localStorage implementation and clearly disclose that portable backup excludes those response bodies, unless a separately reviewed minimized backup design is added.

Until all seven are satisfied, do not enable hosted Family Pilot sync.
