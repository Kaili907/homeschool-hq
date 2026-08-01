# Authorization context model

Production accepts only a principal verified by a trusted server. A client learner identifier is a selector, never proof of household membership or Study authority.

Guardian access requires server evidence binding the verified principal, household, learner, permissions, issue/expiry times, and session epoch. Direct-student access additionally requires a signed server grant with explicit Study capabilities. Staff access requires an approved server model, explicit Study permission, and a recorded audit event for each privileged action.

Authority objects are versioned, time-bounded, and checked for current session epoch. Expired, mismatched, client-authored, unknown-version, or stale authority is denied. The current production host supplies no authority object, so the route remains unavailable.
