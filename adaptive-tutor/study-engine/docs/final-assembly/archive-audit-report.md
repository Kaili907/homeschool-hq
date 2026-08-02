# Portable archive audit

Result: **PASS**.

The release builder creates normalized forward-slash paths under one `adaptive-tutor/` root, fixed timestamps, deterministic ordering, regular-file attributes, and DEFLATE compression. It excludes input ZIPs, the output ZIP itself, `node_modules`, Vite caches, test artifacts, coverage, and Git metadata.

The post-build audit requires:

- one exact and one case-folded name per entry;
- no absolute, drive-qualified, traversal, backslash, empty, encrypted, or symlink entry;
- no personal home path in names or text payload;
- exact manifest size and SHA-256 for every declared payload;
- exact evidence/manifest file count;
- no unexpected payload or embedded archive.

The archive SHA-256 is externally sealed after creation to avoid a circular self-hash. The seal file is not embedded in the archive.
