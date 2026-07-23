# HOMESCHOOL HQ — STAR ECONOMY ADDENDUM (Spec v2.2)
**Companion to Build-Spec-v2 and Tutor-Addendum-v2-1 · Adds milestone MS (Stars)**
**Build order: MS slots immediately after M2 (it hangs off Morning Mission completion). Revised order: M1 → M2 → MS → MT-1 → M3 → ...**

## Scope
Star currency for the **playful-theme profiles only** (3rd & 4th graders). The 6th grader ("cool" theme) can opt in later via a Grown-Ups toggle with subtler styling; teens never see stars. Stars are earned in-app, tracked in-app, and redeemed for real-world prizes with Dad's approval.

## Design principles (load-bearing — do not "improve" these)
1. **Stars pay for effort and completion, not correctness.** Accuracy earns only a small bonus. A kid having a hard day must still earn well by finishing.
2. **Stars are NEVER deducted except by redemption.** No penalties, no expiry, no negative balances. Ever.
3. **Assessments are never starred.** Placement quests and quizzes stay consequence-free so results stay honest.
4. **Dad is the bank.** All redemptions require parent approval. Kids cannot self-redeem.
5. Celebration of mastery (confetti, cheers) stays separate from stars — one is pride, the other is paycheck.

## Data model
```ts
interface StarState {              // added to Profile for playful-theme profiles
  balance: number;
  lifetimeEarned: number;
  ledger: LedgerEntry[];           // every earn and spend, timestamped, reason string
  pendingRedemptions: { prizeId: string; requestedAt: ISODate }[];
}
interface Prize {                  // global, Dad-edited in Grown-Ups panel
  id: string; name: string; emoji: string; cost: number; active: boolean;
}
```
Ledger is append-only. Balance must always equal ledger sum — add an invariant check on load; mismatch = flag in Grown-Ups panel, never silent repair.

## Earning table (defaults; Dad-editable in Grown-Ups panel)
| Event | Stars |
|---|---|
| Daily practice session completed (all 15 questions) | 8 |
| Accuracy bonus: ≥80% on the session | +3 |
| Tutor-retry solved correctly after a walkthrough (MT-1) | +2 each, max +6/day |
| Morning Mission fully complete | 5 |
| Weekly streak bonus (4 mission days in a week) | 10 |
**Daily cap: 25 stars** (prevents grinding). Typical honest week ≈ 60–75 stars.

Earn moments get a short star-fly animation to the wallet counter + sound (respects global mute). No animations longer than 1.5s — school time, not a casino.

## Screens
- **Wallet:** star count always visible on the kid's home header. Tapping it opens the ledger (kid-readable: "Tue — finished practice ⭐8").
- **Prize Shop:** grid of active prizes (emoji, name, cost). Affordable prizes glow. Tap → "Ask Dad!" confirm → creates pendingRedemption, wallet shows the hold. Kid-side copy is cheerful and final: no nagging notifications.
- **Grown-Ups panel additions:** prize CRUD (name/emoji/cost/active), pending redemption approve/deny (deny returns nothing to approve — stars only move on approve), per-kid ledger view, earning-table editor, manual grant/adjust with required reason (for real-world bonuses like "helped sister with hiragana ⭐5").

## Acceptance criteria
Session completion, mission completion, and streak each pay per table into the ledger; daily cap enforced; balance = ledger sum invariant holds after 50 mixed events (test); redemption flow: kid requests → parent approves → balance drops + ledger entry, and deny leaves balance untouched; teen and (default) cool profiles show zero star UI; export/import round-trips StarState.

---

# STARTER PRIZE MENU (household side — Dad's list, edit freely)
Priced against ~60–75 stars/honest week. Enter these in the Grown-Ups panel once MS ships; until then, run it on paper — a star jar per girl works day one.

**Quick wins (save a day or two):**
- 🍦 Special treat pick — 30
- 🎵 Dance party DJ for the evening — 25
- 🛏️ Stay up 15 min late — 35
- 🍕 Pick Friday dinner — 40

**Medium (save a week or two):**
- 🎬 Family movie night — her pick — 100
- 🏪 Dollar-store trip ($5 budget) — 150
- 🎨 New art supplies — 175
- 👩‍🍳 Bake-with-Dad session, her recipe — 125

**Big goals (save a month+; the real lesson):**
- 🧸 Toy or book up to $20 — 800
- 🎳 Special outing of her choice (bowling, trampoline park...) — 1,000
- 🎟️ Day trip she plans with Dad — 1,500

**House rules to announce with the launch:** stars never expire and are never taken away · prizes can change but never mid-save (if she's saving for it, the price is locked) · sisters can pool stars for a shared prize if both agree · Dad can award bonus stars for real-world greatness anytime.
