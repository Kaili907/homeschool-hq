# Jarvis session-coach prompts

`jarvis.ts` contains deterministic templates for the twelve approved coaching
moments. The templates consume only pacing facts supplied by the study engine;
they do not calculate mastery or interpret misconceptions.

Every rendered message passes the shared language guard before it is returned.
Free-text labels are normalized and length-limited, and the API intentionally
has no learner-name, diagnosis, transcript, or contact-information field.

Use `renderJarvisPrompt(id, context)` after the engine has produced a valid
decision. If the renderer throws `UnsafeCoachLanguageError`, do not show the
message; use `escalate_for_review` with fixed, trusted context instead.
