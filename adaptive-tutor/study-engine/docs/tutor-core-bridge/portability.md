# Portable ESM package boundary

The Study–Core bridge is a private, bridge-local ESM package at version
`1.0.1`. Its bridge contract remains version `1`.

`bridges/tutor-core/package.json` is the nearest package boundary for the
TypeScript source. It declares `"type": "module"` so `NodeNext` resolves the
source’s explicit `.ts` import specifiers consistently even when the delivery
ZIP is extracted without the repository-root `package.json`.

The package intentionally has no dependencies, development dependencies,
package-manager override, install script, or packaged `node_modules`.
Consequently, the nested private package does not change the authoritative
repository’s npm and `package-lock.json` workflow.

## Clean-tree validation

The portability suite accepts tool locations from the test environment:

- `SESSION6_NODE22` may name a Node 22 executable. If omitted, the Node
  executable running the test is used and must itself be Node 22.
- `SESSION6_TSC` must name the JavaScript CLI file for an externally supplied
  TypeScript compiler.
- `SESSION6_R2_PACKAGE_ZIP` may name the final R2 ZIP. When supplied, the suite
  validates and extracts that archive itself. Otherwise, it copies only the
  three owned delivery roots into a clean temporary tree.

The suite then verifies that no root `package.json` or bridge `node_modules`
exists and runs:

```text
tsc -p adaptive-tutor/study-engine/bridges/tutor-core/tsconfig.json --noEmit
```

It also imports `src/index.ts` with Node 22’s type-stripping support. The test
uses only environment-supplied tool locations; it does not infer a username,
home directory, drive letter, or repository checkout path.

## Cross-platform archive rules

Archive entry names are always forward-slash-separated and relative to one of
the three owned roots. The packager and portability test reject:

- POSIX absolute paths;
- Windows drive-qualified paths;
- backslashes;
- traversal or empty path segments;
- duplicate or case-colliding entries;
- symbolic links; and
- entries outside bridge, bridge-test, or bridge-documentation ownership.

The portability test independently simulates destination construction with
Windows and POSIX path implementations. POSIX rules cover both Linux and
macOS, whose ZIP entry-name semantics are identical for this package.
