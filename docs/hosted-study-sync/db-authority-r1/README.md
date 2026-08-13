# Hosted Study database authority R1

This directory is the handoff for the final, unapplied hosted Study database
and authority layer needed by cross-device Family Pilot synchronization.

The implementation is additive. It retains the audited local Family Pilot
behavior, reuses the canonical Study session/checkpoint/grant tables, and adds
one one-to-one session-authority extension for safety, guardian attestation and
sync metadata. It stores no raw Tutor transcript, private answer, emotional
label, personality inference or diagnostic inference.

Start with:

- `migration-ledger.md` for historical lease reconciliation and new checksums.
- `authority-contract.md` for actors, binding rules and data minimization.
- `rls-matrix.md` for the primary row boundary and negative cases.
- `function-signature-ledger.md` for exact callable signatures and grants.
- `cross-device-db-primitives.md` for hydrate, CAS and idempotency semantics.
- `local-validation-report.md` for executable evidence.
- `hosted-apply-plan.md` for the future authorized apply sequence.
- `input-branch-ledger.md` for audited production branch tips.

No hosted Supabase endpoint was contacted, no hosted migration was applied,
and no deployment, production-hosting or Tutor activation action was taken.
