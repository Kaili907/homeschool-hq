# W3-08 Validation

The focused deterministic suite covers:

| Case | Expected decision |
| --- | --- |
| Unknown retention class/duration | `static-fallback-required` |
| Training enabled | `ineligible` |
| Minor data unsupported | `ineligible` |
| Wrong data-residency region | `ineligible` |
| Expired policy evidence | `static-fallback-required` |
| Multimodal not approved | `ineligible` |
| Contract/policy revision mismatch | `static-fallback-required` |
| All requirements satisfied | `eligible` |

Additional coverage checks missing registry profiles, excessive retention,
deletion and provider-status violations, and immutable trusted-registry
snapshots. Validation is local only and requires no credentials or network.
