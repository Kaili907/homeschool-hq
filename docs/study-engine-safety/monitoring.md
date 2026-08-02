# Monitoring schema and alerts

External monitoring is not configured in this session. A production adapter must durably record the exact runtime event schema:

```json
{
  "schemaVersion": 1,
  "eventId": "uuid",
  "name": "enumerated-event",
  "service": "study-safety",
  "severity": "info|warning|critical",
  "occurredAt": "ISO-8601",
  "code": "enumerated-code",
  "metricName": "enumerated-metric",
  "runbookId": "enumerated-runbook",
  "attributes": {}
}
```

Unknown names, severity/code combinations, attributes, subject IDs, and strings are rejected.

| Event | Metric | Severity | Recommended alert | Runbook |
| --- | --- | --- | --- | --- |
| `study_safety.classifier_unavailable` | `study_safety_classifier_unavailable_total` | critical | any production occurrence | `classifier-failure` |
| `study_safety.classifier_malformed_response` | `study_safety_classifier_malformed_response_total` | critical | 1 warning; 2 in 10m critical | `classifier-failure` |
| `study_safety.classification_urgent` | `study_safety_classification_total` | critical | route to authorized operational review; never include identity in metric | `urgent-classification` |
| `study_safety.classification_uncertain` | `study_safety_classification_total` | warning | trend and route to authorized operational review | `uncertain-classification` |
| `study_safety.outbox_backlog` | `study_safety_outbox_pending_jobs` | warning | urgent oldest >2m warning/>5m critical; other >10m/>30m; count >25/>100 | `outbox-backlog` |
| `study_safety.delivery_repeated_failure` | `study_safety_delivery_failure_total` | warning | attempt 2 warning; terminal failure critical in alert policy | `delivery-failure` |
| `study_safety.proposal_duplicate` | `study_safety_duplicate_proposal_total` | info | anomaly alert on sustained increase | `duplicate-proposal` |
| `study_safety.recipient_resolution_failure` | `study_safety_recipient_resolution_failure_total` | warning | any urgent proposal; rate threshold for other urgency | `recipient-resolution` |
| `study_safety.request_unauthorized` | `study_safety_request_unauthorized_total` | warning | rate/anomaly threshold, not individual paging | `unauthorized-request` |
| `study_safety.request_rate_limited` | `study_safety_request_rate_limited_total` | warning | sustained rate or actor-hash concentration | `rate-limit` |
| `study_safety.provider_timeout` | `study_safety_provider_timeout_total` | warning | 2 in 10m warning; circuit transition critical | `classifier-failure` |
| `study_safety.circuit_breaker_open` | `study_safety_circuit_breaker_transition_total` | critical | any transition to open | `classifier-failure` |

## Dashboard requirements

Display readiness by deployment, classification counts by outcome without learner dimensions, provider failure/latency and breaker state, proposal duplicate rate, recipient-resolution failures, pending outbox count and oldest age by urgency, attempts by structured outcome, verified deliveries, terminal failures, and unauthorized/rate-limit rates. Correlation must use operational event IDs or opaque proposal/attempt references only in access-controlled drill-down systems, never raw text.
