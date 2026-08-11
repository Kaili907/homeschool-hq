# Final release candidate validation

Run the deterministic local release-candidate gates after the Mac and Windows
integration branches have been combined:

```sh
npm run validate:release-candidate
```

For machine-readable output:

```sh
npm run validate:release-candidate:json
```

The harness runs a fixed gate order and never performs hosted preflight,
deployment, or provider operations. Test and build subprocesses do not receive
hosted service credentials. The unified local production preflight may inspect
its environment, but its own read-only/no-hosted-contact result is enforced.

Required capabilities fail closed. Exact repository scripts are preferred;
where integration contributes a named suite without a package script, discovery
is limited to that suite's test paths. A missing mandatory capability yields
`BLOCKED_BY_MISSING_GATE`. Study local production smoke is non-blocking only
when it is not installed. Curriculum validation is run when its validation
suites are present.

Every JSON gate result includes `gate`, `status`, `durationMs`, `reason`, and
`blocking`. The operator report presents the same fields and one bounded final
classification. Raw subprocess output is not copied into reports, and concise
failure reasons are redacted before serialization.
