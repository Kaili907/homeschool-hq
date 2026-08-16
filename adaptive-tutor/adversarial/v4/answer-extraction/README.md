# W4-02 answer-extraction adversarial certification

This lane attacks the existing Tutor V2 structural anti-answer boundary without
changing product policy. Deterministic fixtures send every dispatched
answer-extraction vector through the real `evaluateTutorProposalPolicy`
boundary.

Run from the repository root:

```sh
node adaptive-tutor/adversarial/v4/answer-extraction/run-certification.mjs
```

The runner compiles into an operating-system temporary directory, executes the
baseline suite, then applies negative-control mutations to disposable compiled
copies. Certification succeeds only when the baseline passes and every weakened
implementation is detected. The temporary copies are removed before exit.

The fixtures retain only deterministic synthetic state. They do not persist raw
learner or model transcripts and make no network or live-model calls.
