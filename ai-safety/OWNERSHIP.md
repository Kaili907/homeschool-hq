# Session 3 ownership resolution

Resolved before implementation on 2026-07-28.

- Safety core and documentation: `ai-safety/**`
- Parent/student interface: `app/features/ai-safety-center/**`
- Safety test suite: `tests/ai-safety/**`

No equivalent pre-existing safety-center directories were found. These exact paths
are therefore the Session 3 ownership boundary. The pre-existing
`adaptive-tutor/**` tree and all shared `src/**`, identity, role, transcript, and
parent-review infrastructure are read-only integration dependencies for this
session.
