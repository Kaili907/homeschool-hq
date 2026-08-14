# Web Build Sensitive Token Provenance Audit R1

## Return

| Field | Result |
| --- | --- |
| STATUS | `BLOCKED` |
| SOURCE_SHA | `7baf8dfbc27168708ed4cf504285a1838d7345f6` |
| SOURCE_TREE | `71dc2a773d5ec5c272ef8fd6f54781513ecaf9a6` |
| TOTAL_HITS | R2 semantics: 143 occurrences, 13 file/rule hits, 4 unique files. Expanded requested literals: 6,004 occurrences, 286 file/token hits, 272 unique files. |
| ANSWER_AUTHORITY_HITS | 114: `answerIndex` 31, `correctAnswer` 78, `expectedAnswer` 5. Of these, 104 are active legacy scoring/Tutor authority, 9 are disconnected legacy Family Pilot seams, and 1 is a protective Admin rejection identifier. |
| PIN_HITS | 30: uppercase `PIN` 23 plus `pinDigest`/`pinDigests` 7. No PIN or digest value is embedded in output. |
| TUTOR_HITS | `Tutor` 39; `transcript` 5,817; R2 Tutor/transcript proximity rule 5. No built artifact contains a learner Tutor conversation. |
| SERVICE_ROLE_HITS | Exact `service_role` 0; exact `service-role` 0; R2 case-insensitive service-role variant rule 2 (`serviceRoleKey`/`servicerolekey` protective deny-list identifiers). No credential value or environment-name literal is present. |
| LOCALHOST_HITS | 4: `localhost` 3 and `127.0.0.1` 1, all in the initial bundle and all resolved to Supabase SDK source. |
| REAL_BLOCKERS | 0 actual secrets, PINs, transcripts, or release answer payloads embedded. |
| LEGACY_EXECUTABLE_BLOCKERS | 2 emitted artifacts, 104 answer-authority occurrences: initial `index` 31 and disabled-route `Grade5MathPractice` 73. The initial artifact also contains the legacy raw-PIN and Tutor-chat persistence/sync paths. |
| FALSE_POSITIVES | 5,762 payload uses of “transcript”; 4 Supabase SDK local-host constants; academic-transcript prose; Web Speech API transcript properties. |
| CLASSIFICATION | `WEB_SENSITIVE_PROVENANCE_COMPLETE` |

The release remains blocked because active answer-bearing legacy code is shipped
as public browser JavaScript. The completed provenance audit does not mean the
web release is approved.

## Scope and reproduction

This is a local, read-only production audit. No production source,
configuration, payload, dependency, or hosted service was changed or contacted.
Only `scripts/audit-web-sensitive-provenance/**` and
`docs/web-sensitive-provenance/**` were added.

The exact authoritative R2 source was built with its Netlify branch-context
values:

```sh
env VITE_FAMILY_PILOT_ENABLED=true VITE_USE_PROXY=true npm run build
```

The build passed with Node `22.23.2`, Vite `6.4.3`, 553 transformed modules,
344 text artifacts, 90 Family Pilot course payloads, and 8,292 projected
lessons. A second diagnostic build used the same environment plus Vite
`--sourcemap` in a temporary directory. Its JavaScript chunk names matched the
production build; the maps resolved all 242 expanded JavaScript occurrences to
original sources, with zero unresolved occurrences. The production artifact
itself has no source-map comments.

The independent final-acceptance PASS cited in the mission belongs to sibling
commit `1ea8bcda`, which descends from this source but is not an ancestor of R2
commit `611c4a84`. R2 contains only six release/configuration changes over
`7baf8dfb`; it does not contain the acceptance branch's Final UI/state repairs.
Accordingly, this audit uses the required R2 source and does not project the
sibling branch's runtime PASS onto it.

Run the permanent inventory with:

```sh
node scripts/audit-web-sensitive-provenance/audit.mjs --root dist --pretty
```

Optionally pass the root of a matching sourcemapped build with `--maps` to add
the original module/line aggregation.

## Count reconciliation

The R2 report counted files with a match. That report is reproduced exactly,
and this audit additionally counts every occurrence:

| R2 rule | Occurrences | Files | Exact emitted files |
| --- | ---: | ---: | --- |
| adult answer authority | 0 | 0 | — |
| `answerIndex` | 31 | 2 | `Grade5MathPractice` 8; `index` 23 |
| `correctAnswer` | 78 | 4 | Admin 1; Final Family Pilot 4; Grade 5 Practice 65; `index` 8 |
| answer-key locator | 0 | 0 | — |
| scoring locator | 0 | 0 | — |
| `PIN` | 23 | 2 | Final Family Pilot 9; `index` 14 |
| Tutor/transcript proximity | 5 | 2 | Admin 1; Final Family Pilot 4 |
| service-role variants | 2 | 2 | Admin 1; Final Family Pilot 1 |
| localhost/loopback | 4 | 1 | `index` 4 |
| **Total** | **143** | **13 file/rule pairs** | **4 unique files** |

The wider literal audit required by this mission found:

| Literal | Occurrences | Files |
| --- | ---: | ---: |
| `answerIndex` | 31 | 2 |
| `correctAnswer` | 78 | 4 |
| `expectedAnswer` | 5 | 1 |
| `PIN` | 23 | 2 |
| `pinDigest` or emitted plural `pinDigests` | 7 | 1 |
| `Tutor` | 39 | 3 |
| `transcript`, case-insensitive | 5,817 | 271 |
| exact `service_role` | 0 | 0 |
| exact `service-role` | 0 | 0 |
| `localhost` | 3 | 1 |
| `127.0.0.1` | 1 | 1 |
| **Total** | **6,004** | **286 file/token pairs; 272 unique files** |

`pinDigest` is deliberately counted as the emitted plural `pinDigests`; a
word-boundary-only grep for singular `pinDigest` would incorrectly report zero.

## Exact emitted-file ledger

Hashes bind this ledger to the reproduced enabled output:

| Emitted file | SHA-256 | Provenance and reachability | Data/result | Classification |
| --- | --- | --- | --- | --- |
| `assets/index-B268OwtQ.js` | `9020189c98e2c0a9e25eb5ddb468db93977873770d6a3ccfdc7e8e74e4e2c91f` | Initial script from `index.html`; executes on every page. | 23 `answerIndex` + 8 `correctAnswer` form active client scoring, answer display, Tutor context, stored chat shape, and sync validation. The legacy app stores raw learner/parent PINs in AppState and raw Tutor messages/correct answers in Profile; sync validation and safety backup admit those shapes. Four loopback strings are SDK constants. No user value is embedded at build time. | Answer/PIN/Tutor runtime paths: `LEGACY_EXECUTABLE_BLOCKER`. Loopback: `FALSE_POSITIVE`. UI labels alone: `NON_SECRET_GENERIC_IDENTIFIER`. |
| `assets/Grade5MathPractice-i9U2RsCa.js` | `ae861549ca01937c541fb9531128b60235c9e90f6bbc72c44435f6a1ce2b0af9` | Public lazy chunk. The exact build leaves `VITE_GRADE5_MATH_PRACTICE_ENABLED` unset, so normal UI navigation cannot load it, but its asset URL is public and its code is executable. | 8 `answerIndex` + 65 `correctAnswer`; generators construct actual correct choices and the component scores selections in-browser. | `LEGACY_EXECUTABLE_BLOCKER` |
| `assets/FinalFamilyPilotApp-Bl3uQxzX.js` | `7ce11132d828ffad584d59641f9e6f874d3b5e514a330e73f48b0d953284e553` | Public lazy chunk loaded by enabled `/family-pilot`. | 4 `correctAnswer` in the local Tutor bridge and 5 `expectedAnswer` in the old Study action seam are executable functions, but current controller material never supplies `helpProblem`, the UI exposes only `startTutor`, no caller invokes `submitTutorTurn` or `submitStudyAction`, and no answer value is present. PIN/digest identifiers carry runtime local verifiers, not build data. The R2-source portable backup serializes the full Final app state, including any runtime `pinDigests`; that is security-relevant behavior, not an embedded digest. Three Tutor-transcript matches are the literal protective declaration `tutorTranscriptIncluded:false`; one is the disconnected session's empty in-memory `transcript:[]`. | Answer seams: `UNREACHABLE_BUT_SHOULD_REMOVE`. Backup declarations: `STATIC_WARNING_TEXT`. PIN/Tutor/service deny-list terms: `NON_SECRET_GENERIC_IDENTIFIER` for static provenance; PIN backup behavior requires policy review. |
| `assets/AdminConsoleRoute-QpWZ75Ij.js` | `a0cef58d46c08e7d5cf32d3767e85fc876e81f306eb3ed147686297ab531a939` | Public lazy Admin chunk, executable after the Admin route is requested; server authorization still gates data. | Its sole `correctAnswer`, Tutor/transcript proximity, and `serviceRoleKey` occurrences are members of `PROHIBITED_KEYS`; `hasProhibitedKey` rejects such server responses. No answer or credential value is present. | `NON_SECRET_GENERIC_IDENTIFIER` (protective validation) |
| `assets/StudyProductionRoute-B8WPDLwn.js` | `b4f8823fadde1c9d0f835accd999c833f25952552cce37e729d0107ae230b8ff` | Public lazy production Study route. | Four raw `transcript` substrings are production session/accessibility contract identifiers and status copy; none is near `Tutor` and none is transcript data. | `NON_SECRET_GENERIC_IDENTIFIER` |
| `curriculum/1.0.0/courses/**/*.json` | Generated payload family | 232 static legacy curriculum unit payloads; non-executable. | 2,786 uses of `transcript`, all educational/accessibility/media terminology. | `FALSE_POSITIVE` |
| `curriculum/1.0.0/grade-5/schedule.json` | Generated payload | Static schedule JSON; non-executable. | 3 educational uses of `transcript`. | `FALSE_POSITIVE` |
| `family-pilot-final/2.0.0/courses/*.json` | Generated payload family | 34 of the 90 lazy Family Pilot course payloads contain the term; non-executable JSON loaded only by course selection. | 2,973 uses of `transcript`, including readable-media fallbacks, captions/transcripts, academic transcripts, and lesson subject matter. No Tutor transcript marker or conversation data. | `FALSE_POSITIVE` |

The four JavaScript bundles named by the R2 gate are therefore not equivalent:
two contain active legacy answer authority, one contains disconnected legacy
answer seams without values, and one contains only protective rejection text.

## Answer-authority source-module ledger

Every answer occurrence mapped to these sources:

| Bundle | Token/count | Source modules and occurrence counts | Behavior |
| --- | --- | --- | --- |
| `index` | `answerIndex` 23 | `QuizSession.tsx` 10; `HsQuizRunner.tsx` 5; `generators4.ts` 3; `explain/diagnose.ts` 1; `explain/types.ts` 1; `generators.ts` 1; `generators6.ts` 1; `genUtils.ts` 1 | Generates questions, compares selections, reveals correct choices, and feeds correction/Tutor flows. Active and browser reachable. |
| `index` | `correctAnswer` 8 | `components/tutor/TutorChat.tsx` 3; `tutor/tutorChat.ts` 2; `QuizSession.tsx` 1; `TutorChatsView.tsx` 1; `sync/provenance.ts` 1 | Constructs Tutor context from the actual correct choice, retains/displays it in the legacy chat shape, and admits that shape to sync validation. Active and browser reachable. |
| Grade 5 Practice | `answerIndex` 8 | `Grade5MathPractice.tsx` 5; `generatorCore.ts` 3 | In-browser choice scoring and correct-choice rendering. Executable public asset; exact UI flag is off. |
| Grade 5 Practice | `correctAnswer` 65 | `generatorCore.ts` 2; unit 1 generator 12; unit 2 12; unit 3 10; unit 4 12; unit 5 12; units 6–10 one each | Authored/calculated answer values enter generated choice sets; client code then derives and displays authority. |
| Final Family Pilot | `correctAnswer` 4 | `family-pilot/tutor/tutorBridge.ts` lines 53, 154, and 171 | Local Tutor eligibility, outbound Tutor context, and answer redaction. No current material supplies the field and no multi-turn UI caller exists. |
| Final Family Pilot | `expectedAnswer` 5 | `family-pilot/study/FamilyPilotStudyRuntime.ts` 2; `family-pilot/final-composition/runtime.ts` 3 | Old Study submit-action forwarding/default. The current R2-source UI uses the learner-response runtime instead and never invokes this method. |
| Admin | `correctAnswer` 1 | `admin/learnerAnalyticsHttpSource.ts` line 20 | Protective forbidden-key response validator; no scoring or value. |

No `adultScoringAuthorityRef`, `answerAuthorityRef`, `restricted:adult`, answer-key
locator, scoring locator, scoring-guide path, or `/scoring/` path appears in the
enabled `dist` tree.

## PIN provenance

The 23 uppercase `PIN` hits resolve entirely to UI labels, errors, and prompts:

- initial `index`: `App.tsx` 9 and `GrownUps.tsx` 5;
- Final Family Pilot: `FamilyPilotStudentLogin.tsx` 3,
  `loginFlow.ts` 1, `controller.ts` 1, `FinalFamilyPilotApp.tsx` 2, and
  `FamilyPreferences.tsx` 2.

The seven `pinDigests` hits resolve to Final Family Pilot `state.ts` 4,
`controller.ts` 2, and `FinalFamilyPilotApp.tsx` 1. They describe an empty
default record, schema validation, local runtime assignment, and comparison.
No four-digit PIN and no digest value is embedded in JavaScript or JSON. The
Family Pilot controller computes the verifier only from a PIN entered at
runtime. In this exact R2 source, `exportFinalFamilyPilotBackup()` places the
entire `app.state` in the portable backup, so configured `pinDigests` travel
with that backup. The later independent acceptance branch treats one-way local
verifiers as acceptable and adds other PIN authorization repairs, but that
sibling commit is not part of this build. The uppercase token count was never
proof of a statically embedded PIN; the runtime backup behavior must be judged
separately against the release's PIN policy.

The legacy main app stores raw learner and parent PINs in AppState, serializes
the full state in its local safety backup, and includes Profile data in its sync
path. That is browser-reachable legacy behavior, not an embedded-output value,
and it is not covered by a Family-Pilot-only acceptance PASS.

## Tutor and transcript provenance

The raw `transcript` count is dominated by ordinary curriculum language:

| Family | Files | Occurrences | Meaning |
| --- | ---: | ---: | --- |
| JavaScript assets | 4 | 55 | Web Speech API transcript properties, accessibility contracts, curriculum-authoring caption fields, privacy deny lists, backup false declarations, and disconnected in-memory Tutor session fields. |
| Legacy curriculum unit JSON | 232 | 2,786 | Educational/media/accessibility text. |
| Legacy schedule JSON | 1 | 3 | Educational text. |
| Family Pilot course JSON | 34 | 2,973 | Educational/media/accessibility text. |

The five R2 Tutor/transcript proximity matches are exact:

1. Admin: `transcript` and `tutorChats` are adjacent entries in the response
   `PROHIBITED_KEYS` rejection set.
2. Final Family Pilot, three occurrences: `tutorTranscriptIncluded:false` is
   constructed, required on parse, and reconstructed on restore.
3. Final Family Pilot, one occurrence: the disconnected local Tutor branch
   initializes an empty in-memory `transcript:[]`.

No built artifact contains a Tutor message, learner utterance, or restored
Tutor transcript. The current R2-source Final UI calls only `startTutor`; it neither
submits a turn nor persists a session. The initial bundle still contains the
separate legacy Tutor chat implementation. It stores raw messages and
`correctAnswer` in `Profile.tutorChats`, and the sync validator admits that
shape. That browser-reachable privacy behavior is part of the initial-bundle
legacy blocker and must not be confused with the Final Family Pilot path, which
does not persist a conversation.

## Service-role provenance

There are no exact `service_role` or `service-role` strings. The recovered R2
regex additionally matches camelCase and therefore finds:

- `src/admin/learnerAnalyticsHttpSource.ts`: `serviceRoleKey` is a prohibited
  response key; the Admin client rejects any nested occurrence.
- `src/study/family-pilot/durable-ports/minimization.ts`: `servicerolekey` is a
  case-insensitive persisted-field deny-list member.

Both are executable protective validation. Neither reads an environment value,
creates a service client, or contains a credential. No
`SUPABASE_SERVICE_ROLE_KEY` literal is present in browser output.

## Exact localhost dependency

All four local-host matches are in the initial bundle and map to installed
Supabase SDK version `2.110.8`:

| Source | Source line | Literal purpose | Runtime conclusion |
| --- | ---: | --- | --- |
| `node_modules/@supabase/auth-js/dist/module/lib/constants.js` | 19 | `http://localhost:9999`, the Auth client library default URL constant | Not selected by this app. |
| `node_modules/@supabase/auth-js/dist/module/lib/webauthn.js` | 229 | hostname validity check accepts `localhost` for WebAuthn development | Validation branch, not a destination. |
| `node_modules/@supabase/supabase-js/dist/index.mjs` | 254 | log-redaction allowlist adds `localhost`, `127.0.0.1`, and `[::1]` | Redaction metadata, not a destination. |

Import chain:

```text
index.html
  -> src/main.tsx
  -> src/App.tsx
  -> src/sync/useSync.ts
  -> src/sync/supabase.ts
  -> @supabase/supabase-js
  -> @supabase/auth-js
```

`getSupabaseClient()` returns `null` unless both `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` are nonempty. When configured,
`createSupabaseBrowserClient()` passes that explicit URL to `createClient`;
there is no call site that constructs Auth without an explicit configured URL.
When unconfigured, the SDK is imported but no client is constructed. Therefore
production runtime does not depend on a development endpoint. The four strings
are `FALSE_POSITIVE`, although an isolated Family Pilot entry would also avoid
shipping this unused SDK code.

## Import chains

```text
Initial legacy scoring
index.html -> main.tsx -> App.tsx
  -> generators.ts -> generators4.ts / generators6.ts / genUtils.ts
  -> QuizSession.tsx -> TutorChat.tsx -> tutor/tutorChat.ts
  -> HighSchoolHome.tsx -> HsQuizRunner.tsx
  -> GrownUps.tsx -> TutorChatsView.tsx
  -> useSync.ts -> sync/provenance.ts

Disabled-route Grade 5 scoring
App.tsx -> dynamic import Grade5MathPractice.tsx
  -> grade5MathPracticeUnits.ts
  -> grade5MathUnit{1..10}Generator.ts
  -> generatorCore.ts

Final Family Pilot disconnected answer seams
App.tsx -> dynamic import FinalFamilyPilotApp.tsx
  -> final-app/controller.ts
  -> final-composition/runtime.ts
  -> study/FamilyPilotStudyRuntime.ts
  -> tutor/tutorBridge.ts

Admin protective identifiers
App.tsx -> dynamic import AdminConsoleRoute.tsx
  -> admin/learnerAnalyticsHttpSource.ts

Generated payload transcript text
npm run build
  -> scripts/build-curriculum.mjs -> public/curriculum -> dist/curriculum
  -> scripts/build-final-family-pilot-data.mjs
     -> public/family-pilot-final -> dist/family-pilot-final
```

## Required repairs

1. Remove the initial legacy client scorer, raw-PIN AppState/backup, and raw
   Tutor chat/answer persistence from the Family Pilot publication boundary.
   Either migrate required behavior to trusted/minimized contracts or build
   Family Pilot from an isolated entry that cannot emit the legacy main app.
2. Do not emit the Grade 5 Math Practice chunk when its production flag is off.
   A runtime navigation gate is insufficient because the public chunk still
   contains executable answer authority.
3. Remove the disconnected `correctAnswer` local-Tutor seam and
   `expectedAnswer` old Study-action seam from the Final Family Pilot production
   closure. They contain no current release data, but their executable public
   code is unnecessary and violates a literal zero-answer-code policy.
4. Replace blanket token failure with provenance-aware rules for protective
   deny lists, `tutorTranscriptIncluded:false`, educational “transcript” text,
   PIN labels, and SDK constants. Do not “repair” these by obscuring or
   minifying names.
5. Prefer an isolated Family Pilot entry that does not import legacy sync; that
   removes the unused Supabase SDK and its localhost constants. No endpoint
   rewrite is required because there is no localhost runtime dependency.
6. Decide explicitly whether portable backups may contain the Final local PIN
   verifier. If not, strip `pinDigests` during export and require fresh local
   PIN setup after restore; do not obscure the property name to satisfy grep.

No production repair was made in this audit.

## Tests

| Command/proof | Result |
| --- | --- |
| `env VITE_FAMILY_PILOT_ENABLED=true VITE_USE_PROXY=true npm run build` | PASS; 553 modules; 344 text artifacts |
| Matching temporary `vite build --sourcemap` | PASS; 242/242 JavaScript token occurrences mapped; 0 unresolved |
| `node --test scripts/audit-web-sensitive-provenance/audit.test.mjs` | PASS; 3/3 |
| `node scripts/audit-web-sensitive-provenance/audit.mjs --root dist` | PASS as inventory; reproduced 143 R2 occurrences and all R2 file counts |

## Classification ledger

| Classification | Findings |
| --- | --- |
| `REAL_RELEASE_BLOCKER` | None. No actual secret, PIN, PIN digest, Tutor conversation, or release answer payload is embedded. |
| `LEGACY_EXECUTABLE_BLOCKER` | Initial bundle answer/scoring authority plus raw legacy PIN/Tutor persistence/sync behavior (31 answer occurrences), and Grade 5 Practice answer generation/scoring (73). |
| `NON_SECRET_GENERIC_IDENTIFIER` | PIN UI/runtime names and verifier property names (no embedded value), Tutor labels, Admin forbidden keys, service-role deny-list members, accessibility/session contract names. |
| `STATIC_WARNING_TEXT` | Three Final Family Pilot `tutorTranscriptIncluded:false` declarations/checks. |
| `UNREACHABLE_BUT_SHOULD_REMOVE` | Final Family Pilot local Tutor `correctAnswer` code (4) and old Study `expectedAnswer` forwarding (5): executable in the chunk, disconnected from the current R2 UI/data flow. |
| `FALSE_POSITIVE` | 5,762 JSON educational/accessibility “transcript” uses, four Supabase SDK loopback constants, academic-transcript prose, and Web Speech API transcript properties. |

Final audit classification: **WEB_SENSITIVE_PROVENANCE_COMPLETE**.
