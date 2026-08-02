# Session 7-R1 portability and packaging agent report

Agent scope: archive portability and packaging only. No runtime bridge,
timezone, canonical-state, UI, or Tutor Core file was changed.

## Existing Session 7 archive: raw result

Audited archive:
`MANUEL-ACADEMY-SESSION-7-STUDY-STUDENT-RUNTIME.zip`

| Field | Raw result |
| --- | --- |
| Expected SHA-256 | `9448B7F91519FDF7213A8939ED5458B9749E58DBF8054F64A56E3F548482097D` |
| Observed SHA-256 | `9448B7F91519FDF7213A8939ED5458B9749E58DBF8054F64A56E3F548482097D` |
| Size | 4,910,937 bytes |
| Central-directory entries | 183 |
| File entries | 178 |
| Directory entries | 5 |
| Entries containing `\` | 183 |
| Entries containing `/` | 0 |

The archive is therefore byte-authentic but not path-portable. Every raw
central-directory name contains Windows separators. The same raw name bytes
also appear in the corresponding local headers; this is not a display or
library-normalization artifact.

All other checks in the isolated audit passed for the existing archive:

- zero absolute or rooted names;
- zero parent traversal segments;
- zero duplicate raw names;
- zero case- or Unicode-normalization-colliding names;
- zero ZIP-encoded symbolic links;
- zero recognizable personal home-directory names;
- zero embedded ZIPs;
- zero `node_modules` entries;
- zero invalid or ambiguous names;
- exact local-header/central-directory name parity;
- one non-ZIP64 disk with matching entry counts; and
- zero encrypted entries.

The exact failure is consequently limited to separator encoding, but it
affects every entry and must be corrected by rebuilding the archive.

## Cause

The Session 7 release was created on Windows with PowerShell
`Compress-Archive` over a staged filesystem tree. That cmdlet derived entry
names from Windows paths and wrote the backslashes into both ZIP filename
records. Windows `Expand-Archive` and .NET `ZipArchive` accept those names, so
the prior clean-extraction and byte-parity checks passed without detecting
the interoperability defect.

Re-running `Compress-Archive` over another Windows staging tree will reproduce
the problem. Renaming the output file, changing the staging root, or checking
the extracted files does not correct the raw entry names.

## Added raw audit

The isolated, dependency-free Node 22 audit is:

`tests/student-runtime/scripts/audit-portable-zip.mjs`

Run it from the packaged repository root:

```text
node adaptive-tutor/study-engine/tests/student-runtime/scripts/audit-portable-zip.mjs <archive.zip>
```

Append `--json` for a machine-readable record. Exit codes are:

- `0`: every portability check passed;
- `1`: the ZIP was structurally readable but at least one policy check failed;
- `2`: usage error or malformed/unsupported archive structure.

The utility reads raw EOCD, central-directory, and local-header bytes. It does
not rely on an extraction library's path normalization. It audits:

1. forward-slash-only names;
2. relative, non-traversing names;
3. duplicate names;
4. case and Unicode-normalization collisions;
5. Unix-mode symlinks;
6. personal home-directory prefixes;
7. embedded `.zip` files;
8. `node_modules` path segments;
9. empty, control, dot, empty-interior, or ambiguously encoded names;
10. raw local/central filename parity;
11. single-disk, non-ZIP64 structure with matching entry counts; and
12. encrypted entries.

Running it against the current archive returns exit `1` with exactly 183
`forwardSlashOnly` violations and no other violations.

## Corrected deterministic packaging procedure

Do not use `Compress-Archive` for the corrected artifact. Use an explicit ZIP
writer (`System.IO.Compression.ZipArchive` is sufficient) and pass each
portable entry name to `CreateEntry` rather than passing a directory to a
convenience archiver.

The release procedure should be:

1. Create a new, uniquely named staging root and refuse to reuse an existing
   directory.
2. Copy only the curated package inputs named by the Session 7-R1 source
   manifest. Do not copy a containing directory wholesale.
3. Exclude the prior and new release ZIPs, adjacent checksum files,
   `node_modules`, test artifacts, embedded frozen input ZIPs, and superseded
   screenshots.
4. Inventory every file and directory before opening the output ZIP. Reject
   any filesystem reparse point or symbolic link.
5. Compute every archive name relative to the staging parent, replace the
   platform separator with `/`, normalize to Unicode NFC, and run the same
   path-policy checks used by the raw audit.
6. Reject duplicate names and names that collide after NFC normalization plus
   invariant lowercase conversion.
7. Sort entries with ordinal comparison. Directory records are optional; if
   used, emit only required directories, with one trailing `/`, in the same
   sort order.
8. Create each entry explicitly with its already validated forward-slash
   name. Use one pinned packaging runtime and compression setting.
9. Set one fixed ZIP-compatible timestamp on every entry. Do not copy local
   filesystem timestamps, owners, ACLs, absolute paths, or platform-specific
   extra fields.
10. Stream bytes from each staged regular file into its entry; never add the
    release ZIP to its own staging tree.
11. Close the writer, calculate SHA-256, then run the raw audit above. A
    nonzero exit blocks release.
12. Extract into a second new path and compare the extracted relative-path
    set, byte lengths, and SHA-256 values with the staged tree.

For repeatability, record the exact Node version, PowerShell/.NET version,
entry ordering, fixed timestamp, and compression mode in the validation
report. If byte-for-byte reproducibility across different operating systems
is required, use stored entries (no compression) or pin one creator image;
DEFLATE byte streams are not guaranteed identical across different runtime
implementations even when extracted content is identical.

## Required final audit assertions

The corrected archive is releasable only when the raw audit reports:

```text
PASS forwardSlashOnly
PASS relativePathsOnly
PASS noTraversalPaths
PASS noDuplicatePaths
PASS noCaseCollidingPaths
PASS noSymlinks
PASS noPersonalHomeDirectoryPaths
PASS noEmbeddedZipFiles
PASS noNodeModules
PASS validPortableNames
PASS localAndCentralNameParity
PASS singleDiskNonZip64
PASS unencryptedEntries
```

The final validation should additionally record:

- zero raw filename bytes equal to backslash;
- a Windows clean extraction and content-hash comparison;
- an independent ZIP extractor result (for example BSD `tar`/`unzip`);
- clean extracted-package install, build, unit, and browser runs;
- the final file count, uncompressed byte count, ZIP byte size, and SHA-256.

Forward-slash relative names, absence of case collisions and symlinks, and
local/central header parity are the archive-level conditions needed by
Windows, Linux, and macOS extractors. Only Windows extraction was exercised
for the original Session 7 package; a claim of actual Linux or macOS execution
must not be made unless those environments are run during the R1 release
gate.

## Packaging caveats for the final handoff

- The final ZIP SHA-256 cannot be embedded inside that same ZIP without
  changing the digest. Store it in an adjacent checksum file and report it in
  the dispatch handoff.
- A raw audit JSON containing the final hash has the same circularity if it is
  embedded. Generate that record adjacent to the completed ZIP, or embed an
  audit template/result without the final archive digest.
- The final archive must not contain any of the four verified frozen input
  ZIPs. Only the approved extracted files needed by the source package may be
  included.
- Package creation must happen only after the genuine Session 6 adapter,
  Session 5-R2 provenance, timezone work, tests, traces, screenshots, and
  reports are final; otherwise its manifest and checksum will immediately be
  stale.

