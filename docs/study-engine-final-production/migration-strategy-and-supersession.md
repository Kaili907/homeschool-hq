# Migration strategy and supersession

Strategy A is selected. Repository policy freezes the three historical foundation migrations and requires additive repair for definitions that have entered hosted history. It does not freeze a Study migration that verified hosted preflight proved was never applied.

`20260801170000_academy_study_adult_review_operations.sql` is therefore corrected in place before first application. The unsafe accepted checksum `46C68426D21A79B90A3011D5FBFCCA19044393887636DD845CA362F6E4E69443` is classified `superseded-before-first-application`. It must never appear in the executable approved checksum set.

The corrected checksum and any narrow Session 19 reconciliation migration are recorded in `migration-manifest.json`. No migration was applied locally to a hosted project.

The corrected canonical LF checksum is `562b67462148d9e94933b0fd9007fad37a3b0a08cb8432383c0b228088c0d8eb`. The additive final reconciliation migration is `20260801190000_academy_study_final_production_reconciliation.sql`, with canonical LF checksum `d4ccea295aac2bda67dbfd310650e1c625de867485ecc47f5e993f74c8006d00`.

The deterministic preflight validates the complete manifest sequence, unique versions and filenames, dependencies, marker transitions, classifications, supersession metadata, canonical checksums, and absence of the unsafe checksum. The sequence now includes the provider-attempt journal and its additive Study safety accounting migration; both remain `not-applied-hosted`. Its hosted authorization phase intentionally fails closed until foundation equivalence, baseline authorization, migration-history resolution, final metadata re-preflight, and checksum-set approval are evidenced.
