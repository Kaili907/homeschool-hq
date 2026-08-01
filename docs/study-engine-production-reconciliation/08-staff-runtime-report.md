# Staff runtime report

Staff Study access is explicitly disabled. No imported session supplied an approved staff authorization model.

Enabling it requires all of the following:

- a trusted-server authorization implementation;
- an approved, versioned permission model with explicit Study permissions;
- learner/household scope enforcement;
- durable audit evidence recorded before or atomically with privileged effects;
- RLS and RPC tests for allowed, denied, cross-household, expired, and revoked cases.

Generic staff identity or a UI role is insufficient.
