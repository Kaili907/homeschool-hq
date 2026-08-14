# Authoritative input ledger

| Input | SHA | Treatment |
| --- | --- | --- |
| Base | `7baf8dfbc27168708ed4cf504285a1838d7345f6` | branch base |
| State contract | `88b585bf012065d8a6608a116aee6115db9909aa` | integrated |
| DB/RPC R2 | `9b13bd98e7b806151c96ee3546216887486aa60c` | integrated with required parent `b4c831b736f8de337cfac4f8a58f4be4bb5db873` |
| Client | `e5f1d82ff38ade95fce271d96e625f6a5f4339f6` | integrated, then reconciled to installed RPCs |
| First link | `745a2105e4ba904cdcb3cfcdf25e8f074bb663c8` | integrated |
| E2E R2 | `b5b83eaea488c6679cf844f41c3d8bd500669c7a` | integrated, then replaced with 36 adapter scenarios |
| Staging preflight | `89ef0932c59b31da2953082d647645bd196f394d` | integrated; local/read-only behavior only |
| Security R2 | `0febff50171657f1994d5f0b50a2c16f9b69e8d5` | evidence only; no runtime activation dependency |

The production privacy-gate Session 5 moving SHA was intentionally not used.
