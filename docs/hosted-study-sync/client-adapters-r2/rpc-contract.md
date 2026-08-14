# Exact R2 RPC contract

The client builders emit these exact argument objects:

```text
first_link_v2:      p_token_digest, p_student_id, p_client_operation_id, p_import
resolve_mapping_v2: p_token_digest, p_student_id, p_local_scope
hydrate_v2:         p_token_digest, p_student_id, p_assignment_ref, p_session_id
write_v2:           p_token_digest, p_student_id, p_assignment_ref, p_session_id,
                    p_expected_revision, p_client_operation_id, p_operation, p_payload
```

No client method maps to a nonexistent database function. There is no separate
acknowledgement RPC: response-loss recovery repeats the original exact request
with its original UUID and fingerprint.
