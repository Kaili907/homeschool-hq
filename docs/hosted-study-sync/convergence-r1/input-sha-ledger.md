# Input SHA ledger

| Lane | Branch | Audited SHA | Convergence import |
|---|---|---:|---|
| Audited Family Pilot | `mac/final-family-pilot-launch-audit-r1` | `19d1ced429b03685b5e9b5759beed4b4a607d1a5` | convergence base |
| DB + authority | `mac/hosted-study-db-authority-r1` | `2e1764d99f2fc2602165d9eef08152af5b1fd5a7` | exact feature commit |
| Identity | `mac/cross-device-identity-bridge-r1` | `f254ae1d6c71b3cea32ec087810c8c7e7186d981` | exact feature commit |
| Transport | `mac/hosted-study-sync-transport-r1` | `a347bd6f2fe854ddaf053effbbb0c275abba732d` | exact feature commit |
| Reconciliation | `mac/hosted-study-conflict-offline-r1` | `26c1eb6399bdfd5075c31ff2c853119a11fff3aa` | exact feature commit |
| E2E harness | `mac/hosted-study-sync-e2e-harness-r1` | `70525566d462f7fe379aa7b21efff27139f58bbf` | exact feature commit |
| Web Pilot release | `mac/family-pilot-web-release-r1` | `c81ddb6e04bc1c3629212327d47817c1b5677477` | four-commit lane chain ending at exact tip |

Every ref resolved to the stated SHA. Every feature lane shared base
`19d1ced429b03685b5e9b5759beed4b4a607d1a5`. The web tip was a documentation
follow-up, so its complete four-commit lane delta was imported in order rather
than cherry-picking an incomplete tip against a missing parent.
