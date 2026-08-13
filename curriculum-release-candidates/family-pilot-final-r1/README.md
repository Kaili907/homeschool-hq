# Family Pilot final structural curriculum candidate R1

This directory is a structural release candidate over immutable, SHA-pinned inputs. It contains indexes, schedules, evidence references, correction custody, and deliberately unbound production-admission slots. It does not copy or silently rewrite lesson instruction.

Supported internal grades are 3, 4, 5, 7, 8, 9, 10, 11, and 12. Grade 6 is absent. The matrix contains the existing ten Manuel Academy subject families only. External World Language tracking is separate and non-blocking.

Rebuild with `python3 build_release.py`; verify the generated structure and checksums with `python3 build_release.py --validate-only`.
