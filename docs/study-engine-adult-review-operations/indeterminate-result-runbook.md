# Indeterminate Result Runbook

An outcome is indeterminate when submission may have occurred but a verified
receipt was not committed—for example, timeout after submission or a worker
crash after provider acceptance.

1. Do not retry the send.
2. Confirm the job remains `indeterminate` and retain the immutable attempt
   evidence.
3. Query the provider by attempt/idempotency reference only when the approved
   adapter supports authoritative reconciliation.
4. If a matching verified receipt is returned, validate every binding and
   commit `delivered` once.
5. If authoritative evidence proves rejection/non-submission, apply the bounded
   safe-retry decision through the operations adapter.
6. If the provider cannot resolve the outcome, leave the job indeterminate for
   operator decision; do not manufacture delivery evidence.
7. Investigate `study.adult_review.indeterminate_job` and related provider
   timeout/circuit events. Never place recipient contact or safety text in the
   incident record.
