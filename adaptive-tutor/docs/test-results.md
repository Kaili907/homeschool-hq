# Adaptive Tutor Core v0.2 — Test Results

**Overall result: PASS**

Final verification command:

```bash
npm run check
```

## Results

| Verification | Result | Evidence |
|---|---|---|
| Strict TypeScript | PASS | `tsc -p tsconfig.json --noEmit` completed with no errors. |
| Automated behavior tests | PASS | 21 passed, 0 failed, 0 skipped. |
| Static build | PASS | TypeScript declarations, browser prototype, and schema artifacts built in `dist/`. |
| JSON Schema export | PASS | 14 draft 2020-12 JSON Schema files generated. |
| Browser smoke test | PASS | Local server loaded HTML, JavaScript, and CSS; speech, AI identity, Jarvis styling, and reduced-motion assertions passed. |
| Package validation | PASS | 19 passed, 0 failed. |

## Covered behaviors

The test suite verifies:

- A single answer never establishes mastery.
- Independent mastery requires at least three items across at least two contexts.
- Repeated varied evidence can reduce uncertainty.
- Guided evidence receives less weight than independent evidence.
- Assessment scoring and adaptive phase transitions work.
- Weak evidence leads to supportive reteaching rather than shame.
- Alternate explanations remain valid.
- Misconception classification preserves uncertainty.
- Prerequisite graphs reject cycles.
- Visual-board contracts reject arbitrary executable commands.
- Missing-media and missing-voice fallbacks keep instruction usable.
- Jarvis cannot claim to be human.
- Graded-work completion, diagnosis requests, and identifying information are safely redirected or redacted.
- Parent/teacher review remains explicit about uncertainty and cannot make placement decisions.

The complete console output is preserved in `docs/final-check.log`.
