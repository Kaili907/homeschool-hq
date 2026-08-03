# Rollback plan

Before hosted authorization, rollback is Git-only: abandon the candidate branch/worktree. Source branches and hosted state are unchanged.

After a separately authorized migration application, stop delivery workers first, disable the feature, preserve immutable audit/receipt evidence, and follow the approved per-migration recovery plan. Do not replay historical foundation SQL, delete evidence, repair history ad hoc, or downgrade to v1 writable authorities. A migration failure inside its transaction must leave no partial objects; a post-commit failure requires a separately reviewed additive recovery migration.
