# Final Family Pilot acceptance harness

This directory is a release-independent, data-driven acceptance boundary. It
does not compose the application or select production implementations.

`runFinalFamilyPilotScenarioLibrary(injection)` runs the required scenarios in
order. Final convergence supplies one `FinalFamilyPilotHarnessInjection`:

- curriculum provider
- production-material provider
- factory for a fresh complete `StudyPortBundle`
- completion/attestation policy
- safety port, including a deterministic hold trigger and parent clear
- backup/recovery port
- isolated persistence factory
- runtime adapter factory
- deterministic clock

The included reference adapters prove the contract and make the suite runnable
now. They are not production composition. A final-release adapter implements
`FinalFamilyPilotRuntimeFactory`, translating the stable acceptance operations
to the release's public Family Pilot APIs while injecting the real providers.

Reload tests retain only the persistence port and create a new runtime with a
new Study port bundle. Corrupt/future-state tests receive their own persistence
instances so recovery evidence is never overwritten. Fixtures use only opaque
`synthetic:*` references and the supported grades 5, 7, and 8.
