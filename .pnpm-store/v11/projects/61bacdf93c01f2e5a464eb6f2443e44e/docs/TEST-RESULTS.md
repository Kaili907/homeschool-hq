# Test Results

Final packaging-correction verification uses the package-local commands in `README.md` and the exact frozen Adaptive Tutor Core v0.2.0 dependency.

| Gate | Final result |
|---|---|
| `pnpm install --ignore-scripts` | PASS; lockfile-pinned dependencies installed without running package scripts |
| Strict TypeScript | PASS, zero diagnostics |
| Windows build | PASS |
| Automated tests | PASS, 11/11 |
| Core contract/package validation | PASS, 317/317 checks across all four modules and all eight required schemas |
| Integration classifications | PASS_DIRECT_CORE_V0_2: 23; PASS_PROVISIONAL_ADAPTER: 10; BLOCKED_CORE_CHANGE: 0; NOT_TESTED: 0 |
| Browser reading validation | PASS; all four support modes, no-choice diagnostic behavior, delayed reasoning, captions, transcript, and no-media fallbacks exercised |
| Browser writing validation | PASS; all four support modes, no-choice diagnostic behavior, delayed reasoning, blank-writing refusal, and learner-owned revision exercised |
| Mobile browser validation | PASS at 390 x 844; single-column layout and no horizontal overflow |
| Browser errors | PASS; zero console warnings, console errors, or page errors |
| Git Bash/MSYS2 script probe | PASS; build, test, and validation scripts returned exit code 0 from the available POSIX-compatible shell |
| Package validation | PASS |
| Core source boundary | PASS, no staged or unstaged Core diff |
| Core-change requests | PASS, zero requests |
| ZIP raw-name audit | PASS; 46 unique safe file entries, 39 nested names with `/`, zero names with `\` |
| ZIP integrity | PASS; every archived entry readable, with no encryption, symlinks, or directory-only records |
| Manifest reconciliation | PASS; every documented file size and SHA-256 matched, with the two generated self-exclusions exact |
| Inventory reconciliation | PASS; all 46 archive entries matched exactly |
| Standard Info-ZIP extraction | PASS; test and extraction returned exit code 0 with no path-separator warning |
| SHA-256 verification | PASS, independently recomputed digest matches the checksum sidecar |

The generated validation report records the per-object contract checks. The delivery response records the corrected ZIP checksum and exact extraction commands. WSL, a Linux host, and a container runtime were unavailable on the assembly machine; the shell probes used Git Bash/MSYS2 with the installed Windows Node runtime, so final independent review should repeat the three Node scripts on a native POSIX Node runtime.
