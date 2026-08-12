# Technology and Computer Science — Accessibility, Safety, and Privacy Policy (Grades 3–4)

This policy extends the shared Manuel Academy instructional policy
(`curriculum-content/manuel-academy/1.0.0/policies/instruction-mastery-accessibility-safety.md`) with
requirements specific to elementary technology and computer science, per the G34-M7 authoring brief.

## Credentials and live systems (non-negotiable)

- Lessons never request a real password, account credential, API key, security question answer, or
  account-recovery data from a learner. Where a lesson practices password or passphrase strength, it uses
  fictional, example, or throwaway values only.
- All accounts, websites, networks, and systems referenced in guided or independent practice are fictional
  or explicitly sandboxed. No lesson teaches or requires probing, scanning, exploiting, or bypassing access
  controls on a real external system.
- The tutor (human or AI) may explain a concept, demonstrate a step, ask guiding questions, and help debug
  a learner's own code or work. It must never silently complete a graded project, assessment, or portfolio
  piece in the learner's place.

## Accessibility (every lesson)

Every lesson in `lessons.jsonl` carries an `accessibility_and_accommodations` block guaranteeing:

- readable text plus optional audio, with no voice feature ever required;
- one-action-at-a-time chunked directions and a worked example or model;
- typed, handwritten, spoken, drawn, manipulative, or demonstrated response modes wherever the standard
  permits;
- extended time, hidden timers, movement breaks, and low-distraction settings on request;
- captions, alt text, high-contrast print, keyboard access, and text-only fallbacks for any optional media.

Media is always optional (`media.required: false`) with a stated text/description/demonstration fallback,
so no lesson depends on a device with audio, video, or a specific input method.

## Safety and privacy (every lesson)

Every lesson's `safety_and_privacy` block includes:

- respectful, non-shaming language and pause/break options that are never treated as failure;
- a standing prohibition on requiring a real password, private message, precise location, account
  credential, API key, or identifiable image;
- a standing requirement to use only fictional or sandboxed systems, accounts, and data;
- a standing requirement to use approved sites/tools and respect filters, access controls, licensing, and
  terms of service — never to bypass them;
- guidance that AI output is a draft to verify, never an authority or a substitute for the learner's own
  work;
- an explicit statement of the tutor-authority boundary described above.

## Guardian visibility

Parent/guardian summaries (see `parent_or_guardian_visibility` on each lesson) share the lesson target,
completion state, evidence type, and next instructional step. They never expose raw private reflections,
raw answers, or diagnosis language, and collect only the guardian confirmation actually needed for a
safety-critical task.

## Mastery

No lesson or assessment establishes mastery from a single answer. See each lesson's `mastery_rule` and each
unit's `assessments.json` entry for the multi-evidence, multi-occasion mastery policy.
