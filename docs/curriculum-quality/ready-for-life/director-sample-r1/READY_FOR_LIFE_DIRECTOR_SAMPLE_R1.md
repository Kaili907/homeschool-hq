# Ready for Life — Director Sample R1

## Review status

`READY_FOR_LIFE_DIRECTOR_SAMPLE_R1_READY_FOR_REVIEW`

This is one development-only representative sample for Director review. It is not approval of the draft Ready for Life standard, a full-corpus repair, a production route, a Tutor V2 implementation, or a claim that all 324 Ready for Life lessons conform.

## Authority and inputs

| Input | Reference |
| --- | --- |
| Requested base | `a7c6edee867e0d3f546aaa6e0442fac434b75c84` |
| Ready for Life lesson standard R1 | `origin/mac/ready-for-life-lesson-standard-r1` at `fe0f0139760edca0138b8da122a982f05e79e8ef` |
| Subject authority | `MANUEL_ACADEMY_LOCAL_COMPOSITION` |
| Representative source lesson | `ma-g3-ready-for-life-u01-l04` |

No Michigan standard, state code, health code, legal rule, or other external authority is claimed. The sample intentionally does not copy the unverified corpus label `Michigan Health/SEL connections`.

## Representative lesson decision

Selected lesson: `ma-g3-ready-for-life-u01-l04`, the Grade 3 Unit 1 application lesson previously titled `Application or project: spotting unsafe items`.

The standard names this lesson in its recommended Director slice as a guardian/safety positive control. It is the strongest single sample for the mission because one bounded lesson can expose all of the high-value Ready for Life seams:

- a clear, physical safety skill with observable steps;
- adult-local materials and a fully delivered equal-credit alternative;
- a worked model with decision reasoning;
- a coached first attempt and correction turn;
- an independent real-life application;
- minimally sensitive evidence and a short process reflection;
- an immediate safety retry with a parallel transfer card;
- route-specific completion authority; and
- the line between Tutor coaching and guardian certification.

The Director sample version is titled `Spot, Stop, Ask: A Safe-Space Check`. It preserves the source lesson identity while replacing the thin/generic experience for review purposes. The existing 324-lesson production corpus is unchanged pending Director acceptance and a separately authorized corpus repair.

## Important correction to the source task

The source package asks the learner to find at least four actual unsafe conditions. That can imply a home ought to contain hazards and can turn household conditions into required academic content. This sample instead asks the learner to complete five risk-based checks. Finding no hazard is a valid outcome when each check has a reason.

The source simulation refers to printed or hand-drawn room pictures that are not delivered with the lesson. This sample embeds all six complete fictional scene cards in the preview. It also embeds the risk-word strip, model, guided card, and retry pair. If a named embedded resource does not resolve, the Tutor instruction is to stop and identify the missing item, never fabricate it.

## Lesson contract demonstrated

| Contract area | Sample evidence |
| --- | --- |
| Goal | Learner-visible `Spot–Stop–Name–Ask` goal states the setting, five risk families, no-touch boundary, and successful outcome. |
| Readiness | Home Check names permission/supervision needs before start; Scene Check works without home access or an adult. |
| Materials | Three embedded/versioned learner resources plus two explicitly adult-local Home Check materials. Every material names its use. |
| Model | The lamp-cord sample shows a starting condition, four visible expert moves, risk reasoning, adult handoff, and a criteria check. |
| Guided attempt | The unknown-bottle card receives process feedback, then a fresh book-on-shelf correction turn before release. |
| Independent transfer | Learner chooses the real Home Check or the complete six-scene equal-credit simulation. Neither requires the home to contain a hazard. |
| Evidence | Only risk words/check status, invented-scene responses, a non-sensitive reflection, and minimal route-specific attestation. |
| Retry | Trigger → contrast reteach → supported card → feedback → fresh parallel card → exit criterion → return path. |
| Duration | `30–40` active minutes in one session; `12–18` adult minutes for Home Check; `30–35` simulation minutes. |
| Completion authority | Guardian certifies only the physical Home Check. Learner evidence completes the fictional simulation without claiming a physical event. |
| Tutor metadata | Public coaching scope, ordered hints, exact resource refs, privacy limits, authority handoff, and non-invention behavior are recorded. |

## Learner flow

1. `Get ready` — goal, honest time, delivered materials, and the risk-word strip.
2. `Watch` — one complete cord-across-a-path model with reasoning and success check.
3. `Try together` — an unknown-bottle guided choice, feedback, and fresh correction turn.
4. `Your turn` — select `Scene Check` or guardian-authorized `Home Check`.
5. `Show it` — small process record plus one privacy-bounded reflection.
6. `Try again` — the complete retry loop remains visible and available without shame language.
7. `Finish` — route-specific authority and the Tutor/guardian boundary.

The preview defaults to Scene Check so a Director can begin without inventing household access or authorization. The Home Check tab shows learner self-report separately from the adult-only preview attestation. The preview attestation creates no production record and requests no name, signature, room, item, photo, recording, address, or location.

## Evidence and scoring boundary

The learner-safe preview contains no hidden scoring answer key. Guided feedback is public instructional content. Independent scene responses are saved only in component state for review and are not marked correct by the browser.

Observable review criteria are:

- the response names how harm could occur or gives a supported safe/unsure decision;
- the learner uses point-without-touching and adult-handling boundaries;
- every selected path checkpoint is completed and a missed safety step is revised; and
- the reflection is relevant without requiring a preferred opinion or private family detail.

The guardian attestation establishes only that permission, observation, no-touch behavior, adult handling, and five physical checks occurred. It does not establish the academic quality of the reflection or infer effort, honesty, maturity, responsibility, diagnosis, or character.

## Tutor / AI boundary

The curriculum-side metadata allows a future Tutor to read cues, rehearse the four moves, ask for risk mechanisms on invented scenes, and coach the documented retry. It requires the Tutor to pause at household permission, physical handling, observation, and attestation.

The Tutor cannot:

- grant household permission;
- request home, product, medicine, account, location, schedule, or family details;
- ask for photos, audio, or video;
- observe or claim a physical condition;
- direct the learner to touch or move an item;
- impersonate a guardian or convert learner self-report into guardian signoff; or
- fabricate a missing model, card, checklist, or other resource.

## Director preview

Development-only path:

`http://127.0.0.1:5173/__review/ready-for-life`

Run from this worktree:

```sh
npm run dev -- --host 127.0.0.1
```

The entry is an exact path and is gated by `import.meta.env.DEV`. The preview module is not reachable through the production route gate. Existing Family Pilot, Dashboard, learner login, and legacy routes are unchanged.

## Director review questions

1. Is `Spot, Stop, Ask` the right learner-facing title for the preserved lesson identity?
2. Should the production contract formally support route-specific authority (`guardian` for physical action, `learner` for a fictional equal-credit alternative)?
3. Is the five-check Home Check sufficiently authentic without requiring the learner to find a hazard?
4. Are six independent simulation scenes the right burden for Grade 3?
5. Is the guardian attestation minimal enough while still certifying the physical event?

## Scope statement

Changed for this sample:

- one typed Ready for Life Director sample contract;
- one development-only preview route and interactive surface;
- focused content, rendering, and route tests; and
- this decision/evidence record.

Not changed:

- the canonical Ready for Life 324-lesson corpus, manifests, projections, scoring records, or checksums;
- any state or external-authority mapping;
- Tutor V2 or any AI service;
- production routing, authentication, persistence, completion, or attestation runtime; or
- deployment configuration.

## Classification

`READY_FOR_LIFE_DIRECTOR_SAMPLE_R1_READY_FOR_REVIEW`
