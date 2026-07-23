# CYCLE — SESSION 2 (MS): Star Economy

- **Session:** SESSION 2 (MS)
- **Milestone:** MS — Star economy (per `Homeschool-HQ-Stars-Addendum-v2-2.md`)
- **Branch:** `ms-star-economy`
- **Worktree:** `../hq-ms`
- **Dev port:** 5175
- **Base:** master @ ce330a9 (tags through v2.0-mt1)

## Scope
Star currency for playful-theme profiles (grades 3 & 4); grade-6 "cool" opt-in
(default OFF); teens never see stars. Earned in-app, tracked in an append-only
ledger, redeemed for real-world prizes with Dad's approval.

Five load-bearing design principles (do not "improve"):
1. Stars pay for **effort/completion, not correctness** (accuracy = small bonus only).
2. Stars are **never deducted** except by redemption. No penalties/expiry/negatives.
3. **Assessments are never starred** (placement & quizzes stay consequence-free).
4. **Dad is the bank** — all redemptions require parent approval.
5. Celebration (confetti/cheers) stays separate from stars.

## Earning hooks (located Phase 0)
- Practice-completion: `App.tsx` practice-screen `onFinish` (NOT placement — that's an assessment).
- Mission-completion + weekly streak: transition through `missions.ts` (`setItemDone` / `autoCompletePractice`).

## Out of scope
H1's conversions of existing code, MM, MT-V, tutor/voice files, assessment logic.
(New state writes here are written as functional updates from the start; expect a
rebase over H1's functional-update conversion at merge.)

## Rules
Branch only, END AT A REPORT — no merge, no tag. Additive/optional schema fields
only (no schemaVersion bump; follows M2/M4/MT-1 precedent), documented in MIGRATIONS.md.
