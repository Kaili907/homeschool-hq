# Clean-extraction release gate

Status: **PASS**.

The candidate archive was extracted into an empty temporary directory. The raw central directory was checked for traversal, absolute/drive-qualified paths, backslashes, empty segments, encryption, symlinks, duplicate names, case collisions, personal paths, embedded ZIPs, and `node_modules`. Every manifested payload file matched its SHA-256 and size.

Using Node 22 and the packaged lockfile, clean extraction completed `npm ci`, strict TypeScript, 44/44 final-assembly tests, 10/10 desktop/mobile browser tests with Axe, the Vite production build, deterministic generation of all ten traces, and the automated release-evidence audit. The lockfile and source-tree digest were unchanged after build/test, while the bundle and trace digests matched evidence.

The final archive was rebuilt only to insert this report, then its central directory, manifest, source digest, bundle digest, evidence consistency, and package exclusions were re-audited. The external SHA-256 seal is `study-engine/release/final-archive.sha256`.
