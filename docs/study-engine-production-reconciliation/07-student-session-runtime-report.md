# Student-session runtime report

Direct student access is intentionally **not-ready**. The contract requires a trusted-server issuer that produces opaque, server-verifiable grants scoped to explicit Study capabilities and expiry. No approved issuer is present in this candidate.

The frozen RC1 runtime also contains a synthetic learner sentinel. Its behavior and checksum remain frozen and verified, but it cannot be presented as a production verified-identity runtime. A separate approved bridge must accept server-derived student identity without altering RC1 custody or allowing a client-provided identity to become authority.

Until both pieces exist, direct student access must stay unavailable even when the feature flag is enabled.
