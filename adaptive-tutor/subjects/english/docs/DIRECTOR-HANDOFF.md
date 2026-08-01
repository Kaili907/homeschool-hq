# Director Handoff — Adaptive English v0.2 Packaging-Corrected Candidate

## Delivery status

Packaging portability correction complete. Four unchanged adaptive English modules remain aligned with Adaptive Tutor Core v0.2.0 and packaged under the English subject boundary. This candidate is returned for independent review and is not declared Director-frozen.

## Review path

1. Open `demo/index.html` and switch between the reading and writing interventions.
2. Exercise all four tutoring modes and one diagnostic item in each intervention.
3. Review `VALIDATION-REPORT.generated.md` for contract-level results and classifications.
4. Review `TEST-RESULTS.md`, `FILE-INVENTORY.generated.md`, and `package-manifest.generated.json`.
5. Verify `manuel-academy-adaptive-english-v0.2.0-packaging-corrected.zip` against its adjacent `.sha256` file.
6. Repeat build, test, validation, and standard Info-ZIP extraction on a native POSIX Node runtime before Director Freeze.

## Acceptance summary

- Curriculum: four of four required modules complete.
- Core alignment: all required v0.2 runtime schemas pass.
- Safety and pedagogy: tutoring boundaries are encoded and tested.
- Demo: one reading and one writing intervention, generated from validated contracts.
- Media: narration, transcript, captions, WebVTT, and no-media fallback included.
- Packaging: raw nested ZIP names use `/`; no raw name contains `\`; 46 file entries reconcile with the generated inventory.
- Portability: cleanup guards use separator-neutral Node path operations and exact target basenames.
- Core changes: none.
- External integrations: none.

## Integration decision

Install the extracted folder at `adaptive-tutor/subjects/english` beside the approved `adaptive-tutor/core` package. The English package expects exactly Core v0.2.0.
