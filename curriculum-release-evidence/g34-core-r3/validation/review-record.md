# Independent review of this evidence set, and what it changed

One standards/custody reviewer went over this set adversarially before it was committed,
with a brief to break the claims rather than confirm them. It re-derived page ranges from
the extraction markers, recomputed every hash, recomputed the before/after counts from the
release's own rollup, and spot-checked locators against the extracted source directly.

It confirmed: custody (all 8 hashes, byte counts, page counts, michigan.gov primaries), all
124 verbatim locators byte-for-byte, the non-occurrence claims underpinning every composite
classification, social studies grade attribution, count reconciliation, the empty
`ALIAS_RESOLVED_VERBATIM` bucket, and the single `HUMAN_REVIEW_REQUIRED` ruling.

It found six defects. All six are fixed; the fixes changed no classification outcome, only
the evidence attached to entries and the strength of the checks.

| # | Finding | Disposition |
| --- | --- | --- |
| F1 | **ELA grade-column attribution was wrong for `4.W.9a` / `4.W.9b` (19 citations).** The resolver picked the k-th *line-start* occurrence of a row number, but on the Writing spread the grade 3 cell reads `(Begins in grade 4)` and does not force a line break, so row 9 yielded two cells, not three, and grade 4 was evidenced from the **grade 5** column. | Fixed. Cells are now matched at line start *or* immediately after a closing parenthesis, and any row not resolving to exactly three cells is refused as `HUMAN_REVIEW_REQUIRED` rather than indexed positionally. Both entries now carry grade 4 text. A new check, `ela-grade-column-attribution-unambiguous`, reports refusals. The latent second instance the reviewer identified (`RL.n.8`, "(Not applicable to literature)" collapsing three cells onto one line) is covered by the same fix; neither grade cites it. |
| F2 | **Three mathematics entries carried empty snippets** (`3.MD.2`, `4.MD.6`, `4.NBT.6`) — the item-number regex used `\s*`, which spans newlines, so on tab-run pages the locator started at the top of the run instead of at the digit. | Fixed: the regex is now `[ \t]*`-bounded. All three carry real text. `evidence-locators-resolve` now fails on any empty snippet. |
| F3 | **72 grade-4 science citations were evidenced from the grade 3 section.** `verify_science` took the first whole-document hit, so the three 3-5 engineering-design expectations resolved to their grade 3 printing. | Fixed: science hits are constrained to the grade's own Performance Expectations section, as social studies already was. `evidence-inside-the-cited-grade-section` now enforces it for both subjects. |
| F4 | **The MP.n alias declared itself reversible but did not round-trip** — `resolved_code` carried a document-name prefix the recorded inverse pattern did not accept, so 0 of 12 entries could be inverted with the map as published. `math-domain-composition` declared reversibility with no inverse recorded at all. | Fixed: `resolved_code` now matches the map's own template, and the composition map carries an explicit component-to-house inverse. `alias-round-trips-*` now exercises every recorded pair through the map's own transform and inverse. |
| F5 | **Four of the ten validation checks could not fail** — one was a hardcoded `True`, one read a self-declared boolean, `no-invented-codes` had a disjunct that passed unconditionally for three of four subjects, and two compared against hardcoded totals. | Rewritten. There are now 13 checks and each reads or recomputes something. In particular, "no lesson content touched" is now proven by re-hashing all 239 files sealed by the release's own `SHA256SUMS.txt`, and the before/after totals are recomputed from the release's rollup and index rather than asserted. |
| F6 | Registry snippets are whitespace-collapsed, which was undocumented next to a "character for character" claim. | Documented on every source record (`snippet_normalisation`) and in the README. `char_offset` and the cited code are never normalised. |
| F7 | README imprecisions: "276 distinct codes" is 276 *(course, code)* pairs (267 distinct strings); the ELA legend prints a second full code, `W.5.1a`; the Language Progressive Skills table prints 17 sub-codes, not six. | All three corrected in `README.md` and `sources/source-observations.md`. |

The reviewer's verdict on the set as first built was SOUND WITH CAVEATS, with F1 as the one
exercised overclaim. Every caveat it raised is closed above.
