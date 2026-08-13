# Mathematics learner audit harness

Run the exhaustive audit and regenerate the four evidence artifacts:

```bash
python3 scripts/audit-learner-mathematics/audit.py
```

Verify committed artifacts and run the negative-control/unit harness:

```bash
python3 scripts/audit-learner-mathematics/audit.py --check
python3 -m unittest scripts/audit-learner-mathematics/test_audit.py
```

The harness reads every active Mathematics schedule row, package, answer key,
admitted binding, browser projection contract, and learner response contract.
It writes only beneath `docs/learner-audits/mathematics/`.
