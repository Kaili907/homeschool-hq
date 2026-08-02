# Portable Reconciliation Test Harness

The five frozen source ZIPs are external inputs and are not embedded in this audit package. Put them in one directory, then point the test harness to that directory with `STUDY_ARTIFACT_DIR`.

The harness expects:

- `CARD-1-STUDY-CONTRACTS.zip`
- `manuel-academy-session-2-study-engine.zip`
- `manuel-academy-study-ux-session-3.zip`
- `manuel-academy-session-4-study-integrations.zip`
- `manuel-academy-adaptive-tutor-core-v0.2.zip`

For compatibility with the originally delivered frozen file, the resolver also accepts `manuel-academy-adaptive-tutor-core-v0.2 .zip` as a relative filename alias. Both names have the same required SHA-256 check.

If the environment variable is unset, the harness resolves files from `./artifacts`, relative to the current working directory.

## Linux and macOS

```bash
STUDY_ARTIFACT_DIR=/path/to/five-zips node --test adaptive-tutor/study-engine/tests/reconciliation/reconciliation.test.mjs
```

## Windows PowerShell

```powershell
$env:STUDY_ARTIFACT_DIR="C:\path\to\five-zips"
node --test adaptive-tutor/study-engine/tests/reconciliation/reconciliation.test.mjs
```

## Preflight only

```bash
STUDY_ARTIFACT_DIR=/path/to/five-zips node adaptive-tutor/study-engine/reconciliation/artifact-resolver.mjs
```

A missing-input run prints one controlled list of missing filenames and explains how to set `STUDY_ARTIFACT_DIR`. It exits unsuccessfully without exposing a raw filesystem `ENOENT` error.

The compatibility probe does not require the five ZIPs:

```bash
node adaptive-tutor/study-engine/reconciliation/compatibility-probe.mjs
```

Package maintainers can additionally set `STUDY_RECON_PACKAGE` to the sealed
R2 ZIP path to make the final ownership test inspect its raw central directory.
When this optional variable is absent, the same test audits the extracted
package tree, so the standard commands above remain self-contained.
