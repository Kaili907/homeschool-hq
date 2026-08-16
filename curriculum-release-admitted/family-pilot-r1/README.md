# Manuel Academy Family Pilot admitted curriculum release R1

This directory is the deterministic, production-bound admission plane for the
Family Pilot. It binds every one of the 8,292 structural lesson references to
exactly one final production package and scoring authority without copying or
modifying any source curriculum corpus.

All inputs are pinned to full Git commit and tree SHAs in `source-ledger.json`.
The adapter in `admit_candidate.ts` explicitly maps the structural indexes into
the existing `src/curriculum/release-admission` contract and exercises its
inspection, validation, admission, browser projection, registry, and readiness
builders. Standards advisory states remain advisory/reference-only.

Rebuild with:

```bash
python3 curriculum-release-admitted/family-pilot-r1/build_release.py
```

Validate the committed artifact checksums with:

```bash
python3 curriculum-release-admitted/family-pilot-r1/build_release.py --validate-only
```
