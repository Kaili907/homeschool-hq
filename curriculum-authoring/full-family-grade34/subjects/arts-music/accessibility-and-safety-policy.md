# Arts and Music — Accessibility, Safety, and Privacy Policy (Grades 3–4)

This policy extends the shared Manuel Academy instructional policy
(`curriculum-content/manuel-academy/1.0.0/policies/instruction-mastery-accessibility-safety.md`) with
requirements specific to elementary arts and music, per the G34-M7 authoring brief.

## Presentation and media (non-negotiable)

- No lesson or capstone ever requires public performance. Every performance/presentation task in
  `units.json` and `lessons.jsonl` states or permits a private, small-audience, recorded-for-self-review,
  or written/described alternative.
- No lesson ever requires a voice recording. Music tasks that could involve singing always offer an
  instrument, body-percussion, written notation, or described alternative.
- No lesson ever requires a camera or photo. Visual-art tasks that could involve photographing work always
  accept a description, written reflection, or in-person/live sharing with the facilitator instead.
- Media in every lesson is optional (`media.required: false`) with a stated text/description/demonstration
  fallback.

## Copyright and authorship (non-negotiable)

- Lessons use only original student work, public-domain material, or properly licensed excerpts. No lesson
  imports or asks a learner to reproduce full copyrighted lyrics, sheet music, or other protected works
  without appropriate rights.
- The submitted graded work must remain the student's own authorship. Adult or AI assistance may support
  planning, technique demonstration, or feedback, but must not create the graded work itself.

## Accessibility (every lesson)

Every lesson in `lessons.jsonl` carries an `accessibility_and_accommodations` block guaranteeing:

- readable text plus optional audio, with no voice feature ever required;
- one-action-at-a-time chunked directions and a worked example or model;
- typed, handwritten, spoken, drawn, manipulative, or demonstrated response modes wherever the standard
  permits;
- extended time, hidden timers, movement breaks, and low-distraction settings on request;
- captions, alt text, high-contrast print, keyboard access, and text-only fallbacks for any optional media.

## Safety and privacy (every lesson)

Every lesson's `safety_and_privacy` block includes:

- respectful, non-shaming language and pause/break options that are never treated as failure;
- protection of hearing (volume/exposure), ventilation, and tool safety for materials-based work, plus
  copyright, cultural context, and respectful representation;
- the standing no-public-performance / no-voice-recording / no-camera guarantee described above;
- the standing copyright and student-authorship guarantee described above.

## Guardian visibility

Parent/guardian summaries (see `parent_or_guardian_visibility` on each lesson) share the lesson target,
completion state, evidence type, and next instructional step. They never expose raw private reflections,
raw answers, voice recordings, or diagnosis language, and collect only the guardian confirmation actually
needed for a safety-critical task (for example, materials or tool use).

## Mastery

No lesson or assessment establishes mastery from a single answer. See each lesson's `mastery_rule` and each
unit's `assessments.json` entry for the multi-evidence, multi-occasion mastery policy.
