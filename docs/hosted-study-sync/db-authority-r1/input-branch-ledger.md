# Input branch ledger

Audit base: `19d1ced429b03685b5e9b5759beed4b4a607d1a5`.

`git fetch origin --prune` was run before inspection. The three required tips
matched the expected values exactly:

| Branch | Observed tip | Result |
|---|---|---|
| `study-a1-production-integration-base-c-r2` | `0e62cdf9562a4e6579f97a87023bb5f639c2a7b1` | Exact expected tip; SQL/runtime delta inspected, not merged |
| `study-a1-auth-runtime-boundary` | `9a22ec4a65efc8557881730623bb35c4aa0fd8ad` | Exact expected tip; runtime interruption semantics inspected |
| `study-a1-session-transport` | `8db1af4e6cfa4b572b0d213e30d3a91a2c012658` | Exact expected tip; ephemeral `x-study-session` transport inspected |

Additional relevant observed tips:

| Family | Branch | Observed tip | Database conclusion |
|---|---|---|---|
| Auth infrastructure | `study-a1-auth-infra-boundary-c` | `050a162fd9a40c1643b42452a2be1d69e7323e11` | No additional authoritative SQL; fail-closed outage classification remains runtime-owned |
| Auth infrastructure | `study-a1-auth-infra-boundary-h2` | `462cbd079f90678c2b00809525ae87fde2b4e25d` | Confirms bearer-verifier outage is not learner safety evidence |
| Auth infrastructure | `study-a1-auth-infra-boundary-h3` | `ff53741153247ec7e1a1521503dda6799a9a5369` | No newer Study SQL contract to import |
| Auth infrastructure docs | `study-a1-auth-infra-boundary-h4-doc` | `095ec73ade79f3b84362ced849b3fb39096ab8a3` | Documentation-only tail |
| Session reference | `study-a1-sessionref-hardening` | `230b836e0ac35bcd8adc00cc5ae7be142ad5993f` | Opaque/bounded session reference remains valid; database stores only digest |
| Lifecycle | `study-a1-lifecycle-invalidation` | `b4e47b432ebf56a7815176e77793a43d7496f6e0` | Grant revocation/expiry and student session-version invalidation remain authoritative |
| Lifecycle | `study-a1-lifecycle-hardening` | `8b1ebac5f29b6979ab261bd7b158b091b7a9720e` | Missing or stale session fails closed |
| Lifecycle | `study-a1-lifecycle-authority-c` | `dd00922fbeb5749ac49ff58950ab4994f427ccce` | Host attaches to authority; it does not mint a second lifecycle |
| Production seam | `study-a1-prod-seam` | `5343f554b8e23fecb4b229e8145126007f052ab1` | Runtime composition only |
| Production seam | `study-a1-prod-seam-h2` | `51ff1361e92694082d984a4ecf3b776f2f3bebf0` | Runtime composition only |
| Production dashboard | `study-a1-prod-dash-1` | `01d438ec890eb060d6412402623415d9b243d7aa` | Superseded by later production integration/runtime work |
| Production dashboard | `study-a1-prod-dash-h2` | `4347380e67ac6c6908eb1491b5ae7d99c550d1e1` | Superseded by later production integration/runtime work |
| Production dashboard | `study-a1-prod-dash-h3` | `7e51cb50ef438978feffac201e66c01d3c8f9dc2` | Superseded by later production integration/runtime work |
| Production runtime | `study-a1-prod-runtime-learner-ops-c` | `3831c8585e471841c86b10d41e20506ac877c012` | Historical learner-operation SQL inspected; contested lease not imported |
| Production ports | `study-a1-prod-port-contract-split-c` | `6383a823764ce64ab49003b8728b01fcffc5bf78` | Current narrow runtime surface remains external to this DB lane |
| Production ports | `study-a1-prod-port-contract-guard-convergence-c` | `58973eb7c47eaa53701de7755d27a3f15f55ed55` | Current contract guards remain runtime-owned |
| Dead producer | `study-a1-prod-dead-producer-boundary-h2` | `fbcfa6edae1be422723d591f3a63809b6ccd1adb` | No database object to restore |
| Dead producer | `study-a1-prod-dead-producer-retirement-c` | `96d09fc161c38214aa20efe32b13a393e7d8e638` | No database object to restore |
| Tutor wrapper | `study-a1-prod-tutor-wrapper-c` | `604a7a35dbfe9a489d06ffddead8d5f5d0c1dbfd` | No Tutor activation or content upload in this lane |
| Tutor wrapper | `study-a1-prod-tutor-wrapper-h2` | `82ef67664b81033f45f68ef15e2ea56aba3344fa` | No Tutor activation or content upload in this lane |
| Safe container | `study-a1-production-safe-container-seam-c` | `715c81b5e44caef30d5a422ed73803fe1ebd104d` | Runtime composition only |
| Safe container | `study-a1-production-safe-container-stale-authority-h2` | `ba01ee5613c3fb69d4a443f473dd15b74435666c` | Stale lifecycle epoch must not clear safety; server write rechecks current grant |

No historical branch was merged. Only its durable contracts were re-derived
against the base migration chain and current call sites.
