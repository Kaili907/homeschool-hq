# Unified privacy matrix

| Data class | Study event | Parent evidence | Adult-private store | Release traces |
|---|---|---|---|---|
| Opaque learner/session/lesson IDs | Allowed | Minimized | Authorized | Synthetic only |
| Correctness, confidence band, reason code | Allowed | Minimized summary | Allowed if authorized | Synthetic only |
| Raw learner answer | Forbidden | Forbidden | Not created by this runtime | Forbidden |
| Raw transcript or disclosure | Forbidden | Forbidden | Host design required; not implemented | Forbidden |
| Name, email, phone, address | Filter/reject | Forbidden | Separate authorized boundary required | Forbidden |
| Credentials/tokens/cookies | Reject | Reject | Reject | Forbidden |
| Adult-private note body | Forbidden | Forbidden | Separate RLS-protected record only | Forbidden |
| Diagnosis/permanent attention label | Forbidden | Forbidden | Forbidden | Forbidden |
| Hidden behavioral score | Forbidden | Forbidden | Forbidden | Forbidden |

Static and runtime adversarial tests cover raw-answer, transcript, PII, credential, adult-private note, diagnosis, permanent-label, and hidden-score leakage. Release files contain no personal home-directory path.
