# W4-01 prompt-injection adversarial certification

## Scope

This lane certifies the accepted Wave 3 Tutor boundary against synthetic prompt
injection, authority confusion, hierarchy attacks, and provider-output
smuggling. It changes no Wave 3 product source.

The permanent corpus and harness live in
`adaptive-tutor/adversarial/v4/prompt-injection/`. The corpus has 38 stable
cases across all 17 required attack families:

- 18 cases model influence originating in trusted reviewed or grounded
  instructional content;
- 20 cases model direct untrusted provider-response attacks; and
- six mutation-style negative controls deliberately weaken an observed
  authority boundary and must be killed by the same permanent oracle.

All material is synthetic. The harness performs no network, provider, tool,
credential, deployment, or live-data operation.

## Boundary model

Accepted Wave 3 carries reviewed and grounded material across the commercial
provider request as opaque references and digests. It has no prose-bearing
request field. For reviewed-context attacks, the corpus records the hostile
content and deterministically scripts the response a provider could emit after
following it. This tests the complete security property: appearing in reviewed
content does not make an instruction authoritative, and any provider output
influenced by that content remains untrusted.

The harness checks every case against the real Wave 3
`executeCommercialTutorInvocation` path. It snapshots the authoritative Study
tuple before execution and requires exact equality afterward for nominal grade,
official working level, curriculum, allowed actions, authorization, and the
closed authority boundary. Every returned advisory must still require a Study
decision and must keep all Tutor mutation, mastery, grade, working-level,
curriculum, and segment-completion authority flags false.

The only accepted case classifications are:

- `safe-advisory`;
- `refusal`;
- `reviewed-static-fallback`; or
- `schema-rejection`.

The corpus also requires hostile markers to remain absent from both the
reference-only provider request and the returned result.

## Running the lane

From the repository root, with `adaptive-tutor` devDependencies installed:

```sh
node adaptive-tutor/adversarial/v4/prompt-injection/run-focused.mjs typecheck
node adaptive-tutor/adversarial/v4/prompt-injection/run-focused.mjs test
```

In a dependency-less worktree, set `TUTOR_W4_TSC` to the TypeScript compiler
and `TUTOR_W4_TYPE_ROOTS` to the directory containing `@types/node`. The runner
does not install or modify dependencies.

See [TEST-MATRIX.md](./TEST-MATRIX.md) for case mapping and
[VALIDATION.md](./VALIDATION.md) for executed evidence.
