# Authority Boundary Matrix

| Decision or record | Tutor Core authority | Study authority | Bridge responsibility |
|---|---|---|---|
| Assessment and item evaluation | Sole | None | Validate version; minimize result |
| Mastery/advance | Sole | Must not override | Reject forged one-answer claim |
| Misconception hypothesis | Sole | Must not invent | Preserve stable ID/status only |
| Prerequisite reasoning | Sole | Schedule approved response | Require graph-backed provenance |
| Confidence/uncertainty | Sole for Tutor statistic | Study self-report remains separate | Preserve numeric bounds and provenance |
| Teaching/reteaching | Sole | Work-block placement only | Map advisory phase requests |
| Instructional safety | Sole except approved pre-Core gap | None | Run urgent gateway before Core |
| Visual/spoken/narration/captions | Sole content authority | Presentation timing only | Validate/fallback; exclude transcript persistence |
| Work block and timer | None | Sole | No mastery effect |
| Break/pause/resume | None | Sole | Preserve neutral event/checkpoint |
| Focus-duration recommendation | None | Sole | Outbox proposal only |
| Review date and calendar pacing | Recommends instructional need | Sole | Require local date and IANA zone |
| Parent timing controls | None | Sole | Preserve decision provenance |
| Session completion | None | Sole | Send low-detail review input to Tutor |
| Adult-private notes | None | Authorized adult/private store | Never create or project a note body |
| Persistence/queue/calendar | None | Production owners | Declare ports only |

## Enforced invariants

- One answer cannot establish mastery.
- Low accuracy alone cannot establish disengagement.
- Pacing, breaks, pauses, or technical interruptions cannot become mastery
  failures.
- A student-requested or approved break cannot lower mastery.
- Only Tutor Core may name a misconception or prerequisite outcome.
- A bridge recommendation always declares
  `masteryDecisionMade:false` and `pacingDecisionMade:false`.
- Unsupported inputs quarantine before producing evidence, recommendations,
  or hooks.
