# Migration strategy and supersession

Strategy A is selected. Repository policy freezes every migration that has entered hosted history and requires additive repair for their definitions. It does not freeze a migration that has never been applied to the hosted project.

> **Superseded 2026-08-07.** The paragraph above read "freezes the three historical foundation migrations" and "does not freeze a Study migration that verified hosted preflight proved was never applied". The policy is unchanged; the set it applies to has grown. The frozen set is now the ten migrations recorded as applied in the hosted ledger — four foundation and six Study — and no longer three. The second clause was also stronger than the evidence ever supported: no hosted preflight proved the Study migrations were never applied, and the six were in fact applied on 2026-08-03. See `hosted-applied-evidence.json`.

`20260801170000_academy_study_adult_review_operations.sql` is therefore corrected in place before first application. The unsafe accepted checksum `46C68426D21A79B90A3011D5FBFCCA19044393887636DD845CA362F6E4E69443` is classified `superseded-before-first-application`. It must never appear in the executable approved checksum set.

> **Confirmed 2026-08-07.** First application has since been dated: 2026-08-03. The classification above therefore stopped being a plan and became a checkable claim, and it checks out — the migration bytes at master `6e78632`, the tree the Aug 3 push ran from, reproduce exactly today and carry the corrected canonical checksum, not the unsafe one. The unsafe bytes were never applied. Derivation in `hosted-applied-evidence.json`.

The corrected checksum and any narrow Session 19 reconciliation migration are recorded in `migration-manifest.json`. No migration was applied locally to a hosted project.

The corrected canonical LF checksum is `562b67462148d9e94933b0fd9007fad37a3b0a08cb8432383c0b228088c0d8eb`. The additive final reconciliation migration is `20260801190000_academy_study_final_production_reconciliation.sql`, with canonical LF checksum `d4ccea295aac2bda67dbfd310650e1c625de867485ecc47f5e993f74c8006d00`.

## C2 integration sequencing (recorded 2026-08-07, no C2 file changed here)

`study-c2-receipt-pin-correction` at `7e5a3a1c4a6e968cc9b4c1a935cc3e4b099edbb3` was inspected read-only. It forked at `0d95d28`, before the four preflight-hardening commits and before this reconciliation, so it has no frozen historical floor at all and does not touch `scripts/study-migration-preflight.mjs`.

C2 appends one forward migration, `20260806140000_academy_study_c2_operations_contract.sql`, depending on `20260806120000_academy_study_in_app_receipt_timestamp.sql`. That append is correct and survives this reconciliation untouched: it sits above the whole historical prefix and is genuinely never-applied work.

The conflict is not the append. It is that C2 carries a **whole copy** of `migration-manifest.json` from before this reconciliation, in which the six original Study migrations are still `executable` / `not-applied-hosted`. Resolving the merge in C2's favour — the ordinary "take the branch that owns this file" reflex — would silently restore six already-applied migrations to executable status and offer them for replay.

Measured, not predicted. Running C2's manifest through this branch's gate returns `frozen-historical-baseline-demoted` with an executable checksum set of **eight**: the six already-applied Study migrations, the Aug 6 receipt migration, and C2's new one. The floor catches it, which is the floor working as designed — but a caught merge is still a merge that must be redone, and the floor is a backstop, not the plan.

The correct integration is therefore **rebase or compose C2 onto this reconciliation**, not merge this into C2:

1. Start from this branch's manifest — ten `historical-baseline` / `hosted-applied-ledger-recorded` entries and one executable.
2. Append C2's `20260806140000` entry verbatim, unchanged: `executable`, `not-applied-hosted`, dependency `20260806120000_...`, sha256 `8448c6d1d6eec2247a913cfb18bd21b8fd9f6793bab5acd81b414878e5333baf`.
3. Change nothing else in the manifest. In particular, do not reintroduce `not-applied-hosted` on any of the ten.
4. Expected result: two executable migrations, floor still ten, gate still `allowed:false` on evidence flags alone.

Any resolution that produces more than two executable entries on this lineage is wrong.

## Preflight validation

The deterministic preflight validates the migration sequence, unique versions and filenames, dependencies, marker transitions, classifications, supersession metadata, canonical checksums, and absence of the unsafe checksum. Its hosted authorization phase intentionally fails closed until foundation equivalence, baseline authorization, migration-history resolution, final metadata re-preflight, and checksum-set approval are evidenced.

> **Superseded 2026-08-07.** The sentence above read "the exact nine-file sequence". The preflight never validated a file count and validating one would be a defect: applying a migration promotes it and appending a forward migration lengthens the lineage, so any rule phrased as a length breaks on the next legal change. It validates the sequence by shape — a nonempty historical prefix followed by a nonempty executable suffix — and by membership of the frozen historical floor, which is now ten migrations. The lineage is eleven files.
